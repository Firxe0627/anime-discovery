# 番组发现 AnimeDiscovery

纯前端的「动漫发现 / 追番记录」静态站：38 部作品的资料库（真实封面）、本季热门区块、
分类与关键词搜索、收藏与按集进度、"在看 / 看完 / 计划看"三种追番状态。

> **本站只做信息展示。** 资料与封面 URL 来自公开 API（Jikan / MyAnimeList 与 AniList）；
> 不提供在线播放，不嵌入任何未授权视频源，不含网盘 / 磁力 / 视频直链入口；
> 也不下载、不转存任何封面图片，图片始终由原站 CDN 直接提供，版权归权利人所有。

技术栈：HTML + CSS + 原生 JavaScript。无后端、无构建步骤、无第三方依赖、无框架、无外链字体。

## 在线预览

**<https://firxe0627.github.io/anime-discovery/>**

由 GitHub Pages 发布，工作流 `.github/workflows/deploy-pages.yml` 会在每次推送到 `main` 时
把本目录（`outputs/anime-discovery`）重新部署。仓库：<https://github.com/Firxe0627/anime-discovery>

## 本地预览

### 方式一：自带的零依赖静态服务器（推荐）

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat\outputs\anime-discovery
node serve.js          # 换端口：node serve.js 9000
```

看到 `番组发现 本地预览已启动：http://localhost:8080/` 后访问 <http://localhost:8080/>。
此时首页「数据来源」显示 `data/anime.json`。

### 方式二：直接双击 `index.html`

浏览器不允许 `file://` 页面用 `fetch()` 读取本地 JSON，所以站点会自动加载同内容的
`data/anime.js` / `data/trending.js` 兜底（首页「数据来源」会显示为“本地兜底”）。
功能完全一致，封面依然走远程 URL，联网即可显示。

### 封面与离线表现

封面用 `<img src="远程 URL">` 直接引用，仓库里没有任何图片文件。断网或图片 404 时，
封面会自动回退成「渐变底色 + 表情 + 标题」的文字占位封面，不会出现裂图或空白。

## 功能一览

| 页面 | 说明 |
| --- | --- |
| `index.html` 首页 | 本季/热门区块（有数据才显示）、38 部海报墙、分类筛选（热血/日常/奇幻/治愈/科幻/悬疑）、关键词搜索、排序（分数 / 名称 / 年份 / 集数）、继续观看 |
| `detail.html` 详情 | 真封面、中文速览 + API 完整简介（可展开）、标签、分数与评分人数、集数进度、追番状态、MyAnimeList / AniList 外链、相关推荐 |
| `mylist.html` 我的追番 | 收藏列表、状态筛选（全部 / 在看 / 看完 / 计划看 / 有进度）、按集进度、导出 JSON、清空数据 |
| `about.html` 关于 | 数据来源与署名、不做什么的清单、正版平台指引、版权与免责声明 |

交互细节：

- 搜索：匹配中文名、罗马字、日文名、英文名、制作公司、类型标签与简介；多个关键词用空格表示「同时满足」。
- 收藏：首页封面右上角 ♥ 一键收藏/取消；详情页有「加入我的追番」；导航徽标实时更新。
- 进度：详情页点任意一集即标记已看（支持 Tab + 空格/回车），可「全部标记已看」或「清空本作进度」；
  首次标记进度会自动加入收藏。集数为空的连载作品（例如 ONE PIECE）按 24 集占位并在页面上说明。
- 状态：想要「在看 / 看完 / 计划看」三态管理，可在详情页或我的追番条目上直接切换；
  没手动设置时按进度推导（全看完 → 看完，看过若干集 → 在看，否则 → 计划看）。
- 数据存储：全部写在浏览器 localStorage（键名 `anime-tracker:v1`），不上传；可导出为 JSON 备份。
- 响应式：手机（375px）下导航、海报墙、横滑热门条、集数列表均自适应；深色主题、动画克制，
  并遵循系统的「减少动态效果」设置。

## 数据来源

| 项 | 来源 |
| --- | --- |
| 番剧资料（名称、简介、分数、集数、年份、季节、放送状态、类型标签、制作公司） | **Jikan**（`https://api.jikan.moe/v4`，MyAnimeList 公开 API）；失败时回退 **AniList**（`https://graphql.anilist.co`） |
| 封面图片 URL | 同上，实际文件托管在 `cdn.myanimelist.net` / `s4.anilist.co` |
| MAL 作品页链接 | 由 `mal_id` 拼出 `https://myanimelist.net/anime/<id>` |
| 本季 / 热门列表 | Jikan `seasons/now` → Jikan `top/anime?filter=airing` → AniList `TRENDING_DESC + RELEASING` |
| 中文标题 | 本站整理（API 不提供中文名） |
| 中文速览 | 仅最早收录的 12 部有，页面标注「本站编辑整理的概述，非官方简介」；其余条目只显示 API 原文 |

**本次抓取实况（记录在 `work/fetch-report.md`）**：抓取时 Jikan 在当前网络下持续返回 504，
脚本在连续失败 2 次后熔断，因此 38 部资料全部来自 AniList 回退源（站内「作品信息 → 数据源」会标注）；
「本季/热门」的 Jikan 两个接口同样不可用，最终用 AniList 的 `TRENDING_DESC + RELEASING` 拿到 18 条。
两条链路都失败时脚本会写入空列表，首页自动隐藏该区块并在报告中说明——本次没有出现这种情况。

如果某个作品两个数据源都匹配不到，脚本会保留占位条目、把简介留空（页面显示「数据源暂未返回简介」），
**不会编造简介或分数**。本次 38 部全部匹配成功，占位 0 条。

## 重新跑抓取脚本

