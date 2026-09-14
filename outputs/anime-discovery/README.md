# 番组发现 AnimeDiscovery

纯前端的「动漫发现 / 追番记录」静态站：**539 部**精选番剧资料库（真实封面）、本季热门、
年份轴与季度表、分类 / 制作公司 / 类型筛选、可分享的筛选链接、站内详情页、
详情页官方 PV、追番四态管理与进度、数据导入导出与分享码。

> **本站只做信息展示。** 资料来自公开 API（主资料 **AniList**，中文名与中文简介来自 **Bangumi**），
> 封面直接引用原站图片 URL，PV 使用 AniList 标注的**官方 YouTube** 视频嵌入。
> 不提供在线播放、不含磁力 / 网盘 / 直链入口，也不下载、不转存任何图片或视频。

技术栈：HTML + CSS + 原生 JavaScript。无后端、无构建步骤、无第三方依赖、无框架、无外链字体。

## 在线预览

**<https://firxe0627.github.io/anime-discovery/>**

GitHub Pages 发布，工作流 `.github/workflows/deploy-pages.yml` 在每次推送到 `main` 时
把本目录（`outputs/anime-discovery`）重新部署。仓库：<https://github.com/Firxe0627/anime-discovery>

## 本地预览

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat\outputs\anime-discovery
node serve.js          # 零依赖，无需 npm install；换端口：node serve.js 9000
```

访问 <http://localhost:8080/>，首页「数据来源」会显示 `data/anime.json`。

直接双击 `index.html` 也能用：`file://` 下浏览器不允许 `fetch()` 本地 JSON，
站点会自动加载同内容的 `data/anime.js` / `data/trending.js` 兜底（数据来源会显示“本地兜底”）。

封面与 PV 都是远程资源，需要联网显示；断网或封面 404 时自动回退为「渐变 + 标题」的文字占位封面。

## 功能一览

| 页面 | 说明 |
| --- | --- |
| `index.html` 首页 | 本季/热门横滑条（23 部，全部站内详情）、539 部海报墙、分类筛选、年份轴（2005–2026）、季度表、制作公司 / 类型 / 排序、随机一部、关键词搜索、继续看 |
| `detail.html` 详情 | 大封面、中文速览、中文简介 + 英文简介（默认收起）、标签、分数与收藏数、制作公司、集数进度、追番状态、数据来源徽章、官方 PV、同系列时间轴、相关推荐、MAL / Bangumi / AniList 外链 |
| `mylist.html` 我的追番 | 想看 / 在看 / 看完 / 弃番 + 计数、按集进度、继续看、猜你也想看、导出 / 导入 JSON、复制分享码、清空 |
| `about.html` 关于 | 数据来源与署名、PV 说明、不做什么的清单、正版平台指引、版权与免责声明 |

### 交互与体验

- **搜索**：中文名 / 日文原名 / 罗马字 / 英文名 / 制作公司（中英）/ 类型标签 / 简介 / 年份；多关键词用空格表示「同时满足」。
- **筛选可分享**：条件写入网址 `?q= &genre= &year= &season= &studio= &format= &sort=`，可直接复制分享；
  同时写进 localStorage，从详情页返回不丢筛选，浏览器前进 / 后退也能还原。
- **年份轴 / 季度表**：年份轴为 2005 至今的横向按钮；季度表按年份显示冬 / 春 / 夏 / 秋作品数，点击即筛选。
- **制作公司**：下拉列出作品数 ≥2 的 70 家公司，内置常见中文名映射（如「京都动画」也能搜到并筛选）。
- **随机一部**：按钮或快捷键 `R`；`/` 聚焦搜索框（输入框内按 `r` 不会误触发）。
- **PV**：只有 AniList 标注的官方 YouTube trailer 才显示；先给「播放 PV」按钮，点击后才插入 iframe 并默认静音；
  列表页与详情页初次加载都不含任何 `iframe`，也不自动播放。
- **追番**：收藏、四种状态（未手动设置时按进度推导：全看完→看完，看过若干集→在看，否则→想看）、
  按集进度条（看到第几集 / 总集数）、继续看（按最近观看时间倒序）、猜你也想看（本地加权推荐）。
