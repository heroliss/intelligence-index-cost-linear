const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { getBuffer, readCodingRows, readManifests, simplifyModel, simplifyCodingAgent, fetchModels, validateRows, writeSnapshot } = require('./fetch_data.cjs');

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

test('Flight rows resolve highlighted-row references across split chunks without losing variants', () => {
  const html = flight({ '31': ['$', '$L1', null, { children: ['$', '$L2', null, { rows: [agent] }] }], '32': ['$', '$L3', null, { benchmarkRows: ['$31:props:children:props:rows:0', { ...agent, id: 'agent-2' }] }] }, 83);
  assert.deepEqual(readCodingRows(html).map(row => row.id), ['agent-1', 'agent-2']);
  assert.throws(() => readCodingRows(flight({ '32': { benchmarkRows: ['$99:props:rows:0'] } })), /Unresolved/);
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
