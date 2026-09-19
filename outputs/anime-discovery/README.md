# 番组发现 AnimeDiscovery

纯前端的「动漫发现 / 追番记录」静态站：**3174 部**番剧资料库（2005–2026 年，真实封面）、本季热门、
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
| `index.html` 首页 | 本季热门快照（23 部，全部站内详情，附「查看本季全部」）、3174 部海报墙（每批 48 部渲染）、搜索 + 分类 / 年份 / 季度 / 制作公司（可搜索下拉）/ 类型 / 排序 一套筛选（每个选项旁显示当前命中数量，0 命中灰掉或隐藏）、可逐条去掉的条件标签、随机一部、继续看 |
| `detail.html` 详情 | 大封面、中文速览、中文简介 + 英文简介（默认收起）、标签、分数与收藏数、制作公司、集数进度、追番状态、数据来源徽章、官方 PV、同系列时间轴、相关推荐、MAL / Bangumi / AniList 外链 |
| `mylist.html` 我的追番 | 想看 / 在看 / 看完 / 弃番 + 计数、按集进度、继续看、猜你也想看、导出 / 导入 JSON、复制分享码、清空 |
| `about.html` 关于 | 数据来源与署名、PV 说明、不做什么的清单、正版平台指引、版权与免责声明 |

### 交互与体验

- **一套筛选**：搜索框和分类 / 年份 / 季度 / 制作公司 / 类型 / 排序在同一条筛选栏里；分类是带命中数量的 chip，
  年份与季度是下拉（列表里同样带数量），制作公司是可输入搜索的下拉，类型与排序是普通下拉。
- **搜索**：中文名 / 日文原名 / 罗马字 / 英文名 / 制作公司（中英）/ 类型标签 / 简介 / 年份；多关键词用空格表示「同时满足」。
  输入停顿 300ms 自动筛选，也可以按「搜索」或回车立刻筛选，`✕` 与 `Esc` 清空。
- **命中数量**：每个分类 / 年份 / 季度 / 公司选项旁都显示「在当前其它条件不变时」的命中部数，
  0 部会被灰掉（分类 chip）或从下拉里隐藏，避免点出一片空白。
- **公司名唯一匹配就自动套用**：搜索框里输入能唯一对上的公司名（如 `京阿尼`、`京都动画`、`Kyoto Animation`、`MAPPA`、`Bones`、`WIT Studio`…），
  会自动套上「制作公司」筛选并提示；匹配到多家时只提示，不改筛选条件。
- **筛选可分享**：条件写入网址 `?q= &genre= &year= &season= &studio= &format= &sort=`，可直接复制分享；
  同时写进 localStorage，从详情页返回不丢筛选与滚动位置，浏览器前进 / 后退也能还原。
- **条件标签**：结果区顶部显示「共 N 部」，下面每颗标签（搜索词 / 分类 / 年份 / 季度 / 公司 / 类型 / 排序）都能单独去掉，
  旁边有「清除全部」；手机端筛选收进「筛选」按钮，这一行标签就是已选条件摘要。
- **无结果**：列表区显示「没有符合的作品」+ 当前条件摘要 + 「清除筛选」按钮，不会只剩一片空白。
- **分批渲染**：每批 48 部，接近列表底部自动加载；还有剩余时按钮显示「显示更多（还剩 X 部）」，一批能装下就不显示按钮。
- **随机一部**：在当前筛选结果里随机，快捷键 `R`；当前结果为 0 部时只提示「先清除筛选再随机」，不会跳到看不见的条目。
  快捷键 `/` 聚焦搜索框；搜索框（或下拉）聚焦时按 `r` 不会触发随机。
- **本季热门**：卡片全部进站内详情；标题下的小字说明这是**上一次抓取的快照**，
  **不会随新一季自动更换**，有生成时间就显示（本地时间），没有就沿用数据里的季节文案；
  「查看本季全部」会套上该季节的年份 + 季度筛选并滚到列表，该季在库里没有作品时不显示这个按钮。
- **PV**：只有 AniList 标注的官方 YouTube trailer 才显示；先给「播放 PV」按钮，点击后才插入 iframe 并默认静音；
  列表页与详情页初次加载都不含任何 `iframe`，也不自动播放。
