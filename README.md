# 智能水平与任务成本（线性横轴）

线上地址：[Intelligence vs. Cost](https://heroliss.github.io/intelligence-index-cost-linear/)。

GitHub Pages 静态网页，用线性美元成本坐标比较 Artificial Analysis 的两套基准：模型智能指数与每任务成本、编程智能体指数与每任务成本。顶部两个页签共用一个占满剩余窗口空间的绘图区，页面不需要纵向滚动；中文为主，英文作为辅助说明。

## 查看与交互

- 首次访问默认深色；右上角可切换浅色，浏览器记住主动选择。禁用本地存储时仍可切换，本次访问有效。
- 两个页签各自保留当前访问中的缩放、平移、筛选及标签设置。切换基准或主题不会清空另一张图的状态。
- 横轴始终为线性尺度。默认视图聚焦较低成本区域；点击“显示全部”查看全部数据，点击“重置视图”恢复默认范围。纵轴范围根据数据计算，避免高分模型超出原有 60 分上界。
- 滚轮缩放横轴，Shift＋滚轮缩放纵轴；也可使用 X/Y 按钮。拖动平移，双击重置。绘图区获得键盘焦点后，方向键平移，加减键缩放，Home 重置。
- 点击厂商图例筛选，输入名称查找；“仅看前沿”显示当前筛选结果中的帕累托最优项。同等成本只保留更高分，同等分数只保留更低成本。
- 悬浮或选中散点查看名称、指数和每任务成本；“图表选项”提供标签显示、字号与距离调整，“数据表”提供对应数值的表格视图。
- 厂商沿用来源数据的类别颜色。深色主题会提高显示亮度；散点、标签、连线与图例使用同一映射，筛选依据厂商身份。

两套指数的任务与口径不同，应分别在各自图中比较。编程智能体成本是基准任务的平均 API 费用，不代表产品订阅价格，也不能直接推算个人订阅额度。

## 数据与更新

数据保存在 `data/current.json`，浏览器读取本地静态快照，不因每位访客访问而请求官网。数据来源：

- [Artificial Analysis 模型首页](https://artificialanalysis.ai/)
- [Coding Agents 排行榜](https://artificialanalysis.ai/agents/coding-agents)
- [Coding Agents 基准方法](https://artificialanalysis.ai/methodology/coding-agents-benchmarking)

快照使用 `schemaVersion: 2`。`models` 保留模型数据契约，`codingAgents` 表示智能体与模型配置组合；模型名称相同但推理档位、智能体或路由配置不同的条目仍分别保留。编程智能体源分数从 0–1 转为 0–100 后写入 `codingAgentIndex`，并使用相同值的 `intelligenceIndex` 供共用渲染器读取。缺少可比较分数或成本的条目不会作为零成本绘制，排除数量记录于 `codingAgentExcludedCount`。指数版本由 `modelIndexVersion` 与 `codingAgentIndexVersion` 记录，页面展示快照所带版本。

GitHub Actions 计划**每两小时检查一次**：UTC+8 每个偶数小时的 **:17**（00:17、02:17……22:17），对应 cron `17 */2 * * *`，错开整点的繁忙队列。

- 两份数据均抓取并校验成功后，使用临时文件替换快照；任何一份失败都会保留之前的完整快照。
- 数据与元信息未变化时，不改写快照、不产生数据提交；定时运行也不重新部署 Pages。手动运行或代码发布仍可部署。
- `updatedAt` 是当前快照最后发生变化并成功写入的时间，**不是最近一次检查时间，也不是官网发布数据的时间**。最近一次检查及其结果请查看 Actions 运行摘要。
- 请求有超时、响应大小上限与有限重试；遇到 401/403 不重试，429 按 `Retry-After` 进行有限等待，不持续发送请求。
- 官网页面、数据字段、基准版本或打包结构变化都可能使更新失败，需要适配抓取器；页面仍可显示最后成功快照。

每天 12 次集中检查在请求量上较轻，但不保证每次都获得新数据或准点完成。[GitHub 调度说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)指出运行可能延迟或被丢弃，公共仓库长时间无活动也可能停用定时任务。公开仓库使用标准 GitHub 托管 runner 的执行费用政策见 [GitHub Actions 计费说明](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。

**数据使用限制：**官网公开可访问不代表已获得自动采集和再发布授权。[Artificial Analysis 使用条款](https://artificialanalysis.ai/terms-of-use)第 3.3(b) 包含自动请求与抓取限制；较低请求频率不能代替授权。持续运营应取得相应许可，或核实[官方 Data API](https://artificialanalysis.ai/data-api/docs)是否覆盖所需字段及使用方式。此说明记录来源限制，不对具体使用作法律结论。

## 本地运行与验证

无需前端构建或安装运行依赖。进入本目录，用 Python 提供静态文件：

```sh
python -m http.server 8765
```

打开 [本地预览](http://localhost:8765/)，使用仓库内已有数据。不要直接以 `file://` 打开，因为页面使用 ES modules 与 fetch。

使用 Node.js 24 可手动刷新并运行回归检查：

```sh
node scripts/fetch_data.cjs
node --test scripts/*.test.*
```

测试覆盖数据格式兼容、智能体配置解析、暂时故障重试、快照不变与失败保留，以及动态指数上界、线性成本范围、缩放边界、同价帕累托前沿、小数刻度和真实快照覆盖。

`index.html` 维护页面结构，`styles.css` 维护主题与布局，`app.js` 维护交互与渲染，`chart-math.mjs` 提供共用坐标计算。抓取器只更新 `data/current.json`，不会覆盖页面或样式。

## GitHub Pages 部署

1. 将本目录作为仓库根目录，在 **Settings → Pages** 中选择 **GitHub Actions** 发布来源。
2. 在 **Actions** 手动运行 `Update chart and deploy`，或推送工作流所监听的代码变更到 `main`。
3. 后续由上述两小时计划检查数据。失败详情、最新检查时间及部署结果均可在同一工作流中查看。
