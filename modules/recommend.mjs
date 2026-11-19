import {
  paretoFrontier,
  valuePerDollar,
  computeScenarioScore,
  SCENARIO_PRESETS
} from '../chart-math.mjs?v=20261120-06';

export const RECOMMEND_USE_CASES = [
  {
    id: 'general',
    zh: '日常综合主力',
    en: 'Daily All-Rounder',
    tab: 'models',
    yLens: '',
    scenarioId: 'default',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '按「跨机构口碑稳健」「API 效率前沿」「能力上限参照」三类流派对照，避免只看单榜跑分踩坑',
    descEn: 'Contrasts Cross-Org Consensus, API Efficiency, and Top Ceiling picks so single-board scores never mislead'
  },
  {
    id: 'coding-agent',
    zh: '编程智能体（端到端实战）',
    en: 'Coding Agents (End-to-End)',
    tab: 'coding-agents',
    yLens: '',
    scenarioId: 'default',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '直接读取「模型 + IDE/Agent 框架」端到端修仓库实测（Antigravity / Claude Code / Codex 等），更贴近真实写代码手感',
    descEn: 'Reads real end-to-end Model + Agent Harness benchmarks (Antigravity, Claude Code, Codex) instead of raw single-turn scores'
  },
  {
    id: 'coding-api',
    zh: '纯代码 API（裸模型）',
    en: 'Code API (Raw Model)',
    tab: 'models',
    yLens: '',
    scenarioId: 'fullstack',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '适合自建工具链或直接调 API 写代码，按全栈工程配方加权 FrontierCode 2.0、Terminal 4.0 与 WebDev',
    descEn: 'For custom API pipelines: weights FrontierCode 2.0, Terminal 4.0, and WebDev on raw models'
  },
  {
    id: 'writing',
    zh: '聊天写作与自然人味',
    en: 'Writing & Natural Chat',
    tab: 'human-arena',
    yLens: 'chatVibe',
    scenarioId: 'default',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '聚焦 Arena.ai 去水份真人盲投人味与去 AI 套话自然度，写文章聊思路更自然',
    descEn: 'Prioritizes Arena.ai style-controlled human preference and Anti-Slop naturalness'
  },
  {
    id: 'design',
    zh: '网页前端与视觉审美',
    en: 'Web & UI Aesthetics',
    tab: 'human-arena',
    yLens: 'webdev',
    scenarioId: 'default',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '优先保障综合开发底线，按「前端开发主力」「单页视觉参考」「全能上限」三流派对撞，并标明偏科风险',
    descEn: 'Enforces a core-capability floor on the primary pick, contrasting Frontend All-Rounder, Single-Shot Visual, and Ceiling'
  },
  {
    id: 'research',
    zh: '研报办公与防幻觉',
    en: 'Research & Low Hallucination',
    tab: 'models',
    yLens: '',
    scenarioId: 'research',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '加权 44 职业 GDPval 专家交付、长文档检索与低盲区幻觉率，适合严谨专业工作',
    descEn: 'Weights GDPval professional deliverables, long-context rigor, and low hallucination'
  },
  {
    id: 'image',
    zh: 'AI 图像生成与修图',
    en: 'Image Gen & Editing',
    tab: 'media',
    mediaTrack: 'image',
    yLens: '',
    scenarioId: 'default',
    unitZh: '张',
    unitEn: 'img',
    descZh: 'AA Image Arena 双盲投票，按单张图像 API 成本（$/张）独立筛选',
    descEn: 'AA Image Arena blind Elo ranked strictly on linear USD per image ($/img)'
  },
  {
    id: 'video',
    zh: 'AI 视频短片生成',
    en: 'Video Clip Generation',
    tab: 'media',
    mediaTrack: 'video',
    yLens: '',
    scenarioId: 'default',
    unitZh: '5秒',
    unitEn: '5s',
    descZh: 'AA Video Arena 双盲投票，按每 5 秒短片 API 成本（$/5秒）独立筛选',
    descEn: 'AA Video Arena blind Elo ranked strictly on linear USD per 5s clip ($/5s)'
  },
  {
    id: 'tts',
    zh: 'AI 语音合成配音',
    en: 'Speech Synthesis (TTS)',
    tab: 'media',
    mediaTrack: 'tts',
    yLens: '',
    scenarioId: 'default',
    unitZh: '千字',
    unitEn: '1k ch',
    descZh: 'AA Speech Arena 盲听自然度，按每千字成本（$/千字）与首包延迟独立筛选',
    descEn: 'AA Speech Arena naturalness Elo ranked strictly on USD per 1k chars & TTFA latency'
  }
];

export const RECOMMEND_BILLING = [
  {id: 'sub', zh: '月卡 / 订阅工具', en: 'Monthly Plan / IDE', alpha: 8},
  {id: 'api-balanced', zh: '按量 API 均衡', en: 'API Balanced', alpha: 3.2},
  {id: 'api-budget', zh: '极致低价跑批', en: 'API Lowest Cost', alpha: 1.4}
];

export const RECOMMEND_LICENSES = [
  {id: 'all', zh: '不限', en: 'Any'},
  {id: 'open', zh: '仅开源可自部署', en: 'Open-Weights Only'},
  {id: 'closed', zh: '仅商业闭源', en: 'Proprietary Only'}
];

// Backward-compatible export alias if external callers reference RECOMMEND_BUDGETS
export const RECOMMEND_BUDGETS = RECOMMEND_BILLING;

function scoreForUseCase(row, useCase) {
  if (useCase.id === 'coding-api') {
    const preset = SCENARIO_PRESETS.find(p => p.id === 'fullstack');
    return computeScenarioScore({...row, _baseIndex: row._baseIndex ?? row.intelligenceIndex}, preset?.weights) ?? row.intelligenceIndex;
  }
  if (useCase.id === 'research') {
    const preset = SCENARIO_PRESETS.find(p => p.id === 'research');
    return computeScenarioScore({...row, _baseIndex: row._baseIndex ?? row.intelligenceIndex}, preset?.weights) ?? row.intelligenceIndex;
  }
  if (useCase.id === 'writing') {
    return row.humanScores?.chatVibe ?? null;
  }
  if (useCase.id === 'design') {
    const vis = row.humanScores?.designWeb ?? row.humanScores?.pureVisual ?? null;
    const web = row.humanScores?.webdev ?? null;
    if (vis != null && web != null) return Number((0.5 * vis + 0.5 * web).toFixed(2));
    return vis ?? web ?? null;
  }
  return row.intelligenceIndex;
}

