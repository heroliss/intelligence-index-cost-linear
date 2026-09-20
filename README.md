# Intelligence Index vs. Cost（线性横轴）

这是一个可部署到 GitHub Pages 的静态网页。网页读取 `data/current.json`，GitHub Actions 每天抓取 Artificial Analysis 的公开页面数据并更新这个文件，然后重新部署 Pages。

## 部署

1. 将本目录中的文件放入一个 GitHub 仓库的根目录。
2. 在仓库的 **Settings → Pages** 中将发布来源设为 **GitHub Actions**。
3. 在 **Actions** 页面手动运行一次 `Update chart and deploy`，之后工作流会每天按 UTC 02:17（北京时间 10:17）自动运行。

也可以在本地预览：

```bash
node scripts/fetch_data.cjs
python -m http.server 8765
```

然后打开 `http://localhost:8765/`。
