import {
  ticks,
  paretoFrontier,
  dataBounds,
  clampView,
  pointerZoomView,
  validRows,
  sortRows,
  valuePerDollar,
  capabilityUtility,
  isoValueCost,
  VALUE_WEIGHT,
  MIN_SCORE,
  VALUE_PRESETS
} from './chart-math.mjs?v=20261118-1';

const $ = selector => document.querySelector(selector);
const svg = $('#svg'), host = $('#chart'), tip = $('#tip');
const NS = 'http://www.w3.org/2000/svg';

const BENCHMARKS = {
  models: {
    key: 'models',
    zhTitle: '模型智能指数与每任务成本',
    enTitle: 'Intelligence Index vs. Cost per Task',
    zhSub: 'Artificial Analysis Intelligence Index · 线性美元成本',
    enSub: 'Artificial Analysis Intelligence Index · Linear USD cost',
    zhAxis: '模型智能指数',
    enAxis: 'Intelligence Index',
    zhUnit: '个模型',
    enUnit: 'models',
    zhCostNote: '智能指数基准任务的加权平均 API 成本',
    enCostNote: 'Weighted average API cost per Intelligence Index task',
    source: 'https://artificialanalysis.ai/',
    defaultX: 4.5
  },
  'coding-agents': {
    key: 'codingAgents',
    zhTitle: '编程智能体指数与每任务成本',
    enTitle: 'Coding Agent Index vs. Cost per Task',
    zhSub: 'Artificial Analysis Coding Agents · 线性美元成本',
    enSub: 'Artificial Analysis Coding Agents · Linear USD cost',
    zhAxis: '编程智能体指数',
    enAxis: 'Coding Agent Index',
    zhUnit: '个智能体变体',
    enUnit: 'agent variants',
    zhCostNote: '编程基准任务的平均 API 成本（非订阅月费）',
    enCostNote: 'Average API cost per coding task, not subscription pricing',
    source: 'https://artificialanalysis.ai/agents/coding-agents',
    defaultX: 20
  }
};

const DEFAULT_SETTINGS = {
  models: {labels: true, smartLabels: true, labelSize: 9.5, labelDistance: 4},
  'coding-agents': {labels: true, smartLabels: true, labelSize: 10, labelDistance: 12}
};

let lang = document.documentElement.lang === 'en' ? 'en' : 'zh';
const t = (zh, en) => (lang === 'en' ? en : zh);

function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return {chart: 'models', params: new URLSearchParams()};
  const ampIndex = raw.indexOf('&');
  const chartPart = ampIndex === -1 ? raw : raw.slice(0, ampIndex);
  const queryPart = ampIndex === -1 ? '' : raw.slice(ampIndex + 1);
  const chart = chartPart === 'coding-agents' ? 'coding-agents' : 'models';
  return {chart, params: new URLSearchParams(queryPart)};
}

const initialRoute = parseHash();
let snapshot, activeKey = initialRoute.chart;
const states = new Map();
let state, nodes = [], frame, pendingFrame = 0, hovered = null, suppressClick = false;
let drag = null, pinch = null;
const activePointers = new Map();
let loadController, loadGeneration = 0;

const measure = document.createElement('canvas').getContext('2d');
const colorCache = new Map();
const mobileLayout = matchMedia('(max-width:760px), (max-height:500px)');
let controlsOpen = !mobileLayout.matches, controlsTouched = false, valueDetailsOpen = false, curveFrame;

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

function makeState(key, routeParams = null) {
  const rows = validRows(snapshot[BENCHMARKS[key].key]);
  const bounds = dataBounds(rows);
  const maxFloor = Math.min(MIN_SCORE.max, Math.max(20, Math.floor(Math.max(...rows.map(d => d.intelligenceIndex)))));
  const defaultView = {...bounds, width: BENCHMARKS[key].defaultX ? Math.min(bounds.width, BENCHMARKS[key].defaultX) : bounds.width};
  const next = {
    rows,
    bounds,
    maxFloor,
    defaultView,
    view: {...defaultView},
    company: null,
    search: '',
    frontierOnly: false,
    isoCurve: false,
    ...DEFAULT_SETTINGS[key],
    mode: 'chart',
    selected: null,
    sortKey: 'intelligenceIndex',
    sortDirection: 'desc',
    valueWeight: VALUE_WEIGHT.default,
    minScore: MIN_SCORE.default,
    curveProbe: 50,
    curveRealRange: true,
    curveLogY: false
  };
  if (routeParams) applyRouteParams(next, routeParams);
  return next;
}

function applyRouteParams(target, params) {
  const view = params.get('view');
  if (['chart', 'table', 'curve'].includes(view)) target.mode = view;
  const w = Number(params.get('w'));
  if (params.has('w') && Number.isFinite(w) && w >= VALUE_WEIGHT.min && w <= VALUE_WEIGHT.max) {
    target.valueWeight = Math.round(w * 10) / 10;
  }
  const min = Number(params.get('min'));
  if (params.has('min') && Number.isFinite(min) && min >= MIN_SCORE.min && min <= target.maxFloor) {
    target.minScore = Math.round(min);
  }
  const focus = params.get('focus');
  if (focus && target.rows.some(r => (r.creator?.name || 'Other') === focus)) target.company = focus;
  const q = params.get('q');
  if (q) target.search = q;
  if (params.get('pf') === '1') target.frontierOnly = true;
  if (params.get('iso') === '1') target.isoCurve = true;
}