function formatPctDelta(cheapCost, refCost) {
  if (!(refCost > 0) || !(cheapCost >= 0)) return 0;
  return Math.round((1 - cheapCost / refCost) * 100);
}

/**
 * Build fast telemetry lookups from snapshot + optional runtime orgRankIndex / divergenceMap
 * so every shortlist candidate carries objective proof badges & honest risk caveats.
 */
function buildEvidenceLookup(snapshot, context = {}) {
  const chatRankById = new Map();
  const chatRankByFam = new Map();
  const webdevRankById = new Map();
  const webdevRankByFam = new Map();
  const designRankById = new Map();
  const designRankByFam = new Map();
  const lbRankById = new Map();
  const lbDesignRankById = new Map();
  const lbDesignRankByFam = new Map();
  const codingRankById = new Map();
  const aaRankById = new Map();

  const models = Array.isArray(snapshot?.models) ? snapshot.models : [];
  const famById = new Map(models.map(m => [m.id, m.family?.slug || null]));
  const aaIndexById = new Map(models.map(m => [m.id, m.intelligenceIndex]));
  const modelFamilies = new Set(models.map(m => m.family?.slug).filter(Boolean));
  const sortedModels = [...models].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex);
  const maxAA = sortedModels[0]?.intelligenceIndex || 0;
  sortedModels.forEach((m, i) => aaRankById.set(m.id, i + 1));

  const coding = Array.isArray(snapshot?.codingAgents) ? snapshot.codingAgents : [];
  [...coding]
    .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
    .forEach((a, i) => codingRankById.set(a.id, i + 1));

  const ext = snapshot?.orgLeaderboards || {};
  (ext.arenaChat?.rows || []).forEach((r, i) => {
    const rank = r.rank || (i + 1);
    if (r.modelId && !chatRankById.has(r.modelId)) {
      chatRankById.set(r.modelId, rank);
      const fam = famById.get(r.modelId);
      if (fam && !chatRankByFam.has(fam)) chatRankByFam.set(fam, rank);
    }
  });
  (ext.arenaWebdev?.rows || []).forEach((r, i) => {
    const rank = r.rank || (i + 1);
    if (r.modelId && !webdevRankById.has(r.modelId)) {
      webdevRankById.set(r.modelId, rank);
      const fam = famById.get(r.modelId);
      if (fam && !webdevRankByFam.has(fam)) webdevRankByFam.set(fam, rank);
    }
  });
  (ext.designArena?.rows || []).forEach((r, i) => {
    const rank = r.rank || (i + 1);
    if (r.modelId && !designRankById.has(r.modelId)) {
      designRankById.set(r.modelId, rank);
      const fam = famById.get(r.modelId);
      if (fam && !designRankByFam.has(fam)) designRankByFam.set(fam, rank);
    }
  });
  (ext.livebench?.rows || []).forEach((r, i) => {
    const rank = r.rank || (i + 1);
    if (r.modelId && !lbRankById.has(r.modelId)) lbRankById.set(r.modelId, rank);
  });
  [...(ext.livebench?.rows || [])]
    .filter(r => r.modelId && typeof r.suites?.design === 'number')
    .sort((a, b) => b.suites.design - a.suites.design)
    .forEach((r, i) => {
      const rank = i + 1;
      if (!lbDesignRankById.has(r.modelId)) {
        lbDesignRankById.set(r.modelId, rank);
        const fam = famById.get(r.modelId);
        if (fam && !lbDesignRankByFam.has(fam)) lbDesignRankByFam.set(fam, rank);
      }
    });

  // Also check orgRankIndex passed by app.js for family fallback chat ranks
  const orgRankIndex = context.orgRankIndex instanceof Map ? context.orgRankIndex : null;
  const divById = new Map();
  const divByFam = new Map();
  if (Array.isArray(context.divergenceRows)) {
    for (const r of context.divergenceRows) {
      divById.set(r.modelId, r);
      if (r.familySlug && !divByFam.has(r.familySlug)) divByFam.set(r.familySlug, r);
    }
  }

  function getChatRank(row) {
    const direct = chatRankById.get(row.id);
    if (direct != null) return {rank: direct, exact: true};
    const canInheritSibling = !row.effort || row.effort.level >= 25;
    if (!canInheritSibling) return null;
    const rec = orgRankIndex?.get(row.id)?.ranks?.arenaChat;
    if (rec && (rec.exact || canInheritSibling)) return {rank: rec.rank, exact: !!rec.exact};
    const fam = row.family?.slug;
    if (fam && chatRankByFam.has(fam)) return {rank: chatRankByFam.get(fam), exact: false};
    return null;
  }

  function getBoardRank(row, exactMap, famMap, orgKey) {
    const direct = exactMap.get(row.id);
    if (direct != null) return direct;
    const canInheritHigh = !row.effort || row.effort.level >= 50;
    if (!canInheritHigh) return null;
    const orgR = orgKey ? orgRankIndex?.get(row.id)?.ranks?.[orgKey]?.rank : null;
    if (orgR != null) return orgR;
    const fam = row.family?.slug;
    if (fam && famMap.has(fam)) return famMap.get(fam);
    return null;
  }

  function getSignals(row, uc, isFrontier) {
    const proofs = [];
    const caveats = [];
    const isMedia = uc.tab === 'media';
    const isCodingAgent = uc.tab === 'coding-agents';

    if (isCodingAgent) {
      const cRank = codingRankById.get(row.id);
      if (cRank != null && cRank <= 5) proofs.push({zh: `端到端编程 #${cRank}`, en: `Coding Agent #${cRank}`});
      if (row.agentStats?.cacheHitRate >= 90) proofs.push({zh: `缓存命中 ${Math.round(row.agentStats.cacheHitRate)}%`, en: `${Math.round(row.agentStats.cacheHitRate)}% cache`});
      if (isFrontier && proofs.length < 2) proofs.push({zh: '帕累托前沿', en: 'Pareto frontier'});

      // Data-driven lookup of underlying LLM family's Arena.ai Chat blind coverage via `Harness:model-family` slug
      const baseSlug = (row.family?.slug || '').split(':')[1] || '';
      const baseKnown = !!(baseSlug && modelFamilies.has(baseSlug));
      const baseHasChat = baseKnown && chatRankByFam.has(baseSlug);
      if (row.cost >= 14) {
        caveats.push({zh: '超高单价 · 常规月卡多不含或易限流', en: 'Very high cost · often API-only / tight quota'});
      }
      if (row.costPercentiles?.p95 && row.cost > 0 && row.costPercentiles.p95 / row.cost >= 2.8) {
        caveats.push({zh: `P95 长尾可达 $${row.costPercentiles.p95.toFixed(1)}`, en: `P95 tail up to $${row.costPercentiles.p95.toFixed(1)}`});
      }
      if (baseKnown && !baseHasChat) {
        caveats.push({zh: '底层缺 Arena 聊天盲测 · 建议先试手感', en: 'Underlying model lacks Arena Chat votes'});
      }
      if (row.timeSec >= 2400) {
        caveats.push({zh: `单任务耗时偏长 (${Math.round(row.timeSec / 60)}分)`, en: `Long runs (~${Math.round(row.timeSec / 60)}m)`});
      }
      return {proofs: proofs.slice(0, 2), caveats: caveats.slice(0, 2)};
    }

    if (isMedia) {
      if (isFrontier) proofs.push({zh: '帕累托前沿', en: 'Pareto frontier'});
      if (uc.mediaTrack === 'image' && row.mediaScores?.t2i != null && row.mediaScores?.imgEdit != null) {
        proofs.push({zh: '文生图 + 修图双全', en: 'T2I + Edit'});
      } else if (uc.mediaTrack === 'video' && row.mediaScores?.i2v != null && row.mediaScores?.t2v != null) {
        proofs.push({zh: '文生 + 图生双覆盖', en: 'T2V + I2V'});
      } else if (uc.mediaTrack === 'tts') {
        const ttfa = row.mediaRaw?.ttfaMs;
        if (ttfa != null && ttfa <= 250) proofs.push({zh: `低首包 ${Math.round(ttfa)}ms`, en: `Fast TTFA ${Math.round(ttfa)}ms`});
        else if (ttfa != null && ttfa >= 600) caveats.push({zh: `首包较慢 (${Math.round(ttfa)}ms)`, en: `Slow TTFA (${Math.round(ttfa)}ms)`});
      }
      if (uc.mediaTrack === 'image' && row.cost >= 0.15) caveats.push({zh: '单张偏贵 · 批量出图慎选', en: 'High $/img for bulk batches'});
      if (uc.mediaTrack === 'video' && row.cost >= 1.5) caveats.push({zh: '单段偏贵 · 建议先用低价档试分镜', en: 'High $/5s — storyboard cheaply first'});
      return {proofs: proofs.slice(0, 2), caveats: caveats.slice(0, 2)};
    }

    // Standard LLM tabs (models, human-arena)
    const chat = getChatRank(row);
    const lb = lbRankById.get(row.id) ?? orgRankIndex?.get(row.id)?.ranks?.livebench?.rank ?? null;
    const lbDes = getBoardRank(row, lbDesignRankById, lbDesignRankByFam, null);
    const des = getBoardRank(row, designRankById, designRankByFam, 'designArena');
    const web = getBoardRank(row, webdevRankById, webdevRankByFam, 'arenaWebdev');
    const div = divById.get(row.id) || (row.family?.slug ? divByFam.get(row.family.slug) : null);

    if (uc.id === 'design') {
      if (des && des <= 10) proofs.push({zh: `Design 整站 #${des}`, en: `Design Web #${des}`});
      if (web && web <= 10) proofs.push({zh: `WebDev #${web}`, en: `WebDev #${web}`});
      if (lbDes && lbDes <= 10 && proofs.length < 2) proofs.push({zh: `LB2 设计 #${lbDes}`, en: `LB2 Design #${lbDes}`});
      if (isFrontier && proofs.length < 2) proofs.push({zh: '帕累托前沿', en: 'Pareto frontier'});
    } else {
      if (chat && chat.rank <= 10) proofs.push({zh: `Arena 聊天 ${chat.exact ? '' : '~'}#${chat.rank}`, en: `Arena Chat ${chat.exact ? '' : '~'}#${chat.rank}`});
      if (uc.id === 'coding-api' && web && web <= 10) proofs.push({zh: `WebDev #${web}`, en: `WebDev #${web}`});
      else if (lb && lb <= 10) proofs.push({zh: `LB2 防污染 #${lb}`, en: `LiveBench #${lb}`});
      if (div?.kind === 'consensus' && chat && proofs.length < 2) proofs.push({zh: '全机构共识', en: 'Cross-org consensus'});
      if (isFrontier && proofs.length < 2) proofs.push({zh: '帕累托前沿', en: 'Pareto frontier'});
    }

    // Objective Risk / Caveat Flags
    const aaRank = aaRankById.get(row.id) ?? null;
    const aaIdx = aaIndexById.get(row.id) ?? row.aaIndex ?? null;
    const isWeakCore = (aaRank != null && aaRank > 30) || (maxAA > 0 && aaIdx != null && aaIdx < maxAA * 0.72);
    if (row.cost >= 11) {
      caveats.push({zh: '高消耗 · 常规月卡多不含或限流极严', en: 'Very high cost · mostly API-only / tight quota'});
    }
    if (uc.id === 'design') {
      if (isWeakCore && aaRank != null) {
        const isVisualOnly = !!(des && des <= 10 && (!web || web > 10));
        caveats.push({
          zh: isVisualOnly ? `综合能力偏弱 (AA #${aaRank}) · 仅宜单页视觉灵感` : `综合推理偏弱 (AA #${aaRank})`,
          en: isVisualOnly ? `Weak core reasoning (AA #${aaRank}) · static mockups only` : `Lower core reasoning (AA #${aaRank})`
        });
      }
      if (row.humanScores?.designWeb == null && caveats.length < 2) {
        caveats.push({zh: '缺 Design Arena 视觉盲测', en: 'Not yet listed on Design Arena'});
      } else if (des && des <= 5 && web && web > 10 && caveats.length < 2) {
        caveats.push({zh: `交互前端相对偏弱 (WebDev #${web})`, en: `Weaker interactive coding (WebDev #${web})`});
      }
      if (!chat && caveats.length < 2) {
        caveats.push({zh: '缺 Arena 聊天盲测 · 实测体感待自验', en: 'No Arena Chat blind votes yet'});
      }
    } else if (uc.id === 'writing') {
      if (isWeakCore && aaRank != null) {
        caveats.push({zh: `综合推理偏弱 (AA #${aaRank}) · 复杂逻辑慎用`, en: `Weak core reasoning (AA #${aaRank}) · light chat only`});
      }
      if (row.arenaRaw?.slop != null && row.arenaRaw.slop >= 50 && caveats.length < 2) {
        caveats.push({zh: `AI 套话偏高 (Slop ${Math.round(row.arenaRaw.slop)}%)`, en: `High AI-slop style (${Math.round(row.arenaRaw.slop)}%)`});
      }
    } else if (!chat && ['general', 'coding-api', 'research'].includes(uc.id)) {
      caveats.push({zh: '缺 Arena 聊天盲测 · 实测体感待自验', en: 'No Arena Chat blind votes yet'});
    } else if (div && div.gap <= -12) {
      caveats.push({zh: `硬考明显强于盲测体感 (存在偏科分歧)`, en: 'Hard exams outpace human vibe ratings'});
    }
    if (uc.id === 'design' && row.arenaRaw?.slop != null && row.arenaRaw.slop >= 50 && caveats.length < 2) {
      caveats.push({zh: `AI 套话偏高 (Slop ${Math.round(row.arenaRaw.slop)}%)`, en: `High AI-slop style (${Math.round(row.arenaRaw.slop)}%)`});
    }
    if (row.subscores?.hallucination != null && row.subscores.hallucination >= 65 && ['general', 'research'].includes(uc.id)) {
      caveats.push({zh: `盲区幻觉率 ${Math.round(row.subscores.hallucination)}%`, en: `${Math.round(row.subscores.hallucination)}% blind-spot hallucination`});
    }
    if (row.timeSec >= 1800 && ['general', 'coding-api', 'research'].includes(uc.id) && caveats.length < 2) {
      caveats.push({zh: `复杂任务思考耗时偏长 (${Math.round(row.timeSec / 60)}分)`, en: `Slow on heavy tasks (~${Math.round(row.timeSec / 60)}m)`});
    }

    return {proofs: proofs.slice(0, 2), caveats: caveats.slice(0, 2)};
  }

  return {
    getChatRank,
    getSignals,
    getDesignRank: row => getBoardRank(row, designRankById, designRankByFam, 'designArena'),
    getWebdevRank: row => getBoardRank(row, webdevRankById, webdevRankByFam, 'arenaWebdev'),
    getLbDesignRank: row => getBoardRank(row, lbDesignRankById, lbDesignRankByFam, null),
    aaIndexOf: row => aaIndexById.get(row.id) ?? row.aaIndex ?? null,
    maxAA,
    aaRankById,
    codingRankById,
    divById,
    divByFam
  };
}

