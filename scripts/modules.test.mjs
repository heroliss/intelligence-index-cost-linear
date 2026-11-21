import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  RECOMMEND_USE_CASES,
  RECOMMEND_BILLING,
  RECOMMEND_LICENSES,
  recommendModels,
  getRowCaveats
} from '../modules/recommend.mjs';
import {computeOrgDivergence} from '../modules/divergence.mjs';
import {createNavHistory} from '../modules/nav-history.mjs';
import {GUIDE_PROFILE_ORDER, GUIDE_TAB_META, GUIDE_GLOSSARY} from '../modules/guide-content.mjs';
import {
  UPDATE_FILTERS,
  normalizeChangelogType,
  buildUpdateFeed,
  filterUpdateFeed,
  resolveUpdateDetail
} from '../modules/updates.mjs';

test('recommendModels returns distinct multi-archetype picks with objective proofs & caveats across all 81 live combinations', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  // Hydrate humanScores onto models just like the app does for coding-api/research scenarios
  const humanById = new Map((snapshot.humanArenaModels || []).map(h => [h.id, h]));
  snapshot.models = snapshot.models.map(m => {
    const h = humanById.get(m.id);
    return h?.humanScores ? {...m, humanScores: h.humanScores} : m;
  });

  let comboCount = 0;
  for (const uc of RECOMMEND_USE_CASES) {
    for (const bill of RECOMMEND_BILLING) {
      for (const lic of RECOMMEND_LICENSES) {
        comboCount++;
        const res = recommendModels(snapshot, {useCase: uc.id, billing: bill.id, license: lic.id});
        assert.equal(res.useCase.id, uc.id);
        assert.equal(res.billing.id, bill.id);
        assert.equal(res.license.id, lic.id);
        if (res.totalPool > 0) {
          assert.ok(res.picks.length >= 1 && res.picks.length <= 3, `expected 1..3 picks for ${uc.id}/${bill.id}/${lic.id}`);
          const ids = new Set(res.picks.map(p => p.row.id));
          assert.equal(ids.size, res.picks.length, `picks must be unique for ${uc.id}/${bill.id}/${lic.id}`);
          for (const p of res.picks) {
            assert.ok(p.row.cost > 0 && Number.isFinite(p.score), 'every pick has valid cost & score');
            if (lic.id === 'open') assert.equal(!!p.row.isOpenWeights, true, `open filter respected in ${uc.id}`);
            if (lic.id === 'closed') assert.equal(!!p.row.isOpenWeights, false, `closed filter respected in ${uc.id}`);
            assert.ok(p.reason.zh.length > 4 && p.reason.en.length > 4, 'pick has bilingual rationale');
            assert.ok(!p.reason.zh.includes('+-') && !p.reason.en.includes('+-'), `malformed signed delta in ${uc.id}/${bill.id}/${lic.id}: ${p.reason.zh}`);
            assert.ok(Array.isArray(p.proofs) && Array.isArray(p.caveats), 'pick exposes proofs & caveats arrays');
          }
        }
      }
    }
  }
  assert.equal(comboCount, 81);

  // Verify real-world multi-archetype & honest-caveat guarantees on current snapshot:
  // 1. General Daily All-Rounder separates Arena-Chat-verified consensus from missing-chat efficiency & high-cost ceiling
  const gen = recommendModels(snapshot, {useCase: 'general', billing: 'api-balanced', license: 'all'});
  assert.equal(gen.picks.length, 3);
  assert.equal(gen.picks[0].badgeZh, '跨机构口碑稳健');
  assert.ok(
    gen.picks[0].proofs.some(pr => pr.zh.includes('Arena 聊天')),
    `consensus pick (${gen.picks[0].row.name}) must carry verified Arena Chat proof`
  );
  assert.ok(
    !gen.picks[0].caveats.some(cv => cv.zh.includes('缺 Arena 聊天')),
    'consensus pick must not lack Arena Chat blind coverage'
  );
  for (const p of gen.picks) {
    if (p.row.cost >= 11) {
      assert.ok(
        p.caveats.some(cv => cv.zh.includes('常规月卡')),
        `high-cost model (${p.row.name}, $${p.row.cost}) must carry subscription/API-only caveat`
      );
    }
  }

  // 2. Web & UI Aesthetics enforces a core-intelligence floor on Primary pick & flags style-only outliers transparently
  const des = recommendModels(snapshot, {useCase: 'design', billing: 'sub', license: 'all'});
  assert.equal(des.picks.length, 3);
  assert.equal(des.picks[0].badgeZh, '前端开发主力');
  assert.ok(des.picks[0].proofs.some(pr => pr.zh.includes('WebDev #')), `primary frontend pick (${des.picks[0].row.name}) must carry WebDev proof`);
  assert.ok(des.picks[0].row.aaIndex >= 50, `primary frontend pick (${des.picks[0].row.name}) must meet core-intelligence floor, got ${des.picks[0].row.aaIndex}`);
  assert.equal(des.picks[1].badgeZh, '单页视觉参考');
  assert.ok(des.picks[1].proofs.some(pr => pr.zh.includes('Design 整站 #1')), `visual reference (${des.picks[1].row.name}) carries Design #1 proof`);
  assert.ok(des.picks[1].caveats.some(cv => cv.zh.includes('综合能力偏弱')), 'low-intelligence visual outlier carries explicit weak-core caveat');
  assert.equal(des.picks[2].badgeZh, '前端审美全能上限');
  assert.ok(des.picks[2].proofs.some(pr => pr.zh.includes('WebDev #1')), `ceiling pick (${des.picks[2].row.name}) must show WebDev #1 proof`);
  assert.ok(des.picks[2].caveats.some(cv => cv.zh.includes('常规月卡')), 'high-cost design ceiling carries subscription caveat');

  // 2b. Writing under monthly plan contrasts Natural Chat #1 against cross-vendor Low-Slop Craft (enforcing core intelligence!)
  const wrt = recommendModels(snapshot, {useCase: 'writing', billing: 'sub', license: 'all'});
  assert.equal(wrt.picks[0].badgeZh, '自然对话主力');
  assert.ok(wrt.picks[0].proofs.some(pr => pr.zh.includes('Arena 聊天 #1')), `writing leader (${wrt.picks[0].row.name}) must carry Arena Chat #1 proof`);
  assert.equal(wrt.picks[1].badgeZh, '低 AI 味写作派');
  assert.notEqual(wrt.picks[1].row.creator?.name, wrt.picks[0].row.creator?.name, 'writing slot 2 contrasts a different vendor');
  assert.ok(wrt.picks[1].row.aaIndex >= 50, `low-slop writing pick (${wrt.picks[1].row.name}) passes core intelligence floor`);

  // 2c. Research highlights low hallucination proofs and warns on high blind-spot hallucination (>=45%)
  const res = recommendModels(snapshot, {useCase: 'research', billing: 'sub', license: 'all'});
  assert.ok(res.picks[0].proofs.some(pr => pr.zh.includes('盲区幻觉仅')), `research leader (${res.picks[0].row.name}) carries low-hallucination proof`);
  for (const p of res.picks) {
    if (p.row.subscores?.hallucination >= 45) {
      assert.ok(p.caveats.some(cv => cv.zh.includes('盲区幻觉率')), `research pick (${p.row.name}) with ${p.row.subscores.hallucination}% hallucination must warn`);
    }
  }

  // 2d. Image & TTS diversify creators across top peers and never surface edit-only image models as T2I picks
  const img = recommendModels(snapshot, {useCase: 'image', billing: 'sub', license: 'all'});
  assert.notEqual(img.picks[0].row.creator?.name, img.picks[1].row.creator?.name, 'image top 2 picks come from distinct vendors');
  const imgBal = recommendModels(snapshot, {useCase: 'image', billing: 'api-balanced', license: 'all'});
  assert.ok(imgBal.picks.every(p => p.row.mediaScores?.t2i != null), 'image balanced picks must support text-to-image');
  const tts = recommendModels(snapshot, {useCase: 'tts', billing: 'sub', license: 'all'});
  assert.notEqual(tts.picks[0].row.creator?.name, tts.picks[1].row.creator?.name, 'tts top 2 picks come from distinct vendors');

  // 2e. getRowCaveats exposes unified objective caveats for scatter pinned cards
  const museWonder = snapshot.humanArenaModels.find(x => /Muse Wonder/i.test(x.name));
  const museCav = getRowCaveats(snapshot, museWonder, 'human-arena');
  assert.ok(museCav.some(c => c.zh.includes('综合能力偏弱')), 'pinned Muse Wonder flags weak core reasoning');
  const editOnlyImg = snapshot.mediaModels.find(x => x.mediaKind === 'image' && x.mediaScores?.t2i == null && x.mediaScores?.imgEdit != null);
  if (editOnlyImg) {
    const editCav = getRowCaveats(snapshot, editOnlyImg, 'media');
    assert.ok(editCav.some(c => c.zh.includes('仅支持修图')), 'pinned edit-only image model flags no T2I');
  }

  // 3. End-to-end Coding Agents under monthly plan mode picks top real-world Coding Agent within mainstream burn
  const ca = recommendModels(snapshot, {useCase: 'coding-agent', billing: 'sub', license: 'all'});
  assert.equal(ca.picks.length, 3);
  assert.equal(ca.picks[0].badgeZh, '端到端实战首选');
  assert.ok(ca.picks[0].proofs.some(pr => pr.zh.includes('端到端编程 #1')), 'coding-agent leader displays #1 rank proof');
  assert.ok(ca.picks[0].row.cost <= 12, 'monthly plan pick stays within mainstream burn cap');
  for (const p of ca.picks) {
    if (p.row.cost >= 14) {
      assert.ok(p.caveats.some(cv => cv.zh.includes('常规月卡')), `extreme-cost coding agent (${p.row.name}) carries caveat`);
    }
  }

  // 3. Default billing is monthly plan (`sub`) and option chips stay neutral without editorial "Recommended" nudges
  const def = recommendModels(snapshot);
  assert.equal(def.billing.id, 'sub');
  assert.ok(RECOMMEND_BILLING.every(b => !b.zh.includes('推荐') && !/rec/i.test(b.en)), 'billing labels stay neutral');
  assert.ok(RECOMMEND_LICENSES.every(l => !l.zh.includes('推荐') && !/rec/i.test(l.en)), 'license labels stay neutral');

  // 4. Legacy `budget` option still maps cleanly to `billing`
  const legacy = recommendModels(snapshot, {useCase: 'general', budget: 'balanced', license: 'all'});
  assert.equal(legacy.billing.id, 'api-balanced');

  // 5. General daily monthly-plan driver balances cross-org consensus, subscription burn & low hallucination,
  //    keeping the true peak flagship in Slot 3 rather than crowding it out with a high-burn sibling.
  const genSub = recommendModels(snapshot, {useCase: 'general', billing: 'sub', license: 'all'});
  assert.equal(genSub.picks.length, 3);
  assert.ok(genSub.picks[0].row.cost <= 8.0, `general/sub daily driver (${genSub.picks[0].row.name}, $${genSub.picks[0].row.cost}) should stay in mainstream plan burn`);
  assert.ok((genSub.picks[0].row.subscores?.hallucination ?? 0) < 40, `general/sub daily driver should avoid severe hallucination (${genSub.picks[0].row.subscores?.hallucination}%)`);
  assert.equal(genSub.picks[2].badgeZh, '能力上限参照', 'general/sub Slot 3 preserves the true capability ceiling');

  // 6. Open-weights shortlists stay above usable efficiency floors and differentiate budget tiers
  const openSub = recommendModels(snapshot, {useCase: 'general', billing: 'sub', license: 'open'});
  assert.ok(openSub.picks[1].score >= openSub.picks[0].score * 0.45, `open efficiency pick (${openSub.picks[1].row.name}, ${openSub.picks[1].score}) must not degrade to unsorted junk`);
  const openBud = recommendModels(snapshot, {useCase: 'general', billing: 'api-budget', license: 'open'});
  assert.ok(openBud.picks[0].row.cost < openSub.picks[0].row.cost, 'open api-budget primary pick is cheaper than open sub primary pick');
  const openCodeBal = recommendModels(snapshot, {useCase: 'coding-api', billing: 'api-balanced', license: 'open'});
  assert.equal(openCodeBal.picks[2].badgeZh, '能力上限参照', 'open coding-api Slot 2 must not steal the expensive ceiling from Slot 3');

  // 7. Research Slot 2 avoids severe-hallucination efficiency traps when low-hallucination options exist
  assert.ok((res.picks[1].row.subscores?.hallucination ?? 0) < 45, `research/sub efficiency pick (${res.picks[1].row.name}) should avoid >=45% hallucination`);

  // 8. Video picks never surface I2V-only models as general video generation Slot 1, and media step-up badges only appear for strictly higher scores
  for (const b of RECOMMEND_BILLING) {
    const vid = recommendModels(snapshot, {useCase: 'video', billing: b.id, license: 'all'});
    assert.ok(vid.picks[0].row.mediaScores?.t2v != null, `video/${b.id} primary pick (${vid.picks[0].row.name}) must support text-to-video`);
    for (const track of ['image', 'video', 'tts']) {
      for (const lic of RECOMMEND_LICENSES) {
        const m = recommendModels(snapshot, {useCase: track, billing: b.id, license: lic.id});
        if (m.picks[2]?.badgeZh === '进阶参照') {
          assert.ok(m.picks[2].score > m.picks[0].score, `${track}/${b.id}/${lic.id} step-up pick must strictly outscore primary`);
        }
      }
    }
  }
});

