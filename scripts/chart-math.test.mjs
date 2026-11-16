import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dataBounds, clampView, paretoFrontier, ticks, validRows, sortRows, valuePerDollar, VALUE_WEIGHT} from '../chart-math.mjs';

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

test('weight configuration is frozen and defaults to cubic capability preference', () => {
  assert.deepEqual(VALUE_WEIGHT, {min: 1, max: 4, step: 0.1, default: 3, reference: 100});
  assert.ok(Object.isFrozen(VALUE_WEIGHT));
  assert.throws(() => { VALUE_WEIGHT.default = 1; }, TypeError);
  assert.equal(valuePerDollar(row('default', 2, 50)), 6.25);
});

test('weighted value follows the normalized formula across integer and fractional preferences', () => {
  for (const weight of [1, 1.1, 1.5, 2, 2.7, 3, 4]) {
    for (const [score, cost] of [[25, 0.5], [50, 2], [100, 3], [125, 4]]) {
      const actual = valuePerDollar(row('formula', cost, score), weight);
      const expected = 100 * (score / 100) ** weight / cost;
      assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * 1e-14, `score=${score}, cost=${cost}, weight=${weight}`);
      assert.equal(valuePerDollar(row('zero-score', cost, 0), weight), 0);
      assert.equal(Object.is(valuePerDollar(row('negative-zero-score', cost, -0), weight), -0), false);
    }
    assert.equal(valuePerDollar(row('reference', 2, 100), weight), 50);
    const low = valuePerDollar(row('low', 1, 25), weight), high = valuePerDollar(row('high', 1, 50), weight);
    assert.ok(Math.abs(high / low - 2 ** weight) < 1e-12);
  }
});

test('invalid weights throw for values and all sorts, including empty or single-row input', () => {
  for (const weight of [NaN, Infinity, -Infinity, 0, 0.999, 4.001, -1, null, '3', {}, true, 3n, Symbol('weight')]) {
    assert.throws(() => valuePerDollar(row('valid', 1, 50), weight), RangeError);
    assert.throws(() => valuePerDollar(null, weight), RangeError);
    assert.throws(() => sortRows([], 'valuePerDollar', 'asc', weight), RangeError);
    assert.throws(() => sortRows([], 'name', 'asc', weight), RangeError);
    assert.throws(() => sortRows([row('single', 1, 50)], 'cost', 'desc', weight), RangeError);
  }
});

test('stronger capability preference changes the value ranking without changing costs or scores', () => {
  const rows = Object.freeze([Object.freeze(row('cheap-low', 0.1, 20)), Object.freeze(row('capable', 1, 50))]);
  const before = structuredClone(rows);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 1).map(d => d.id), ['cheap-low', 'capable']);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 2).map(d => d.id), ['cheap-low', 'capable']);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 3).map(d => d.id), ['capable', 'cheap-low']);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', 4).map(d => d.id), ['capable', 'cheap-low']);
  assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc'), sortRows(rows, 'valuePerDollar', 'desc', 3));
  assert.deepEqual(rows, before);
});

test('value per dollar rejects invalid or absent inputs and finite-input overflow', () => {
  for (const invalid of [null, undefined, {}, {cost: 1}, {intelligenceIndex: 20},
    row('zero-cost', 0, 20), row('negative-cost', -1, 20), row('nan-cost', NaN, 20),
    row('infinite-cost', Infinity, 20), row('negative-score', 1, -1),
    row('nan-score', 1, NaN), row('infinite-score', 1, Infinity),
    row('string-cost', '1', 20), row('string-score', 1, '20'),
    row('overflow', Number.MIN_VALUE, 1)]) {
    for (const weight of [1, 1.5, 2, 3, 4]) assert.equal(valuePerDollar(invalid, weight), null);
  }
  assert.equal(valuePerDollar(row('weighted-overflow', 1, Number.MAX_VALUE), 4), null);
});

test('value sorting keeps full precision when displayed rounded values would tie', () => {
  const rows = [row('A lower', 1, 100.0001), row('Z higher', 1, 100.0002)];
  for (const weight of [1, 1.5, 2, 3, 4]) {
    assert.equal(valuePerDollar(rows[0], weight).toFixed(2), valuePerDollar(rows[1], weight).toFixed(2));
    assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', weight).map(d => d.id), ['Z higher', 'A lower']);
    assert.deepEqual(sortRows(rows, 'valuePerDollar', 'asc', weight).map(d => d.id), ['A lower', 'Z higher']);
  }
});

