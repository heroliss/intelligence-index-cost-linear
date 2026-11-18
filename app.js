import {
  ticks,
  paretoFrontier,
  dataBounds,
  effortTrajectories,
  historicalFrontierSummary,
  cascadingRouteSummary,
  clampView,
  pointerZoomView,
  validRows,
  sortRows,
  valuePerDollar,
  capabilityUtility,
  isoValueCost,
  breakEvenTasks,
  subscriptionVerdict,
  VALUE_WEIGHT,
  MIN_SCORE,
  MAX_COST_PRESETS,
  VALUE_PRESETS,
  SUBSCRIPTION_TIERS,
  MONTHLY_USAGE,
  TASK_VOLUME_PRESETS
} from './chart-math.mjs?v=20261118-16';

const $ = selector => document.querySelector(selector);
const svg = $('#svg'), host = $('#chart'), tip = $('#tip');
const NS = 'http://www.w3.org/2000/svg';

const BENCHMARKS = {
  models: {
    key: 'models',
    zhTitle: '综合智能指数与每任务成本',
    enTitle: 'Intelligence Index vs. Cost per Task',
    zhSub: 'Artificial Analysis Intelligence Index · 线性美元成本与耗时',
    enSub: 'Artificial Analysis Intelligence Index · Linear USD cost & latency',
    zhAxis: '综合智能指数',
    enAxis: 'Intelligence Index',
    zhUnit: '个模型',
    enUnit: 'models',
    zhCostNote: '智能指数基准任务的加权平均 API 成本',
    enCostNote: 'Weighted average API cost per Intelligence Index task',
    source: 'https://artificialanalysis.ai/',
    defaultX: 4.5,
    defaultTimeMin: 25
  },
  frontier: {
    key: 'frontierModels',
    zhTitle: '未饱和前沿极限基准与每任务成本',
    enTitle: 'Unsaturated Frontier Hard Index vs. Cost per Task',
    zhSub: '剔除 90%+ 已饱和旧题集 · 聚焦 GDP-PDF 全过 / FrontierCode 2.0 / Terminal 4.0 / CritPt / HLE 六大高区分度测试',
    enSub: 'Strips 90%+ saturated legacy tests · 6 high-spread suites (GDP-PDF / FrontierCode / Terminal 4 / CritPt / Automation / HLE)',
    zhAxis: '未饱和前沿极限指数',
    enAxis: 'Frontier Hard Index',
    zhUnit: '个前沿实测模型',
    enUnit: 'frontier models',
    zhCostNote: '横轴对齐标准化单任务 API 成本；专门拉开顶尖旗舰真实硬实力差距',
    enCostNote: 'Standardized API cost per task; isolates unsaturated SOTA capability spread',
    source: 'https://artificialanalysis.ai/methodology/intelligence-benchmarking',
    defaultX: 5,
    defaultTimeMin: 25
  },
  'human-arena': {
    key: 'humanArenaModels',
    zhTitle: '人类体感、视觉审美与真实交付指数 vs. 成本',
    enTitle: 'Human Blind Preference, Aesthetic Taste & Deliverable Arena vs. Cost',
    zhSub: '融合 LMArena 去水份盲测人味 + Design Arena 网页/UI 视觉审美 + GDPval/Briefcase 44 职业真实交付盲评',
    enSub: 'LMArena style-controlled blind votes + Design Arena UI/web aesthetics + GDPval/Briefcase expert deliverables',
    zhAxis: '人类审美与体感指数',
    enAxis: 'Human & Aesthetic Index',
    zhUnit: '个真人盲测模型',
    enUnit: 'blind-tested models',
    zhCostNote: '横轴为统一单任务 API 成本；悬停与剖析对比可查看各竞技场原始 Elo 与对决胜率',
    enCostNote: 'Standardized API cost/task on X-axis; hover & Compare show raw Elo & win rates',
    source: 'https://lmarena.ai/leaderboard',
    defaultX: 8,
    defaultTimeMin: 25
  },
  'coding-agents': {
    key: 'codingAgents',
    zhTitle: '编程智能体指数与每任务成本',
    enTitle: 'Coding Agent Index vs. Cost per Task',
    zhSub: 'Artificial Analysis Coding Agents · 线性美元成本与耗时',
    enSub: 'Artificial Analysis Coding Agents · Linear USD cost & wall time',
    zhAxis: '编程智能体指数',
    enAxis: 'Coding Agent Index',
    zhUnit: '个智能体变体',
    enUnit: 'agent variants',
    zhCostNote: '编程基准任务的平均 API 成本（非订阅月费）',
    enCostNote: 'Average API cost per coding task, not subscription pricing',
    source: 'https://artificialanalysis.ai/agents/coding-agents',
    defaultX: 20,
    defaultTimeMin: 60
  },
  cyber: {
    key: 'cyberModels',
    zhTitle: '网络安全指数与每任务成本',
    enTitle: 'Cyber Index vs. Cost per Task',
    zhSub: 'Artificial Analysis Cyber Index · 线性美元成本、耗时与拒答率',
    enSub: 'Artificial Analysis Cyber Index · Linear USD cost, latency & refusal rate',
    zhAxis: '网络安全指数',
    enAxis: 'Cyber Index',
    zhUnit: '个安全评测模型',
    enUnit: 'cyber models',
    zhCostNote: '网络安全基准任务的平均 API 成本（含安全防护拒答率）',
    enCostNote: 'Average API cost per Cyber Index task (includes safety refusal rate)',
    source: 'https://artificialanalysis.ai/cyber',
    defaultX: 5,
    defaultTimeMin: 30
  }
};

const MAX_COMPARE = 8;

const COMPARE_PALETTE = {
  dark: ['#5ce1c6', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#fb923c', '#a3e635', '#38bdf8'],
  light: ['#0b6e58', '#1d4ed8', '#a14408', '#be185d', '#6d28d9', '#c2410c', '#3f6212', '#0369a1']
};

function compareColor(index) {
  const dark = document.documentElement.dataset.theme !== 'light';
  const palette = dark ? COMPARE_PALETTE.dark : COMPARE_PALETTE.light;
  return palette[index % palette.length];
}

const DEFAULT_SETTINGS = {
  models: {labels: true, smartLabels: true, labelSize: 9.5, labelDistance: 4},
  frontier: {labels: true, smartLabels: true, labelSize: 9.5, labelDistance: 5},
  'human-arena': {labels: true, smartLabels: true, labelSize: 10, labelDistance: 7},
  'coding-agents': {labels: true, smartLabels: true, labelSize: 10, labelDistance: 12},
  cyber: {labels: true, smartLabels: true, labelSize: 10, labelDistance: 8}
};

const Y_LENSES = {
  models: [
    {id: '', zh: '纵轴：综合智能总分', en: 'Y: Overall Index', axisZh: '综合智能指数', axisEn: 'Intelligence Index', get: r => r._baseIndex},
    {id: 'omniscience', zh: '纵轴：全科闭卷准确率', en: 'Y: Omniscience Acc.', axisZh: '全科闭卷准确率 (%)', axisEn: 'Omniscience Accuracy (%)', get: r => r.subscores?.omniscience ?? null},
    {id: 'finance', zh: '纵轴：金融财务 (GDPval)', en: 'Y: Finance (GDPval)', axisZh: '金融财务专业分', axisEn: 'Finance & Accounting', get: r => r.domainScores?.finance ?? null},
    {id: 'legal', zh: '纵轴：法律合规 (GDPval)', en: 'Y: Legal (GDPval)', axisZh: '法律合规专业分', axisEn: 'Legal Domain', get: r => r.domainScores?.legal ?? null},
    {id: 'healthcare', zh: '纵轴：医疗健康 (GDPval)', en: 'Y: Healthcare (GDPval)', axisZh: '医疗健康专业分', axisEn: 'Healthcare Domain', get: r => r.domainScores?.healthcare ?? null},
    {id: 'engineering', zh: '纵轴：工程研发 (GDPval)', en: 'Y: Engineering (GDPval)', axisZh: '工程研发专业分', axisEn: 'Engineering Domain', get: r => r.domainScores?.engineering ?? null}
  ],
  frontier: [
    {id: '', zh: '纵轴：未饱和硬核总分', en: 'Y: Frontier Hard Index', axisZh: '未饱和前沿极限指数', axisEn: 'Frontier Hard Index', get: r => r._baseIndex},
    {id: 'gdpPdf', zh: '纵轴：GDP-PDF 一次全过', en: 'Y: GDP-PDF All-Pass', axisZh: 'GDP-PDF 全过率 (%)', axisEn: 'GDP-PDF All-Pass (%)', get: r => r.frontierScores?.gdpPdf ?? null},
    {id: 'frontierCode', zh: '纵轴：FrontierCode 2.0', en: 'Y: FrontierCode 2.0', axisZh: 'FrontierCode 2.0 (%)', axisEn: 'FrontierCode 2.0 (%)', get: r => r.frontierScores?.frontierCode ?? null},
    {id: 'terminal4', zh: '纵轴：Terminal-Bench 4.0', en: 'Y: Terminal-Bench 4.0', axisZh: 'Terminal-Bench 4.0 (%)', axisEn: 'Terminal-Bench 4.0 (%)', get: r => r.frontierScores?.terminal4 ?? null},
    {id: 'critptAgent', zh: '纵轴：CritPt 深度研究', en: 'Y: CritPt Research', axisZh: 'CritPt 深度研究 (%)', axisEn: 'CritPt Agentic Hard (%)', get: r => r.frontierScores?.critptAgent ?? null},
    {id: 'hleDiamond', zh: '纵轴：HLE 人类终极考', en: 'Y: HLE Diamond', axisZh: 'HLE 人类终极考 (%)', axisEn: 'HLE Diamond (%)', get: r => r.frontierScores?.hleDiamond ?? null},
    {id: 'harveyLaw', zh: '纵轴：Harvey 顶尖律所', en: 'Y: Harvey BigLaw', axisZh: 'Harvey 律所实测 (%)', axisEn: 'Harvey BigLaw (%)', get: r => r.frontierScores?.harveyLaw ?? null}
  ],
  'human-arena': [
    {id: '', zh: '纵轴：人类与审美总分', en: 'Y: Human & Taste Index', axisZh: '人类审美与体感指数', axisEn: 'Human & Aesthetic Index', get: r => r._baseIndex},
    {id: 'chatVibe', zh: '纵轴：交流人味 (去水份)', en: 'Y: Chat Vibe (De-biased)', axisZh: 'LMArena 交流人味校准分', axisEn: 'LMArena Chat Vibe Score', get: r => r.humanScores?.chatVibe ?? null},
    {id: 'pureVisual', zh: '纵轴：视觉审美五维总分', en: 'Y: Design Arena 5D', axisZh: 'Design Arena 五维审美分', axisEn: 'Design Arena 5D Aesthetic', get: r => r.humanScores?.pureVisual ?? null},
    {id: 'creativeCraft', zh: '纵轴：SVG 矢量与游戏创意', en: 'Y: SVG & GameDev Craft', axisZh: 'SVG与游戏交互创意分', axisEn: 'SVG & GameDev Craft Score', get: r => r.humanScores?.creativeCraft ?? null},
    {id: 'deliverable', zh: '纵轴：专家办公交付 (GDPval)', en: 'Y: Expert Deliverables', axisZh: '44职业真实交付盲评分', axisEn: 'Expert Deliverable Score', get: r => r.humanScores?.deliverable ?? null},
    {id: 'webdev', zh: '纵轴：Web全栈体感 (WebDev)', en: 'Y: WebDev Arena', axisZh: 'WebDev 全栈体感分', axisEn: 'WebDev Arena Score', get: r => r.humanScores?.webdev ?? null}
  ],
  'coding-agents': [
    {id: '', zh: '纵轴：编程智能体总分', en: 'Y: Coding Agent Index', axisZh: '编程智能体指数', axisEn: 'Coding Agent Index', get: r => r._baseIndex},
    {id: 'fc2', zh: '纵轴：FrontierCode 2.0', en: 'Y: FrontierCode 2.0', axisZh: 'FrontierCode 2.0 (%)', axisEn: 'FrontierCode 2.0 (%)', get: r => r.evalScores?.find(e => /frontiercode/i.test(e.name))?.score ?? null},
    {id: 'swe', zh: '纵轴：SWE-Atlas 仓库修复', en: 'Y: SWE-Atlas', axisZh: 'SWE-Atlas (%)', axisEn: 'SWE-Atlas (%)', get: r => r.evalScores?.find(e => /swe-atlas/i.test(e.name))?.score ?? null},
    {id: 'tb4', zh: '纵轴：Terminal-Bench 4.0', en: 'Y: Terminal-Bench 4.0', axisZh: 'Terminal-Bench 4.0 (%)', axisEn: 'Terminal-Bench 4.0 (%)', get: r => r.evalScores?.find(e => /terminal-bench/i.test(e.name))?.score ?? null}
  ],
  cyber: [
    {id: '', zh: '纵轴：网络安全总指数', en: 'Y: Cyber Index', axisZh: '网络安全指数', axisEn: 'Cyber Index', get: r => r._baseIndex}
  ]
};

function currentLensObj(target = state, key = activeKey) {
  const list = Y_LENSES[key] || Y_LENSES.models;
  return list.find(l => l.id === (target?.yLens || '')) || list[0];
}

function currentAxisLabel(target = state, key = activeKey) {
  const lens = currentLensObj(target, key);
  return t(lens.axisZh, lens.axisEn);
}

let lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
const t = (zh, en) => (lang === 'en' ? en : zh);

function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return {chart: 'models', params: new URLSearchParams()};
  const ampIndex = raw.indexOf('&');
  const chartPart = ampIndex === -1 ? raw : raw.slice(0, ampIndex);
  const queryPart = ampIndex === -1 ? '' : raw.slice(ampIndex + 1);
  const chart = ['frontier', 'human-arena', 'coding-agents', 'cyber'].includes(chartPart) ? chartPart : 'models';
  return {chart, params: new URLSearchParams(queryPart)};
}

const initialRoute = parseHash();
let snapshot, activeKey = initialRoute.chart;
const states = new Map();
let crossTabIndex = new Map();
let lastModelCompareIds = null;
let state, nodes = [], frame, pendingFrame = 0, hovered = null, suppressClick = false;
let drag = null, pinch = null;
const activePointers = new Map();
let loadController, loadGeneration = 0;

const measure = document.createElement('canvas').getContext('2d');
const colorCache = new Map();
const mobileLayout = matchMedia('(max-width:760px), (max-height:500px)');
let controlsOpen = !mobileLayout.matches, controlsTouched = false, valueDetailsOpen = false, changelogOpen = false, radarInfoOpen = false, comparePickerOpen = false, radarCtx = null, shareTimer = 0, copyMdTimer = 0, curveFrame;

const node = (tag, attrs = {}, content) => {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (content != null) element.textContent = content;
  return element;
};

function html(tag, content, className) {
  const element = document.createElement(tag);
  if (content != null) element.textContent = content;
  if (className) element.className = className;
  return element;
}

function hexToRgb(hex) {
  let v = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || '') ? hex.toLowerCase() : '#64748b';
  if (v.length === 4) v = '#' + [...v.slice(1)].map(x => x + x).join('');
  return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  return [r, g, b].reduce((sum, c, i) => {
    const channel = c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4;
    return sum + channel * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}

function contrastRatio(rgb1, rgb2) {
  const l1 = luminance(rgb1), l2 = luminance(rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, k) => {
    if (k < 0) k += 1;
    if (k > 1) k -= 1;
    if (k < 1 / 6) return p + (q - p) * 6 * k;
    if (k < 1 / 2) return q;
    if (k < 2 / 3) return p + (q - p) * (2 / 3 - k) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)].map(v => Math.round(v * 255));
}

// Bidirectional perceptual HSL contrast adjustment: guarantees >= 4.5:1 in both dark & light themes.
function color(source) {
  const dark = document.documentElement.dataset.theme !== 'light';
  const raw = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(source || '') ? source.toLowerCase() : '#64748b';
  const cacheKey = `${dark}:${raw}`;
  if (colorCache.has(cacheKey)) return colorCache.get(cacheKey);

  const rgb = hexToRgb(raw);
  const [h, s, l0] = rgbToHsl(rgb);
  if (dark && s < 0.08 && l0 < 0.28) {
    const slate = '#cbd5e1';
    colorCache.set(cacheKey, slate);
    return slate;
  }

  const bgQuadrant = dark ? [17, 42, 40] : [234, 245, 240];
  const bgCanvas = dark ? [13, 22, 38] : [255, 255, 255];
  let best = rgb;
  if (contrastRatio(rgb, bgQuadrant) < 4.55 || contrastRatio(rgb, bgCanvas) < 4.55) {
    for (let step = 1; step <= 100; step++) {
      const l = dark ? l0 + (0.93 - l0) * (step / 100) : l0 * (1 - 0.88 * (step / 100));
      const candidate = hslToRgb([h, dark ? Math.min(1, s * 1.04) : s, l]);
      best = candidate;
      if (contrastRatio(candidate, bgQuadrant) >= 4.55 && contrastRatio(candidate, bgCanvas) >= 4.55) break;
    }
  }
  const adjusted = '#' + best.map(c => c.toString(16).padStart(2, '0')).join('');
  colorCache.set(cacheKey, adjusted);
  return adjusted;
}

function format(value, digits = 3) {
  return value.toLocaleString('en-US', {maximumFractionDigits: digits});
}

function money(value) {
  return '$' + format(value, value > 0 && value < 0.001 ? 6 : 3);
}

function valueLabel(value) {
  if (value === null) return '—';
  if (value > 0 && (value < 0.001 || value >= 1e6)) return value.toExponential(2);
  return format(value, value > 0 && value < 0.01 ? 5 : 2);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatTime(sec) {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec <= 0) return '—';
  if (sec < 60) return t(`${format(sec, 1)} 秒`, `${format(sec, 1)}s`);
  const mins = sec / 60;
  if (mins < 60) return t(`${format(mins, 1)} 分`, `${format(mins, 1)}m`);
  return t(`${format(mins / 60, 2)} 小时`, `${format(mins / 60, 2)}h`);
}

function xValOf(row, metric = state?.xMetric || 'cost') {
  if (metric === 'time') {
    return typeof row?.timeSec === 'number' && Number.isFinite(row.timeSec) && row.timeSec > 0
      ? row.timeSec / 60
      : null;
  }
  return row.cost;
}

function defaultCompareIds(rows) {
  if (!rows.length) return [];
  const picks = [];
  const add = item => {
    if (item && !picks.includes(item.id) && picks.length < 4) picks.push(item.id);
  };
  add(sortRows(rows, 'intelligenceIndex', 'desc')[0]);
  add(sortRows(rows, 'valuePerDollar', 'desc', 6, 30)[0] || sortRows(rows, 'valuePerDollar', 'desc', 6)[0]);
  add(sortRows(rows, 'valuePerDollar', 'desc', 2.5, 25)[0] || sortRows(rows, 'valuePerDollar', 'desc', 2.5)[0]);
  const topOpen = sortRows(rows.filter(r => r.isOpenWeights), 'intelligenceIndex', 'desc')[0];
  if (topOpen) add(topOpen);
  for (const f of [...paretoFrontier(rows)].reverse()) {
    if (picks.length >= 3) break;
    add(f);
  }
  for (const r of sortRows(rows, 'intelligenceIndex', 'desc')) {
    if (picks.length >= Math.min(3, rows.length)) break;
    add(r);
  }
  return picks;
}

function frontierCompareIds(rows, limit = MAX_COMPARE) {
  if (!rows.length) return [];
  const frontier = [...paretoFrontier(rows)].reverse(); // Highest score -> lowest cost
  if (frontier.length <= limit) {
    const picks = frontier.map(r => r.id);
    for (const r of sortRows(rows, 'intelligenceIndex', 'desc')) {
      if (picks.length >= Math.min(limit, rows.length)) break;
      if (!picks.includes(r.id)) picks.push(r.id);
    }
    return picks;
  }
  const sampled = [];
  for (let i = 0; i < limit; i++) {
    const idx = Math.round((i * (frontier.length - 1)) / (limit - 1));
    const id = frontier[idx].id;
    if (!sampled.includes(id)) sampled.push(id);
  }
  return sampled;
}

function syncMetricViewport(target, nextMetric) {
  if (target.xMetric && target.view) {
    target.views[target.xMetric] = {...target.view};
  }
  target.xMetric = nextMetric === 'time' ? 'time' : 'cost';
  target.bounds = target.boundsByMetric[target.xMetric];
  target.defaultView = target.defaultViews[target.xMetric];
  target.view = {...target.views[target.xMetric]};
}

function applyYLens(target, lensId = '') {
  const list = Y_LENSES[target.benchKey] || Y_LENSES.models;
  const lens = list.find(l => l.id === lensId) || list[0];
  target.yLens = lens.id;
  const projected = target.baseRows
    .map(r => {
      const val = lens.get(r);
      return typeof val === 'number' && Number.isFinite(val) && val >= 0
        ? {...r, intelligenceIndex: Number(val.toFixed(4))}
        : null;
    })
    .filter(Boolean);
  const rows = projected.length ? projected : target.baseRows;
  const costBounds = dataBounds(rows, r => r.cost);
  const timeRows = rows.filter(r => Number.isFinite(r.timeSec) && r.timeSec > 0);
  const timeBounds = dataBounds(timeRows.length ? timeRows : rows, r => (r.timeSec > 0 ? r.timeSec / 60 : 0));
  const maxFloor = Math.min(MIN_SCORE.max, Math.max(15, Math.floor(Math.max(...rows.map(d => d.intelligenceIndex)))));
  const cfg = BENCHMARKS[target.benchKey];
  const defaultCostView = {...costBounds, width: cfg.defaultX ? Math.min(costBounds.width, cfg.defaultX) : costBounds.width};
  const defaultTimeView = {...timeBounds, width: cfg.defaultTimeMin ? Math.min(timeBounds.width, cfg.defaultTimeMin) : timeBounds.width};
  target.rows = rows;
  target.releaseDates = [...new Set(rows.map(r => r.releaseDate).filter(Boolean))].sort();
  target.historyIndex = Math.min(target.historyIndex ?? Math.max(0, target.releaseDates.length - 1), Math.max(0, target.releaseDates.length - 1));
  target.boundsByMetric = {cost: costBounds, time: timeBounds};
  target.defaultViews = {cost: defaultCostView, time: defaultTimeView};
  target.views = {cost: {...defaultCostView}, time: {...defaultTimeView}};
  target.bounds = target.boundsByMetric[target.xMetric || 'cost'];
  target.defaultView = target.defaultViews[target.xMetric || 'cost'];
  target.view = {...target.views[target.xMetric || 'cost']};
  target.maxFloor = maxFloor;
  if (target.minScore > maxFloor) target.minScore = 0;
  target._licCache = null;
  target._poolCache = null;
  target._frontierCache = null;
  target._rankCache = null;
}

function makeState(key, routeParams = null) {
  const baseRows = validRows(snapshot[BENCHMARKS[key].key]).map(r => ({...r, _baseIndex: r.intelligenceIndex}));
  const defaultTasks = key === 'coding-agents' ? MONTHLY_USAGE.defaultAgentTasks : MONTHLY_USAGE.defaultModelTasks;
  const defaultCmp = defaultCompareIds(baseRows);
  const defaultFast = sortRows(baseRows, 'valuePerDollar', 'desc', 2, 25)[0] || baseRows[0];
  const defaultStrong = sortRows(baseRows, 'intelligenceIndex', 'desc')[0] || baseRows.at(-1);
  const next = {
    benchKey: key,
    baseRows,
    rows: baseRows,
    releaseDates: [],
    xMetric: 'cost',
    yLens: '',
    boundsByMetric: {},
    defaultViews: {},
    views: {},
    bounds: null,
    maxFloor: 60,
    defaultTasks,
    defaultView: null,
    view: null,
    company: null,
    license: 'all',
    extraFilter: '',
    search: '',
    frontierOnly: false,
    effortCurves: false,
    historyMode: false,
    historyIndex: 0,
    isoCurve: false,
    subLine: false,
    ...DEFAULT_SETTINGS[key],
    mode: 'chart',
    radarMode: 'bench',
    radarPinnedId: null,
    selected: null,
    defaultCompareKey: defaultCmp.join(','),
    compareIds: [...defaultCmp],
    sortKey: 'intelligenceIndex',
    sortDirection: 'desc',
    subSortKey: 'intelligenceIndex',
    subSortDirection: 'desc',
    valueWeight: VALUE_WEIGHT.default,
    minScore: MIN_SCORE.default,
    maxCost: 0,
    monthlyTasks: defaultTasks,
    subFee: MONTHLY_USAGE.defaultFee,
    routerOpen: false,
    routerFastId: defaultFast.id,
    routerStrongId: defaultStrong.id,
    routerShare: 80,
    curveProbe: 50,
    curveRealRange: true,
    curveLogY: false
  };
  applyYLens(next, '');
  next.historyIndex = Math.max(0, next.releaseDates.length - 1);
  if (routeParams) applyRouteParams(next, routeParams);
  return next;
}

function applyRouteParams(target, params) {
  const view = params.get('view');
  if (['chart', 'table', 'curve', 'sub', 'compare'].includes(view)) target.mode = view;
  const yl = params.get('ylens') || '';
  if (yl !== target.yLens) applyYLens(target, yl);
  if (params.get('x') === 'time') syncMetricViewport(target, 'time');
  const lic = params.get('lic');
  if (['all', 'open', 'closed'].includes(lic)) target.license = lic;
  const xf = params.get('xf');
  if (xf) target.extraFilter = xf;
  if (params.get('radar') === 'domain') target.radarMode = 'domain';
  const w = Number(params.get('w'));
  if (params.has('w') && Number.isFinite(w) && w >= VALUE_WEIGHT.min && w <= VALUE_WEIGHT.max) {
    target.valueWeight = Math.round(w * 10) / 10;
  }
  const min = Number(params.get('min'));
  if (params.has('min') && Number.isFinite(min) && min >= MIN_SCORE.min && min <= target.maxFloor) {
    target.minScore = Math.round(min);
  }
  const maxc = Number(params.get('maxc'));
  if (params.has('maxc') && Number.isFinite(maxc) && maxc > 0 && MAX_COST_PRESETS.includes(maxc)) {
    target.maxCost = maxc;
  }
  const fee = Number(params.get('fee'));
  if (params.has('fee') && Number.isFinite(fee) && fee >= MONTHLY_USAGE.minFee && fee <= MONTHLY_USAGE.maxFee) {
    target.subFee = Math.round(fee);
  }
  const tasks = Number(params.get('tasks'));
  if (params.has('tasks') && Number.isFinite(tasks) && tasks >= MONTHLY_USAGE.minTasks && tasks <= MONTHLY_USAGE.maxTasks) {
    target.monthlyTasks = Math.round(tasks);
  }
  const focus = params.get('focus');
  if (focus && target.rows.some(r => (r.creator?.name || 'Other') === focus)) target.company = focus;
  const q = params.get('q');
  if (q) target.search = q;
  if (params.get('pf') === '1') target.frontierOnly = true;
  if (params.get('effort') === '1') target.effortCurves = true;
  if (params.get('hist') && target.releaseDates.length) {
    target.historyMode = true;
    const d = params.get('hist');
    const idx = target.releaseDates.findIndex(x => x >= d);
    target.historyIndex = idx === -1 ? target.releaseDates.length - 1 : idx;
  }
  if (params.get('iso') === '1') target.isoCurve = true;
  if (params.get('subline') === '1') target.subLine = true;
  const validIds = new Set(target.rows.map(r => r.id));
  const cmp = params.get('cmp');
  if (cmp) {
    const parsed = [...new Set(cmp.split(',').filter(id => validIds.has(id)))].slice(0, MAX_COMPARE);
    if (parsed.length) target.compareIds = parsed;
  }
  const pin = params.get('pin');
  if (pin && validIds.has(pin)) target.selected = pin;
  const rpin = params.get('rpin');
  if (rpin && target.compareIds.includes(rpin)) target.radarPinnedId = rpin;
}

function syncUrlHash() {
  if (!state) return;
  const params = new URLSearchParams();
  if (state.mode !== 'chart') params.set('view', state.mode);
  if (state.yLens) params.set('ylens', state.yLens);
  if (state.xMetric === 'time') params.set('x', 'time');
  if (state.license !== 'all') params.set('lic', state.license);
  if (state.extraFilter) params.set('xf', state.extraFilter);
  if (state.mode === 'compare' && state.radarMode === 'domain') params.set('radar', 'domain');
  if (state.valueWeight !== VALUE_WEIGHT.default) params.set('w', state.valueWeight.toFixed(1));
  if (state.minScore > 0) params.set('min', String(state.minScore));
  if (state.maxCost > 0) params.set('maxc', String(state.maxCost));
  if (state.subFee !== MONTHLY_USAGE.defaultFee) params.set('fee', String(state.subFee));
  if (state.monthlyTasks !== state.defaultTasks) params.set('tasks', String(state.monthlyTasks));
  if (state.company) params.set('focus', state.company);
  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.frontierOnly) params.set('pf', '1');
  if (state.effortCurves) params.set('effort', '1');
  if (state.historyMode && state.releaseDates[state.historyIndex]) {
    params.set('hist', state.releaseDates[state.historyIndex]);
  }
  if (state.isoCurve) params.set('iso', '1');
  if (state.subLine) params.set('subline', '1');
  if (state.selected && state.mode !== 'curve' && state.mode !== 'compare') {
    params.set('pin', state.selected);
  }
  if (state.mode === 'compare' && state.radarPinnedId) {
    params.set('rpin', state.radarPinnedId);
  }
  if (state.compareIds.join(',') !== state.defaultCompareKey) {
    params.set('cmp', state.compareIds.join(','));
  }
  const query = params.toString();
  const nextHash = activeKey === 'models' && !query ? '' : `#${activeKey}${query ? '&' + query : ''}`;
  const current = location.hash || '';
  if (current !== nextHash) {
    history.replaceState(null, '', nextHash || location.pathname + location.search);
  }
}

function licenseFilteredRows(rows = state.rows) {
  const useCache = rows === state.rows;
  const cacheKey = `${state.license}|${state.extraFilter}`;
  if (useCache && state._licCache?.key === cacheKey) return state._licCache.rows;
  let out = rows;
  if (state.license === 'open') out = out.filter(row => row.isOpenWeights);
  else if (state.license === 'closed') out = out.filter(row => !row.isOpenWeights);
  if (state.extraFilter) {
    if (state.extraFilter.startsWith('mod:')) {
      const mod = state.extraFilter.slice(4);
      out = out.filter(row => Array.isArray(row.modalities) && row.modalities.includes(mod));
    } else if (state.extraFilter === 'lic:permissive') {
      out = out.filter(row => row.isOpenWeights && row.openLicense === 'permissive');
    } else if (state.extraFilter === 'delta:up') {
      out = out.filter(row => (row.rankDelta ?? 0) >= 2);
    } else if (state.extraFilter === 'track:law') {
      out = out.filter(row => row.frontierScores?.harveyLaw != null);
    } else if (state.extraFilter === 'track:analyst') {
      out = out.filter(row => row.frontierScores?.analystAgent != null);
    } else if (state.extraFilter === 'track:health') {
      out = out.filter(row => row.frontierScores?.healthPro != null);
    } else if (state.extraFilter === 'src:both') {
      out = out.filter(row => row.arenaRaw?.sources?.includes('lmarena') && row.arenaRaw?.sources?.includes('design-arena'));
    } else if (state.extraFilter === 'vibe:top') {
      out = out.filter(row => (row.arenaRaw?.chatElo ?? 0) >= 1470);
    } else if (state.extraFilter === 'design:top') {
      out = out.filter(row => (row.arenaRaw?.designWebElo ?? 0) >= 1300);
    } else if (state.extraFilter === 'deliv:top') {
      out = out.filter(row => (row.arenaRaw?.gdpvalElo ?? 0) >= 1700);
    } else if (state.extraFilter === 'refusal:zero') {
      out = out.filter(row => (row.refusalRate ?? 0) === 0);
    } else if (state.extraFilter === 'refusal:guarded') {
      out = out.filter(row => (row.refusalRate ?? 0) > 0);
    } else if (state.extraFilter.startsWith('agent:')) {
      const ag = state.extraFilter.slice(6);
      out = out.filter(row => row.agentName === ag);
    }
  }
  if (useCache) state._licCache = {key: cacheKey, rows: out};
  return out;
}

function currentXOf() {
  return state.mode === 'chart' && state.xMetric === 'time'
    ? row => xValOf(row, 'time')
    : row => row.cost;
}

function activePool() {
  const metric = state.mode === 'chart' && state.xMetric === 'time' ? 'time' : 'cost';
  const cacheKey = `${state.license}|${state.extraFilter}|${metric}`;
  if (state._poolCache?.key === cacheKey) return state._poolCache.rows;
  const base = licenseFilteredRows(state.rows);
  const out = metric === 'time' ? base.filter(row => xValOf(row, 'time') !== null) : base;
  state._poolCache = {key: cacheKey, rows: out};
  return out;
}

function activeFrontierSet() {
  const metric = state.mode === 'chart' && state.xMetric === 'time' ? 'time' : 'cost';
  const cacheKey = `${state.license}|${state.extraFilter}|${metric}`;
  if (state._frontierCache?.key === cacheKey) return state._frontierCache;
  const list = paretoFrontier(activePool(), currentXOf());
  const entry = {key: cacheKey, list, idSet: new Set(list.map(row => row.id))};
  state._frontierCache = entry;
  return entry;
}

