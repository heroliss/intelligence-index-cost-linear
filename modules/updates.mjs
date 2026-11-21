import {paretoFrontier, breakEvenTasks} from '../chart-math.mjs?v=20261122-04';
import {getRowCaveats} from './recommend.mjs?v=20261122-04';

export const UPDATE_FILTERS = Object.freeze([
  Object.freeze({id: 'all', zh: '全部动态', en: 'All Updates'}),
  Object.freeze({id: 'diff', zh: '实况变动', en: 'Live Diffs'}),
  Object.freeze({id: 'price', zh: '价格调整', en: 'Price Shifts'}),
  Object.freeze({id: 'official', zh: '官方公告', en: 'Official Feed'})
]);

const SUITE_KEY_BY_TAB = Object.freeze({
  models: 'models',
  frontier: 'frontierModels',
  'human-arena': 'humanArenaModels',
  'coding-agents': 'codingAgents',
  cyber: 'cyberModels',
  media: 'mediaModels'
});

const TAB_LABELS = Object.freeze({
  models: {zh: '综合智能', en: 'Intelligence'},
  frontier: {zh: '前沿极限', en: 'Frontier Hard'},
  'human-arena': {zh: '人类审美', en: 'Human Arena'},
  'coding-agents': {zh: '编程智能体', en: 'Coding Agents'},
  cyber: {zh: '网络安全', en: 'Cyber'},
  media: {zh: '多模态生成', en: 'Multimodal'}
});

const MEDIA_KIND_LABELS = Object.freeze({
  image: {zh: '图像生成', en: 'Image'},
  video: {zh: '视频生成', en: 'Video'},
  tts: {zh: '语音 TTS', en: 'TTS'}
});

export function normalizeChangelogType(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  const low = s.toLowerCase();
  if (low === 'articlepublished' || low === 'article' || low === 'blog') {
    return {kind: 'article', zh: '深度评测', en: 'Article'};
  }
  if (low === 'modeladded' || low === 'model') {
    return {kind: 'model-added', zh: '新收录模型', en: 'Model Added'};
  }
  if (low === 'benchmark' || low === 'index') {
    return {kind: 'benchmark', zh: '基准更新', en: 'Benchmark'};
  }
  if (low === 'agent' || low === 'codingagent') {
    return {kind: 'agent', zh: '智能体', en: 'Agent'};
  }
  return {kind: 'update', zh: '官方动态', en: 'Update'};
}

export function tabTagFor(tab, mediaKind = null) {
  if (tab === 'media') {
    const mk = MEDIA_KIND_LABELS[mediaKind];
    if (mk) return mk;
  }
  return TAB_LABELS[tab] || TAB_LABELS.models;
}

function isAlnum(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 122);
}

