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
      ...(Number.isFinite(costObj.nonCacheInput) ? { nonCacheInput: numOrNull(costObj.nonCacheInput, 5) } : {}),
      ...(Number.isFinite(costObj.cacheRead) ? { cacheRead: numOrNull(costObj.cacheRead, 5) } : {}),
      ...(Number.isFinite(costObj.cacheWrite) ? { cacheWrite: numOrNull(costObj.cacheWrite, 5) } : {}),
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
    hallucination: pctOrNull(model.omniscienceHallucinationRate),
    mlcr: pctOrNull(model.mlcrOverall),
    mmmuPro: pctOrNull(model.mmmuPro),
    ifbench: pctOrNull(model.ifbench)
  };
  if (Object.values(subscores).some(v => v !== null)) entry.subscores = subscores;

  const frontierScores = {
    gdpPdf: pctOrNull(model.gdpPdfAllPass),
    frontierCode: pctOrNull(model.frontierCode20 ?? model.frontierCode),
    terminal4: pctOrNull(model.terminalBench40),
    critptAgent: pctOrNull(model.critptAgenticHard),
    automation: pctOrNull(model.automationBenchPartialScore),
    hleDiamond: pctOrNull(model.hleDiamond ?? model.hle),
    science: pctOrNull(model.terminalBenchScience ?? model.scicode),
    mlcr: pctOrNull(model.mlcrOverall),
    itBenchSre: pctOrNull(model.itBenchSre),
    critptClosed: pctOrNull(model.critpt),
    harveyLaw: pctOrNull(model.harveyLab),
    analystAgent: pctOrNull(model.analystAgent),
    healthPro: pctOrNull(model.healthbenchProfessional ?? model.healthbench)
  };
  if (Object.values(frontierScores).some(v => v !== null)) entry.frontierScores = frontierScores;

  const expertElo = {
    gdpval: numOrNull(model.gdpval, 1),
    briefcase: typeof model.briefcaseElo === 'number' && Number.isFinite(model.briefcaseElo) && model.briefcaseElo > 0
      ? numOrNull(model.briefcaseElo, 1)
      : null,
    aa3d: typeof model.aa3dElo === 'number' && Number.isFinite(model.aa3dElo) && model.aa3dElo > 0
      ? numOrNull(model.aa3dElo, 1)
      : null,
    code2video: typeof model.code2videoElo === 'number' && Number.isFinite(model.code2videoElo) && model.code2videoElo > 0
      ? numOrNull(model.code2videoElo, 1)
      : null
  };
  if (Object.values(expertElo).some(v => v !== null)) entry.expertElo = expertElo;

  const pb = model.personalityBench?.indexScores;
  if (pb && typeof pb === 'object') {
    const personality = {
      slop: numOrNull(pb.slop, 1),
      warmth: numOrNull(pb.warmth, 1),
      imagination: numOrNull(pb.imagination, 1),
      expressiveness: numOrNull(pb.expressiveness, 1)
    };
    if (Object.values(personality).some(v => v !== null)) entry.personality = personality;
  }

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

function simplifyCyberModel(item, byId = null, bySlug = null) {
  const cost = item?.costPerTask;
  const score = item?.score;
  if (!item?.id || typeof item.name !== 'string' || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(score) || score < 0 || score > 100) {
    return null;
  }
  const base = byId?.get(item.id) || bySlug?.get(item.slug) || null;
  const entry = {
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName || item.name,
    cyberIndex: score,
    intelligenceIndex: score,
    cost,
    creator: creator(item.creator || base?.creator),
    isReasoning: !!base?.isReasoning,
    isOpenWeights: !!base?.isOpenWeights,
    refusalRate: pctOrNull(item.refusalRate),
    mitigationStatus: typeof item.mitigationStatus === 'string' ? item.mitigationStatus : null
  };
  if (base?.releaseDate) entry.releaseDate = base.releaseDate;
  if (base?.openLicense) entry.openLicense = base.openLicense;
  if (base?.parametersB) entry.parametersB = base.parametersB;
  if (base?.modalities) entry.modalities = base.modalities;
  if (item.release?.slug || base?.family) {
    entry.family = base?.family || { slug: item.release.slug, name: item.shortName || item.name };
  }
  if (base?.effort) entry.effort = base.effort;
  if (base?.timeSec) entry.timeSec = base.timeSec;
  if (base?.subscores) entry.subscores = base.subscores;
  if (base?.frontierScores) entry.frontierScores = base.frontierScores;
  if (base?.domainScores) entry.domainScores = base.domainScores;
  if (base?.expertElo) entry.expertElo = base.expertElo;
  if (base?.providers) entry.providers = base.providers;
  return entry;
}

const FRONTIER_CORE_KEYS = ['gdpPdf', 'frontierCode', 'terminal4', 'critptAgent', 'automation', 'hleDiamond'];
const EFFORT_SLUGS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const HIGH_EFFORTS = new Set(['high', 'xhigh', 'max', 'default']);
const LMARENA_DATASET_BASE = 'https://datasets-server.huggingface.co/rows?dataset=lmarena-ai%2Fleaderboard-dataset';
const DESIGN_ARENA_API_BASE = 'https://www.designarena.ai/api/leaderboard?arenaType=models&category=';
const DESIGN_ARENA_CATEGORIES = ['website', 'uicomponent', 'dataviz', 'gamedev', 'svg'];
const DESIGN_ARENA_CALIBRATION = {
  website: { center: 1220, scale: 195 },
  uicomponent: { center: 1220, scale: 210 },
  dataviz: { center: 1225, scale: 200 },
  gamedev: { center: 1220, scale: 285 },
  svg: { center: 1220, scale: 300 }
};