test('missing value ratios stay last in either direction and zero remains a valid ratio', () => {
  const rows = [row('invalid 10', 0, 100), row('ten', 2, 20), row('zero', 1, 0), row('invalid 2', 1, NaN)];
  for (const weight of [1, 1.5, 2, 3, 4]) {
    assert.deepEqual(sortRows(rows, 'valuePerDollar', 'asc', weight).map(d => d.id), ['zero', 'ten', 'invalid 2', 'invalid 10']);
    assert.deepEqual(sortRows(rows, 'valuePerDollar', 'desc', weight).map(d => d.id), ['ten', 'zero', 'invalid 2', 'invalid 10']);
  }
});

test('table names sort naturally across numeric suffixes and ignore letter case', () => {
  const rows = [row('Model 10', 1, 1), row('model 2', 1, 1), row('MODEL 1', 1, 1)];
  assert.deepEqual(sortRows(rows, 'name').map(d => d.name), ['MODEL 1', 'model 2', 'Model 10']);
  assert.deepEqual(sortRows(rows, 'name', 'desc').map(d => d.name), ['Model 10', 'model 2', 'MODEL 1']);
  assert.deepEqual(sortRows([row('模型10', 1, 1), row('模型2', 1, 1)], 'name').map(d => d.name), ['模型2', '模型10']);
});

test('creator sorting uses creator names and groups absent names under Other', () => {
  const rows = [
    {...row('missing', 1, 1)},
    {...row('ten', 1, 1), creator: {name: 'Company 10'}},
    {...row('two', 1, 1), creator: {name: 'Company 2'}},
    {...row('first', 1, 1), creator: {name: 'Anthropic'}},
  ];
  assert.deepEqual(sortRows(rows, 'creator').map(d => d.id), ['first', 'two', 'ten', 'missing']);
  assert.deepEqual(sortRows(rows, 'creator', 'desc').map(d => d.id), ['missing', 'ten', 'two', 'first']);
});

test('table ties use ascending natural name then id regardless of sort direction', () => {
  const rows = [
    {...row('b', 2, 40), name: 'Model 2'},
    {...row('c', 2, 40), name: 'Model 10'},
    {...row('a', 2, 40), name: 'Model 2'},
  ];
  for (const direction of ['asc', 'desc']) {
    assert.deepEqual(sortRows(rows, 'cost', direction).map(d => d.id), ['a', 'b', 'c']);
    assert.deepEqual(sortRows(rows, 'intelligenceIndex', direction).map(d => d.id), ['a', 'b', 'c']);
    assert.deepEqual(sortRows(rows, 'valuePerDollar', direction).map(d => d.id), ['a', 'b', 'c']);
  }
});

test('sorting copies the row order without mutating records or their source array', () => {
  const rows = Object.freeze([Object.freeze(row('two', 2, 20)), Object.freeze(row('one', 1, 10))]);
  const before = structuredClone(rows);
  for (const key of ['cost', 'valuePerDollar']) {
    const sorted = sortRows(rows, key);
    assert.notEqual(sorted, rows);
    assert.equal(sorted[0], rows[1]);
    assert.equal(sorted[1], rows[0]);
  }
  assert.deepEqual(rows, before);
  assert.deepEqual(sortRows([], 'name'), []);
});

test('sorting rejects unsupported columns and directions', () => {
  for (const key of ['score', 'constructor', '__proto__', '', null]) assert.throws(() => sortRows([], key), RangeError);
  for (const direction of ['ascending', 'DESC', '', null]) assert.throws(() => sortRows([], 'cost', direction), RangeError);
});

test('both actual snapshots sort monotonically across the full weight range without mutation', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  for (const rows of [snapshot.models, snapshot.codingAgents]) {
    const before = structuredClone(rows), ids = rows.map(d => d.id).sort();
    const weights = Array.from({length: 31}, (_, i) => Number((1 + i * 0.1).toFixed(1)));
    for (const weight of weights) for (const key of ['cost', 'intelligenceIndex', 'valuePerDollar']) for (const direction of ['asc', 'desc']) {
      const sorted = sortRows(rows, key, direction, weight);
      assert.deepEqual(sorted.map(d => d.id).sort(), ids);
      for (let i = 1; i < sorted.length; i++) {
        const previous = key === 'valuePerDollar' ? valuePerDollar(sorted[i - 1], weight) : sorted[i - 1][key];
        const current = key === 'valuePerDollar' ? valuePerDollar(sorted[i], weight) : sorted[i][key];
        assert.ok(Number.isFinite(previous) && Number.isFinite(current));
        assert.ok(direction === 'asc' ? previous <= current : previous >= current);
      }
    }
    assert.deepEqual(rows, before);
  }
});
