# Intelligence Index vs. Cost（线性横轴）

线上地址： https://heroliss.github.io/intelligence-index-cost-linear/

这是一个部署到 GitHub Pages 的静态网页。网页读取 `data/current.json`，GitHub Actions 每 6 小时抓取 Artificial Analysis 的公开页面数据并更新这个文件，然后重新部署 Pages。

## 部署

1. 将本目录中的文件放入一个 GitHub 仓库的根目录。
2. 在仓库的 **Settings → Pages** 中将发布来源设为 **GitHub Actions**。
3. 在 **Actions** 页面手动运行一次 `Update chart and deploy`，之后工作流会按北京时间每天 06:00、12:00、18:00、00:00（UTC 22:00、04:00、10:00、16:00）自动运行；GitHub Actions 的实际启动时间可能因队列延迟。

也可以在本地预览：

```bash
node scripts/fetch_data.cjs
python -m http.server 8765
```

然后打开 `http://localhost:8765/`。