function slimDerivedBase(m) {
  const base = {
    id: m.id,
    slug: m.slug,
    name: m.name,
    shortName: m.shortName,
    cost: m.cost,
    creator: m.creator,
    isReasoning: !!m.isReasoning,
    isOpenWeights: !!m.isOpenWeights,
    deprecated: !!m.deprecated
  };
  if (m.releaseDate) base.releaseDate = m.releaseDate;
  if (m.openLicense) base.openLicense = m.openLicense;
  if (m.parametersB) base.parametersB = m.parametersB;
  if (m.modalities) base.modalities = m.modalities;
  if (m.family) base.family = m.family;
  if (m.effort) base.effort = m.effort;
  if (m.timeSec) base.timeSec = m.timeSec;
  return base;
}

function buildFrontierModels(models) {
  if (!Array.isArray(models)) return [];
  const candidates = [];
  for (const m of models) {
    const fs = m?.frontierScores;
    if (!fs || typeof fs !== 'object') continue;
    const vals = FRONTIER_CORE_KEYS.map(k => fs[k]).filter(v => typeof v === 'number' && Number.isFinite(v));
    if (vals.length < 4) continue;
    const frontierIndex = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    const aaIndex = Number(m.intelligenceIndex.toFixed(2));
    candidates.push({
      ...slimDerivedBase(m),
      frontierIndex,
      intelligenceIndex: frontierIndex,
      aaIndex,
      indexDelta: Number((frontierIndex - aaIndex).toFixed(2)),
      coreCount: vals.length,
      frontierScores: fs
    });
  }
  const byAa = [...candidates].sort((a, b) => b.aaIndex - a.aaIndex || a.cost - b.cost || a.id.localeCompare(b.id));
  const byFrontier = [...candidates].sort((a, b) => b.frontierIndex - a.frontierIndex || a.cost - b.cost || a.id.localeCompare(b.id));
  const aaRankMap = new Map(byAa.map((m, idx) => [m.id, idx + 1]));
  const frontierRankMap = new Map(byFrontier.map((m, idx) => [m.id, idx + 1]));
  for (const row of candidates) {
    row.aaRank = aaRankMap.get(row.id);
    row.frontierRank = frontierRankMap.get(row.id);
    row.rankDelta = row.aaRank - row.frontierRank;
  }
  if (candidates.length) validateRows(candidates, 1, 'frontier-model');
  return candidates;
}

function eloToWinPct(elo, baseline = 1380, scale = 400) {
  if (typeof elo !== 'number' || !Number.isFinite(elo) || !Number.isFinite(scale) || scale <= 0) return null;
  const pct = 100 / (1 + 10 ** ((baseline - elo) / scale));
  return Number(pct.toFixed(2));
}

function canonArenaSlug(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .trim()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b202\d(\d{4})\b/g, '$1')
    .replace(/\b(?:full|preview|latest|chat)\b/g, ' ')
    .replace(/-1\.0\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripDateStamp(slug) {
  return slug.replace(/-\d{4}$/, '');
}

function parseExternalIdentity(rawName, knownFamilies) {
  if (!rawName || typeof rawName !== 'string') return { base: '', effort: null };
  let effort = null;
  const parenMatches = [...rawName.matchAll(/\(([^)]+)\)/g)];
  for (const m of parenMatches) {
    const tokens = m[1].toLowerCase().split(/[\s,/+-]+/).filter(Boolean);
    const hit = tokens.find(t => EFFORT_SLUGS.has(t));
    if (hit) { effort = hit; break; }
  }
  let base = canonArenaSlug(rawName);
  if (!effort && !knownFamilies.has(base) && !knownFamilies.has(stripDateStamp(base))) {
    const parts = base.split('-');
    const tail = parts[parts.length - 1];
    if (parts.length >= 2 && EFFORT_SLUGS.has(tail)) {
      const prefix = parts.slice(0, -1).join('-');
      if (knownFamilies.has(prefix) || knownFamilies.has(stripDateStamp(prefix)) || !prefix.startsWith('qwen')) {
        base = prefix;
        effort = tail;
      }
    }
  }
  return { base, effort };
}

function buildModelArenaIndex(models) {
  const familyBuckets = new Map();
  const knownFamilies = new Set();
  for (const m of models) {
    const famRaw = m.family?.slug || m.slug || m.shortName || m.name;
    const famSlug = canonArenaSlug(famRaw);
    if (!famSlug) continue;
    knownFamilies.add(famSlug);
    const stripped = stripDateStamp(famSlug);
    if (stripped) knownFamilies.add(stripped);
    if (!familyBuckets.has(famSlug)) familyBuckets.set(famSlug, []);
    familyBuckets.get(famSlug).push(m);
  }

  const aliasToFamily = new Map();
  const primaryByFamily = new Map();
  const byFamilyEffort = new Map();

  for (const [famSlug, list] of familyBuckets.entries()) {
    aliasToFamily.set(famSlug, famSlug);
    const stripped = stripDateStamp(famSlug);
    if (stripped && !aliasToFamily.has(stripped)) aliasToFamily.set(stripped, famSlug);

    // Primary model of a family: exact slug === family.slug, otherwise highest intelligenceIndex that isn't low/minimal
    const exactPrimary = list.find(m => m.slug && m.family?.slug && m.slug === m.family.slug);
    const nonLow = list.filter(m => !m.effort?.slug || !['low', 'minimal'].includes(m.effort.slug));
    const pool = nonLow.length ? nonLow : list;
    const best = exactPrimary || [...pool].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)[0];
    if (best) primaryByFamily.set(famSlug, best);

    for (const m of list) {
      const eff = m.effort?.slug || 'default';
      const key = `${famSlug}::${eff}`;
      if (!byFamilyEffort.has(key) || m.intelligenceIndex > byFamilyEffort.get(key).intelligenceIndex) {
        byFamilyEffort.set(key, m);
      }
      const nameAlias = canonArenaSlug(m.shortName || m.name);
      if (nameAlias && !aliasToFamily.has(nameAlias) && !EFFORT_SLUGS.has(nameAlias.split('-').pop())) {
        aliasToFamily.set(nameAlias, famSlug);
      }
    }
  }

  function resolve(rawName) {
    const { base, effort } = parseExternalIdentity(rawName, knownFamilies);
    if (!base) return null;
    const famSlug = aliasToFamily.get(base) || aliasToFamily.get(stripDateStamp(base));
    if (!famSlug) return null;
    if (effort) {
      const exact = byFamilyEffort.get(`${famSlug}::${effort}`);
      if (exact) return exact;
      const list = familyBuckets.get(famSlug) || [];
      if (list.length === 1 && HIGH_EFFORTS.has(effort)) {
        const only = list[0];
        const onlyEff = only.effort?.slug || 'default';
        if (HIGH_EFFORTS.has(onlyEff)) return only;
      }
      return null;
    }
    return primaryByFamily.get(famSlug) || null;
  }

  return { resolve, knownFamilies, primaryByFamily };
}