function filteredRows() {
  const query = state.search.trim().toLocaleLowerCase();
  const pool = activePool();
  let rows = pool.filter(row => !query || [row.name, row.shortName, row.creator?.name, row.agentName, row.modelName, row.family?.name].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  if (state.frontierOnly) {
    const {idSet} = activeFrontierSet();
    rows = rows.filter(row => idSet.has(row.id));
  }
  return rows;
}

function computeRankings(rows = licenseFilteredRows(state.rows)) {
  const defaultPool = licenseFilteredRows(state.rows);
  const useCache = rows === defaultPool;
  const cacheKey = `${state.license}|${state.extraFilter}|${state.valueWeight}|${state.minScore}|${state.maxCost}`;
  if (useCache && state._rankCache?.key === cacheKey) return state._rankCache.val;
  const ranked = sortRows(rows, 'valuePerDollar', 'desc', state.valueWeight, state.minScore, state.maxCost);
  const rankMap = new Map();
  let qualifiedCount = 0, champion = null, championValue = null;
  for (const row of ranked) {
    const val = valuePerDollar(row, state.valueWeight, state.minScore, state.maxCost);
    if (val !== null) {
      qualifiedCount++;
      rankMap.set(row.id, {rank: qualifiedCount, value: val});
      if (!champion) {
        champion = row;
        championValue = val;
      }
    }
  }
  const result = {rankMap, qualifiedCount, champion, championValue};
  if (useCache) state._rankCache = {key: cacheKey, val: result};
  return result;
}

function isRecentRelease(row) {
  if (!row?.releaseDate || !state?.releaseDates?.length) return false;
  const latestMs = Date.parse(state.releaseDates.at(-1) + 'T00:00:00Z');
  const rowMs = Date.parse(row.releaseDate + 'T00:00:00Z');
  return Number.isFinite(latestMs) && Number.isFinite(rowMs) && (latestMs - rowMs) >= 0 && (latestMs - rowMs) <= 14 * 86400 * 1000;
}

function renderChangelog() {
  $('#changelogTitle').textContent = t('Artificial Analysis 最新动态', 'Latest Upstream Updates');
  $('#changelogTime').textContent = t('每 2 小时检查', '2h auto-sync');
  const list = $('#changelogList');
  const frag = document.createDocumentFragment();
  const items = Array.isArray(snapshot?.changelog) ? snapshot.changelog : [];
  const typeLabelOf = raw => {
    if (raw === 'model') return t('新模型', 'Model');
    if (raw === 'benchmark' || raw === 'index') return t('基准更新', 'Benchmark');
    if (raw === 'agent') return t('智能体', 'Agent');
    return t('动态', 'Update');
  };
  if (items.length) {
    for (const item of items.slice(0, 10)) {
      const li = html('li', null, 'changelog-item');
      const meta = html('div', null, 'changelog-meta');
      meta.append(html('span', item.date), html('span', typeLabelOf(item.type), 'row-tag'));
      if (item.url) {
        const link = html('a', item.title);
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener';
        li.append(meta, link);
      } else {
        li.append(meta, html('span', item.title));
      }
      frag.append(li);
    }
  } else {
    frag.append(html('li', t('每 2 小时自动检查 Artificial Analysis 上游榜单更新。', 'Checked every 2 hours against upstream Artificial Analysis releases.'), 'changelog-item'));
  }
  list.replaceChildren(frag);
}

function clampAnchoredPopover(popover, anchor, maxWidth = 360) {
  if (!popover || popover.hidden || !anchor) return;
  const anchorRect = anchor.getBoundingClientRect();
  const popW = Math.min(maxWidth, Math.max(240, innerWidth - 16));
  const preferLeft = anchorRect.right - popW >= 8 ? anchorRect.right - popW : anchorRect.left;
  const clampedLeft = Math.max(8, Math.min(innerWidth - popW - 8, preferLeft));
  popover.style.width = `${popW}px`;
  popover.style.left = `${clampedLeft - anchorRect.left}px`;
  popover.style.right = 'auto';
}

function setChangelogOpen(open) {
  changelogOpen = open;
  $('#updateBadge').setAttribute('aria-expanded', String(open));
  $('#changelogPopover').hidden = !open;
  if (open) {
    renderChangelog();
    clampAnchoredPopover($('#changelogPopover'), $('#updateBadge'), 340);
  }
}

function renderPresets() {
  const fragment = document.createDocumentFragment();
  for (const preset of VALUE_PRESETS) {
    const btn = html('button', `${t(preset.zh, preset.en)} ${preset.value}`);
    btn.type = 'button';
    btn.dataset.preset = String(preset.value);
    btn.setAttribute('aria-pressed', String(state ? Math.abs(state.valueWeight - preset.value) < 0.05 : preset.value === VALUE_WEIGHT.default));
    btn.addEventListener('click', () => setValueWeight(preset.value));
    fragment.append(btn);
  }
  $('#presetGroup').replaceChildren(fragment);

  const tierFrag = document.createDocumentFragment();
  for (const tier of SUBSCRIPTION_TIERS) {
    const btn = html('button', t(tier.zh, tier.en));
    btn.type = 'button';
    btn.dataset.fee = String(tier.price);
    btn.setAttribute('aria-pressed', String(state ? state.subFee === tier.price : tier.price === MONTHLY_USAGE.defaultFee));
    btn.addEventListener('click', () => setSubFee(tier.price));
    tierFrag.append(btn);
  }
  $('#subTierGroup').replaceChildren(tierFrag);

  const taskFrag = document.createDocumentFragment();
  for (const tp of TASK_VOLUME_PRESETS) {
    const btn = html('button', t(tp.zh, tp.en));
    btn.type = 'button';
    btn.dataset.tasks = String(tp.tasks);
    btn.setAttribute('aria-pressed', String(state ? state.monthlyTasks === tp.tasks : false));
    btn.addEventListener('click', () => setMonthlyTasks(tp.tasks));
    taskFrag.append(btn);
  }
  $('#taskPresetGroup').replaceChildren(taskFrag);
}

function formatTaskCount(tasks) {
  if (tasks === null) return '—';
  if (tasks < 1) return t(`< 1 次 (${format(tasks, 2)})`, `< 1 (${format(tasks, 2)})`);
  if (tasks >= 100) return `${Math.round(tasks).toLocaleString('en-US')}${t(' 次', '')}`;
  return `${format(tasks, 1)}${t(' 次', '')}`;
}

function compactMoney(value) {
  if (value >= 100) return '$' + Math.round(value).toLocaleString('en-US');
  if (value >= 1) return '$' + format(value, 1);
  return money(value);
}

function tierBreakevenText(cost) {
  const parts = SUBSCRIPTION_TIERS.map(tier => {
    const n = breakEvenTasks(cost, tier.price);
    if (n === null) return null;
    const countStr = n < 1 ? '<1' : n >= 100 ? Math.round(n).toLocaleString('en-US') : format(n, 1);
    return `$${tier.price}: ${countStr}\u00A0${t('次', 'x')}`;
  }).filter(Boolean);
  return parts.length ? `${t('回本', 'Break-even')} · ${parts.join(' · ')}` : '';
}

function syncStaticText() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  $('#appTitle').textContent = t('智能水平与任务成本', 'Intelligence vs. Cost');
  $('#appSubtitle').textContent = t('Intelligence vs. Cost · 线性成本基准', 'Linear-cost AI benchmark explorer');
  $('#tab-models').textContent = t('综合智能', 'Intelligence');
  $('#tab-frontier').textContent = t('前沿极限', 'Frontier Hard');
  $('#tab-human-arena').textContent = t('人类与审美', 'Human & Taste');
  $('#tab-coding-agents').textContent = t('编程智能体', 'Coding Agents');
  $('#tab-cyber').textContent = t('网络安全', 'Cyber');
  $('#updateText').textContent = t('最新动态', 'Updates');
  if (changelogOpen) renderChangelog();
  if (!shareTimer) $('#shareBtn').textContent = t('分享', 'Share');
  $('#shareBtn').setAttribute('aria-label', t('复制当前视图分享链接', 'Copy shareable view URL'));
  $('#langToggle').textContent = lang === 'en' ? '中文' : 'EN';
  $('#langToggle').setAttribute('aria-label', lang === 'en' ? '切换为中文界面' : 'Switch interface to English');

  $('[data-i18n="scatterView"]').textContent = t('散点图', 'Scatter');
  $('[data-i18n="tableView"]').textContent = t('数据表', 'Table');
  $('[data-i18n="curveView"]').textContent = t('权重曲线', 'Curve');
  $('[data-i18n="subView"]').textContent = t('订阅回本', 'Sub vs API');
  $('[data-i18n="compareView"]').textContent = t('剖析对比', 'Compare');

  $('#keyLinear').textContent = t('线性美元横轴', 'Linear USD axis');
  $('#keyQuadrant').textContent = t('优于中位参考区', 'Above-median score & below-median cost');
  $('#keyFrontier').textContent = t('帕累托前沿', 'Pareto frontier');
  $('#keyIso').textContent = t('最优等性价比切线', 'Best-value iso-curve');
  $('#keySub').textContent = t('订阅回本成本线', 'Subscription break-even');
  $('#keyEffort').textContent = t('同系列推理轨迹', 'Reasoning effort trajectory');
  $('#keyHistory').textContent = t('历史帕累托前沿（虚线为今日）', 'Historical Pareto (dashed = today)');
  $('#keyBetter').textContent = t('越靠左上越理想', 'Upper-left is better');

  $('#xMetricSwitch').setAttribute('aria-label', t('横轴维度', 'Horizontal axis metric'));
  $('#xMetricCost').textContent = t('成本', 'Cost');
  $('#xMetricTime').textContent = t('耗时', 'Time');

  $('#reset').textContent = t('重置视图', 'Reset view');
  $('#fit').textContent = t('显示全部', 'Fit all');
  $('#xminus').setAttribute('aria-label', t('缩小横轴', 'Zoom X out'));
  $('#xplus').setAttribute('aria-label', t('放大横轴', 'Zoom X in'));
  $('#yminus').setAttribute('aria-label', t('缩小纵轴', 'Zoom Y out'));
  $('#yplus').setAttribute('aria-label', t('放大纵轴', 'Zoom Y in'));

  $('#searchSr').textContent = t('查找模型或厂商', 'Search models or creators');
  $('#search').placeholder = t('查找模型或厂商…', 'Search models or creators…');
  $('#licenseGroup').setAttribute('aria-label', t('开源与闭源筛选', 'Open vs proprietary filter'));
  $('[data-license="all"]').textContent = t('全部', 'All');
  $('[data-license="open"]').textContent = t('开源', 'Open');
  $('[data-license="closed"]').textContent = t('闭源', 'Closed');
  $('#extraFilterSr').textContent = t('按模态、安全拦截或框架筛选', 'Filter by modality, safeguards, or harness');
  $('#exportPng').textContent = t('导图 PNG', 'Export PNG');
  $('#curveExportPng').textContent = t('导图 PNG', 'Export PNG');
  $('#exportCsv').textContent = t('导出 CSV', 'Export CSV');
  $('#clearFilters').textContent = t('清除筛选', 'Clear filters');

  $('#labelSizeText').textContent = t('字号', 'Size');
  $('#labelDistText').textContent = t('距离', 'Offset');

  $('#helpMouse').replaceChildren(
    document.createTextNode(t('滚轮缩放 X · ', 'Wheel X · ')),
    html('kbd', 'Shift'),
    document.createTextNode(t('+滚轮 Y · ', '+wheel Y · ')),
    html('kbd', 'Ctrl'),
    document.createTextNode(t('+滚轮双向 · 拖动平移 · 单击锁定 · ', '+wheel XY · Drag · Click pin · ')),
    html('kbd', 'Shift'),
    document.createTextNode(t('+单击加入对比', '+click compare'))
  );
  $('#helpKeyboard').replaceChildren(
    document.createTextNode(t('键盘：', 'Keys: ')),
    html('kbd', '1–5'),
    document.createTextNode(t(' 切视图 · ', ' views · ')),
    html('kbd', 'Alt+1–5'),
    document.createTextNode(t(' 切榜单 · ', ' tabs · ')),
    html('kbd', '/'),
    document.createTextNode(t(' 搜索 · ', ' search · ')),
    html('kbd', '[ ]'),
    document.createTextNode(t(' 前沿巡航 · ', ' tour frontier · ')),
    html('kbd', '← ↑ ↓ →'),
    document.createTextNode(t(' 平移 · ', ' pan · ')),
    html('kbd', '+ −'),
    document.createTextNode(t(' 缩放 · ', ' zoom · ')),
    html('kbd', 'Esc'),
    document.createTextNode(t(' 解锁', ' unpin'))
  );

  document.querySelector('.tabs').setAttribute('aria-label', t('选择基准', 'Choose benchmark'));
  document.querySelector('.view-switch').setAttribute('aria-label', t('选择视图', 'Choose view'));
  $('#legend').setAttribute('aria-label', t('按厂商聚焦', 'Focus by creator'));
  $('#interactionHelp').setAttribute('aria-label', t('图表操作提示', 'Chart controls'));
  $('#valueSettings').setAttribute('aria-label', t('自定义性价比模型', 'Customize value model'));
  $('#presetGroup').setAttribute('aria-label', t('权重档位预设', 'Weight presets'));
  $('#valueWeightValue').setAttribute('aria-label', t('输入智能权重 α', 'Enter capability weight α'));
  host.setAttribute('aria-label', t('交互散点图：方向键平移，加减键缩放，Home 重置；也可切换到数据表查看', 'Interactive scatter chart: arrow keys pan, plus/minus zoom, Home resets'));
  $('#pinnedCard').setAttribute('aria-label', t('锁定节点详情', 'Pinned point details'));
  $('#tableCaption').textContent = t('基准数据与性价比线性比较表', 'Benchmark data and weighted value comparison table');
  $('#curveHost').setAttribute('aria-label', t('能力效用曲线：点击或按左右方向键探查各分数效用', 'Utility curve: click or use left/right arrow keys to inspect'));
  $('#curveSvg').setAttribute('aria-label', t('指数与能力效用的对应曲线及帕累托前沿投射点', 'Capability utility curve with projected Pareto frontier entries'));
  $('#loading').textContent = t('正在加载基准快照…', 'Loading benchmark snapshot…');

  $('#weightLabel').textContent = t('智能权重 α', 'Weight α');
  $('#minScoreLabel').textContent = t('最低门槛', 'Min score');
  $('#maxCostLabel').textContent = t('预算上限', 'Max $/task');
  $('#resetValueInline').textContent = t('重置参数', 'Reset');

  $('#pinnedBadge').textContent = t('已锁定节点', 'Pinned');
  $('#pinGoCompareBtn').textContent = t('去剖析 →', 'Analyze →');
  $('#unpin').textContent = t('取消 · Esc', 'Unpin · Esc');
  $('#pinScoreLabel').textContent = t('指数', 'Index');
  $('#pinCostLabel').textContent = t('单次成本', 'Cost / task');
  $('#pinTimeLabel').textContent = t('平均耗时', 'Mean time');
  $('#pinValueLabel').textContent = t('性价比', 'Value');
  $('#pinnedOutside').textContent = t('该节点当前在可视范围外', 'Point is outside current viewport');

  $('#thName').textContent = t('名称', 'Name');
  $('#thCreator').textContent = t('厂商', 'Creator');
  $('#thIndex').textContent = t('指数 (0–100)', 'Index (0–100)');
  $('#thCost').textContent = t('每任务成本 (USD)', 'Cost / task (USD)');
  $('#thTime').textContent = t('平均耗时', 'Mean time');
  $('#thValue').textContent = t('性价比', 'Value');

  $('#curveTitle').textContent = t('IRT 胜率混合能力效用曲线', 'IRT Pass-Odds Capability Utility Curve');
  $('#curveCurrentLabel').textContent = t('当前 α =', 'Current α =');
  $('#curveLinearLabel').textContent = t('线性参考 (α = 1)', 'Linear ref (α = 1)');
  $('#curveParetoLabel').textContent = t('帕累托前沿节点', 'Pareto frontier');
  $('#curveNote').textContent = t(
    '50 分锚点恒对应效用 50；曲线上的圆点为当前榜单帕累托前沿条目，外环高亮当前性价比榜首。',
    'Score 50 is anchored at utility 50; dots mark Pareto frontier entries, with the ring highlighting the #1 value leader.'
  );

  $('#subSettings').setAttribute('aria-label', t('月度订阅与 API 回本测算', 'Subscription vs API break-even calculator'));
  $('#subTierGroup').setAttribute('aria-label', t('订阅月费档位', 'Subscription fee presets'));
  $('#taskPresetGroup').setAttribute('aria-label', t('月任务量预设', 'Monthly task volume presets'));
  $('#subFeeLabel').textContent = t('参考月订阅', 'Monthly sub');
  $('#subFeeValue').setAttribute('aria-label', t('自定义月订阅美元价格', 'Custom monthly subscription USD price'));
  $('#monthlyTasksLabel').textContent = t('预计月任务量', 'Tasks / mo');
  $('#monthlyTasksValue').setAttribute('aria-label', t('输入预计每月任务次数', 'Enter estimated monthly tasks'));
  $('#routerFastLabel').textContent = t('日常主力', 'Routine');
  $('#routerStrongLabel').textContent = t('疑难旗舰', 'Flagship');
  $('#routerShareLabel').textContent = t('主力分流', 'Fast %');
  $('#resetSubInline').textContent = t('重置测算', 'Reset');
  $('#subDisclaimer').textContent = t(
    '基于实测 API 单任务均价精确换算；官方订阅含 5 小时/周动态限流且不公开配额，「已回本」代表配额够用时买月订阅更划算。',
    'Derived from verified API cost per task; official plans enforce dynamic rate limits, so "Sub saves" holds when plan quota suffices.'
  );
  $('#subTableCaption').textContent = t('API 按量计费与月订阅盈亏平衡对比表', 'Pay-as-you-go API versus monthly subscription break-even table');
  $('#subThName').textContent = t('名称', 'Name');
  $('#subThIndex').textContent = t('指数 (0–100)', 'Index (0–100)');
  $('#subThCost').textContent = t('单任务 API', 'API / task');
  $('#subThBreakeven').textContent = t('回本任务数', 'Break-even');
  $('#subThBill').textContent = t('月 API 账单 · 订阅结论', 'Est. API · Sub Verdict');

  $('#historySettings').setAttribute('aria-label', t('历史帕累托演进与 AI 降本时间轴', 'Historical Pareto evolution & AI cost deflation timeline'));
  $('#historyLabel').textContent = t('发布时间轴', 'Timeline');

  $('#compareSelectSr').textContent = t('搜索并添加条目到多维对比', 'Search and add entries to comparison');
  $('#compareSearchInput').placeholder = t('搜索模型或厂商（点击多选）…', 'Search models or creators (click to toggle)…');
  $('#compareSyncBtn').textContent = t('同步跨榜选型', 'Sync selection');
  $('#compareSyncBtn').title = t('将上一榜单自选的对比模型一键同步到当前榜单', 'Sync custom model selection from previous benchmark tab');
  $('#compareAutoBtn').textContent = t('推荐 4 项', 'Top 4');
  $('#compareAutoBtn').title = t('自动挑选榜首、高性价比与开源代表共 4 项', 'Auto-pick SOTA, best-value & top open-weights (4)');
  $('#compareFrontierBtn').textContent = t(`前沿全览 (${MAX_COMPARE})`, `Frontier (${MAX_COMPARE})`);
  $('#compareFrontierBtn').title = t(`沿帕累托前沿均匀抽取最多 ${MAX_COMPARE} 项进行跨档位全景对比`, `Sample up to ${MAX_COMPARE} Pareto frontier entries across tiers`);
  $('#compareClearBtn').textContent = t('精简', 'Trim');
  $('#compareClearBtn').title = t('仅保留当前锁定或第一项，便于从头自选组合', 'Keep only the pinned or first entry to rebuild selection');
  if (!copyMdTimer) $('#compareCopyMd').textContent = t('复制表格', 'Copy MD');
  $('#compareCopyMd').title = t('复制当前对比矩阵与细分得分为 Markdown 表格', 'Copy comparison matrix & subscores as Markdown table');
  $('#compareExportPng').textContent = t('导图 PNG', 'Export PNG');
  $('#radarModeSwitch').setAttribute('aria-label', t('雷达图维度切换', 'Radar dimension mode'));
  $('#radarModeBench').textContent = t('基准六维', 'Benchmarks');
  $('#radarModeDomain').textContent = t('行业六维', 'Domains');
  $('#radarInfoBtn').textContent = radarInfoOpen ? t('收起口径', 'Hide sources') : t('ⓘ 指标口径', 'ⓘ Sources');
  $('#radarHeading').textContent = t('细分基准能力雷达与分项对比', 'Sub-benchmark Capability Radar & Breakdown');
  $('#anatomyHeading').textContent = t('单任务成本结构拆解与耗时剖析', 'Per-Task Cost Anatomy & Latency Profile');
  $('#matrixHeading').textContent = t('核心指标并排对决表', 'Head-to-Head Metrics Matrix');

  renderPresets();
  applyThemeText();
  if (state) {
    const cfg = BENCHMARKS[activeKey];
    $('#chartTitle').textContent = t(cfg.zhTitle, cfg.enTitle);
    $('#chartSubtitle').textContent = t(cfg.zhSub, cfg.enSub);
    syncControls();
    renderLegend();
    renderStatus();
    buildPlot();
  }
}

function applyThemeText() {
  const dark = document.documentElement.dataset.theme !== 'light';
  $('#themeLabel').textContent = dark ? t('深色', 'Dark') : t('浅色', 'Light');
  $('#theme').setAttribute('aria-pressed', String(dark));
  $('#theme').setAttribute('aria-label', dark ? t('切换为浅色主题', 'Switch to light theme') : t('切换为深色主题', 'Switch to dark theme'));
}

function applyTheme() {
  applyThemeText();
  clearHover();
  if (state) {
    renderLegend();
    buildPlot();
  }
}

$('#theme').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('intelligence-cost-theme', theme); } catch {}
  applyTheme();
});

$('#langToggle').addEventListener('click', () => {
  lang = lang === 'en' ? 'zh' : 'en';
  try { localStorage.setItem('intelligence-cost-lang', lang); } catch {}
  syncStaticText();
});

$('#updateBadge').addEventListener('click', () => {
  setChangelogOpen(!changelogOpen);
});

$('#shareBtn').addEventListener('click', async () => {
  syncUrlHash();
  const url = location.href;
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      copied = true;
    }
  } catch {}
  if (!copied) {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try { copied = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  clearTimeout(shareTimer);
  $('#shareBtn').textContent = copied ? t('已复制 ✓', 'Copied ✓') : t('已同步链接', 'URL synced');
  shareTimer = setTimeout(() => {
    shareTimer = 0;
    $('#shareBtn').textContent = t('分享', 'Share');
  }, 1800);
});

let historyTimer = 0;
function stopHistoryPlay() {
  if (historyTimer) {
    clearInterval(historyTimer);
    historyTimer = 0;
    if (state) syncHistoryControls();
  }
}

function chooseChart(key, {changeHash = true, routeParams = null} = {}) {
  if (!BENCHMARKS[key]) return;
  if (snapshot) {
    const arr = snapshot[BENCHMARKS[key].key];
    if (!Array.isArray(arr) || !arr.length) key = 'models';
  }
  stopHistoryPlay();
  if (comparePickerOpen) setComparePickerOpen(false);
  const previousMode = state?.mode;
  endPointerInteractions();
  clearHover();
  activeKey = key;
  for (const tab of document.querySelectorAll('[role=tab]')) {
    const selected = tab.dataset.chart === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (!selected && document.activeElement === tab) tab.blur();
  }
  $('#chart-panel').setAttribute('aria-labelledby', `tab-${key}`);
  $('#chartTitle').textContent = t(BENCHMARKS[key].zhTitle, BENCHMARKS[key].enTitle);
  $('#chartSubtitle').textContent = t(BENCHMARKS[key].zhSub, BENCHMARKS[key].enSub);
  if (!snapshot) return;
  try {
    if (!states.has(key)) states.set(key, makeState(key, routeParams));
    else if (routeParams) applyRouteParams(states.get(key), routeParams);
    state = states.get(key);
    if (!routeParams?.has('view') && previousMode) state.mode = previousMode;
    $('#loading').hidden = true;
    host.setAttribute('aria-busy', 'false');
    if (changeHash) syncUrlHash();
    syncControls();
    renderLegend();
    renderStatus();
    buildPlot();
  } catch (error) {
    state = null;
    svg.replaceChildren();
    showLoadError(error);
  }
}

for (const tab of document.querySelectorAll('[role=tab]')) {
  tab.addEventListener('click', () => chooseChart(tab.dataset.chart));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const visibleTabs = [...document.querySelectorAll('[role=tab]')].filter(el => !el.hidden);
    if (!visibleTabs.length) return;
    const idx = Math.max(0, visibleTabs.findIndex(el => el.dataset.chart === activeKey));
    const nextIdx = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? visibleTabs.length - 1
        : (idx + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
    const key = visibleTabs[nextIdx].dataset.chart;
    chooseChart(key);
    $(`#tab-${key}`).focus();
  });
}

addEventListener('hashchange', () => {
  const parsed = parseHash();
  chooseChart(parsed.chart, {changeHash: false, routeParams: parsed.params});
});

function renderLegend() {
  const companies = new Map();
  for (const row of licenseFilteredRows(state.rows)) {
    const name = row.creator?.name || 'Other';
    if (!companies.has(name)) companies.set(name, {name, color: row.creator?.color, count: 0});
    companies.get(name).count++;
  }
  if (state.company && !companies.has(state.company)) state.company = null;
  const fragment = document.createDocumentFragment();
  for (const creator of [...companies.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))) {
    const button = html('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(creator.name === state.company));
    button.setAttribute('aria-label', t(`聚焦 ${creator.name}（${creator.count} 项）`, `Focus ${creator.name} (${creator.count})`));
    const dot = html('i');
    dot.style.setProperty('--color', color(creator.color));
    dot.setAttribute('aria-hidden', 'true');
    button.append(dot, document.createTextNode(creator.name), html('span', creator.count, 'legend-count'));
    button.addEventListener('click', () => {
      state.company = state.company === creator.name ? null : creator.name;
      state.selected = null;
      clearHover();
      renderLegend();
      syncControls();
      syncUrlHash();
      if (state.mode === 'table') renderTable();
      else if (state.mode === 'sub') renderSubTable();
      scheduleDraw();
    });
    fragment.append(button);
  }
  $('#legend').replaceChildren(fragment);
}

function syncYLensOptions() {
  const wrap = $('#yLensWrap');
  const sel = $('#yLensSelect');
  const list = Y_LENSES[activeKey] || Y_LENSES.models;
  wrap.hidden = list.length <= 1;
  const frag = document.createDocumentFragment();
  for (const lens of list) {
    const opt = html('option', t(lens.zh, lens.en));
    opt.value = lens.id;
    frag.append(opt);
  }
  sel.replaceChildren(frag);
  sel.value = state.yLens || '';
}

function syncExtraFilterOptions() {
  const sel = $('#extraFilter');
  const frag = document.createDocumentFragment();
  if (activeKey === 'models') {
    const opts = [
      ['', t('全部模态 / 协议', 'All modalities')],
      ['mod:image', t('支持图像输入', 'Image input')],
      ['mod:speech', t('支持语音输入', 'Speech input')],
      ['mod:video', t('支持视频输入', 'Video input')],
      ['lic:permissive', t('宽松开源 (MIT/Apache)', 'Permissive open')]
    ];
    for (const [val, label] of opts) {
      const opt = html('option', label);
      opt.value = val;
      frag.append(opt);
    }
  } else if (activeKey === 'frontier') {
    const opts = [
      ['', t('全部前沿极限模型', 'All frontier models')],
      ['delta:up', t('抗刷榜硬核跃升 (排名↑)', 'Hard-eval rank risers (↑)')],
      ['track:law', t('含 Harvey 律所实测', 'With Harvey BigLaw eval')],
      ['track:analyst', t('含金融分析代理实测', 'With Analyst Agent eval')],
      ['track:health', t('含临床专科医疗实测', 'With HealthBench Pro eval')],
      ['lic:permissive', t('宽松开源 (MIT/Apache)', 'Permissive open')]
    ];
    for (const [val, label] of opts) {
      const opt = html('option', label);
      opt.value = val;
      frag.append(opt);
    }
  } else if (activeKey === 'human-arena') {
    const opts = [
      ['', t('全部真人盲测模型', 'All blind-tested models')],
      ['src:both', t('双竞技场全覆盖 (LMArena + Design)', 'Both LMArena & Design Arena')],
      ['vibe:top', t('高交流人味 (Chat Elo ≥ 1470)', 'Top Chat Vibe (Elo ≥ 1470)')],
      ['design:top', t('高视觉审美 (Website Elo ≥ 1300)', 'Top Aesthetic (Web Elo ≥ 1300)')],
      ['deliv:top', t('高专家交付 (GDPval ≥ 1700)', 'Top Deliverable (GDPval ≥ 1700)')],
      ['lic:permissive', t('宽松开源 (MIT/Apache)', 'Permissive open')]
    ];
    for (const [val, label] of opts) {
      const opt = html('option', label);
      opt.value = val;
      frag.append(opt);
    }
  } else if (activeKey === 'cyber') {
    const opts = [
      ['', t('全部安全模型', 'All cyber models')],
      ['refusal:zero', t('零安全拒答 (0%)', 'Zero refusal (0%)')],
      ['refusal:guarded', t('含安全拦截 (>0%)', 'With safeguards (>0%)')],
      ['mod:image', t('支持图像输入', 'Image input')],
      ['lic:permissive', t('宽松开源 (MIT/Apache)', 'Permissive open')]
    ];
    for (const [val, label] of opts) {
      const opt = html('option', label);
      opt.value = val;
      frag.append(opt);
    }
  } else {
    const counts = new Map();
    for (const r of state.rows) {
      if (!r.agentName) continue;
      counts.set(r.agentName, (counts.get(r.agentName) || 0) + 1);
    }
    const first = html('option', t('全部智能体框架', 'All harnesses'));
    first.value = '';
    frag.append(first);
    for (const [ag, cnt] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      const opt = html('option', `${ag} (${cnt})`);
      opt.value = `agent:${ag}`;
      frag.append(opt);
    }
  }
  sel.replaceChildren(frag);
  if (![...sel.options].some(o => o.value === state.extraFilter)) {
    state.extraFilter = '';
  }
  sel.value = state.extraFilter;
}

function shiftMonthsIso(isoDate, deltaMonths) {
  const dt = new Date(isoDate + 'T00:00:00Z');
  dt.setUTCMonth(dt.getUTCMonth() + deltaMonths);
  return dt.toISOString().slice(0, 10);
}

function canHistoryMode() {
  return ['models', 'frontier', 'human-arena', 'cyber'].includes(activeKey) && state.xMetric === 'cost' && state.releaseDates.length > 1;
}

function syncHistoryControls() {
  const canHist = canHistoryMode();
  $('#historyToggle').hidden = state.mode !== 'chart' || !canHist;
  $('#historyToggle').setAttribute('aria-pressed', String(state.historyMode && canHist));
  $('#historyToggle').textContent = state.historyMode && canHist
    ? t('历史演进 ✓', 'History ✓')
    : t('历史演进', 'History');
  const showBar = state.mode === 'chart' && canHist && state.historyMode;
  $('#historySettings').hidden = !showBar;
  $('#keyHistoryWrap').hidden = !showBar;
  if (!showBar) return;

  $('#historyPlayBtn').textContent = historyTimer
    ? t('⏸ 暂停', '⏸ Pause')
    : t('▶ 回放演进', '▶ Play');

  const dates = state.releaseDates;
  const maxIdx = dates.length - 1;
  state.historyIndex = Math.max(0, Math.min(maxIdx, state.historyIndex));
  $('#historySlider').max = maxIdx;
  $('#historySlider').value = state.historyIndex;
  const cutoff = dates[state.historyIndex];
  $('#historyDateOut').textContent = cutoff;

  const latest = dates[maxIdx];
  const findIdxNear = targetIso => {
    const idx = dates.findIndex(d => d >= targetIso);
    return idx === -1 ? maxIdx : Math.max(0, idx);
  };
  const milestones = [
    {idx: 0, zh: '起点', en: 'Start'},
    {idx: findIdxNear(shiftMonthsIso(latest, -6)), zh: '6 个月前', en: '−6 mo'},
    {idx: findIdxNear(shiftMonthsIso(latest, -3)), zh: '3 个月前', en: '−3 mo'},
    {idx: maxIdx, zh: '最新全榜', en: 'Today'}
  ];
  const pFrag = document.createDocumentFragment();
  const seenIdx = new Set();
  for (const ms of milestones) {
    if (seenIdx.has(ms.idx)) continue;
    seenIdx.add(ms.idx);
    const btn = html('button', t(ms.zh, ms.en));
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(state.historyIndex === ms.idx));
    btn.addEventListener('click', () => {
      stopHistoryPlay();
      state.historyIndex = ms.idx;
      syncHistoryControls();
      syncUrlHash();
      scheduleDraw();
    });
    pFrag.append(btn);
  }
  $('#historyPresetGroup').replaceChildren(pFrag);

  const summary = historicalFrontierSummary(licenseFilteredRows(state.rows), cutoff);
  if (summary && summary.pastCount > 0) {
    const defStr = summary.deflationFactor && summary.deflationFactor >= 1.05
      ? t(
        ` · 达 ≥${summary.milestone} 分最低成本 ${money(summary.pastMinCost)} → 今日 ${money(summary.currentMinCost)}（AI 降本 ×${format(summary.deflationFactor, 1)}）`,
        ` · Min cost for ≥${summary.milestone}: ${money(summary.pastMinCost)} → ${money(summary.currentMinCost)} today (${format(summary.deflationFactor, 1)}× cheaper)`
      )
      : '';
    $('#historySummary').textContent = t(
      `截至 ${cutoff}：已发布 ${summary.pastCount}/${summary.totalCount} 款 · 当时最高 ${format(summary.pastMaxScore, 1)} 分（今日 ${format(summary.currentMaxScore, 1)}）${defStr}`,
      `As of ${cutoff}: ${summary.pastCount}/${summary.totalCount} released · Peak ${format(summary.pastMaxScore, 1)} vs ${format(summary.currentMaxScore, 1)} today${defStr}`
    );
  }
}

function syncControls() {
  const isTimeAxis = state.xMetric === 'time';
  $('#xMetricCost').setAttribute('aria-pressed', String(!isTimeAxis));
  $('#xMetricTime').setAttribute('aria-pressed', String(isTimeAxis));
  $('#keyLinear').textContent = isTimeAxis
    ? t('线性耗时横轴（分钟）', 'Linear time axis (min)')
    : t('线性美元横轴', 'Linear USD axis');
  $('#keyQuadrant').textContent = isTimeAxis
    ? t('高分且快于中位参考区', 'Above-median score & faster than median')
    : t('优于中位参考区', 'Above-median score & below-median cost');

  for (const btn of document.querySelectorAll('#licenseGroup [data-license]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.license === state.license));
  }
  syncYLensOptions();
  syncExtraFilterOptions();

  $('#search').value = state.search;
  $('#frontier').setAttribute('aria-pressed', String(state.frontierOnly));
  $('#frontier').textContent = state.frontierOnly ? t('仅看前沿 ✓', 'Frontier ✓') : t('仅看前沿', 'Frontier only');

  $('#effortToggle').hidden = state.mode !== 'chart';
  $('#effortToggle').setAttribute('aria-pressed', String(state.effortCurves));
  $('#effortToggle').textContent = state.effortCurves ? t('推理轨迹 ✓', 'Effort paths ✓') : t('推理轨迹', 'Effort paths');
  $('#keyEffortWrap').hidden = !state.effortCurves;

  $('#isoToggle').hidden = state.mode !== 'chart' || isTimeAxis;
  $('#isoToggle').setAttribute('aria-pressed', String(state.isoCurve));
  $('#isoToggle').textContent = state.isoCurve ? t('等值切线 ✓', 'Iso-value ✓') : t('等值切线', 'Iso-value');
  $('#keyIsoWrap').hidden = !(state.isoCurve && !isTimeAxis);

  $('#subLineToggle').hidden = state.mode !== 'chart' || isTimeAxis;
  $('#subLineToggle').setAttribute('aria-pressed', String(state.subLine));
  $('#subLineToggle').textContent = state.subLine ? t('回本线 ✓', 'Sub line ✓') : t('回本线', 'Sub line');
  $('#keySubWrap').hidden = !(state.subLine && !isTimeAxis);

  $('#exportPng').hidden = state.mode !== 'chart';
  $('#exportCsv').hidden = !(state.mode === 'table' || state.mode === 'sub');

  $('#labels').setAttribute('aria-pressed', String(state.labels));
  $('#labels').textContent = state.labels ? t('显示标签 ✓', 'Labels ✓') : t('标签已关', 'Labels off');

  $('#smartLabels').disabled = !state.labels;
  $('#smartLabels').setAttribute('aria-pressed', String(state.smartLabels));
  $('#smartLabels').textContent = state.smartLabels ? t('自动避让 ✓', 'Smart cull ✓') : t('自动避让', 'Smart cull');
  $('#smartLabels').title = t(
    '优先保留帕累托前沿与高分节点标签，密集重叠处自动隐藏，放大后自动浮现',
    'Prioritize Pareto frontier labels and hide overlapping labels until zoomed in'
  );

  $('#labelSize').value = state.labelSize;
  $('#labelSizeValue').value = state.labelSize;
  $('#labelDistance').value = state.labelDistance;
  $('#labelDistanceValue').value = state.labelDistance;

  syncSettingsReset();
  syncValueControls();
  syncSubControls();
  syncHistoryControls();

  const hideFilterChrome = state.mode === 'curve' || state.mode === 'compare';
  $('#optionsPanel').hidden = state.mode !== 'chart';
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === state.mode));
  }
  $('#dataTable').hidden = state.mode !== 'table';
  $('#subPanel').hidden = state.mode !== 'sub';
  $('#comparePanel').hidden = state.mode !== 'compare';
  host.hidden = state.mode !== 'chart';
  $('#curvePanel').hidden = state.mode !== 'curve';
  $('#valueSettings').hidden = !(state.mode === 'table' || state.mode === 'curve' || (state.mode === 'chart' && (state.isoCurve || state.minScore > 0 || state.maxCost > 0) && !isTimeAxis));
  $('#subSettings').hidden = !(state.mode === 'sub' || (state.mode === 'chart' && state.subLine && !isTimeAxis));
  $('#interactionHelp').hidden = state.mode !== 'chart';
  $('#viewControls').hidden = state.mode !== 'chart';
  $('#legend').hidden = hideFilterChrome;
  $('#filterControls').hidden = hideFilterChrome;
  $('#toolbar').hidden = hideFilterChrome;
  $('#readingKey').hidden = state.mode !== 'chart';

  const topScore = state.bounds.y + state.bounds.height;
  $('#curveRangeToggle').setAttribute('aria-pressed', String(state.curveRealRange));
  $('#curveRangeToggle').textContent = state.curveRealRange
    ? t(`真实区间 0–${topScore}`, `Data range 0–${topScore}`)
    : t('全量程 0–100', 'Full 0–100');
  $('#curveScaleToggle').setAttribute('aria-pressed', String(state.curveLogY));
  $('#curveScaleToggle').textContent = state.curveLogY ? t('对数纵轴 ✓', 'Log Y ✓') : t('对数纵轴', 'Log Y');

  const hasFocus = !!(state.company || state.license !== 'all' || state.yLens || state.extraFilter || state.search || state.frontierOnly || state.minScore > 0 || state.maxCost > 0);
  $('#clearFilters').hidden = false;
  $('#clearFilters').style.visibility = hasFocus ? 'visible' : 'hidden';
  $('#clearFilters').disabled = !hasFocus;
  syncPanelControls();
}

