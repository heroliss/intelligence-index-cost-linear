import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  dataBounds,
  effortTrajectories,
  historicalFrontierSummary,
  cascadingRouteSummary,
  clampView,
  pointerZoomView,
  paretoFrontier,
  ticks,
  validRows,
  sortRows,
  valuePerDollar,
  capabilityUtility,
  isoValueCost,
  breakEvenTasks,
  monthlyApiBill,
  subscriptionVerdict,
  zoomedAxisScale,
  zoomedRadarBounds,
  radarRadiusRatio,
  SCENARIO_PILLARS,
  SCENARIO_PRESETS,
  COST_PROFILES,
  computeScenarioScore,
  simulateWorkloadCost,
  VALUE_WEIGHT,
  MIN_SCORE,
  MAX_COST_PRESETS,
  VALUE_PRESETS,
  SUBSCRIPTION_TIERS,
  MONTHLY_USAGE
} from '../chart-math.mjs';

const row = (id, cost, intelligenceIndex) => ({id, name: id, cost, intelligenceIndex});

test('full data bounds include current high scores above the old 60-point ceiling', () => {
  const rows = [row('low', 0.005, 3.8), row('high', 26.54, 64.5636)];
  const bounds = dataBounds(rows);
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 0);
  assert.equal(bounds.y + bounds.height, 65);
  for (const item of rows) {
    assert.ok(item.cost < bounds.x + bounds.width);
    assert.ok(item.intelligenceIndex < bounds.y + bounds.height);
  }
});

test('coding-agent view ends near its highest point instead of adding another band', () => {
  const bounds = dataBounds([row('lower', 0.2, 25), row('highest', 44.2, 58.4719)]);
  assert.equal(bounds.y + bounds.height, 60);
});

test('a highest score exactly on 65 remains included on the upper boundary', () => {
  const highest = row('highest', 2, 65), bounds = dataBounds([row('lower', 1, 20), highest]);
  assert.equal(bounds.y + bounds.height, 65);
  assert.ok(highest.intelligenceIndex <= bounds.y + bounds.height);
  assert.deepEqual(clampView(bounds, bounds), bounds);
});

test('a score just beyond 65 automatically expands the upper boundary to 70', () => {
  const bounds = dataBounds([row('highest', 2, 65.01)]);
  assert.equal(bounds.y + bounds.height, 70);
  assert.ok(65.01 < bounds.y + bounds.height);
});

test('cost bounds remain in linear USD units across different cost ranges', () => {
  const first = dataBounds([row('a', 10, 50)]);
  const second = dataBounds([row('b', 20, 50)]);
  const subDollar = dataBounds([row('img', 0.2, 85)]);
  assert.equal(first.x, 0);
  assert.equal(second.x, 0);
  assert.equal(second.width, first.width * 2);
  assert.equal(first.height, second.height);
  assert.ok(Math.abs(subDollar.width - 0.2 * 1.08) < 1e-12, 'sub-dollar arenas fit tightly instead of padding to $1.08');
  assert.equal(dataBounds([row('free', 0, 50)]).width, 1.08, 'pure-zero cost fallback stays non-degenerate');
});

test('bounds cover negative scores and zero-cost rows without a degenerate axis', () => {
  const bounds = dataBounds([row('zero', 0, 0), row('negative', 0.1, -7.5)]);
  assert.ok(bounds.y < -7.5);
  assert.ok(bounds.y + bounds.height > 0);
  assert.ok(bounds.width > 0);
  assert.ok(bounds.height > 0);
});

test('clamp keeps a zoomed viewport inside data bounds at both pan extremes', () => {
  const bounds = {x: 0, y: -10, width: 100, height: 80};
  const left = clampView({x: -1000, y: -1000, width: 20, height: 30}, bounds);
  const right = clampView({x: 1000, y: 1000, width: 20, height: 30}, bounds);
  assert.deepEqual(left, {x: 0, y: -10, width: 20, height: 30});
  assert.deepEqual(right, {x: 80, y: 40, width: 20, height: 30});
});