function buildHumanArenaModels(models, external = {}) {
  if (!Array.isArray(models) || !models.length) return [];
  const { resolve, primaryByFamily } = buildModelArenaIndex(models);
  const accById = new Map();

  function ensureAcc(model) {
    if (!accById.has(model.id)) {
      accById.set(model.id, {
        model,
        chat: null,
        doc: null,
        webdev: null,
        design: {},
        sources: new Set()
      });
    }
    return accById.get(model.id);
  }

  for (const [slot, rows] of [['chat', external.chatRows], ['doc', external.docRows], ['webdev', external.webdevRows]]) {
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      if (!r || (r.category && r.category !== 'overall')) continue;
      const rating = Number(r.rating);
      if (!Number.isFinite(rating)) continue;
      const matched = resolve(r.model_name || r.modelName || r.name);
      if (!matched) continue;
      const acc = ensureAcc(matched);
      if (!acc[slot] || rating > acc[slot].elo) {
        acc[slot] = {
          elo: Number(rating.toFixed(1)),
          votes: Number.isFinite(Number(r.vote_count ?? r.votes)) ? Math.round(Number(r.vote_count ?? r.votes)) : null
        };
      }
      acc.sources.add('lmarena');
    }
  }

  const designByCat = external.designByCat && typeof external.designByCat === 'object' ? external.designByCat : {};
  for (const cat of DESIGN_ARENA_CATEGORIES) {
    const items = designByCat[cat];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const elo = Number(item?.elo);
      if (!Number.isFinite(elo)) continue;
      const matched = resolve(item.modelId || item.name || item.displayName);
      if (!matched) continue;
      const acc = ensureAcc(matched);
      const prev = acc.design[cat];
      if (!prev || elo > prev.elo) {
        acc.design[cat] = {
          elo: Math.round(elo),
          winRate: typeof item.winRate === 'number' && Number.isFinite(item.winRate) ? Number(item.winRate.toFixed(1)) : eloToWinPct(elo, 1280),
          battles: Number.isFinite(Number(item.battles)) ? Math.round(Number(item.battles)) : null,
          avgCostUsd: typeof item.avgCostUsd === 'number' && item.avgCostUsd > 0 ? Number(item.avgCostUsd.toFixed(4)) : null
        };
      }
      acc.sources.add('design-arena');
    }
  }

  // Consolidate split high-effort arena submissions (e.g. Chat tested at High/xHigh while Design tested at Max)
  // onto the family's flagship entry, without ever touching medium/low/minimal variants.
  for (const [famSlug, primaryModel] of primaryByFamily.entries()) {
    const highSibs = [...accById.values()]
      .filter(a => {
        const aFam = canonArenaSlug(a.model.family?.slug || a.model.slug || a.model.shortName || a.model.name);
        const eff = a.model.effort?.slug || 'default';
        return aFam === famSlug && a.model.id !== primaryModel.id && HIGH_EFFORTS.has(eff);
      })
      .sort((a, b) => (b.model.effort?.level || 0) - (a.model.effort?.level || 0) || b.model.intelligenceIndex - a.model.intelligenceIndex);
    if (!highSibs.length) continue;

    const primaryAcc = ensureAcc(primaryModel);
    for (const sib of highSibs) {
      let independentSlots = 0;
      for (const slot of ['chat', 'doc', 'webdev']) {
        if (!sib[slot]) continue;
        if (!primaryAcc[slot]) {
          primaryAcc[slot] = sib[slot];
          primaryAcc.sources.add('lmarena');
        } else {
          independentSlots++;
        }
      }
      for (const cat of DESIGN_ARENA_CATEGORIES) {
        if (!sib.design[cat]) continue;
        if (!primaryAcc.design[cat]) {
          primaryAcc.design[cat] = sib.design[cat];
          primaryAcc.sources.add('design-arena');
        } else {
          independentSlots++;
        }
      }
      if (independentSlots === 0) {
        accById.delete(sib.model.id);
      }
    }
  }

  const out = [];
  for (const { model, chat, doc, webdev, design, sources } of accById.values()) {
    if (!sources.size) continue;
    const gdpvalElo = model.expertElo?.gdpval ?? null;
    const briefcaseElo = model.expertElo?.briefcase ?? null;
    if (gdpvalElo !== null || briefcaseElo !== null) sources.add('aa-expert');

    const shrinkBySample = (rawScore, count, prior = 54, k = 220) => {
      if (rawScore === null) return null;
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return rawScore;
      const w = count / (count + k);
      return Number((w * rawScore + (1 - w) * prior).toFixed(2));
    };

    const chatVibe = chat ? shrinkBySample(eloToWinPct(chat.elo, 1360, 220), chat.votes, 54, 600) : null;
    const docCraft = doc ? shrinkBySample(eloToWinPct(doc.elo, 1360, 200), doc.votes, 54, 400) : null;
    const webdevScore = webdev ? shrinkBySample(eloToWinPct(webdev.elo, 1490, 440), webdev.votes, 54, 500) : null;

    const designScore = cat => {
      const entry = design[cat];
      if (!entry) return null;
      const cal = DESIGN_ARENA_CALIBRATION[cat] || DESIGN_ARENA_CALIBRATION.website;
      const raw = eloToWinPct(entry.elo, cal.center, cal.scale);
      return shrinkBySample(raw, entry.battles, 53, 220);
    };

    const designWeb = designScore('website');
    const uiParts = ['uicomponent', 'dataviz']
      .map(designScore)
      .filter(v => typeof v === 'number' && Number.isFinite(v));
    const designUi = uiParts.length ? Number((uiParts.reduce((a, b) => a + b, 0) / uiParts.length).toFixed(2)) : null;

    const creativeParts = ['gamedev', 'svg']
      .map(designScore)
      .filter(v => typeof v === 'number' && Number.isFinite(v));
    const creativeCraft = creativeParts.length
      ? Number((creativeParts.reduce((a, b) => a + b, 0) / creativeParts.length).toFixed(2))
      : null;

    const expParts = [
      gdpvalElo !== null ? eloToWinPct(gdpvalElo, 1480, 480) : null,
      briefcaseElo !== null ? eloToWinPct(briefcaseElo, 1480, 480) : null
    ].filter(v => v !== null);
    const deliverable = expParts.length ? Number((expParts.reduce((a, b) => a + b, 0) / expParts.length).toFixed(2)) : null;

    const allDesignParts = DESIGN_ARENA_CATEGORIES
      .map(designScore)
      .filter(v => typeof v === 'number' && Number.isFinite(v));
    const pureVisual = allDesignParts.length
      ? Number(((allDesignParts.reduce((a, b) => a + b, 0) + 0.5 * 54) / (allDesignParts.length + 0.5)).toFixed(2))
      : null;

    const langParts = [chatVibe, docCraft].filter(v => typeof v === 'number' && Number.isFinite(v));
    const langVibe = chatVibe !== null && docCraft !== null
      ? Number((0.7 * chatVibe + 0.3 * docCraft).toFixed(2))
      : (langParts[0] ?? null);

    const aa3dElo = model.expertElo?.aa3d ?? null;
    const code2videoElo = model.expertElo?.code2video ?? null;
    const spatialParts = [
      aa3dElo !== null ? eloToWinPct(aa3dElo, 1120, 175) : null,
      code2videoElo !== null ? eloToWinPct(code2videoElo, 1340, 220) : null
    ].filter(v => v !== null);
    const spatialMotion = spatialParts.length
      ? Number((spatialParts.reduce((a, b) => a + b, 0) / spatialParts.length).toFixed(2))
      : null;
    const slopVal = model.personality?.slop ?? null;
    const antiSlop = slopVal !== null ? Number(Math.max(0, Math.min(100, 100 - slopVal)).toFixed(2)) : null;

    const humanScores = {
      chatVibe: langVibe,
      rawChatVibe: chatVibe,
      docCraft,
      webdev: webdevScore,
      designWeb,
      designUi,
      creativeCraft,
      deliverable,
      pureVisual,
      spatialMotion,
      antiSlop
    };
    const headlineKeys = ['chatVibe', 'webdev', 'designWeb', 'designUi', 'creativeCraft', 'deliverable'];
    const compositeParts = headlineKeys.map(k => humanScores[k]).filter(v => typeof v === 'number' && Number.isFinite(v));
    if (!compositeParts.length) continue;
    const rawSum = compositeParts.reduce((a, b) => a + b, 0);
    const humanIndex = Number(((rawSum + 1.0 * 55) / (compositeParts.length + 1.0)).toFixed(2));
    const aaIndex = Number(model.intelligenceIndex.toFixed(2));

    const designSub = {
      website: designScore('website'),
      uicomponent: designScore('uicomponent'),
      dataviz: designScore('dataviz'),
      gamedev: designScore('gamedev'),
      svg: designScore('svg')
    };

    const arenaRaw = {
      chatElo: chat?.elo ?? null,
      chatVotes: chat?.votes ?? null,
      docElo: doc?.elo ?? null,
      docVotes: doc?.votes ?? null,
      webdevElo: webdev?.elo ?? null,
      webdevVotes: webdev?.votes ?? null,
      designWebElo: design.website?.elo ?? null,
      designWebWinRate: design.website?.winRate ?? null,
      designWebBattles: design.website?.battles ?? null,
      designAvgCostUsd: design.website?.avgCostUsd ?? design.uicomponent?.avgCostUsd ?? null,
      designUiElo: design.uicomponent?.elo ?? null,
      designUiWinRate: design.uicomponent?.winRate ?? null,
      designUiBattles: design.uicomponent?.battles ?? null,
      designDatavizElo: design.dataviz?.elo ?? null,
      designGameElo: design.gamedev?.elo ?? null,
      designSvgElo: design.svg?.elo ?? null,
      gdpvalElo,
      briefcaseElo,
      aa3dElo,
      code2videoElo,
      slop: slopVal,
      dimensionCount: compositeParts.length,
      sources: [...sources]
    };

    out.push({
      ...slimDerivedBase(model),
      humanIndex,
      intelligenceIndex: humanIndex,
      aaIndex,
      indexDelta: Number((humanIndex - aaIndex).toFixed(2)),
      humanScores,
      designSub,
      arenaRaw
    });
  }

  if (out.length) validateRows(out, 1, 'human-arena-model');
  return out;
}

