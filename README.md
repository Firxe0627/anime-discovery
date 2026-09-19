# AnimeDiscovery · 番组发现

纯前端的「动漫发现 / 追番记录」静态站：**3174 部**番剧资料库（2005–2026 年，真实封面）、本季热门、
年份轴与季度表、多维筛选与可分享链接、站内详情页与官方 PV、追番四态管理与进度、
数据导入导出与分享码。线上地址：**<https://firxe0627.github.io/anime-discovery/>**

> **本站只做信息展示。** 资料来自公开 API（主资料 **AniList**，中文名与中文简介来自 **Bangumi**），
> 封面直接引用原站图片 URL，PV 使用 AniList 标注的**官方 YouTube** 嵌入。
> 不提供在线播放，不含磁力 / 网盘 / 直链入口，也不下载、不转存任何图片或视频。

## 在线预览

**<https://firxe0627.github.io/anime-discovery/>**

每次推送到 `main` 会自动重新部署（工作流 `.github/workflows/deploy-pages.yml`，
发布目录 `outputs/anime-discovery`）。仓库：<https://github.com/Firxe0627/anime-discovery>

## 本地预览

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat\outputs\anime-discovery
node serve.js          # 零依赖服务器，无需 npm install；换端口：node serve.js 9000
```

访问 <http://localhost:8080/>。也可以直接双击 `outputs/anime-discovery/index.html`
（会自动使用 `data/anime.js` 兜底，功能一致）。

## 功能

| 页面 | 说明 |
| --- | --- |
| 首页 | 本季热门快照 23 部（全站内详情，附「查看本季全部」）、3174 部海报墙（每批 48 部渲染）、搜索 + 分类 / 年份 / 季度 / 制作公司（可搜索下拉）/ 类型 / 排序 一套筛选（选项旁带当前命中数量，0 命中灰掉或隐藏）、可逐条去掉的条件标签、随机一部、继续看 |
| 详情 | 大封面、中文速览 + 中文简介 + 英文简介（默认收起）、标签、分数、制作公司、集数进度、追番状态、数据来源徽章、官方 PV（点击才加载）、同系列时间轴、相关推荐、MAL / Bangumi / AniList 外链 |
| 我的追番 | 想看 / 在看 / 看完 / 弃番 + 计数、按集进度、继续看、猜你也想看、导出 / 导入 JSON、复制分享码、清空 |
| 关于 | 数据来源与署名、PV 说明、不做什么、正版平台指引、版权免责 |

筛选条件会写进网址（`?q= &genre= &year= &season= &studio= &format= &sort=`），可直接分享；
还会记在本机 localStorage，从详情页返回不丢筛选，滚动位置也会恢复。快捷键：`/` 聚焦搜索框、`R` 在当前筛选结果里随机一部
（搜索框聚焦时按 `R` 不会触发）。搜索框输入停顿 300ms 自动筛选，也可以按「搜索」或回车。
收藏、进度、状态只保存在浏览器 localStorage（键名 `anime-tracker:v1`），无账号系统。

> **两件容易误会的事**：站点里的「某家公司 N 部」指的是**本站精选库里**收录的作品数，不是该公司的全部作品；
> 「本季热门」是抓取时留下的**快照**，需要重新跑脚本（`node work/fetch-anime-data.mjs --only=trending`）才会更新。
> 制作公司支持中文别名搜索（京都动画 / 京阿尼 / KyoAni 等），输入能唯一匹配的公司名会自动套上公司筛选。

## 数据来源与重新抓取

主资料 **AniList GraphQL**（名称、封面 URL、简介、分数、集数、年份、季节、制作公司、relations、官方 PV id）——
按年份轴逐年分页（2005–2026，每年取热度靠前的作品，只收 TV / 剧场版 / ONA），
中文名与中文简介 **Bangumi**（带 User-Agent，间隔 ≥1 秒；v0 搜索接口不可用时会自动切到同一来源的旧版搜索接口），
Jikan 作为可选回退（只在缺 MAL id 时查询，连续失败自动熔断；本次运行时持续 504，未参与数据）。

```powershell
node work/fetch-anime-data.mjs                   # 默认：2005–2026 每年 150 部，走 work/api-cache 缓存
node work/fetch-anime-data.mjs --per-year=200     # 改每年条数
node work/fetch-anime-data.mjs --years=2006-2026  # 改年份区间
node work/fetch-anime-data.mjs --no-cache         # 重新请求 API
node work/fetch-anime-data.mjs --only=trending    # 只更新热门列表
node work/fetch-anime-data.mjs --skip-bangumi     # 跳过中文补全
```

脚本间隔 ≥1.1 秒、429/403/5xx 退避重试、单次 20 秒超时、失败缓存 10 分钟；
条数低于现有库 80% 时保留旧 JSON 不覆盖；主库按 UTF-8 字节切成 < 3MB 的分片，前端取回后合并；
**只保存文本与图片 / PV 的视频 id，不下载图片或视频**；运行报告写入 `work/fetch-report.md`。

本次规模：3174 部（TV 2422 / 剧场版 521 / ONA 231，2005–2026 年，22 个年份无缺失），
其中 2546 部有中文名、2545 部有中文简介、2206 部有官方 PV；
没有中文资料时显示原名或英文简介，不做机翻。

## 项目结构

```
.
├── README.md                    本文件（仓库说明）
├── .gitignore                   忽略密钥、依赖、API 缓存、原始数据集
├── .github/workflows/
│   └── deploy-pages.yml         发布静态站到 GitHub Pages
├── work/
│   ├── fetch-anime-data.mjs     数据抓取脚本（AniList + Bangumi，可选 Jikan）
│   ├── fetch-report.md          最近一次抓取报告
│   ├── qa.md                    阶段 A–E 自测记录与已知限制
│   └── plan.md                  最初的实现计划（过程文档）
└── outputs/anime-discovery/     站点成品（HTML + CSS + 原生 JS，无构建步骤）
    ├── index.html / detail.html / mylist.html / about.html
    ├── data/anime.json（分片清单）+ anime-1..3.json   主库 3174 部（每个 < 3MB）
    ├── data/anime.js + anime-1..3.js        同内容 JS，file:// 兜底
    ├── data/trending.json + trending.js     本季热门 23 条（+ 兜底）
    ├── assets/css/style.css
    ├── assets/js/{data,store,ui,home,detail,mylist}.js
    ├── serve.js                 零依赖本地静态服务器
    └── README.md                站点详细说明与完整文件清单
