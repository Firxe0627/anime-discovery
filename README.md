# AnimeDiscovery · 番组发现

一个纯前端的「动漫发现 / 追番记录」静态站：浏览番剧资料、按分类和关键词筛选、收藏番剧、按集记录观看进度。

> **本站只做信息展示。** 不提供在线播放、不嵌入任何未授权视频源，也不含网盘 / 磁力 / 视频直链入口；
> 想看正片请前往正版平台。详见站内「关于」页。

## 在线预览

在线演示：**尚未部署**（初始化这台机器时未检测到 GitHub 登录状态）。
部署完成后，网址会写在这里：`https://<你的用户名>.github.io/anime-discovery/`

## 推送到 GitHub 并开启 Pages

初始化时这台机器上没有可用的 GitHub 登录（未安装 `gh` CLI、没有 SSH key、Windows 凭据管理器与
Git Credential Manager 里都没有 github.com 账号），所以仓库已在本地完成首次提交，
但**没有**创建远程仓库、也没有推送。登录后按下面任一种方式即可（都在项目根目录执行）：

**方式 A：GitHub CLI（推荐，能顺手开启 Pages）**

```powershell
winget install --id GitHub.cli      # 或到 https://cli.github.com 下载安装
gh auth login                       # 浏览器登录一次
gh repo create anime-discovery --public --source . --push
gh api -X POST repos/{owner}/{repo}/pages -f build_type=workflow
gh api repos/{owner}/{repo}/pages/builds/latest --jq .status   # 应为 built
```

**方式 B：网页建仓 + git 命令**

```powershell
# 先在 github.com 新建一个空的公开仓库（不要勾选 README / .gitignore / License）
git remote add origin https://github.com/<你的用户名>/anime-discovery.git
git push -u origin main
# 再打开仓库 Settings → Pages → Build and deployment → Source，选择 GitHub Actions
```

推送后工作流 `.github/workflows/deploy-pages.yml` 会把 `outputs/anime-discovery` 发布成静态站，
默认网址形如 `https://<你的用户名>.github.io/anime-discovery/`，把它填回上面「在线预览」一节即可。

提交身份目前是占位值，推送前建议改成你自己的：

```powershell
git config user.name "你的名字"
git config user.email "你的邮箱"
git commit --amend --reset-author --no-edit
```

### 如果 git 报 “detected dubious ownership”

本仓库的文件由自动化沙箱账号创建，你以本机账号运行 git 时可能出现该提示，执行一次即可：

```powershell
git config --global --add safe.directory C:/Users/User/Documents/Codex/2026-09-14/new-chat
```

## 本地预览

```powershell
cd C:\Users\User\Documents\Codex\2026-09-14\new-chat\outputs\anime-discovery
node serve.js
```

然后访问 <http://localhost:8080/>。也可以直接双击 `outputs/anime-discovery/index.html`，
此时页面会自动使用内置兜底数据（`file://` 下浏览器不允许 fetch 本地 JSON）。

## 项目结构

```
.
├── README.md                    本文件（仓库说明）
├── .gitignore                   忽略密钥、依赖与临时文件
├── .github/workflows/
│   └── deploy-pages.yml         把静态站发布到 GitHub Pages
├── work/
│   └── plan.md                  开工前的实现计划（过程文档）
└── outputs/anime-discovery/     站点成品（HTML + CSS + 原生 JS，无构建步骤）
    ├── index.html               首页：海报墙 / 分类 / 搜索 / 排序
    ├── detail.html              番剧详情：简介 / 标签 / 集数清单 / 追番进度
    ├── mylist.html              我的追番：收藏 / 进度 / 导出 / 清空
    ├── about.html               关于：信息展示声明 + 正版平台指引
    ├── data/anime.json          12 部示例番剧数据
    ├── assets/css/style.css     深色主题与响应式样式
    ├── assets/js/               数据、本地存储与页面逻辑
    ├── serve.js                 零依赖本地静态服务器
    └── README.md                站点详细说明与完整文件清单
```

更详细的说明（功能清单、数据结构、localStorage 说明、全部文件清单）见
[`outputs/anime-discovery/README.md`](outputs/anime-discovery/README.md)。

## 技术要点

- 纯前端：HTML + CSS + 原生 JavaScript，无后端、无构建、无第三方依赖、无外链图片。
- 封面为 CSS 渐变 + 文字程序生成的占位图，离线可完整显示。
- 收藏与进度写入浏览器 localStorage（键名 `anime-tracker:v1`），不上传任何服务器。
- 响应式布局，手机可正常浏览；动画克制并遵循 `prefers-reduced-motion`。

## 版权与免责声明

文中出现的番剧名称、商标与标识归各自权利人所有，仅用于说明性的信息展示，不代表与任何权利人或平台
存在关联、合作或授权关系。站内封面为程序生成的占位图，未使用官方素材。本项目不提供任何视频内容与
未授权资源入口。
