# 番组发现 AnimeDiscovery

一个纯前端的「动漫发现 / 追番记录」演示站：浏览番剧资料、按分类和关键词筛选、收藏番剧、
按集记录观看进度。**不做在线播放，不爬取、不嵌入任何未授权视频源，不含任何网盘 / 磁力 /
直链入口。** 想看正片请前往正版平台（关于页有说明）。

技术栈：HTML + CSS + 原生 JavaScript，无后端、无构建、无第三方依赖、无外链字体或图片。
所有封面都是 CSS 渐变 + 文字程序生成的占位图，离线也能完整显示。

---

## 怎么本地预览

### 在线预览（GitHub Pages）

仓库里已经放好发布流程 `.github/workflows/deploy-pages.yml`，会把本目录（`outputs/anime-discovery`）
直接发布成静态站点。部署完成后网址填在这里：
**`https://<你的用户名>.github.io/anime-discovery/`**

启用方法（首次推送后执行一次即可，两种任选）：

1. 网页端：仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**，
   然后到 **Actions** 里等 “Deploy static site to GitHub Pages” 这次运行变绿。
2. 命令行（已安装 GitHub CLI）：`gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow`

### 方式一：直接双击打开（最简单）

### 方式一：直接双击打开（最简单）

双击 `outputs/anime-discovery/index.html`，或右键选择用 Chrome / Edge / Firefox 打开。

因为浏览器不允许 `file://` 页面用 `fetch()` 读取本地 JSON，此时页面会自动使用
`assets/js/data.js` 里同内容的内置数据，功能完全一样（首页的「数据来源」会显示
「内置兜底数据」）。

### 方式二：起一个本地静态服务器（推荐，走真正的 JSON 文件）

项目里自带一个零依赖的静态服务器 `serve.js`，只需要本机已安装 Node.js，不需要联网安装任何包：

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat\outputs\anime-discovery
node serve.js
```

看到 `番组发现 本地预览已启动：http://localhost:8080/` 后，浏览器访问：<http://localhost:8080/>

换端口：`node serve.js 9000`。结束：在终端按 `Ctrl+C`。

此时首页「数据来源」会显示 `data/anime.json`，说明读取的是 JSON 文件。
（服务器只是把静态文件发出去，没有任何后端逻辑，也没有接口。）

如果你更习惯其他静态服务器（例如已安装 Python 的 `python -m http.server 8080`、或 `npx serve`），
在同一个目录里启动也一样能用，项目本身不依赖任何一种。

---

## 功能一览

| 页面 | 说明 |
| --- | --- |
| `index.html` 首页 | 推荐海报墙、分类筛选（热血 / 日常 / 奇幻 / 治愈 / 全部）、关键词搜索、排序（评分 / 年份 / 标题 / 集数）、继续观看 |
| `detail.html` 番剧详情 | 由 `?id=` 定位，展示封面、简介、分类与标签、作品信息表、集数清单（占位数据）、追番按钮、进度条、相关推荐 |
| `mylist.html` 我的追番 | 收藏列表、观看进度、继续观看、最近浏览、导出记录 JSON、清空全部数据 |
| `about.html` 关于 | 本站只做信息展示的声明、不做什么的清单、正版平台指引、版权与免责声明 |

交互细节：

- 搜索：匹配中文名、日文名、英文名、制作公司、标签、分类与简介；多个关键词用空格分隔表示「同时满足」。
- 收藏：首页封面右上角 ♥ 一键收藏/取消，详情页有「加入我的追番」按钮，导航栏徽标实时更新数量。
- 进度：详情页点任意一集即可标记「已看」（支持键盘 Tab + 空格/回车），可「全部标记已看」或「清空本作进度」。
  首次标记进度会自动把该番加入收藏。进度条会同步出现在首页、我的追番页。
- 数据存储：全部写在浏览器 localStorage，键名 `anime-tracker:v1`，只在本机浏览器里，不会上传。
  在「我的追番」页可以导出为 JSON 备份；清空浏览器数据会丢掉记录。
- 响应式：手机（含 375px 宽度）下导航、海报墙、集数列表均自适应，深色主题、动画克制并遵循
  「减少动态效果」系统设置。

---

## 数据说明

- 12 部示例番剧数据在 `data/anime.json`，字段包括：
  `id`、`title`、`titleJa`、`titleEn`、`year`、`season`、`studio`、`status`、`rating`、`duration`、
  `episodes`、`categories`、`tags`、`emoji`、`palette`（封面渐变色）、`summary`。
- 番剧名称使用公开常见的作品名做展示示例；**评分、集数、简介均为示例 / 占位内容**，请勿当作准确资料。
- 集数列表由 `assets/js/data.js` 的 `buildEpisodes()` 按集数生成「第 N 集 + 占位简介」，
  刻意不编造真实剧集标题。
- 想换数据：直接编辑 `data/anime.json`（若用 `file://` 打开，同时同步 `assets/js/data.js`
  里的 `ANIME_FALLBACK` 数组）。

---

## 本项目中创建的所有文件

所有路径都相对于 `C:\Users\User\Documents\Codex\2026-09-14\new-chat\`。

成品（`outputs/anime-discovery/`）：

| 文件 | 作用 |
| --- | --- |
| `outputs/anime-discovery/README.md` | 本说明文档 |
| `outputs/anime-discovery/index.html` | 首页：海报墙、分类筛选、搜索、排序、继续观看 |
| `outputs/anime-discovery/detail.html` | 番剧详情页（通过 `?id=xxx` 定位番剧） |
| `outputs/anime-discovery/mylist.html` | 我的追番：收藏、进度、最近浏览、导出与清空 |
| `outputs/anime-discovery/about.html` | 关于页：信息展示声明、正版平台指引、免责声明 |
| `outputs/anime-discovery/data/anime.json` | 12 部示例番剧的 JSON 数据 |
| `outputs/anime-discovery/assets/css/style.css` | 深色二次元主题、组件与响应式样式 |
| `outputs/anime-discovery/assets/js/data.js` | 数据加载（fetch JSON + 内置兜底）、占位集数生成 |
| `outputs/anime-discovery/assets/js/store.js` | localStorage 封装（收藏 / 进度 / 最近浏览 / 统计） |
| `outputs/anime-discovery/assets/js/ui.js` | 通用 UI：封面生成、海报卡、追番条目卡、导航与徽标 |
| `outputs/anime-discovery/assets/js/home.js` | 首页逻辑：筛选、搜索、排序、继续观看 |
| `outputs/anime-discovery/assets/js/detail.js` | 详情页逻辑：资料渲染、集数勾选、追番按钮 |
| `outputs/anime-discovery/assets/js/mylist.js` | 我的追番逻辑：列表渲染、导出、清空 |
| `outputs/anime-discovery/serve.js` | 零依赖本地静态服务器（本地预览用，非站点运行必需） |

过程文件（`work/`，不属于成品，可随时删除）：

| 文件 | 作用 |
| --- | --- |
| `work/plan.md` | 开工前的实现计划：目标与边界、数据结构、文件结构、步骤与验证清单 |

---

## 版权与免责声明

本项目是前端演示作品。文中出现的番剧名称、商标与标识归各自权利人所有，仅用于说明性的信息展示，
不代表与任何权利人或平台存在关联、合作或授权关系。站内封面为程序生成的占位图，未使用官方素材。
本站不提供任何视频内容与未授权资源入口；如需公开部署，请自行确认数据来源的合规性并保留本声明。
