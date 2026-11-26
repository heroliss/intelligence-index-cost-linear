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
  const raw = typeof value?.name === 'string' ? value.name.trim() : '';
  const name = raw === 'Bytedance' ? 'ByteDance' : (raw || 'Other');
  return { name, color: /^#(?:[0-9a-f]{3}){1,2}$/i.test(value?.color || '') ? value.color : '#777777' };
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
      const hCost = (h?.intelligenceIndexCostPerTask?.cost ?? h?.intelligenceIndexCostPerTask)?.total;
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

function canonicalizeCodingAgents(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const canonicalNameBySlug = new Map();
  const upperCount = s => (String(s).match(/[A-Z]/g) || []).length;
  for (const r of rows) {
    const slug = typeof r?.agentSlug === 'string' ? r.agentSlug.trim().toLowerCase() : '';
    const name = typeof r?.agentName === 'string' ? r.agentName.trim() : '';
    if (!slug || !name) continue;
    const prev = canonicalNameBySlug.get(slug);
    if (
      !prev
      || name.length > prev.length
      || (name.length === prev.length && upperCount(name) > upperCount(prev))
    ) {
      canonicalNameBySlug.set(slug, name);
    }
  }
  for (const r of rows) {
    const slug = typeof r?.agentSlug === 'string' ? r.agentSlug.trim().toLowerCase() : '';
    const canon = canonicalNameBySlug.get(slug);
    if (!canon || !r.agentName || r.agentName === canon) continue;
    const oldName = r.agentName;
    r.agentName = canon;
    if (r.family?.slug && r.family.slug.startsWith(`${oldName}:`)) {
      r.family = { ...r.family, slug: `${canon}:${r.family.slug.slice(oldName.length + 1)}` };
    }
  }
  return rows;
}

const CYBER_EFFORT_LEVELS = { minimal: 10, low: 20, medium: 30, high: 40, xhigh: 50, max: 60 };

function inferEffortFromName(name = '', slug = '') {
  const m = String(name).match(/\((?:[^)]*\b)?(minimal|low|medium|high|xhigh|max)\b[^)]*\)/i)
    || String(slug).match(/-(minimal|low|medium|high|xhigh|max)$/i);
  if (!m) return null;
  const eff = m[1].toLowerCase();
  const labelMap = { minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'xHigh', max: 'Max' };
  return { slug: eff, label: labelMap[eff] || eff, level: CYBER_EFFORT_LEVELS[eff] || 0 };
}

