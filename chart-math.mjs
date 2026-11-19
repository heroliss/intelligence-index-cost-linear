// Shared by the renderer and regression checks. View domains use linear data units.
export function niceStep(span, count = 8) {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / count, power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].find(n => n * power >= raw) * power;
}

export function ticks(min, max, count = 8) {
  const step = niceStep(max - min, count), result = [];
  for (let n = Math.ceil((min - step * 1e-8) / step); n * step <= max + step * 1e-8; n++) {
    result.push(Number((n * step).toPrecision(12)));
    if (result.length > 100) break;
  }
  return result;
}

export function paretoFrontier(rows, xOf = d => d.cost) {
  let best = -Infinity;
  return [...rows]
    .filter(row => Number.isFinite(xOf(row)) && xOf(row) >= 0)
    .sort((a, b) => xOf(a) - xOf(b) || b.intelligenceIndex - a.intelligenceIndex)
    .filter(row => {
      if (row.intelligenceIndex <= best) return false;
      best = row.intelligenceIndex;
      return true;
    });
}

export function dataBounds(rows, xOf = d => d.cost) {
  const xs = rows.map(xOf).filter(v => Number.isFinite(v) && v >= 0);
  const rawMaxX = xs.length ? Math.max(...xs) : 1;
  const maxX = rawMaxX > 0 ? rawMaxX : 1;
  const maxY = Math.max(1, ...rows.map(d => d.intelligenceIndex));
  const minY = Math.min(0, ...rows.map(d => d.intelligenceIndex));
  const y = minY < 0 ? Math.floor(minY / 5) * 5 - 2 : 0;
  return {x: 0, y, width: maxX * 1.08, height: Math.ceil(maxY / 5) * 5 - y};
}

export function effortTrajectories(rows, xOf = d => d.cost) {
  const groups = new Map();
  for (const row of rows) {
    const slug = row?.family?.slug;
    const xVal = xOf(row);
    if (!slug || !row?.effort || !Number.isFinite(xVal) || xVal < 0 || !Number.isFinite(row.intelligenceIndex)) continue;
    if (!groups.has(slug)) {
      groups.set(slug, {slug, name: row.family.name || slug, creator: row.creator, points: []});
    }
    groups.get(slug).points.push(row);
  }
  const trajectories = [];
  for (const group of groups.values()) {
    if (group.points.length < 2) continue;
    group.points.sort((a, b) => (a.effort.level - b.effort.level) || (xOf(a) - xOf(b)) || a.id.localeCompare(b.id));
    trajectories.push(group);
  }
  return trajectories;
}

export function clampView(view, bounds) {
  const width = Math.max(bounds.width / 300, Math.min(bounds.width * 1.15, view.width));
  const height = Math.max(bounds.height / 80, Math.min(bounds.height * 1.1, view.height));
  return {
    width,
    height,
    x: Math.max(0, Math.min(Math.max(0, bounds.width - width), view.x)),
    y: Math.max(bounds.y, Math.min(Math.max(bounds.y, bounds.y + bounds.height - height), view.y))
  };
}

export function pointerZoomView(view, bounds, axis, factor, anchorRatio = 0.5) {
  const ratio = Number.isFinite(anchorRatio) ? Math.max(0, Math.min(1, anchorRatio)) : 0.5;
  const next = {...view};
  if (axis === 'x' || axis === 'xy') {
    const anchorX = view.x + ratio * view.width;
    const width = Math.max(bounds.width / 300, Math.min(bounds.width * 1.15, view.width * factor));
    next.width = width;
    next.x = anchorX - ratio * width;
  }
  if (axis === 'y' || axis === 'xy') {
    const yRatio = axis === 'xy' && arguments.length > 5 && Number.isFinite(arguments[5])
      ? Math.max(0, Math.min(1, arguments[5]))
      : ratio;
    const anchorY = view.y + yRatio * view.height;
    const height = Math.max(bounds.height / 80, Math.min(bounds.height * 1.1, view.height * factor));
    next.height = height;
    next.y = anchorY - yRatio * height;
  }
  return clampView(next, bounds);
}

