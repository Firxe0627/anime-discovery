# AnimeDiscovery · 番组发现

纯前端的「动漫发现 / 追番记录」静态站：38 部作品资料库（真实封面）、本季热门区块、
分类与关键词搜索、收藏与按集进度、"在看 / 看完 / 计划看"追番状态管理。

> **本站只做信息展示。** 番剧资料与封面 URL 来自公开 API（Jikan / MyAnimeList 与 AniList），
> 封面由原站 CDN 直接提供、不下载不转存；不提供在线播放，不嵌入任何未授权视频源，
> 也不含网盘 / 磁力 / 视频直链入口。想看正片请前往正版平台。

## 在线预览

**<https://firxe0627.github.io/anime-discovery/>**

由 GitHub Pages 发布：每次推送到 `main` 会自动重新部署（工作流 `.github/workflows/deploy-pages.yml`，
发布目录 `outputs/anime-discovery`）。仓库地址：<https://github.com/Firxe0627/anime-discovery>

## 本地预览

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat\outputs\anime-discovery
node serve.js          # 零依赖服务器，无需 npm install；换端口：node serve.js 9000
```

然后访问 <http://localhost:8080/>。也可以直接双击 `outputs/anime-discovery/index.html`：
此时页面会用同内容的 `data/anime.js` 兜底（`file://` 下浏览器不允许 fetch 本地 JSON），功能一致。

断网或封面 404 时，封面会自动回退为「渐变 + 标题」的文字占位，不会出现裂图。

## 功能

| 页面 | 说明 |
| --- | --- |
| `index.html` 首页 | 本季/热门横滑区块（有数据才显示）、38 部海报墙、分类筛选、搜索、排序（分数 / 名称 / 年份 / 集数）、继续观看 |
| `detail.html` 详情 | 真封面、中文速览 + API 完整简介、标签、分数与评分人数、集数进度、追番状态、MAL / AniList 外链、相关推荐 |
| `mylist.html` 我的追番 | 收藏列表、状态筛选（全部 / 在看 / 看完 / 计划看 / 有进度）、按集进度、导出 JSON、清空 |
| `about.html` 关于 | 数据来源署名、不做什么的清单、正版平台指引、版权与免责声明 |

收藏、进度与状态保存在浏览器 localStorage（键名 `anime-tracker:v1`），不上传任何服务器。

## 数据来源与抓取脚本

数据由一次性脚本 `work/fetch-anime-data.mjs` 生成，**优先 Jikan（MyAnimeList 公开 API），
失败回退 AniList GraphQL**；请求间隔 ≥1 秒，遇 429/5xx 按 `Retry-After` 或指数退避重试（最多 4 次），
单次请求 20 秒超时。匹配不到的作品保留占位并把简介留空，不编造内容。

```powershell
node work/fetch-anime-data.mjs                   # 走 work/api-cache 缓存
node work/fetch-anime-data.mjs --no-cache        # 重新请求 API
node work/fetch-anime-data.mjs --only=trending   # 只更新「本季 / 热门」
```

本次抓取时 Jikan 在当前网络下持续 504，脚本熔断后 38 部资料全部由 AniList 回退源提供
（站内「作品信息 → 数据源」会标注），「本季 / 热门」的 18 条来自 AniList 的 `TRENDING_DESC + RELEASING`。
详细过程见 `work/fetch-report.md`。

脚本**只保存文本与图片 URL，不下载图片或视频**；API 响应缓存在 `work/api-cache/`（已被 `.gitignore` 忽略）。

## 项目结构

```
.
├── README.md                    本文件（仓库说明）
├── .gitignore                   忽略密钥、依赖、API 缓存与临时文件
├── .github/workflows/
│   └── deploy-pages.yml         把静态站发布到 GitHub Pages
├── work/
│   ├── fetch-anime-data.mjs     数据抓取脚本（Jikan → AniList）
│   ├── fetch-report.md          最近一次抓取报告
│   └── plan.md                  最初的实现计划（过程文档）
└── outputs/anime-discovery/     站点成品（HTML + CSS + 原生 JS，无构建步骤）
    ├── index.html / detail.html / mylist.html / about.html
    ├── data/anime.json + anime.js           38 部资料（+ file:// 兜底）
    ├── data/trending.json + trending.js     本季热门 18 条（+ 兜底）
    ├── assets/css/style.css
    ├── assets/js/{data,store,ui,home,detail,mylist}.js
    ├── serve.js                 零依赖本地静态服务器
    └── README.md                站点详细说明与完整文件清单
```

更详细的说明（字段表、抓取实况、文件清单、版权声明）见
[`outputs/anime-discovery/README.md`](outputs/anime-discovery/README.md)。

## 技术要点

- 纯前端：HTML + CSS + 原生 JavaScript，无后端、无构建、无第三方依赖、无框架、无外链字体。
- 封面使用 API 返回的图片 URL（`<img src>`），仓库内**没有任何图片文件**；图裂/离线自动回退文字封面。
- 响应式布局，375px 手机上导航、海报墙、横滑热门条、集数列表均正常；动画克制并遵循 `prefers-reduced-motion`。

## 更新流程

```powershell
git add -A
git commit -m "你的改动说明"
git push
```

推送后到 **Actions** 里等 “Deploy static site to GitHub Pages” 变绿即可，通常 20 秒内完成。

首次推送时若 git 报 `detected dubious ownership`（本仓库文件由自动化沙箱账号创建），执行一次：

```powershell
git config --global --add safe.directory C:/Users/User/Documents/Codex/2026-09-14/new-chat
```

## 版权与免责声明

番剧名称、商标、标识与封面图片归各自权利人所有，仅用于说明性的信息展示，不代表与任何权利人或平台
存在关联、合作或授权关系。本项目不提供任何视频内容与未授权资源入口。本站与 MyAnimeList、AniList
均无隶属或合作关系。
