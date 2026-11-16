import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dataBounds, clampView, paretoFrontier, ticks, validRows, sortRows} from '../chart-math.mjs';

const row = (id, cost, intelligenceIndex) => ({id, name: id, cost, intelligenceIndex});

test('full data bounds include current high scores above the old 60-point ceiling', () => {
  const rows = [row('low', 0.005, 3.8), row('high', 26.54, 64.5636)];
  const bounds = dataBounds(rows);
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 0);
  for (const item of rows) {
    assert.ok(item.cost < bounds.x + bounds.width);
    assert.ok(item.intelligenceIndex < bounds.y + bounds.height);
  }
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
  }
});

test('sorting copies the row order without mutating records or their source array', () => {
  const rows = Object.freeze([Object.freeze(row('two', 2, 20)), Object.freeze(row('one', 1, 10))]);
  const before = structuredClone(rows), sorted = sortRows(rows, 'cost');
  assert.notEqual(sorted, rows);
  assert.equal(sorted[0], rows[1]);
  assert.equal(sorted[1], rows[0]);
  assert.deepEqual(rows, before);
  assert.deepEqual(sortRows([], 'name'), []);
});

test('sorting rejects unsupported columns and directions', () => {
  for (const key of ['score', 'constructor', '__proto__', '', null]) assert.throws(() => sortRows([], key), RangeError);
  for (const direction of ['ascending', 'DESC', '', null]) assert.throws(() => sortRows([], 'cost', direction), RangeError);
});

test('both actual snapshots sort monotonically while preserving every original row', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  for (const rows of [snapshot.models, snapshot.codingAgents]) {
    const before = structuredClone(rows), ids = rows.map(d => d.id).sort();
    for (const key of ['cost', 'intelligenceIndex']) for (const direction of ['asc', 'desc']) {
      const sorted = sortRows(rows, key, direction);
      assert.deepEqual(sorted.map(d => d.id).sort(), ids);
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(direction === 'asc' ? sorted[i - 1][key] <= sorted[i][key] : sorted[i - 1][key] >= sorted[i][key]);
      }
    }
    assert.deepEqual(rows, before);
  }
});
