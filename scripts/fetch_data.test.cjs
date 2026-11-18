const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { getBuffer, readCodingRows, readManifests, simplifyModel, expectedCodingComponents, simplifyCodingAgent, fetchModels, validateRows, writeSnapshot } = require('./fetch_data.cjs');

const model = { id: 'model-1', slug: 'example-model', name: 'Example Model', intelligenceIndex: 50, intelligenceIndexCostPerTask: { total: 0.5 } };
const agent = { id: 'agent-1', displayLabel: 'Example Agent - Model', indexScore: 0.53, mean: { costUsd: 7.6 }, indexComponentCount: 3, modelCreators: [{ name: 'Example', color: '#123456' }] };
function flight(records, splitAt) {
  const stream = Object.entries(records).map(([key, value]) => `${key}:${JSON.stringify(value)}\n`).join('');
  const chunks = splitAt ? [stream.slice(0, splitAt), stream.slice(splitAt)] : [stream];
  return chunks.map(chunk => `<script>self.__next_f.push(${JSON.stringify([1, chunk])})</script>`).join('');
}
function encryptedPayload(payload, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, crypto.createHash('sha256').update(key).digest().subarray(0, 12));
  return Buffer.concat([cipher.update(zlib.gzipSync(JSON.stringify(payload))), cipher.final(), cipher.getAuthTag()]);
}

test('models support old and current cost formats; missing or zeroed pricing is excluded', () => {
  assert.equal(simplifyModel(model).cost, 0.5);
  assert.equal(simplifyModel({ ...model, intelligenceIndexCostPerTask: { cost: { total: 0.2 } } }).cost, 0.2);
  assert.equal(simplifyModel({ ...model, intelligenceIndexCostPerTask: { total: 0 } }), null);
  assert.equal(simplifyModel({ ...model, intelligenceIndexCostPerTask: null }), null);
  assert.equal(simplifyModel({ ...model, intelligenceIndex: NaN }), null);
});

test('coding score is converted from a fraction once; absent telemetry is not zero', () => {
  assert.equal(simplifyCodingAgent(agent).codingAgentIndex, 53);
  assert.equal(simplifyCodingAgent(agent).intelligenceIndex, 53);
  assert.equal(simplifyCodingAgent({ ...agent, mean: { costUsd: null } }), null);
  assert.equal(simplifyCodingAgent({ ...agent, indexScore: 53 }), null);
  assert.equal(simplifyCodingAgent({ ...agent, indexComponentCount: 2 }), null);
});

test('enriched model and coding-agent telemetry preserves open weights, subscores, cost breakdown, and percentiles', () => {
  const richModel = simplifyModel({
    ...model,
    isOpenWeights: true,
    releaseDate: '2026-09-01',
    release: { slug: 'example-family', name: 'Example Family' },
    effort: { slug: 'high', label: 'High', level: 3 },
    intelligenceIndexTimePerTask: 142.346,
    intelligenceIndexCostPerTask: { cost: { total: 1.25, input: 0.15, output: 1.1, reasoning: 0.9, answer: 0.2 } },
    intelligenceIndexOutputTokensPerTask: { output: 18400.4, reasoning: 15200.2, answer: 3200.2 },
    frontierCode20: 0.625,
    omniscienceHallucinationRate: 0.312
  });
  assert.equal(richModel.isOpenWeights, true);
  assert.equal(richModel.releaseDate, '2026-09-01');
  assert.deepEqual(richModel.family, { slug: 'example-family', name: 'Example Family' });
  assert.deepEqual(richModel.effort, { slug: 'high', label: 'High', level: 3 });
  assert.equal(richModel.timeSec, 142.35);
  assert.deepEqual(richModel.costBreakdown, { input: 0.15, reasoning: 0.9, answer: 0.2 });
  assert.deepEqual(richModel.outTokens, { reasoning: 15200, answer: 3200, total: 18400 });
  assert.equal(richModel.subscores.frontierCode, 62.5);
  assert.equal(richModel.subscores.hallucination, 31.2);
  assert.equal(richModel.subscores.science, null);

  const openSet = new Set(['example family']);
  const richAgent = simplifyCodingAgent({
    ...agent,
    agentRelease: { key: 'claude-code', name: 'Claude Code' },
    model: { release: { shortName: 'Example Family' }, effort: { slug: 'max', label: 'Max', level: 4 } },
    mean: { costUsd: 7.6, agentWallTimeSec: 915.4, steps: 64.24, totalTokens: 1250000, cacheHitRate: 0.942 },
    percentiles: { costUsd: { p05: 0.4, p25: 1.8, p50: 4.5, p75: 9.2, p95: 22.7 } },
    evals: [{ evaluationDatasetSlug: 'FrontierCode 2.0', mean: { reward: 0.584 } }]
  }, 3, openSet);
  assert.equal(richAgent.isOpenWeights, true);
  assert.deepEqual(richAgent.family, { slug: 'claude-code', name: 'Claude Code' });
  assert.deepEqual(richAgent.effort, { slug: 'max', label: 'Max', level: 4 });
  assert.equal(richAgent.timeSec, 915.4);
  assert.deepEqual(richAgent.agentStats, { steps: 64.2, totalTokens: 1250000, cacheHitRate: 94.2 });
  assert.equal(richAgent.costPercentiles.p50, 4.5);
  assert.equal(richAgent.costPercentiles.p95, 22.7);
  assert.deepEqual(richAgent.evalScores, [{ name: 'FrontierCode 2.0', score: 58.4 }]);
});

