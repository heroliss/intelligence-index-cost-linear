import {
  paretoFrontier,
  valuePerDollar,
  computeScenarioScore,
  SCENARIO_PRESETS
} from '../chart-math.mjs?v=20261122-04';
import {computeOrgDivergence} from './divergence.mjs?v=20261122-04';

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
    descZh: '按「自然对话主力」「低 AI 味写作派」「轻量高效参照」三流派对撞，并标明 AI 套话率与推理短板',
    descEn: 'Contrasts Natural Chat Leader, Low-Slop Writing Craft, and Lightweight Alt — flagging AI-slop & weak reasoning'
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
  const lbRankByFam = new Map();
  const lbDesignRankById = new Map();
  const lbDesignRankByFam = new Map();
  const codingRankById = new Map();
  const aaRankById = new Map();

  const models = Array.isArray(snapshot?.models) ? snapshot.models : [];
  const famById = new Map(models.map(m => [m.id, m.family?.slug || null]));
  const effortById = new Map(models.map(m => [m.id, m.effort?.level ?? null]));
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
      if (fam && !chatRankByFam.has(fam)) {
        chatRankByFam.set(fam, {rank, srcLevel: effortById.get(r.modelId) ?? null});
      }
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
    if (r.modelId && !lbRankById.has(r.modelId)) {
      lbRankById.set(r.modelId, rank);
      const fam = famById.get(r.modelId);
      if (fam && !lbRankByFam.has(fam)) {
        lbRankByFam.set(fam, {rank, srcLevel: effortById.get(r.modelId) ?? null});
      }
    }
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

  // Also check orgRankIndex passed by app.js for family fallback ranks when snapshot orgLeaderboards is partial
  const orgRankIndex = context.orgRankIndex instanceof Map ? context.orgRankIndex : null;
  const divById = new Map();
  const divByFam = new Map();
  let divRows = Array.isArray(context.divergenceRows) && context.divergenceRows.length
    ? context.divergenceRows
    : null;
  if (!divRows && models.length) {
    // Derive exact cohort-normalized org divergence standalone so browser & headless callers stay 100% consistent
    const baseById = new Map(models.map(m => [m.id, m]));
    const standBoards = [{id: 'aa', shortTag: 'AA'}];
    if (ext.livebench?.rows?.length) standBoards.push({id: 'livebench', shortTag: 'LB2'});
    if (ext.arenaChat?.rows?.length) standBoards.push({id: 'arenaChat', shortTag: 'Chat'});
    if (ext.arenaWebdev?.rows?.length) standBoards.push({id: 'arenaWebdev', shortTag: 'WebDev'});
    if (ext.designArena?.rows?.length) standBoards.push({id: 'designArena', shortTag: 'Design'});
    const gdpModels = models.filter(m => m.expertElo?.gdpval != null).sort((a, b) => b.expertElo.gdpval - a.expertElo.gdpval);
    if (gdpModels.length) standBoards.push({id: 'aaGdpval', shortTag: 'GDPval'});
    const standIdx = new Map();
    const addStandRank = (modelId, boardId, rank, score) => {
      const m = baseById.get(modelId);
      if (!m) return;
      let rec = standIdx.get(modelId);
      if (!rec) {
        rec = {
          name: m.name,
          shortName: m.shortName || m.name,
          creator: m.creator?.name || 'Other',
          creatorColor: m.creator?.color || null,
          cost: m.cost,
          familySlug: m.family?.slug || null,
          ranks: {}
        };
        standIdx.set(modelId, rec);
      }
      if (!rec.ranks[boardId]) rec.ranks[boardId] = {rank, score, exact: true};
    };
    sortedModels.forEach((m, i) => addStandRank(m.id, 'aa', i + 1, m.intelligenceIndex));
    for (const [bId, key] of [['livebench', 'livebench'], ['arenaChat', 'arenaChat'], ['arenaWebdev', 'arenaWebdev'], ['designArena', 'designArena']]) {
      (ext[key]?.rows || []).forEach((r, i) => {
        if (r.modelId) addStandRank(r.modelId, bId, r.rank || (i + 1), r.score);
      });
    }
    gdpModels.forEach((m, i) => addStandRank(m.id, 'aaGdpval', i + 1, m.expertElo.gdpval));
    divRows = computeOrgDivergence(standBoards, standIdx, baseById).rows;
  }
  if (Array.isArray(divRows)) {
    for (const r of divRows) {
      divById.set(r.modelId, r);
      if (r.familySlug && !divByFam.has(r.familySlug)) divByFam.set(r.familySlug, r);
    }
  }
  const getDivergence = row => divById.get(row.id) || (row.family?.slug ? divByFam.get(row.family.slug) : null);

  function resolveInheritedRank(row, entry) {
    if (!entry || entry.rank == null) return null;
    const rowLevel = row.effort?.level ?? effortById.get(row.id) ?? null;
    const srcLevel = entry.srcLevel ?? null;
    if (srcLevel != null && rowLevel != null && rowLevel < srcLevel) {
      return {rank: entry.rank, exact: false, direction: 'down', levelGap: srcLevel - rowLevel};
    }
    return {rank: entry.rank, exact: false, direction: 'up', levelGap: 0};
  }

  function getChatRank(row) {
    const direct = chatRankById.get(row.id);
    if (direct != null) return {rank: direct, exact: true, direction: 'exact', levelGap: 0};
    const canInheritSibling = !row.effort || row.effort.level >= 25;
    if (!canInheritSibling) return null;
    const fam = row.family?.slug;
    if (fam && chatRankByFam.has(fam)) return resolveInheritedRank(row, chatRankByFam.get(fam));
    const rec = orgRankIndex?.get(row.id)?.ranks?.arenaChat;
    if (rec) {
      if (rec.exact) return {rank: rec.rank, exact: true, direction: 'exact', levelGap: 0};
      return resolveInheritedRank(row, {rank: rec.rank, srcLevel: rec.modelId ? (effortById.get(rec.modelId) ?? null) : null});
    }
    return null;
  }

  function getLiveBenchRank(row) {
    const direct = lbRankById.get(row.id) ?? row.livebench?.rank ?? null;
    if (direct != null) return {rank: direct, exact: true, direction: 'exact', levelGap: 0};
    const canInheritHigh = !row.effort || row.effort.level >= 40;
    if (!canInheritHigh) return null;
    const fam = row.family?.slug;
    if (fam && lbRankByFam.has(fam)) return resolveInheritedRank(row, lbRankByFam.get(fam));
    const rec = orgRankIndex?.get(row.id)?.ranks?.livebench;
    if (rec) {
      if (rec.exact) return {rank: rec.rank, exact: true, direction: 'exact', levelGap: 0};
      return resolveInheritedRank(row, {rank: rec.rank, srcLevel: rec.modelId ? (effortById.get(rec.modelId) ?? null) : null});
    }
    return null;
  }

  function getBoardRank(row, exactMap, famMap, orgKey) {
    const direct = exactMap.get(row.id);
    if (direct != null) return direct;
    const canInheritHigh = !row.effort || row.effort.level >= 50;
    if (!canInheritHigh) return null;
    const fam = row.family?.slug;
    if (fam && famMap.has(fam)) return famMap.get(fam);
    const orgR = orgKey ? orgRankIndex?.get(row.id)?.ranks?.[orgKey]?.rank : null;
    if (orgR != null) return orgR;
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
      if (uc.mediaTrack === 'image') {
        if (row.mediaScores?.t2i != null && row.mediaScores?.imgEdit != null) {
          proofs.push({zh: '文生图 + 修图双全', en: 'T2I + Edit'});
        } else if (row.mediaScores?.t2i == null && row.mediaScores?.imgEdit != null) {
          caveats.push({zh: '仅支持修图（无文生图）', en: 'Image-edit only (no T2I)'});
        } else if (row.mediaScores?.t2i != null && row.mediaScores?.imgEdit == null) {
          caveats.push({zh: '仅支持文生图（无修图）', en: 'T2I only (no editing)'});
        }
      } else if (uc.mediaTrack === 'video') {
        if (row.mediaScores?.i2v != null && row.mediaScores?.t2v != null) {
          proofs.push({zh: '文生 + 图生双覆盖', en: 'T2V + I2V'});
        } else if (row.mediaScores?.t2v == null && row.mediaScores?.i2v != null) {
          caveats.push({zh: '仅支持图生视频（无文生）', en: 'Image-to-video only'});
        }
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
    const lb = getLiveBenchRank(row);
    const lbCredible = lb && (lb.exact || lb.direction === 'up');
    const lbDes = getBoardRank(row, lbDesignRankById, lbDesignRankByFam, null);
    const des = getBoardRank(row, designRankById, designRankByFam, 'designArena');
    const web = getBoardRank(row, webdevRankById, webdevRankByFam, 'arenaWebdev');
    const div = divById.get(row.id) || (row.family?.slug ? divByFam.get(row.family.slug) : null);

    if (uc.id === 'design') {
      if (des && des <= 10) proofs.push({zh: `Design 整站 #${des}`, en: `Design Web #${des}`});
      if (web && web <= 10) proofs.push({zh: `WebDev #${web}`, en: `WebDev #${web}`});
      if (lbDes && lbDes <= 10 && proofs.length < 2) proofs.push({zh: `LB2 设计 #${lbDes}`, en: `LB2 Design #${lbDes}`});
      if (isFrontier && proofs.length < 2) proofs.push({zh: '帕累托前沿', en: 'Pareto frontier'});
    } else if (uc.id === 'writing') {
      if (chat && chat.rank <= 15) proofs.push({zh: `Arena 聊天 ${chat.exact ? '' : '~'}#${chat.rank}`, en: `Arena Chat ${chat.exact ? '' : '~'}#${chat.rank}`});
      if (row.arenaRaw?.slop != null && row.arenaRaw.slop <= 25 && proofs.length < 2) {
        proofs.push({zh: `低 AI 套话 (Slop ${Math.round(row.arenaRaw.slop)}%)`, en: `Low AI-slop (${Math.round(row.arenaRaw.slop)}%)`});
      }
      if (lbCredible && lb.rank <= 10 && proofs.length < 2) proofs.push({zh: `LB2 防污染 ${lb.exact ? '' : '~'}#${lb.rank}`, en: `LiveBench ${lb.exact ? '' : '~'}#${lb.rank}`});
      if (isFrontier && proofs.length < 2) proofs.push({zh: '帕累托前沿', en: 'Pareto frontier'});
    } else {
      if (chat && chat.rank <= 10) proofs.push({zh: `Arena 聊天 ${chat.exact ? '' : '~'}#${chat.rank}`, en: `Arena Chat ${chat.exact ? '' : '~'}#${chat.rank}`});
      if (uc.id === 'research' && row.subscores?.hallucination != null && row.subscores.hallucination <= 20) {
        proofs.push({zh: `盲区幻觉仅 ${Math.round(row.subscores.hallucination)}%`, en: `Low hallucination ${Math.round(row.subscores.hallucination)}%`});
      } else if (uc.id === 'coding-api' && web && web <= 10) {
        proofs.push({zh: `WebDev #${web}`, en: `WebDev #${web}`});
      } else if (lbCredible && lb.rank <= 10) {
        proofs.push({zh: `LB2 防污染 ${lb.exact ? '' : '~'}#${lb.rank}`, en: `LiveBench ${lb.exact ? '' : '~'}#${lb.rank}`});
      }
      if (div?.kind === 'consensus' && chat && proofs.length < 2) proofs.push({zh: '全机构共识', en: 'Cross-org consensus'});
      if (chat && chat.rank <= 20 && proofs.length === 0) {
        proofs.push({zh: `Arena 聊天 ${chat.exact ? '' : '~'}#${chat.rank}`, en: `Arena Chat ${chat.exact ? '' : '~'}#${chat.rank}`});
      }
      if (isFrontier && proofs.length < 2) proofs.push({zh: '帕累托前沿', en: 'Pareto frontier'});
    }

    // Objective Risk / Caveat Flags
    const aaRank = aaRankById.get(row.id) ?? null;
    const aaIdx = aaIndexById.get(row.id) ?? row.aaIndex ?? null;
    const isWeakCore = (aaRank != null && aaRank > 30) || (maxAA > 0 && aaIdx != null && aaIdx < maxAA * 0.72);
    if (row.cost >= 11) {
      caveats.push({zh: '高消耗 · 常规月卡多不含或限流极严', en: 'Very high cost · mostly API-only / tight quota'});
    } else if (row.cost >= 8.5) {
      caveats.push({zh: '消耗偏高 · 基础月卡可能不含或限流偏紧', en: 'High burn · often excluded or tight on base plans'});
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
      if (row.arenaRaw?.slop != null && row.arenaRaw.slop >= 50) {
        caveats.push({zh: `AI 套话偏高 (Slop ${Math.round(row.arenaRaw.slop)}%)`, en: `High AI-slop style (${Math.round(row.arenaRaw.slop)}%)`});
      }
      if (isWeakCore && aaRank != null && caveats.length < 2) {
        caveats.push({zh: `综合推理偏弱 (AA #${aaRank}) · 复杂逻辑慎用`, en: `Weak core reasoning (AA #${aaRank}) · light chat only`});
      }
    } else if (uc.id === 'research') {
      if (row.subscores?.hallucination != null && row.subscores.hallucination >= 45) {
        caveats.push({zh: `盲区幻觉率 ${Math.round(row.subscores.hallucination)}% · 严核引用`, en: `${Math.round(row.subscores.hallucination)}% blind-spot hallucination — verify citations`});
      }
      if (!chat && caveats.length < 2) {
        caveats.push({zh: '缺 Arena 聊天盲测 · 实测体感待自验', en: 'No Arena Chat blind votes yet'});
      }
    } else if (!chat && ['general', 'coding-api'].includes(uc.id)) {
      caveats.push({zh: '缺 Arena 聊天盲测 · 实测体感待自验', en: 'No Arena Chat blind votes yet'});
    } else if (div && div.gap <= -12) {
      caveats.push({zh: `硬考明显强于盲测体感 (存在偏科分歧)`, en: 'Hard exams outpace human vibe ratings'});
    }
    if (uc.id === 'design' && row.arenaRaw?.slop != null && row.arenaRaw.slop >= 50 && caveats.length < 2) {
      caveats.push({zh: `AI 套话偏高 (Slop ${Math.round(row.arenaRaw.slop)}%)`, en: `High AI-slop style (${Math.round(row.arenaRaw.slop)}%)`});
    }
    if (uc.id === 'general' && row.subscores?.hallucination != null && row.subscores.hallucination >= 55 && caveats.length < 2) {
      caveats.push({zh: `盲区幻觉率 ${Math.round(row.subscores.hallucination)}%`, en: `${Math.round(row.subscores.hallucination)}% blind-spot hallucination`});
    }
    if (row.timeSec >= 1800 && ['general', 'coding-api', 'research', 'writing'].includes(uc.id) && caveats.length < 2) {
      caveats.push({zh: `复杂任务思考耗时偏长 (${Math.round(row.timeSec / 60)}分)`, en: `Slow on heavy tasks (~${Math.round(row.timeSec / 60)}m)`});
    }

    return {proofs: proofs.slice(0, 2), caveats: caveats.slice(0, 2)};
  }

  return {
    getChatRank,
    getLiveBenchRank,
    getDivergence,
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
    if (uc.tab === 'media') return r.creator?.name || r.id;
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

  // Shared transparent scoring helpers (no hardcoded model names; purely telemetry-driven)
  const chatEvidenceBonus = chat => {
    if (!chat) return 0;
    const base = chat.rank <= 3 ? 2.6 : chat.rank <= 5 ? 1.9 : chat.rank <= 10 ? 1.2 : chat.rank <= 15 ? 0.5 : 0;
    if (!base) return 0;
    if (chat.exact) return base;
    if (chat.direction === 'up') return base * 0.85;
    return base * (chat.levelGap >= 20 ? 0.35 : 0.55);
  };
  const liveBenchBonus = lb => {
    if (!lb || lb.direction === 'down') return 0;
    const base = lb.rank <= 3 ? 1.4 : lb.rank <= 5 ? 0.9 : lb.rank <= 10 ? 0.4 : 0;
    return lb.exact ? base : base * 0.5;
  };
  const subBurnPenalty = (cost, anchor = 7.0, slope = 0.65, cap = 3.0) => (
    cost > anchor ? Math.min(cap, (cost - anchor) * slope) : 0
  );
  const hallucinationPenalty = (row, ucId) => {
    const h = row.subscores?.hallucination;
    if (typeof h !== 'number' || !Number.isFinite(h)) return 0;
    if (ucId === 'general' && h > 40) return Math.min(1.8, (h - 40) * 0.06);
    if (ucId === 'research' && h > 45) return Math.min(1.6, (h - 45) * 0.08);
    return 0;
  };
  const researchRigorMult = row => {
    const h = row.subscores?.hallucination;
    if (typeof h !== 'number' || !Number.isFinite(h)) return 1;
    if (uc.id === 'research' && h > 45) return 1 / (1 + (h - 45) * 0.045);
    if (uc.id === 'general' && h > 70) return 1 / (1 + (h - 70) * 0.015);
    return 1;
  };
  // Cross-org divergence: gently discount hard-exam-heavy / weak-human-vibe specialists on Daily All-Rounder
  // while giving a modest boost to proven cross-org consensus leaders (high on both automated & human boards).
  const divergenceAdjust = (row, ucId) => {
    if (ucId !== 'general') return 0;
    const div = evidence.getDivergence(row);
    if (!div) return 0;
    if (div.kind === 'consensus') return 0.5;
    if (div.gap <= -12) return -Math.min(1.6, (-div.gap - 12) * 0.06);
    return 0;
  };
  const divergenceMult = (row, ucId) => {
    if (ucId !== 'general') return 1;
    const div = evidence.getDivergence(row);
    if (!div) return 1;
    if (div.kind === 'consensus') return 1.04;
    if (div.gap <= -12) return 1 / (1 + Math.min(0.22, (-div.gap - 12) * 0.008));
    return 1;
  };
  // Interactive latency guard: gently penalize ultra-slow thinking models (>30m AA suite) on interactive daily/writing tracks
  const latencyPenalty = (row, ucId) => {
    const t = row.timeSec;
    if (typeof t !== 'number' || !Number.isFinite(t) || t <= 1800) return 0;
    if (ucId === 'general') return Math.min(1.5, ((t - 1800) / 600) * 0.75);
    if (ucId === 'writing') return Math.min(1.8, ((t - 1800) / 600) * 0.9);
    return 0;
  };
  const latencyMult = (row, ucId) => {
    const t = row.timeSec;
    if (typeof t !== 'number' || !Number.isFinite(t) || t <= 1800) return 1;
    if (ucId === 'general') return 1 / (1 + Math.min(0.24, ((t - 1800) / 600) * 0.12));
    if (ucId === 'writing') return 1 / (1 + Math.min(0.32, ((t - 1800) / 600) * 0.16));
    return 1;
  };

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
    const subConsensusRank = r => (
      r.intelligenceIndex
      + chatEvidenceBonus(evidence.getChatRank(r))
      + liveBenchBonus(evidence.getLiveBenchRank(r))
      + divergenceAdjust(r, uc.id)
      - subBurnPenalty(r.cost, 7.0, 0.65, 3.0)
      - hallucinationPenalty(r, uc.id)
      - latencyPenalty(r, uc.id)
    );
    consensusCandidates.sort((a, b) => {
      if (bill.id === 'sub') {
        return subConsensusRank(b) - subConsensusRank(a) || a.cost - b.cost;
      }
      const chatBonusApi = r => {
        const c = evidence.getChatRank(r);
        return (!c || c.direction === 'down') ? 0 : chatEvidenceBonus(c);
      };
      const multA = (1 + 0.07 * chatBonusApi(a) + 0.04 * liveBenchBonus(evidence.getLiveBenchRank(a)))
        * researchRigorMult(a) * divergenceMult(a, uc.id) * latencyMult(a, uc.id);
      const multB = (1 + 0.07 * chatBonusApi(b) + 0.04 * liveBenchBonus(evidence.getLiveBenchRank(b)))
        * researchRigorMult(b) * divergenceMult(b, uc.id) * latencyMult(b, uc.id);
      return (scoreVal(b, consensusSortAlpha) * multB) - (scoreVal(a, consensusSortAlpha) * multA)
        || b.intelligenceIndex - a.intelligenceIndex;
    });

    let fallbackSlot1 = null;
    if (!consensusCandidates.length) {
      if (bill.id === 'sub') {
        const subCands = projected.filter(r => r.cost <= subFriendlyCap);
        const base = subCands.length ? subCands : projected;
        fallbackSlot1 = [...base].sort((a, b) => subConsensusRank(b) - subConsensusRank(a) || a.cost - b.cost)[0];
      } else {
        const fbFloor = maxScore * (bill.id === 'api-budget' ? 0.58 : 0.72);
        const elig = projected.filter(r => r.intelligenceIndex >= fbFloor);
        const base = elig.length ? elig : projected;
        fallbackSlot1 = [...base].sort((a, b) =>
          (scoreVal(b, bill.alpha) * researchRigorMult(b) * divergenceMult(b, uc.id) * latencyMult(b, uc.id))
          - (scoreVal(a, bill.alpha) * researchRigorMult(a) * divergenceMult(a, uc.id) * latencyMult(a, uc.id))
          || b.intelligenceIndex - a.intelligenceIndex
        )[0];
      }
    }
    const slot1 = claim(consensusCandidates[0]) || claim(fallbackSlot1) || claim(sortedByScore[0]);

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

    // 2. Pure API Cost-Efficiency Frontier Pick (protects ceiling for Slot 3, avoids dominated picks, and prefers low-hallucination in research!)
    const effAlpha = bill.id === 'api-budget' ? 1.3 : 3.2;
    const effFloor = maxScore * (bill.id === 'api-budget' ? 0.58 : 0.74);
    const effRankVal = r => scoreVal(r, effAlpha) * researchRigorMult(r) * latencyMult(r, uc.id);
    const reserveCeilingId = (sortedByScore[0] && slot1 && sortedByScore[0].id !== slot1.id && sortedByScore[0].cost > slot1.cost)
      ? sortedByScore[0].id
      : null;
    const notDominatedBySlot1 = r => !slot1 || r.cost < slot1.cost || r.intelligenceIndex > slot1.intelligenceIndex;
    const isLowHallucResearch = r => uc.id !== 'research' || r.subscores?.hallucination == null || r.subscores.hallucination < 45;
    const pickEffFrom = (minFloor, {diffFam = true, skipCeiling = true, strictRigor = false, nonDom = true} = {}) => projected
      .filter(r =>
        isFresh(r, diffFam)
        && r.intelligenceIndex >= minFloor
        && (!skipCeiling || r.id !== reserveCeilingId)
        && (!strictRigor || isLowHallucResearch(r))
        && (!nonDom || notDominatedBySlot1(r))
      )
      .sort((a, b) => effRankVal(b) - effRankVal(a) || a.cost - b.cost)[0];
    const slot2 = claim(
      (uc.id === 'research' ? pickEffFrom(effFloor, {strictRigor: true}) : null)
      || pickEffFrom(effFloor)
      || (uc.id === 'research' ? pickEffFrom(maxScore * 0.5, {strictRigor: true}) : null)
      || pickEffFrom(maxScore * 0.5)
      || pickEffFrom(0)
      || pickEffFrom(0, {skipCeiling: false, nonDom: false})
      || pickEffFrom(0, {diffFam: false, skipCeiling: false, nonDom: false})
    );
    if (slot2) {
      const saveVs1 = slot1 ? formatPctDelta(slot2.cost, slot1.cost) : 0;
      const keepVs1 = slot1 && slot1.intelligenceIndex > 0 ? Math.round((slot2.intelligenceIndex / slot1.intelligenceIndex) * 100) : 100;
      const isStepUp = !!(slot1 && slot2.cost > slot1.cost && slot2.intelligenceIndex > slot1.intelligenceIndex + 0.05);
      picks.push({
        slot: 'saving',
        badgeZh: isStepUp ? '高效进阶参照' : 'API 效率前沿派',
        badgeEn: isStepUp ? 'Efficient Step-Up' : 'API Efficiency',
        row: slot2,
        score: slot2._pickScore,
        isFrontier: frontierIds.has(slot2.id),
        ...evidence.getSignals(slot2, uc, frontierIds.has(slot2.id)),
        reason: {
          zh: saveVs1 >= 15
            ? `按量 API 成本比口碑款低 ${saveVs1}%，纸面保留约 ${keepVs1}% 能力分，适合高频调用与先小量实测`
            : isStepUp
              ? `处于帕累托高效前沿的进阶档位（+${(slot2.intelligenceIndex - slot1.intelligenceIndex).toFixed(1)} 分），适合愿意小幅加预算换更高精度`
              : `线性美元前沿高效率点位，适合看重按量 API 单次成本的工程流水线`,
          en: saveVs1 >= 15
            ? `${saveVs1}% cheaper per API task than Consensus while keeping ~${keepVs1}% paper score — great to trial for high-volume API calls`
            : isStepUp
              ? `Frontier step-up (+${(slot2.intelligenceIndex - slot1.intelligenceIndex).toFixed(1)} pts) for modest extra API budget`
              : `Strong linear-USD efficiency on the Pareto frontier for pay-as-you-go pipelines`
        }
      });
    }

    // 3. Top Capability Ceiling Reference (transparently flags $26 API-only cost and stays honest when Slot 1 already tops the pool!)
    const slot3 = claim(sortedByScore.find(r => isFresh(r, true))) || claim(sortedByScore.find(r => isFresh(r, false)));
    if (slot3) {
      const isCeiling = slot3.id === sortedByScore[0].id;
      const gap = slot1 ? slot3.intelligenceIndex - slot1.intelligenceIndex : 0;
      const isHigher = gap > 0.05;
      picks.push({
        slot: 'flagship',
        badgeZh: isCeiling ? '能力上限参照' : isHigher ? '高分进阶参照' : '次高实力备选',
        badgeEn: isCeiling ? 'Capability Ceiling' : isHigher ? 'High-Tier Alt' : 'Runner-Up Alt',
        row: slot3,
        score: slot3._pickScore,
        isFrontier: frontierIds.has(slot3.id),
        ...evidence.getSignals(slot3, uc, frontierIds.has(slot3.id)),
        reason: {
          zh: slot3.cost >= 11
            ? `全榜纸面最高梯队（${gap >= 0 ? '+' : ''}${gap.toFixed(1)} 分），但单次 API 昂贵且常规月卡多不含，建议仅作疑难攻坚兜底`
            : isHigher
              ? `高分梯队参照（+${gap.toFixed(1)} 分），可与前两款直接进「剖析对比」看各维分差`
              : `当前筛选下的不同家族次高分参照（低 ${Math.abs(gap).toFixed(1)} 分），可与首选并排对比分项表现与价格`,
          en: slot3.cost >= 11
            ? `Peak paper score (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts), but very expensive and rarely included in flat plans — best reserved as an escalation fallback`
            : isHigher
              ? `High-capability reference (+${gap.toFixed(1)} pts) to compare side-by-side in Compare view`
              : `Next highest-scoring family in this filter (${Math.abs(gap).toFixed(1)} pts below Pick 1) to contrast strengths & pricing`
        }
      });
    }
  } else if (uc.id === 'design') {
    // 3 DISTINCT ARCHETYPES FOR FRONTEND & VISUAL AESTHETICS (with core-intelligence floor on Primary & Ceiling!):
    const poolAAs = projected.map(r => evidence.aaIndexOf(r)).filter(v => typeof v === 'number');
    const maxPoolAA = poolAAs.length ? Math.max(...poolAAs) : 0;
    const coreFloor = lic.id === 'open'
      ? maxPoolAA * 0.75
      : Math.max(evidence.maxAA * 0.74, maxPoolAA * 0.78);
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
        const sa = a.humanScores.webdev + (ca && ca.rank <= 15 ? 2 : 0) + (la && la <= 6 ? 1.5 : 0) - subBurnPenalty(a.cost, 7.5, 0.5, 2.0);
        const sb = b.humanScores.webdev + (cb && cb.rank <= 15 ? 2 : 0) + (lb && lb <= 6 ? 1.5 : 0) - subBurnPenalty(b.cost, 7.5, 0.5, 2.0);
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
    const slot2 = claim(visSorted[0]) || claim(sortedByScore.find(r => isFresh(r, true))) || claim(sortedByScore.find(r => isFresh(r, false)));
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
  } else if (uc.id === 'writing') {
    // 3 DISTINCT ARCHETYPES FOR WRITING & NATURAL CHAT (prevents high-slop crowd pleasers from dominating without low-slop contrast!):
    const poolAAs = projected.map(r => evidence.aaIndexOf(r)).filter(v => typeof v === 'number');
    const maxPoolAA = poolAAs.length ? Math.max(...poolAAs) : 0;
    const coreFloor = lic.id === 'open'
      ? maxPoolAA * 0.70
      : Math.max(evidence.maxAA * (bill.id === 'api-budget' ? 0.62 : 0.70), maxPoolAA * 0.72);
    const hasCore = r => {
      const aa = evidence.aaIndexOf(r);
      return aa == null || aa >= coreFloor;
    };
    const isLowSlop = r => r.arenaRaw?.slop == null || r.arenaRaw.slop < 45;

    // 1. Natural Chat Leader (Arena Chat leader with solid core intelligence & avoiding heavy AI-slop)
    const chatClean = projected.filter(r => hasCore(r) && isLowSlop(r));
    const chatBase = chatClean.length ? chatClean : projected.filter(isLowSlop).length ? projected.filter(isLowSlop) : projected;
    const maxChat = Math.max(...chatBase.map(r => r.intelligenceIndex));
    const slot1Pool = (bill.id === 'sub'
      ? (chatBase.filter(r => r.cost <= subFriendlyCap).length ? chatBase.filter(r => r.cost <= subFriendlyCap) : chatBase)
      : chatBase.filter(r => r.intelligenceIndex >= maxChat * (bill.id === 'api-budget' ? 0.65 : 0.78))
    ).sort((a, b) => {
      if (bill.id === 'sub') {
        const sa = a.intelligenceIndex - subBurnPenalty(a.cost, 7.5, 0.45, 2.0) - latencyPenalty(a, 'writing');
        const sb = b.intelligenceIndex - subBurnPenalty(b.cost, 7.5, 0.45, 2.0) - latencyPenalty(b, 'writing');
        return sb - sa || a.cost - b.cost;
      }
      return (scoreVal(b, bill.alpha) * latencyMult(b, 'writing')) - (scoreVal(a, bill.alpha) * latencyMult(a, 'writing'))
        || b.intelligenceIndex - a.intelligenceIndex;
    });
    const slot1 = claim(slot1Pool[0]) || claim(sortedByScore[0]);
    if (slot1) {
      const chatR = evidence.getChatRank(slot1);
      picks.push({
        slot: 'primary',
        badgeZh: '自然对话主力',
        badgeEn: 'Natural Chat Leader',
        scoreLabelZh: '对话人味分',
        scoreLabelEn: 'Chat Vibe',
        row: slot1,
        score: slot1._pickScore,
        isFrontier: frontierIds.has(slot1.id),
        ...evidence.getSignals(slot1, uc, frontierIds.has(slot1.id)),
        reason: {
          zh: chatR
            ? `Arena.ai 去水份聊天盲测排 ${chatR.exact ? '' : '~'}#${chatR.rank} 且综合逻辑扎实，聊思路写长文都不易空泛跑偏`
            : `对话自然度与综合逻辑均衡，适合日常写作与深度讨论`,
          en: chatR
            ? `Arena.ai style-controlled Chat ${chatR.exact ? '' : '~'}#${chatR.rank} with solid reasoning — stays natural without fluff`
            : `Balanced natural conversation and core reasoning for daily writing`
        }
      });
    }

    // 2. Low-Slop Writing Craft (optimizes Anti-Slop + Chat from a DIFFERENT creator/family while enforcing core intelligence!)
    const slopAll = projected.filter(r => isFresh(r, true) && typeof r.humanScores?.antiSlop === 'number' && r.humanScores.antiSlop >= 65);
    const slopCore = slopAll.filter(hasCore);
    const slopPool = slopCore.length ? slopCore : slopAll;
    const diffCreatorSlop = slot1 ? slopPool.filter(r => r.creator?.name !== slot1.creator?.name) : slopPool;
    const craftBase = diffCreatorSlop.length ? diffCreatorSlop : slopPool;
    const craftBlend = r => 0.55 * r.humanScores.antiSlop + 0.45 * r.intelligenceIndex;
    const craftSorted = (bill.id === 'sub'
      ? (craftBase.filter(r => r.cost <= subFriendlyCap).length ? craftBase.filter(r => r.cost <= subFriendlyCap) : craftBase)
      : craftBase
    ).sort((a, b) => {
      if (bill.id === 'sub') {
        return (craftBlend(b) - subBurnPenalty(b.cost, 7.5, 0.45, 2.0) - latencyPenalty(b, 'writing'))
          - (craftBlend(a) - subBurnPenalty(a.cost, 7.5, 0.45, 2.0) - latencyPenalty(a, 'writing'))
          || a.cost - b.cost;
      }
      const va = (valuePerDollar({intelligenceIndex: craftBlend(a), cost: a.cost}, bill.alpha, 0, 0) ?? -1) * latencyMult(a, 'writing');
      const vb = (valuePerDollar({intelligenceIndex: craftBlend(b), cost: b.cost}, bill.alpha, 0, 0) ?? -1) * latencyMult(b, 'writing');
      return vb - va || craftBlend(b) - craftBlend(a);
    });
    const slot2 = claim(craftSorted[0]) || claim(sortedByScore.find(r => isFresh(r, true))) || claim(sortedByScore.find(r => isFresh(r, false)));
    if (slot2) {
      const hasAnti = typeof slot2.humanScores?.antiSlop === 'number';
      picks.push({
        slot: 'flagship',
        badgeZh: hasAnti ? '低 AI 味写作派' : '同级风格对照',
        badgeEn: hasAnti ? 'Low-Slop Craft' : 'Style Peer Alt',
        scoreLabelZh: hasAnti ? '去套话自然度' : '对话人味分',
        scoreLabelEn: hasAnti ? 'Anti-Slop' : 'Chat Vibe',
        row: slot2,
        score: hasAnti ? slot2.humanScores.antiSlop : slot2._pickScore,
        isFrontier: frontierIds.has(slot2.id),
        ...evidence.getSignals(slot2, uc, frontierIds.has(slot2.id)),
        reason: {
          zh: hasAnti
            ? `PersonalityBench 去 AI 套话达 ${Math.round(slot2.humanScores.antiSlop)}%，极少输出模板排比和官腔，文字质感更像真人`
            : `不同厂商的对话风格参照，建议与第一款实测同一篇文案对比语感`,
          en: hasAnti
            ? `${Math.round(slot2.humanScores.antiSlop)}% Anti-Slop naturalness — avoids clichés and boilerplate framing for human-sounding prose`
            : `Cross-vendor writing style peer to test side-by-side on your own prompts`
        }
      });
    }

    // 3. Lightweight / Cost-Efficient Writing Alt (prefers strong-vibe low-slop cheap candidates over very weak-reasoning outliers!)
    const cheapBase = projected.filter(r => isFresh(r, true) && r.cost < (slot1?.cost || Infinity) * 0.85 && r.intelligenceIndex >= maxScore * 0.6);
    const cheapStrong = cheapBase.filter(r => r.intelligenceIndex >= maxScore * 0.72);
    const cheapStrongClean = cheapStrong.filter(r => r.arenaRaw?.slop == null || r.arenaRaw.slop < 45);
    const cheapStrongMeasured = cheapStrongClean.filter(r => typeof r.arenaRaw?.slop === 'number' || hasCore(r));
    const cheapAnyClean = cheapBase.filter(r => r.arenaRaw?.slop == null || r.arenaRaw.slop < 50);
    const cheapPool = (
      cheapStrongMeasured.length ? cheapStrongMeasured
        : cheapStrongClean.length ? cheapStrongClean
          : cheapAnyClean.length ? cheapAnyClean
            : cheapBase
    ).sort((a, b) => (scoreVal(b, 2.4) * latencyMult(b, 'writing')) - (scoreVal(a, 2.4) * latencyMult(a, 'writing')) || a.cost - b.cost);
    const slot3 = claim(cheapPool[0]) || claim(sortedByScore.find(r => isFresh(r, true))) || claim(sortedByScore.find(r => isFresh(r, false)));
    if (slot3) {
      const savePct = slot1 ? formatPctDelta(slot3.cost, slot1.cost) : 0;
      picks.push({
        slot: 'saving',
        badgeZh: savePct >= 15 ? '低价轻量参照' : '风格备选参照',
        badgeEn: savePct >= 15 ? 'Lightweight Alt' : 'Style Alt',
        scoreLabelZh: '对话人味分',
        scoreLabelEn: 'Chat Vibe',
        row: slot3,
        score: slot3._pickScore,
        isFrontier: frontierIds.has(slot3.id),
        ...evidence.getSignals(slot3, uc, frontierIds.has(slot3.id)),
        reason: {
          zh: savePct >= 15
            ? `单次成本低 ${savePct}%，适合高频润色、头脑风暴与轻量日常聊天（留意卡面套话与推理提示）`
            : `另一流派的对话风格参照，可直接送入剖析对比查看去套话与综合分差`,
          en: savePct >= 15
            ? `${savePct}% lower cost for casual drafting and quick chats (check slop & reasoning caveats above)`
            : `Alternative conversational style to inspect side-by-side in Compare view`
        }
      });
    }
  } else {
    // Coding Agents and Media (Image / Video / TTS)
    const floorRatio = bill.id === 'api-budget' ? 0.62 : bill.id === 'api-balanced' ? 0.78 : 0.88;
    const minScoreFloor = maxScore * floorRatio;
    const mediaGenEligible = r => {
      if (uc.mediaTrack === 'image' && r.mediaScores?.t2i == null) return false;
      if (uc.mediaTrack === 'video' && r.mediaScores?.t2v == null) return false;
      return true;
    };
    const ttsLatencyPenalty = r => (
      uc.mediaTrack === 'tts' && typeof r.mediaRaw?.ttfaMs === 'number' && r.mediaRaw.ttfaMs >= 3000 ? 2.0 : 0
    );
    const subTrackScore = r => (
      r.intelligenceIndex
      - (uc.tab === 'coding-agents' ? subBurnPenalty(r.cost, 8.5, 0.5, 2.5) : 0)
      - ttsLatencyPenalty(r)
    );

    let slot1;
    if (bill.id === 'sub') {
      // Monthly plan / IDE users care about top real-world capability without extreme API-only burn
      const subPool = projected.filter(r => r.cost <= subFriendlyCap && mediaGenEligible(r));
      const subBest = (subPool.length ? subPool : projected).sort((a, b) => subTrackScore(b) - subTrackScore(a) || a.cost - b.cost);
      slot1 = claim(subBest[0]);
    } else {
      const elig = projected.filter(r => r.intelligenceIndex >= minScoreFloor && mediaGenEligible(r));
      const cands = (elig.length ? elig : projected.filter(mediaGenEligible).length ? projected.filter(mediaGenEligible) : projected).sort((a, b) =>
        scoreVal(b, bill.alpha) - scoreVal(a, bill.alpha)
        || b.intelligenceIndex - a.intelligenceIndex
        || a.cost - b.cost
      );
      slot1 = claim(cands[0]);
    }

    const topCeiling = sortedByScore.find(mediaGenEligible) || sortedByScore[0];
    let slot2 = null;
    let slot2IsRunnerUp = false;
    if (topCeiling && isFresh(topCeiling, false)) {
      slot2 = claim(topCeiling);
    } else {
      slot2IsRunnerUp = true;
      const runnerPool = [...projected]
        .filter(r => isFresh(r, true) && mediaGenEligible(r))
        .sort((a, b) => (b.intelligenceIndex - ttsLatencyPenalty(b)) - (a.intelligenceIndex - ttsLatencyPenalty(a)) || a.cost - b.cost);
      slot2 = claim(runnerPool[0])
        || claim(sortedByScore.find(r => isFresh(r, true)))
        || claim(sortedByScore.find(r => isFresh(r, false)));
    }

    // 3rd slot: cheaper Pareto alternative -> modest step-up -> sorted peer fallback (never unsorted or negative step-up!)
    const saverFloor = Math.max(maxScore * (uc.tab === 'media' ? 0.72 : 0.65), (slot1?.intelligenceIndex || 0) * 0.78);
    const cheaper = projected
      .filter(r => isFresh(r, true) && mediaGenEligible(r) && r.cost < (slot1?.cost || Infinity) * 0.85 && r.intelligenceIndex >= saverFloor)
      .sort((a, b) => scoreVal(b, 1.8) - scoreVal(a, 1.8) || a.cost - b.cost);
    let slot3Mode = 'saving';
    let slot3 = claim(cheaper[0]);
    if (!slot3) {
      const cheaperAny = projected
        .filter(r => isFresh(r, false) && mediaGenEligible(r) && r.cost < (slot1?.cost || Infinity) * 0.9 && r.intelligenceIndex >= maxScore * (uc.tab === 'media' ? 0.7 : 0.55))
        .sort((a, b) => scoreVal(b, 1.8) - scoreVal(a, 1.8) || a.cost - b.cost);
      slot3 = claim(cheaperAny[0]);
    }
    if (!slot3) {
      const stepUp = projected
        .filter(r => isFresh(r, true) && mediaGenEligible(r) && r.intelligenceIndex > (slot1?.intelligenceIndex || 0) + 0.05)
        .sort((a, b) => scoreVal(b, 3.2) - scoreVal(a, 3.2) || b.intelligenceIndex - a.intelligenceIndex);
      if (stepUp[0]) {
        slot3Mode = 'stepup';
        slot3 = claim(stepUp[0]);
      }
    }
    if (!slot3) {
      const cheaperRelaxed = projected
        .filter(r => isFresh(r, true) && mediaGenEligible(r) && r.cost < (slot1?.cost || Infinity) * 0.85 && r.intelligenceIndex >= maxScore * 0.45)
        .sort((a, b) => scoreVal(b, 1.8) - scoreVal(a, 1.8) || a.cost - b.cost);
      if (cheaperRelaxed[0]) {
        slot3Mode = 'saving';
        slot3 = claim(cheaperRelaxed[0]);
      } else {
        slot3Mode = 'peer';
        slot3 = claim(sortedByScore.find(r => isFresh(r, true) && mediaGenEligible(r)))
          || claim(sortedByScore.find(r => isFresh(r, true)))
          || claim(sortedByScore.find(r => isFresh(r, false)));
      }
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
      const delta3 = slot1 ? slot3.intelligenceIndex - slot1.intelligenceIndex : 0;
      picks.push({
        slot: 'saving',
        badgeZh: slot3Mode === 'stepup' ? '进阶参照' : slot3Mode === 'saving' ? '低价效率参照' : '同级备选参照',
        badgeEn: slot3Mode === 'stepup' ? 'Step-Up Alt' : slot3Mode === 'saving' ? 'Low-Cost Alt' : 'Peer Alt',
        row: slot3,
        score: slot3._pickScore,
        isFrontier: frontierIds.has(slot3.id),
        ...evidence.getSignals(slot3, uc, frontierIds.has(slot3.id)),
        reason: {
          zh: slot3Mode === 'stepup'
            ? `小幅提高预算可再涨 +${delta3.toFixed(1)} 分`
            : slot3Mode === 'saving'
              ? `单次成本再低 ${Math.max(1, savePct)}%，保留约 ${keepPct}% 实测表现，适合轻量日常或批量跑任务`
              : `同赛道另一高分备选（分差 ${Math.abs(delta3).toFixed(1)}），建议与前两款直接实测对比效果`,
          en: slot3Mode === 'stepup'
            ? `Modest budget step-up adding +${delta3.toFixed(1)} pts`
            : slot3Mode === 'saving'
              ? `${Math.max(1, savePct)}% lower unit cost while keeping ~${keepPct}% score for lighter or batch workloads`
              : `Another high-scoring peer (${Math.abs(delta3).toFixed(1)} pts apart) worth testing side-by-side`
        }
      });
    }
  }

  return {useCase: uc, billing: bill, budget: bill, license: lic, totalPool, picks};
}