test('recommendModels discounts downward-inherited Max chat ranks, high quota burn & high hallucination in sub mode', () => {
  const synth = {
    models: [
      {
        id: 'expensive-max',
        name: 'Expensive Max',
        shortName: 'Expensive (max)',
        intelligenceIndex: 65,
        cost: 26,
        isOpenWeights: false,
        creator: {name: 'VendorA'},
        family: {slug: 'expensive'},
        effort: {slug: 'max', label: 'max', level: 60},
        subscores: {hallucination: 58}
      },
      {
        id: 'expensive-high',
        name: 'Expensive High',
        shortName: 'Expensive (high)',
        intelligenceIndex: 61.9,
        cost: 9.2,
        isOpenWeights: false,
        creator: {name: 'VendorA'},
        family: {slug: 'expensive'},
        effort: {slug: 'high', label: 'high', level: 40},
        subscores: {hallucination: 58}
      },
      {
        id: 'balanced-high',
        name: 'Balanced High',
        shortName: 'Balanced (high)',
        intelligenceIndex: 59.5,
        cost: 3.7,
        isOpenWeights: false,
        creator: {name: 'VendorB'},
        family: {slug: 'balanced'},
        effort: {slug: 'high', label: 'high', level: 40},
        subscores: {hallucination: 14}
      },
      {
        id: 'balanced-xhigh',
        name: 'Balanced XHigh',
        shortName: 'Balanced (xhigh)',
        intelligenceIndex: 61.4,
        cost: 6.4,
        isOpenWeights: false,
        creator: {name: 'VendorB'},
        family: {slug: 'balanced'},
        effort: {slug: 'xhigh', label: 'xhigh', level: 50},
        subscores: {hallucination: 14},
        livebench: {rank: 1, overall: 87}
      },
      {
        id: 'cheap-eff',
        name: 'Cheap Eff',
        shortName: 'Cheap (medium)',
        intelligenceIndex: 52.5,
        cost: 0.4,
        isOpenWeights: false,
        creator: {name: 'VendorC'},
        family: {slug: 'cheap'},
        effort: {slug: 'medium', label: 'medium', level: 30},
        subscores: {hallucination: 42}
      }
    ],
    orgLeaderboards: {
      arenaChat: {
        rows: [
          {rank: 3, modelId: 'balanced-high', score: 1515},
          {rank: 7, modelId: 'expensive-max', score: 1503}
        ]
      },
      livebench: {
        rows: [
          {rank: 1, modelId: 'balanced-xhigh', score: 87},
          {rank: 2, modelId: 'expensive-max', score: 85}
        ]
      }
    }
  };

  const subRes = recommendModels(synth, {useCase: 'general', billing: 'sub', license: 'all'});
  assert.equal(subRes.picks[0].row.id, 'balanced-xhigh', 'upward-inherited Top-3 chat + exact LB2 #1 + lower burn/hallucination beats downward-inherited high-burn sibling');
  assert.equal(subRes.picks[2].row.id, 'expensive-max', 'true capability ceiling stays in Slot 3');

  const balRes = recommendModels(synth, {useCase: 'general', billing: 'api-balanced', license: 'all'});
  assert.equal(balRes.picks[0].row.id, 'balanced-high', 'api-balanced prefers exact Arena Chat #3 over downward-inherited siblings');
});

