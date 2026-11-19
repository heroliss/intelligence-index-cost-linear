import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  RECOMMEND_USE_CASES,
  RECOMMEND_BUDGETS,
  RECOMMEND_LICENSES,
  recommendModels
} from '../modules/recommend.mjs';
import {computeOrgDivergence} from '../modules/divergence.mjs';
import {createNavHistory} from '../modules/nav-history.mjs';
import {GUIDE_TAB_META, GUIDE_GLOSSARY} from '../modules/guide-content.mjs';

test('recommendModels returns strictly distinct, license-compliant picks across all 72 live combinations', async () => {
  const snapshot = JSON.parse(await readFile(new URL('../data/current.json', import.meta.url), 'utf8'));
  // Hydrate humanScores onto models just like the app does for coding/research scenarios
  const humanById = new Map((snapshot.humanArenaModels || []).map(h => [h.id, h]));
  snapshot.models = snapshot.models.map(m => {
    const h = humanById.get(m.id);
    return h?.humanScores ? {...m, humanScores: h.humanScores} : m;
  });

  let comboCount = 0;
  for (const uc of RECOMMEND_USE_CASES) {
    for (const bud of RECOMMEND_BUDGETS) {
      for (const lic of RECOMMEND_LICENSES) {
        comboCount++;
        const res = recommendModels(snapshot, {useCase: uc.id, budget: bud.id, license: lic.id});
        assert.equal(res.useCase.id, uc.id);
        assert.equal(res.budget.id, bud.id);
        assert.equal(res.license.id, lic.id);
        if (res.totalPool > 0) {
          assert.ok(res.picks.length >= 1 && res.picks.length <= 3, `expected 1..3 picks for ${uc.id}/${bud.id}/${lic.id}`);
          const ids = new Set(res.picks.map(p => p.row.id));
          assert.equal(ids.size, res.picks.length, `picks must be unique for ${uc.id}/${bud.id}/${lic.id}`);
          for (const p of res.picks) {
            assert.ok(p.row.cost > 0 && Number.isFinite(p.score), 'every pick has valid cost & score');
            if (lic.id === 'open') assert.equal(!!p.row.isOpenWeights, true, `open filter respected in ${uc.id}`);
            if (lic.id === 'closed') assert.equal(!!p.row.isOpenWeights, false, `closed filter respected in ${uc.id}`);
            assert.ok(p.reason.zh.length > 4 && p.reason.en.length > 4, 'pick has bilingual rationale');
          }
          if (bud.id === 'flagship' && res.picks.length >= 2) {
            assert.ok(res.picks[0].score >= res.picks[1].score - 1e-6, 'flagship budget puts highest score first');
          }
        }
      }
    }
  }
  assert.equal(comboCount, 72);
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

test('guide-content exports complete bilingual metadata and unique recipe IDs', () => {
  const expectedKeys = ['models', 'frontier', 'human-arena', 'coding-agents', 'cyber', 'media:image', 'media:video', 'media:tts', 'orgs'];
  for (const k of expectedKeys) {
    assert.ok(GUIDE_TAB_META[k], `missing GUIDE_TAB_META.${k}`);
    assert.ok(GUIDE_TAB_META[k].recipes.length >= 3, `${k} has at least 3 recipes`);
  }
  const allIds = Object.values(GUIDE_TAB_META).flatMap(m => m.recipes.map(r => r.id));
  assert.equal(new Set(allIds).size, allIds.length, 'all recipe IDs must be unique');
  assert.ok(GUIDE_GLOSSARY.length >= 7);
});
