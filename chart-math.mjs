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

export function paretoFrontier(rows) {
  let best = -Infinity;
  return [...rows].sort((a, b) => a.cost - b.cost || b.intelligenceIndex - a.intelligenceIndex).filter(row => {
    if (row.intelligenceIndex <= best) return false;
    best = row.intelligenceIndex;
    return true;
  });
}

export function dataBounds(rows) {
  const maxX = Math.max(1, ...rows.map(d => d.cost)), maxY = Math.max(1, ...rows.map(d => d.intelligenceIndex));
  const minY = Math.min(0, ...rows.map(d => d.intelligenceIndex));
  const y = minY < 0 ? Math.floor(minY / 5) * 5 - 2 : 0;
  return {x: 0, y, width: maxX * 1.08, height: Math.ceil(maxY / 5) * 5 - y};
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

export function valuePerDollar(row, weight = VALUE_WEIGHT.default, minScore = MIN_SCORE.default) {
  validateValueWeight(weight);
  validateMinScore(minScore);
  const score = row?.intelligenceIndex, cost = row?.cost;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) return null;
  if (minScore > 0 && score < minScore) return null;
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

export function sortRows(rows, key, direction = 'asc', weight = VALUE_WEIGHT.default, minScore = MIN_SCORE.default) {
  validateValueWeight(weight);
  validateMinScore(minScore);
  if (!['name', 'creator', 'intelligenceIndex', 'cost', 'valuePerDollar'].includes(key)) throw new RangeError(`Unknown table sort key: ${key}`);
  if (direction !== 'asc' && direction !== 'desc') throw new RangeError(`Unknown table sort direction: ${direction}`);
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let primary;
    if (key === 'valuePerDollar') {
      const aValue = valuePerDollar(a, weight, minScore), bValue = valuePerDollar(b, weight, minScore);
      // Disqualified or missing ratios are not infinite bargains; keep them last in either direction.
      if ((aValue === null) !== (bValue === null)) return aValue === null ? 1 : -1;
      primary = aValue === null ? 0 : aValue - bValue;
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