test('clamp prevents zero-size zooms and unbounded zoom-out', () => {
  const bounds = {x: 0, y: 0, width: 100, height: 80};
  const small = clampView({x: 0, y: 0, width: 0, height: -1}, bounds);
  const large = clampView({x: -1, y: -1, width: Infinity, height: Infinity}, bounds);
  assert.ok(Number.isFinite(small.width) && small.width > 0);
  assert.ok(Number.isFinite(small.height) && small.height > 0);
  assert.ok(Number.isFinite(large.width) && large.width >= bounds.width && large.width < bounds.width * 2);
  assert.ok(Number.isFinite(large.height) && large.height >= bounds.height && large.height < bounds.height * 2);
  assert.equal(large.x, 0);
  assert.equal(large.y, 0);
});

test('pointerZoomView keeps the anchored data coordinate fixed under the cursor', () => {
  const bounds = {x: 0, y: 0, width: 100, height: 80};
  const view = {x: 10, y: 10, width: 40, height: 40};
  // Anchor at 75% across X (dataX = 10 + 0.75 * 40 = 40) and 25% up Y (dataY = 10 + 0.25 * 40 = 20)
  const zoomedX = pointerZoomView(view, bounds, 'x', 0.5, 0.75);
  assert.ok(Math.abs((zoomedX.x + 0.75 * zoomedX.width) - 40) < 1e-12);
  const zoomedXY = pointerZoomView(view, bounds, 'xy', 0.5, 0.75, 0.25);
  assert.ok(Math.abs((zoomedXY.x + 0.75 * zoomedXY.width) - 40) < 1e-12);
  assert.ok(Math.abs((zoomedXY.y + 0.25 * zoomedXY.height) - 20) < 1e-12);
});

test('same-price Pareto candidates retain the highest score regardless of source order', () => {
  const cheap = row('cheap', 0.5, 20);
  const inferior = row('inferior', 1, 25);
  const superior = row('superior', 1, 40);
  const expensive = row('expensive', 2, 50);
  assert.deepEqual(paretoFrontier([cheap, inferior, superior, expensive]).map(d => d.id), ['cheap', 'superior', 'expensive']);
  assert.deepEqual(paretoFrontier([expensive, superior, inferior, cheap]).map(d => d.id), ['cheap', 'superior', 'expensive']);
});

test('Pareto includes free options, rejects dominated scores, and does not mutate input', () => {
  const rows = Object.freeze([
    Object.freeze(row('costly-tie', 3, 30)),
    Object.freeze(row('best-free', 0, 20)),
    Object.freeze(row('cheap-improvement', 1, 30)),
    Object.freeze(row('weaker-free', 0, 10)),
    Object.freeze(row('dominated', 2, 25)),
    Object.freeze(row('higher', 4, 50)),
  ]);
  const before = structuredClone(rows);
  assert.deepEqual(paretoFrontier(rows).map(d => d.id), ['best-free', 'cheap-improvement', 'higher']);
  assert.deepEqual(rows, before);
});

test('ticks adapt to a decimal-cost zoom instead of retaining integer-only labels', () => {
  const values = ticks(0, 0.4, 8);
  assert.ok(values.length >= 4 && values.length <= 12);
  assert.equal(values[0], 0);
  assert.ok(values.some(value => value > 0 && value < 1));
  const step = values[1] - values[0];
  for (let i = 0; i < values.length; i++) {
    assert.ok(values[i] >= 0 && values[i] <= 0.4 + 1e-10);
    if (i) assert.ok(Math.abs(values[i] - values[i - 1] - step) < 1e-10);
  }
});

test('ticks remain aligned and evenly spaced after panning a decimal viewport', () => {
  const values = ticks(1.13, 1.37, 6);
  assert.ok(values.length >= 3);
  for (let i = 0; i < values.length; i++) {
    assert.ok(values[i] >= 1.13 && values[i] <= 1.37);
    assert.ok(Number.isFinite(values[i]));
    if (i > 1) assert.ok(Math.abs((values[i] - values[i - 1]) - (values[1] - values[0])) < 1e-10);
  }
});

test('validRows accepts a true zero cost and rejects malformed or duplicated rows', () => {
  const valid = [row('zero', 0, 0), row('negative-score', 0.5, -2)];
  assert.equal(validRows(valid), valid);
  for (const invalid of [[], null, [row('bad', -1, 10)], [row('bad', 1, NaN)], [row('bad', Infinity, 10)], [row('same', 1, 10), row('same', 2, 20)], [{...row('blank', 1, 10), name: ' '}]] ) {
    assert.throws(() => validRows(invalid));
  }
});