export function validRows(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('缺少有效图表数据 / Missing chart data');
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || ids.has(row.id) || typeof row.name !== 'string' || !row.name.trim() || !Number.isFinite(row.cost) || row.cost < 0 || !Number.isFinite(row.intelligenceIndex)) {
      throw new Error('数据格式校验失败 / Invalid chart data');
    }
    ids.add(row.id);
  }
  return rows;
}

const tableCollator = new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'});

// Smooth C1 IRT pass-odds hybrid curve:
// - anchor = 50: natural 50% pass-rate balance point where utility equals 50 for all weights.
// - ceiling = 105: regularized benchmark asymptote (~5% irreducible item noise), keeping s=100 finite.
// - weight = 0: pure cost-efficiency (constant utility = 50 for positive scores).
// - weight = 1: exact linear utility = score (Index / Cost).
// - weight > 1: compounds pass rate (s/50)^w with error-headroom compression ((105-50)/(105-s))^((w-1)^2/w).
export const VALUE_WEIGHT = Object.freeze({
  min: 0,
  max: 25,
  step: 0.1,
  default: 3,
  anchor: 50,
  ceiling: 105
});

export const MIN_SCORE = Object.freeze({
  min: 0,
  max: 95,
  step: 1,
  default: 0
});

export const MAX_COST_PRESETS = Object.freeze([0, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]);

export const VALUE_PRESETS = Object.freeze([
  Object.freeze({value: 0, id: 'cost', zh: '纯成本', en: 'Cost only'}),
  Object.freeze({value: 1, id: 'linear', zh: '线性', en: 'Linear'}),
  Object.freeze({value: 3, id: 'balanced', zh: '均衡', en: 'Balanced'}),
  Object.freeze({value: 6, id: 'mainstream', zh: '主力', en: 'Mainstream'}),
  Object.freeze({value: 10, id: 'flagship', zh: '旗舰', en: 'Flagship'}),
  Object.freeze({value: 22, id: 'sota', zh: '极限', en: 'SOTA'})
]);

export const SUBSCRIPTION_TIERS = Object.freeze([
  Object.freeze({price: 20, id: 'pro', zh: 'Pro $20', en: 'Pro $20'}),
  Object.freeze({price: 100, id: 'max', zh: 'Max $100', en: 'Max $100'}),
  Object.freeze({price: 200, id: 'ultra', zh: 'Ultra $200', en: 'Ultra $200'})
]);

export const MONTHLY_USAGE = Object.freeze({
  minTasks: 1,
  maxTasks: 1000,
  defaultModelTasks: 60,
  defaultAgentTasks: 30,
  minFee: 5,
  maxFee: 1000,
  defaultFee: 20
});

export const TASK_VOLUME_PRESETS = Object.freeze([
  Object.freeze({tasks: 15, zh: '轻度 15', en: 'Light 15'}),
  Object.freeze({tasks: 60, zh: '日常 60', en: 'Daily 60'}),
  Object.freeze({tasks: 180, zh: '高频 180', en: 'Heavy 180'}),
  Object.freeze({tasks: 450, zh: '重度 450', en: 'Intense 450'})
]);

function validateValueWeight(weight) {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < VALUE_WEIGHT.min || weight > VALUE_WEIGHT.max) {
    throw new RangeError(`Value weight must be a finite number between ${VALUE_WEIGHT.min} and ${VALUE_WEIGHT.max}`);
  }
}

function validateMinScore(minScore) {
  if (typeof minScore !== 'number' || !Number.isFinite(minScore) || minScore < MIN_SCORE.min || minScore > MIN_SCORE.max) {
    throw new RangeError(`Minimum score must be a finite number between ${MIN_SCORE.min} and ${MIN_SCORE.max}`);
  }
}

function validateMaxCost(maxCost) {
  if (typeof maxCost !== 'number' || !Number.isFinite(maxCost) || maxCost < 0) {
    throw new RangeError('Maximum cost cap must be a non-negative finite number');
  }
}