function simplifyCyberModel(item, byId = null, bySlug = null, byFamily = null) {
  const cost = item?.costPerTask;
  const score = item?.score;
  if (!item?.id || typeof item.name !== 'string' || !Number.isFinite(cost) || cost <= 0 || !Number.isFinite(score) || score < 0 || score > 100) {
    return null;
  }
  const base = byId?.get(item.id) || bySlug?.get(item.slug) || null;
  const famSlug = item.release?.slug || base?.family?.slug || canonArenaSlug(item.slug || item.shortName || item.name);
  const famBase = !base && byFamily ? (byFamily.get(famSlug) || byFamily.get(stripDateStamp(famSlug)) || null) : null;
  const inferredEff = base?.effort || (item.effort?.slug
    ? { slug: item.effort.slug, label: item.effort.label || item.effort.slug, level: Number.isFinite(item.effort.level) ? item.effort.level : (CYBER_EFFORT_LEVELS[item.effort.slug] || 0) }
    : inferEffortFromName(item.name, item.slug));
  const isOpen = typeof item.isOpenWeights === 'boolean'
    ? item.isOpenWeights
    : base
      ? !!base.isOpenWeights
      : famBase
        ? !!famBase.isOpenWeights
        : /\b(?:deepseek|kimi|glm-|minimax|nemotron|gpt-oss|llama|gemma|mimo)\b|\b\d+(?:\.\d+)?[tb]\s+a\d+b\b/i.test(item.name);
  const isReasoning = typeof item.isReasoning === 'boolean'
    ? item.isReasoning
    : base
      ? !!base.isReasoning
      : !!(inferredEff || /\(reasoning\)/i.test(item.name) || famBase?.isReasoning);

  const rawCreator = item.creator || (Array.isArray(item.modelCreators) ? item.modelCreators[0] : item.modelCreators);
  const entry = {
    id: item.id,
    slug: item.slug,
    name: item.name,
    shortName: item.shortName || item.name,
    cyberIndex: score,
    intelligenceIndex: score,
    cost,
    creator: creator(rawCreator || base?.creator || famBase?.creator),
    isReasoning,
    isOpenWeights: isOpen,
    refusalRate: pctOrNull(item.refusalRate),
    mitigationStatus: typeof item.mitigationStatus === 'string' ? item.mitigationStatus : null
  };
  if (base?.releaseDate) entry.releaseDate = base.releaseDate;
  if (base?.openLicense || (isOpen && famBase?.openLicense)) entry.openLicense = base?.openLicense || famBase?.openLicense;
  if (base?.parametersB) entry.parametersB = base.parametersB;
  if (base?.modalities) entry.modalities = base.modalities;
  if (item.release?.slug || base?.family || famBase?.family) {
    entry.family = base?.family || famBase?.family || { slug: item.release.slug, name: item.shortName || item.name };
  }
  if (inferredEff) entry.effort = inferredEff;
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
const LIVEBENCH_SITE_URL = 'https://livebench.ai/';
const LIVEBENCH_FALLBACK_RELEASE = '20261106';
const LIVEBENCH_SUITE_KEYS = {
  'Long Agentic': 'longAgentic',
  Reasoning: 'reasoning',
  Coding: 'coding',
  Browser: 'browser',
  'Data Analysis': 'dataAnalysis',
  Research: 'research',
  Design: 'design'
};
const DESIGN_ARENA_CALIBRATION = {
  website: { center: 1285, scale: 135, k: 30, weight: 0.55 },
  uicomponent: { center: 1295, scale: 155, k: 35, weight: 0.20 },
  dataviz: { center: 1265, scale: 175, k: 55, weight: 0.09 },
  gamedev: { center: 1305, scale: 260, k: 55, weight: 0.08 },
  svg: { center: 1265, scale: 215, k: 55, weight: 0.08 }
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

function isLowOrNonReasoningModel(m) {
  const eff = m?.effort?.slug || '';
  return ['low', 'minimal'].includes(eff)
    || /non-reasoning/i.test(m?.slug || '')
    || /\(non-reasoning\)/i.test(m?.name || '');
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
  const vendorPrefixes = ['tencent-', 'nvidia-', 'alibaba-', 'meta-', 'mistral-', 'moonshot-', 'baidu-', 'bytedance-'];

  for (const [famSlug, list] of familyBuckets.entries()) {
    aliasToFamily.set(famSlug, famSlug);
    const stripped = stripDateStamp(famSlug);
    if (stripped && !aliasToFamily.has(stripped)) aliasToFamily.set(stripped, famSlug);
    for (const vp of vendorPrefixes) {
      if (famSlug.startsWith(vp) && famSlug.length > vp.length + 1) {
        const shortAlias = famSlug.slice(vp.length);
        if (!aliasToFamily.has(shortAlias)) aliasToFamily.set(shortAlias, famSlug);
      }
    }

    // Primary model of a family: exact slug === family.slug, otherwise highest intelligenceIndex that isn't low/minimal/non-reasoning.
    // Never fall back to a low/minimal/non-reasoning variant when the flagship variant is absent from priced models.
    const exactPrimary = list.find(m => m.slug && m.family?.slug && m.slug === m.family.slug && !isLowOrNonReasoningModel(m));
    const nonLow = list.filter(m => !isLowOrNonReasoningModel(m));
    const best = exactPrimary || (nonLow.length ? [...nonLow].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)[0] : null);
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
    const explicitDate = base.match(/-(\d{4})$/)?.[1] || null;
    const dequant = base.replace(/-(?:nvfp4|fp8|fp4|int4|int8|bf16|awq)$/i, '');
    const altBases = [
      base,
      dequant,
      stripDateStamp(base),
      stripDateStamp(dequant),
      dequant.replace(/-0$/, ''),
      dequant.replace(/^nemotron-super-vl-3-5$/, 'nemotron-3-5-super-vl')
    ];
    let famSlug = null;
    for (const candidate of altBases) {
      if (!candidate) continue;
      const found = aliasToFamily.get(candidate) || aliasToFamily.get(stripDateStamp(candidate));
      if (!found) continue;
      // Never conflate two different explicit MMDD checkpoints (e.g. -0910 vs -1017)
      const famDate = found.match(/-(\d{4})$/)?.[1] || null;
      if (explicitDate && famDate && explicitDate !== famDate) continue;
      famSlug = found;
      break;
    }
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

    const shrinkBySample = (rawScore, count, prior = 50, k = 180) => {
      if (rawScore === null) return null;
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return rawScore;
      const w = count / (count + k);
      return Number((w * rawScore + (1 - w) * prior).toFixed(2));
    };

    // 2026 empirical median-centered calibrations so median ≈ 50–55 and global SOTA ≈ 80–86
    const chatVibe = chat ? shrinkBySample(eloToWinPct(chat.elo, 1445, 115), chat.votes, 50, 120) : null;
    const docCraft = doc ? shrinkBySample(eloToWinPct(doc.elo, 1445, 115), doc.votes, 50, 100) : null;
    const webdevScore = webdev ? shrinkBySample(eloToWinPct(webdev.elo, 1640, 250), webdev.votes, 50, 90) : null;

    const designScore = cat => {
      const entry = design[cat];
      if (!entry) return null;
      const cal = DESIGN_ARENA_CALIBRATION[cat] || DESIGN_ARENA_CALIBRATION.website;
      const raw = eloToWinPct(entry.elo, cal.center, cal.scale);
      return shrinkBySample(raw, entry.battles, 50, cal.k ?? 35);
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
      gdpvalElo !== null ? eloToWinPct(gdpvalElo, 1580, 390) : null,
      briefcaseElo !== null ? eloToWinPct(briefcaseElo, 1500, 420) : null
    ].filter(v => v !== null);
    const deliverable = expParts.length ? Number((expParts.reduce((a, b) => a + b, 0) / expParts.length).toFixed(2)) : null;

    // Weighted visual aesthetic score: prioritizes Website (55%) & UI Component (20%) over DataViz/GameDev/SVG (9%/8%/8%),
    // and avoids penalizing fresh releases just because Design Arena has not finished evaluating niche sub-categories yet.
    let pvNum = 0, pvDen = 0;
    for (const cat of DESIGN_ARENA_CATEGORIES) {
      const val = designScore(cat);
      if (typeof val === 'number' && Number.isFinite(val)) {
        const w = DESIGN_ARENA_CALIBRATION[cat]?.weight ?? 0.1;
        pvNum += val * w;
        pvDen += w;
      }
    }
    const pureVisual = pvDen > 0 ? Number((pvNum / pvDen).toFixed(2)) : null;

    const langParts = [chatVibe, docCraft].filter(v => typeof v === 'number' && Number.isFinite(v));
    const langVibe = chatVibe !== null && docCraft !== null
      ? Number((0.7 * chatVibe + 0.3 * docCraft).toFixed(2))
      : (langParts[0] ?? null);

    const aa3dElo = model.expertElo?.aa3d ?? null;
    const code2videoElo = model.expertElo?.code2video ?? null;
    const spatialParts = [
      aa3dElo !== null ? eloToWinPct(aa3dElo, 1030, 380) : null,
      code2videoElo !== null ? eloToWinPct(code2videoElo, 1050, 580) : null
    ].filter(v => v !== null);
    const spatialMotion = spatialParts.length
      ? Number((spatialParts.reduce((a, b) => a + b, 0) / spatialParts.length).toFixed(2))
      : null;
    const slopVal = model.personality?.slop ?? null;
    const antiSlop = slopVal !== null ? Number(Math.max(0, Math.min(100, 100 - slopVal)).toFixed(2)) : null;
    const calAntiSlop = antiSlop !== null ? Number((12 + 0.75 * antiSlop).toFixed(2)) : null;

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

    // Balanced 4-Pillar Composite (prevents single crowd arena from dominating 50% and factors in Anti-Slop & 3D/Motion):
    // 1. Visual, Creative & Spatial (0.30): Design Arena weighted 5D visual (72%) + AA-3D/Code2Video (28%)
    // 2. Chat Vibe & Naturalness (0.25): Arena.ai Style-Ctrl Chat/Doc (65%) + Calibrated Anti-Slop (35%)
    // 3. Expert Real Deliverables (0.25): GDPval + Briefcase 44-occupation expert grading
    // 4. Interactive WebDev Craft (0.20): Arena.ai WebDev
    const daUnified = pureVisual;

    let pVisual = null, wVisual = 0;
    if (daUnified !== null && spatialMotion !== null) {
      pVisual = 0.72 * daUnified + 0.28 * spatialMotion;
      wVisual = 0.30;
    } else if (daUnified !== null) {
      pVisual = daUnified;
      wVisual = 0.25;
    } else if (spatialMotion !== null) {
      pVisual = spatialMotion;
      wVisual = 0.14;
    }

    let pChat = null, wChat = 0;
    if (langVibe !== null && calAntiSlop !== null) {
      pChat = 0.65 * langVibe + 0.35 * calAntiSlop;
      wChat = 0.25;
    } else if (langVibe !== null) {
      pChat = langVibe;
      wChat = 0.21;
    } else if (calAntiSlop !== null) {
      pChat = calAntiSlop;
      wChat = 0.14;
    }

    const pDeliv = deliverable;
    const wDeliv = pDeliv !== null ? 0.25 : 0;
    const pWeb = webdevScore;
    const wWeb = pWeb !== null ? 0.20 : 0;

    let wSum = 0, sSum = 0;
    for (const [val, w] of [[pVisual, wVisual], [pChat, wChat], [pDeliv, wDeliv], [pWeb, wWeb]]) {
      if (val !== null && w > 0) {
        wSum += w;
        sSum += val * w;
      }
    }
    if (wSum <= 0) continue;
    // Gentle coverage shrinkage only when total pillar weight < 0.85 (avoids penalizing fresh flagships missing 1 sub-source)
    const priorW = Math.max(0, 0.85 - wSum) * 0.45;
    const humanIndex = Number(((sSum + priorW * 50) / (wSum + priorW)).toFixed(2));
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
      dimensionCount: [pVisual, pChat, pDeliv, pWeb].filter(v => v !== null).length,
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

function parseSimpleCsv(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(v => v.trim() !== '')) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').trim();
    });
    return obj;
  });
}