- **追番**：收藏、四种状态（未手动设置时按进度推导：全看完→看完，看过若干集→在看，否则→想看）、
  按集进度条（看到第几集 / 总集数）、继续看（按最近观看时间倒序）、猜你也想看（本地加权推荐）。
- **数据管理**：导出 JSON、导入 JSON（合并、不覆盖）、复制分享码（`AD1.` 开头文本）、从分享码导入、清空（带确认）。
- **性能与可用性**：封面 `loading="lazy"`、列表骨架屏、卡片分页渲染（每批 48 部 + 接近底部自动加载）、
  筛选重绘时保留列表高度并用极轻的透明度过渡（不整页闪白）、深色主题、
  手机（390px 实测无横向溢出）、动效克制并遵循 `prefers-reduced-motion`。

### 两个容易误解的地方

- **某家公司能搜到几部，取决于本站库，不是该社的全部作品。**
  资料库是脚本按年份逐年挑选的 3174 部（每年取热度靠前的作品），所以「京都动画 N 部」的意思是
  「本站库里收录了 N 部京都动画的作品」，不代表京都动画只做过 N 部。换一家公司同理。
- **「本季热门」是抓取时的快照，需要重新跑脚本才会更新。**
  它是 `data/trending.json` 里的固定列表（脚本运行时按 AniList 当时的热度取一次），
  不会随着新一季自动更换；想更新就重新执行下面「重新跑数据脚本」里的命令（`--only=trending` 只更新热门）。

## 数据来源

| 内容 | 来源 |
| --- | --- |
| 名称（原名 / 罗马字 / 英文）、封面 URL、简介、分数与收藏数、集数、年份、季节、放送状态、类型标签、制作公司 | **AniList GraphQL**（批量分页） |
| 中文名、中文简介 | **Bangumi**（`api.bgm.tv/v0/search/subjects`，带 UA，间隔 ≥1 秒） |
| 同系列关系（前作 / 续作 / 剧场版等） | AniList `relations` |
| 官方 PV | AniList `trailer`（仅当 `site == youtube`，只保存视频 id） |
| MAL 作品页链接 | AniList `idMal` → `https://myanimelist.net/anime/<id>` |
| Bangumi 作品页链接 | Bangumi subject id → `https://bgm.tv/subject/<id>` |
| Jikan（MyAnimeList 公开 API） | 仅在缺少 MAL id 时兜底查询的可选回退来源；连续失败会自动熔断，本次运行时持续 504，未参与数据 |

**本次抓取实况**（详见 `work/fetch-report.md` 与 `work/qa.md`）：
3174 部（2005–2026 年，TV 2422 / 剧场版 521 / 网络动画 231）中，2546 部有中文名、
2545 部有中文简介、2206 部有官方 PV、2143 部有同系列关系；命中 Bangumi 共 2578 条。
没有中文资料的作品显示日文原名或英文简介，**不做机器翻译、不编造内容**。
抓取当天 Bangumi 的 v0 搜索接口整体返回 500，脚本自动切到同一来源的旧版搜索接口
（命中 1382 次）+ 条目详情接口（1250 次）取中文简介，报告里如实记录。

## 重新跑数据脚本