test('all shipped datasets pass validation and fit inside their full-data view', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  const suites = [['models', snapshot.models], ['codingAgents', snapshot.codingAgents]];
  if (snapshot.frontierModels?.length) suites.push(['frontierModels', snapshot.frontierModels]);
  if (snapshot.humanArenaModels?.length) suites.push(['humanArenaModels', snapshot.humanArenaModels]);
  if (snapshot.cyberModels?.length) suites.push(['cyberModels', snapshot.cyberModels]);
  if (snapshot.mediaModels?.length) suites.push(['mediaModels', snapshot.mediaModels]);
  for (const [name, rows] of suites) {
    validRows(rows);
    const bounds = dataBounds(rows);
    const highest = Math.max(...rows.map(item => item.intelligenceIndex));
    const top = bounds.y + bounds.height;
    assert.equal(top % 5, 0, `${name}: upper boundary should be a readable multiple of five`);
    assert.ok(top >= highest && top - highest < 5, `${name}: excess top range should remain below five points`);
    for (const item of rows) {
      assert.ok(item.cost >= bounds.x && item.cost <= bounds.x + bounds.width, `${name}: ${item.name} cost outside bounds`);
      assert.ok(item.intelligenceIndex >= bounds.y && item.intelligenceIndex <= bounds.y + bounds.height, `${name}: ${item.name} score outside bounds`);
    }
  }
});

test('table cost, index, and timeSec sorts compare actual numbers and keep missing latencies last', () => {
  const rows = [
    {...row('ten', 10, 9), timeSec: 120},
    {...row('two', 2, 100), timeSec: 15.5},
    {...row('fraction', 0.1, 10), timeSec: null},
    {...row('zero', 0, 0), timeSec: 0}
  ];
  assert.deepEqual(sortRows(rows, 'cost').map(d => d.cost), [0, 0.1, 2, 10]);
  assert.deepEqual(sortRows(rows, 'cost', 'desc').map(d => d.cost), [10, 2, 0.1, 0]);
  assert.deepEqual(sortRows(rows, 'intelligenceIndex').map(d => d.intelligenceIndex), [0, 9, 10, 100]);
  assert.deepEqual(sortRows(rows, 'intelligenceIndex', 'desc').map(d => d.intelligenceIndex), [100, 10, 9, 0]);
  assert.deepEqual(sortRows(rows, 'timeSec', 'asc').map(d => d.id), ['two', 'ten', 'fraction', 'zero']);
  assert.deepEqual(sortRows(rows, 'timeSec', 'desc').map(d => d.id), ['ten', 'two', 'fraction', 'zero']);
});

test('weight 1 exactly preserves the original index divided by actual per-task cost', () => {
  assert.equal(valuePerDollar(row('fractional-price', 0.5, 53.5), 1), 107);
  assert.equal(valuePerDollar(row('ordinary', 2, 40), 1), 20);
  assert.equal(valuePerDollar(row('zero-score', 0.5, 0), 1), 0);
  assert.ok(Math.abs(valuePerDollar(row('very-small-cost', 1e-300, 1), 1) / 1e300 - 1) < 1e-14);
  for (const [score, cost] of [[64.563595756626, 26.53855780398091], [9.66610812336462, 0.005115255188520391], [1e-200, 1e100]]) {
    assert.equal(valuePerDollar(row('exact', cost, score), 1), score / cost);
  }
});

test('weight 0 ranks purely by lowest per-task cost for positive-score entries', () => {
  const rows = [row('expensive-smart', 5, 64), row('cheap-modest', 0.05, 12), row('mid', 0.5, 45)];
  assert.equal(capabilityUtility(12, 0), 50);
  assert.equal(capabilityUtility(64, 0), 50);
  assert.equal(capabilityUtility(0, 0), 0);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 0).map(d => d.id), ['cheap-modest', 'mid', 'expensive-smart']);
});

