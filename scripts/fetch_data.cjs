const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = 'https://artificialanalysis.ai/';
const CODING_SOURCE = 'https://artificialanalysis.ai/agents/coding-agents';
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

// At most three attempts, only for temporary failures. Never retry a 401/403.
async function getBuffer(url, { fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let retryDelay = (attempt + 1) * 1500;
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': 'intelligence-index-chart-updater/2.0 (+https://github.com/heroliss/intelligence-index-cost-linear)' },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) {
        const error = new Error(`${response.status} ${response.statusText}: ${url}`);
        error.retryable = response.status === 429 || response.status >= 500;
        const retryAfter = response.headers.get('retry-after');
        if (retryAfter) {
          const seconds = Number(retryAfter);
          retryDelay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
          if (!Number.isFinite(retryDelay) || retryDelay > 30000) error.retryable = false;
          retryDelay = Math.max(1500, retryDelay);
        }
        await response.body?.cancel();
        throw error;
      }
      if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw Object.assign(new Error(`Response too large: ${url}`), { retryable: false });
      }
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw Object.assign(new Error(`Response too large: ${url}`), { retryable: false });
        }
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (attempt === 2 || error.retryable === false) throw error;
      console.warn(`Temporary fetch failure; retry ${attempt + 1}/2: ${error.message}`);
      await sleep(retryDelay);
    }
  }
}

function readFlightRecords(pageHtml) {
  // Decode JSON strings, never execute scripts. Chunks can split an individual record.
  const chunks = [];
  for (const match of pageHtml.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)) {
    let chunk;
    try { chunk = JSON.parse(match[1]); } catch { continue; }
    if (chunk[0] === 1 && typeof chunk[1] === 'string') chunks.push(chunk[1]);
  }
  const records = new Map();
  for (const line of chunks.join('').split('\n')) {
    const match = line.match(/^([0-9a-f]+):([\[{].*)$/);
    if (!match) continue;
    try { records.set(match[1], JSON.parse(match[2])); } catch { /* Non-JSON Flight records are not data. */ }
  }
  return records;
}

function walk(value, visitor) {
  if (!value || typeof value !== 'object') return;
  visitor(value);
  for (const child of Object.values(value)) walk(child, visitor);
}

function readManifests(pageHtml) {
  const unique = new Map();
  for (const record of readFlightRecords(pageHtml).values()) walk(record, value => {
    if (typeof value.manifest?.path === 'string' && /^[0-9a-f]{64}$/i.test(value.manifest.key)) {
      unique.set(value.manifest.path, value.manifest);
    }
  });
  // Compatibility with pages containing escaped data outside standard Flight chunks.
  for (const match of pageHtml.matchAll(/manifest\\":\{\\"path\\":\\"([^"\\]+)\\",\\"key\\":\\"([0-9a-f]{64})\\"/gi)) {
    unique.set(match[1], { path: match[1], key: match[2] });
  }
  if (!unique.size) throw new Error('Could not find Artificial Analysis data manifest in the page');
  return [...unique.values()];
}

function decryptPayload(encrypted, keyHex) {
  if (!/^[0-9a-f]{64}$/i.test(keyHex) || encrypted.length <= 16) throw new Error('Invalid manifest payload');
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.createHash('sha256').update(key).digest().subarray(0, 12);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(encrypted.subarray(-16));
  return zlib.gunzipSync(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]), { maxOutputLength: 64 * 1024 * 1024 });
}

function creator(value) {
  return { name: value?.name || 'Other', color: /^#(?:[0-9a-f]{3}){1,2}$/i.test(value?.color || '') ? value.color : '#777777' };
}

function simplifyModel(model) {
  const cost = model.intelligenceIndexCostPerTask?.cost?.total ?? model.intelligenceIndexCostPerTask?.total;
  const score = model.intelligenceIndex;
  // Preserve the original positive-cost admission rule: zeroed source totals
  // are not sufficient evidence that a hosted model is free to run.
  if (!model.id || typeof model.name !== 'string' || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(score) || score < 0 || score > 100) return null;
  return {
    id: model.id, slug: model.slug, name: model.name, shortName: model.shortName || model.name,
    intelligenceIndex: score, cost, creator: creator(model.creator),
    isReasoning: !!model.isReasoning, deprecated: !!model.deprecated
  };
}

function resolveFlightReference(value, records) {
  const visited = new Set();
  while (typeof value === 'string' && /^\$[0-9a-f]+:/.test(value)) {
    if (visited.has(value)) throw new Error('Circular coding-agent data reference');
    visited.add(value);
    const [id, ...keys] = value.slice(1).split(':');
    value = records.get(id);
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('Invalid data reference');
      value = Array.isArray(value) && key === 'props' ? value[3] : value?.[key];
    }
  }
  return value;
}

function readCodingRows(pageHtml) {
  const records = readFlightRecords(pageHtml);
  let rows;
  for (const record of records.values()) walk(record, value => {
    if (Array.isArray(value.benchmarkRows) && (!rows || value.benchmarkRows.length > rows.length)) rows = value.benchmarkRows;
  });
  if (!rows?.length) throw new Error('Could not find coding-agent benchmark rows in public page');
  const resolved = rows.map(row => resolveFlightReference(row, records));
  if (resolved.some(row => !row || typeof row !== 'object' || !row.id)) throw new Error('Unresolved coding-agent benchmark row');
  return resolved;
}

function simplifyCodingAgent(row) {
  const cost = row.mean?.costUsd;
  const score = row.indexScore;
  if (!row.id || typeof row.displayLabel !== 'string' || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(score) || score < 0 || score > 1 || row.indexComponentCount !== 3) return null;
  const creators = row.modelCreators || [];
  const modelCreator = creators.length > 1
    ? { name: creators.map(item => item.name).join(' + '), color: '#64748b' }
    : creators[0] || row.agentCreator;
  return {
    id: row.id, slug: row.agentSlug, name: row.displayLabel, shortName: row.shortLabel || row.displayLabel,
    codingAgentIndex: score * 100, intelligenceIndex: score * 100, cost,
    creator: creator(modelCreator), agentCreator: creator(row.agentCreator),
    agentName: row.agentName, agentSlug: row.agentSlug, modelName: row.display?.model || row.model?.name,
    isReasoning: !!row.model?.isReasoning, isDefault: !!row.isDefault,
    isRouter: !!row.isRouter, isUnavailable: !!row.isUnavailable,
    benchmarkCount: row.indexComponentCount
  };
}

function validateRows(rows, minimum, name) {
  if (rows.length < minimum) throw new Error(`Unexpectedly low ${name} count: ${rows.length}`);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`Duplicate ${name} IDs`);
  rows.sort((a, b) => a.cost - b.cost || b.intelligenceIndex - a.intelligenceIndex || a.id.localeCompare(b.id));
}