async function fetchLmArenaSlice(config, offset, get) {
  const url = `${LMARENA_DATASET_BASE}&config=${encodeURIComponent(config)}&split=latest&offset=${offset}&length=100`;
  const payload = JSON.parse((await get(url)).toString('utf8'));
  if (!Array.isArray(payload?.rows)) return { rows: [], date: null };
  const rows = payload.rows.map(item => item?.row).filter(r => r && r.category === 'overall');
  const date = rows[0]?.leaderboard_publish_date || null;
  return { rows, date };
}

async function fetchDesignArenaCategory(category, get) {
  const url = `${DESIGN_ARENA_API_BASE}${encodeURIComponent(category)}`;
  const payload = JSON.parse((await get(url)).toString('utf8'));
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function fetchHumanArenas(models, previous, get = getBuffer) {
  try {
    const [chat0, chat1, chat2, web0, doc0, ...designResults] = await Promise.allSettled([
      fetchLmArenaSlice('text_style_control', 0, get),
      fetchLmArenaSlice('text_style_control', 100, get),
      fetchLmArenaSlice('text_style_control', 200, get),
      fetchLmArenaSlice('webdev', 0, get),
      fetchLmArenaSlice('document_style_control', 0, get),
      ...DESIGN_ARENA_CATEGORIES.map(cat => fetchDesignArenaCategory(cat, get))
    ]);

    const chatRows = [
      ...(chat0.status === 'fulfilled' ? chat0.value.rows : []),
      ...(chat1.status === 'fulfilled' ? chat1.value.rows : []),
      ...(chat2.status === 'fulfilled' ? chat2.value.rows : [])
    ];
    const webdevRows = web0.status === 'fulfilled' ? web0.value.rows : [];
    const docRows = doc0.status === 'fulfilled' ? doc0.value.rows : [];
    const designByCat = {};
    DESIGN_ARENA_CATEGORIES.forEach((cat, idx) => {
      const res = designResults[idx];
      if (res.status === 'fulfilled') designByCat[cat] = res.value;
    });

    const humanArenaModels = buildHumanArenaModels(models, { chatRows, webdevRows, docRows, designByCat });
    if (humanArenaModels.length >= 10) {
      validateRows(humanArenaModels, 10, 'human-arena-model');
      return {
        humanArenaModels,
        lmArenaPublishDate: (chat0.status === 'fulfilled' && chat0.value.date) || (web0.status === 'fulfilled' && web0.value.date) || null
      };
    }
    console.warn(`External human arena matched ${humanArenaModels.length} models (< 10); falling back to previous snapshot if available.`);
  } catch (error) {
    console.warn(`External human arena refresh degraded gracefully: ${error.message}`);
  }
  return {
    humanArenaModels: Array.isArray(previous?.humanArenaModels) ? previous.humanArenaModels : [],
    lmArenaPublishDate: previous?.lmArenaPublishDate || null
  };
}

function readTtsHostRows(pageHtml) {
  const records = readFlightRecords(pageHtml);
  let best = [];
  for (const record of records.values()) {
    walk(record, value => {
      if (Array.isArray(value.hostModels) && value.hostModels.length > best.length && value.hostModels.some(h => h?.pricePer1mCharacters != null)) {
        best = value.hostModels;
      }
    });
  }
  return best;
}

function buildMediaModels({ imagePayload = null, videoPayload = null, ttsRows = [] } = {}) {
  const out = [];

  if (imagePayload?.media) {
    const lbMeta = new Map();
    for (const arr of Object.values(imagePayload.imageLeaderboards || {})) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item?.id && !lbMeta.has(item.id)) lbMeta.set(item.id, item);
      }
    }
    const byId = new Map();
    const ingestImg = (arr, field) => {
      if (!Array.isArray(arr)) return;
      for (const item of arr) {
        if (!item?.id || typeof item.name !== 'string' || !Number.isFinite(item.price) || item.price <= 0 || !Number.isFinite(item.elo)) continue;
        let rec = byId.get(item.id);
        if (!rec) {
          rec = { item, t2iElo: null, editElo: null, pricePer1k: item.price };
          byId.set(item.id, rec);
        }
        rec[field] = Number(item.elo.toFixed(2));
        if (item.price < rec.pricePer1k) rec.pricePer1k = item.price;
      }
    };
    ingestImg(imagePayload.media.textToImage, 't2iElo');
    ingestImg(imagePayload.media.imageEditing, 'editElo');

    for (const [rawId, rec] of byId.entries()) {
      const meta = lbMeta.get(rawId);
      const t2i = rec.t2iElo !== null ? eloToWinPct(rec.t2iElo, 1080, 155) : null;
      const imgEdit = rec.editElo !== null ? eloToWinPct(rec.editElo, 1095, 155) : null;
      const parts = [t2i, imgEdit].filter(v => v !== null);
      if (!parts.length) continue;
      const idxScore = Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2));
      const isOpen = !!(meta?.openWeightsUrl || /\b(flux\.1\s*\[?(?:dev|schnell)|stable diffusion|sdxl|sd\s*3\.5|qwen-image|hidream|hunyuan|cogview|sana)\b/i.test(rec.item.name));
      const entry = {
        id: `img:${rawId}`,
        slug: rec.item.slug || rawId,
        name: rec.item.name,
        shortName: rec.item.name,
        mediaKind: 'image',
        intelligenceIndex: idxScore,
        cost: Number((rec.pricePer1k / 1000).toFixed(6)),
        creator: creator(rec.item.creator || meta?.creator),
        isReasoning: false,
        isOpenWeights: isOpen,
        mediaScores: { t2i, imgEdit, t2v: null, i2v: null, vidEdit: null, tts: null },
        mediaRaw: {
          kind: 'image',
          unitZh: '每张图',
          unitEn: '/ image',
          t2iElo: rec.t2iElo,
          imgEditElo: rec.editElo,
          pricePer1k: Number(rec.pricePer1k.toFixed(2))
        }
      };
      if (meta?.releaseDate) entry.releaseDate = meta.releaseDate;
      out.push(entry);
    }
  }

  if (videoPayload?.media) {
    const lbMeta = new Map();
    for (const arr of Object.values(videoPayload.videoLeaderboards || {})) {
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item?.id && !lbMeta.has(item.id)) lbMeta.set(item.id, item);
      }
    }
    const byId = new Map();
    const ingestVid = (arr, field) => {
      if (!Array.isArray(arr)) return;
      for (const item of arr) {
        if (!item?.id || typeof item.name !== 'string' || !Number.isFinite(item.price) || item.price <= 0 || !Number.isFinite(item.elo)) continue;
        let rec = byId.get(item.id);
        if (!rec) {
          rec = { item, t2vElo: null, i2vElo: null, vidEditElo: null, pricePerMin: item.price };
          byId.set(item.id, rec);
        }
        rec[field] = Number(item.elo.toFixed(2));
        if (item.price < rec.pricePerMin) rec.pricePerMin = item.price;
      }
    };
    ingestVid(videoPayload.media.textToVideo, 't2vElo');
    ingestVid(videoPayload.media.imageToVideo, 'i2vElo');
    ingestVid(videoPayload.media.videoEditing, 'vidEditElo');

    for (const [rawId, rec] of byId.entries()) {
      const meta = lbMeta.get(rawId);
      const t2v = rec.t2vElo !== null ? eloToWinPct(rec.t2vElo, 1075, 140) : null;
      const i2v = rec.i2vElo !== null ? eloToWinPct(rec.i2vElo, 1075, 140) : null;
      const vidEdit = rec.vidEditElo !== null ? eloToWinPct(rec.vidEditElo, 1075, 140) : null;
      const parts = [t2v, i2v, vidEdit].filter(v => v !== null);
      if (!parts.length) continue;
      const idxScore = Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2));
      const isOpen = !!(meta?.openWeightsUrl || /\b(wan\s*2|hunyuanvideo|cogvideo|mochi|ltx-video|skyreels|step-video)\b/i.test(rec.item.name));
      const entry = {
        id: `vid:${rawId}`,
        slug: rec.item.slug || rawId,
        name: rec.item.name,
        shortName: rec.item.name,
        mediaKind: 'video',
        intelligenceIndex: idxScore,
        cost: Number((rec.pricePerMin / 12).toFixed(5)),
        creator: creator(rec.item.creator || meta?.creator),
        isReasoning: false,
        isOpenWeights: isOpen,
        mediaScores: { t2i: null, imgEdit: null, t2v, i2v, vidEdit, tts: null },
        mediaRaw: {
          kind: 'video',
          unitZh: '每 5 秒视频',
          unitEn: '/ 5s clip',
          t2vElo: rec.t2vElo,
          i2vElo: rec.i2vElo,
          vidEditElo: rec.vidEditElo,
          pricePerMin: Number(rec.pricePerMin.toFixed(2))
        }
      };
      if (meta?.releaseDate) entry.releaseDate = meta.releaseDate;
      out.push(entry);
    }
  }

  if (Array.isArray(ttsRows) && ttsRows.length) {
    const byModelId = new Map();
    for (const h of ttsRows) {
      const m = h?.model;
      if (!h?.isRepresentative || !m?.id || typeof m.name !== 'string') continue;
      if (!Number.isFinite(h.pricePer1mCharacters) || h.pricePer1mCharacters <= 0) continue;
      if (!Number.isFinite(m.qualityElo) || m.qualityElo <= 0) continue;
      const prev = byModelId.get(m.id);
      if (!prev || h.pricePer1mCharacters < prev.pricePer1mCharacters) byModelId.set(m.id, h);
    }
    for (const [mId, h] of byModelId.entries()) {
      const m = h.model;
      const ttsScore = eloToWinPct(m.qualityElo, 1080, 140);
      const timeSec = Number.isFinite(h.performance?.medianGenerationTimeSeconds) && h.performance.medianGenerationTimeSeconds > 0
        ? Number(h.performance.medianGenerationTimeSeconds.toFixed(2))
        : null;
      const ttfaMs = Number.isFinite(h.latencyPerformance?.medianTimeToFirstAudioMs) && h.latencyPerformance.medianTimeToFirstAudioMs > 0
        ? Math.round(h.latencyPerformance.medianTimeToFirstAudioMs)
        : null;
      const entry = {
        id: `tts:${mId}`,
        slug: m.slug || mId,
        name: m.name,
        shortName: m.shortName || m.name,
        mediaKind: 'tts',
        intelligenceIndex: ttsScore,
        cost: Number((h.pricePer1mCharacters / 1000).toFixed(6)),
        creator: creator(m.creator || h.host),
        isReasoning: false,
        isOpenWeights: !!m.isOpenWeights,
        ...(timeSec ? { timeSec } : {}),
        mediaScores: { t2i: null, imgEdit: null, t2v: null, i2v: null, vidEdit: null, tts: ttsScore },
        mediaRaw: {
          kind: 'tts',
          unitZh: '每千字语音',
          unitEn: '/ 1k chars',
          ttsElo: Number(m.qualityElo.toFixed(1)),
          pricePer1mChars: Number(h.pricePer1mCharacters.toFixed(2)),
          ttfaMs,
          cps: numOrNull(h.performance?.medianCharactersPerSecond, 1)
        }
      };
      if (m.releaseDate) entry.releaseDate = m.releaseDate;
      out.push(entry);
    }
  }

  if (out.length) validateRows(out, 1, 'media-model');
  return out;
}

