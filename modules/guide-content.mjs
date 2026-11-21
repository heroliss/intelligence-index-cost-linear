export const GUIDE_PROFILE_ORDER = [
  'models',
  'frontier',
  'human-arena',
  'coding-agents',
  'cyber',
  'media:image',
  'media:video',
  'media:tts',
  'orgs'
];

export const GUIDE_TAB_META = {
  models: {
    shortZh: '综合智能',
    shortEn: 'Intelligence',
    badgeZh: '综合基线 · 覆盖最全',
    badgeEn: 'Baseline · Widest Coverage',
    titleZh: '综合智能（Artificial Analysis v5）',
    titleEn: 'Intelligence Index (Artificial Analysis v5)',
    descZh: '将代码、科学推理、百万长上下文、全科闭卷等 10 项标准化任务合成为 0–100 总分，并同口径记录真实跑完一套任务的美元 API 花费与平均耗时，是新手对比“花多少钱买多少智商”的第一入口。',
    descEn: 'Combines 10 standardized tasks (coding, reasoning, long context, closed-book knowledge) into a 0–100 score paired with real USD API cost and wall time — the best starting point for value comparisons.',
    trapZh: '单榜总分高不等于实测体感好，也可能伴随高盲区幻觉率或高单次成本（常规月卡多不含）；点选任意圆点可在锁定卡查看风险提示，或去「机构分榜 → 争议分歧榜」核验硬考与盲测口碑差。',
    trapEn: 'High overall scores don’t guarantee great real-world feel and can mask high blind-spot hallucination or API-only burn. Click any dot to inspect caveat badges or check the Org Divergence board.',
    recipes: [
      {
        id: 'models-effort',
        titleZh: '揭秘推理“加档”边际收益',
        titleEn: 'Expose Reasoning-Effort Diminishing Returns',
        descZh: '开启「推理轨迹」连线同一模型家族的 Low → Medium → High → Xhigh 思考档位，一眼识别哪些模型加档后成本暴涨 5 倍但分数几乎不动。',
        descEn: 'Turn on Effort Paths to connect Low → Medium → High → Xhigh variants of the same family and spot where extra thinking cost stops paying off.'
      },
      {
        id: 'models-history',
        titleZh: '回看过去一年 AI 降本幅度',
        titleEn: 'Replay 1-Year AI Cost Deflation',
        descZh: '打开「历史演进」时间轴并定位到半年前，实线为历史前沿、虚线为今日前沿，直接看到同等智能水平便宜了多少倍。',
        descEn: 'Open Historical Evolution to compare the Pareto frontier 6 months ago (solid) against today (dashed) and measure exact price deflation.'
      },
      {
        id: 'models-livebench',
        titleZh: '防污染照妖镜：切换 LiveBench 2.0 纵轴',
        titleEn: 'Contamination Check: Switch Y to LiveBench 2.0',
        descZh: '把纵轴换成按月出新题的 LiveBench 2.0，对比各模型在“从未见过的客观难题”上的真实排名与单价。',
        descEn: 'Switch the Y-axis to monthly contamination-free LiveBench 2.0 scores to expose models inflated on stale public test sets.'
      },
      {
        id: 'models-fullstack',
        titleZh: '按你的真实业务重算前沿（全栈研发 + 等值切线）',
        titleEn: 'Re-rank for Your Workflow (Full-Stack + Iso-Value)',
        descZh: '启用「全栈研发」场景配方并勾出「等值切线」，把通用总分重算为你工作流专属的性价比榜首。',
        descEn: 'Apply the Full-Stack Dev scenario weights with the Iso-Value contour to find the true best-value winner for engineering.'
      }
    ]
  },
  frontier: {
    shortZh: '前沿极限',
    shortEn: 'Frontier Hard',
    badgeZh: '去水份硬考 · 专测旗舰分差',
    badgeEn: 'Unsaturated Hard Suites',
    titleZh: '前沿极限（剔除已饱和旧题）',
    titleEn: 'Frontier Hard (Strips Saturated Legacy Suites)',
    descZh: '很多常见基准在顶级模型上已经考到 90%+ 失去区分度。本榜只保留 GDP-PDF 全过、FrontierCode 2.0、Terminal 4.0、CritPt、Automation 与 HLE 六大未饱和难题，专门拉开旗舰硬实力差距。',
    descEn: 'Legacy tests hit 90%+ ceilings on top models. This tab keeps only 6 unsaturated hard suites (GDP-PDF, FrontierCode 2.0, Terminal 4.0, CritPt, Automation, HLE) to reveal true SOTA separation.',
    trapZh: '难题本身高度依赖深度思考 Token，成本跨度极大；别忘了结合「抗刷榜跃升」标签找出低价却在难题逆袭的黑马。',
    trapEn: 'Hard suites burn heavy reasoning tokens; watch the rank-riser filter to catch lower-priced models that jump ahead when easy questions are removed.',
    recipes: [
      {
        id: 'frontier-risers',
        titleZh: '揪出“抗刷榜硬核逆袭”黑马',
        titleEn: 'Find Hard-Eval Rank Risers',
        descZh: '筛选「抗刷榜硬核跃升 (排名↑)」，只看剔除旧题后名次显著上涨的硬核实力派，避开“简单题刷分王”。',
        descEn: 'Filter to models whose rank climbs once saturated easy suites are removed — avoiding inflated benchmark specialists.'
      },
      {
        id: 'frontier-mlcr',
        titleZh: '百万长上下文压力测试 (MLCR)',
        titleEn: 'Million-Token Long-Context Stress Test (MLCR)',
        descZh: '把纵轴切为 MLCR 超长上下文，许多短文本高分模型在百万字多文档检索里会断崖下跌。',
        descEn: 'Switch Y-axis to MLCR long-context retrieval — many strong short-context models drop sharply at massive document scales.'
      },
      {
        id: 'frontier-law',
        titleZh: '垂类实战：顶尖律所 Harvey BigLaw',
        titleEn: 'Vertical Domain: Harvey BigLaw Legal Eval',
        descZh: '切到 Harvey 顶尖律所实测纵轴，观察专业合同审查与法律推理场景下谁最值得付费。',
        descEn: 'Switch Y-axis to Harvey BigLaw legal evaluation to compare cost vs. rigor in high-stakes legal work.'
      },
      {
        id: 'frontier-open',
        titleZh: '开源权重离闭源前沿有多近？',
        titleEn: 'How Close Are Open-Weights to Frontier?',
        descZh: '切换「仅开源」并打开「等值切线」，直接找出可私有化部署的最强硬核开源模型。',
        descEn: 'Filter to Open-Weights with the Iso-Value contour to identify the strongest self-hostable hard-eval models.'
      }
    ]
  },
  'human-arena': {
    shortZh: '人类审美',
    shortEn: 'Human Arena',
    badgeZh: '真人盲测 · 体感与审美',
    badgeEn: 'Blind Human Taste & Vibe',
    titleZh: '人类与审美（体感 · 视觉 · 办公交付）',
    titleEn: 'Human & Aesthetic Arena (Chat · Design · Deliverables)',
    descZh: '客观题高分常常伴随“AI 味太重、满屏套话、页面很土”。本榜融合 Arena.ai 去水份盲投人味、Design Arena 五维审美与 GDPval 44 职业专家交付，专门衡量“真实人类用起来爽不爽”。',
    descEn: 'High test scores often come with robotic prose and generic UIs. This tab blends Arena.ai style-controlled chat, Design Arena 5D aesthetics, and GDPval 44-job expert deliverables.',
    trapZh: '人类盲测偏重第一眼观感与流畅度：部分模型靠后训练模板在单轮视觉或闲聊榜冲高，但综合智能偏低或 AI 套话率极高（50%+），日常复杂开发容易露馅——务必交叉核验「综合智能」与「WebDev 交互前端」。',
    trapEn: 'Blind crowd votes reward first-impression polish: some style-tuned models score high on single-shot aesthetics or chat while lagging in core reasoning or carrying heavy AI-slop (50%+) — always cross-check Core Intelligence & WebDev.',
    recipes: [
      {
        id: 'human-antislop',
        titleZh: '拒绝“AI 味套话”：去 AI 套话自然度排行',
        titleEn: 'Cut Robotic Prose: Anti-Slop Naturalness',
        descZh: '将纵轴切为「去 AI 套话自然度」，快速避开满口“当然！这是一个很好的问题”的模板腔模型。',
        descEn: 'Switch Y-axis to Anti-Slop Naturalness to avoid models heavy on clichés and boilerplate framing.'
      },
      {
        id: 'human-design',
        titleZh: '前端/页面不土气：Design Arena 五维审美',
        titleEn: 'UI & Web Aesthetics: Design Arena 5D',
        descZh: '切到「视觉审美五维总分」并筛选高视觉审美门槛 (Website Elo ≥ 1300)，直奔审美第一梯队。',
        descEn: 'Switch Y-axis to Design Arena 5D aesthetics and filter to Website Elo ≥ 1300 for top visual craft.'
      },
      {
        id: 'human-gdpval',
        titleZh: '买来当数字员工：44 职业真实交付盲评',
        titleEn: 'Real Work Products: 44-Job Expert Deliverables',
        descZh: '纵轴切为「专家办公交付 (GDPval)」，看金融、法律、医疗、工程资深专家盲选出的真实交付冠军。',
        descEn: 'Switch Y-axis to GDPval expert deliverables to see which models produce usable work artifacts across 44 professions.'
      },
      {
        id: 'human-compare',
        titleZh: '微距对比：同时剖析人味、审美与交付短板',
        titleEn: 'Side-by-Side Anatomy of Vibe, Taste & Rigor',
        descZh: '一键切到「剖析对比」并自动选出 4 款代表模型，用雷达图与微距跑道看清谁是偏科生。',
        descEn: 'Jump to Compare view with 4 representative models to inspect radar & zoomed-strip trade-offs.'
      }
    ]
  },
  'coding-agents': {
    shortZh: '编程智能体',
    shortEn: 'Coding Agents',
    badgeZh: '模型 + 框架端到端实测',
    badgeEn: 'End-to-End Model + Harness',
    titleZh: '编程智能体（Model + Agent Harness）',
    titleEn: 'Coding Agents (Model + Harness End-to-End)',
    descZh: '现实写代码不只是模型裸考，更是“模型 + Agent 框架（Claude Code、Codex 等）”在真实终端改代码、跑测试、修 Bug 的协同表现。',
    descEn: 'Real engineering combines a model with an agent harness (Claude Code, Codex, etc.) editing repos, running shells, and iterating until tests pass.',
    trapZh: '相同模型套不同框架，成绩和花费能差出几倍；且“均值成本”可能掩盖 P95 死循环烧钱风险，务必点「剖析对比」看成本分位数。',
    trapEn: 'The same model in different harnesses can differ dramatically in score and spend; check Compare view for P50 vs P95 tail-cost blowups.',
    recipes: [
      {
        id: 'coding-tail',
        titleZh: '拆解 P50 vs P95 成本长尾与缓存命中率',
        titleEn: 'Inspect P50 vs P95 Tail Costs & Cache Hit Rate',
        descZh: '打开「剖析对比」，看清各编程智能体单次任务的中位花费 vs 95% 极端长尾花费、平均步数与 Prompt 缓存命中率。',
        descEn: 'Open Compare view to inspect median vs. P95 tail cost, average step count, and prompt cache hit rate.'
      },
      {
        id: 'coding-sub',
        titleZh: '月卡订阅回本线 + 80/20 混合路由省钱算账',
        titleEn: 'Subscription Break-Even + 80/20 Hybrid Routing',
        descZh: '切到「订阅回本」并展开「混合路由模拟」，实测每月写多少任务买 $20/$100/$200 订阅划算，或混用轻量+旗舰能省多少。',
        descEn: 'Open Sub vs API with Hybrid Routing enabled to see when $20/$100/$200 plans pay off — or how an 80/20 split cuts bills.'
      },
      {
        id: 'coding-time',
        titleZh: '横轴切换「实测耗时」：谁强还不用苦等？',
        titleEn: 'Switch X-Axis to Wall Time: Fast & Strong',
        descZh: '将横轴从成本切为平均耗时，有些高分 Agent 平均一个任务要跑 15 分钟以上，切耗时轴立现原形。',
        descEn: 'Switch X-axis to measured wall time to separate snappy coding agents from slow 15+ minute runs.'
      }
    ]
  },
  cyber: {
    shortZh: '网络安全',
    shortEn: 'Cyber',
    badgeZh: '攻防实测 + 拒答率透明',
    badgeEn: 'Security Evals + Refusal Rate',
    titleZh: '网络安全（攻防实力与安全护栏）',
    titleEn: 'Cyber Index (Capability & Safeguard Refusals)',
    descZh: '评估模型在漏洞挖掘、红蓝攻防与安全代码审计任务上的实测能力，同时透明公开每个模型的安全护栏拒答比例。',
    descEn: 'Measures vulnerability analysis, offensive/defensive cyber tasks, and secure auditing alongside each model’s safeguard refusal rate.',
    trapZh: '安全场景最怕“一问漏洞就拒答”导致白花钱。筛选拒答率前先明确你的合规授权场景，别只盯着总分。',
    trapEn: 'Over-eager refusals can break authorized pentesting or code auditing workflows — always check refusal rate alongside score.',
    recipes: [
      {
        id: 'cyber-zero',
        titleZh: '筛选「零安全拒答 (0%)」：适合合规审计/红蓝演练',
        titleEn: 'Filter to Zero Refusal (0%) for Authorized Audits',
        descZh: '只看在合法安全评测里零拒答的模型，避免正常代码漏洞分析被安全护栏误杀。',
        descEn: 'Show models with 0% refusal rate on authorized security evaluations so legitimate auditing isn’t blocked.'
      },
      {
        id: 'cyber-guarded',
        titleZh: '对比「含安全拦截 (>0%)」模型的分价影响',
        titleEn: 'Inspect Models with Active Safeguards (>0% Refusal)',
        descZh: '查看启用主动安全拦截机制的模型分布，评估强护栏与攻防实用性之间的权衡。',
        descEn: 'Inspect models with active refusal safeguards to see how guardrails trade off against benchmark score.'
      },
      {
        id: 'cyber-value',
        titleZh: '按性价比排安全初筛主力榜',
        titleEn: 'Sort Security Models by Value per Dollar',
        descZh: '切到「数据表」并按性价比降序，快速挑出适合 CI 自动化安全扫描的低成本高分模型。',
        descEn: 'Open Table view sorted by Value/USD to pick economical models for continuous security scanning.'
      }
    ]
  },
  'media:image': {
    shortZh: '图像',
    shortEn: 'Image',
    badgeZh: '独立赛道 · 仅比图像 $/张',
    badgeEn: 'Isolated Track · Image $/img',
    titleZh: '多模态生成 · 图像赛道（文生图 / 修图）',
    titleEn: 'Media Arena · Image Track (T2I & Editing)',
    descZh: '基于 AA Image Arena 真人双盲投票 Elo 校准分，横轴严格统一为单张出图 API 均价（$/张），绝不与视频或语音混排。',
    descEn: 'Blind human Elo calibrated to 0–100 from AA Image Arena, plotted strictly on linear USD per image ($/img) — isolated from video and speech.',
    trapZh: '有的引擎只擅长从零画图 (T2I) 却不会改图 (Edit)；而且顶级旗舰单张价格可达甜点区 10 倍以上，批量出图建议优先看帕累托前沿。',
    trapEn: 'Some models only excel at T2I and lack editing support, and flagship per-image cost can exceed sweet-spot models by 10×.',
    recipes: [
      {
        id: 'img-both',
        titleZh: '找出「文生图 + 指令修图」全能引擎',
        titleEn: 'Find Dual T2I + Image Editing Engines',
        descZh: '筛选同时覆盖文生图和指令修图双赛道盲测的图像引擎，一套 API 搞定生成与局部改图。',
        descEn: 'Filter to engines blind-tested on BOTH Text-to-Image and Image Editing for unified creative pipelines.'
      },
      {
        id: 'img-frontier',
        titleZh: '聚焦图像帕累托前沿 + 等值切线',
        titleEn: 'Isolate Image Pareto Frontier + Iso-Value',
        descZh: '只看当前无可替代的图像前沿引擎并画出等性价比切线，一眼看清 $0.01–$0.04 甜点区与 $0.20+ 旗舰差价。',
        descEn: 'Show only Pareto-optimal image models with the Iso-Value contour to compare $0.01–$0.04 sweet spots vs. $0.20+ flagships.'
      },
      {
        id: 'img-sub',
        titleZh: '创意包月 vs 单张 API 回本测算',
        titleEn: 'Creative Plan vs. Per-Image API Break-Even',
        descZh: '切到「订阅回本」，按你每月的实际出图张数算出买包月会员还是走按量 API 更省钱。',
        descEn: 'Open Sub vs API to calculate how many monthly images you need before a flat creative subscription pays off.'
      }
    ]
  },
  'media:video': {
    shortZh: '视频',
    shortEn: 'Video',
    badgeZh: '独立赛道 · 仅比视频 $/5秒',
    badgeEn: 'Isolated Track · Video $/5s',
    titleZh: '多模态生成 · 视频赛道（文生 / 图生 / 编辑）',
    titleEn: 'Media Arena · Video Track (T2V / I2V / Edit)',
    descZh: '基于 AA Video Arena 真人盲评校准分，横轴统一按每 5 秒短片 API 均价（$/5秒）线性比较，覆盖文生视频、图生视频与视频编辑。',
    descEn: 'Blind human video ratings (0–100) plotted strictly on linear USD per 5-second clip ($/5s), covering T2V, I2V, and Video Editing.',
    trapZh: '真实影视/广告工作流大多先出精修首帧再做「图生视频 (I2V)」，而 I2V 与文生视频 (T2V) 的榜首常常不是同一款引擎。',
    trapEn: 'Production workflows usually keyframe first and run Image-to-Video (I2V) — whose leader often differs from Text-to-Video (T2V).',
    recipes: [
      {
        id: 'vid-i2v',
        titleZh: '切换「图生视频 (I2V)」纵轴找主力',
        titleEn: 'Switch Y-Axis to Image-to-Video (I2V)',
        descZh: '按图生视频专项盲测分重新排布前沿，找到最适合“先画分镜、再动起来”的高性价比视频引擎。',
        descEn: 'Re-rank the video frontier specifically by Image-to-Video blind quality for storyboard-to-motion workflows.'
      },
      {
        id: 'vid-edit',
        titleZh: '只看支持「视频编辑 (Edit)」的引擎',
        titleEn: 'Isolate Video Editing (Edit) Engines',
        descZh: '将纵轴切为视频编辑盲测分，专门比较能够对现有镜头做指令级修改/重绘的视频模型。',
        descEn: 'Switch Y-axis to Video Editing Arena to compare engines that modify existing footage by prompt.'
      },
      {
        id: 'vid-sub',
        titleZh: '按每月 5 秒镜头数算月卡回本',
        titleEn: 'Monthly Video Plan vs. Per-Clip API',
        descZh: '打开「订阅回本」，按每月生成多少条 5 秒短片快速比较月卡订阅与按量 API 账单。',
        descEn: 'Open Sub vs API to compare flat video subscriptions against per-5s-clip API pricing.'
      }
    ]
  },
  'media:tts': {
    shortZh: '语音',
    shortEn: 'Speech',
    badgeZh: '独立赛道 · 仅比语音 $/千字',
    badgeEn: 'Isolated Track · TTS $/1k chars',
    titleZh: '多模态生成 · 语音合成 TTS 赛道',
    titleEn: 'Media Arena · Speech TTS Track',
    descZh: '基于 AA Speech Arena 真人盲听自然度校准分，横轴按每千字符（约 1 分钟播音）API 均价线性排布，且独有实测生成耗时与首包延迟 (TTFA)。',
    descEn: 'Blind human speech naturalness (0–100) plotted on USD per 1k chars (~1 min audio), with measured wall time and time-to-first-audio (TTFA).',
    trapZh: '做有声书看“每千字单价 + 自然度”，但做实时语音对话必须看「首包延迟 TTFA」——开口慢 1 秒体验就会卡顿。',
    trapEn: 'Audiobooks care about $/1k chars, but live voice agents need low TTFA latency — waiting >1s to start speaking breaks conversation flow.',
    recipes: [
      {
        id: 'tts-fast',
        titleZh: '实时语音对话：筛选低首包延迟 (TTFA ≤ 250ms)',
        titleEn: 'Live Voice Agents: Low Latency (TTFA ≤ 250ms)',
        descZh: '只看首包响应 ≤ 250 毫秒的极速语音引擎，保证实时语音助手开口不卡顿。',
        descEn: 'Filter to speech engines with time-to-first-audio ≤ 250ms for responsive conversational voice agents.'
      },
      {
        id: 'tts-time',
        titleZh: '横轴切为「实测耗时」：自然度 vs 生成速度',
        titleEn: 'Switch X-Axis to Latency: Quality vs. Speed',
        descZh: '语音赛道独有实测耗时轴！把横轴切为耗时，直观看清哪些高自然度引擎生成整段播音也飞快。',
        descEn: 'TTS includes measured generation latency — switch X-axis to Time to find fast, natural voices.'
      },
      {
        id: 'tts-value',
        titleZh: '大批量配音性价比排行表',
        titleEn: 'Bulk Narration Value Table',
        descZh: '切到「数据表」按性价比排序，快速找出每千字几厘钱却接近顶级人声自然度的配音引擎。',
        descEn: 'Sort TTS engines by Value/USD in Table view to spot ultra-low-cost voices near the top of blind ratings.'
      }
    ]
  },
  orgs: {
    shortZh: '机构分榜',
    shortEn: 'Org Boards',
    badgeZh: '6 份权威原榜 · 绝不混算改序',
    badgeEn: '6 Official Un-Blended Boards',
    titleZh: '机构分榜（跨机构交叉验证）',
    titleEn: 'Organization Leaderboards (Cross-Agency Verification)',
    descZh: '任何单一榜单都有盲区。这里严格保留 Artificial Analysis、LiveBench 2.0、Arena.ai 聊天/WebDev、Design Arena 与 GDPval 6 份官方原始排名，帮你一眼拆穿“单榜刷分王”，找出全维度稳健模型。',
    descEn: 'Every benchmark has blind spots. This view preserves 6 official leaderboards untouched so you can spot specialists vs. true all-rounders at a glance.',
    trapZh: '如果某模型在自动化榜排前 3，但在真人聊天或防污染榜掉出前 15，说明它存在明显偏科或旧题库红利——用「争议分歧榜」与「跨机构轨迹图」最直观。',
    trapEn: 'If a model ranks top-3 on automated tests but drops past #15 on live or human boards, it’s either specialized or overfit — inspect Divergence or the Bump Chart.',
    recipes: [
      {
        id: 'orgs-divergence',
        titleZh: '打开「争议分歧榜」揪出跑分与体感割裂模型',
        titleEn: 'Open Divergence Board: Hard Evals vs. Human Taste',
        descZh: '同批模型去容量偏差百分位对照：一眼识别“跑分一般但真人爱用”的低调好模型，以及“硬考顶尖但聊起来机械”的偏科生。',
        descEn: 'Size-normalized cohort comparison surfacing human-loved sleepers and hard-exam specialists in one glance.'
      },
      {
        id: 'orgs-bump',
        titleZh: '打开「跨机构轨迹图 (Bump Chart)」看排名波动',
        titleEn: 'Open Cross-Org Rank Trajectory (Bump Chart)',
        descZh: '折线越平缓靠上说明各机构共识越强；折线大起大落说明在不同评测口径下表现割裂。',
        descEn: 'Flat high lines show cross-agency consensus; steep zigzags expose sharp specialization or benchmark bias.'
      },
      {
        id: 'orgs-livebench',
        titleZh: '单榜精析：LiveBench 2.0 防污染七维热力表',
        titleEn: 'Deep Dive: LiveBench 2.0 7-Suite Heatmap',
        descZh: '直接展开 LiveBench 2.0 精析视图，按长程智能体、真实编程、视觉设计等无污染子项自由排序。',
        descEn: 'Inspect the full LiveBench 2.0 table with sortable heat-tinted sub-suites (Agentic, Coding, Design, Data).'
      },
      {
        id: 'orgs-pin-top',
        titleZh: '一键锁定榜首模型，同步对齐全部 6 榜位置',
        titleEn: 'Pin Top Model to Auto-Align All 6 Lists',
        descZh: '在 6 机构并排视图中自动锁定当前综合榜首（琥珀金），其余 5 张榜单立刻自动滚动对齐它的排名。',
        descEn: 'Lock the #1 overall model in Amber to auto-scroll and highlight its exact standing across all 6 org cards.'
      }
    ]
  }
};