async function fetchModels(page, sourceUrl, previous, get = getBuffer) {
  const manifests = readManifests(page);
  // Reuse the previous model manifest as first choice, avoiding unrelated media downloads.
  manifests.sort((a, b) => Number(b.path === previous?.manifestPath) - Number(a.path === previous?.manifestPath));
  const errors = [];
  for (const manifest of manifests) {
    const url = new URL(manifest.path, sourceUrl);
    if (url.origin !== new URL(sourceUrl).origin || !url.pathname.startsWith('/data/')) throw new Error('Unexpected manifest URL');
    try {
      const payload = JSON.parse(decryptPayload(await get(url.href), manifest.key));
      if (!Array.isArray(payload.models)) continue;
      const models = payload.models.map(simplifyModel).filter(Boolean);
      validateRows(models, 50, 'model');
      return { models, manifestPath: manifest.path };
    } catch (error) { errors.push(error.message); }
  }
  throw new Error(`No valid model manifest: ${errors.join('; ')}`);
}

function comparable(snapshot) {
  const { updatedAt, ...data } = snapshot;
  return JSON.stringify(data);
}

async function writeSnapshot(outPath, output, previous) {
  if (previous && comparable(previous) === comparable(output)) return false;
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const temporary = `${outPath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(output, null, 2) + '\n', 'utf8');
    await fs.rename(temporary, outPath);
  } finally { await fs.rm(temporary, { force: true }); }
  return true;
}

async function main() {
  const sourceUrlFile = path.resolve(process.env.SOURCE_URL_FILE || path.join(root, 'source-url.txt'));
  let sourceUrl = process.env.SOURCE_URL;
  if (!sourceUrl) {
    try { sourceUrl = (await fs.readFile(sourceUrlFile, 'utf8')).trim(); } catch { sourceUrl = DEFAULT_SOURCE; }
  }
  const codingAgentSourceUrl = process.env.CODING_SOURCE_URL || CODING_SOURCE;
  const outPath = path.resolve(process.env.DATA_OUTPUT || path.join(root, 'data/current.json'));
  let previous;
  try { previous = JSON.parse(await fs.readFile(outPath, 'utf8')); } catch { /* First run. */ }
  const [modelPage, codingPageBuffer] = await Promise.all([getBuffer(sourceUrl), getBuffer(codingAgentSourceUrl)]);
  const codingPage = codingPageBuffer.toString('utf8');
  const rawCodingRows = readCodingRows(codingPage);
  const codingAgents = rawCodingRows.map(simplifyCodingAgent).filter(Boolean);
  validateRows(codingAgents, 5, 'coding-agent');
  const { models, manifestPath } = await fetchModels(modelPage.toString('utf8'), sourceUrl, previous);
  const output = {
    schemaVersion: 2, source: 'Artificial Analysis', sourceUrl, manifestPath,
    updatedAt: new Date().toISOString(), updateIntervalHours: 2,
    modelIndexVersion: modelPage.toString('utf8').match(/Artificial Analysis Intelligence Index v([\d.]+)/)?.[1] || null,
    modelCount: models.length, models,
    codingAgentSourceUrl,
    codingAgentMethodologyUrl: 'https://artificialanalysis.ai/methodology/coding-agents-benchmarking',
    codingAgentIndexVersion: codingPage.match(/Coding Agent Index v([\d.]+)/)?.[1] || null,
    codingAgentCount: codingAgents.length,
    codingAgentExcludedCount: rawCodingRows.length - codingAgents.length,
    codingAgents
  };
  const changed = await writeSnapshot(outPath, output, previous);
  console.log(`${changed ? 'Wrote' : 'Unchanged:'} ${models.length} models and ${codingAgents.length} coding-agent variants; checked ${new Date().toISOString()}`);
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Artificial Analysis data check\n- Checked: ${new Date().toISOString()}\n- Models: ${models.length}\n- Coding-agent variants: ${codingAgents.length}\n- Excluded coding-agent rows without comparable score/cost: ${output.codingAgentExcludedCount}\n- Snapshot changed: ${changed}\n`);
}

module.exports = { getBuffer, readFlightRecords, readManifests, decryptPayload, simplifyModel, resolveFlightReference, readCodingRows, simplifyCodingAgent, validateRows, fetchModels, writeSnapshot };
if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