function buildSnapshotDiff(output, previous, dateStr = new Date().toISOString().slice(0, 10)) {
  const events = [];
  const compareSuite = (nextArr, prevArr, tab) => {
    if (!Array.isArray(nextArr) || !Array.isArray(prevArr) || !prevArr.length) return;
    const prevMap = new Map(prevArr.map(r => [r.id, r]));
    for (const cur of nextArr) {
      const old = prevMap.get(cur.id);
      if (!old) {
        events.push({
          date: cur.releaseDate || dateStr,
          kind: 'new',
          tab,
          id: cur.id,
          name: cur.shortName || cur.name,
          score: Number(cur.intelligenceIndex.toFixed(1)),
          cost: Number(cur.cost.toFixed(4))
        });
        continue;
      }
      if (old.cost > 0) {
        const relCost = (cur.cost - old.cost) / old.cost;
        if (Math.abs(relCost) >= 0.03 && Math.abs(cur.cost - old.cost) >= 0.0005) {
          events.push({
            date: dateStr,
            kind: relCost < 0 ? 'price-drop' : 'price-up',
            tab,
            id: cur.id,
            name: cur.shortName || cur.name,
            oldCost: Number(old.cost.toFixed(4)),
            cost: Number(cur.cost.toFixed(4)),
            pct: Math.round(relCost * 100)
          });
        }
      }
      const dScore = cur.intelligenceIndex - old.intelligenceIndex;
      if (Math.abs(dScore) >= 0.5) {
        events.push({
          date: dateStr,
          kind: 'score',
          tab,
          id: cur.id,
          name: cur.shortName || cur.name,
          oldScore: Number(old.intelligenceIndex.toFixed(1)),
          score: Number(cur.intelligenceIndex.toFixed(1)),
          delta: Number(dScore.toFixed(1))
        });
      }
    }
  };

  if (previous) {
    compareSuite(output.models, previous.models, 'models');
    compareSuite(output.codingAgents, previous.codingAgents, 'coding-agents');
    compareSuite(output.mediaModels, previous.mediaModels, 'media');
  }

  const priorEvents = Array.isArray(previous?.diffEvents) ? previous.diffEvents : [];
  const merged = [];
  const seen = new Set();
  for (const ev of [...events, ...priorEvents]) {
    if (!ev?.id || !ev?.kind) continue;
    const key = `${ev.date}:${ev.tab}:${ev.id}:${ev.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ev);
    if (merged.length >= 20) break;
  }

  if (merged.length < 5 && Array.isArray(output.models) && output.models.length) {
    const dated = output.models.filter(m => m.releaseDate).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || b.intelligenceIndex - a.intelligenceIndex);
    if (dated.length) {
      const latestMs = Date.parse(dated[0].releaseDate + 'T00:00:00Z');
      const seenFamilies = new Set();
      for (const m of dated) {
        const ms = Date.parse(m.releaseDate + 'T00:00:00Z');
        if (!Number.isFinite(ms) || (latestMs - ms) > 21 * 86400 * 1000) break;
        const famKey = m.family?.slug || m.id;
        if (seenFamilies.has(famKey)) continue;
        seenFamilies.add(famKey);
        const key = `${m.releaseDate}:models:${m.id}:new`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({
          date: m.releaseDate,
          kind: 'new',
          tab: 'models',
          id: m.id,
          name: m.shortName || m.name,
          score: Number(m.intelligenceIndex.toFixed(1)),
          cost: Number(m.cost.toFixed(4))
        });
        if (merged.length >= 8) break;
      }
    }
  }

  return merged;
}

function simplifyChangelog(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    if (!item?.title || !item?.dateLa) continue;
    out.push({
      date: String(item.dateLa),
      type: typeof item.type === 'string' ? item.type : 'update',
      title: String(item.title),
      url: typeof item.url === 'string' && item.url.startsWith('/') ? `https://artificialanalysis.ai${item.url}` : null
    });
    if (out.length >= 12) break;
  }
  return out;
}