function syncPanelControls() {
  const emptyDesktopPanel = !mobileLayout.matches && !!state && (state.mode === 'curve' || state.mode === 'compare');
  document.documentElement.dataset.mobile = String(mobileLayout.matches);
  document.documentElement.dataset.panelCollapsed = String(!controlsOpen || emptyDesktopPanel);
  $('#controlsToggle').hidden = emptyDesktopPanel;
  $('#controlPanel').hidden = !controlsOpen || emptyDesktopPanel;
  const activeFilters = state && state.mode !== 'curve' && state.mode !== 'compare'
    ? Number(!!state.company) + Number(state.license !== 'all') + Number(!!state.yLens) + Number(!!state.extraFilter) + Number(!!state.search) + Number(state.frontierOnly) + Number(state.minScore > 0) + Number(state.maxCost > 0)
    : 0;
  $('#controlsToggle').setAttribute('aria-expanded', String(controlsOpen));
  $('#controlsToggle').textContent = controlsOpen
    ? t('收起面板', 'Hide panel')
    : t(`展开面板${activeFilters ? ' · ' + activeFilters : ''}`, `Controls${activeFilters ? ' · ' + activeFilters : ''}`);
  $('#valueMore').setAttribute('aria-expanded', String(valueDetailsOpen));
  $('#valueMore').textContent = valueDetailsOpen ? t('收起说明', 'Hide formula') : t('公式与说明', 'Formula');
  $('#valueMorePanel').hidden = !valueDetailsOpen;
}

function setControlsOpen(open) {
  controlsOpen = open;
  clearHover();
  if (!open && $('#controlPanel').contains(document.activeElement)) {
    $('#controlsToggle').focus({preventScroll: true});
  }
  syncPanelControls();
  scheduleDraw();
}

$('#controlsToggle').addEventListener('click', () => {
  controlsTouched = true;
  valueDetailsOpen = false;
  setControlsOpen(!controlsOpen);
});

$('#valueMore').addEventListener('click', () => {
  if (mobileLayout.matches && controlsOpen) setControlsOpen(false);
  valueDetailsOpen = !valueDetailsOpen;
  syncPanelControls();
  scheduleDraw();
});

function syncResponsiveChrome() {
  const app = document.querySelector('.app');
  const topbar = document.querySelector('.topbar');
  const tabs = document.querySelector('.tabs');
  const footer = document.querySelector('.app-footer');
  const heading = document.querySelector('.panel-heading');
  if (mobileLayout.matches) {
    app.insertBefore(tabs, $('#chart-panel'));
    $('#controlPanel').prepend(topbar);
    $('#controlPanel').insertBefore(heading, $('#readingKey'));
    $('#controlPanel').append(footer);
  } else {
    topbar.insertBefore(tabs, document.querySelector('.top-actions'));
    app.insertBefore(topbar, $('#chart-panel'));
    document.querySelector('.workspace-bar').insertBefore(heading, $('#controlsToggle'));
    $('#chart-panel').append(footer);
  }
}

mobileLayout.addEventListener('change', () => {
  syncResponsiveChrome();
  if (!controlsTouched) setControlsOpen(!mobileLayout.matches);
  else {
    syncPanelControls();
    scheduleDraw();
  }
});

function syncSettingsReset() {
  const defaults = DEFAULT_SETTINGS[activeKey];
  const restored = Object.entries(defaults).every(([key, value]) => state[key] === value);
  $('#resetSettings').disabled = restored;
  $('#resetSettings').textContent = restored ? t('默认标签', 'Default') : t('恢复默认', 'Reset labels');
}

function syncValueControls() {
  const weight = state.valueWeight, minScore = state.minScore, maxCost = state.maxCost;
  const linear = weight === 1, pureCost = weight === 0;
  const restored = weight === VALUE_WEIGHT.default && minScore === MIN_SCORE.default && maxCost === 0;

  const slider = $('#valueWeight');
  slider.min = VALUE_WEIGHT.min;
  slider.max = VALUE_WEIGHT.max;
  slider.step = VALUE_WEIGHT.step;
  slider.value = weight;
  slider.setAttribute('aria-valuetext', `${weight.toFixed(1)}`);

  const numInput = $('#valueWeightValue');
  numInput.min = VALUE_WEIGHT.min;
  numInput.max = VALUE_WEIGHT.max;
  numInput.step = VALUE_WEIGHT.step;
  numInput.value = weight.toFixed(1);

  const floorInput = $('#minScore');
  floorInput.max = state.maxFloor;
  floorInput.value = minScore;
  $('#minScoreValue').textContent = minScore > 0 ? `≥ ${minScore}` : t('不限', 'Any');

  const maxCostSel = $('#maxCostSelect');
  const mcFrag = document.createDocumentFragment();
  for (const cap of MAX_COST_PRESETS) {
    const opt = html('option', cap === 0 ? t('不限', 'Any') : `≤ $${cap}`);
    opt.value = String(cap);
    mcFrag.append(opt);
  }
  maxCostSel.replaceChildren(mcFrag);
  maxCostSel.value = String(maxCost);

  for (const btn of document.querySelectorAll('#presetGroup button')) {
    btn.setAttribute('aria-pressed', String(Math.abs(Number(btn.dataset.preset) - weight) < 0.05));
  }

  $('#resetValueInline').hidden = restored;
  $('#resetValueWeight').disabled = restored;
  $('#resetValueWeight').textContent = restored
    ? t('已是默认设置', 'At defaults')
    : t('恢复默认 (α=3, 无限制)', 'Reset (α=3, no limits)');

  const formulaEl = $('#valueFormula');
  if (pureCost) {
    formulaEl.textContent = t('当前公式：性价比 = 50 ÷ 每任务成本（纯成本最小化）', 'Formula: Value = 50 / Cost (pure cost minimization)');
  } else if (linear) {
    formulaEl.textContent = t('当前公式：性价比 = 指数 ÷ 每任务成本（经典线性比值）', 'Formula: Value = Index / Cost (classic linear ratio)');
  } else if (weight < 1) {
    formulaEl.replaceChildren(
      document.createTextNode(t('当前公式：性价比 = 50 × (指数 / 50)', 'Formula: Value = 50 × (Index / 50)')),
      html('sup', weight.toFixed(1)),
      document.createTextNode(t(' ÷ 每任务成本（边际收益递减）', ' / Cost (diminishing returns)'))
    );
  } else {
    const beta = ((weight - 1) ** 2 / weight).toFixed(2);
    formulaEl.replaceChildren(
      document.createTextNode(t('IRT 混合公式：性价比 = 50 × (指数/50)', 'IRT Hybrid: Value = 50 × (Index/50)')),
      html('sup', weight.toFixed(1)),
      document.createTextNode(t(' × [55 / (105 − 指数)]', ' × [55 / (105 − Index)]')),
      html('sup', beta),
      document.createTextNode(t(' ÷ 成本', ' / Cost'))
    );
  }

  const ratio45to55 = capabilityUtility(55, weight) / capabilityUtility(45, weight);
  const ratio55to62 = capabilityUtility(62, weight) / capabilityUtility(55, weight);
  $('#valueEffect').textContent = t(
    `偏好弹性：45→55 分效用 ×${format(ratio45to55, 2)} · 55→62 分效用 ×${format(ratio55to62, 2)} · 成本翻倍性价比 ÷2`,
    `Elasticity: 45→55 utility ×${format(ratio45to55, 2)} · 55→62 utility ×${format(ratio55to62, 2)} · 2× cost halves value`
  );

  const {champion, championValue} = computeRankings();
  $('#valueChampion').textContent = champion
    ? t(
      `当前参数榜首：${champion.name}（指数 ${format(champion.intelligenceIndex, 2)} · ${money(champion.cost)} · 性价比 ${valueLabel(championValue)}）`,
      `Current #1 leader: ${champion.name} (Index ${format(champion.intelligenceIndex, 2)} · ${money(champion.cost)} · Value ${valueLabel(championValue)})`
    )
    : t('当前门槛或预算限制过严，暂无达标条目', 'No entries meet the current score floor or budget cap');

  $('#valueHint').textContent = t(
    '说明：该曲线结合多步达标率幂次与 IRT 高分失误率压缩，反映主观质量偏好而非官方实测收益；仅限同一榜单、同一参数内横向比较。',
    'Combines pass-rate compounding with IRT error-headroom compression. Reflects user preference, not official utility; compare within one benchmark.'
  );

  $('#curveAlpha').textContent = weight.toFixed(1);
  $('#valueUnit').textContent = pureCost ? t('50/USD', '50/USD') : linear ? t('指数/USD', 'Index/USD') : t('加权/USD', 'Weighted/USD');
}

function syncRouterControls() {
  const open = !!state.routerOpen;
  $('#routerToggle').setAttribute('aria-pressed', String(open));
  $('#routerToggle').textContent = open
    ? t('混合路由 ✓', 'Router ✓')
    : t('混合路由模拟', 'Router sim');
  $('#routerPanel').hidden = !open;
  if (!open) return;

  const sorted = sortRows(state.rows, 'intelligenceIndex', 'desc');
  for (const [selId, key] of [['#routerFastSelect', 'routerFastId'], ['#routerStrongSelect', 'routerStrongId']]) {
    const sel = $(selId);
    if (sel.dataset.bench !== activeKey || sel.options.length !== sorted.length) {
      const frag = document.createDocumentFragment();
      for (const r of sorted) {
        const opt = html('option', `${r.shortName || r.name} (${format(r.intelligenceIndex, 1)} · ${money(r.cost)})`);
        opt.value = r.id;
        frag.append(opt);
      }
      sel.replaceChildren(frag);
      sel.dataset.bench = activeKey;
    }
    if (!state.rows.some(r => r.id === state[key])) state[key] = sorted[0].id;
    sel.value = state[key];
  }

  $('#routerShare').value = state.routerShare;
  $('#routerShareOut').textContent = `${state.routerShare}% / ${100 - state.routerShare}%`;

  const fastRow = state.rows.find(r => r.id === state.routerFastId) || sorted.at(-1);
  const strongRow = state.rows.find(r => r.id === state.routerStrongId) || sorted[0];
  const res = cascadingRouteSummary(fastRow, strongRow, state.routerShare / 100, state.monthlyTasks);
  if (res) {
    const subCmp = res.monthlyBlendedBill < state.subFee
      ? t(`比 $${state.subFee} 订阅还省 ${compactMoney(state.subFee - res.monthlyBlendedBill)}/月`, `saves ${compactMoney(state.subFee - res.monthlyBlendedBill)} vs $${state.subFee}/mo`)
      : t(`高于 $${state.subFee} 订阅 +${compactMoney(res.monthlyBlendedBill - state.subFee)}（配额够用则订阅更省）`, `+${compactMoney(res.monthlyBlendedBill - state.subFee)} vs $${state.subFee}/mo (sub wins if quota suffices)`);
    $('#routerReadout').textContent = t(
      `混合均价 ${money(res.blendedCost)}/次（较纯旗舰省 ${Math.round(Math.max(0, res.savingsVsStrong) * 100)}%）· 月账单 ${compactMoney(res.monthlyBlendedBill)}（${subCmp}）`,
      `Blended ${money(res.blendedCost)}/task (−${Math.round(Math.max(0, res.savingsVsStrong) * 100)}% vs flagship) · ${compactMoney(res.monthlyBlendedBill)}/mo (${subCmp})`
    );
  }
}

function syncSubControls() {
  const fee = state.subFee, tasks = state.monthlyTasks;
  const restored = fee === MONTHLY_USAGE.defaultFee && tasks === state.defaultTasks;
  $('#subFeeValue').value = fee;
  $('#monthlyTasks').value = Math.min(500, tasks);
  $('#monthlyTasksValue').value = tasks;
  $('#dailyTasksHint').textContent = t(`≈ ${format(tasks / 30, 1)}/天`, `≈ ${format(tasks / 30, 1)}/day`);
  $('#resetSubInline').hidden = restored;

  for (const btn of document.querySelectorAll('#subTierGroup button')) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.fee) === fee));
  }
  for (const btn of document.querySelectorAll('#taskPresetGroup button')) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.tasks) === tasks));
  }

  $('#subThTierHint').textContent = t(`达 $${fee}/月`, `for $${fee}/mo`);
  $('#subThTasksHint').textContent = t(`${tasks} 次/月`, `${tasks} tasks/mo`);

  const rows = filteredRows();
  const thresholdCost = fee / tasks;
  let apiCount = 0, subCount = 0;
  for (const row of rows) {
    const verdict = subscriptionVerdict(row.cost, tasks, fee);
    if (!verdict) continue;
    if (verdict.status === 'api-cheaper') apiCount++;
    else if (verdict.status === 'sub-cheaper') subCount++;
  }
  $('#subBreakevenSummary').textContent = t(
    `盈亏平衡单价：${money(thresholdCost)}/任务 · 当前 ${subCount} 项买 $${fee}/月订阅已回本，${apiCount} 项未回本（按量 API 更省）`,
    `Break-even: ${money(thresholdCost)}/task · ${subCount} worth $${fee}/mo sub, ${apiCount} unmet (API cheaper)`
  );
  syncRouterControls();
}

function renderStatus() {
  const cfg = BENCHMARKS[activeKey];
  const version = activeKey === 'models' || activeKey === 'frontier'
    ? snapshot.modelIndexVersion
    : activeKey === 'coding-agents'
      ? snapshot.codingAgentIndexVersion
      : null;
  $('#count').textContent = `${state.rows.length} ${t(cfg.zhUnit, cfg.enUnit)}${version ? ' · v' + version : ''}`;

  const makeLink = (txt, href) => {
    const a = html('a', txt);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  };

  const time = new Date(snapshot.updatedAt);
  const label = Number.isFinite(time.getTime())
    ? time.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {hour12: false})
    : t('未知', 'Unknown');

  const sourceFrag = document.createDocumentFragment();
  sourceFrag.append(document.createTextNode(t('数据来源：', 'Source: ')));
  if (activeKey === 'human-arena') {
    sourceFrag.append(
      makeLink('LMArena', snapshot.lmArenaSourceUrl || 'https://lmarena.ai/leaderboard'),
      document.createTextNode(' + '),
      makeLink('Design Arena', snapshot.designArenaSourceUrl || 'https://www.designarena.ai/leaderboard'),
      document.createTextNode(' + '),
      makeLink('Artificial Analysis', 'https://artificialanalysis.ai/evaluations/gdpval-aa')
    );
  } else {
    sourceFrag.append(makeLink('Artificial Analysis', cfg.source));
  }
  sourceFrag.append(document.createTextNode(t(` · 快照更新：${label}`, ` · Snapshot: ${label}`)));
  $('#status').replaceChildren(sourceFrag);
  if (Date.now() - time.getTime() > 8 * 60 * 60 * 1000) {
    $('#status').append(document.createTextNode(t(' · 快照较早', ' · Older snapshot')));
  }
  $('#status').title = t(
    '仅在源数据变化时更新快照时间；每 2 小时自动检查记录见 GitHub Actions。',
    'Snapshot timestamp updates only when upstream benchmark data changes.'
  );
  $('#costNote').textContent = t(cfg.zhCostNote, cfg.enCostNote);
  $('#keyQuadrantWrap').title = t(
    '参考象限：成本不高于全榜中位数，且指数不低于全榜中位数。',
    'Reference region: cost at or below median and score at or above median across all entries.'
  );
}

function x(value) {
  return frame.left + (value - state.view.x) / state.view.width * frame.width;
}

function y(value) {
  return frame.bottom - (value - state.view.y) / state.view.height * frame.height;
}

function xCoord(row) {
  const val = xValOf(row, state.xMetric);
  return val === null ? NaN : x(val);
}

function inView(row) {
  const val = xValOf(row, state.xMetric);
  if (val === null) return false;
  const xx = x(val), yy = y(row.intelligenceIndex);
  return xx >= frame.left - 0.01 && xx <= frame.right + 0.01 && yy >= frame.top - 0.01 && yy <= frame.bottom + 0.01;
}

function glowId(display) {
  return 'point-glow-' + display.slice(1);
}

function buildPlot() {
  clearHover();
  const rows = filteredRows();
  const defs = node('defs');
  const clip = node('clipPath', {id: 'plot-clip'});
  const emphasisClip = node('clipPath', {id: 'emphasis-clip'});
  clip.append(node('rect'));
  emphasisClip.append(node('rect'));
  defs.append(clip, emphasisClip);

  for (const display of new Set(rows.map(row => color(row.creator?.color)))) {
    const gradient = node('radialGradient', {id: glowId(display), cx: '50%', cy: '50%', r: '50%'});
    for (const [offset, opacity] of [['0%', 0.58], ['35%', 0.36], ['70%', 0.11], ['100%', 0]]) {
      gradient.append(node('stop', {offset, 'stop-color': display, 'stop-opacity': opacity}));
    }
    defs.append(gradient);
  }

  const plot = node('g', {'clip-path': 'url(#plot-clip)', class: 'plot-content'});
  const quadrant = node('rect', {class: 'quadrant'});
  const quadrantBorder = node('path', {class: 'quadrant-border'});
  const floorRect = node('rect', {class: 'floor-rect'});
  const floorGuide = node('line', {class: 'floor-guide'});
  const budgetRect = node('rect', {class: 'budget-rect'});
  const budgetGuide = node('line', {class: 'budget-guide'});
  const paretoPath = node('path', {class: 'pareto'});
  const paretoHistoryPath = node('path', {class: 'pareto-history'});
  const effortLayer = node('g', {class: 'effort-layer'});
  const isoPath = node('path', {class: 'iso-curve'});
  const subGuide = node('line', {class: 'sub-guide'});
  const connectors = node('g', {class: 'connector-layer'});
  const points = node('g', {class: 'points'});
  const labels = node('g', {class: 'label-layer'});

  const emphasis = node('g', {class: 'emphasis-layer', 'clip-path': 'url(#emphasis-clip)', 'aria-hidden': 'true', 'pointer-events': 'none'});
  emphasis.append(
    node('g', {class: 'active-effort-layer'}),
    node('g', {class: 'glow-layer'}),
    node('g', {class: 'company-layer'}),
    node('g', {class: 'active-layer'})
  );

  plot.append(quadrant, quadrantBorder, floorRect, floorGuide, budgetRect, budgetGuide, paretoPath, paretoHistoryPath, effortLayer, isoPath, subGuide, connectors, points, labels);
  svg.replaceChildren(defs, node('g', {class: 'grid'}), plot, node('g', {class: 'axis'}), emphasis);

  const axisName = currentAxisLabel();
  nodes = rows.map(row => {
    const display = color(row.creator?.color);
    const metricText = state.xMetric === 'time' ? formatTime(row.timeSec) : money(row.cost);
    const p = node('circle', {
      class: 'point',
      'data-id': row.id,
      r: 4.4,
      fill: display,
      tabindex: 0,
      role: 'button',
      'aria-label': `${row.name}, ${axisName} ${format(row.intelligenceIndex, 2)}, ${metricText}`
    });
    const label = node('text', {class: 'label', fill: display, 'font-size': state.labelSize}, row.shortName || row.name);
    const line = node('line', {class: 'connector', stroke: display});
    points.append(p);
    labels.append(label);
    connectors.append(line);
    const item = {row, p, label, line, color: display};
    p.addEventListener('focus', () => showHover(item));
    p.addEventListener('blur', clearHover);
    p.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePin(item);
      }
      if (event.key === 'Escape') {
        clearPin();
        p.blur();
        host.focus();
      }
    });
    return item;
  });

  if (state.selected && !rows.some(row => row.id === state.selected)) state.selected = null;
  if (state.mode === 'table') renderTable(rows);
  else if (state.mode === 'sub') renderSubTable(rows);
  else if (state.mode === 'compare') renderCompare();
  updateSummary();
  scheduleDraw();
}

function locateRowInChart(row) {
  if (state.xMetric === 'time' && xValOf(row, 'time') === null) {
    syncMetricViewport(state, 'cost');
  }
  state.selected = row.id;
  state.mode = 'chart';
  valueDetailsOpen = false;
  syncControls();
  buildPlot();
  const rect = host.getBoundingClientRect();
  const rx = xValOf(row, state.xMetric) ?? row.cost;
  const defSpan = state.xMetric === 'time' ? BENCHMARKS[activeKey].defaultTimeMin : BENCHMARKS[activeKey].defaultX;
  if (rect.width > 40 && rect.height > 40) {
    const v = state.view;
    if (rx < v.x || rx > v.x + v.width || row.intelligenceIndex < v.y || row.intelligenceIndex > v.y + v.height) {
      const targetWidth = Math.max(v.width, Math.min(state.bounds.width, Math.max(rx * 1.45, defSpan)));
      const targetHeight = state.bounds.height;
      state.view = clampView({
        x: Math.max(0, rx - targetWidth * 0.55),
        y: state.bounds.y,
        width: targetWidth,
        height: targetHeight
      }, state.bounds);
    }
  }
  syncUrlHash();
  scheduleDraw();
}

function toggleCompareId(id, {evictOldest = true} = {}) {
  if (!state) return;
  const idx = state.compareIds.indexOf(id);
  if (idx !== -1) {
    if (state.compareIds.length > 1) state.compareIds.splice(idx, 1);
  } else {
    if (state.compareIds.length >= MAX_COMPARE) {
      if (!evictOldest) return;
      state.compareIds.shift();
    }
    state.compareIds.push(id);
  }
  if (activeKey !== 'coding-agents') lastModelCompareIds = [...state.compareIds];
  syncUrlHash();
  if (state.mode === 'table') renderTable();
  else if (state.mode === 'sub') renderSubTable();
  else if (state.mode === 'compare') renderCompare();
  renderPinned();
  updateSummary();
}

function makeCompareRowBtn(row) {
  const inCompare = state.compareIds.includes(row.id);
  const btn = html('button', inCompare ? t('已对比 ✓', 'In cmp ✓') : t('+对比', '+Cmp'), 'locate-btn compare-row-btn');
  btn.type = 'button';
  btn.setAttribute('aria-pressed', String(inCompare));
  btn.addEventListener('click', event => {
    event.stopPropagation();
    toggleCompareId(row.id);
  });
  return btn;
}