test('weight configuration and presets are frozen and cover [0, 25] with anchor 50', () => {
  assert.deepEqual(VALUE_WEIGHT, {min: 0, max: 25, step: 0.1, default: 3, anchor: 50, ceiling: 105});
  assert.deepEqual(MIN_SCORE, {min: 0, max: 95, step: 1, default: 0});
  assert.ok(Object.isFrozen(VALUE_WEIGHT));
  assert.ok(Object.isFrozen(MIN_SCORE));
  assert.ok(Object.isFrozen(VALUE_PRESETS) && VALUE_PRESETS.length >= 5);
  assert.throws(() => { VALUE_WEIGHT.default = 1; }, TypeError);
  assert.equal(valuePerDollar(row('anchor', 2, 50), 3), 25);
});

test('IRT pass-odds hybrid curve is C1-smooth across weight = 1 and anchored at 50', () => {
  for (const score of [15, 30, 45, 50, 62, 80]) {
    assert.equal(capabilityUtility(50, 0.5), 50);
    assert.equal(capabilityUtility(50, 3), 50);
    assert.equal(capabilityUtility(50, 25), 50);
    const leftSlope = (capabilityUtility(score, 1) - capabilityUtility(score, 1 - 1e-5)) / 1e-5;
    const rightSlope = (capabilityUtility(score, 1 + 1e-5) - capabilityUtility(score, 1)) / 1e-5;
    assert.ok(Math.abs(leftSlope - rightSlope) < 1e-3, `C1 slope continuity at weight=1 for score=${score}`);
  }
});

test('relative preference for higher scores increases strictly across all 251 weights in [0, 25]', () => {
  const weights = Array.from({length: 251}, (_, i) => Number((i * 0.1).toFixed(1)));
  let prevRatio = 0;
  for (const weight of weights) {
    assert.equal(capabilityUtility(0, weight), 0);
    assert.equal(Object.is(capabilityUtility(-0, weight), -0), false);
    assert.equal(capabilityUtility(50, weight), 50);
    if (weight > 0) {
      let prev = 0;
      for (let score = 1; score <= 100; score++) {
        const u = capabilityUtility(score, weight);
        assert.ok(Number.isFinite(u) && u > prev, `monotonic score at weight=${weight}, score=${score}`);
        assert.ok(Math.abs(valuePerDollar(row('agree', 1, score), weight) - u) <= u * 1e-13);
        prev = u;
      }
    }
    const ratio = capabilityUtility(62, weight) / capabilityUtility(45, weight);
    assert.ok(ratio > prevRatio, `ratio 62/45 strictly increases at weight=${weight}`);
    prevRatio = ratio;
  }
});

test('expanded curve range traverses all capability tiers and preserves Pareto monotonicity on live data', async () => {
  // Deterministic 4-tier fixture covering ultra-budget through 10x-cost SOTA
  const tiers = [
    row('budget', 0.005, 10),
    row('mainstream', 0.4, 52),
    row('flagship', 2.5, 61.5),
    row('sota', 26.5, 64.5)
  ];
  assert.equal(sortRows(tiers, 'valuePerDollar', 'desc', 0)[0].id, 'budget');
  assert.equal(sortRows(tiers, 'valuePerDollar', 'desc', 3)[0].id, 'mainstream');
  assert.equal(sortRows(tiers, 'valuePerDollar', 'desc', 10)[0].id, 'flagship');
  assert.equal(sortRows(tiers, 'valuePerDollar', 'desc', 22)[0].id, 'sota');

  // Structural invariants that hold across any valid live snapshot update
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  const liveSuites = [
    snapshot.models,
    snapshot.codingAgents,
    ...(snapshot.frontierModels?.length ? [snapshot.frontierModels] : []),
    ...(snapshot.humanArenaModels?.length ? [snapshot.humanArenaModels] : []),
    ...(snapshot.cyberModels?.length ? [snapshot.cyberModels] : [])
  ];
  for (const rows of liveSuites) {
    const frontierIds = new Set(paretoFrontier(rows).map(r => r.id));
    const minCost = Math.min(...rows.map(r => r.cost));
    const leader0 = sortRows(rows, 'valuePerDollar', 'desc', 0)[0];
    assert.equal(leader0.cost, minCost, 'w=0 always selects a minimum-cost entry');
    let prevScore = -Infinity, prevCost = -Infinity;
    for (let i = 0; i <= 250; i += 5) {
      const w = Number((i * 0.1).toFixed(1));
      const leader = sortRows(rows, 'valuePerDollar', 'desc', w)[0];
      assert.ok(frontierIds.has(leader.id), `leader at w=${w} must lie on the Pareto frontier`);
      assert.ok(leader.intelligenceIndex >= prevScore - 1e-12, `leader score must not decrease with w (${w})`);
      assert.ok(leader.cost >= prevCost - 1e-12, `leader cost must not decrease with w (${w})`);
      prevScore = leader.intelligenceIndex;
      prevCost = leader.cost;
    }
    assert.ok(prevScore > leader0.intelligenceIndex, 'high weights reach strictly stronger Pareto entries');
  }
});