test('recommendModels penalizes severe cross-org divergence and ultra-slow thinking latency on interactive tracks', () => {
  const synth = {
    models: [
      {
        id: 'exam-specialist',
        name: 'Exam Specialist',
        shortName: 'Exam Specialist',
        intelligenceIndex: 60.8,
        cost: 4.0,
        timeSec: 700,
        isOpenWeights: false,
        creator: {name: 'VendorA'},
        family: {slug: 'exam-spec'},
        subscores: {hallucination: 20}
      },
      {
        id: 'slow-thinker',
        name: 'Slow Thinker',
        shortName: 'Slow Thinker',
        intelligenceIndex: 60.5,
        cost: 4.0,
        timeSec: 2880,
        isOpenWeights: false,
        creator: {name: 'VendorB'},
        family: {slug: 'slow-thinker'},
        subscores: {hallucination: 20}
      },
      {
        id: 'fast-consensus',
        name: 'Fast Consensus',
        shortName: 'Fast Consensus',
        intelligenceIndex: 60.0,
        cost: 4.0,
        timeSec: 720,
        isOpenWeights: false,
        creator: {name: 'VendorC'},
        family: {slug: 'fast-cons'},
        subscores: {hallucination: 20}
      }
    ],
    humanArenaModels: [
      {
        id: 'slow-writer',
        name: 'Slow Writer',
        shortName: 'Slow Writer',
        intelligenceIndex: 78.6,
        aaIndex: 58,
        cost: 4.0,
        timeSec: 2880,
        isOpenWeights: false,
        creator: {name: 'VendorA'},
        family: {slug: 'slow-writer'},
        humanScores: {chatVibe: 78.6, antiSlop: 80},
        arenaRaw: {slop: 20}
      },
      {
        id: 'snappy-writer',
        name: 'Snappy Writer',
        shortName: 'Snappy Writer',
        intelligenceIndex: 78.0,
        aaIndex: 58,
        cost: 4.0,
        timeSec: 600,
        isOpenWeights: false,
        creator: {name: 'VendorB'},
        family: {slug: 'snappy-writer'},
        humanScores: {chatVibe: 78.0, antiSlop: 80},
        arenaRaw: {slop: 20}
      }
    ],
    orgLeaderboards: {
      arenaChat: {
        rows: [
          {rank: 6, modelId: 'fast-consensus', score: 1505},
          {rank: 7, modelId: 'slow-thinker', score: 1504},
          {rank: 8, modelId: 'exam-specialist', score: 1503}
        ]
      }
    }
  };
  const divergenceRows = [
    {modelId: 'exam-specialist', familySlug: 'exam-spec', gap: -35, kind: 'auto'},
    {modelId: 'slow-thinker', familySlug: 'slow-thinker', gap: 0, kind: 'balanced'},
    {modelId: 'fast-consensus', familySlug: 'fast-cons', gap: -1, kind: 'consensus'}
  ];

  const genRes = recommendModels(synth, {useCase: 'general', billing: 'sub', license: 'all'}, {divergenceRows});
  assert.equal(genRes.picks[0].row.id, 'fast-consensus', 'general/sub prefers fast cross-org consensus over hard-exam specialist and 48m ultra-slow model');

  const wrtRes = recommendModels(synth, {useCase: 'writing', billing: 'sub', license: 'all'});
  assert.equal(wrtRes.picks[0].row.id, 'snappy-writer', 'writing/sub prefers responsive writer over 48m slow model at near-identical chat score');
  assert.ok(wrtRes.picks.some(p => p.row.id === 'slow-writer' && p.caveats.some(c => c.zh.includes('耗时偏长'))), 'slow writer surfaces latency caveat');
});