- **数据管理**：导出 JSON、导入 JSON（合并、不覆盖）、复制分享码（`AD1.` 开头文本）、从分享码导入、清空（带确认）。
- **性能与可用性**：封面 `loading="lazy"`、列表骨架屏、卡片分页渲染（每批 48 部 + 自动加载）、
  深色主题、手机（390px 实测无横向溢出）、动效克制并遵循 `prefers-reduced-motion`。

## 数据来源

| 内容 | 来源 |
| --- | --- |
| 名称（原名 / 罗马字 / 英文）、封面 URL、简介、分数与收藏数、集数、年份、季节、放送状态、类型标签、制作公司 | **AniList GraphQL**（批量分页） |
| 中文名、中文简介 | **Bangumi**（`api.bgm.tv/v0/search/subjects`，带 UA，间隔 ≥1 秒） |
| 同系列关系（前作 / 续作 / 剧场版等） | AniList `relations` |
| 官方 PV | AniList `trailer`（仅当 `site == youtube`，只保存视频 id） |
| MAL 作品页链接 | AniList `idMal` → `https://myanimelist.net/anime/<id>` |
| Bangumi 作品页链接 | Bangumi subject id → `https://bgm.tv/subject/<id>` |
| Jikan（MyAnimeList 公开 API） | 脚本中保留的可选回退来源；本次运行时持续 504，未参与数据 |

**本次抓取实况**（详见 `work/fetch-report.md` 与 `work/qa.md`）：
539 部中 473 部有中文名、471 部有中文简介、520 部有官方 PV、439 部有同系列关系；
Bangumi 查询命中 476 条（命中率 88%）。没有中文资料的作品显示日文原名或英文简介，
**不做机器翻译、不编造内容**；两个数据源都匹配不到的作品会被跳过而不是硬塞。

## 重新跑数据脚本