function renderTable(rows = filteredRows()) {
  const pool = licenseFilteredRows(state.rows);
  const fragment = document.createDocumentFragment();
  const scaleSource = state.frontierOnly || state.search.trim() || state.minScore > 0 || state.maxCost > 0 ? rows : pool;
  const fallbackRows = scaleSource.length ? scaleSource : state.rows;
  const maxCost = Math.max(...fallbackRows.map(row => row.cost), 0.001);
  const maxTime = Math.max(...fallbackRows.map(row => row.timeSec || 0), 1);
  const comparableValues = fallbackRows
    .map(row => valuePerDollar(row, state.valueWeight, state.minScore, state.maxCost))
    .filter(value => value !== null);
  const maxValue = comparableValues.length ? Math.max(...comparableValues) : null;
  const valueRange = maxValue === null ? t('暂无', 'None') : `0–${valueLabel(maxValue)}`;

  $('#tableScale').textContent = t(
    `比较条比例（${scaleSource === pool && state.license === 'all' ? '全榜统一' : '当前筛选范围'}）：指数 0–100 · 成本 $0–${format(maxCost)} · 耗时 0–${formatTime(maxTime)} · 性价比 ${valueRange}`,
    `Linear bar scale (${scaleSource === pool && state.license === 'all' ? 'full benchmark' : 'filtered set'}): Index 0–100 · Cost $0–${format(maxCost)} · Time 0–${formatTime(maxTime)} · Value ${valueRange}`
  );

  const frontierIds = new Set(paretoFrontier(pool).map(row => row.id));
  const {champion} = computeRankings(pool);

  for (const row of sortRows(rows, state.sortKey, state.sortDirection, state.valueWeight, state.minScore, state.maxCost)) {
    const tr = html('tr');
    tr.dataset.id = row.id;
    const belowFloor = state.minScore > 0 && row.intelligenceIndex < state.minScore;
    const overBudget = state.maxCost > 0 && row.cost > state.maxCost;
    tr.classList.toggle('is-muted', (!!state.company && row.creator?.name !== state.company) || belowFloor || overBudget);
    tr.classList.toggle('is-selected', state.selected === row.id);

    const nameTd = html('td', null, 'table-name');
    const wrap = html('div', null, 'name-wrap');
    const dot = html('i', null, 'creator-dot');
    const displayColor = color(row.creator?.color);
    dot.style.background = displayColor;
    dot.setAttribute('aria-hidden', 'true');
    wrap.append(dot, html('span', row.name));

    if (champion && champion.id === row.id) {
      wrap.append(html('span', '#1', 'row-tag tag-top'));
    }
    if (isRecentRelease(row)) {
      wrap.append(html('span', t('新', 'NEW'), 'row-tag tag-new'));
    }
    if (frontierIds.has(row.id)) {
      wrap.append(html('span', t('前沿', 'Frontier'), 'row-tag'));
    }
    if (activeKey === 'frontier' && (row.rankDelta ?? 0) >= 3) {
      wrap.append(html('span', t(`硬核↑${row.rankDelta}`, `↑${row.rankDelta}`), 'row-tag tag-new'));
    }
    if (activeKey === 'human-arena' && (row.arenaRaw?.designWebElo ?? 0) >= 1330 && (row.arenaRaw?.designWebBattles ?? 0) >= 500) {
      wrap.append(html('span', t('高审美', 'Aesthetic'), 'row-tag tag-new'));
    }
    if (activeKey === 'human-arena' && (row.indexDelta ?? 0) >= 18) {
      wrap.append(html('span', t(`体感↑+${Math.round(row.indexDelta)}`, `Vibe +${Math.round(row.indexDelta)}`), 'row-tag tag-top'));
    }
    if (row.isOpenWeights) {
      wrap.append(html('span', t('开源', 'Open'), 'row-tag tag-open'));
    }

    const locateBtn = html('button', t('图中定位', 'Locate'), 'locate-btn');
    locateBtn.type = 'button';
    locateBtn.addEventListener('click', event => {
      event.stopPropagation();
      locateRowInChart(row);
    });
    wrap.append(locateBtn, makeCompareRowBtn(row));
    nameTd.append(wrap);

    const hasTime = typeof row.timeSec === 'number' && Number.isFinite(row.timeSec) && row.timeSec > 0;
    const timeCell = comparisonCell(formatTime(row.timeSec), hasTime ? row.timeSec / maxTime : 0, displayColor);
    if (!hasTime) timeCell.querySelector('.comparison-track').hidden = true;

    const value = valuePerDollar(row, state.valueWeight, state.minScore, state.maxCost);
    const displayVal = belowFloor
      ? t('未达门槛', '< Min')
      : overBudget
        ? t('超出预算', '> Cap')
        : valueLabel(value);
    const valueCell = comparisonCell(displayVal, value !== null && maxValue > 0 ? value / maxValue : 0, displayColor);
    valueCell.className = 'value-column';
    valueCell.title = belowFloor
      ? t(`低于最低门槛 ${state.minScore} 分`, `Below minimum score ${state.minScore}`)
      : overBudget
        ? t(`高于预算上限 $${state.maxCost}/任务`, `Exceeds budget cap $${state.maxCost}/task`)
        : value === null
          ? t('无有效性价比', 'No comparable value')
          : `${t('原始精度性价比', 'Exact weighted value')}: ${value.toPrecision(8)}`;
    if (value === null) valueCell.querySelector('.comparison-track').hidden = true;

    tr.append(
      nameTd,
      html('td', row.creator?.name || 'Other'),
      comparisonCell(format(row.intelligenceIndex, 2), row.intelligenceIndex / 100, displayColor),
      comparisonCell(money(row.cost), row.cost / maxCost, displayColor),
      timeCell,
      valueCell
    );

    tr.addEventListener('click', () => {
      state.selected = state.selected === row.id ? null : row.id;
      renderTable(rows);
      updateSummary();
    });
    fragment.append(tr);
  }

  if (!rows.length) {
    const td = html('td', t('没有匹配的条目，请调整搜索词或清除筛选。', 'No matching entries. Try clearing filters.'));
    td.colSpan = 6;
    const tr = html('tr');
    tr.append(td);
    fragment.append(tr);
  }
  $('#tableBody').replaceChildren(fragment);

  for (const button of document.querySelectorAll('.sort-button')) {
    const selected = button.dataset.sort === state.sortKey;
    button.closest('th').setAttribute('aria-sort', selected ? (state.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
    button.querySelector('.sort-arrow').textContent = selected ? (state.sortDirection === 'asc' ? '↑' : '↓') : '↕';
  }
}

function comparisonCell(value, ratio, displayColor) {
  const cell = html('td');
  const comparison = html('div', null, 'comparison');
  const track = html('span', null, 'comparison-track');
  const bar = html('i');
  track.setAttribute('aria-hidden', 'true');
  bar.style.width = Math.max(0, Math.min(100, ratio * 100)) + '%';
  bar.style.background = displayColor;
  track.append(bar);
  comparison.append(html('span', value, 'comparison-value'), track);
  cell.append(comparison);
  return cell;
}

function renderSubTable(rows = filteredRows()) {
  const pool = licenseFilteredRows(state.rows);
  const fragment = document.createDocumentFragment();
  const frontierIds = new Set(paretoFrontier(pool).map(row => row.id));
  const fee = state.subFee, tasks = state.monthlyTasks;
  const collator = new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'});
  const sign = state.subSortDirection === 'asc' ? 1 : -1;

  const sorted = [...rows].sort((a, b) => {
    let primary = 0;
    if (state.subSortKey === 'name') {
      primary = collator.compare(a.name, b.name);
    } else if (state.subSortKey === 'intelligenceIndex') {
      primary = a.intelligenceIndex - b.intelligenceIndex;
    } else if (state.subSortKey === 'cost' || state.subSortKey === 'apiBill') {
      primary = a.cost - b.cost;
    } else if (state.subSortKey === 'breakeven') {
      const ba = breakEvenTasks(a.cost, fee) ?? Infinity;
      const bb = breakEvenTasks(b.cost, fee) ?? Infinity;
      primary = ba - bb;
    }
    return primary * sign || collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
  });

  const maxBe = Math.max(...rows.map(r => Math.min(500, breakEvenTasks(r.cost, fee) || 0)), 1);

  for (const row of sorted) {
    const tr = html('tr');
    tr.dataset.id = row.id;
    tr.classList.toggle('is-muted', !!state.company && row.creator?.name !== state.company);
    tr.classList.toggle('is-selected', state.selected === row.id);

    const displayColor = color(row.creator?.color);
    const nameTd = html('td', null, 'table-name');
    const wrap = html('div', null, 'name-wrap');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = displayColor;
    dot.setAttribute('aria-hidden', 'true');
    wrap.append(dot, html('span', row.name));
    if (isRecentRelease(row)) wrap.append(html('span', t('新', 'NEW'), 'row-tag tag-new'));
    if (frontierIds.has(row.id)) wrap.append(html('span', t('前沿', 'Frontier'), 'row-tag'));
    if (row.isOpenWeights) wrap.append(html('span', t('开源', 'Open'), 'row-tag tag-open'));

    const locateBtn = html('button', t('图中定位', 'Locate'), 'locate-btn');
    locateBtn.type = 'button';
    locateBtn.addEventListener('click', event => {
      event.stopPropagation();
      locateRowInChart(row);
    });
    wrap.append(locateBtn, makeCompareRowBtn(row));
    nameTd.append(wrap);

    const costTd = html('td', money(row.cost));
    costTd.style.fontVariantNumeric = 'tabular-nums';

    const verdict = subscriptionVerdict(row.cost, tasks, fee);
    const beRatio = verdict ? Math.min(1, Math.min(500, verdict.breakeven) / maxBe) : 0;
    const beTd = comparisonCell(verdict ? formatTaskCount(verdict.breakeven) : '—', beRatio, displayColor);
    beTd.title = tierBreakevenText(row.cost);

    const billTd = html('td');
    const verdictWrap = html('div', null, 'verdict-wrap');
    verdictWrap.append(html('span', verdict ? compactMoney(verdict.apiBill) : '—', 'bill-amount'));
    if (verdict) {
      let pillText, pillClass;
      if (verdict.status === 'sub-cheaper') {
        pillText = t(`已回本 · 订阅省 ${compactMoney(verdict.delta)}`, `Sub saves ${compactMoney(verdict.delta)}`);
        pillClass = 'verdict-pill pill-sub';
        billTd.title = t(
          `预计月 API 账单 ${compactMoney(verdict.apiBill)} 高于 $${fee} 订阅费：配额够用时买订阅划算（省 ${compactMoney(verdict.delta)}）`,
          `Est. API bill ${compactMoney(verdict.apiBill)} exceeds $${fee}/mo: subscription saves ${compactMoney(verdict.delta)} if quota suffices`
        );
      } else if (verdict.status === 'api-cheaper') {
        pillText = t(`未回本 · API 省 ${compactMoney(Math.abs(verdict.delta))}`, `Unmet · API −${compactMoney(Math.abs(verdict.delta))}`);
        pillClass = 'verdict-pill pill-api';
        billTd.title = t(
          `预计月 API 账单仅 ${compactMoney(verdict.apiBill)}，未达 $${fee} 订阅回本线：买订阅不划算，直接按量用 API 省 ${compactMoney(Math.abs(verdict.delta))}`,
          `Est. API bill ${compactMoney(verdict.apiBill)} is below $${fee}/mo: subscription doesn't break even; pay-as-you-go API saves ${compactMoney(Math.abs(verdict.delta))}`
        );
      } else {
        pillText = t('约持平', '≈ Even');
        pillClass = 'verdict-pill pill-even';
      }
      verdictWrap.append(html('span', pillText, pillClass));
    }
    billTd.append(verdictWrap);

    tr.append(
      nameTd,
      comparisonCell(format(row.intelligenceIndex, 2), row.intelligenceIndex / 100, displayColor),
      costTd,
      beTd,
      billTd
    );

    tr.addEventListener('click', () => {
      state.selected = state.selected === row.id ? null : row.id;
      renderSubTable(rows);
      updateSummary();
    });
    fragment.append(tr);
  }

  if (!rows.length) {
    const td = html('td', t('没有匹配的条目，请调整搜索词或清除筛选。', 'No matching entries. Try clearing filters.'));
    td.colSpan = 5;
    const tr = html('tr');
    tr.append(td);
    fragment.append(tr);
  }
  $('#subTableBody').replaceChildren(fragment);

  for (const button of document.querySelectorAll('.sub-sort-button')) {
    const selected = button.dataset.subSort === state.subSortKey;
    button.closest('th').setAttribute('aria-sort', selected ? (state.subSortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
    button.querySelector('.sort-arrow').textContent = selected ? (state.sortDirection === 'asc' ? '↑' : '↓') : '↕';
  }
}

function exportCsv() {
  if (!state) return;
  const rows = sortRows(filteredRows(), state.sortKey, state.sortDirection, state.valueWeight, state.minScore, state.maxCost);
  const escapeCsv = val => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const headers = [
    'Name',
    'Creator',
    'License',
    'Effort',
    'ReleaseDate',
    'IntelligenceIndex',
    'CostPerTaskUSD',
    'MeanTimeSec',
    ...(activeKey === 'frontier' ? ['AA_OverallIndex', 'HardRankDelta'] : []),
    ...(activeKey === 'human-arena' ? ['LMArena_ChatElo', 'LMArena_WebDevElo', 'DesignArena_WebElo', 'AA_GDPvalElo'] : []),
    ...(activeKey === 'cyber' ? ['SafetyRefusalPct'] : []),
    `WeightedValue_w${state.valueWeight.toFixed(1)}`,
    `BreakEvenTasks_$${state.subFee}`,
    `EstMonthlyApiUSD_${state.monthlyTasks}tasks`,
    `SubVerdict_$${state.subFee}`
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const val = valuePerDollar(row, state.valueWeight, state.minScore, state.maxCost);
    const be = breakEvenTasks(row.cost, state.subFee);
    const verdict = subscriptionVerdict(row.cost, state.monthlyTasks, state.subFee);
    const verdictCode = !verdict
      ? ''
      : verdict.status === 'sub-cheaper'
        ? 'Worth_Subscription'
        : verdict.status === 'api-cheaper'
          ? 'Unmet_API_Cheaper'
          : 'Near_BreakEven';
    lines.push([
      row.name,
      row.creator?.name || 'Other',
      row.isOpenWeights ? 'Open Weights' : 'Proprietary',
      row.effort?.label || '',
      row.releaseDate || '',
      row.intelligenceIndex.toFixed(4),
      row.cost.toFixed(6),
      row.timeSec ?? '',
      ...(activeKey === 'frontier' ? [row.aaIndex ?? '', row.rankDelta ?? ''] : []),
      ...(activeKey === 'human-arena' ? [
        row.arenaRaw?.chatElo ?? '',
        row.arenaRaw?.webdevElo ?? '',
        row.arenaRaw?.designWebElo ?? '',
        row.arenaRaw?.gdpvalElo ?? ''
      ] : []),
      ...(activeKey === 'cyber' ? [row.refusalRate ?? ''] : []),
      val !== null ? val.toFixed(4) : '',
      be !== null ? be.toFixed(2) : '',
      verdict ? verdict.apiBill.toFixed(4) : '',
      verdictCode
    ].map(escapeCsv).join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `intelligence-vs-cost-${activeKey}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function shortEvalLabel(name) {
  if (/frontiercode/i.test(name)) return 'FrontierCode';
  if (/swe-atlas/i.test(name)) return 'SWE-Atlas';
  if (/terminal-bench/i.test(name)) return 'Terminal v4';
  return name.length > 14 ? name.slice(0, 13) + '…' : name;
}

function exportChartPng(kind = state?.mode) {
  if (!state) return;
  const targetSvg = kind === 'curve' ? $('#curveSvg') : kind === 'compare' ? $('#radarSvg') : $('#svg');
  const vb = targetSvg.getAttribute('viewBox')?.split(/\s+/).map(Number);
  if (!vb || vb.length !== 4 || !(vb[2] > 0 && vb[3] > 0)) return;
  const [, , svgW, svgH] = vb;

  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim() || '#888';
  const clone = targetSvg.cloneNode(true);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('width', String(svgW));
  clone.setAttribute('height', String(svgH));

  const styleText = `
    svg { font-family: "IBM Plex Sans", "Segoe UI", "Microsoft YaHei UI", sans-serif; }
    .grid line, .curve-grid line { stroke: ${v('--grid')}; stroke-width: 1; }
    .frame { stroke: ${v('--frame')}; stroke-width: 1; fill: none; }
    .axis text, .curve-axis text, .radar-scale-tick { fill: ${v('--muted')}; font-size: 11px; }
    .axis .axis-title, .curve-axis .axis-title { fill: ${v('--ink')}; font-size: 11.5px; font-weight: 500; }
    .axis .quadrant-note { fill: ${v('--muted')}; font-size: 11px; opacity: 0.78; }
    .quadrant { fill: ${v('--quadrant')}; }
    .quadrant-border { stroke: ${v('--quadrant-edge')}; stroke-width: 1; stroke-dasharray: 4 4; fill: none; }
    .floor-rect, .budget-rect { fill: ${v('--floor-shade')}; }
    .floor-guide, .budget-guide { stroke: ${v('--floor-line')}; stroke-width: 1.2; stroke-dasharray: 5 4; }
    .budget-guide-label { fill: ${v('--floor-line')}; font-size: 11px; font-weight: 600; }
    .pareto { stroke: ${v('--frontier')}; stroke-width: 1.6; stroke-dasharray: 2 5; fill: none; }
    .pareto-history { stroke: ${v('--accent')}; stroke-width: 2.3; fill: none; }
    .effort-line { fill: none; stroke-width: 1.6; stroke-dasharray: 4 3; opacity: 0.6; }
    .effort-line.is-highlighted { stroke-width: 2.3; stroke-dasharray: none; opacity: 0.95; }
    .iso-curve { stroke: ${v('--accent')}; stroke-width: 1.75; stroke-dasharray: 6 4; fill: none; }
    .sub-guide { stroke: ${v('--amber')}; stroke-width: 1.65; stroke-dasharray: 6 4; }
    .sub-guide-label { fill: ${v('--amber')}; font-size: 11.5px; font-weight: 600; }
    .point, .curve-pareto-dot { stroke: ${v('--halo')}; stroke-width: 1.2; }
    .label { stroke: ${v('--halo')}; stroke-width: 2.2; paint-order: stroke; }
    .connector { stroke-width: 0.75; opacity: 0.6; }
    .champion-ring { stroke: ${v('--accent')}; stroke-width: 2; stroke-dasharray: 3 2; fill: none; }
    .curve-champion-label { fill: ${v('--accent')}; font-size: 11.5px; font-weight: 600; }
    .utility-line { fill: none; stroke: ${v('--accent')}; stroke-width: 2.5; }
    .utility-reference { fill: none; stroke: ${v('--muted')}; stroke-width: 1.5; stroke-dasharray: 6 5; }
    .utility-area { fill: ${v('--accent')}; opacity: 0.08; }
    .curve-probe path { stroke: ${v('--accent')}; stroke-width: 1; stroke-dasharray: 3 4; }
    .curve-probe circle { fill: ${v('--accent')}; stroke: ${v('--chart')}; stroke-width: 2; }
    .radar-grid, .radar-spoke { fill: none; stroke: ${v('--border-strong')}; stroke-width: 1; opacity: 0.72; }
    .radar-ring-fill { fill: ${v('--chart')}; opacity: 0.42; }
    .radar-axis-label { fill: ${v('--ink')}; font-size: 12.5px; font-weight: 600; }
    .radar-axis-sub { fill: ${v('--accent')}; font-size: 11px; font-weight: 500; }
    .radar-svg.has-focus .radar-series:not(.is-focused) { opacity: 0.18; }
    .radar-series.is-focused polygon { stroke-width: 3.4; fill-opacity: 0.25; }
    .radar-vertex-val { font-size: 11px; font-weight: 600; stroke: ${v('--halo')}; stroke-width: 3px; paint-order: stroke; }
  `;
  const styleNode = node('style', {}, styleText);
  clone.prepend(styleNode);

  let serialized = new XMLSerializer().serializeToString(clone);
  serialized = serialized.replace(/var\((--[a-z0-9-]+)\)/gi, (_, name) => v(name));
  const svgBlob = new Blob([serialized], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const padX = 24, footH = 32;
    const outW = Math.max(640, svgW + padX * 2);
    const measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = '500 12px "IBM Plex Sans", "Segoe UI", sans-serif';
    const legendPlaced = [];
    let legendRows = 0;
    if (kind === 'compare') {
      const rowMap = new Map(state.rows.map(r => [r.id, r]));
      let lx = padX, rowIdx = 0;
      const maxRight = outW - padX;
      state.compareIds.map(id => rowMap.get(id)).filter(Boolean).forEach((r, idx) => {
        const nameTxt = r.shortName || r.name;
        const itemW = measureCtx.measureText(nameTxt).width + 26;
        if (lx > padX && lx + itemW > maxRight) {
          rowIdx++;
          lx = padX;
        }
        legendPlaced.push({idx, nameTxt, x: lx, rowIdx});
        lx += itemW;
      });
      legendRows = legendPlaced.length ? rowIdx + 1 : 0;
    }
    const headH = kind === 'compare' ? 56 + legendRows * 20 : 54;
    const outH = svgH + headH + footH;
    const canvas = document.createElement('canvas');
    canvas.width = outW * scale;
    canvas.height = outH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = v('--chart');
    ctx.fillRect(0, 0, outW, outH);

    ctx.fillStyle = v('--ink');
    ctx.font = '600 16px "IBM Plex Sans", "Segoe UI", sans-serif';
    const titleStr = kind === 'compare' ? $('#radarHeading').textContent : $('#chartTitle').textContent;
    ctx.fillText(titleStr, padX, 28);

    ctx.fillStyle = v('--muted');
    ctx.font = '400 12px "IBM Plex Sans", "Segoe UI", sans-serif';
    ctx.fillText($('#viewStatus').textContent || '', padX, 46);

    if (kind === 'compare') {
      for (const item of legendPlaced) {
        const ly = 64 + item.rowIdx * 20;
        ctx.fillStyle = compareColor(item.idx);
        ctx.beginPath();
        ctx.arc(item.x + 4, ly - 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = v('--ink');
        ctx.font = '500 12px "IBM Plex Sans", "Segoe UI", sans-serif';
        ctx.fillText(item.nameTxt, item.x + 12, ly);
      }
    }

    ctx.drawImage(img, (outW - svgW) / 2, headH, svgW, svgH);

    ctx.fillStyle = v('--muted');
    ctx.font = '400 11.5px "IBM Plex Sans", "Segoe UI", sans-serif';
    ctx.fillText(`Artificial Analysis · Intelligence vs. Cost (${new Date().toISOString().slice(0, 10)})`, padX, outH - 11);

    canvas.toBlob(pngBlob => {
      URL.revokeObjectURL(url);
      if (!pngBlob) return;
      const dlUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `intelligence-vs-cost-${activeKey}-${kind}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function modalitySummary(row) {
  const parts = [t('文本', 'Text')];
  if (row.modalities?.includes('image')) parts.push(t('图像', 'Img'));
  if (row.modalities?.includes('speech')) parts.push(t('语音', 'Aud'));
  if (row.modalities?.includes('video')) parts.push(t('视频', 'Vid'));
  return parts.join('+');
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - ax, py - ay);
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

function radarSvgPoint(event) {
  const rect = $('#radarSvg')?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * 580,
    y: ((event.clientY - rect.top) / rect.height) * 410
  };
}

function hitTestRadar(sx, sy) {
  if (!radarCtx) return null;
  const {cx, cy, verticesBySeries, axisEndpoints} = radarCtx;

  // 1. Exact vertex proximity (never blocked by upper polygon fills!)
  const nearDots = [];
  verticesBySeries.forEach((verts, sIdx) => {
    verts.forEach((v, aIdx) => {
      if (v.val === null) return;
      const d = Math.hypot(sx - v.x, sy - v.y);
      if (d <= 16) nearDots.push({sIdx, aIdx, d, x: v.x, y: v.y, val: v.val});
    });
  });
  if (nearDots.length) {
    nearDots.sort((a, b) => a.d - b.d || a.sIdx - b.sIdx);
    const top = nearDots[0];
    const cluster = nearDots.filter(m => m.aIdx === top.aIdx && m.d <= top.d + 6);
    const pinnedIdx = state?.radarPinnedId ? radarCtx.selectedRows.findIndex(r => r.id === state.radarPinnedId) : -1;
    const chosen = cluster.find(m => m.sIdx === pinnedIdx) || top;
    return {kind: 'vertex', seriesIdx: chosen.sIdx, axisIdx: top.aIdx, cluster};
  }

  // Nearest spoke angle helper
  let nearestAxis = 0, bestAngDist = Infinity;
  axisEndpoints.forEach((ep, aIdx) => {
    const d = distToSegment(sx, sy, cx, cy, ep.ex, ep.ey);
    if (d < bestAngDist) {
      bestAngDist = d;
      nearestAxis = aIdx;
    }
  });

  // 2. Polygon outline edge proximity (pierces straight through overlapping fills!)
  let bestEdgeDist = 10.5, bestEdgeSeries = -1;
  verticesBySeries.forEach((verts, sIdx) => {
    const present = verts.filter(v => v.val !== null);
    if (present.length < 2) return;
    const edgeCount = present.length === 2 ? 1 : present.length;
    for (let i = 0; i < edgeCount; i++) {
      const a = present[i], b = present[(i + 1) % present.length];
      const d = distToSegment(sx, sy, a.x, a.y, b.x, b.y);
      if (d < bestEdgeDist) {
        bestEdgeDist = d;
        bestEdgeSeries = sIdx;
      }
    }
  });
  if (bestEdgeSeries >= 0) {
    return {kind: 'edge', seriesIdx: bestEdgeSeries, axisIdx: bestAngDist <= 22 ? nearestAxis : null, cluster: null};
  }

  // 3. Axis label or spoke hover
  for (let i = 0; i < axisEndpoints.length; i++) {
    const ep = axisEndpoints[i];
    if (Math.abs(sx - ep.lx) <= 52 && Math.abs(sy - (ep.ly + 4)) <= 19) {
      return {kind: 'axis', seriesIdx: null, axisIdx: i, cluster: null};
    }
  }
  if (Math.hypot(sx - cx, sy - cy) > 18 && bestAngDist <= 9) {
    return {kind: 'axis', seriesIdx: null, axisIdx: nearestAxis, cluster: null};
  }
  return null;
}

function syncRadarSpotlight(hoverSeriesIdx = null, hoverAxisKey = null) {
  if (!radarCtx || !state) return;
  const {selectedRows, seriesLayer, calloutLayer, verticesBySeries, axes} = radarCtx;
  const radarSvg = $('#radarSvg');

  let pinnedIdx = state.radarPinnedId ? selectedRows.findIndex(r => r.id === state.radarPinnedId) : -1;
  if (pinnedIdx === -1 && state.radarPinnedId) state.radarPinnedId = null;

  const activeIdx = hoverSeriesIdx !== null && hoverSeriesIdx >= 0 ? hoverSeriesIdx : pinnedIdx;
  const groups = [...seriesLayer.querySelectorAll('.radar-series')];

  if (activeIdx >= 0) {
    radarSvg.classList.add('has-focus');
    groups.sort((a, b) => {
      const ia = Number(a.dataset.seriesIdx), ib = Number(b.dataset.seriesIdx);
      return Number(ia === activeIdx) - Number(ib === activeIdx) || ia - ib;
    });
    for (const g of groups) {
      const isAct = Number(g.dataset.seriesIdx) === activeIdx;
      g.classList.toggle('is-focused', isAct);
      seriesLayer.append(g);
    }
  } else {
    radarSvg.classList.remove('has-focus');
    groups.sort((a, b) => Number(a.dataset.seriesIdx) - Number(b.dataset.seriesIdx));
    for (const g of groups) {
      g.classList.remove('is-focused');
      seriesLayer.append(g);
    }
  }

  // Render crisp vertex score badges for the spotlighted model
  calloutLayer.replaceChildren();
  if (activeIdx >= 0 && verticesBySeries[activeIdx]) {
    const sc = compareColor(activeIdx);
    verticesBySeries[activeIdx].forEach((v, i) => {
      if (v.val === null) return;
      const radialShift = v.ratio > 0.82 ? -13 : 12;
      const tx = v.x + Math.cos(v.ang) * radialShift;
      const ty = v.y + Math.sin(v.ang) * radialShift + 3.5;
      calloutLayer.append(node('text', {
        class: 'radar-vertex-val',
        x: tx,
        y: ty,
        fill: sc,
        'text-anchor': 'middle'
      }, `${format(v.val, 1)}%`));
    });
  }

  // Sync chip states
  document.querySelectorAll('#compareChips .compare-chip').forEach((chip, idx) => {
    chip.classList.toggle('is-pinned', idx === pinnedIdx);
    chip.classList.toggle('is-focused', idx === activeIdx);
  });

  // Sync spoke, axis label & score card highlights
  radarSvg.querySelectorAll('.radar-spoke').forEach((sp, i) => {
    sp.classList.toggle('is-axis-active', axes[i]?.key === hoverAxisKey);
  });
  radarSvg.querySelectorAll('.radar-axis-label').forEach((lbl, i) => {
    lbl.classList.toggle('is-axis-active', axes[i]?.key === hoverAxisKey);
  });
  document.querySelectorAll('#subscoreBars .radar-dim-card').forEach(card => {
    card.classList.toggle('is-axis-active', !!hoverAxisKey && card.dataset.metricKey === hoverAxisKey);
  });
  document.querySelectorAll('#subscoreBars .radar-dim-item').forEach(item => {
    item.classList.toggle('is-focused', Number(item.dataset.seriesIdx) === activeIdx);
  });

  const hintEl = $('#radarInteractHint');
  if (hintEl) {
    if (pinnedIdx >= 0) {
      const pName = selectedRows[pinnedIdx].shortName || selectedRows[pinnedIdx].name;
      hintEl.textContent = t(
        `已锁定置顶：${pName} · 单击雷达空白处或按 Esc 解锁（重叠顶点再次单击可切换下层模型）`,
        `Locked on top: ${pName} · Click blank space or press Esc to unlock (click overlapping dots to cycle)`
      );
    } else {
      hintEl.textContent = t(
        '线条与顶点支持穿透拾取（不被上层遮挡）· 单击曲线或标签锁定置顶 · 悬浮轴名或卡片查看指标来源',
        'Piercing edge/vertex hit-test (never blocked by upper layers) · Click line or chip to lock on top · Hover axis for source'
      );
    }
  }
}

function showMetricTip(metric, event, focusSeriesIdx = null, clusterCount = 0) {
  if (!radarCtx || !metric) return;
  const {selectedRows} = radarCtx;
  const validNums = selectedRows.map(r => metric.get(r)).filter(v => v !== null);
  const bestVal = validNums.length
    ? (metric.lowerBetter ? Math.min(...validNums) : Math.max(...validNums))
    : null;

  tip.replaceChildren(html('strong', t(metric.zh, metric.en)));
  if (metric.srcZh || metric.srcEn) {
    tip.append(html('span', t(metric.srcZh, metric.srcEn), 'tip-sub'));
  }

  selectedRows.forEach((row, idx) => {
    const val = metric.get(row);
    const line = html('div', null, 'tip-value');
    const left = html('span');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = compareColor(idx);
    dot.style.marginRight = '6px';
    left.append(dot, document.createTextNode(row.shortName || row.name));
    if (idx === focusSeriesIdx) left.style.fontWeight = '600';

    let textVal = val === null ? '—' : `${format(val, 1)}%`;
    if (metric.key === 'hallucination' && val !== null && row.subscores?.omniscience != null) {
      const totalWrong = ((100 - row.subscores.omniscience) * val) / 100;
      textVal += t(`（全题错答 ${format(totalWrong, 1)}%）`, ` (${format(totalWrong, 1)}% total)`);
    }
    const right = html('b', textVal);
    if (val !== null && bestVal !== null && selectedRows.length > 1 && Math.abs(val - bestVal) < 1e-6) {
      right.style.color = 'var(--accent)';
    }
    line.append(left, right);
    tip.append(line);
  });

  if (clusterCount > 1) {
    tip.append(html('span', t(`该处有 ${clusterCount} 个模型顶点重合，单击可依次轮换置顶`, `${clusterCount} models overlap here — click to cycle`), 'tip-foot'));
  } else if (focusSeriesIdx !== null) {
    tip.append(html('span', t('单击锁定并将该模型置顶展示', 'Click to lock and bring model to front'), 'tip-foot'));
  }
  tip.hidden = false;
  positionTip(event.clientX, event.clientY);
}

function renderRadarInfo() {
  const panel = $('#radarInfoPanel');
  const btn = $('#radarInfoBtn');
  btn.setAttribute('aria-expanded', String(radarInfoOpen));
  btn.textContent = radarInfoOpen ? t('收起口径', 'Hide sources') : t('ⓘ 指标口径', 'ⓘ Sources');
  panel.hidden = !radarInfoOpen;
  if (!radarInfoOpen) return;

  const extLink = (label, href) => {
    const a = html('a', label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  };

  const frag = document.createDocumentFragment();
  if (activeKey === 'frontier') {
    const p1 = html('p');
    p1.append(
      html('strong', t('为什么要单独设立「未饱和前沿极限」榜？', 'Why Strip Saturated Legacy Benchmarks? ')),
      document.createTextNode(t(
        '传统基准如 MMLU、GPQA Diamond（最高 96.3%）、AIME 2025（最高 99.0%）、TAU2（最高 99.1%）及 LiveCodeBench（最高 91.7%）对当前顶尖 AI 已严重“天花板饱和”，前十名差距甚至在噪声误差之内。本榜完全剔除 90%+ 饱和旧题集，仅聚合 6 项当前最高分仍仅在 30%–80% 之间、能大幅拉开真实差距的硬核测试。详见 ',
        'Legacy suites like GPQA (96.3%), AIME 25 (99.0%), TAU2 (99.1%) and LiveCodeBench (91.7%) are ceiling-saturated across frontier models. This index strips saturated tests and aggregates 6 unsaturated suites where SOTA remains 30%–80% with wide spread. See '
      )),
      extLink('AA Intelligence v5 Methodology', 'https://artificialanalysis.ai/methodology/intelligence-benchmarking'),
      document.createTextNode('。')
    );
    const p2 = html('p');
    p2.append(
      html('strong', t('未饱和六维与专项实验室口径：', 'Hard Suites & Specialist Labs: ')),
      document.createTextNode(t(
        'GDP-PDF 一次全过（复杂长篇文档与图表端到端零差错交付率，目前全球最高仅 ~32.8%）；FrontierCode 2.0（防污染多语言软件工程，尚无模型破 50%）；Terminal-Bench 4.0（真实容器系统工程）；CritPt Agentic Hard（长链路深度研究）；Automation Bench（多步业务流自动化）；HLE Diamond（人类终极考）。切换到「专项实验室」还可查看 Harvey 顶尖律所（最高仅 ~20.8%）、CritPt 闭卷物理、金融分析代理与临床专科医疗实测。',
        'GDP-PDF All-Pass (zero-defect end-to-end document deliverables, SOTA ~32.8%); FrontierCode 2.0 (SOTA <50%); Terminal-Bench 4.0; CritPt Agentic Hard; Automation Bench; HLE Diamond. Switch to "Lab Suites" for Harvey BigLaw (~20.8% max), CritPt closed-book physics, Analyst Agent, and HealthBench Pro.'
      ))
    );
    frag.append(p1, p2);
  } else if (activeKey === 'human-arena') {
    const p1 = html('p');
    p1.append(
      html('strong', t('跨三大权威真人盲测源融合：', '3-Source Blind Human Evaluation Fusion: ')),
      document.createTextNode(t(
        '自动化考试高分不代表模型“好聊、有审美、交付物能直接用”。本页实时融合：(1) ',
        'High automated exam scores do not guarantee natural conversation, visual taste, or polished deliverables. This arena fuses: (1) '
      )),
      extLink('LMArena Style-Controlled & WebDev', 'https://lmarena.ai/leaderboard'),
      document.createTextNode(t(
        '（剥离长篇废话与排版偏见的纯盲测交流人味、文档写作及 Web 全栈体感）；(2) ',
        ' (blind human chat preference controlling for length/markdown verbosity, plus WebDev & Document arenas); (2) '
      )),
      extLink('Design Arena', 'https://www.designarena.ai/leaderboard'),
      document.createTextNode(t(
        '（真人双盲投票评测整站网页审美、UI 组件质感、数据可视化、游戏交互与 SVG 造型）；(3) ',
        ' (blind human aesthetic battles across Websites, UI Components, DataViz, GameDev & SVG); and (3) '
      )),
      extLink('GDPval & Briefcase', 'https://artificialanalysis.ai/evaluations/gdpval-aa'),
      document.createTextNode(t(
        '（44 个真实白领职业专家盲评 Word/PPT/Excel 实际交付质量）。',
        ' (blind human expert grading of real Word/PPT/Excel deliverables across 44 occupations).'
      ))
    );
    const p2 = html('p');
    p2.append(
      html('strong', t('全维度保留 + 分池独立标尺校准与样本置信度：', 'Full 5D Preservation, Per-Pool Calibration & Sample Credibility: ')),
      document.createTextNode(t(
        '完整保留 Design Arena 全部五大审美测试（Website、UI 组件、DataViz、GameDev 交互创意、SVG 矢量造型），在总分与「体验六维」中均衡归纳为「整站视觉审美」「UI 与图表美感」「SVG 与游戏创意」三大视觉支柱（与交流人味、WebDev、专家办公交付共同构成等权六维）。针对 GameDev（原始最高 1466）与 SVG（最高 1494）离散度远大于 Website（最高 1375）的统计特性，系统按各子池真实中位数与标准差分别校准至同一 0–100 标尺，并对低场次新模型（<400 场）施加经验贝叶斯样本量收缩，既保留 SVG/游戏创意权重，又消除跨池量纲膨胀。',
        'All 5 Design Arena suites (Website, UI Component, DataViz, GameDev, SVG) are preserved across three balanced visual pillars (Website, UI & DataViz, SVG & GameDev) alongside Chat Vibe, WebDev, and Expert Deliverables. Each pool is calibrated by its own empirical Elo center and spread (preventing wider-spread GameDev/SVG Elos from inflating scores) with empirical Bayes shrinkage for low-sample (<400 battle) models.'
      ))
    );
    const p3 = html('p');
    p3.append(
      html('strong', t('为什么众包网页盲测（Design Arena）有时与个人主观设计品味存在温差？', 'Why Can Crowd HTML Arenas Diverge from Editorial Taste? ')),
      document.createTextNode(t(
        '在 15 秒众包双盲投票中，大众往往优先奖励「按钮交互全能点、信息密度高、不报错」的工业风 B 端卡片模板，而未必惩罚千篇一律的 AI 套路感；相比之下，44 职业人类专家深度审阅 Word/PPT/报告版式的 GDPval 与去长文水分的 LMArena 更能反映细腻审美与人味——您可随时用上方「纵轴切换」单独查看纯人味或专家交付榜。',
        'In 15-second crowd HTML battles, voters heavily reward functional JS interactivity and dense SaaS dashboards even when typography feels generic. By contrast, expert-graded GDPval deliverables and style-controlled LMArena chat better capture editorial polish and natural tone — use the Y-axis lens selector to isolate each.'
      ))
    );
    frag.append(p1, p2, p3);
  } else if (activeKey === 'coding-agents') {
    const p1 = html('p');
    p1.append(
      html('strong', t('数据来源与权威性：', 'Source & Reliability: ')),
      document.createTextNode(t(
        '全部来自独立第三方评测机构 Artificial Analysis 官方实测（Coding Agents v2.1），在真实沙盒容器与代码仓库中对各智能体客户端 + 模型组合统一黑盒测试，非厂商自报跑分。详见 ',
        'Independently benchmarked by Artificial Analysis (Coding Agents v2.1) inside sandboxed repositories and terminals — never vendor self-reported. See '
      )),
      extLink('Coding Agents Methodology', 'https://artificialanalysis.ai/methodology/coding-agents-benchmarking'),
      document.createTextNode('。')
    );
    const p2 = html('p');
    p2.append(
      html('strong', t('细分基准说明：', 'Sub-benchmarks: ')),
      document.createTextNode(t(
        'FrontierCode 2.0 考察复杂多语言软件工程；SWE-Atlas 考察大型真实仓库多文件修复与架构理解；Terminal-Bench 4.0 考察 Linux 终端命令行编译与排障；成本分位数（P05–P95）与缓存命中率均取自同一批任务的真实 API 账单。',
        'FrontierCode 2.0 tests multi-language SWE; SWE-Atlas tests multi-file repo engineering; Terminal-Bench 4.0 tests Linux CLI tasks; cost percentiles and cache hit rates reflect actual API billing telemetry.'
      ))
    );
    frag.append(p1, p2);
  } else if (state?.radarMode === 'domain') {
    const p1 = html('p');
    p1.append(
      html('strong', t('行业六维来源（GDPval-AA）：', 'Domain Scores (GDPval-AA): ')),
      document.createTextNode(t(
        '源自 Artificial Analysis 基于 OpenAI GDPval 框架独立运行的专业能力评测（覆盖 44 个高价值白领职业），模型在配备终端与浏览工具的代理循环中完成真实财务建模、法律文书、临床资料分析与工程方案，经盲测对决换算得分。详见 ',
        'Derived from Artificial Analysis GDPval-AA across 44 knowledge-work occupations using agentic tool loops and blind pairwise grading. See '
      )),
      extLink('GDPval-AA Methodology', 'https://artificialanalysis.ai/evaluations/gdpval-aa'),
      document.createTextNode('。')
    );
    frag.append(p1);
  } else {
    const p1 = html('p');
    p1.append(
      html('strong', t('数据来源与权威性：', 'Source & Reliability: ')),
      document.createTextNode(t(
        '100% 同步自独立评测机构 Artificial Analysis（Intelligence Index v5.0），采用防数据污染私有集与统一 API 参数实测，横向可比性极高；但固定评测集不等同于特定中文业务或私有知识库（RAG）表现。详见 ',
        '100% sourced from independent Artificial Analysis evaluations (Intelligence Index v5.0) under standardized API settings. Highly reliable for cross-model comparison, though distinct from RAG or custom enterprise prompts. See '
      )),
      extLink('Intelligence Methodology', 'https://artificialanalysis.ai/methodology/intelligence-benchmarking'),
      document.createTextNode(' · '),
      extLink('AA-Omniscience', 'https://artificialanalysis.ai/evaluations/omniscience'),
      document.createTextNode('。')
    );
    const p2 = html('p');
    p2.append(
      html('strong', t('为什么「盲区幻觉率」看起来偏高（50%–90%）？', 'Why is Omniscience Hallucination Rate 50%–90%? ')),
      document.createTextNode(t(
        'AA-Omniscience 在禁止联网搜索的闭卷条件下测试数千道跨学科冷门事实题，其定义为「条件盲猜率 = 答错瞎编数 ÷ (答错数 + 诚实承认不知道数)」。例如某模型全科准确率为 79%，仅剩 21% 不会答；若其中 60% 选择强行瞎编（即盲区幻觉率 60%），折算占全部题目的绝对错答率其实仅为 21% × 60% ≈ 12.6%。越低代表模型越懂得“不知为不知”，下方对决表已同时列出折算后的全题错答率。',
        'AA-Omniscience is a closed-book (no web search) factuality test. Its Hallucination Rate is the conditional guessing rate when wrong: Incorrect / (Incorrect + Abstained). E.g. at 79% accuracy and 60% hallucination rate, overall fabricated answers across all questions are only 21% × 60% ≈ 12.6%.'
      ))
    );
    frag.append(p1, p2);
    if (activeKey === 'cyber') {
      const p3 = html('p');
      p3.append(
        html('strong', t('网络安全指数与拒答率：', 'Cyber Index & Refusal Rate: ')),
        document.createTextNode(t(
          '衡量漏洞分析、逆向与安全运维能力；「安全拒答率」为模型因内置网络攻防合规护栏而主动拦截双用途测试指令的实测比例。详见 ',
          'Measures offensive/defensive cyber tasks; Refusal Rate tracks prompts declined due to built-in cyber safety guardrails. See '
        )),
        extLink('Cyber Index', 'https://artificialanalysis.ai/cyber'),
        document.createTextNode('。')
      );
      frag.append(p3);
    }
  }
  panel.replaceChildren(frag);
}

function renderComparePicker() {
  if (!state) return;
  const list = $('#comparePickerList');
  const q = $('#compareSearchInput').value.trim().toLocaleLowerCase();
  const pool = sortRows(licenseFilteredRows(state.rows), 'intelligenceIndex', 'desc');
  const filtered = q
    ? pool.filter(r => [r.name, r.shortName, r.creator?.name, r.agentName, r.modelName].filter(Boolean).join(' ').toLocaleLowerCase().includes(q))
    : pool;
  const frag = document.createDocumentFragment();
  const full = state.compareIds.length >= MAX_COMPARE;

  for (const row of filtered) {
    const picked = state.compareIds.includes(row.id);
    const btn = html('button', null, picked ? 'picker-item is-picked' : 'picker-item');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(picked));
    btn.disabled = (!picked && full) || (picked && state.compareIds.length <= 1);

    const left = html('span', null, 'picker-item-name');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = color(row.creator?.color);
    dot.setAttribute('aria-hidden', 'true');
    left.append(dot, html('span', row.name));

    const statusMark = picked ? '✓' : '+';
    const meta = html('span', `${format(row.intelligenceIndex, 1)} · ${money(row.cost)} ${statusMark}`, 'picker-item-meta');
    btn.append(left, meta);
    btn.addEventListener('click', () => {
      toggleCompareId(row.id, {evictOldest: false});
      renderComparePicker();
    });
    frag.append(btn);
  }
  if (!filtered.length) {
    frag.append(html('div', t('无匹配模型，请换个关键词', 'No matching entries'), 'anatomy-note'));
  }
  list.replaceChildren(frag);
  requestAnimationFrame(() => clampAnchoredPopover($('#comparePickerPopover'), $('#compareAddBtn'), 360));
}

function setComparePickerOpen(open) {
  comparePickerOpen = open;
  $('#compareAddBtn').setAttribute('aria-expanded', String(open));
  $('#comparePickerPopover').hidden = !open;
  if (open) {
    renderComparePicker();
    clampAnchoredPopover($('#comparePickerPopover'), $('#compareAddBtn'), 360);
    requestAnimationFrame(() => $('#compareSearchInput').focus({preventScroll: true}));
  }
}

async function copyCompareMarkdown() {
  if (!state || !radarCtx) return;
  const {selectedRows, barMetrics} = radarCtx;
  const esc = s => String(s ?? '').replace(/\|/g, '\\|');
  const lines = [];
  lines.push(`| ${t('指标', 'Metric')} | ${selectedRows.map(r => esc(r.shortName || r.name)).join(' | ')} |`);
  lines.push(`| --- | ${selectedRows.map(() => '---:').join(' | ')} |`);

  for (const tr of document.querySelectorAll('#compareMatrix tbody tr')) {
    const cells = [...tr.children].map(el => esc(el.textContent.trim()));
    if (cells.length) lines.push(`| ${cells.join(' | ')} |`);
  }
  for (const m of barMetrics) {
    const vals = selectedRows.map(r => {
      const v = m.get(r);
      return v === null ? '—' : `${format(v, 1)}%`;
    });
    lines.push(`| ${esc(t(m.zh, m.en))} | ${vals.join(' | ')} |`);
  }

  const md = lines.join('\n');
  let copied = false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(md);
      copied = true;
    }
  } catch {}
  if (!copied) {
    const ta = document.createElement('textarea');
    ta.value = md;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    try { copied = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  clearTimeout(copyMdTimer);
  $('#compareCopyMd').textContent = copied ? t('已复制表格 ✓', 'Copied MD ✓') : t('复制失败', 'Copy failed');
  copyMdTimer = setTimeout(() => {
    copyMdTimer = 0;
    $('#compareCopyMd').textContent = t('复制表格', 'Copy MD');
  }, 1800);
}

function renderCompare() {
  if (!state) return;
  const rowMap = new Map(state.rows.map(r => [r.id, r]));
  let selectedRows = state.compareIds.map(id => rowMap.get(id)).filter(Boolean);
  if (!selectedRows.length) {
    state.compareIds = defaultCompareIds(state.rows);
    selectedRows = state.compareIds.map(id => rowMap.get(id)).filter(Boolean);
  }
  if (state.radarPinnedId && !selectedRows.some(r => r.id === state.radarPinnedId)) {
    state.radarPinnedId = null;
  }

  // 1. Selected Chips & Searchable Multi-Select Picker (up to MAX_COMPARE = 8)
  const chipsFrag = document.createDocumentFragment();
  selectedRows.forEach((row, idx) => {
    const sc = compareColor(idx);
    const chip = html('div', null, 'compare-chip');
    chip.setAttribute('role', 'listitem');
    const focusBtn = html('button', null, 'chip-focus-btn');
    focusBtn.type = 'button';
    focusBtn.title = t('单击锁定置顶该模型曲线', 'Click to lock and bring curve to front');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = sc;
    dot.setAttribute('aria-hidden', 'true');
    focusBtn.append(dot, html('span', row.shortName || row.name));
    focusBtn.addEventListener('click', () => {
      state.radarPinnedId = state.radarPinnedId === row.id ? null : row.id;
      syncUrlHash();
      syncRadarSpotlight(null, null);
    });

    const rmBtn = html('button', '×', 'chip-rm-btn');
    rmBtn.type = 'button';
    rmBtn.disabled = selectedRows.length <= 1;
    rmBtn.setAttribute('aria-label', t(`移除 ${row.name}`, `Remove ${row.name}`));
    rmBtn.addEventListener('click', event => {
      event.stopPropagation();
      toggleCompareId(row.id);
      if (comparePickerOpen) renderComparePicker();
    });

    chip.addEventListener('pointerenter', () => syncRadarSpotlight(idx, null));
    chip.addEventListener('pointerleave', () => syncRadarSpotlight(null, null));
    chip.append(focusBtn, rmBtn);
    chipsFrag.append(chip);
  });
  $('#compareChips').replaceChildren(chipsFrag);

  const countStr = `${selectedRows.length}/${MAX_COMPARE}`;
  $('#compareAddBtn').textContent = selectedRows.length >= MAX_COMPARE
    ? t(`已满 (${countStr})`, `Full (${countStr})`)
    : t(`+ 添加对比 (${countStr})`, `+ Add (${countStr})`);
  $('#compareClearBtn').disabled = selectedRows.length <= 1;
  const syncCandidates = activeKey !== 'coding-agents' && Array.isArray(lastModelCompareIds)
    ? lastModelCompareIds.filter(id => rowMap.has(id))
    : [];
  $('#compareSyncBtn').hidden = !(syncCandidates.length >= 1 && syncCandidates.join(',') !== state.compareIds.join(','));
  if (comparePickerOpen) renderComparePicker();

  // 2. Hero Centerpiece Capability Radar & Compact Score Strip
  $('#radarModeSwitch').hidden = activeKey === 'coding-agents';
  if (activeKey === 'frontier') {
    $('#radarModeBench').textContent = t('未饱和六维', 'Hard 6D');
    $('#radarModeDomain').textContent = t('专项实验室', 'Lab Suites');
  } else if (activeKey === 'human-arena') {
    $('#radarModeBench').textContent = t('体验六维', 'Human 6D');
    $('#radarModeDomain').textContent = t('视觉审美五维', 'Aesthetic 5D');
  } else {
    $('#radarModeBench').textContent = t('基准六维', 'Benchmarks');
    $('#radarModeDomain').textContent = t('行业六维', 'Domains');
  }
  $('#radarModeBench').setAttribute('aria-pressed', String(state.radarMode !== 'domain'));
  $('#radarModeDomain').setAttribute('aria-pressed', String(state.radarMode === 'domain'));
  renderRadarInfo();

  let axes, barMetrics;
  if (activeKey === 'frontier') {
    if (state.radarMode === 'domain') {
      $('#radarHeading').textContent = t('前沿专项实验室（律所 / 闭卷物理 / 金融代理 / 专科医疗）', 'Specialist Frontier Labs (BigLaw / Physics / Analyst / Clinical)');
      axes = [
        {key: 'critptClosed', zh: 'CritPt 闭卷物理', en: 'CritPt Physics', srcZh: 'CritPt 闭卷前沿物理研究题集（禁止工具纯推理，最高仅 ~35.7%）', srcEn: 'CritPt closed-book frontier physics research (~35.7% SOTA)', get: r => r.frontierScores?.critptClosed ?? null},
        {key: 'harveyLaw', zh: 'Harvey 顶尖律所', en: 'Harvey BigLaw', srcZh: 'Harvey Law 真实顶尖商事律所复杂合同与尽调评测（最高仅 ~20.8%）', srcEn: 'Harvey BigLaw complex commercial legal workflows (~20.8% SOTA)', get: r => r.frontierScores?.harveyLaw ?? null},
        {key: 'analystAgent', zh: '金融分析代理', en: 'Analyst Agent', srcZh: 'Analyst Agent 真实多表财务建模与投研数据代理实测', srcEn: 'Analyst Agent multi-sheet financial modeling & research', get: r => r.frontierScores?.analystAgent ?? null},
        {key: 'healthPro', zh: '临床专科医疗', en: 'HealthBench Pro', srcZh: 'HealthBench Professional 专科医师审定的高难临床诊疗评测', srcEn: 'HealthBench Professional physician-graded clinical reasoning', get: r => r.frontierScores?.healthPro ?? null},
        {key: 'science', zh: 'Terminal 科学', en: 'Terminal Science', srcZh: 'Terminal-Bench Science 容器环境计算科学与科研实操', srcEn: 'Terminal-Bench Science sandboxed scientific computing', get: r => r.frontierScores?.science ?? null},
        {key: 'gdpPdf', zh: 'GDP-PDF 全过', en: 'GDP-PDF AllPass', srcZh: 'GDP-PDF All-Pass 复杂版式文档与图表端到端零差错一次全过率', srcEn: 'GDP-PDF All-Pass zero-defect complex document workflows', get: r => r.frontierScores?.gdpPdf ?? null}
      ];
      barMetrics = [...axes];
    } else {
      $('#radarHeading').textContent = t('未饱和前沿极限六维能力雷达（剔除 90%+ 已饱和旧测试）', 'Unsaturated 6-Pillar Frontier Hard Radar (90%+ Legacy Suites Stripped)');
      axes = [
        {key: 'gdpPdf', zh: 'GDP-PDF 全过', en: 'GDP-PDF AllPass', srcZh: '复杂长篇 PDF/报告/图表端到端一次全过率（SOTA 最高仅 ~32.8%，极强区分度）', srcEn: 'End-to-end complex PDF/deliverable all-pass rate (SOTA ~32.8%)', get: r => r.frontierScores?.gdpPdf ?? null},
        {key: 'frontierCode', zh: 'FrontierCode 2', en: 'FrontierCode 2', srcZh: 'FrontierCode 2.0 防污染多语言高难软件工程（目前尚无模型突破 50%）', srcEn: 'FrontierCode 2.0 contamination-resistant SWE (no model >50% yet)', get: r => r.frontierScores?.frontierCode ?? null},
        {key: 'terminal4', zh: 'Terminal 4.0', en: 'Terminal 4.0', srcZh: 'Terminal-Bench 4.0 真实 Linux 容器编译、排障与系统运维代理', srcEn: 'Terminal-Bench 4.0 sandboxed Linux CLI & systems engineering', get: r => r.frontierScores?.terminal4 ?? null},
        {key: 'critptAgent', zh: 'CritPt 深度研究', en: 'CritPt Agent', srcZh: 'CritPt Agentic Hard 博士级多步工具调用与长链路研究代理', srcEn: 'CritPt Agentic Hard PhD-level multi-step research agent', get: r => r.frontierScores?.critptAgent ?? null},
        {key: 'automation', zh: '业务流自动化', en: 'Automation', srcZh: 'Automation Bench 跨系统多步复杂工作流自动编排与执行得分', srcEn: 'Automation Bench multi-step workflow orchestration score', get: r => r.frontierScores?.automation ?? null},
        {key: 'hleDiamond', zh: 'HLE 人类终极考', en: 'HLE Diamond', srcZh: 'Humanity’s Last Exam (Diamond) 跨学科前沿学术极限推理（前十名分差超 24%）', srcEn: 'Humanity’s Last Exam (Diamond) frontier academic reasoning', get: r => r.frontierScores?.hleDiamond ?? null}
      ];
      barMetrics = [
        ...axes,
        {key: 'science', zh: 'Terminal 科学', en: 'Terminal Science', srcZh: 'Terminal-Bench Science 科研计算与数理实验代码实测', srcEn: 'Terminal-Bench Science scientific computing', get: r => r.frontierScores?.science ?? null}
      ];
    }
  } else if (activeKey === 'human-arena') {
    if (state.radarMode === 'domain') {
      $('#radarHeading').textContent = t('Design Arena 视觉审美与交互创意五维盲测雷达', 'Design Arena 5-Axis Blind Visual Aesthetic & UX Taste Radar');
      axes = [
        {key: 'website', zh: '整站网页审美', en: 'Website Design', srcZh: 'Design Arena Website · 真人双盲对决评测整站排版、配色、留白与现代设计感', srcEn: 'Design Arena Website · Blind human battles on layout, typography & visual polish', get: r => r.designSub?.website ?? null},
        {key: 'uicomponent', zh: 'UI 组件质感', en: 'UI Component', srcZh: 'Design Arena UI Component · 交互控件细节、微动效与组件级视觉完成度盲测', srcEn: 'Design Arena UI Component · Blind human grading of component craft & micro-UX', get: r => r.designSub?.uicomponent ?? null},
        {key: 'dataviz', zh: '数据图表审美', en: 'DataViz Taste', srcZh: 'Design Arena DataViz · 复杂仪表盘与数据可视化的可读性与审美盲测', srcEn: 'Design Arena DataViz · Blind human preference on dashboards & data visualization', get: r => r.designSub?.dataviz ?? null},
        {key: 'gamedev', zh: '游戏交互创意', en: 'GameDev UX', srcZh: 'Design Arena GameDev · 可玩性、交互反馈与视觉创意真人盲测', srcEn: 'Design Arena GameDev · Blind human testing of playable mini-games & feel', get: r => r.designSub?.gamedev ?? null},
        {key: 'svg', zh: 'SVG 矢量造型', en: 'SVG Craft', srcZh: 'Design Arena SVG · 纯代码生成矢量插画、构图美感与几何造型盲测', srcEn: 'Design Arena SVG · Blind human preference on vector illustration & geometry', get: r => r.designSub?.svg ?? null}
      ];
      barMetrics = [...axes];
    } else {
      $('#radarHeading').textContent = t('人类盲测六维体感雷达（交流人味 · 视觉创意 · 真实交付）', '6-Axis Human Preference Radar (Chat Vibe · Visual & Creative · Deliverables)');
      axes = [
        {key: 'chatVibe', zh: '交流人味 (Chat)', en: 'Chat Vibe', srcZh: 'LMArena Text & Doc Style-Controlled · 剔除长篇堆砌与排版讨好后的纯人类对话与行文偏好', srcEn: 'LMArena Style-Controlled · Blind chat & writing preference controlling for verbosity bias', get: r => r.humanScores?.chatVibe ?? null},
        {key: 'webdev', zh: '全栈体感 (WebDev)', en: 'WebDev Arena', srcZh: 'LMArena WebDev · 真人实测构建可交互前端/全栈应用盲评校准分', srcEn: 'LMArena WebDev · Blind human battles on live interactive web apps', get: r => r.humanScores?.webdev ?? null},
        {key: 'designWeb', zh: '整站视觉审美', en: 'Website Taste', srcZh: 'Design Arena Website · 真人双盲视觉审美对决校准分（整站排版、配色与留白）', srcEn: 'Design Arena Website · Blind human aesthetic preference on full web pages', get: r => r.humanScores?.designWeb ?? null},
        {key: 'designUi', zh: 'UI 与图表美感', en: 'UI & DataViz', srcZh: 'Design Arena UI Component + DataViz · 交互控件细节与数据可视化美感综合分', srcEn: 'Design Arena UI Component + DataViz · Component craft & dashboard visual clarity', get: r => r.humanScores?.designUi ?? null},
        {key: 'creativeCraft', zh: 'SVG 与游戏创意', en: 'SVG & GameDev', srcZh: 'Design Arena SVG + GameDev · 矢量插画构图造型与可玩游戏动态交互审美（独立标尺校准）', srcEn: 'Design Arena SVG + GameDev · Vector illustration composition & interactive game feel', get: r => r.humanScores?.creativeCraft ?? null},
        {key: 'deliverable', zh: '专家真实交付', en: 'Deliverables', srcZh: 'GDPval + Briefcase · 44 个职业领域人类专家盲评真实办公交付物质量', srcEn: 'GDPval + Briefcase · Blind human expert grading of real office deliverables', get: r => r.humanScores?.deliverable ?? null}
      ];
      barMetrics = [...axes];
    }
  } else if (activeKey === 'models' || activeKey === 'cyber') {
    if (state.radarMode === 'domain') {
      $('#radarHeading').textContent = t('六大行业专业能力评估雷达', '6-Sector Professional Domain Capability Radar');
      axes = [
        {key: 'finance', zh: '金融财务', en: 'Finance', srcZh: 'GDPval-AA · 财务建模、报表分析与定量推理实测', srcEn: 'GDPval-AA · Financial modeling, spreadsheets & quantitative analysis', get: r => r.domainScores?.finance ?? null},
        {key: 'strategy', zh: '战略运营', en: 'Strategy & Ops', srcZh: 'GDPval-AA · 商业战略规划、管理咨询与运营决策交付物', srcEn: 'GDPval-AA · Business strategy, consulting decks & operations workflows', get: r => r.domainScores?.strategy ?? null},
        {key: 'legal', zh: '法律合规', en: 'Legal', srcZh: 'GDPval-AA · 长篇法律合同审阅、判例推理与合规起草', srcEn: 'GDPval-AA · Contract review, legal briefs & compliance constraints', get: r => r.domainScores?.legal ?? null},
        {key: 'healthcare', zh: '医疗健康', en: 'Healthcare', srcZh: 'GDPval-AA · 临床病历综合分析、生物医学文献与公卫评估', srcEn: 'GDPval-AA · Clinical record synthesis & biomedical knowledge tasks', get: r => r.domainScores?.healthcare ?? null},
        {key: 'engineering', zh: '工程研发', en: 'Engineering', srcZh: 'GDPval-AA · 工程架构方案、技术文档与终端实操排障', srcEn: 'GDPval-AA · Technical architecture, engineering docs & shell workflows', get: r => r.domainScores?.engineering ?? null},
        {key: 'economics', zh: '宏观经济', en: 'Economics', srcZh: 'GDPval-AA · 宏观经济指标建模、政策研究与计量分析', srcEn: 'GDPval-AA · Macroeconomic analysis, policy research & econometrics', get: r => r.domainScores?.economics ?? null}
      ];
      barMetrics = [...axes];
    } else if (activeKey === 'cyber') {
      $('#radarHeading').textContent = t('网络安全指数与五大核心基准能力雷达', 'Cyber Index & 5-Pillar Core Capability Radar');
      axes = [
        {key: 'cyber', zh: '网络安全总分', en: 'Cyber Index', srcZh: 'AA Cyber Index · 漏洞挖掘、逆向分析与攻防实操综合分', srcEn: 'AA Cyber Index · Composite offensive & defensive cybersecurity score', get: r => r.intelligenceIndex},
        {key: 'frontierCode', zh: '前沿编程', en: 'FrontierCode', srcZh: 'FrontierCode 2.0 · 多语言高难度真实软件工程评测', srcEn: 'FrontierCode 2.0 · Contamination-resistant multi-language SWE benchmark', get: r => r.subscores?.frontierCode ?? null},
        {key: 'terminalBench', zh: '终端代理', en: 'Terminal 4.0', srcZh: 'Terminal-Bench 4.0 · Linux 容器命令行多步编译与系统运维', srcEn: 'Terminal-Bench 4.0 · Multi-step Linux CLI & systems engineering', get: r => r.subscores?.terminalBench ?? null},
        {key: 'hleDiamond', zh: '人类终极考', en: 'HLE Diamond', srcZh: 'Humanity’s Last Exam (Diamond) · 跨学科前沿博士级极限推理', srcEn: 'Humanity’s Last Exam (Diamond) · Frontier PhD-level academic reasoning', get: r => r.subscores?.hleDiamond ?? null},
        {key: 'critptAgentic', zh: '复杂研究', en: 'CritPt Agent', srcZh: 'CritPt Agentic Hard · 多步深度检索、工具调用与复杂研究', srcEn: 'CritPt Agentic Hard · Multi-step agentic tool-use & deep research', get: r => r.subscores?.critptAgentic ?? null},
        {key: 'science', zh: '科学推理', en: 'Science', srcZh: 'Terminal-Bench Science / SciCode · 计算科学与科研编程实测', srcEn: 'Terminal-Bench Science / SciCode · Scientific computing & reasoning', get: r => r.subscores?.science ?? null}
      ];
      barMetrics = [
        ...axes,
        {key: 'refusal', zh: '安全拒答率 ↓', en: 'Refusal Rate ↓', lowerBetter: true, srcZh: 'AA Cyber · 因内置安全护栏主动拒绝执行测试指令的比例（0% = 无拦截）', srcEn: 'AA Cyber · Share of cyber tasks refused due to safety guardrails', get: r => r.refusalRate ?? null}
      ];
    } else {
      $('#radarHeading').textContent = t('Intelligence Index v5 六维核心能力雷达', 'Intelligence Index v5 6-Pillar Capability Radar');
      axes = [
        {key: 'frontierCode', zh: '前沿编程', en: 'FrontierCode', srcZh: 'FrontierCode 2.0 · Artificial Analysis 防污染多语言软件工程评测', srcEn: 'FrontierCode 2.0 · Contamination-resistant multi-language SWE benchmark', get: r => r.subscores?.frontierCode ?? null},
        {key: 'terminalBench', zh: '终端代理', en: 'Terminal 4.0', srcZh: 'Terminal-Bench 4.0 · 真实 Linux 容器命令行多步排障与编译代理实测', srcEn: 'Terminal-Bench 4.0 · Sandboxed Linux CLI & systems agent benchmark', get: r => r.subscores?.terminalBench ?? null},
        {key: 'hleDiamond', zh: '人类终极考', en: 'HLE Diamond', srcZh: 'Humanity’s Last Exam (Diamond) · 全球学者构建的跨学科极限推理题集', srcEn: 'Humanity’s Last Exam (Diamond) · Expert frontier academic reasoning', get: r => r.subscores?.hleDiamond ?? null},
        {key: 'critptAgentic', zh: '复杂研究', en: 'CritPt Agent', srcZh: 'CritPt Agentic Hard · 长链路多步代理研究与复杂工具协同基准', srcEn: 'CritPt Agentic Hard · Long-horizon multi-step agentic research', get: r => r.subscores?.critptAgentic ?? null},
        {key: 'science', zh: '科学推理', en: 'Science', srcZh: 'Terminal-Bench Science / SciCode · 计算科学、数理化与科研代码评测', srcEn: 'Terminal-Bench Science / SciCode · Scientific computing & reasoning', get: r => r.subscores?.science ?? null},
        {key: 'omniscience', zh: '全科知识', en: 'Omniscience', srcZh: 'AA-Omniscience Accuracy · 跨 6 大专业领域 3,000+ 题闭卷事实准确率', srcEn: 'AA-Omniscience Accuracy · Closed-book factual accuracy across 6 domains', get: r => r.subscores?.omniscience ?? null}
      ];
      barMetrics = [
        ...axes,
        {
          key: 'hallucination',
          zh: '盲区幻觉率 ↓',
          en: 'When-Wrong Guess ↓',
          lowerBetter: true,
          srcZh: 'AA-Omniscience 条件盲猜率 = 答错瞎编数 ÷ (答错数 + 诚实弃权数)，衡量闭卷不会答时强行瞎编的比例（越低越诚实）',
          srcEn: 'AA-Omniscience conditional guessing rate = Incorrect / (Incorrect + Abstained) on closed-book questions',
          get: r => r.subscores?.hallucination ?? null
        }
      ];
    }
  } else {
    $('#radarHeading').textContent = t('编程智能体四维基准能力雷达', 'Coding Agent 4-Axis Capability Radar');
    const evalNames = [];
    for (const r of state.rows) {
      for (const ev of r.evalScores || []) {
        if (!evalNames.includes(ev.name)) evalNames.push(ev.name);
      }
    }
    const evalDescOf = ename => {
      if (/frontiercode/i.test(ename)) return ['FrontierCode 2.0 · 端到端多语言软件工程任务通过率', 'FrontierCode 2.0 · End-to-end multi-language SWE pass rate'];
      if (/swe-atlas/i.test(ename)) return ['SWE-Atlas · 大型真实代码仓库跨文件缺陷定位与修复率', 'SWE-Atlas · Multi-file repository bug-fixing & architecture pass rate'];
      if (/terminal-bench/i.test(ename)) return ['Terminal-Bench 4.0 · 真实容器终端编译、运维与排障通过率', 'Terminal-Bench 4.0 · Sandboxed CLI build & debugging pass rate'];
      return [`${ename} · Artificial Analysis 编程智能体实测子项`, `${ename} · Coding agent sub-benchmark`];
    };
    const evalAxes = evalNames.map(ename => {
      const [srcZh, srcEn] = evalDescOf(ename);
      return {
        key: ename,
        zh: shortEvalLabel(ename),
        en: shortEvalLabel(ename),
        srcZh,
        srcEn,
        get: r => r.evalScores?.find(e => e.name === ename)?.score ?? null
      };
    });
    axes = [
      {key: 'index', zh: '智能体总指数', en: 'Agent Index', srcZh: 'AA Coding Agent Index v2.1 · 三大实战编程基准等权综合得分', srcEn: 'AA Coding Agent Index v2.1 · Composite score across all agent suites', get: r => r.intelligenceIndex},
      ...evalAxes
    ];
    barMetrics = [
      ...axes,
      {key: 'cache', zh: '缓存命中率', en: 'Cache Hit %', srcZh: '多轮代理循环中命中 Prompt KV 缓存的输入 Token 实测占比', srcEn: 'Measured share of input tokens served from prompt KV cache', get: r => r.agentStats?.cacheHitRate ?? null}
    ];
  }

  const radarSvg = $('#radarSvg');
  radarSvg.setAttribute('viewBox', '0 0 580 410');
  radarSvg.classList.remove('has-focus');
  radarSvg.replaceChildren();
  const cx = 290, cy = 205, R = 142, N = Math.max(3, axes.length);
  const obsValues = selectedRows.flatMap(r => axes.map(a => a.get(r))).filter(v => v !== null);
  const scaleMax = Math.min(100, Math.max(60, Math.ceil(Math.max(40, ...obsValues) / 20) * 20));

  for (const [ringIdx, frac] of [1, 0.75, 0.5, 0.25].entries()) {
    const pts = axes.map((_, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      return `${cx + Math.cos(ang) * R * frac},${cy + Math.sin(ang) * R * frac}`;
    }).join(' ');
    if (ringIdx % 2 === 0) {
      radarSvg.append(node('polygon', {class: 'radar-ring-fill', points: pts}));
    }
    radarSvg.append(node('polygon', {class: 'radar-grid', points: pts}));
  }

  for (const frac of [0.25, 0.5, 0.75, 1]) {
    radarSvg.append(node('text', {
      class: 'radar-scale-tick',
      x: cx + 5,
      y: cy - R * frac + 11
    }, String(Math.round(scaleMax * frac))));
  }

  const axisEndpoints = [];
  axes.forEach((ax, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const ex = cx + cos * R, ey = cy + sin * R;
    radarSvg.append(node('line', {
      class: 'radar-spoke',
      'data-axis-idx': i,
      x1: cx,
      y1: cy,
      x2: ex,
      y2: ey
    }));
    const anchor = Math.abs(cos) < 0.18 ? 'middle' : cos > 0 ? 'start' : 'end';
    const labelR = R + 16;
    const lx = cx + cos * labelR;
    const ly = cy + sin * labelR + (sin < -0.5 ? -8 : sin > 0.5 ? 12 : 1);
    radarSvg.append(node('text', {
      class: 'radar-axis-label',
      'data-axis-idx': i,
      x: lx,
      y: ly,
      'text-anchor': anchor
    }, t(ax.zh, ax.en)));

    const labelHitX = anchor === 'start' ? lx + 28 : anchor === 'end' ? lx - 28 : lx;
    axisEndpoints.push({ex, ey, lx: labelHitX, ly});

    const vals = selectedRows.map(r => ax.get(r)).filter(v => v !== null);
    if (vals.length) {
      const topVal = Math.max(...vals);
      radarSvg.append(node('text', {
        class: 'radar-axis-sub',
        x: lx,
        y: ly + 14,
        'text-anchor': anchor
      }, `${t('最高', 'Max')} ${format(topVal, 1)}%`));
    }
  });

  const seriesLayer = node('g', {class: 'radar-series-layer'});
  const calloutLayer = node('g', {class: 'radar-callout-layer'});
  const verticesBySeries = [];

  selectedRows.forEach((row, idx) => {
    const sc = compareColor(idx);
    const seriesG = node('g', {class: 'radar-series', 'data-series-idx': idx});
    const verts = axes.map((ax, i) => {
      const val = ax.get(row);
      const ratio = val === null ? 0 : Math.max(0, Math.min(1, val / scaleMax));
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      return {
        val,
        ratio,
        ang,
        x: cx + Math.cos(ang) * R * ratio,
        y: cy + Math.sin(ang) * R * ratio
      };
    });
    verticesBySeries.push(verts);

    const baseFillOpacity = selectedRows.length <= 4 ? 0.15 : Math.max(0.06, 0.21 - selectedRows.length * 0.018);
    const baseStrokeW = selectedRows.length <= 5 ? 2.5 : 2.1;
    const presentVerts = verts.filter(v => v.val !== null);
    if (presentVerts.length >= 3) {
      seriesG.append(node('polygon', {
        points: presentVerts.map(v => `${v.x},${v.y}`).join(' '),
        fill: sc,
        'fill-opacity': baseFillOpacity,
        stroke: sc,
        'stroke-width': baseStrokeW,
        'stroke-linejoin': 'round'
      }));
    } else if (presentVerts.length === 2) {
      seriesG.append(node('line', {
        x1: presentVerts[0].x,
        y1: presentVerts[0].y,
        x2: presentVerts[1].x,
        y2: presentVerts[1].y,
        stroke: sc,
        'stroke-width': baseStrokeW,
        'stroke-linecap': 'round'
      }));
    }
    verts.forEach(v => {
      if (v.val === null) return;
      seriesG.append(node('circle', {
        cx: v.x,
        cy: v.y,
        r: 4.5,
        fill: sc,
        stroke: 'var(--halo)',
        'stroke-width': 1.4
      }));
    });
    seriesLayer.append(seriesG);
  });
  radarSvg.append(seriesLayer, calloutLayer);

  radarCtx = {
    cx,
    cy,
    R,
    scaleMax,
    axes,
    barMetrics,
    selectedRows,
    verticesBySeries,
    axisEndpoints,
    seriesLayer,
    calloutLayer
  };

  // Compact score summary grid directly beneath the Hero Radar
  const barsFrag = document.createDocumentFragment();
  for (const m of barMetrics) {
    const validNums = selectedRows.map(r => m.get(r)).filter(v => v !== null);
    if (!validNums.length) continue;
    const bestVal = m.lowerBetter ? Math.min(...validNums) : Math.max(...validNums);
    const card = html('div', null, 'radar-dim-card');
    card.dataset.metricKey = m.key;
    const titleEl = html('div', t(m.zh, m.en), 'radar-dim-title');
    if (m.srcZh || m.srcEn) titleEl.title = t(m.srcZh, m.srcEn);
    card.addEventListener('pointerenter', event => {
      syncRadarSpotlight(null, m.key);
      showMetricTip(m, event, null, 0);
    });
    card.addEventListener('pointermove', event => {
      if (!tip.hidden) positionTip(event.clientX, event.clientY);
    });
    card.addEventListener('pointerleave', () => {
      tip.hidden = true;
      syncRadarSpotlight(null, null);
    });
    card.append(titleEl);
    selectedRows.forEach((row, idx) => {
      const val = m.get(row);
      const item = html('div', null, 'radar-dim-item');
      item.dataset.seriesIdx = String(idx);
      const nameWrap = html('span', null, 'radar-dim-name');
      const dot = html('i', null, 'creator-dot');
      dot.style.background = compareColor(idx);
      const short = (row.shortName || row.name).replace(/^Claude Code - |^Codex - /i, '');
      nameWrap.append(dot, html('span', short));
      const valEl = html('b', val === null ? '—' : `${format(val, 1)}%`);
      if (val !== null && selectedRows.length > 1 && Math.abs(val - bestVal) < 1e-6) {
        valEl.style.color = 'var(--accent)';
      }
      item.addEventListener('pointerenter', event => {
        event.stopPropagation();
        syncRadarSpotlight(idx, m.key);
        showMetricTip(m, event, idx, 0);
      });
      item.addEventListener('click', event => {
        event.stopPropagation();
        state.radarPinnedId = state.radarPinnedId === row.id ? null : row.id;
        syncUrlHash();
        syncRadarSpotlight(idx, m.key);
      });
      item.append(nameWrap, valEl);
      card.append(item);
    });
    barsFrag.append(card);
  }
  $('#subscoreBars').replaceChildren(barsFrag);
  syncRadarSpotlight(null, null);

  // 3. Cost Structure, Tail Risk, Multi-Provider Arbitrage & Latency Anatomy
  const anatomyFrag = document.createDocumentFragment();
  if (activeKey === 'models' || activeKey === 'frontier') {
    $('#anatomyHeading').textContent = activeKey === 'frontier'
      ? t('硬核排名跃升、单任务成本构成与多云比价', 'Hard-Eval Rank Shift, Per-Task Cost Anatomy & Cloud Hosts')
      : t('单任务成本构成、多云比价与耗时', 'Per-Task Cost Composition, Cloud Hosts & Latency');
    if (activeKey === 'frontier') {
      const deltaBlock = html('div', null, 'metric-block');
      deltaBlock.append(html('div', t('剔除饱和旧题集后的硬核排名变化（对比综合智能总榜）', 'Rank Shift vs. Overall Intelligence Index (Saturated Tests Removed)'), 'metric-title'));
      selectedRows.forEach((row, idx) => {
        const dRank = row.rankDelta ?? 0;
        const signStr = dRank > 0 ? `↑ +${dRank}` : dRank < 0 ? `↓ ${dRank}` : '—';
        const pillRow = html('div', null, 'mini-bar-row');
        const track = html('span', null, 'comparison-track');
        const fill = html('i');
        fill.style.width = `${Math.max(4, Math.min(100, row.intelligenceIndex * 1.4))}%`;
        fill.style.background = compareColor(idx);
        track.append(fill);
        pillRow.append(
          html('span', row.shortName || row.name, 'mini-bar-name'),
          track,
          html('span', `#${row.frontierRank ?? '—'} (${signStr})`, 'mini-bar-val')
        );
        deltaBlock.append(pillRow);
      });
      anatomyFrag.append(deltaBlock);
    }
    const legend = html('div', null, 'stack-legend');
    for (const [col, zhL, enL] of [
      ['#38bdf8', '输入 Prompt', 'Input'],
      ['#f59e0b', '推理思考 Token', 'Reasoning'],
      ['#10b981', '最终输出回答', 'Answer']
    ]) {
      const item = html('span');
      const sw = html('i');
      sw.style.background = col;
      item.append(sw, document.createTextNode(t(zhL, enL)));
      legend.append(item);
    }
    anatomyFrag.append(legend);

    selectedRows.forEach((row, idx) => {
      const cb = row.costBreakdown || {input: 0, reasoning: 0, answer: row.cost};
      const sum = Math.max(1e-9, (cb.input || 0) + (cb.reasoning || 0) + (cb.answer || 0));
      const thinkShare = Math.round(((cb.reasoning || 0) / sum) * 100);
      const tokStr = row.outTokens ? ` · ${format(row.outTokens.total / 1000, 1)}k tok` : '';

      const block = html('div', null, 'metric-block');
      const head = html('div', null, 'metric-title');
      const leftName = html('span');
      const dot = html('i', null, 'creator-dot');
      dot.style.background = compareColor(idx);
      dot.style.marginRight = '6px';
      leftName.append(dot, document.createTextNode(row.shortName || row.name));
      head.append(leftName, html('span', `${money(row.cost)} · ${t('思考占', 'Think')} ${thinkShare}%${tokStr}`));

      const stack = html('div', null, 'stack-track');
      stack.title = `${t('输入', 'Input')}: ${money(cb.input || 0)} · ${t('思考', 'Reasoning')}: ${money(cb.reasoning || 0)} · ${t('回答', 'Answer')}: ${money(cb.answer || 0)}`;
      for (const [part, col] of [[cb.input || 0, '#38bdf8'], [cb.reasoning || 0, '#f59e0b'], [cb.answer || 0, '#10b981']]) {
        if (part <= 0) continue;
        const seg = html('i');
        seg.style.width = `${(part / sum) * 100}%`;
        seg.style.background = col;
        stack.append(seg);
      }
      block.append(head, stack);
      anatomyFrag.append(block);
    });

    const maxTime = Math.max(1, ...selectedRows.map(r => r.timeSec || 0));
    const timeBlock = html('div', null, 'metric-block');
    timeBlock.style.marginTop = '4px';
    timeBlock.append(html('div', t('单任务平均端到端耗时', 'Mean End-to-End Task Time'), 'metric-title'));
    selectedRows.forEach((row, idx) => {
      const mini = html('div', null, 'mini-bar-row');
      const track = html('span', null, 'comparison-track');
      const fill = html('i');
      fill.style.width = row.timeSec ? `${Math.max(2, (row.timeSec / maxTime) * 100)}%` : '0%';
      fill.style.background = compareColor(idx);
      track.append(fill);
      mini.append(html('span', row.shortName || row.name, 'mini-bar-name'), track, html('span', formatTime(row.timeSec), 'mini-bar-val'));
      timeBlock.append(mini);
    });
    anatomyFrag.append(timeBlock);

    // Multi-provider API cloud arbitrage block when available
    const multiHostRows = selectedRows.filter(r => r.providers?.length >= 2);
    if (multiHostRows.length) {
      const provGroup = html('div', null, 'provider-group');
      provGroup.append(html('div', t('同模型多云 API 托管商实测比价与耗时', 'Multi-Cloud API Provider Cost & Latency'), 'metric-title'));
      for (const row of multiHostRows) {
        const sub = html('div', null, 'metric-block');
        sub.append(html('span', `${row.shortName || row.name} (${row.providers.length} ${t('家服务商', 'hosts')})`, 'anatomy-note'));
        const list = html('div', null, 'provider-chips');
        row.providers.slice(0, 6).forEach((p, pIdx) => {
          const pill = html('span', `${p.host}: ${money(p.cost)}${p.timeSec ? ' · ' + formatTime(p.timeSec) : ''}`, pIdx === 0 ? 'provider-pill is-cheapest' : 'provider-pill');
          list.append(pill);
        });
        sub.append(list);
        provGroup.append(sub);
      }
      anatomyFrag.append(provGroup);
    }
  } else if (activeKey === 'human-arena') {
    $('#anatomyHeading').textContent = t('跨平台真人盲测原始 Elo、视觉胜率与耗时剖析', 'Cross-Arena Raw Human Elo, Aesthetic Win Rate & Latency');
    const rawMetrics = [
      {
        titleZh: 'LMArena 交流人味 Elo（Style-Controlled 去长文水分）',
        titleEn: 'LMArena Style-Controlled Chat Elo (De-biased)',
        min: 1250,
        max: 1550,
        getVal: r => r.arenaRaw?.chatElo ?? null,
        fmt: r => r.arenaRaw?.chatElo != null
          ? `${format(r.arenaRaw.chatElo, 1)}${r.arenaRaw.chatVotes ? ' · ' + format(r.arenaRaw.chatVotes / 1000, 1) + 'k' + t('票', 'v') : ''}`
          : '—'
      },
      {
        titleZh: 'Design Arena 整站网页审美 Elo（附真人对决胜率）',
        titleEn: 'Design Arena Website Aesthetic Elo (& Blind Win Rate)',
        min: 1100,
        max: 1400,
        getVal: r => r.arenaRaw?.designWebElo ?? null,
        fmt: r => r.arenaRaw?.designWebElo != null
          ? `${r.arenaRaw.designWebElo}${r.arenaRaw.designWebWinRate != null ? ' (' + format(r.arenaRaw.designWebWinRate, 1) + '%)' : ''}`
          : '—'
      },
      {
        titleZh: '专家办公实际交付 Elo（GDPval 44 职业盲评）',
        titleEn: 'Expert Real-World Deliverable Elo (GDPval 44 Occupations)',
        min: 1200,
        max: 1900,
        getVal: r => r.arenaRaw?.gdpvalElo ?? r.arenaRaw?.briefcaseElo ?? null,
        fmt: r => {
          const g = r.arenaRaw?.gdpvalElo, b = r.arenaRaw?.briefcaseElo;
          if (g != null) return `${format(g, 0)}${b != null ? ' / ' + format(b, 0) : ''}`;
          return b != null ? `Briefcase ${format(b, 0)}` : '—';
        }
      }
    ];

    for (const rm of rawMetrics) {
      if (!selectedRows.some(r => rm.getVal(r) !== null)) continue;
      const block = html('div', null, 'metric-block');
      block.append(html('div', t(rm.titleZh, rm.titleEn), 'metric-title'));
      selectedRows.forEach((row, idx) => {
        const v = rm.getVal(row);
        const mini = html('div', null, 'mini-bar-row');
        const track = html('span', null, 'comparison-track');
        const fill = html('i');
        const pct = v !== null ? Math.max(4, Math.min(100, ((v - rm.min) / (rm.max - rm.min)) * 100)) : 0;
        fill.style.width = `${pct}%`;
        fill.style.background = compareColor(idx);
        track.append(fill);
        mini.append(html('span', row.shortName || row.name, 'mini-bar-name'), track, html('span', rm.fmt(row), 'mini-bar-val'));
        block.append(mini);
      });
      anatomyFrag.append(block);
    }

    const maxTime = Math.max(1, ...selectedRows.map(r => r.timeSec || 0));
    const timeBlock = html('div', null, 'metric-block');
    timeBlock.style.marginTop = '4px';
    timeBlock.append(html('div', t('单任务平均端到端耗时', 'Mean End-to-End Task Time'), 'metric-title'));
    selectedRows.forEach((row, idx) => {
      const mini = html('div', null, 'mini-bar-row');
      const track = html('span', null, 'comparison-track');
      const fill = html('i');
      fill.style.width = row.timeSec ? `${Math.max(2, (row.timeSec / maxTime) * 100)}%` : '0%';
      fill.style.background = compareColor(idx);
      track.append(fill);
      mini.append(html('span', row.shortName || row.name, 'mini-bar-name'), track, html('span', formatTime(row.timeSec), 'mini-bar-val'));
      timeBlock.append(mini);
    });
    anatomyFrag.append(timeBlock);

    const multiHostRows = selectedRows.filter(r => r.providers?.length >= 2);
    if (multiHostRows.length) {
      const provGroup = html('div', null, 'provider-group');
      provGroup.append(html('div', t('同模型多云 API 托管商实测比价与耗时', 'Multi-Cloud API Provider Cost & Latency'), 'metric-title'));
      for (const row of multiHostRows) {
        const sub = html('div', null, 'metric-block');
        sub.append(html('span', `${row.shortName || row.name} (${row.providers.length} ${t('家服务商', 'hosts')})`, 'anatomy-note'));
        const list = html('div', null, 'provider-chips');
        row.providers.slice(0, 6).forEach((p, pIdx) => {
          const pill = html('span', `${p.host}: ${money(p.cost)}${p.timeSec ? ' · ' + formatTime(p.timeSec) : ''}`, pIdx === 0 ? 'provider-pill is-cheapest' : 'provider-pill');
          list.append(pill);
        });
        sub.append(list);
        provGroup.append(sub);
      }
      anatomyFrag.append(provGroup);
    }
  } else if (activeKey === 'cyber') {
    $('#anatomyHeading').textContent = t('安全防护拒答率、多云比价与执行耗时', 'Safety Refusal Rate, Cloud Hosts & Task Latency');
    const maxRefusal = Math.max(20, ...selectedRows.map(r => r.refusalRate || 0));
    const refBlock = html('div', null, 'metric-block');
    refBlock.append(html('div', t('安全评测拒答率（越低代表越少误拦合规测试）', 'Safety Benchmark Refusal Rate (0% = no refusal)'), 'metric-title'));
    selectedRows.forEach((row, idx) => {
      const rate = row.refusalRate;
      const mini = html('div', null, 'mini-bar-row');
      const track = html('span', null, 'comparison-track');
      const fill = html('i');
      fill.style.width = rate != null && rate > 0 ? `${Math.max(2, (rate / maxRefusal) * 100)}%` : '0%';
      fill.style.background = compareColor(idx);
      track.append(fill);
      const rateLabel = rate != null ? `${format(rate, 1)}%` : '—';
      mini.append(html('span', row.shortName || row.name, 'mini-bar-name'), track, html('span', rateLabel, 'mini-bar-val'));
      refBlock.append(mini);
    });
    anatomyFrag.append(
      refBlock,
      html('p', t('部分前沿闭源模型内置网络攻防合规拦截策略，遇敏感载荷会主动拒答；开源模型通常为 0% 拒答。', 'Frontier closed models often enforce cyber-safety guardrails that refuse dual-use prompts; open-weights models typically show 0% refusal.'), 'anatomy-note')
    );

    const maxTime = Math.max(1, ...selectedRows.map(r => r.timeSec || 0));
    const timeBlock = html('div', null, 'metric-block');
    timeBlock.style.marginTop = '4px';
    timeBlock.append(html('div', t('单任务平均端到端耗时', 'Mean End-to-End Task Time'), 'metric-title'));
    selectedRows.forEach((row, idx) => {
      const mini = html('div', null, 'mini-bar-row');
      const track = html('span', null, 'comparison-track');
      const fill = html('i');
      fill.style.width = row.timeSec ? `${Math.max(2, (row.timeSec / maxTime) * 100)}%` : '0%';
      fill.style.background = compareColor(idx);
      track.append(fill);
      mini.append(html('span', row.shortName || row.name, 'mini-bar-name'), track, html('span', formatTime(row.timeSec), 'mini-bar-val'));
      timeBlock.append(mini);
    });
    anatomyFrag.append(timeBlock);

    const multiHostRows = selectedRows.filter(r => r.providers?.length >= 2);
    if (multiHostRows.length) {
      const provGroup = html('div', null, 'provider-group');
      provGroup.append(html('div', t('同模型多云 API 托管商实测比价与耗时', 'Multi-Cloud API Provider Cost & Latency'), 'metric-title'));
      for (const row of multiHostRows) {
        const sub = html('div', null, 'metric-block');
        sub.append(html('span', `${row.shortName || row.name} (${row.providers.length} ${t('家服务商', 'hosts')})`, 'anatomy-note'));
        const list = html('div', null, 'provider-chips');
        row.providers.slice(0, 6).forEach((p, pIdx) => {
          const pill = html('span', `${p.host}: ${money(p.cost)}${p.timeSec ? ' · ' + formatTime(p.timeSec) : ''}`, pIdx === 0 ? 'provider-pill is-cheapest' : 'provider-pill');
          list.append(pill);
        });
        sub.append(list);
        provGroup.append(sub);
      }
      anatomyFrag.append(provGroup);
    }
  } else {
    $('#anatomyHeading').textContent = t('单任务成本分位箱线图（尾部风险）与执行耗时', 'Task Cost Distribution (P05–P50–P95 Tail Risk) & Wall Time');
    const maxDollar = Math.max(1, ...selectedRows.map(r => Math.max(r.costPercentiles?.p95 || 0, r.cost))) * 1.06;
    const rowStep = selectedRows.length > 5 ? 32 : 38;
    const svgH = 30 + selectedRows.length * rowStep;
    const x0 = 136, x1 = 446;
    const mapX = v => x0 + (Math.max(0, v) / maxDollar) * (x1 - x0);
    const wSvg = node('svg', {class: 'whisker-svg', viewBox: `0 0 460 ${svgH}`, role: 'img', 'aria-label': t('单任务成本分位数箱线图', 'Cost percentiles box-and-whisker chart')});

    for (const tk of ticks(0, maxDollar, 5)) {
      const tx = mapX(tk);
      wSvg.append(
        node('line', {x1: tx, x2: tx, y1: 6, y2: svgH - 20, stroke: 'var(--grid)', 'stroke-width': 1}),
        node('text', {x: tx, y: svgH - 5, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': '11'}, compactMoney(tk))
      );
    }

    selectedRows.forEach((row, idx) => {
      const sc = compareColor(idx);
      const cy = 20 + idx * rowStep;
      const short = (row.shortName || row.name).slice(0, 20);
      const g = node('g');
      g.append(node('text', {x: x0 - 8, y: cy + 4, 'text-anchor': 'end', fill: 'var(--ink)', 'font-size': '11.5'}, short));
      const pct = row.costPercentiles;
      if (pct) {
        const xp05 = mapX(pct.p05 ?? 0), xp25 = mapX(pct.p25 ?? 0), xp50 = mapX(pct.p50 ?? 0), xp75 = mapX(pct.p75 ?? 0), xp95 = mapX(pct.p95 ?? 0);
        g.append(
          node('line', {x1: xp05, x2: xp95, y1: cy, y2: cy, stroke: sc, 'stroke-width': 1.5}),
          node('line', {x1: xp05, x2: xp05, y1: cy - 5, y2: cy + 5, stroke: sc, 'stroke-width': 1.5}),
          node('line', {x1: xp95, x2: xp95, y1: cy - 5, y2: cy + 5, stroke: sc, 'stroke-width': 1.5}),
          node('rect', {x: xp25, y: cy - 8, width: Math.max(2, xp75 - xp25), height: 16, rx: 3, fill: sc, 'fill-opacity': 0.24, stroke: sc, 'stroke-width': 1.5}),
          node('line', {x1: xp50, x2: xp50, y1: cy - 8, y2: cy + 8, stroke: sc, 'stroke-width': 2.5})
        );
        g.append(node('title', {}, `${row.name}\nP05: ${money(pct.p05 || 0)} · P25: ${money(pct.p25 || 0)} · P50: ${money(pct.p50 || 0)}\nMean: ${money(row.cost)} · P75: ${money(pct.p75 || 0)} · P95: ${money(pct.p95 || 0)}`));
      }
      const xm = mapX(row.cost);
      g.append(node('polygon', {
        points: `${xm},${cy - 5} ${xm + 5},${cy} ${xm},${cy + 5} ${xm - 5},${cy}`,
        fill: 'var(--ink)',
        stroke: sc,
        'stroke-width': 1.4
      }));
      wSvg.append(g);
    });
    anatomyFrag.append(
      wSvg,
      html('p', t('竖线 = P50 中位成本 · 方框 = P25–P75 · 菱形 ◆ = 平均成本 · 须线 = P05–P95 长尾分布', 'Line = P50 median · Box = P25–P75 · ◆ = Mean cost · Whiskers = P05–P95 tail range'), 'anatomy-note')
    );

    const maxTime = Math.max(1, ...selectedRows.map(r => r.timeSec || 0));
    const timeBlock = html('div', null, 'metric-block');
    timeBlock.style.marginTop = '4px';
    timeBlock.append(html('div', t('单任务平均耗时与代理步数', 'Mean Wall Time & Agent Steps'), 'metric-title'));
    selectedRows.forEach((row, idx) => {
      const mini = html('div', null, 'mini-bar-row');
      const track = html('span', null, 'comparison-track');
      const fill = html('i');
      fill.style.width = row.timeSec ? `${Math.max(2, (row.timeSec / maxTime) * 100)}%` : '0%';
      fill.style.background = compareColor(idx);
      track.append(fill);
      const stepNote = row.agentStats?.steps ? ` · ${format(row.agentStats.steps, 0)}${t('步', 'st')}` : '';
      mini.append(html('span', row.shortName || row.name, 'mini-bar-name'), track, html('span', `${formatTime(row.timeSec)}${stepNote}`, 'mini-bar-val'));
      timeBlock.append(mini);
    });
    anatomyFrag.append(timeBlock);
  }
  $('#anatomyBody').replaceChildren(anatomyFrag);

  // 4. Side-by-Side Head-to-Head Matrix
  const matrix = $('#compareMatrix');
  const thead = html('thead');
  const headTr = html('tr');
  headTr.append(html('th', t('核心指标', 'Metric')));
  selectedRows.forEach((row, idx) => {
    const th = html('th');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = compareColor(idx);
    dot.style.marginRight = '6px';
    th.append(dot, document.createTextNode(row.shortName || row.name));
    headTr.append(th);
  });
  thead.append(headTr);

  const tbody = html('tbody');
  const addRow = (label, texts, nums = null, lowerBetter = false) => {
    const tr = html('tr');
    tr.append(html('th', label));
    let best = null;
    if (nums && selectedRows.length > 1) {
      const finite = nums.filter(v => typeof v === 'number' && Number.isFinite(v));
      if (finite.length > 1) best = lowerBetter ? Math.min(...finite) : Math.max(...finite);
    }
    texts.forEach((txt, i) => {
      const td = html('td', txt);
      if (best !== null && typeof nums[i] === 'number' && Math.abs(nums[i] - best) < 1e-9) {
        td.className = 'cell-best';
      }
      tr.append(td);
    });
    tbody.append(tr);
  };

  addRow(
    t('综合智能指数', 'Composite Index'),
    selectedRows.map(r => format(r.intelligenceIndex, 2)),
    selectedRows.map(r => r.intelligenceIndex),
    false
  );
  addRow(
    t('单任务平均 API 成本', 'Mean Cost / Task'),
    selectedRows.map(r => money(r.cost)),
    selectedRows.map(r => r.cost),
    true
  );
  addRow(
    t('单任务平均耗时', 'Mean Time / Task'),
    selectedRows.map(r => formatTime(r.timeSec)),
    selectedRows.map(r => r.timeSec ?? null),
    true
  );
  const vals = selectedRows.map(r => valuePerDollar(r, state.valueWeight, state.minScore, state.maxCost));
  addRow(
    t(
      `加权性价比 (α=${state.valueWeight.toFixed(1)}${state.maxCost > 0 ? ', ≤$' + state.maxCost : ''})`,
      `Weighted Value (α=${state.valueWeight.toFixed(1)}${state.maxCost > 0 ? ', ≤$' + state.maxCost : ''})`
    ),
    selectedRows.map((r, i) => state.minScore > 0 && r.intelligenceIndex < state.minScore
      ? t('未达门槛', '< Min')
      : state.maxCost > 0 && r.cost > state.maxCost
        ? t('超出预算', '> Cap')
        : valueLabel(vals[i])),
    vals,
    false
  );
  if (activeKey !== 'coding-agents') {
    addRow(
      t('跨榜全站排名（综合 / 极限 / 审美 / 安全）', 'Cross-Tab Ranks (Intel / Hard / Taste / Cyber)'),
      selectedRows.map(r => {
        const info = crossTabIndex.get(r.id);
        if (!info) return '—';
        return [
          info.models ? `${t('综', 'Int')} #${info.models.rank}` : null,
          info.frontier ? `${t('极', 'Hard')} #${info.frontier.rank}` : null,
          info['human-arena'] ? `${t('审', 'Taste')} #${info['human-arena'].rank}` : null,
          info.cyber ? `${t('安', 'Cyb')} #${info.cyber.rank}` : null
        ].filter(Boolean).join(' · ') || '—';
      })
    );
  }
  addRow(
    t('开源属性 · 推理档位', 'License · Effort'),
    selectedRows.map(r => `${r.isOpenWeights ? t('开源权重', 'Open weights') : t('闭源专有', 'Proprietary')}${r.effort?.label ? ' · ' + r.effort.label : ''}`)
  );
  addRow(
    t('Pro $20 / Max $100 回本数', 'Pro $20 / Max $100 Break-even'),
    selectedRows.map(r => `${formatTaskCount(breakEvenTasks(r.cost, 20))} / ${formatTaskCount(breakEvenTasks(r.cost, 100))}`)
  );

  if (activeKey === 'models') {
    addRow(
      t('参数规模 · 输入模态', 'Parameters · Modalities'),
      selectedRows.map(r => `${r.parametersB ? r.parametersB + 'B' : t('未公开', 'Undisclosed')} · ${modalitySummary(r)}`)
    );
    addRow(
      t('输出总 Token（思考占比）', 'Output Tokens (Reasoning %)'),
      selectedRows.map(r => r.outTokens
        ? `${format(r.outTokens.total / 1000, 1)}k (${Math.round((r.outTokens.reasoning / Math.max(1, r.outTokens.total)) * 100)}%)`
        : '—'),
      selectedRows.map(r => r.outTokens?.total ?? null),
      true
    );
    addRow(
      t('盲区幻觉率（占全题错答）', 'When-Wrong Guess (Total Wrong)'),
      selectedRows.map(r => {
        const h = r.subscores?.hallucination;
        if (h == null) return '—';
        const acc = r.subscores?.omniscience;
        if (acc == null) return `${format(h, 1)}%`;
        const totalWrong = ((100 - acc) * h) / 100;
        return t(`${format(h, 1)}%（全题 ${format(totalWrong, 1)}%）`, `${format(h, 1)}% (${format(totalWrong, 1)}% all)`);
      }),
      selectedRows.map(r => r.subscores?.hallucination ?? null),
      true
    );
    addRow(
      t('发布日期', 'Release Date'),
      selectedRows.map(r => r.releaseDate || '—')
    );
  } else if (activeKey === 'frontier') {
    addRow(
      t('综合智能总分 · 硬核排名变化', 'Overall AA Index · Hard Rank Δ'),
      selectedRows.map(r => {
        const d = r.rankDelta ?? 0;
        const deltaTxt = d > 0 ? `↑+${d}` : d < 0 ? `↓${d}` : '—';
        return `${format(r.aaIndex ?? r.intelligenceIndex, 2)} (${deltaTxt})`;
      }),
      selectedRows.map(r => r.rankDelta ?? null),
      false
    );
    addRow(
      t('Harvey 律所 / 金融代理 / 临床医疗', 'Harvey Law / Analyst / Health Pro'),
      selectedRows.map(r => {
        const fs = r.frontierScores || {};
        const p = [
          fs.harveyLaw != null ? `${t('律', 'Law')} ${format(fs.harveyLaw, 1)}%` : null,
          fs.analystAgent != null ? `${t('金', 'Fin')} ${format(fs.analystAgent, 1)}%` : null,
          fs.healthPro != null ? `${t('医', 'Med')} ${format(fs.healthPro, 1)}%` : null
        ].filter(Boolean);
        return p.length ? p.join(' · ') : '—';
      })
    );
    addRow(
      t('输出总 Token（思考占比）', 'Output Tokens (Reasoning %)'),
      selectedRows.map(r => r.outTokens
        ? `${format(r.outTokens.total / 1000, 1)}k (${Math.round((r.outTokens.reasoning / Math.max(1, r.outTokens.total)) * 100)}%)`
        : '—'),
      selectedRows.map(r => r.outTokens?.total ?? null),
      true
    );
    addRow(
      t('发布日期', 'Release Date'),
      selectedRows.map(r => r.releaseDate || '—')
    );
  } else if (activeKey === 'human-arena') {
    addRow(
      t('LMArena 交流人味 Elo（去水份）', 'LMArena Style-Ctrl Chat Elo'),
      selectedRows.map(r => r.arenaRaw?.chatElo != null
        ? `${format(r.arenaRaw.chatElo, 1)}${r.arenaRaw.chatVotes ? ' (' + format(r.arenaRaw.chatVotes / 1000, 1) + 'k' + t('票', 'v') + ')' : ''}`
        : '—'),
      selectedRows.map(r => r.arenaRaw?.chatElo ?? null),
      false
    );
    addRow(
      t('LMArena WebDev / 文档盲测 Elo', 'LMArena WebDev / Doc Elo'),
      selectedRows.map(r => {
        const w = r.arenaRaw?.webdevElo, d = r.arenaRaw?.docElo;
        if (w == null && d == null) return '—';
        return `${w != null ? 'Web ' + format(w, 0) : '—'} / ${d != null ? 'Doc ' + format(d, 0) : '—'}`;
      }),
      selectedRows.map(r => r.arenaRaw?.webdevElo ?? r.arenaRaw?.docElo ?? null),
      false
    );
    addRow(
      t('Design Arena 整站审美 Elo（胜率·场次）', 'Design Arena Website Elo (Win% · Battles)'),
      selectedRows.map(r => {
        if (r.arenaRaw?.designWebElo == null) return '—';
        const b = r.arenaRaw.designWebBattles;
        const bTxt = b ? ` · ${b < 400 ? b + t('场(小样本)', 'b(low-n)') : format(b / 1000, 1) + 'k' + t('场', 'b')}` : '';
        return `${r.arenaRaw.designWebElo}${r.arenaRaw.designWebWinRate != null ? ' (' + format(r.arenaRaw.designWebWinRate, 1) + '%)' : ''}${bTxt}`;
      }),
      selectedRows.map(r => r.arenaRaw?.designWebElo ?? null),
      false
    );
    addRow(
      t('Design Arena UI / 图表 / SVG Elo', 'Design Arena UI / Viz / SVG Elo'),
      selectedRows.map(r => {
        const ar = r.arenaRaw || {};
        const p = [
          ar.designUiElo ? `UI ${ar.designUiElo}` : null,
          ar.designDatavizElo ? `Viz ${ar.designDatavizElo}` : null,
          ar.designSvgElo ? `SVG ${ar.designSvgElo}` : null
        ].filter(Boolean);
        return p.length ? p.join(' · ') : '—';
      }),
      selectedRows.map(r => r.arenaRaw?.designUiElo ?? null),
      false
    );
    addRow(
      t('专家真实交付 Elo (GDPval / Briefcase)', 'Expert Deliverable Elo (GDPval / Briefcase)'),
      selectedRows.map(r => {
        const g = r.arenaRaw?.gdpvalElo, b = r.arenaRaw?.briefcaseElo;
        if (g == null && b == null) return '—';
        return `${g != null ? format(g, 0) : '—'} / ${b != null ? format(b, 0) : '—'}`;
      }),
      selectedRows.map(r => r.arenaRaw?.gdpvalElo ?? r.arenaRaw?.briefcaseElo ?? null),
      false
    );
    addRow(
      t('对比自动化综合指数（体感分差 Δ）', 'vs. Automated AA Index (Δ)'),
      selectedRows.map(r => {
        const d = r.indexDelta ?? 0;
        return `${format(r.aaIndex ?? 0, 1)} (${d >= 0 ? '+' : ''}${format(d, 1)})`;
      }),
      selectedRows.map(r => r.indexDelta ?? null),
      false
    );
  } else if (activeKey === 'cyber') {
    addRow(
      t('安全拒答率 · 防护策略', 'Refusal Rate · Safeguards'),
      selectedRows.map(r => r.refusalRate != null
        ? `${format(r.refusalRate, 1)}%${r.mitigationStatus ? ' · ' + r.mitigationStatus : ''}`
        : '—'),
      selectedRows.map(r => r.refusalRate ?? null),
      true
    );
    addRow(
      t('参数规模 · 输入模态', 'Parameters · Modalities'),
      selectedRows.map(r => `${r.parametersB ? r.parametersB + 'B' : t('未公开', 'Undisclosed')} · ${modalitySummary(r)}`)
    );
    addRow(
      t('发布日期', 'Release Date'),
      selectedRows.map(r => r.releaseDate || '—')
    );
  } else {
    addRow(
      t('成本中位数 P50 / 尾部 P95', 'Median P50 / P95 Tail Cost'),
      selectedRows.map(r => r.costPercentiles ? `${money(r.costPercentiles.p50 || 0)} / ${money(r.costPercentiles.p95 || 0)}` : '—'),
      selectedRows.map(r => r.costPercentiles?.p95 ?? null),
      true
    );
    addRow(
      t('平均交互步数 / 总 Token', 'Mean Steps / Total Tokens'),
      selectedRows.map(r => `${r.agentStats?.steps != null ? format(r.agentStats.steps, 1) + t(' 步', ' steps') : '—'}${r.agentStats?.totalTokens ? ' · ' + format(r.agentStats.totalTokens / 1e6, 2) + 'M' : ''}`),
      selectedRows.map(r => r.agentStats?.steps ?? null),
      true
    );
    addRow(
      t('Prompt 缓存命中率', 'Prompt Cache Hit Rate'),
      selectedRows.map(r => r.agentStats?.cacheHitRate != null ? `${format(r.agentStats.cacheHitRate, 1)}%` : '—'),
      selectedRows.map(r => r.agentStats?.cacheHitRate ?? null),
      false
    );
  }

  matrix.replaceChildren(thead, tbody);
}

function drawCurve() {
  const container = $('#curveHost'), chart = $('#curveSvg'), rect = container.getBoundingClientRect();
  if (rect.width < 100 || rect.height < 100) return;

  const width = rect.width, height = rect.height;
  const left = 58, right = width - 22, top = 26, bottom = height - 46;
  const xMax = state.curveRealRange ? state.bounds.y + state.bounds.height : 100;
  const maxUtilityRaw = Math.max(
    capabilityUtility(xMax, state.valueWeight) || 100,
    xMax,
    55
  );

  const logMin = 0.5;
  const mapY = val => {
    const safe = Math.max(0, val);
    if (!state.curveLogY) {
      return bottom - Math.min(1, safe / maxUtilityRaw) * (bottom - top);
    }
    const clamped = Math.max(logMin, safe);
    const ratio = (Math.log10(clamped) - Math.log10(logMin)) / (Math.log10(Math.max(logMin * 10, maxUtilityRaw)) - Math.log10(logMin));
    return bottom - Math.max(0, Math.min(1, ratio)) * (bottom - top);
  };
  const xx = score => left + (score / xMax) * (right - left);

  curveFrame = {left, right, width: rect.width, xMax};
  chart.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const grid = node('g', {class: 'curve-grid'});
  const axis = node('g', {class: 'curve-axis'});

  for (const value of ticks(0, xMax, Math.max(4, Math.floor((right - left) / 110)))) {
    grid.append(node('line', {x1: xx(value), x2: xx(value), y1: top, y2: bottom}));
    axis.append(node('text', {x: xx(value), y: bottom + 18, 'text-anchor': 'middle'}, format(value, 0)));
  }

  if (state.curveLogY) {
    const maxPow = Math.ceil(Math.log10(Math.max(10, maxUtilityRaw)));
    for (let p = 0; p <= maxPow; p++) {
      const val = 10 ** p;
      if (val > maxUtilityRaw * 1.05) break;
      const py = mapY(val);
      grid.append(node('line', {x1: left, x2: right, y1: py, y2: py}));
      axis.append(node('text', {x: left - 8, y: py + 4, 'text-anchor': 'end'}, valueLabel(val)));
    }
  } else {
    for (const value of ticks(0, maxUtilityRaw, 5)) {
      const py = mapY(value);
      grid.append(node('line', {x1: left, x2: right, y1: py, y2: py}));
      axis.append(node('text', {x: left - 8, y: py + 4, 'text-anchor': 'end'}, valueLabel(value)));
    }
  }

  axis.append(
    node('text', {class: 'axis-title', x: left, y: 15}, t('能力效用 U(指数)', 'Capability Utility U(Index)')),
    node('text', {class: 'axis-title', x: (left + right) / 2, y: height - 8, 'text-anchor': 'middle'}, `${currentAxisLabel()} (0–${xMax})`)
  );

  const floorLayer = node('g');
  if (state.minScore > 0 && state.minScore <= xMax) {
    const fx = xx(state.minScore);
    floorLayer.append(
      node('rect', {class: 'floor-rect', x: left, y: top, width: Math.max(0, fx - left), height: bottom - top}),
      node('line', {class: 'floor-guide', x1: fx, x2: fx, y1: top, y2: bottom})
    );
  }

  const steps = 200;
  const pathPoints = Array.from({length: steps + 1}, (_, i) => {
    const s = (i / steps) * xMax;
    const util = capabilityUtility(s, state.valueWeight) ?? 0;
    return `${i ? 'L' : 'M'}${xx(s)},${mapY(util)}`;
  }).join(' ');

  const refPoints = Array.from({length: 60}, (_, i) => {
    const s = (i / 59) * xMax;
    return `${i ? 'L' : 'M'}${xx(s)},${mapY(s)}`;
  }).join(' ');

  const curve = node('path', {class: 'utility-line', d: pathPoints});
  const area = node('path', {class: 'utility-area', d: `${pathPoints}L${right} ${bottom}H${left}Z`});
  const reference = node('path', {class: 'utility-reference', d: refPoints});

  // Project actual Pareto frontier entries directly onto the utility curve
  const paretoLayer = node('g');
  const frontier = paretoFrontier(licenseFilteredRows(state.rows));
  const {champion} = computeRankings();
  for (const row of frontier) {
    if (row.intelligenceIndex > xMax) continue;
    if (state.company && row.creator?.name !== state.company) continue;
    const util = capabilityUtility(row.intelligenceIndex, state.valueWeight) ?? 0;
    const cx = xx(row.intelligenceIndex), cy = mapY(util);
    const isChamp = champion && champion.id === row.id;
    const disqualified = (state.minScore > 0 && row.intelligenceIndex < state.minScore) || (state.maxCost > 0 && row.cost > state.maxCost);
    const dot = node('circle', {
      class: 'curve-pareto-dot',
      cx,
      cy,
      r: isChamp ? 5.8 : 3.8,
      fill: color(row.creator?.color)
    });
    if (disqualified) dot.style.opacity = '0.32';
    dot.append(node('title', {}, `${row.name} (${format(row.intelligenceIndex, 1)} · ${money(row.cost)})`));
    paretoLayer.append(dot);
    if (isChamp) {
      paretoLayer.append(node('circle', {class: 'champion-ring', cx, cy, r: 9.5}));
      const anchorEnd = cx > left + (right - left) * 0.68;
      paretoLayer.append(node('text', {
        class: 'curve-champion-label',
        x: anchorEnd ? cx - 12 : cx + 12,
        y: Math.max(top + 14, cy - 6),
        'text-anchor': anchorEnd ? 'end' : 'start'
      }, `#1 ${row.shortName || row.name}`));
    }
  }

  const probeScore = Math.min(xMax, state.curveProbe);
  const probeUtil = capabilityUtility(probeScore, state.valueWeight) ?? 0;
  const px = xx(probeScore), py = mapY(probeUtil);
  const probe = node('g', {class: 'curve-probe'});
  probe.append(
    node('path', {d: `M${left} ${py}H${px}V${bottom}`, fill: 'none'}),
    node('circle', {cx: px, cy: py, r: 5})
  );

  chart.replaceChildren(grid, floorLayer, area, reference, curve, paretoLayer, probe, axis);
  const below = state.minScore > 0 && probeScore < state.minScore;
  $('#curveReadout').textContent = t(
    `探针：指数 ${format(probeScore, 1)} → 能力效用 ${valueLabel(probeUtil)}${below ? '（低于当前门槛）' : ''} · 点击或拖动曲线探查`,
    `Probe: Index ${format(probeScore, 1)} → Utility ${valueLabel(probeUtil)}${below ? ' (below min threshold)' : ''} · Drag or use ← → keys`
  );
}

function setCurveProbe(value) {
  if (!state || state.mode !== 'curve') return;
  const max = curveFrame?.xMax || 100;
  state.curveProbe = Math.max(0, Math.min(max, Math.round(value * 2) / 2));
  scheduleDraw();
}

function probeFromPointer(event) {
  if (!curveFrame) return;
  const rect = $('#curveHost').getBoundingClientRect();
  const ratio = (event.clientX - rect.left - curveFrame.left) / (curveFrame.right - curveFrame.left);
  setCurveProbe(ratio * curveFrame.xMax);
}

$('#curveHost').addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.isPrimary === false) return;
  $('#curveHost').focus({preventScroll: true});
  $('#curveHost').setPointerCapture(event.pointerId);
  probeFromPointer(event);
});
$('#curveHost').addEventListener('pointermove', event => {
  if ($('#curveHost').hasPointerCapture(event.pointerId)) probeFromPointer(event);
});
$('#curveHost').addEventListener('pointerup', event => {
  if ($('#curveHost').hasPointerCapture(event.pointerId)) $('#curveHost').releasePointerCapture(event.pointerId);
});
$('#curveHost').addEventListener('keydown', event => {
  if (!state || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const max = curveFrame?.xMax || 100;
  setCurveProbe(
    event.key === 'Home' ? 0 : event.key === 'End' ? max : state.curveProbe + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 5 : 1)
  );
});

$('#curveRangeToggle').addEventListener('click', () => {
  if (!state) return;
  state.curveRealRange = !state.curveRealRange;
  syncControls();
  scheduleDraw();
});

$('#curveScaleToggle').addEventListener('click', () => {
  if (!state) return;
  state.curveLogY = !state.curveLogY;
  syncControls();
  scheduleDraw();
});

function scheduleDraw() {
  if (!pendingFrame) {
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      draw();
    });
  }
}

function setAttrs(element, attrs) {
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
}

function draw() {
  if (!state) return;
  if (state.mode !== 'chart') {
    if (state.mode === 'curve') drawCurve();
    else if (state.mode === 'compare') renderCompare();
    updateSummary();
    return;
  }
  const rect = host.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return;

  const width = rect.width, height = rect.height;
  frame = {left: width < 500 ? 52 : 64, top: 14, right: width - 16, bottom: height - 46};
  frame.width = frame.right - frame.left;
  frame.height = frame.bottom - frame.top;
  if (frame.height < 10) return;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  state.view = clampView(state.view, state.bounds);
  state.views[state.xMetric] = {...state.view};

  setAttrs(svg.querySelector('#plot-clip rect'), {x: frame.left - 5, y: frame.top - 5, width: frame.width + 10, height: frame.height + 10});
  setAttrs(svg.querySelector('#emphasis-clip rect'), {x: frame.left - 14, y: Math.max(0, frame.top - 14), width: frame.width + 28, height: frame.height + 28});

  const pool = activePool();
  const xOf = currentXOf();
  const medianX = pool.length ? median(pool.map(xOf)) : 0;
  const medianY = pool.length ? median(pool.map(d => d.intelligenceIndex)) : 0;
  const qx = Math.max(frame.left, Math.min(frame.right, x(medianX)));
  const qy = Math.max(frame.top, Math.min(frame.bottom, y(medianY)));
  const qWidth = Math.max(0, qx - frame.left), qHeight = Math.max(0, qy - frame.top);
  setAttrs(svg.querySelector('.quadrant'), {x: frame.left, y: frame.top, width: qWidth, height: qHeight});
  svg.querySelector('.quadrant-border').setAttribute(
    'd',
    qWidth > 2 && qHeight > 2 ? `M${frame.left} ${qy}H${qx}V${frame.top}` : ''
  );

  // Minimum score floor overlay & maximum cost ceiling overlay
  const floorRect = svg.querySelector('.floor-rect'), floorGuide = svg.querySelector('.floor-guide');
  if (state.minScore > 0) {
    const fy = Math.max(frame.top, Math.min(frame.bottom, y(state.minScore)));
    setAttrs(floorRect, {x: frame.left, y: fy, width: frame.width, height: Math.max(0, frame.bottom - fy)});
    setAttrs(floorGuide, {x1: frame.left, x2: frame.right, y1: fy, y2: fy});
    floorRect.style.display = floorGuide.style.display = '';
  } else {
    floorRect.style.display = floorGuide.style.display = 'none';
  }
  const budgetRect = svg.querySelector('.budget-rect'), budgetGuide = svg.querySelector('.budget-guide');
  if (state.xMetric === 'cost' && state.maxCost > 0) {
    const bx = Math.max(frame.left, Math.min(frame.right, x(state.maxCost)));
    setAttrs(budgetRect, {x: bx, y: frame.top, width: Math.max(0, frame.right - bx), height: frame.height});
    setAttrs(budgetGuide, {x1: bx, x2: bx, y1: frame.top, y2: frame.bottom});
    budgetRect.style.display = budgetGuide.style.display = '';
  } else {
    budgetRect.style.display = budgetGuide.style.display = 'none';
  }

  // Active pool Pareto frontier (cost or time) + optional Historical Pareto evolution
  const {list: frontier} = activeFrontierSet();
  const paretoEl = svg.querySelector('.pareto');
  const histEl = svg.querySelector('.pareto-history');
  paretoEl.setAttribute('d', frontier.map((row, i) => `${i ? 'L' : 'M'}${xCoord(row)},${y(row.intelligenceIndex)}`).join(' '));
  const inHist = canHistoryMode() && state.historyMode;
  if (inHist) {
    const cutoff = state.releaseDates[state.historyIndex];
    const pastFront = paretoFrontier(pool.filter(r => r.releaseDate && r.releaseDate <= cutoff), xOf);
    histEl.setAttribute('d', pastFront.map((row, i) => `${i ? 'L' : 'M'}${xCoord(row)},${y(row.intelligenceIndex)}`).join(' '));
    paretoEl.style.opacity = '0.42';
  } else {
    histEl.setAttribute('d', '');
    paretoEl.style.opacity = '';
  }

  // Optional reasoning effort trajectories across multi-effort families
  const effortLayer = svg.querySelector('.effort-layer');
  effortLayer.replaceChildren();
  if (state.effortCurves) {
    const visibleIds = new Set(nodes.map(n => n.row.id));
    for (const traj of effortTrajectories(pool, xOf)) {
      const pts = traj.points.filter(r => visibleIds.has(r.id));
      if (pts.length < 2) continue;
      const muted = state.company && traj.creator?.name !== state.company;
      const path = node('path', {
        class: 'effort-line',
        'data-family': traj.slug,
        stroke: color(traj.creator?.color),
        d: pts.map((r, i) => `${i ? 'L' : 'M'}${xCoord(r)},${y(r.intelligenceIndex)}`).join(' ')
      });
      if (muted) path.style.opacity = '0.16';
      effortLayer.append(path);
    }
  }

  // Optional Iso-Value tangent contour passing through the #1 best-value entry (USD mode only)
  const isoPath = svg.querySelector('.iso-curve');
  const {champion, championValue} = computeRankings();
  if (state.xMetric === 'cost' && state.isoCurve && champion && championValue > 0) {
    const sMin = Math.max(0.25, state.minScore || 0.25, state.view.y);
    const sMax = Math.min(104, state.view.y + state.view.height);
    const segments = [];
    const sampleCount = 140;
    for (let i = 0; i <= sampleCount; i++) {
      const s = sMin + (i / sampleCount) * (sMax - sMin);
      const c = isoValueCost(s, championValue, state.valueWeight);
      if (c === null || c > state.bounds.width * 1.5) continue;
      segments.push(`${segments.length ? 'L' : 'M'}${x(c)},${y(s)}`);
    }
    isoPath.setAttribute('d', segments.join(' '));
  } else {
    isoPath.setAttribute('d', '');
  }

  // Optional vertical subscription break-even threshold line: cost* = subFee / monthlyTasks (USD mode only)
  const subGuide = svg.querySelector('.sub-guide');
  if (state.xMetric === 'cost' && state.subLine && state.monthlyTasks > 0) {
    const thresholdCost = state.subFee / state.monthlyTasks;
    const sx = x(thresholdCost);
    setAttrs(subGuide, {x1: sx, x2: sx, y1: frame.top, y2: frame.bottom});
    subGuide.style.display = '';
  } else {
    subGuide.style.display = 'none';
  }

  for (const item of nodes) {
    const visible = inView(item.row);
    const cx = xCoord(item.row);
    if (Number.isFinite(cx)) {
      setAttrs(item.p, {cx, cy: y(item.row.intelligenceIndex), tabindex: visible ? 0 : -1});
    } else {
      item.p.setAttribute('tabindex', '-1');
    }
    item.p.style.visibility = visible ? 'visible' : 'hidden';
  }

  drawAxes(medianX, medianY);
  layoutLabels(champion?.id);
  drawActive(champion);
  updateSummary();

  host.dataset.chart = activeKey;
  host.dataset.xMetric = state.xMetric;
  host.dataset.xMin = state.view.x;
  host.dataset.xMax = state.view.x + state.view.width;
  host.dataset.yMin = state.view.y;
  host.dataset.yMax = state.view.y + state.view.height;
}

function drawAxes(medianX, medianY) {
  const grid = svg.querySelector('.grid'), axis = svg.querySelector('.axis');
  grid.replaceChildren();
  axis.replaceChildren();
  const v = state.view;
  const isTime = state.xMetric === 'time';

  for (const value of ticks(v.x, v.x + v.width, Math.max(3, Math.floor(frame.width / 105)))) {
    const xx = x(value);
    grid.append(node('line', {x1: xx, x2: xx, y1: frame.top, y2: frame.bottom}));
    const tickText = isTime ? t(`${format(value, 2)}分`, `${format(value, 2)}m`) : '$' + format(value, 6);
    axis.append(node('text', {class: 'x-tick', x: xx, y: frame.bottom + 17, 'text-anchor': 'middle'}, tickText));
  }

  const yTicks = ticks(v.y, v.y + v.height, Math.max(3, Math.floor(frame.height / 54)));
  const upper = v.y + v.height;
  if (v.y === state.bounds.y && v.height === state.bounds.height && !yTicks.includes(upper)) {
    if (yTicks.length && (upper - yTicks.at(-1)) / v.height * frame.height < 18) yTicks.pop();
    yTicks.push(upper);
  }
  for (const value of yTicks) {
    const yy = y(value);
    grid.append(node('line', {x1: frame.left, x2: frame.right, y1: yy, y2: yy}));
    axis.append(node('text', {class: 'y-tick', x: frame.left - 9, y: yy + 3.5, 'text-anchor': 'end'}, format(value, 3)));
  }

  // Subtle quadrant median reference micro-labels when inside plot frame
  const qx = x(medianX), qy = y(medianY);
  if (frame.width > 360 && qx > frame.left + 70 && qx < frame.right - 70 && qy > frame.top + 26) {
    const medLabel = isTime ? formatTime(medianX * 60) : money(medianX);
    axis.append(node('text', {
      class: 'quadrant-note',
      x: qx - 5,
      y: frame.top + 13,
      'text-anchor': 'end'
    }, t(`中位 ${medLabel}`, `Median ${medLabel}`)));
  }

  if (!isTime && state.subLine && state.monthlyTasks > 0) {
    const thresholdCost = state.subFee / state.monthlyTasks;
    const sx = x(thresholdCost);
    if (sx > frame.left + 20 && sx < frame.right - 20) {
      const alignRight = sx > frame.left + frame.width * 0.62;
      const compact = frame.width < 520;
      axis.append(node('text', {
        class: 'sub-guide-label',
        x: alignRight ? sx - 6 : sx + 6,
        y: frame.top + 27,
        'text-anchor': alignRight ? 'end' : 'start'
      }, compact
        ? (alignRight ? `← ${money(thresholdCost)}` : `${money(thresholdCost)} →`)
        : t(
          alignRight ? `← 未回本（API 省）· $${state.subFee}/${state.monthlyTasks}次 (${money(thresholdCost)})` : `${money(thresholdCost)} ($${state.subFee}/${state.monthlyTasks}次) · 已回本（订阅省）→`,
          alignRight ? `← Unmet (API saves) · $${state.subFee}/${state.monthlyTasks}x` : `$${state.subFee}/${state.monthlyTasks}x · Sub saves →`
        )));
    }
  }
  if (!isTime && state.maxCost > 0) {
    const bx = x(state.maxCost);
    if (bx > frame.left + 20 && bx < frame.right - 20) {
      const alignRight = bx > frame.left + frame.width * 0.62;
      const yOffset = state.subLine && state.monthlyTasks > 0 ? frame.top + 42 : frame.top + 27;
      axis.append(node('text', {
        class: 'budget-guide-label',
        x: alignRight ? bx - 6 : bx + 6,
        y: yOffset,
        'text-anchor': alignRight ? 'end' : 'start'
      }, t(
        alignRight ? `← 预算内 (≤ $${state.maxCost})` : `超出预算 (> $${state.maxCost}) →`,
        alignRight ? `← Within $${state.maxCost}` : `Over $${state.maxCost} cap →`
      )));
    }
  }

  axis.append(node('path', {class: 'frame', d: `M${frame.left},${frame.top}V${frame.bottom}H${frame.right}`}));
  axis.append(node('text', {
    class: 'axis-title x-title',
    x: (frame.left + frame.right) / 2,
    y: frame.bottom + 36,
    'text-anchor': 'middle'
  }, isTime
    ? t('每任务平均耗时（分钟 · 线性刻度）', 'Mean Wall Time per Task (Minutes · Linear Scale)')
    : t('每任务成本（美元 · 线性刻度）', 'Cost per Task (USD · Linear Scale)')));

  const group = node('g', {transform: `translate(16 ${(frame.top + frame.bottom) / 2}) rotate(-90)`});
  group.append(node('text', {
    class: 'axis-title y-title',
    'text-anchor': 'middle',
    y: 0
  }, currentAxisLabel()));
  axis.append(group);
}

function overlapArea(a, b) {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function isFutureHidden(row) {
  if (!(canHistoryMode() && state.historyMode)) return false;
  const cutoff = state.releaseDates[state.historyIndex];
  return !!(row.releaseDate && row.releaseDate > cutoff);
}

function layoutLabels(championId) {
  const placed = [], visible = nodes.filter(item => inView(item.row) && !isFutureHidden(item.row));
  const pool = activePool();
  const inHist = canHistoryMode() && state.historyMode;
  const frontier = inHist
    ? new Set(paretoFrontier(pool.filter(r => r.releaseDate && r.releaseDate <= state.releaseDates[state.historyIndex]), currentXOf()).map(row => row.id))
    : activeFrontierSet().idSet;
  const baseDist = state.labelDistance;
  const radii = [3, baseDist * 0.55, baseDist * 0.85, Math.max(6, baseDist)].filter((v, i, arr) => v >= 2 && arr.indexOf(v) === i);
  measure.font = `500 ${state.labelSize}px "IBM Plex Sans", "Segoe UI", "Microsoft YaHei UI", sans-serif`;

  const priorityOf = item => {
    const id = item.row.id;
    if (id === state.selected || item === hovered) return 4;
    if (state.xMetric === 'cost' && state.isoCurve && id === championId) return 3;
    if (state.company && item.row.creator?.name === state.company) return 2;
    if (frontier.has(id)) return 1;
    return 0;
  };

  const ordered = [...nodes].sort((a, b) => priorityOf(b) - priorityOf(a) || b.row.intelligenceIndex - a.row.intelligenceIndex);

  for (const item of ordered) {
    item.label.setAttribute('font-size', state.labelSize);
    const forceActive = item.row.id === state.selected || item === hovered;
    if (!state.labels || !inView(item.row) || (isFutureHidden(item.row) && !forceActive)) {
      item.label.style.visibility = item.line.style.visibility = 'hidden';
      continue;
    }

    const priority = priorityOf(item);
    const px = xCoord(item.row), py = y(item.row.intelligenceIndex);
    const w = measure.measureText(item.row.shortName || item.row.name).width + 2;
    const h = state.labelSize * 1.22;

    let best = null, bestScore = Infinity, bestLabelOverlap = Infinity;
    for (const radius of radii) {
      for (let i = 0; i < 16; i++) {
        const dx = Math.cos(i * Math.PI / 8), dy = Math.sin(i * Math.PI / 8);
        const candidate = {
          x: px + (dx > 0.01 ? radius : dx < -0.01 ? -radius - w : -w / 2),
          y: py + (dy > 0.01 ? radius : dy < -0.01 ? -radius - h : -h / 2),
          w,
          h
        };
        if (candidate.x < frame.left + 1 || candidate.x + w > frame.right - 1 || candidate.y < frame.top + 1 || candidate.y + h > frame.bottom - 1) continue;

        let labelCollision = 0, pointCollision = 0;
        for (const previous of placed) labelCollision += overlapArea(candidate, previous);
        for (const other of visible) {
          if (other !== item) pointCollision += overlapArea(candidate, {x: xCoord(other.row) - 4.5, y: y(other.row.intelligenceIndex) - 4.5, w: 9, h: 9});
        }
        const score = radius * 0.12 + labelCollision * 6 + pointCollision * 2.2;
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
          bestLabelOverlap = labelCollision;
        }
      }
    }

    if (!best) {
      item.label.style.visibility = item.line.style.visibility = 'hidden';
      continue;
    }

    // Smart collision avoidance: cull overlapping non-frontier crowd labels until zoomed in.
    if (state.smartLabels && priority < 3) {
      const maxAllowed = priority >= 1 ? w * h * 0.06 : 2;
      if (bestLabelOverlap > maxAllowed) {
        item.label.style.visibility = item.line.style.visibility = 'hidden';
        continue;
      }
    }

    placed.push(best);
    item.label.style.visibility = item.line.style.visibility = 'visible';
    setAttrs(item.label, {x: best.x, y: best.y + h * 0.8});
    setAttrs(item.line, {
      x1: px,
      y1: py,
      x2: Math.max(best.x, Math.min(best.x + w, px)),
      y2: Math.max(best.y, Math.min(best.y + h, py))
    });
  }
}

function drawActive(champion) {
  const layer = svg.querySelector('.active-layer');
  const companies = svg.querySelector('.company-layer');
  const glows = svg.querySelector('.glow-layer');
  const activeEffortLayer = svg.querySelector('.active-effort-layer');
  if (!layer || !companies || !glows || !frame) return;
  layer.replaceChildren();
  companies.replaceChildren();
  glows.replaceChildren();
  activeEffortLayer?.replaceChildren();

  for (const item of nodes) {
    const selected = item.row.id === state.selected, active = selected || item === hovered;
    const futureOut = isFutureHidden(item.row);
    const focused = !futureOut && !!state.company && item.row.creator?.name === state.company && !state.selected;
    const belowFloor = state.minScore > 0 && item.row.intelligenceIndex < state.minScore;
    const overBudget = state.xMetric === 'cost' && state.maxCost > 0 && item.row.cost > state.maxCost;
    const emphasized = active || focused;
    const muted = !active && (futureOut || belowFloor || overBudget || (state.company && item.row.creator?.name !== state.company) || (state.selected && !selected));

    setAttrs(item.p, {
      r: active ? 6 : focused ? 5 : 4.4,
      opacity: emphasized ? 0 : futureOut ? 0.1 : muted ? 0.3 : 1,
      'aria-pressed': selected
    });
    item.p.classList.toggle('is-active', active);
    item.label.classList.toggle('is-active', active);
    item.line.classList.toggle('is-active', active);
    item.label.style.opacity = emphasized ? '0' : muted ? '0.52' : '1';
    item.line.style.opacity = emphasized ? '0' : muted ? '0.18' : '0.6';
    if (focused && !active && inView(item.row)) companies.append(emphasisCopy(item, 5, 'company'));
  }

  const selected = nodes.find(item => item.row.id === state.selected);
  const focusItem = hovered || selected;
  if (activeEffortLayer && focusItem?.row.family?.slug) {
    const traj = effortTrajectories(activePool(), currentXOf()).find(tr => tr.slug === focusItem.row.family.slug);
    if (traj && traj.points.length >= 2) {
      activeEffortLayer.append(node('path', {
        class: 'effort-line is-highlighted',
        stroke: focusItem.color,
        d: traj.points.map((r, i) => `${i ? 'L' : 'M'}${xCoord(r)},${y(r.intelligenceIndex)}`).join(' ')
      }));
      for (const sibling of traj.points) {
        if (sibling.id === focusItem.row.id || !inView(sibling)) continue;
        activeEffortLayer.append(node('circle', {
          cx: xCoord(sibling),
          cy: y(sibling.intelligenceIndex),
          r: 5.5,
          fill: 'none',
          stroke: focusItem.color,
          'stroke-width': 1.5
        }));
      }
    }
  }

  if (state.xMetric === 'cost' && state.isoCurve && champion) {
    const champNode = nodes.find(item => item.row.id === champion.id);
    if (champNode && inView(champNode.row)) {
      layer.append(node('circle', {
        class: 'champion-ring',
        cx: xCoord(champNode.row),
        cy: y(champNode.row.intelligenceIndex),
        r: 9
      }));
    }
  }

  if (selected && inView(selected.row)) {
    const xx = xCoord(selected.row), yy = y(selected.row.intelligenceIndex);
    layer.append(
      node('path', {class: 'pin-guides', d: `M${frame.left} ${yy}H${xx}V${frame.bottom}`, stroke: selected.color, fill: 'none'}),
      node('circle', {class: 'pin-ring', cx: xx, cy: yy, r: 10, stroke: selected.color, fill: 'none'}),
      emphasisCopy(selected, 6, 'pinned')
    );
  }
  if (hovered && hovered !== selected && inView(hovered.row)) {
    layer.append(
      node('circle', {cx: xCoord(hovered.row), cy: y(hovered.row.intelligenceIndex), r: 8, stroke: hovered.color, 'stroke-width': 1.5, fill: 'none'}),
      emphasisCopy(hovered, 6, 'hovered')
    );
  }
  renderPinned();
}

function emphasisCopy(item, radius, kind) {
  const group = node('g', {class: `emphasis-item emphasis-${kind}`, 'data-id': item.row.id});
  const cx = xCoord(item.row), cy = y(item.row.intelligenceIndex);
  svg.querySelector('.glow-layer').append(node('circle', {
    class: `emphasis-glow glow-${kind}`,
    'data-id': item.row.id,
    cx,
    cy,
    r: kind === 'company' ? 11 : 12,
    fill: `url(#${glowId(item.color)})`
  }));
  const forceLabel = kind === 'pinned' || kind === 'hovered';
  const hasLabel = state.labels && (item.label.style.visibility === 'visible' || forceLabel);
  if (hasLabel && item.label.hasAttribute('x')) {
    const line = item.line.cloneNode(false);
    line.setAttribute('class', 'emphasis-connector');
    line.style.visibility = 'visible';
    line.style.opacity = '1';
    group.append(line);
  }
  group.append(node('circle', {class: 'emphasis-marker', cx, cy, r: radius, fill: item.color}));
  if (hasLabel && item.label.hasAttribute('x')) {
    const label = item.label.cloneNode(true);
    label.setAttribute('class', 'label emphasis-label');
    label.style.visibility = 'visible';
    label.style.opacity = '1';
    group.append(label);
  }
  return group;
}

function renderPinned() {
  const row = state?.rows.find(r => r.id === state.selected), card = $('#pinnedCard');
  card.hidden = !row || state.mode !== 'chart';
  if (!row) return;

  const {idSet: frontierIds} = activeFrontierSet();
  const {rankMap, qualifiedCount} = computeRankings();
  const rankInfo = rankMap.get(row.id);

  $('#pinnedName').textContent = row.name;
  const metaParts = [row.creator?.name || 'Other'];
  if (row.isOpenWeights) metaParts.push(row.parametersB ? `${t('开源', 'Open')} ${row.parametersB}B` : t('开源', 'Open'));
  if (row.effort?.label) metaParts.push(row.effort.label);
  if (row.modalities?.length) metaParts.push(modalitySummary(row));
  if (row.refusalRate != null) metaParts.push(t(`拒答 ${format(row.refusalRate, 1)}%`, `Refusal ${format(row.refusalRate, 1)}%`));
  if (activeKey === 'frontier' && row.rankDelta != null && row.rankDelta !== 0) {
    metaParts.push(row.rankDelta > 0 ? t(`硬核排名 ↑+${row.rankDelta}`, `Hard rank ↑+${row.rankDelta}`) : t(`硬核排名 ↓${row.rankDelta}`, `Hard rank ↓${row.rankDelta}`));
  }
  if (activeKey === 'human-arena' && row.arenaRaw) {
    if (row.arenaRaw.chatElo != null) metaParts.push(`Chat Elo ${format(row.arenaRaw.chatElo, 0)}`);
    if (row.arenaRaw.designWebElo != null) metaParts.push(`Design Elo ${row.arenaRaw.designWebElo}`);
  }
  if (frontierIds.has(row.id)) metaParts.push(t('帕累托前沿', 'Pareto frontier'));
  if (rankInfo) metaParts.push(t(`性价比 #${rankInfo.rank}/${qualifiedCount}`, `Value #${rankInfo.rank}/${qualifiedCount}`));
  $('#pinnedMeta').textContent = metaParts.join(' · ');

  $('#pinnedScore').textContent = format(row.intelligenceIndex, 2);
  $('#pinnedCost').textContent = money(row.cost);
  $('#pinnedTime').textContent = formatTime(row.timeSec);
  $('#pinnedValue').textContent = rankInfo
    ? valueLabel(rankInfo.value)
    : state.minScore > 0 && row.intelligenceIndex < state.minScore
      ? t('未达门槛', 'Below min')
      : state.maxCost > 0 && row.cost > state.maxCost
        ? t('超出预算', 'Over cap')
        : '—';
  $('#pinnedSubNote').textContent = tierBreakevenText(row.cost);

  const crossEl = $('#pinnedCrossTabs');
  const crossInfo = activeKey !== 'coding-agents' ? crossTabIndex.get(row.id) : null;
  const tabDefs = [
    ['models', '综合', 'Intel'],
    ['frontier', '极限', 'Hard'],
    ['human-arena', '审美', 'Taste'],
    ['cyber', '安全', 'Cyber']
  ];
  const crossEntries = crossInfo
    ? tabDefs.filter(([k]) => crossInfo[k] && !$(`#tab-${k}`)?.hidden)
    : [];
  if (crossEntries.length >= 2) {
    const cFrag = document.createDocumentFragment();
    for (const [tabKey, zhLbl, enLbl] of crossEntries) {
      const entry = crossInfo[tabKey];
      const pill = html('button', `${t(zhLbl, enLbl)} ${format(entry.score, 1)} (#${entry.rank})`, 'cross-tab-pill');
      pill.type = 'button';
      if (tabKey === activeKey) {
        pill.classList.add('is-current');
        pill.title = t('当前所在榜单', 'Current benchmark tab');
      } else {
        pill.title = t(`跳转到「${BENCHMARKS[tabKey].zhTitle}」并定位该模型`, `Switch to ${BENCHMARKS[tabKey].enTitle} & locate model`);
        pill.addEventListener('click', () => {
          chooseChart(tabKey);
          const targetRow = state?.rows.find(r => r.id === row.id);
          if (targetRow) locateRowInChart(targetRow);
        });
      }
      cFrag.append(pill);
    }
    crossEl.replaceChildren(cFrag);
    crossEl.hidden = false;
  } else {
    crossEl.hidden = true;
    crossEl.replaceChildren();
  }
  const provEl = $('#pinnedProviders');
  if (row.providers?.length >= 2) {
    const cheapest = row.providers[0];
    const fastest = [...row.providers].filter(p => p.timeSec > 0).sort((a, b) => a.timeSec - b.timeSec)[0];
    provEl.hidden = false;
    provEl.textContent = t(
      `多云比价（${row.providers.length} 家）：最低 ${money(cheapest.cost)} (${cheapest.host})${fastest ? ' · 最快 ' + formatTime(fastest.timeSec) + ' (' + fastest.host + ')' : ''}`,
      `Cloud hosts (${row.providers.length}): Low ${money(cheapest.cost)} (${cheapest.host})${fastest ? ' · Fast ' + formatTime(fastest.timeSec) + ' (' + fastest.host + ')' : ''}`
    );
  } else {
    provEl.hidden = true;
    provEl.textContent = '';
  }
  $('#pinnedOutside').hidden = !frame || inView(row);

  const inCmp = state.compareIds.includes(row.id);
  $('#pinCompareBtn').textContent = inCmp ? t('已对比 ✓', 'In cmp ✓') : t('+ 对比', '+ Compare');
  $('#pinCompareBtn').setAttribute('aria-pressed', String(inCmp));

  if (frame) {
    card.style.left = 'auto';
    card.style.right = '10px';
    card.style.top = '10px';
    card.style.bottom = 'auto';
    card.style.width = '';
    const rx = xCoord(row);
    if (frame.width >= 440) {
      card.style.width = Math.min(318, frame.width * 0.46) + 'px';
      if (Number.isFinite(rx) && rx > frame.left + frame.width / 2) {
        card.style.left = frame.left + 10 + 'px';
        card.style.right = 'auto';
      }
    } else if (y(row.intelligenceIndex) < frame.top + frame.height / 2) {
      card.style.top = 'auto';
      card.style.bottom = host.clientHeight - frame.bottom + 10 + 'px';
    }
  }
}

function showHover(item, event) {
  if (!inView(item.row)) return;
  hovered = item;
  const {champion, rankMap, qualifiedCount} = computeRankings();
  drawActive(champion);

  const row = item.row;
  const {idSet: frontierIds} = activeFrontierSet();
  const rankInfo = rankMap.get(row.id);

  tip.replaceChildren(html('strong', row.name));
  const subParts = [row.creator?.name || 'Other'];
  if (row.isOpenWeights) subParts.push(row.parametersB ? `${t('开源权重', 'Open')} ${row.parametersB}B` : t('开源权重', 'Open weights'));
  if (row.effort?.label) subParts.push(`${t('推理', 'Effort')}: ${row.effort.label}`);
  if (row.modalities?.length) subParts.push(modalitySummary(row));
  if (row.releaseDate) subParts.push(row.releaseDate);
  if (row.agentName && row.modelName) subParts.push(`${row.agentName} · ${row.modelName}`);
  if (frontierIds.has(row.id)) subParts.push(t('帕累托前沿', 'Pareto frontier'));
  if (row.isRouter) subParts.push(t('路由变体', 'Router'));
  tip.append(html('span', subParts.join(' · '), 'tip-sub'));

  const axisLabel = currentAxisLabel();
  const valText = rankInfo
    ? `${valueLabel(rankInfo.value)} (#${rankInfo.rank}/${qualifiedCount})`
    : state.minScore > 0 && row.intelligenceIndex < state.minScore
      ? t('未达最低门槛', 'Below min score')
      : state.maxCost > 0 && row.cost > state.maxCost
        ? t('超出预算上限', 'Exceeds budget cap')
        : '—';
  const kvRows = [
    [axisLabel, format(row.intelligenceIndex, 2)],
    [t('每任务成本', 'Cost / task'), money(row.cost)]
  ];
  if (row.timeSec > 0) kvRows.push([t('平均耗时', 'Mean time'), formatTime(row.timeSec)]);
  if (activeKey === 'frontier') {
    const d = row.rankDelta ?? 0;
    const dStr = d > 0 ? `↑+${d}` : d < 0 ? `↓${d}` : '—';
    kvRows.push([t('综合智能分 · 排名变化', 'Overall Index · Rank Δ'), `${format(row.aaIndex ?? row.intelligenceIndex, 2)} (${dStr})`]);
    if (row.frontierScores?.gdpPdf != null || row.frontierScores?.frontierCode != null) {
      const fParts = [];
      if (row.frontierScores.gdpPdf != null) fParts.push(`PDF ${format(row.frontierScores.gdpPdf, 1)}%`);
      if (row.frontierScores.frontierCode != null) fParts.push(`Code ${format(row.frontierScores.frontierCode, 1)}%`);
      kvRows.push([t('极难分项 (全过/编程)', 'Hard Suites (PDF/Code)'), fParts.join(' · ')]);
    }
  }
  if (activeKey === 'human-arena' && row.arenaRaw) {
    const ar = row.arenaRaw;
    if (ar.chatElo != null) kvRows.push([t('LMArena 交流人味 Elo', 'LMArena Chat Elo'), format(ar.chatElo, 1)]);
    if (ar.designWebElo != null) {
      kvRows.push([
        t('Design Arena 网页审美', 'Design Arena Web'),
        `${ar.designWebElo} Elo${ar.designWebWinRate != null ? ' (' + format(ar.designWebWinRate, 1) + '%)' : ''}`
      ]);
    }
    if (ar.webdevElo != null) kvRows.push([t('LMArena WebDev Elo', 'LMArena WebDev Elo'), format(ar.webdevElo, 0)]);
    if (ar.gdpvalElo != null) kvRows.push([t('专家交付 GDPval Elo', 'Expert GDPval Elo'), format(ar.gdpvalElo, 0)]);
  }
  if (row.refusalRate != null) kvRows.push([t('安全拒答率', 'Safety refusal'), `${format(row.refusalRate, 1)}%`]);
  if (row.costPercentiles) {
    kvRows.push([t('成本 P50 / P95', 'Cost P50 / P95'), `${money(row.costPercentiles.p50 || 0)} / ${money(row.costPercentiles.p95 || 0)}`]);
  }
  kvRows.push([t(`性价比 (α=${state.valueWeight.toFixed(1)})`, `Value (α=${state.valueWeight.toFixed(1)})`), valText]);

  for (const [label, value] of kvRows) {
    const line = html('div', null, 'tip-value');
    line.append(html('span', label), html('b', value));
    tip.append(line);
  }
  const beSummary = tierBreakevenText(row.cost);
  if (beSummary) tip.append(html('span', beSummary, 'tip-foot'));
  const inCmp = state.compareIds.includes(row.id);
  tip.append(html('span', inCmp
    ? t('单击锁定卡片 · 已在剖析对比组 ✓', 'Click to pin · In comparison ✓')
    : t('单击锁定卡片 · Shift+单击加入对比', 'Click to pin · Shift+click to compare'), 'tip-foot'));
  tip.hidden = state.selected === row.id;
  const box = item.p.getBoundingClientRect();
  positionTip(event?.clientX ?? box.x + box.width / 2, event?.clientY ?? box.y);
}

function positionTip(px, py) {
  const box = tip.getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(innerWidth - box.width - 8, px + 14)) + 'px';
  tip.style.top = Math.max(8, Math.min(innerHeight - box.height - 8, py + 14)) + 'px';
}

function clearHover() {
  hovered = null;
  tip.hidden = true;
  if (state && state.mode === 'chart') {
    const {champion} = computeRankings();
    drawActive(champion);
  }
}

function nearestItem(event) {
  if (!state || state.mode !== 'chart' || !frame || event.target.closest('.pinned-card')) return null;
  const rect = host.getBoundingClientRect(), px = event.clientX - rect.left, py = event.clientY - rect.top;
  let closest = null, best = 13 * 13;
  for (const item of nodes) {
    if (!inView(item.row)) continue;
    const distance = (xCoord(item.row) - px) ** 2 + (y(item.row.intelligenceIndex) - py) ** 2;
    if (distance < best) {
      closest = item;
      best = distance;
    }
  }
  return closest;
}

function togglePin(item) {
  state.selected = state.selected === item.row.id ? null : item.row.id;
  tip.hidden = true;
  syncUrlHash();
  draw();
}

function clearPin() {
  if (!state) return;
  state.selected = null;
  clearHover();
  syncUrlHash();
  if (state.mode === 'table') renderTable();
  else if (state.mode === 'sub') renderSubTable();
  scheduleDraw();
}

$('#unpin').addEventListener('click', clearPin);
$('#pinCompareBtn').addEventListener('click', () => {
  if (state?.selected) toggleCompareId(state.selected);
});
$('#pinGoCompareBtn').addEventListener('click', () => {
  if (!state?.selected) return;
  if (!state.compareIds.includes(state.selected)) {
    if (state.compareIds.length >= MAX_COMPARE) state.compareIds.shift();
    state.compareIds.push(state.selected);
  }
  if (activeKey !== 'coding-agents') lastModelCompareIds = [...state.compareIds];
  showView('compare');
});

function updateSummary() {
  const rows = filteredRows();
  const shown = frame && state.mode === 'chart' ? rows.filter(inView).length : rows.length;
  const v = state.view;
  const {champion} = computeRankings();

  if (state.mode === 'curve') {
    const ratio = capabilityUtility(60, state.valueWeight) / capabilityUtility(50, state.valueWeight);
    $('#viewStatus').textContent = t(
      `α = ${state.valueWeight.toFixed(1)} · 50→60 分效用倍率 ×${format(ratio, 2)}${champion ? ' · 当前榜首：' + (champion.shortName || champion.name) : ''}`,
      `α = ${state.valueWeight.toFixed(1)} · 50→60 utility ×${format(ratio, 2)}${champion ? ' · #1: ' + (champion.shortName || champion.name) : ''}`
    );
  } else if (state.mode === 'compare') {
    $('#viewStatus').textContent = t(
      `已选 ${state.compareIds.length}/${MAX_COMPARE} 项深度剖析 · 含大尺寸雷达、成本结构与并排对决表`,
      `Comparing ${state.compareIds.length}/${MAX_COMPARE} entries · Hero radar, cost anatomy & matrix`
    );
  } else if (state.mode === 'table') {
    $('#viewStatus').textContent = t(
      `共 ${rows.length} 项 · α = ${state.valueWeight.toFixed(1)}${state.minScore > 0 ? ' · 门槛 ≥' + state.minScore : ''}${state.maxCost > 0 ? ' · 预算 ≤$' + state.maxCost : ''}`,
      `${rows.length} entries · α = ${state.valueWeight.toFixed(1)}${state.minScore > 0 ? ' · Min ≥' + state.minScore : ''}${state.maxCost > 0 ? ' · Cap ≤$' + state.maxCost : ''}`
    );
  } else if (state.mode === 'sub') {
    $('#viewStatus').textContent = t(
      `共 ${rows.length} 项 · 参考月费 $${state.subFee} · 预计 ${state.monthlyTasks} 次/月`,
      `${rows.length} entries · Sub $${state.subFee}/mo · ${state.monthlyTasks} tasks/mo`
    );
  } else if (state.xMetric === 'time') {
    const startTime = v.x <= 0 ? t('0 分', '0m') : formatTime(v.x * 60);
    $('#viewStatus').textContent = t(
      `当前视野 ${shown}/${rows.length} 项 · 耗时区间 ${startTime}–${formatTime((v.x + v.width) * 60)}`,
      `Showing ${shown}/${rows.length} · Time ${startTime}–${formatTime((v.x + v.width) * 60)}`
    );
  } else {
    $('#viewStatus').textContent = t(
      `当前视野 ${shown}/${rows.length} 项 · 成本区间 ${money(v.x)}–${money(v.x + v.width)}${state.maxCost > 0 ? ' · 预算 ≤$' + state.maxCost : ''}`,
      `Showing ${shown}/${rows.length} · Cost ${money(v.x)}–${money(v.x + v.width)}${state.maxCost > 0 ? ' · Cap ≤$' + state.maxCost : ''}`
    );
  }

  if (state.mode !== 'curve' && state.mode !== 'compare') {
    if (state.yLens) $('#viewStatus').append(document.createTextNode(` · ${currentAxisLabel()}`));
    if (state.license === 'open') $('#viewStatus').append(document.createTextNode(t(' · 仅开源', ' · Open only')));
    else if (state.license === 'closed') $('#viewStatus').append(document.createTextNode(t(' · 仅闭源', ' · Proprietary')));
    if (state.extraFilter) {
      const xfLabel = $('#extraFilter')?.selectedOptions?.[0]?.textContent;
      if (xfLabel) $('#viewStatus').append(document.createTextNode(` · ${xfLabel}`));
    }
    if (state.company) $('#viewStatus').append(document.createTextNode(t(` · 聚焦：${state.company}`, ` · Focus: ${state.company}`)));
    if (state.search) $('#viewStatus').append(document.createTextNode(t(` · 搜索：${state.search}`, ` · Search: ${state.search}`)));
    if (state.frontierOnly) $('#viewStatus').append(document.createTextNode(t(' · 仅前沿', ' · Frontier')));
  }
  $('#viewStatus').title = $('#viewStatus').textContent;

  if (!rows.length) {
    $('#loading').hidden = state.mode !== 'chart';
    $('#loading').replaceChildren(document.createTextNode(t('没有匹配结果，请清除筛选条件', 'No matching results. Clear filters to restore.')));
  } else {
    $('#loading').hidden = true;
  }

  const selected = state.rows.find(row => row.id === state.selected);
  $('#selection').textContent = selected && state.mode !== 'curve' && state.mode !== 'compare'
    ? t(`已锁定：${selected.name}`, `Pinned: ${selected.name}`)
    : '';
}

function changeView(view) {
  if (!state) return;
  clearHover();
  state.view = clampView(view, state.bounds);
  state.views[state.xMetric] = {...state.view};
  scheduleDraw();
}

function zoom(axis, factor, anchorX = 0.5, anchorY = 0.5) {
  if (!state) return;
  clearHover();
  state.view = pointerZoomView(state.view, state.bounds, axis, factor, anchorX, anchorY);
  state.views[state.xMetric] = {...state.view};
  scheduleDraw();
}

for (const [id, metric] of [['xMetricCost', 'cost'], ['xMetricTime', 'time']]) {
  $('#' + id).addEventListener('click', () => {
    if (!state || state.xMetric === metric) return;
    syncMetricViewport(state, metric);
    syncControls();
    syncUrlHash();
    buildPlot();
  });
}

$('#reset').addEventListener('click', () => {
  if (state) changeView({...state.defaultView});
});
$('#fit').addEventListener('click', () => {
  if (state) changeView({...state.bounds});
});
for (const [id, axis, factor] of [['xminus', 'x', 1.2], ['xplus', 'x', 1 / 1.2], ['yminus', 'y', 1.2], ['yplus', 'y', 1 / 1.2]]) {
  $('#' + id).addEventListener('click', () => zoom(axis, factor, 0.5, 0.5));
}

$('#search').addEventListener('input', () => {
  if (!state) return;
  state.search = $('#search').value;
  state.selected = null;
  syncControls();
  syncUrlHash();
  buildPlot();
});

for (const btn of document.querySelectorAll('#licenseGroup [data-license]')) {
  btn.addEventListener('click', () => {
    if (!state || state.license === btn.dataset.license) return;
    state.license = btn.dataset.license;
    state.selected = null;
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
  });
}

$('#yLensSelect').addEventListener('change', () => {
  if (!state) return;
  stopHistoryPlay();
  applyYLens(state, $('#yLensSelect').value);
  state.selected = null;
  renderLegend();
  syncControls();
  syncUrlHash();
  buildPlot();
});

$('#extraFilter').addEventListener('change', () => {
  if (!state) return;
  state.extraFilter = $('#extraFilter').value;
  state.selected = null;
  renderLegend();
  syncControls();
  syncUrlHash();
  buildPlot();
});

$('#frontier').addEventListener('click', () => {
  if (!state) return;
  state.frontierOnly = !state.frontierOnly;
  state.selected = null;
  syncControls();
  syncUrlHash();
  buildPlot();
});

$('#effortToggle').addEventListener('click', () => {
  if (!state) return;
  state.effortCurves = !state.effortCurves;
  syncControls();
  syncUrlHash();
  scheduleDraw();
});

$('#historyToggle').addEventListener('click', () => {
  if (!state || !state.releaseDates.length) return;
  stopHistoryPlay();
  state.historyMode = !state.historyMode;
  if (state.historyMode && state.historyIndex >= state.releaseDates.length - 1) {
    const sixMo = shiftMonthsIso(state.releaseDates.at(-1), -6);
    const idx = state.releaseDates.findIndex(d => d >= sixMo);
    state.historyIndex = idx === -1 ? Math.floor(state.releaseDates.length * 0.45) : idx;
  }
  syncControls();
  syncUrlHash();
  scheduleDraw();
});

$('#historySlider').addEventListener('input', () => {
  if (!state) return;
  stopHistoryPlay();
  state.historyIndex = Number($('#historySlider').value);
  syncHistoryControls();
  syncUrlHash();
  scheduleDraw();
});

$('#historyPlayBtn').addEventListener('click', () => {
  if (!state || !state.releaseDates.length) return;
  if (historyTimer) {
    stopHistoryPlay();
    return;
  }
  if (state.historyIndex >= state.releaseDates.length - 1) {
    state.historyIndex = 0;
  }
  historyTimer = setInterval(() => {
    if (!state || !state.historyMode || state.mode !== 'chart') {
      stopHistoryPlay();
      return;
    }
    if (state.historyIndex < state.releaseDates.length - 1) {
      state.historyIndex++;
      syncHistoryControls();
      syncUrlHash();
      scheduleDraw();
    } else {
      stopHistoryPlay();
    }
  }, 150);
  syncHistoryControls();
});

$('#routerToggle').addEventListener('click', () => {
  if (!state) return;
  state.routerOpen = !state.routerOpen;
  syncRouterControls();
});

for (const [selId, key] of [['#routerFastSelect', 'routerFastId'], ['#routerStrongSelect', 'routerStrongId']]) {
  $(selId).addEventListener('change', () => {
    if (!state) return;
    state[key] = $(selId).value;
    syncRouterControls();
  });
}

$('#routerShare').addEventListener('input', () => {
  if (!state) return;
  state.routerShare = Number($('#routerShare').value);
  syncRouterControls();
});

for (const [btnId, mode] of [['#radarModeBench', 'bench'], ['#radarModeDomain', 'domain']]) {
  $(btnId).addEventListener('click', () => {
    if (!state || state.radarMode === mode) return;
    state.radarMode = mode;
    syncUrlHash();
    renderCompare();
  });
}

$('#radarInfoBtn').addEventListener('click', () => {
  radarInfoOpen = !radarInfoOpen;
  renderRadarInfo();
});

$('#radarSvg').addEventListener('pointermove', event => {
  if (!state || state.mode !== 'compare' || !radarCtx) return;
  const pt = radarSvgPoint(event);
  if (!pt) return;
  const hit = hitTestRadar(pt.x, pt.y);
  $('#radarSvg').classList.toggle('is-interactive', !!(hit && hit.seriesIdx !== null));
  if (!hit) {
    tip.hidden = true;
    syncRadarSpotlight(null, null);
    return;
  }
  const ax = hit.axisIdx !== null ? radarCtx.axes[hit.axisIdx] : null;
  syncRadarSpotlight(hit.seriesIdx, ax?.key || null);
  if (ax) {
    showMetricTip(ax, event, hit.seriesIdx, hit.cluster?.length || 0);
  } else if (hit.seriesIdx !== null) {
    const row = radarCtx.selectedRows[hit.seriesIdx];
    tip.replaceChildren(
      html('strong', row.name),
      html('span', `${row.creator?.name || 'Other'} · ${t('综合指数', 'Index')} ${format(row.intelligenceIndex, 2)} · ${money(row.cost)}`, 'tip-sub'),
      html('span', t('单击锁定并将该模型置顶展示', 'Click to lock and bring model to front'), 'tip-foot')
    );
    tip.hidden = false;
    positionTip(event.clientX, event.clientY);
  }
});

$('#radarSvg').addEventListener('pointerleave', () => {
  $('#radarSvg').classList.remove('is-interactive');
  tip.hidden = true;
  if (state?.mode === 'compare') syncRadarSpotlight(null, null);
});

$('#radarSvg').addEventListener('click', event => {
  if (!state || state.mode !== 'compare' || !radarCtx) return;
  const pt = radarSvgPoint(event);
  const hit = pt ? hitTestRadar(pt.x, pt.y) : null;
  if (!hit || hit.seriesIdx === null) {
    if (state.radarPinnedId) {
      state.radarPinnedId = null;
      syncUrlHash();
      syncRadarSpotlight(null, hit?.axisIdx != null ? radarCtx.axes[hit.axisIdx]?.key : null);
    }
    return;
  }
  if (hit.cluster && hit.cluster.length > 1) {
    const ids = hit.cluster.map(c => radarCtx.selectedRows[c.sIdx].id);
    const curPos = ids.indexOf(state.radarPinnedId);
    state.radarPinnedId = curPos === -1
      ? ids[0]
      : curPos < ids.length - 1
        ? ids[curPos + 1]
        : null;
  } else {
    const targetId = radarCtx.selectedRows[hit.seriesIdx].id;
    state.radarPinnedId = state.radarPinnedId === targetId ? null : targetId;
  }
  syncUrlHash();
  const nextActiveIdx = state.radarPinnedId
    ? radarCtx.selectedRows.findIndex(r => r.id === state.radarPinnedId)
    : null;
  const ax = hit.axisIdx !== null ? radarCtx.axes[hit.axisIdx] : null;
  syncRadarSpotlight(nextActiveIdx, ax?.key || null);
  if (ax && nextActiveIdx !== null && nextActiveIdx >= 0) {
    showMetricTip(ax, event, nextActiveIdx, hit.cluster?.length || 0);
  }
});

$('#isoToggle').addEventListener('click', () => {
  if (!state) return;
  state.isoCurve = !state.isoCurve;
  syncControls();
  syncUrlHash();
  scheduleDraw();
});

$('#subLineToggle').addEventListener('click', () => {
  if (!state) return;
  state.subLine = !state.subLine;
  syncControls();
  syncUrlHash();
  scheduleDraw();
});

$('#exportPng').addEventListener('click', () => exportChartPng('chart'));
$('#curveExportPng').addEventListener('click', () => exportChartPng('curve'));
$('#compareExportPng').addEventListener('click', () => exportChartPng('compare'));
$('#compareCopyMd').addEventListener('click', copyCompareMarkdown);
$('#exportCsv').addEventListener('click', exportCsv);

$('#compareAddBtn').addEventListener('click', () => {
  setComparePickerOpen(!comparePickerOpen);
});
$('#compareSearchInput').addEventListener('input', renderComparePicker);

$('#compareSyncBtn').addEventListener('click', () => {
  if (!state || activeKey === 'coding-agents' || !Array.isArray(lastModelCompareIds)) return;
  const valid = new Set(state.rows.map(r => r.id));
  const synced = lastModelCompareIds.filter(id => valid.has(id)).slice(0, MAX_COMPARE);
  if (!synced.length) return;
  state.compareIds = synced;
  syncUrlHash();
  renderCompare();
  updateSummary();
});

$('#compareAutoBtn').addEventListener('click', () => {
  if (!state) return;
  const pool = licenseFilteredRows(state.rows);
  state.compareIds = defaultCompareIds(pool.length >= 2 ? pool : state.rows);
  if (activeKey !== 'coding-agents') lastModelCompareIds = [...state.compareIds];
  syncUrlHash();
  renderCompare();
  updateSummary();
});

$('#compareFrontierBtn').addEventListener('click', () => {
  if (!state) return;
  const pool = licenseFilteredRows(state.rows);
  state.compareIds = frontierCompareIds(pool.length >= 2 ? pool : state.rows, MAX_COMPARE);
  if (activeKey !== 'coding-agents') lastModelCompareIds = [...state.compareIds];
  syncUrlHash();
  renderCompare();
  updateSummary();
});

$('#compareClearBtn').addEventListener('click', () => {
  if (!state || state.compareIds.length <= 1) return;
  const keepId = state.radarPinnedId && state.compareIds.includes(state.radarPinnedId)
    ? state.radarPinnedId
    : state.compareIds[0];
  state.compareIds = [keepId];
  if (activeKey !== 'coding-agents') lastModelCompareIds = [...state.compareIds];
  syncUrlHash();
  renderCompare();
  updateSummary();
});

$('#clearFilters').addEventListener('click', () => {
  if (!state) return;
  stopHistoryPlay();
  if (state.yLens) applyYLens(state, '');
  state.company = null;
  state.license = 'all';
  state.extraFilter = '';
  state.search = '';
  state.frontierOnly = false;
  state.minScore = 0;
  state.maxCost = 0;
  state.selected = null;
  syncControls();
  syncUrlHash();
  renderLegend();
  buildPlot();
});

$('#labels').addEventListener('click', () => {
  if (!state) return;
  state.labels = !state.labels;
  syncControls();
  scheduleDraw();
});

$('#smartLabels').addEventListener('click', () => {
  if (!state) return;
  state.smartLabels = !state.smartLabels;
  syncControls();
  scheduleDraw();
});

for (const [id, key] of [['labelSize', 'labelSize'], ['labelDistance', 'labelDistance']]) {
  $('#' + id).addEventListener('input', () => {
    if (!state) return;
    state[key] = +$('#' + id).value;
    $('#' + id + 'Value').value = state[key];
    syncSettingsReset();
    clearHover();
    scheduleDraw();
  });
}

$('#resetSettings').addEventListener('click', () => {
  if (!state) return;
  Object.assign(state, DEFAULT_SETTINGS[activeKey]);
  clearHover();
  syncControls();
  scheduleDraw();
});

function showView(mode) {
  if (!state || !['chart', 'table', 'curve', 'sub', 'compare'].includes(mode)) return;
  stopHistoryPlay();
  if (comparePickerOpen && mode !== 'compare') setComparePickerOpen(false);
  endPointerInteractions();
  clearHover();
  state.mode = mode;
  valueDetailsOpen = false;
  syncControls();
  syncUrlHash();
  if (mode === 'chart') buildPlot();
  else if (mode === 'table') renderTable();
  else if (mode === 'sub') renderSubTable();
  else if (mode === 'compare') renderCompare();
  scheduleDraw();
}

for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => showView(button.dataset.view));
}

