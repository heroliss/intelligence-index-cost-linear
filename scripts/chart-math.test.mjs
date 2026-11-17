import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  dataBounds,
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
  VALUE_WEIGHT,
  MIN_SCORE,
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
  assert.equal(first.x, 0);
  assert.equal(second.x, 0);
  assert.equal(second.width, first.width * 2);
  assert.equal(second.height, first.height);
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

test('both shipped datasets pass validation and fit inside their full-data view', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  for (const [name, rows] of [['models', snapshot.models], ['codingAgents', snapshot.codingAgents]]) {
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

test('table cost and index sorts compare actual numbers in both directions', () => {
  const rows = [row('ten', 10, 9), row('two', 2, 100), row('fraction', 0.1, 10), row('zero', 0, 0)];
  assert.deepEqual(sortRows(rows, 'cost').map(d => d.cost), [0, 0.1, 2, 10]);
  assert.deepEqual(sortRows(rows, 'cost', 'desc').map(d => d.cost), [10, 2, 0.1, 0]);
  assert.deepEqual(sortRows(rows, 'intelligenceIndex').map(d => d.intelligenceIndex), [0, 9, 10, 100]);
  assert.deepEqual(sortRows(rows, 'intelligenceIndex', 'desc').map(d => d.intelligenceIndex), [100, 10, 9, 0]);
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
  for (const rows of [snapshot.models, snapshot.codingAgents]) {
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

test('minimum score threshold disqualifies lower-scoring entries and keeps them last in value sorts', () => {
  const rows = [
    row('cheap-toy', 0.005, 10),
    row('qualified-good', 0.8, 52),
    row('qualified-pricey', 5, 60)
  ];
  assert.equal(valuePerDollar(rows[0], 1, 45), null);
  assert.ok(valuePerDollar(rows[1], 1, 45) > 0);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 1, 45).map(d => d.id), ['qualified-good', 'qualified-pricey', 'cheap-toy']);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'asc', 1, 45).map(d => d.id), ['qualified-pricey', 'qualified-good', 'cheap-toy']);
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