test('minimum score threshold and maximum cost budget cap disqualify out-of-range entries and place them last', () => {
  const rows = [
    row('cheap-toy', 0.005, 10),
    row('qualified-good', 0.8, 52),
    row('qualified-pricey', 5, 60)
  ];
  assert.equal(valuePerDollar(rows[0], 1, 45), null);
  assert.ok(valuePerDollar(rows[1], 1, 45) > 0);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 1, 45).map(d => d.id), ['qualified-good', 'qualified-pricey', 'cheap-toy']);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'asc', 1, 45).map(d => d.id), ['qualified-pricey', 'qualified-good', 'cheap-toy']);

  assert.ok(Object.isFrozen(MAX_COST_PRESETS) && MAX_COST_PRESETS[0] === 0 && MAX_COST_PRESETS.includes(1));
  assert.equal(valuePerDollar(rows[2], 3, 0, 1), null, 'cost 5 > maxCost 1 should be disqualified');
  assert.ok(valuePerDollar(rows[1], 3, 0, 1) > 0, 'cost 0.8 <= maxCost 1 remains qualified');
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 20, 45, 1).map(d => d.id), ['qualified-good', 'cheap-toy', 'qualified-pricey']);
  for (const badMaxCost of [-0.01, -1, NaN, Infinity, '1', null]) {
    assert.throws(() => valuePerDollar(rows[1], 3, 0, badMaxCost), RangeError);
    assert.throws(() => sortRows(rows, 'valuePerDollar', 'desc', 3, 0, badMaxCost), RangeError);
  }
});

test('isoValueCost passes exactly through the champion point and bounds all other entries', () => {
  const champ = row('champ', 0.75, 52);
  const val = valuePerDollar(champ, 4);
  const tangentCost = isoValueCost(52, val, 4);
  assert.ok(Math.abs(tangentCost - 0.75) < 1e-12);
  assert.equal(isoValueCost(50, 0, 4), null);
  assert.equal(isoValueCost(-1, val, 4), null);
});

test('subscription break-even and monthly API bill calculations remain exact and reject bad inputs', () => {
  assert.ok(Object.isFrozen(SUBSCRIPTION_TIERS) && SUBSCRIPTION_TIERS.length === 3);
  assert.ok(Object.isFrozen(MONTHLY_USAGE));
  assert.equal(breakEvenTasks(0.5, 20), 40);
  assert.equal(breakEvenTasks(8, 200), 25);
  assert.equal(breakEvenTasks(0, 20), null);
  assert.equal(breakEvenTasks(-1, 20), null);
  assert.throws(() => breakEvenTasks(1, 0), RangeError);
  assert.throws(() => breakEvenTasks(1, -20), RangeError);

  assert.equal(monthlyApiBill(0.5, 60), 30);
  assert.equal(monthlyApiBill(0.5, 0), 0);
  assert.equal(monthlyApiBill(-1, 10), null);
  assert.throws(() => monthlyApiBill(1, -5), RangeError);

  const apiWins = subscriptionVerdict(0.1, 60, 20);
  assert.equal(apiWins.status, 'api-cheaper');
  assert.equal(apiWins.apiBill, 6);
  assert.equal(apiWins.delta, -14);

  const subWins = subscriptionVerdict(2.5, 60, 100);
  assert.equal(subWins.status, 'sub-cheaper');
  assert.equal(subWins.apiBill, 150);
  assert.equal(subWins.breakeven, 40);

  const even = subscriptionVerdict(1, 20, 20);
  assert.equal(even.status, 'near-breakeven');
});