let pendingValueFrame = 0;
function scheduleValueRefresh() {
  if (!pendingValueFrame) {
    pendingValueFrame = requestAnimationFrame(() => {
      pendingValueFrame = 0;
      if (!state) return;
      syncUrlHash();
      if (state.mode === 'table') renderTable();
      else if (state.mode === 'curve') drawCurve();
      else if (state.mode === 'compare') renderCompare();
      else if (state.mode === 'chart') draw();
      updateSummary();
    });
  }
}

function setValueWeight(value) {
  if (!state || !Number.isFinite(value) || value < VALUE_WEIGHT.min || value > VALUE_WEIGHT.max) return;
  state.valueWeight = Math.round(value * 10) / 10;
  syncValueControls();
  scheduleValueRefresh();
}

function setMinScore(value) {
  if (!state || !Number.isFinite(value)) return;
  state.minScore = Math.max(0, Math.min(state.maxFloor, Math.round(value)));
  syncControls();
  scheduleValueRefresh();
}

function setMaxCost(value) {
  if (!state || !Number.isFinite(value) || value < 0) return;
  state.maxCost = MAX_COST_PRESETS.includes(value) ? value : 0;
  syncControls();
  scheduleValueRefresh();
}

$('#valueWeight').addEventListener('input', () => setValueWeight(Number($('#valueWeight').value)));
$('#minScore').addEventListener('input', () => setMinScore(Number($('#minScore').value)));
$('#maxCostSelect').addEventListener('change', () => setMaxCost(Number($('#maxCostSelect').value)));

