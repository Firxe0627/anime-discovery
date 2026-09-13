# 番剧数据抓取报告

- 运行时间：2026-09-13T19:35:59.442Z
- 缓存：启用 work/api-cache
- 请求间隔下限：1100ms，单次超时 20000ms，429/5xx 最多重试 4 次
- 数据源优先级：Jikan（MAL）→ AniList；Jikan 连续失败 2 次后熔断

== 逐条抓取番剧元数据 ==
• 进击的巨人 (aot)  query="Shingeki no Kyojin"
  ! HTTP 504，等待 2s 后重试（第 1 次）
  ! HTTP 504，等待 4s 后重试（第 2 次）
  ! HTTP 504，等待 8s 后重试（第 3 次）
  ! HTTP 504，等待 16s 后重试（第 4 次）
  × 重试 4 次仍失败：https://api.jikan.moe/v4/anime/16498?sfw
  ! HTTP 504，等待 2s 后重试（第 1 次）
  ! HTTP 504，等待 4s 后重试（第 2 次）
  ! HTTP 504，等待 8s 后重试（第 3 次）
  ! HTTP 504，等待 16s 后重试（第 4 次）
  × 重试 4 次仍失败：https://api.jikan.moe/v4/anime?q=Shingeki%20no%20Kyojin&limit=3&sfw
  ⚠ Jikan 连续失败，判定当前网络不可达：后续条目直接使用 AniList 回退源
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-16498
  ✓ [anilist] Shingeki no Kyojin · 分数 8.5 · 25 集 · 2013
• 鬼灭之刃 (demon-slayer)  query="Kimetsu no Yaiba"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-38000
  ✓ [anilist] Kimetsu no Yaiba · 分数 8.3 · 26 集 · 2019
• 咒术回战 (jujutsu-kaisen)  query="Jujutsu Kaisen"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-40748
  ✓ [anilist] Jujutsu Kaisen · 分数 8.4 · 24 集 · 2020
• 排球少年!! (haikyuu)  query="Haikyuu!!"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-20583
  ✓ [anilist] Haikyuu!! · 分数 8.4 · 25 集 · 2014
• 我的英雄学院 (boku-no-hero)  query="Boku no Hero Academia"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-31964
  ✓ [anilist] Boku no Hero Academia · 分数 7.7 · 13 集 · 2016
• 一拳超人 (one-punch-man)  query="One Punch Man"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-30276
  ✓ [anilist] One Punch Man · 分数 8.3 · 12 集 · 2015
• 全职猎人（2011） (hunter-x-hunter)  query="Hunter x Hunter (2011)"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-11061
  ✓ [anilist] HUNTER×HUNTER (2011) · 分数 8.9 · 148 集 · 2011
• 钢之炼金术师 FA (fmab)  query="Fullmetal Alchemist: Brotherhood"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-5114
  ✓ [anilist] Hagane no Renkinjutsushi: FULLMETAL ALCHEMIST · 分数 9 · 64 集 · 2009
• 天元突破 红莲螺岩 (gurren-lagann)  query="Tengen Toppa Gurren Lagann"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-2001
  ✓ [anilist] Tengen Toppa Gurren Lagann · 分数 8.5 · 27 集 · 2007
• 火影忍者 (naruto)  query="Naruto"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-20
  ✓ [anilist] NARUTO · 分数 8 · 220 集 · 2002
• 海贼王 (one-piece)  query="One Piece"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-21
  ✓ [anilist] ONE PIECE · 分数 8.7 · — 集 · 1999
• 孤独摇滚! (bocchi)  query="Bocchi the Rock!"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-47917
  ✓ [anilist] Bocchi the Rock! · 分数 8.7 · 12 集 · 2022
• 摇曳露营△ (yuru-camp)  query="Yuru Camp"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-34798
  ✓ [anilist] Yuru Camp△ · 分数 8.1 · 12 集 · 2018
• 间谍过家家 (spy-family)  query="Spy x Family"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-50265
  ✓ [anilist] SPY×FAMILY · 分数 8.3 · 12 集 · 2022
• 冰菓 (hyouka)  query="Hyouka"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-12189
  ✓ [anilist] Hyouka · 分数 7.9 · 22 集 · 2012
• 轻音少女 (k-on)  query="K-On!"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-5680
  ✓ [anilist] K-ON! · 分数 7.8 · 13 集 · 2009
• 日常 (nichijou)  query="Nichijou"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-10165
  ✓ [anilist] Nichijou · 分数 8.3 · 26 集 · 2011
• 月刊少女野崎君 (nozaki-kun)  query="Gekkan Shoujo Nozaki-kun"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-23289
  ✓ [anilist] Gekkan Shoujo Nozaki-kun · 分数 7.7 · 12 集 · 2014
• 辉夜大小姐想让我告白 (kaguya-sama)  query="Kaguya-sama wa Kokurasetai"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-37999
  ✓ [anilist] Kaguya-sama wa Kokurasetai: Tensaitachi no Renai Zunousen · 分数 8.3 · 12 集 · 2019