脚本在 `work/fetch-anime-data.mjs`，用 Node 自带 `fetch`，无需安装依赖：

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat
node work/fetch-anime-data.mjs                    # 默认：2005–2026 每年 150 部，走缓存
node work/fetch-anime-data.mjs --per-year=200     # 改每年条数
node work/fetch-anime-data.mjs --years=2006-2026  # 只跑指定年份区间
node work/fetch-anime-data.mjs --limit=450        # 限制总条数
node work/fetch-anime-data.mjs --no-cache         # 忽略缓存重新请求
node work/fetch-anime-data.mjs --only=trending    # 只更新「本季 / 热门」
node work/fetch-anime-data.mjs --skip-bangumi     # 只跑 AniList，跳过中文补全
```

脚本行为：

- 主源 **AniList**：按年份轴逐年分页（`startDate_greater/lesser` + `sort: POPULARITY_DESC`，
  `format_in: [TV, MOVIE, ONA]`，`isAdult: false`），2005–2026 年每年取前 N 部，保证每一年都有覆盖。
- 中文名 / 中文简介走 **Bangumi**：优先 v0 搜索接口，接口整体不可用时自动切到旧版搜索接口
  （`/search/subject`）+ 条目详情接口；连续失败先冷却 60 秒，冷却两轮仍不可用就熔断，不长时间空等。
- 请求间隔 ≥ 1100ms；429 / 403 / 5xx 按 `Retry-After` 或指数退避（2→4→8→16 秒）重试；
  单次请求 20 秒超时；失败结果缓存 10 分钟（期间不再重复打同一个 key），成功结果缓存 14 天（`work/api-cache/`，已 gitignore）。
- 可选回退 **Jikan**：只在某条资料缺少 MAL id 时查询，连续失败自动熔断。
- 筛选：仅 TV / Movie / ONA，年份 2005–2026，按罗马字标题去重；时长 ≤6 分钟的短片 / CM / PV 不收（不要短篇广告）；
  热门条目会并入主库，保证首页点得进站内详情；旧库里这次没重新拉到的条目会保留，资料库只增不减。
- 健康检查：条数低于现有库的 80%（且不少于 300）或热门 < 10 条时判定抓取不完整，**保留旧 JSON 不覆盖**，只写报告。
- 写入：按 UTF-8 字节切分，单个文件 < 3MB；单文件时 `data/anime.json` 就是数组，拆文件时它是分片清单。
- **只保存文本与图片 / PV 的视频 id，绝不下载图片或视频。**
- 产物：`data/anime.json`（+ `anime-1.json`… 分片）+ `anime.js`（+ `anime-1.js`…）、
  `data/trending.json` + `trending.js`、`work/fetch-report.md`。

脚本可以反复重跑：命中的中文会沿用，AniList / Bangumi 的结果都带缓存，重跑通常只要几分钟。

## 数据结构

主库文件格式：单文件时 `data/anime.json` 是数组；拆文件时它是清单
（`{ generatedAt, count, source, parts: [{ file, script, count, bytes }] }`），真正的数据在
`data/anime-1.json`、`anime-2.json`… 里，前端取回后按顺序合并成一个数组。每条主要字段：

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
| `outputs/anime-discovery/index.html` | 首页：热门快照、搜索 + 筛选栏、条件标签、海报墙 |
| `outputs/anime-discovery/detail.html` | 番剧详情页（`?id=` 定位） |
| `outputs/anime-discovery/mylist.html` | 我的追番：状态、进度、推荐、导入导出 |
| `outputs/anime-discovery/about.html` | 关于：数据来源、PV 说明、免责声明 |
| `outputs/anime-discovery/data/anime.json` | 主库清单（单文件运行时这里直接是数组） |
| `outputs/anime-discovery/data/anime-1.json` ~ `anime-3.json` | 主库分片，每个 < 3MB，前端取回后合并 |
| `outputs/anime-discovery/data/anime.js` + `anime-1.js` ~ `anime-3.js` | 同内容 JS，供 `file://` 兜底 |
| `outputs/anime-discovery/data/trending.json` | 本季 / 热门 23 条 |
| `outputs/anime-discovery/data/trending.js` | 同内容 JS 兜底 |
| `outputs/anime-discovery/assets/css/style.css` | 深色主题、封面、骨架屏、时间轴、PV、响应式 |
| `outputs/anime-discovery/assets/js/data.js` | 数据加载与字段取值（含公司中文名 / 别名匹配、筛选状态与网址参数、推荐算法） |
| `outputs/anime-discovery/assets/js/store.js` | localStorage：收藏 / 进度 / 状态 / 导出导入 / 分享码 |
| `outputs/anime-discovery/assets/js/ui.js` | 封面、海报卡、热门卡、追番卡、骨架屏 |
| `outputs/anime-discovery/assets/js/home.js` | 首页：搜索 + 筛选一套、命中数量、条件标签、URL 同步、分批渲染与自动加载、随机、快捷键 |
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
