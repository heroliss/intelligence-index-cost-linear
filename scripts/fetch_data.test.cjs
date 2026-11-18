const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { getBuffer, readCodingRows, readManifests, simplifyModel, simplifyCyberModel, simplifyChangelog, buildFrontierModels, eloToWinPct, buildHumanArenaModels, fetchHumanArenas, expectedCodingComponents, simplifyCodingAgent, fetchModels, validateRows, writeSnapshot } = require('./fetch_data.cjs');

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
  const capMap = new Map([['model-1', { financeAndAccounting: 54.321, legal: 48.9 }]]);
  const hostMap = new Map([['example-model', [
    { shortName: 'Example Model, CloudB', host: { name: 'CloudB' }, intelligenceIndexCostPerTask: { total: 0.9 }, intelligenceIndexTimePerTask: 100 },
    { shortName: 'Example Model (FP4), CloudA', host: { name: 'CloudA' }, intelligenceIndexCostPerTask: { total: 0.35 }, intelligenceIndexTimePerTask: 62.44 }
  ]]]);
  const richModel = simplifyModel({
    ...model,
    isOpenWeights: true,
    openSourceCategorization: 'permissive',
    parameters: 320,
    inputModalityImage: true,
    inputModalityVideo: true,
    releaseDate: '2026-09-01',
    release: { slug: 'example-family', name: 'Example Family' },
    effort: { slug: 'high', label: 'High', level: 3 },
    intelligenceIndexTimePerTask: 142.346,
    intelligenceIndexCostPerTask: { cost: { total: 1.25, input: 0.15, output: 1.1, reasoning: 0.9, answer: 0.2 } },
    intelligenceIndexOutputTokensPerTask: { output: 18400.4, reasoning: 15200.2, answer: 3200.2 },
    frontierCode20: 0.625,
    omniscienceHallucinationRate: 0.312
  }, capMap, hostMap);
  assert.equal(richModel.isOpenWeights, true);
  assert.equal(richModel.openLicense, 'permissive');
  assert.equal(richModel.parametersB, 320);
  assert.deepEqual(richModel.modalities, ['image', 'video']);
  assert.equal(richModel.domainScores.finance, 54.32);
  assert.equal(richModel.domainScores.legal, 48.9);
  assert.deepEqual(richModel.providers, [
    { host: 'CloudA (FP4)', cost: 0.35, timeSec: 62.4 },
    { host: 'CloudB', cost: 0.9, timeSec: 100 }
  ]);
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

  const byId = new Map([[richModel.id, richModel]]);
  const cyber = simplifyCyberModel({
    id: 'model-1',
    slug: 'example-model',
    name: 'Example Model',
    shortName: 'Example',
    score: 64.25,
    costPerTask: 3.12,
    refusalRate: 0.382,
    mitigationStatus: 'Safeguards Active'
  }, byId);
  assert.equal(cyber.cyberIndex, 64.25);
  assert.equal(cyber.intelligenceIndex, 64.25);
  assert.equal(cyber.cost, 3.12);
  assert.equal(cyber.refusalRate, 38.2);
  assert.equal(cyber.mitigationStatus, 'Safeguards Active');
  assert.equal(cyber.isOpenWeights, true);
  assert.equal(cyber.releaseDate, '2026-09-01');
  assert.equal(cyber.timeSec, 142.35);
  assert.equal(cyber.subscores.frontierCode, 62.5);
  assert.equal(cyber.domainScores.finance, 54.32);
  assert.equal(cyber.providers.length, 2);
  assert.equal(simplifyCyberModel({ id: 'bad', name: 'Bad', score: 50, costPerTask: 0 }), null);

  const log = simplifyChangelog([
    { dateLa: '2026-11-15', type: 'model', title: 'Added Example Model', url: '/models/example' },
    { dateLa: '', title: 'Missing date' }
  ]);
  assert.deepEqual(log, [{
    date: '2026-11-15',
    type: 'model',
    title: 'Added Example Model',
    url: 'https://artificialanalysis.ai/models/example'
  }]);
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

