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
  zoomedAxisScale,
  zoomedRadarBounds,
  radarRadiusRatio,
  SCENARIO_PILLARS,
  SCENARIO_PRESETS,
  COST_PROFILES,
  computeScenarioScore,
  simulateWorkloadCost,
  VALUE_WEIGHT,
  MIN_SCORE,
  MAX_COST_PRESETS,
  VALUE_PRESETS,
  SUBSCRIPTION_TIERS,
  MONTHLY_USAGE,
  TASK_VOLUME_PRESETS
} from './chart-math.mjs?v=20261120-02';
import {
  RECOMMEND_USE_CASES,
  RECOMMEND_BUDGETS,
  RECOMMEND_LICENSES,
  recommendModels
} from './modules/recommend.mjs?v=20261120-02';
import {computeOrgDivergence} from './modules/divergence.mjs?v=20261120-02';
import {createNavHistory} from './modules/nav-history.mjs?v=20261120-02';
import {GUIDE_TAB_META, GUIDE_GLOSSARY} from './modules/guide-content.mjs?v=20261120-02';

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
    zhTitle: '人类体感、审美与真实交付与每任务成本',
    enTitle: 'Human Blind Preference, Aesthetic Taste & Deliverable Arena vs. Cost',
    zhSub: '融合 Arena.ai (LMArena) 去水份盲测人味 + Design Arena 网页/UI 视觉审美 + GDPval/Briefcase 44 职业真实交付盲评',
    enSub: 'Arena.ai (LMArena) style-controlled blind votes + Design Arena UI/web aesthetics + GDPval/Briefcase expert deliverables',
    zhAxis: '人类审美与体感指数',
    enAxis: 'Human & Aesthetic Index',
    zhUnit: '个真人盲测模型',
    enUnit: 'blind-tested models',
    zhCostNote: '横轴为统一单任务 API 成本；悬停与剖析对比可查看各竞技场原始 Elo 与对决胜率',
    enCostNote: 'Standardized API cost/task on X-axis; hover & Compare show raw Elo & win rates',
    source: 'https://arena.ai/leaderboard',
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
  },
  media: {
    key: 'mediaModels',
    zhTitle: '图像生成与编辑盲测与单张成本',
    enTitle: 'Image Generation & Editing Arena vs. Cost',
    zhSub: 'AA Image Arena 双盲投票校准分 · 文生图 / 指令修图 · 线性美元 $/张',
    enSub: 'AA Image Arena blind human Elo (0–100) · Text-to-Image & Editing · Linear $/img',
    zhAxis: '图像盲测综合分',
    enAxis: 'Image Arena Index',
    zhUnit: '个图像引擎',
    enUnit: 'image models',
    zhCostNote: '单张图像 API 均价（官方千张报价 ÷ 1000），仅限图像赛道内横向比较',
    enCostNote: 'Average API cost per image (per-1k rate ÷ 1000); compared within Image track only',
    source: 'https://artificialanalysis.ai/image',
    defaultX: 0.23,
    defaultTimeMin: 1
  },
  orgs: {
    key: 'models',
    isOrgs: true,
    zhTitle: '各测评机构独立原榜对照',
    enTitle: 'Independent Evaluation Organization Leaderboards',
    zhSub: '6 份权威榜单原序原分呈现 · 悬停或点击任意模型跨机构同步高亮排名',
    enSub: '6 un-blended official org leaderboards · Hover or click any model to spotlight ranks across orgs',
    zhAxis: '官方原榜分',
    enAxis: 'Official Score',
    zhUnit: '份独立机构原榜',
    enUnit: 'org boards',
    zhCostNote: '各机构原榜严格保留官方原始排名与计分口径，绝不混算改序',
    enCostNote: 'Each org leaderboard preserves its exact official ranking & scoring methodology without blending',
    source: 'https://livebench.ai/',
    defaultX: 4.5,
    defaultTimeMin: 25
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
  cyber: {labels: true, smartLabels: true, labelSize: 10, labelDistance: 8},
  media: {labels: true, smartLabels: true, labelSize: 9.5, labelDistance: 5},
  orgs: {labels: true, smartLabels: true, labelSize: 9.5, labelDistance: 4}
};

const MEDIA_TRACK_ORDER = ['image', 'video', 'tts'];

const MEDIA_TRACKS = {
  image: {
    id: 'image',
    zhBtn: '图像 $/张',
    enBtn: 'Image $/img',
    zhTitle: '图像生成与编辑盲测与单张成本',
    enTitle: 'Image Generation & Editing Arena vs. Cost',
    zhSub: 'AA Image Arena 双盲投票校准分 · 文生图 / 指令修图 · 线性美元 $/张',
    enSub: 'AA Image Arena blind human Elo (0–100) · Text-to-Image & Editing · Linear $/img',
    zhUnit: '个图像引擎',
    enUnit: 'image models',
    zhCostHdr: '每张图成本 (USD)',
    enCostHdr: 'Cost / Image (USD)',
    zhSubCostHdr: '单张图 API',
    enSubCostHdr: 'API / img',
    zhXTitle: '每张图像成本（美元 $/张 · 线性刻度）',
    enXTitle: 'Cost per Image (USD $/img · Linear Scale)',
    zhCostNote: '单张图像 API 均价（官方千张报价 ÷ 1000），仅限图像赛道内横向比较',
    enCostNote: 'Average API cost per image (per-1k rate ÷ 1000); compared within Image track only',
    zhTrackNote: '独立赛道 · 仅对比图像生成/修图引擎（$/张），不与视频或语音混排',
    enTrackNote: 'Isolated track · Image gen & editing only ($/img), never mixed with video or speech',
    zhSubUnit: '张',
    enSubUnit: 'imgs',
    zhPerUnit: '张',
    enPerUnit: 'img',
    zhSubDisclaimer: '按单张图像 API 均价折算月订阅（如 Midjourney / ChatGPT / 即梦等）回本出图量，仅限图像赛道内比较。',
    enSubDisclaimer: 'Compares per-image API cost against monthly creative subscriptions (e.g. Midjourney, ChatGPT) within the Image track.',
    zhAnatomyTitle: '单张图像生成美元成本 ($/张)',
    enAnatomyTitle: 'Unit Image Generation Cost ($/img)',
    zhMatrixCost: '单张图 API 成本',
    enMatrixCost: 'API Cost / Image',
    sourceName: 'AA Image Arena',
    sourceUrl: 'https://artificialanalysis.ai/image',
    defaultX: 0.23
  },
  video: {
    id: 'video',
    zhBtn: '视频 $/5秒',
    enBtn: 'Video $/5s',
    zhTitle: '视频生成与编辑盲测与单段成本',
    enTitle: 'Video Generation & Editing Arena vs. Cost',
    zhSub: 'AA Video Arena 双盲投票校准分 · 文生视频 / 图生视频 / 编辑 · 线性美元 $/5秒',
    enSub: 'AA Video Arena blind human Elo (0–100) · T2V / I2V / Editing · Linear $/5s clip',
    zhUnit: '个视频引擎',
    enUnit: 'video models',
    zhCostHdr: '每 5 秒视频成本 (USD)',
    enCostHdr: 'Cost / 5s Video (USD)',
    zhSubCostHdr: '单段 5 秒 API',
    enSubCostHdr: 'API / 5s',
    zhXTitle: '每 5 秒视频成本（美元 $/5秒 · 线性刻度）',
    enXTitle: 'Cost per 5s Video Clip (USD $/5s · Linear Scale)',
    zhCostNote: '每 5 秒短片 API 均价（官方每分钟报价 ÷ 12），仅限视频赛道内横向比较',
    enCostNote: 'Average API cost per 5s video clip (per-min rate ÷ 12); compared within Video track only',
    zhTrackNote: '独立赛道 · 仅对比视频生成/编辑引擎（$/5秒），不与图像或语音混排',
    enTrackNote: 'Isolated track · Video gen & editing only ($/5s clip), never mixed with image or speech',
    zhSubUnit: '段',
    enSubUnit: 'clips',
    zhPerUnit: '5秒',
    enPerUnit: '5s',
    zhSubDisclaimer: '按每 5 秒视频短片 API 均价折算月订阅（如可灵 Kling / Runway / Sora 等）回本生成段数，仅限视频赛道内比较。',
    enSubDisclaimer: 'Compares per-5s-clip API cost against monthly video plans (e.g. Kling, Runway, Sora) within the Video track.',
    zhAnatomyTitle: '每 5 秒视频生成美元成本 ($/5秒)',
    enAnatomyTitle: 'Unit Video Clip Cost ($/5s clip)',
    zhMatrixCost: '每 5 秒视频 API 成本',
    enMatrixCost: 'API Cost / 5s Clip',
    sourceName: 'AA Video Arena',
    sourceUrl: 'https://artificialanalysis.ai/video',
    defaultX: 1.9
  },
  tts: {
    id: 'tts',
    zhBtn: '语音 $/千字',
    enBtn: 'TTS $/1k ch',
    zhTitle: '语音合成 TTS 盲测与千字成本',
    enTitle: 'Speech TTS Blind Arena vs. Cost',
    zhSub: 'AA Speech Arena 盲听自然度校准分 · 含首包延迟与实测耗时 · 线性美元 $/千字',
    enSub: 'AA Speech Arena blind listening Elo (0–100) · TTFA latency & wall time · Linear $/1k chars',
    zhUnit: '个语音引擎',
    enUnit: 'TTS models',
    zhCostHdr: '每千字成本 (USD)',
    enCostHdr: 'Cost / 1k Chars (USD)',
    zhSubCostHdr: '每千字 API',
    enSubCostHdr: 'API / 1k ch',
    zhXTitle: '每千字语音成本（美元 $/千字 · 线性刻度）',
    enXTitle: 'Cost per 1k TTS Characters (USD $/1k ch · Linear Scale)',
    zhCostNote: '每千字符语音 API 均价（约 1 分钟播音，百万字符报价 ÷ 1000），仅限语音赛道内横向比较',
    enCostNote: 'Average API cost per 1k TTS chars (~1 min audio, per-1M rate ÷ 1000); TTS track only',
    zhTrackNote: '独立赛道 · 仅对比语音合成 TTS 引擎（$/千字 · 含实测耗时轴）',
    enTrackNote: 'Isolated track · Speech TTS only ($/1k chars · measured latency axis available)',
    zhSubUnit: '千字',
    enSubUnit: 'k-ch',
    zhPerUnit: '千字',
    enPerUnit: '1k ch',
    zhSubDisclaimer: '按每千字符（约 1 分钟播音）API 均价折算月订阅（如 ElevenLabs / Fish Audio 等）回本播音量，仅限语音赛道内比较。',
    enSubDisclaimer: 'Compares per-1k-char (~1 min audio) API cost against monthly TTS plans (e.g. ElevenLabs, Fish Audio) within the Speech track.',
    zhAnatomyTitle: '每千字语音合成美元成本 ($/千字)',
    enAnatomyTitle: 'Unit Speech Synthesis Cost ($/1k chars)',
    zhMatrixCost: '每千字语音 API 成本',
    enMatrixCost: 'API Cost / 1k Chars',
    sourceName: 'AA Speech TTS',
    sourceUrl: 'https://artificialanalysis.ai/text-to-speech',
    defaultX: 0.15
  }
};

function mediaTrackMeta(track = state?.mediaTrack) {
  return MEDIA_TRACKS[track] || MEDIA_TRACKS.image;
}

const MEDIA_Y_LENSES = {
  image: [
    {id: '', zh: '纵轴：图像盲测综合分', en: 'Y: Image Arena Overall', axisZh: '图像盲测综合分', axisEn: 'Image Arena Index', get: r => r._baseIndex},
    {id: 't2i', zh: '纵轴：文生图 (T2I)', en: 'Y: Text-to-Image (T2I)', axisZh: '文生图盲测胜率分', axisEn: 'Text-to-Image Arena Score', get: r => r.mediaScores?.t2i ?? null},
    {id: 'imgEdit', zh: '纵轴：图像编辑 (Edit)', en: 'Y: Image Editing', axisZh: '图像编辑盲测胜率分', axisEn: 'Image Editing Arena Score', get: r => r.mediaScores?.imgEdit ?? null}
  ],
  video: [
    {id: '', zh: '纵轴：视频盲测综合分', en: 'Y: Video Arena Overall', axisZh: '视频盲测综合分', axisEn: 'Video Arena Index', get: r => r._baseIndex},
    {id: 't2v', zh: '纵轴：文生视频 (T2V)', en: 'Y: Text-to-Video (T2V)', axisZh: '文生视频盲测胜率分', axisEn: 'Text-to-Video Arena Score', get: r => r.mediaScores?.t2v ?? null},
    {id: 'i2v', zh: '纵轴：图生视频 (I2V)', en: 'Y: Image-to-Video (I2V)', axisZh: '图生视频盲测胜率分', axisEn: 'Image-to-Video Arena Score', get: r => r.mediaScores?.i2v ?? null},
    {id: 'vidEdit', zh: '纵轴：视频编辑 (Edit)', en: 'Y: Video Editing', axisZh: '视频编辑盲测胜率分', axisEn: 'Video Editing Arena Score', get: r => r.mediaScores?.vidEdit ?? null}
  ],
  tts: [
    {id: '', zh: '纵轴：语音自然度盲测分', en: 'Y: Speech TTS Score', axisZh: 'TTS 语音自然度盲测分', axisEn: 'Speech TTS Arena Score', get: r => r._baseIndex}
  ]
};

const Y_LENSES = {
  models: [
    {id: '', zh: '纵轴：综合智能总分', en: 'Y: Overall Index', axisZh: '综合智能指数', axisEn: 'Intelligence Index', get: r => r._baseIndex},
    {id: 'livebench', zh: '纵轴：LiveBench 2.0 防污染总分', en: 'Y: LiveBench 2.0 Overall', axisZh: 'LiveBench 2.0 防污染加权分', axisEn: 'LiveBench 2.0 Overall Score', get: r => r.livebench?.overall ?? null},
    {id: 'mmmuPro', zh: '纵轴：视觉多模态 (MMMU-Pro)', en: 'Y: Vision MMMU-Pro', axisZh: 'MMMU-Pro 视觉推理 (%)', axisEn: 'MMMU-Pro Vision (%)', get: r => r.subscores?.mmmuPro ?? null},
    {id: 'mlcr', zh: '纵轴：百万长上下文 (MLCR)', en: 'Y: Million-Ctx MLCR', axisZh: 'MLCR 超长上下文 (%)', axisEn: 'MLCR Long-Context (%)', get: r => r.subscores?.mlcr ?? null},
    {id: 'omniscience', zh: '纵轴：全科闭卷准确率', en: 'Y: Omniscience Acc.', axisZh: '全科闭卷准确率 (%)', axisEn: 'Omniscience Accuracy (%)', get: r => r.subscores?.omniscience ?? null},
    {id: 'finance', zh: '纵轴：金融财务 (GDPval)', en: 'Y: Finance (GDPval)', axisZh: '金融财务专业分', axisEn: 'Finance & Accounting', get: r => r.domainScores?.finance ?? null},
    {id: 'legal', zh: '纵轴：法律合规 (GDPval)', en: 'Y: Legal (GDPval)', axisZh: '法律合规专业分', axisEn: 'Legal Domain', get: r => r.domainScores?.legal ?? null},
    {id: 'healthcare', zh: '纵轴：医疗健康 (GDPval)', en: 'Y: Healthcare (GDPval)', axisZh: '医疗健康专业分', axisEn: 'Healthcare Domain', get: r => r.domainScores?.healthcare ?? null},
    {id: 'engineering', zh: '纵轴：工程研发 (GDPval)', en: 'Y: Engineering (GDPval)', axisZh: '工程研发专业分', axisEn: 'Engineering Domain', get: r => r.domainScores?.engineering ?? null}
  ],
  frontier: [
    {id: '', zh: '纵轴：未饱和硬核总分', en: 'Y: Frontier Hard Index', axisZh: '未饱和前沿极限指数', axisEn: 'Frontier Hard Index', get: r => r._baseIndex},
    {id: 'livebench', zh: '纵轴：LiveBench 2.0 防污染总分', en: 'Y: LiveBench 2.0 Overall', axisZh: 'LiveBench 2.0 防污染加权分', axisEn: 'LiveBench 2.0 Overall Score', get: r => r.livebench?.overall ?? null},
    {id: 'lbLongAgentic', zh: '纵轴：LiveBench 长程智能体', en: 'Y: LiveBench Long Agentic', axisZh: 'LiveBench 2.0 长程智能体 (%)', axisEn: 'LiveBench 2.0 Long Agentic (%)', get: r => r.livebench?.longAgentic ?? null},
    {id: 'gdpPdf', zh: '纵轴：GDP-PDF 一次全过', en: 'Y: GDP-PDF All-Pass', axisZh: 'GDP-PDF 全过率 (%)', axisEn: 'GDP-PDF All-Pass (%)', get: r => r.frontierScores?.gdpPdf ?? null},
    {id: 'frontierCode', zh: '纵轴：FrontierCode 2.0', en: 'Y: FrontierCode 2.0', axisZh: 'FrontierCode 2.0 (%)', axisEn: 'FrontierCode 2.0 (%)', get: r => r.frontierScores?.frontierCode ?? null},
    {id: 'mlcr', zh: '纵轴：MLCR 百万长上下文', en: 'Y: MLCR Long-Context', axisZh: 'MLCR 百万长上下文 (%)', axisEn: 'MLCR Long-Context (%)', get: r => r.frontierScores?.mlcr ?? null},
    {id: 'itBenchSre', zh: '纵轴：IT-Bench SRE 故障排障', en: 'Y: IT-Bench SRE', axisZh: 'IT-Bench SRE (%)', axisEn: 'IT-Bench SRE (%)', get: r => r.frontierScores?.itBenchSre ?? null},
    {id: 'terminal4', zh: '纵轴：Terminal-Bench 4.0', en: 'Y: Terminal-Bench 4.0', axisZh: 'Terminal-Bench 4.0 (%)', axisEn: 'Terminal-Bench 4.0 (%)', get: r => r.frontierScores?.terminal4 ?? null},
    {id: 'critptAgent', zh: '纵轴：CritPt 深度研究', en: 'Y: CritPt Research', axisZh: 'CritPt 深度研究 (%)', axisEn: 'CritPt Agentic Hard (%)', get: r => r.frontierScores?.critptAgent ?? null},
    {id: 'hleDiamond', zh: '纵轴：HLE 人类终极考', en: 'Y: HLE Diamond', axisZh: 'HLE 人类终极考 (%)', axisEn: 'HLE Diamond (%)', get: r => r.frontierScores?.hleDiamond ?? null},
    {id: 'harveyLaw', zh: '纵轴：Harvey 顶尖律所', en: 'Y: Harvey BigLaw', axisZh: 'Harvey 律所实测 (%)', axisEn: 'Harvey BigLaw (%)', get: r => r.frontierScores?.harveyLaw ?? null}
  ],
  'human-arena': [
    {id: '', zh: '纵轴：人类与审美总分', en: 'Y: Human & Taste Index', axisZh: '人类审美与体感指数', axisEn: 'Human & Aesthetic Index', get: r => r._baseIndex},
    {id: 'chatVibe', zh: '纵轴：交流人味 (Arena.ai 去水份)', en: 'Y: Chat Vibe (Arena.ai)', axisZh: 'Arena.ai (LMArena) 交流人味校准分', axisEn: 'Arena.ai (LMArena) Chat Vibe Score', get: r => r.humanScores?.chatVibe ?? null},
    {id: 'antiSlop', zh: '纵轴：去 AI 套话自然度', en: 'Y: Anti-Slop Naturalness', axisZh: '去 AI 套话自然度 (%)', axisEn: 'Anti-Slop Score (%)', get: r => r.humanScores?.antiSlop ?? null},
    {id: 'pureVisual', zh: '纵轴：视觉审美五维总分', en: 'Y: Design Arena 5D', axisZh: 'Design Arena 五维审美分', axisEn: 'Design Arena 5D Aesthetic', get: r => r.humanScores?.pureVisual ?? null},
    {id: 'creativeCraft', zh: '纵轴：SVG 矢量与游戏创意', en: 'Y: SVG & GameDev Craft', axisZh: 'SVG与游戏交互创意分', axisEn: 'SVG & GameDev Craft Score', get: r => r.humanScores?.creativeCraft ?? null},
    {id: 'spatialMotion', zh: '纵轴：3D 造型与代码动效', en: 'Y: 3D & Code2Video', axisZh: '3D与代码动效盲测分', axisEn: '3D & Code2Video Score', get: r => r.humanScores?.spatialMotion ?? null},
    {id: 'deliverable', zh: '纵轴：专家办公交付 (GDPval)', en: 'Y: Expert Deliverables', axisZh: '44职业真实交付盲评分', axisEn: 'Expert Deliverable Score', get: r => r.humanScores?.deliverable ?? null},
    {id: 'webdev', zh: '纵轴：Web全栈体感 (Arena.ai WebDev)', en: 'Y: WebDev Arena (Arena.ai)', axisZh: 'Arena.ai WebDev 全栈体感分', axisEn: 'Arena.ai WebDev Score', get: r => r.humanScores?.webdev ?? null}
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

function lensesFor(target = state, key = activeKey) {
  if (key === 'media') return MEDIA_Y_LENSES[target?.mediaTrack || 'image'] || MEDIA_Y_LENSES.image;
  return Y_LENSES[key] || Y_LENSES.models;
}

function currentLensObj(target = state, key = activeKey) {
  const list = lensesFor(target, key);
  return list.find(l => l.id === (target?.yLens || '')) || list[0];
}

function currentAxisLabel(target = state, key = activeKey) {
  if (target?.scenarioId && target.scenarioId !== 'default' && !['coding-agents', 'media'].includes(key)) {
    const preset = SCENARIO_PRESETS.find(p => p.id === target.scenarioId);
    if (preset) return `${t('场景', 'Scenario')} · ${t(preset.zh, preset.en)}`;
    return t('自定义工作流场景得分', 'Custom Workload Score');
  }
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
  const params = new URLSearchParams(queryPart);
  const urlLang = params.get('lang');
  if (urlLang === 'en' || urlLang === 'zh') {
    lang = urlLang;
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  }
  let chart = ['frontier', 'human-arena', 'coding-agents', 'cyber', 'media', 'orgs'].includes(chartPart) ? chartPart : 'models';
  if (params.get('view') === 'orgs') {
    chart = 'orgs';
    params.delete('view');
  }
  return {chart, params};
}

const initialRoute = parseHash();
let snapshot, activeKey = initialRoute.chart;
let lastArenaMode = 'chart';
const states = new Map();
let crossTabIndex = new Map();
let orgBoards = [];
let orgRankIndex = new Map();
let orgFamilyIndex = new Map();
let orgCreatorColors = new Map();
let pendingUrlTimer = 0;
let orgFocus = 'all';
let orgDivFilter = 'all';
const pickerChoice = {useCase: 'general', budget: 'balanced', license: 'all'};
let orgBumpLimit = 12;
let orgChartCollapsed = false;
const orgExpandedCards = new Set();
let orgDetailSort = {boardId: null, colKey: null, dir: 'desc'};
let orgMatchedOnly = false;
let orgSpotlightKey = null;
let orgPinnedKey = null;
let viewToolsOpen = false;
let pinCollapsed = false;
let globalCatalog = [];
let lastModelCompareIds = null;
const starredKeys = new Set((() => {
  try {
    const raw = JSON.parse(localStorage.getItem('intelligence-cost-stars') || '[]');
    return Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : [];
  } catch { return []; }
})());
let state, nodes = [], frame, pendingFrame = 0, hovered = null, suppressClick = false;
let drag = null, pinch = null, lasso = null, lassoSelection = null, boxSelectMode = false;
const activePointers = new Map();
let loadController, loadGeneration = 0;

const measure = document.createElement('canvas').getContext('2d');
const colorCache = new Map();
const mobileLayout = matchMedia('(max-width:760px), (max-height:500px)');
const ONBOARDING_KEY = 'intelligence-cost-onboard-v1';
let onboardingDismissed = (() => {
  try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
})();
let controlsOpen = !mobileLayout.matches, controlsTouched = false, valueDetailsOpen = false, changelogOpen = false, scenarioOpen = false, radarInfoOpen = false, comparePickerOpen = false, cmdOpen = false, cmdIndex = 0, guideOpen = false, guideTab = 'current', selectionNotice = '', radarCtx = null, shareTimer = 0, copyMdTimer = 0, curveFrame;

function starKeyOf(row) {
  if (!row) return '';
  return row.mediaKind ? String(row.id) : String(row.slug || row.id);
}

function isStarred(row) {
  return starredKeys.has(starKeyOf(row));
}

function saveStars() {
  try { localStorage.setItem('intelligence-cost-stars', JSON.stringify([...starredKeys])); } catch {}
}

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
  if (sec < 60) return t(`${format(sec, 1)}\u00A0秒`, `${format(sec, 1)}s`);
  const mins = sec / 60;
  if (mins < 60) return t(`${format(mins, 1)}\u00A0分`, `${format(mins, 1)}m`);
  return t(`${format(mins / 60, 2)}\u00A0小时`, `${format(mins / 60, 2)}h`);
}

function xValOf(row, metric = state?.xMetric || 'cost') {
  if (metric === 'time') {
    return typeof row?.timeSec === 'number' && Number.isFinite(row.timeSec) && row.timeSec > 0
      ? row.timeSec / 60
      : null;
  }
  return row.cost;
}

const CREATOR_ZH_ALIASES = [
  [/alibaba|qwen/i, '阿里 阿里巴巴 通义 千问 万相 qwen wan'],
  [/bytedance|seed|dreamina/i, '字节 字节跳动 豆包 即梦 seedream seedance'],
  [/deepseek/i, '深度求索 deepseek'],
  [/kuaishou|kling/i, '快手 可灵 kling'],
  [/minimax|hailuo/i, '稀宇 海螺 minimax hailuo'],
  [/\bz\s*ai\b|zhipu|glm/i, '智谱 智谱清言 glm'],
  [/moonshot|kimi/i, '月之暗面 kimi'],
  [/tencent|hunyuan/i, '腾讯 混元 hunyuan'],
  [/stepfun|step/i, '阶跃 阶跃星辰 step'],
  [/baidu|ernie/i, '百度 文心 ernie'],
  [/google|deepmind|gemini/i, '谷歌 google gemini veo imagen'],
  [/openai/i, 'openai chatgpt gpt sora'],
  [/anthropic|claude/i, 'anthropic claude 克劳德'],
  [/\bxai\b|grok/i, '马斯克 xai grok'],
  [/meta|llama/i, 'meta 脸书 llama'],
  [/mistral/i, 'mistral 米斯特拉尔'],
  [/microsoft/i, '微软 microsoft mai'],
  [/black forest|flux/i, '黑森林 bfl flux'],
  [/elevenlabs|eleven/i, 'elevenlabs 11labs'],
  [/vidu|shengshu/i, '生数 vidu']
];

function rowSearchBlob(row) {
  if (!row) return '';
  if (row._searchBlob) return row._searchBlob;
  const raw = [row.name, row.shortName, row.creator?.name, row.slug, row.agentName, row.modelName, row.family?.name]
    .filter(Boolean)
    .join(' ');
  const extra = [];
  for (const [re, words] of CREATOR_ZH_ALIASES) {
    if (re.test(raw)) extra.push(words);
  }
  if (row.isOpenWeights) extra.push('open 开源 开放权重');
  if (row.mediaKind === 'image') extra.push('image t2i 文生图 图像 生图 修图');
  else if (row.mediaKind === 'video') extra.push('video t2v i2v 文生视频 图生视频 视频');
  else if (row.mediaKind === 'tts') extra.push('tts speech audio 语音 合成 配音');
  const blob = `${raw} ${extra.join(' ')}`.toLocaleLowerCase();
  try { Object.defineProperty(row, '_searchBlob', {value: blob, enumerable: false}); } catch {}
  return blob;
}

function defaultCompareIds(rows) {
  if (!rows.length) return [];
  const picks = [];
  const add = item => {
    if (item && !picks.includes(item.id) && picks.length < 4) picks.push(item.id);
  };
  const byScore = sortRows(rows, 'intelligenceIndex', 'desc');
  add(byScore[0]);
  if (byScore[1]) add(byScore[1]);
  add(sortRows(rows, 'valuePerDollar', 'desc', 5, 30)[0] || sortRows(rows, 'valuePerDollar', 'desc', 5)[0]);
  const topOpen = byScore.find(r => r.isOpenWeights);
  if (topOpen) add(topOpen);
  for (const f of [...paretoFrontier(rows)].reverse()) {
    if (picks.length >= Math.min(4, rows.length)) break;
    add(f);
  }
  for (const r of byScore) {
    if (picks.length >= Math.min(4, rows.length)) break;
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

function mediaDefaultSpan(target) {
  return mediaTrackMeta(target?.mediaTrack).defaultX;
}

function syncTargetBoundsAndViews(target) {
  const boundSource = target.rows;
  const costBounds = dataBounds(boundSource, r => r.cost);
  const timeRows = boundSource.filter(r => Number.isFinite(r.timeSec) && r.timeSec > 0);
  const timeBounds = dataBounds(timeRows.length ? timeRows : boundSource, r => (r.timeSec > 0 ? r.timeSec / 60 : 0));
  if (target.xMetric === 'time' && !timeRows.length) target.xMetric = 'cost';
  const cfg = BENCHMARKS[target.benchKey];
  const profileId = target.costProfile || 'benchmark';
  const costMultiplier = profileId === 'chat' ? 0.35 : profileId === 'longdoc' ? 1.8 : profileId === 'reasoning' ? 1.5 : 1;
  const defCostSpan = target.benchKey === 'media'
    ? mediaDefaultSpan(target)
    : cfg.defaultX
      ? cfg.defaultX * costMultiplier
      : costBounds.width;
  const defaultCostView = {...costBounds, width: Math.min(costBounds.width, defCostSpan)};
  const defaultTimeView = {...timeBounds, width: cfg.defaultTimeMin ? Math.min(timeBounds.width, cfg.defaultTimeMin) : timeBounds.width};
  target.boundsByMetric = {cost: costBounds, time: timeBounds};
  target.defaultViews = {cost: defaultCostView, time: defaultTimeView};
  target.views = {cost: {...defaultCostView}, time: {...defaultTimeView}};
  target.bounds = target.boundsByMetric[target.xMetric || 'cost'];
  target.defaultView = target.defaultViews[target.xMetric || 'cost'];
  target.view = {...target.views[target.xMetric || 'cost']};
}

function reprojectRows(target) {
  let sourceBase = target.baseRows;
  if (target.benchKey === 'media') {
    const avail = MEDIA_TRACK_ORDER.filter(mk => target.baseRows.some(r => r.mediaKind === mk));
    if (!avail.includes(target.mediaTrack)) target.mediaTrack = avail[0] || 'image';
    sourceBase = target.baseRows.filter(r => r.mediaKind === target.mediaTrack);
    if (!sourceBase.length) sourceBase = target.baseRows;
  }
  const list = lensesFor(target, target.benchKey);
  const lens = list.find(l => l.id === target.yLens) || list[0];
  target.yLens = lens.id;
  const useScenario = target.scenarioId && target.scenarioId !== 'default' && target.scenarioWeights && !['coding-agents', 'media'].includes(target.benchKey);
  const profileId = target.costProfile || 'benchmark';
  const projected = sourceBase
    .map(r => {
      const val = useScenario ? computeScenarioScore(r, target.scenarioWeights) : lens.get(r);
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return null;
      const simCost = simulateWorkloadCost(r, profileId);
      return {...r, intelligenceIndex: Number(val.toFixed(4)), cost: simCost};
    })
    .filter(Boolean);
  const rows = projected.length ? projected : sourceBase;
  const maxFloor = Math.min(MIN_SCORE.max, Math.max(15, Math.floor(Math.max(...rows.map(d => d.intelligenceIndex)))));
  target.rows = rows;
  target.releaseDates = [...new Set(rows.map(r => r.releaseDate).filter(Boolean))].sort();
  target.historyIndex = Math.min(target.historyIndex ?? Math.max(0, target.releaseDates.length - 1), Math.max(0, target.releaseDates.length - 1));
  syncTargetBoundsAndViews(target);
  target.maxFloor = maxFloor;
  if (target.minScore > maxFloor) target.minScore = 0;
  target._licCache = null;
  target._poolCache = null;
  target._frontierCache = null;
  target._rankCache = null;
}

function syncMediaTrackDerived(target) {
  const validIds = new Set(target.rows.map(r => r.id));
  const trackDefaultCmp = defaultCompareIds(target.rows);
  target.defaultCompareKey = trackDefaultCmp.join(',');
  const savedCmp = (target.mediaCompareByTrack?.[target.mediaTrack] || []).filter(id => validIds.has(id));
  target.compareIds = savedCmp.length ? savedCmp : [...trackDefaultCmp];
  if (target.radarPinnedId && !target.compareIds.includes(target.radarPinnedId)) target.radarPinnedId = null;
  if (!validIds.has(target.routerFastId)) {
    target.routerFastId = (sortRows(target.rows, 'valuePerDollar', 'desc', 2, 25)[0] || target.rows[0])?.id || null;
  }
  if (!validIds.has(target.routerStrongId)) {
    target.routerStrongId = (sortRows(target.rows, 'intelligenceIndex', 'desc')[0] || target.rows.at(-1))?.id || null;
  }
}

function setMediaTrack(nextTrack, {reRender = true, updateUrl = true} = {}) {
  if (!state || state.benchKey !== 'media') return;
  if (!MEDIA_TRACK_ORDER.includes(nextTrack) || !state.baseRows.some(r => r.mediaKind === nextTrack)) return;
  if (state.mediaTrack === nextTrack) return;
  stopHistoryPlay();
  if (state.mediaTrack && state.compareIds?.length) {
    state.mediaCompareByTrack[state.mediaTrack] = [...state.compareIds];
  }
  state.mediaTrack = nextTrack;
  state.yLens = '';
  state.extraFilter = '';
  state.company = null;
  state.selected = null;
  state.radarPinnedId = null;
  state.maxCost = 0;
  reprojectRows(state);
  state.historyIndex = Math.max(0, state.releaseDates.length - 1);
  syncMediaTrackDerived(state);
  if (reRender) {
    renderLegend();
    renderStatus();
    syncControls();
    if (updateUrl) syncUrlHash();
    buildPlot();
  }
}

function applyYLens(target, lensId = '') {
  target.yLens = lensId;
  if (lensId) {
    target.scenarioId = 'default';
    target.scenarioWeights = null;
  }
  reprojectRows(target);
}

function makeState(key, routeParams = null) {
  const baseRows = validRows(snapshot[BENCHMARKS[key].key]).map(r => ({...r, _baseIndex: r.intelligenceIndex, _baseCost: r.cost}));
  const defaultMediaTrack = key === 'media'
    ? (MEDIA_TRACK_ORDER.find(mk => baseRows.some(r => r.mediaKind === mk)) || 'image')
    : null;
  const initialRows = key === 'media' ? baseRows.filter(r => r.mediaKind === defaultMediaTrack) : baseRows;
  const defaultTasks = key === 'coding-agents' ? MONTHLY_USAGE.defaultAgentTasks : MONTHLY_USAGE.defaultModelTasks;
  const defaultCmp = defaultCompareIds(initialRows);
  const defaultFast = sortRows(initialRows, 'valuePerDollar', 'desc', 2, 25)[0] || initialRows[0];
  const defaultStrong = sortRows(initialRows, 'intelligenceIndex', 'desc')[0] || initialRows.at(-1);
  const next = {
    benchKey: key,
    mediaTrack: defaultMediaTrack,
    mediaCompareByTrack: {},
    baseRows,
    rows: initialRows,
    releaseDates: [],
    xMetric: 'cost',
    yLens: '',
    scenarioId: 'default',
    scenarioWeights: null,
    costProfile: 'benchmark',
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
    starredOnly: false,
    frontierOnly: false,
    effortCurves: false,
    historyMode: false,
    historyIndex: 0,
    isoCurve: false,
    subLine: false,
    ...DEFAULT_SETTINGS[key],
    mode: key === 'orgs' ? 'orgs' : 'chart',
    compareVis: 'radar',
    radarScale: 'zoom',
    stripScale: 'zoom',
    deltaBase: 'mean',
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

function resolveMediaTrackFromParams(target, params) {
  const avail = MEDIA_TRACK_ORDER.filter(mk => target.baseRows.some(r => r.mediaKind === mk));
  const rawTrack = params.get('track');
  if (rawTrack && avail.includes(rawTrack)) return rawTrack;
  const rawXf = params.get('xf') || '';
  if (rawXf.startsWith('media:')) {
    const legacy = rawXf.slice(6);
    if (avail.includes(legacy)) return legacy;
  }
  const rawYl = params.get('ylens') || '';
  if (['t2i', 'imgEdit'].includes(rawYl) && avail.includes('image')) return 'image';
  if (['t2v', 'i2v', 'vidEdit'].includes(rawYl) && avail.includes('video')) return 'video';
  if (rawYl === 'tts' && avail.includes('tts')) return 'tts';
  const rawPin = params.get('pin');
  if (rawPin) {
    const hit = target.baseRows.find(r => r.id === rawPin);
    if (hit?.mediaKind && avail.includes(hit.mediaKind)) return hit.mediaKind;
  }
  const rawCmp = params.get('cmp');
  if (rawCmp) {
    for (const id of rawCmp.split(',')) {
      const hit = target.baseRows.find(r => r.id === id);
      if (hit?.mediaKind && avail.includes(hit.mediaKind)) return hit.mediaKind;
    }
  }
  return avail[0] || 'image';
}

function applyRouteParams(target, params) {
  const view = params.get('view');
  if (target.benchKey === 'orgs') {
    target.mode = 'orgs';
  } else if (['chart', 'table', 'curve', 'sub', 'compare'].includes(view)) {
    target.mode = view;
  }
  const org = params.get('org');
  if (['all', 'bump', 'divergence', 'aa', 'livebench', 'arenaChat', 'arenaWebdev', 'designArena', 'aaGdpval'].includes(org)) orgFocus = org;
  if (params.get('orgm') === '1') orgMatchedOnly = true;
  const bl = Number(params.get('bl'));
  if (bl === 12 || bl === 18) orgBumpLimit = bl;
  let needsReproject = false;
  let trackChanged = false;
  if (target.benchKey === 'media') {
    const nextTrack = resolveMediaTrackFromParams(target, params);
    if (nextTrack && nextTrack !== target.mediaTrack) {
      target.mediaTrack = nextTrack;
      target.yLens = '';
      target.extraFilter = '';
      target.company = null;
      needsReproject = true;
      trackChanged = true;
    }
  }
  const rawYl = params.get('ylens') || '';
  const yl = target.benchKey === 'media' && rawYl === 'tts' ? '' : rawYl;
  const scen = params.get('scen') || '';
  const cprof = params.get('cprof') || '';
  if (COST_PROFILES.some(c => c.id === cprof) && cprof !== target.costProfile) {
    target.costProfile = cprof;
    needsReproject = true;
  }
  if (scen && SCENARIO_PRESETS.some(p => p.id === scen && p.id !== 'default')) {
    const p = SCENARIO_PRESETS.find(x => x.id === scen);
    target.scenarioId = p.id;
    target.scenarioWeights = {...p.weights};
    target.yLens = '';
    needsReproject = true;
  } else if (params.has('sw')) {
    const parts = params.get('sw').split(',').map(Number);
    if (parts.length === SCENARIO_PILLARS.length && parts.every(n => Number.isFinite(n) && n >= 0 && n <= 5) && parts.some(n => n > 0)) {
      target.scenarioId = 'custom';
      target.scenarioWeights = Object.fromEntries(SCENARIO_PILLARS.map((p, i) => [p.key, parts[i]]));
      target.yLens = '';
      needsReproject = true;
    }
  } else if (yl !== target.yLens) {
    target.yLens = yl;
    target.scenarioId = 'default';
    target.scenarioWeights = null;
    needsReproject = true;
  }
  if (needsReproject) reprojectRows(target);
  if (trackChanged) {
    target.historyIndex = Math.max(0, target.releaseDates.length - 1);
    syncMediaTrackDerived(target);
  }
  if (params.get('star') === '1') target.starredOnly = true;
  if (params.get('x') === 'time' && target.rows.some(r => Number.isFinite(r.timeSec) && r.timeSec > 0)) {
    syncMetricViewport(target, 'time');
  }
  const lic = params.get('lic');
  if (['all', 'open', 'closed'].includes(lic)) target.license = lic;
  const xf = params.get('xf');
  if (xf && !(target.benchKey === 'media' && xf.startsWith('media:'))) {
    target.extraFilter = xf;
  }
  if (params.get('radar') === 'domain') target.radarMode = 'domain';
  else if (params.get('radar') === 'livebench') target.radarMode = 'livebench';
  const cvis = params.get('cvis');
  if (['radar', 'strip', 'delta'].includes(cvis)) target.compareVis = cvis;
  const cscale = params.get('cscale');
  if (['zoom', 'axis', 'full'].includes(cscale)) target.radarScale = cscale;
  if (params.get('sscale') === 'full') target.stripScale = 'full';
  const dbase = params.get('dbase');
  if (dbase) target.deltaBase = dbase;
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
  if (params.get('rt') === '1') target.routerOpen = true;
  const rf = params.get('rf');
  if (rf && validIds.has(rf)) target.routerFastId = rf;
  const rs = params.get('rs');
  if (rs && validIds.has(rs)) target.routerStrongId = rs;
  const rsh = Number(params.get('rsh'));
  if (params.has('rsh') && Number.isFinite(rsh) && rsh >= 50 && rsh <= 95) target.routerShare = Math.round(rsh / 5) * 5;
  if (params.get('fit') === '1' && target.bounds) {
    target.view = {...target.bounds};
    target.views[target.xMetric] = {...target.view};
  } else if (params.has('vp') && target.bounds) {
    const vp = params.get('vp').split(',').map(Number);
    if (vp.length === 4 && vp.every(Number.isFinite) && vp[2] > 0 && vp[3] > 0) {
      target.view = clampView({x: vp[0], y: vp[1], width: vp[2], height: vp[3]}, target.bounds);
      target.views[target.xMetric] = {...target.view};
    }
  }
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

function buildUrlHash({includeLang = false} = {}) {
  if (!state) return location.hash || '';
  const params = new URLSearchParams();
  if (includeLang && lang === 'en') params.set('lang', 'en');
  if (activeKey === 'media' && state.mediaTrack && state.mediaTrack !== 'image') params.set('track', state.mediaTrack);
  if (activeKey !== 'orgs' && state.mode !== 'chart') params.set('view', state.mode);
  if (state.scenarioId && state.scenarioId !== 'default') {
    if (state.scenarioId === 'custom' && state.scenarioWeights) {
      params.set('sw', SCENARIO_PILLARS.map(p => state.scenarioWeights[p.key] ?? 0).join(','));
    } else {
      params.set('scen', state.scenarioId);
    }
  } else if (state.yLens) {
    params.set('ylens', state.yLens);
  }
  if (state.costProfile && state.costProfile !== 'benchmark') params.set('cprof', state.costProfile);
  if (state.starredOnly) params.set('star', '1');
  if (state.xMetric === 'time') params.set('x', 'time');
  if (state.license !== 'all') params.set('lic', state.license);
  if (state.extraFilter) params.set('xf', state.extraFilter);
  if (state.mode === 'orgs') {
    if (orgFocus && orgFocus !== 'all') params.set('org', orgFocus);
    if (orgMatchedOnly) params.set('orgm', '1');
    if (orgFocus === 'bump' && orgBumpLimit !== 12) params.set('bl', String(orgBumpLimit));
  }
  if (state.mode === 'chart' && state.view && state.defaultView && state.bounds) {
    const v = state.view, dv = state.defaultView, bd = state.bounds;
    const isDef = Math.abs(v.x - dv.x) <= Math.max(1e-5, dv.width * 0.015)
      && Math.abs(v.width - dv.width) <= Math.max(1e-5, dv.width * 0.015)
      && Math.abs(v.y - dv.y) <= Math.max(0.1, dv.height * 0.015)
      && Math.abs(v.height - dv.height) <= Math.max(0.1, dv.height * 0.015);
    if (!isDef) {
      const isFit = Math.abs(v.x - bd.x) <= Math.max(1e-5, bd.width * 0.01)
        && Math.abs(v.width - bd.width) <= Math.max(1e-5, bd.width * 0.01)
        && Math.abs(v.y - bd.y) <= Math.max(0.1, bd.height * 0.01)
        && Math.abs(v.height - bd.height) <= Math.max(0.1, bd.height * 0.01);
      if (isFit) {
        params.set('fit', '1');
      } else {
        const fmtN = n => Number(n.toPrecision(5));
        params.set('vp', [fmtN(v.x), fmtN(v.y), fmtN(v.width), fmtN(v.height)].join(','));
      }
    }
  }
  if (state.mode === 'sub' && state.routerOpen) {
    params.set('rt', '1');
    if (state.routerFastId) params.set('rf', state.routerFastId);
    if (state.routerStrongId) params.set('rs', state.routerStrongId);
    if (state.routerShare !== 80) params.set('rsh', String(state.routerShare));
  }
  if (state.mode === 'compare') {
    if (state.radarMode === 'domain' || state.radarMode === 'livebench') params.set('radar', state.radarMode);
    if (state.compareVis !== 'radar') params.set('cvis', state.compareVis);
    if (state.compareVis === 'radar' && state.radarScale !== 'zoom') params.set('cscale', state.radarScale);
    if (state.compareVis === 'strip' && state.stripScale !== 'zoom') params.set('sscale', state.stripScale);
    if (state.compareVis === 'delta' && state.deltaBase !== 'mean') params.set('dbase', state.deltaBase);
  }
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
  if (state.selected && state.mode !== 'curve' && state.mode !== 'compare' && state.mode !== 'orgs') {
    params.set('pin', state.selected);
  }
  if (state.mode === 'compare' && state.radarPinnedId) {
    params.set('rpin', state.radarPinnedId);
  }
  if (state.compareIds.join(',') !== state.defaultCompareKey) {
    params.set('cmp', state.compareIds.join(','));
  }
  const query = params.toString();
  return activeKey === 'models' && !query ? '' : `#${activeKey}${query ? '&' + query : ''}`;
}

function syncUrlHash({includeLang = false} = {}) {
  if (!state || navHistory.isSuppressingUrl()) return;
  const nextHash = buildUrlHash({includeLang});
  const current = location.hash || '';
  if (current !== nextHash) {
    history.replaceState(history.state, '', nextHash || location.pathname + location.search);
  }
}

function captureNavSnapshot() {
  if (!state) return null;
  return {
    key: activeKey,
    mode: state.mode,
    mediaTrack: activeKey === 'media' ? (state.mediaTrack || 'image') : null,
    xMetric: state.xMetric || 'cost',
    yLens: state.yLens || '',
    scenarioId: state.scenarioId || 'default',
    scenarioWeights: state.scenarioWeights ? {...state.scenarioWeights} : null,
    costProfile: state.costProfile || 'benchmark',
    license: state.license || 'all',
    extraFilter: state.extraFilter || '',
    company: state.company || null,
    search: state.search || '',
    starredOnly: !!state.starredOnly,
    frontierOnly: !!state.frontierOnly,
    effortCurves: !!state.effortCurves,
    isoCurve: !!state.isoCurve,
    subLine: !!state.subLine,
    historyMode: !!state.historyMode,
    historyIndex: state.historyIndex,
    routerOpen: !!state.routerOpen,
    selected: state.selected || null,
    sortKey: state.sortKey || 'intelligenceIndex',
    sortDirection: state.sortDirection || 'desc',
    orgFocus,
    orgDivFilter,
    orgPinnedKey,
    orgMatchedOnly,
    orgDetailSort: {...orgDetailSort},
    compareIds: Array.isArray(state.compareIds) ? [...state.compareIds] : null,
    view: state.view ? {...state.view} : null
  };
}

function navSignature(snap) {
  if (!snap) return '';
  return JSON.stringify([
    snap.key,
    snap.mode,
    snap.mediaTrack,
    snap.xMetric,
    snap.yLens,
    snap.scenarioId,
    snap.scenarioWeights,
    snap.costProfile,
    snap.license,
    snap.extraFilter,
    snap.company,
    snap.starredOnly,
    snap.frontierOnly,
    snap.effortCurves,
    snap.isoCurve,
    snap.subLine,
    snap.historyMode,
    snap.routerOpen,
    snap.selected,
    snap.orgFocus,
    snap.orgPinnedKey,
    snap.orgMatchedOnly
  ]);
}

function navSnapshotLabel(snap) {
  if (!snap) return '';
  const tabNames = {
    models: ['综合智能', 'Intelligence'],
    frontier: ['前沿极限', 'Frontier Hard'],
    'human-arena': ['人类与审美', 'Human & Taste'],
    'coding-agents': ['编程智能体', 'Coding Agents'],
    cyber: ['网络安全', 'Cyber'],
    media: ['多模态', 'Media'],
    orgs: ['机构分榜', 'Org Ranks']
  };
  const [tabZh, tabEn] = tabNames[snap.key] || tabNames.models;
  const parts = [t(tabZh, tabEn)];
  if (snap.key === 'orgs') {
    if (snap.orgFocus === 'bump') parts.push(t('跨机构轨迹图', 'Bump Chart'));
    else if (snap.orgFocus === 'divergence') parts.push(t('争议分歧榜', 'Divergence'));
    else if (snap.orgFocus && snap.orgFocus !== 'all') {
      const b = orgBoards.find(x => x.id === snap.orgFocus);
      if (b) parts.push(t(b.pillZh, b.pillEn));
    } else {
      parts.push(t('6 机构并排', 'Side-by-Side'));
    }
    return parts.join(' · ');
  }
  if (snap.key === 'media' && snap.mediaTrack) {
    const m = MEDIA_TRACKS[snap.mediaTrack];
    if (m) parts.push(t(m.zhBtn, m.enBtn));
  }
  const viewNames = {
    table: ['数据表', 'Table'],
    curve: ['权重曲线', 'Curve'],
    sub: ['订阅回本', 'Sub vs API'],
    compare: ['剖析对比', 'Compare']
  };
  if (snap.mode && viewNames[snap.mode]) {
    parts.push(t(viewNames[snap.mode][0], viewNames[snap.mode][1]));
  } else if (snap.scenarioId && snap.scenarioId !== 'default') {
    const p = SCENARIO_PRESETS.find(x => x.id === snap.scenarioId);
    parts.push(p ? t(p.zh, p.en) : t('自定义场景', 'Custom Scenario'));
  } else if (snap.yLens) {
    const lensList = snap.key === 'media'
      ? (MEDIA_Y_LENSES[snap.mediaTrack || 'image'] || [])
      : (Y_LENSES[snap.key] || []);
    const l = lensList.find(x => x.id === snap.yLens);
    if (l) parts.push(t(l.axisZh, l.axisEn));
  } else if (snap.effortCurves) {
    parts.push(t('推理轨迹', 'Effort Paths'));
  } else if (snap.historyMode) {
    parts.push(t('历史演进', 'History'));
  } else if (snap.xMetric === 'time') {
    parts.push(t('耗时轴', 'Time Axis'));
  } else if (snap.selected) {
    const arr = snapshot?.[BENCHMARKS[snap.key]?.key] || [];
    const hit = arr.find(r => r.id === snap.selected);
    if (hit) parts.push(hit.shortName || hit.name);
  }
  return parts.join(' · ');
}

function renderNavButtonsState({stack, index, canBack, canForward, hasHistory}) {
  const wrap = $('#navHistory');
  const backBtn = $('#navBackBtn');
  const fwdBtn = $('#navForwardBtn');
  if (!wrap || !backBtn || !fwdBtn) return;
  wrap.hidden = !hasHistory;
  wrap.setAttribute('aria-label', t('站内历史导航', 'In-app navigation history'));
  $('#navBackLabel').textContent = t('返回', 'Back');
  if (!hasHistory) return;

  backBtn.disabled = !canBack;
  if (canBack) {
    const dest = navSnapshotLabel(stack[index - 1].snap);
    const tipTxt = t(`返回：${dest} (Alt+←)`, `Back to: ${dest} (Alt+←)`);
    backBtn.title = tipTxt;
    backBtn.setAttribute('aria-label', tipTxt);
  } else {
    const tipTxt = t('已是本次会话起点', 'At start of session history');
    backBtn.title = tipTxt;
    backBtn.setAttribute('aria-label', tipTxt);
  }

  fwdBtn.hidden = !canForward;
  fwdBtn.disabled = !canForward;
  if (canForward) {
    const dest = navSnapshotLabel(stack[index + 1].snap);
    const tipTxt = t(`前进：${dest} (Alt+→)`, `Forward to: ${dest} (Alt+→)`);
    fwdBtn.title = tipTxt;
    fwdBtn.setAttribute('aria-label', tipTxt);
  }
}

function restoreNavSnapshot(snap, direction = 'back') {
  if (!snap || !snapshot || !BENCHMARKS[snap.key]) return;
  stopHistoryPlay();
  if (guideOpen) setGuideOpen(false);
  if (cmdOpen) setCmdOpen(false);
  if (changelogOpen) setChangelogOpen(false);
  if (scenarioOpen) setScenarioOpen(false);
  if (viewToolsOpen) setViewToolsOpen(false);
  if (comparePickerOpen) setComparePickerOpen(false);
  radarInfoOpen = false;
  endPointerInteractions();
  clearLasso();
  clearHover();

  orgFocus = snap.orgFocus || 'all';
  orgDivFilter = snap.orgDivFilter || 'all';
  orgPinnedKey = snap.orgPinnedKey || null;
  orgMatchedOnly = !!snap.orgMatchedOnly;
  orgDetailSort = snap.orgDetailSort ? {...snap.orgDetailSort} : {boardId: null, colKey: null, dir: 'desc'};
  orgSpotlightKey = null;
  lastOrgBarSig = '';

  const key = snap.key;
  activeKey = key;
  for (const tab of document.querySelectorAll('.tabs [role=tab]')) {
    const selected = tab.dataset.chart === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  $('#chart-panel').setAttribute('aria-labelledby', `tab-${key}`);
  $('#chartTitle').textContent = t(BENCHMARKS[key].zhTitle, BENCHMARKS[key].enTitle);
  $('#chartSubtitle').textContent = t(BENCHMARKS[key].zhSub, BENCHMARKS[key].enSub);
  syncOnboardingStrip();

  if (!states.has(key)) states.set(key, makeState(key));
  state = states.get(key);
  if (key === 'media' && snap.mediaTrack && MEDIA_TRACKS[snap.mediaTrack]) {
    state.mediaTrack = snap.mediaTrack;
  }
  state.yLens = snap.yLens || '';
  state.scenarioId = snap.scenarioId || 'default';
  state.scenarioWeights = snap.scenarioWeights ? {...snap.scenarioWeights} : null;
  state.costProfile = snap.costProfile || 'benchmark';
  state.license = snap.license || 'all';
  state.extraFilter = snap.extraFilter || '';
  state.company = snap.company || null;
  state.search = snap.search || '';
  state.starredOnly = !!snap.starredOnly && state.baseRows.some(isStarred);
  state.frontierOnly = !!snap.frontierOnly;
  state.effortCurves = !!snap.effortCurves;
  state.isoCurve = !!snap.isoCurve;
  state.subLine = !!snap.subLine;
  state.historyMode = !!snap.historyMode;
  state.routerOpen = !!snap.routerOpen;
  state.sortKey = snap.sortKey || 'intelligenceIndex';
  state.sortDirection = snap.sortDirection || 'desc';
  state.mode = key === 'orgs' ? 'orgs' : (snap.mode || 'chart');
  if (state.mode !== 'orgs') lastArenaMode = state.mode;

  reprojectRows(state);
  if (typeof snap.historyIndex === 'number' && state.releaseDates.length) {
    state.historyIndex = Math.max(0, Math.min(state.releaseDates.length - 1, snap.historyIndex));
  }
  if (Array.isArray(snap.compareIds) && snap.compareIds.length) {
    const validIds = new Set(state.rows.map(r => r.id));
    const kept = snap.compareIds.filter(id => validIds.has(id));
    if (kept.length) state.compareIds = kept;
  }
  const hasTime = state.rows.some(r => xValOf(r, 'time') !== null);
  syncMetricViewport(state, snap.xMetric === 'time' && hasTime ? 'time' : 'cost');
  if (snap.view && state.bounds) {
    state.view = clampView({...snap.view}, state.bounds);
    state.views[state.xMetric] = {...state.view};
  }
  state.selected = snap.selected && state.rows.some(r => r.id === snap.selected) ? snap.selected : null;

  $('#loading').hidden = true;
  host.setAttribute('aria-busy', 'false');
  syncMediaTrackBar();
  renderLegend();
  syncControls();
  syncPanelControls();
  renderStatus();
  buildPlot();
  if (state.mode === 'orgs' && orgPinnedKey) {
    applyOrgSpotlight(null, null, {scrollPinned: true});
  }
  const lbl = navSnapshotLabel(snap);
  selectionNotice = !state.selected && lbl
    ? (direction === 'forward' ? t(`已前进：${lbl}`, `Forward to: ${lbl}`) : t(`已返回：${lbl}`, `Back to: ${lbl}`))
    : '';
  updateSummary();
}

const navHistory = createNavHistory({
  captureSnapshot: captureNavSnapshot,
  signatureOf: navSignature,
  restoreSnapshot: restoreNavSnapshot,
  buildUrlHash,
  onButtonsChange: renderNavButtonsState,
  maxStack: 50
});

const syncNavButtons = () => navHistory.syncButtons();
const initNavHistory = () => navHistory.init();
const runNavAction = fn => navHistory.runAction(fn, {canCommit: () => !!(snapshot && state), fallbackSyncUrl: syncUrlHash});
const navBack = () => navHistory.back();
const navForward = () => navHistory.forward();

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
    } else if (state.extraFilter === 'msub:t2i') {
      out = out.filter(row => row.mediaScores?.t2i != null);
    } else if (state.extraFilter === 'msub:imgEdit') {
      out = out.filter(row => row.mediaScores?.imgEdit != null);
    } else if (state.extraFilter === 'msub:imgBoth') {
      out = out.filter(row => row.mediaScores?.t2i != null && row.mediaScores?.imgEdit != null);
    } else if (state.extraFilter === 'msub:t2v') {
      out = out.filter(row => row.mediaScores?.t2v != null);
    } else if (state.extraFilter === 'msub:i2v') {
      out = out.filter(row => row.mediaScores?.i2v != null);
    } else if (state.extraFilter === 'msub:vidEdit') {
      out = out.filter(row => row.mediaScores?.vidEdit != null);
    } else if (state.extraFilter === 'msub:ttsFast') {
      out = out.filter(row => row.mediaRaw?.ttfaMs != null && row.mediaRaw.ttfaMs <= 250);
    } else if (state.extraFilter === 'msub:ttsTimed') {
      out = out.filter(row => typeof row.timeSec === 'number' && Number.isFinite(row.timeSec) && row.timeSec > 0);
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
  const cacheKey = `${state.license}|${state.extraFilter}|${state.yLens}|${metric}`;
  if (state._frontierCache?.key === cacheKey) return state._frontierCache;
  const pool = activePool();
  const xOf = currentXOf();
  const list = paretoFrontier(pool, xOf);
  const entry = {key: cacheKey, list, idSet: new Set(list.map(row => row.id))};
  state._frontierCache = entry;
  return entry;
}

function filteredRows() {
  const query = state.search.trim().toLocaleLowerCase();
  const tokens = query ? query.split(/\s+/).filter(Boolean) : [];
  const pool = activePool();
  let rows = tokens.length
    ? pool.filter(row => {
      const blob = rowSearchBlob(row);
      return tokens.every(tk => blob.includes(tk));
    })
    : pool;
  if (state.starredOnly) {
    rows = rows.filter(isStarred);
  }
  if (state.frontierOnly) {
    const {idSet} = activeFrontierSet();
    rows = rows.filter(row => idSet.has(row.id));
  }
  return rows;
}

function computeRankings(rows = licenseFilteredRows(state.rows)) {
  const defaultPool = licenseFilteredRows(state.rows);
  const useCache = rows === defaultPool;
  const cacheKey = `${state.license}|${state.extraFilter}|${state.yLens}|${state.valueWeight}|${state.minScore}|${state.maxCost}`;
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
  $('#changelogTitle').textContent = t('实况变动与上游动态', 'Live Snapshot Diff & Updates');
  $('#changelogTime').textContent = t('每 2 小时检查', '2h auto-sync');
  const list = $('#changelogList');
  const frag = document.createDocumentFragment();
  const diffs = Array.isArray(snapshot?.diffEvents) ? snapshot.diffEvents : [];
  if (diffs.length) {
    frag.append(html('li', t('⚡ 自动监测：新上榜 / 价格调整 / 跑分刷新', '⚡ Live Tracker: New Arrivals & Price Shifts'), 'diff-section-label'));
    for (const ev of diffs.slice(0, 8)) {
      const li = html('li', null, 'changelog-item');
      const btn = html('button', null, 'diff-jump-btn');
      btn.type = 'button';
      const tabTag = ev.tab === 'coding-agents'
        ? t('智能体', 'Agent')
        : ev.tab === 'media'
          ? (ev.mediaKind === 'image' ? t('图像', 'Image') : ev.mediaKind === 'video' ? t('视频', 'Video') : 'TTS')
          : t('大模型', 'LLM');
      const creatorBit = ev.creator ? `${ev.creator} · ` : '';
      const left = html('span', `${ev.date.slice(5)} · [${tabTag}] ${creatorBit}${ev.name}`, 'diff-jump-name');
      let badgeTxt = '', badgeCls = 'diff-badge is-good';
      if (ev.kind === 'new') {
        badgeTxt = `${t('新上榜', 'NEW')} ${ev.score}`;
      } else if (ev.kind === 'price-drop') {
        badgeTxt = `${t('降价', 'Drop')} ${ev.pct}%`;
      } else if (ev.kind === 'price-up') {
        badgeTxt = `${t('调价', 'Price')} +${ev.pct}%`;
        badgeCls = 'diff-badge is-warn';
      } else {
        badgeTxt = `${ev.delta > 0 ? '+' : ''}${ev.delta} ${t('分', 'pt')}`;
      }
      btn.append(left, html('span', badgeTxt, badgeCls));
      btn.addEventListener('click', () => {
        setChangelogOpen(false);
        runNavAction(() => {
          const targetTab = BENCHMARKS[ev.tab] ? ev.tab : 'models';
          chooseChart(targetTab);
          if (targetTab === 'media' && state) {
            const targetTrack = ev.mediaKind || state.baseRows.find(r => r.id === ev.id)?.mediaKind;
            if (targetTrack && state.mediaTrack !== targetTrack) setMediaTrack(targetTrack);
          }
          const found = state?.rows.find(r => r.id === ev.id);
          if (found) locateRowInChart(found);
        });
      });
      li.append(btn);
      frag.append(li);
    }
  }
  const items = Array.isArray(snapshot?.changelog) ? snapshot.changelog : [];
  const typeLabelOf = raw => {
    if (raw === 'model') return t('新模型', 'Model');
    if (raw === 'benchmark' || raw === 'index') return t('基准更新', 'Benchmark');
    if (raw === 'agent') return t('智能体', 'Agent');
    return t('动态', 'Update');
  };
  if (items.length) {
    if (diffs.length) {
      frag.append(html('li', t('📰 Artificial Analysis 官方评测公告', '📰 Official Artificial Analysis Announcements'), 'diff-section-label'));
    }
    for (const item of items.slice(0, 8)) {
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
  } else if (!diffs.length) {
    frag.append(html('li', t('每 2 小时自动检查 Artificial Analysis 上游榜单更新。', 'Checked every 2 hours against upstream Artificial Analysis releases.'), 'changelog-item'));
  }
  const guideLi = html('li', null, 'changelog-item');
  const guideAnchor = html('a', t('📖 查看四步上手教学与作品详情 · Liss Works ↗', '📖 Read 4-step quick-start guide · Liss Works ↗'));
  guideAnchor.href = 'https://heroliss.github.io/liss-works/projects/intelligence-index-cost-linear/';
  guideAnchor.target = '_blank';
  guideAnchor.rel = 'noopener';
  guideLi.append(guideAnchor);
  frag.append(guideLi);
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

function formatTaskCount(tasks, row = null) {
  if (tasks === null) return '—';
  const unitZh = row?.mediaKind === 'image'
    ? '\u00A0张'
    : row?.mediaKind === 'video'
      ? '\u00A0段'
      : row?.mediaKind === 'tts'
        ? '\u00A0千字'
        : '\u00A0次';
  const unitEn = row?.mediaKind === 'image'
    ? '\u00A0img'
    : row?.mediaKind === 'video'
      ? '\u00A0clips'
      : row?.mediaKind === 'tts'
        ? '\u00A0k-ch'
        : '';
  if (tasks < 1) return t(`< 1${unitZh} (${format(tasks, 2)})`, `< 1${unitEn} (${format(tasks, 2)})`);
  if (tasks >= 100) return `${Math.round(tasks).toLocaleString('en-US')}${t(unitZh, unitEn)}`;
  return `${format(tasks, 1)}${t(unitZh, unitEn)}`;
}

function compactMoney(value) {
  if (value >= 100) return '$' + Math.round(value).toLocaleString('en-US');
  if (value >= 1) return '$' + format(value, 1);
  return money(value);
}

function tierBreakevenText(cost, row = null) {
  const unitTxt = row?.mediaKind === 'image'
    ? t('张', 'img')
    : row?.mediaKind === 'video'
      ? t('段', 'clip')
      : row?.mediaKind === 'tts'
        ? t('千字', 'k-ch')
        : t('次', 'x');
  const parts = SUBSCRIPTION_TIERS.map(tier => {
    const n = breakEvenTasks(cost, tier.price);
    if (n === null) return null;
    const countStr = n < 1 ? '<1' : n >= 100 ? Math.round(n).toLocaleString('en-US') : format(n, 1);
    return `$${tier.price}: ${countStr}\u00A0${unitTxt}`;
  }).filter(Boolean);
  return parts.length ? `${t('回本', 'Break-even')} · ${parts.join(' · ')}` : '';
}

function syncStaticText() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  $('#appTitle').textContent = t('智能水平与任务成本', 'Intelligence vs. Cost');
  $('#appSubtitle').textContent = t('Intelligence vs. Cost · 线性成本基准', 'Linear-cost AI benchmark explorer');
  $('#tab-models').textContent = t('综合智能', 'Intelligence');
  $('#tab-models').title = t(
    'Artificial Analysis 综合智能 v5：代码、推理、长文本、全科知识等 10 项标准化任务总分与真实单任务成本',
    'Artificial Analysis Intelligence Index v5: 10 standardized coding, reasoning, long-context & knowledge suites vs. real API task cost'
  );
  $('#tab-frontier').textContent = t('前沿极限', 'Frontier Hard');
  $('#tab-frontier').title = t(
    '剔除 90%+ 已饱和旧题，聚焦 GDP-PDF、FrontierCode 2.0、Terminal 4.0、HLE 等高区分度难题，看顶尖旗舰真实分差',
    'Strips 90%+ saturated legacy tests to expose real SOTA capability spread across 6 unsaturated hard suites'
  );
  $('#tab-human-arena').textContent = t('人类与审美', 'Human & Taste');
  $('#tab-human-arena').title = t(
    '真人双盲投票与专家评审：Arena.ai 去水份聊天人味 + Design Arena 视觉审美 + GDPval 44 职业真实交付',
    'Blind human preference & taste: Arena.ai style-controlled chat + Design Arena aesthetics + GDPval 44-job deliverables'
  );
  $('#tab-coding-agents').textContent = t('编程智能体', 'Coding Agents');
  $('#tab-coding-agents').title = t(
    '模型 + Agent 编程框架（Claude Code / Codex 等）端到端修仓库、跑终端的真实分与单任务成本（含 P50/P95 分布）',
    'End-to-end Model + Coding Harness (Claude Code, Codex, etc.) real-repo benchmarks with cost & latency distributions'
  );
  $('#tab-cyber').textContent = t('网络安全', 'Cyber');
  $('#tab-cyber').title = t(
    '渗透攻防、漏洞分析与安全代码审计能力，同时标注各模型的安全护栏拒答率',
    'Offensive/defensive security & vulnerability benchmarks paired with each model’s safeguard refusal rate'
  );
  $('#tab-media').textContent = t('多模态生成', 'Media Arena');
  $('#tab-media').title = t(
    '图像（$/张）、视频（$/5秒）、语音合成（$/千字）三大独立盲测赛道，各自独立排名与计价，绝不混排',
    'Three strictly isolated blind arenas: Image ($/img), Video ($/5s), and Speech TTS ($/1k chars) — never mixed across units'
  );
  $('#tab-orgs').textContent = t('机构分榜', 'Org Ranks');
  $('#tab-orgs').title = t(
    '6 家权威测评机构原始榜单原序对照（AA / LiveBench 2.0 / Arena.ai / Design Arena / GDPval），支持跨榜轨迹与单榜精析',
    '6 un-blended official organization leaderboards side-by-side with cross-org rank trajectories and sub-metric inspection'
  );
  $('#pickerBtnText').textContent = t('帮我选', 'Pick');
  $('#pickerBtn').title = t(
    '3 步帮我选模型：按用途、预算与开源偏好一键推荐 3 款候选并支持直接剖析对比',
    '3-Step Model Picker: answer 3 quick choices for 3 tailored recommendations'
  );
  $('#guideBtnText').textContent = t('读懂榜单', 'Guide');
  $('#guideBtn').title = t(
    '新手导览：了解各榜单与测评机构特点，一键实操发现数据背后的隐藏信息（快捷键 ?）',
    'Beginner guide: benchmark & agency profiles, chart glossary & 1-click data insight recipes (press ?)'
  );
  $('#footerGuideLink').textContent = t('上手指南与介绍 ↗', 'Quick-Start Guide ↗');
  $('#footerGuideLink').title = t('查看本作品详情页与选型入门指南', 'Read beginner guide & project overview on Liss Works');
  $('#footerWorksLink').textContent = t('Liss Works 作品站 ↗', 'Liss Works Portfolio ↗');
  $('#footerWorksLink').title = t('访问作者个人作品站 Liss Works', 'Visit author portfolio: Liss Works');
  $('#cmdPaletteBtn').replaceChildren(
    document.createTextNode(t('速查 ', 'Jump ')),
    html('kbd', 'Ctrl+K')
  );
  $('#cmdPaletteBtn').setAttribute('aria-label', t('打开全局模型速查面板 (Ctrl+K)', 'Open global model search palette (Ctrl+K)'));
  $('#cmdInput').placeholder = t('输入模型、厂商或生成引擎名速查全站排名…', 'Search any model, creator, or media generator across all tabs…');
  const cmdLinks = html('span', null, 'cmd-foot-links');
  const mkExtLink = (txt, href) => {
    const a = html('a', txt);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  };
  cmdLinks.append(
    mkExtLink(t('上手指南 ↗', 'Guide ↗'), 'https://heroliss.github.io/liss-works/projects/intelligence-index-cost-linear/'),
    html('span', '·', 'footer-sep'),
    mkExtLink('Liss Works ↗', 'https://heroliss.github.io/liss-works/')
  );
  $('#cmdFoot').replaceChildren(
    html('span', t('↑↓ 选择 · Enter 跳转定位 · Shift+Enter 加入剖析对比 · ★ 收藏关注', '↑↓ Navigate · Enter locate · Shift+Enter compare · ★ Star')),
    cmdLinks
  );
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
  $('#orgSelectGroup').setAttribute('aria-label', t('选择测评机构原榜', 'Choose evaluation organization leaderboard'));
  $('#orgMatchedToggle').textContent = orgMatchedOnly
    ? t('仅看可对齐全站模型 ✓', 'Aligned models only ✓')
    : t('仅看可对齐全站模型', 'Aligned models only');

  $('#keyLinear').textContent = t('线性美元横轴', 'Linear USD axis');
  $('#keyLinear').title = t('横轴严格按真实比例线性排布（非对数压缩），10 倍价差直观呈现为 10 倍距离', 'Strictly linear axis (not log-compressed): 10× higher price is 10× farther right');
  $('#keyQuadrant').textContent = t('优于中位参考区', 'Above-median score & below-median cost');
  $('#keyQuadrantWrap').title = t('绿色背景区同时满足「分数高于全榜中位数」且「成本/耗时低于中位数」，适合优先挑选日常主力', 'Green sweet spot: above-median score AND below-median cost/time — best starting zone for daily drivers');
  $('#keyFrontier').textContent = t('帕累托前沿', 'Pareto frontier');
  $('#keyFrontierWrap').title = t('虚折线串联起同价位下的最高分模型；想超越前沿上的模型，只能花更多钱或降分', 'Dashed envelope of unbeatable models: no other model beats them on both score and cost');
  $('#keyIso').textContent = t('最优等性价比切线', 'Best-value iso-curve');
  $('#keyIsoWrap').title = t('穿过当前智能权重 α 冠军的等性价比曲线，离曲线越近性价比越接近榜首', 'Contour of equal score/cost value passing through the current α champion');
  $('#keySub').textContent = t('订阅回本成本线', 'Subscription break-even');
  $('#keySubWrap').title = t('竖线右侧代表按你设定的月用量买月订阅更省钱，左侧代表直接按量用 API 更划算', 'Models right of this line break even on a monthly subscription; models left are cheaper via pay-as-you-go API');
  $('#keyEffort').textContent = t('同系列推理轨迹', 'Reasoning effort trajectory');
  $('#keyEffortWrap').title = t('连线同一模型家族的低/中/高/超高思考档位，直观看清“多想一会儿”换来多少分差', 'Connects Low → Medium → High → Xhigh reasoning effort variants of the same family');
  $('#keyHistory').textContent = t('历史帕累托前沿（虚线为今日）', 'Historical Pareto (dashed = today)');
  $('#keyHistoryWrap').title = t('实线为所选历史日期的帕累托前沿，虚线为今日前沿，直观对比 AI 能力涨价或降本幅度', 'Solid line = historical frontier at selected date vs. dashed today frontier');
  $('#keyBetter').textContent = t('越靠左上越理想', 'Upper-left is better');
  $('#keyBetter').title = t('纵轴分数越高越强，横轴成本/耗时越低越省，因此左上角是理想方向', 'Higher Y = stronger capability, lower X = lower cost/time');
  syncOnboardingStrip();
  syncNavButtons();
  if (guideOpen) renderGuideDialog();

  $('#xMetricSwitch').setAttribute('aria-label', t('横轴维度', 'Horizontal axis metric'));
  $('#xMetricCost').textContent = t('成本', 'Cost');
  $('#xMetricTime').textContent = t('耗时', 'Time');
  $('#mediaKindSwitch').setAttribute('aria-label', t('选择多模态独立赛道', 'Choose isolated generative media track'));
  syncMediaTrackBar();
  $('#legendPrevBtn').setAttribute('aria-label', t('向左滚动厂商列表', 'Scroll creators left'));
  $('#legendNextBtn').setAttribute('aria-label', t('向右滚动厂商列表', 'Scroll creators right'));

  $('#reset').textContent = t('重置视图', 'Reset view');
  $('#fit').textContent = t('显示全部', 'Fit all');
  $('#boxSelectBtn').textContent = boxSelectMode ? t('框选模式 ✓', 'Box select ✓') : t('框选模式', 'Box select');
  $('#boxSelectBtn').title = t('开启拉框模式（或按住 Shift 在图中拖拽）框选局部放大或批量加入对比', 'Toggle box-select mode (or Shift+drag on chart) to zoom or batch-compare');
  $('#lassoZoomBtn').textContent = t('放大此区', 'Zoom here');
  $('#lassoCompareBtn').textContent = t('框内前沿对比', 'Compare frontier');
  $('#toolsFiltersTitle').textContent = t('成本负载与专项筛选', 'Cost Profile & Filters');
  $('#toolsOverlaysTitle').textContent = t('分析辅助图层', 'Chart Overlays');
  $('#toolsNavTitle').textContent = t('视图缩放与拉框', 'Zoom & Box Select');
  $('#toolsLabelsTitle').textContent = t('标签密度与排版', 'Labels & Layout');
  $('#orgModeSwitch').setAttribute('aria-label', t('机构分榜展示模式', 'Org leaderboard display mode'));
  $('#scenarioTitle').textContent = t('自定义工作流场景配方', 'Custom Workload Scenario');
  $('#scenarioResetBtn').textContent = t('恢复官方', 'Official');
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
    document.createTextNode(t('+拖拽拉框放大/批量对比', '+drag box-zoom/compare'))
  );
  $('#helpKeyboard').replaceChildren(
    document.createTextNode(t('键盘：', 'Keys: ')),
    html('kbd', 'Ctrl+K'),
    document.createTextNode(t(' 速查 · ', ' jump · ')),
    html('kbd', '1–5'),
    document.createTextNode(t(' 切视图 · ', ' views · ')),
    html('kbd', 'Alt+1–7'),
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
  $('#pinCollapseBtn').textContent = pinCollapsed ? t('展开', 'Expand') : t('收起', 'Compact');
  $('#pinCollapseBtn').setAttribute('aria-expanded', String(!pinCollapsed));
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
  $('#radarModeLiveBench').textContent = 'LiveBench 2.0';
  $('#compareVisSwitch').setAttribute('aria-label', t('对比图表形式切换', 'Comparison chart type'));
  $('#visRadarBtn').textContent = t('雷达图', 'Radar');
  $('#visStripBtn').textContent = t('微距跑道', 'Dot Strip');
  $('#visDeltaBtn').textContent = t('胜负分差 Δ', 'Delta Δ');
  $('#radarScaleSwitch').setAttribute('aria-label', t('雷达图量程缩放', 'Radar scale mode'));
  $('#scaleZoomBtn').textContent = t('微距去底', 'Zoomed');
  $('#scaleZoomBtn').title = t('自动剥离圆心低分空白死区，放大前沿模型微弱差距', 'Trim dead center range to amplify frontier model differences');
  $('#scaleAxisBtn').textContent = t('分轴极值', 'Per-Axis');
  $('#scaleAxisBtn').title = t('每个维度按已选模型各自最低/最高分独立归一化，解决跨测试分数段悬殊问题', 'Normalize each spoke independently to its [min, max] spread');
  $('#scaleFullBtn').textContent = t('0–100', '0–100');
  $('#scaleFullBtn').title = t('传统 0–100 全量程绝对比例雷达', 'Classic 0–100 zero-origin radar scale');
  $('#stripScaleSwitch').setAttribute('aria-label', t('跑道图量程缩放', 'Dot strip scale mode'));
  $('#stripZoomBtn').textContent = t('微距区间', 'Zoomed');
  $('#stripFullBtn').textContent = t('0–100 全程', '0–100 Full');
  $('#deltaBaseLabel').textContent = t('基准', 'Ref');
  $('#radarInfoBtn').textContent = radarInfoOpen ? t('收起口径', 'Hide sources') : t('指标口径', 'Sources');
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1626' : '#f5f7fa');
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
  syncUrlHash({includeLang: true});
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
  selectionNotice = '';
  if (comparePickerOpen) setComparePickerOpen(false);
  if (viewToolsOpen) setViewToolsOpen(false);
  radarInfoOpen = false;
  const previousMode = state?.mode;
  if (previousMode && previousMode !== 'orgs') lastArenaMode = previousMode;
  endPointerInteractions();
  clearHover();
  activeKey = key;
  for (const tab of document.querySelectorAll('.tabs [role=tab]')) {
    const selected = tab.dataset.chart === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (!selected && document.activeElement === tab) tab.blur();
    if (selected) {
      requestAnimationFrame(() => tab.scrollIntoView({inline: 'nearest', block: 'nearest'}));
    }
  }
  $('#chart-panel').setAttribute('aria-labelledby', `tab-${key}`);
  $('#chartTitle').textContent = t(BENCHMARKS[key].zhTitle, BENCHMARKS[key].enTitle);
  $('#chartSubtitle').textContent = t(BENCHMARKS[key].zhSub, BENCHMARKS[key].enSub);
  syncOnboardingStrip();
  if (!snapshot) return;
  try {
    if (!states.has(key)) states.set(key, makeState(key, routeParams));
    else if (routeParams) applyRouteParams(states.get(key), routeParams);
    state = states.get(key);
    if (state.starredOnly && !state.rows.some(isStarred)) state.starredOnly = false;
    if (key === 'orgs') {
      state.mode = 'orgs';
    } else if (!routeParams?.has('view')) {
      state.mode = (previousMode && previousMode !== 'orgs') ? previousMode : lastArenaMode;
    }
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

for (const tab of document.querySelectorAll('.tabs [role=tab]')) {
  tab.addEventListener('click', () => runNavAction(() => chooseChart(tab.dataset.chart)));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const visibleTabs = [...document.querySelectorAll('.tabs [role=tab]')].filter(el => !el.hidden);
    if (!visibleTabs.length) return;
    const idx = Math.max(0, visibleTabs.findIndex(el => el.dataset.chart === activeKey));
    const nextIdx = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? visibleTabs.length - 1
        : (idx + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
    const key = visibleTabs[nextIdx].dataset.chart;
    runNavAction(() => chooseChart(key));
    $(`#tab-${key}`).focus();
  });
}

addEventListener('popstate', event => {
  if (!snapshot) return;
  navHistory.handlePopState(event.state, () => {
    const parsed = parseHash();
    chooseChart(parsed.chart, {changeHash: false, routeParams: parsed.params});
  });
});

addEventListener('hashchange', () => {
  if (navHistory.ownsCurrentHistory()) return;
  const parsed = parseHash();
  chooseChart(parsed.chart, {changeHash: false, routeParams: parsed.params});
});

function syncLegendNav() {
  const leg = $('#legend');
  const prevBtn = $('#legendPrevBtn');
  const nextBtn = $('#legendNextBtn');
  if (!leg || !prevBtn || !nextBtn) return;
  const maxScroll = Math.max(0, leg.scrollWidth - leg.clientWidth);
  const hasOverflow = maxScroll > 4;
  prevBtn.hidden = !hasOverflow || leg.scrollLeft <= 2;
  nextBtn.hidden = !hasOverflow || leg.scrollLeft >= maxScroll - 2;
  leg.classList.toggle('is-at-end', !hasOverflow || leg.scrollLeft >= maxScroll - 2);
}

$('#legendPrevBtn')?.addEventListener('click', () => {
  $('#legend')?.scrollBy({left: -240, behavior: 'smooth'});
});
$('#legendNextBtn')?.addEventListener('click', () => {
  $('#legend')?.scrollBy({left: 240, behavior: 'smooth'});
});
$('#legend')?.addEventListener('scroll', syncLegendNav, {passive: true});
$('#legend')?.addEventListener('wheel', event => {
  const leg = $('#legend');
  if (!leg || leg.scrollWidth <= leg.clientWidth + 2) return;
  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    event.preventDefault();
    leg.scrollLeft += event.deltaY;
  }
}, {passive: false});

function renderLegend() {
  const companies = new Map();
  const legendSource = state.mode === 'orgs' && snapshot?.models?.length ? snapshot.models : state.rows;
  for (const row of licenseFilteredRows(legendSource)) {
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
      else if (state.mode === 'orgs') renderOrgLeaderboards();
      scheduleDraw();
    });
    fragment.append(button);
  }
  $('#legend').replaceChildren(fragment);
  requestAnimationFrame(syncLegendNav);
}

function syncMediaTrackBar() {
  const bar = $('#mediaTrackBar');
  if (!bar) return;
  const isMedia = activeKey === 'media' && state?.mode !== 'orgs';
  bar.hidden = !isMedia;
  const activeTrack = state?.benchKey === 'media' ? (state.mediaTrack || 'image') : 'image';
  const counts = {};
  if (state?.benchKey === 'media' && Array.isArray(state.baseRows)) {
    for (const r of state.baseRows) {
      if (r.mediaKind) counts[r.mediaKind] = (counts[r.mediaKind] || 0) + 1;
    }
  }
  for (const btn of document.querySelectorAll('#mediaKindSwitch [data-mkind]')) {
    const mk = btn.dataset.mkind;
    const meta = MEDIA_TRACKS[mk];
    if (!meta) continue;
    const cnt = counts[mk] || 0;
    const hasLoaded = state?.benchKey === 'media' && Array.isArray(state.baseRows) && state.baseRows.length > 0;
    btn.hidden = hasLoaded && cnt === 0;
    btn.textContent = cnt > 0 ? `${t(meta.zhBtn, meta.enBtn)} (${cnt})` : t(meta.zhBtn, meta.enBtn);
    btn.setAttribute('aria-pressed', String(mk === activeTrack));
  }
  const activeMeta = mediaTrackMeta(activeTrack);
  const noteEl = $('#mediaTrackNote');
  if (noteEl) noteEl.textContent = t(activeMeta.zhTrackNote, activeMeta.enTrackNote);
}

function syncDynamicTableHeaders() {
  if (!state) return;
  const hasCustomAxis = !!(state.yLens || (state.scenarioId && state.scenarioId !== 'default' && !['coding-agents', 'media'].includes(activeKey)));
  const idxHdr = hasCustomAxis ? currentAxisLabel() : t('指数 (0–100)', 'Index (0–100)');
  $('#thIndex').textContent = idxHdr;
  $('#subThIndex').textContent = idxHdr;

  let costHdr = t('每任务成本 (USD)', 'Cost / task (USD)');
  let subCostHdr = t('单任务 API', 'API / task');
  if (activeKey === 'media') {
    const meta = mediaTrackMeta(state.mediaTrack);
    costHdr = t(meta.zhCostHdr, meta.enCostHdr);
    subCostHdr = t(meta.zhSubCostHdr, meta.enSubCostHdr);
  } else if (state.costProfile && state.costProfile !== 'benchmark') {
    const shortCp = state.costProfile === 'chat' ? t('轻量问答', 'Light Q&A') : state.costProfile === 'longdoc' ? t('长文档', 'Long-Doc') : t('重推理', 'Heavy Rsn');
    costHdr = t(`模拟成本 · ${shortCp} (USD)`, `Sim Cost · ${shortCp} (USD)`);
    subCostHdr = t(`模拟单次 · ${shortCp}`, `Sim / ${shortCp}`);
  }
  $('#thCost').textContent = costHdr;
  $('#subThCost').textContent = subCostHdr;
}

function syncYLensOptions() {
  const wrap = $('#yLensWrap');
  const sel = $('#yLensSelect');
  const list = lensesFor(state, activeKey);
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

function syncScenarioControls() {
  const wrap = $('#scenarioWrap');
  const supported = !['coding-agents', 'media'].includes(activeKey);
  wrap.hidden = !supported;
  if (!supported) {
    if (scenarioOpen) setScenarioOpen(false);
    return;
  }
  const activeScen = state.scenarioId && state.scenarioId !== 'default';
  const presetObj = SCENARIO_PRESETS.find(p => p.id === state.scenarioId);
  const btn = $('#scenarioBtn');
  btn.classList.toggle('is-active', !!activeScen);
  btn.textContent = activeScen
    ? (presetObj ? `${t(presetObj.zh, presetObj.en)} ✓` : t('自定义配方 ✓', 'Custom ✓'))
    : t('场景配方', 'Scenarios');
  btn.setAttribute('aria-expanded', String(scenarioOpen));
  if (!scenarioOpen) return;

  $('#scenarioResetBtn').disabled = !activeScen;
  const pFrag = document.createDocumentFragment();
  for (const p of SCENARIO_PRESETS) {
    const b = html('button', t(p.zh, p.en));
    b.type = 'button';
    b.setAttribute('aria-pressed', String((state.scenarioId || 'default') === p.id));
    b.addEventListener('click', () => {
      stopHistoryPlay();
      state.scenarioId = p.id;
      state.scenarioWeights = p.weights ? {...p.weights} : null;
      if (p.weights) state.yLens = '';
      state.selected = null;
      reprojectRows(state);
      syncControls();
      syncUrlHash();
      buildPlot();
    });
    pFrag.append(b);
  }
  $('#scenarioPresetGroup').replaceChildren(pFrag);

  const curWeights = state.scenarioWeights || {coding: 2, reasoning: 2, visual: 2, vibe: 2, rigor: 2};
  const sFrag = document.createDocumentFragment();
  for (const pil of SCENARIO_PILLARS) {
    const rowEl = html('label', null, 'scenario-slider-row');
    const lbl = html('span', t(pil.zh, pil.en));
    const inp = html('input');
    inp.type = 'range';
    inp.min = '0';
    inp.max = '5';
    inp.step = '1';
    inp.value = String(state.scenarioId === 'default' ? 2 : (curWeights[pil.key] ?? 0));
    const out = html('output', inp.value);
    inp.addEventListener('input', () => {
      stopHistoryPlay();
      const nextW = state.scenarioWeights ? {...state.scenarioWeights} : {coding: 2, reasoning: 2, visual: 2, vibe: 2, rigor: 2};
      nextW[pil.key] = Number(inp.value);
      if (Object.values(nextW).every(v => v === 0)) nextW[pil.key] = 1;
      inp.value = String(nextW[pil.key]);
      out.textContent = inp.value;
      state.scenarioId = 'custom';
      state.scenarioWeights = nextW;
      state.yLens = '';
      state.selected = null;
      reprojectRows(state);
      syncYLensOptions();
      syncUrlHash();
      buildPlot();
      btn.classList.add('is-active');
      btn.textContent = t('自定义配方 ✓', 'Custom ✓');
      $('#scenarioResetBtn').disabled = false;
      for (const pb of document.querySelectorAll('#scenarioPresetGroup button')) {
        pb.setAttribute('aria-pressed', 'false');
      }
    });
    rowEl.append(lbl, inp, out);
    sFrag.append(rowEl);
  }
  $('#scenarioSliders').replaceChildren(sFrag);
  $('#scenarioNote').textContent = t(
    '融合代码终端、复杂长文本推理、Design Arena 审美、Arena.ai (LMArena) 人味去套话与办公防幻觉五维实测，实时重算专属于您的帕累托前沿与性价比榜首。',
    'Blends Coding, Long-Doc Reasoning, Visual Taste, Arena.ai Chat Vibe & Low-Hallucination Rigor to recompute your custom Pareto frontier live.'
  );
}

function setViewToolsOpen(open) {
  viewToolsOpen = open;
  $('#viewToolsBtn').setAttribute('aria-expanded', String(open));
  const pop = $('#viewToolsPopover');
  pop.hidden = !open;
  if (open) {
    if (mobileLayout.matches) {
      pop.style.left = '';
      pop.style.right = '';
      pop.style.width = '';
    } else {
      clampAnchoredPopover(pop, $('#viewToolsBtn'), 360);
    }
  }
}

$('#viewToolsBtn').addEventListener('click', () => {
  if (scenarioOpen) setScenarioOpen(false);
  setViewToolsOpen(!viewToolsOpen);
});

function syncViewToolsControls() {
  if (!state) return;
  const isChart = state.mode === 'chart';
  const isOrgs = state.mode === 'orgs';
  const isTimeAxis = state.xMetric === 'time';
  const showTools = state.mode === 'chart' || state.mode === 'table' || state.mode === 'sub';
  $('#toolsWrap').hidden = !showTools;
  if (!showTools && viewToolsOpen) setViewToolsOpen(false);
  $('#toolsSecFilters').hidden = isOrgs;
  $('#toolsSecOverlays').hidden = !isChart;
  $('#toolsSecNav').hidden = !isChart;
  $('#optionsPanel').hidden = !isChart;
  $('#toolsSecExport').hidden = !isChart;
  $('#interactionHelp').hidden = !isChart;

  const defaults = DEFAULT_SETTINGS[activeKey];
  const labelChanged = !!(defaults && (state.labels !== defaults.labels || state.smartLabels !== defaults.smartLabels || state.labelSize !== defaults.labelSize || state.labelDistance !== defaults.labelDistance));
  const activeTools = Number(!!(state.costProfile && state.costProfile !== 'benchmark' && activeKey !== 'media'))
    + Number(!!state.extraFilter)
    + (isChart
      ? Number(!!state.effortCurves) + Number(!!state.historyMode) + Number(!!(state.isoCurve && !isTimeAxis)) + Number(!!(state.subLine && !isTimeAxis)) + Number(!!boxSelectMode) + Number(labelChanged)
      : 0);
  const baseLabel = isChart ? t('图层与视图', 'View & Layers') : t('成本与筛选', 'Cost & Filters');
  $('#viewToolsLabel').textContent = activeTools > 0 ? `${baseLabel} · ${activeTools}` : baseLabel;
  $('#viewToolsBtn').classList.toggle('is-active', activeTools > 0);
}

function setScenarioOpen(open) {
  scenarioOpen = open;
  if (open && viewToolsOpen) setViewToolsOpen(false);
  $('#scenarioBtn').setAttribute('aria-expanded', String(open));
  $('#scenarioPopover').hidden = !open;
  if (open) {
    syncScenarioControls();
    clampAnchoredPopover($('#scenarioPopover'), $('#scenarioBtn'), 340);
  }
}

function syncCostProfileOptions() {
  const wrap = $('#costProfileWrap');
  const sel = $('#costProfileSelect');
  wrap.hidden = activeKey === 'media';
  const frag = document.createDocumentFragment();
  for (const cp of COST_PROFILES) {
    const opt = html('option', t(cp.zh, cp.en));
    opt.value = cp.id;
    frag.append(opt);
  }
  sel.replaceChildren(frag);
  sel.value = state.costProfile || 'benchmark';
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
      ['src:both', t('双竞技场全覆盖 (Arena.ai + Design)', 'Both Arena.ai & Design Arena')],
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
  } else if (activeKey === 'media') {
    const track = state.mediaTrack || 'image';
    const opts = track === 'image'
      ? [
        ['', t('全部图像引擎', 'All image models')],
        ['msub:t2i', t('含文生图盲测 (T2I)', 'With Text-to-Image (T2I)')],
        ['msub:imgEdit', t('含图像编辑盲测 (Edit)', 'With Image Editing')],
        ['msub:imgBoth', t('同时覆盖文生图与修图', 'Both T2I & Image Editing')]
      ]
      : track === 'video'
        ? [
          ['', t('全部视频引擎', 'All video models')],
          ['msub:t2v', t('含文生视频盲测 (T2V)', 'With Text-to-Video (T2V)')],
          ['msub:i2v', t('含图生视频盲测 (I2V)', 'With Image-to-Video (I2V)')],
          ['msub:vidEdit', t('含视频编辑盲测', 'With Video Editing')]
        ]
        : [
          ['', t('全部语音引擎', 'All TTS models')],
          ['msub:ttsFast', t('低首包延迟 (TTFA ≤ 250ms)', 'Low latency (TTFA ≤ 250ms)')],
          ['msub:ttsTimed', t('含实测生成耗时', 'With measured latency')]
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
  return ['models', 'frontier', 'human-arena', 'cyber', 'media'].includes(activeKey) && state.xMetric === 'cost' && state.releaseDates.length > 1;
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
  syncExtraFilterOptions();
  const hasAnyTime = licenseFilteredRows(state.rows).some(r => xValOf(r, 'time') !== null);
  if (!hasAnyTime && state.xMetric === 'time') syncMetricViewport(state, 'cost');
  $('#xMetricTime').disabled = !hasAnyTime;
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
  syncScenarioControls();
  syncCostProfileOptions();
  syncDynamicTableHeaders();

  $('#boxSelectBtn').setAttribute('aria-pressed', String(boxSelectMode));
  $('#boxSelectBtn').textContent = boxSelectMode ? t('框选模式 ✓', 'Box select ✓') : t('框选模式', 'Box select');
  host.classList.toggle('box-mode', boxSelectMode);

  const starCountOnTab = state.rows.filter(isStarred).length;
  $('#starFilterBtn').setAttribute('aria-pressed', String(!!state.starredOnly));
  $('#starFilterBtn').textContent = starCountOnTab > 0
    ? t(`★ 关注 (${starCountOnTab})${state.starredOnly ? ' ✓' : ''}`, `★ Stars (${starCountOnTab})${state.starredOnly ? ' ✓' : ''}`)
    : t('★ 关注', '★ Stars');
  $('#starFilterBtn').disabled = false;
  $('#starFilterBtn').classList.toggle('is-empty', !state.starredOnly && starCountOnTab === 0);
  $('#starFilterBtn').title = starCountOnTab === 0
    ? t('尚未收藏关注：点击任意节点卡片或数据表中的 ☆ 即可加入常驻关注列表', 'No stars yet — click ☆ in any pinned card or table row to build your watchlist')
    : t('仅筛选显示您收藏关注的常驻模型', 'Filter to your starred watchlist models');

  $('#search').value = state.search;
  $('#frontier').setAttribute('aria-pressed', String(state.frontierOnly));
  $('#frontier').textContent = state.frontierOnly ? t('仅看前沿 ✓', 'Frontier ✓') : t('仅看前沿', 'Frontier only');

  $('#effortToggle').hidden = state.mode !== 'chart' || activeKey === 'media';
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

  const isOrgsMode = activeKey === 'orgs' || state.mode === 'orgs';
  $('#exportPng').hidden = !(state.mode === 'chart' || (isOrgsMode && orgFocus === 'bump'));
  $('#exportCsv').hidden = !(state.mode === 'table' || state.mode === 'sub' || isOrgsMode);

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

  const isOrgs = activeKey === 'orgs' || state.mode === 'orgs';
  const hideFilterChrome = state.mode === 'curve' || state.mode === 'compare';
  if (isOrgs) {
    $('#yLensWrap').hidden = true;
    $('#scenarioWrap').hidden = true;
    $('#costProfileWrap').hidden = true;
    if (scenarioOpen) setScenarioOpen(false);
  }
  $('#extraFilter').closest('.extra-filter-wrap').hidden = isOrgs;
  $('#frontier').hidden = isOrgs;
  syncViewToolsControls();
  $('#viewSwitch').hidden = isOrgs;
  $('#orgModeSwitch').hidden = !isOrgs;
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === state.mode));
  }
  $('#dataTable').hidden = state.mode !== 'table';
  $('#orgPanel').hidden = !isOrgs;
  $('#subPanel').hidden = state.mode !== 'sub';
  $('#comparePanel').hidden = state.mode !== 'compare';
  host.hidden = state.mode !== 'chart';
  $('#curvePanel').hidden = state.mode !== 'curve';
  $('#valueSettings').hidden = !(state.mode === 'table' || state.mode === 'curve' || (state.mode === 'chart' && (state.isoCurve || state.minScore > 0 || state.maxCost > 0) && !isTimeAxis));
  $('#subSettings').hidden = !(state.mode === 'sub' || (state.mode === 'chart' && state.subLine && !isTimeAxis));
  syncMediaTrackBar();
  const hasTrackTime = state.rows.some(r => xValOf(r, 'time') !== null);
  const showXMetric = state.mode === 'chart' && hasTrackTime;
  $('#xMetricSwitch').hidden = !showXMetric;
  $('#viewControls').hidden = !showXMetric;
  $('#subStrip').hidden = hideFilterChrome;
  $('#legendStrip').hidden = hideFilterChrome;
  $('#legend').hidden = hideFilterChrome;
  $('#filterControls').hidden = hideFilterChrome;
  $('#toolbar').hidden = hideFilterChrome;
  $('#readingKey').hidden = state.mode !== 'chart';
  $('#keyFrontierWrap').hidden = false;
  $('#keyQuadrantWrap').hidden = false;
  requestAnimationFrame(syncLegendNav);

  const topScore = state.bounds.y + state.bounds.height;
  $('#curveRangeToggle').setAttribute('aria-pressed', String(state.curveRealRange));
  $('#curveRangeToggle').textContent = state.curveRealRange
    ? t(`真实区间 0–${topScore}`, `Data range 0–${topScore}`)
    : t('全量程 0–100', 'Full 0–100');
  $('#curveScaleToggle').setAttribute('aria-pressed', String(state.curveLogY));
  $('#curveScaleToggle').textContent = state.curveLogY ? t('对数纵轴 ✓', 'Log Y ✓') : t('对数纵轴', 'Log Y');

  const hasScenario = !!(state.scenarioId && state.scenarioId !== 'default');
  const hasCostProf = !!(state.costProfile && state.costProfile !== 'benchmark');
  const hasFocus = !!(state.company || state.license !== 'all' || state.yLens || hasScenario || hasCostProf || state.extraFilter || state.search || state.starredOnly || state.frontierOnly || state.minScore > 0 || state.maxCost > 0);
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
    ? Number(!!state.company) + Number(state.license !== 'all') + Number(!!state.yLens) + Number(!!(state.scenarioId && state.scenarioId !== 'default')) + Number(!!(state.costProfile && state.costProfile !== 'benchmark')) + Number(!!state.extraFilter) + Number(!!state.search) + Number(!!state.starredOnly) + Number(state.frontierOnly) + Number(state.minScore > 0) + Number(state.maxCost > 0)
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
  const topActions = document.querySelector('.top-actions');
  const tabs = document.querySelector('.tabs');
  const footer = document.querySelector('.app-footer');
  const heading = document.querySelector('.panel-heading');
  let secBox = document.getElementById('mobileSecActions');
  if (!secBox) {
    secBox = html('div', null, 'mobile-secondary-actions');
    secBox.id = 'mobileSecActions';
  }
  const pickerEl = $('#pickerBtn');
  const guideEl = $('#guideBtn');
  const updateWrapEl = document.querySelector('.update-wrap');
  const shareEl = $('#shareBtn');
  const cmdEl = $('#cmdPaletteBtn');
  const langEl = $('#langToggle');

  if (mobileLayout.matches) {
    app.insertBefore(topbar, $('#chart-panel'));
    app.insertBefore(tabs, $('#chart-panel'));
    secBox.append(pickerEl, guideEl, updateWrapEl, shareEl);
    $('#controlPanel').insertBefore(heading, $('#toolbar'));
    $('#controlPanel').append(secBox, footer);
  } else {
    topActions.insertBefore(pickerEl, cmdEl);
    topActions.insertBefore(guideEl, cmdEl);
    topActions.insertBefore(updateWrapEl, langEl);
    topActions.insertBefore(shareEl, langEl);
    if (secBox.parentNode) secBox.remove();
    topbar.insertBefore(tabs, topActions);
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
  syncViewToolsControls();
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

  const pool = licenseFilteredRows(state.rows);
  const sourceRows = pool.length ? pool : state.rows;
  const sorted = sortRows(sourceRows, 'intelligenceIndex', 'desc');
  const routerCacheKey = `${activeKey}|${state.mediaTrack || ''}|${lang}|${state.yLens}|${state.scenarioId}|${state.costProfile}|${state.license}|${state.extraFilter}`;
  for (const [selId, key] of [['#routerFastSelect', 'routerFastId'], ['#routerStrongSelect', 'routerStrongId']]) {
    const sel = $(selId);
    if (sel.dataset.cacheKey !== routerCacheKey || sel.options.length !== sorted.length) {
      const frag = document.createDocumentFragment();
      for (const r of sorted) {
        const opt = html('option', `${r.shortName || r.name} (${format(r.intelligenceIndex, 1)} · ${money(r.cost)})`);
        opt.value = r.id;
        frag.append(opt);
      }
      sel.replaceChildren(frag);
      sel.dataset.cacheKey = routerCacheKey;
    }
    if (!sourceRows.some(r => r.id === state[key])) {
      state[key] = key === 'routerFastId'
        ? (sortRows(sourceRows, 'valuePerDollar', 'desc', 2)[0] || sorted.at(-1)).id
        : sorted[0].id;
    }
    sel.value = state[key];
  }

  $('#routerShare').value = state.routerShare;
  $('#routerShareOut').textContent = `${state.routerShare}% / ${100 - state.routerShare}%`;

  const fastRow = sourceRows.find(r => r.id === state.routerFastId) || sorted.at(-1);
  const strongRow = sourceRows.find(r => r.id === state.routerStrongId) || sorted[0];
  const res = cascadingRouteSummary(fastRow, strongRow, state.routerShare / 100, state.monthlyTasks);
  if (res) {
    const perUnit = activeKey === 'media'
      ? t(mediaTrackMeta(state.mediaTrack).zhPerUnit, mediaTrackMeta(state.mediaTrack).enPerUnit)
      : t('次', 'task');
    const subCmp = res.monthlyBlendedBill < state.subFee
      ? t(`比 $${state.subFee} 订阅省 ${compactMoney(state.subFee - res.monthlyBlendedBill)}/月`, `saves ${compactMoney(state.subFee - res.monthlyBlendedBill)} vs $${state.subFee}/mo`)
      : t(`较 $${state.subFee} 订阅高 +${compactMoney(res.monthlyBlendedBill - state.subFee)}，配额够用则订阅更省`, `+${compactMoney(res.monthlyBlendedBill - state.subFee)} vs $${state.subFee}/mo, sub wins if quota suffices`);
    $('#routerReadout').textContent = t(
      `混合均价 ${money(res.blendedCost)}/${perUnit}（较纯旗舰省 ${Math.round(Math.max(0, res.savingsVsStrong) * 100)}%）· 月账单 ${compactMoney(res.monthlyBlendedBill)} · ${subCmp}`,
      `Blended ${money(res.blendedCost)}/${perUnit} (−${Math.round(Math.max(0, res.savingsVsStrong) * 100)}% vs flagship) · ${compactMoney(res.monthlyBlendedBill)}/mo · ${subCmp}`
    );
  }
}

function syncSubControls() {
  const fee = state.subFee, tasks = state.monthlyTasks;
  const restored = fee === MONTHLY_USAGE.defaultFee && tasks === state.defaultTasks;
  const mediaMeta = activeKey === 'media' ? mediaTrackMeta(state.mediaTrack) : null;
  const unitZh = mediaMeta ? mediaMeta.zhSubUnit : '次';
  const unitEn = mediaMeta ? mediaMeta.enSubUnit : 'tasks';
  const perZh = mediaMeta ? mediaMeta.zhPerUnit : '任务';
  const perEn = mediaMeta ? mediaMeta.enPerUnit : 'task';
  $('#subFeeValue').value = fee;
  $('#monthlyTasks').value = Math.min(500, tasks);
  $('#monthlyTasksValue').value = tasks;
  $('#dailyTasksHint').textContent = t(`≈ ${format(tasks / 30, 1)} ${unitZh}/天`, `≈ ${format(tasks / 30, 1)}/day`);
  $('#resetSubInline').hidden = restored;

  for (const btn of document.querySelectorAll('#subTierGroup button')) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.fee) === fee));
  }
  for (const btn of document.querySelectorAll('#taskPresetGroup button')) {
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.tasks) === tasks));
  }

  $('#subThTierHint').textContent = t(`达 $${fee}/月`, `for $${fee}/mo`);
  $('#subThTasksHint').textContent = t(`${tasks} ${unitZh}/月`, `${tasks} ${unitEn}/mo`);

  const rows = filteredRows();
  const thresholdCost = fee / tasks;
  let apiCount = 0, subCount = 0, evenCount = 0;
  for (const row of rows) {
    const verdict = subscriptionVerdict(row.cost, tasks, fee);
    if (!verdict) continue;
    if (verdict.status === 'api-cheaper') apiCount++;
    else if (verdict.status === 'sub-cheaper') subCount++;
    else evenCount++;
  }
  const evenZh = evenCount > 0 ? `，${evenCount} 项约持平` : '';
  const evenEn = evenCount > 0 ? `, ${evenCount} near even` : '';
  $('#subBreakevenSummary').textContent = t(
    `盈亏平衡单价：${money(thresholdCost)}/${perZh} · 当前 ${subCount} 项买 $${fee}/月订阅已回本${evenZh}，${apiCount} 项未回本（按量 API 更省）`,
    `Break-even: ${money(thresholdCost)}/${perEn} · ${subCount} worth $${fee}/mo sub${evenEn}, ${apiCount} unmet (API cheaper)`
  );
  $('#subDisclaimer').textContent = mediaMeta
    ? t(mediaMeta.zhSubDisclaimer, mediaMeta.enSubDisclaimer)
    : t(
      '基于实测 API 单任务均价精确换算；官方订阅含 5 小时/周动态限流且不公开配额，「已回本」代表配额够用时买月订阅更划算。',
      'Derived from verified API cost per task; official plans enforce dynamic rate limits, so "Sub saves" holds when plan quota suffices.'
    );
  syncRouterControls();
}

function renderStatus() {
  const cfg = BENCHMARKS[activeKey];
  const mediaMeta = activeKey === 'media' ? mediaTrackMeta(state?.mediaTrack) : null;
  const version = activeKey === 'models' || activeKey === 'frontier'
    ? snapshot.modelIndexVersion
    : activeKey === 'coding-agents'
      ? snapshot.codingAgentIndexVersion
      : null;
  if (state?.mode === 'orgs') {
    $('#chartTitle').textContent = t('各测评机构独立原榜对照', 'Independent Evaluation Organization Leaderboards');
    $('#chartSubtitle').textContent = t(
      '6 份权威榜单原序原分呈现 · 悬停或点击任意模型跨机构同步高亮排名',
      '6 un-blended official org leaderboards · Hover or click any model to spotlight ranks across orgs'
    );
    $('#count').textContent = t(`${orgBoards.length} 份独立机构原榜`, `${orgBoards.length} org boards`);
  } else if (mediaMeta) {
    $('#chartTitle').textContent = t(mediaMeta.zhTitle, mediaMeta.enTitle);
    $('#chartSubtitle').textContent = t(mediaMeta.zhSub, mediaMeta.enSub);
    $('#count').textContent = `${state.rows.length} ${t(mediaMeta.zhUnit, mediaMeta.enUnit)}`;
  } else {
    $('#chartTitle').textContent = t(cfg.zhTitle, cfg.enTitle);
    $('#chartSubtitle').textContent = t(cfg.zhSub, cfg.enSub);
    $('#count').textContent = `${state.rows.length} ${t(cfg.zhUnit, cfg.enUnit)}${version ? ' · v' + version : ''}`;
  }

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
  if (state?.mode === 'orgs') {
    sourceFrag.append(
      makeLink('Artificial Analysis', 'https://artificialanalysis.ai/'),
      document.createTextNode(' · '),
      makeLink('LiveBench 2.0', snapshot.orgLeaderboards?.livebench?.sourceUrl || 'https://livebench.ai/'),
      document.createTextNode(' · '),
      makeLink('Arena.ai (LMArena)', snapshot.lmArenaSourceUrl || 'https://arena.ai/leaderboard'),
      document.createTextNode(' · '),
      makeLink('Design Arena', snapshot.designArenaSourceUrl || 'https://www.designarena.ai/leaderboard')
    );
  } else if (activeKey === 'human-arena') {
    sourceFrag.append(
      makeLink('Arena.ai (LMArena)', snapshot.lmArenaSourceUrl || 'https://arena.ai/leaderboard'),
      document.createTextNode(' + '),
      makeLink('Design Arena', snapshot.designArenaSourceUrl || 'https://www.designarena.ai/leaderboard'),
      document.createTextNode(' + '),
      makeLink('Artificial Analysis', 'https://artificialanalysis.ai/evaluations/gdpval-aa')
    );
  } else if (mediaMeta) {
    sourceFrag.append(makeLink(mediaMeta.sourceName, mediaMeta.sourceUrl));
  } else if ((activeKey === 'models' || activeKey === 'frontier') && snapshot.orgLeaderboards?.livebench) {
    sourceFrag.append(
      makeLink('Artificial Analysis', cfg.source),
      document.createTextNode(' + '),
      makeLink('LiveBench 2.0', snapshot.orgLeaderboards.livebench.sourceUrl || 'https://livebench.ai/')
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
  $('#costNote').textContent = state?.mode === 'orgs'
    ? t('各机构原榜严格保留官方原始排名与计分口径，绝不混算改序', 'Each org leaderboard preserves its exact official ranking & scoring methodology without blending')
    : mediaMeta
      ? t(mediaMeta.zhCostNote, mediaMeta.enCostNote)
      : t(cfg.zhCostNote, cfg.enCostNote);
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
  clearLasso();
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
    node('g', {class: 'active-layer'}),
    node('rect', {class: 'lasso-rect', style: 'display:none'})
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
  else if (state.mode === 'orgs') renderOrgLeaderboards();
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
  const defSpan = state.xMetric === 'time'
    ? BENCHMARKS[activeKey].defaultTimeMin
    : activeKey === 'media'
      ? mediaDefaultSpan(state)
      : BENCHMARKS[activeKey].defaultX;
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
  if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...state.compareIds];
  syncUrlHash();
  if (state.mode === 'table') renderTable();
  else if (state.mode === 'sub') renderSubTable();
  else if (state.mode === 'compare') renderCompare();
  renderPinned();
  updateSummary();
}

function toggleStar(row) {
  if (!row) return;
  const key = starKeyOf(row);
  if (!key) return;
  if (starredKeys.has(key)) starredKeys.delete(key);
  else starredKeys.add(key);
  saveStars();
  for (const st of states.values()) {
    if (st.starredOnly && !st.rows.some(isStarred)) st.starredOnly = false;
  }
  if (state) {
    syncUrlHash();
    syncControls();
    if (state.starredOnly) {
      buildPlot();
    } else {
      if (state.mode === 'table') renderTable();
      else if (state.mode === 'sub') renderSubTable();
      else if (state.mode === 'chart') scheduleDraw();
      renderPinned();
      updateSummary();
    }
  }
  if (cmdOpen) renderCmdList();
}

function makeStarRowBtn(row) {
  const on = isStarred(row);
  const btn = html('button', on ? '★' : '☆', 'locate-btn star-row-btn');
  btn.type = 'button';
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? t(`取消关注 ${row.name}`, `Unstar ${row.name}`) : t(`收藏关注 ${row.name}`, `Star ${row.name}`));
  btn.title = on ? t('已收藏常驻关注（点击取消）', 'Starred in watchlist (click to remove)') : t('加入本地 ★ 常驻关注', 'Add to local ★ watchlist');
  btn.addEventListener('click', event => {
    event.stopPropagation();
    toggleStar(row);
  });
  return btn;
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
  const hasAnyTime = fallbackRows.some(row => typeof row.timeSec === 'number' && Number.isFinite(row.timeSec) && row.timeSec > 0);
  const maxTime = hasAnyTime ? Math.max(...fallbackRows.map(row => row.timeSec || 0), 1) : 1;
  const comparableValues = fallbackRows
    .map(row => valuePerDollar(row, state.valueWeight, state.minScore, state.maxCost))
    .filter(value => value !== null);
  const maxValue = comparableValues.length ? Math.max(...comparableValues) : null;
  const valueRange = maxValue === null ? t('暂无', 'None') : `0–${valueLabel(maxValue)}`;
  const timeScaleZh = hasAnyTime ? ` · 耗时 0–${formatTime(maxTime)}` : '';
  const timeScaleEn = hasAnyTime ? ` · Time 0–${formatTime(maxTime)}` : '';

  $('#tableScale').textContent = t(
    `比较条比例（${scaleSource === pool && state.license === 'all' ? '全榜统一' : '当前筛选范围'}）：指数 0–100 · 成本 $0–${format(maxCost)}${timeScaleZh} · 性价比 ${valueRange}`,
    `Linear bar scale (${scaleSource === pool && state.license === 'all' ? 'full benchmark' : 'filtered set'}): Index 0–100 · Cost $0–${format(maxCost)}${timeScaleEn} · Value ${valueRange}`
  );

  const {idSet: frontierIds} = activeFrontierSet();
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
      runNavAction(() => locateRowInChart(row));
    });
    const actGroup = html('span', null, 'row-actions');
    actGroup.append(locateBtn, makeCompareRowBtn(row), makeStarRowBtn(row));
    wrap.append(actGroup);
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
    const td = html('td');
    td.colSpan = 6;
    td.append(makeEmptyResetNotice('没有匹配的条目，请调整搜索词或清除筛选。', 'No matching entries. Try clearing filters.'));
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
  const fragment = document.createDocumentFragment();
  const {idSet: frontierIds} = activeFrontierSet();
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
      runNavAction(() => locateRowInChart(row));
    });
    const actGroup = html('span', null, 'row-actions');
    actGroup.append(locateBtn, makeCompareRowBtn(row), makeStarRowBtn(row));
    wrap.append(actGroup);
    nameTd.append(wrap);

    const costTd = html('td', money(row.cost));
    costTd.style.fontVariantNumeric = 'tabular-nums';

    const verdict = subscriptionVerdict(row.cost, tasks, fee);
    const beRatio = verdict ? Math.min(1, Math.min(500, verdict.breakeven) / maxBe) : 0;
    const beTd = comparisonCell(verdict ? formatTaskCount(verdict.breakeven, row) : '—', beRatio, displayColor);
    beTd.title = tierBreakevenText(row.cost, row);

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
    const td = html('td');
    td.colSpan = 5;
    td.append(makeEmptyResetNotice('没有匹配的条目，请调整搜索词或清除筛选。', 'No matching entries. Try clearing filters.'));
    const tr = html('tr');
    tr.append(td);
    fragment.append(tr);
  }
  $('#subTableBody').replaceChildren(fragment);

  for (const button of document.querySelectorAll('.sub-sort-button')) {
    const selected = button.dataset.subSort === state.subSortKey;
    button.closest('th').setAttribute('aria-sort', selected ? (state.subSortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
    button.querySelector('.sort-arrow').textContent = selected ? (state.subSortDirection === 'asc' ? '↑' : '↓') : '↕';
  }
}

function exportCsv() {
  if (!state) return;
  const escapeCsv = val => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  if (activeKey === 'orgs' || state.mode === 'orgs') {
    const activeBoard = orgBoards.find(b => b.id === orgFocus) || null;
    const targetBoards = activeBoard ? [activeBoard] : orgBoards;
    const headers = ['Org', 'Board', 'Date', 'Rank', 'Model', 'RawEntry', 'Creator', 'Score', 'CostUSD', 'MatchType', 'MatchedModel'];
    const lines = [headers.join(',')];
    for (const b of targetBoards) {
      for (const r of filterOrgRows(b.rows)) {
        const matchType = r.modelId ? 'Exact' : (r.siblingId || r.cyberId) ? 'Sibling' : 'OrgOnly';
        const matchedName = r.modelId ? r.name : (r.siblingName || r.cyberName || '');
        lines.push([
          b.orgEn,
          b.titleEn,
          b.date || '',
          r.rank,
          orgDisplayName(r),
          r.rawName || r.name,
          r.creator || '',
          typeof r.score === 'number' ? r.score.toFixed(b.scoreDecimals) : '',
          r.lbCost ?? r.cost ?? '',
          matchType,
          matchedName
        ].map(escapeCsv).join(','));
      }
    }
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intelligence-vs-cost-orgs-${activeBoard ? activeBoard.id : 'all'}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const rawRows = filteredRows();
  let rows;
  if (state.mode === 'sub') {
    const collator = new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'});
    const sign = state.subSortDirection === 'asc' ? 1 : -1;
    rows = [...rawRows].sort((a, b) => {
      let primary = 0;
      if (state.subSortKey === 'name') primary = collator.compare(a.name, b.name);
      else if (state.subSortKey === 'intelligenceIndex') primary = a.intelligenceIndex - b.intelligenceIndex;
      else if (state.subSortKey === 'cost' || state.subSortKey === 'apiBill') primary = a.cost - b.cost;
      else if (state.subSortKey === 'breakeven') {
        primary = (breakEvenTasks(a.cost, state.subFee) ?? Infinity) - (breakEvenTasks(b.cost, state.subFee) ?? Infinity);
      }
      return primary * sign || collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
    });
  } else {
    rows = sortRows(rawRows, state.sortKey, state.sortDirection, state.valueWeight, state.minScore, state.maxCost);
  }
  const {rankMap, qualifiedCount} = computeRankings();
  const headers = [
    'Name',
    'Creator',
    'Starred',
    'License',
    'Effort',
    'ReleaseDate',
    'Score_0_100',
    'CostPerUnitUSD',
    'MeanTimeSec',
    ...(activeKey === 'models' ? ['MMMU_Pro_Pct', 'MLCR_LongCtx_Pct', 'Omniscience_Acc_Pct', 'Hallucination_Guess_Pct', 'LiveBench2_Overall', 'LiveBench2_CostUSD'] : []),
    ...(activeKey === 'frontier' ? ['AA_OverallIndex', 'HardRankDelta', 'GDP_PDF_AllPass_Pct', 'FrontierCode2_Pct', 'MLCR_Pct', 'IT_Bench_SRE_Pct', 'LiveBench2_Overall'] : []),
    ...(activeKey === 'human-arena' ? ['ArenaAI_ChatElo', 'ArenaAI_WebDevElo', 'DesignArena_WebElo', 'AA_GDPvalElo', 'AntiSlop_Pct', 'AA3D_Elo', 'Code2Video_Elo'] : []),
    ...(activeKey === 'coding-agents' ? ['AgentHarness', 'BaseModel', 'CostP50_USD', 'CostP95_USD', 'CacheHit_Pct'] : []),
    ...(activeKey === 'cyber' ? ['SafetyRefusalPct'] : []),
    ...(activeKey === 'media' ? ['MediaTrack', 'BillingUnit', 'TrackValueRank', 'T2I_Elo', 'ImageEdit_Elo', 'T2V_Elo', 'I2V_Elo', 'TTS_Elo', 'TTS_TTFA_ms'] : []),
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
    const rInfo = rankMap.get(row.id);
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
      isStarred(row) ? 'Yes' : '',
      row.isOpenWeights ? 'Open Weights' : 'Proprietary',
      row.effort?.label || '',
      row.releaseDate || '',
      row.intelligenceIndex.toFixed(4),
      row.cost.toFixed(6),
      row.timeSec ?? '',
      ...(activeKey === 'models' ? [
        row.subscores?.mmmuPro ?? '',
        row.subscores?.mlcr ?? '',
        row.subscores?.omniscience ?? '',
        row.subscores?.hallucination ?? '',
        row.livebench?.overall ?? '',
        row.livebench?.lbCost ?? ''
      ] : []),
      ...(activeKey === 'frontier' ? [
        row.aaIndex ?? '',
        row.rankDelta ?? '',
        row.frontierScores?.gdpPdf ?? '',
        row.frontierScores?.frontierCode ?? '',
        row.frontierScores?.mlcr ?? '',
        row.frontierScores?.itBenchSre ?? '',
        row.livebench?.overall ?? ''
      ] : []),
      ...(activeKey === 'human-arena' ? [
        row.arenaRaw?.chatElo ?? '',
        row.arenaRaw?.webdevElo ?? '',
        row.arenaRaw?.designWebElo ?? '',
        row.arenaRaw?.gdpvalElo ?? '',
        row.humanScores?.antiSlop ?? '',
        row.arenaRaw?.aa3dElo ?? '',
        row.arenaRaw?.code2videoElo ?? ''
      ] : []),
      ...(activeKey === 'coding-agents' ? [
        row.agentName ?? '',
        row.modelName ?? '',
        row.costPercentiles?.p50 ?? '',
        row.costPercentiles?.p95 ?? '',
        row.agentStats?.cacheHitRate ?? ''
      ] : []),
      ...(activeKey === 'cyber' ? [row.refusalRate ?? ''] : []),
      ...(activeKey === 'media' ? [
        row.mediaKind ?? '',
        row.mediaRaw?.unitEn?.replace(/^\/\s*/, '') ?? '',
        rInfo ? `${rInfo.rank}/${qualifiedCount}` : '',
        row.mediaRaw?.t2iElo ?? '',
        row.mediaRaw?.imgEditElo ?? '',
        row.mediaRaw?.t2vElo ?? '',
        row.mediaRaw?.i2vElo ?? '',
        row.mediaRaw?.ttsElo ?? '',
        row.mediaRaw?.ttfaMs ?? ''
      ] : []),
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
  const exportSlug = activeKey === 'media' ? `media-${state.mediaTrack || 'image'}` : activeKey;
  link.download = `intelligence-vs-cost-${exportSlug}.csv`;
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
  const isBump = (kind === 'orgs' || activeKey === 'orgs') && orgFocus === 'bump';
  const targetSvg = isBump ? $('#orgContent .org-bump-svg') : kind === 'curve' ? $('#curveSvg') : kind === 'compare' ? $('#radarSvg') : $('#svg');
  const vb = targetSvg?.getAttribute('viewBox')?.split(/\s+/).map(Number);
  if (!vb || vb.length !== 4 || !(vb[2] > 0 && vb[3] > 0)) return;
  const [, , svgW, svgH] = vb;

  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim() || '#888';
  const clone = targetSvg.cloneNode(true);
  clone.querySelector('.lasso-rect')?.remove();
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
    .star-ring { fill: none; stroke: ${v('--amber')}; stroke-width: 1.7; stroke-dasharray: 2.5 2; }
    .pin-guides { stroke-width: 1; stroke-dasharray: 4 4; opacity: 0.7; fill: none; }
    .pin-ring { stroke-width: 2.2; fill: none; }
    .emphasis-marker { stroke: ${v('--halo')}; stroke-width: 1.6; }
    .emphasis-connector { stroke-width: 1.25; }
    .emphasis-label { font-weight: 600; stroke: ${v('--halo')}; stroke-width: 2.8px; paint-order: stroke; }
    .champion-ring { stroke: ${v('--accent')}; stroke-width: 2; stroke-dasharray: 3 2; fill: none; }
    .curve-champion-label { fill: ${v('--accent')}; font-size: 11.5px; font-weight: 600; }
    .utility-line { fill: none; stroke: ${v('--accent')}; stroke-width: 2.5; }
    .utility-reference { fill: none; stroke: ${v('--muted')}; stroke-width: 1.5; stroke-dasharray: 6 5; }
    .utility-area { fill: ${v('--accent')}; opacity: 0.08; }
    .curve-probe path { stroke: ${v('--accent')}; stroke-width: 1; stroke-dasharray: 3 4; }
    .curve-probe circle { fill: ${v('--accent')}; stroke: ${v('--chart')}; stroke-width: 2; }
    .radar-grid, .radar-spoke { fill: none; stroke: ${v('--border-strong')}; stroke-width: 1; opacity: 0.72; }
    .radar-ring-fill { fill: ${v('--chart')}; opacity: 0.42; }
    .radar-inner-floor { fill: ${v('--surface')}; fill-opacity: 0.55; stroke: ${v('--accent')}; stroke-width: 1.15; stroke-dasharray: 4 3; opacity: 0.82; }
    .strip-lane { fill: ${v('--chart')}; stroke: ${v('--border')}; stroke-width: 1; }
    .strip-rail { stroke: ${v('--border-strong')}; stroke-width: 1.2; opacity: 0.72; }
    .strip-tick-line { stroke: ${v('--border-strong')}; stroke-width: 1; opacity: 0.65; }
    .strip-span-bar { stroke: ${v('--border-strong')}; stroke-width: 4.5; stroke-linecap: round; opacity: 0.85; }
    .strip-leader-ring { fill: none; stroke: ${v('--accent')}; stroke-width: 1.6; stroke-dasharray: 2.5 2; }
    .delta-zero-line { stroke: ${v('--frame')}; stroke-width: 1.35; }
    .delta-grid-line { stroke: ${v('--border-strong')}; stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.55; }
    .delta-header-text { font-size: 10.8px; font-weight: 600; }
    .delta-val-label { font-size: 10.4px; font-weight: 600; stroke: ${v('--halo')}; stroke-width: 2.6px; paint-order: stroke; }
    .radar-axis-label { fill: ${v('--ink')}; font-size: 12.5px; font-weight: 600; }
    .radar-axis-sub { fill: ${v('--accent')}; font-size: 11px; font-weight: 500; }
    .radar-svg.has-focus .radar-series:not(.is-focused) { opacity: 0.18; }
    .radar-series.is-focused polygon, .radar-series.is-focused path, .radar-series.is-focused line { stroke-width: 3.4; fill-opacity: 0.25; }
    .radar-vertex-val { font-size: 11px; font-weight: 600; stroke: ${v('--halo')}; stroke-width: 3px; paint-order: stroke; }
    .bump-guide { stroke: ${v('--grid')}; stroke-width: 1; }
    .bump-guide-major { stroke: ${v('--border-strong')}; stroke-width: 1; stroke-dasharray: 4 4; }
    .bump-rank-tick { fill: ${v('--muted')}; font-size: 10.5px; }
    .bump-col-line { stroke: ${v('--border')}; stroke-width: 1; stroke-dasharray: 2 3; }
    .bump-col-title { fill: ${v('--ink')}; font-size: 12.5px; font-weight: 600; }
    .bump-col-sub { fill: ${v('--muted')}; font-size: 10.5px; }
    .bump-series.is-dimmed { opacity: 0.18; }
    .bump-hit { fill: none; stroke: none; }
    .bump-line { fill: none; stroke-width: 2.2; stroke-linecap: round; opacity: 0.85; }
    .bump-line.is-gap { stroke-dasharray: 4 4; opacity: 0.52; }
    .bump-series.is-hover-spot .bump-line, .bump-series.is-pinned-spot .bump-line { stroke-width: 3.4; opacity: 1; }
    .bump-dot { stroke-width: 1.8; }
    .bump-series.is-pinned-spot .bump-dot { stroke: ${v('--amber')}; stroke-width: 2.5; }
    .bump-dot.is-family { stroke-dasharray: 2.5 2; }
    .bump-dot-num { fill: ${v('--chart')}; font-size: 9.5px; font-weight: 700; }
    .bump-dot-num.is-family { font-weight: 600; }
    .bump-lbl-leader { stroke-width: 1; opacity: 0.45; stroke-dasharray: 2 2; }
    .bump-end-lbl { font-size: 11.5px; font-weight: 500; }
    .bump-series.is-hover-spot .bump-end-lbl, .bump-series.is-pinned-spot .bump-end-lbl { font-weight: 700; }
    .bump-callout { opacity: 0; }
    .bump-series.is-hover-spot .bump-callout, .bump-series.is-pinned-spot .bump-callout { opacity: 1; }
    .bump-callout rect { fill: ${v('--surface-elevated')}; stroke-width: 1.1; }
    .bump-series.is-pinned-spot .bump-callout rect { stroke: ${v('--amber')}; stroke-width: 1.6; }
    .bump-callout text { fill: ${v('--ink')}; font-size: 10px; font-weight: 600; }
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

    const maxTextW = outW - padX * 2;
    ctx.fillStyle = v('--ink');
    ctx.font = '600 16px "IBM Plex Sans", "Segoe UI", sans-serif';
    const titleStr = isBump
      ? t('跨测评机构独立排名轨迹图（Bump Chart）', 'Cross-Organization Official Rank Trajectory')
      : kind === 'compare' ? $('#radarHeading').textContent : $('#chartTitle').textContent;
    ctx.fillText(titleStr, padX, 28, maxTextW);

    ctx.fillStyle = v('--muted');
    ctx.font = '400 12px "IBM Plex Sans", "Segoe UI", sans-serif';
    ctx.fillText($('#viewStatus').textContent || '', padX, 46, maxTextW);

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

    const srcFoot = isBump
      ? 'Artificial Analysis + LiveBench 2.0 + Arena.ai (LMArena) + Design Arena'
      : activeKey === 'human-arena'
        ? 'Arena.ai (LMArena) + Design Arena + Artificial Analysis'
        : activeKey === 'media'
          ? `Artificial Analysis · ${mediaTrackMeta(state.mediaTrack).sourceName}`
          : state.yLens === 'livebench' || state.yLens === 'lbLongAgentic' || state.radarMode === 'livebench'
            ? 'LiveBench 2.0 + Artificial Analysis'
            : 'Artificial Analysis';
    ctx.fillStyle = v('--muted');
    ctx.font = '400 11.5px "IBM Plex Sans", "Segoe UI", sans-serif';
    ctx.fillText(`${srcFoot} · Intelligence vs. Cost (${new Date().toISOString().slice(0, 10)})`, padX, outH - 11, maxTextW);

    canvas.toBlob(pngBlob => {
      URL.revokeObjectURL(url);
      if (!pngBlob) return;
      const dlUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = dlUrl;
      const exportSlug = activeKey === 'media' ? `media-${state.mediaTrack || 'image'}` : activeKey;
      a.download = isBump ? 'intelligence-vs-cost-orgs-bump.png' : `intelligence-vs-cost-${exportSlug}-${kind}.png`;
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
  const svgEl = $('#radarSvg');
  const rect = svgEl?.getBoundingClientRect();
  const vb = svgEl?.getAttribute('viewBox')?.split(/\s+/).map(Number);
  if (!rect || !rect.width || !rect.height || !vb || vb.length !== 4) return null;
  return {
    x: ((event.clientX - rect.left) / rect.width) * vb[2],
    y: ((event.clientY - rect.top) / rect.height) * vb[3]
  };
}

function hitTestRadar(sx, sy) {
  if (!radarCtx) return null;
  const {visMode = 'radar', verticesBySeries, lanes = [], deltaBars = []} = radarCtx;

  if (visMode === 'strip') {
    const nearDots = [];
    verticesBySeries.forEach((verts, sIdx) => {
      verts.forEach((v, aIdx) => {
        if (!v || v.val === null) return;
        const d = Math.hypot(sx - v.x, sy - v.y);
        if (d <= 15) nearDots.push({sIdx, aIdx, d, x: v.x, y: v.y, val: v.val});
      });
    });
    if (nearDots.length) {
      nearDots.sort((a, b) => a.d - b.d || a.sIdx - b.sIdx);
      const top = nearDots[0];
      const cluster = nearDots.filter(m => m.aIdx === top.aIdx && m.d <= top.d + 5.5);
      const pinnedIdx = state?.radarPinnedId ? radarCtx.selectedRows.findIndex(r => r.id === state.radarPinnedId) : -1;
      const chosen = cluster.find(m => m.sIdx === pinnedIdx) || top;
      return {kind: 'vertex', seriesIdx: chosen.sIdx, axisIdx: top.aIdx, cluster};
    }
    const lane = lanes.find(l => sy >= l.top && sy <= l.bottom);
    if (lane) return {kind: 'axis', seriesIdx: null, axisIdx: lane.axisIdx, cluster: null};
    return null;
  }

  if (visMode === 'delta') {
    for (const b of deltaBars) {
      if (sx >= b.x0 && sx <= b.x1 && sy >= b.y0 && sy <= b.y1) {
        return {kind: 'bar', seriesIdx: b.sIdx, axisIdx: b.aIdx, cluster: null};
      }
    }
    const lane = lanes.find(l => sy >= l.top && sy <= l.bottom);
    if (lane) return {kind: 'axis', seriesIdx: null, axisIdx: lane.axisIdx, cluster: null};
    return null;
  }

  const {cx, cy, axisEndpoints} = radarCtx;

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
  const {visMode = 'radar', selectedRows, seriesLayer, calloutLayer, verticesBySeries, axes, stripLeaders = [], baseLabel = '', scaleMin = 0} = radarCtx;
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

  // Render crisp vertex/strip score badges
  const metricUnit = m => (m?.unit !== undefined ? m.unit : '%');
  calloutLayer.replaceChildren();
  if (visMode === 'radar' && activeIdx >= 0 && verticesBySeries[activeIdx]) {
    const sc = compareColor(activeIdx);
    verticesBySeries[activeIdx].forEach((v, vIdx) => {
      if (!v || v.val === null) return;
      const radialShift = v.ratio > 0.82 ? -13 : 12;
      const tx = v.x + Math.cos(v.ang) * radialShift;
      const ty = v.y + Math.sin(v.ang) * radialShift + 3.5;
      calloutLayer.append(node('text', {
        class: 'radar-vertex-val',
        x: tx,
        y: ty,
        fill: sc,
        'text-anchor': 'middle'
      }, `${format(v.val, 1)}${metricUnit(axes[vIdx])}`));
    });
  } else if (visMode === 'strip') {
    if (activeIdx >= 0 && verticesBySeries[activeIdx]) {
      const sc = compareColor(activeIdx);
      verticesBySeries[activeIdx].forEach((v, vIdx) => {
        if (!v || v.val === null) return;
        const tx = Math.max(178, Math.min(542, v.x));
        const ty = v.y - 9;
        calloutLayer.append(node('text', {
          class: 'radar-vertex-val',
          x: tx,
          y: ty,
          fill: sc,
          'text-anchor': 'middle'
        }, `#${v.rank} · ${format(v.val, 1)}${metricUnit(axes[vIdx])}`));
      });
    } else {
      for (const ld of stripLeaders) {
        const u = metricUnit(axes[ld.axisIdx]);
        if (ld.best) {
          calloutLayer.append(node('text', {
            class: 'radar-vertex-val',
            x: Math.min(548, ld.best.x),
            y: ld.best.y - 9,
            fill: compareColor(ld.best.sIdx),
            'text-anchor': 'middle'
          }, `${format(ld.best.val, 1)}${u}`));
        }
        if (ld.worst && ld.best && Math.abs(ld.best.x - ld.worst.x) >= 44) {
          calloutLayer.append(node('text', {
            class: 'radar-vertex-val',
            x: Math.max(172, ld.worst.x),
            y: ld.worst.y - 9,
            fill: 'var(--muted)',
            'text-anchor': 'middle'
          }, `${format(ld.worst.val, 1)}${u}`));
        }
      }
    }
  }

  // Sync chip states
  document.querySelectorAll('#compareChips .compare-chip').forEach((chip, idx) => {
    chip.classList.toggle('is-pinned', idx === pinnedIdx);
    chip.classList.toggle('is-focused', idx === activeIdx);
  });

  // Sync spoke/lane, axis label & score card highlights
  radarSvg.querySelectorAll('.radar-spoke').forEach((sp, i) => {
    sp.classList.toggle('is-axis-active', axes[i]?.key === hoverAxisKey);
  });
  radarSvg.querySelectorAll('.strip-lane').forEach((ln, i) => {
    ln.classList.toggle('is-axis-active', axes[i]?.key === hoverAxisKey);
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
        `已锁定置顶：${pName} · 单击空白处或按 Esc 解锁`,
        `Locked on top: ${pName} · Click blank space or press Esc to unlock`
      );
    } else if (visMode === 'strip') {
      hintEl.textContent = t(
        '每条水平跑道独立聚焦模型分差区间，将细微差距放大数倍 · 悬浮或单击圆点查看排名与单项差距',
        'Each horizontal track zooms into the active score range to magnify subtle frontier gaps · Click any dot to lock'
      );
    } else if (visMode === 'delta') {
      hintEl.textContent = t(
        `中央 0 轴 = ${baseLabel} · 向右为领先 (+Δ)，向左为落后 (−Δ) · 右上方可随时切换对比基准模型`,
        `Center 0 = ${baseLabel} · Right = ahead (+Δ), Left = behind (−Δ) · Switch reference baseline anytime above`
      );
    } else if (state.radarScale === 'axis') {
      hintEl.textContent = t(
        '分轴极值归一化：每根辐条按各自最低–最高分独立拉伸（轴名下方标注真实区间），彻底消除跨测试分数段压缩',
        'Per-axis normalized: each spoke stretches its own [min–max%] spread (shown under spoke labels)'
      );
    } else if (scaleMin > 0) {
      const floorUnit = axes.every(a => (a?.unit !== undefined ? a.unit : '%') === '%') ? '%' : '';
      hintEl.textContent = t(
        `微距去底雷达（内圈虚线 = ${scaleMin}${floorUnit} 起点）：剥离圆心空白死区放大前沿差距 · 也可切换上方「微距跑道」或「胜负分差 Δ」`,
        `Zoomed radar (dashed inner ring = ${scaleMin}${floorUnit} floor) · Switch to "Dot Strip" or "Delta Δ" above for horizontal precision`
      );
    } else {
      hintEl.textContent = t(
        '线条与顶点支持穿透拾取 · 单击锁定置顶 · 细微差距建议点击上方「微距跑道」或「胜负分差 Δ」',
        'Piercing hit-test · Click line or chip to lock · Try "Dot Strip" or "Delta Δ" above to inspect close gaps'
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

  const ordered = selectedRows
    .map((row, idx) => ({row, idx, val: metric.get(row)}))
    .sort((a, b) => {
      if ((a.val === null) !== (b.val === null)) return a.val === null ? 1 : -1;
      if (a.val === null) return a.idx - b.idx;
      return metric.lowerBetter ? a.val - b.val : b.val - a.val;
    });

  ordered.forEach(({row, idx, val}) => {
    const line = html('div', null, 'tip-value');
    const left = html('span');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = compareColor(idx);
    dot.style.marginRight = '6px';
    left.append(dot, document.createTextNode(row.shortName || row.name));
    if (idx === focusSeriesIdx) left.style.fontWeight = '600';

    const mUnit = metric?.unit !== undefined ? metric.unit : '%';
    let textVal = val === null ? '—' : `${format(val, 1)}${mUnit}`;
    if (metric.key === 'hallucination' && val !== null && row.subscores?.omniscience != null) {
      const totalWrong = ((100 - row.subscores.omniscience) * val) / 100;
      textVal += t(`（全题错答 ${format(totalWrong, 1)}%）`, ` (${format(totalWrong, 1)}% total)`);
    } else if (val !== null && bestVal !== null && selectedRows.length > 1) {
      const diff = val - bestVal;
      if (Math.abs(diff) >= 0.05) {
        textVal += ` (${diff > 0 ? '+' : ''}${format(diff, 1)})`;
      }
    }
    const right = html('b', textVal);
    if (val !== null && bestVal !== null && selectedRows.length > 1 && Math.abs(val - bestVal) < 1e-6) {
      right.style.color = 'var(--accent)';
    }
    line.append(left, right);
    tip.append(line);
  });

  if (clusterCount > 1) {
    tip.append(html('span', t(`该处有 ${clusterCount} 个模型重合，单击可依次轮换置顶`, `${clusterCount} models overlap here — click to cycle`), 'tip-foot'));
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
  btn.textContent = radarInfoOpen ? t('收起口径', 'Hide sources') : t('指标口径', 'Sources');
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
  if ((activeKey === 'models' || activeKey === 'frontier') && state?.radarMode === 'livebench') {
    const p1 = html('p');
    p1.append(
      html('strong', t('LiveBench 2.0 防污染长程实测来源：', 'LiveBench 2.0 Contamination-Free Evaluation: ')),
      document.createTextNode(t(
        '完全独立于 Artificial Analysis，由 Abacus.AI / LiveBench 学术团队定期轮换全新考题并采用客观程序自动判分（非 LLM-as-a-Judge）。官方加权总分权重：长程智能体 (Long Agentic) ×2、真实编程 (Coding) ×1.5、视觉设计 (Design) ×1.5，其余深度推理、网页浏览、数据分析、深度研究各 ×1。详见 ',
        'Completely independent from Artificial Analysis — periodically refreshed questions with objective programmatic grading (no LLM-as-a-Judge). Official overall weighting: Long Agentic ×2, Coding ×1.5, Design ×1.5, plus Reasoning, Browser, Data Analysis & Research ×1 each. See '
      )),
      extLink('LiveBench 2.0 Official Leaderboard', snapshot?.orgLeaderboards?.livebench?.sourceUrl || 'https://livebench.ai/'),
      document.createTextNode('。')
    );
    frag.append(p1);
  } else if (activeKey === 'frontier') {
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
      extLink('Arena.ai (LMArena) Style-Controlled & WebDev', 'https://arena.ai/leaderboard'),
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
      html('strong', t('四大独立支柱均衡配权 + 2026 真实中位标尺校准：', 'Balanced 4-Pillar Weighting & 2026 Median-Centered Calibration: ')),
      document.createTextNode(t(
        '总分按 4 大独立信号均衡合成，防止单一众包平台占比过高导致“套话讨好型”模型虚高：① 视觉与创意审美（30%）：完整保留 Design Arena 全部 5 维（Website、UI、DataViz、GameDev、SVG，占 72%）+ AA-3D 与 Code2Video 空间动效（28%）；② 交流人味与自然度（25%）：Arena.ai 去水份聊天/文档（65%）+ PersonalityBench Anti-Slop 去 AI 套话分（35%）；③ 专家真实交付（25%）：GDPval + Briefcase 44 职业盲评；④ 前端交互实操（20%）：Arena.ai WebDev。各分池 Elo 均按 2026 全榜真实中位数对齐至 50 分锚点、顶尖旗舰落在 78–86 分，并对低样本场次施加温和贝叶斯收缩。',
        'The headline index balances 4 independent pillars so no single crowd arena dominates: (1) Visual, Creative & Spatial (30%): all 5 Design Arena suites (Website, UI, DataViz, GameDev, SVG at 72%) + AA-3D & Code2Video (28%); (2) Chat Vibe & Naturalness (25%): Arena.ai style-controlled Chat/Doc (65%) + PersonalityBench Anti-Slop (35%); (3) Expert Deliverables (25%): GDPval + Briefcase; (4) Interactive WebDev (20%): Arena.ai WebDev. Every Elo pool is calibrated to its 2026 empirical median (~50) with SOTA around 78–86 and mild low-sample Bayes shrinkage.'
      ))
    );
    const p3 = html('p');
    p3.append(
      html('strong', t('为什么众包网页盲测（Design Arena）有时与个人主观设计品味存在温差？', 'Why Can Crowd HTML Arenas Diverge from Editorial Taste? ')),
      document.createTextNode(t(
        '在 15 秒众包双盲投票中，大众往往优先奖励「按钮交互全能点、信息密度高、不报错」的工业风 B 端卡片模板，而未必惩罚千篇一律的 AI 套路感；相比之下，44 职业人类专家深度审阅 Word/PPT/报告版式的 GDPval 与去长文水分的 Arena.ai (LMArena) 更能反映细腻审美与人味——您可随时用上方「纵轴切换」或「机构分榜」单独查看纯人味与各机构原榜。',
        'In 15-second crowd HTML battles, voters heavily reward functional JS interactivity and dense SaaS dashboards even when typography feels generic. By contrast, expert-graded GDPval deliverables and style-controlled Arena.ai (LMArena) chat better capture editorial polish and natural tone — use the Y-axis lens selector or Org Ranks view to inspect each independently.'
      ))
    );
    frag.append(p1, p2, p3);
  } else if (activeKey === 'media') {
    const track = state?.mediaTrack || 'image';
    const meta = mediaTrackMeta(track);
    const p1 = html('p');
    p1.append(
      html('strong', t('当前独立赛道数据来源：', 'Isolated Arena Source: ')),
      document.createTextNode(t(
        '本赛道数据 100% 同步自 Artificial Analysis 真人双盲竞技场 ',
        '100% sourced from the Artificial Analysis blind human arena '
      )),
      extLink(meta.sourceName, meta.sourceUrl),
      document.createTextNode(
        track === 'image'
          ? t('（覆盖文生图 T2I 与指令修图 Image Editing 双盲投票，按该池真实 Elo 校准至 0–100 胜率分）。', ' (Text-to-Image & Image Editing blind votes, calibrated from raw Elo to 0–100).')
          : track === 'video'
            ? t('（覆盖文生视频 T2V、图生视频 I2V 与视频编辑双盲投票，按该池真实 Elo 校准至 0–100 胜率分）。', ' (Text-to-Video, Image-to-Video & Video Editing blind votes, calibrated from raw Elo to 0–100).')
            : t('（覆盖真人盲听语音自然度 Elo、首包音频延迟 TTFA 与实测合成速度）。', ' (blind human listening Elo, time-to-first-audio TTFA & measured synthesis throughput).')
      )
    );
    const p2 = html('p');
    p2.append(
      html('strong', t('同口径独立比较原则：', 'Strict Within-Track Comparability: ')),
      document.createTextNode(t(
        '图像（$/张）、视频（$/5秒）与语音合成（$/千字）计费单位与盲测 Elo 池完全不同，因此本页严格拆分为三条独立赛道，绝不跨赛道混排比较。可用上方赛道条一键切换。',
        'Image ($/img), Video ($/5s clip), and Speech TTS ($/1k chars) have incompatible billing units and Elo pools, so each track is strictly isolated—switch tracks anytime using the top track bar.'
      ))
    );
    frag.append(p1, p2);
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
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const pool = sortRows(licenseFilteredRows(state.rows), 'intelligenceIndex', 'desc');
  const filtered = tokens.length
    ? pool.filter(r => {
      const blob = rowSearchBlob(r);
      return tokens.every(tk => blob.includes(tk));
    })
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
    const mUnit = m?.unit !== undefined ? m.unit : '%';
    const vals = selectedRows.map(r => {
      const v = m.get(r);
      return v === null ? '—' : `${format(v, 1)}${mUnit}`;
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
  const syncCandidates = !['coding-agents', 'media'].includes(activeKey) && Array.isArray(lastModelCompareIds)
    ? lastModelCompareIds.filter(id => rowMap.has(id))
    : [];
  $('#compareSyncBtn').hidden = !(syncCandidates.length >= 1 && syncCandidates.join(',') !== state.compareIds.join(','));
  if (comparePickerOpen) renderComparePicker();

  // 2. Hero Centerpiece Capability Radar & Compact Score Strip
  $('#radarModeSwitch').hidden = activeKey === 'coding-agents' || activeKey === 'media';
  const showLbRadarBtn = (activeKey === 'models' || activeKey === 'frontier') && selectedRows.some(r => r.livebench);
  $('#radarModeLiveBench').hidden = !showLbRadarBtn;
  if (!showLbRadarBtn && state.radarMode === 'livebench') state.radarMode = 'bench';
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
  $('#radarModeBench').setAttribute('aria-pressed', String(state.radarMode !== 'domain' && state.radarMode !== 'livebench'));
  $('#radarModeDomain').setAttribute('aria-pressed', String(state.radarMode === 'domain'));
  $('#radarModeLiveBench').setAttribute('aria-pressed', String(state.radarMode === 'livebench'));
  renderRadarInfo();

  let axes, barMetrics;
  if ((activeKey === 'models' || activeKey === 'frontier') && state.radarMode === 'livebench') {
    $('#radarHeading').textContent = t('LiveBench 2.0 七维防污染长程实测雷达', 'LiveBench 2.0 7-Suite Contamination-Free Radar');
    axes = [
      {key: 'longAgentic', zh: '长程智能体 (×2)', en: 'Long Agentic (×2)', srcZh: 'LiveBench 2.0 Long Agentic · 多轮工具调用、跨步长程代理规划（官方加权权重 ×2）', srcEn: 'LiveBench 2.0 Long Agentic · Multi-step tool & planning agent suite (weight ×2)', get: r => r.livebench?.longAgentic ?? null},
      {key: 'reasoning', zh: '深度推理', en: 'Reasoning', srcZh: 'LiveBench 2.0 Reasoning · 定期轮换防污染数理逻辑推理题集', srcEn: 'LiveBench 2.0 Reasoning · Contamination-free logic & math reasoning', get: r => r.livebench?.reasoning ?? null},
      {key: 'coding', zh: '真实编程 (×1.5)', en: 'Coding (×1.5)', srcZh: 'LiveBench 2.0 Coding · 实时防污染代码生成与排障实测（官方权重 ×1.5）', srcEn: 'LiveBench 2.0 Coding · Contamination-free code generation & repair (weight ×1.5)', get: r => r.livebench?.coding ?? null},
      {key: 'browser', zh: '网页浏览', en: 'Browser', srcZh: 'LiveBench 2.0 Browser · 真实浏览器交互、检索与跨页信息提取代理', srcEn: 'LiveBench 2.0 Browser · Live web browsing & interaction agent suite', get: r => r.livebench?.browser ?? null},
      {key: 'dataAnalysis', zh: '数据分析', en: 'Data Analysis', srcZh: 'LiveBench 2.0 Data Analysis · 表格重构、统计分析与程序化数据处理', srcEn: 'LiveBench 2.0 Data Analysis · Tabular & programmatic data analytics', get: r => r.livebench?.dataAnalysis ?? null},
      {key: 'research', zh: '深度研究', en: 'Research', srcZh: 'LiveBench 2.0 Research · 复杂文献综述与多源事实验证研究', srcEn: 'LiveBench 2.0 Research · Deep multi-source synthesis & fact verification', get: r => r.livebench?.research ?? null},
      {key: 'design', zh: '视觉设计 (×1.5)', en: 'Design (×1.5)', srcZh: 'LiveBench 2.0 Design · 前端视觉排版与界面设计实现能力（官方权重 ×1.5）', srcEn: 'LiveBench 2.0 Design · UI layout & visual frontend craft (weight ×1.5)', get: r => r.livebench?.design ?? null}
    ];
    barMetrics = [
      {key: 'lbOverall', unit: '', zh: 'LB 2.0 总分', en: 'LB 2.0 Overall', srcZh: 'LiveBench 2.0 官方加权综合分', srcEn: 'LiveBench 2.0 official weighted overall score', get: r => r.livebench?.overall ?? null},
      ...axes
    ];
  } else if (activeKey === 'frontier') {
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
      barMetrics = [
        ...axes,
        {key: 'itBenchSre', zh: 'SRE 故障排障', en: 'IT-Bench SRE', srcZh: 'IT-Bench SRE 云原生集群真实故障定位与自愈排障实测', srcEn: 'IT-Bench SRE cloud-native incident root-cause & remediation', get: r => r.frontierScores?.itBenchSre ?? null},
        {key: 'mlcr', zh: '百万长上下文', en: 'MLCR Long-Ctx', srcZh: 'MLCR 百万 Token 超长上下文跨文档多跳检索与精准推理', srcEn: 'MLCR million-token multi-hop long-context reasoning', get: r => r.frontierScores?.mlcr ?? null}
      ];
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
        {key: 'mlcr', zh: '百万长上下文', en: 'MLCR Long-Ctx', srcZh: 'MLCR 百万 Token 超长上下文跨文档推理实测', srcEn: 'MLCR million-token long-context reasoning', get: r => r.frontierScores?.mlcr ?? null},
        {key: 'itBenchSre', zh: 'SRE 故障排障', en: 'IT-Bench SRE', srcZh: 'IT-Bench SRE 生产环境运维故障排障实测', srcEn: 'IT-Bench SRE incident diagnosis & remediation', get: r => r.frontierScores?.itBenchSre ?? null},
        {key: 'science', zh: 'Terminal 科学', en: 'Terminal Science', srcZh: 'Terminal-Bench Science 科研计算与数理实验代码实测', srcEn: 'Terminal-Bench Science scientific computing', get: r => r.frontierScores?.science ?? null}
      ];
    }
  } else if (activeKey === 'human-arena') {
    if (state.radarMode === 'domain') {
      $('#radarHeading').textContent = t('Design Arena 视觉审美与交互创意五维盲测雷达', 'Design Arena 5-Axis Blind Visual Aesthetic & UX Taste Radar');
      axes = [
        {key: 'website', unit: '', zh: '整站网页审美', en: 'Website Design', srcZh: 'Design Arena Website · 真人双盲对决评测整站排版、配色、留白与现代设计感', srcEn: 'Design Arena Website · Blind human battles on layout, typography & visual polish', get: r => r.designSub?.website ?? null},
        {key: 'uicomponent', unit: '', zh: 'UI 组件质感', en: 'UI Component', srcZh: 'Design Arena UI Component · 交互控件细节、微动效与组件级视觉完成度盲测', srcEn: 'Design Arena UI Component · Blind human grading of component craft & micro-UX', get: r => r.designSub?.uicomponent ?? null},
        {key: 'dataviz', unit: '', zh: '数据图表审美', en: 'DataViz Taste', srcZh: 'Design Arena DataViz · 复杂仪表盘与数据可视化的可读性与审美盲测', srcEn: 'Design Arena DataViz · Blind human preference on dashboards & data visualization', get: r => r.designSub?.dataviz ?? null},
        {key: 'gamedev', unit: '', zh: '游戏交互创意', en: 'GameDev UX', srcZh: 'Design Arena GameDev · 可玩性、交互反馈与视觉创意真人盲测', srcEn: 'Design Arena GameDev · Blind human testing of playable mini-games & feel', get: r => r.designSub?.gamedev ?? null},
        {key: 'svg', unit: '', zh: 'SVG 矢量造型', en: 'SVG Craft', srcZh: 'Design Arena SVG · 纯代码生成矢量插画、构图美感与几何造型盲测', srcEn: 'Design Arena SVG · Blind human preference on vector illustration & geometry', get: r => r.designSub?.svg ?? null}
      ];
      barMetrics = [...axes];
    } else {
      $('#radarHeading').textContent = t('人类盲测六维体感雷达（交流人味 · 视觉创意 · 真实交付）', '6-Axis Human Preference Radar (Chat Vibe · Visual & Creative · Deliverables)');
      axes = [
        {key: 'chatVibe', unit: '', zh: '交流人味 (Chat)', en: 'Chat Vibe', srcZh: 'Arena.ai (LMArena) Text & Doc Style-Controlled · 剔除长篇堆砌与排版讨好后的纯人类对话与行文偏好', srcEn: 'Arena.ai (LMArena) Style-Controlled · Blind chat & writing preference controlling for verbosity bias', get: r => r.humanScores?.chatVibe ?? null},
        {key: 'webdev', unit: '', zh: '全栈体感 (WebDev)', en: 'WebDev Arena', srcZh: 'Arena.ai (LMArena) WebDev · 真人实测构建可交互前端/全栈应用盲评校准分', srcEn: 'Arena.ai (LMArena) WebDev · Blind human battles on live interactive web apps', get: r => r.humanScores?.webdev ?? null},
        {key: 'designWeb', unit: '', zh: '整站视觉审美', en: 'Website Taste', srcZh: 'Design Arena Website · 真人双盲视觉审美对决校准分（整站排版、配色与留白）', srcEn: 'Design Arena Website · Blind human aesthetic preference on full web pages', get: r => r.humanScores?.designWeb ?? null},
        {key: 'designUi', unit: '', zh: 'UI 与图表美感', en: 'UI & DataViz', srcZh: 'Design Arena UI Component + DataViz · 交互控件细节与数据可视化美感综合分', srcEn: 'Design Arena UI Component + DataViz · Component craft & dashboard visual clarity', get: r => r.humanScores?.designUi ?? null},
        {key: 'creativeCraft', unit: '', zh: 'SVG 与游戏创意', en: 'SVG & GameDev', srcZh: 'Design Arena SVG + GameDev · 矢量插画构图造型与可玩游戏动态交互审美（独立标尺校准）', srcEn: 'Design Arena SVG + GameDev · Vector illustration composition & interactive game feel', get: r => r.humanScores?.creativeCraft ?? null},
        {key: 'deliverable', unit: '', zh: '专家真实交付', en: 'Deliverables', srcZh: 'GDPval + Briefcase · 44 个职业领域人类专家盲评真实办公交付物质量', srcEn: 'GDPval + Briefcase · Blind human expert grading of real office deliverables', get: r => r.humanScores?.deliverable ?? null}
      ];
      barMetrics = [
        ...axes,
        {key: 'antiSlop', zh: '去 AI 套话感', en: 'Anti-Slop', srcZh: 'PersonalityBench Anti-Slop · 避免机械排比与官腔套话的自然表达分 (100 − Slop%)', srcEn: 'PersonalityBench Anti-Slop · Natural phrasing free of AI clichés (100 − Slop%)', get: r => r.humanScores?.antiSlop ?? null},
        {key: 'spatialMotion', unit: '', zh: '3D 与代码动效', en: '3D & Motion', srcZh: 'AA-3D + Code2Video · 纯代码构建三维场景与动态教学视频盲测校准分', srcEn: 'AA-3D + Code2Video · Blind human arena on 3D scenes & programmatic motion', get: r => r.humanScores?.spatialMotion ?? null}
      ];
    }
  } else if (activeKey === 'models' || activeKey === 'cyber') {
    if (state.radarMode === 'domain') {
      $('#radarHeading').textContent = t('六大行业专业能力评估雷达', '6-Sector Professional Domain Capability Radar');
      axes = [
        {key: 'finance', unit: '', zh: '金融财务', en: 'Finance', srcZh: 'GDPval-AA · 财务建模、报表分析与定量推理实测', srcEn: 'GDPval-AA · Financial modeling, spreadsheets & quantitative analysis', get: r => r.domainScores?.finance ?? null},
        {key: 'strategy', unit: '', zh: '战略运营', en: 'Strategy & Ops', srcZh: 'GDPval-AA · 商业战略规划、管理咨询与运营决策交付物', srcEn: 'GDPval-AA · Business strategy, consulting decks & operations workflows', get: r => r.domainScores?.strategy ?? null},
        {key: 'legal', unit: '', zh: '法律合规', en: 'Legal', srcZh: 'GDPval-AA · 长篇法律合同审阅、判例推理与合规起草', srcEn: 'GDPval-AA · Contract review, legal briefs & compliance constraints', get: r => r.domainScores?.legal ?? null},
        {key: 'healthcare', unit: '', zh: '医疗健康', en: 'Healthcare', srcZh: 'GDPval-AA · 临床病历综合分析、生物医学文献与公卫评估', srcEn: 'GDPval-AA · Clinical record synthesis & biomedical knowledge tasks', get: r => r.domainScores?.healthcare ?? null},
        {key: 'engineering', unit: '', zh: '工程研发', en: 'Engineering', srcZh: 'GDPval-AA · 工程架构方案、技术文档与终端实操排障', srcEn: 'GDPval-AA · Technical architecture, engineering docs & shell workflows', get: r => r.domainScores?.engineering ?? null},
        {key: 'economics', unit: '', zh: '宏观经济', en: 'Economics', srcZh: 'GDPval-AA · 宏观经济指标建模、政策研究与计量分析', srcEn: 'GDPval-AA · Macroeconomic analysis, policy research & econometrics', get: r => r.domainScores?.economics ?? null}
      ];
      barMetrics = [...axes];
    } else if (activeKey === 'cyber') {
      const cyberCosts = state.rows.filter(r => r.cost > 0).map(r => r.cost);
      const medCyberCost = cyberCosts.length ? median(cyberCosts) : 1.75;
      $('#radarHeading').textContent = t('网络安全攻防、合规响应与核心能力六维雷达', 'Cyber Capability, Compliance & Cost Efficiency 6-Axis Radar');
      axes = [
        {key: 'cyber', unit: '', zh: '网络安全总分', en: 'Cyber Index', srcZh: 'AA Cyber Index · 漏洞挖掘、逆向分析与攻防实操综合分', srcEn: 'AA Cyber Index · Composite offensive & defensive cybersecurity score', get: r => r.intelligenceIndex},
        {key: 'compliance', zh: '合规响应率', en: 'Non-Refusal %', srcZh: '安全测试合规响应比例 = 100% − 安全拒答率（100% 代表零误拦，越高越少误拒合法安全测试）', srcEn: 'Compliance response rate = 100% − Refusal Rate (100% = zero false refusal)', get: r => r.refusalRate != null ? Number((100 - r.refusalRate).toFixed(2)) : null},
        {key: 'costEff', unit: '', zh: '单次经济性', en: 'Cost Eff.', srcZh: '安全任务成本经济性校准分 = 100 ÷ (1 + 单次成本 ÷ 全榜中位价)，50 分对应中位单价，越高越便宜', srcEn: 'Cyber cost efficiency = 100 / (1 + cost / median cost), 50 = median, higher = cheaper', get: r => r.cost > 0 ? Number((100 / (1 + r.cost / medCyberCost)).toFixed(2)) : null},
        {key: 'frontierCode', zh: '前沿编程', en: 'FrontierCode', srcZh: 'FrontierCode 2.0 · 多语言高难度真实软件工程评测', srcEn: 'FrontierCode 2.0 · Contamination-resistant multi-language SWE benchmark', get: r => r.subscores?.frontierCode ?? null},
        {key: 'terminalBench', zh: '终端代理', en: 'Terminal 4.0', srcZh: 'Terminal-Bench 4.0 · Linux 容器命令行多步编译与系统运维', srcEn: 'Terminal-Bench 4.0 · Multi-step Linux CLI & systems engineering', get: r => r.subscores?.terminalBench ?? null},
        {key: 'hleDiamond', zh: '人类终极考', en: 'HLE Diamond', srcZh: 'Humanity’s Last Exam (Diamond) · 跨学科前沿博士级极限推理', srcEn: 'Humanity’s Last Exam (Diamond) · Frontier PhD-level academic reasoning', get: r => r.subscores?.hleDiamond ?? null}
      ];
      barMetrics = [
        ...axes,
        {key: 'critptAgentic', zh: '复杂研究', en: 'CritPt Agent', srcZh: 'CritPt Agentic Hard · 多步深度检索、工具调用与复杂研究', srcEn: 'CritPt Agentic Hard · Multi-step agentic tool-use & deep research', get: r => r.subscores?.critptAgentic ?? null},
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
        {key: 'mmmuPro', zh: '视觉多模态', en: 'MMMU-Pro', srcZh: 'MMMU-Pro · 跨学科高难图表、公式与图像视觉理解实测', srcEn: 'MMMU-Pro · Multi-discipline college-level visual reasoning', get: r => r.subscores?.mmmuPro ?? null},
        {key: 'mlcr', zh: '百万长上下文', en: 'MLCR Long-Ctx', srcZh: 'MLCR · 百万 Token 级超长文档多跳定位与综合推理准确率', srcEn: 'MLCR · Million-token multi-hop long-context accuracy', get: r => r.subscores?.mlcr ?? null},
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
  } else if (activeKey === 'media') {
    const track = state.mediaTrack || 'image';
    const trackCosts = state.rows.filter(r => r.cost > 0).map(r => r.cost);
    const medTrackCost = trackCosts.length ? median(trackCosts) : 0.04;
    const costEffAxis = (zhName = '单次经济性', enName = 'Cost Eff.') => ({
      key: 'costEff',
      unit: '',
      zh: zhName,
      en: enName,
      srcZh: '本赛道单次成本经济性校准分 = 100 ÷ (1 + 单次成本 ÷ 本赛道中位价)，50 分对应行业中位成本，越高越便宜划算',
      srcEn: 'Within-track cost efficiency = 100 / (1 + cost / track median), 50 = median price, higher = cheaper',
      get: r => (r.cost > 0 ? Number((100 / (1 + r.cost / medTrackCost)).toFixed(2)) : null)
    });
    const axIndex = {key: 'index', unit: '', zh: '盲测综合分', en: 'Arena Index', srcZh: '本赛道真人双盲竞技场校准胜率总分 (0–100)', srcEn: 'Calibrated blind human arena composite win-pct score (0–100)', get: r => r.intelligenceIndex};
    const axT2i = {key: 't2i', unit: '', zh: '文生图 (T2I)', en: 'Text-to-Image', srcZh: 'Artificial Analysis Image Arena · 文生图真人双盲投票校准分', srcEn: 'AA Image Arena · Blind human preference on Text-to-Image', get: r => r.mediaScores?.t2i ?? null};
    const axImgEdit = {key: 'imgEdit', unit: '', zh: '图像编辑', en: 'Image Edit', srcZh: 'Artificial Analysis Image Editing · 指令修图与局部重绘双盲校准分', srcEn: 'AA Image Editing · Blind human preference on instruction-guided editing', get: r => r.mediaScores?.imgEdit ?? null};
    const axT2v = {key: 't2v', unit: '', zh: '文生视频 (T2V)', en: 'Text-to-Video', srcZh: 'Artificial Analysis Video Arena · 文生视频动态美感与物理一致性双盲分', srcEn: 'AA Video Arena · Blind human preference on Text-to-Video', get: r => r.mediaScores?.t2v ?? null};
    const axI2v = {key: 'i2v', unit: '', zh: '图生视频 (I2V)', en: 'Image-to-Video', srcZh: 'Artificial Analysis Video Arena · 首帧图生视频动态还原双盲分', srcEn: 'AA Video Arena · Blind human preference on Image-to-Video', get: r => r.mediaScores?.i2v ?? null};
    const axVidEdit = {key: 'vidEdit', unit: '', zh: '视频编辑', en: 'Video Edit', srcZh: 'Artificial Analysis Video Editing · 视频指令重绘与风格编辑双盲分', srcEn: 'AA Video Editing · Blind human preference on video editing', get: r => r.mediaScores?.vidEdit ?? null};
    const axTts = {key: 'tts', unit: '', zh: '语音自然度', en: 'Speech TTS', srcZh: 'Artificial Analysis Speech Arena · 语音自然度与情感韵律真人盲听分', srcEn: 'AA Speech Arena · Blind human listening score on TTS naturalness', get: r => r.mediaScores?.tts ?? null};

    if (track === 'image') {
      $('#radarHeading').textContent = t('图像生成与修图四维能力雷达（双盲审美 · 单张经济性）', 'Image Generation & Editing 4-Axis Radar');
      axes = [axIndex, axT2i, axImgEdit, costEffAxis('单张经济性', 'Cost Eff.')];
      barMetrics = [...axes];
    } else if (track === 'video') {
      $('#radarHeading').textContent = t('视频生成与编辑能力雷达（T2V · I2V · 单段经济性）', 'Video Generation & Editing Capability Radar');
      const hasVEdit = selectedRows.some(r => axVidEdit.get(r) !== null);
      axes = [axIndex, axT2v, axI2v, ...(hasVEdit ? [axVidEdit] : []), costEffAxis('单段经济性', 'Cost Eff.')];
      barMetrics = [...axes];
    } else {
      $('#radarHeading').textContent = t('语音合成 TTS 四维实战雷达（自然度 · 首包低延迟 · 吞吐 · 经济性）', 'Speech TTS 4-Axis Radar (Naturalness · TTFA Speed · Throughput · Cost)');
      const axTtfa = {
        key: 'ttfaSpeed',
        unit: '',
        zh: '首包低延迟',
        en: 'Low Latency',
        srcZh: '实测首包音频延迟 (TTFA) 响应分 = 100 ÷ (1 + TTFA_ms ÷ 250)，250ms 对应 50 分，越高代表开口越快',
        srcEn: 'First-audio responsiveness = 100 / (1 + TTFA_ms / 250); higher = faster time-to-first-audio',
        get: r => r.mediaRaw?.ttfaMs > 0 ? Number((100 / (1 + r.mediaRaw.ttfaMs / 250)).toFixed(2)) : null
      };
      const axCps = {
        key: 'cpsSpeed',
        unit: '',
        zh: '合成吞吐率',
        en: 'Throughput',
        srcZh: '实测中位字符吞吐分 = 100 × 字/秒 ÷ (字/秒 + 120)，越高代表长音频批量合成越快',
        srcEn: 'Throughput score = 100 * chars/sec / (chars/sec + 120); higher = faster batch synthesis',
        get: r => r.mediaRaw?.cps > 0 ? Number(((100 * r.mediaRaw.cps) / (r.mediaRaw.cps + 120)).toFixed(2)) : null
      };
      axes = [axTts, axTtfa, axCps, costEffAxis('千字经济性', 'Cost Eff.')];
      barMetrics = [...axes];
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
      {key: 'index', unit: '', zh: '智能体总指数', en: 'Agent Index', srcZh: 'AA Coding Agent Index v2.1 · 三大实战编程基准等权综合得分', srcEn: 'AA Coding Agent Index v2.1 · Composite score across all agent suites', get: r => r.intelligenceIndex},
      ...evalAxes
    ];
    barMetrics = [
      ...axes,
      {key: 'cache', zh: '缓存命中率', en: 'Cache Hit %', srcZh: '多轮代理循环中命中 Prompt KV 缓存的输入 Token 实测占比', srcEn: 'Measured share of input tokens served from prompt KV cache', get: r => r.agentStats?.cacheHitRate ?? null}
    ];
  }

  const visMode = ['radar', 'strip', 'delta'].includes(state.compareVis) ? state.compareVis : 'radar';
  if (visMode !== 'radar') {
    const curHead = $('#radarHeading').textContent;
    if (lang === 'en') {
      const repEn = visMode === 'strip' ? 'Dot Strip' : 'Win/Loss Δ';
      $('#radarHeading').textContent = /\bRadar\b/i.test(curHead) ? curHead.replace(/\bRadar\b/i, repEn) : `${curHead} · ${repEn}`;
    } else {
      const repZh = visMode === 'strip' ? '微距跑道' : '胜负分差 Δ';
      $('#radarHeading').textContent = curHead.includes('雷达') ? curHead.replace('雷达', repZh) : `${curHead} · ${repZh}`;
    }
  }
  for (const btn of document.querySelectorAll('#compareVisSwitch [data-cvis]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.cvis === visMode));
  }
  $('#radarScaleSwitch').hidden = visMode !== 'radar';
  $('#stripScaleSwitch').hidden = visMode !== 'strip';
  $('#deltaBaseWrap').hidden = visMode !== 'delta';

  for (const btn of document.querySelectorAll('#radarScaleSwitch [data-cscale]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.cscale === state.radarScale));
  }
  for (const btn of document.querySelectorAll('#stripScaleSwitch [data-sscale]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.sscale === state.stripScale));
  }

  const topByIndex = [...selectedRows].sort((a, b) => b.intelligenceIndex - a.intelligenceIndex)[0];
  const baseSel = $('#deltaBaseSelect');
  const baseFrag = document.createDocumentFragment();
  const addBaseOpt = (val, text) => {
    const o = html('option', text);
    o.value = val;
    baseFrag.append(o);
  };
  addBaseOpt('mean', t('已选均值 (Mean)', 'Pack Mean'));
  if (topByIndex && selectedRows.length >= 2) {
    addBaseOpt('top', `${t('总分榜首', '#1 Top')}: ${topByIndex.shortName || topByIndex.name}`);
  }
  for (const r of selectedRows) {
    addBaseOpt(r.id, r.shortName || r.name);
  }
  baseSel.replaceChildren(baseFrag);
  if (state.deltaBase !== 'mean' && state.deltaBase !== 'top' && !selectedRows.some(r => r.id === state.deltaBase)) {
    state.deltaBase = 'mean';
  }
  baseSel.value = state.deltaBase;

  const radarSvg = $('#radarSvg');
  radarSvg.classList.remove('has-focus');
  radarSvg.replaceChildren();
  const seriesLayer = node('g', {class: 'radar-series-layer'});
  const calloutLayer = node('g', {class: 'radar-callout-layer'});
  const verticesBySeries = selectedRows.map(() => axes.map(() => ({val: null, x: 0, y: 0, ratio: 0, ang: 0})));
  const axisEndpoints = [];
  const lanes = [];
  const stripLeaders = [];
  const deltaBars = [];
  let cx = 290, cy = 205, R = 142, scaleMin = 0, scaleMax = 100, baseLabel = '';

  if (visMode === 'radar') {
    radarSvg.setAttribute('viewBox', '0 0 580 410');
    const N = Math.max(3, axes.length);
    const obsValues = selectedRows.flatMap(r => axes.map(a => a.get(r))).filter(v => v !== null);
    const axScales = axes.map(ax => zoomedAxisScale(
      selectedRows.map(r => ax.get(r)).filter(v => v !== null),
      {minSpan: 6, padRatio: 0.12}
    ));

    let innerRatio = 0;
    if (state.radarScale === 'zoom') {
      const zb = zoomedRadarBounds(obsValues);
      scaleMin = zb.scaleMin;
      scaleMax = zb.scaleMax;
      innerRatio = zb.innerRatio;
    } else if (state.radarScale === 'axis') {
      scaleMin = 0;
      scaleMax = 100;
      innerRatio = 0.2;
    } else {
      scaleMin = 0;
      scaleMax = Math.min(100, Math.max(60, Math.ceil(Math.max(40, ...obsValues) / 20) * 20));
      innerRatio = 0;
    }

    const ringPolygonPts = frac => axes.map((_, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
      return `${cx + Math.cos(ang) * R * frac},${cy + Math.sin(ang) * R * frac}`;
    }).join(' ');

    if (innerRatio > 0) {
      const outerFracs = [1, innerRatio + (1 - innerRatio) * (2 / 3), innerRatio + (1 - innerRatio) * (1 / 3)];
      outerFracs.forEach((frac, rIdx) => {
        const pts = ringPolygonPts(frac);
        if (rIdx % 2 === 0) radarSvg.append(node('polygon', {class: 'radar-ring-fill', points: pts}));
        radarSvg.append(node('polygon', {class: 'radar-grid', points: pts}));
      });
      radarSvg.append(node('polygon', {class: 'radar-inner-floor', points: ringPolygonPts(innerRatio)}));

      if (state.radarScale === 'zoom') {
        const tickSpecs = [
          [innerRatio, scaleMin],
          [innerRatio + (1 - innerRatio) * (1 / 3), Math.round(scaleMin + (scaleMax - scaleMin) / 3)],
          [innerRatio + (1 - innerRatio) * (2 / 3), Math.round(scaleMin + ((scaleMax - scaleMin) * 2) / 3)],
          [1, scaleMax]
        ];
        for (const [frac, valNum] of tickSpecs) {
          radarSvg.append(node('text', {
            class: 'radar-scale-tick',
            x: cx + 5,
            y: cy - R * frac + 11
          }, String(valNum)));
        }
      } else {
        radarSvg.append(
          node('text', {class: 'radar-scale-tick', x: cx + 5, y: cy - R * innerRatio + 11}, 'Min'),
          node('text', {class: 'radar-scale-tick', x: cx + 5, y: cy - R + 11}, 'Max')
        );
      }
    } else {
      for (const [ringIdx, frac] of [1, 0.75, 0.5, 0.25].entries()) {
        const pts = ringPolygonPts(frac);
        if (ringIdx % 2 === 0) radarSvg.append(node('polygon', {class: 'radar-ring-fill', points: pts}));
        radarSvg.append(node('polygon', {class: 'radar-grid', points: pts}));
      }
      for (const frac of [0.25, 0.5, 0.75, 1]) {
        radarSvg.append(node('text', {
          class: 'radar-scale-tick',
          x: cx + 5,
          y: cy - R * frac + 11
        }, String(Math.round(scaleMax * frac))));
      }
    }

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
        const u = ax?.unit !== undefined ? ax.unit : '%';
        const loV = Math.min(...vals), hiV = Math.max(...vals);
        const subTxt = vals.length >= 2 && Math.abs(hiV - loV) >= 0.05
          ? `${format(loV, 1)}–${format(hiV, 1)}${u}`
          : `${t('最高', 'Max')} ${format(hiV, 1)}${u}`;
        radarSvg.append(node('text', {
          class: 'radar-axis-sub',
          x: lx,
          y: ly + 14,
          'text-anchor': anchor
        }, subTxt));
      }
    });

    selectedRows.forEach((row, idx) => {
      const sc = compareColor(idx);
      const seriesG = node('g', {class: 'radar-series', 'data-series-idx': idx});
      const verts = axes.map((ax, i) => {
        const val = ax.get(row);
        let ratio = 0;
        if (val !== null) {
          if (state.radarScale === 'axis') {
            const scAx = axScales[i];
            ratio = innerRatio + (1 - innerRatio) * Math.max(0, Math.min(1, (val - scAx.min) / scAx.span));
          } else {
            ratio = radarRadiusRatio(val, scaleMin, scaleMax, innerRatio);
          }
        }
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
        return {
          val,
          ratio,
          ang,
          x: cx + Math.cos(ang) * R * ratio,
          y: cy + Math.sin(ang) * R * ratio
        };
      });
      verticesBySeries[idx] = verts;

      const baseFillOpacity = selectedRows.length <= 4 ? 0.14 : Math.max(0.05, 0.2 - selectedRows.length * 0.018);
      const baseStrokeW = selectedRows.length <= 5 ? 2.5 : 2.1;
      const presentVerts = verts.filter(v => v.val !== null);
      if (presentVerts.length === verts.length && presentVerts.length >= 3) {
        seriesG.append(node('polygon', {
          points: presentVerts.map(v => `${v.x},${v.y}`).join(' '),
          fill: sc,
          'fill-opacity': baseFillOpacity,
          stroke: sc,
          'stroke-width': baseStrokeW,
          'stroke-linejoin': 'round'
        }));
      } else if (presentVerts.length >= 2) {
        // Partial/sparse data: draw solid segments ONLY between adjacent present spokes; bridge gaps with subtle dashed line without fake area fill
        const solidSegs = [];
        for (let i = 0; i < verts.length; i++) {
          const a = verts[i], b = verts[(i + 1) % verts.length];
          if (a.val !== null && b.val !== null) {
            solidSegs.push(`M${a.x},${a.y}L${b.x},${b.y}`);
          }
        }
        const bridgePts = [...presentVerts, ...(presentVerts.length >= 3 ? [presentVerts[0]] : [])]
          .map((v, i) => `${i ? 'L' : 'M'}${v.x},${v.y}`)
          .join(' ');
        seriesG.append(node('path', {
          d: bridgePts,
          fill: 'none',
          stroke: sc,
          'stroke-width': 1.4,
          'stroke-dasharray': '3.5 3',
          opacity: '0.52'
        }));
        if (solidSegs.length) {
          seriesG.append(node('path', {
            d: solidSegs.join(' '),
            fill: 'none',
            stroke: sc,
            'stroke-width': baseStrokeW,
            'stroke-linecap': 'round'
          }));
        }
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
  } else if (visMode === 'strip') {
    const laneH = 58, laneStep = 65, topOff = 8;
    const svgH = topOff + axes.length * laneStep + 6;
    radarSvg.setAttribute('viewBox', `0 0 580 ${svgH}`);
    const trackL = 158, trackR = 556, trackW = trackR - trackL;
    const seriesGroups = selectedRows.map((_, idx) => node('g', {class: 'radar-series', 'data-series-idx': idx}));
    const ringLayer = node('g', {'pointer-events': 'none'});

    axes.forEach((ax, aIdx) => {
      const ly = topOff + aIdx * laneStep;
      const trackY = ly + 25;
      lanes.push({axisIdx: aIdx, top: ly, bottom: ly + laneH});

      radarSvg.append(node('rect', {
        class: 'strip-lane',
        'data-axis-idx': aIdx,
        x: 8,
        y: ly,
        width: 564,
        height: laneH,
        rx: 8
      }));
      radarSvg.append(node('text', {
        class: 'radar-axis-label',
        'data-axis-idx': aIdx,
        x: 18,
        y: ly + 23
      }, t(ax.zh, ax.en)));

      const present = selectedRows
        .map((r, sIdx) => ({sIdx, val: ax.get(r)}))
        .filter(d => d.val !== null);
      const validVals = present.map(d => d.val);
      const axScale = state.stripScale === 'full'
        ? {min: 0, max: 100, span: 100, minVal: validVals.length ? Math.min(...validVals) : null, maxVal: validVals.length ? Math.max(...validVals) : null, leaderGap: validVals.length >= 2 ? [...validVals].sort((a, b) => b - a)[0] - [...validVals].sort((a, b) => b - a)[1] : null}
        : zoomedAxisScale(validVals, {minSpan: 5, padRatio: 0.14});

      const u = ax?.unit !== undefined ? ax.unit : '%';
      let subNote = '—';
      if (axScale.leaderGap !== null) {
        subNote = axScale.leaderGap >= 0.05
          ? t(`第1领先 +${format(axScale.leaderGap, 1)}${u}`, `#1 lead +${format(axScale.leaderGap, 1)}${u}`)
          : t(`榜首并列 (<0.1${u})`, `Tied #1 (<0.1${u})`);
      } else if (axScale.maxVal !== null) {
        subNote = `${format(axScale.maxVal, 1)}${u}`;
      }
      radarSvg.append(node('text', {
        class: 'radar-axis-sub',
        x: 18,
        y: ly + 42
      }, subNote));

      radarSvg.append(node('line', {
        class: 'strip-rail',
        x1: trackL,
        x2: trackR,
        y1: trackY,
        y2: trackY
      }));

      const xOfVal = v => trackL + ((v - axScale.min) / axScale.span) * trackW;
      const tickNums = ticks(axScale.min, axScale.max, 5);
      for (const tk of tickNums) {
        const tx = xOfVal(tk);
        if (tx < trackL - 1 || tx > trackR + 1) continue;
        radarSvg.append(
          node('line', {class: 'strip-tick-line', x1: tx, x2: tx, y1: trackY - 4, y2: trackY + 4}),
          node('text', {
            class: 'radar-scale-tick',
            x: tx,
            y: ly + 49,
            'text-anchor': 'middle'
          }, `${format(tk, axScale.span < 12 ? 1 : 0)}${u}`)
        );
      }

      if (present.length >= 2 && axScale.minVal !== null && axScale.maxVal !== null) {
        radarSvg.append(node('line', {
          class: 'strip-span-bar',
          x1: xOfVal(axScale.minVal),
          x2: xOfVal(axScale.maxVal),
          y1: trackY,
          y2: trackY
        }));
      }

      if (present.length) {
        const byBest = [...present].sort((a, b) => (ax.lowerBetter ? a.val - b.val : b.val - a.val) || a.sIdx - b.sIdx);
        const rankMap = new Map();
        byBest.forEach((d, rIdx) => rankMap.set(d.sIdx, rIdx + 1));
        const bestVal = byBest[0].val;

        const byX = present
          .map(d => ({...d, px: xOfVal(d.val)}))
          .sort((a, b) => a.px - b.px || a.sIdx - b.sIdx);
        const placed = [];
        const dyCandidates = [0, -6.5, 6.5, -12, 12, -16, 16];
        for (const item of byX) {
          let chosenDy = 0;
          for (const dy of dyCandidates) {
            const pyTest = trackY + dy;
            if (!placed.some(p => Math.hypot(item.px - p.x, pyTest - p.y) < 8.6)) {
              chosenDy = dy;
              break;
            }
          }
          const py = Math.max(ly + 11, Math.min(ly + laneH - 13, trackY + chosenDy));
          const ptObj = {
            sIdx: item.sIdx,
            val: item.val,
            rank: rankMap.get(item.sIdx),
            x: item.px,
            y: py,
            ratio: 0.5,
            ang: 0
          };
          placed.push(ptObj);
          verticesBySeries[item.sIdx][aIdx] = ptObj;

          const sc = compareColor(item.sIdx);
          if (selectedRows.length > 1 && Math.abs(item.val - bestVal) < 1e-6) {
            ringLayer.append(node('circle', {
              class: 'strip-leader-ring',
              cx: item.px,
              cy: py,
              r: 7.8
            }));
          }
          seriesGroups[item.sIdx].append(node('circle', {
            cx: item.px,
            cy: py,
            r: 5,
            fill: sc,
            stroke: 'var(--halo)',
            'stroke-width': 1.4
          }));
        }

        const bestPt = placed.find(p => p.sIdx === byBest[0].sIdx) || null;
        const worstPt = placed.length >= 2 ? placed.find(p => p.sIdx === byBest.at(-1).sIdx) : null;
        stripLeaders.push({axisIdx: aIdx, best: bestPt, worst: worstPt});
      }
    });

    radarSvg.append(ringLayer);
    for (const g of seriesGroups) seriesLayer.append(g);
  } else {
    // visMode === 'delta': Baseline-Anchored Diverging Delta (+Δ / -Δ) Chart
    let refRow = null, refIdx = -1;
    if (selectedRows.length >= 2) {
      if (state.deltaBase === 'top' && topByIndex) {
        refRow = topByIndex;
        refIdx = selectedRows.findIndex(r => r.id === refRow.id);
      } else if (state.deltaBase !== 'mean') {
        refIdx = selectedRows.findIndex(r => r.id === state.deltaBase);
        if (refIdx >= 0) refRow = selectedRows[refIdx];
      }
    }
    baseLabel = refRow ? (refRow.shortName || refRow.name) : t('已选均值', 'Pack Mean');

    const baseVals = axes.map(ax => {
      const valid = selectedRows.map(r => ax.get(r)).filter(v => v !== null);
      if (!valid.length) return null;
      if (refRow) {
        const rv = ax.get(refRow);
        if (rv !== null) return rv;
      }
      return valid.reduce((s, v) => s + v, 0) / valid.length;
    });

    const barSeriesIndices = refIdx >= 0 && selectedRows.length >= 2
      ? selectedRows.map((_, i) => i).filter(i => i !== refIdx)
      : selectedRows.map((_, i) => i);

    const allDeltas = [];
    axes.forEach((ax, aIdx) => {
      const bv = baseVals[aIdx];
      if (bv === null) return;
      for (const sIdx of barSeriesIndices) {
        const v = ax.get(selectedRows[sIdx]);
        if (v !== null) allDeltas.push(ax.lowerBetter ? bv - v : v - bv);
      }
    });
    const maxAbs = Math.max(2, ...allDeltas.map(d => Math.abs(d))) * 1.22;

    const rowStep = barSeriesIndices.length <= 4 ? 12 : barSeriesIndices.length <= 6 ? 10.4 : 9.2;
    const laneH = Math.max(52, 16 + barSeriesIndices.length * rowStep);
    const laneStep = laneH + 6;
    const topOff = 26;
    const svgH = topOff + axes.length * laneStep + 4;
    radarSvg.setAttribute('viewBox', `0 0 580 ${svgH}`);

    const zeroX = 358, halfW = 180;
    const shortBase = baseLabel.length > 20 ? baseLabel.slice(0, 19) + '…' : baseLabel;
    radarSvg.append(
      node('text', {class: 'delta-header-text', x: 18, y: 17, fill: 'var(--ink)', 'text-anchor': 'start'}, `${t('基准', 'Ref')}: ${shortBase}`),
      node('text', {class: 'delta-header-text', x: zeroX - 18, y: 17, fill: 'var(--muted)', 'text-anchor': 'end'}, t('← 落后 (−Δ)', '← Behind (−Δ)')),
      node('text', {class: 'delta-header-text', x: zeroX, y: 17, fill: 'var(--ink)', 'text-anchor': 'middle'}, '0'),
      node('text', {class: 'delta-header-text', x: zeroX + 18, y: 17, fill: 'var(--accent)', 'text-anchor': 'start'}, t('领先 (+Δ) →', 'Ahead (+Δ) →'))
    );

    const seriesGroups = selectedRows.map((_, idx) => node('g', {class: 'radar-series', 'data-series-idx': idx}));

    axes.forEach((ax, aIdx) => {
      const ly = topOff + aIdx * laneStep;
      lanes.push({axisIdx: aIdx, top: ly, bottom: ly + laneH});
      radarSvg.append(node('rect', {
        class: 'strip-lane',
        'data-axis-idx': aIdx,
        x: 8,
        y: ly,
        width: 564,
        height: laneH,
        rx: 8
      }));

      const midStep = Math.max(1, Math.round((maxAbs / 2) * 10) / 10);
      const guideDx = (midStep / maxAbs) * halfW;
      radarSvg.append(
        node('line', {class: 'delta-grid-line', x1: zeroX - guideDx, x2: zeroX - guideDx, y1: ly + 4, y2: ly + laneH - 4}),
        node('line', {class: 'delta-grid-line', x1: zeroX + guideDx, x2: zeroX + guideDx, y1: ly + 4, y2: ly + laneH - 4}),
        node('line', {class: 'delta-zero-line', x1: zeroX, x2: zeroX, y1: ly + 3, y2: ly + laneH - 3})
      );

      radarSvg.append(node('text', {
        class: 'radar-axis-label',
        'data-axis-idx': aIdx,
        x: 18,
        y: ly + Math.min(24, laneH * 0.44)
      }, t(ax.zh, ax.en)));

      const u = ax?.unit !== undefined ? ax.unit : '%';
      const bv = baseVals[aIdx];
      radarSvg.append(node('text', {
        class: 'radar-axis-sub',
        x: 18,
        y: ly + Math.min(41, laneH * 0.44 + 16)
      }, bv !== null ? `${refRow ? t('基准', 'Ref') : t('均值', 'Mean')} ${format(bv, 1)}${u}` : '—'));

      if (refIdx >= 0 && bv !== null && ax.get(selectedRows[refIdx]) !== null) {
        const refCy = ly + laneH / 2;
        seriesGroups[refIdx].append(node('polygon', {
          points: `${zeroX},${refCy - 5} ${zeroX + 5},${refCy} ${zeroX},${refCy + 5} ${zeroX - 5},${refCy}`,
          fill: compareColor(refIdx),
          stroke: 'var(--halo)',
          'stroke-width': 1.2
        }));
      }

      const startY = ly + (laneH - (barSeriesIndices.length - 1) * rowStep) / 2;
      barSeriesIndices.forEach((sIdx, rPos) => {
        const ry = startY + rPos * rowStep;
        const val = ax.get(selectedRows[sIdx]);
        if (val === null || bv === null) return;
        const delta = ax.lowerBetter ? bv - val : val - bv;
        const dx = (delta / maxAbs) * halfW;
        const sc = compareColor(sIdx);
        const barX = dx >= 0 ? zeroX : zeroX + dx;
        const barW = Math.max(1.6, Math.abs(dx));

        seriesGroups[sIdx].append(
          node('rect', {
            class: 'delta-bar',
            x: barX,
            y: ry - 3.1,
            width: barW,
            height: 6.2,
            rx: 3,
            fill: sc
          }),
          node('circle', {
            cx: zeroX + dx,
            cy: ry,
            r: 3.3,
            fill: sc,
            stroke: 'var(--halo)',
            'stroke-width': 1
          })
        );

        const deltaStr = `${delta > 0.04 ? '+' : delta < -0.04 ? '−' : '±'}${format(Math.abs(delta), 1)}${u}`;
        const lblX = dx >= 0 ? zeroX + dx + 6 : zeroX + dx - 6;
        seriesGroups[sIdx].append(node('text', {
          class: 'delta-val-label',
          x: lblX,
          y: ry + 3.4,
          fill: sc,
          'text-anchor': dx >= 0 ? 'start' : 'end'
        }, deltaStr));

        deltaBars.push({
          sIdx,
          aIdx,
          x0: Math.min(zeroX, zeroX + dx) - 42,
          x1: Math.max(zeroX, zeroX + dx) + 42,
          y0: ry - rowStep * 0.52,
          y1: ry + rowStep * 0.52
        });
      });
    });

    for (const g of seriesGroups) seriesLayer.append(g);
  }

  radarSvg.append(seriesLayer, calloutLayer);

  radarCtx = {
    visMode,
    cx,
    cy,
    R,
    scaleMin,
    scaleMax,
    baseLabel,
    axes,
    barMetrics,
    selectedRows,
    verticesBySeries,
    axisEndpoints,
    lanes,
    stripLeaders,
    deltaBars,
    seriesLayer,
    calloutLayer
  };

  // Sorted sub-dimension leaderboard cards beneath the Hero Chart (with zoomed micro-bars!)
  const barsFrag = document.createDocumentFragment();
  for (const m of barMetrics) {
    const validNums = selectedRows.map(r => m.get(r)).filter(v => v !== null);
    if (!validNums.length) continue;
    const bestVal = m.lowerBetter ? Math.min(...validNums) : Math.max(...validNums);
    const dimScale = zoomedAxisScale(validNums, {minSpan: 5, padRatio: 0.1});
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

    const sortedEntries = selectedRows
      .map((row, idx) => ({row, idx, val: m.get(row)}))
      .sort((a, b) => {
        if ((a.val === null) !== (b.val === null)) return a.val === null ? 1 : -1;
        if (a.val === null) return a.idx - b.idx;
        return (m.lowerBetter ? a.val - b.val : b.val - a.val) || a.idx - b.idx;
      });

    sortedEntries.forEach(({row, idx, val}) => {
      const item = html('div', null, 'radar-dim-item');
      item.dataset.seriesIdx = String(idx);
      const sc = compareColor(idx);
      if (val !== null) {
        const bar = html('i', null, 'radar-dim-bar');
        const rawPct = m.lowerBetter
          ? ((dimScale.max - val) / dimScale.span) * 100
          : ((val - dimScale.min) / dimScale.span) * 100;
        bar.style.width = `${Math.max(6, Math.min(100, rawPct))}%`;
        bar.style.background = sc;
        item.append(bar);
      }
      const nameWrap = html('span', null, 'radar-dim-name');
      const dot = html('i', null, 'creator-dot');
      dot.style.background = sc;
      const short = (row.shortName || row.name).replace(/^Claude Code - |^Codex - /i, '');
      nameWrap.append(dot, html('span', short));
      const mUnit = m?.unit !== undefined ? m.unit : '%';
      const valEl = html('b', val === null ? '—' : `${format(val, 1)}${mUnit}`);
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
    const hasGranularCache = selectedRows.some(r => (r.costBreakdown?.cacheRead || 0) > 0 || (r.costBreakdown?.cacheWrite || 0) > 0);
    const legend = html('div', null, 'stack-legend');
    const legendItems = hasGranularCache
      ? [
        ['#38bdf8', '新鲜输入', 'Fresh In'],
        ['#818cf8', '缓存读取', 'Cache Read'],
        ['#e879f9', '缓存写入', 'Cache Write'],
        ['#f59e0b', '推理思考', 'Reasoning'],
        ['#10b981', '最终回答', 'Answer']
      ]
      : [
        ['#38bdf8', '输入 Prompt', 'Input'],
        ['#f59e0b', '推理思考 Token', 'Reasoning'],
        ['#10b981', '最终输出回答', 'Answer']
      ];
    for (const [col, zhL, enL] of legendItems) {
      const item = html('span');
      const sw = html('i');
      sw.style.background = col;
      item.append(sw, document.createTextNode(t(zhL, enL)));
      legend.append(item);
    }
    anatomyFrag.append(legend);

    selectedRows.forEach((row, idx) => {
      const cb = row.costBreakdown || {input: 0, reasoning: 0, answer: row.cost};
      const rowHasCache = hasGranularCache && Number.isFinite(cb.nonCacheInput);
      const segments = rowHasCache
        ? [
          [cb.nonCacheInput || 0, '#38bdf8'],
          [cb.cacheRead || 0, '#818cf8'],
          [cb.cacheWrite || 0, '#e879f9'],
          [cb.reasoning || 0, '#f59e0b'],
          [cb.answer || 0, '#10b981']
        ]
        : [
          [cb.input || 0, '#38bdf8'],
          [cb.reasoning || 0, '#f59e0b'],
          [cb.answer || 0, '#10b981']
        ];
      const sum = Math.max(1e-9, segments.reduce((acc, [v]) => acc + Math.max(0, v), 0));
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
      stack.title = rowHasCache
        ? `${t('新鲜输入', 'Fresh In')}: ${money(cb.nonCacheInput || 0)} · ${t('缓存读', 'Cache Read')}: ${money(cb.cacheRead || 0)} · ${t('缓存写', 'Cache Write')}: ${money(cb.cacheWrite || 0)} · ${t('思考', 'Reasoning')}: ${money(cb.reasoning || 0)} · ${t('回答', 'Answer')}: ${money(cb.answer || 0)}`
        : `${t('输入', 'Input')}: ${money(cb.input || 0)} · ${t('思考', 'Reasoning')}: ${money(cb.reasoning || 0)} · ${t('回答', 'Answer')}: ${money(cb.answer || 0)}`;
      for (const [part, col] of segments) {
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
        row.providers.forEach((p, pIdx) => {
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
        titleZh: 'Arena.ai (LMArena) 交流人味 Elo（Style-Controlled 去长文水分）',
        titleEn: 'Arena.ai (LMArena) Style-Controlled Chat Elo (De-biased)',
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
        row.providers.forEach((p, pIdx) => {
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
    const allZeroRefusal = selectedRows.every(r => (r.refusalRate ?? 0) === 0);
    anatomyFrag.append(
      refBlock,
      html('p', allZeroRefusal
        ? t('当前所选模型均为 0% 安全拒答（无合规测试误拦）；部分其他闭源模型因内置安全护栏会主动拒答双用途载荷。', 'All selected models show 0% refusal (no false blocks); some other closed models enforce dual-use safety guardrails.')
        : t('部分前沿闭源模型内置网络攻防合规拦截策略，遇敏感载荷会主动拒答；开源模型通常为 0% 拒答。', 'Frontier closed models often enforce cyber-safety guardrails that refuse dual-use prompts; open-weights models typically show 0% refusal.'), 'anatomy-note')
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
        row.providers.forEach((p, pIdx) => {
          const pill = html('span', `${p.host}: ${money(p.cost)}${p.timeSec ? ' · ' + formatTime(p.timeSec) : ''}`, pIdx === 0 ? 'provider-pill is-cheapest' : 'provider-pill');
          list.append(pill);
        });
        sub.append(list);
        provGroup.append(sub);
      }
      anatomyFrag.append(provGroup);
    }
  } else if (activeKey === 'media') {
    const meta = mediaTrackMeta(state.mediaTrack);
    $('#anatomyHeading').textContent = t('单次生成计费、批发原价与原始盲测 Elo 剖析', 'Unit Generation Pricing, Wholesale Rates & Raw Arena Elo');
    const maxUnitCost = Math.max(0.001, ...selectedRows.map(r => r.cost || 0));
    const costBlock = html('div', null, 'metric-block');
    costBlock.append(html('div', t(meta.zhAnatomyTitle, meta.enAnatomyTitle), 'metric-title'));
    selectedRows.forEach((row, idx) => {
      const mini = html('div', null, 'mini-bar-row');
      const track = html('span', null, 'comparison-track');
      const fill = html('i');
      fill.style.width = `${Math.max(3, (row.cost / maxUnitCost) * 100)}%`;
      fill.style.background = compareColor(idx);
      track.append(fill);
      const unitStr = row.mediaRaw ? ` ${t(row.mediaRaw.unitZh, row.mediaRaw.unitEn)}` : '';
      mini.append(html('span', row.shortName || row.name, 'mini-bar-name'), track, html('span', `${money(row.cost)}${unitStr}`, 'mini-bar-val'));
      costBlock.append(mini);
    });
    anatomyFrag.append(costBlock);

    const eloGroup = html('div', null, 'provider-group');
    eloGroup.append(html('div', t('各引擎竞技场原始盲测 Elo 与官方批发报价', 'Raw Blind Arena Elo & Official Wholesale Rate'), 'metric-title'));
    selectedRows.forEach((row, idx) => {
      const mr = row.mediaRaw || {};
      const sub = html('div', null, 'metric-block');
      const head = html('div', null, 'metric-title');
      const left = html('span');
      const dot = html('i', null, 'creator-dot');
      dot.style.background = compareColor(idx);
      dot.style.marginRight = '6px';
      left.append(dot, document.createTextNode(row.shortName || row.name));
      const rateStr = mr.kind === 'image'
        ? `$${format(mr.pricePer1k ?? row.cost * 1000, 2)} / ${t('千张图', '1k imgs')}`
        : mr.kind === 'video'
          ? `$${format(mr.pricePerMin ?? row.cost * 12, 2)} / ${t('分钟视频', 'min video')}`
          : `$${format(mr.pricePer1mChars ?? row.cost * 1000, 2)} / ${t('百万字符', '1M chars')}`;
      head.append(left, html('span', rateStr));
      const chips = html('div', null, 'provider-chips');
      if (mr.t2iElo != null) chips.append(html('span', `T2I Elo ${format(mr.t2iElo, 0)}`, 'provider-pill is-cheapest'));
      if (mr.imgEditElo != null) chips.append(html('span', `Edit Elo ${format(mr.imgEditElo, 0)}`, 'provider-pill'));
      if (mr.t2vElo != null) chips.append(html('span', `T2V Elo ${format(mr.t2vElo, 0)}`, 'provider-pill is-cheapest'));
      if (mr.i2vElo != null) chips.append(html('span', `I2V Elo ${format(mr.i2vElo, 0)}`, 'provider-pill'));
      if (mr.vidEditElo != null) chips.append(html('span', `VidEdit Elo ${format(mr.vidEditElo, 0)}`, 'provider-pill'));
      if (mr.ttsElo != null) chips.append(html('span', `TTS Elo ${format(mr.ttsElo, 0)}`, 'provider-pill is-cheapest'));
      if (mr.ttfaMs != null) chips.append(html('span', `${t('首包', 'TTFA')} ${mr.ttfaMs}ms`, 'provider-pill'));
      if (mr.cps != null) chips.append(html('span', `${format(mr.cps, 0)} ${t('字/秒', 'ch/s')}`, 'provider-pill'));
      sub.append(head, chips);
      eloGroup.append(sub);
    });
    anatomyFrag.append(eloGroup);
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
    currentAxisLabel(),
    selectedRows.map(r => format(r.intelligenceIndex, 2)),
    selectedRows.map(r => r.intelligenceIndex),
    false
  );
  addRow(
    activeKey === 'media'
      ? t(mediaTrackMeta(state.mediaTrack).zhMatrixCost, mediaTrackMeta(state.mediaTrack).enMatrixCost)
      : t('单任务平均 API 成本', 'Mean Cost / Task'),
    selectedRows.map(r => money(r.cost)),
    selectedRows.map(r => r.cost),
    true
  );
  if (activeKey !== 'media' || selectedRows.some(r => r.timeSec > 0)) {
    addRow(
      t('单任务平均耗时', 'Mean Time / Task'),
      selectedRows.map(r => formatTime(r.timeSec)),
      selectedRows.map(r => r.timeSec ?? null),
      true
    );
  }
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
  if (!['coding-agents', 'media'].includes(activeKey)) {
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
    selectedRows.map(r => `${formatTaskCount(breakEvenTasks(r.cost, 20), r)} / ${formatTaskCount(breakEvenTasks(r.cost, 100), r)}`)
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
      t('视觉多模态 (MMMU-Pro) · 百万上下文 (MLCR)', 'Vision (MMMU-Pro) · Long-Ctx (MLCR)'),
      selectedRows.map(r => {
        const s = r.subscores || {};
        const p = [
          s.mmmuPro != null ? `MMMU ${format(s.mmmuPro, 1)}%` : null,
          s.mlcr != null ? `MLCR ${format(s.mlcr, 1)}%` : null
        ].filter(Boolean);
        return p.length ? p.join(' · ') : '—';
      }),
      selectedRows.map(r => r.subscores?.mmmuPro ?? r.subscores?.mlcr ?? null),
      false
    );
    if (selectedRows.some(r => r.livebench)) {
      addRow(
        t('LiveBench 2.0 防污染总分（排名 · 自测单价）', 'LiveBench 2.0 Score (Rank · LB Cost)'),
        selectedRows.map(r => r.livebench
          ? `${format(r.livebench.overall, 2)} (#${r.livebench.rank}${r.livebench.lbCost != null ? ' · ' + money(r.livebench.lbCost) : ''})`
          : '—'),
        selectedRows.map(r => r.livebench?.overall ?? null),
        false
      );
    }
    addRow(
      t('各测评机构独立排名（AA / LB2 / Arena / Design）', 'Org Ranks (AA / LB2 / Arena / Design)'),
      selectedRows.map(r => formatOrgRankSummary(r.id))
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
      t('百万上下文 (MLCR) · SRE 故障排障', 'MLCR Long-Ctx · IT-Bench SRE'),
      selectedRows.map(r => {
        const fs = r.frontierScores || {};
        const p = [
          fs.mlcr != null ? `MLCR ${format(fs.mlcr, 1)}%` : null,
          fs.itBenchSre != null ? `SRE ${format(fs.itBenchSre, 1)}%` : null
        ].filter(Boolean);
        return p.length ? p.join(' · ') : '—';
      }),
      selectedRows.map(r => r.frontierScores?.mlcr ?? r.frontierScores?.itBenchSre ?? null),
      false
    );
    addRow(
      t('输出总 Token（思考占比）', 'Output Tokens (Reasoning %)'),
      selectedRows.map(r => r.outTokens
        ? `${format(r.outTokens.total / 1000, 1)}k (${Math.round((r.outTokens.reasoning / Math.max(1, r.outTokens.total)) * 100)}%)`
        : '—'),
      selectedRows.map(r => r.outTokens?.total ?? null),
      true
    );
    if (selectedRows.some(r => r.livebench)) {
      addRow(
        t('LiveBench 2.0 防污染总分（排名 · 长程代理）', 'LiveBench 2.0 (Rank · Long Agentic)'),
        selectedRows.map(r => r.livebench
          ? `${format(r.livebench.overall, 2)} (#${r.livebench.rank}${r.livebench.longAgentic != null ? ' · Ag ' + format(r.livebench.longAgentic, 1) + '%' : ''})`
          : '—'),
        selectedRows.map(r => r.livebench?.overall ?? null),
        false
      );
    }
    addRow(
      t('各测评机构独立排名（AA / LB2 / Arena / Design）', 'Org Ranks (AA / LB2 / Arena / Design)'),
      selectedRows.map(r => formatOrgRankSummary(r.id))
    );
    addRow(
      t('发布日期', 'Release Date'),
      selectedRows.map(r => r.releaseDate || '—')
    );
  } else if (activeKey === 'human-arena') {
    addRow(
      t('Arena.ai (LMArena) 交流人味 Elo（去水份）', 'Arena.ai (LMArena) Style-Ctrl Chat Elo'),
      selectedRows.map(r => r.arenaRaw?.chatElo != null
        ? `${format(r.arenaRaw.chatElo, 1)}${r.arenaRaw.chatVotes ? ' (' + format(r.arenaRaw.chatVotes / 1000, 1) + 'k' + t('票', 'v') + ')' : ''}`
        : '—'),
      selectedRows.map(r => r.arenaRaw?.chatElo ?? null),
      false
    );
    addRow(
      t('Arena.ai (LMArena) WebDev / 文档盲测 Elo', 'Arena.ai (LMArena) WebDev / Doc Elo'),
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
      t('去 AI 套话感 · 3D/代码动效 Elo', 'Anti-Slop · 3D / Code2Video Elo'),
      selectedRows.map(r => {
        const ar = r.arenaRaw || {};
        const anti = r.humanScores?.antiSlop;
        const p = [
          anti != null ? `${t('自然度', 'Natural')} ${format(anti, 0)}%` : null,
          ar.aa3dElo != null ? `3D ${format(ar.aa3dElo, 0)}` : null,
          ar.code2videoElo != null ? `C2V ${format(ar.code2videoElo, 0)}` : null
        ].filter(Boolean);
        return p.length ? p.join(' · ') : '—';
      }),
      selectedRows.map(r => r.humanScores?.antiSlop ?? r.humanScores?.spatialMotion ?? null),
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
    addRow(
      t('各测评机构独立排名（AA / LB2 / Arena / Design）', 'Org Ranks (AA / LB2 / Arena / Design)'),
      selectedRows.map(r => formatOrgRankSummary(r.id))
    );
  } else if (activeKey === 'media') {
    addRow(
      t('生成模态 · 单次计费单位', 'Modality · Billing Unit'),
      selectedRows.map(r => {
        const kindLabel = r.mediaKind === 'image'
          ? t('图像生成/修图', 'Image Gen/Edit')
          : r.mediaKind === 'video'
            ? t('视频生成/编辑', 'Video Gen/Edit')
            : t('语音合成 TTS', 'Speech TTS');
        const unit = r.mediaRaw ? t(r.mediaRaw.unitZh, r.mediaRaw.unitEn) : '';
        return `${kindLabel}${unit ? ' · ' + unit : ''}`;
      })
    );
    addRow(
      t('官方商业批发原价', 'Official Wholesale Pricing'),
      selectedRows.map(r => {
        const mr = r.mediaRaw || {};
        if (mr.kind === 'image') return `$${format(mr.pricePer1k ?? r.cost * 1000, 2)} / ${t('千张图', '1k imgs')}`;
        if (mr.kind === 'video') return `$${format(mr.pricePerMin ?? r.cost * 12, 2)} / ${t('分钟视频', 'min video')}`;
        return `$${format(mr.pricePer1mChars ?? r.cost * 1000, 2)} / ${t('百万字符', '1M chars')}`;
      }),
      selectedRows.map(r => r.cost),
      true
    );
    addRow(
      t('双盲竞技场原始 Elo', 'Raw Blind Arena Elo'),
      selectedRows.map(r => {
        const mr = r.mediaRaw || {};
        const p = [
          mr.t2iElo != null ? `T2I ${format(mr.t2iElo, 0)}` : null,
          mr.imgEditElo != null ? `Edit ${format(mr.imgEditElo, 0)}` : null,
          mr.t2vElo != null ? `T2V ${format(mr.t2vElo, 0)}` : null,
          mr.i2vElo != null ? `I2V ${format(mr.i2vElo, 0)}` : null,
          mr.vidEditElo != null ? `VEdit ${format(mr.vidEditElo, 0)}` : null,
          mr.ttsElo != null ? `TTS ${format(mr.ttsElo, 0)}` : null
        ].filter(Boolean);
        return p.length ? p.join(' · ') : '—';
      }),
      selectedRows.map(r => r.intelligenceIndex),
      false
    );
    if (selectedRows.some(r => r.mediaRaw?.ttfaMs != null || r.mediaRaw?.cps != null)) {
      addRow(
        t('TTS 首包延迟 (TTFA) · 吞吐速度', 'TTS First-Audio Latency · Throughput'),
        selectedRows.map(r => {
          const mr = r.mediaRaw || {};
          const p = [
            mr.ttfaMs != null ? `${mr.ttfaMs} ms` : null,
            mr.cps != null ? `${format(mr.cps, 0)} ${t('字/秒', 'ch/s')}` : null
          ].filter(Boolean);
          return p.length ? p.join(' · ') : '—';
        }),
        selectedRows.map(r => r.mediaRaw?.ttfaMs ?? null),
        true
      );
    }
    addRow(
      t('发布日期', 'Release Date'),
      selectedRows.map(r => r.releaseDate || '—')
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
  const frontier = activeFrontierSet().list;
  const {champion} = computeRankings();
  for (const row of frontier) {
    if (row.intelligenceIndex > xMax) continue;
    if (state.company && row.creator?.name !== state.company) continue;
    const util = capabilityUtility(row.intelligenceIndex, state.valueWeight) ?? 0;
    const cx = xx(row.intelligenceIndex), cy = mapY(util);
    const isChamp = !!(champion && champion.id === row.id);
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
  const qWidth = Math.max(0, qx - frame.left);
  const qHeight = Math.max(0, qy - frame.top);
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
  const inHist = canHistoryMode() && state.historyMode;
  paretoEl.setAttribute('d', frontier.map((row, i) => `${i ? 'L' : 'M'}${xCoord(row)},${y(row.intelligenceIndex)}`).join(' '));
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
  syncViewportHint();
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
      const subUnitZh = activeKey === 'media' ? mediaTrackMeta(state.mediaTrack).zhSubUnit : '次';
      const subUnitEn = activeKey === 'media' ? ' ' + mediaTrackMeta(state.mediaTrack).enSubUnit : 'x';
      axis.append(node('text', {
        class: 'sub-guide-label',
        x: alignRight ? sx - 6 : sx + 6,
        y: frame.top + 27,
        'text-anchor': alignRight ? 'end' : 'start'
      }, compact
        ? (alignRight ? `← ${money(thresholdCost)}` : `${money(thresholdCost)} →`)
        : t(
          alignRight ? `← 未回本（API 省）· $${state.subFee}/${state.monthlyTasks}${subUnitZh} (${money(thresholdCost)})` : `${money(thresholdCost)} ($${state.subFee}/${state.monthlyTasks}${subUnitZh}) · 已回本（订阅省）→`,
          alignRight ? `← Unmet (API saves) · $${state.subFee}/${state.monthlyTasks}${subUnitEn}` : `$${state.subFee}/${state.monthlyTasks}${subUnitEn} · Sub saves →`
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
  let xTitleTxt;
  if (isTime) {
    xTitleTxt = activeKey === 'media'
      ? t('平均生成耗时（分钟 · 线性刻度）', 'Mean Generation Time (Minutes · Linear Scale)')
      : t('每任务平均耗时（分钟 · 线性刻度）', 'Mean Wall Time per Task (Minutes · Linear Scale)');
  } else if (activeKey === 'media') {
    const meta = mediaTrackMeta(state.mediaTrack);
    xTitleTxt = t(meta.zhXTitle, meta.enXTitle);
  } else {
    xTitleTxt = t('每任务成本（美元 · 线性刻度）', 'Cost per Task (USD · Linear Scale)');
  }
  axis.append(node('text', {
    class: 'axis-title x-title',
    x: (frame.left + frame.right) / 2,
    y: frame.bottom + 36,
    'text-anchor': 'middle'
  }, xTitleTxt));

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

function distSqPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) return (px - x1) ** 2 + (py - y1) ** 2;
  const tVal = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const nx = x1 + tVal * dx, ny = y1 + tVal * dy;
  return (px - nx) ** 2 + (py - ny) ** 2;
}

function rectSegmentPenalty(rect, segs) {
  let pen = 0;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const rx = rect.w / 2 + 2, ry = rect.h / 2 + 2;
  for (const s of segs) {
    if (Math.max(s.x1, s.x2) < rect.x - 2 || Math.min(s.x1, s.x2) > rect.x + rect.w + 2) continue;
    if (Math.max(s.y1, s.y2) < rect.y - 2 || Math.min(s.y1, s.y2) > rect.y + rect.h + 2) continue;
    // Sample 3 interior points + midpoint check against expanded box
    for (const frac of [0.25, 0.5, 0.75]) {
      const sx = s.x1 + (s.x2 - s.x1) * frac;
      const sy = s.y1 + (s.y2 - s.y1) * frac;
      if (Math.abs(sx - cx) <= rx && Math.abs(sy - cy) <= ry) {
        pen += 36;
        break;
      }
    }
    if (distSqPointToSegment(cx, cy, s.x1, s.y1, s.x2, s.y2) < (ry + 3) ** 2) pen += 16;
  }
  return pen;
}

function syncViewportHint() {
  const btn = $('#viewportHintBtn');
  if (!btn || !state || state.mode !== 'chart' || !frame) {
    if (btn) btn.hidden = true;
    return;
  }
  const rows = nodes.map(n => n.row).filter(r => !isFutureHidden(r));
  const v = state.view;
  const dv = state.defaultView;
  const xOf = currentXOf();
  const vRight = v.x + v.width;
  const rightClipped = rows.filter(r => {
    const xv = xOf(r);
    return typeof xv === 'number' && Number.isFinite(xv) && xv > vRight + 1e-6;
  });
  const nearDefault = dv
    && Math.abs(v.x - dv.x) <= Math.max(1e-5, dv.width * 0.015)
    && Math.abs(v.width - dv.width) <= Math.max(1e-5, dv.width * 0.015)
    && Math.abs(v.y - dv.y) <= Math.max(0.1, dv.height * 0.015)
    && Math.abs(v.height - dv.height) <= Math.max(0.1, dv.height * 0.015);

  if (rightClipped.length > 0) {
    const maxClipScore = Math.max(...rightClipped.map(r => r.intelligenceIndex));
    const unitKind = state.xMetric === 'time' ? t('长耗时', 'slower') : t('高价', 'higher-cost');
    btn.dataset.action = 'fit';
    btn.classList.remove('is-reset');
    btn.textContent = mobileLayout.matches
      ? t(`右侧 +${rightClipped.length} 款 · 显示全部 →`, `+${rightClipped.length} off-right · Fit all →`)
      : t(
        `右侧另有 ${rightClipped.length} 款${unitKind}项（最高 ${format(maxClipScore, 1)} 分）· 显示全部 →`,
        `+${rightClipped.length} ${unitKind} off-right (up to ${format(maxClipScore, 1)}) · Fit all →`
      );
    btn.title = t('一键缩放横轴至完整区间，查看右侧高价旗舰（双击空白处可恢复默认视野）', 'Zoom out to full range to inspect high-cost SOTA models (double-click plot to reset)');
    btn.hidden = false;
  } else if (!nearDefault) {
    btn.dataset.action = 'reset';
    btn.classList.add('is-reset');
    btn.textContent = t('↺ 恢复默认主力视野', '↺ Default focus view');
    btn.title = t('切回日常高性价比主力区间视野 (Home)', 'Return to default mainstream focus viewport (Home)');
    btn.hidden = false;
  } else {
    btn.hidden = true;
  }
}

function layoutLabels(championId) {
  const placed = [], visible = nodes.filter(item => inView(item.row) && !isFutureHidden(item.row));
  const pool = activePool();
  const inHist = canHistoryMode() && state.historyMode;
  const fSet = activeFrontierSet();
  const frontier = inHist
    ? new Set(paretoFrontier(pool.filter(r => r.releaseDate && r.releaseDate <= state.releaseDates[state.historyIndex]), currentXOf()).map(row => row.id))
    : fSet.idSet;
  const baseDist = state.labelDistance;
  const radii = [3, baseDist * 0.55, baseDist * 0.85, Math.max(6, baseDist)].filter((v, i, arr) => v >= 2 && arr.indexOf(v) === i);
  measure.font = `500 ${state.labelSize}px "IBM Plex Sans", "Segoe UI", "Microsoft YaHei UI", sans-serif`;

  // Register quadrant median micro-label box & floating viewport hint pill so top-right labels never hide behind them
  const qNote = svg.querySelector('.quadrant-note');
  if (qNote) {
    const qx = Number(qNote.getAttribute('x')) || 0;
    const qw = measure.measureText(qNote.textContent || '').width + 8;
    placed.push({x: qx - qw, y: frame.top + 1, w: qw + 4, h: 16});
  }
  const hintBtn = $('#viewportHintBtn');
  if (hintBtn && !hintBtn.hidden) {
    const hRect = host.getBoundingClientRect();
    const bRect = hintBtn.getBoundingClientRect();
    if (bRect.width > 0 && bRect.height > 0 && hRect.width > 0) {
      placed.push({
        x: bRect.left - hRect.left - 6,
        y: bRect.top - hRect.top - 4,
        w: bRect.width + 12,
        h: bRect.height + 10
      });
    } else {
      const hw = hintBtn.offsetWidth || (measure.measureText(hintBtn.textContent || '').width + 26);
      placed.push({x: frame.right - hw - 14, y: frame.top + 2, w: hw + 14, h: 36});
    }
  }

  // Build Pareto frontier segments so labels avoid getting struck through by the frontier line
  const paretoSegs = [];
  const addChainSegs = arr => {
    for (let i = 0; i < arr.length - 1; i++) {
      const x1 = xCoord(arr[i]), y1 = y(arr[i].intelligenceIndex);
      const x2 = xCoord(arr[i + 1]), y2 = y(arr[i + 1].intelligenceIndex);
      if (Number.isFinite(x1) && Number.isFinite(x2)) paretoSegs.push({x1, y1, x2, y2});
    }
  };
  if (!inHist) {
    addChainSegs(fSet.list);
  }

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

    let best = null, bestScore = Infinity, bestLabelOverlap = Infinity, bestPointOverlap = Infinity;
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
        const linePen = paretoSegs.length ? rectSegmentPenalty(candidate, paretoSegs) : 0;
        const score = radius * 0.12 + labelCollision * 6 + pointCollision * 2.2 + linePen;
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
          bestLabelOverlap = labelCollision;
          bestPointOverlap = pointCollision;
        }
      }
    }

    if (!best) {
      item.label.style.visibility = item.line.style.visibility = 'hidden';
      continue;
    }

    // Smart collision avoidance: cull overlapping non-frontier crowd labels until zoomed in.
    if (state.smartLabels && priority < 3) {
      const maxAllowed = priority >= 1 ? w * h * 0.05 : 1;
      if (bestLabelOverlap > maxAllowed || (priority === 0 && bestPointOverlap > 26)) {
        item.label.style.visibility = item.line.style.visibility = 'hidden';
        continue;
      }
    }

    placed.push({x: best.x - 1.5, y: best.y - 1.5, w: best.w + 3, h: best.h + 3});
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
    if (!futureOut && isStarred(item.row) && inView(item.row)) {
      layer.append(node('circle', {
        class: 'star-ring',
        cx: xCoord(item.row),
        cy: y(item.row.intelligenceIndex),
        r: 7.8,
        fill: 'none'
      }));
    }
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
  if (activeKey === 'media' && row.mediaRaw) {
    metaParts.push(t(row.mediaRaw.unitZh, row.mediaRaw.unitEn.replace(/^\/\s*/, 'per ')));
  }
  if ((state.yLens || (state.scenarioId && state.scenarioId !== 'default')) && row._baseIndex != null) {
    metaParts.push(t(`官方分 ${format(row._baseIndex, 1)}`, `Base ${format(row._baseIndex, 1)}`));
  }
  if (state.costProfile && state.costProfile !== 'benchmark' && row._baseCost != null) {
    metaParts.push(t(`基准价 ${money(row._baseCost)}`, `Avg ${money(row._baseCost)}`));
  }
  if (frontierIds.has(row.id)) metaParts.push(t('帕累托前沿', 'Pareto frontier'));
  if (rankInfo) {
    metaParts.push(t(`性价比 #${rankInfo.rank}/${qualifiedCount}`, `Value #${rankInfo.rank}/${qualifiedCount}`));
  }
  $('#pinnedMeta').textContent = metaParts.join(' · ');

  $('#pinCostLabel').textContent = activeKey === 'media'
    ? (row.mediaKind === 'image' ? t('单张成本', 'Cost / img') : row.mediaKind === 'video' ? t('单段成本', 'Cost / 5s') : t('千字成本', 'Cost / 1k ch'))
    : (state.costProfile && state.costProfile !== 'benchmark' ? t('模拟成本', 'Sim cost') : t('单次成本', 'Cost / task'));
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
  $('#pinnedSubNote').textContent = tierBreakevenText(row.cost, row);

  const crossEl = $('#pinnedCrossTabs');
  const crossInfo = !['coding-agents', 'media'].includes(activeKey) ? crossTabIndex.get(row.id) : null;
  const tabDefs = [
    ['models', '综合', 'Intel'],
    ['frontier', '极限', 'Hard'],
    ['human-arena', '审美', 'Taste'],
    ['cyber', '安全', 'Cyber']
  ];
  const crossEntries = crossInfo
    ? tabDefs.filter(([k]) => crossInfo[k] && !$(`#tab-${k}`)?.hidden)
    : [];
  const hasOrgRanks = !['coding-agents', 'media'].includes(activeKey) && (orgRankIndex.has(row.id) || !!row.livebench);
  if (crossEntries.length >= 2 || hasOrgRanks) {
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
          runNavAction(() => {
            chooseChart(tabKey);
            const targetRow = state?.rows.find(r => r.id === row.id);
            if (targetRow) locateRowInChart(targetRow);
          });
        });
      }
      cFrag.append(pill);
    }
    if (row.livebench) {
      const lbPill = html('button', `LB2 ${format(row.livebench.overall, 1)} (#${row.livebench.rank})`, 'cross-tab-pill');
      lbPill.type = 'button';
      lbPill.title = t('查看 LiveBench 2.0 防污染原榜或纵轴透视', 'Inspect LiveBench 2.0 standalone leaderboard');
      lbPill.addEventListener('click', () => {
        runNavAction(() => {
          orgFocus = 'livebench';
          orgPinnedKey = row.id;
          orgSpotlightKey = row.id;
          chooseChart('orgs');
        });
      });
      cFrag.append(lbPill);
    }
    if (orgRankIndex.has(row.id)) {
      const orgPill = html('button', t('机构分榜 →', 'Org ranks →'), 'cross-tab-pill');
      orgPill.type = 'button';
      orgPill.title = t('在 6 家独立测评机构原榜中同步高亮该模型', 'Spotlight this model across all 6 independent org leaderboards');
      orgPill.addEventListener('click', () => {
        runNavAction(() => {
          orgFocus = 'all';
          orgPinnedKey = row.id;
          orgSpotlightKey = row.id;
          chooseChart('orgs');
        });
      });
      cFrag.append(orgPill);
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

  const starred = isStarred(row);
  $('#pinStarBtn').textContent = starred ? t('★ 已关注', '★ Starred') : t('☆ 关注', '☆ Star');
  $('#pinStarBtn').setAttribute('aria-pressed', String(starred));
  $('#pinStarBtn').title = starred ? t('从本地常驻关注移除', 'Remove from watchlist') : t('加入本地 ★ 常驻关注', 'Add to ★ watchlist');

  const inCmp = state.compareIds.includes(row.id);
  $('#pinCompareBtn').textContent = inCmp ? t('已对比 ✓', 'In cmp ✓') : t('+ 对比', '+ Compare');
  $('#pinCompareBtn').setAttribute('aria-pressed', String(inCmp));

  card.classList.toggle('is-collapsed', pinCollapsed);
  const colBtn = $('#pinCollapseBtn');
  if (colBtn) {
    colBtn.textContent = pinCollapsed ? t('展开', 'Expand') : t('收起', 'Compact');
    colBtn.setAttribute('aria-expanded', String(!pinCollapsed));
    colBtn.title = pinCollapsed ? t('展开完整详情与跨榜胶囊', 'Expand full details') : t('收起为单行迷你条，让出散点图空间', 'Collapse to compact header');
  }

  if (frame) {
    card.style.left = 'auto';
    card.style.right = '12px';
    card.style.top = 'auto';
    card.style.bottom = Math.max(10, host.clientHeight - frame.bottom + 8) + 'px';
    card.style.width = '';
    const cardW = frame.width >= 440 ? Math.min(336, Math.round(frame.width * 0.45)) : Math.min(326, host.clientWidth - 16);
    if (frame.width >= 440) card.style.width = `${cardW}px`;
    const cardH = card.offsetHeight || (pinCollapsed ? 62 : 210);
    const hintVisible = !$('#viewportHintBtn')?.hidden;
    const topRightOffset = hintVisible ? 52 : 10;

    if (frame.width >= 480 && frame.height >= 260) {
      const rx = xCoord(row), ry = y(row.intelligenceIndex);
      const corners = [
        {id: 'br', x: frame.right - cardW - 8, y: frame.bottom - cardH - 8, bias: 0},
        {id: 'tr', x: frame.right - cardW - 8, y: frame.top + topRightOffset, bias: 6},
        {id: 'bl', x: frame.left + 10, y: frame.bottom - cardH - 8, bias: 14},
        {id: 'tl', x: frame.left + 10, y: frame.top + 10, bias: 34}
      ];
      let bestCorner = corners[0], bestPenalty = Infinity;
      for (const c of corners) {
        const box = {x: c.x - 6, y: c.y - 6, w: cardW + 12, h: cardH + 12};
        let pen = c.bias;
        if (Number.isFinite(rx) && rx >= box.x && rx <= box.x + box.w && ry >= box.y && ry <= box.y + box.h) {
          pen += 500;
        }
        for (const n of nodes) {
          if (!inView(n.row) || isFutureHidden(n.row)) continue;
          const nx = xCoord(n.row), ny = y(n.row.intelligenceIndex);
          if (nx >= box.x && nx <= box.x + box.w && ny >= box.y && ny <= box.y + box.h) {
            pen += frontierIds.has(n.row.id) ? 28 : 3;
          }
        }
        if (pen < bestPenalty) {
          bestPenalty = pen;
          bestCorner = c;
        }
      }
      if (bestCorner.id.endsWith('l')) {
        card.style.left = `${frame.left + 10}px`;
        card.style.right = 'auto';
      } else {
        card.style.left = 'auto';
        card.style.right = `${Math.max(10, host.clientWidth - frame.right + 10)}px`;
      }
      if (bestCorner.id.startsWith('t')) {
        card.style.top = `${bestCorner.y}px`;
        card.style.bottom = 'auto';
      } else {
        card.style.top = 'auto';
        card.style.bottom = `${Math.max(10, host.clientHeight - frame.bottom + 8)}px`;
      }
    } else if (y(row.intelligenceIndex) > frame.top + frame.height * 0.55) {
      card.style.top = `${frame.top + (hintVisible ? 46 : 8)}px`;
      card.style.bottom = 'auto';
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
  const costUnitLbl = activeKey === 'media' && row.mediaRaw
    ? `${t('单次成本', 'Unit cost')} (${t(row.mediaRaw.unitZh, row.mediaRaw.unitEn.replace(/^\/\s*/, ''))})`
    : t('每任务成本', 'Cost / task');
  const kvRows = [
    [axisLabel, format(row.intelligenceIndex, 2)],
    [costUnitLbl, money(row.cost)]
  ];
  if (row.timeSec > 0) kvRows.push([t('平均耗时', 'Mean time'), formatTime(row.timeSec)]);
  if (activeKey === 'models' && (row.subscores?.mmmuPro != null || row.subscores?.mlcr != null)) {
    const mParts = [];
    if (row.subscores.mmmuPro != null) mParts.push(`MMMU ${format(row.subscores.mmmuPro, 1)}%`);
    if (row.subscores.mlcr != null) mParts.push(`MLCR ${format(row.subscores.mlcr, 1)}%`);
    kvRows.push([t('视觉多模态 · 超长上下文', 'Vision · Long-Ctx'), mParts.join(' · ')]);
  }
  if (activeKey === 'media' && row.mediaRaw) {
    const mr = row.mediaRaw;
    const elos = [
      mr.t2iElo != null ? `T2I ${format(mr.t2iElo, 0)}` : null,
      mr.imgEditElo != null ? `Edit ${format(mr.imgEditElo, 0)}` : null,
      mr.t2vElo != null ? `T2V ${format(mr.t2vElo, 0)}` : null,
      mr.i2vElo != null ? `I2V ${format(mr.i2vElo, 0)}` : null,
      mr.ttsElo != null ? `TTS ${format(mr.ttsElo, 0)}` : null
    ].filter(Boolean);
    if (elos.length) kvRows.push([t('竞技场原始 Elo', 'Raw Arena Elo'), elos.join(' · ')]);
    if (mr.ttfaMs != null) kvRows.push([t('首包音频延迟 (TTFA)', 'First-Audio TTFA'), `${mr.ttfaMs} ms`]);
  }
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
  if ((activeKey === 'models' || activeKey === 'frontier') && row.livebench) {
    kvRows.push([
      'LiveBench 2.0',
      `${format(row.livebench.overall, 2)} (#${row.livebench.rank}${row.livebench.lbCost != null ? ' · LB ' + money(row.livebench.lbCost) : ''})`
    ]);
  }
  if (activeKey === 'human-arena' && row.arenaRaw) {
    const ar = row.arenaRaw;
    if (ar.chatElo != null) kvRows.push([t('Arena.ai 交流人味 Elo', 'Arena.ai Chat Elo'), format(ar.chatElo, 1)]);
    if (ar.designWebElo != null) {
      kvRows.push([
        t('Design Arena 网页审美', 'Design Arena Web'),
        `${ar.designWebElo} Elo${ar.designWebWinRate != null ? ' (' + format(ar.designWebWinRate, 1) + '%)' : ''}`
      ]);
    }
    if (ar.webdevElo != null) kvRows.push([t('Arena.ai WebDev Elo', 'Arena.ai WebDev Elo'), format(ar.webdevElo, 0)]);
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
  const beSummary = tierBreakevenText(row.cost, row);
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
  if (!state || state.mode !== 'chart' || !frame || event.target.closest('.pinned-card, .lasso-menu, .viewport-hint-btn, .loading')) return null;
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
$('#pinCollapseBtn')?.addEventListener('click', () => {
  pinCollapsed = !pinCollapsed;
  renderPinned();
});
$('#viewportHintBtn')?.addEventListener('click', event => {
  event.stopPropagation();
  if (!state) return;
  const act = $('#viewportHintBtn').dataset.action;
  changeView(act === 'fit' ? {...state.bounds} : {...state.defaultView});
});
$('#pinStarBtn').addEventListener('click', () => {
  if (!state?.selected) return;
  const row = state.rows.find(r => r.id === state.selected);
  if (row) toggleStar(row);
});
$('#pinCompareBtn').addEventListener('click', () => {
  if (state?.selected) toggleCompareId(state.selected);
});
$('#pinGoCompareBtn').addEventListener('click', () => {
  if (!state?.selected) return;
  runNavAction(() => {
    if (!state.compareIds.includes(state.selected)) {
      if (state.compareIds.length >= MAX_COMPARE) state.compareIds.shift();
      state.compareIds.push(state.selected);
    }
    if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...state.compareIds];
    showView('compare');
  });
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
    const rowIdSet = new Set(state.rows.map(r => r.id));
    const shownCmp = state.compareIds.filter(id => rowIdSet.has(id)).length;
    $('#viewStatus').textContent = t(
      `已选 ${shownCmp}/${MAX_COMPARE} 项深度剖析 · 含大尺寸雷达、成本结构与并排对决表`,
      `Comparing ${shownCmp}/${MAX_COMPARE} entries · Hero radar, cost anatomy & matrix`
    );
  } else if (state.mode === 'orgs') {
    const activeOrg = orgBoards.find(b => b.id === orgFocus);
    if (orgFocus === 'bump') {
      $('#viewStatus').textContent = t(
        `跨 ${orgBoards.length} 份独立机构原榜排名轨迹图 · 单击锁定基准曲线，悬停另一模型即可双线对照`,
        `Cross-org rank trajectory across ${orgBoards.length} official boards · Click to pin one trajectory, hover another to compare`
      );
    } else if (orgFocus === 'divergence') {
      $('#viewStatus').textContent = t(
        '自动化硬考（AA / LiveBench）vs 真人盲测（Arena.ai / Design Arena）同批百分位分歧对照 · 消除榜单容量偏差',
        'Automated hard evals (AA / LiveBench) vs. blind human taste (Arena.ai / Design) cohort percentile divergence'
      );
    } else if (activeOrg) {
      const shownOrgRows = filterOrgRows(activeOrg.rows).length;
      $('#viewStatus').textContent = t(
        `${activeOrg.orgZh} · ${activeOrg.titleZh}：显示 ${shownOrgRows}/${activeOrg.rows.length} 项${activeOrg.date ? ' · 原榜日期 ' + activeOrg.date : ''}`,
        `${activeOrg.orgEn} · ${activeOrg.titleEn}: ${shownOrgRows}/${activeOrg.rows.length} rows${activeOrg.date ? ' · As of ' + activeOrg.date : ''}`
      );
    } else {
      const totalShown = orgBoards.reduce((sum, b) => sum + filterOrgRows(b.rows).length, 0);
      $('#viewStatus').textContent = t(
        `并排展示 ${orgBoards.length} 份独立机构原榜（共 ${totalShown} 条上榜记录）· 悬停或点击任意模型跨机构联动对照`,
        `Side-by-side ${orgBoards.length} independent org leaderboards (${totalShown} ranked entries) · Hover or click any model to spotlight across orgs`
      );
    }
  } else if (state.mode === 'table') {
    $('#viewStatus').textContent = t(
      `共 ${rows.length} 项 · α = ${state.valueWeight.toFixed(1)}${state.minScore > 0 ? ' · 门槛 ≥' + state.minScore : ''}${state.maxCost > 0 ? ' · 预算 ≤$' + state.maxCost : ''}`,
      `${rows.length} entries · α = ${state.valueWeight.toFixed(1)}${state.minScore > 0 ? ' · Min ≥' + state.minScore : ''}${state.maxCost > 0 ? ' · Cap ≤$' + state.maxCost : ''}`
    );
  } else if (state.mode === 'sub') {
    const unitZh = activeKey === 'media' ? mediaTrackMeta(state.mediaTrack).zhSubUnit : '次';
    const unitEn = activeKey === 'media' ? mediaTrackMeta(state.mediaTrack).enSubUnit : 'tasks';
    $('#viewStatus').textContent = t(
      `共 ${rows.length} 项 · 参考月费 $${state.subFee} · 预计 ${state.monthlyTasks} ${unitZh}/月`,
      `${rows.length} entries · Sub $${state.subFee}/mo · ${state.monthlyTasks} ${unitEn}/mo`
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

  if (state.mode !== 'curve' && state.mode !== 'compare' && state.mode !== 'orgs') {
    const hasScen = state.scenarioId && state.scenarioId !== 'default' && !['coding-agents', 'media'].includes(activeKey);
    if (state.yLens || hasScen) $('#viewStatus').append(document.createTextNode(` · ${currentAxisLabel()}`));
    if (state.costProfile && state.costProfile !== 'benchmark' && activeKey !== 'media') {
      const cp = COST_PROFILES.find(c => c.id === state.costProfile);
      if (cp) $('#viewStatus').append(document.createTextNode(` · ${t(cp.zh, cp.en)}`));
    }
    if (state.license === 'open') $('#viewStatus').append(document.createTextNode(t(' · 仅开源', ' · Open only')));
    else if (state.license === 'closed') $('#viewStatus').append(document.createTextNode(t(' · 仅闭源', ' · Proprietary')));
    if (state.extraFilter) {
      const xfLabel = $('#extraFilter')?.selectedOptions?.[0]?.textContent;
      if (xfLabel) $('#viewStatus').append(document.createTextNode(` · ${xfLabel}`));
    }
    if (state.company) $('#viewStatus').append(document.createTextNode(t(` · 聚焦：${state.company}`, ` · Focus: ${state.company}`)));
    if (state.search) $('#viewStatus').append(document.createTextNode(t(` · 搜索：${state.search}`, ` · Search: ${state.search}`)));
    if (state.starredOnly) $('#viewStatus').append(document.createTextNode(t(' · ★ 仅关注', ' · ★ Watchlist')));
    if (state.frontierOnly) $('#viewStatus').append(document.createTextNode(t(' · 仅前沿', ' · Frontier')));
  }
  $('#viewStatus').title = $('#viewStatus').textContent;

  if (!rows.length) {
    $('#loading').hidden = state.mode !== 'chart';
    $('#loading').replaceChildren(makeEmptyResetNotice('没有匹配结果，请调整条件或一键恢复全部。', 'No matching results. Clear filters to restore.'));
  } else {
    $('#loading').hidden = true;
  }

  const selected = state.rows.find(row => row.id === state.selected);
  if (selected && state.mode !== 'curve' && state.mode !== 'compare' && state.mode !== 'orgs') {
    selectionNotice = '';
    $('#selection').textContent = t(`已锁定：${selected.name}`, `Pinned: ${selected.name}`);
  } else {
    $('#selection').textContent = selectionNotice || '';
  }
}

function clearLasso() {
  lasso = null;
  lassoSelection = null;
  const rectEl = svg?.querySelector('.lasso-rect');
  if (rectEl) rectEl.style.display = 'none';
  const menu = $('#lassoMenu');
  if (menu) menu.hidden = true;
}

function scheduleUrlSync() {
  clearTimeout(pendingUrlTimer);
  pendingUrlTimer = setTimeout(() => {
    pendingUrlTimer = 0;
    syncUrlHash();
  }, 180);
}

function changeView(view) {
  if (!state) return;
  clearHover();
  clearLasso();
  state.view = clampView(view, state.bounds);
  state.views[state.xMetric] = {...state.view};
  scheduleUrlSync();
  scheduleDraw();
}

function zoom(axis, factor, anchorX = 0.5, anchorY = 0.5) {
  if (!state) return;
  clearHover();
  clearLasso();
  state.view = pointerZoomView(state.view, state.bounds, axis, factor, anchorX, anchorY);
  state.views[state.xMetric] = {...state.view};
  scheduleUrlSync();
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

for (const btn of document.querySelectorAll('#mediaKindSwitch [data-mkind]')) {
  btn.addEventListener('click', () => {
    if (!state || activeKey !== 'media') return;
    runNavAction(() => setMediaTrack(btn.dataset.mkind || 'image'));
  });
}

$('#reset').addEventListener('click', () => {
  if (state) changeView({...state.defaultView});
});
$('#fit').addEventListener('click', () => {
  if (state) changeView({...state.bounds});
});
$('#boxSelectBtn').addEventListener('click', () => {
  boxSelectMode = !boxSelectMode;
  if (!boxSelectMode) clearLasso();
  if (state) syncControls();
});
$('#lassoZoomBtn').addEventListener('click', () => {
  if (!state || !lassoSelection) return;
  const targetView = lassoSelection.view;
  boxSelectMode = false;
  clearLasso();
  syncControls();
  changeView(targetView);
});
$('#lassoCompareBtn').addEventListener('click', () => {
  if (!state || !lassoSelection?.hits?.length) return;
  const picked = frontierCompareIds(lassoSelection.hits, MAX_COMPARE);
  if (!picked.length) return;
  runNavAction(() => {
    state.compareIds = picked;
    if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...picked];
    boxSelectMode = false;
    clearLasso();
    syncControls();
    showView('compare');
  });
});
$('#lassoCancelBtn').addEventListener('click', clearLasso);

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

$('#scenarioBtn').addEventListener('click', () => {
  setScenarioOpen(!scenarioOpen);
});

$('#scenarioResetBtn').addEventListener('click', () => {
  if (!state) return;
  stopHistoryPlay();
  state.scenarioId = 'default';
  state.scenarioWeights = null;
  state.selected = null;
  reprojectRows(state);
  syncControls();
  syncUrlHash();
  buildPlot();
});

$('#costProfileSelect').addEventListener('change', () => {
  if (!state) return;
  stopHistoryPlay();
  state.costProfile = $('#costProfileSelect').value || 'benchmark';
  state.selected = null;
  reprojectRows(state);
  syncControls();
  syncUrlHash();
  buildPlot();
});

$('#starFilterBtn').addEventListener('click', () => {
  if (!state) return;
  const starCountOnTab = state.rows.filter(isStarred).length;
  if (!state.starredOnly && starCountOnTab === 0) {
    selectionNotice = t(
      '尚未收藏关注模型：单击任意散点后点右上角 ★，或在数据表行末点 ☆ 即可加入常驻关注列表',
      'No starred models yet — click any dot and press ★ (or ☆ in Table view) to build your watchlist'
    );
    updateSummary();
    return;
  }
  selectionNotice = '';
  state.starredOnly = !state.starredOnly;
  state.selected = null;
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
  syncUrlHash();
});

for (const [selId, key] of [['#routerFastSelect', 'routerFastId'], ['#routerStrongSelect', 'routerStrongId']]) {
  $(selId).addEventListener('change', () => {
    if (!state) return;
    state[key] = $(selId).value;
    syncRouterControls();
    syncUrlHash();
  });
}

$('#routerShare').addEventListener('input', () => {
  if (!state) return;
  state.routerShare = Number($('#routerShare').value);
  syncRouterControls();
  scheduleUrlSync();
});

for (const [btnId, mode] of [['#radarModeBench', 'bench'], ['#radarModeDomain', 'domain'], ['#radarModeLiveBench', 'livebench']]) {
  $(btnId).addEventListener('click', () => {
    if (!state || state.radarMode === mode) return;
    state.radarMode = mode;
    syncUrlHash();
    renderCompare();
  });
}

for (const btn of document.querySelectorAll('#compareVisSwitch [data-cvis]')) {
  btn.addEventListener('click', () => {
    if (!state || state.compareVis === btn.dataset.cvis) return;
    state.compareVis = btn.dataset.cvis;
    tip.hidden = true;
    syncUrlHash();
    renderCompare();
  });
}

for (const btn of document.querySelectorAll('#radarScaleSwitch [data-cscale]')) {
  btn.addEventListener('click', () => {
    if (!state || state.radarScale === btn.dataset.cscale) return;
    state.radarScale = btn.dataset.cscale;
    tip.hidden = true;
    syncUrlHash();
    renderCompare();
  });
}

for (const btn of document.querySelectorAll('#stripScaleSwitch [data-sscale]')) {
  btn.addEventListener('click', () => {
    if (!state || state.stripScale === btn.dataset.sscale) return;
    state.stripScale = btn.dataset.sscale;
    tip.hidden = true;
    syncUrlHash();
    renderCompare();
  });
}

$('#deltaBaseSelect').addEventListener('change', () => {
  if (!state) return;
  state.deltaBase = $('#deltaBaseSelect').value || 'mean';
  tip.hidden = true;
  syncUrlHash();
  renderCompare();
});

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
  if (!state || ['coding-agents', 'media'].includes(activeKey) || !Array.isArray(lastModelCompareIds)) return;
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
  if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...state.compareIds];
  syncUrlHash();
  renderCompare();
  updateSummary();
});

$('#compareFrontierBtn').addEventListener('click', () => {
  if (!state) return;
  const pool = licenseFilteredRows(state.rows);
  state.compareIds = frontierCompareIds(pool.length >= 2 ? pool : state.rows, MAX_COMPARE);
  if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...state.compareIds];
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
  if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...state.compareIds];
  syncUrlHash();
  renderCompare();
  updateSummary();
});

function resetActiveFilters({clearOrgMatch = false} = {}) {
  if (!state) return;
  stopHistoryPlay();
  selectionNotice = '';
  state.yLens = '';
  state.scenarioId = 'default';
  state.scenarioWeights = null;
  state.costProfile = 'benchmark';
  state.starredOnly = false;
  state.company = null;
  state.license = 'all';
  state.extraFilter = '';
  state.search = '';
  state.frontierOnly = false;
  state.minScore = 0;
  state.maxCost = 0;
  state.selected = null;
  if (clearOrgMatch) orgMatchedOnly = false;
  reprojectRows(state);
  syncControls();
  syncUrlHash();
  renderLegend();
  buildPlot();
}

function makeEmptyResetNotice(msgZh, msgEn, {clearOrgMatch = false} = {}) {
  const wrap = html('div', null, 'empty-inline-wrap');
  wrap.append(html('span', t(msgZh, msgEn)));
  const btn = html('button', t('清除筛选恢复全部', 'Reset all filters'), 'empty-reset-btn');
  btn.type = 'button';
  btn.addEventListener('click', () => resetActiveFilters({clearOrgMatch}));
  wrap.append(btn);
  return wrap;
}

$('#clearFilters').addEventListener('click', () => {
  resetActiveFilters({clearOrgMatch: activeKey === 'orgs'});
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
  if (mode === 'orgs') {
    chooseChart('orgs');
    return;
  }
  if (!state || !['chart', 'table', 'curve', 'sub', 'compare'].includes(mode)) return;
  if (activeKey === 'orgs') {
    chooseChart('models', {changeHash: false});
    if (!state) return;
  }
  stopHistoryPlay();
  if (comparePickerOpen && mode !== 'compare') setComparePickerOpen(false);
  if (viewToolsOpen) setViewToolsOpen(false);
  if (scenarioOpen && (mode === 'curve' || mode === 'compare')) setScenarioOpen(false);
  endPointerInteractions();
  clearLasso();
  clearHover();
  state.mode = mode;
  lastArenaMode = mode;
  valueDetailsOpen = false;
  syncControls();
  renderStatus();
  syncUrlHash();
  if (mode === 'chart') buildPlot();
  else if (mode === 'table') renderTable();
  else if (mode === 'sub') renderSubTable();
  else if (mode === 'compare') renderCompare();
  scheduleDraw();
}

for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => runNavAction(() => showView(button.dataset.view)));
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
  if (state && !event.target.closest('.pinned-card, .lasso-menu, .viewport-hint-btn, .loading') && !nearestItem(event)) {
    changeView({...state.defaultView});
  }
});

host.addEventListener('click', event => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (!state || event.target.closest('.pinned-card, .lasso-menu, .viewport-hint-btn, .loading')) return;
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

// Unified single-pointer pan, rubber-band box-select & two-finger pinch-zoom on chart
host.addEventListener('pointerdown', event => {
  if (!state || !frame || event.button > 0) return;
  if (event.target.closest('.pinned-card, .lasso-menu, .viewport-hint-btn, .loading') || event.target.closest('.axis')) return;
  suppressClick = false;
  clearHover();
  host.focus({preventScroll: true});
  host.classList.remove('over-point');
  activePointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  try { host.setPointerCapture(event.pointerId); } catch {}

  if (activePointers.size === 1) {
    clearLasso();
    if (boxSelectMode || event.shiftKey || event.altKey) {
      lasso = {id: event.pointerId, startX: event.clientX, startY: event.clientY, curX: event.clientX, curY: event.clientY, moved: false};
      drag = null;
    } else {
      drag = {id: event.pointerId, startX: event.clientX, startY: event.clientY, view: {...state.view}, moved: false};
      host.classList.add('dragging');
    }
    pinch = null;
  } else if (activePointers.size === 2) {
    clearLasso();
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

  if (lasso && lasso.id === event.pointerId && frame) {
    const dx = event.clientX - lasso.startX, dy = event.clientY - lasso.startY;
    if (!lasso.moved && Math.hypot(dx, dy) > 5) lasso.moved = true;
    if (!lasso.moved) return;
    lasso.curX = event.clientX;
    lasso.curY = event.clientY;
    const hostRect = host.getBoundingClientRect();
    const x1 = Math.max(frame.left, Math.min(frame.right, Math.min(lasso.startX, lasso.curX) - hostRect.left));
    const x2 = Math.max(frame.left, Math.min(frame.right, Math.max(lasso.startX, lasso.curX) - hostRect.left));
    const y1 = Math.max(frame.top, Math.min(frame.bottom, Math.min(lasso.startY, lasso.curY) - hostRect.top));
    const y2 = Math.max(frame.top, Math.min(frame.bottom, Math.max(lasso.startY, lasso.curY) - hostRect.top));
    const rectEl = svg.querySelector('.lasso-rect');
    if (rectEl) {
      setAttrs(rectEl, {x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1)});
      rectEl.style.display = '';
    }
    return;
  }

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
  if (lasso && lasso.id === event.pointerId) {
    const finished = lasso;
    lasso = null;
    if (finished.moved && frame && state) {
      suppressClick = true;
      const hostRect = host.getBoundingClientRect();
      const x1 = Math.max(frame.left, Math.min(frame.right, Math.min(finished.startX, finished.curX) - hostRect.left));
      const x2 = Math.max(frame.left, Math.min(frame.right, Math.max(finished.startX, finished.curX) - hostRect.left));
      const y1 = Math.max(frame.top, Math.min(frame.bottom, Math.min(finished.startY, finished.curY) - hostRect.top));
      const y2 = Math.max(frame.top, Math.min(frame.bottom, Math.max(finished.startY, finished.curY) - hostRect.top));
      if (x2 - x1 >= 12 && y2 - y1 >= 12) {
        const vxMin = state.view.x + ((x1 - frame.left) / frame.width) * state.view.width;
        const vxMax = state.view.x + ((x2 - frame.left) / frame.width) * state.view.width;
        const vyMax = state.view.y + ((frame.bottom - y1) / frame.height) * state.view.height;
        const vyMin = state.view.y + ((frame.bottom - y2) / frame.height) * state.view.height;
        const hits = nodes
          .filter(n => inView(n.row) && !isFutureHidden(n.row))
          .filter(n => {
            const px = xCoord(n.row), py = y(n.row.intelligenceIndex);
            return px >= x1 && px <= x2 && py >= y1 && py <= y2;
          })
          .map(n => n.row);
        lassoSelection = {
          view: {x: vxMin, y: vyMin, width: Math.max(1e-6, vxMax - vxMin), height: Math.max(0.5, vyMax - vyMin)},
          hits
        };
        const menu = $('#lassoMenu');
        $('#lassoCount').textContent = t(`框选 ${hits.length} 项`, `${hits.length} in box`);
        $('#lassoCompareBtn').disabled = hits.length === 0;
        menu.style.left = '8px';
        menu.style.top = '8px';
        menu.hidden = false;
        const menuW = Math.min(hostRect.width - 16, Math.max(180, menu.offsetWidth || 300));
        const menuH = menu.offsetHeight || 38;
        const leftPx = Math.max(8, Math.min(hostRect.width - menuW - 8, (x1 + x2) / 2 - menuW / 2));
        const topPx = y2 + menuH + 10 < hostRect.height ? y2 + 8 : Math.max(8, y1 - menuH - 8);
        menu.style.left = `${leftPx}px`;
        menu.style.top = `${topPx}px`;
      } else {
        clearLasso();
      }
    } else {
      clearLasso();
    }
  }
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
  lasso = null;
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

function buildGlobalCatalog(snap) {
  if (!snap) return [];
  const items = [];
  const seenModelIds = new Set();
  const modelTabOrder = [
    ['models', 'models'],
    ['frontier', 'frontierModels'],
    ['human-arena', 'humanArenaModels'],
    ['cyber', 'cyberModels']
  ];
  for (const [tabKey, snapKey] of modelTabOrder) {
    const arr = Array.isArray(snap[snapKey]) ? validRows(snap[snapKey]) : [];
    for (const row of arr) {
      if (seenModelIds.has(row.id)) continue;
      seenModelIds.add(row.id);
      items.push({
        row,
        primaryTab: tabKey,
        kind: 'llm',
        searchText: `${rowSearchBlob(row)} llm model 大模型 智能`
      });
    }
  }
  for (const row of (Array.isArray(snap.codingAgents) ? validRows(snap.codingAgents) : [])) {
    items.push({
      row,
      primaryTab: 'coding-agents',
      kind: 'agent',
      searchText: `${rowSearchBlob(row)} agent coding 编程 智能体`
    });
  }
  for (const row of (Array.isArray(snap.mediaModels) ? validRows(snap.mediaModels) : [])) {
    items.push({
      row,
      primaryTab: 'media',
      kind: row.mediaKind || 'media',
      searchText: `${rowSearchBlob(row)} media 多模态 生成`
    });
  }
  return items;
}

function getCmdMatches() {
  const q = $('#cmdInput').value.trim().toLocaleLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const filtered = tokens.length
    ? globalCatalog.filter(it => tokens.every(tk => it.searchText.includes(tk)))
    : globalCatalog;
  const focusTab = activeKey === 'orgs' ? 'models' : activeKey;
  return [...filtered]
    .sort((a, b) => {
      const sa = isStarred(a.row) ? 1 : 0;
      const sb = isStarred(b.row) ? 1 : 0;
      if (!tokens.length) {
        if (sa !== sb) return sb - sa;
        const ta = a.primaryTab === focusTab ? 2 : a.kind === 'llm' ? 1 : 0;
        const tb = b.primaryTab === focusTab ? 2 : b.kind === 'llm' ? 1 : 0;
        if (ta !== tb) return tb - ta;
        return b.row.intelligenceIndex - a.row.intelligenceIndex;
      }
      const na = (a.row.shortName || a.row.name).toLocaleLowerCase();
      const nb = (b.row.shortName || b.row.name).toLocaleLowerCase();
      const pa = na.startsWith(tokens[0]) ? 1 : 0;
      const pb = nb.startsWith(tokens[0]) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      if (sa !== sb) return sb - sa;
      if (a.kind !== b.kind && (a.kind === 'llm' || b.kind === 'llm')) return a.kind === 'llm' ? -1 : 1;
      return b.row.intelligenceIndex - a.row.intelligenceIndex;
    })
    .slice(0, 32);
}

function activateCmdEntry(entry, {toCompare = false} = {}) {
  if (!entry) return;
  setCmdOpen(false, {restoreFocus: false});
  runNavAction(() => {
    if (activeKey !== entry.primaryTab) chooseChart(entry.primaryTab);
    if (!state) return;
    if (activeKey === 'media' && entry.row.mediaKind && state.mediaTrack !== entry.row.mediaKind) {
      setMediaTrack(entry.row.mediaKind, {reRender: true, updateUrl: true});
    }
    let targetRow = state.rows.find(r => r.id === entry.row.id);
    if (!targetRow || !filteredRows().some(r => r.id === entry.row.id)) {
      state.yLens = '';
      state.search = '';
      state.license = 'all';
      state.extraFilter = '';
      state.starredOnly = false;
      state.frontierOnly = false;
      state.company = null;
      reprojectRows(state);
      syncControls();
      renderLegend();
      buildPlot();
      targetRow = state.rows.find(r => r.id === entry.row.id);
    }
    if (!targetRow) return;
    if (toCompare) {
      if (!state.compareIds.includes(targetRow.id)) {
        if (state.compareIds.length >= MAX_COMPARE) state.compareIds.shift();
        state.compareIds.push(targetRow.id);
      }
      state.radarPinnedId = targetRow.id;
      if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...state.compareIds];
      showView('compare');
    } else {
      locateRowInChart(targetRow);
      requestAnimationFrame(() => host.focus({preventScroll: true}));
    }
  });
}

function renderCmdList() {
  const listEl = $('#cmdList');
  const matches = getCmdMatches();
  if (cmdIndex >= matches.length) cmdIndex = Math.max(0, matches.length - 1);
  const frag = document.createDocumentFragment();
  if (!matches.length) {
    frag.append(html('div', t('未找到匹配模型或生成引擎，请尝试其他关键词', 'No matching models or generative engines found'), 'anatomy-note'));
    listEl.replaceChildren(frag);
    return;
  }
  matches.forEach((entry, idx) => {
    const row = entry.row;
    const item = html('div', null, idx === cmdIndex ? 'cmd-item is-active' : 'cmd-item');
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(idx === cmdIndex));

    const main = html('div', null, 'cmd-item-main');
    const title = html('div', null, 'cmd-item-title');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = color(row.creator?.color);
    title.append(dot, html('span', row.name));
    const badgeTxt = entry.primaryTab === 'coding-agents'
      ? t('智能体', 'Agent')
      : entry.primaryTab === 'media'
        ? (row.mediaKind === 'image' ? t('图像', 'Image') : row.mediaKind === 'video' ? t('视频', 'Video') : 'TTS')
        : t('大模型', 'LLM');
    title.append(html('span', badgeTxt, 'row-tag'));

    let subText = `${row.creator?.name || 'Other'} · ${format(row.intelligenceIndex, 1)} · ${money(row.cost)}`;
    if (entry.primaryTab === 'media' && row.mediaRaw) {
      subText += ` (${t(row.mediaRaw.unitZh, row.mediaRaw.unitEn.replace(/^\/\s*/, ''))})`;
    } else if (entry.kind === 'llm') {
      const info = crossTabIndex.get(row.id);
      if (info) {
        const ranks = [
          info.models ? `${t('综合', 'Int')} #${info.models.rank}` : null,
          info.frontier ? `${t('极限', 'Hard')} #${info.frontier.rank}` : null,
          info['human-arena'] ? `${t('审美', 'Taste')} #${info['human-arena'].rank}` : null,
          info.cyber ? `${t('安全', 'Cyber')} #${info.cyber.rank}` : null
        ].filter(Boolean);
        if (ranks.length) subText += ` · ${ranks.join(' / ')}`;
      }
    }
    main.append(title, html('div', subText, 'cmd-item-sub'));

    const actions = html('div', null, 'cmd-item-actions');
    const starBtn = html('button', isStarred(row) ? '★' : '☆', 'star-row-btn');
    starBtn.type = 'button';
    starBtn.setAttribute('aria-pressed', String(isStarred(row)));
    starBtn.title = t('常驻关注', 'Toggle star');
    starBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleStar(row);
    });
    const cmpBtn = html('button', t('+对比', '+Cmp'));
    cmpBtn.type = 'button';
    cmpBtn.addEventListener('click', e => {
      e.stopPropagation();
      activateCmdEntry(entry, {toCompare: true});
    });
    actions.append(starBtn, cmpBtn);

    item.append(main, actions);
    item.addEventListener('pointerenter', () => {
      if (cmdIndex === idx) return;
      cmdIndex = idx;
      for (const [i, el] of [...listEl.children].entries()) {
        el.classList.toggle('is-active', i === cmdIndex);
        el.setAttribute('aria-selected', String(i === cmdIndex));
      }
    });
    item.addEventListener('click', event => {
      activateCmdEntry(entry, {toCompare: event.shiftKey});
    });
    frag.append(item);
  });
  listEl.replaceChildren(frag);
}

let cmdPrevFocus = null;
function setCmdOpen(open, {restoreFocus = true} = {}) {
  if (open && !cmdOpen) {
    cmdPrevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  cmdOpen = open;
  $('#cmdBackdrop').hidden = !open;
  if (open) {
    cmdIndex = 0;
    renderCmdList();
    requestAnimationFrame(() => {
      $('#cmdInput').focus({preventScroll: true});
      $('#cmdInput').select();
    });
  } else if (restoreFocus) {
    const target = cmdPrevFocus && cmdPrevFocus.isConnected && !$('#cmdBackdrop').contains(cmdPrevFocus)
      ? cmdPrevFocus
      : $('#cmdPaletteBtn');
    target.focus({preventScroll: true});
    cmdPrevFocus = null;
  } else {
    cmdPrevFocus = null;
  }
}

$('#cmdPaletteBtn').addEventListener('click', () => setCmdOpen(!cmdOpen));
$('#cmdCloseBtn').addEventListener('click', () => setCmdOpen(false));
$('#cmdBackdrop').addEventListener('click', event => {
  if (event.target === $('#cmdBackdrop')) setCmdOpen(false);
});
$('#cmdInput').addEventListener('input', () => {
  cmdIndex = 0;
  renderCmdList();
});

// Close floating popovers on outside click or Escape
document.addEventListener('pointerdown', event => {
  if (changelogOpen && !event.target.closest('.update-wrap')) {
    setChangelogOpen(false);
  }
  if (scenarioOpen && !event.target.closest('.scenario-wrap')) {
    setScenarioOpen(false);
  }
  if (viewToolsOpen && !event.target.closest('.tools-wrap')) {
    setViewToolsOpen(false);
  }
  if (comparePickerOpen && !event.target.closest('.compare-picker-wrap')) {
    setComparePickerOpen(false);
  }
  if (lassoSelection && !event.target.closest('#chart')) {
    clearLasso();
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
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    setCmdOpen(!cmdOpen);
    return;
  }
  if (guideOpen) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setGuideOpen(false);
    }
    return;
  }
  if (cmdOpen) {
    const matches = getCmdMatches();
    if (event.key === 'Escape') {
      event.preventDefault();
      setCmdOpen(false);
    } else if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      cmdIndex = (cmdIndex + 1) % matches.length;
      renderCmdList();
      $('#cmdList').children[cmdIndex]?.scrollIntoView({block: 'nearest'});
    } else if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      cmdIndex = (cmdIndex - 1 + matches.length) % matches.length;
      renderCmdList();
      $('#cmdList').children[cmdIndex]?.scrollIntoView({block: 'nearest'});
    } else if (event.key === 'Enter' && matches[cmdIndex]) {
      event.preventDefault();
      activateCmdEntry(matches[cmdIndex], {toCompare: event.shiftKey});
    }
    return;
  }
  const tag = event.target?.tagName;
  const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || event.target?.isContentEditable;
  if (!typing && event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowLeft' && navHistory.canBack()) {
    event.preventDefault();
    navBack();
    return;
  }
  if (!typing && event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowRight' && navHistory.canForward()) {
    event.preventDefault();
    navForward();
    return;
  }
  if (!typing && event.altKey && !event.ctrlKey && !event.metaKey && ['1', '2', '3', '4', '5', '6', '7'].includes(event.key)) {
    const visibleTabs = [...document.querySelectorAll('.tabs [role=tab]')].filter(el => !el.hidden);
    const targetTab = visibleTabs[Number(event.key) - 1];
    if (targetTab && targetTab.dataset.chart !== activeKey) {
      event.preventDefault();
      runNavAction(() => chooseChart(targetTab.dataset.chart));
    }
    return;
  }
  if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (state && activeKey === 'orgs' && ['1', '2', '3'].includes(event.key)) {
      const nextFocus = event.key === '1' ? 'all' : event.key === '2' ? 'bump' : 'divergence';
      if (orgFocus !== nextFocus) {
        event.preventDefault();
        runNavAction(() => {
          orgFocus = nextFocus;
          syncUrlHash();
          renderOrgLeaderboards();
          updateSummary();
        });
      }
      return;
    }
    if (state && activeKey !== 'orgs' && ['1', '2', '3', '4', '5'].includes(event.key)) {
      const modes = ['chart', 'table', 'curve', 'sub', 'compare'];
      const targetMode = modes[Number(event.key) - 1];
      if (targetMode && state.mode !== targetMode) {
        event.preventDefault();
        runNavAction(() => showView(targetMode));
      }
      return;
    }
    if (event.key === '?' && state) {
      event.preventDefault();
      setGuideOpen(true);
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
  } else if (scenarioOpen) {
    setScenarioOpen(false);
    $('#scenarioBtn').focus({preventScroll: true});
  } else if (viewToolsOpen) {
    setViewToolsOpen(false);
    $('#viewToolsBtn').focus({preventScroll: true});
  } else if (comparePickerOpen) {
    setComparePickerOpen(false);
    $('#compareAddBtn').focus({preventScroll: true});
  } else if (lassoSelection) {
    clearLasso();
  } else if (boxSelectMode) {
    boxSelectMode = false;
    if (state) syncControls();
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
  } else if (state?.mode === 'orgs' && orgPinnedKey) {
    orgPinnedKey = null;
    orgSpotlightKey = null;
    lastOrgBarSig = '';
    applyOrgSpotlight(null);
  } else if (state?.selected) {
    clearPin();
  }
});

addEventListener('resize', () => {
  syncLegendNav();
  if (changelogOpen) clampAnchoredPopover($('#changelogPopover'), $('#updateBadge'), 340);
  if (scenarioOpen) clampAnchoredPopover($('#scenarioPopover'), $('#scenarioBtn'), 340);
  if (viewToolsOpen) clampAnchoredPopover($('#viewToolsPopover'), $('#viewToolsBtn'), 360);
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
let orgBumpResizeTimer = 0;
new ResizeObserver(() => {
  if (state?.mode === 'orgs' && orgFocus === 'bump') {
    clearTimeout(orgBumpResizeTimer);
    orgBumpResizeTimer = setTimeout(() => {
      if (state?.mode === 'orgs' && orgFocus === 'bump') renderOrgLeaderboards();
    }, 120);
  }
}).observe($('#orgContent'));

function showLoadError(error) {
  host.hidden = false;
  $('#dataTable').hidden = true;
  $('#orgPanel').hidden = true;
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

function cleanCreatorName(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return 'Other';
  return trimmed === 'Bytedance' ? 'ByteDance' : trimmed;
}

function hydrateDerivedModels(snap) {
  if (!snap || !Array.isArray(snap.models)) return snap;
  for (const key of ['models', 'frontierModels', 'humanArenaModels', 'codingAgents', 'cyberModels', 'mediaModels']) {
    if (!Array.isArray(snap[key])) continue;
    for (const item of snap[key]) {
      if (item?.creator && typeof item.creator === 'object') {
        item.creator = {...item.creator, name: cleanCreatorName(item.creator.name)};
      }
    }
  }
  if (snap.orgLeaderboards && typeof snap.orgLeaderboards === 'object') {
    for (const board of Object.values(snap.orgLeaderboards)) {
      if (!Array.isArray(board?.rows)) continue;
      for (const row of board.rows) {
        if (typeof row?.creator === 'string') row.creator = cleanCreatorName(row.creator);
      }
    }
  }
  const humanById = new Map((snap.humanArenaModels || []).map(h => [h.id, h]));
  const humanByFam = new Map();
  // Prefer the most complete, highest-effort flagship sibling per family (humanArenaModels is sorted by ascending cost!)
  const sortedHuman = [...(snap.humanArenaModels || [])].sort((a, b) =>
    (b.arenaRaw?.dimensionCount || 0) - (a.arenaRaw?.dimensionCount || 0)
    || (b.effort?.level || 0) - (a.effort?.level || 0)
    || b.humanIndex - a.humanIndex
  );
  for (const h of sortedHuman) {
    if (h.family?.slug && !humanByFam.has(h.family.slug)) humanByFam.set(h.family.slug, h);
  }
  const frontById = new Map((snap.frontierModels || []).map(f => [f.id, f]));
  snap.models = snap.models.map(m => {
    const hExact = humanById.get(m.id);
    const canShareFam = m.family?.slug && (!m.effort || m.effort.level >= 30);
    const hFam = canShareFam ? humanByFam.get(m.family.slug) : null;
    const sharedHumanScores = hFam?.humanScores
      ? {
        chatVibe: hFam.humanScores.chatVibe,
        webdev: hFam.humanScores.webdev,
        designWeb: hFam.humanScores.designWeb,
        designUi: hFam.humanScores.designUi,
        creativeCraft: hFam.humanScores.creativeCraft,
        spatialMotion: hFam.humanScores.spatialMotion,
        deliverable: hFam.humanScores.deliverable,
        antiSlop: hFam.humanScores.antiSlop
      }
      : null;
    let mergedHuman = null;
    if (hExact?.humanScores) {
      mergedHuman = {...hExact.humanScores};
      if (sharedHumanScores && canShareFam) {
        for (const [k, v] of Object.entries(sharedHumanScores)) {
          if (mergedHuman[k] == null && v != null) mergedHuman[k] = v;
        }
      }
    } else if (sharedHumanScores) {
      mergedHuman = sharedHumanScores;
    }
    const f = frontById.get(m.id);
    return {
      ...m,
      ...(f?.frontierScores ? {frontierScores: f.frontierScores} : {}),
      ...(mergedHuman ? {humanScores: mergedHuman, ...(hExact?.arenaRaw ? {arenaRaw: hExact.arenaRaw} : {})} : {})
    };
  });
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

const ORG_FALLBACK_COLORS = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
  meta: '#0668e1',
  xai: '#94a3b8',
  deepseek: '#4f7cff',
  alibaba: '#ff6a00',
  qwen: '#ff6a00',
  'z ai': '#38bdf8',
  zai: '#38bdf8',
  moonshot: '#a78bfa',
  minimax: '#f472b6',
  mistral: '#f59e0b',
  xiaomi: '#fb923c',
  bytedance: '#22d3ee',
  nvidia: '#76b900',
  amazon: '#f59e0b',
  cohere: '#34d399'
};

function orgCreatorColor(name, explicitColor = null) {
  if (explicitColor) return color(explicitColor);
  const key = String(name || '').toLowerCase().trim();
  const mapped = orgCreatorColors.get(key) || ORG_FALLBACK_COLORS[key];
  return color(mapped || '#64748b');
}

function normalizeOrgSpotKey(raw) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildStandaloneOrgBoards(snap) {
  orgBoards = [];
  orgRankIndex = new Map();
  orgFamilyIndex = new Map();
  orgCreatorColors = new Map();
  if (!snap || !Array.isArray(snap.models)) return;

  const baseModels = validRows(snap.models);
  const baseById = new Map();
  for (const m of baseModels) {
    baseById.set(m.id, m);
    const cname = m.creator?.name;
    if (cname && m.creator?.color && !orgCreatorColors.has(cname.toLowerCase())) {
      orgCreatorColors.set(cname.toLowerCase(), m.creator.color);
    }
  }

  const snapDate = typeof snap.updatedAt === 'string' ? snap.updatedAt.slice(0, 10) : '';
  const aaSorted = sortRows(baseModels, 'intelligenceIndex', 'desc');
  const familyRepBySlug = new Map();
  for (const m of aaSorted) {
    if (m.family?.slug && !familyRepBySlug.has(m.family.slug)) familyRepBySlug.set(m.family.slug, m);
  }
  const cyberByFam = new Map();
  for (const c of sortRows(validRows(snap.cyberModels || []), 'intelligenceIndex', 'desc')) {
    const cf = c.family?.slug || c.slug;
    if (cf && !cyberByFam.has(cf)) cyberByFam.set(cf, c);
  }
  const normExtFamilySlug = raw => String(raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-(max|xhigh|high|medium|low|minimal|thinking|non-reasoning)$/, '');

  const aaRows = aaSorted.map((m, i) => ({
    rank: i + 1,
    modelId: m.id,
    familySlug: m.family?.slug || null,
    rawName: m.name,
    name: m.name,
    shortName: m.shortName || m.name,
    creator: m.creator?.name || 'Other',
    creatorColor: m.creator?.color || null,
    isOpenWeights: !!m.isOpenWeights,
    score: m.intelligenceIndex,
    cost: m.cost,
    timeSec: m.timeSec,
    subscores: m.subscores || null,
    livebench: m.livebench || null
  }));

  const enrichExternalRows = (rawRows = []) => {
    const idCount = new Map();
    for (const r of rawRows) {
      if (r.modelId) idCount.set(r.modelId, (idCount.get(r.modelId) || 0) + 1);
    }
    return rawRows.map((r, i) => {
      const base = r.modelId ? baseById.get(r.modelId) : null;
      const candFam = !base ? normExtFamilySlug(r.rawName || r.name) : null;
      const sib = !base && candFam ? (familyRepBySlug.get(candFam) || null) : null;
      const cyb = !base && candFam ? (cyberByFam.get(candFam) || null) : null;
      const approxFam = (sib || cyb) ? candFam : null;
      const dupId = !!(r.modelId && (idCount.get(r.modelId) || 0) > 1);
      const creatorName = r.creator || base?.creator?.name || sib?.creator?.name || cyb?.creator?.name || 'Other';
      return {
        ...r,
        rank: r.rank ?? (i + 1),
        modelId: r.modelId || null,
        familySlug: base?.family?.slug || approxFam,
        siblingId: sib?.id || null,
        siblingName: sib ? (sib.shortName || sib.name) : null,
        cyberId: cyb?.id || null,
        cyberName: cyb ? (cyb.shortName || cyb.name) : null,
        rawName: r.rawName || r.name || '',
        name: base?.name || r.name || r.rawName || '',
        shortName: base?.shortName || r.name || r.rawName || '',
        dupId,
        creator: creatorName,
        creatorColor: base?.creator?.color || sib?.creator?.color || cyb?.creator?.color || null,
        isOpenWeights: base ? !!base.isOpenWeights : sib ? !!sib.isOpenWeights : cyb ? !!cyb.isOpenWeights : null,
        cost: r.cost ?? base?.cost ?? null,
        aaIndex: base?.intelligenceIndex ?? null
      };
    });
  };

  const ext = snap.orgLeaderboards || {};
  const boards = [
    {
      id: 'aa',
      orgZh: 'Artificial Analysis',
      orgEn: 'Artificial Analysis',
      titleZh: '综合智能指数 v5',
      titleEn: 'Intelligence Index v5',
      pillZh: 'AA 综合 v5',
      pillEn: 'AA Index v5',
      shortTag: 'AA',
      tagZh: '自动化综合',
      tagEn: 'Automated',
      briefZh: '10 项标准化任务自动打分并绑定实测 API 成本与耗时，最适合横向算性价比',
      briefEn: '10 standardized automated tasks tied to real API cost & latency — best baseline for value',
      whatZh: '覆盖编程（FrontierCode/Terminal）、科学推理（HLE/CritPt）、百万长上下文与全科闭卷准确率等 10 项客观测试',
      whatEn: '10 objective tasks spanning coding, deep reasoning, million-token context, and closed-book knowledge',
      strengthZh: '全网覆盖模型最全，且同口径记录“跑完整套题的真实美元花费与耗时”',
      strengthEn: 'Widest model coverage paired with standardized real-world USD cost and wall time',
      caveatZh: '纯客观计分测不出“聊起来像不像人”或“页面好不好看”；部分旧题趋于饱和，需结合「前沿极限」看',
      caveatEn: 'Objective tests miss chat tone & visual taste; pair with Frontier Hard to filter saturated suites',
      scoreLabelZh: '智能分',
      scoreLabelEn: 'Score',
      scoreDecimals: 1,
      sourceUrl: 'https://artificialanalysis.ai/models',
      date: snapDate,
      scatterTarget: {tab: 'models', yLens: ''},
      rows: aaRows
    }
  ];

  if (ext.livebench?.rows?.length) {
    boards.push({
      id: 'livebench',
      orgZh: 'LiveBench 2.0',
      orgEn: 'LiveBench 2.0',
      titleZh: '防污染长程实测榜',
      titleEn: 'Contamination-Free v2',
      pillZh: 'LiveBench 2.0',
      pillEn: 'LiveBench 2.0',
      shortTag: 'LB2',
      tagZh: '防污染硬考',
      tagEn: 'Live Evals',
      briefZh: '按月取材新论文/赛事出新题客观判分，杜绝背题库刷榜，长程智能体权重最高',
      briefEn: 'Monthly fresh questions with objective grading — blocks train-set memorization; heavy agentic weight',
      whatZh: '基于近期新论文、新闻与真实任务生成无污染考题，加权考核长程智能体 (×2)、真实编程 (×1.5) 与视觉设计 (×1.5)',
      whatEn: 'Fresh monthly tasks from recent sources weighting Long Agentic (×2), Coding (×1.5), and Design (×1.5)',
      strengthZh: '抗刷榜能力最强，最容易照出“在旧题库虚高、一遇新题就露馅”的模型',
      strengthEn: 'Strongest contamination resistance — exposes models inflated on stale public benchmarks',
      caveatZh: '收录数量少于综合榜，且偏硬核任务执行，不反映日常闲聊文风与情商',
      caveatEn: 'Smaller catalog than AA v5 and focused on hard execution rather than conversational warmth',
      scoreLabelZh: '加权分',
      scoreLabelEn: 'Overall',
      scoreDecimals: 2,
      sourceUrl: ext.livebench.sourceUrl || 'https://livebench.ai/',
      date: ext.livebench.date || '',
      scatterTarget: {tab: 'models', yLens: 'livebench'},
      rows: enrichExternalRows(ext.livebench.rows)
    });
  }

  if (ext.arenaChat?.rows?.length) {
    boards.push({
      id: 'arenaChat',
      orgZh: 'Arena.ai (LMArena)',
      orgEn: 'Arena.ai (LMArena)',
      titleZh: '去水份聊天盲测榜',
      titleEn: 'Style-Ctrl Text Arena',
      pillZh: 'Arena.ai 聊天',
      pillEn: 'Arena.ai Text',
      shortTag: 'Chat',
      tagZh: '真人盲投',
      tagEn: 'Human Elo',
      briefZh: '全球用户双盲投票且已剥离“篇幅长/排版花哨”水份，最贴近日常聊天真实体感',
      briefEn: 'Crowdsourced blind A/B votes with Style Control stripping length/markdown inflation',
      whatZh: '匿名展示两个模型的回复由真实用户投票，再经 Style-Control 算法剔除字数、列表与加粗带来的格式偏置',
      whatEn: 'Anonymous pairwise user votes adjusted by Style Control to remove length and formatting bias',
      strengthZh: '最能反映文风自然度、共情表达与指令理解，发现“分不高但用着顺手”的好模型',
      strengthEn: 'Best proxy for natural writing, tone, and everyday helpfulness beyond test scores',
      caveatZh: '众包提问偏生活与通用写作；专业复杂代码或隐蔽逻辑错漏中，话术流畅的模型容易占便宜',
      caveatEn: 'Crowd voters can reward confident prose even when deep code or math has subtle bugs',
      scoreLabelZh: 'Chat Elo',
      scoreLabelEn: 'Chat Elo',
      scoreDecimals: 1,
      sourceUrl: ext.arenaChat.sourceUrl || 'https://arena.ai/leaderboard',
      date: ext.arenaChat.date || '',
      scatterTarget: {tab: 'human-arena', yLens: 'chatVibe'},
      rows: enrichExternalRows(ext.arenaChat.rows)
    });
  }

  if (ext.arenaWebdev?.rows?.length) {
    boards.push({
      id: 'arenaWebdev',
      orgZh: 'Arena.ai (LMArena)',
      orgEn: 'Arena.ai (LMArena)',
      titleZh: 'WebDev 前端盲测榜',
      titleEn: 'WebDev Blind Arena',
      pillZh: 'Arena.ai WebDev',
      pillEn: 'Arena.ai WebDev',
      shortTag: 'WebDev',
      tagZh: '前端盲投',
      tagEn: 'WebDev Elo',
      briefZh: '现场写可运行网页由真人实测盲投，专测前端一次成型率与交互手感',
      briefEn: 'Live-rendered interactive web apps judged blind by humans on usability & finish',
      whatZh: '要求模型一次性输出可运行的完整前端应用，投票者直接点击交互并看渲染成品盲选胜者',
      whatEn: 'Models build interactive web apps from scratch; voters test live rendered previews blind',
      strengthZh: '同时检验“代码能跑通 + 交互不崩 + 成品像样”，做原型/小工具/落地页参考价值极高',
      strengthEn: 'Jointly tests runnable code, interactive polish, and visual finish for prototypes & frontends',
      caveatZh: '集中在单文件/单页 Web 应用，不代表大型多文件仓库排障能力（后端重构请看「编程智能体」）',
      caveatEn: 'Focuses on single-page web apps; check Coding Agents for multi-file repo engineering',
      scoreLabelZh: 'WebDev Elo',
      scoreLabelEn: 'WebDev Elo',
      scoreDecimals: 1,
      sourceUrl: ext.arenaWebdev.sourceUrl || 'https://arena.ai/leaderboard',
      date: ext.arenaWebdev.date || '',
      scatterTarget: {tab: 'human-arena', yLens: 'webdev'},
      rows: enrichExternalRows(ext.arenaWebdev.rows)
    });
  }

  if (ext.designArena?.rows?.length) {
    boards.push({
      id: 'designArena',
      orgZh: 'Design Arena',
      orgEn: 'Design Arena',
      titleZh: '网页与视觉审美盲测',
      titleEn: 'Website & Visual Taste',
      pillZh: 'Design Arena',
      pillEn: 'Design Arena',
      shortTag: 'Design',
      tagZh: '视觉审美',
      tagEn: 'Aesthetic',
      briefZh: '专攻整站、UI 组件、图表与 SVG 视觉盲测，专治 AI 做出“土味页面”',
      briefEn: '5-track visual taste arena (Websites, UI, DataViz, GameDev, SVG) — spots genuinely good design',
      whatZh: '五大视觉赛道双盲比拼：整站视觉、UI 组件、数据可视化图表、游戏交互与 SVG 矢量绘图',
      whatEn: 'Pairwise blind aesthetic battles across Websites, UI Components, DataViz, GameDev, and SVG',
      strengthZh: '精准区分“审美在线”与“模板味/紫蓝渐变堆砌”，设计师与前端选型必备',
      strengthEn: 'Separates intentional visual taste from generic templated layouts across 5 creative tracks',
      caveatZh: '高度专注视觉和创意表现，不衡量后端逻辑、数学推理或事实防幻觉能力',
      caveatEn: 'Strictly evaluates visual craft & creativity, not factual rigor or backend logic',
      scoreLabelZh: 'Website Elo',
      scoreLabelEn: 'Web Elo',
      scoreDecimals: 0,
      sourceUrl: ext.designArena.sourceUrl || 'https://www.designarena.ai/leaderboard',
      date: ext.designArena.date || snapDate,
      scatterTarget: {tab: 'human-arena', yLens: 'pureVisual'},
      rows: enrichExternalRows(ext.designArena.rows)
    });
  }

  const gdpModels = baseModels
    .filter(m => m.expertElo?.gdpval != null)
    .sort((a, b) => b.expertElo.gdpval - a.expertElo.gdpval);
  if (gdpModels.length) {
    boards.push({
      id: 'aaGdpval',
      orgZh: 'Artificial Analysis',
      orgEn: 'Artificial Analysis',
      titleZh: 'GDPval 44 职业专家交付',
      titleEn: 'GDPval 44-Job Experts',
      pillZh: 'AA GDPval',
      pillEn: 'AA GDPval',
      shortTag: 'GDPval',
      tagZh: '专家盲评',
      tagEn: 'Expert Elo',
      briefZh: '44 类白领岗位真实文档/表格/分析方案由行业专家双盲评审，看谁能直接交差',
      briefEn: 'Industry experts blind-grade real deliverables across 44 white-collar professions',
      whatZh: '覆盖金融、法律、医疗、工程与战略等 44 职业的真实复杂交付物（研报、合同、表格），由领域专家盲评 Elo',
      whatEn: 'Real-world work products (reports, models, memos) across 44 professions blind-graded by experts',
      strengthZh: '最接近“雇 AI 当专业同事能不能直接交付可用成果”的经济价值标尺',
      strengthEn: 'Closest proxy for real economic value and usable professional work deliverables',
      caveatZh: '人工专家评审成本高，主要覆盖主流旗舰与主力型号，超低价小模型收录较少',
      caveatEn: 'High expert-grading cost limits coverage mostly to mainstream & flagship models',
      scoreLabelZh: 'GDPval Elo',
      scoreLabelEn: 'GDPval Elo',
      scoreDecimals: 0,
      sourceUrl: 'https://artificialanalysis.ai/evaluations/gdpval-aa',
      date: snapDate,
      scatterTarget: {tab: 'human-arena', yLens: 'deliverable'},
      rows: gdpModels.map((m, i) => ({
        rank: i + 1,
        modelId: m.id,
        familySlug: m.family?.slug || null,
        rawName: m.name,
        name: m.name,
        shortName: m.shortName || m.name,
        creator: m.creator?.name || 'Other',
        creatorColor: m.creator?.color || null,
        isOpenWeights: !!m.isOpenWeights,
        score: m.expertElo.gdpval,
        briefcaseElo: m.expertElo.briefcase ?? null,
        domainScores: m.domainScores || null,
        cost: m.cost,
        aaIndex: m.intelligenceIndex
      }))
    });
  }

  orgBoards = boards;

  // Index best rank per modelId, spotKey, and familySlug for O(1) lookup & spotlighting
  orgSpotRowMap = new Map();
  orgExactBoardMap = new Map();
  const familyBest = new Map();
  for (const board of orgBoards) {
    for (const row of board.rows) {
      const sk = orgRowSpotKey(row);
      if (!orgSpotRowMap.has(sk)) orgSpotRowMap.set(sk, row);
      const ebKey = `${sk}|${board.id}`;
      if (!orgExactBoardMap.has(ebKey)) {
        orgExactBoardMap.set(ebKey, {rank: row.rank, total: board.rows.length, score: row.score, rawName: row.rawName, exact: true});
      }
      if (row.modelId) {
        let rec = orgRankIndex.get(row.modelId);
        if (!rec) {
          rec = {name: row.name, shortName: row.shortName, creator: row.creator, creatorColor: row.creatorColor, cost: row.cost, familySlug: row.familySlug, ranks: {}};
          orgRankIndex.set(row.modelId, rec);
        }
        if (!rec.ranks[board.id]) {
          rec.ranks[board.id] = {rank: row.rank, total: board.rows.length, score: row.score, rawName: row.rawName, exact: true};
        }
      }
      if (row.familySlug) {
        let frec = familyBest.get(row.familySlug);
        if (!frec) {
          frec = {};
          familyBest.set(row.familySlug, frec);
        }
        if (!frec[board.id]) {
          frec[board.id] = {rank: row.rank, total: board.rows.length, score: row.score, rawName: row.rawName, modelId: row.modelId, exact: false};
        }
      }
    }
  }
  // Attach family-level fallback rank when exact effort variant wasn't evaluated by an org
  orgFamilyIndex = familyBest;
  for (const [, rec] of orgRankIndex) {
    if (!rec.familySlug) continue;
    const frec = familyBest.get(rec.familySlug);
    if (!frec) continue;
    for (const board of orgBoards) {
      if (!rec.ranks[board.id] && frec[board.id]) {
        rec.ranks[board.id] = {...frec[board.id], exact: false};
      }
    }
  }
  if (orgFocus !== 'all' && orgFocus !== 'bump' && orgFocus !== 'divergence' && !orgBoards.some(b => b.id === orgFocus)) {
    orgFocus = 'all';
  }
}

function formatOrgRankSummary(modelId) {
  const rec = orgRankIndex.get(modelId);
  if (!rec) return '—';
  const parts = [];
  for (const board of orgBoards) {
    const r = rec.ranks[board.id];
    if (!r) continue;
    parts.push(`${board.shortTag} ${r.exact ? '' : '~'}#${r.rank}`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

function filterOrgRows(rows) {
  const q = (state?.search || '').trim().toLowerCase();
  const comp = state?.company || null;
  const lic = state?.license || 'all';
  const starOnly = !!state?.starredOnly;
  return rows.filter(r => {
    if (orgMatchedOnly && !(r.modelId || r.siblingId || r.cyberId)) return false;
    if (comp && r.creator !== comp) return false;
    if (lic === 'open' && r.isOpenWeights !== true) return false;
    if (lic === 'closed' && r.isOpenWeights !== false) return false;
    if (starOnly && !((r.modelId || r.siblingId) && isStarred({id: r.modelId || r.siblingId, name: r.name, creator: {name: r.creator}}))) return false;
    if (q) {
      const hay = `${r.name} ${r.rawName} ${r.creator}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function jumpToOrgScatter(board) {
  if (!board?.scatterTarget) return;
  runNavAction(() => {
    const {tab, yLens} = board.scatterTarget;
    chooseChart(tab, {changeHash: false});
    if (state) {
      applyYLens(state, yLens || '');
      showView('chart');
    }
  });
}

function locateOrgModel(row, board) {
  const targetId = row?.modelId || row?.siblingId || null;
  if (!targetId && row?.cyberId) {
    runNavAction(() => {
      chooseChart('cyber', {changeHash: false});
      if (!state) return;
      const foundCyber = state.rows.find(r => r.id === row.cyberId);
      if (foundCyber) locateRowInChart(foundCyber);
      else showView('chart');
    });
    return;
  }
  if (!targetId) return;
  runNavAction(() => {
    const preferredTab = board?.scatterTarget?.tab || 'models';
    const preferredArr = snapshot?.[BENCHMARKS[preferredTab]?.key] || [];
    const hasInPreferred = preferredArr.some(m => m.id === targetId);
    const targetTab = hasInPreferred ? preferredTab : 'models';
    chooseChart(targetTab, {changeHash: false});
    if (!state) return;
    const targetLens = hasInPreferred ? (board?.scatterTarget?.yLens || '') : '';
    const testLens = (Y_LENSES[targetTab] || []).find(l => l.id === targetLens);
    const baseMatch = state.baseRows.find(r => r.id === targetId);
    const canUseLens = targetLens && testLens && baseMatch && testLens.get(baseMatch) != null;
    applyYLens(state, canUseLens ? targetLens : '');
    const found = state.rows.find(r => r.id === targetId);
    if (found) {
      locateRowInChart(found);
    } else {
      showView('chart');
    }
  });
}

function toggleOrgCompare(row, board, openCompare = false) {
  if (!row?.modelId) return;
  const preferredTab = !['coding-agents', 'media', 'orgs'].includes(activeKey)
    ? activeKey
    : (board?.scatterTarget?.tab || 'models');
  const preferredArr = snapshot?.[BENCHMARKS[preferredTab]?.key] || [];
  const targetTab = preferredArr.some(m => m.id === row.modelId) ? preferredTab : 'models';
  if (!states.has(targetTab)) states.set(targetTab, makeState(targetTab));
  const targetState = states.get(targetTab);
  const idx = targetState.compareIds.indexOf(row.modelId);
  if (openCompare) {
    runNavAction(() => {
      if (idx === -1) {
        if (targetState.compareIds.length >= MAX_COMPARE) targetState.compareIds.shift();
        targetState.compareIds.push(row.modelId);
      }
      lastModelCompareIds = [...targetState.compareIds];
      chooseChart(targetTab, {changeHash: false});
      showView('compare');
    });
    return;
  }
  if (idx !== -1) {
    if (targetState.compareIds.length > 1) targetState.compareIds.splice(idx, 1);
  } else {
    if (targetState.compareIds.length >= MAX_COMPARE) targetState.compareIds.shift();
    targetState.compareIds.push(row.modelId);
  }
  lastModelCompareIds = [...targetState.compareIds];
  if (targetTab === activeKey) syncUrlHash();
  renderOrgLeaderboards();
}

function isInCompareAnyModelTab(modelId) {
  if (!modelId) return false;
  if (state && !['coding-agents', 'media', 'orgs'].includes(activeKey) && state.compareIds.includes(modelId)) return true;
  const ms = states.get('models');
  return !!(ms && ms.compareIds.includes(modelId));
}

const orgRowByEl = new WeakMap();
let orgSpotRowMap = new Map();
let orgExactBoardMap = new Map();
let lastOrgBarSig = '';
let orgHoverRaf = 0;
let orgLeaveTimer = 0;
let pendingOrgHoverKey = null;
let pendingOrgHoverRow = null;
let orgDomIndex = {
  byKey: new Map(),
  bestByFamScope: new Map(),
  cardBadges: new Map(),
  litEls: new Set(),
  bumpSvg: null,
  bumpSeries: []
};

function orgRowSpotKey(row) {
  return row.modelId || (row.familySlug ? `fam:${row.familySlug}` : `raw:${normalizeOrgSpotKey(row.rawName || row.name)}`);
}

function resolveOrgSpotMeta(spotKey, hintRow = null) {
  if (!spotKey) return null;
  const rec = orgRankIndex.get(spotKey) || null;
  const fallbackRow = hintRow || orgSpotRowMap.get(spotKey) || null;
  const famSlug = rec?.familySlug || fallbackRow?.familySlug || (spotKey.startsWith('fam:') ? spotKey.slice(4) : null);
  const famRec = famSlug ? (orgFamilyIndex.get(famSlug) || null) : null;
  const displayName = rec?.shortName || rec?.name || fallbackRow?.rawName || fallbackRow?.name || '';
  const creatorName = rec?.creator || fallbackRow?.creator || 'Other';
  const cColor = orgCreatorColor(creatorName, rec?.creatorColor || fallbackRow?.creatorColor);
  const costVal = rec?.cost ?? fallbackRow?.cost ?? null;
  return {spotKey, rec, fallbackRow, famSlug, famRec, displayName, creatorName, cColor, costVal};
}

function resolveOrgBoardRank(boardId, meta) {
  if (!meta) return null;
  if (meta.rec?.ranks?.[boardId]) return meta.rec.ranks[boardId];
  const exactHit = orgExactBoardMap.get(`${meta.spotKey}|${boardId}`);
  if (exactHit) return exactHit;
  return meta.famRec?.[boardId] ? {...meta.famRec[boardId], exact: false} : null;
}

function rebuildOrgDomIndex(container) {
  const byKey = new Map();
  const bestByFamScope = new Map();
  const cardBadges = new Map();
  for (const card of container.querySelectorAll('.org-card[data-org-id]')) {
    const badge = card.querySelector('.org-card-match');
    if (badge) cardBadges.set(card.dataset.orgId, badge);
  }
  for (const el of container.querySelectorAll('[data-spot-key]')) {
    const sk = el.dataset.spotKey;
    const scopeId = el.dataset.orgScope || 'default';
    const scrollHost = el.closest('.org-card-list, .org-detail-scroll, .org-viz-scroll, .org-div-scroll') || null;
    const item = {el, scopeId, scrollHost};
    let list = byKey.get(sk);
    if (!list) {
      list = [];
      byKey.set(sk, list);
    }
    list.push(item);
    const fam = el.dataset.familySlug;
    if (fam && scopeId !== 'bump') {
      const fKey = `${fam}|${scopeId}`;
      if (!bestByFamScope.has(fKey)) bestByFamScope.set(fKey, item);
    }
  }
  const bumpSvg = container.querySelector('.org-bump-svg');
  const bumpSeries = bumpSvg ? [...bumpSvg.querySelectorAll('.bump-series')] : [];
  orgDomIndex = {byKey, bestByFamScope, cardBadges, litEls: new Set(), bumpSvg, bumpSeries};
  lastOrgBarSig = '';
}

function scrollOrgMatchIntoContainer(targetEl, scrollHost) {
  if (!targetEl || !scrollHost) return;
  const hostRect = scrollHost.getBoundingClientRect();
  const elRect = targetEl.getBoundingClientRect();
  if (hostRect.height <= 0) return;
  const relTop = elRect.top - hostRect.top;
  const relBottom = elRect.bottom - hostRect.top;
  if (relTop >= 18 && relBottom <= hostRect.height - 18) return;
  const nextTop = scrollHost.scrollTop + relTop - (hostRect.height - elRect.height) / 2;
  scrollHost.scrollTo({top: Math.max(0, nextTop), behavior: 'smooth'});
}

function renderOrgSpotlightBar(hovKey, hoverRow = null) {
  const bar = $('#orgSpotlightBar');
  if (!bar) return;
  const pinKey = orgPinnedKey;
  const isDual = !!(hovKey && pinKey && hovKey !== pinKey);
  const displayKey = hovKey || pinKey;
  const isShowingPin = !!(pinKey && displayKey === pinKey);
  const sig = `${displayKey || ''}|${pinKey || ''}|${isDual ? 1 : 0}|${lang}|${orgFocus}`;
  if (sig === lastOrgBarSig) return;
  lastOrgBarSig = sig;

  if (!displayKey) {
    bar.classList.remove('is-hovering', 'is-pinned');
    const hintTxt = t(
      '悬停预览跨榜排名（青绿） · 单击任意行锁定基准并自动对齐 6 榜视野（琥珀金，Esc 解锁）',
      'Hover any row to preview cross-org ranks (Teal) · Click to lock baseline & auto-align all 6 lists (Amber, Esc to unpin)'
    );
    const hint = html('span', hintTxt, 'org-spot-hint');
    hint.title = hintTxt;
    bar.replaceChildren(hint);
    return;
  }

  bar.classList.toggle('is-pinned', isShowingPin);
  bar.classList.toggle('is-hovering', !isShowingPin);

  const meta = resolveOrgSpotMeta(displayKey, displayKey === hovKey ? hoverRow : null);
  if (!meta) return;

  const left = html('div', null, 'org-spot-identity');
  const stateBadge = html(
    'span',
    isShowingPin
      ? t('已锁定', 'Pinned')
      : isDual
        ? t('对比预览', 'Preview')
        : t('悬停预览', 'Preview'),
    `org-state-badge ${isShowingPin ? 'is-pin' : 'is-hover'}`
  );
  const dot = html('i', null, 'creator-dot');
  dot.style.background = meta.cColor;
  dot.setAttribute('aria-hidden', 'true');
  left.append(stateBadge, dot, html('strong', meta.displayName), html('span', meta.creatorName, 'org-spot-creator'));
  if (meta.costVal != null && meta.costVal > 0) {
    left.append(html('span', money(meta.costVal), 'org-spot-cost'));
  }

  const pills = html('div', null, 'org-spot-ranks');
  pills.addEventListener('wheel', event => {
    if (pills.scrollWidth > pills.clientWidth + 2 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      pills.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }, {passive: false});
  let pillCount = 0;
  for (const board of orgBoards) {
    const info = resolveOrgBoardRank(board.id, meta);
    if (!info) continue;
    pillCount++;
    const scoreTxt = format(info.score, board.scoreDecimals);
    const pill = html('button', `${t(board.pillZh, board.pillEn)} ${info.exact ? '' : '~'}#${info.rank} (${scoreTxt})`, 'org-spot-pill');
    pill.type = 'button';
    if (!info.exact) {
      pill.classList.add('is-family');
      pill.title = t('同系列相邻推理档位在该机构的最佳排名（点击展开该机构全榜）', 'Best rank by sibling effort variant in this org (click to open full org table)');
    } else {
      pill.title = t(`点击展开 ${board.orgZh} · ${board.titleZh} 完整分项表`, `Open full ${board.orgEn} · ${board.titleEn} table`);
    }
    pill.addEventListener('click', () => {
      runNavAction(() => {
        orgFocus = board.id;
        orgPinnedKey = displayKey;
        orgSpotlightKey = null;
        syncUrlHash();
        renderOrgLeaderboards();
        updateSummary();
      });
    });
    pills.append(pill);
  }
  if (!pillCount) {
    pills.append(html('span', t('仅在该机构上榜', 'Ranked in this org only'), 'org-spot-hint'));
  }

  const actions = html('div', null, 'org-spot-actions');
  if (isDual) {
    const pinMeta = resolveOrgSpotMeta(pinKey);
    const pinShort = pinMeta?.displayName || '';
    const anchorBtn = html('button', `${t('锁定中', 'Pinned')}: ${pinShort} ×`, 'org-pin-anchor-btn');
    anchorBtn.type = 'button';
    anchorBtn.title = t('点击取消琥珀金锁定基准 (Esc)', 'Click to clear pinned Amber baseline (Esc)');
    anchorBtn.addEventListener('click', () => {
      orgPinnedKey = null;
      lastOrgBarSig = '';
      applyOrgSpotlight(orgSpotlightKey);
    });
    actions.append(anchorBtn);
  } else {
    if (meta.rec) {
      const locBtn = html('button', t('定位散点', 'Locate'), 'org-mini-btn');
      locBtn.type = 'button';
      locBtn.addEventListener('click', () => locateOrgModel({modelId: displayKey}, orgBoards.find(b => b.id === orgFocus) || orgBoards[0]));
      const cmpBtn = html('button', t('去剖析 →', 'Compare →'), 'org-mini-btn');
      cmpBtn.type = 'button';
      cmpBtn.addEventListener('click', () => toggleOrgCompare({modelId: displayKey}, orgBoards.find(b => b.id === orgFocus) || orgBoards[0], true));
      actions.append(locBtn, cmpBtn);
    } else if (meta.fallbackRow?.siblingId || meta.fallbackRow?.cyberId) {
      const locBtn = html('button', t('~定位同系', '~Locate sib'), 'org-mini-btn');
      locBtn.type = 'button';
      locBtn.title = t(`定位同系列 ${meta.fallbackRow.siblingName || meta.fallbackRow.cyberName}`, `Locate sibling ${meta.fallbackRow.siblingName || meta.fallbackRow.cyberName}`);
      locBtn.addEventListener('click', () => locateOrgModel(meta.fallbackRow, orgBoards.find(b => b.id === orgFocus) || orgBoards[0]));
      actions.append(locBtn);
    }
    if (pinKey) {
      const clearBtn = html('button', t('解锁 ×', 'Unpin ×'), 'org-mini-btn is-clear');
      clearBtn.type = 'button';
      clearBtn.title = t('取消锁定 (Esc)', 'Clear pin (Esc)');
      clearBtn.addEventListener('click', () => {
        orgPinnedKey = null;
        orgSpotlightKey = null;
        lastOrgBarSig = '';
        applyOrgSpotlight(null);
      });
      actions.append(clearBtn);
    }
  }

  bar.replaceChildren(left, pills, actions);
}

function collectSpotMatches(targetKey, hintRow, clsName) {
  if (!targetKey) return [];
  const matched = [];
  const coveredScopes = new Set();
  const exactHits = orgDomIndex.byKey.get(targetKey) || [];
  for (const hit of exactHits) {
    hit.el.classList.add(clsName);
    orgDomIndex.litEls.add(hit.el);
    coveredScopes.add(hit.scopeId);
    matched.push(hit);
  }
  const meta = resolveOrgSpotMeta(targetKey, hintRow);
  if (meta?.famSlug) {
    for (const sc of ['aa', 'livebench', 'arenaChat', 'arenaWebdev', 'designArena', 'aaGdpval', 'viz', 'table', 'div']) {
      if (coveredScopes.has(sc)) continue;
      const sibHit = orgDomIndex.bestByFamScope.get(`${meta.famSlug}|${sc}`);
      if (sibHit) {
        sibHit.el.classList.add(clsName, 'is-family-spotlit');
        orgDomIndex.litEls.add(sibHit.el);
        coveredScopes.add(sc);
        matched.push(sibHit);
      }
    }
  }
  return matched;
}

function applyOrgSpotlight(hoverKey, hoverRow = null, {scrollPinned = false, sourceScope = null} = {}) {
  for (const el of orgDomIndex.litEls) {
    el.classList.remove('is-hover-spot', 'is-pinned-spot', 'is-family-spotlit');
  }
  orgDomIndex.litEls.clear();

  const pinKey = orgPinnedKey;
  const hovKey = hoverKey && hoverKey !== pinKey ? hoverKey : null;
  const hasAnySpot = !!(pinKey || hovKey);

  const pinHits = pinKey ? collectSpotMatches(pinKey, null, 'is-pinned-spot') : [];
  if (hovKey) collectSpotMatches(hovKey, hoverRow, 'is-hover-spot');

  if (scrollPinned && pinHits.length) {
    const scrolledScopes = new Set();
    for (const hit of pinHits) {
      if (sourceScope && hit.scopeId === sourceScope) continue;
      if (scrolledScopes.has(hit.scopeId)) continue;
      scrolledScopes.add(hit.scopeId);
      scrollOrgMatchIntoContainer(hit.el, hit.scrollHost);
    }
  }

  // Update per-card header live rank badges in 6-org side-by-side view
  if (orgDomIndex.cardBadges.size) {
    const focusKey = hovKey || pinKey;
    const isPinBadge = !hovKey && !!pinKey;
    const focusMeta = focusKey ? resolveOrgSpotMeta(focusKey, focusKey === hovKey ? hoverRow : null) : null;
    for (const [boardId, badge] of orgDomIndex.cardBadges) {
      if (!focusMeta) {
        badge.hidden = true;
        delete badge.dataset.targetKey;
        continue;
      }
      const info = resolveOrgBoardRank(boardId, focusMeta);
      badge.hidden = false;
      if (info) {
        badge.textContent = info.exact ? `#${info.rank}` : `${t('同系', 'Sib')} ~#${info.rank}`;
        badge.className = `org-card-match ${isPinBadge ? 'is-pin' : 'is-hover'}${info.exact ? '' : ' is-approx'}`;
        badge.dataset.targetKey = focusKey;
        badge.title = t('点击将本卡滚动至该模型所在行', 'Click to scroll this card to the matching row');
      } else {
        badge.textContent = t('未上榜', 'Unranked');
        badge.className = 'org-card-match is-none';
        badge.title = '';
        delete badge.dataset.targetKey;
      }
    }
  }

  const bumpSvg = orgDomIndex.bumpSvg;
  if (bumpSvg) {
    bumpSvg.classList.toggle('has-focus', hasAnySpot);
    for (const g of orgDomIndex.bumpSeries) {
      const lit = g.classList.contains('is-pinned-spot') || g.classList.contains('is-hover-spot');
      g.classList.toggle('is-dimmed', hasAnySpot && !lit);
      for (const c of g.querySelectorAll('.bump-callout')) c.removeAttribute('transform');
    }
    if (hasAnySpot) {
      const seriesLayer = bumpSvg.querySelector('.bump-series-layer');
      if (seriesLayer) {
        const pinG = pinKey ? orgDomIndex.byKey.get(pinKey)?.[0]?.el : null;
        const hovG = hovKey ? orgDomIndex.byKey.get(hovKey)?.[0]?.el : null;
        if (pinG && !hovG && pinG !== seriesLayer.lastElementChild) seriesLayer.append(pinG);
        if (hovG) {
          if (pinG && pinG.nextElementSibling !== hovG && pinG !== seriesLayer.lastElementChild) seriesLayer.append(pinG);
          if (hovG !== seriesLayer.lastElementChild) seriesLayer.append(hovG);
          if (pinG) {
            const pinBoxes = new Map();
            for (const pc of pinG.querySelectorAll('.bump-callout')) {
              pinBoxes.set(pc.dataset.colIdx, Number(pc.dataset.py));
            }
            for (const hc of hovG.querySelectorAll('.bump-callout')) {
              const pY = pinBoxes.get(hc.dataset.colIdx);
              const hY = Number(hc.dataset.py);
              if (pY != null && Math.abs(pY - hY) < 26) {
                const shift = hY >= pY ? 26 : -26;
                hc.setAttribute('transform', `translate(0, ${shift})`);
              }
            }
          }
        }
      }
    }
  }
  renderOrgSpotlightBar(hoverKey, hoverRow);
}

function scheduleOrgSpotlight(nextKey, nextRow = null) {
  pendingOrgHoverKey = nextKey;
  pendingOrgHoverRow = nextRow;
  if (orgHoverRaf) return;
  orgHoverRaf = requestAnimationFrame(() => {
    orgHoverRaf = 0;
    orgSpotlightKey = pendingOrgHoverKey;
    applyOrgSpotlight(pendingOrgHoverKey, pendingOrgHoverRow);
  });
}

function orgDisplayName(row) {
  if (!row.modelId || row.dupId) return row.rawName || row.name;
  return row.shortName || row.name || row.rawName;
}

function renderOrgSideBySide(container) {
  const grid = html('div', null, 'org-grid');
  for (const board of orgBoards) {
    const rows = filterOrgRows(board.rows);
    const allScores = board.rows.map(r => r.score).filter(v => typeof v === 'number' && Number.isFinite(v));
    const maxS = allScores.length ? Math.max(...allScores) : 100;
    const minS = allScores.length ? Math.min(...allScores) : 0;
    const floorS = minS - (maxS - minS) * 0.14;
    const spanS = Math.max(1e-6, maxS - floorS);

    const card = html('section', null, 'org-card');
    card.dataset.orgId = board.id;

    const head = html('header', null, 'org-card-head');
    const titleWrap = html('div', null, 'org-card-titles');
    const topLine = html('div', null, 'org-card-topline');
    const ext = html('a', `${t(board.orgZh, board.orgEn)} ↗`, 'org-ext-link');
    ext.href = board.sourceUrl;
    ext.target = '_blank';
    ext.rel = 'noopener';
    ext.title = t('打开该机构官方原榜', 'Open official organization leaderboard');
    const badge = html('span', t(board.tagZh, board.tagEn), 'org-tag-pill');
    const matchBadge = html('span', '', 'org-card-match');
    matchBadge.hidden = true;
    matchBadge.addEventListener('click', e => {
      e.stopPropagation();
      const tk = matchBadge.dataset.targetKey;
      if (!tk) return;
      const direct = (orgDomIndex.byKey.get(tk) || []).find(h => h.scopeId === board.id);
      const meta = resolveOrgSpotMeta(tk);
      const hit = direct || (meta?.famSlug ? orgDomIndex.bestByFamScope.get(`${meta.famSlug}|${board.id}`) : null);
      if (hit) scrollOrgMatchIntoContainer(hit.el, hit.scrollHost);
    });
    topLine.append(ext, badge, matchBadge);

    const subLine = html('div', null, 'org-card-subline');
    subLine.append(
      html('strong', t(board.titleZh, board.titleEn)),
      html('span', `${rows.length}/${board.rows.length}${board.date ? ' · ' + board.date : ''}`, 'org-meta-count')
    );
    titleWrap.append(topLine, subLine);

    const headBtns = html('div', null, 'org-card-actions');
    const expandBtn = html('button', t('精析', 'Inspect'), 'org-mini-btn');
    expandBtn.type = 'button';
    expandBtn.title = t('展开该机构可视化榜图与完整分项表', 'Open single-org chart & full sub-metric table');
    expandBtn.addEventListener('click', () => {
      runNavAction(() => {
        orgFocus = board.id;
        orgDetailSort = {boardId: board.id, colKey: null, dir: 'desc'};
        syncUrlHash();
        renderOrgLeaderboards();
        updateSummary();
      });
    });
    const scatterBtn = html('button', t('散点 ↗', 'Scatter ↗'), 'org-mini-btn');
    scatterBtn.type = 'button';
    scatterBtn.title = t('以该机构成绩作为纵轴打开成本散点图', 'Open cost scatter chart with this org on the Y-axis');
    scatterBtn.addEventListener('click', () => jumpToOrgScatter(board));
    headBtns.append(expandBtn, scatterBtn);
    head.append(titleWrap, headBtns);

    const list = html('ol', null, 'org-card-list');
    const isMobCard = mobileLayout.matches;
    const isExpanded = orgExpandedCards.has(board.id);
    const shownRows = isMobCard && !isExpanded && rows.length > 12 ? rows.slice(0, 12) : rows;
    if (!rows.length) {
      const empty = html('li', null, 'org-empty');
      empty.append(makeEmptyResetNotice('当前筛选条件下无匹配模型', 'No matching models under current filters', {clearOrgMatch: true}));
      list.append(empty);
    } else {
      const frag = document.createDocumentFragment();
      for (const row of shownRows) {
        const li = html('li', null, 'org-row');
        const spotKey = orgRowSpotKey(row);
        li.dataset.spotKey = spotKey;
        li.dataset.orgScope = board.id;
        if (row.familySlug) li.dataset.familySlug = row.familySlug;
        orgRowByEl.set(li, row);
        if (!row.modelId) li.classList.add('is-unmatched');
        const pct = Math.max(8, Math.min(100, ((row.score - floorS) / spanS) * 100));
        li.style.setProperty('--bar-pct', `${pct.toFixed(1)}%`);

        const rankSpan = html('span', `#${row.rank}`, `org-rank${row.rank <= 3 ? ' rank-' + row.rank : ''}`);
        const dot = html('i', null, 'creator-dot');
        dot.style.background = orgCreatorColor(row.creator, row.creatorColor);
        dot.setAttribute('aria-hidden', 'true');

        const main = html('div', null, 'org-row-main');
        const primaryTxt = orgDisplayName(row);
        const nameEl = html('span', primaryTxt, 'org-row-name');
        nameEl.title = row.rawName && row.rawName !== primaryTxt ? `${primaryTxt} (${row.rawName})` : primaryTxt;

        const subParts = [row.creator];
        if (row.dupId && row.name && row.name !== row.rawName) subParts.push(row.shortName || row.name);
        if (board.id === 'livebench' && row.lbCost != null) subParts.push(`LB ${money(row.lbCost)}`);
        else if (row.cost != null && row.cost > 0) subParts.push(money(row.cost));
        if (board.id === 'designArena' && row.winRate != null) subParts.push(`${format(row.winRate, 1)}%`);
        else if ((board.id === 'arenaChat' || board.id === 'arenaWebdev') && row.votes) {
          subParts.push(`${row.votes >= 1000 ? format(row.votes / 1000, 1) + 'k' : row.votes}${t('票', 'v')}`);
        }
        if (!row.modelId) {
          if (row.siblingId || row.cyberId) {
            subParts.push(t(`~同系 ${row.siblingName || row.cyberName}`, `~Sib ${row.siblingName || row.cyberName}`));
          } else {
            subParts.push(t('机构独有', 'Org-only'));
          }
        }
        main.append(nameEl, html('span', subParts.join(' · '), 'org-row-sub'));

        const scoreEl = html('span', format(row.score, board.scoreDecimals), 'org-row-score');
        scoreEl.title = `${t(board.scoreLabelZh, board.scoreLabelEn)}: ${format(row.score, board.scoreDecimals)}`;

        const rowActs = html('div', null, 'org-row-acts');
        if (row.modelId) {
          const loc = html('button', t('定位', 'Pin'), 'org-micro-btn');
          loc.type = 'button';
          loc.title = t('在散点图中定位该模型', 'Locate in scatter chart');
          loc.setAttribute('aria-label', t(`在散点图中定位 ${primaryTxt}`, `Locate ${primaryTxt} in scatter chart`));
          loc.addEventListener('click', e => {
            e.stopPropagation();
            locateOrgModel(row, board);
          });
          const inCmp = isInCompareAnyModelTab(row.modelId);
          const cmp = html('button', inCmp ? t('已选', 'In') : t('+对比', '+Cmp'), `org-micro-btn${inCmp ? ' is-in' : ''}`);
          cmp.type = 'button';
          cmp.title = inCmp ? t('已在剖析对比组中（点击移除）', 'In comparison (click to remove)') : t('加入剖析对比组', 'Add to comparison');
          cmp.setAttribute('aria-label', inCmp ? t(`从对比组移除 ${primaryTxt}`, `Remove ${primaryTxt} from comparison`) : t(`将 ${primaryTxt} 加入剖析对比`, `Add ${primaryTxt} to comparison`));
          cmp.addEventListener('click', e => {
            e.stopPropagation();
            toggleOrgCompare(row, board, false);
          });
          rowActs.append(loc, cmp);
        } else if (row.siblingId || row.cyberId) {
          const loc = html('button', t('~定位', '~Pin'), 'org-micro-btn is-approx');
          loc.type = 'button';
          loc.title = t(
            `该推理档位未单独收录，点击定位同系列 ${row.siblingName || row.cyberName}`,
            `Locate sibling variant ${row.siblingName || row.cyberName} in scatter chart`
          );
          loc.setAttribute('aria-label', t(`定位同系列 ${row.siblingName || row.cyberName}`, `Locate sibling ${row.siblingName || row.cyberName}`));
          loc.addEventListener('click', e => {
            e.stopPropagation();
            locateOrgModel(row, board);
          });
          rowActs.append(loc);
        }

        li.append(rankSpan, dot, main, scoreEl, rowActs);
        frag.append(li);
      }
      list.append(frag);
    }

    const briefBar = html('div', t(board.briefZh, board.briefEn), 'org-card-brief');
    briefBar.title = `${t('特点：', 'Strength: ')}${t(board.strengthZh, board.strengthEn)} · ${t('注意：', 'Caveat: ')}${t(board.caveatZh, board.caveatEn)}`;
    card.append(head, briefBar, list);
    if (isMobCard && rows.length > 12) {
      const moreBtn = html(
        'button',
        isExpanded ? t('收起至前 12 名', 'Show top 12') : t(`展开全部 ${rows.length} 款模型 ↓`, `Show all ${rows.length} models ↓`),
        'org-card-more-btn'
      );
      moreBtn.type = 'button';
      moreBtn.addEventListener('click', () => {
        if (orgExpandedCards.has(board.id)) orgExpandedCards.delete(board.id);
        else orgExpandedCards.add(board.id);
        renderOrgLeaderboards();
      });
      card.append(moreBtn);
    }
    grid.append(card);
  }
  container.replaceChildren(grid);
}

function renderOrgBumpChart(container) {
  const wrap = html('div', null, 'org-bump-wrap');
  const head = html('div', null, 'org-bump-head');
  const hCopy = html('div', null, 'org-bump-copy');
  hCopy.append(
    html('strong', t('跨机构独立排名轨迹图（Bump Chart）', 'Cross-Organization Official Rank Trajectory')),
    html('span', t(
      '纵轴越靠上排名越靠前 · 实心圆 = 精确对齐，虚线环 = 同系列相邻档位 · 点击机构标题可进入精析',
      'Higher = better rank · Solid dot = exact model, dashed ring = sibling variant · Click any org header to inspect'
    ), 'org-meta-count')
  );
  const ctrl = html('div', null, 'org-bump-controls');
  const limitSwitch = html('div', null, 'axis-controls');
  for (const n of [12, 18]) {
    const b = html('button', `Top ${n}`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(orgBumpLimit === n));
    b.addEventListener('click', () => {
      if (orgBumpLimit === n) return;
      orgBumpLimit = n;
      syncUrlHash();
      renderOrgLeaderboards();
    });
    limitSwitch.append(b);
  }
  const pngBtn = html('button', t('导图 PNG', 'Export PNG'), 'org-mini-btn');
  pngBtn.type = 'button';
  pngBtn.addEventListener('click', () => exportChartPng('orgs'));
  ctrl.append(limitSwitch, pngBtn);
  head.append(hCopy, ctrl);

  // Collect multi-org candidate models (respecting active search / vendor / license / star filters)
  const q = (state?.search || '').trim().toLowerCase();
  const comp = state?.company || null;
  const lic = state?.license || 'all';
  const starOnly = !!state?.starredOnly;
  const baseById = new Map((snapshot?.models || []).map(m => [m.id, m]));

  // Deduplicate by familySlug keeping the strongest flagship model per family so trajectories stay legible
  const familyPicked = new Map();
  for (const [modelId, rec] of orgRankIndex.entries()) {
    const base = baseById.get(modelId);
    if (comp && rec.creator !== comp) continue;
    if (lic === 'open' && !base?.isOpenWeights) continue;
    if (lic === 'closed' && base?.isOpenWeights) continue;
    if (starOnly && !isStarred({id: modelId, name: rec.name, creator: {name: rec.creator}})) continue;
    if (q && !`${rec.name} ${rec.shortName} ${rec.creator}`.toLowerCase().includes(q)) continue;

    const covered = orgBoards.filter(b => rec.ranks[b.id]);
    if (covered.length < 3) continue;
    const avgRank = covered.reduce((s, b) => s + rec.ranks[b.id].rank, 0) / covered.length;
    const bestRank = Math.min(...covered.map(b => rec.ranks[b.id].rank));
    const sortScore = avgRank - covered.length * 0.45;
    const cand = {modelId, rec, base, coveredCount: covered.length, avgRank, bestRank, sortScore};
    const fKey = rec.familySlug || modelId;
    const prev = familyPicked.get(fKey);
    if (!prev || cand.sortScore < prev.sortScore) {
      familyPicked.set(fKey, cand);
    }
  }

  let series = [...familyPicked.values()]
    .sort((a, b) => a.sortScore - b.sortScore)
    .slice(0, orgBumpLimit);

  // Ensure pinned model stays visible if it exists in orgRankIndex
  if (orgPinnedKey && orgRankIndex.has(orgPinnedKey) && !series.some(s => s.modelId === orgPinnedKey)) {
    const rec = orgRankIndex.get(orgPinnedKey);
    const covered = orgBoards.filter(b => rec.ranks[b.id]);
    if (covered.length >= 2) {
      series.push({
        modelId: orgPinnedKey,
        rec,
        base: baseById.get(orgPinnedKey),
        coveredCount: covered.length,
        avgRank: covered.reduce((s, b) => s + rec.ranks[b.id].rank, 0) / covered.length,
        bestRank: Math.min(...covered.map(b => rec.ranks[b.id].rank)),
        sortScore: 99
      });
    }
  }

  if (!series.length) {
    const emptyBox = html('div', null, 'org-empty');
    const notice = makeEmptyResetNotice(
      '当前筛选条件下暂无跨 3 家以上机构上榜的模型。',
      'No models ranked across 3+ orgs under current filters.',
      {clearOrgMatch: true}
    );
    const sideBtn = html('button', t('切回 6 机构并排', 'Switch to Side-by-Side'), 'empty-reset-btn');
    sideBtn.type = 'button';
    sideBtn.addEventListener('click', () => {
      runNavAction(() => {
        orgFocus = 'all';
        syncUrlHash();
        renderOrgLeaderboards();
        updateSummary();
      });
    });
    notice.append(sideBtn);
    emptyBox.append(notice);
    wrap.append(head, emptyBox);
    container.replaceChildren(wrap);
    return;
  }

  // Compute rank Y-scale (rank 1 at top -> maxRank at bottom, soft-capped visually at 32 so outliers don't crush top 10!)
  const maxObserved = Math.max(10, ...series.flatMap(s => orgBoards.map(b => s.rec.ranks[b.id]?.rank || 0)));
  const rankCap = Math.min(35, Math.max(15, maxObserved));
  const mapRankVal = r => (r <= rankCap ? r : rankCap + Math.min(3.5, Math.log2(r - rankCap + 1) * 1.4));
  const maxMapped = Math.max(rankCap, ...series.flatMap(s => orgBoards.map(b => s.rec.ranks[b.id] ? mapRankVal(s.rec.ranks[b.id].rank) : 0)));

  const availW = container.clientWidth || 1200;
  const svgW = Math.max(920, Math.min(1360, Math.round(availW - 22)));
  const svgH = Math.max(486, Math.min(586, 356 + series.length * 15));
  const padL = 204, padR = 204, padT = 62, padB = 34;
  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;
  const colX = i => padL + (orgBoards.length > 1 ? (i * innerW) / (orgBoards.length - 1) : innerW / 2);
  // Gently expand top-12 vertical spacing (power 0.86) so #1–#5 circles breathe without overlap
  const rankY = r => padT + Math.pow((mapRankVal(r) - 1) / Math.max(1, maxMapped - 1), 0.86) * innerH;

  const chartHost = html('div', null, 'org-bump-scroll');
  const svgEl = node('svg', {class: 'org-bump-svg', viewBox: `0 0 ${svgW} ${svgH}`, style: `max-width:${svgW}px`, role: 'img', 'aria-label': t('跨机构官方排名轨迹图', 'Cross-organization rank bump chart')});

  // Subtle horizontal rank guide lines (#1, #5, #10, #20, #30)
  const gridG = node('g', {class: 'bump-grid'});
  for (const rTick of [1, 5, 10, 15, 20, 30]) {
    if (rTick > maxMapped + 0.5) continue;
    const py = rankY(rTick);
    gridG.append(
      node('line', {x1: padL - 10, x2: svgW - padR + 10, y1: py, y2: py, class: rTick === 10 ? 'bump-guide-major' : 'bump-guide'}),
      node('text', {x: padL - 16, y: py + 3.5, 'text-anchor': 'end', class: 'bump-rank-tick'}, `#${rTick}`)
    );
  }

  // Vertical org columns + clickable org headers
  const colG = node('g', {class: 'bump-cols'});
  orgBoards.forEach((b, idx) => {
    const cx = colX(idx);
    colG.append(node('line', {x1: cx, x2: cx, y1: padT - 12, y2: svgH - padB + 6, class: 'bump-col-line'}));
    const hdr = node('g', {class: 'bump-col-hdr', tabindex: 0, role: 'button'});
    hdr.append(
      node('title', {}, t(`点击进入 ${b.orgZh} · ${b.titleZh} 独立精析`, `Open ${b.orgEn} · ${b.titleEn} deep dive`)),
      node('text', {x: cx, y: 20, 'text-anchor': 'middle', class: 'bump-col-title'}, t(b.pillZh, b.pillEn)),
      node('text', {x: cx, y: 35, 'text-anchor': 'middle', class: 'bump-col-sub'}, t(b.tagZh, b.tagEn))
    );
    hdr.addEventListener('click', () => {
      runNavAction(() => {
        orgFocus = b.id;
        orgDetailSort = {boardId: b.id, colKey: null, dir: 'desc'};
        syncUrlHash();
        renderOrgLeaderboards();
        updateSummary();
      });
    });
    colG.append(hdr);
  });

  // Collision-avoidance resolver for left & right end labels
  const resolveLabelYs = (items, minGap = 21) => {
    const sorted = [...items].sort((a, b) => a.rawY - b.rawY);
    const minY = padT - 6;
    const maxY = svgH - padB + 4;
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].y = Math.max(minY, sorted[i].rawY);
      if (i > 0 && sorted[i].y - sorted[i - 1].y < minGap) {
        sorted[i].y = sorted[i - 1].y + minGap;
      }
    }
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (i === sorted.length - 1 && sorted[i].y > maxY) sorted[i].y = maxY;
      if (i < sorted.length - 1 && sorted[i + 1].y - sorted[i].y < minGap) {
        sorted[i].y = sorted[i + 1].y - minGap;
      }
    }
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 && sorted[i].y < minY) sorted[i].y = minY;
      if (i > 0 && sorted[i].y - sorted[i - 1].y < minGap) {
        sorted[i].y = sorted[i - 1].y + minGap;
      }
    }
    return new Map(sorted.map(x => [x.id, x.y]));
  };

  const leftCandidates = [];
  const rightCandidates = [];
  for (const s of series) {
    const firstIdx = orgBoards.findIndex(b => s.rec.ranks[b.id]);
    const lastIdx = orgBoards.length - 1 - [...orgBoards].reverse().findIndex(b => s.rec.ranks[b.id]);
    if (firstIdx === 0) leftCandidates.push({id: s.modelId, rawY: rankY(s.rec.ranks[orgBoards[0].id].rank)});
    if (lastIdx === orgBoards.length - 1) rightCandidates.push({id: s.modelId, rawY: rankY(s.rec.ranks[orgBoards[lastIdx].id].rank)});
  }
  const leftLabelY = resolveLabelYs(leftCandidates);
  const rightLabelY = resolveLabelYs(rightCandidates);

  const seriesLayer = node('g', {class: 'bump-series-layer'});
  for (const s of series) {
    const g = node('g', {class: 'bump-series', 'data-spot-key': s.modelId});
    if (s.rec.familySlug) g.dataset.familySlug = s.rec.familySlug;
    const strokeCol = orgCreatorColor(s.rec.creator, s.rec.creatorColor);

    const pts = [];
    orgBoards.forEach((b, idx) => {
      const rInfo = s.rec.ranks[b.id];
      if (!rInfo) return;
      pts.push({idx, board: b, x: colX(idx), y: rankY(rInfo.rank), rank: rInfo.rank, score: rInfo.score, exact: rInfo.exact});
    });

    // Draw smooth cubic Bézier segments (dashed if bridging a missing org column)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = (b.x - a.x) * 0.45;
      const dPath = `M${a.x.toFixed(1)},${a.y.toFixed(1)} C${(a.x + dx).toFixed(1)},${a.y.toFixed(1)} ${(b.x - dx).toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      const isGap = b.idx - a.idx > 1;
      g.append(node('path', {d: dPath, class: 'bump-hit'}));
      g.append(node('path', {
        d: dPath,
        class: isGap ? 'bump-line is-gap' : 'bump-line',
        stroke: strokeCol
      }));
    }

    // Nodes + rank badges + hover score callouts
    for (const pt of pts) {
      g.append(node('circle', {
        cx: pt.x.toFixed(1),
        cy: pt.y.toFixed(1),
        r: pt.exact ? 9.5 : 8.5,
        class: pt.exact ? 'bump-dot' : 'bump-dot is-family',
        fill: pt.exact ? strokeCol : 'var(--chart)',
        stroke: strokeCol
      }));
      g.append(node('text', {
        x: pt.x.toFixed(1),
        y: (pt.y + 3.2).toFixed(1),
        'text-anchor': 'middle',
        class: pt.exact ? 'bump-dot-num' : 'bump-dot-num is-family',
        fill: pt.exact ? '' : strokeCol
      }, String(pt.rank)));

      // Score pill visible on focus/spotlight
      const scoreLabel = `${pt.exact ? '' : '~'}#${pt.rank} · ${format(pt.score, pt.board.scoreDecimals)}`;
      const pillG = node('g', {class: 'bump-callout', 'data-col-idx': pt.idx, 'data-py': (pt.y < padT + 22 ? pt.y + 13 : pt.y - 29).toFixed(1)});
      const pillW = Math.max(66, scoreLabel.length * 6.5 + 12);
      const pillY = pt.y < padT + 22 ? pt.y + 13 : pt.y - 29;
      pillG.append(
        node('rect', {x: (pt.x - pillW / 2).toFixed(1), y: pillY.toFixed(1), width: pillW, height: 17, rx: 4.5, stroke: strokeCol}),
        node('text', {x: pt.x.toFixed(1), y: (pillY + 11.8).toFixed(1), 'text-anchor': 'middle'}, scoreLabel)
      );
      g.append(pillG);
    }

    const shortLbl = (s.rec.shortName || s.rec.name).replace(/\s*\(Default Fallback\)/i, '');
    const trimLbl = shortLbl.length > 22 ? shortLbl.slice(0, 21) + '…' : shortLbl;
    if (leftLabelY.has(s.modelId)) {
      const ly = leftLabelY.get(s.modelId);
      const firstPt = pts[0];
      if (Math.abs(ly - firstPt.y) > 4) {
        g.append(node('line', {x1: padL - 44, y1: ly, x2: firstPt.x - 10, y2: firstPt.y, stroke: strokeCol, class: 'bump-lbl-leader'}));
      }
      g.append(node('text', {x: padL - 48, y: ly + 3.5, 'text-anchor': 'end', class: 'bump-end-lbl', fill: strokeCol}, trimLbl));
    }
    if (rightLabelY.has(s.modelId)) {
      const ry = rightLabelY.get(s.modelId);
      const lastPt = pts[pts.length - 1];
      if (Math.abs(ry - lastPt.y) > 4) {
        g.append(node('line', {x1: lastPt.x + 10, y1: lastPt.y, x2: svgW - padR + 28, y2: ry, stroke: strokeCol, class: 'bump-lbl-leader'}));
      }
      g.append(node('text', {x: svgW - padR + 32, y: ry + 3.5, 'text-anchor': 'start', class: 'bump-end-lbl', fill: strokeCol}, trimLbl));
    }

    const dummyRow = {modelId: s.modelId, familySlug: s.rec.familySlug, name: s.rec.name, creator: s.rec.creator, creatorColor: s.rec.creatorColor, cost: s.rec.cost};
    g.dataset.orgScope = 'bump';
    orgRowByEl.set(g, dummyRow);

    seriesLayer.append(g);
  }

  svgEl.append(gridG, colG, seriesLayer);
  chartHost.append(svgEl);
  wrap.append(head, chartHost);
  container.replaceChildren(wrap);
}

function buildOrgTopBarChart(board, rows) {
  const top = rows.slice(0, 15);
  const panel = html('div', null, 'org-bar-viz');
  const head = html('div', null, 'org-viz-head');
  head.append(
    html('span', t(
      `Top ${top.length} 分差与成本对照（${board.scoreLabelZh}）`,
      `Top ${top.length} Score Spread & API Cost (${board.scoreLabelEn})`
    ), 'org-viz-title')
  );
  const toggleBtn = html('button', orgChartCollapsed ? t('展开榜图', 'Show chart') : t('收起榜图', 'Hide chart'), 'org-mini-btn');
  toggleBtn.type = 'button';
  toggleBtn.addEventListener('click', () => {
    orgChartCollapsed = !orgChartCollapsed;
    renderOrgLeaderboards();
  });
  head.append(toggleBtn);
  panel.append(head);
  if (orgChartCollapsed || !top.length) return panel;

  const scores = top.map(r => r.score).filter(v => typeof v === 'number' && Number.isFinite(v));
  const maxS = Math.max(...scores);
  const minS = Math.min(...scores);
  const span = Math.max(0.5, maxS - minS);
  const floor = Math.max(0, minS - span * 0.28);
  const scaleSpan = Math.max(0.5, maxS - floor);

  const scroller = html('div', null, 'org-viz-scroll');
  const list = html('ol', null, 'org-bar-list');
  const frag = document.createDocumentFragment();

  top.forEach((row, i) => {
    const spotKey = orgRowSpotKey(row);
    const fillCol = orgCreatorColor(row.creator, row.creatorColor);
    const pct = Math.max(6, Math.min(100, ((row.score - floor) / scaleSpan) * 100));

    const li = html('li', null, 'org-bar-item');
    li.dataset.spotKey = spotKey;
    li.dataset.orgScope = 'viz';
    if (row.familySlug) li.dataset.familySlug = row.familySlug;
    orgRowByEl.set(li, row);
    li.style.setProperty('--bar-color', fillCol);

    const rankEl = html('span', `#${row.rank}`, `org-bar-rank${row.rank <= 3 ? ' is-top' : ''}`);
    const dot = html('i', null, 'creator-dot');
    dot.style.background = fillCol;
    dot.setAttribute('aria-hidden', 'true');

    const disp = orgDisplayName(row);
    const nameEl = html('span', disp, 'org-bar-name');
    nameEl.title = row.rawName && row.rawName !== disp ? `${disp} (${row.rawName})` : disp;

    const track = html('span', null, 'org-bar-track');
    track.setAttribute('aria-hidden', 'true');
    const fill = html('span', null, 'org-bar-fill');
    fill.style.width = `${pct.toFixed(1)}%`;
    track.append(fill);

    const scoreEl = html('span', format(row.score, board.scoreDecimals), 'org-bar-score');
    const gap = maxS - row.score;
    const gapEl = html('span', i === 0 ? t('榜首', '#1') : `−${format(gap, board.scoreDecimals)}`, `org-bar-gap${i === 0 ? ' is-lead' : ''}`);
    const costStr = board.id === 'livebench' && row.lbCost != null
      ? `LB ${money(row.lbCost)}`
      : row.cost != null && row.cost > 0 ? money(row.cost) : '—';
    const costEl = html('span', costStr, 'org-bar-cost');

    li.append(rankEl, dot, nameEl, track, scoreEl, gapEl, costEl);
    frag.append(li);
  });

  list.append(frag);
  scroller.append(list);
  panel.append(scroller);
  return panel;
}

function renderOrgDetailTable(container, board) {
  const baseRows = filterOrgRows(board.rows);
  const wrap = html('div', null, 'org-detail-wrap');

  const banner = html('div', null, 'org-detail-banner');
  const bLeft = html('div', null, 'org-detail-head-copy');
  const ext = html('a', `${t(board.orgZh, board.orgEn)} · ${t(board.titleZh, board.titleEn)} ↗`, 'org-ext-link');
  ext.href = board.sourceUrl;
  ext.target = '_blank';
  ext.rel = 'noopener';
  const metaTxt = `${baseRows.length}/${board.rows.length} ${t('款上榜模型', 'ranked models')}${board.date ? ' · ' + t('原榜日期 ', 'Official date ') + board.date : ''}`;
  bLeft.append(ext, html('span', metaTxt, 'org-meta-count'));

  const bActs = html('div', null, 'org-card-actions');
  if (orgDetailSort.boardId === board.id && orgDetailSort.colKey) {
    const resetSort = html('button', t('恢复原榜排序', 'Official order'), 'org-mini-btn');
    resetSort.type = 'button';
    resetSort.addEventListener('click', () => {
      orgDetailSort = {boardId: board.id, colKey: null, dir: 'desc'};
      renderOrgLeaderboards();
    });
    bActs.append(resetSort);
  }
  const backBtn = html('button', t('← 返回 6 机构并排', '← All 6 orgs'), 'org-mini-btn');
  backBtn.type = 'button';
  backBtn.addEventListener('click', () => {
    runNavAction(() => {
      orgFocus = 'all';
      syncUrlHash();
      renderOrgLeaderboards();
      updateSummary();
    });
  });
  bActs.append(backBtn);
  banner.append(bLeft, bActs);

  // Define org-specific columns with numeric extractors for sorting + relative heat-tint visualization
  let cols;
  if (board.id === 'livebench') {
    cols = [
      {key: 'score', zh: 'LB 2.0 总分', en: 'Overall', cls: 'num is-primary', heat: true, num: r => r.score, get: r => format(r.score, 2)},
      {key: 'longAgentic', zh: '长程智能体 ×2', en: 'Agentic ×2', cls: 'num', heat: true, num: r => r.suites?.longAgentic ?? null, get: r => r.suites?.longAgentic != null ? format(r.suites.longAgentic, 1) : '—'},
      {key: 'reasoning', zh: '深度推理', en: 'Reasoning', cls: 'num', heat: true, num: r => r.suites?.reasoning ?? null, get: r => r.suites?.reasoning != null ? format(r.suites.reasoning, 1) : '—'},
      {key: 'coding', zh: '真实编程 ×1.5', en: 'Coding ×1.5', cls: 'num', heat: true, num: r => r.suites?.coding ?? null, get: r => r.suites?.coding != null ? format(r.suites.coding, 1) : '—'},
      {key: 'browser', zh: '网页浏览', en: 'Browser', cls: 'num', heat: true, num: r => r.suites?.browser ?? null, get: r => r.suites?.browser != null ? format(r.suites.browser, 1) : '—'},
      {key: 'dataAnalysis', zh: '数据分析', en: 'Data', cls: 'num', heat: true, num: r => r.suites?.dataAnalysis ?? null, get: r => r.suites?.dataAnalysis != null ? format(r.suites.dataAnalysis, 1) : '—'},
      {key: 'research', zh: '深度研究', en: 'Research', cls: 'num', heat: true, num: r => r.suites?.research ?? null, get: r => r.suites?.research != null ? format(r.suites.research, 1) : '—'},
      {key: 'design', zh: '视觉设计 ×1.5', en: 'Design ×1.5', cls: 'num', heat: true, num: r => r.suites?.design ?? null, get: r => r.suites?.design != null ? format(r.suites.design, 1) : '—'},
      {key: 'lbCost', zh: 'LB 实测单价', en: 'LB $/task', cls: 'num', lowerBetter: true, num: r => r.lbCost ?? null, get: r => r.lbCost != null ? money(r.lbCost) : '—'},
      {key: 'cost', zh: 'AA 均价', en: 'AA $/task', cls: 'num', lowerBetter: true, num: r => r.cost ?? null, get: r => r.cost != null ? money(r.cost) : '—'}
    ];
  } else if (board.id === 'designArena') {
    cols = [
      {key: 'score', zh: '整站 Website Elo', en: 'Website Elo', cls: 'num is-primary', heat: true, num: r => r.score, get: r => format(r.score, 0)},
      {key: 'winRate', zh: '盲测胜率 · 场次', en: 'Win% · Battles', cls: 'num', num: r => r.winRate ?? null, get: r => `${r.winRate != null ? format(r.winRate, 1) + '%' : '—'}${r.battles ? ' · ' + (r.battles >= 1000 ? format(r.battles / 1000, 1) + 'k' : r.battles) : ''}`},
      {key: 'uicomponent', zh: 'UI 组件 Elo', en: 'UI Comp.', cls: 'num', heat: true, num: r => r.suites?.uicomponent ?? null, get: r => r.suites?.uicomponent != null ? format(r.suites.uicomponent, 0) : '—'},
      {key: 'dataviz', zh: '数据图表 Elo', en: 'DataViz', cls: 'num', heat: true, num: r => r.suites?.dataviz ?? null, get: r => r.suites?.dataviz != null ? format(r.suites.dataviz, 0) : '—'},
      {key: 'gamedev', zh: '游戏交互 Elo', en: 'GameDev', cls: 'num', heat: true, num: r => r.suites?.gamedev ?? null, get: r => r.suites?.gamedev != null ? format(r.suites.gamedev, 0) : '—'},
      {key: 'svg', zh: 'SVG 矢量 Elo', en: 'SVG', cls: 'num', heat: true, num: r => r.suites?.svg ?? null, get: r => r.suites?.svg != null ? format(r.suites.svg, 0) : '—'},
      {key: 'cost', zh: 'AA 均价', en: 'AA $/task', cls: 'num', lowerBetter: true, num: r => r.cost ?? null, get: r => r.cost != null ? money(r.cost) : '—'}
    ];
  } else if (board.id === 'arenaChat' || board.id === 'arenaWebdev') {
    cols = [
      {key: 'score', zh: board.scoreLabelZh, en: board.scoreLabelEn, cls: 'num is-primary', heat: true, num: r => r.score, get: r => format(r.score, 1)},
      {key: 'votes', zh: '真人盲测票数', en: 'Blind Votes', cls: 'num', num: r => r.votes ?? null, get: r => r.votes != null ? r.votes.toLocaleString() : '—'},
      {key: 'aaIndex', zh: 'AA 综合分', en: 'AA Index', cls: 'num', heat: true, num: r => r.aaIndex ?? null, get: r => r.aaIndex != null ? format(r.aaIndex, 1) : '—'},
      {key: 'cost', zh: 'AA 均价', en: 'AA $/task', cls: 'num', lowerBetter: true, num: r => r.cost ?? null, get: r => r.cost != null ? money(r.cost) : '—'},
      {key: 'cross', zh: '其他机构排名', en: 'Other Orgs', cls: 'org-cross-cell', num: null, get: r => r.modelId ? formatOrgRankSummary(r.modelId) : '—'}
    ];
  } else if (board.id === 'aaGdpval') {
    cols = [
      {key: 'score', zh: 'GDPval Elo', en: 'GDPval Elo', cls: 'num is-primary', heat: true, num: r => r.score, get: r => format(r.score, 0)},
      {key: 'briefcase', zh: 'Briefcase Elo', en: 'Briefcase', cls: 'num', heat: true, num: r => r.briefcaseElo ?? null, get: r => r.briefcaseElo != null ? format(r.briefcaseElo, 0) : '—'},
      {key: 'finance', zh: '金融财务', en: 'Finance', cls: 'num', heat: true, num: r => r.domainScores?.finance ?? null, get: r => r.domainScores?.finance != null ? format(r.domainScores.finance, 1) : '—'},
      {key: 'legal', zh: '法律合规', en: 'Legal', cls: 'num', heat: true, num: r => r.domainScores?.legal ?? null, get: r => r.domainScores?.legal != null ? format(r.domainScores.legal, 1) : '—'},
      {key: 'healthcare', zh: '医疗健康', en: 'Health', cls: 'num', heat: true, num: r => r.domainScores?.healthcare ?? null, get: r => r.domainScores?.healthcare != null ? format(r.domainScores.healthcare, 1) : '—'},
      {key: 'engineering', zh: '工程研发', en: 'Eng.', cls: 'num', heat: true, num: r => r.domainScores?.engineering ?? null, get: r => r.domainScores?.engineering != null ? format(r.domainScores.engineering, 1) : '—'},
      {key: 'cost', zh: 'AA 均价', en: 'AA $/task', cls: 'num', lowerBetter: true, num: r => r.cost ?? null, get: r => r.cost != null ? money(r.cost) : '—'}
    ];
  } else {
    cols = [
      {key: 'score', zh: '综合智能 v5', en: 'AA Index v5', cls: 'num is-primary', heat: true, num: r => r.score, get: r => format(r.score, 1)},
      {key: 'frontierCode', zh: 'FrontierCode 2', en: 'FrontierCode 2', cls: 'num', heat: true, num: r => r.subscores?.frontierCode ?? null, get: r => r.subscores?.frontierCode != null ? format(r.subscores.frontierCode, 1) : '—'},
      {key: 'terminalBench', zh: 'Terminal 4.0', en: 'Terminal 4', cls: 'num', heat: true, num: r => r.subscores?.terminalBench ?? null, get: r => r.subscores?.terminalBench != null ? format(r.subscores.terminalBench, 1) : '—'},
      {key: 'hleDiamond', zh: 'HLE Diamond', en: 'HLE', cls: 'num', heat: true, num: r => r.subscores?.hleDiamond ?? null, get: r => r.subscores?.hleDiamond != null ? format(r.subscores.hleDiamond, 1) : '—'},
      {key: 'livebench', zh: 'LiveBench 2.0', en: 'LB 2.0', cls: 'num', heat: true, num: r => r.livebench?.overall ?? null, get: r => r.livebench?.overall != null ? `${format(r.livebench.overall, 1)} (#${r.livebench.rank})` : '—'},
      {key: 'cost', zh: '单任务 API', en: 'API $/task', cls: 'num', lowerBetter: true, num: r => r.cost ?? null, get: r => r.cost != null ? money(r.cost) : '—'},
      {key: 'cross', zh: '跨机构原榜排名', en: 'Cross-Org Ranks', cls: 'org-cross-cell', num: null, get: r => formatOrgRankSummary(r.modelId)}
    ];
  }

  // Apply optional sub-column sort
  let rows = [...baseRows];
  if (orgDetailSort.boardId === board.id && orgDetailSort.colKey) {
    const sortCol = cols.find(c => c.key === orgDetailSort.colKey && c.num);
    if (sortCol) {
      const mul = orgDetailSort.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const va = sortCol.num(a), vb = sortCol.num(b);
        if (va == null && vb == null) return a.rank - b.rank;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (va - vb) * mul || a.rank - b.rank;
      });
    }
  }

  // Precompute column [min, max] for heat-tint visualization & #1 badge
  const colRanges = cols.map(c => {
    if (!c.heat || !c.num) return null;
    const vals = rows.map(c.num).filter(v => typeof v === 'number' && Number.isFinite(v));
    if (vals.length < 2) return null;
    return {min: Math.min(...vals), max: Math.max(...vals)};
  });

  const vizPanel = buildOrgTopBarChart(board, baseRows);

  const scroller = html('div', null, 'org-detail-scroll');
  const table = html('table', null, 'org-detail-table');
  const thead = html('thead');
  const trHead = html('tr');
  trHead.append(
    html('th', t('原榜', 'Rank'), 'num'),
    html('th', t('模型（原榜条目）', 'Model (Official Entry)'))
  );
  cols.forEach(c => {
    const th = html('th', null, c.cls.includes('num') ? 'num' : '');
    if (c.num) {
      const activeSort = orgDetailSort.boardId === board.id && orgDetailSort.colKey === c.key;
      const arrow = activeSort ? (orgDetailSort.dir === 'asc' ? ' ↑' : ' ↓') : '';
      const btn = html('button', `${t(c.zh, c.en)}${arrow}`, `org-th-sort${activeSort ? ' is-sorted' : ''}`);
      btn.type = 'button';
      btn.title = t('点击按此列排序', 'Click to sort by this column');
      btn.addEventListener('click', () => {
        if (orgDetailSort.boardId === board.id && orgDetailSort.colKey === c.key) {
          orgDetailSort.dir = orgDetailSort.dir === 'desc' ? 'asc' : 'desc';
        } else {
          orgDetailSort = {boardId: board.id, colKey: c.key, dir: c.lowerBetter ? 'asc' : 'desc'};
        }
        renderOrgLeaderboards();
      });
      th.append(btn);
    } else {
      th.textContent = t(c.zh, c.en);
    }
    trHead.append(th);
  });
  trHead.append(html('th', t('操作', 'Action'), 'num'));
  thead.append(trHead);

  const tbody = html('tbody');
  if (!rows.length) {
    const tr = html('tr');
    const td = html('td', null, 'org-empty-cell');
    td.colSpan = cols.length + 3;
    td.append(makeEmptyResetNotice('当前筛选条件下无匹配模型', 'No matching models under current filters', {clearOrgMatch: true}));
    tr.append(td);
    tbody.append(tr);
  } else {
    for (const row of rows) {
      const tr = html('tr');
      const spotKey = orgRowSpotKey(row);
      tr.dataset.spotKey = spotKey;
      tr.dataset.orgScope = 'table';
      if (row.familySlug) tr.dataset.familySlug = row.familySlug;
      orgRowByEl.set(tr, row);
      if (!row.modelId) tr.classList.add('is-unmatched');

      const tdRank = html('td', null, 'num');
      tdRank.append(html('span', `#${row.rank}`, `org-rank${row.rank <= 3 ? ' rank-' + row.rank : ''}`));

      const tdName = html('td', null, 'org-name-cell');
      const nameWrap = html('div', null, 'org-detail-name-wrap');
      const dot = html('i', null, 'creator-dot');
      dot.style.background = orgCreatorColor(row.creator, row.creatorColor);
      dot.setAttribute('aria-hidden', 'true');
      const copy = html('div', null, 'org-detail-name-copy');
      const primaryTxt = orgDisplayName(row);
      const subBits = [row.creator];
      if (row.rawName && row.rawName.toLowerCase() !== primaryTxt.toLowerCase()) subBits.push(row.rawName);
      if (row.isOpenWeights === true) subBits.push(t('开源', 'Open'));
      if (!row.modelId) {
        if (row.siblingId || row.cyberId) {
          subBits.push(t(`~同系 ${row.siblingName || row.cyberName}`, `~Sib ${row.siblingName || row.cyberName}`));
        } else {
          subBits.push(t('机构独有', 'Org-only'));
        }
      }
      copy.append(html('strong', primaryTxt), html('span', subBits.join(' · '), 'org-row-sub'));
      nameWrap.append(dot, copy);
      tdName.append(nameWrap);

      const valTds = cols.map((c, ci) => {
        const td = html('td', c.get(row), c.cls);
        const range = colRanges[ci];
        if (range && c.num) {
          const val = c.num(row);
          if (typeof val === 'number' && Number.isFinite(val)) {
            const norm = range.max > range.min ? (val - range.min) / (range.max - range.min) : 0.5;
            td.classList.add('has-heat');
            td.style.setProperty('--heat', `${Math.max(6, Math.round(norm * 100))}%`);
            if (Math.abs(val - range.max) < 1e-6) td.classList.add('is-col-best');
          }
        }
        return td;
      });

      const tdAct = html('td', null, 'num org-act-cell');
      if (row.modelId) {
        const loc = html('button', t('定位', 'Locate'), 'org-micro-btn');
        loc.type = 'button';
        loc.addEventListener('click', e => {
          e.stopPropagation();
          locateOrgModel(row, board);
        });
        const inCmp = isInCompareAnyModelTab(row.modelId);
        const cmp = html('button', inCmp ? t('已对比 ✓', 'In ✓') : t('+ 对比', '+ Cmp'), `org-micro-btn${inCmp ? ' is-in' : ''}`);
        cmp.type = 'button';
        cmp.addEventListener('click', e => {
          e.stopPropagation();
          toggleOrgCompare(row, board, false);
        });
        tdAct.append(loc, cmp);
      } else if (row.siblingId || row.cyberId) {
        const loc = html('button', t('~定位', '~Locate'), 'org-micro-btn is-approx');
        loc.type = 'button';
        loc.title = t(
          `该推理档位未单独收录，点击定位同系列 ${row.siblingName || row.cyberName}`,
          `Locate sibling variant ${row.siblingName || row.cyberName} in scatter chart`
        );
        loc.addEventListener('click', e => {
          e.stopPropagation();
          locateOrgModel(row, board);
        });
        tdAct.append(loc);
      } else {
        tdAct.append(html('span', '—', 'org-row-sub'));
      }

      tr.append(tdRank, tdName, ...valTds, tdAct);
      tbody.append(tr);
    }
  }
  table.append(thead, tbody);
  scroller.append(table);
  const profileBar = html('div', null, 'org-detail-profile');
  for (const [cls, kZh, kEn, vZh, vEn] of [
    ['', '测什么', 'What it tests', board.whatZh, board.whatEn],
    ['', '核心优势', 'Key strength', board.strengthZh, board.strengthEn],
    ['is-caveat', '注意盲区', 'Watch out for', board.caveatZh, board.caveatEn]
  ]) {
    const item = html('div', null, `org-detail-profile-item${cls ? ' ' + cls : ''}`);
    item.append(html('b', t(kZh, kEn)), html('span', t(vZh, vEn)));
    profileBar.append(item);
  }
  const detailBody = html('div', null, `org-detail-body${orgChartCollapsed ? ' is-chart-collapsed' : ''}`);
  detailBody.append(vizPanel, scroller);
  wrap.append(banner, profileBar, detailBody);
  container.replaceChildren(wrap);
}

function renderOrgDivergence(container) {
  const wrap = html('div', null, 'org-div-wrap');
  const baseById = new Map((snapshot?.models || []).map(m => [m.id, m]));
  const boardById = new Map(orgBoards.map(b => [b.id, b]));
  const q = (state?.search || '').trim().toLowerCase();
  const comp = state?.company || null;
  const lic = state?.license || 'all';
  const starOnly = !!state?.starredOnly;

  const divData = computeOrgDivergence(orgBoards, orgRankIndex, baseById, ({modelId, rec, base}) => {
    if (comp && rec.creator !== comp) return false;
    if (lic === 'open' && !base?.isOpenWeights) return false;
    if (lic === 'closed' && base?.isOpenWeights) return false;
    if (starOnly && !isStarred({id: modelId, name: rec.name, creator: {name: rec.creator}})) return false;
    if (q && !`${rec.name} ${rec.shortName} ${rec.creator}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const head = html('div', null, 'org-div-head');
  const hCopy = html('div', null, 'org-div-copy');
  hCopy.append(
    html('strong', t('争议分歧榜：自动化硬考 vs. 真人盲测', 'Org Divergence: Hard Evals vs. Blind Human Taste')),
    html('span', t(
      '同批 40+ 家族模型按各自官方排序折算 0–100 同批百分位（彻底消除 AA 137 项 vs Arena 60 项的容量偏差）· 向右青绿 = 真人盲测更爱，向左琥珀 = 硬考明显更强',
      'Cohort-normalized 0–100 percentiles across shared models (eliminating board-size bias) · Right teal = loved by human voters, left amber = hard-exam specialist'
    ), 'org-meta-count')
  );

  const filterRow = html('div', null, 'org-div-filters');
  for (const [fid, zh, en, cnt] of [
    ['all', '全部分歧', 'All', divData.counts.all],
    ['human', '体感胜跑分', 'Human > Hard', divData.counts.human],
    ['auto', '硬考胜体感', 'Hard > Human', divData.counts.auto],
    ['consensus', '全机构共识', 'Consensus', divData.counts.consensus]
  ]) {
    const b = html('button', `${t(zh, en)} (${cnt})`, 'org-mini-btn');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(orgDivFilter === fid));
    b.addEventListener('click', () => {
      if (orgDivFilter === fid) return;
      orgDivFilter = fid;
      renderOrgLeaderboards();
    });
    filterRow.append(b);
  }
  head.append(hCopy, filterRow);
  wrap.append(head);

  if (!divData.rows.length) {
    const emptyBox = html('div', null, 'org-empty');
    const notice = makeEmptyResetNotice(
      '当前筛选条件下暂无同时覆盖自动化硬考与真人盲测的模型。',
      'No models covered by both automated & human boards under current filters.',
      {clearOrgMatch: true}
    );
    emptyBox.append(notice);
    wrap.append(emptyBox);
    container.replaceChildren(wrap);
    return;
  }

  const fmtEntries = entries => entries.map(e => {
    const tag = boardById.get(e.boardId)?.shortTag || e.boardId;
    return `${tag} ${e.exact ? '' : '~'}#${e.rank}`;
  }).join(' · ');

  // 3-column insight highlight strip
  const kpis = html('div', null, 'org-div-kpis');
  const makeKpi = (cls, labelZh, labelEn, item, detailTxt) => {
    const btn = html('button', null, `org-div-kpi${cls ? ' ' + cls : ''}`);
    btn.type = 'button';
    if (!item) {
      btn.disabled = true;
      btn.append(html('span', t(labelZh, labelEn), 'org-div-kpi-label'), html('span', '—', 'org-div-kpi-sub'));
      return btn;
    }
    const top = html('div', null, 'org-div-kpi-main');
    top.append(html('strong', item.shortName), html('span', item.cost ? money(item.cost) : '—', 'org-meta-count'));
    btn.append(
      html('span', t(labelZh, labelEn), 'org-div-kpi-label'),
      top,
      html('span', detailTxt, 'org-div-kpi-sub')
    );
    btn.addEventListener('click', () => {
      orgPinnedKey = item.modelId;
      lastOrgBarSig = '';
      applyOrgSpotlight(null, null, {scrollPinned: true});
    });
    return btn;
  };
  kpis.append(
    makeKpi(
      '',
      '最大「体感逆袭」（真人更爱）',
      'Top Human Favorite (Vibe > Exam)',
      divData.topHumanFavorite,
      divData.topHumanFavorite
        ? `${t('盲测分位领先', 'Human lead')} +${format(divData.topHumanFavorite.gap, 1)} · ${fmtEntries(divData.topHumanFavorite.humanEntries)} vs ${fmtEntries(divData.topHumanFavorite.autoEntries)}`
        : ''
    ),
    makeKpi(
      'is-auto',
      '最大「硬考偏科」（跑分更强）',
      'Top Hard-Eval Specialist (Exam > Vibe)',
      divData.topHardSpecialist,
      divData.topHardSpecialist
        ? `${t('硬考分位领先', 'Hard lead')} +${format(Math.abs(divData.topHardSpecialist.gap), 1)} · ${fmtEntries(divData.topHardSpecialist.autoEntries)} vs ${fmtEntries(divData.topHardSpecialist.humanEntries)}`
        : ''
    ),
    makeKpi(
      '',
      '最稳「全机构共识」旗舰',
      'Strongest Cross-Org Consensus',
      divData.topConsensus,
      divData.topConsensus
        ? `${t('硬考', 'Hard')} ${format(divData.topConsensus.autoPct, 0)}% · ${t('盲测', 'Human')} ${format(divData.topConsensus.humanPct, 0)}% (${divData.topConsensus.coveredCount}${t('榜全优', ' boards')})`
        : ''
    )
  );
  wrap.append(kpis);

  let shown = divData.rows;
  if (orgDivFilter === 'human') shown = shown.filter(r => r.gap >= 8).sort((a, b) => b.gap - a.gap);
  else if (orgDivFilter === 'auto') shown = shown.filter(r => r.gap <= -8).sort((a, b) => a.gap - b.gap);
  else if (orgDivFilter === 'consensus') shown = shown.filter(r => r.kind === 'consensus').sort((a, b) => b.overallPct - a.overallPct);

  const maxAbsGap = Math.max(25, ...divData.rows.map(r => r.absGap));
  const scroller = html('div', null, 'org-div-scroll');
  const table = html('table', null, 'org-div-table');
  const thead = html('thead');
  const trH = html('tr');
  trH.append(
    html('th', t('模型（点击锁定跨榜对齐）', 'Model (click to pin cross-org)')),
    html('th', t('自动化硬考 (AA / LB2)', 'Hard Evals (AA / LB2)')),
    html('th', t('真人盲测 (Arena / Design)', 'Human Taste (Arena / Design)')),
    html('th', t('硬考 ← 分歧方向 → 体感', 'Hard ← Divergence → Human')),
    html('th', t('最强 ↔ 最弱机构', 'Best ↔ Worst Org')),
    html('th', t('操作', 'Action'), 'num')
  );
  thead.append(trH);

  const tbody = html('tbody');
  if (!shown.length) {
    const tr = html('tr');
    const td = html('td', t('该分歧分类下暂无匹配模型，请切换上方分类标签。', 'No models in this divergence bucket. Try another filter pill above.'), 'org-empty-cell');
    td.colSpan = 6;
    tr.append(td);
    tbody.append(tr);
  } else {
    for (const r of shown) {
      const tr = html('tr');
      tr.dataset.spotKey = r.modelId;
      tr.dataset.orgScope = 'div';
      if (r.familySlug) tr.dataset.familySlug = r.familySlug;
      orgRowByEl.set(tr, {modelId: r.modelId, familySlug: r.familySlug, name: r.name, shortName: r.shortName, creator: r.creator, creatorColor: r.creatorColor, cost: r.cost});

      const tdName = html('td', null, 'org-name-cell');
      const nameWrap = html('div', null, 'org-detail-name-wrap');
      const dot = html('i', null, 'creator-dot');
      dot.style.background = orgCreatorColor(r.creator, r.creatorColor);
      dot.setAttribute('aria-hidden', 'true');
      const copy = html('div', null, 'org-detail-name-copy');
      const subBits = [r.creator];
      if (r.cost != null && r.cost > 0) subBits.push(money(r.cost));
      if (r.isOpenWeights) subBits.push(t('开源', 'Open'));
      copy.append(html('strong', r.shortName), html('span', subBits.join(' · '), 'org-row-sub'));
      nameWrap.append(dot, copy);
      tdName.append(nameWrap);

      const tdAuto = html('td', null, 'org-div-ranks-cell');
      const autoTxt = fmtEntries(r.autoEntries);
      tdAuto.title = `${Math.round(r.autoPct)}% · ${autoTxt}`;
      tdAuto.append(html('b', `${Math.round(r.autoPct)}%`), document.createTextNode(autoTxt));

      const tdHuman = html('td', null, 'org-div-ranks-cell');
      const humanTxt = fmtEntries(r.humanEntries);
      tdHuman.title = `${Math.round(r.humanPct)}% · ${humanTxt}`;
      tdHuman.append(html('b', `${Math.round(r.humanPct)}%`), document.createTextNode(humanTxt));

      const tdBar = html('td', null, 'org-div-bar-cell');
      const barWrap = html('div', null, 'org-div-bar-wrap');
      const track = html('div', null, 'org-div-track');
      track.append(html('span', null, 'org-div-axis'));
      const halfPct = Math.min(48, Math.max(3, (r.absGap / maxAbsGap) * 48));
      if (r.absGap >= 1.5) {
        const fill = html('span', null, `org-div-fill ${r.gap > 0 ? 'is-human' : 'is-auto'}`);
        fill.style.width = `${halfPct.toFixed(1)}%`;
        track.append(fill);
      }
      const deltaCls = r.gap >= 8 ? 'is-human' : r.gap <= -8 ? 'is-auto' : 'is-even';
      const deltaTxt = r.gap >= 8
        ? t(`体感 +${format(r.gap, 0)}`, `Human +${format(r.gap, 0)}`)
        : r.gap <= -8
          ? t(`硬考 +${format(Math.abs(r.gap), 0)}`, `Hard +${format(Math.abs(r.gap), 0)}`)
          : t('基本一致', 'Aligned');
      barWrap.append(track, html('span', deltaTxt, `org-div-delta ${deltaCls}`));
      tdBar.append(barWrap);

      const bestTag = boardById.get(r.bestOrg.boardId)?.shortTag || r.bestOrg.boardId;
      const worstTag = boardById.get(r.worstOrg.boardId)?.shortTag || r.worstOrg.boardId;
      const tdSpread = html('td', `${bestTag} ${r.bestOrg.exact ? '' : '~'}#${r.bestOrg.rank} ↔ ${worstTag} ${r.worstOrg.exact ? '' : '~'}#${r.worstOrg.rank}`, 'org-div-ranks-cell');

      const tdAct = html('td', null, 'num org-act-cell');
      const loc = html('button', t('定位', 'Locate'), 'org-micro-btn');
      loc.type = 'button';
      loc.setAttribute('aria-label', t(`在散点图中定位 ${r.shortName}`, `Locate ${r.shortName} in scatter chart`));
      loc.addEventListener('click', e => {
        e.stopPropagation();
        locateOrgModel({modelId: r.modelId}, orgBoards[0]);
      });
      const inCmp = isInCompareAnyModelTab(r.modelId);
      const cmp = html('button', inCmp ? t('已选', 'In') : t('+对比', '+Cmp'), `org-micro-btn${inCmp ? ' is-in' : ''}`);
      cmp.type = 'button';
      cmp.setAttribute('aria-label', inCmp ? t(`从对比移除 ${r.shortName}`, `Remove ${r.shortName}`) : t(`将 ${r.shortName} 加入剖析对比`, `Add ${r.shortName} to compare`));
      cmp.addEventListener('click', e => {
        e.stopPropagation();
        toggleOrgCompare({modelId: r.modelId}, orgBoards[0], false);
      });
      tdAct.append(loc, cmp);

      tr.append(tdName, tdAuto, tdHuman, tdBar, tdSpread, tdAct);
      tbody.append(tr);
    }
  }
  table.append(thead, tbody);
  scroller.append(table);
  wrap.append(scroller);
  container.replaceChildren(wrap);
}

function renderOrgLeaderboards() {
  if (!state || !orgBoards.length) return;
  $('#exportPng').hidden = orgFocus !== 'bump';
  $('#exportCsv').hidden = false;
  const modeSwitch = $('#orgModeSwitch');
  const mFrag = document.createDocumentFragment();
  for (const [id, zh, en] of [
    ['all', '6 机构并排', 'Side-by-Side'],
    ['bump', '跨机构轨迹图', 'Rank Trajectory'],
    ['divergence', '争议分歧榜', 'Divergence']
  ]) {
    const b = html('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(orgFocus === id));
    const ic = node('svg', {viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true'});
    if (id === 'all') {
      ic.append(
        node('rect', {x: 1.8, y: 2.5, width: 3.4, height: 11, rx: 0.9, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.25}),
        node('rect', {x: 6.3, y: 2.5, width: 3.4, height: 11, rx: 0.9, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.25}),
        node('rect', {x: 10.8, y: 2.5, width: 3.4, height: 11, rx: 0.9, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.25})
      );
    } else if (id === 'bump') {
      ic.append(
        node('path', {d: 'M2 11.5 C5.2 11.5, 5.8 4.5, 8 4.5 C10.2 4.5, 10.8 10, 14 6', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round'}),
        node('path', {d: 'M2 5.5 C5.2 5.5, 5.8 11, 8 11 C10.2 11, 10.8 4.8, 14 11.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.15, 'stroke-dasharray': '2 2', opacity: 0.72, 'stroke-linecap': 'round'}),
        node('circle', {cx: 8, cy: 4.5, r: 1.4, fill: 'currentColor'})
      );
    } else {
      ic.append(
        node('line', {x1: 8, y1: 2.2, x2: 8, y2: 13.8, stroke: 'currentColor', 'stroke-width': 1.25, opacity: 0.65}),
        node('rect', {x: 8, y: 3.5, width: 5.5, height: 2.6, rx: 0.8, fill: 'currentColor'}),
        node('rect', {x: 2.5, y: 9.8, width: 5.5, height: 2.6, rx: 0.8, fill: 'currentColor', opacity: 0.75})
      );
    }
    b.append(ic, html('span', t(zh, en)));
    b.addEventListener('click', () => {
      if (orgFocus === id) return;
      runNavAction(() => {
        orgFocus = id;
        syncUrlHash();
        renderOrgLeaderboards();
        updateSummary();
      });
    });
    mFrag.append(b);
  }
  modeSwitch.replaceChildren(mFrag);

  const selGroup = $('#orgSelectGroup');
  const pFrag = document.createDocumentFragment();
  for (const board of orgBoards) {
    const btn = html('button', t(board.pillZh, board.pillEn));
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(orgFocus === board.id));
    btn.title = `${t(board.orgZh, board.orgEn)} · ${t(board.titleZh, board.titleEn)}`;
    btn.addEventListener('click', () => {
      if (orgFocus === board.id) return;
      runNavAction(() => {
        orgFocus = board.id;
        orgDetailSort = {boardId: board.id, colKey: null, dir: 'desc'};
        syncUrlHash();
        renderOrgLeaderboards();
        updateSummary();
      });
    });
    pFrag.append(btn);
  }
  selGroup.replaceChildren(pFrag);

  const matchBtn = $('#orgMatchedToggle');
  matchBtn.hidden = orgFocus === 'bump' || orgFocus === 'divergence';
  matchBtn.setAttribute('aria-pressed', String(orgMatchedOnly));
  matchBtn.textContent = orgMatchedOnly
    ? t('仅看可对齐全站模型 ✓', 'Aligned models only ✓')
    : t('仅看可对齐全站模型', 'Aligned models only');

  const activeBoard = orgBoards.find(b => b.id === orgFocus) || null;
  const jumpBtn = $('#orgJumpScatterBtn');
  if (activeBoard) {
    jumpBtn.hidden = false;
    jumpBtn.textContent = t(`在散点图看 ${activeBoard.pillZh} →`, `Scatter: ${activeBoard.pillEn} →`);
  } else {
    jumpBtn.hidden = true;
  }

  const content = $('#orgContent');
  clearTimeout(orgLeaveTimer);
  orgLeaveTimer = 0;
  if (orgHoverRaf) {
    cancelAnimationFrame(orgHoverRaf);
    orgHoverRaf = 0;
  }
  orgSpotlightKey = null;
  pendingOrgHoverKey = null;
  pendingOrgHoverRow = null;
  if (orgFocus === 'bump') {
    renderOrgBumpChart(content);
  } else if (orgFocus === 'divergence') {
    renderOrgDivergence(content);
  } else if (activeBoard) {
    renderOrgDetailTable(content, activeBoard);
  } else {
    renderOrgSideBySide(content);
  }
  rebuildOrgDomIndex(content);
  applyOrgSpotlight(null);
}

// Single delegated, rAF-coalesced & gap-debounced spotlight controller on #orgContent
$('#orgContent').addEventListener('pointerover', event => {
  const target = event.target instanceof Element ? event.target : null;
  const el = target?.closest('[data-spot-key]');
  if (el) {
    clearTimeout(orgLeaveTimer);
    orgLeaveTimer = 0;
    const sk = el.dataset.spotKey;
    if (sk !== pendingOrgHoverKey || sk !== orgSpotlightKey) {
      scheduleOrgSpotlight(sk, orgRowByEl.get(el) || null);
    }
  } else if ((orgSpotlightKey || pendingOrgHoverKey) && !orgLeaveTimer) {
    orgLeaveTimer = setTimeout(() => {
      orgLeaveTimer = 0;
      scheduleOrgSpotlight(null, null);
    }, 48);
  }
});

$('#orgContent').addEventListener('pointerleave', () => {
  clearTimeout(orgLeaveTimer);
  orgLeaveTimer = 0;
  scheduleOrgSpotlight(null, null);
});

$('#orgContent').addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest('button, a, .org-card-match')) return;
  const el = target.closest('[data-spot-key]');
  if (!el) return;
  const sk = el.dataset.spotKey;
  const row = orgRowByEl.get(el) || null;
  const nextPin = orgPinnedKey === sk ? null : sk;
  orgPinnedKey = nextPin;
  lastOrgBarSig = '';
  applyOrgSpotlight(orgSpotlightKey, row, {
    scrollPinned: !!nextPin,
    sourceScope: el.dataset.orgScope || null
  });
});

$('#orgMatchedToggle').addEventListener('click', () => {
  orgMatchedOnly = !orgMatchedOnly;
  syncUrlHash();
  renderOrgLeaderboards();
  updateSummary();
});

$('#orgJumpScatterBtn').addEventListener('click', () => {
  const activeBoard = orgBoards.find(b => b.id === orgFocus);
  if (activeBoard) jumpToOrgScatter(activeBoard);
});

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
    buildStandaloneOrgBoards(snapshot);
    globalCatalog = buildGlobalCatalog(snapshot);
    states.clear();
    const hasFrontier = Array.isArray(snapshot.frontierModels) && snapshot.frontierModels.length > 0;
    const hasHumanArena = Array.isArray(snapshot.humanArenaModels) && snapshot.humanArenaModels.length > 0;
    const hasCyber = Array.isArray(snapshot.cyberModels) && snapshot.cyberModels.length > 0;
    const hasMedia = Array.isArray(snapshot.mediaModels) && snapshot.mediaModels.length > 0;
    $('#tab-frontier').hidden = !hasFrontier;
    $('#tab-human-arena').hidden = !hasHumanArena;
    $('#tab-cyber').hidden = !hasCyber;
    $('#tab-media').hidden = !hasMedia;
    $('#tab-orgs').hidden = !orgBoards.length;
    if (changelogOpen) renderChangelog();
    if (cmdOpen) renderCmdList();
    const parsed = parseHash();
    chooseChart(parsed.chart, {changeHash: false, routeParams: parsed.params});
    initNavHistory();
  } catch (error) {
    if (generation === loadGeneration) {
      showLoadError(error.name === 'AbortError' ? new Error(t('请求超时，请重试', 'Request timed out')) : error);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function syncOnboardingStrip() {
  const strip = $('#onboardingStrip');
  if (!strip) return;
  if (onboardingDismissed) {
    strip.hidden = true;
    return;
  }
  strip.hidden = false;
  strip.setAttribute('aria-label', t('新手读图提示', 'Beginner quick-read hint'));
  $('#onboardingText').textContent = activeKey === 'orgs'
    ? t(
      '6 家权威测评机构原序原分对照 · 悬停或单击任意模型同步高亮跨榜排名 · 点「读懂榜单」了解各机构侧重与盲区',
      '6 official org leaderboards un-blended · Hover or click any model to align ranks across orgs · Open Guide for agency traits'
    )
    : t(
      '看图口诀：越靠左上越理想（高分且低价）· 虚线为帕累托前沿（同价位无可替代）· 单击圆点看跨榜详情',
      'Quick read: Upper-left is best (high score, low cost) · Dashed line = Pareto frontier (unbeaten at its price) · Click dots for details'
    );
  $('#onboardingPickerBtn').textContent = t('3 步帮我选模型', '3-Step Model Picker');
  $('#onboardingGuideBtn').textContent = t('读懂榜单', 'Guide');
  $('#onboardingDismissBtn').textContent = t('知道了', 'Got it');
  $('#onboardingDismissBtn').setAttribute('aria-label', t('关闭新手读图提示', 'Dismiss quick-read hint'));
}

const GUIDE_RECIPE_RUNNERS = {
  'models-effort': () => {
    resetActiveFilters();
    showView('chart');
    state.effortCurves = true;
    state.view = {...state.bounds};
    syncControls();
    syncUrlHash();
    scheduleDraw();
    selectionNotice = t(
      '已开启「推理轨迹」：虚线连接同系列不同思考档位，斜率越平缓说明加档越不划算',
      'Effort Paths active: dashed trails link effort tiers within each family — flatter slopes mean diminishing returns'
    );
    updateSummary();
  },
  'models-history': () => {
    resetActiveFilters();
    showView('chart');
    if (state.releaseDates.length) {
      state.historyMode = true;
      const sixMo = shiftMonthsIso(state.releaseDates.at(-1), -6);
      const idx = state.releaseDates.findIndex(d => d >= sixMo);
      state.historyIndex = idx === -1 ? Math.floor(state.releaseDates.length * 0.45) : idx;
    }
    syncControls();
    syncUrlHash();
    scheduleDraw();
    selectionNotice = t(
      '已开启「历史演进」：拖动上方时间轴或点「▶ 回放演进」观察同等能力成本暴跌轨迹',
      'History mode active: scrub the timeline or click Play to watch identical capability become multiples cheaper'
    );
    updateSummary();
  },
  'models-livebench': () => {
    resetActiveFilters();
    showView('chart');
    applyYLens(state, 'livebench');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '纵轴已切至「LiveBench 2.0 防污染总分」：远离左上前沿的旧高分模型往往受旧题库红利影响',
      'Y-axis set to LiveBench 2.0 (contamination-free): compare positions against overall index to spot benchmark overfitting'
    );
    updateSummary();
  },
  'models-fullstack': () => {
    resetActiveFilters();
    showView('chart');
    const preset = SCENARIO_PRESETS.find(p => p.id === 'fullstack');
    if (preset) {
      state.scenarioId = preset.id;
      state.scenarioWeights = {...preset.weights};
    }
    state.isoCurve = true;
    reprojectRows(state);
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已切换「全栈研发」场景配方并开启等值切线：点工具栏「场景配方」可微调五维权重',
      'Full-Stack scenario + Iso-Value active: open Scenarios in the toolbar to customize all 5 workflow weights'
    );
    updateSummary();
  },
  'frontier-risers': () => {
    resetActiveFilters();
    showView('chart');
    state.extraFilter = 'delta:up';
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已筛选「抗刷榜硬核跃升」模型：这些模型在剔除旧题后名次上升，硬核泛化更稳',
      'Filtered to Hard-Eval Rank Risers: models that climb the standings when saturated legacy tests are stripped'
    );
    updateSummary();
  },
  'frontier-mlcr': () => {
    resetActiveFilters();
    showView('chart');
    applyYLens(state, 'mlcr');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '纵轴已切至「MLCR 百万长上下文」：观察哪些低价模型在长文档里依然稳住高分',
      'Y-axis set to MLCR Million-Token Context: spot models that keep accuracy intact on huge documents'
    );
    updateSummary();
  },
  'frontier-law': () => {
    resetActiveFilters();
    showView('chart');
    applyYLens(state, 'harveyLaw');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '纵轴已切至「Harvey 顶尖律所」：工具栏下拉框还可切到 IT-Bench SRE 排障、Terminal 4.0 等专项',
      'Y-axis set to Harvey BigLaw: use the Y-lens dropdown to switch to IT-Bench SRE, Terminal 4.0, or HLE'
    );
    updateSummary();
  },
  'frontier-open': () => {
    resetActiveFilters();
    showView('chart');
    state.license = 'open';
    state.isoCurve = true;
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已筛选「仅开源」前沿模型并画出等值切线：开源前沿集中在左下极低成本带',
      'Open-Weights filter + Iso-Value contour active: inspect the strongest self-hostable models'
    );
    updateSummary();
  },
  'human-antislop': () => {
    resetActiveFilters();
    showView('chart');
    applyYLens(state, 'antiSlop');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '纵轴已切至「去 AI 套话自然度」：分数越高，文字越自然克制、越少机械套话',
      'Y-axis set to Anti-Slop Naturalness: higher scores mean cleaner, less cliché-ridden writing'
    );
    updateSummary();
  },
  'human-design': () => {
    resetActiveFilters();
    showView('chart');
    applyYLens(state, 'pureVisual');
    state.extraFilter = 'design:top';
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已聚焦 Design Arena 高审美第一梯队：适合选网页原型、UI 组件与数据可视化主力模型',
      'Focused on top Design Arena models (Website Elo ≥ 1300) for web, UI, and visual craft'
    );
    updateSummary();
  },
  'human-gdpval': () => {
    resetActiveFilters();
    showView('chart');
    applyYLens(state, 'deliverable');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '纵轴已切至「44 职业专家办公交付」：衡量研报、表格、方案等直接可用成果质量',
      'Y-axis set to 44-Job Expert Deliverables: measures directly usable professional work products'
    );
    updateSummary();
  },
  'human-compare': () => {
    resetActiveFilters();
    state.compareIds = defaultCompareIds(state.rows);
    showView('compare');
    selectionNotice = t(
      '已打开「剖析对比」：可切换「微距跑道」或「胜负分差 Δ」放大细微差距',
      'Compare view open: switch between Radar, Zoomed Strip, and Delta Δ views above the chart'
    );
    updateSummary();
  },
  'coding-tail': () => {
    resetActiveFilters();
    showView('compare');
    selectionNotice = t(
      '向下看「单任务成本结构拆解」：P95 远高于均值说明该智能体偶发长尾重试很烧钱',
      'Check Cost Anatomy below: P95 >> Mean warns of occasional expensive retry loops'
    );
    updateSummary();
  },
  'coding-sub': () => {
    resetActiveFilters();
    showView('sub');
    state.routerOpen = true;
    syncRouterControls();
    syncUrlHash();
    selectionNotice = t(
      '已打开「订阅回本 + 混合路由」：拖动月任务量与分流比例，实时算清订阅还是 API 省钱',
      'Sub vs API + Hybrid Routing active: adjust monthly tasks & routing share to optimize spend'
    );
    updateSummary();
  },
  'coding-time': () => {
    resetActiveFilters();
    showView('chart');
    syncMetricViewport(state, 'time');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '横轴已切至「每任务平均耗时」：越靠左上代表既能解难题、等待时间又短',
      'X-axis switched to Mean Wall Time: upper-left agents solve hard repos without long waits'
    );
    updateSummary();
  },
  'cyber-zero': () => {
    resetActiveFilters();
    showView('chart');
    state.extraFilter = 'refusal:zero';
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已筛选「零安全拒答 (0%)」安全模型：悬停任意圆点可查看具体拒答率与防护状态',
      'Filtered to 0% refusal cyber models: hover any dot to inspect refusal rate and safeguard status'
    );
    updateSummary();
  },
  'cyber-guarded': () => {
    resetActiveFilters();
    showView('chart');
    state.extraFilter = 'refusal:guarded';
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已筛选「含安全拦截 (>0%)」模型：可点击数据表横向比较各模型拒答率与单价',
      'Filtered to safeguarded (>0% refusal) models: switch to Table view for side-by-side comparison'
    );
    updateSummary();
  },
  'cyber-value': () => {
    resetActiveFilters();
    state.sortKey = 'valuePerDollar';
    state.sortDirection = 'desc';
    showView('table');
    selectionNotice = t(
      '已按「性价比」降序排列网络安全数据表：顶部可拖动 α 滑块调整偏省钱还是偏高分',
      'Table sorted by Value/USD: drag the α slider above to tilt between lowest cost and highest score'
    );
    updateSummary();
  },
  'img-both': () => {
    resetActiveFilters();
    setMediaTrack('image');
    showView('chart');
    state.extraFilter = 'msub:imgBoth';
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已筛选「同时覆盖文生图与修图」图像引擎：可在纵轴下拉框分别看 T2I 与 Edit 分数',
      'Filtered to dual T2I + Editing engines: use the Y-lens selector to toggle T2I vs. Edit scores'
    );
    updateSummary();
  },
  'img-frontier': () => {
    resetActiveFilters();
    setMediaTrack('image');
    showView('chart');
    state.frontierOnly = true;
    state.isoCurve = true;
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已聚焦「图像前沿 + 等值切线」：离青绿切线越近，单张美元换回的盲测观感越高',
      'Image Pareto frontier + Iso-Value active: points closest to the teal curve deliver peak perceptual value per image'
    );
    updateSummary();
  },
  'img-sub': () => {
    resetActiveFilters();
    setMediaTrack('image');
    showView('sub');
    selectionNotice = t(
      '已打开图像「订阅回本」测算：拖动预计每月出图张数即可看各引擎 API 账单对比',
      'Image Sub vs API open: adjust monthly image volume to compare flat subscriptions against per-image API spend'
    );
    updateSummary();
  },
  'vid-i2v': () => {
    resetActiveFilters();
    setMediaTrack('video');
    showView('chart');
    applyYLens(state, 'i2v');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '纵轴已切至「图生视频 (I2V)」：横轴为每 5 秒短片单价，越靠左上越值得主力批量生成',
      'Y-axis set to Image-to-Video (I2V): compare $/5s clip cost along the upper-left frontier'
    );
    updateSummary();
  },
  'vid-edit': () => {
    resetActiveFilters();
    setMediaTrack('video');
    showView('chart');
    applyYLens(state, 'vidEdit');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '纵轴已切至「视频编辑 (Edit)」：点击任意引擎可查看其 T2V / I2V / Edit 三项细分分',
      'Y-axis set to Video Editing: click any model to inspect its T2V, I2V, and Edit breakdown'
    );
    updateSummary();
  },
  'vid-sub': () => {
    resetActiveFilters();
    setMediaTrack('video');
    showView('sub');
    selectionNotice = t(
      '已打开视频「订阅回本」测算：拖动月生成段数即可估算可灵 / Runway / Sora 类月卡回本点',
      'Video Sub vs API open: adjust monthly 5s clip volume to see break-even points vs. flat plans'
    );
    updateSummary();
  },
  'tts-fast': () => {
    resetActiveFilters();
    setMediaTrack('tts');
    showView('chart');
    state.extraFilter = 'msub:ttsFast';
    renderLegend();
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '已筛选「低首包延迟 (TTFA ≤ 250ms)」语音引擎：悬停任意圆点查看精确毫秒数',
      'Filtered to TTFA ≤ 250ms speech engines: hover any dot to inspect exact latency in ms'
    );
    updateSummary();
  },
  'tts-time': () => {
    resetActiveFilters();
    setMediaTrack('tts');
    showView('chart');
    syncMetricViewport(state, 'time');
    syncControls();
    syncUrlHash();
    buildPlot();
    selectionNotice = t(
      '语音赛道横轴已切至「实测耗时」：越靠左上代表语音既自然、整段合成又快',
      'TTS X-axis switched to Measured Time: upper-left voices are both natural and fast'
    );
    updateSummary();
  },
  'tts-value': () => {
    resetActiveFilters();
    setMediaTrack('tts');
    state.sortKey = 'valuePerDollar';
    state.sortDirection = 'desc';
    showView('table');
    selectionNotice = t(
      '已按「性价比」降序排列语音引擎表：适合有声书、播客与大规模配音选型',
      'TTS Table sorted by Value/USD for high-volume narration and audio production'
    );
    updateSummary();
  },
  'orgs-divergence': () => {
    resetActiveFilters({clearOrgMatch: true});
    orgFocus = 'divergence';
    orgDivFilter = 'all';
    syncUrlHash();
    renderOrgLeaderboards();
    selectionNotice = t(
      '已打开「争议分歧榜」：向右青绿代表真人盲测远胜自动化考分，向左琥珀代表硬考强但体感相对偏弱',
      'Divergence board open: teal bars = loved more by human voters, amber bars = hard-exam specialists'
    );
    updateSummary();
  },
  'orgs-bump': () => {
    resetActiveFilters({clearOrgMatch: true});
    orgFocus = 'bump';
    syncUrlHash();
    renderOrgLeaderboards();
    selectionNotice = t(
      '已切到「跨机构轨迹图」：悬停或单击任意曲线高亮其 6 榜原分，点机构列标题可进单榜精析',
      'Bump Chart open: hover/click any line to trace ranks across all 6 orgs; click column headers to inspect'
    );
    updateSummary();
  },
  'orgs-livebench': () => {
    resetActiveFilters({clearOrgMatch: true});
    orgFocus = 'livebench';
    orgDetailSort = {boardId: 'livebench', colKey: null, dir: 'desc'};
    syncUrlHash();
    renderOrgLeaderboards();
    selectionNotice = t(
      '已进入 LiveBench 2.0 单榜精析：点击任意列头可按单项成绩或实测单价重新排序',
      'Inspecting LiveBench 2.0: click any column header to sort by sub-suite score or measured cost'
    );
    updateSummary();
  },
  'orgs-pin-top': () => {
    resetActiveFilters({clearOrgMatch: true});
    orgFocus = 'all';
    const topId = orgBoards[0]?.rows?.[0]?.modelId || null;
    orgPinnedKey = topId;
    syncUrlHash();
    renderOrgLeaderboards();
    if (topId) applyOrgSpotlight(null, null, {scrollPinned: true});
    selectionNotice = t(
      '已用琥珀金锁定榜首模型：悬停其他行可触发双模型实时对比，按 Esc 解锁',
      'Top model pinned in Amber: hover any other row for dual comparison, or press Esc to unpin'
    );
    updateSummary();
  }
};

function currentGuideProfileKey() {
  if (activeKey === 'media') return `media:${state?.mediaTrack || 'image'}`;
  return GUIDE_TAB_META[activeKey] ? activeKey : 'models';
}

function setGuideOpen(open, tabName = null) {
  if (tabName && ['picker', 'current', 'orgs', 'glossary'].includes(tabName)) guideTab = tabName;
  guideOpen = !!open;
  const backdrop = $('#guideBackdrop');
  if (!backdrop) return;
  backdrop.hidden = !guideOpen;
  $('#guideBtn')?.setAttribute('aria-expanded', String(guideOpen && guideTab !== 'picker'));
  $('#pickerBtn')?.setAttribute('aria-expanded', String(guideOpen && guideTab === 'picker'));
  if (guideOpen) {
    if (cmdOpen) setCmdOpen(false);
    if (changelogOpen) setChangelogOpen(false);
    if (scenarioOpen) setScenarioOpen(false);
    if (viewToolsOpen) setViewToolsOpen(false);
    renderGuideDialog();
    requestAnimationFrame(() => $('#guideCloseBtn')?.focus({preventScroll: true}));
  } else {
    (guideTab === 'picker' ? $('#pickerBtn') : $('#guideBtn'))?.focus({preventScroll: true});
  }
}

function applyPickerContext(recResult, {targetRow = null, toCompare = false} = {}) {
  const {useCase, license, picks} = recResult;
  setGuideOpen(false);
  runNavAction(() => {
    chooseChart(useCase.tab, {changeHash: false});
    if (!state) return;
    if (useCase.tab === 'media' && useCase.mediaTrack) {
      setMediaTrack(useCase.mediaTrack, {reRender: false, updateUrl: false});
    }
    state.search = '';
    state.company = null;
    state.starredOnly = false;
    state.frontierOnly = false;
    state.extraFilter = '';
    state.minScore = 0;
    state.maxCost = 0;
    state.license = license.id;
    if (useCase.scenarioId && useCase.scenarioId !== 'default' && !['coding-agents', 'media'].includes(useCase.tab)) {
      const preset = SCENARIO_PRESETS.find(p => p.id === useCase.scenarioId);
      state.scenarioId = preset ? preset.id : 'default';
      state.scenarioWeights = preset?.weights ? {...preset.weights} : null;
      state.yLens = '';
      reprojectRows(state);
    } else {
      state.scenarioId = 'default';
      state.scenarioWeights = null;
      applyYLens(state, useCase.yLens || '');
    }
    if (toCompare && picks.length) {
      const ids = picks.map(p => p.row.id).filter(id => state.rows.some(r => r.id === id));
      if (ids.length) {
        state.compareIds = ids;
        if (!['coding-agents', 'media'].includes(activeKey)) lastModelCompareIds = [...ids];
      }
      renderLegend();
      showView('compare');
      selectionNotice = t(
        `已按「${useCase.zh}」将推荐的 ${ids.length} 款模型送入剖析对比（点左上 ‹ 返回可随时退回）`,
        `Loaded ${ids.length} recommended ${useCase.en} models into Compare view`
      );
      updateSummary();
      return;
    }
    renderLegend();
    syncControls();
    buildPlot();
    if (targetRow) {
      const liveRow = state.rows.find(r => r.id === targetRow.id);
      if (liveRow) locateRowInChart(liveRow);
    } else {
      showView('chart');
      selectionNotice = t(
        `已切换至「${useCase.zh}」前沿散点视野（左上角为最优区间）`,
        `Opened ${useCase.en} scatter frontier (upper-left is best)`
      );
      updateSummary();
    }
  });
}

function renderPickerTab(frag) {
  const steps = html('section', null, 'picker-steps');

  // Step 1: Use Case
  const s1 = html('div', null, 'picker-step');
  const s1Lbl = html('div', null, 'picker-step-label');
  s1Lbl.append(
    document.createTextNode(t('1. 你主要拿模型做什么？', '1. What is your primary use case?')),
    html('span', t('单选场景，实时重算', 'Pick one — updates live'))
  );
  const s1Chips = html('div', null, 'picker-chips');
  for (const uc of RECOMMEND_USE_CASES) {
    const b = html('button', t(uc.zh, uc.en), 'picker-chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pickerChoice.useCase === uc.id));
    b.addEventListener('click', () => {
      pickerChoice.useCase = uc.id;
      renderGuideDialog();
    });
    s1Chips.append(b);
  }
  s1.append(s1Lbl, s1Chips);

  // Step 2 & Step 3 side-by-side
  const row23 = html('div', null, 'picker-step-row');
  const s2 = html('div', null, 'picker-step');
  s2.append(html('div', t('2. 预算与付费偏好？', '2. Cost vs. capability priority?'), 'picker-step-label'));
  const s2Chips = html('div', null, 'picker-chips');
  for (const bud of RECOMMEND_BUDGETS) {
    const b = html('button', t(bud.zh, bud.en), 'picker-chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pickerChoice.budget === bud.id));
    b.addEventListener('click', () => {
      pickerChoice.budget = bud.id;
      renderGuideDialog();
    });
    s2Chips.append(b);
  }
  s2.append(s2Chips);

  const s3 = html('div', null, 'picker-step');
  s3.append(html('div', t('3. 开源 / 部署要求？', '3. Open-weights preference?'), 'picker-step-label'));
  const s3Chips = html('div', null, 'picker-chips');
  for (const lic of RECOMMEND_LICENSES) {
    const b = html('button', t(lic.zh, lic.en), 'picker-chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pickerChoice.license === lic.id));
    b.addEventListener('click', () => {
      pickerChoice.license = lic.id;
      renderGuideDialog();
    });
    s3Chips.append(b);
  }
  s3.append(s3Chips);
  row23.append(s2, s3);
  steps.append(s1, row23);
  frag.append(steps);

  const rec = recommendModels(snapshot, pickerChoice);
  const secHead = html('div', null, 'guide-sec-head');
  secHead.append(
    html('h3', t(`为你从 ${rec.totalPool} 款候选中挑出 3 个参考方案`, `3 Curated Picks from ${rec.totalPool} Models`)),
    html('span', t(rec.useCase.descZh, rec.useCase.descEn))
  );
  frag.append(secHead);

  if (!rec.picks.length) {
    const empty = html('div', null, 'guide-hero');
    empty.append(html('p', t('当前开源筛选下暂无该场景收录模型，建议将第 3 步切回「不限（推荐）」。', 'No models match this exact filter — try setting Step 3 back to Any.')));
    frag.append(empty);
    return;
  }

  const grid = html('div', null, 'picker-results');
  const unitTxt = t(rec.useCase.unitZh, rec.useCase.unitEn);
  for (const pick of rec.picks) {
    const card = html('article', null, `picker-card is-${pick.slot}`);
    const top = html('div', null, 'picker-card-top');
    top.append(
      html('span', t(pick.badgeZh, pick.badgeEn), 'picker-role'),
      html('span', pick.row.isOpenWeights ? t('开源', 'Open') : t('闭源', 'Closed'), 'org-tag-pill')
    );
    const modelLine = html('div', null, 'picker-model');
    const dot = html('i', null, 'creator-dot');
    dot.style.background = color(pick.row.creator?.color);
    dot.setAttribute('aria-hidden', 'true');
    const nm = html('strong', pick.row.shortName || pick.row.name);
    nm.title = pick.row.name;
    modelLine.append(dot, nm);

    const meta = html('div', `${pick.row.creator?.name || 'Other'}${pick.isFrontier ? ' · ' + t('帕累托前沿', 'Pareto') : ''}`, 'picker-meta');

    const metrics = html('div', null, 'picker-metrics');
    const mScore = html('div');
    mScore.append(html('span', t('场景得分', 'Score')), html('b', format(pick.score, 1)));
    const mCost = html('div');
    mCost.append(html('span', t(`单${unitTxt}成本`, `Cost/${unitTxt}`)), html('b', money(pick.row.cost)));
    metrics.append(mScore, mCost);

    const reason = html('p', t(pick.reason.zh, pick.reason.en), 'picker-reason');

    const acts = html('div', null, 'picker-card-acts');
    const locBtn = html('button', t('图中定位 →', 'Locate →'), 'org-mini-btn');
    locBtn.type = 'button';
    locBtn.addEventListener('click', () => applyPickerContext(rec, {targetRow: pick.row}));
    acts.append(locBtn);

    card.append(top, modelLine, meta, metrics, reason, acts);
    grid.append(card);
  }
  frag.append(grid);

  const footBar = html('div', null, 'picker-footer-bar');
  footBar.append(
    html('span', t('想进一步看雷达分项、幻觉率与多云比价？直接将这几款送进剖析对比', 'Want radar breakdowns, hallucination rates & multi-cloud pricing? Compare them side-by-side'), 'picker-footer-note')
  );
  const footActs = html('div', null, 'picker-footer-acts');
  const scatterBtn = html('button', t('看场景前沿散点', 'View Frontier'), 'org-mini-btn');
  scatterBtn.type = 'button';
  scatterBtn.addEventListener('click', () => applyPickerContext(rec, {toCompare: false}));
  const cmpBtn = html('button', t(`一键剖析对比这 ${rec.picks.length} 款 →`, `Compare all ${rec.picks.length} picks →`), 'guide-try-btn');
  cmpBtn.type = 'button';
  cmpBtn.addEventListener('click', () => applyPickerContext(rec, {toCompare: true}));
  footActs.append(scatterBtn, cmpBtn);
  footBar.append(footActs);
  frag.append(footBar);
}

function renderGuideDialog() {
  $('#guideDialogTitle').textContent = guideTab === 'picker'
    ? t('3 步帮我选模型', '3-Step Model Picker')
    : t('读懂榜单与隐藏洞察', 'Benchmark Guide & Hidden Insights');
  $('#guideDialogSub').textContent = guideTab === 'picker'
    ? t('不用看懂坐标轴与术语：按真实用途、预算与开源偏好，实时推荐 3 款代表模型', 'Skip the jargon: choose your use case, budget & license for 3 data-backed recommendations')
    : t('了解各测评机构侧重、避开常见误区，一键实操发现数据背后的规律', 'Understand what each agency tests, avoid common traps, and explore hidden data patterns in one click');
  $('#gtabPicker').textContent = t('3 步选模型', '3-Step Picker');
  $('#gtabCurrent').textContent = t('当前榜与隐藏玩法', 'Current Tab & Insights');
  $('#gtabOrgs').textContent = t('测评机构特点', 'Eval Agencies');
  $('#gtabGlossary').textContent = t('看图与指标速查', 'Chart & Metrics');
  $('#guideFootHint').textContent = t(
    '快捷键：按 ? 打开导览 · Alt+←/→ 返回/前进 · Ctrl+K 全局速查 · [ ] 巡航前沿',
    'Shortcuts: ? guide · Alt+←/→ back/forward · Ctrl+K jump · [ ] frontier'
  );
  $('#guideExtLink').textContent = t('完整图文教程与 Liss Works ↗', 'Full Guide & Liss Works ↗');

  for (const btn of document.querySelectorAll('#guideTabs [role=tab]')) {
    const sel = btn.dataset.gtab === guideTab;
    btn.setAttribute('aria-selected', String(sel));
    btn.tabIndex = sel ? 0 : -1;
  }

  const body = $('#guideBody');
  const frag = document.createDocumentFragment();

  if (guideTab === 'picker') {
    renderPickerTab(frag);
  } else if (guideTab === 'current') {
    const prof = GUIDE_TAB_META[currentGuideProfileKey()];
    const hero = html('section', null, 'guide-hero');
    const heroHead = html('div', null, 'guide-hero-head');
    heroHead.append(
      html('strong', t(prof.titleZh, prof.titleEn)),
      html('span', t(prof.badgeZh, prof.badgeEn), 'guide-hero-badge')
    );
    const trap = html('div', null, 'guide-hero-trap');
    trap.append(html('b', t('新手避坑：', 'Watch out: ')), document.createTextNode(t(prof.trapZh, prof.trapEn)));
    hero.append(heroHead, html('p', t(prof.descZh, prof.descEn)), trap);
    frag.append(hero);

    const secHead = html('div', null, 'guide-sec-head');
    secHead.append(
      html('h3', t('数据背后可以挖掘的隐藏信息', 'Hidden Insights You Can Uncover Here')),
      html('span', t('点击按钮立即在当前页面实操', 'Click any recipe to apply it live'))
    );
    frag.append(secHead);

    const list = html('div', null, 'guide-recipes');
    for (const rec of prof.recipes) {
      const row = html('div', null, 'guide-recipe-item');
      const copy = html('div', null, 'guide-recipe-copy');
      copy.append(html('strong', t(rec.titleZh, rec.titleEn)), html('span', t(rec.descZh, rec.descEn)));
      const btn = html('button', t('立即体验 →', 'Try now →'), 'guide-try-btn');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        setGuideOpen(false);
        const runner = GUIDE_RECIPE_RUNNERS[rec.id];
        if (runner) runNavAction(() => runner());
      });
      row.append(copy, btn);
      list.append(row);
    }
    frag.append(list);
  } else if (guideTab === 'orgs') {
    const secHead = html('div', null, 'guide-sec-head');
    secHead.append(
      html('h3', t('本站收录的权威测评机构与各自特点', 'Evaluation Agencies & Their Strengths / Blind Spots')),
      html('span', t('没有万能单榜，交叉对照才能看清真实实力', 'No single board tells the full story — cross-check agencies'))
    );
    frag.append(secHead);

    const list = html('div', null, 'guide-org-list');
    const agencies = [
      ...orgBoards.map(b => ({
        orgZh: b.orgZh,
        orgEn: b.orgEn,
        titleZh: b.titleZh,
        titleEn: b.titleEn,
        tagZh: b.tagZh,
        tagEn: b.tagEn,
        whatZh: b.whatZh,
        whatEn: b.whatEn,
        strengthZh: b.strengthZh,
        strengthEn: b.strengthEn,
        caveatZh: b.caveatZh,
        caveatEn: b.caveatEn,
        board: b
      })),
      {
        orgZh: 'Artificial Analysis',
        orgEn: 'Artificial Analysis',
        titleZh: '多模态三赛道双盲竞技场（图像 / 视频 / 语音）',
        titleEn: 'Multimodal Blind Arenas (Image / Video / Speech)',
        tagZh: '三赛道隔离',
        tagEn: '3 Isolated Tracks',
        whatZh: '真人双盲看图、看 5 秒短片、听播音投票，按单张 $/张、单段 $/5秒、每千字 $/千字独立计价',
        whatEn: 'Blind human voting across Image ($/img), Video ($/5s), and Speech TTS ($/1k chars) on separate tracks',
        strengthZh: '严格按计价单位与任务类型隔离，各自独立计算帕累托前沿，语音还带实测耗时与首包延迟',
        strengthEn: 'Strictly isolated per unit and modality with independent Pareto frontiers plus measured TTS latency',
        caveatZh: '反映单次生成盲测质量与公开 API 均价，不包含实际创作中的多次抽卡重绘成本',
        caveatEn: 'Captures per-generation blind quality & API cost, excluding iterative re-roll counts',
        mediaJump: true
      }
    ];
    for (const ag of agencies) {
      const row = html('div', null, 'guide-org-row');
      const top = html('div', null, 'guide-org-top');
      const title = html('div', null, 'guide-org-title');
      title.append(
        html('strong', `${t(ag.orgZh, ag.orgEn)} · ${t(ag.titleZh, ag.titleEn)}`),
        html('span', t(ag.tagZh, ag.tagEn), 'org-tag-pill')
      );
      const acts = html('div', null, 'guide-org-acts');
      if (ag.board) {
        const inspectBtn = html('button', t('看机构原榜', 'Org board'), 'org-mini-btn');
        inspectBtn.type = 'button';
        inspectBtn.addEventListener('click', () => {
          setGuideOpen(false);
          runNavAction(() => {
            orgFocus = ag.board.id;
            orgDetailSort = {boardId: ag.board.id, colKey: null, dir: 'desc'};
            chooseChart('orgs');
            selectionNotice = t(
              `已直达 ${ag.orgZh} · ${ag.titleZh} 官方原榜精析`,
              `Opened ${ag.orgEn} · ${ag.titleEn} official board`
            );
            updateSummary();
          });
        });
        const scatterBtn = html('button', t('看成本散点 ↗', 'Scatter ↗'), 'org-mini-btn');
        scatterBtn.type = 'button';
        scatterBtn.addEventListener('click', () => {
          setGuideOpen(false);
          runNavAction(() => {
            jumpToOrgScatter(ag.board);
            selectionNotice = t(
              `已以 ${ag.orgZh} 成绩作纵轴打开成本散点图`,
              `Opened cost scatter chart with ${ag.orgEn} on the Y-axis`
            );
            updateSummary();
          });
        });
        acts.append(inspectBtn, scatterBtn);
      } else if (ag.mediaJump) {
        const mediaBtn = html('button', t('去多模态赛道 →', 'Open Media Arena →'), 'org-mini-btn');
        mediaBtn.type = 'button';
        mediaBtn.addEventListener('click', () => {
          setGuideOpen(false);
          runNavAction(() => chooseChart('media'));
        });
        acts.append(mediaBtn);
      }
      top.append(title, acts);

      const facts = html('div', null, 'guide-org-facts');
      for (const [cls, kZh, kEn, vZh, vEn] of [
        ['', '测什么', 'Measures', ag.whatZh, ag.whatEn],
        ['', '核心优势', 'Strength', ag.strengthZh, ag.strengthEn],
        ['is-caveat', '局限盲区', 'Caveat', ag.caveatZh, ag.caveatEn]
      ]) {
        const f = html('div', null, `guide-org-fact${cls ? ' ' + cls : ''}`);
        f.append(html('b', t(kZh, kEn)), html('span', t(vZh, vEn)));
        facts.append(f);
      }
      row.append(top, facts);
      list.append(row);
    }
    frag.append(list);
  } else {
    const secHead = html('div', null, 'guide-sec-head');
    secHead.append(
      html('h3', t('看懂散点图与核心分析指标', 'How to Read the Chart & Core Metrics')),
      html('span', t('一分钟掌握所有分析概念', 'Every core concept in plain language'))
    );
    frag.append(secHead);

    const grid = html('div', null, 'guide-glossary-grid');
    for (const item of GUIDE_GLOSSARY) {
      const box = html('div', null, 'guide-gloss-item');
      box.append(html('strong', t(item.titleZh, item.titleEn)), html('p', t(item.descZh, item.descEn)));
      grid.append(box);
    }
    frag.append(grid);
  }

  body.replaceChildren(frag);
}

$('#navBackBtn')?.addEventListener('click', navBack);
$('#navForwardBtn')?.addEventListener('click', navForward);
$('#pickerBtn')?.addEventListener('click', () => setGuideOpen(!(guideOpen && guideTab === 'picker'), 'picker'));
$('#guideBtn')?.addEventListener('click', () => setGuideOpen(!(guideOpen && guideTab !== 'picker'), 'current'));
$('#onboardingPickerBtn')?.addEventListener('click', () => setGuideOpen(true, 'picker'));
$('#onboardingGuideBtn')?.addEventListener('click', () => setGuideOpen(true, 'current'));
$('#onboardingDismissBtn')?.addEventListener('click', () => {
  onboardingDismissed = true;
  try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
  syncOnboardingStrip();
  scheduleDraw();
});
$('#guideCloseBtn')?.addEventListener('click', () => setGuideOpen(false));
$('#guideBackdrop')?.addEventListener('pointerdown', event => {
  if (event.target === $('#guideBackdrop')) setGuideOpen(false);
});
for (const btn of document.querySelectorAll('#guideTabs [role=tab]')) {
  btn.addEventListener('click', () => {
    guideTab = btn.dataset.gtab;
    renderGuideDialog();
  });
  btn.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('#guideTabs [role=tab]')];
    const idx = Math.max(0, tabs.indexOf(btn));
    const nextIdx = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (idx + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    guideTab = tabs[nextIdx].dataset.gtab;
    renderGuideDialog();
    tabs[nextIdx].focus();
  });
}

syncResponsiveChrome();
syncStaticText();
syncPanelControls();
chooseChart(activeKey, {changeHash: false});
loadData();