function formatLiveBenchDate(releaseId) {
  if (typeof releaseId !== 'string') return null;
  const m = releaseId.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : releaseId;
}

function parseLiveBenchData({ tableCsv, categoriesJson, costCsv, releaseId, models }) {
  const tableRows = parseSimpleCsv(tableCsv);
  if (!tableRows.length) return { board: null, byModelId: new Map() };
  const costRows = parseSimpleCsv(costCsv || '');
  const costByModel = new Map(costRows.map(r => [r.model, r]));

  const rawWeights = categoriesJson && typeof categoriesJson._overall_weights === 'object' ? categoriesJson._overall_weights : {};
  const categories = {};
  for (const [label, cols] of Object.entries(categoriesJson || {})) {
    if (label === '_overall_weights' || !Array.isArray(cols) || !cols.length) continue;
    categories[label] = cols;
  }
  const catNames = Object.keys(categories);
  const allCols = Object.values(categories).flat();
  const { resolve } = buildModelArenaIndex(models || []);

  const parsed = [];
  for (const r of tableRows) {
    const rawModel = r.model;
    if (!rawModel) continue;
    const suites = {};
    let weightedSum = 0, weightTotal = 0;
    for (const label of catNames) {
      const cols = categories[label];
      const vals = cols.map(c => Number(r[c])).filter(v => Number.isFinite(v));
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const shortKey = LIVEBENCH_SUITE_KEYS[label] || label.toLowerCase().replace(/[^a-z0-9]+/g, '');
      suites[shortKey] = Number(avg.toFixed(1));
      const w = Number.isFinite(Number(rawWeights[label])) && Number(rawWeights[label]) > 0 ? Number(rawWeights[label]) : 1;
      weightedSum += avg * w;
      weightTotal += w;
    }
    if (weightTotal <= 0) continue;
    const overall = Number((weightedSum / weightTotal).toFixed(2));
    const cRow = costByModel.get(rawModel);
    let lbCost = null;
    if (cRow) {
      let costSum = 0, qSum = 0;
      for (const col of allCols) {
        const cVal = Number(cRow[col]);
        const nqVal = Number(cRow[`nq_${col}`]);
        if (Number.isFinite(cVal) && Number.isFinite(nqVal) && nqVal > 0) {
          costSum += cVal;
          qSum += nqVal;
        }
      }
      if (qSum > 0) lbCost = Number((costSum / qSum).toFixed(4));
    }
    const matched = resolve(rawModel);
    parsed.push({
      rawModel,
      name: matched ? (matched.shortName || matched.name) : rawModel,
      creator: matched?.creator?.name || null,
      modelId: matched?.id || null,
      aaCost: matched?.cost ?? null,
      overall,
      lbCost,
      suites
    });
  }
  parsed.sort((a, b) => b.overall - a.overall || (a.lbCost ?? Infinity) - (b.lbCost ?? Infinity) || a.rawModel.localeCompare(b.rawModel));
  const byModelId = new Map();
  const rows = parsed.map((item, idx) => {
    const rank = idx + 1;
    const row = {
      rank,
      rawName: item.rawModel,
      name: item.name,
      ...(item.creator ? { creator: item.creator } : {}),
      ...(item.modelId ? { modelId: item.modelId } : {}),
      score: item.overall,
      ...(item.lbCost !== null ? { lbCost: item.lbCost } : {}),
      ...(item.aaCost !== null ? { cost: item.aaCost } : {}),
      suites: item.suites
    };
    if (item.modelId && !byModelId.has(item.modelId)) {
      byModelId.set(item.modelId, {
        overall: item.overall,
        rank,
        ...(item.lbCost !== null ? { lbCost: item.lbCost } : {}),
        ...item.suites
      });
    }
    return row;
  });

  return {
    board: {
      releaseId: releaseId || LIVEBENCH_FALLBACK_RELEASE,
      date: formatLiveBenchDate(releaseId || LIVEBENCH_FALLBACK_RELEASE),
      sourceUrl: LIVEBENCH_SITE_URL,
      totalCount: rows.length,
      matchedCount: rows.filter(r => r.modelId).length,
      rows
    },
    byModelId
  };
}

async function fetchLiveBench(models, previous, get = getBuffer) {
  try {
    let releaseId = LIVEBENCH_FALLBACK_RELEASE;
    try {
      const html = (await get(LIVEBENCH_SITE_URL)).toString('utf8');
      const jsPath = html.match(/src=["'](\.?\/static\/js\/main\.[^"']+\.js)["']/)?.[1];
      if (jsPath) {
        const jsUrl = new URL(jsPath, LIVEBENCH_SITE_URL).toString();
        const bundle = (await get(jsUrl)).toString('utf8');
        const v2Arr = bundle.match(/\[((?:"202\d{5}",?)+)\]/)?.[1];
        if (v2Arr) {
          const ids = [...v2Arr.matchAll(/"(202\d{5})"/g)].map(m => m[1]).sort();
          if (ids.length) releaseId = ids[ids.length - 1];
        }
      }
    } catch { /* Fall back to known v2 release id. */ }

    const base = `https://livebench.ai/data/${releaseId}`;
    const [tableBuf, catBuf, costRes] = await Promise.all([
      get(`${base}/table.csv`),
      get(`${base}/categories.json`),
      get(`${base}/cost.csv`).catch(() => null)
    ]);
    const parsed = parseLiveBenchData({
      tableCsv: tableBuf.toString('utf8'),
      categoriesJson: JSON.parse(catBuf.toString('utf8')),
      costCsv: costRes ? costRes.toString('utf8') : '',
      releaseId,
      models
    });
    if (!costRes && parsed.board && previous?.orgLeaderboards?.livebench?.releaseId === parsed.board.releaseId) {
      const prevCostByRaw = new Map(
        (previous.orgLeaderboards.livebench.rows || [])
          .filter(r => r?.rawName && typeof r.lbCost === 'number')
          .map(r => [r.rawName, r.lbCost])
      );
      if (prevCostByRaw.size) {
        for (const row of parsed.board.rows) {
          const prevLbCost = prevCostByRaw.get(row.rawName);
          if (row.lbCost == null && prevLbCost != null) {
            row.lbCost = prevLbCost;
            if (row.modelId && parsed.byModelId.has(row.modelId)) {
              parsed.byModelId.get(row.modelId).lbCost = prevLbCost;
            }
          }
        }
      }
    }
    if (parsed.board && parsed.board.rows.length >= 10) return parsed;
  } catch (error) {
    console.warn(`LiveBench 2.0 refresh degraded gracefully: ${error.message}`);
  }
  const prevBoard = previous?.orgLeaderboards?.livebench || null;
  const byModelId = new Map();
  if (prevBoard && Array.isArray(prevBoard.rows)) {
    const { resolve } = buildModelArenaIndex(models || []);
    for (const r of prevBoard.rows) {
      const matched = resolve(r.rawName || r.name);
      const id = matched?.id || r.modelId;
      if (id && !byModelId.has(id)) {
        byModelId.set(id, {
          overall: r.score,
          rank: r.rank,
          ...(r.lbCost != null ? { lbCost: r.lbCost } : {}),
          ...(r.suites || {})
        });
      }
    }
  }
  return { board: prevBoard, byModelId };
}