```

详细说明（字段表、抓取实况、自测结果、文件清单、版权声明）见
[`outputs/anime-discovery/README.md`](outputs/anime-discovery/README.md) 与
[`work/qa.md`](work/qa.md)。

## 技术要点

- 纯前端：HTML + CSS + 原生 JavaScript，无后端、无构建、无第三方依赖、无框架。
- 封面使用 API 返回的图片 URL（`<img loading="lazy">`），仓库内**没有任何图片或视频文件**；
  图裂 / 离线自动回退文字占位封面；列表使用骨架屏，卡片分批渲染。
- PV 仅在详情页、仅有官方 trailer 时出现，点击后才插入 iframe 并默认静音；列表页无任何视频加载。
- 响应式：390px 实测无横向溢出；深色主题、动效克制并遵循 `prefers-reduced-motion`。
- **不使用任何第三方离线番剧大数据库**：主库为脚本按年份逐年抓取的 3174 条，
  用户放入 `work/datasets/` 的原始数据集已被 gitignore，不进入仓库。

## 更新流程

```powershell
git add -A
git commit -m "你的改动说明"
git push
```

推送后到 **Actions** 里等 “Deploy static site to GitHub Pages” 变绿即可（约 20 秒）。

首次推送时若 git 报 `detected dubious ownership`（本仓库文件由自动化沙箱账号创建），执行一次：

```powershell
git config --global --add safe.directory C:/Users/User/Documents/Codex/2026-09-14/new-chat
```

## 版权与免责声明

番剧名称、商标、标识、封面图片与 PV 归各自权利人所有，仅用于说明性的信息展示，不代表与任何权利人或
平台存在关联、合作或授权关系。本项目不提供任何正片内容与未授权资源入口。本站与 MyAnimeList、
AniList、Bangumi 均无隶属或合作关系。