test('computeOrgDivergence eliminates board-size bias and surfaces human favorites, hard specialists, and consensus leaders', async () => {
  // Synthetic bias test: identical ordering across a 100-row AA board and a 10-row Arena board must yield gap = 0
  const syntheticBoards = [
    {id: 'aa', shortTag: 'AA', rows: []},
    {id: 'arenaChat', shortTag: 'Chat', rows: []}
  ];
  const synIndex = new Map([
    ['m1', {name: 'M1', shortName: 'M1', creator: 'A', ranks: {aa: {rank: 1, exact: true, score: 90}, arenaChat: {rank: 1, exact: true, score: 1500}}}],
    ['m2', {name: 'M2', shortName: 'M2', creator: 'B', ranks: {aa: {rank: 50, exact: true, score: 60}, arenaChat: {rank: 5, exact: true, score: 1300}}}],
    ['m3', {name: 'M3', shortName: 'M3', creator: 'C', ranks: {aa: {rank: 100, exact: true, score: 30}, arenaChat: {rank: 10, exact: true, score: 1100}}}]
  ]);
  const syn = computeOrgDivergence(syntheticBoards, synIndex, new Map());
  for (const r of syn.rows) {
    assert.equal(r.gap, 0, `identical peer order across different board sizes must have zero gap, got ${r.gap} for ${r.name}`);
  }

  // Live snapshot divergence sanity check
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  const baseById = new Map(snapshot.models.map(m => [m.id, m]));
  const aaSorted = [...snapshot.models].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex);
  const orgBoards = [
    {id: 'aa', shortTag: 'AA'},
    {id: 'livebench', shortTag: 'LB2'},
    {id: 'arenaChat', shortTag: 'Chat'},
    {id: 'arenaWebdev', shortTag: 'WebDev'},
    {id: 'designArena', shortTag: 'Design'}
  ];
  const idx = new Map();
  const addRank = (modelId, bId, rank, score) => {
    const m = baseById.get(modelId);
    if (!m) return;
    if (!idx.has(modelId)) {
      idx.set(modelId, {name: m.name, shortName: m.shortName || m.name, creator: m.creator?.name || 'Other', familySlug: m.family?.slug || null, cost: m.cost, ranks: {}});
    }
    if (!idx.get(modelId).ranks[bId]) idx.get(modelId).ranks[bId] = {rank, score, exact: true};
  };
  aaSorted.forEach((m, i) => addRank(m.id, 'aa', i + 1, m.intelligenceIndex));
  for (const [bId, key] of [['livebench', 'livebench'], ['arenaChat', 'arenaChat'], ['arenaWebdev', 'arenaWebdev'], ['designArena', 'designArena']]) {
    (snapshot.orgLeaderboards?.[key]?.rows || []).forEach((r, i) => {
      if (r.modelId) addRank(r.modelId, bId, r.rank || (i + 1), r.score);
    });
  }

  const live = computeOrgDivergence(orgBoards, idx, baseById);
  assert.ok(live.rows.length >= 25, `expected >= 25 cross-evaluated families, got ${live.rows.length}`);
  assert.ok(live.topHumanFavorite && live.topHumanFavorite.gap > 10, 'live data surfaces a clear human-favorite sleeper');
  assert.ok(live.topHardSpecialist && live.topHardSpecialist.gap < -10, 'live data surfaces a clear hard-eval specialist');
  assert.ok(live.topConsensus && live.topConsensus.autoPct >= 65 && live.topConsensus.humanPct >= 65, 'live data surfaces a cross-org consensus leader');
  // Mutual exclusivity: consensus rows never overlap with human (gap >= 8) or auto (gap <= -8)
  for (const r of live.rows) {
    if (r.kind === 'consensus') {
      assert.ok(Math.abs(r.gap) < 8, `consensus row ${r.name} must have |gap| < 8, got ${r.gap}`);
    }
    if (r.gap >= 8) assert.equal(r.kind, 'human');
    if (r.gap <= -8) assert.equal(r.kind, 'auto');
  }
  assert.equal(live.counts.human, live.rows.filter(r => r.kind === 'human').length);
  assert.equal(live.counts.auto, live.rows.filter(r => r.kind === 'auto').length);
});