function commitValueWeight() {
  const value = $('#valueWeightValue').valueAsNumber;
  if (Number.isFinite(value)) {
    setValueWeight(Math.max(VALUE_WEIGHT.min, Math.min(VALUE_WEIGHT.max, value)));
  }
  if (state) syncValueControls();
}

$('#valueWeightValue').addEventListener('change', commitValueWeight);
$('#valueWeightValue').addEventListener('blur', commitValueWeight);
$('#valueWeightValue').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitValueWeight();
  }
});

function resetValuePreferences() {
  if (!state) return;
  state.valueWeight = VALUE_WEIGHT.default;
  state.minScore = MIN_SCORE.default;
  state.maxCost = 0;
  syncControls();
  scheduleValueRefresh();
}

$('#resetValueWeight').addEventListener('click', resetValuePreferences);
$('#resetValueInline').addEventListener('click', resetValuePreferences);

function refreshSubView() {
  if (!state) return;
  syncSubControls();
  syncUrlHash();
  if (state.mode === 'sub') renderSubTable();
  else if (state.mode === 'chart') draw();
  updateSummary();
}

function setSubFee(value) {
  if (!state || !Number.isFinite(value)) return;
  state.subFee = Math.max(MONTHLY_USAGE.minFee, Math.min(MONTHLY_USAGE.maxFee, Math.round(value)));
  refreshSubView();
}

