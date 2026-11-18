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

function extractBalancedJson(source, startIndex) {
  let depth = 0, inString = false, escaped = false;
  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return null;
}

function readFlightRecords(pageHtml) {
  // Decode JSON strings, never execute scripts. Multiple pushes can share one script tag.
  const chunks = [];
  const marker = 'self.__next_f.push(';
  let cursor = 0;
  for (;;) {
    const found = pageHtml.indexOf(marker, cursor);
    if (found === -1) break;
    let arrayStart = found + marker.length;
    while (arrayStart < pageHtml.length && /\s/.test(pageHtml[arrayStart])) arrayStart++;
    cursor = arrayStart + 1;
    if (pageHtml[arrayStart] !== '[') continue;
    const rawArray = extractBalancedJson(pageHtml, arrayStart);
    if (!rawArray) continue;
    cursor = arrayStart + rawArray.length;
    let chunk;
    try { chunk = JSON.parse(rawArray); } catch { continue; }
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

function numOrNull(value, digits = 6) {
  return typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function pctOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Number((value * 100).toFixed(2)) : null;
}

function simplifyModel(model, capMap = null, hostMap = null) {
  const costObj = model.intelligenceIndexCostPerTask?.cost ?? model.intelligenceIndexCostPerTask;
  const cost = costObj?.total;
  const score = model.intelligenceIndex;
  // Preserve the original positive-cost admission rule: zeroed source totals
  // are not sufficient evidence that a hosted model is free to run.
  if (!model.id || typeof model.name !== 'string' || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(score) || score < 0 || score > 100) return null;

  const entry = {
    id: model.id, slug: model.slug, name: model.name, shortName: model.shortName || model.name,
    intelligenceIndex: score, cost, creator: creator(model.creator),
    isReasoning: !!model.isReasoning, isOpenWeights: !!model.isOpenWeights,
    deprecated: !!model.deprecated
  };

  if (typeof model.releaseDate === 'string' && model.releaseDate) entry.releaseDate = model.releaseDate;
  if (entry.isOpenWeights && typeof model.openSourceCategorization === 'string' && model.openSourceCategorization) {
    entry.openLicense = model.openSourceCategorization;
  }
  if (typeof model.parameters === 'number' && Number.isFinite(model.parameters) && model.parameters > 0) {
    entry.parametersB = Number(model.parameters.toFixed(1));
  }
  const modalities = [];
  if (model.inputModalityImage) modalities.push('image');
  if (model.inputModalitySpeech) modalities.push('speech');
  if (model.inputModalityVideo) modalities.push('video');
  if (modalities.length) entry.modalities = modalities;

  if (model.release?.slug) {
    entry.family = { slug: model.release.slug, name: model.release.name || model.shortName || model.name };
  }
  if (model.effort?.slug) {
    entry.effort = {
      slug: model.effort.slug,
      label: model.effort.label || model.effort.slug,
      level: Number.isFinite(model.effort.level) ? model.effort.level : 0
    };
  }
  if (Number.isFinite(model.intelligenceIndexTimePerTask) && model.intelligenceIndexTimePerTask > 0) {
    entry.timeSec = Number(model.intelligenceIndexTimePerTask.toFixed(2));
  }
  if (costObj && Number.isFinite(costObj.input) && Number.isFinite(costObj.output)) {
    entry.costBreakdown = {
      input: numOrNull(costObj.input, 5),
      reasoning: numOrNull(costObj.reasoning ?? 0, 5),
      answer: numOrNull(costObj.answer ?? costObj.output, 5)
    };
  }
  const tok = model.intelligenceIndexOutputTokensPerTask;
  if (tok && Number.isFinite(tok.output) && tok.output >= 0) {
    entry.outTokens = {
      reasoning: Math.round(tok.reasoning || 0),
      answer: Math.round(tok.answer || 0),
      total: Math.round(tok.output)
    };
  }
  const subscores = {
    frontierCode: pctOrNull(model.frontierCode20 ?? model.frontierCode),
    terminalBench: pctOrNull(model.terminalBench40),
    hleDiamond: pctOrNull(model.hleDiamond ?? model.hle),
    critptAgentic: pctOrNull(model.critptAgenticHard),
    science: pctOrNull(model.terminalBenchScience ?? model.scicode),
    omniscience: pctOrNull(model.omniscienceAccuracy),
    hallucination: pctOrNull(model.omniscienceHallucinationRate)
  };
  if (Object.values(subscores).some(v => v !== null)) entry.subscores = subscores;

  const caps = capMap?.get(model.id) ?? model.capabilities;
  if (caps && typeof caps === 'object') {
    const domainScores = {
      finance: numOrNull(caps.financeAndAccounting, 2),
      strategy: numOrNull(caps.strategyAndOps, 2),
      legal: numOrNull(caps.legal, 2),
      healthcare: numOrNull(caps.healthcareAndMedical, 2),
      engineering: numOrNull(caps.engineering, 2),
      economics: numOrNull(caps.economics, 2)
    };
    if (Object.values(domainScores).some(v => v !== null)) entry.domainScores = domainScores;
  }

  const rawHosts = hostMap?.get(model.slug);
  if (Array.isArray(rawHosts) && rawHosts.length >= 2) {
    const dedup = new Map();
    const baseShort = (entry.shortName || '').toLowerCase();
    for (const h of rawHosts) {
      const hCost = h?.intelligenceIndexCostPerTask?.total;
      if (!Number.isFinite(hCost) || hCost <= 0 || !h?.host?.name) continue;
      let label = h.host.name;
      const prefix = String(h.shortName || h.name || '').split(',')[0].trim();
      if (prefix && baseShort && prefix.toLowerCase().startsWith(baseShort) && prefix.length > baseShort.length) {
        const qual = prefix.slice(baseShort.length).trim().replace(/^\(|\)$/g, '').trim();
        if (qual && qual.length <= 16) label = `${label} (${qual})`;
      }
      const timeSec = Number.isFinite(h.intelligenceIndexTimePerTask) && h.intelligenceIndexTimePerTask > 0
        ? Number(h.intelligenceIndexTimePerTask.toFixed(1))
        : null;
      const existing = dedup.get(label);
      if (!existing || hCost < existing.cost) {
        dedup.set(label, { host: label, cost: Number(hCost.toFixed(5)), timeSec });
      }
    }
    if (dedup.size >= 2) {
      entry.providers = [...dedup.values()].sort((a, b) => a.cost - b.cost).slice(0, 8);
    }
  }
  return entry;
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

function expectedCodingComponents(rows) {
  let maxCount = 3;
  for (const row of rows) {
    if (Number.isInteger(row?.indexComponentCount) && row.indexComponentCount > maxCount) {
      maxCount = row.indexComponentCount;
    }
  }
  return maxCount;
}

function simplifyCodingAgent(row, requiredComponents = 3, openFamilyNames = null) {
  const cost = row.mean?.costUsd;
  const score = row.indexScore;
  if (!row.id || typeof row.displayLabel !== 'string' || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(score) || score < 0 || score > 1 || row.indexComponentCount !== requiredComponents) return null;
  const creators = row.modelCreators || [];
  const modelCreator = creators.length > 1
    ? { name: creators.map(item => item.name).join(' + '), color: '#64748b' }
    : creators[0] || row.agentCreator;
  const releaseShort = row.model?.release?.shortName || '';
  const isOpen = typeof row.model?.isOpenWeights === 'boolean'
    ? row.model.isOpenWeights
    : !!(openFamilyNames && releaseShort && openFamilyNames.has(releaseShort.toLowerCase()));

  const entry = {
    id: row.id, slug: row.agentSlug, name: row.displayLabel, shortName: row.shortLabel || row.displayLabel,
    codingAgentIndex: score * 100, intelligenceIndex: score * 100, cost,
    creator: creator(modelCreator), agentCreator: creator(row.agentCreator),
    agentName: row.agentName, agentSlug: row.agentSlug, modelName: row.display?.model || row.model?.name,
    isReasoning: !!row.model?.isReasoning, isOpenWeights: isOpen,
    isDefault: !!row.isDefault, isRouter: !!row.isRouter, isUnavailable: !!row.isUnavailable,
    benchmarkCount: row.indexComponentCount
  };

  if (row.agentRelease?.key) {
    entry.family = { slug: row.agentRelease.key, name: row.agentRelease.name || row.agentName || row.displayLabel };
  }
  if (row.model?.effort?.slug) {
    entry.effort = {
      slug: row.model.effort.slug,
      label: row.model.effort.label || row.model.effort.slug,
      level: Number.isFinite(row.model.effort.level) ? row.model.effort.level : 0
    };
  }
  if (Number.isFinite(row.mean?.agentWallTimeSec) && row.mean.agentWallTimeSec > 0) {
    entry.timeSec = Number(row.mean.agentWallTimeSec.toFixed(2));
  }
  if (row.mean && (Number.isFinite(row.mean.steps) || Number.isFinite(row.mean.totalTokens))) {
    entry.agentStats = {
      steps: numOrNull(row.mean.steps, 1),
      totalTokens: Number.isFinite(row.mean.totalTokens) ? Math.round(row.mean.totalTokens) : null,
      cacheHitRate: pctOrNull(row.mean.cacheHitRate)
    };
  }
  const pct = row.percentiles?.costUsd;
  if (pct && Number.isFinite(pct.p50) && Number.isFinite(pct.p95)) {
    entry.costPercentiles = {
      p05: numOrNull(pct.p05, 4),
      p25: numOrNull(pct.p25, 4),
      p50: numOrNull(pct.p50, 4),
      p75: numOrNull(pct.p75, 4),
      p95: numOrNull(pct.p95, 4)
    };
  }
  if (Array.isArray(row.evals) && row.evals.length) {
    const evalScores = row.evals
      .filter(e => e?.evaluationDatasetSlug && Number.isFinite(e?.mean?.reward))
      .map(e => ({ name: e.evaluationDatasetSlug, score: pctOrNull(e.mean.reward) }));
    if (evalScores.length) entry.evalScores = evalScores;
  }
  return entry;
}

function validateRows(rows, minimum, name) {
  if (rows.length < minimum) throw new Error(`Unexpectedly low ${name} count: ${rows.length}`);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`Duplicate ${name} IDs`);
  rows.sort((a, b) => a.cost - b.cost || b.intelligenceIndex - a.intelligenceIndex || a.id.localeCompare(b.id));
}

async function fetchModels(page, sourceUrl, previous, get = getBuffer, { includeHosts = false } = {}) {
  const manifests = readManifests(page);
  // Reuse the previous model manifest as first choice, avoiding unrelated media downloads.
  manifests.sort((a, b) => Number(b.path === previous?.manifestPath) - Number(a.path === previous?.manifestPath));
  const errors = [];
  let modelPayload = null, modelManifestPath = null;
  const cachedPayloads = new Map();

  for (const manifest of manifests) {
    const url = new URL(manifest.path, sourceUrl);
    if (url.origin !== new URL(sourceUrl).origin || !url.pathname.startsWith('/data/')) throw new Error('Unexpected manifest URL');
    try {
      const payload = JSON.parse(decryptPayload(await get(url.href), manifest.key));
      cachedPayloads.set(manifest.path, payload);
      if (!Array.isArray(payload?.models)) continue;
      modelPayload = payload;
      modelManifestPath = manifest.path;
      break;
    } catch (error) { errors.push(error.message); }
  }
  if (!modelPayload) throw new Error(`No valid model manifest: ${errors.join('; ')}`);

  let hostMap = null, hostsManifestPath = null;
  if (includeHosts) {
    const candidates = manifests
      .filter(m => m.path !== modelManifestPath)
      .sort((a, b) => Number(b.path === previous?.hostsManifestPath) - Number(a.path === previous?.hostsManifestPath));
    for (const cand of candidates) {
      try {
        let payload = cachedPayloads.get(cand.path);
        if (!payload) {
          const url = new URL(cand.path, sourceUrl);
          if (url.origin !== new URL(sourceUrl).origin || !url.pathname.startsWith('/data/')) continue;
          payload = JSON.parse(decryptPayload(await get(url.href), cand.key));
        }
        if (Array.isArray(payload) && payload.some(item => item?.modelSlug && item?.host?.name)) {
          hostMap = new Map();
          for (const item of payload) {
            if (!item?.modelSlug) continue;
            if (!hostMap.has(item.modelSlug)) hostMap.set(item.modelSlug, []);
            hostMap.get(item.modelSlug).push(item);
          }
          hostsManifestPath = cand.path;
          break;
        }
      } catch { /* Optional provider manifest; never fail core refresh. */ }
    }
  }

  const capMap = new Map();
  if (Array.isArray(modelPayload.capabilityModels)) {
    for (const capItem of modelPayload.capabilityModels) {
      if (capItem?.id && capItem?.capabilities) capMap.set(capItem.id, capItem.capabilities);
    }
  }

  const models = modelPayload.models.map(m => simplifyModel(m, capMap, hostMap)).filter(Boolean);
  validateRows(models, 50, 'model');
  return { models, manifestPath: modelManifestPath, hostsManifestPath };
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
  const { models, manifestPath, hostsManifestPath } = await fetchModels(modelPage.toString('utf8'), sourceUrl, previous, getBuffer, { includeHosts: true });
  const openFamilyNames = new Set(
    models.filter(m => m.isOpenWeights && m.family?.name).map(m => m.family.name.toLowerCase())
  );
  const requiredComponents = expectedCodingComponents(rawCodingRows);
  const codingAgents = rawCodingRows.map(row => simplifyCodingAgent(row, requiredComponents, openFamilyNames)).filter(Boolean);
  validateRows(codingAgents, 5, 'coding-agent');
  const output = {
    schemaVersion: 2, source: 'Artificial Analysis', sourceUrl, manifestPath,
    ...(hostsManifestPath ? { hostsManifestPath } : {}),
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

module.exports = { getBuffer, readFlightRecords, readManifests, decryptPayload, simplifyModel, resolveFlightReference, readCodingRows, expectedCodingComponents, simplifyCodingAgent, validateRows, fetchModels, writeSnapshot };
if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