test('createNavHistory coalesces nested actions, supports back/forward/popstate, truncates forward tail, and enforces maxStack', () => {
  let current = {tab: 'models', view: 'chart', lens: ''};
  const restored = [];
  const fakeEntries = [];
  let fakePos = -1;
  let nav;
  const mockHistory = {
    get state() { return fakeEntries[fakePos]?.state ?? null; },
    replaceState(st, _t, url) {
      if (fakePos < 0) {
        fakeEntries.push({state: st, url});
        fakePos = 0;
      } else {
        fakeEntries[fakePos] = {state: st, url};
      }
    },
    pushState(st, _t, url) {
      fakeEntries.length = fakePos + 1;
      fakeEntries.push({state: st, url});
      fakePos = fakeEntries.length - 1;
    },
    back() {
      if (fakePos > 0) {
        fakePos--;
        nav.handlePopState(fakeEntries[fakePos].state);
      }
    },
    forward() {
      if (fakePos < fakeEntries.length - 1) {
        fakePos++;
        nav.handlePopState(fakeEntries[fakePos].state);
      }
    }
  };

  nav = createNavHistory({
    captureSnapshot: () => ({...current}),
    signatureOf: s => `${s.tab}|${s.view}|${s.lens}`,
    restoreSnapshot: (s, dir) => {
      current = {...s};
      restored.push({dir, snap: {...s}});
    },
    buildUrlHash: () => `#${current.tab}`,
    historyApi: mockHistory,
    locationApi: {pathname: '/', search: ''},
    maxStack: 4
  });

  nav.init();
  assert.equal(nav.canBack(), false);
  assert.equal(nav.canForward(), false);

  // Nested re-entrant action should create ONLY ONE stack entry
  nav.runAction(() => {
    current.tab = 'orgs';
    nav.runAction(() => { current.view = 'orgs'; });
  });
  assert.equal(nav.getState().stack.length, 2);
  assert.equal(nav.canBack(), true);

  // No-op action does not duplicate entry
  nav.runAction(() => {});
  assert.equal(nav.getState().stack.length, 2);

  // Navigate to media -> back -> forward -> new jump truncates forward tail
  nav.runAction(() => { current = {tab: 'media', view: 'chart', lens: 't2i'}; });
  assert.equal(nav.getState().stack.length, 3);
  assert.equal(nav.back(), true);
  assert.deepEqual(current, {tab: 'orgs', view: 'orgs', lens: ''});
  assert.equal(nav.canForward(), true);
  assert.equal(nav.forward(), true);
  assert.deepEqual(current, {tab: 'media', view: 'chart', lens: 't2i'});

  nav.back();
  nav.runAction(() => { current = {tab: 'cyber', view: 'table', lens: ''}; });
  assert.equal(nav.canForward(), false, 'new navigation clears forward history');
  assert.equal(nav.getState().stack.at(-1).snap.tab, 'cyber');

  // Verify maxStack = 4 bounding
  nav.runAction(() => { current = {tab: 'frontier', view: 'chart', lens: ''}; });
  nav.runAction(() => { current = {tab: 'human-arena', view: 'chart', lens: ''}; });
  assert.equal(nav.getState().stack.length, 4, 'stack is capped at maxStack');
});