function setMonthlyTasks(value) {
  if (!state || !Number.isFinite(value)) return;
  state.monthlyTasks = Math.max(MONTHLY_USAGE.minTasks, Math.min(MONTHLY_USAGE.maxTasks, Math.round(value)));
  refreshSubView();
}

$('#monthlyTasks').addEventListener('input', () => setMonthlyTasks(Number($('#monthlyTasks').value)));
$('#monthlyTasksValue').addEventListener('change', () => setMonthlyTasks($('#monthlyTasksValue').valueAsNumber));
$('#monthlyTasksValue').addEventListener('blur', () => {
  if (Number.isFinite($('#monthlyTasksValue').valueAsNumber)) setMonthlyTasks($('#monthlyTasksValue').valueAsNumber);
  else if (state) syncSubControls();
});
$('#monthlyTasksValue').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    setMonthlyTasks($('#monthlyTasksValue').valueAsNumber);
  }
});

$('#subFeeValue').addEventListener('change', () => setSubFee($('#subFeeValue').valueAsNumber));
$('#subFeeValue').addEventListener('blur', () => {
  if (Number.isFinite($('#subFeeValue').valueAsNumber)) setSubFee($('#subFeeValue').valueAsNumber);
  else if (state) syncSubControls();
});
$('#subFeeValue').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    setSubFee($('#subFeeValue').valueAsNumber);
  }
});