脚本在 `work/fetch-anime-data.mjs`，用 Node 自带 `fetch`，无需安装依赖：

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat
node work/fetch-anime-data.mjs                    # 目标 520 部，走缓存（重跑数秒）
node work/fetch-anime-data.mjs --limit=450        # 改目标条数
node work/fetch-anime-data.mjs --no-cache         # 忽略缓存重新请求
node work/fetch-anime-data.mjs --only=trending    # 只更新「本季 / 热门」
node work/fetch-anime-data.mjs --skip-bangumi     # 只跑 AniList，跳过中文补全
```

脚本行为：

- 请求间隔 ≥ 1100ms；429 / 403 / 5xx 按 `Retry-After` 或指数退避（2→4→8→16 秒）重试，最多 4 次；
  单次请求 20 秒超时；失败结果缓存 10 分钟，成功结果缓存 14 天（`work/api-cache/`，已 gitignore）。
- 数据源优先级 AniList → Bangumi →（可选）Jikan；中文缺失时保留原名，不机翻。
- 筛选：仅 TV / Movie / ONA，年份 ≥2005，按罗马字标题去重；热门条目会并入主库，保证首页点得进站内详情。
- 健康检查：条数 < 300 或热门 < 10 条时判定抓取不完整，**保留旧 JSON 不覆盖**，只写报告。
- **只保存文本与图片 / PV 的视频 id，绝不下载图片或视频。**
- 产物：`data/anime.json` + `anime.js`、`data/trending.json` + `trending.js`、`work/fetch-report.md`。

要增删或修正作品，编辑脚本顶部的 `ENTRIES` / 抓取参数；若要给某些作品指定准确条目，
可在 `ENTRIES` 里加 `malId`（当前实现直接按 AniList 热度抓取，`malId` 由 API 返回）。

## 数据结构

`data/anime.json` 是数组，每条主要字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 站内唯一 slug，详情页 `detail.html?id=<id>` |
| `anilistId` / `malId` / `bgmId` | 三个站点的条目 id（外部链接在前端拼接） |
| `name` / `name_romaji` / `name_en` / `name_cn` | 原名 / 罗马字 / 英文名 / 中文名（可能为 `null`） |
| `cover` / `coverSmall` | 封面图片 URL（不下载到仓库） |
| `summary_en` / `summary_cn` / `summary_cn_short` | 英文简介 / 中文简介 / 本站编辑的中文速览（仅早期 38 部） |
| `score` / `scoredBy` | 分数（AniList 百分制 ÷ 10）/ 收藏数 |
| `genres` / `categories` | 原始类型标签 / 本站分类（热血·日常·奇幻·治愈·科幻·悬疑，用于筛选） |
| `episodes` / `duration` / `year` / `season` / `format` / `status` | 集数（可能为 `null`）/ 单集时长 / 年份 / 季节 / TV·MOVIE·ONA / 放送状态 |
| `studios` | 制作公司（前端有中文名映射） |
| `relations` | 同系列关系（`relationType` + 目标作品名 / 年份 / 格式 / AniList id） |
| `trailer` | 官方 YouTube 视频 id（没有则为 `null`） |
| `emoji` / `palette` | 文字兜底封面用的图标与渐变色 |

`data/trending.json`：`{ generatedAt, source, season, items: [{ rank, id, name, name_cn, cover, score, ... }] }`，
每项都带主库 `id`，因此首页热门卡一定进入站内详情页。

## 本项目中创建的所有文件

相对于 `C:\Users\User\Documents\Codex\2026-09-14\new-chat\`：

| 文件 | 作用 |
| --- | --- |
| `outputs/anime-discovery/README.md` | 本说明文档 |
| `outputs/anime-discovery/index.html` | 首页：热门、筛选、年份轴、季度表、海报墙 |
| `outputs/anime-discovery/detail.html` | 番剧详情页（`?id=` 定位） |
| `outputs/anime-discovery/mylist.html` | 我的追番：状态、进度、推荐、导入导出 |
| `outputs/anime-discovery/about.html` | 关于：数据来源、PV 说明、免责声明 |
| `outputs/anime-discovery/data/anime.json` | 539 部番剧元数据（权威数据，压缩输出） |
| `outputs/anime-discovery/data/anime.js` | 同内容 JS，供 `file://` 兜底 |
| `outputs/anime-discovery/data/trending.json` | 本季 / 热门 23 条 |
| `outputs/anime-discovery/data/trending.js` | 同内容 JS 兜底 |
| `outputs/anime-discovery/assets/css/style.css` | 深色主题、封面、骨架屏、时间轴、PV、响应式 |
| `outputs/anime-discovery/assets/js/data.js` | 数据加载与字段取值（含公司中文名、推荐算法） |
| `outputs/anime-discovery/assets/js/store.js` | localStorage：收藏 / 进度 / 状态 / 导出导入 / 分享码 |
| `outputs/anime-discovery/assets/js/ui.js` | 封面、海报卡、热门卡、追番卡、骨架屏 |
| `outputs/anime-discovery/assets/js/home.js` | 首页：筛选、URL 同步、分页、随机、快捷键 |
| `outputs/anime-discovery/assets/js/detail.js` | 详情：简介、PV、时间轴、进度与状态 |
| `outputs/anime-discovery/assets/js/mylist.js` | 我的追番：状态筛选、继续看、推荐、数据管理 |
| `outputs/anime-discovery/serve.js` | 零依赖本地静态服务器（预览用，非运行必需） |
| `work/fetch-anime-data.mjs` | 数据抓取脚本（AniList + Bangumi，可选 Jikan） |
| `work/fetch-report.md` | 最近一次抓取报告 |
| `work/qa.md` | 阶段 A–E 自测记录与已知限制 |
| `work/plan.md` | 最初的实现计划（过程文档） |

不提交（已 gitignore）：`work/api-cache/`（API 缓存）、`work/datasets/`（用户原始数据集）、
`node_modules/`、`.env`、`*.pem`、`*.key` 等。

## 版权与免责声明

番剧名称、商标、标识、封面图片与 PV 归各自权利人所有，本项目仅用于说明性的信息展示与学习示例，
不代表与任何权利人或平台存在关联、合作或授权关系。本站不提供任何正片内容与未授权资源入口；
若权利人认为某项展示不妥，可通过仓库 issue 联系删除。