test('invalid weights or minScores throw RangeError across math helpers', () => {
  for (const weight of [NaN, Infinity, -Infinity, -0.1, 25.001, -1, null, '3', {}, true]) {
    assert.throws(() => capabilityUtility(50, weight), RangeError);
    assert.throws(() => valuePerDollar(row('valid', 1, 50), weight), RangeError);
    assert.throws(() => sortRows([], 'valuePerDollar', 'asc', weight), RangeError);
  }
  for (const badMin of [NaN, -1, 96, Infinity, '10', null]) {
    assert.throws(() => valuePerDollar(row('valid', 1, 50), 3, badMin), RangeError);
    assert.throws(() => sortRows([], 'cost', 'asc', 3, badMin), RangeError);
  }
});

test('capability utility and valuePerDollar reject malformed scores and overflow safely', () => {
  for (const score of [null, undefined, NaN, Infinity, -Infinity, -1, '50', {}]) {
    assert.equal(capabilityUtility(score), null);
  }
  assert.equal(capabilityUtility(Number.MAX_VALUE, 15), null);
  for (const invalid of [null, undefined, {}, row('zero-cost', 0, 20), row('neg-cost', -1, 20), row('nan-score', 1, NaN), row('overflow', Number.MIN_VALUE, 50)]) {
    assert.equal(valuePerDollar(invalid, 3), null);
  }
});

test('table names, creators, ties, and immutability hold across sorts', () => {
  const rows = Object.freeze([
    Object.freeze({...row('b', 2, 40), name: 'Model 2', creator: {name: 'Company 10'}}),
    Object.freeze({...row('c', 2, 40), name: 'Model 10', creator: {name: 'Company 2'}}),
    Object.freeze({...row('a', 2, 40), name: 'Model 2', creator: {name: 'Anthropic'}}),
  ]);
  const before = structuredClone(rows);
  for (const direction of ['asc', 'desc']) {
    assert.deepEqual(sortRows(rows, 'cost', direction).map(d => d.id), ['a', 'b', 'c']);
    assert.deepEqual(sortRows(rows, 'valuePerDollar', direction).map(d => d.id), ['a', 'b', 'c']);
  }
  assert.deepEqual(sortRows(rows, 'creator', 'asc').map(d => d.id), ['a', 'c', 'b']);
  assert.deepEqual(rows, before);
});

test('custom xOf accessor supports speed-intelligence Pareto frontier, time bounds, and effort trajectories', async () => {
  const entries = [
    {id: 'm-low', name: 'M (low)', cost: 0.3, timeSec: 60, intelligenceIndex: 44, family: {slug: 'm', name: 'M'}, effort: {slug: 'low', label: 'low', level: 1}},
    {id: 'm-high', name: 'M (high)', cost: 1.5, timeSec: 240, intelligenceIndex: 58, family: {slug: 'm', name: 'M'}, effort: {slug: 'high', label: 'high', level: 3}},
    {id: 'm-med', name: 'M (med)', cost: 0.7, timeSec: 120, intelligenceIndex: 53, family: {slug: 'm', name: 'M'}, effort: {slug: 'med', label: 'med', level: 2}},
    {id: 'solo', name: 'Solo', cost: 0.5, timeSec: 90, intelligenceIndex: 55, family: {slug: 's', name: 'S'}, effort: {slug: 'high', label: 'high', level: 3}},
    {id: 'no-time', name: 'Legacy', cost: 0.1, timeSec: null, intelligenceIndex: 60, family: {slug: 'm', name: 'M'}, effort: {slug: 'max', label: 'max', level: 4}}
  ];
  const timeMin = d => (typeof d.timeSec === 'number' && d.timeSec > 0 ? d.timeSec / 60 : NaN);
  assert.deepEqual(paretoFrontier(entries, timeMin).map(d => d.id), ['m-low', 'solo', 'm-high']);
  const bounds = dataBounds(entries, timeMin);
  assert.equal(bounds.x, 0);
  assert.ok(Math.abs(bounds.width - 4 * 1.08) < 1e-12);

  const trajs = effortTrajectories(entries, timeMin);
  assert.equal(trajs.length, 1);
  assert.equal(trajs[0].slug, 'm');
  assert.deepEqual(trajs[0].points.map(p => p.id), ['m-low', 'm-med', 'm-high']);

  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  assert.ok(effortTrajectories(snapshot.models).length >= 5, 'live models include multi-effort trajectories');
  assert.ok(effortTrajectories(snapshot.codingAgents).length >= 3, 'live coding agents include multi-effort trajectories');
});