function normalizeName(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function diffPriority(ev) {
  const kindW = ev.kind === 'price-drop' ? 40 : ev.kind === 'price-up' ? 35 : ev.kind === 'new' ? 30 : 20;
  const tabW = ev.tab === 'models' ? 12 : ev.tab === 'coding-agents' ? 8 : 4;
  return kindW + tabW + Math.min(20, (Number(ev.score) || 0) / 5);
}

function extractUrlSlug(url) {
  if (typeof url !== 'string' || !url) return null;
  const m = url.match(/\/(?:models|articles)\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

function medianOf(nums) {
  const arr = nums.filter(n => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function getSuiteRows(snapshot, tab) {
  const key = SUITE_KEY_BY_TAB[tab] || 'models';
  const rows = snapshot?.[key];
  return Array.isArray(rows) ? rows : [];
}

function peerPoolFor(snapshot, tab, row) {
  const rows = getSuiteRows(snapshot, tab);
  if (tab === 'media' && row?.mediaKind) {
    return rows.filter(r => r.mediaKind === row.mediaKind);
  }
  return rows;
}

function computeModelContext(row, tab, snapshot, {crossTabIndex, orgRankIndex} = {}) {
  const pool = peerPoolFor(snapshot, tab, row);
  const byScore = [...pool].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex || a.cost - b.cost);
  const rankIdx = byScore.findIndex(r => r.id === row.id);
  const scoreRank = rankIdx >= 0 ? rankIdx + 1 : null;
  const suiteTotal = byScore.length;

  const frontier = paretoFrontier(pool, r => r.cost);
  const isPareto = frontier.some(r => r.id === row.id);
  const medianCost = medianOf(pool.map(r => r.cost));
  const costVsMedian = medianCost && medianCost > 0 && Number.isFinite(row.cost)
    ? row.cost / medianCost
    : null;

  let siblings = [];
  if (row.family?.slug) {
    const famRows = pool.filter(r => r.family?.slug === row.family.slug);
    if (famRows.length >= 2) {
      siblings = [...famRows].sort((a, b) => {
        const la = a.effort?.level ?? 999;
        const lb = b.effort?.level ?? 999;
        return la - lb || a.intelligenceIndex - b.intelligenceIndex || a.cost - b.cost;
      });
    }
  }

  const isLlmTab = !['coding-agents', 'media'].includes(tab);
  const crossInfo = isLlmTab ? (crossTabIndex?.get(row.id) || null) : null;
  const hasOrgRanks = isLlmTab && Boolean(orgRankIndex?.has(row.id) || row.livebench);
  const caveats = getRowCaveats(snapshot, row, tab, {orgRankIndex});

  const subscoreHighlights = buildSubscoreHighlights(row, tab);
  const costAnatomy = buildCostAnatomy(row, tab);
  const mediaMetrics = tab === 'media' ? buildMediaMetrics(row) : null;
  const agentMetrics = tab === 'coding-agents' ? buildAgentMetrics(row) : null;

  return {
    row,
    tab,
    mediaKind: row.mediaKind || null,
    scoreRank,
    suiteTotal,
    isPareto,
    medianCost,
    costVsMedian,
    siblings,
    crossInfo,
    hasOrgRanks,
    caveats,
    subscoreHighlights,
    costAnatomy,
    mediaMetrics,
    agentMetrics
  };
}

function buildSubscoreHighlights(row, tab) {
  const out = [];
  if (tab === 'coding-agents') {
    if (Array.isArray(row.evalScores)) {
      for (const ev of row.evalScores) {
        if (ev?.name && Number.isFinite(ev.score)) {
          out.push({key: ev.name, zh: ev.name, en: ev.name, value: ev.score, max: 100, unit: '%'});
        }
      }
    }
    return out;
  }
  if (tab === 'media') {
    const ms = row.mediaScores || {};
    const defs = [
      ['t2i', '文生图 T2I', 'Text-to-Image'],
      ['imgEdit', '图像编辑 Edit', 'Image Editing'],
      ['t2v', '文生视频 T2V', 'Text-to-Video'],
      ['i2v', '图生视频 I2V', 'Image-to-Video'],
      ['vidEdit', '视频编辑 Edit', 'Video Editing'],
      ['tts', '语音合成 TTS', 'Text-to-Speech']
    ];
    for (const [k, zh, en] of defs) {
      if (Number.isFinite(ms[k])) out.push({key: k, zh, en, value: ms[k], max: 100, unit: ''});
    }
    return out;
  }

  const s = row.subscores || {};
  const hs = row.humanScores || {};
  const defs = [
    ['frontierCode', 'FrontierCode 2.0', 'FrontierCode 2.0', s.frontierCode, 100, false],
    ['terminalBench', 'Terminal 4.0', 'Terminal 4.0', s.terminalBench, 100, false],
    ['hleDiamond', 'HLE 极难科学', 'HLE Hard Science', s.hleDiamond, 100, false],
    ['critptAgentic', 'CritPt 推理', 'CritPt Agentic', s.critptAgentic, 100, false],
    ['omniscience', '全科闭卷知识', 'Omniscience', s.omniscience, 100, false],
    ['hallucination', '盲区幻觉率 (越低越好)', 'Hallucination Rate (lower=better)', s.hallucination, 100, true],
    ['mlcr', 'MLCR 百万长文', 'MLCR Long-Context', s.mlcr, 100, false],
    ['mmmuPro', 'MMMU-Pro 视觉', 'MMMU-Pro Vision', s.mmmuPro, 100, false],
    ['chatVibe', 'Arena 盲测聊天', 'Arena Blind Chat', hs.chatVibe, 100, false],
    ['webdev', 'WebDev 交互前端', 'WebDev Frontend', hs.webdev, 100, false],
    ['designWeb', 'Design 视觉审美', 'Design Aesthetics', hs.designWeb, 100, false],
    ['antiSlop', '去 AI 套话自然度', 'Anti-Slop Naturalness', hs.antiSlop, 100, false]
  ];
  for (const [key, zh, en, val, max, lowerIsBetter] of defs) {
    if (typeof val === 'number' && Number.isFinite(val)) {
      out.push({key, zh, en, value: val, max, lowerIsBetter, unit: key === 'hallucination' ? '%' : ''});
    }
  }
  if (row.livebench && Number.isFinite(row.livebench.overall)) {
    out.push({
      key: 'livebench',
      zh: `LiveBench 2.0 (#${row.livebench.rank})`,
      en: `LiveBench 2.0 (#${row.livebench.rank})`,
      value: row.livebench.overall,
      max: 100,
      lowerIsBetter: false,
      unit: ''
    });
  }
  return out.slice(0, 8);
}

function buildCostAnatomy(row, tab) {
  if (tab === 'coding-agents' && row.costPercentiles) {
    const p = row.costPercentiles;
    if (Number.isFinite(p.p50)) {
      return {
        kind: 'percentiles',
        p05: p.p05,
        p25: p.p25,
        p50: p.p50,
        p75: p.p75,
        p95: p.p95
      };
    }
    return null;
  }
  const cb = row.costBreakdown;
  if (!cb) return null;
  const input = Number.isFinite(cb.input) ? Math.max(0, cb.input) : 0;
  const reasoning = Number.isFinite(cb.reasoning) ? Math.max(0, cb.reasoning) : 0;
  const answer = Number.isFinite(cb.answer) ? Math.max(0, cb.answer) : 0;
  const sum = input + reasoning + answer;
  if (!(sum > 0)) return null;
  return {
    kind: 'breakdown',
    total: sum,
    segments: [
      {key: 'input', zh: '输入/缓存', en: 'Input / Cache', cost: input, pct: (input / sum) * 100},
      {key: 'reasoning', zh: '思考推理', en: 'Reasoning', cost: reasoning, pct: (reasoning / sum) * 100},
      {key: 'answer', zh: '正文输出', en: 'Answer', cost: answer, pct: (answer / sum) * 100}
    ].filter(seg => seg.cost > 0)
  };
}

function buildMediaMetrics(row) {
  const mr = row.mediaRaw;
  if (!mr) return null;
  const facts = [];
  if (Number.isFinite(mr.t2iElo)) facts.push({zh: '文生图 Elo', en: 'T2I Elo', text: String(Math.round(mr.t2iElo))});
  if (Number.isFinite(mr.imgEditElo)) facts.push({zh: '图像编辑 Elo', en: 'Edit Elo', text: String(Math.round(mr.imgEditElo))});
  if (Number.isFinite(mr.t2vElo)) facts.push({zh: '文生视频 Elo', en: 'T2V Elo', text: String(Math.round(mr.t2vElo))});
  if (Number.isFinite(mr.i2vElo)) facts.push({zh: '图生视频 Elo', en: 'I2V Elo', text: String(Math.round(mr.i2vElo))});
  if (Number.isFinite(mr.vidEditElo)) facts.push({zh: '视频编辑 Elo', en: 'Video Edit Elo', text: String(Math.round(mr.vidEditElo))});
  if (Number.isFinite(mr.ttsElo)) facts.push({zh: '语音盲测 Elo', en: 'TTS Elo', text: String(Math.round(mr.ttsElo))});
  if (Number.isFinite(mr.pricePer1k)) facts.push({zh: '每千张参考价', en: 'Per 1k images', text: `$${mr.pricePer1k}`});
  if (Number.isFinite(mr.pricePerMin)) facts.push({zh: '每分钟视频价', en: 'Per min video', text: `$${mr.pricePerMin}`});
  if (Number.isFinite(mr.pricePer1mChars)) facts.push({zh: '每百万字符价', en: 'Per 1M chars', text: `$${mr.pricePer1mChars}`});
  if (Number.isFinite(mr.ttfaMs)) facts.push({zh: '首字音频延迟', en: 'Time to first audio', text: `${Math.round(mr.ttfaMs)} ms`});
  if (Number.isFinite(mr.cps)) facts.push({zh: '生成语速', en: 'Speech speed', text: `${mr.cps.toFixed(1)} ch/s`});
  return {
    unitZh: mr.unitZh || '',
    unitEn: mr.unitEn || '',
    facts
  };
}

function buildAgentMetrics(row) {
  const st = row.agentStats;
  const facts = [];
  if (row.agentName) facts.push({zh: '智能体框架', en: 'Agent Harness', text: row.agentName});
  if (row.modelName) facts.push({zh: '底座模型', en: 'Base Model', text: row.modelName});
  if (Number.isFinite(row.benchmarkCount)) facts.push({zh: '覆盖基准数', en: 'Benchmarks', text: `${row.benchmarkCount}`});
  if (st && Number.isFinite(st.steps)) facts.push({zh: '平均执行步数', en: 'Avg Steps', text: st.steps.toFixed(1)});
  if (st && Number.isFinite(st.totalTokens)) {
    const mTok = st.totalTokens >= 1e6
      ? `${(st.totalTokens / 1e6).toFixed(2)}M`
      : `${Math.round(st.totalTokens / 1e3)}K`;
    facts.push({zh: '平均总 Token', en: 'Avg Total Tokens', text: mTok});
  }
  if (st && Number.isFinite(st.cacheHitRate)) facts.push({zh: '缓存命中率', en: 'Cache Hit Rate', text: `${Math.round(st.cacheHitRate)}%`});
  return facts.length ? facts : null;
}

function findRowForDiff(ev, snapshot) {
  const preferredTab = SUITE_KEY_BY_TAB[ev.tab] ? ev.tab : 'models';
  const tabsToSearch = [preferredTab, 'models', 'coding-agents', 'media', 'cyber'];
  const seenTabs = new Set();
  for (const tab of tabsToSearch) {
    if (seenTabs.has(tab)) continue;
    seenTabs.add(tab);
    const rows = getSuiteRows(snapshot, tab);
    const byId = rows.find(r => r.id === ev.id);
    if (byId) return {row: byId, tab};
  }
  const targetName = normalizeName(ev.name);
  if (targetName) {
    const rows = getSuiteRows(snapshot, preferredTab);
    const byName = rows.find(r => normalizeName(r.name) === targetName || normalizeName(r.shortName) === targetName);
    if (byName) return {row: byName, tab: preferredTab};
  }
  return null;
}

function findRowForOfficialModel(entry, snapshot) {
  const metaId = entry.meta?.modelId;
  const titleNorm = normalizeName(entry.title);
  const urlSlug = extractUrlSlug(entry.url);
  const tabs = ['models', 'coding-agents', 'media', 'cyber'];

  if (metaId) {
    for (const tab of tabs) {
      const hit = getSuiteRows(snapshot, tab).find(r => r.id === metaId);
      if (hit) return {row: hit, tab};
    }
  }
  if (titleNorm) {
    for (const tab of tabs) {
      const hit = getSuiteRows(snapshot, tab).find(
        r => normalizeName(r.name) === titleNorm || normalizeName(r.shortName) === titleNorm
      );
      if (hit) return {row: hit, tab};
    }
  }
  if (urlSlug) {
    const models = getSuiteRows(snapshot, 'models');
    const effortHint = titleNorm.match(/\((low|medium|high|xhigh|max|minimal|none|non-reasoning)\)/)?.[1] || null;
    const slugMatches = models.filter(r => normalizeName(r.slug) === urlSlug || normalizeName(r.family?.slug) === urlSlug);
    if (slugMatches.length === 1) {
      return {row: slugMatches[0], tab: 'models'};
    }
    if (slugMatches.length > 1 && effortHint) {
      const effHit = slugMatches.find(r => normalizeName(r.effort?.slug) === effortHint || normalizeName(r.effort?.label) === effortHint);
      if (effHit) return {row: effHit, tab: 'models'};
    }
  }
  return null;
}

function matchMentionedModels(title, url, snapshot) {
  const models = getSuiteRows(snapshot, 'models');
  const coding = getSuiteRows(snapshot, 'coding-agents');
  const media = getSuiteRows(snapshot, 'media');
  const allRows = [
    ...models.map(r => ({row: r, tab: 'models'})),
    ...coding.map(r => ({row: r, tab: 'coding-agents'})),
    ...media.map(r => ({row: r, tab: 'media'}))
  ];

  // Build candidate terms: family names first, then individual names; deduplicate per normalized term
  const termMap = new Map();
  const register = (rawTerm, entry, isFamily) => {
    const term = normalizeName(rawTerm);
    if (term.length < 4) return;
    if (!termMap.has(term)) {
      termMap.set(term, {term, entries: [], isFamily});
    }
    const bucket = termMap.get(term);
    if (!bucket.entries.some(e => e.row.id === entry.row.id && e.tab === entry.tab)) {
      bucket.entries.push(entry);
    }
  };

  for (const entry of allRows) {
    if (entry.row.family?.name) register(entry.row.family.name, entry, true);
    register(entry.row.name, entry, false);
    if (entry.row.shortName && entry.row.shortName !== entry.row.name) {
      register(entry.row.shortName, entry, false);
    }
  }

  // Prefer longest terms first so "Inkling 2 Mini" claims its span before shorter "Inkling"
  const candidates = [...termMap.values()].sort((a, b) => b.term.length - a.term.length);

  const scanText = rawText => {
    const text = normalizeName(rawText);
    if (!text) return [];
    const claimed = [];
    const matched = [];
    const overlaps = (s, e) => claimed.some(([cs, ce]) => s < ce && e > cs);

    for (const cand of candidates) {
      let from = 0;
      let hitThisTerm = false;
      while (from < text.length) {
        const idx = text.indexOf(cand.term, from);
        if (idx === -1) break;
        const end = idx + cand.term.length;
        const leftOk = idx === 0 || !isAlnum(text[idx - 1]);
        const rightOk = end === text.length || !isAlnum(text[end]);
        if (leftOk && rightOk && !overlaps(idx, end)) {
          claimed.push([idx, end]);
          hitThisTerm = true;
          break;
        }
        from = idx + 1;
      }
      if (hitThisTerm) {
        matched.push(...cand.entries);
      }
    }
    return matched;
  };

  let hits = scanText(title);
  if (!hits.length) {
    const slug = extractUrlSlug(url);
    if (slug) hits = scanText(slug.replace(/[-_]+/g, ' '));
  }

  // Prefer models tab rows when the same family also appears in coding agents, unless only coding agents matched
  const unique = [];
  const seen = new Set();
  for (const h of hits) {
    const k = `${h.tab}:${h.row.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(h);
  }
  const hasLlm = unique.some(h => h.tab === 'models');
  const filtered = hasLlm ? unique.filter(h => h.tab === 'models') : unique;
  filtered.sort((a, b) => b.row.intelligenceIndex - a.row.intelligenceIndex || a.row.cost - b.row.cost);
  return filtered;
}

export function buildUpdateFeed(snapshot) {
  const rawDiffs = Array.isArray(snapshot?.diffEvents) ? snapshot.diffEvents : [];
  const rawLogs = Array.isArray(snapshot?.changelog) ? snapshot.changelog : [];

  const diffItems = rawDiffs
    .filter(ev => ev && ev.id && ev.kind && ev.name)
    .map(ev => {
      const tab = SUITE_KEY_BY_TAB[ev.tab] ? ev.tab : 'models';
      const date = String(ev.date || '');
      return {
        key: `diff:${date}:${tab}:${ev.id}:${ev.kind}`,
        source: 'diff',
        kind: ev.kind,
        date,
        tab,
        mediaKind: ev.mediaKind || null,
        tabTag: tabTagFor(tab, ev.mediaKind),
        title: String(ev.name),
        creator: ev.creator || null,
        event: ev
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || diffPriority(b.event) - diffPriority(a.event));

  const officialItems = rawLogs
    .filter(item => item && item.title && item.date)
    .map((item, idx) => {
      const norm = normalizeChangelogType(item.type);
      const entry = {
        key: `log:${idx}:${item.date}:${item.type || 'update'}:${item.title}`,
        source: 'official',
        kind: norm.kind,
        rawType: item.type || 'update',
        typeLabel: {zh: norm.zh, en: norm.en},
        date: String(item.date),
        title: String(item.title),
        url: item.url || null,
        meta: item.meta || null,
        raw: item,
        preview: null,
        _idx: idx
      };
      if (snapshot) {
        if (norm.kind === 'model-added') {
          const hit = findRowForOfficialModel(entry, snapshot);
          if (hit?.row) {
            entry.preview = {
              kind: 'model',
              creator: hit.row.creator?.name || null,
              score: hit.row.intelligenceIndex,
              cost: hit.row.cost
            };
          } else if (entry.meta && (entry.meta.creator || Number.isFinite(entry.meta.score))) {
            entry.preview = {
              kind: 'meta',
              creator: entry.meta.creator || null,
              score: Number.isFinite(entry.meta.score) ? entry.meta.score : null
            };
          } else {
            entry.preview = {kind: 'unpriced'};
          }
        } else {
          const hits = matchMentionedModels(entry.title, entry.url, snapshot);
          if (hits.length) {
            const families = new Set(hits.map(h => h.row.family?.slug || h.row.id));
            entry.preview = {
              kind: 'article',
              familyCount: families.size,
              variantCount: hits.length,
              topName: hits[0].row.shortName || hits[0].row.name,
              topScore: hits[0].row.intelligenceIndex
            };
          }
        }
      }
      return entry;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a._idx - b._idx);

  const items = [...diffItems, ...officialItems];
  const counts = {
    all: items.length,
    diff: diffItems.length,
    price: diffItems.filter(it => it.kind === 'price-drop' || it.kind === 'price-up').length,
    official: officialItems.length
  };
  return {items, diffItems, officialItems, counts};
}

export function filterUpdateFeed(items, filterId = 'all') {
  if (!Array.isArray(items)) return [];
  if (filterId === 'diff') return items.filter(it => it.source === 'diff');
  if (filterId === 'price') return items.filter(it => it.source === 'diff' && (it.kind === 'price-drop' || it.kind === 'price-up'));
  if (filterId === 'official') return items.filter(it => it.source === 'official');
  return items;
}

export function resolveUpdateDetail(entry, snapshot, {crossTabIndex = null, orgRankIndex = null, feedItems = null} = {}) {
  if (!entry) return null;
  const allFeed = Array.isArray(feedItems) ? feedItems : buildUpdateFeed(snapshot).items;

  if (entry.source === 'diff') {
    const ev = entry.event;
    const found = findRowForDiff(ev, snapshot);
    const primaryModel = found
      ? computeModelContext(found.row, found.tab, snapshot, {crossTabIndex, orgRankIndex})
      : null;

    let diffSummary = null;
    if (ev.kind === 'price-drop' || ev.kind === 'price-up') {
      const oldCost = Number(ev.oldCost);
      const newCost = primaryModel ? primaryModel.row.cost : Number(ev.cost);
      const costDelta = Number.isFinite(oldCost) && Number.isFinite(newCost) ? newCost - oldCost : null;
      const pct = Number.isFinite(ev.pct)
        ? ev.pct
        : (oldCost > 0 && Number.isFinite(newCost) ? Math.round(((newCost - oldCost) / oldCost) * 100) : null);
      const oldBe = oldCost > 0 ? breakEvenTasks(oldCost, 20) : null;
      const newBe = newCost > 0 ? breakEvenTasks(newCost, 20) : null;
      const providers = primaryModel?.row?.providers;
      const cheaperHost = Array.isArray(providers) && providers.length >= 2 && providers[0].cost < newCost * 0.98
        ? providers[0]
        : null;
      diffSummary = {
        kind: ev.kind,
        oldCost: Number.isFinite(oldCost) ? oldCost : null,
        newCost: Number.isFinite(newCost) ? newCost : null,
        costDelta,
        pct,
        oldBreakeven20: Number.isFinite(oldBe) ? Math.ceil(oldBe) : null,
        newBreakeven20: Number.isFinite(newBe) ? Math.ceil(newBe) : null,
        cheaperHost
      };
    } else if (ev.kind === 'score') {
      const oldScore = Number(ev.oldScore);
      const newScore = primaryModel ? primaryModel.row.intelligenceIndex : Number(ev.score);
      const delta = Number.isFinite(ev.delta)
        ? ev.delta
        : (Number.isFinite(oldScore) && Number.isFinite(newScore) ? Number((newScore - oldScore).toFixed(1)) : null);
      diffSummary = {
        kind: 'score',
        oldScore: Number.isFinite(oldScore) ? oldScore : null,
        newScore: Number.isFinite(newScore) ? newScore : null,
        delta
      };
    } else {
      diffSummary = {
        kind: 'new',
        score: primaryModel ? primaryModel.row.intelligenceIndex : Number(ev.score),
        cost: primaryModel ? primaryModel.row.cost : Number(ev.cost)
      };
    }

    // Find related official announcements (matching exact model or family name)
    const famNorm = normalizeName(primaryModel?.row?.family?.name);
    const nameNorm = normalizeName(primaryModel?.row?.name || ev.name);
    const relatedFeed = allFeed.filter(other => {
      if (other.key === entry.key || other.source !== 'official') return false;
      const ot = normalizeName(other.title);
      return (nameNorm.length >= 4 && ot.includes(nameNorm)) || (famNorm.length >= 4 && ot.includes(famNorm));
    }).slice(0, 4);

    return {
      entry,
      detailKind: 'diff',
      diffSummary,
      primaryModel,
      matchedModels: [],
      relatedFeed,
      unplotted: !primaryModel ? {
        reasonZh: '该条目在更早的快照中被记录，目前可能已从最新上游榜单移除或更名。',
        reasonEn: 'This entry was captured in an earlier snapshot and is no longer present under the same ID in the latest leaderboard.'
      } : null
    };
  }

  // Official announcement: Model Added
  if (entry.kind === 'model-added') {
    const found = findRowForOfficialModel(entry, snapshot);
    const primaryModel = found
      ? computeModelContext(found.row, found.tab, snapshot, {crossTabIndex, orgRankIndex})
      : null;

    const relatedFeed = allFeed.filter(other => {
      if (other.key === entry.key) return false;
      if (other.source === 'diff' && primaryModel && other.event?.id === primaryModel.row.id) return true;
      if (other.source === 'official' && other.kind === 'article') {
        const famNorm = normalizeName(primaryModel?.row?.family?.name || entry.title.replace(/\s*\([^)]*\)\s*$/, ''));
        return famNorm.length >= 4 && normalizeName(other.title).includes(famNorm);
      }
      return false;
    }).slice(0, 4);

    let unplotted = null;
    if (!primaryModel) {
      const meta = entry.meta || null;
      const models = getSuiteRows(snapshot, 'models');
      let hypotheticalRank = null;
      if (meta && Number.isFinite(meta.score) && models.length) {
        hypotheticalRank = models.filter(m => m.intelligenceIndex > meta.score).length + 1;
      }
      const sameCreatorPeers = meta?.creator
        ? models
            .filter(m => m.creator?.name === meta.creator)
            .sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)
            .slice(0, 3)
            .map(row => ({row, tab: 'models'}))
        : [];
      unplotted = {
        meta,
        hypotheticalRank,
        suiteTotal: models.length,
        sameCreatorPeers,
        reasonZh: '该模型已被 Artificial Analysis 官方收录，但暂缺公开 API 单任务计费数据，因此暂未绘入“成本 vs 智能”散点图；待上游补全定价后将自动进入本页对比。',
        reasonEn: 'Listed on Artificial Analysis, but lacks public per-task API pricing data so it is not yet plotted on the Cost vs. Intelligence scatter chart. It will appear automatically once pricing is published.'
      };
    }

    return {
      entry,
      detailKind: 'official-model',
      diffSummary: null,
      primaryModel,
      matchedModels: [],
      relatedFeed,
      unplotted
    };
  }

  // Official announcement: Article / Benchmark / Update
  const matchedRaw = matchMentionedModels(entry.title, entry.url, snapshot);
  const matchedModels = matchedRaw.map(item =>
    computeModelContext(item.row, item.tab, snapshot, {crossTabIndex, orgRankIndex})
  );

  let articleStats = null;
  if (matchedModels.length) {
    const families = new Set(matchedModels.map(m => m.row.family?.slug || m.row.id));
    const best = matchedModels[0];
    const costs = matchedModels.map(m => m.row.cost).filter(c => Number.isFinite(c) && c > 0);
    const minCost = costs.length ? Math.min(...costs) : null;
    const maxCost = costs.length ? Math.max(...costs) : null;
    const openCount = matchedModels.filter(m => m.row.isOpenWeights).length;
    articleStats = {
      familyCount: families.size,
      variantCount: matchedModels.length,
      topRow: best.row,
      topRank: best.scoreRank,
      topSuiteTotal: best.suiteTotal,
      minCost,
      maxCost,
      openCount,
      tab: best.tab
    };
  }

  const matchedIdSet = new Set(matchedModels.map(m => m.row.id));
  const relatedFeed = allFeed.filter(other => {
    if (other.key === entry.key) return false;
    if (other.source === 'diff' && matchedIdSet.has(other.event?.id)) return true;
    return false;
  }).slice(0, 4);

  return {
    entry,
    detailKind: 'official-article',
    diffSummary: null,
    primaryModel: matchedModels.length === 1 ? matchedModels[0] : null,
    matchedModels,
    articleStats,
    relatedFeed,
    unplotted: null
  };
}