test('buildFrontierModels strips incomplete rows and computes unsaturated hard index and rank shift', () => {
  const m1 = simplifyModel({
    id: 'm1', slug: 'legacy-inflated', name: 'Legacy Inflated', intelligenceIndex: 62,
    intelligenceIndexCostPerTask: { total: 5 },
    gdpPdfAllPass: 0.2, frontierCode20: 0.35, terminalBench40: 0.5, critptAgenticHard: 0.55, automationBenchPartialScore: 0.6, hleDiamond: 0.5
  });
  const m2 = simplifyModel({
    id: 'm2', slug: 'frontier-specialist', name: 'Frontier Specialist', intelligenceIndex: 60,
    intelligenceIndexCostPerTask: { total: 3 },
    gdpPdfAllPass: 0.32, frontierCode20: 0.48, terminalBench40: 0.65, critptAgenticHard: 0.74, automationBenchPartialScore: 0.76, hleDiamond: 0.77,
    harveyLab: 0.185
  });
  const mIncomplete = simplifyModel({
    id: 'm3', slug: 'incomplete', name: 'Incomplete', intelligenceIndex: 55,
    intelligenceIndexCostPerTask: { total: 1 },
    gdpPdfAllPass: 0.2, frontierCode20: 0.3
  });
  const frontier = buildFrontierModels([m1, m2, mIncomplete]);
  assert.equal(frontier.length, 2);
  const spec = frontier.find(r => r.id === 'm2');
  const leg = frontier.find(r => r.id === 'm1');
  assert.equal(spec.frontierIndex, 62);
  assert.equal(spec.aaRank, 2);
  assert.equal(spec.frontierRank, 1);
  assert.equal(spec.rankDelta, 1);
  assert.equal(spec.frontierScores.harveyLaw, 18.5);
  assert.equal(leg.rankDelta, -1);
});

test('buildHumanArenaModels matches effort-aware variants without cloning onto low-effort siblings and falls back safely', async () => {
  assert.equal(eloToWinPct(1360, 1360, 220), 50);
  assert.ok(eloToWinPct(1526, 1360, 220) > 80);

  const museMax = simplifyModel({
    id: 'mw-max', slug: 'muse-wonder', name: 'Muse Wonder (Max)', shortName: 'Muse Wonder (max)',
    intelligenceIndex: 43.6, intelligenceIndexCostPerTask: { total: 6.95 },
    release: { slug: 'muse-wonder', name: 'Muse Wonder' },
    effort: { slug: 'max', label: 'Max', level: 4 },
    gdpval: 1770.3, briefcaseElo: 1720.0
  });
  const museLow = simplifyModel({
    id: 'mw-low', slug: 'muse-wonder-low', name: 'Muse Wonder (Low)', shortName: 'Muse Wonder (low)',
    intelligenceIndex: 35.0, intelligenceIndexCostPerTask: { total: 1.2 },
    release: { slug: 'muse-wonder', name: 'Muse Wonder' },
    effort: { slug: 'low', label: 'Low', level: 1 }
  });
  const qwenMax = simplifyModel({
    id: 'qw-max', slug: 'qwen3-8-max', name: 'Qwen3.8 Max (0902)', shortName: 'Qwen3.8 Max (0902)',
    intelligenceIndex: 52.0, intelligenceIndexCostPerTask: { total: 2.1 },
    release: { slug: 'qwen3-8-max', name: 'Qwen3.8 Max' },
    effort: { slug: 'xhigh', label: 'xHigh', level: 3 }
  });

  const arenaRows = buildHumanArenaModels([museMax, museLow, qwenMax], {
    chatRows: [
      { category: 'overall', model_name: 'Muse Wonder Full (Max)', rating: 1510.9, vote_count: 8400 },
      { category: 'overall', model_name: 'Qwen3.8-Max (0902)', rating: 1465.2, vote_count: 12000 }
    ],
    webdevRows: [
      { category: 'overall', model_name: 'Muse Wonder (Max)', rating: 1723.9, vote_count: 2064 }
    ],
    docRows: [],
    designByCat: {
      website: [{ modelId: 'muse-wonder-1.0', elo: 1375, winRate: 63.8, battles: 4960, avgCostUsd: 0.4279 }],
      gamedev: [{ modelId: 'qwen3-8-max', elo: 1460, winRate: 70.0, battles: 80 }]
    }
  });

  // museLow must NOT inherit un-suffixed muse-wonder-1.0 or (Max) ratings!
  assert.deepEqual(arenaRows.map(r => r.id).sort(), ['mw-max', 'qw-max']);
  const mw = arenaRows.find(r => r.id === 'mw-max');
  const qw = arenaRows.find(r => r.id === 'qw-max');
  assert.equal(mw.arenaRaw.chatElo, 1510.9);
  assert.equal(mw.arenaRaw.designWebElo, 1375);
  assert.equal(mw.arenaRaw.designWebWinRate, 63.8);
  assert.equal(mw.arenaRaw.gdpvalElo, 1770.3);
  assert.ok(mw.humanIndex > 70 && mw.humanIndex < 90);
  // GameDev must NOT contaminate headline designUi aesthetic score, and 80-battle low sample is shrunk!
  assert.equal(qw.humanScores.designUi, null);
  assert.ok(qw.designSub.gamedev < 70, 'low-sample gamedev score is shrunk toward prior');

  // Fault tolerance: network error falls back cleanly to previous snapshot
  const fallbackPrev = { humanArenaModels: arenaRows, lmArenaPublishDate: '2026-11-11' };
  const degraded = await fetchHumanArenas([museMax], fallbackPrev, async () => { throw new Error('offline'); });
  assert.equal(degraded.humanArenaModels.length, 2);
  assert.equal(degraded.lmArenaPublishDate, '2026-11-11');
});