test('historicalFrontierSummary and cascadingRouteSummary compute exact AI cost deflation and blended routing', () => {
  const historyRows = [
    {id: 'old-mid', name: 'Old Mid', cost: 2.0, intelligenceIndex: 51, releaseDate: '2025-10-01'},
    {id: 'old-budget', name: 'Old Budget', cost: 0.4, intelligenceIndex: 38, releaseDate: '2025-11-01'},
    {id: 'new-fast', name: 'New Fast', cost: 0.2, intelligenceIndex: 53, releaseDate: '2026-08-01'},
    {id: 'new-sota', name: 'New SOTA', cost: 10.0, intelligenceIndex: 63, releaseDate: '2026-10-01'}
  ];
  const hist = historicalFrontierSummary(historyRows, '2025-12-31');
  assert.equal(hist.pastCount, 2);
  assert.equal(hist.totalCount, 4);
  assert.equal(hist.milestone, 50);
  assert.equal(hist.pastMinCost, 2.0);
  assert.equal(hist.currentMinCost, 0.2);
  assert.equal(hist.deflationFactor, 10);
  assert.deepEqual(hist.pastFrontier.map(r => r.id), ['old-budget', 'old-mid']);
  assert.equal(historicalFrontierSummary(historyRows, '2024-01-01').pastCount, 0);

  const route = cascadingRouteSummary(historyRows[2], historyRows[3], 0.8, 100);
  assert.ok(Math.abs(route.blendedCost - 2.16) < 1e-12);
  assert.ok(Math.abs(route.monthlyBlendedBill - 216) < 1e-9);
  assert.ok(Math.abs(route.savingsVsStrong - 0.784) < 1e-12);
  assert.throws(() => cascadingRouteSummary(historyRows[2], historyRows[3], 1.2, 60), RangeError);
});

test('zoomedAxisScale, zoomedRadarBounds, and radarRadiusRatio magnify subtle frontier gaps while staying monotonic', () => {
  const closeFrontier = [75.9, 76.4, 79.2, 81.6];
  const ax = zoomedAxisScale(closeFrontier);
  assert.equal(ax.minVal, 75.9);
  assert.equal(ax.maxVal, 81.6);
  assert.ok(Math.abs(ax.leaderGap - 2.4) < 1e-9);
  assert.ok(ax.min > 70 && ax.max < 86 && ax.span < 12, 'magnifies 5.7% frontier spread by ~9x vs 0-100');

  const nearTie = zoomedAxisScale([80.1, 80.2], {minSpan: 5, padRatio: 0.14});
  assert.ok(nearTie.span >= 5, 'enforces minSpan so 0.1% noise is not over-amplified');

  const highEdge = zoomedAxisScale([97.5, 99.4]);
  assert.equal(highEdge.max, 100);
  assert.ok(highEdge.min < 94, 'preserves window width when clamped against 100 ceiling');

  // Outlier-resistant radar zoom: 1 low-tier model (20%) mixed with 18 frontier scores (72%-85%)
  const mixedCluster = [20, ...Array.from({length: 18}, (_, i) => 72 + (i % 7) * 2)];
  const zb = zoomedRadarBounds(mixedCluster);
  assert.ok(zb.scaleMin >= 60 && zb.scaleMax <= 95 && zb.innerRatio === 0.18);
  let prevR = -1;
  for (const s of [0, 20, zb.scaleMin, 75, 80, zb.scaleMax]) {
    const r = radarRadiusRatio(s, zb.scaleMin, zb.scaleMax, zb.innerRatio);
    assert.ok(r > prevR && r <= 1, `monotonic radius ratio at ${s}: ${r}`);
    prevR = r;
  }
  const fullSpanDiff = (79.2 - 75.9) / 100;
  const zoomedDiff = radarRadiusRatio(79.2, zb.scaleMin, zb.scaleMax, zb.innerRatio) - radarRadiusRatio(75.9, zb.scaleMin, zb.scaleMax, zb.innerRatio);
  assert.ok(zoomedDiff > fullSpanDiff * 2.2, 'zoomed radar expands radial separation >2.2x');
});