function syncUrlHash() {
  if (!state) return;
  const params = new URLSearchParams();
  if (state.mode !== 'chart') params.set('view', state.mode);
  if (state.valueWeight !== VALUE_WEIGHT.default) params.set('w', state.valueWeight.toFixed(1));
  if (state.minScore > 0) params.set('min', String(state.minScore));
  if (state.company) params.set('focus', state.company);
  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.frontierOnly) params.set('pf', '1');
  if (state.isoCurve) params.set('iso', '1');
  const query = params.toString();
  const nextHash = activeKey === 'models' && !query ? '' : `#${activeKey}${query ? '&' + query : ''}`;
  const current = location.hash || '';
  if (current !== nextHash) {
    history.replaceState(null, '', nextHash || location.pathname + location.search);
  }
}

function filteredRows() {
  const query = state.search.trim().toLocaleLowerCase();
  let rows = state.rows.filter(row => !query || [row.name, row.shortName, row.creator?.name, row.agentName, row.modelName].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  if (state.frontierOnly) {
    const frontier = new Set(paretoFrontier(state.rows).map(row => row.id));
    rows = rows.filter(row => frontier.has(row.id));
  }
  return rows;
}

function computeRankings(rows = state.rows) {
  const ranked = sortRows(rows, 'valuePerDollar', 'desc', state.valueWeight, state.minScore);
  const rankMap = new Map();
  let qualifiedCount = 0, champion = null, championValue = null;
  for (const row of ranked) {
    const val = valuePerDollar(row, state.valueWeight, state.minScore);
    if (val !== null) {
      qualifiedCount++;
      rankMap.set(row.id, {rank: qualifiedCount, value: val});
      if (!champion) {
        champion = row;
        championValue = val;
      }
    }
  }
  return {rankMap, qualifiedCount, champion, championValue};
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
}

function syncStaticText() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  $('#appTitle').textContent = t('智能水平与任务成本', 'Intelligence vs. Cost');
  $('#appSubtitle').textContent = t('Intelligence vs. Cost · 线性成本基准', 'Linear-cost AI benchmark explorer');
  $('#tab-models').textContent = t('模型智能指数', 'Intelligence Index');
  $('#tab-coding-agents').textContent = t('编程智能体', 'Coding Agents');
  $('#updateText').textContent = t('每 2 小时检查', '2h check');
  $('#langToggle').textContent = lang === 'en' ? '中文' : 'EN';
  $('#langToggle').setAttribute('aria-label', lang === 'en' ? '切换为中文界面' : 'Switch interface to English');

  $('[data-i18n="scatterView"]').textContent = t('散点图', 'Scatter');
  $('[data-i18n="tableView"]').textContent = t('数据表', 'Table');
  $('[data-i18n="curveView"]').textContent = t('权重曲线', 'Utility Curve');

  $('#keyLinear').textContent = t('线性美元横轴', 'Linear USD axis');
  $('#keyQuadrant').textContent = t('优于中位参考区', 'Above-median score & below-median cost');
  $('#keyFrontier').textContent = t('帕累托前沿', 'Pareto frontier');
  $('#keyIso').textContent = t('最优等性价比切线', 'Best-value iso-curve');
  $('#keyBetter').textContent = t('越靠左上越理想', 'Upper-left is better');

  $('#reset').textContent = t('重置视图', 'Reset view');
  $('#fit').textContent = t('显示全部', 'Fit all');
  $('#xminus').setAttribute('aria-label', t('缩小横轴', 'Zoom X out'));
  $('#xplus').setAttribute('aria-label', t('放大横轴', 'Zoom X in'));
  $('#yminus').setAttribute('aria-label', t('缩小纵轴', 'Zoom Y out'));
  $('#yplus').setAttribute('aria-label', t('放大纵轴', 'Zoom Y in'));

  $('#searchSr').textContent = t('查找模型或厂商', 'Search models or creators');
  $('#search').placeholder = t('查找模型或厂商…', 'Search models or creators…');
  $('#clearFilters').textContent = t('清除筛选', 'Clear filters');

  $('#labelSizeText').textContent = t('字号', 'Size');
  $('#labelDistText').textContent = t('距离', 'Offset');

  $('#helpMouse').replaceChildren(
    document.createTextNode(t('滚轮以指针为中心缩放 X · ', 'Wheel zooms X at cursor · ')),
    html('kbd', 'Shift'),
    document.createTextNode(t('+滚轮缩放 Y · ', '+wheel Y · ')),
    html('kbd', 'Ctrl'),
    document.createTextNode(t('+滚轮双向缩放 · 拖动或双指缩放平移 · 单击锁定', '+wheel XY · Drag or pinch · Click to pin'))
  );
  $('#helpKeyboard').replaceChildren(
    document.createTextNode(t('键盘：', 'Keys: ')),
    html('kbd', '← ↑ ↓ →'),
    document.createTextNode(t(' 平移 · ', ' pan · ')),
    html('kbd', '+ −'),
    document.createTextNode(t(' 缩放 · ', ' zoom · ')),
    html('kbd', 'Home'),
    document.createTextNode(t(' 重置 · ', ' reset · ')),
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
  $('#resetValueInline').textContent = t('重置参数', 'Reset');

  $('#pinnedBadge').textContent = t('已锁定节点', 'Pinned');
  $('#unpin').textContent = t('取消 · Esc', 'Unpin · Esc');
  $('#pinScoreLabel').textContent = t('指数', 'Index');
  $('#pinCostLabel').textContent = t('单任务成本', 'Cost / task');
  $('#pinValueLabel').textContent = t('性价比', 'Value');
  $('#pinnedOutside').textContent = t('该节点当前在可视范围外', 'Point is outside current viewport');

  $('#thName').textContent = t('名称', 'Name');
  $('#thCreator').textContent = t('厂商', 'Creator');
  $('#thIndex').textContent = t('指数 (0–100)', 'Index (0–100)');
  $('#thCost').textContent = t('每任务成本 (USD)', 'Cost / task (USD)');
  $('#thValue').textContent = t('性价比', 'Value');

  $('#curveTitle').textContent = t('IRT 胜率混合能力效用曲线', 'IRT Pass-Odds Capability Utility Curve');
  $('#curveCurrentLabel').textContent = t('当前 α =', 'Current α =');
  $('#curveLinearLabel').textContent = t('线性参考 (α = 1)', 'Linear ref (α = 1)');
  $('#curveParetoLabel').textContent = t('帕累托前沿节点', 'Pareto frontier');
  $('#curveNote').textContent = t(
    '50 分锚点恒对应效用 50；曲线上的圆点为当前榜单帕累托前沿条目，外环高亮当前性价比榜首。',
    'Score 50 is anchored at utility 50; dots mark Pareto frontier entries, with the ring highlighting the #1 value leader.'
  );

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

function chooseChart(key, {changeHash = true, routeParams = null} = {}) {
  if (!BENCHMARKS[key]) return;
  endPointerInteractions();
  clearHover();
  activeKey = key;
  for (const tab of document.querySelectorAll('[role=tab]')) {
    const selected = tab.dataset.chart === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  $('#chart-panel').setAttribute('aria-labelledby', `tab-${key}`);
  $('#chartTitle').textContent = t(BENCHMARKS[key].zhTitle, BENCHMARKS[key].enTitle);
  $('#chartSubtitle').textContent = t(BENCHMARKS[key].zhSub, BENCHMARKS[key].enSub);
  if (!snapshot) return;
  try {
    if (!states.has(key)) states.set(key, makeState(key, routeParams));
    else if (routeParams) applyRouteParams(states.get(key), routeParams);
    state = states.get(key);
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
    const key = event.key === 'Home' ? 'models' : event.key === 'End' ? 'coding-agents' : activeKey === 'models' ? 'coding-agents' : 'models';
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
  for (const row of state.rows) {
    const name = row.creator?.name || 'Other';
    if (!companies.has(name)) companies.set(name, {name, color: row.creator?.color, count: 0});
    companies.get(name).count++;
  }
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
      scheduleDraw();
    });
    fragment.append(button);
  }
  $('#legend').replaceChildren(fragment);
}

function syncControls() {
  $('#search').value = state.search;
  $('#frontier').setAttribute('aria-pressed', String(state.frontierOnly));
  $('#frontier').textContent = state.frontierOnly ? t('仅看前沿 ✓', 'Frontier ✓') : t('仅看前沿', 'Frontier only');

  $('#isoToggle').hidden = state.mode !== 'chart';
  $('#isoToggle').setAttribute('aria-pressed', String(state.isoCurve));
  $('#isoToggle').textContent = state.isoCurve ? t('等值切线 ✓', 'Iso-value ✓') : t('等值切线', 'Iso-value');
  $('#keyIsoWrap').hidden = !state.isoCurve;

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

  $('#optionsPanel').hidden = state.mode !== 'chart';
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === state.mode));
  }
  $('#dataTable').hidden = state.mode !== 'table';
  host.hidden = state.mode !== 'chart';
  $('#curvePanel').hidden = state.mode !== 'curve';
  $('#valueSettings').hidden = state.mode === 'chart' && !state.isoCurve;
  $('#interactionHelp').hidden = state.mode !== 'chart';
  $('#viewControls').hidden = state.mode !== 'chart';
  $('#legend').hidden = state.mode === 'curve';
  $('#filterControls').hidden = state.mode === 'curve';
  $('#toolbar').hidden = state.mode === 'curve';
  $('#readingKey').hidden = state.mode !== 'chart';

  const topScore = state.bounds.y + state.bounds.height;
  $('#curveRangeToggle').setAttribute('aria-pressed', String(state.curveRealRange));
  $('#curveRangeToggle').textContent = state.curveRealRange
    ? t(`真实区间 0–${topScore}`, `Data range 0–${topScore}`)
    : t('全量程 0–100', 'Full 0–100');
  $('#curveScaleToggle').setAttribute('aria-pressed', String(state.curveLogY));
  $('#curveScaleToggle').textContent = state.curveLogY ? t('对数纵轴 ✓', 'Log Y ✓') : t('对数纵轴', 'Log Y');

  const hasFocus = !!(state.company || state.search || state.frontierOnly || state.minScore > 0);
  $('#clearFilters').hidden = false;
  $('#clearFilters').style.visibility = hasFocus ? 'visible' : 'hidden';
  $('#clearFilters').disabled = !hasFocus;
  syncPanelControls();
}