/**
 * Single-source-of-truth objective caveats for any pinned model dot on any scatter chart,
 * keeping scatter inspection consistent with the Shortlist Builder's risk flags.
 */
export function getRowCaveats(snapshot, row, tabKey, context = {}) {
  if (!snapshot || !row) return [];
  const evidence = buildEvidenceLookup(snapshot, context);
  if (tabKey === 'coding-agents') {
    const uc = RECOMMEND_USE_CASES.find(x => x.id === 'coding-agent');
    return evidence.getSignals(row, uc, false).caveats;
  }
  if (tabKey === 'media') {
    const track = row.mediaKind || 'image';
    const uc = RECOMMEND_USE_CASES.find(x => x.mediaTrack === track) || RECOMMEND_USE_CASES[6];
    return evidence.getSignals(row, uc, false).caveats;
  }
  const out = [];
  const pushUnique = item => {
    if (item && !out.some(x => x.zh === item.zh)) out.push(item);
  };
  if (tabKey === 'human-arena') {
    for (const c of evidence.getSignals(row, RECOMMEND_USE_CASES.find(x => x.id === 'design'), false).caveats) pushUnique(c);
    for (const c of evidence.getSignals(row, RECOMMEND_USE_CASES.find(x => x.id === 'writing'), false).caveats) pushUnique(c);
    return out.slice(0, 3);
  }
  // models, frontier, cyber
  for (const c of evidence.getSignals(row, RECOMMEND_USE_CASES[0], false).caveats) pushUnique(c);
  if (tabKey === 'cyber' && row.refusalRate != null && row.refusalRate >= 35) {
    pushUnique({zh: `安全拦截拒答率 ${Math.round(row.refusalRate)}%`, en: `High refusal rate (${Math.round(row.refusalRate)}%)`});
  }
  return out.slice(0, 3);
}
