import {
  paretoFrontier,
  valuePerDollar,
  computeScenarioScore,
  SCENARIO_PRESETS
} from '../chart-math.mjs?v=20261120-02';

export const RECOMMEND_USE_CASES = [
  {
    id: 'general',
    zh: '日常全能主力',
    en: 'Daily All-Rounder',
    tab: 'models',
    yLens: '',
    scenarioId: 'default',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '均衡代码、推理、文档与日常问答，优先人工与综合体验双稳的模型',
    descEn: 'Balanced coding, reasoning, docs & everyday chat on the main value frontier'
  },
  {
    id: 'coding',
    zh: '编程与代码工程',
    en: 'Coding & Engineering',
    tab: 'models',
    yLens: '',
    scenarioId: 'fullstack',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '按全栈工程配方加权 FrontierCode 2.0、Terminal 4.0 与 WebDev 实战表现',
    descEn: 'Weighted toward FrontierCode 2.0, Terminal 4.0, and WebDev engineering tasks'
  },
  {
    id: 'writing',
    zh: '聊天写作与高人味',
    en: 'Writing & Natural Chat',
    tab: 'human-arena',
    yLens: 'chatVibe',
    scenarioId: 'default',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '聚焦 Arena.ai 去水份盲投人味与去 AI 套话自然度，写文章聊思路不机械',
    descEn: 'Prioritizes Arena.ai style-controlled human preference and Anti-Slop naturalness'
  },
  {
    id: 'design',
    zh: '网页前端与视觉审美',
    en: 'Web & UI Aesthetics',
    tab: 'human-arena',
    yLens: 'pureVisual',
    scenarioId: 'default',
    unitZh: '任务',
    unitEn: 'task',
    descZh: '聚焦 Design Arena 五维视觉盲测（整站 / UI 组件 / 图表 / SVG），拒绝土味页面',
    descEn: 'Prioritizes Design Arena 5D aesthetic Elo across websites, UI, DataViz & SVG'
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
    descZh: '加权 44 职业 GDPval 交付、长文档检索与低盲区幻觉率，适合严谨专业工作',
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
    descZh: 'AA Speech Arena 盲听自然度，按每千字成本（$/千字）与延迟独立筛选',
    descEn: 'AA Speech Arena naturalness Elo ranked strictly on USD per 1k chars & latency'
  }
];

export const RECOMMEND_BUDGETS = [
  {id: 'budget', zh: '极致省钱', en: 'Lowest Cost', alpha: 1.4},
  {id: 'balanced', zh: '均衡甜点（推荐）', en: 'Balanced (Recommended)', alpha: 3.5},
  {id: 'flagship', zh: '追最强上限', en: 'Top Capability', alpha: 12}
];

export const RECOMMEND_LICENSES = [
  {id: 'all', zh: '不限（推荐）', en: 'Any (Recommended)'},
  {id: 'open', zh: '仅开源可自部署', en: 'Open-Weights Only'},
  {id: 'closed', zh: '仅商业闭源 API', en: 'Proprietary API Only'}
];

function scoreForUseCase(row, useCase) {
  if (useCase.id === 'coding') {
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
    return row.humanScores?.pureVisual ?? null;
  }
  return row.intelligenceIndex;
}

function formatPctDelta(cheapCost, refCost) {
  if (!(refCost > 0) || !(cheapCost >= 0)) return 0;
  return Math.round((1 - cheapCost / refCost) * 100);
}

/**
 * Compute up to 3 curated, strictly deduplicated model recommendations
 * (Primary Match, Top Ceiling / Runner-Up, Budget Saver / Step-Up) from snapshot data.
 */