function buildOrgArenaBoards(models, { chatRows = [], webdevRows = [], designByCat = {}, lmArenaPublishDate = null }) {
  const { resolve } = buildModelArenaIndex(models || []);
  const normLmBoard = (rows, limit = 60) => {
    const seen = new Set();
    const sorted = [...rows]
      .filter(r => r && (!r.category || r.category === 'overall') && Number.isFinite(Number(r.rating)))
      .sort((a, b) => Number(b.rating) - Number(a.rating));
    const out = [];
    for (const r of sorted) {
      const rawName = String(r.model_name || r.modelName || r.name || '').trim();
      if (!rawName || seen.has(rawName.toLowerCase())) continue;
      seen.add(rawName.toLowerCase());
      const matched = resolve(rawName);
      out.push({
        rank: out.length + 1,
        rawName,
        name: matched ? (matched.shortName || matched.name) : rawName,
        ...(matched?.creator?.name ? { creator: matched.creator.name } : (r.organization ? { creator: r.organization } : {})),
        ...(matched?.id ? { modelId: matched.id } : {}),
        ...(matched?.cost != null ? { cost: matched.cost } : {}),
        score: Number(Number(r.rating).toFixed(1)),
        ...(Number.isFinite(Number(r.vote_count ?? r.votes)) ? { votes: Math.round(Number(r.vote_count ?? r.votes)) } : {})
      });
      if (out.length >= limit) break;
    }
    return out;
  };

  const arenaChatRows = normLmBoard(chatRows, 60);
  const arenaWebdevRows = normLmBoard(webdevRows, 60);

  // Build Design Arena standalone board anchored on 'website' + enriched with other 4 categories
  const extraCatMaps = {};
  for (const cat of ['uicomponent', 'dataviz', 'gamedev', 'svg']) {
    const m = new Map();
    for (const item of (designByCat[cat] || [])) {
      const key = String(item?.modelId || item?.name || '').toLowerCase();
      if (key && Number.isFinite(Number(item?.elo))) m.set(key, Math.round(Number(item.elo)));
    }
    extraCatMaps[cat] = m;
  }
  const webSorted = [...(designByCat.website || [])]
    .filter(item => item && Number.isFinite(Number(item.elo)))
    .sort((a, b) => Number(b.elo) - Number(a.elo));
  const designSeen = new Set();
  const designRows = [];
  for (const item of webSorted) {
    const rawName = String(item.displayName || item.name || item.modelId || '').trim();
    const key = String(item.modelId || item.name || '').toLowerCase();
    if (!rawName || designSeen.has(key)) continue;
    designSeen.add(key);
    const matched = resolve(item.modelId || item.name || item.displayName);
    const suites = {
      website: Math.round(Number(item.elo)),
      ...(extraCatMaps.uicomponent.has(key) ? { uicomponent: extraCatMaps.uicomponent.get(key) } : {}),
      ...(extraCatMaps.dataviz.has(key) ? { dataviz: extraCatMaps.dataviz.get(key) } : {}),
      ...(extraCatMaps.gamedev.has(key) ? { gamedev: extraCatMaps.gamedev.get(key) } : {}),
      ...(extraCatMaps.svg.has(key) ? { svg: extraCatMaps.svg.get(key) } : {})
    };
    designRows.push({
      rank: designRows.length + 1,
      rawName,
      name: matched ? (matched.shortName || matched.name) : rawName,
      ...(matched?.creator?.name ? { creator: matched.creator.name } : (item.provider ? { creator: item.provider } : {})),
      ...(matched?.id ? { modelId: matched.id } : {}),
      ...(matched?.cost != null ? { cost: matched.cost } : {}),
      score: Math.round(Number(item.elo)),
      ...(typeof item.winRate === 'number' && Number.isFinite(item.winRate) ? { winRate: Number(item.winRate.toFixed(1)) } : {}),
      ...(Number.isFinite(Number(item.battles)) ? { battles: Math.round(Number(item.battles)) } : {}),
      suites
    });
    if (designRows.length >= 60) break;
  }

  return {
    ...(arenaChatRows.length ? {
      arenaChat: {
        date: lmArenaPublishDate || null,
        sourceUrl: 'https://arena.ai/leaderboard',
        totalCount: arenaChatRows.length,
        matchedCount: arenaChatRows.filter(r => r.modelId).length,
        rows: arenaChatRows
      }
    } : {}),
    ...(arenaWebdevRows.length ? {
      arenaWebdev: {
        date: lmArenaPublishDate || null,
        sourceUrl: 'https://arena.ai/leaderboard',
        totalCount: arenaWebdevRows.length,
        matchedCount: arenaWebdevRows.filter(r => r.modelId).length,
        rows: arenaWebdevRows
      }
    } : {}),
    ...(designRows.length ? {
      designArena: {
        sourceUrl: 'https://www.designarena.ai/leaderboard',
        totalCount: designRows.length,
        matchedCount: designRows.filter(r => r.modelId).length,
        rows: designRows
      }
    } : {})
  };
}

function fallbackHumanArenas(models, previous) {
  const byId = new Map((models || []).filter(m => m?.id).map(m => [m.id, m]));
  const prevHuman = Array.isArray(previous?.humanArenaModels)
    ? previous.humanArenaModels.map(h => {
        const live = h?.id ? byId.get(h.id) : null;
        if (!live || !Number.isFinite(h.humanIndex)) return h;
        const aaIndex = Number(live.intelligenceIndex.toFixed(2));
        return {
          ...h,
          cost: live.cost,
          aaIndex,
          indexDelta: Number((h.humanIndex - aaIndex).toFixed(2)),
          deprecated: !!live.deprecated,
          ...(live.timeSec ? { timeSec: live.timeSec } : {})
        };
      })
    : [];
  if (prevHuman.length && prevHuman.every(r => r?.id && Number.isFinite(r.cost) && Number.isFinite(r.intelligenceIndex))) {
    validateRows(prevHuman, 1, 'human-arena-model');
  }
  const syncBoard = board => (board && Array.isArray(board.rows))
    ? {
        ...board,
        rows: board.rows.map(r => {
          const live = r?.modelId ? byId.get(r.modelId) : null;
          return live ? { ...r, cost: live.cost } : r;
        })
      }
    : null;
  const arenaChat = syncBoard(previous?.orgLeaderboards?.arenaChat);
  const arenaWebdev = syncBoard(previous?.orgLeaderboards?.arenaWebdev);
  const designArena = syncBoard(previous?.orgLeaderboards?.designArena);
  return {
    humanArenaModels: prevHuman,
    lmArenaPublishDate: previous?.lmArenaPublishDate || null,
    arenaBoards: {
      ...(arenaChat ? { arenaChat } : {}),
      ...(arenaWebdev ? { arenaWebdev } : {}),
      ...(designArena ? { designArena } : {})
    }
  };
}