• 男子高中生的日常 (danshi-koukousei)  query="Danshi Koukousei no Nichijou"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-11843
  ✓ [anilist] Danshi Koukousei no Nichijou · 分数 8 · 12 集 · 2012
• 白箱 (shirobako)  query="Shirobako"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-25835
  ✓ [anilist] SHIROBAKO · 分数 8.1 · 24 集 · 2014
• 凉宫春日的忧郁 (haruhi)  query="Suzumiya Haruhi no Yuuutsu"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-849
  ✓ [anilist] Suzumiya Haruhi no Yuuutsu · 分数 7.6 · 14 集 · 2006
• 葬送的芙莉莲 (frieren)  query="Sousou no Frieren"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-52991
  ✓ [anilist] Sousou no Frieren · 分数 9.1 · 28 集 · 2023
• 迷宫饭 (dungeon-meshi)  query="Dungeon Meshi"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-52701
  ✓ [anilist] Dungeon Meshi · 分数 8.5 · 24 集 · 2024
• 无职转生 (mushoku-tensei)  query="Mushoku Tensei: Isekai Ittara Honki Dasu"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-39535
  ✓ [anilist] Mushoku Tensei: Isekai Ittara Honki Dasu · 分数 8.2 · 11 集 · 2021
• Re:从零开始的异世界生活 (re-zero)  query="Re:Zero kara Hajimeru Isekai Seikatsu"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-31240
  ✓ [anilist] Re:Zero kara Hajimeru Isekai Seikatsu · 分数 8.1 · 25 集 · 2016
• 为美好的世界献上祝福! (konosuba)  query="Kono Subarashii Sekai ni Shukufuku wo!"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-30831
  ✓ [anilist] Kono Subarashii Sekai ni Shukufuku wo! · 分数 7.9 · 10 集 · 2016
• 魔法少女小圆 (madoka)  query="Mahou Shoujo Madoka Magica"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-9756
  ✓ [anilist] Mahou Shoujo Madoka☆Magica · 分数 8.3 · 12 集 · 2011
• 来自深渊 (made-in-abyss)  query="Made in Abyss"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-34599
  ✓ [anilist] Made in Abyss · 分数 8.4 · 13 集 · 2017
• 狼与香辛料 (spice-and-wolf)  query="Ookami to Koushinryou"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-2966
  ✓ [anilist] Ookami to Koushinryou · 分数 8 · 13 集 · 2008
• 夏目友人帐 (natsume)  query="Natsume Yuujinchou"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-4081
  ✓ [anilist] Natsume Yuujinchou · 分数 8 · 13 集 · 2008
• 紫罗兰永恒花园 (violet)  query="Violet Evergarden"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-33352
  ✓ [anilist] Violet Evergarden · 分数 8.5 · 13 集 · 2018
• CLANNAD (clannad)  query="CLANNAD"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-2167
  ✓ [anilist] CLANNAD · 分数 7.7 · 23 集 · 2007
• 未闻花名 (anohana)  query="Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-9989
  ✓ [anilist] Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai. · 分数 8 · 11 集 · 2011
• 四月是你的谎言 (your-lie-in-april)  query="Shigatsu wa Kimi no Uso"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-23273
  ✓ [anilist] Shigatsu wa Kimi no Uso · 分数 8.4 · 22 集 · 2014
• 命运石之门 (steins-gate)  query="Steins;Gate"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-9253
  ✓ [anilist] Steins;Gate · 分数 8.9 · 24 集 · 2011
• 死亡笔记 (death-note)  query="Death Note"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-1535
  ✓ [anilist] DEATH NOTE · 分数 8.4 · 37 集 · 2006
• 心理测量者 (psycho-pass)  query="Psycho-Pass"
  → 回退 AniList
  ↺ 缓存命中 anilist-idmal-13601
  ✓ [anilist] PSYCHO-PASS · 分数 8.1 · 22 集 · 2012

== 汇总 ==
- 条目：38（Jikan 0 · AniList 38 · 占位 0）
- 有封面 URL：38 / 38
- 有简介：38 / 38

已写入 data/anime.json（38 条）与 data/anime.js（file:// 兜底）

== 拉取「本季 / 热门」列表 ==
  ! seasons/now 无数据，改用 top/anime?filter=airing
  ! Jikan 不可用，改用 AniList（TRENDING_DESC + RELEASING）
  ↺ 缓存命中 anilist-trending-18
  ✓ anilist:trending(releasing) · 18 条 · 2026 夏季
已写入 data/trending.json（18 条）与 data/trending.js

说明：封面与图片只保存 URL，脚本不会下载任何图片文件；简介、分数、集数等来自 Jikan(MAL)，Jikan 不可用时回退 AniList（AniList 数据标注进站内「关于」页）；无匹配条目保留占位且不编造简介。
本次番剧元数据实际来源：Jikan 0 条、AniList 38 条、占位 0 条。