$('#resetSubInline').addEventListener('click', () => {
  if (!state) return;
  state.subFee = MONTHLY_USAGE.defaultFee;
  state.monthlyTasks = state.defaultTasks;
  refreshSubView();
});

for (const button of document.querySelectorAll('.sub-sort-button')) {
  button.addEventListener('click', () => {
    if (!state) return;
    const key = button.dataset.subSort;
    state.subSortDirection = state.subSortKey === key
      ? (state.subSortDirection === 'asc' ? 'desc' : 'asc')
      : (['intelligenceIndex', 'apiBill'].includes(key) ? 'desc' : 'asc');
    state.subSortKey = key;
    renderSubTable();
    $('#subPanel .table-scroll').scrollTop = 0;
  });
}

for (const button of document.querySelectorAll('.sort-button')) {
  button.addEventListener('click', () => {
    if (!state) return;
    const key = button.dataset.sort;
    state.sortDirection = state.sortKey === key
      ? (state.sortDirection === 'asc' ? 'desc' : 'asc')
      : (['intelligenceIndex', 'valuePerDollar'].includes(key) ? 'desc' : 'asc');
    state.sortKey = key;
    renderTable();
    $('.table-scroll').scrollTop = 0;
  });
}

// Pointer-anchored wheel zoom (X default, Shift -> Y, Ctrl/Meta -> XY)
host.addEventListener('wheel', event => {
  if (!state || !frame) return;
  event.preventDefault();
  const rect = host.getBoundingClientRect();
  const rx = (event.clientX - rect.left - frame.left) / frame.width;
  const ry = (frame.bottom - (event.clientY - rect.top)) / frame.height;
  const axis = event.ctrlKey || event.metaKey ? 'xy' : event.shiftKey ? 'y' : 'x';
  const factor = Math.exp(Math.max(-240, Math.min(240, event.deltaY)) * 0.0015);
  zoom(axis, factor, rx, ry);
}, {passive: false});

host.addEventListener('dblclick', event => {
  if (state && !event.target.closest('.pinned-card') && !nearestItem(event)) {
    changeView({...state.defaultView});
  }
});

host.addEventListener('click', event => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (!state || event.target.closest('.pinned-card')) return;
  const item = nearestItem(event);
  if (item) {
    host.focus({preventScroll: true});
    if (event.shiftKey) {
      toggleCompareId(item.row.id);
      const inCmp = state.compareIds.includes(item.row.id);
      $('#selection').textContent = inCmp
        ? t(`已加入剖析对比 (${state.compareIds.length}/${MAX_COMPARE})：${item.row.name}`, `Added to compare (${state.compareIds.length}/${MAX_COMPARE}): ${item.row.name}`)
        : t(`已从对比移除：${item.row.name}`, `Removed from compare: ${item.row.name}`);
      if (hovered === item) showHover(item, event);
    } else {
      togglePin(item);
    }
  }
});

// Unified single-pointer pan & two-finger pinch-zoom on chart
host.addEventListener('pointerdown', event => {
  if (!state || !frame || event.button > 0) return;
  if (event.target.closest('.pinned-card') || event.target.closest('.axis')) return;
  suppressClick = false;
  clearHover();
  host.focus({preventScroll: true});
  host.classList.remove('over-point');
  activePointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  try { host.setPointerCapture(event.pointerId); } catch {}

  if (activePointers.size === 1) {
    drag = {id: event.pointerId, startX: event.clientX, startY: event.clientY, view: {...state.view}, moved: false};
    pinch = null;
    host.classList.add('dragging');
  } else if (activePointers.size === 2) {
    const [p1, p2] = [...activePointers.values()];
    pinch = {
      dist: Math.max(20, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
      midX: (p1.x + p2.x) / 2,
      midY: (p1.y + p2.y) / 2,
      view: {...state.view}
    };
    drag = null;
    suppressClick = true;
  }
});

host.addEventListener('pointermove', event => {
  if (!activePointers.has(event.pointerId)) {
    const item = nearestItem(event);
    host.classList.toggle('over-point', !!item);
    if (item !== hovered) {
      if (item) showHover(item, event);
      else clearHover();
    } else if (item && !tip.hidden) {
      positionTip(event.clientX, event.clientY);
    }
    return;
  }

  activePointers.set(event.pointerId, {x: event.clientX, y: event.clientY});

  if (activePointers.size === 2 && pinch && frame) {
    const [p1, p2] = [...activePointers.values()];
    const nextDist = Math.max(20, Math.hypot(p2.x - p1.x, p2.y - p1.y));
    const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
    const scale = pinch.dist / nextDist;
    const rect = host.getBoundingClientRect();
    const rx = Math.max(0, Math.min(1, (pinch.midX - rect.left - frame.left) / frame.width));
    const ry = Math.max(0, Math.min(1, (frame.bottom - (pinch.midY - rect.top)) / frame.height));

    const zoomed = pointerZoomView(pinch.view, state.bounds, 'xy', scale, rx, ry);
    const dx = midX - pinch.midX, dy = midY - pinch.midY;
    changeView({
      ...zoomed,
      x: zoomed.x - dx / frame.width * zoomed.width,
      y: zoomed.y + dy / frame.height * zoomed.height
    });
    return;
  }

  if (drag && drag.id === event.pointerId && frame) {
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    drag.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
    if (!drag.moved) return;
    changeView({
      ...drag.view,
      x: drag.view.x - dx / frame.width * drag.view.width,
      y: drag.view.y + dy / frame.height * drag.view.height
    });
  }
});

function releasePointer(event) {
  if (drag?.moved) suppressClick = true;
  activePointers.delete(event.pointerId);
  try {
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
  } catch {}
  if (activePointers.size === 1 && state) {
    const [remainingId, pos] = [...activePointers.entries()][0];
    drag = {id: remainingId, startX: pos.x, startY: pos.y, view: {...state.view}, moved: true};
    pinch = null;
  } else if (activePointers.size === 0) {
    drag = null;
    pinch = null;
    host.classList.remove('dragging');
  }
}

function endPointerInteractions() {
  for (const id of activePointers.keys()) {
    try {
      if (host.hasPointerCapture(id)) host.releasePointerCapture(id);
    } catch {}
  }
  activePointers.clear();
  drag = null;
  pinch = null;
  host.classList.remove('dragging');
}

for (const evt of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  host.addEventListener(evt, releasePointer);
}

host.addEventListener('pointerleave', () => {
  host.classList.remove('over-point');
  if (!activePointers.size) clearHover();
});

host.addEventListener('keydown', event => {
  if (!state || event.target !== host) return;
  const v = {...state.view}, delta = 0.08;
  if (event.key === 'ArrowLeft') v.x -= v.width * delta;
  else if (event.key === 'ArrowRight') v.x += v.width * delta;
  else if (event.key === 'ArrowUp') v.y += v.height * delta;
  else if (event.key === 'ArrowDown') v.y -= v.height * delta;
  else if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    zoom(event.shiftKey ? 'y' : 'x', 1 / 1.2);
    return;
  } else if (event.key === '-') {
    event.preventDefault();
    zoom(event.shiftKey ? 'y' : 'x', 1.2);
    return;
  } else if (event.key === 'Home') {
    event.preventDefault();
    changeView({...state.defaultView});
    return;
  } else if (event.key === 'Escape') {
    clearPin();
    return;
  } else return;
  event.preventDefault();
  changeView(v);
});

// Close floating popovers on outside click or Escape
document.addEventListener('pointerdown', event => {
  if (changelogOpen && !event.target.closest('.update-wrap')) {
    setChangelogOpen(false);
  }
  if (comparePickerOpen && !event.target.closest('.compare-picker-wrap')) {
    setComparePickerOpen(false);
  }
  if (valueDetailsOpen && !event.target.closest('#valueMorePanel') && !event.target.closest('#valueMore')) {
    valueDetailsOpen = false;
    syncPanelControls();
  }
  if (mobileLayout.matches && controlsOpen && !event.target.closest('#controlPanel') && !event.target.closest('#controlsToggle')) {
    setControlsOpen(false);
  }
});

document.addEventListener('keydown', event => {
  const tag = event.target?.tagName;
  const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || event.target?.isContentEditable;
  if (!typing && event.altKey && !event.ctrlKey && !event.metaKey && ['1', '2', '3', '4', '5'].includes(event.key)) {
    const visibleTabs = [...document.querySelectorAll('[role=tab]')].filter(el => !el.hidden);
    const targetTab = visibleTabs[Number(event.key) - 1];
    if (targetTab && targetTab.dataset.chart !== activeKey) {
      event.preventDefault();
      chooseChart(targetTab.dataset.chart);
    }
    return;
  }
  if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (state && ['1', '2', '3', '4', '5'].includes(event.key)) {
      const modes = ['chart', 'table', 'curve', 'sub', 'compare'];
      const targetMode = modes[Number(event.key) - 1];
      if (targetMode && state.mode !== targetMode) {
        event.preventDefault();
        showView(targetMode);
      }
      return;
    }
    if (event.key === '/' && state && state.mode !== 'curve') {
      event.preventDefault();
      if (state.mode === 'compare') {
        setComparePickerOpen(true);
      } else {
        if (!controlsOpen) setControlsOpen(true);
        $('#search').focus();
        $('#search').select();
      }
      return;
    }
    if ((event.key === '[' || event.key === ']') && state && state.mode === 'chart') {
      const {list: frontier} = activeFrontierSet();
      if (frontier.length) {
        event.preventDefault();
        const curIdx = frontier.findIndex(r => r.id === state.selected);
        const nextIdx = curIdx === -1
          ? (event.key === ']' ? 0 : frontier.length - 1)
          : (curIdx + (event.key === ']' ? 1 : -1) + frontier.length) % frontier.length;
        locateRowInChart(frontier[nextIdx]);
      }
      return;
    }
  }
  if (event.key !== 'Escape') return;
  if (event.target === $('#search') && state?.search) {
    event.preventDefault();
    state.search = '';
    $('#search').value = '';
    syncControls();
    syncUrlHash();
    buildPlot();
    return;
  }
  if (event.target === $('#compareSearchInput') && $('#compareSearchInput').value) {
    event.preventDefault();
    $('#compareSearchInput').value = '';
    renderComparePicker();
    return;
  }
  if (changelogOpen) {
    setChangelogOpen(false);
    $('#updateBadge').focus({preventScroll: true});
  } else if (comparePickerOpen) {
    setComparePickerOpen(false);
    $('#compareAddBtn').focus({preventScroll: true});
  } else if (state?.mode === 'compare' && state.radarPinnedId) {
    state.radarPinnedId = null;
    tip.hidden = true;
    syncUrlHash();
    syncRadarSpotlight(null, null);
  } else if (state?.mode === 'compare' && radarInfoOpen) {
    radarInfoOpen = false;
    renderRadarInfo();
    $('#radarInfoBtn').focus({preventScroll: true});
  } else if (valueDetailsOpen) {
    valueDetailsOpen = false;
    syncPanelControls();
    $('#valueMore').focus({preventScroll: true});
  } else if (mobileLayout.matches && controlsOpen) {
    setControlsOpen(false);
    $('#controlsToggle').focus({preventScroll: true});
  } else if (state?.selected) {
    clearPin();
  }
});

addEventListener('resize', () => {
  if (changelogOpen) clampAnchoredPopover($('#changelogPopover'), $('#updateBadge'), 340);
  if (comparePickerOpen) clampAnchoredPopover($('#comparePickerPopover'), $('#compareAddBtn'), 360);
});

addEventListener('blur', () => {
  endPointerInteractions();
  clearHover();
});

new ResizeObserver(() => {
  clearHover();
  scheduleDraw();
}).observe(host);
new ResizeObserver(scheduleDraw).observe($('#curveHost'));

function showLoadError(error) {
  host.hidden = false;
  $('#dataTable').hidden = true;
  $('#subPanel').hidden = true;
  $('#comparePanel').hidden = true;
  $('#curvePanel').hidden = true;
  $('#valueSettings').hidden = true;
  $('#subSettings').hidden = true;
  $('#historySettings').hidden = true;
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === 'chart'));
  }
  $('#pinnedCard').hidden = true;
  $('#viewControls').hidden = false;
  $('#legend').replaceChildren();
  $('#count').replaceChildren();
  $('#viewStatus').textContent = '';
  $('#selection').textContent = '';
  host.setAttribute('aria-busy', 'false');
  $('#loading').hidden = false;
  const button = html('button', t('重新加载', 'Retry'));
  button.type = 'button';
  button.addEventListener('click', loadData);
  $('#loading').replaceChildren(
    document.createTextNode(t('基准数据暂时无法加载', 'Unable to load benchmark snapshot')),
    button
  );
  $('#status').textContent = error.message;
}

function hydrateDerivedModels(snap) {
  if (!snap || !Array.isArray(snap.models)) return snap;
  const baseById = new Map(snap.models.map(m => [m.id, m]));
  for (const key of ['frontierModels', 'humanArenaModels', 'cyberModels']) {
    if (!Array.isArray(snap[key])) continue;
    snap[key] = snap[key].map(item => {
      const base = baseById.get(item.id);
      return base ? {...base, ...item} : item;
    });
  }
  return snap;
}

function buildCrossTabLookup(snap) {
  const map = new Map();
  if (!snap) return map;
  for (const [tabKey, snapKey] of [
    ['models', 'models'],
    ['frontier', 'frontierModels'],
    ['human-arena', 'humanArenaModels'],
    ['cyber', 'cyberModels']
  ]) {
    const arr = Array.isArray(snap[snapKey]) ? validRows(snap[snapKey]) : [];
    const sorted = sortRows(arr, 'intelligenceIndex', 'desc');
    sorted.forEach((row, i) => {
      let rec = map.get(row.id);
      if (!rec) {
        rec = {};
        map.set(row.id, rec);
      }
      rec[tabKey] = {rank: i + 1, total: sorted.length, score: row.intelligenceIndex};
    });
  }
  return map;
}

async function loadData() {
  loadController?.abort();
  loadController = new AbortController();
  const generation = ++loadGeneration;
  const timeout = setTimeout(() => loadController.abort(), 20000);
  host.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('data/current.json', {cache: 'no-cache', signal: loadController.signal});
    if (!response.ok) throw new Error(t(`数据请求失败 (${response.status})`, `Request failed (${response.status})`));
    const next = hydrateDerivedModels(await response.json());
    if (generation !== loadGeneration) return;
    snapshot = next;
    crossTabIndex = buildCrossTabLookup(snapshot);
    states.clear();
    const hasFrontier = Array.isArray(snapshot.frontierModels) && snapshot.frontierModels.length > 0;
    const hasHumanArena = Array.isArray(snapshot.humanArenaModels) && snapshot.humanArenaModels.length > 0;
    const hasCyber = Array.isArray(snapshot.cyberModels) && snapshot.cyberModels.length > 0;
    $('#tab-frontier').hidden = !hasFrontier;
    $('#tab-human-arena').hidden = !hasHumanArena;
    $('#tab-cyber').hidden = !hasCyber;
    if (changelogOpen) renderChangelog();
    const parsed = parseHash();
    chooseChart(parsed.chart, {changeHash: false, routeParams: parsed.params});
  } catch (error) {
    if (generation === loadGeneration) {
      showLoadError(error.name === 'AbortError' ? new Error(t('请求超时，请重试', 'Request timed out')) : error);
    }
  } finally {
    clearTimeout(timeout);
  }
}

syncResponsiveChrome();
syncStaticText();
syncPanelControls();
chooseChart(activeKey, {changeHash: false});
loadData();