export const GUIDE_GLOSSARY = [
  {
    titleZh: '为什么要坚持「线性美元横轴」？',
    titleEn: 'Why a Strictly Linear USD X-Axis?',
    descZh: '对数坐标会把 $0.5 和 $5 压缩成同样宽的一格，让人产生“贵 10 倍也没贵多少”的错觉。线性坐标严格按真实美元比例拉开距离，让你一眼看穿多花 10 倍钱到底多买到几分能力。',
    descEn: 'Log axes compress $0.50 and $5.00 into equal visual steps, disguising 10× price jumps. A linear axis shows true economic distance so diminishing returns are unmistakable.'
  },
  {
    titleZh: '帕累托前沿（虚折线）',
    titleEn: 'Pareto Frontier (Dashed Envelope)',
    descZh: '串联起“在同等价位下无人能敌”的最高分模型。如果你想比前沿上的模型更强，就必须花更多钱；想比它便宜，就只能接受更低分。虚线右下方的点通常已有更优平替。',
    descEn: 'Connects models unbeatable at their price: to score higher you must pay more; to pay less you must give up score. Points below and right of the line are dominated.'
  },
  {
    titleZh: '优于中位参考区（左上绿区）',
    titleEn: 'Above-Median Sweet Spot (Green Zone)',
    descZh: '同时满足「得分高于全榜中位数」且「单任务成本（或耗时）低于全榜中位数」。对大多数新手而言，日常主力模型优先从这片左上绿区里挑，最不容易踩高价低能的坑。',
    descEn: 'Marks models simultaneously above median score AND below median cost/time. For most newcomers choosing a daily driver, starting inside this upper-left zone avoids bad value traps.'
  },
  {
    titleZh: '智能权重 α 与等值切线',
    titleEn: 'Intelligence Weight α & Iso-Value Curve',
    descZh: '不同场景对“省钱 vs 能力”的看重不同：α = 0–1 偏极致省钱，α = 3 为均衡主力，α ≥ 8 偏不计成本追顶尖。开启「等值切线」后，散点图会画出与当前 α 榜首等价的曲线。',
    descEn: 'Controls how aggressively value rankings favor capability over price: α = 0–1 favors cheapest, α = 3 balances both, α ≥ 8 favors top scores. Iso-Value plots equal-value contours on the scatter chart.'
  },
  {
    titleZh: '同系列推理档位轨迹',
    titleEn: 'Reasoning Effort Trajectories',
    descZh: '同一代模型常提供 Low / Medium / High / Xhigh 思考力度。开启「推理轨迹」连线后，可以直观看到“多思考一会儿”究竟换来陡峭提分，还是徒增数倍账单的水平拖尾。',
    descEn: 'Modern models ship multiple thinking levels (Low → Xhigh). Effort Paths link siblings so you can see whether turning reasoning up yields steep gains or flat cost burn.'
  },
  {
    titleZh: '订阅回本线与 80/20 混合路由',
    titleEn: 'Subscription Break-Even & 80/20 Hybrid Routing',
    descZh: '把官方 API 单任务均价乘以每月任务量，直接对比 $20 / $100 / $200 月卡。再配合「80% 低价主力 + 20% 顶级旗舰」混合路由模拟，往往花不到 1/3 的钱就能拿回 95% 旗舰体验。',
    descEn: 'Multiplies per-task API cost by monthly volume to check if $20/$100/$200 subscriptions save money — and models an 80% fast / 20% flagship split that cuts bills dramatically.'
  },
  {
    titleZh: '盲区幻觉率与自定义场景配方',
    titleEn: 'Hallucination Rate & Custom Scenarios',
    descZh: '答对率高不代表不会一本正经胡说：悬停或在「剖析对比」里可看各模型的盲区幻觉率。点工具栏「场景配方」，还能按全栈研发、设计审美或严谨办公权重重算专属榜单。',
    descEn: 'Accuracy alone doesn’t capture fabrication risk — check hallucination rates on hover or in Compare. Use Scenarios to re-weight the chart for dev, design, or rigorous research.'
  }
];