export function capabilityUtility(score, weight = VALUE_WEIGHT.default) {
  validateValueWeight(weight);
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return null;
  if (score === 0) return 0;
  if (weight === 0) return VALUE_WEIGHT.anchor;
  if (weight === 1) return score === 0 ? 0 : score;
  const {anchor, ceiling} = VALUE_WEIGHT;
  const passGain = (score / anchor) ** weight;
  if (weight < 1) {
    const utility = anchor * passGain;
    return Number.isFinite(utility) ? (utility === 0 ? 0 : utility) : null;
  }
  const clamped = Math.min(score, ceiling - 0.5);
  const beta = (weight - 1) ** 2 / weight;
  const headroomGain = ((ceiling - anchor) / (ceiling - clamped)) ** beta;
  const utility = anchor * passGain * headroomGain;
  return Number.isFinite(utility) ? (utility === 0 ? 0 : utility) : null;
}

export function valuePerDollar(row, weight = VALUE_WEIGHT.default, minScore = MIN_SCORE.default, maxCost = 0) {
  validateValueWeight(weight);
  validateMinScore(minScore);
  validateMaxCost(maxCost);
  const score = row?.intelligenceIndex, cost = row?.cost;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) return null;
  if (minScore > 0 && score < minScore) return null;
  if (maxCost > 0 && cost > maxCost) return null;
  if (score === 0) return 0;
  // Preserve the original ratio bit-for-bit at weight 1.
  if (weight === 1) {
    const linear = score / cost;
    return Number.isFinite(linear) ? (linear === 0 ? 0 : linear) : null;
  }
  const utility = capabilityUtility(score, weight);
  if (utility === null) return null;
  const value = utility / cost;
  return Number.isFinite(value) ? (value === 0 ? 0 : value) : null;
}

export function isoValueCost(score, targetValue, weight = VALUE_WEIGHT.default) {
  validateValueWeight(weight);
  if (typeof targetValue !== 'number' || !Number.isFinite(targetValue) || targetValue <= 0) return null;
  const utility = capabilityUtility(score, weight);
  if (utility === null) return null;
  const cost = utility / targetValue;
  return Number.isFinite(cost) ? cost : null;
}

export function breakEvenTasks(costPerTask, monthlyFee = MONTHLY_USAGE.defaultFee) {
  if (typeof monthlyFee !== 'number' || !Number.isFinite(monthlyFee) || monthlyFee <= 0) {
    throw new RangeError('Monthly subscription fee must be a positive finite number');
  }
  if (typeof costPerTask !== 'number' || !Number.isFinite(costPerTask) || costPerTask <= 0) return null;
  const tasks = monthlyFee / costPerTask;
  return Number.isFinite(tasks) ? tasks : null;
}

export function monthlyApiBill(costPerTask, monthlyTasks) {
  if (typeof monthlyTasks !== 'number' || !Number.isFinite(monthlyTasks) || monthlyTasks < 0) {
    throw new RangeError('Monthly task count must be a non-negative finite number');
  }
  if (typeof costPerTask !== 'number' || !Number.isFinite(costPerTask) || costPerTask < 0) return null;
  const bill = costPerTask * monthlyTasks;
  return Number.isFinite(bill) ? (bill === 0 ? 0 : bill) : null;
}

export function subscriptionVerdict(costPerTask, monthlyTasks, monthlyFee = MONTHLY_USAGE.defaultFee) {
  const apiBill = monthlyApiBill(costPerTask, monthlyTasks);
  const breakeven = breakEvenTasks(costPerTask, monthlyFee);
  if (apiBill === null || breakeven === null) return null;
  const delta = apiBill - monthlyFee;
  const ratio = apiBill / monthlyFee;
  const status = ratio < 0.95 ? 'api-cheaper' : ratio > 1.05 ? 'sub-cheaper' : 'near-breakeven';
  return {apiBill, monthlyFee, breakeven, delta, ratio, status};
}