test('guide-content exports complete bilingual metadata, ordered profile chips, and wired recipe runners', async () => {
  const expectedKeys = ['models', 'frontier', 'human-arena', 'coding-agents', 'cyber', 'media:image', 'media:video', 'media:tts', 'orgs'];
  assert.deepEqual(GUIDE_PROFILE_ORDER, expectedKeys, 'GUIDE_PROFILE_ORDER lists all 9 tabs/tracks in display order');
  for (const k of expectedKeys) {
    assert.ok(GUIDE_TAB_META[k], `missing GUIDE_TAB_META.${k}`);
    assert.ok(GUIDE_TAB_META[k].shortZh && GUIDE_TAB_META[k].shortEn, `${k} has short bilingual chip labels`);
    assert.ok(GUIDE_TAB_META[k].recipes.length >= 3, `${k} has at least 3 recipes`);
  }
  const allIds = Object.values(GUIDE_TAB_META).flatMap(m => m.recipes.map(r => r.id));
  assert.equal(new Set(allIds).size, allIds.length, 'all recipe IDs must be unique');
  const appSrc = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  for (const id of allIds) {
    assert.ok(appSrc.includes(`'${id}':`), `missing GUIDE_RECIPE_RUNNERS handler for recipe "${id}"`);
  }
  assert.ok(GUIDE_GLOSSARY.length >= 7);
});