function validateRows(rows, minimum, name) {
  if (rows.length < minimum) throw new Error(`Unexpectedly low ${name} count: ${rows.length}`);
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`Duplicate ${name} IDs`);
  rows.sort((a, b) => a.cost - b.cost || b.intelligenceIndex - a.intelligenceIndex || a.id.localeCompare(b.id));
}

async function fetchModels(page, sourceUrl, previous, get = getBuffer, { includeHosts = false, includeMedia = false } = {}) {
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
  let imagePayload = null, videoPayload = null;
  if (includeHosts || includeMedia) {
    const candidates = manifests
      .filter(m => m.path !== modelManifestPath)
      .sort((a, b) => Number(b.path === previous?.hostsManifestPath) - Number(a.path === previous?.hostsManifestPath));
    for (const cand of candidates) {
      if ((!includeHosts || hostMap) && (!includeMedia || (imagePayload && videoPayload))) break;
      try {
        let payload = cachedPayloads.get(cand.path);
        if (!payload) {
          const url = new URL(cand.path, sourceUrl);
          if (url.origin !== new URL(sourceUrl).origin || !url.pathname.startsWith('/data/')) continue;
          payload = JSON.parse(decryptPayload(await get(url.href), cand.key));
          cachedPayloads.set(cand.path, payload);
        }
        if (includeHosts && !hostMap && Array.isArray(payload) && payload.some(item => item?.modelSlug && item?.host?.name)) {
          hostMap = new Map();
          for (const item of payload) {
            if (!item?.modelSlug) continue;
            if (!hostMap.has(item.modelSlug)) hostMap.set(item.modelSlug, []);
            hostMap.get(item.modelSlug).push(item);
          }
          hostsManifestPath = cand.path;
        } else if (includeMedia && !imagePayload && payload?.media?.textToImage) {
          imagePayload = payload;
        } else if (includeMedia && !videoPayload && payload?.media?.textToVideo) {
          videoPayload = payload;
        }
      } catch { /* Optional provider/media manifest; never fail core refresh. */ }
    }
  }

  let mediaModels = [];
  if (includeMedia) {
    let ttsRows = [];
    try {
      const ttsUrl = new URL('/text-to-speech', sourceUrl).href;
      const ttsHtml = (await get(ttsUrl)).toString('utf8');
      ttsRows = readTtsHostRows(ttsHtml);
    } catch { /* Optional TTS page; degrade gracefully. */ }
    try {
      mediaModels = buildMediaModels({ imagePayload, videoPayload, ttsRows });
    } catch { mediaModels = []; }
    if (mediaModels.length < 10 && Array.isArray(previous?.mediaModels)) {
      mediaModels = previous.mediaModels;
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

  const byId = new Map(models.map(m => [m.id, m]));
  const bySlug = new Map(models.filter(m => m.slug).map(m => [m.slug, m]));
  let cyberModels = [];
  if (Array.isArray(modelPayload.cyberIndexModels)) {
    cyberModels = modelPayload.cyberIndexModels.map(c => simplifyCyberModel(c, byId, bySlug)).filter(Boolean);
    if (cyberModels.length >= 3) validateRows(cyberModels, 3, 'cyber-model');
    else cyberModels = [];
  }
  const changelog = simplifyChangelog(modelPayload.changelog);

  return { models, cyberModels, mediaModels, changelog, manifestPath: modelManifestPath, hostsManifestPath };
}

function comparable(snapshot) {
  const { updatedAt, diffEvents, ...data } = snapshot;
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
  const { models, cyberModels, mediaModels, changelog, manifestPath, hostsManifestPath } = await fetchModels(modelPage.toString('utf8'), sourceUrl, previous, getBuffer, { includeHosts: true, includeMedia: true });
  const frontierModels = buildFrontierModels(models);
  if (frontierModels.length >= 30) validateRows(frontierModels, 30, 'frontier-model');
  const { humanArenaModels, lmArenaPublishDate } = process.env.DISABLE_EXTERNAL_ARENAS === '1'
    ? { humanArenaModels: previous?.humanArenaModels || [], lmArenaPublishDate: previous?.lmArenaPublishDate || null }
    : await fetchHumanArenas(models, previous, getBuffer);
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
    ...(changelog.length ? { changelog } : {}),
    modelIndexVersion: modelPage.toString('utf8').match(/Artificial Analysis Intelligence Index v([\d.]+)/)?.[1] || null,
    modelCount: models.length, models,
    ...(frontierModels.length ? {
      frontierMethodologyUrl: 'https://artificialanalysis.ai/methodology/intelligence-benchmarking',
      frontierModelCount: frontierModels.length,
      frontierModels
    } : {}),
    ...(humanArenaModels.length ? {
      lmArenaSourceUrl: 'https://lmarena.ai/leaderboard',
      designArenaSourceUrl: 'https://www.designarena.ai/leaderboard',
      ...(lmArenaPublishDate ? { lmArenaPublishDate } : {}),
      humanArenaCount: humanArenaModels.length,
      humanArenaModels
    } : {}),
    codingAgentSourceUrl,
    codingAgentMethodologyUrl: 'https://artificialanalysis.ai/methodology/coding-agents-benchmarking',
    codingAgentIndexVersion: codingPage.match(/Coding Agent Index v([\d.]+)/)?.[1] || null,
    codingAgentCount: codingAgents.length,
    codingAgentExcludedCount: rawCodingRows.length - codingAgents.length,
    codingAgents,
    ...(cyberModels.length ? {
      cyberSourceUrl: 'https://artificialanalysis.ai/cyber',
      cyberModelCount: cyberModels.length,
      cyberModels
    } : {}),
    ...(mediaModels.length ? {
      mediaSourceUrl: 'https://artificialanalysis.ai/image',
      mediaModelCount: mediaModels.length,
      mediaModels
    } : {})
  };
  const diffEvents = buildSnapshotDiff(output, previous);
  if (diffEvents.length) output.diffEvents = diffEvents;
  const changed = await writeSnapshot(outPath, output, previous);
  console.log(`${changed ? 'Wrote' : 'Unchanged:'} ${models.length} models, ${frontierModels.length} frontier, ${humanArenaModels.length} human-arena, ${codingAgents.length} coding agents, ${cyberModels.length} cyber, ${mediaModels.length} media; checked ${new Date().toISOString()}`);
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Multi-source benchmark data check\n- Checked: ${new Date().toISOString()}\n- Models: ${models.length}\n- Frontier hard-eval models: ${frontierModels.length}\n- Human & Aesthetic Arena models: ${humanArenaModels.length}\n- Coding-agent variants: ${codingAgents.length}\n- Cyber-index models: ${cyberModels.length}\n- Multimodal generation models (Image/Video/TTS): ${mediaModels.length}\n- Excluded coding-agent rows without comparable score/cost: ${output.codingAgentExcludedCount}\n- Snapshot changed: ${changed}\n`);
}

module.exports = { getBuffer, readFlightRecords, readManifests, decryptPayload, simplifyModel, simplifyCyberModel, simplifyChangelog, buildFrontierModels, eloToWinPct, buildHumanArenaModels, fetchHumanArenas, readTtsHostRows, buildMediaModels, buildSnapshotDiff, resolveFlightReference, readCodingRows, expectedCodingComponents, simplifyCodingAgent, validateRows, fetchModels, writeSnapshot };
if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