export function historicalFrontierSummary(rows, cutoffDate, xOf = d => d.cost) {
  if (typeof cutoffDate !== 'string' || !cutoffDate) return null;
  const datedRows = rows.filter(r => typeof r?.releaseDate === 'string' && r.releaseDate);
  const pastRows = datedRows.filter(r => r.releaseDate <= cutoffDate);
  const pastFrontier = paretoFrontier(pastRows, xOf);
  const currentFrontier = paretoFrontier(rows, xOf);
  const currentMaxScore = rows.length ? Math.max(...rows.map(r => r.intelligenceIndex)) : null;
  if (!pastRows.length) {
    return {
      cutoffDate,
      pastCount: 0,
      totalCount: rows.length,
      pastFrontier: [],
      currentFrontier,
      pastMaxScore: null,
      currentMaxScore,
      milestone: null,
      pastMinCost: null,
      currentMinCost: null,
      deflationFactor: null
    };
  }
  const pastMaxScore = Math.max(...pastRows.map(r => r.intelligenceIndex));
  const thresholds = [55, 50, 45, 40, 35, 30, 20];
  const milestone = thresholds.find(t => pastRows.some(r => r.intelligenceIndex >= t && r.cost > 0))
    ?? Math.max(1, Math.floor(pastMaxScore));
  const pastQualified = pastRows.filter(r => r.intelligenceIndex >= milestone && r.cost > 0);
  const curQualified = rows.filter(r => r.intelligenceIndex >= milestone && r.cost > 0);
  const pastMinCost = pastQualified.length ? Math.min(...pastQualified.map(r => r.cost)) : null;
  const currentMinCost = curQualified.length ? Math.min(...curQualified.map(r => r.cost)) : null;
  const deflationFactor = pastMinCost && currentMinCost ? pastMinCost / currentMinCost : null;
  return {
    cutoffDate,
    pastCount: pastRows.length,
    totalCount: rows.length,
    pastFrontier,
    currentFrontier,
    pastMaxScore,
    currentMaxScore,
    milestone,
    pastMinCost,
    currentMinCost,
    deflationFactor
  };
}

export function cascadingRouteSummary(fastRow, strongRow, fastShare = 0.8, monthlyTasks = MONTHLY_USAGE.defaultModelTasks) {
  if (typeof fastShare !== 'number' || !Number.isFinite(fastShare) || fastShare < 0 || fastShare > 1) {
    throw new RangeError('Fast model share must be between 0 and 1');
  }
  if (typeof monthlyTasks !== 'number' || !Number.isFinite(monthlyTasks) || monthlyTasks < 0) {
    throw new RangeError('Monthly task count must be non-negative');
  }
  if (!fastRow || !strongRow || !Number.isFinite(fastRow.cost) || fastRow.cost < 0 || !Number.isFinite(strongRow.cost) || strongRow.cost < 0) {
    return null;
  }
  const strongShare = 1 - fastShare;
  const blendedCost = fastRow.cost * fastShare + strongRow.cost * strongShare;
  const blendedScore = fastRow.intelligenceIndex * fastShare + strongRow.intelligenceIndex * strongShare;
  const savingsVsStrong = strongRow.cost > 0 ? (strongRow.cost - blendedCost) / strongRow.cost : 0;
  return {
    fastShare,
    strongShare,
    blendedCost,
    blendedScore,
    savingsVsStrong,
    monthlyBlendedBill: blendedCost * monthlyTasks,
    monthlyStrongBill: strongRow.cost * monthlyTasks
  };
}

export function zoomedAxisScale(values, {minSpan = 5, padRatio = 0.14, clampMin = 0, clampMax = 100} = {}) {
  const finite = (Array.isArray(values) ? values : []).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!finite.length) {
    return {min: clampMin, max: clampMax, span: Math.max(1, clampMax - clampMin), minVal: null, maxVal: null, leaderGap: null};
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const minVal = sorted[0], maxVal = sorted.at(-1);
  const leaderGap = sorted.length >= 2 ? sorted.at(-1) - sorted.at(-2) : null;
  const effSpan = Math.max(minSpan, maxVal - minVal);
  const totalSpan = Math.min(clampMax - clampMin, effSpan * (1 + padRatio * 2));
  const mid = (minVal + maxVal) / 2;
  let lo = mid - totalSpan / 2, hi = mid + totalSpan / 2;
  if (lo < clampMin) {
    hi = Math.min(clampMax, hi + (clampMin - lo));
    lo = clampMin;
  }
  if (hi > clampMax) {
    lo = Math.max(clampMin, lo - (hi - clampMax));
    hi = clampMax;
  }
  return {min: lo, max: hi, span: Math.max(1e-6, hi - lo), minVal, maxVal, leaderGap};
}

