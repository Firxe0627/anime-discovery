/* ==========================================================================
   data.js —— 数据加载与字段取值

   数据由 work/fetch-anime-data.mjs 生成（主资料 AniList，中文名/中文简介 Bangumi）：
     主库很大时会被拆成 data/anime-1.json、anime-2.json …，此时 data/anime.json 是一份清单
     （{ count, parts: [...] }）；前端把清单里的分片并行取回后合并成同一个数组。
     data/anime.js（+ anime-1.js / anime-2.js …）是 file:// 打开时的兜底，内容与 JSON 一致。
     data/trending.json 本季/热门（独立）     data/trending.js 同内容 JS

   本站只保存图片 / PV 的远程 URL，不下载、不托管任何图片或视频文件。
   ========================================================================== */

(function (global) {
  'use strict';

  /* 资源版本号：数据或脚本有更新就 +1，避免 GitHub Pages / 浏览器缓存混用新旧文件 */
  var ASSET_VERSION = '20260919a';

  function withVersion(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + ASSET_VERSION;
  }

  var CATEGORIES = ['全部', '热血', '日常', '奇幻', '治愈', '科幻', '悬疑'];

  var SEASON_ZH = { winter: '冬季', spring: '春季', summer: '夏季', fall: '秋季' };
  var STATUS_ZH = {
    FINISHED: '已完结',
    RELEASING: '连载中',
    NOT_YET_RELEASED: '未开播',
    CANCELLED: '已停播',
    HIATUS: '休载'
  };
  var FORMAT_ZH = { TV: 'TV 动画', MOVIE: '剧场版', ONA: '网络动画', OVA: 'OVA', SPECIAL: '特别篇' };

  var TRACK_STATUS = {
    planned: '想看',
    watching: '在看',
    completed: '看完',
    dropped: '弃番'
  };
  var TRACK_ORDER = ['planned', 'watching', 'completed', 'dropped'];

  var SORTS = [
    { value: 'score', label: '分数最高' },
    { value: 'popularity', label: '热度最高' },
    { value: 'year-desc', label: '年份（新→旧）' },
    { value: 'year-asc', label: '年份（旧→新）' },
    { value: 'name', label: '名称（中文）' },
    { value: 'episodes', label: '集数最多' }
  ];

  /* 常见制作公司的中文名（仅用于显示与搜索，便于用「京都动画」这类中文词检索） */
  var STUDIO_ZH = {
    'Kyoto Animation': '京都动画',
    'bones': '骨头社',
    'Shaft': 'SHAFT',
    'Studio Pierrot': '小丑社',
    'Toei Animation': '东映动画',
    'Sunrise': '日升动画',
    'TMS Entertainment': 'TMS 娱乐',
    'WHITE FOX': 'WHITE FOX',
    'SILVER LINK.': 'SILVER LINK.',
    'david production': 'david production',
    'Brain\'s Base': 'Brain\'s Base',
    'Doga Kobo': '动画工房',
    'P.A.WORKS': 'P.A.WORKS',
    'Kinema Citrus': 'Kinema Citrus',
    'Studio DEEN': 'Studio DEEN',
    'Lerche': 'Lerche',
    'Science SARU': 'Science SARU',
    'CoMix Wave': 'CoMix Wave Films',
    'Studio Bind': 'Studio Bind',
    'Studio Khara': 'khara',
    'NUT': 'NUT',
    'OLM': 'OLM',
    'TROYCA': 'TROYCA',
    'Orange': 'Orange',
    'Telecom Animation Film': 'Telecom Animation Film',
    'Shin-Ei Animation': 'SHIN-EI 动画',
    'Tezuka Productions': '手冢 Production',
    'Studio Ghibli': '吉卜力工作室',
    'Studio Chizu': '地图工作室',
    'Gainax': 'GAINAX',
    'Satelight': 'Satelight',
    'GONZO': 'GONZO',
    'Tatsunoko Production': '龙之子 Production',
    'PINE JAM': 'PINE JAM',
    'Bibury Animation Studios': 'Bibury Animation Studios',
    'LIDENFILMS': 'LIDENFILMS'
  };

  /* 制作公司别名（中文 / 日文 / 常见简称），用于搜索，也用于「输入公司名唯一匹配时自动套用筛选」。
     只做名称映射，不新增或改动任何作品数据。 */
  var STUDIO_ALIASES = {
    'Kyoto Animation': ['京都动画', '京阿尼', '京都アニメーション', '京アニ', 'KyoAni'],
    'ufotable': ['飞碟社', 'ufotable'],
    'MAPPA': ['mappa'],
    'A-1 Pictures': ['A1 Pictures', 'A1Pictures', 'A-1'],
    'bones': ['BONES', '骨头社', 'Bones'],
    'bones film': ['BONES FILM'],
    'CloverWorks': ['clover works', 'CloverWorks'],
    'WIT STUDIO': ['WIT', 'Wit Studio', '霸权社'],
    'TRIGGER': ['Trigger', '扳机社'],
    'Shaft': ['SHAFT', 'シャフト'],
    'Production I.G': ['Production IG', 'I.G', 'IG Port'],
    'J.C.STAFF': ['J.C. Staff', 'JC Staff', 'JCSTAFF', '节操社'],
    'MADHOUSE': ['Madhouse', '疯屋'],
    'Toei Animation': ['东映动画', '東映アニメーション', 'Toei'],
    'Sunrise': ['SUNRISE', '日升', '日升动画', 'サンライズ', 'Bandai Namco Filmworks'],
    'Studio Pierrot': ['小丑社', 'Pierrot', 'ぴえろ'],
    'TMS Entertainment': ['TMS 娱乐', 'Tokyo Movie Shinsha'],
    'david production': ['David Production', 'davidpro'],
    'Doga Kobo': ['动画工房', '動画工房'],
    'Science SARU': ['サイエンスSARU', 'ScienceSARU'],
    'CoMix Wave': ['CoMix Wave Films', '新海诚'],
    'Studio Khara': ['khara', 'カラー'],
    'Bibury Animation Studios': ['Bibury', 'バイブリーアニメーションスタジオ']
  };

  /* 归一化：转小写并去掉空格、点、横线等分隔符，用于公司名匹配 */
  function normalizeKey(str) {
    return String(str === undefined || str === null ? '' : str)
      .toLowerCase()
      .replace(/[\s\u3000·・.\-_/\\()（）[\]【】!！?？'"’“”]/g, '');
  }

  /** 某个制作公司的全部可搜索名称（英文原名、中文显示名、别名） */
  function studioAliases(name) {
    var list = [name, STUDIO_ZH[name]].concat(STUDIO_ALIASES[name] || []);
    var seen = {};
    return list.filter(function (item) {
      if (!item) { return false; }
      var key = normalizeKey(item);
      if (!key || seen[key]) { return false; }
      seen[key] = true;
      return true;
    });
  }

  /**
   * 按公司名 / 别名匹配制作公司列表（studios 来自 studioList）。
   * 返回 { exact: [...], partial: [...] }：exact 是完全相等的匹配，partial 是包含关系的匹配。
   */
  function matchStudios(studios, query) {
    var q = normalizeKey(query);
    var result = { exact: [], partial: [] };
    if (!q || q.length < 2) { return result; }
    (studios || []).forEach(function (row) {
      var aliases = studioAliases(row.name).map(normalizeKey);
      if (aliases.indexOf(q) !== -1) { result.exact.push(row); return; }
      if (aliases.some(function (a) { return a.indexOf(q) !== -1; })) { result.partial.push(row); }
    });
    return result;
  }

  var cache = { anime: null, trending: null, animeSource: '', trendingSource: '' };
  var isFileProtocol = global.location && global.location.protocol === 'file:';

  /* ------------------------------------------------------------- 加载工具 */

  function loadScriptOnce(id, src) {
    return new Promise(function (resolve) {
      var existing = document.getElementById(id);
      if (existing) {
        if (existing.getAttribute('data-loaded') === '1') { resolve(true); return; }
        existing.addEventListener('load', function () { resolve(true); });
        existing.addEventListener('error', function () { resolve(false); });
        return;
      }
      var s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.addEventListener('load', function () { s.setAttribute('data-loaded', '1'); resolve(true); });
      s.addEventListener('error', function () { resolve(false); });
      document.head.appendChild(s);
    });
  }

  function fetchJson(url) {
    if (isFileProtocol || typeof global.fetch !== 'function') { return Promise.resolve(null); }
    var options = { cache: 'no-cache' };
    // 网络不稳时 fetch 可能长时间挂起：超时后直接改用同内容的 .js 兜底，避免页面停在骨架屏
    var timeout = (typeof global.AbortSignal !== 'undefined' && global.AbortSignal.timeout)
      ? global.AbortSignal.timeout(9000) : null;
    if (timeout) { options.signal = timeout; }
    return global.fetch(withVersion(url), options).then(function (res) {
      if (!res.ok) { return null; }
      return res.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function loadPair(jsonPath, jsPath, globalName) {
    return fetchJson(jsonPath).then(function (json) {
      if (json) { return { value: json, source: jsonPath }; }
      return loadScriptOnce('fallback-' + jsPath, withVersion(jsPath)).then(function (ok) {
        var value = ok ? global[globalName] : null;
        return { value: value || null, source: value ? jsPath + '（本地兜底）' : '不可用' };
      });
    });
  }

  /* ------------------------------------------------------- 主库加载（含分片） */

  /** 清单里的分片：并行取回所有 JSON，顺序拼接成一个数组（任意一片失败就整体回退到 .js） */
  function loadJsonParts(manifest) {
    var files = manifest.parts.map(function (part) {
      return typeof part === 'string' ? part : (part.file || part.script);
    }).filter(Boolean);
    if (!files.length) { return Promise.resolve(null); }
    return Promise.all(files.map(function (file) { return fetchJson(file); })).then(function (chunks) {
      var ok = chunks.every(function (chunk) { return Array.isArray(chunk); });
      if (!ok) { return null; }
      return { value: Array.prototype.concat.apply([], chunks), source: files.join(' + ') };
    });
  }

  /** file:// 兜底：anime.js 里要么是完整数组，要么是一串分片脚本地址 */
  function loadFromScripts() {
    return loadScriptOnce('fallback-data/anime.js', withVersion('data/anime.js')).then(function (ok) {
      if (!ok) { return { value: null, source: '不可用' }; }
      if (Array.isArray(global.__ANIME_DATA__)) {
        return { value: global.__ANIME_DATA__, source: 'data/anime.js（本地兜底）' };
      }
      var parts = global.__ANIME_PARTS__;
      if (!Array.isArray(parts) || !parts.length) { return { value: null, source: '不可用' }; }
      return parts.reduce(function (chain, src, i) {
        return chain.then(function (acc) {
          return loadScriptOnce('fallback-part-' + i, withVersion(src)).then(function (loaded) {
            var chunk = loaded ? global['__ANIME_PART_' + (i + 1) + '__'] : null;
            return acc.concat(Array.isArray(chunk) ? chunk : []);
          });
        });
      }, Promise.resolve([])).then(function (list) {
        return {
          value: list.length ? list : null,
          source: list.length ? 'data/anime-1.js + …（本地兜底）' : '不可用'
        };
      });
    });
  }

  function loadAnime() {
    return fetchJson('data/anime.json').then(function (json) {
      if (Array.isArray(json)) { return { value: json, source: 'data/anime.json' }; }
      if (json && Array.isArray(json.parts) && json.parts.length) {
        return loadJsonParts(json).then(function (merged) { return merged || loadFromScripts(); });
      }
      return loadFromScripts();
    });
  }

  function load() {
    if (cache.anime) { return Promise.resolve(cache.anime); }
    return loadAnime().then(function (r) {
      cache.anime = Array.isArray(r.value) ? r.value : [];
      cache.animeSource = r.source;
      return cache.anime;
    });
  }

  function loadTrending() {
    if (cache.trending) { return Promise.resolve(cache.trending); }
    return loadPair('data/trending.json', 'data/trending.js', '__TRENDING_DATA__').then(function (r) {
      var value = r.value && Array.isArray(r.value.items) ? r.value : { items: [], source: null, season: null };
      cache.trending = value;
      cache.trendingSource = r.source;
      return value;
    });
  }

  function find(list, id) {
    if (!id || !Array.isArray(list)) { return null; }
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { return list[i]; }
    }
    return null;
  }

  function findByAniList(list, anilistId) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].anilistId === anilistId) { return list[i]; }
    }
    return null;
  }

  /* -------------------------------------------------------------- 取值器 */

  /** 优先中文名；没有中文名就显示原名（AniList 的 native，通常是日文原名）。 */
  function displayTitle(a) {
    if (!a) { return '未知作品'; }
    return a.name_cn || a.name || a.name_romaji || a.name_en || '未知作品';
  }

  function altTitles(a) {
    var primary = displayTitle(a);
    return [a.name, a.name_romaji, a.name_en].filter(function (t, i, arr) {
      return t && t !== primary && arr.indexOf(t) === i;
    });
  }

  function hasCn(a) { return !!(a && (a.name_cn || a.summary_cn)); }

  function scoreText(a) {
    return a && typeof a.score === 'number' ? a.score.toFixed(1) : '—';
  }

  function seasonZh(season) { return SEASON_ZH[season] || ''; }

  function yearText(a) {
    if (!a || !a.year) { return '年份未知'; }
    return a.year + ' 年' + (seasonZh(a.season) ? ' ' + seasonZh(a.season) : '');
  }

  function statusText(a) {
    if (!a) { return '状态未知'; }
    return STATUS_ZH[a.status] || a.status || '状态未知';
  }

  function formatText(a) {
    if (!a || !a.format) { return '动画'; }
    return FORMAT_ZH[a.format] || a.format;
  }

  function trackStatusText(key) { return TRACK_STATUS[key] || key || ''; }

  function episodesText(a) {
    if (!a) { return '集数未知'; }
    return a.episodes ? '全 ' + a.episodes + ' 集' : '集数未知';
  }

  /** 集数未知的连载作品按 24 集占位，仅用于记录进度。 */
  function episodeTotal(a) { return (a && a.episodes) || 24; }
  function episodesEstimated(a) { return !(a && a.episodes); }

  function primaryStudio(a) { return (a && a.studios && a.studios[0]) || ''; }

  /** 制作公司中文名（没有映射时返回英文原名）。 */
  function studioName(name) { return STUDIO_ZH[name] || name || ''; }

  /** 制作公司显示用文案：中文名 + 英文原名 */
  function studioLabel(name) {
    var zh = STUDIO_ZH[name];
    return zh && zh !== name ? zh + '（' + name + '）' : (name || '');
  }

  function tagsOf(a, limit) {
    var tags = [].concat((a && a.categories) || [], (a && a.genres) || []);
    var seen = {};
    tags = tags.filter(function (t) {
      if (!t || seen[t]) { return false; }
      seen[t] = true;
      return true;
    });
    return limit ? tags.slice(0, limit) : tags;
  }

  function externalLinks(a) {
    var links = [];
    if (!a) { return links; }
    if (a.malId) { links.push({ label: 'MyAnimeList', url: 'https://myanimelist.net/anime/' + a.malId, kind: 'mal' }); }
    if (a.bgmId) { links.push({ label: 'Bangumi', url: 'https://bgm.tv/subject/' + a.bgmId, kind: 'bgm' }); }
    if (a.anilistId) { links.push({ label: 'AniList', url: 'https://anilist.co/anime/' + a.anilistId, kind: 'anilist' }); }
    return links;
  }

  /** 只有 AniList 明确标注为官方的 YouTube trailer 才会有值。 */
  function trailerEmbedUrl(a, autoplay) {
    if (!a || !a.trailer) { return null; }
    return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(a.trailer)
      + '?rel=0&modestbranding=1' + (autoplay ? '&autoplay=1&mute=1' : '');
  }

  function sourceLabel(a) {
    if (!a) { return '数据源未知'; }
    if (a.bgmId) { return '资料来自 AniList，中文名/简介来自 Bangumi'; }
    return '资料来自 AniList';
  }

  /** 搜索用文本：中文名 / 原名 / 罗马字 / 英文名 / 制作公司 / 标签 / 简介。 */
  function searchText(a) {
    if (a.__search) { return a.__search; }
    var parts = [
      a.name_cn, a.name, a.name_romaji, a.name_en,
      (a.studios || []).join(' '),
      (a.studios || []).map(studioName).join(' '),
      (a.genres || []).join(' '),
      (a.categories || []).join(' '),
      a.year ? String(a.year) : '',
      a.summary_cn || '', a.summary_en || ''
    ];
    a.__search = parts.filter(Boolean).join(' ').toLowerCase();
    return a.__search;
  }

  function buildEpisodes(a) {
    var total = Math.max(1, Math.min(300, episodeTotal(a)));
    var list = [];
    for (var i = 1; i <= total; i++) {
      list.push({
        n: i,
        title: '第 ' + i + ' 集',
        desc: '占位条目：仅用于记录你看到第几集，不代表真实剧集标题。'
      });
    }
    return list;
  }

  /** 年份轴：主库里出现过的年份，倒序（新 → 旧）。 */
  function yearList(list) {
    var seen = {};
    list.forEach(function (a) { if (a.year) { seen[a.year] = true; } });
    return Object.keys(seen).map(Number).sort(function (a, b) { return b - a; });
  }

  /** 制作公司列表（带作品数），按数量倒序。 */
  function studioList(list) {
    var map = {};
    list.forEach(function (a) {
    (a.studios || []).forEach(function (s) { map[s] = (map[s] || 0) + 1; });
    });
    return Object.keys(map).map(function (name) {
      return { name: name, label: studioLabel(name), count: map[name] };
    }).sort(function (a, b) { return b.count - a.count || a.name.localeCompare(b.name); });
  }

  /** relations → 站内已有条目 or 纯外链条目 */
  function resolveRelations(a, all) {
    if (!a || !a.relations) { return []; }
    return a.relations.map(function (r) {
      var local = findByAniList(all, r.anilistId);
      return {
        relation: r.relation,
        relationZh: r.relationZh,
        name: local ? displayTitle(local) : r.name,
        originalName: r.name,
        format: r.format,
        formatZh: FORMAT_ZH[r.format] || r.format || '',
        year: r.year,
        local: local,
        url: 'https://anilist.co/anime/' + r.anilistId
      };
    });
  }

  /** 猜你也想看：按共同的分类 + 类型标签打分，纯前端、不编造评论。 */
  function recommend(all, favorites, limit) {
    var owned = {};
    favorites.forEach(function (a) { owned[a.id] = true; });
    var weights = {};
    favorites.forEach(function (a) {
      (a.categories || []).forEach(function (c) { weights['c:' + c] = (weights['c:' + c] || 0) + 3; });
      (a.genres || []).forEach(function (g) { weights['g:' + g] = (weights['g:' + g] || 0) + 2; });
      (a.studios || []).forEach(function (s) { weights['s:' + s] = (weights['s:' + s] || 0) + 2; });
    });
    var scored = all.filter(function (a) { return !owned[a.id]; }).map(function (a) {
      var score = 0;
      (a.categories || []).forEach(function (c) { score += weights['c:' + c] || 0; });
      (a.genres || []).forEach(function (g) { score += weights['g:' + g] || 0; });
      (a.studios || []).forEach(function (s) { score += weights['s:' + s] || 0; });
      if (a.score) { score += a.score; }
      return { anime: a, score: score };
    }).filter(function (row) { return row.score > 3; })
      .sort(function (x, y) { return y.score - x.score; });
    return scored.slice(0, limit || 6).map(function (row) { return row.anime; });
  }

  /* ---------------------------------------------- 筛选状态与网址参数 */

  var FILTER_KEY = 'anime-tracker:filters';
  var SCROLL_KEY = 'anime-tracker:scroll';   // 首页滚动位置（sessionStorage，仅本标签页）
  var RETURN_KEY = 'anime-tracker:return';   // 详情页返回标记：回到首页时恢复滚动位置

  /** 首页筛选状态的默认值（分类用「全部」表示不筛选） */
  function defaultFilters() {
    return { keyword: '', category: '全部', year: '', season: '', studio: '', format: '', sort: 'score' };
  }

  /** 筛选状态 → 网址查询串（只写非默认项，?q= &genre= &year= &season= &studio= &format= &sort=） */
  function filtersToQuery(filters) {
    var f = filters || {};
    var p = new global.URLSearchParams();
    if (f.keyword) { p.set('q', f.keyword); }
    if (f.category && f.category !== '全部') { p.set('genre', f.category); }
    if (f.year) { p.set('year', String(f.year)); }
    if (f.season) { p.set('season', f.season); }
    if (f.studio) { p.set('studio', f.studio); }
    if (f.format) { p.set('format', f.format); }
    if (f.sort && f.sort !== 'score') { p.set('sort', f.sort); }
    return p.toString();
  }

  /** 网址查询串 → 筛选状态（无效参数忽略，分类必须是已知分类） */
  function filtersFromQuery(search) {
    var p = new global.URLSearchParams(search || '');
    var f = defaultFilters();
    if (p.get('q')) { f.keyword = p.get('q'); }
    if (p.get('genre') && CATEGORIES.indexOf(p.get('genre')) !== -1) { f.category = p.get('genre'); }
    if (p.get('year')) { f.year = String(p.get('year')); }
    if (p.get('season')) { f.season = p.get('season'); }
    if (p.get('studio')) { f.studio = p.get('studio'); }
    if (p.get('format')) { f.format = p.get('format'); }
    if (p.get('sort')) { f.sort = p.get('sort'); }
    return f;
  }

  function rememberFilters(filters) {
    try { global.localStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch (e) { /* ignore */ }
  }

  /** 读回本机记住的筛选条件（从详情页返回首页时用），读不到返回 null */
  function readRememberedFilters() {
    try {
      var raw = global.localStorage.getItem(FILTER_KEY);
      if (!raw) { return null; }
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') { return null; }
      var f = defaultFilters();
      Object.keys(f).forEach(function (k) { if (saved[k] !== undefined && saved[k] !== null) { f[k] = saved[k]; } });
      return f;
    } catch (e) { return null; }
  }

  global.AnimeData = {
    CATEGORIES: CATEGORIES,
    TRACK_STATUS: TRACK_STATUS,
    TRACK_ORDER: TRACK_ORDER,
    SORTS: SORTS,
    load: load,
    loadTrending: loadTrending,
    animeSource: function () { return cache.animeSource; },
    trendingSource: function () { return cache.trendingSource; },
    find: find,
    findByAniList: findByAniList,
    displayTitle: displayTitle,
    altTitles: altTitles,
    hasCn: hasCn,
    scoreText: scoreText,
    seasonZh: seasonZh,
    yearText: yearText,
    statusText: statusText,
    formatText: formatText,
    trackStatusText: trackStatusText,
    episodesText: episodesText,
    episodeTotal: episodeTotal,
    episodesEstimated: episodesEstimated,
    primaryStudio: primaryStudio,
    studioName: studioName,
    studioLabel: studioLabel,
    studioAliases: studioAliases,
    matchStudios: matchStudios,
    tagsOf: tagsOf,
    externalLinks: externalLinks,
    trailerEmbedUrl: trailerEmbedUrl,
    sourceLabel: sourceLabel,
    searchText: searchText,
    buildEpisodes: buildEpisodes,
    yearList: yearList,
    studioList: studioList,
    resolveRelations: resolveRelations,
    recommend: recommend,
    FILTER_KEY: FILTER_KEY,
    SCROLL_KEY: SCROLL_KEY,
    RETURN_KEY: RETURN_KEY,
    defaultFilters: defaultFilters,
    filtersToQuery: filtersToQuery,
    filtersFromQuery: filtersFromQuery,
    rememberFilters: rememberFilters,
    readRememberedFilters: readRememberedFilters
  };
})(window);