脚本在 `work/fetch-anime-data.mjs`，用 Node 自带 `fetch`，不需要 `npm install`：

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat
node work/fetch-anime-data.mjs              # 默认使用 work/api-cache 缓存（7 天）
node work/fetch-anime-data.mjs --no-cache   # 忽略缓存，重新请求 API
node work/fetch-anime-data.mjs --only=trending   # 只更新「本季/热门」
node work/fetch-anime-data.mjs --only=anime      # 只更新番剧资料
```

脚本行为：

- 请求间隔 ≥ 1100ms；遇 `429` 会按 `Retry-After`（或指数退避 2s→4s→8s→16s）重试，最多 4 次；
  单次请求 20 秒超时；`5xx` 同样重试。
- 数据源优先级 Jikan → AniList；Jikan 连续失败 2 次即熔断，本次运行之后直接走 AniList（避免逐条空等）。
- 成功结果缓存到 `work/api-cache/`（已被 `.gitignore` 忽略），失败结果缓存 10 分钟，方便反复调试时快速重跑。
- **只保存文本与图片 URL，绝不下载图片或视频文件。**
- 运行结束输出 `work/fetch-report.md`（逐条匹配结果、汇总、占位清单）。

要增删作品，编辑脚本顶部的 `ENTRIES` 数组（`id` / `titleZh` / `query` / `expect` / `malId` /
`categories` / `emoji`），然后重跑脚本即可。`expect` 是校验正则，用来确认 API 返回的确实是想要的那部作品。

## 数据结构

`data/anime.json` 是数组，每条主要字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 站内唯一标识，详情页 `detail.html?id=<id>` |
| `titleZh` / `title` / `titleJa` / `titleEn` | 中文名 / 罗马字 / 日文名 / 英文名 |
| `cover` / `coverSmall` | 封面图片 URL（大图 / 小图），不下载到仓库 |
| `synopsis` | API 返回的完整简介（原文，未改写） |
| `summaryZh` | 仅前 12 部有的中文速览（可空） |
| `score` / `scoredBy` | 分数 / 评分人数 |
| `episodes` / `duration` | 集数（可能为 `null`）/ 单集时长 |
| `year` / `season` / `status` | 年份 / 季节（winter/spring/summer/fall）/ 放送状态 |
| `genres` / `themes` / `studios` | 类型 / 主题 / 制作公司 |
| `categories` | 本站分类（热血/日常/奇幻/治愈/科幻/悬疑），用于首页筛选 |
| `malId` / `malUrl` / `anilistId` / `anilistUrl` | 外部作品页链接 |
| `source` | `jikan` / `anilist` / `placeholder` |
| `emoji` / `palette` | 文字兜底封面用的图标与渐变色 |

`data/trending.json` 结构：`{ generatedAt, source, season, items: [{ rank, malId, title, cover, score, episodes, year, categories, malUrl, ... }] }`。
每个 `.json` 都有一份同内容的 `.js`（`window.__ANIME_DATA__` / `window.__TRENDING_DATA__`）供 `file://` 兜底。

## 本项目中创建的所有文件

相对于 `C:\Users\User\Documents\Codex\2026-09-14\new-chat\`：

| 文件 | 作用 |
| --- | --- |
| `outputs/anime-discovery/README.md` | 本说明文档 |
| `outputs/anime-discovery/index.html` | 首页：本季热门、海报墙、分类 / 搜索 / 排序 |
| `outputs/anime-discovery/detail.html` | 番剧详情页（`?id=` 定位） |
| `outputs/anime-discovery/mylist.html` | 我的追番：收藏、状态筛选、导出与清空 |
| `outputs/anime-discovery/about.html` | 关于：数据来源署名、正版平台指引、免责声明 |
| `outputs/anime-discovery/data/anime.json` | 38 部番剧元数据（权威数据） |
| `outputs/anime-discovery/data/anime.js` | 同内容 JS，供 `file://` 兜底 |
| `outputs/anime-discovery/data/trending.json` | 本季 / 热门列表（18 条） |
| `outputs/anime-discovery/data/trending.js` | 同内容 JS 兜底 |
| `outputs/anime-discovery/assets/css/style.css` | 深色主题、封面（真图 + 文字兜底）、响应式样式 |
| `outputs/anime-discovery/assets/js/data.js` | 数据加载（JSON → JS 兜底）与字段取值器 |
| `outputs/anime-discovery/assets/js/store.js` | localStorage：收藏 / 进度 / 状态 / 最近浏览 |
| `outputs/anime-discovery/assets/js/ui.js` | 封面、海报卡、追番条目卡、热门卡、导航徽标 |
| `outputs/anime-discovery/assets/js/home.js` | 首页逻辑 |
| `outputs/anime-discovery/assets/js/detail.js` | 详情页逻辑 |
| `outputs/anime-discovery/assets/js/mylist.js` | 我的追番逻辑 |
| `outputs/anime-discovery/serve.js` | 零依赖本地静态服务器（预览用，非运行必需） |
| `work/fetch-anime-data.mjs` | 数据抓取脚本（Jikan → AniList），一次性运行 |
| `work/fetch-report.md` | 最近一次抓取的报告 |
| `work/plan.md` | 最初的实现计划（过程文档） |

被 `.gitignore` 排除、不会提交的：`work/api-cache/`（API 响应缓存）、`node_modules/`、`.env` 等密钥文件。

## 版权与免责声明

番剧名称、商标、标识与封面图片归各自权利人所有，本项目仅用于说明性的信息展示与学习示例，
不代表与任何权利人或平台存在关联、合作或授权关系。本站不提供任何视频内容与未授权资源入口；
若权利人认为某项展示不妥，可通过仓库 issue 联系删除。