/**
 * Compute up to 3 transparent, multi-archetype shortlist candidates (NOT an opaque single verdict!)
 * with objective cross-org proof tags and honest risk/billing caveats.
 */
export function recommendModels(snapshot, {useCase = 'general', billing = null, budget = null, license = 'all'} = {}, context = {}) {
  const uc = RECOMMEND_USE_CASES.find(x => x.id === useCase) || RECOMMEND_USE_CASES[0];
  // Support legacy `budget` param values cleanly (`balanced` -> `api-balanced`, `budget` -> `api-budget`, `flagship` -> `sub`)
  const rawBilling = billing || (budget === 'flagship' ? 'sub' : budget === 'budget' ? 'api-budget' : budget === 'balanced' ? 'api-balanced' : 'sub');
  const bill = RECOMMEND_BILLING.find(x => x.id === rawBilling) || RECOMMEND_BILLING[0];
  const lic = RECOMMEND_LICENSES.find(x => x.id === license) || RECOMMEND_LICENSES[0];

  const sourceKey = uc.tab === 'human-arena'
    ? 'humanArenaModels'
    : uc.tab === 'coding-agents'
      ? 'codingAgents'
      : uc.tab === 'media'
        ? 'mediaModels'
        : 'models';
  const rawList = Array.isArray(snapshot?.[sourceKey]) ? snapshot[sourceKey] : [];

  const pool = rawList
    .filter(r => !uc.mediaTrack || r.mediaKind === uc.mediaTrack)
    .filter(r => {
      if (lic.id === 'open') return !!r.isOpenWeights;
      if (lic.id === 'closed') return !r.isOpenWeights;
      return true;
    })
    .map(r => {
      const score = scoreForUseCase(r, uc);
      if (typeof score !== 'number' || !Number.isFinite(score) || !(r.cost > 0)) return null;
      return {...r, _pickScore: Number(score.toFixed(2))};
    })
    .filter(Boolean);

  const totalPool = pool.length;
  if (!totalPool) {
    return {useCase: uc, billing: bill, budget: bill, license: lic, totalPool: 0, picks: []};
  }

  const evidence = buildEvidenceLookup(snapshot, context);
  const projected = pool.map(r => ({...r, intelligenceIndex: r._pickScore}));
  const frontier = paretoFrontier(projected, r => r.cost);
  const frontierIds = new Set(frontier.map(r => r.id));
  const sortedByScore = [...projected].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex || a.cost - b.cost);
  const maxScore = sortedByScore[0].intelligenceIndex;
  const scoreVal = (row, alpha) => valuePerDollar(row, alpha, 0, 0) ?? -1;

  const usedIds = new Set();
  const usedFamilies = new Set();
  const familyKeyOf = r => {
    if (uc.tab === 'coding-agents') return r.agentName ? `${r.agentName}|${r.creator?.name || ''}` : r.id;
    return r.family?.slug || r.id;
  };
  const isFresh = (r, diffFam = true) => {
    if (!r || usedIds.has(r.id)) return false;
    if (diffFam && usedFamilies.has(familyKeyOf(r))) return false;
    return true;
  };
  const claim = r => {
    if (!r) return null;
    usedIds.add(r.id);
    usedFamilies.add(familyKeyOf(r));
    return r;
  };

  // Cost ceiling for standard monthly-plan-friendly picks (avoids recommending $14/$26/$44 API-only max tiers as daily sub driver)
  const subFriendlyCap = uc.tab === 'coding-agents' ? 12 : uc.tab === 'media' ? Infinity : 10.5;
  const picks = [];

  if (uc.tab === 'models') {
    // 3 DISTINCT ARCHETYPES FOR LLMs:
    // 1. Cross-Org Consensus / Verified Taste (requires genuine Arena.ai Chat blind votes + strong hard-eval standing!)
    const consensusCandidates = projected.filter(r => {
      const chat = evidence.getChatRank(r);
      const hasChatProof = (chat && chat.rank <= 20) || (r.humanScores?.chatVibe >= 68);
      if (!hasChatProof) return false;
      if (bill.id === 'sub' && r.cost > subFriendlyCap) return false;
      return r.intelligenceIndex >= maxScore * (bill.id === 'api-budget' ? 0.62 : 0.78);
    });
    const consensusSortAlpha = bill.id === 'api-budget' ? 1.8 : 4.2;
    consensusCandidates.sort((a, b) => {
      const ca = evidence.getChatRank(a), cb = evidence.getChatRank(b);
      if (bill.id === 'sub') {
        const scoreA = a.intelligenceIndex + (ca?.exact && ca.rank <= 5 ? 2.5 : ca && ca.rank <= 10 ? 1.2 : 0);
        const scoreB = b.intelligenceIndex + (cb?.exact && cb.rank <= 5 ? 2.5 : cb && cb.rank <= 10 ? 1.2 : 0);
        return scoreB - scoreA || a.cost - b.cost;
      }
      const bonusA = (ca?.exact && ca.rank <= 10 ? 1.18 : 1);
      const bonusB = (cb?.exact && cb.rank <= 10 ? 1.18 : 1);
      return (scoreVal(b, consensusSortAlpha) * bonusB) - (scoreVal(a, consensusSortAlpha) * bonusA)
        || b.intelligenceIndex - a.intelligenceIndex;
    });

    const slot1 = claim(consensusCandidates[0]) || claim(
      (bill.id === 'sub' ? sortedByScore.find(r => r.cost <= subFriendlyCap) : null) || sortedByScore[0]
    );

    if (slot1) {
      const hasConsensus = consensusCandidates.length > 0 && slot1.id === consensusCandidates[0].id;
      const chat = evidence.getChatRank(slot1);
      picks.push({
        slot: 'primary',
        badgeZh: hasConsensus ? '跨机构口碑稳健' : '综合实力代表',
        badgeEn: hasConsensus ? 'Cross-Org Consensus' : 'Balanced Pick',
        row: slot1,
        score: slot1._pickScore,
        isFrontier: frontierIds.has(slot1.id),
        ...evidence.getSignals(slot1, uc, frontierIds.has(slot1.id)),
        reason: {
          zh: hasConsensus
            ? `同时通过自动化硬考与真人盲测验证${chat ? `（Arena 聊天 ${chat.exact ? '' : '~'}#${chat.rank}）` : ''}，不易出现“高分低体感”落差`
            : `当前筛选条件下能力与可用性最均衡的综合代表`,
          en: hasConsensus
            ? `Backed by both hard exams and blind human votes${chat ? ` (Arena Chat ${chat.exact ? '' : '~'}#${chat.rank})` : ''}, minimizing score-vs-vibe surprises`
            : `Most balanced all-round candidate under your active filter`
        }
      });
    }

    // 2. Pure API Cost-Efficiency Frontier Pick (explicitly labeled as paper efficiency — caveats show if chat votes missing!)
    const effAlpha = bill.id === 'api-budget' ? 1.3 : 3.2;
    const effFloor = maxScore * (bill.id === 'api-budget' ? 0.58 : 0.74);
    const effCandidates = projected
      .filter(r => isFresh(r, true) && r.intelligenceIndex >= effFloor)
      .sort((a, b) => scoreVal(b, effAlpha) - scoreVal(a, effAlpha) || a.cost - b.cost);
    const slot2 = claim(effCandidates[0]) || claim(projected.find(r => isFresh(r, false)));
    if (slot2) {
      const saveVs1 = slot1 ? formatPctDelta(slot2.cost, slot1.cost) : 0;
      const keepVs1 = slot1 && slot1.intelligenceIndex > 0 ? Math.round((slot2.intelligenceIndex / slot1.intelligenceIndex) * 100) : 100;
      picks.push({
        slot: 'saving',
        badgeZh: 'API 效率前沿派',
        badgeEn: 'API Efficiency',
        row: slot2,
        score: slot2._pickScore,
        isFrontier: frontierIds.has(slot2.id),
        ...evidence.getSignals(slot2, uc, frontierIds.has(slot2.id)),
        reason: {
          zh: saveVs1 >= 15
            ? `按量 API 成本比口碑款低 ${saveVs1}%，纸面保留约 ${keepVs1}% 能力分，适合高频调用与先小量实测`
            : `线性美元前沿高效率点位，适合看重按量 API 单次成本的工程流水线`,
          en: saveVs1 >= 15
            ? `${saveVs1}% cheaper per API task than Consensus while keeping ~${keepVs1}% paper score — great to trial for high-volume API calls`
            : `Strong linear-USD efficiency on the Pareto frontier for pay-as-you-go pipelines`
        }
      });
    }

    // 3. Top Capability Ceiling Reference (transparently flags $26 API-only cost!)
    const slot3 = claim(sortedByScore.find(r => isFresh(r, true))) || claim(sortedByScore.find(r => isFresh(r, false)));
    if (slot3) {
      const isCeiling = slot3.id === sortedByScore[0].id;
      const gap = slot1 ? slot3.intelligenceIndex - slot1.intelligenceIndex : 0;
      picks.push({
        slot: 'flagship',
        badgeZh: isCeiling ? '能力上限参照' : '高分进阶参照',
        badgeEn: isCeiling ? 'Capability Ceiling' : 'High-Tier Alt',
        row: slot3,
        score: slot3._pickScore,
        isFrontier: frontierIds.has(slot3.id),
        ...evidence.getSignals(slot3, uc, frontierIds.has(slot3.id)),
        reason: {
          zh: slot3.cost >= 11
            ? `全榜纸面最高梯队（${gap >= 0 ? '+' : ''}${gap.toFixed(1)} 分），但单次 API 昂贵且常规月卡多不含，建议仅作疑难攻坚兜底`
            : `高分梯队参照（${gap >= 0 ? '+' : ''}${gap.toFixed(1)} 分），可与前两款直接进「剖析对比」看各维分差`,
          en: slot3.cost >= 11
            ? `Peak paper score (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts), but very expensive and rarely included in flat plans — best reserved as an escalation fallback`
            : `High-capability reference (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts) to compare side-by-side in Compare view`
        }
      });
    }
  } else if (uc.id === 'design') {
    // 3 DISTINCT ARCHETYPES FOR FRONTEND & VISUAL AESTHETICS (with core-intelligence floor on Primary & Ceiling!):
    const poolAAs = projected.map(r => evidence.aaIndexOf(r)).filter(v => typeof v === 'number');
    const maxPoolAA = poolAAs.length ? Math.max(...poolAAs) : 0;
    const coreFloor = Math.max(evidence.maxAA * 0.76, maxPoolAA * 0.78);
    const hasCoreFloor = r => {
      const aa = evidence.aaIndexOf(r);
      return aa == null || aa >= coreFloor;
    };

    // 1. Primary: Frontend All-Rounder (MUST pass core-intelligence floor so it can actually ship complex frontend logic + iterative edits!)
    const webAll = projected.filter(r => typeof r.humanScores?.webdev === 'number');
    const webCapable = webAll.filter(hasCoreFloor);
    const webBase = webCapable.length ? webCapable : webAll;
    const maxWeb = webBase.length ? Math.max(...webBase.map(r => r.humanScores.webdev)) : 0;
    const webCands = (bill.id === 'sub'
      ? (webBase.filter(r => r.cost <= subFriendlyCap).length ? webBase.filter(r => r.cost <= subFriendlyCap) : webBase)
      : webBase.filter(r => r.humanScores.webdev >= maxWeb * (bill.id === 'api-budget' ? 0.68 : 0.82))
    ).sort((a, b) => {
      if (bill.id === 'sub') {
        const ca = evidence.getChatRank(a), cb = evidence.getChatRank(b);
        const la = evidence.getLbDesignRank(a), lb = evidence.getLbDesignRank(b);
        const sa = a.humanScores.webdev + (ca && ca.rank <= 15 ? 2 : 0) + (la && la <= 6 ? 1.5 : 0);
        const sb = b.humanScores.webdev + (cb && cb.rank <= 15 ? 2 : 0) + (lb && lb <= 6 ? 1.5 : 0);
        return sb - sa || a.cost - b.cost;
      }
      const va = valuePerDollar({intelligenceIndex: a.humanScores.webdev, cost: a.cost}, bill.alpha, 0, 0) ?? -1;
      const vb = valuePerDollar({intelligenceIndex: b.humanScores.webdev, cost: b.cost}, bill.alpha, 0, 0) ?? -1;
      return vb - va || b.humanScores.webdev - a.humanScores.webdev;
    });
    const slot1 = claim(webCands[0]) || claim(sortedByScore.find(hasCoreFloor)) || claim(sortedByScore[0]);
    if (slot1) {
      const webRank = evidence.getWebdevRank(slot1);
      const aaR = evidence.aaRankById.get(slot1.id);
      picks.push({
        slot: 'primary',
        badgeZh: '前端开发主力',
        badgeEn: 'Frontend All-Rounder',
        scoreLabelZh: '交互前端分',
        scoreLabelEn: 'WebDev Score',
        row: slot1,
        score: slot1.humanScores?.webdev ?? slot1._pickScore,
        isFrontier: frontierIds.has(slot1.id),
        ...evidence.getSignals(slot1, uc, frontierIds.has(slot1.id)),
        reason: {
          zh: webRank
            ? `综合能力过硬${aaR ? `（AA #${aaR}）` : ''}且 Arena WebDev 排 #${webRank}，写交互状态、修 Bug 与多轮改布局真正能落地`
            : `综合逻辑与前端工程能力均衡，适合真实日常项目开发与多轮迭代`,
          en: webRank
            ? `Solid core reasoning${aaR ? ` (AA #${aaR})` : ''} paired with Arena WebDev #${webRank} — reliable for real interactive apps & multi-turn edits`
            : `Balanced core capability and frontend engineering for real production work`
        }
      });
    }

    // 2. Single-Shot Visual Aesthetics Reference (Design Arena Website leader — candidly warns if core intelligence is weak!)
    const visPool = projected.filter(r => isFresh(r, true) && typeof r.humanScores?.designWeb === 'number');
    const maxVis = visPool.length ? Math.max(...visPool.map(r => r.humanScores.designWeb)) : 0;
    const visSorted = (bill.id === 'sub'
      ? (visPool.filter(r => r.cost <= subFriendlyCap).length ? visPool.filter(r => r.cost <= subFriendlyCap) : visPool)
      : visPool.filter(r => r.humanScores.designWeb >= maxVis * (bill.id === 'api-budget' ? 0.65 : 0.8))
    ).sort((a, b) => {
      if (bill.id === 'sub') {
        return b.humanScores.designWeb - a.humanScores.designWeb
          || (b.humanScores.pureVisual ?? 0) - (a.humanScores.pureVisual ?? 0)
          || a.cost - b.cost;
      }
      const va = valuePerDollar({intelligenceIndex: a.humanScores.designWeb, cost: a.cost}, bill.alpha, 0, 0) ?? -1;
      const vb = valuePerDollar({intelligenceIndex: b.humanScores.designWeb, cost: b.cost}, bill.alpha, 0, 0) ?? -1;
      return vb - va || b.humanScores.designWeb - a.humanScores.designWeb;
    });
    const slot2 = claim(visSorted[0]) || claim(projected.find(r => isFresh(r, true))) || claim(projected.find(r => isFresh(r, false)));
    if (slot2) {
      const desRank = evidence.getDesignRank(slot2);
      const aaR = evidence.aaRankById.get(slot2.id);
      const weakCore = aaR != null && aaR > 30;
      picks.push({
        slot: 'saving',
        badgeZh: '单页视觉参考',
        badgeEn: 'Single-Shot Visual',
        scoreLabelZh: '整站视觉分',
        scoreLabelEn: 'Web Visual',
        row: slot2,
        score: slot2.humanScores?.designWeb ?? slot2._pickScore,
        isFrontier: frontierIds.has(slot2.id),
        ...evidence.getSignals(slot2, uc, frontierIds.has(slot2.id)),
        reason: {
          zh: weakCore
            ? `Design Arena 整站盲测排 #${desRank || '前列'}，适合单轮出静态视觉稿找灵感；但综合逻辑偏弱（AA #${aaR}），复杂交互开发请选第一款`
            : `Design Arena 整站盲测排 #${desRank || '前列'}，初版页面排版与视觉观感突出，可与第一款对比风格`,
          en: weakCore
            ? `Design Arena Website #${desRank || 'top'} — great for single-shot visual mockups, but weak core reasoning (AA #${aaR}); use Pick 1 for complex apps`
            : `Design Arena Website #${desRank || 'top'} — strong first-pass visual layout & polish to contrast with Pick 1`
        }
      });
    }

    // 3. Dual-Board Frontend Ceiling Reference (Core-capable Design Arena + Arena WebDev combined SOTA)
    const dualPool = projected
      .filter(r => isFresh(r, true))
      .sort((a, b) => {
        const capA = hasCoreFloor(a) ? 1 : 0;
        const capB = hasCoreFloor(b) ? 1 : 0;
        const dualA = (a.humanScores?.designWeb != null && a.humanScores?.webdev != null) ? 1 : 0;
        const dualB = (b.humanScores?.designWeb != null && b.humanScores?.webdev != null) ? 1 : 0;
        return capB - capA || dualB - dualA || b.intelligenceIndex - a.intelligenceIndex || a.cost - b.cost;
      });
    const slot3 = claim(dualPool[0]) || claim(sortedByScore.find(r => isFresh(r, false)));
    if (slot3) {
      picks.push({
        slot: 'flagship',
        badgeZh: '前端审美全能上限',
        badgeEn: 'Frontend Ceiling',
        scoreLabelZh: '双榜综合分',
        scoreLabelEn: 'Dual Score',
        row: slot3,
        score: slot3._pickScore,
        isFrontier: frontierIds.has(slot3.id),
        ...evidence.getSignals(slot3, uc, frontierIds.has(slot3.id)),
        reason: {
          zh: slot3.cost >= 11
            ? `综合能力、整站视觉与交互前端全线顶尖，但单次消耗极高且常规月卡多不含，适合关键页面定稿参照`
            : `综合能力、整站视觉与交互前端双榜均衡的高分参照，建议直接与前两款并排对比`,
          en: slot3.cost >= 11
            ? `Top tier across core intelligence, visual taste & WebDev, but very costly / API-only — best as a high-end reference`
            : `Balanced high-tier reference across core intelligence, Design Arena & WebDev`
        }
      });
    }
  } else {
    // Coding Agents, Human Arena (Writing / Design), and Media (Image / Video / TTS)
    const floorRatio = bill.id === 'api-budget' ? 0.62 : bill.id === 'api-balanced' ? 0.78 : 0.88;
    const minScoreFloor = maxScore * floorRatio;

    let slot1;
    if (bill.id === 'sub') {
      // Monthly plan / IDE users care about top real-world capability without extreme API-only burn
      const subPool = projected.filter(r => r.cost <= subFriendlyCap);
      const subBest = (subPool.length ? subPool : projected).sort((a, b) => b.intelligenceIndex - a.intelligenceIndex || a.cost - b.cost);
      slot1 = claim(subBest[0]);
    } else {
      const elig = projected.filter(r => r.intelligenceIndex >= minScoreFloor);
      const cands = (elig.length ? elig : projected).sort((a, b) =>
        scoreVal(b, bill.alpha) - scoreVal(a, bill.alpha)
        || b.intelligenceIndex - a.intelligenceIndex
        || a.cost - b.cost
      );
      slot1 = claim(cands[0]);
    }

    const topCeiling = sortedByScore[0];
    let slot2 = null;
    let slot2IsRunnerUp = false;
    if (topCeiling && isFresh(topCeiling, false)) {
      slot2 = claim(topCeiling);
    } else {
      slot2IsRunnerUp = true;
      slot2 = claim(sortedByScore.find(r => isFresh(r, true))) || claim(sortedByScore.find(r => isFresh(r, false)));
    }

    // 3rd slot: cheaper Pareto alternative (or balanced step-up if slot1 is already ultra-cheap)
    const saverFloor = Math.max(maxScore * 0.65, (slot1?.intelligenceIndex || 0) * 0.78);
    const cheaper = projected
      .filter(r => isFresh(r, true) && r.cost < (slot1?.cost || Infinity) * 0.85 && r.intelligenceIndex >= saverFloor)
      .sort((a, b) => scoreVal(b, 1.8) - scoreVal(a, 1.8) || a.cost - b.cost);
    let slot3IsStepUp = false;
    let slot3 = claim(cheaper[0]);
    if (!slot3) {
      const cheaperAny = projected
        .filter(r => isFresh(r, false) && r.cost < (slot1?.cost || Infinity) * 0.9 && r.intelligenceIndex >= maxScore * 0.55)
        .sort((a, b) => scoreVal(b, 1.8) - scoreVal(a, 1.8) || a.cost - b.cost);
      slot3 = claim(cheaperAny[0]);
    }
    if (!slot3) {
      slot3IsStepUp = true;
      const stepUp = projected
        .filter(r => isFresh(r, true) && r.intelligenceIndex > (slot1?.intelligenceIndex || 0))
        .sort((a, b) => scoreVal(b, 3.2) - scoreVal(a, 3.2) || b.intelligenceIndex - a.intelligenceIndex);
      slot3 = claim(stepUp[0]) || claim(projected.find(r => isFresh(r, true))) || claim(projected.find(r => isFresh(r, false)));
    }

    const refHigh = slot2 && !slot2IsRunnerUp ? slot2 : slot1;
    if (slot1) {
      const savePct = refHigh ? formatPctDelta(slot1.cost, refHigh.cost) : 0;
      const keepPct = refHigh && refHigh.intelligenceIndex > 0 ? Math.round((slot1.intelligenceIndex / refHigh.intelligenceIndex) * 100) : 100;
      picks.push({
        slot: 'primary',
        badgeZh: uc.tab === 'coding-agents' && bill.id === 'sub' ? '端到端实战首选' : bill.id === 'sub' ? '体验优先参照' : '均衡甜点参照',
        badgeEn: uc.tab === 'coding-agents' && bill.id === 'sub' ? 'End-to-End Leader' : bill.id === 'sub' ? 'Experience Pick' : 'Balanced Pick',
        row: slot1,
        score: slot1._pickScore,
        isFrontier: frontierIds.has(slot1.id),
        ...evidence.getSignals(slot1, uc, frontierIds.has(slot1.id)),
        reason: {
          zh: bill.id === 'sub'
            ? `在常规可承受消耗带内拿到最高实测表现（${slot1._pickScore.toFixed(1)} 分），避开天价 API 专用档`
            : savePct >= 15
              ? `较最高分项省 ${savePct}% 成本，保留约 ${keepPct}% 实测表现，位于当前赛道性价比甜点区`
              : `当前付费偏好下实测表现与单次成本最均衡的参照方案`,
          en: bill.id === 'sub'
            ? `Top measured score (${slot1._pickScore.toFixed(1)}) within mainstream plan-friendly burn, avoiding API-only spikes`
            : savePct >= 15
              ? `${savePct}% cheaper than track ceiling while keeping ~${keepPct}% measured score`
              : `Strongest score-to-cost balance in this track for your preference`
        }
      });
    }

    if (slot2) {
      const gap = slot1 ? slot2.intelligenceIndex - slot1.intelligenceIndex : 0;
      picks.push({
        slot: 'flagship',
        badgeZh: slot2IsRunnerUp ? '同级强力对照' : '赛道上限参照',
        badgeEn: slot2IsRunnerUp ? 'Top Peer Alt' : 'Track Ceiling',
        row: slot2,
        score: slot2._pickScore,
        isFrontier: frontierIds.has(slot2.id),
        ...evidence.getSignals(slot2, uc, frontierIds.has(slot2.id)),
        reason: {
          zh: slot2IsRunnerUp
            ? `不同家族/框架的高分参照（分差 ${Math.abs(gap).toFixed(1)}），建议与第一款对比交互手感与生态适配`
            : `赛道最高分上限（+${Math.abs(gap).toFixed(1)} 分），用来判断多花成本换取的边际提升是否值得`,
          en: slot2IsRunnerUp
            ? `Cross-vendor/harness peer (${Math.abs(gap).toFixed(1)} pts apart) to compare real workflow fit`
            : `Track score ceiling (+${Math.abs(gap).toFixed(1)} pts) to benchmark whether paying more is worth it`
        }
      });
    }

    if (slot3) {
      const savePct = slot1 ? formatPctDelta(slot3.cost, slot1.cost) : 0;
      const keepPct = slot1 && slot1.intelligenceIndex > 0 ? Math.round((slot3.intelligenceIndex / slot1.intelligenceIndex) * 100) : 100;
      picks.push({
        slot: 'saving',
        badgeZh: slot3IsStepUp ? '进阶参照' : '低价效率参照',
        badgeEn: slot3IsStepUp ? 'Step-Up Alt' : 'Low-Cost Alt',
        row: slot3,
        score: slot3._pickScore,
        isFrontier: frontierIds.has(slot3.id),
        ...evidence.getSignals(slot3, uc, frontierIds.has(slot3.id)),
        reason: {
          zh: slot3IsStepUp
            ? `小幅提高预算可再涨 +${(slot3.intelligenceIndex - (slot1?.intelligenceIndex || 0)).toFixed(1)} 分`
            : `单次成本再低 ${Math.max(1, savePct)}%，保留约 ${keepPct}% 实测表现，适合轻量日常或批量跑任务`,
          en: slot3IsStepUp
            ? `Modest budget step-up adding +${(slot3.intelligenceIndex - (slot1?.intelligenceIndex || 0)).toFixed(1)} pts`
            : `${Math.max(1, savePct)}% lower unit cost while keeping ~${keepPct}% score for lighter or batch workloads`
        }
      });
    }
  }

  return {useCase: uc, billing: bill, budget: bill, license: lic, totalPool, picks};
}