test('updates module builds chronologically sorted feed, classifies upstream types, and resolves rich details for every item', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  const feed = buildUpdateFeed(snapshot);

  assert.equal(UPDATE_FILTERS.length, 4);
  assert.equal(feed.counts.all, feed.items.length);
  assert.equal(feed.counts.diff, feed.diffItems.length);
  assert.equal(feed.counts.official, feed.officialItems.length);
  assert.equal(feed.counts.diff + feed.counts.official, feed.counts.all);

  // Verify chronological DESC ordering on diffEvents (no out-of-order 10-07 interrupting 11-19 / 11-18)
  for (let i = 1; i < feed.diffItems.length; i++) {
    assert.ok(
      feed.diffItems[i - 1].date >= feed.diffItems[i].date,
      `diffItems must be sorted by date DESC: ${feed.diffItems[i - 1].date} >= ${feed.diffItems[i].date}`
    );
  }

  // Verify upstream type normalization
  assert.equal(normalizeChangelogType('articlePublished').kind, 'article');
  assert.equal(normalizeChangelogType('articlePublished').zh, '深度评测');
  assert.equal(normalizeChangelogType('modelAdded').kind, 'model-added');
  assert.equal(normalizeChangelogType('modelAdded').zh, '新收录模型');
  assert.equal(normalizeChangelogType('benchmark').kind, 'benchmark');

  // Verify category filters match counts exactly
  for (const f of UPDATE_FILTERS) {
    assert.equal(filterUpdateFeed(feed.items, f.id).length, feed.counts[f.id], `filter ${f.id} count matches`);
  }

  // Every single item in live current.json resolves cleanly without errors
  for (const entry of feed.items) {
    const detail = resolveUpdateDetail(entry, snapshot, {feedItems: feed.items});
    assert.ok(detail && detail.entry.key === entry.key, `detail resolved for ${entry.key}`);
    if (entry.source === 'diff') {
      assert.ok(detail.diffSummary, `diffSummary present for ${entry.key}`);
      if (entry.kind === 'price-up' || entry.kind === 'price-drop') {
        assert.ok(detail.diffSummary.oldCost > 0 && detail.diffSummary.newCost > 0);
        assert.ok(detail.diffSummary.oldBreakeven20 >= 1 && detail.diffSummary.newBreakeven20 >= 1);
      }
    }
  }

  // Specific verification on price-up diff: Gemini 4 Argon (medium) $4.3146 -> $8.6292 (+100%, $20 breakeven 5 -> 3)
  const argonDiff = feed.diffItems.find(it => it.title.includes('Gemini 4 Argon (medium)'));
  assert.ok(argonDiff, 'found Gemini 4 Argon (medium) diff event');
  const argonDetail = resolveUpdateDetail(argonDiff, snapshot, {feedItems: feed.items});
  assert.equal(argonDetail.diffSummary.oldBreakeven20, 5);
  assert.equal(argonDetail.diffSummary.newBreakeven20, 3);
  assert.ok(argonDetail.primaryModel?.scoreRank >= 1 && argonDetail.primaryModel.suiteTotal > 50);
  assert.ok(argonDetail.primaryModel.siblings.length >= 2, 'resolves sibling effort variants');

  // Specific verification on span-aware article matching:
  // 1) "Inkling 2 Mini" article must NOT falsely match parent "Inkling" family
  const inklingArt = feed.officialItems.find(it => it.kind === 'article' && it.title.includes('Inkling 2 Mini'));
  assert.ok(inklingArt, 'found Inkling 2 Mini article');
  const inklingDetail = resolveUpdateDetail(inklingArt, snapshot, {feedItems: feed.items});
  assert.equal(inklingDetail.matchedModels.length, 1, 'matches only Inkling 2 Mini, not shorter Inkling substring');
  assert.equal(inklingDetail.matchedModels[0].row.name, 'Inkling 2 Mini');

  // 2) "Gemini 4 Neon" article matches all 4 effort tiers
  const neonArt = feed.officialItems.find(it => it.kind === 'article' && it.title.includes('Gemini 4 Neon'));
  assert.ok(neonArt, 'found Gemini 4 Neon article');
  const neonDetail = resolveUpdateDetail(neonArt, snapshot, {feedItems: feed.items});
  assert.equal(neonDetail.matchedModels.length, 4, 'matches all 4 Gemini 4 Neon effort tiers');
  assert.equal(neonDetail.articleStats.familyCount, 1);

  // 3) "GPT-6.2 Astra and GPT-6.2 Sol" article matches BOTH families and carries rich list preview
  const gptArt = feed.officialItems.find(it => it.kind === 'article' && it.title.includes('GPT-6.2 Astra'));
  assert.ok(gptArt, 'found GPT-6.2 Astra & Sol article');
  assert.equal(gptArt.preview?.kind, 'article');
  assert.ok(gptArt.preview.familyCount >= 2 && gptArt.preview.variantCount >= 4);
  const neonModelItem = feed.officialItems.find(it => it.kind === 'model-added' && it.title === 'Gemini 4 Neon (Xhigh)');
  assert.equal(neonModelItem?.preview?.kind, 'model');
  assert.ok(neonModelItem.preview.score > 50 && neonModelItem.preview.cost > 0);
  const gptDetail = resolveUpdateDetail(gptArt, snapshot, {feedItems: feed.items});
  assert.ok(gptDetail.articleStats.familyCount >= 2, 'matches both GPT-6.2 Astra and GPT-6.2 Sol families');

  // 4) Unpriced modelAdded item (e.g. JoyAI-VL-Preview) returns graceful unplotted metadata + hypothetical rank when enriched
  const unpricedEntry = {
    key: 'log:test:unpriced',
    source: 'official',
    kind: 'model-added',
    rawType: 'modelAdded',
    typeLabel: {zh: '新收录模型', en: 'Model Added'},
    date: '2026-11-17',
    title: 'JoyAI-VL-Preview',
    url: 'https://artificialanalysis.ai/models/joyai-vl',
    meta: {creator: 'Joy Future Academy', score: 28.04, hasPricing: false, isOpenWeights: false}
  };
  const unpricedDetail = resolveUpdateDetail(unpricedEntry, snapshot, {feedItems: feed.items});
  assert.equal(unpricedDetail.primaryModel, null);
  assert.ok(unpricedDetail.unplotted && unpricedDetail.unplotted.hypotheticalRank >= 1);
  assert.ok(unpricedDetail.unplotted.reasonZh.includes('计费数据'));
});