export function zoomedRadarBounds(values) {
  const finite = (Array.isArray(values) ? values : []).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!finite.length) return {scaleMin: 0, scaleMax: 100, innerRatio: 0};
  const sorted = [...finite].sort((a, b) => a - b);
  const maxV = sorted.at(-1);
  const qIdx = Math.floor(sorted.length * 0.18);
  const focusRawMin = sorted.length >= 8 && (sorted[qIdx] - sorted[0]) > 16 ? sorted[qIdx] : sorted[0];
  const scaleMax = Math.min(100, Math.max(25, Math.ceil((maxV + 2) / 5) * 5));
  const pad = Math.max(3, (maxV - focusRawMin) * 0.18);
  const rawFloor = Math.floor((focusRawMin - pad) / 5) * 5;
  const scaleMin = Math.max(0, Math.min(scaleMax - 10, rawFloor));
  if (scaleMin < 15) {
    return {scaleMin: 0, scaleMax: Math.min(100, Math.max(60, Math.ceil(Math.max(40, maxV) / 20) * 20)), innerRatio: 0};
  }
  return {scaleMin, scaleMax, innerRatio: 0.18};
}

export function radarRadiusRatio(val, scaleMin = 0, scaleMax = 100, innerRatio = 0) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  if (scaleMin <= 0 || innerRatio <= 0) return Math.max(0, Math.min(1, val / Math.max(1e-6, scaleMax)));
  if (val >= scaleMin) {
    return innerRatio + (1 - innerRatio) * Math.min(1, (val - scaleMin) / Math.max(1e-6, scaleMax - scaleMin));
  }
  return 0.04 + (innerRatio - 0.04) * Math.max(0, val / scaleMin);
}

export const SCENARIO_PILLARS = Object.freeze([
  Object.freeze({key: 'coding', zh: '工程编程与终端', en: 'Coding & CLI'}),
  Object.freeze({key: 'reasoning', zh: '复杂推理与超长文', en: 'Reasoning & Long-Doc'}),
  Object.freeze({key: 'visual', zh: '视觉审美与多模态', en: 'Visual & Multimodal'}),
  Object.freeze({key: 'vibe', zh: '交流人味与去套话', en: 'Chat Vibe & Anti-Slop'}),
  Object.freeze({key: 'rigor', zh: '专业交付与低幻觉', en: 'Deliverables & Rigor'})
]);

export const SCENARIO_PRESETS = Object.freeze([
  Object.freeze({id: 'default', zh: '官方默认基准', en: 'Official Default', weights: null}),
  Object.freeze({id: 'fullstack', zh: '全栈研发与终端', en: 'Full-Stack & CLI', weights: Object.freeze({coding: 5, reasoning: 3, visual: 2, vibe: 1, rigor: 2})}),
  Object.freeze({id: 'aesthetic', zh: '审美设计与前端', en: 'Design & UI Craft', weights: Object.freeze({coding: 2, reasoning: 1, visual: 5, vibe: 3, rigor: 1})}),
  Object.freeze({id: 'research', zh: '严肃投研与办公', en: 'Research & Docs', weights: Object.freeze({coding: 1, reasoning: 4, visual: 1, vibe: 1, rigor: 5})}),
  Object.freeze({id: 'assistant', zh: '高人味去套话助理', en: 'Natural Chat', weights: Object.freeze({coding: 1, reasoning: 2, visual: 2, vibe: 5, rigor: 2})}),
  Object.freeze({id: 'longvision', zh: '长文档与图文全能', en: 'Long-Doc & Vision', weights: Object.freeze({coding: 1, reasoning: 5, visual: 4, vibe: 1, rigor: 3})})
]);

export const COST_PROFILES = Object.freeze([
  Object.freeze({id: 'benchmark', zh: '成本：基准实测均价', en: 'Cost: Benchmark Avg'}),
  Object.freeze({id: 'chat', zh: '成本：日常轻量问答', en: 'Cost: Light Q&A'}),
  Object.freeze({id: 'longdoc', zh: '成本：长文档重输入', en: 'Cost: Long-Context Input'}),
  Object.freeze({id: 'reasoning', zh: '成本：重度推理攻坚', en: 'Cost: Heavy Reasoning'})
]);

