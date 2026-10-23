# Intelligence Index vs. Cost（线性横轴）

线上地址： https://heroliss.github.io/intelligence-index-cost-linear/

这是一个部署到 GitHub Pages 的静态网页。网页读取 `data/current.json`，GitHub Actions 每 6 小时抓取 Artificial Analysis 的公开页面数据并更新这个文件，然后重新部署 Pages。

## 查看与交互

- 首次打开默认深色主题；右上角可切换浅色，浏览器会记住主动选择。禁用本地存储时仍可切换，本次访问有效。
- 供应商类别沿用原数据颜色。深色主题仅提高显示亮度，使文字在绘图区可读；散点、标签、连线和图例始终使用同一映射，筛选仍依据原始类别。
- 点击供应商图例筛选，点击散点突出模型；滚轮横向缩放，Shift + 滚轮纵向缩放，拖动平移，双击或点击 Reset view 恢复视图。
- 可调整标签字号、距离，或暂时隐藏标签。主题切换不会重置当前视图、标签设置和筛选。

## 部署

1. 将本目录中的文件放入一个 GitHub 仓库的根目录。
2. 在仓库的 **Settings → Pages** 中将发布来源设为 **GitHub Actions**。
3. 在 **Actions** 页面手动运行一次 `Update chart and deploy`，之后工作流会按北京时间每天 06:00、12:00、18:00、00:00（UTC 22:00、04:00、10:00、16:00）自动运行；GitHub Actions 的实际启动时间可能因队列延迟。

也可以在本地预览：

```bash
python -m http.server 8765
```

然后打开 `http://localhost:8765/`。这会使用仓库内已有数据；如需手动刷新，可另行执行 `node scripts/fetch_data.cjs`。

网页本身直接维护于 `index.html`，数据脚本只更新 `data/current.json`，不会重新生成或覆盖主题样式。
