/* ==========================================================================
   data.js —— 番剧数据加载与通用取值

   数据由 work/fetch-anime-data.mjs 抓取生成（Jikan / AniList），文件有三份：
     data/anime.json    权威数据（本地服务器 / GitHub Pages 下 fetch 读取）
     data/anime.js      同内容的 JS，供 file:// 双击打开时兜底
     data/trending.json / trending.js   本季·热门列表（可能为空）

   本站只保存图片 URL，不下载、不托管任何图片文件。
   ========================================================================== */

(function (global) {
  'use strict';

  var CATEGORIES = ['全部', '热血', '日常', '奇幻', '治愈', '科幻', '悬疑'];

  var SEASON_ZH = { winter: '冬季', spring: '春季', summer: '夏季', fall: '秋季' };
  var STATUS_ZH = {
    'Finished Airing': '已完结',
    'Currently Airing': '连载中',
    'Not yet aired': '未开播',
    'Cancelled': '停播',
    'On Hiatus': '休载'
  };
  var TRACK_STATUS = {
    watching: '在看',
    completed: '看完',
    planned: '计划看'
  };

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
      s.addEventListener('load', function () {
        s.setAttribute('data-loaded', '1');
        resolve(true);
      });
      s.addEventListener('error', function () { resolve(false); });
      document.head.appendChild(s);
    });
  }

  function fetchJson(url) {
    if (isFileProtocol || typeof global.fetch !== 'function') { return Promise.resolve(null); }
    return global.fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) { return null; }
      return res.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  /**
   * 读取一份数据：先试 JSON，失败再加载同名 .js 兜底。
   * @returns {Promise<{value:*, source:string}>}
   */
  function loadPair(jsonPath, jsPath, globalName) {
    return fetchJson(jsonPath).then(function (json) {
      if (json) { return { value: json, source: jsonPath }; }
      return loadScriptOnce('fallback-' + jsPath, jsPath).then(function (ok) {
        var value = ok ? global[globalName] : null;
        return { value: value || null, source: value ? jsPath + '（本地兜底）' : '不可用' };
      });
    });
  }

  /* ------------------------------------------------------------ 对外接口 */

  function load() {
    if (cache.anime) { return Promise.resolve(cache.anime); }
    return loadPair('data/anime.json', 'data/anime.js', '__ANIME_DATA__').then(function (r) {
      cache.anime = Array.isArray(r.value) ? r.value : [];
      cache.animeSource = r.source;
      return cache.anime;
    });
  }

  function loadTrending() {
    if (cache.trending) { return Promise.resolve(cache.trending); }
    return loadPair('data/trending.json', 'data/trending.js', '__TRENDING_DATA__').then(function (r) {
      var value = r.value && Array.isArray(r.value.items)
        ? r.value
        : { items: [], source: null, season: null };
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

  /* -------------------------------------------------------------- 取值器 */

  function displayTitle(a) {
    return a.titleZh || a.title || a.titleEn || a.titleJa || '未知作品';
  }

  function altTitles(a) {
    return [a.title, a.titleEn, a.titleJa].filter(function (t) {
      return t && t !== displayTitle(a);
    });
  }

  function scoreText(a) {
    return typeof a.score === 'number' ? a.score.toFixed(1) : '—';
  }

  function yearText(a) {
    var season = a.season && SEASON_ZH[a.season] ? ' ' + SEASON_ZH[a.season] : '';
    return a.year ? a.year + ' 年' + season : '年份未知';
  }

  function statusText(a) {
    return STATUS_ZH[a.status] || a.status || '状态未知';
  }

  function trackStatusText(key) {
    return TRACK_STATUS[key] || key || '';
  }

  function episodesText(a) {
    return a.episodes ? '全 ' + a.episodes + ' 集' : '集数未知';
  }

  /** 集数为空的连载作品（例如 ONE PIECE）按 24 集占位，便于记录进度。 */
  function episodeTotal(a) {
    return a.episodes || 24;
  }

  function episodesEstimated(a) {
    return !a.episodes;
  }

  function allTags(a, limit) {
    var tags = [].concat(a.categories || [], a.genres || [], a.themes || []);
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
    if (a.malUrl) { links.push({ label: 'MyAnimeList', url: a.malUrl, kind: 'mal' }); }
    if (a.anilistUrl) { links.push({ label: 'AniList', url: a.anilistUrl, kind: 'anilist' }); }
    return links;
  }

  function sourceLabel(a) {
    if (a.source === 'jikan') { return '来自 Jikan（MyAnimeList 公开 API）'; }
    if (a.source === 'anilist') { return '来自 AniList GraphQL API'; }
    return '数据源未匹配到条目（占位）';
  }

  /** 生成占位集数列表（不含任何真实剧集信息）。 */
  function buildEpisodes(a) {
    var total = Math.max(1, Math.min(300, episodeTotal(a)));
    var list = [];
    for (var i = 1; i <= total; i++) {
      list.push({
        n: i,
        title: '第 ' + i + ' 集',
        desc: '占位条目：用于记录观看进度，不代表真实剧集标题。'
      });
    }
    return list;
  }

  global.AnimeData = {
    CATEGORIES: CATEGORIES,
    TRACK_STATUS: TRACK_STATUS,
    load: load,
    loadTrending: loadTrending,
    animeSource: function () { return cache.animeSource; },
    trendingSource: function () { return cache.trendingSource; },
    find: find,
    displayTitle: displayTitle,
    altTitles: altTitles,
    scoreText: scoreText,
    yearText: yearText,
    statusText: statusText,
    trackStatusText: trackStatusText,
    episodesText: episodesText,
    episodeTotal: episodeTotal,
    episodesEstimated: episodesEstimated,
    allTags: allTags,
    externalLinks: externalLinks,
    sourceLabel: sourceLabel,
    buildEpisodes: buildEpisodes
  };
})(window);