test('Flight rows resolve highlighted-row references across split chunks and multi-push script tags', () => {
  const html = flight({ '31': ['$', '$L1', null, { children: ['$', '$L2', null, { rows: [agent] }] }], '32': ['$', '$L3', null, { benchmarkRows: ['$31:props:children:props:rows:0', { ...agent, id: 'agent-2' }] }] }, 83);
  assert.deepEqual(readCodingRows(html).map(row => row.id), ['agent-1', 'agent-2']);
  const combinedScript = `<script>self.__next_f.push(${JSON.stringify([1, `10:${JSON.stringify({ benchmarkRows: [agent] })}\n`])});self.__next_f.push(${JSON.stringify([1, `11:{"extra":true}\n`])});</script>`;
  assert.deepEqual(readCodingRows(combinedScript).map(row => row.id), ['agent-1']);
  assert.throws(() => readCodingRows(flight({ '32': { benchmarkRows: ['$99:props:rows:0'] } })), /Unresolved/);
});

test('coding component count adapts automatically if benchmark suite expands beyond 3 components', () => {
  const expandedRows = [
    { ...agent, id: 'partial', indexComponentCount: 3 },
    { ...agent, id: 'full-4', indexComponentCount: 4 }
  ];
  const req = expectedCodingComponents(expandedRows);
  assert.equal(req, 4);
  assert.equal(simplifyCodingAgent(expandedRows[0], req), null);
  assert.equal(simplifyCodingAgent(expandedRows[1], req).benchmarkCount, 4);
});

test('manifest selection prefers the existing model manifest and skips unrelated data', async () => {
  const key = 'ab'.repeat(32);
  const html = flight({ '1': { manifest: { path: '/data/speech.txt', key } }, '2': { manifest: { path: '/data/models.txt', key } } });
  assert.equal(readManifests(html).length, 2);
  const models = Array.from({ length: 50 }, (_, index) => ({ ...model, id: `model-${index}` }));
  const urls = [];
  const result = await fetchModels(html, 'https://example.test/', { manifestPath: '/data/models.txt' }, async url => {
    urls.push(url);
    return encryptedPayload({ models }, key);
  });
  assert.equal(result.models.length, 50);
  assert.deepEqual(urls, ['https://example.test/data/models.txt']);
  assert.throws(() => validateRows([simplifyModel(model), simplifyModel(model)], 1, 'model'), /Duplicate/);
});

test('network retries transient failures but respects denied responses and long Retry-After', async () => {
  let calls = 0;
  const buffer = await getBuffer('https://example.test/', { fetchImpl: async () => ++calls === 1 ? new Response('', { status: 503 }) : new Response('ok'), sleep: async () => {} });
  assert.equal(buffer.toString(), 'ok');
  assert.equal(calls, 2);
  for (const status of [403, 429]) {
    calls = 0;
    await assert.rejects(getBuffer('https://example.test/', { fetchImpl: async () => { calls++; return new Response('', { status, headers: { 'retry-after': '120' } }); }, sleep: async () => {} }));
    assert.equal(calls, 1);
  }
});

test('unchanged snapshots keep their original timestamp and a failed refresh preserves the file', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aa-data-test-'));
  const out = path.join(directory, 'current.json');
  const server = http.createServer((request, response) => response.end('<html>source structure changed</html>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const original = { models: [simplifyModel(model)], updatedAt: '2026-01-01T00:00:00Z' };
    assert.equal(await writeSnapshot(out, original), true);
    assert.equal(await writeSnapshot(out, { ...original, updatedAt: '2026-02-01T00:00:00Z' }, original), false);
    assert.deepEqual(JSON.parse(await fs.readFile(out, 'utf8')), original);
    const url = `http://127.0.0.1:${server.address().port}/`;
    const child = spawn(process.execPath, [path.join(__dirname, 'fetch_data.cjs')], {
      env: { ...process.env, SOURCE_URL: url, CODING_SOURCE_URL: url, DATA_OUTPUT: out }
    });
    let errorOutput = '';
    child.stderr.on('data', chunk => { errorOutput += chunk; });
    child.stdout.resume();
    const exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    assert.equal(exitCode, 1);
    assert.match(errorOutput, /Could not find coding-agent benchmark rows/);
    assert.deepEqual(JSON.parse(await fs.readFile(out, 'utf8')), original);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(out, { force: true });
    await fs.rmdir(directory);
  }
});