function eloPct(elo, center, scale) {
  return typeof elo === 'number' && Number.isFinite(elo)
    ? 100 / (1 + Math.pow(10, (center - elo) / scale))
    : null;
}

function meanFinite(arr) {
  const valid = arr.filter(v => typeof v === 'number' && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function computeScenarioScore(row, weights) {
  const baseScore = row?._baseIndex ?? row?.intelligenceIndex ?? 0;
  if (!row || !weights || typeof weights !== 'object') return baseScore;
  const wEntries = SCENARIO_PILLARS.map(p => [p.key, Number(weights[p.key]) || 0]).filter(([, w]) => w > 0);
  if (!wEntries.length) return baseScore;

  const sub = row.subscores || {};
  const fr = row.frontierScores || {};
  const hs = row.humanScores || {};
  const dm = row.domainScores || {};
  const exp = row.expertElo || {};
  const pb = row.personality || {};
  const lb = row.livebench || {};
  const fallback = 0.65 * baseScore + 0.35 * 45;

  const daUnified = meanFinite([hs.designWeb, hs.designUi, hs.creativeCraft]);
  const spatialVal = hs.spatialMotion ?? meanFinite([eloPct(exp.aa3d, 1030, 380), eloPct(exp.code2video, 1050, 580)]);
  const aestheticCore = meanFinite([
    daUnified,
    spatialVal,
    lb.design != null ? lb.design * 0.85 : null
  ]);
  // Prevent models missing all aesthetic arenas from winning visual scenarios on MMMU-Pro alone
  const mmmuScaled = sub.mmmuPro != null ? sub.mmmuPro * 0.80 : null;
  const visualVal = aestheticCore !== null && mmmuScaled !== null
    ? 0.72 * aestheticCore + 0.28 * mmmuScaled
    : aestheticCore !== null
      ? aestheticCore
      : mmmuScaled !== null
        ? 0.58 * mmmuScaled + 0.42 * fallback
        : null;

  const antiSlopRaw = hs.antiSlop ?? (pb.slop != null ? Math.max(0, 100 - pb.slop) : null);
  const antiSlopCal = antiSlopRaw !== null ? 12 + 0.75 * antiSlopRaw : null;
  const vibeCore = meanFinite([hs.chatVibe, antiSlopCal]);
  const personalityTone = meanFinite([pb.warmth, pb.expressiveness]);
  const vibeVal = vibeCore !== null && personalityTone !== null
    ? 0.78 * vibeCore + 0.22 * personalityTone
    : vibeCore ?? (personalityTone !== null ? 0.55 * personalityTone + 0.45 * fallback : null);

  const pillarVals = {
    coding: meanFinite([
      sub.frontierCode ?? fr.frontierCode,
      sub.terminalBench ?? fr.terminal4,
      fr.itBenchSre != null ? Math.min(100, fr.itBenchSre * 1.45) : null,
      hs.webdev,
      lb.coding != null ? lb.coding * 0.78 : null,
      lb.longAgentic != null ? lb.longAgentic * 0.82 : null
    ]),
    reasoning: meanFinite([
      sub.hleDiamond ?? fr.hleDiamond,
      sub.critptAgentic ?? fr.critptAgent,
      sub.science ?? fr.science,
      (sub.mlcr ?? fr.mlcr) != null ? Math.min(100, (sub.mlcr ?? fr.mlcr) * 1.8) : null,
      fr.automation,
      lb.reasoning != null ? lb.reasoning * 0.78 : null
    ]),
    visual: visualVal,
    vibe: vibeVal,
    rigor: meanFinite([
      fr.gdpPdf != null ? Math.min(100, fr.gdpPdf * 2.1) : null,
      hs.deliverable ?? meanFinite([eloPct(exp.gdpval, 1580, 390), eloPct(exp.briefcase, 1500, 420)]),
      sub.omniscience,
      sub.hallucination != null ? Math.max(0, 100 - sub.hallucination) : null,
      meanFinite([dm.finance, dm.legal, dm.healthcare, dm.strategy]),
      lb.research != null ? lb.research * 0.78 : null
    ])
  };

  let weightedSum = 0, totalW = 0;
  for (const [k, w] of wEntries) {
    const val = pillarVals[k] ?? fallback;
    weightedSum += w * val;
    totalW += w;
  }
  return Number(Math.max(0, Math.min(100, weightedSum / totalW)).toFixed(4));
}

export function simulateWorkloadCost(row, profileId = 'benchmark') {
  const baseCost = row?._baseCost ?? row?.cost ?? 0;
  if (!row || !profileId || profileId === 'benchmark') return baseCost;
  const cb = row.costBreakdown;
  if (cb && Number.isFinite(cb.input)) {
    const inp = Math.max(0, cb.input || 0);
    const rsn = Math.max(0, cb.reasoning || 0);
    const ans = Math.max(0, cb.answer || 0);
    const hasGranularCache = Number.isFinite(cb.nonCacheInput) && (cb.cacheRead != null || cb.cacheWrite != null);
    if (profileId === 'chat') {
      const freshIn = hasGranularCache ? Math.max(0, cb.nonCacheInput) * 1.2 : inp * 0.15;
      return Number(Math.max(0.0001, freshIn + rsn * 0.12 + ans * 0.45).toFixed(6));
    }
    if (profileId === 'longdoc') {
      const docIn = hasGranularCache
        ? Math.max(0, cb.nonCacheInput) * 6.0 + Math.max(0, cb.cacheRead || 0) * 1.6 + Math.max(0, cb.cacheWrite || 0) * 1.4
        : inp * 2.20;
      return Number(Math.max(0.0001, docIn + rsn * 0.25 + ans * 0.40).toFixed(6));
    }
    if (profileId === 'reasoning') {
      return Number(Math.max(0.0001, inp * 1.15 + rsn * 1.75 + ans * 1.05).toFixed(6));
    }
  }
  const pct = row.costPercentiles;
  if (pct && Number.isFinite(pct.p50) && pct.p50 > 0) {
    if (profileId === 'chat') return Number(Math.max(0.0001, pct.p25 || pct.p50 * 0.6).toFixed(6));
    if (profileId === 'longdoc') return Number(Math.max(0.0001, pct.p50).toFixed(6));
    if (profileId === 'reasoning') return Number(Math.max(0.0001, pct.p75 || pct.p95 || baseCost * 1.35).toFixed(6));
  }
  return baseCost;
}

export function sortRows(rows, key, direction = 'asc', weight = VALUE_WEIGHT.default, minScore = MIN_SCORE.default, maxCost = 0) {
  validateValueWeight(weight);
  validateMinScore(minScore);
  validateMaxCost(maxCost);
  if (!['name', 'creator', 'intelligenceIndex', 'cost', 'timeSec', 'valuePerDollar'].includes(key)) throw new RangeError(`Unknown table sort key: ${key}`);
  if (direction !== 'asc' && direction !== 'desc') throw new RangeError(`Unknown table sort direction: ${direction}`);
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let primary;
    if (key === 'valuePerDollar') {
      const aValue = valuePerDollar(a, weight, minScore, maxCost), bValue = valuePerDollar(b, weight, minScore, maxCost);
      // Disqualified or missing ratios are not infinite bargains; keep them last in either direction.
      if ((aValue === null) !== (bValue === null)) return aValue === null ? 1 : -1;
      primary = aValue === null ? 0 : aValue - bValue;
    } else if (key === 'timeSec') {
      const aTime = typeof a.timeSec === 'number' && Number.isFinite(a.timeSec) && a.timeSec > 0 ? a.timeSec : null;
      const bTime = typeof b.timeSec === 'number' && Number.isFinite(b.timeSec) && b.timeSec > 0 ? b.timeSec : null;
      if ((aTime === null) !== (bTime === null)) return aTime === null ? 1 : -1;
      primary = aTime === null ? 0 : aTime - bTime;
    } else {
      primary = key === 'cost' || key === 'intelligenceIndex'
        ? a[key] - b[key]
        : tableCollator.compare(key === 'creator' ? a.creator?.name || 'Other' : a.name, key === 'creator' ? b.creator?.name || 'Other' : b.name);
    }
    const byName = tableCollator.compare(a.name, b.name);
    const aId = String(a.id), bId = String(b.id);
    // Tie ordering stays ascending when the primary direction is reversed.
    return primary * sign || byName || (aId < bId ? -1 : aId > bId ? 1 : 0);
  });
}