test('computeScenarioScore and simulateWorkloadCost re-rank models by custom workflow weights and cost profiles', () => {
  assert.equal(SCENARIO_PILLARS.length, 5);
  assert.ok(SCENARIO_PRESETS.length >= 6 && COST_PROFILES.length >= 4);

  const coder = {
    id: 'coder', _baseIndex: 56, intelligenceIndex: 56, _baseCost: 5, cost: 5,
    subscores: {frontierCode: 62, terminalBench: 70, mmmuPro: 65, omniscience: 60, hallucination: 45},
    humanScores: {designWeb: 58, chatVibe: 62},
    costBreakdown: {input: 0.4, reasoning: 4.1, answer: 0.5}
  };
  const designer = {
    id: 'designer', _baseIndex: 54, intelligenceIndex: 54, _baseCost: 5, cost: 5,
    subscores: {frontierCode: 38, terminalBench: 42, mmmuPro: 89, omniscience: 64, hallucination: 30},
    humanScores: {designWeb: 84, designUi: 82, creativeCraft: 80, chatVibe: 83, antiSlop: 82},
    costBreakdown: {input: 3.6, reasoning: 0.5, answer: 0.9}
  };

  const fullstackW = SCENARIO_PRESETS.find(p => p.id === 'fullstack').weights;
  const aestheticW = SCENARIO_PRESETS.find(p => p.id === 'aesthetic').weights;
  assert.ok(computeScenarioScore(coder, fullstackW) > computeScenarioScore(designer, fullstackW), 'fullstack preset favors coding specialist');
  assert.ok(computeScenarioScore(designer, aestheticW) > computeScenarioScore(coder, aestheticW), 'aesthetic preset favors design/vibe specialist');
  const mmmuOnlySibling = {
    id: 'mmmu-only', _baseIndex: 54, intelligenceIndex: 54, _baseCost: 3, cost: 3,
    subscores: {frontierCode: 38, terminalBench: 42, mmmuPro: 90, omniscience: 64, hallucination: 30}
  };
  assert.ok(computeScenarioScore(designer, aestheticW) > computeScenarioScore(mmmuOnlySibling, aestheticW), 'missing Design Arena does not let MMMU-Pro alone beat tested aesthetic leaders');
  assert.equal(computeScenarioScore(coder, null), 56);

  assert.equal(simulateWorkloadCost(coder, 'benchmark'), 5);
  assert.ok(simulateWorkloadCost(coder, 'chat') < simulateWorkloadCost(coder, 'benchmark'), 'light Q&A reduces heavy reasoning cost');
  assert.ok(simulateWorkloadCost(designer, 'longdoc') > simulateWorkloadCost(coder, 'longdoc'), 'longdoc profile penalizes expensive input-heavy breakdown');
  assert.ok(simulateWorkloadCost(coder, 'reasoning') > simulateWorkloadCost(designer, 'reasoning'), 'heavy reasoning profile penalizes high thinking-token burn');

  const agenticCacheHeavy = {
    id: 'cache-heavy', _baseCost: 26.5, cost: 26.5,
    costBreakdown: {input: 15.6, nonCacheInput: 0.07, cacheRead: 8.5, cacheWrite: 7.03, reasoning: 7.7, answer: 3.2}
  };
  assert.ok(simulateWorkloadCost(agenticCacheHeavy, 'chat') < 3.5, 'single-turn chat uses nonCacheInput instead of multi-turn cacheWrite churn');
  assert.ok(simulateWorkloadCost(agenticCacheHeavy, 'longdoc') > 20, 'longdoc reflects multi-turn cacheRead + cacheWrite cost');
});

test('cache-busting version query strings match across index.html and app.js', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const cssVer = html.match(/styles\.css\?v=([^"']+)/)?.[1];
  const appVer = html.match(/app\.js\?v=([^"']+)/)?.[1];
  const mathVer = js.match(/chart-math\.mjs\?v=([^"']+)/)?.[1];
  assert.ok(cssVer, 'styles.css should have a cache-busting version');
  assert.equal(cssVer, appVer, 'index.html styles.css and app.js versions must match');
  assert.equal(appVer, mathVer, 'app.js and chart-math.mjs versions must match');
});