function syncPanelControls() {
  document.documentElement.dataset.mobile = String(mobileLayout.matches);
  document.documentElement.dataset.panelCollapsed = String(!controlsOpen);
  $('#controlPanel').hidden = !controlsOpen;
  const activeFilters = state && state.mode !== 'curve'
    ? Number(!!state.company) + Number(!!state.search) + Number(state.frontierOnly) + Number(state.minScore > 0)
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
  const weight = state.valueWeight, minScore = state.minScore;
  const linear = weight === 1, pureCost = weight === 0;
  const restored = weight === VALUE_WEIGHT.default && minScore === MIN_SCORE.default;

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

  for (const btn of document.querySelectorAll('#presetGroup button')) {
    btn.setAttribute('aria-pressed', String(Math.abs(Number(btn.dataset.preset) - weight) < 0.05));
  }

  $('#resetValueInline').hidden = restored;
  $('#resetValueWeight').disabled = restored;
  $('#resetValueWeight').textContent = restored
    ? t('已是默认设置', 'At defaults')
    : t('恢复默认 (α=3, 无门槛)', 'Reset (α=3, no min)');

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
    : t('当前最低门槛过高，暂无达标条目', 'No entries meet the current minimum score threshold');

  $('#valueHint').textContent = t(
    '说明：该曲线结合多步达标率幂次与 IRT 高分失误率压缩，反映主观质量偏好而非官方实测收益；仅限同一榜单、同一参数内横向比较。',
    'Combines pass-rate compounding with IRT error-headroom compression. Reflects user preference, not official utility; compare within one benchmark.'
  );

  $('#curveAlpha').textContent = weight.toFixed(1);
  $('#valueUnit').textContent = pureCost ? t('50/USD', '50/USD') : linear ? t('指数/USD', 'Index/USD') : t('加权/USD', 'Weighted/USD');
}