async function fetchHumanArenas(models, previous, get = getBuffer) {
  const hasPrev = Array.isArray(previous?.humanArenaModels) && previous.humanArenaModels.length > 0;
  try {
    const lmSpecs = [
      ['chat0', 'text_style_control', 0],
      ['chat1', 'text_style_control', 100],
      ['chat2', 'text_style_control', 200],
      ['web0', 'webdev', 0],
      ['doc0', 'document_style_control', 0]
    ];
    // Query HuggingFace Datasets Server sequentially to avoid burst 500/502 gateway errors,
    // while fetching Design Arena categories in parallel on their separate origin.
    const fetchLmSequential = async () => {
      const out = {};
      for (const [key, cfg, offset] of lmSpecs) {
        try {
          out[key] = { status: 'fulfilled', value: await fetchLmArenaSlice(cfg, offset, get) };
        } catch (reason) {
          out[key] = { status: 'rejected', reason };
          if (hasPrev) break;
        }
      }
      return out;
    };
    const [lmRes, designResults] = await Promise.all([
      fetchLmSequential(),
      Promise.allSettled(DESIGN_ARENA_CATEGORIES.map(cat => fetchDesignArenaCategory(cat, get)))
    ]);

    if (hasPrev) {
      const failed = [];
      for (const [key] of lmSpecs) {
        if (lmRes[key]?.status !== 'fulfilled') failed.push(`lmarena:${key}`);
      }
      DESIGN_ARENA_CATEGORIES.forEach((cat, idx) => {
        if (designResults[idx]?.status !== 'fulfilled') failed.push(`design:${cat}`);
      });
      if (failed.length) {
        throw new Error(`Incomplete external arena sub-sources (${failed.join(', ')})`);
      }
    }

    const { chat0, chat1, chat2, web0, doc0 } = lmRes;
    const chatRows = [
      ...(chat0?.status === 'fulfilled' ? chat0.value.rows : []),
      ...(chat1?.status === 'fulfilled' ? chat1.value.rows : []),
      ...(chat2?.status === 'fulfilled' ? chat2.value.rows : [])
    ];
    const webdevRows = web0?.status === 'fulfilled' ? web0.value.rows : [];
    const docRows = doc0?.status === 'fulfilled' ? doc0.value.rows : [];
    const designByCat = {};
    DESIGN_ARENA_CATEGORIES.forEach((cat, idx) => {
      const res = designResults[idx];
      if (res?.status === 'fulfilled') designByCat[cat] = res.value;
    });

    if (hasPrev) {
      if (chatRows.length < 10 || webdevRows.length < 5 || docRows.length < 5 || (designByCat.website?.length || 0) < 10) {
        throw new Error(
          `Unexpectedly empty arena sub-leaderboard (chat=${chatRows.length}, webdev=${webdevRows.length}, doc=${docRows.length}, designWeb=${designByCat.website?.length || 0})`
        );
      }
    }

    const lmArenaPublishDate = (chat0?.status === 'fulfilled' && chat0.value.date) || (web0?.status === 'fulfilled' && web0.value.date) || previous?.lmArenaPublishDate || null;
    const humanArenaModels = buildHumanArenaModels(models, { chatRows, webdevRows, docRows, designByCat });
    const arenaBoards = buildOrgArenaBoards(models, { chatRows, webdevRows, designByCat, lmArenaPublishDate });

    if (hasPrev) {
      for (const boardKey of ['arenaChat', 'arenaWebdev', 'designArena']) {
        const prevLen = previous?.orgLeaderboards?.[boardKey]?.rows?.length || 0;
        const nextLen = arenaBoards?.[boardKey]?.rows?.length || 0;
        if (prevLen >= 10 && nextLen < Math.max(5, Math.floor(prevLen * 0.5))) {
          throw new Error(`Degraded ${boardKey} board (${nextLen} rows vs previous ${prevLen})`);
        }
      }
      if (previous.humanArenaModels.length >= 20 && humanArenaModels.length < Math.floor(previous.humanArenaModels.length * 0.7)) {
        throw new Error(`Degraded humanArenaModels count (${humanArenaModels.length} vs previous ${previous.humanArenaModels.length})`);
      }
    }

    if (humanArenaModels.length >= 10) {
      validateRows(humanArenaModels, 10, 'human-arena-model');
      return {
        humanArenaModels,
        lmArenaPublishDate,
        arenaBoards
      };
    }
    console.warn(`External human arena matched ${humanArenaModels.length} models (< 10); falling back to previous snapshot if available.`);
  } catch (error) {
    console.warn(`External human arena refresh degraded gracefully: ${error.message}`);
  }
  return fallbackHumanArenas(models, previous);
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

const GENERIC_MEDIA_TIERS = /^(?:standard|neural|generative|long-form|studio|journey|wavenet|polyglot|hd|turbo|flash|pro|lite|mini)$/i;

function cleanMediaShortName(raw, fullName = '', creatorName = '') {
  const stripNoise = str => String(str || '')
    .replace(/\s*\((?:Gemini|Tencent|Alibaba|OpenAI|ByteDance)[^)]{8,}\)$/i, '')
    .replace(/\s*\((?:\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4})\)$/i, '')
    .trim();
  let cleaned = stripNoise(raw) || String(raw || '').trim();
  const cleanFull = stripNoise(fullName);
  if (GENERIC_MEDIA_TIERS.test(cleaned) && cleanFull && !GENERIC_MEDIA_TIERS.test(cleanFull)) {
    cleaned = cleanFull;
  }
  if (GENERIC_MEDIA_TIERS.test(cleaned) && creatorName && creatorName !== 'Other') {
    cleaned = `${creatorName} ${cleaned}`;
  }
  return cleaned;
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
      const t2i = rec.t2iElo !== null ? eloToWinPct(rec.t2iElo, 1010, 300) : null;
      const imgEdit = rec.editElo !== null ? eloToWinPct(rec.editElo, 1025, 300) : null;
      const parts = [t2i, imgEdit].filter(v => v !== null);
      if (!parts.length) continue;
      const idxScore = Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2));
      const isOpen = !!(meta?.openWeightsUrl || /\b(flux\.1\s*\[?(?:dev|schnell)|stable diffusion|sdxl|sd\s*3\.5|qwen-image|hidream|hunyuan|cogview|sana)\b/i.test(rec.item.name));
      const imgCreator = creator(rec.item.creator || meta?.creator);
      const entry = {
        id: `img:${rawId}`,
        slug: rec.item.slug || rawId,
        name: GENERIC_MEDIA_TIERS.test(rec.item.name.trim()) && imgCreator.name !== 'Other' ? `${imgCreator.name} ${rec.item.name.trim()}` : rec.item.name,
        shortName: cleanMediaShortName(meta?.shortName || rec.item.name, rec.item.name, imgCreator.name),
        mediaKind: 'image',
        intelligenceIndex: idxScore,
        cost: Number((rec.pricePer1k / 1000).toFixed(6)),
        creator: imgCreator,
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
      const t2v = rec.t2vElo !== null ? eloToWinPct(rec.t2vElo, 1050, 210) : null;
      const i2v = rec.i2vElo !== null ? eloToWinPct(rec.i2vElo, 1050, 210) : null;
      const vidEdit = rec.vidEditElo !== null ? eloToWinPct(rec.vidEditElo, 1050, 210) : null;
      const parts = [t2v, i2v, vidEdit].filter(v => v !== null);
      if (!parts.length) continue;
      const idxScore = Number((parts.reduce((a, b) => a + b, 0) / parts.length).toFixed(2));
      const isOpen = !!(meta?.openWeightsUrl || /\b(wan\s*2|hunyuanvideo|cogvideo|mochi|ltx-video|skyreels|step-video)\b/i.test(rec.item.name));
      const vidCreator = creator(rec.item.creator || meta?.creator);
      const entry = {
        id: `vid:${rawId}`,
        slug: rec.item.slug || rawId,
        name: GENERIC_MEDIA_TIERS.test(rec.item.name.trim()) && vidCreator.name !== 'Other' ? `${vidCreator.name} ${rec.item.name.trim()}` : rec.item.name,
        shortName: cleanMediaShortName(meta?.shortName || rec.item.name, rec.item.name, vidCreator.name),
        mediaKind: 'video',
        intelligenceIndex: idxScore,
        cost: Number((rec.pricePerMin / 12).toFixed(5)),
        creator: vidCreator,
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
      const ttsScore = eloToWinPct(m.qualityElo, 1105, 300);
      const timeSec = Number.isFinite(h.performance?.medianGenerationTimeSeconds) && h.performance.medianGenerationTimeSeconds > 0
        ? Number(h.performance.medianGenerationTimeSeconds.toFixed(2))
        : null;
      const ttfaMs = Number.isFinite(h.latencyPerformance?.medianTimeToFirstAudioMs) && h.latencyPerformance.medianTimeToFirstAudioMs > 0
        ? Math.round(h.latencyPerformance.medianTimeToFirstAudioMs)
        : null;
      const ttsCreator = creator(m.creator || h.host);
      const ttsFullName = GENERIC_MEDIA_TIERS.test(m.name.trim()) && ttsCreator.name !== 'Other'
        ? `${ttsCreator.name} ${m.name.trim()}`
        : m.name;
      const entry = {
        id: `tts:${mId}`,
        slug: m.slug || mId,
        name: ttsFullName,
        shortName: cleanMediaShortName(m.shortName || m.name, ttsFullName, ttsCreator.name),
        mediaKind: 'tts',
        intelligenceIndex: ttsScore,
        cost: Number((h.pricePer1mCharacters / 1000).toFixed(6)),
        creator: ttsCreator,
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

  // Disambiguate duplicate shortNames within the same modality so chart/table labels stay unique.
  const shortBuckets = new Map();
  for (const entry of out) {
    const key = `${entry.mediaKind}::${String(entry.shortName || '').trim().toLowerCase()}`;
    if (!shortBuckets.has(key)) shortBuckets.set(key, []);
    shortBuckets.get(key).push(entry);
  }
  for (const group of shortBuckets.values()) {
    if (group.length < 2) continue;
    const distinctNames = new Set(group.map(e => String(e.name || '').trim().toLowerCase()));
    if (distinctNames.size > 1) {
      for (const e of group) {
        if (e.name && e.name.trim()) e.shortName = e.name.trim();
      }
    }
    const stillDup = new Map();
    for (const e of group) {
      const k = String(e.shortName || '').trim().toLowerCase();
      if (!stillDup.has(k)) stillDup.set(k, []);
      stillDup.get(k).push(e);
    }
    for (const sub of stillDup.values()) {
      if (sub.length < 2) continue;
      const slugs = sub.map(e => String(e.slug || ''));
      const shortestSlug = slugs.reduce((a, b) => (a.length <= b.length ? a : b));
      for (const e of sub) {
        const slug = String(e.slug || '');
        if (slug.length > shortestSlug.length && slug.startsWith(`${shortestSlug}-`)) {
          const qual = slug.slice(shortestSlug.length + 1).replace(/[-_]+/g, ' ').trim();
          if (qual) e.shortName = `${e.shortName} (${qual})`;
        }
      }
    }
  }

  if (out.length) validateRows(out, 1, 'media-model');
  return out;
}

function diffGroupKey(cur, tab) {
  if (tab === 'coding-agents') {
    const raw = cur.modelName || cur.family?.slug?.split(':')[1] || cur.id;
    return String(raw).replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase() || cur.id;
  }
  if (tab === 'models' || tab === 'cyber') {
    return cur.family?.slug || cur.id;
  }
  return cur.id;
}

function buildSnapshotDiff(output, previous, dateStr = new Date().toISOString().slice(0, 10)) {
  const events = [];
  const rowMeta = cur => ({
    ...(cur.creator?.name && cur.creator.name !== 'Other' ? { creator: cur.creator.name } : {}),
    ...(cur.mediaKind ? { mediaKind: cur.mediaKind } : {})
  });
  const compareSuite = (nextArr, prevArr, tab) => {
    if (!Array.isArray(nextArr) || !Array.isArray(prevArr) || !prevArr.length) return;
    const prevMap = new Map(prevArr.map(r => [r.id, r]));
    const suiteNewEvents = [];
    const suitePriceEvents = [];
    const suiteScoreEvents = [];
    for (const cur of nextArr) {
      const old = prevMap.get(cur.id);
      const dispName = cleanMediaShortName(cur.shortName || cur.name, cur.name, cur.creator?.name || '');
      const groupKey = diffGroupKey(cur, tab);
      if (!old) {
        suiteNewEvents.push({
          _groupKey: groupKey,
          date: dateStr,
          ...(cur.releaseDate ? { releaseDate: cur.releaseDate } : {}),
          kind: 'new',
          tab,
          id: cur.id,
          name: dispName,
          ...rowMeta(cur),
          score: Number(cur.intelligenceIndex.toFixed(1)),
          cost: Number(cur.cost.toFixed(4))
        });
        continue;
      }
      if (old.cost > 0) {
        const relCost = (cur.cost - old.cost) / old.cost;
        if (Math.abs(relCost) >= 0.03 && Math.abs(cur.cost - old.cost) >= 0.0005) {
          suitePriceEvents.push({
            _groupKey: groupKey,
            _score: cur.intelligenceIndex,
            date: dateStr,
            kind: relCost < 0 ? 'price-drop' : 'price-up',
            tab,
            id: cur.id,
            name: dispName,
            ...rowMeta(cur),
            oldCost: Number(old.cost.toFixed(4)),
            cost: Number(cur.cost.toFixed(4)),
            pct: Math.round(relCost * 100)
          });
        }
      }
      const dScore = cur.intelligenceIndex - old.intelligenceIndex;
      const minDelta = tab === 'media' ? 2.5 : 0.5;
      if (Math.abs(dScore) >= minDelta) {
        suiteScoreEvents.push({
          date: dateStr,
          kind: 'score',
          tab,
          id: cur.id,
          name: dispName,
          ...rowMeta(cur),
          oldScore: Number(old.intelligenceIndex.toFixed(1)),
          score: Number(cur.intelligenceIndex.toFixed(1)),
          delta: Number(dScore.toFixed(1))
        });
      }
    }
    if (suiteNewEvents.length) {
      // Prevent multi-harness coding-agent waves or multi-effort launches from flooding all 20 diff slots.
      suiteNewEvents.sort((a, b) => (b.score || 0) - (a.score || 0) || (a.cost || 0) - (b.cost || 0) || a.id.localeCompare(b.id));
      const seenGroups = new Set();
      const dedupedNew = [];
      for (const item of suiteNewEvents) {
        if (seenGroups.has(item._groupKey)) continue;
        seenGroups.add(item._groupKey);
        const { _groupKey, ...clean } = item;
        dedupedNew.push(clean);
        if (dedupedNew.length >= 6) break;
      }
      events.push(...dedupedNew);
    }
    const massRescaleThreshold = Math.max(8, Math.floor(prevArr.length * 0.25));
    if (suitePriceEvents.length) {
      suitePriceEvents.sort((a, b) => Math.abs(b.pct || 0) - Math.abs(a.pct || 0) || (b._score || 0) - (a._score || 0) || a.id.localeCompare(b.id));
      const groupCounts = new Map();
      const maxPerGroup = suitePriceEvents.length > massRescaleThreshold ? 1 : 2;
      const cap = suitePriceEvents.length > massRescaleThreshold ? 4 : 6;
      const keptPrice = [];
      for (const item of suitePriceEvents) {
        const cnt = groupCounts.get(item._groupKey) || 0;
        if (cnt >= maxPerGroup) continue;
        groupCounts.set(item._groupKey, cnt + 1);
        const { _groupKey, _score, ...clean } = item;
        keptPrice.push(clean);
        if (keptPrice.length >= cap) break;
      }
      events.push(...keptPrice);
    }
    if (suiteScoreEvents.length <= massRescaleThreshold) {
      suiteScoreEvents.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || (b.score || 0) - (a.score || 0));
      events.push(...suiteScoreEvents.slice(0, 4));
    }
  };

  if (previous) {
    compareSuite(output.models, previous.models, 'models');
    compareSuite(output.codingAgents, previous.codingAgents, 'coding-agents');
    compareSuite(output.cyberModels, previous.cyberModels, 'cyber');
    compareSuite(output.mediaModels, previous.mediaModels, 'media');
  }

  const eventPriority = ev => {
    const kindW = ev.kind === 'new' ? 300 : ev.kind === 'price-drop' ? 220 : ev.kind === 'price-up' ? 160 : 80;
    const tabW = ev.tab === 'models' ? 90 : ev.tab === 'coding-agents' ? 70 : ev.tab === 'cyber' ? 55 : 20;
    return kindW + tabW + Math.min(60, ev.score || 0);
  };
  events.sort((a, b) => eventPriority(b) - eventPriority(a));

  const priorEvents = Array.isArray(previous?.diffEvents) ? previous.diffEvents : [];
  const deduped = [];
  const seen = new Set();
  for (const ev of [...events, ...priorEvents]) {
    if (!ev?.id || !ev?.kind) continue;
    const key = `${ev.date}:${ev.tab}:${ev.id}:${ev.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ev);
  }
  deduped.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || eventPriority(b) - eventPriority(a));
  const merged = deduped.slice(0, 20);

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
          ...rowMeta(m),
          score: Number(m.intelligenceIndex.toFixed(1)),
          cost: Number(m.cost.toFixed(4))
        });
        if (merged.length >= 8) break;
      }
    }
  }

  return merged;
}

function simplifyChangelog(items, rawModels = null) {
  if (!Array.isArray(items)) return [];
  const rawByName = new Map();
  if (Array.isArray(rawModels)) {
    for (const m of rawModels) {
      if (!m) continue;
      for (const field of [m.name, m.shortName]) {
        const key = typeof field === 'string' ? field.trim().toLowerCase() : '';
        if (key && !rawByName.has(key)) rawByName.set(key, m);
      }
    }
  }
  const out = [];
  for (const item of items) {
    if (!item?.title || !item?.dateLa) continue;
    const type = typeof item.type === 'string' ? item.type : 'update';
    const title = String(item.title);
    const entry = {
      date: String(item.dateLa),
      type,
      title,
      url: typeof item.url === 'string' && item.url.startsWith('/') ? `https://artificialanalysis.ai${item.url}` : null
    };
    if (rawByName.size && (type === 'modelAdded' || type === 'model')) {
      const hit = rawByName.get(title.trim().toLowerCase());
      if (hit) {
        const rawCostObj = hit.intelligenceIndexCostPerTask?.cost ?? hit.intelligenceIndexCostPerTask;
        const rawCost = typeof rawCostObj === 'object' ? rawCostObj?.total : rawCostObj;
        const meta = {
          ...(hit.id ? { modelId: String(hit.id) } : {}),
          ...(hit.creator?.name ? { creator: String(hit.creator.name) } : {}),
          ...(typeof hit.intelligenceIndex === 'number' && Number.isFinite(hit.intelligenceIndex)
            ? { score: Number(hit.intelligenceIndex.toFixed(2)) }
            : {}),
          hasPricing: typeof rawCost === 'number' && Number.isFinite(rawCost) && rawCost > 0,
          isOpenWeights: Boolean(hit.isOpenWeights),
          ...(hit.releaseDate ? { releaseDate: String(hit.releaseDate).slice(0, 10) } : {})
        };
        entry.meta = meta;
      }
    }
    out.push(entry);
    if (out.length >= 20) break;
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
    if (Array.isArray(previous?.mediaModels) && previous.mediaModels.length) {
      const restored = [...mediaModels];
      let didRestore = false;
      for (const kind of ['image', 'video', 'tts']) {
        const curKindCount = restored.filter(m => m.mediaKind === kind).length;
        const prevKindRows = previous.mediaModels.filter(m => m.mediaKind === kind);
        if (prevKindRows.length >= 5 && curKindCount < Math.max(3, Math.floor(prevKindRows.length * 0.5))) {
          console.warn(`Media modality "${kind}" degraded (${curKindCount} vs previous ${prevKindRows.length}); preserving previous ${kind} rows.`);
          for (let i = restored.length - 1; i >= 0; i--) {
            if (restored[i].mediaKind === kind) restored.splice(i, 1);
          }
          restored.push(...prevKindRows);
          didRestore = true;
        }
      }
      if (didRestore) {
        if (restored.length) validateRows(restored, 1, 'media-model');
        mediaModels = restored;
      } else if (mediaModels.length < 10) {
        mediaModels = previous.mediaModels;
      }
    }
  }

  const capMap = new Map();
  if (Array.isArray(modelPayload.capabilityModels)) {
    for (const capItem of modelPayload.capabilityModels) {
      if (capItem?.id && capItem?.capabilities) capMap.set(capItem.id, capItem.capabilities);
    }
  }

  const models = modelPayload.models.map(m => simplifyModel(m, capMap, hostMap)).filter(Boolean);
  if (includeHosts && !hostMap && Array.isArray(previous?.models)) {
    const prevProvidersById = new Map(
      previous.models.filter(m => m?.id && Array.isArray(m.providers) && m.providers.length >= 2).map(m => [m.id, m.providers])
    );
    if (prevProvidersById.size) {
      for (const m of models) {
        const prevProv = prevProvidersById.get(m.id);
        if (!m.providers && prevProv) m.providers = prevProv;
      }
      hostsManifestPath = previous?.hostsManifestPath || null;
    }
  }
  validateRows(models, 50, 'model');

  const byId = new Map(models.map(m => [m.id, m]));
  const bySlug = new Map(models.filter(m => m.slug).map(m => [m.slug, m]));
  const byFamily = new Map();
  for (const m of models) {
    const fSlug = m.family?.slug;
    if (fSlug && (!byFamily.has(fSlug) || m.intelligenceIndex > byFamily.get(fSlug).intelligenceIndex)) {
      byFamily.set(fSlug, m);
    }
  }
  // Enrich byId/bySlug from raw upstream models that lacked positive general-index pricing
  for (const rawM of modelPayload.models) {
    if (!rawM?.id || byId.has(rawM.id)) continue;
    const synth = simplifyModel({ ...rawM, intelligenceIndex: Number.isFinite(rawM.intelligenceIndex) ? rawM.intelligenceIndex : 50, intelligenceIndexCostPerTask: { total: 1 } }, capMap, hostMap);
    if (synth) {
      delete synth.timeSec;
      byId.set(rawM.id, synth);
      if (synth.slug && !bySlug.has(synth.slug)) bySlug.set(synth.slug, synth);
    }
  }
  let cyberModels = [];
  if (Array.isArray(modelPayload.cyberIndexModels)) {
    cyberModels = modelPayload.cyberIndexModels.map(c => simplifyCyberModel(c, byId, bySlug, byFamily)).filter(Boolean);
    if (cyberModels.length >= 3) validateRows(cyberModels, 3, 'cyber-model');
    else cyberModels = [];
  }
  if (cyberModels.length < 3 && Array.isArray(previous?.cyberModels) && previous.cyberModels.length >= 3) {
    cyberModels = previous.cyberModels;
  }
  const changelog = simplifyChangelog(modelPayload.changelog, modelPayload.models);

  return { models, cyberModels, mediaModels, changelog, manifestPath: modelManifestPath, hostsManifestPath };
}

const VOLATILE_SNAPSHOT_KEYS = new Set([
  'designWebBattles',
  'designUiBattles',
  'designAvgCostUsd',
  'battles',
  'chatVotes',
  'webdevVotes',
  'docVotes',
  'votes'
]);

function comparable(snapshot) {
  const { updatedAt, diffEvents, ...data } = snapshot;
  return JSON.stringify(data, (key, value) => (VOLATILE_SNAPSHOT_KEYS.has(key) ? undefined : value));
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
  const { humanArenaModels, lmArenaPublishDate, arenaBoards } = process.env.DISABLE_EXTERNAL_ARENAS === '1'
    ? {
        humanArenaModels: previous?.humanArenaModels || [],
        lmArenaPublishDate: previous?.lmArenaPublishDate || null,
        arenaBoards: {
          ...(previous?.orgLeaderboards?.arenaChat ? { arenaChat: previous.orgLeaderboards.arenaChat } : {}),
          ...(previous?.orgLeaderboards?.arenaWebdev ? { arenaWebdev: previous.orgLeaderboards.arenaWebdev } : {}),
          ...(previous?.orgLeaderboards?.designArena ? { designArena: previous.orgLeaderboards.designArena } : {})
        }
      }
    : await fetchHumanArenas(models, previous, getBuffer);
  const { board: livebenchBoard, byModelId: livebenchByModelId } = process.env.DISABLE_EXTERNAL_ARENAS === '1'
    ? { board: previous?.orgLeaderboards?.livebench || null, byModelId: new Map() }
    : await fetchLiveBench(models, previous, getBuffer);
  if (livebenchByModelId.size) {
    for (const m of models) {
      const lb = livebenchByModelId.get(m.id);
      if (lb) m.livebench = lb;
    }
    for (const fm of frontierModels) {
      const lb = livebenchByModelId.get(fm.id);
      if (lb) fm.livebench = lb;
    }
  }
  const orgLeaderboards = {
    ...(livebenchBoard ? { livebench: livebenchBoard } : {}),
    ...(arenaBoards || {})
  };
  const openFamilyNames = new Set(
    models.filter(m => m.isOpenWeights && m.family?.name).map(m => m.family.name.toLowerCase())
  );
  const requiredComponents = expectedCodingComponents(rawCodingRows);
  const codingAgents = canonicalizeCodingAgents(
    rawCodingRows.map(row => simplifyCodingAgent(row, requiredComponents, openFamilyNames)).filter(Boolean)
  );
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
      lmArenaSourceUrl: 'https://arena.ai/leaderboard',
      designArenaSourceUrl: 'https://www.designarena.ai/leaderboard',
      ...(lmArenaPublishDate ? { lmArenaPublishDate } : {}),
      humanArenaCount: humanArenaModels.length,
      humanArenaModels
    } : {}),
    ...(Object.keys(orgLeaderboards).length ? { orgLeaderboards } : {}),
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
  console.log(`${changed ? 'Wrote' : 'Unchanged:'} ${models.length} models, ${frontierModels.length} frontier, ${humanArenaModels.length} human-arena, ${livebenchBoard?.rows?.length || 0} livebench, ${codingAgents.length} coding agents, ${cyberModels.length} cyber, ${mediaModels.length} media; checked ${new Date().toISOString()}`);
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Multi-source benchmark data check\n- Checked: ${new Date().toISOString()}\n- Models: ${models.length}\n- Frontier hard-eval models: ${frontierModels.length}\n- Human & Aesthetic Arena models: ${humanArenaModels.length}\n- LiveBench 2.0 models: ${livebenchBoard?.rows?.length || 0} (matched ${livebenchBoard?.matchedCount || 0})\n- Coding-agent variants: ${codingAgents.length}\n- Cyber-index models: ${cyberModels.length}\n- Multimodal generation models (Image/Video/TTS): ${mediaModels.length}\n- Excluded coding-agent rows without comparable score/cost: ${output.codingAgentExcludedCount}\n- Snapshot changed: ${changed}\n`);
}

module.exports = { getBuffer, readFlightRecords, readManifests, decryptPayload, simplifyModel, simplifyCyberModel, simplifyChangelog, buildFrontierModels, eloToWinPct, buildModelArenaIndex, buildHumanArenaModels, fetchHumanArenas, parseSimpleCsv, parseLiveBenchData, fetchLiveBench, buildOrgArenaBoards, readTtsHostRows, cleanMediaShortName, buildMediaModels, buildSnapshotDiff, resolveFlightReference, readCodingRows, expectedCodingComponents, simplifyCodingAgent, canonicalizeCodingAgents, validateRows, fetchModels, writeSnapshot };
if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