export function recommendModels(snapshot, {useCase = 'general', budget = 'balanced', license = 'all'} = {}) {
  const uc = RECOMMEND_USE_CASES.find(x => x.id === useCase) || RECOMMEND_USE_CASES[0];
  const bud = RECOMMEND_BUDGETS.find(x => x.id === budget) || RECOMMEND_BUDGETS[1];
  const lic = RECOMMEND_LICENSES.find(x => x.id === license) || RECOMMEND_LICENSES[0];

  const sourceKey = uc.tab === 'human-arena'
    ? 'humanArenaModels'
    : uc.tab === 'media'
      ? 'mediaModels'
      : 'models';
  const rawList = Array.isArray(snapshot?.[sourceKey]) ? snapshot[sourceKey] : [];

  let pool = rawList
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

  // Deduplicate by family keeping strongest or best-value variants? Keep full pool for Pareto,
  // but ensure the 3 final picks come from distinct model families whenever possible.
  const totalPool = pool.length;
  if (!totalPool) {
    return {useCase: uc, budget: bud, license: lic, totalPool: 0, picks: []};
  }

  const projected = pool.map(r => ({...r, intelligenceIndex: r._pickScore}));
  const frontier = paretoFrontier(projected, r => r.cost);
  const frontierIds = new Set(frontier.map(r => r.id));

  const sortedByScore = [...projected].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex || a.cost - b.cost);
  const maxScore = sortedByScore[0].intelligenceIndex;

  // Minimum reasonable capability floor so "budget" doesn't pick a broken tiny model
  const floorRatio = bud.id === 'budget' ? 0.62 : bud.id === 'balanced' ? 0.78 : 0.90;
  const minScoreFloor = Math.max(0, maxScore * floorRatio);

  const scoreVal = (row, alpha, minS = 0) => valuePerDollar(row, alpha, minS, 0) ?? -1;

  // 1. Primary pick tailored to budget preference
  let primary;
  if (bud.id === 'flagship') {
    primary = sortedByScore[0];
  } else {
    const eligible = projected.filter(r => r.intelligenceIndex >= minScoreFloor);
    const candidates = eligible.length ? eligible : projected;
    candidates.sort((a, b) =>
      scoreVal(b, bud.alpha, 0) - scoreVal(a, bud.alpha, 0)
      || b.intelligenceIndex - a.intelligenceIndex
      || a.cost - b.cost
    );
    primary = candidates[0];
  }

  const usedIds = new Set([primary.id]);
  const usedFamilies = new Set([primary.family?.slug || primary.id]);
  const isFresh = (r, preferDiffFamily = true) => {
    if (usedIds.has(r.id)) return false;
    if (preferDiffFamily && r.family?.slug && usedFamilies.has(r.family.slug)) return false;
    return true;
  };
  const claim = r => {
    usedIds.add(r.id);
    usedFamilies.add(r.family?.slug || r.id);
    return r;
  };

  // 2. Top Ceiling (Flagship) or Runner-Up if Primary is already #1
  let flagship = null;
  let flagshipIsRunnerUp = false;
  if (sortedByScore[0].id !== primary.id) {
    flagship = claim(sortedByScore[0]);
  } else {
    flagshipIsRunnerUp = true;
    const alt = sortedByScore.find(r => isFresh(r, true)) || sortedByScore.find(r => isFresh(r, false));
    if (alt) flagship = claim(alt);
  }

  // 3. Budget Saver (cheaper alternative retaining solid quality) or Value Sweet Spot if Primary is already ultra-cheap
  let saver = null;
  let saverIsBalancedStepUp = false;
  const saverFloor = Math.max(maxScore * 0.65, primary.intelligenceIndex * 0.78);
  const cheaperPool = projected
    .filter(r => isFresh(r, true) && r.cost < primary.cost * 0.85 && r.intelligenceIndex >= saverFloor)
    .sort((a, b) => scoreVal(b, 1.8, 0) - scoreVal(a, 1.8, 0) || a.cost - b.cost);
  if (cheaperPool.length) {
    saver = claim(cheaperPool[0]);
  } else {
    const cheaperAnyFam = projected
      .filter(r => isFresh(r, false) && r.cost < primary.cost * 0.9 && r.intelligenceIndex >= maxScore * 0.55)
      .sort((a, b) => scoreVal(b, 1.8, 0) - scoreVal(a, 1.8, 0) || a.cost - b.cost);
    if (cheaperAnyFam.length) {
      saver = claim(cheaperAnyFam[0]);
    } else {
      // Primary is already among the cheapest: offer a balanced mid-tier sweet spot as 3rd option
      saverIsBalancedStepUp = true;
      const stepUp = projected
        .filter(r => isFresh(r, true) && r.intelligenceIndex > primary.intelligenceIndex)
        .sort((a, b) => scoreVal(b, 3.5, 0) - scoreVal(a, 3.5, 0) || b.intelligenceIndex - a.intelligenceIndex);
      const fallback = stepUp[0] || projected.find(r => isFresh(r, true)) || projected.find(r => isFresh(r, false));
      if (fallback) saver = claim(fallback);
    }
  }

  const refFlagship = flagship && !flagshipIsRunnerUp ? flagship : primary;
  const picks = [];

  const makeReasonPrimary = () => {
    const onFront = frontierIds.has(primary.id);
    if (bud.id === 'flagship') {
      return {
        zh: `该场景最高能力分（${primary._pickScore.toFixed(1)}）${onFront ? ' · 位于帕累托前沿' : ''}`,
        en: `Highest score in this track (${primary._pickScore.toFixed(1)})${onFront ? ' · On Pareto frontier' : ''}`
      };
    }
    const savePct = formatPctDelta(primary.cost, refFlagship.cost);
    const keepPct = refFlagship.intelligenceIndex > 0 ? Math.round((primary.intelligenceIndex / refFlagship.intelligenceIndex) * 100) : 100;
    if (savePct >= 15) {
      return {
        zh: `${onFront ? '帕累托前沿 · ' : ''}比顶级旗舰省 ${savePct}% 成本，保留约 ${keepPct}% 能力`,
        en: `${onFront ? 'Pareto frontier · ' : ''}${savePct}% cheaper than top flagship while keeping ~${keepPct}% score`
      };
    }
    return {
      zh: `${onFront ? '帕累托前沿 · ' : ''}当前预算偏好下的综合性价比最优解`,
      en: `${onFront ? 'Pareto frontier · ' : ''}Top score-to-cost balance for your chosen preference`
    };
  };

  picks.push({
    slot: 'primary',
    badgeZh: bud.id === 'flagship' ? '最强主力' : '主力推荐',
    badgeEn: bud.id === 'flagship' ? 'Top Flagship' : 'Best Match',
    row: primary,
    score: primary._pickScore,
    isFrontier: frontierIds.has(primary.id),
    reason: makeReasonPrimary()
  });

  if (flagship) {
    const gap = Math.abs(flagship.intelligenceIndex - primary.intelligenceIndex);
    const ratio = primary.cost > 0 ? flagship.cost / primary.cost : 1;
    const reason = flagshipIsRunnerUp
      ? {
        zh: `紧随榜首（分差 ${gap.toFixed(1)}），${flagship.cost < primary.cost ? `单价便宜 ${formatPctDelta(flagship.cost, primary.cost)}%` : '可作同档备选参照'}`,
        en: `Runner-up (${gap.toFixed(1)} pts behind)${flagship.cost < primary.cost ? `, ${formatPctDelta(flagship.cost, primary.cost)}% cheaper` : ' as top-tier alternative'}`
      }
      : {
        zh: `场景最高分（+${gap.toFixed(1)} 分），成本约为主力的 ${ratio >= 1.2 ? ratio.toFixed(1) + '×' : '同档'}`,
        en: `Track ceiling (+${gap.toFixed(1)} pts), ${ratio >= 1.2 ? `~${ratio.toFixed(1)}× the cost of Best Match` : 'at comparable price'}`
      };
    picks.push({
      slot: 'flagship',
      badgeZh: flagshipIsRunnerUp ? '强力备选' : '能力上限',
      badgeEn: flagshipIsRunnerUp ? 'Runner-Up' : 'Top Ceiling',
      row: flagship,
      score: flagship._pickScore,
      isFrontier: frontierIds.has(flagship.id),
      reason
    });
  }

  if (saver) {
    const savePct = formatPctDelta(saver.cost, primary.cost);
    const keepPct = primary.intelligenceIndex > 0 ? Math.round((saver.intelligenceIndex / primary.intelligenceIndex) * 100) : 100;
    const reason = saverIsBalancedStepUp
      ? {
        zh: `加一点预算换取 +${(saver.intelligenceIndex - primary.intelligenceIndex).toFixed(1)} 分的甜点升级档`,
        en: `Balanced step-up gaining +${(saver.intelligenceIndex - primary.intelligenceIndex).toFixed(1)} pts on the frontier`
      }
      : {
        zh: `比主力再省 ${Math.max(1, savePct)}% 费用，仍保留约 ${keepPct}% 表现，适合高频跑批`,
        en: `${Math.max(1, savePct)}% cheaper than Best Match while keeping ~${keepPct}% score for bulk runs`
      };
    picks.push({
      slot: 'saving',
      badgeZh: saverIsBalancedStepUp ? '甜点进阶' : '低价平替',
      badgeEn: saverIsBalancedStepUp ? 'Balanced Step-Up' : 'Budget Saver',
      row: saver,
      score: saver._pickScore,
      isFrontier: frontierIds.has(saver.id),
      reason
    });
  }

  return {useCase: uc, budget: bud, license: lic, totalPool, picks};
}