function renderStatus() {
  const cfg = BENCHMARKS[activeKey];
  const version = activeKey === 'models' ? snapshot.modelIndexVersion : snapshot.codingAgentIndexVersion;
  $('#count').textContent = `${state.rows.length} ${t(cfg.zhUnit, cfg.enUnit)}${version ? ' · v' + version : ''}`;

  const source = html('a', 'Artificial Analysis');
  source.href = cfg.source;
  source.target = '_blank';
  source.rel = 'noopener';

  const time = new Date(snapshot.updatedAt);
  const label = Number.isFinite(time.getTime())
    ? time.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {hour12: false})
    : t('未知', 'Unknown');

  $('#status').replaceChildren(
    document.createTextNode(t('数据来源：', 'Source: ')),
    source,
    document.createTextNode(t(` · 快照更新：${label}`, ` · Snapshot: ${label}`))
  );
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

function inView(row) {
  const xx = x(row.cost), yy = y(row.intelligenceIndex);
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
  const paretoPath = node('path', {class: 'pareto'});
  const isoPath = node('path', {class: 'iso-curve'});
  const connectors = node('g', {class: 'connector-layer'});
  const points = node('g', {class: 'points'});
  const labels = node('g', {class: 'label-layer'});

  const emphasis = node('g', {class: 'emphasis-layer', 'clip-path': 'url(#emphasis-clip)', 'aria-hidden': 'true', 'pointer-events': 'none'});
  emphasis.append(node('g', {class: 'glow-layer'}), node('g', {class: 'company-layer'}), node('g', {class: 'active-layer'}));

  plot.append(quadrant, quadrantBorder, floorRect, floorGuide, paretoPath, isoPath, connectors, points, labels);
  svg.replaceChildren(defs, node('g', {class: 'grid'}), plot, node('g', {class: 'axis'}), emphasis);

  const axisName = t(BENCHMARKS[activeKey].zhAxis, BENCHMARKS[activeKey].enAxis);
  nodes = rows.map(row => {
    const display = color(row.creator?.color);
    const p = node('circle', {
      class: 'point',
      'data-id': row.id,
      r: 4.4,
      fill: display,
      tabindex: 0,
      role: 'button',
      'aria-label': `${row.name}, ${axisName} ${format(row.intelligenceIndex, 2)}, ${money(row.cost)}`
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
  scheduleDraw();
}

function locateRowInChart(row) {
  state.selected = row.id;
  state.mode = 'chart';
  valueDetailsOpen = false;
  syncControls();
  const rect = host.getBoundingClientRect();
  if (rect.width > 40 && rect.height > 40) {
    const v = state.view;
    if (row.cost < v.x || row.cost > v.x + v.width || row.intelligenceIndex < v.y || row.intelligenceIndex > v.y + v.height) {
      const targetWidth = Math.max(v.width, Math.min(state.bounds.width, Math.max(row.cost * 1.45, BENCHMARKS[activeKey].defaultX)));
      const targetHeight = state.bounds.height;
      state.view = clampView({
        x: Math.max(0, row.cost - targetWidth * 0.55),
        y: state.bounds.y,
        width: targetWidth,
        height: targetHeight
      }, state.bounds);
    }
  }
  syncUrlHash();
  scheduleDraw();
}

function renderTable(rows = filteredRows()) {
  const fragment = document.createDocumentFragment();
  const scaleSource = state.frontierOnly || state.search.trim() || state.minScore > 0 ? rows : state.rows;
  const maxCost = Math.max(...(scaleSource.length ? scaleSource : state.rows).map(row => row.cost), 0.001);
  const comparableValues = (scaleSource.length ? scaleSource : state.rows)
    .map(row => valuePerDollar(row, state.valueWeight, state.minScore))
    .filter(value => value !== null);
  const maxValue = comparableValues.length ? Math.max(...comparableValues) : null;
  const valueRange = maxValue === null ? t('暂无', 'None') : `0–${valueLabel(maxValue)}`;

  $('#tableScale').textContent = t(
    `比较条比例（${scaleSource === state.rows ? '全榜统一' : '当前筛选范围'}）：指数 0–100 · 成本 $0–${format(maxCost)} · 性价比 ${valueRange}`,
    `Linear bar scale (${scaleSource === state.rows ? 'full benchmark' : 'filtered set'}): Index 0–100 · Cost $0–${format(maxCost)} · Value ${valueRange}`
  );

  const frontierIds = new Set(paretoFrontier(state.rows).map(row => row.id));
  const {champion} = computeRankings();

  for (const row of sortRows(rows, state.sortKey, state.sortDirection, state.valueWeight, state.minScore)) {
    const tr = html('tr');
    tr.dataset.id = row.id;
    const belowFloor = state.minScore > 0 && row.intelligenceIndex < state.minScore;
    tr.classList.toggle('is-muted', (!!state.company && row.creator?.name !== state.company) || belowFloor);
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
    if (frontierIds.has(row.id)) {
      wrap.append(html('span', t('前沿', 'Frontier'), 'row-tag'));
    }

    const locateBtn = html('button', t('图中定位', 'Locate'), 'locate-btn');
    locateBtn.type = 'button';
    locateBtn.addEventListener('click', event => {
      event.stopPropagation();
      locateRowInChart(row);
    });
    wrap.append(locateBtn);
    nameTd.append(wrap);

    const value = valuePerDollar(row, state.valueWeight, state.minScore);
    const displayVal = belowFloor ? t('未达门槛', '< Min') : valueLabel(value);
    const valueCell = comparisonCell(displayVal, value !== null && maxValue > 0 ? value / maxValue : 0, displayColor);
    valueCell.className = 'value-column';
    valueCell.title = belowFloor
      ? t(`低于最低门槛 ${state.minScore} 分`, `Below minimum score ${state.minScore}`)
      : value === null
        ? t('无有效性价比', 'No comparable value')
        : `${t('原始精度性价比', 'Exact weighted value')}: ${value.toPrecision(8)}`;
    if (value === null) valueCell.querySelector('.comparison-track').hidden = true;

    tr.append(
      nameTd,
      html('td', row.creator?.name || 'Other'),
      comparisonCell(format(row.intelligenceIndex, 2), row.intelligenceIndex / 100, displayColor),
      comparisonCell(money(row.cost), row.cost / maxCost, displayColor),
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
    td.colSpan = 5;
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
    node('text', {class: 'axis-title', x: (left + right) / 2, y: height - 8, 'text-anchor': 'middle'}, t(`${BENCHMARKS[activeKey].zhAxis} (0–${xMax})`, `${BENCHMARKS[activeKey].enAxis} (0–${xMax})`))
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
  const frontier = paretoFrontier(state.rows);
  const {champion} = computeRankings();
  for (const row of frontier) {
    if (row.intelligenceIndex > xMax) continue;
    if (state.company && row.creator?.name !== state.company) continue;
    const util = capabilityUtility(row.intelligenceIndex, state.valueWeight) ?? 0;
    const cx = xx(row.intelligenceIndex), cy = mapY(util);
    const isChamp = champion && champion.id === row.id;
    const dot = node('circle', {
      class: 'curve-pareto-dot',
      cx,
      cy,
      r: isChamp ? 5.8 : 3.8,
      fill: color(row.creator?.color)
    });
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

  setAttrs(svg.querySelector('#plot-clip rect'), {x: frame.left - 5, y: frame.top - 5, width: frame.width + 10, height: frame.height + 10});
  setAttrs(svg.querySelector('#emphasis-clip rect'), {x: frame.left - 14, y: Math.max(0, frame.top - 14), width: frame.width + 28, height: frame.height + 28});

  const medianX = median(state.rows.map(d => d.cost));
  const medianY = median(state.rows.map(d => d.intelligenceIndex));
  const qx = Math.max(frame.left, Math.min(frame.right, x(medianX)));
  const qy = Math.max(frame.top, Math.min(frame.bottom, y(medianY)));
  const qWidth = Math.max(0, qx - frame.left), qHeight = Math.max(0, qy - frame.top);
  setAttrs(svg.querySelector('.quadrant'), {x: frame.left, y: frame.top, width: qWidth, height: qHeight});
  svg.querySelector('.quadrant-border').setAttribute(
    'd',
    qWidth > 2 && qHeight > 2 ? `M${frame.left} ${qy}H${qx}V${frame.top}` : ''
  );

  // Minimum score floor overlay
  const floorRect = svg.querySelector('.floor-rect'), floorGuide = svg.querySelector('.floor-guide');
  if (state.minScore > 0) {
    const fy = Math.max(frame.top, Math.min(frame.bottom, y(state.minScore)));
    setAttrs(floorRect, {x: frame.left, y: fy, width: frame.width, height: Math.max(0, frame.bottom - fy)});
    setAttrs(floorGuide, {x1: frame.left, x2: frame.right, y1: fy, y2: fy});
    floorRect.style.display = floorGuide.style.display = '';
  } else {
    floorRect.style.display = floorGuide.style.display = 'none';
  }

  // Full-dataset Pareto frontier
  const frontier = paretoFrontier(state.rows);
  svg.querySelector('.pareto').setAttribute('d', frontier.map((row, i) => `${i ? 'L' : 'M'}${x(row.cost)},${y(row.intelligenceIndex)}`).join(' '));

  // Optional Iso-Value tangent contour passing through the #1 best-value entry
  const isoPath = svg.querySelector('.iso-curve');
  const {champion, championValue} = computeRankings();
  if (state.isoCurve && champion && championValue > 0) {
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

  for (const item of nodes) {
    const visible = inView(item.row);
    setAttrs(item.p, {cx: x(item.row.cost), cy: y(item.row.intelligenceIndex), tabindex: visible ? 0 : -1});
    item.p.style.visibility = visible ? 'visible' : 'hidden';
  }

  drawAxes(medianX, medianY);
  layoutLabels(champion?.id);
  drawActive(champion);
  updateSummary();

  host.dataset.chart = activeKey;
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

  for (const value of ticks(v.x, v.x + v.width, Math.max(3, Math.floor(frame.width / 105)))) {
    const xx = x(value);
    grid.append(node('line', {x1: xx, x2: xx, y1: frame.top, y2: frame.bottom}));
    axis.append(node('text', {class: 'x-tick', x: xx, y: frame.bottom + 17, 'text-anchor': 'middle'}, '$' + format(value, 6)));
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
    axis.append(node('text', {
      class: 'quadrant-note',
      x: qx - 5,
      y: frame.top + 13,
      'text-anchor': 'end'
    }, t(`中位 ${money(medianX)}`, `Median ${money(medianX)}`)));
  }

  axis.append(node('path', {class: 'frame', d: `M${frame.left},${frame.top}V${frame.bottom}H${frame.right}`}));
  axis.append(node('text', {
    class: 'axis-title x-title',
    x: (frame.left + frame.right) / 2,
    y: frame.bottom + 36,
    'text-anchor': 'middle'
  }, t('每任务成本（美元 · 线性刻度）', 'Cost per Task (USD · Linear Scale)')));

  const group = node('g', {transform: `translate(16 ${(frame.top + frame.bottom) / 2}) rotate(-90)`});
  group.append(node('text', {
    class: 'axis-title y-title',
    'text-anchor': 'middle',
    y: 0
  }, t(BENCHMARKS[activeKey].zhAxis, BENCHMARKS[activeKey].enAxis)));
  axis.append(group);
}

function overlapArea(a, b) {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function layoutLabels(championId) {
  const placed = [], visible = nodes.filter(item => inView(item.row));
  const frontier = new Set(paretoFrontier(state.rows).map(row => row.id));
  const baseDist = state.labelDistance;
  const radii = [3, baseDist * 0.55, baseDist * 0.85, Math.max(6, baseDist)].filter((v, i, arr) => v >= 2 && arr.indexOf(v) === i);
  measure.font = `500 ${state.labelSize}px "IBM Plex Sans", "Segoe UI", "Microsoft YaHei UI", sans-serif`;

  const priorityOf = item => {
    const id = item.row.id;
    if (id === state.selected || item === hovered) return 4;
    if (state.isoCurve && id === championId) return 3;
    if (state.company && item.row.creator?.name === state.company) return 2;
    if (frontier.has(id)) return 1;
    return 0;
  };

  const ordered = [...nodes].sort((a, b) => priorityOf(b) - priorityOf(a) || b.row.intelligenceIndex - a.row.intelligenceIndex);

  for (const item of ordered) {
    item.label.setAttribute('font-size', state.labelSize);
    if (!state.labels || !inView(item.row)) {
      item.label.style.visibility = item.line.style.visibility = 'hidden';
      continue;
    }

    const priority = priorityOf(item);
    const px = x(item.row.cost), py = y(item.row.intelligenceIndex);
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
          if (other !== item) pointCollision += overlapArea(candidate, {x: x(other.row.cost) - 4.5, y: y(other.row.intelligenceIndex) - 4.5, w: 9, h: 9});
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
  if (!layer || !companies || !glows || !frame) return;
  layer.replaceChildren();
  companies.replaceChildren();
  glows.replaceChildren();

  for (const item of nodes) {
    const selected = item.row.id === state.selected, active = selected || item === hovered;
    const focused = !!state.company && item.row.creator?.name === state.company && !state.selected;
    const belowFloor = state.minScore > 0 && item.row.intelligenceIndex < state.minScore;
    const emphasized = active || focused;
    const muted = !active && (belowFloor || (state.company && item.row.creator?.name !== state.company) || (state.selected && !selected));

    setAttrs(item.p, {
      r: active ? 6 : focused ? 5 : 4.4,
      opacity: emphasized ? 0 : muted ? 0.3 : 1,
      'aria-pressed': selected
    });
    item.p.classList.toggle('is-active', active);
    item.label.classList.toggle('is-active', active);
    item.line.classList.toggle('is-active', active);
    item.label.style.opacity = emphasized ? '0' : muted ? '0.52' : '1';
    item.line.style.opacity = emphasized ? '0' : muted ? '0.18' : '0.6';
    if (focused && !active && inView(item.row)) companies.append(emphasisCopy(item, 5, 'company'));
  }

  if (state.isoCurve && champion) {
    const champNode = nodes.find(item => item.row.id === champion.id);
    if (champNode && inView(champNode.row)) {
      layer.append(node('circle', {
        class: 'champion-ring',
        cx: x(champNode.row.cost),
        cy: y(champNode.row.intelligenceIndex),
        r: 9
      }));
    }
  }

  const selected = nodes.find(item => item.row.id === state.selected);
  if (selected && inView(selected.row)) {
    const xx = x(selected.row.cost), yy = y(selected.row.intelligenceIndex);
    layer.append(
      node('path', {class: 'pin-guides', d: `M${frame.left} ${yy}H${xx}V${frame.bottom}`, stroke: selected.color, fill: 'none'}),
      node('circle', {class: 'pin-ring', cx: xx, cy: yy, r: 10, stroke: selected.color, fill: 'none'}),
      emphasisCopy(selected, 6, 'pinned')
    );
  }
  if (hovered && hovered !== selected && inView(hovered.row)) {
    layer.append(
      node('circle', {cx: x(hovered.row.cost), cy: y(hovered.row.intelligenceIndex), r: 8, stroke: hovered.color, 'stroke-width': 1.5, fill: 'none'}),
      emphasisCopy(hovered, 6, 'hovered')
    );
  }
  renderPinned();
}

function emphasisCopy(item, radius, kind) {
  const group = node('g', {class: `emphasis-item emphasis-${kind}`, 'data-id': item.row.id});
  svg.querySelector('.glow-layer').append(node('circle', {
    class: `emphasis-glow glow-${kind}`,
    'data-id': item.row.id,
    cx: x(item.row.cost),
    cy: y(item.row.intelligenceIndex),
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
  group.append(node('circle', {class: 'emphasis-marker', cx: x(item.row.cost), cy: y(item.row.intelligenceIndex), r: radius, fill: item.color}));
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

  const frontierIds = new Set(paretoFrontier(state.rows).map(r => r.id));
  const {rankMap, qualifiedCount} = computeRankings();
  const rankInfo = rankMap.get(row.id);

  $('#pinnedName').textContent = row.name;
  const metaParts = [row.creator?.name || 'Other'];
  if (frontierIds.has(row.id)) metaParts.push(t('帕累托前沿', 'Pareto frontier'));
  if (rankInfo) metaParts.push(t(`性价比排名 #${rankInfo.rank}/${qualifiedCount}`, `Value rank #${rankInfo.rank}/${qualifiedCount}`));
  $('#pinnedMeta').textContent = metaParts.join(' · ');

  $('#pinnedScore').textContent = format(row.intelligenceIndex, 2);
  $('#pinnedCost').textContent = money(row.cost);
  $('#pinnedValue').textContent = rankInfo ? valueLabel(rankInfo.value) : t('未达门槛', 'Below min');
  $('#pinnedOutside').hidden = !frame || inView(row);

  if (frame) {
    card.style.left = 'auto';
    card.style.right = '10px';
    card.style.top = '10px';
    card.style.bottom = 'auto';
    card.style.width = '';
    if (frame.width >= 440) {
      card.style.width = Math.min(295, frame.width * 0.45) + 'px';
      if (x(row.cost) > frame.left + frame.width / 2) {
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
  const frontierIds = new Set(paretoFrontier(state.rows).map(r => r.id));
  const rankInfo = rankMap.get(row.id);

  tip.replaceChildren(html('strong', row.name));
  const subParts = [row.creator?.name || 'Other'];
  if (row.agentName && row.modelName) subParts.push(`${row.agentName} · ${row.modelName}`);
  if (frontierIds.has(row.id)) subParts.push(t('帕累托前沿', 'Pareto frontier'));
  if (row.isRouter) subParts.push(t('路由变体', 'Router'));
  tip.append(html('span', subParts.join(' · '), 'tip-sub'));

  const axisLabel = t(BENCHMARKS[activeKey].zhAxis, BENCHMARKS[activeKey].enAxis);
  const valText = rankInfo
    ? `${valueLabel(rankInfo.value)} (#${rankInfo.rank}/${qualifiedCount})`
    : t('未达最低门槛', 'Below min score');
  for (const [label, value] of [
    [axisLabel, format(row.intelligenceIndex, 2)],
    [t('每任务成本', 'Cost / task'), money(row.cost)],
    [t(`性价比 (α=${state.valueWeight.toFixed(1)})`, `Value (α=${state.valueWeight.toFixed(1)})`), valText]
  ]) {
    const line = html('div', null, 'tip-value');
    line.append(html('span', label), html('b', value));
    tip.append(line);
  }
  tip.append(html('span', t('单击锁定详情卡片', 'Click to pin details card'), 'tip-foot'));
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
    const distance = (x(item.row.cost) - px) ** 2 + (y(item.row.intelligenceIndex) - py) ** 2;
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
  draw();
}

function clearPin() {
  if (!state) return;
  state.selected = null;
  clearHover();
  if (state.mode === 'table') renderTable();
  scheduleDraw();
}

$('#unpin').addEventListener('click', clearPin);

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
  } else if (state.mode === 'table') {
    $('#viewStatus').textContent = t(
      `共 ${rows.length} 项 · α = ${state.valueWeight.toFixed(1)}${state.minScore > 0 ? ' · 门槛 ≥' + state.minScore : ''}`,
      `${rows.length} entries · α = ${state.valueWeight.toFixed(1)}${state.minScore > 0 ? ' · Min ≥' + state.minScore : ''}`
    );
  } else {
    $('#viewStatus').textContent = t(
      `当前视野 ${shown}/${rows.length} 项 · 成本区间 ${money(v.x)}–${money(v.x + v.width)}`,
      `Showing ${shown}/${rows.length} · Cost ${money(v.x)}–${money(v.x + v.width)}`
    );
  }

  if (state.mode !== 'curve') {
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
  $('#selection').textContent = selected && state.mode !== 'curve'
    ? t(`已锁定：${selected.name}`, `Pinned: ${selected.name}`)
    : '';
}

function changeView(view) {
  if (!state) return;
  clearHover();
  state.view = clampView(view, state.bounds);
  scheduleDraw();
}

function zoom(axis, factor, anchorX = 0.5, anchorY = 0.5) {
  if (!state) return;
  clearHover();
  state.view = pointerZoomView(state.view, state.bounds, axis, factor, anchorX, anchorY);
  scheduleDraw();
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

$('#frontier').addEventListener('click', () => {
  if (!state) return;
  state.frontierOnly = !state.frontierOnly;
  state.selected = null;
  syncControls();
  syncUrlHash();
  buildPlot();
});

$('#isoToggle').addEventListener('click', () => {
  if (!state) return;
  state.isoCurve = !state.isoCurve;
  syncControls();
  syncUrlHash();
  scheduleDraw();
});

$('#clearFilters').addEventListener('click', () => {
  if (!state) return;
  state.company = null;
  state.search = '';
  state.frontierOnly = false;
  state.minScore = 0;
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
  if (!state || !['chart', 'table', 'curve'].includes(mode)) return;
  endPointerInteractions();
  clearHover();
  state.mode = mode;
  valueDetailsOpen = false;
  syncControls();
  syncUrlHash();
  if (mode === 'table') renderTable();
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

$('#valueWeight').addEventListener('input', () => setValueWeight(Number($('#valueWeight').value)));
$('#minScore').addEventListener('input', () => setMinScore(Number($('#minScore').value)));

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
  syncControls();
  scheduleValueRefresh();
}

$('#resetValueWeight').addEventListener('click', resetValuePreferences);
$('#resetValueInline').addEventListener('click', resetValuePreferences);

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
    togglePin(item);
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
  if (valueDetailsOpen && !event.target.closest('#valueMorePanel') && !event.target.closest('#valueMore')) {
    valueDetailsOpen = false;
    syncPanelControls();
  }
  if (mobileLayout.matches && controlsOpen && !event.target.closest('#controlPanel') && !event.target.closest('#controlsToggle')) {
    setControlsOpen(false);
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (valueDetailsOpen) {
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
  $('#curvePanel').hidden = true;
  $('#valueSettings').hidden = true;
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

async function loadData() {
  loadController?.abort();
  loadController = new AbortController();
  const generation = ++loadGeneration;
  const timeout = setTimeout(() => loadController.abort(), 20000);
  host.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('data/current.json', {cache: 'no-cache', signal: loadController.signal});
    if (!response.ok) throw new Error(t(`数据请求失败 (${response.status})`, `Request failed (${response.status})`));
    const next = await response.json();
    if (generation !== loadGeneration) return;
    snapshot = next;
    states.clear();
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
