/* ==========================================================================
   store.js —— 追番数据的本地存储（localStorage，无账号系统）

   键名：anime-tracker:v1
   结构：{
     favorites: { id: { addedAt } },
     progress:  { id: { watched: [1,2,3], updatedAt } },
     status:    { id: 'planned' | 'watching' | 'completed' | 'dropped' },
     recent:    [ { id, at } ]
   }
   所有数据只保存在你自己的浏览器里；导出 / 导入 / 分享码都在本地完成。
   ========================================================================== */

(function (global) {
  'use strict';

  var KEY = 'anime-tracker:v1';
  var memory = null;

  function emptyState() {
    return { favorites: {}, progress: {}, status: {}, recent: [] };
  }

  function available() {
    try {
      var t = '__t' + Date.now();
      global.localStorage.setItem(t, '1');
      global.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  }

  var canUse = available();

  function normalizeState(raw) {
    var parsed = raw && typeof raw === 'object' ? raw : {};
    return {
      favorites: parsed.favorites && typeof parsed.favorites === 'object' ? parsed.favorites : {},
      progress: parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
      status: parsed.status && typeof parsed.status === 'object' ? parsed.status : {},
      recent: Array.isArray(parsed.recent) ? parsed.recent : []
    };
  }

  function read() {
    if (!canUse) { return memory || (memory = emptyState()); }
    try {
      var raw = global.localStorage.getItem(KEY);
      return raw ? normalizeState(JSON.parse(raw)) : emptyState();
    } catch (e) { return emptyState(); }
  }

  function write(state) {
    if (!canUse) { memory = state; return state; }
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      canUse = false;
      memory = state;
    }
    return state;
  }

  /* --------------------------------------------------------------- 收藏 */

  function isFavorite(id) { return Object.prototype.hasOwnProperty.call(read().favorites, id); }
  function favoritesCount() { return Object.keys(read().favorites).length; }

  function favoriteIds() {
    var favs = read().favorites;
    return Object.keys(favs).sort(function (a, b) {
      return (favs[b].addedAt || 0) - (favs[a].addedAt || 0);
    });
  }

  function addFavorite(id) {
    if (!id) { return false; }
    var s = read();
    s.favorites[id] = { addedAt: Date.now() };
    write(s);
    return true;
  }

  function removeFavorite(id) {
    var s = read();
    if (s.favorites[id]) { delete s.favorites[id]; write(s); return true; }
    return false;
  }

  function toggleFavorite(id) {
    var next = !isFavorite(id);
    if (next) { addFavorite(id); } else { removeFavorite(id); }
    return next;
  }

  /* --------------------------------------------------------------- 进度 */

  function watchedList(id) {
    var p = read().progress[id];
    return p && Array.isArray(p.watched) ? p.watched.slice() : [];
  }

  function watchedCount(id) { return watchedList(id).length; }

  function setWatched(id, episodes) {
    var s = read();
    var cleaned = Array.from(new Set((episodes || []).map(Number).filter(function (n) { return n > 0; })))
      .sort(function (a, b) { return a - b; });
    if (!cleaned.length) { delete s.progress[id]; } else {
      s.progress[id] = { watched: cleaned, updatedAt: Date.now() };
    }
    write(s);
    return cleaned;
  }

  function toggleEpisode(id, n) {
    var current = watchedList(id);
    var idx = current.indexOf(Number(n));
    if (idx >= 0) { current.splice(idx, 1); } else { current.push(Number(n)); }
    return setWatched(id, current);
  }

  function setProgressRatio(id, total) {
    var done = watchedCount(id);
    var t = Number(total) || 0;
    var pct = t > 0 ? Math.round((done / t) * 100) : 0;
    return { done: done, total: t, pct: Math.min(100, pct) };
  }

  function clearProgress(id) {
    var s = read();
    delete s.progress[id];
    write(s);
  }

  /** 最近一次有进度更新的时间，用于「继续看」排序。 */
  function progressUpdatedAt(id) {
    var p = read().progress[id];
    return (p && p.updatedAt) || 0;
  }

  /* --------------------------------------------------------- 追番状态 */

  function getStatus(id, totalEpisodes) {
    var s = read();
    var explicit = s.status[id];
    if (explicit) { return explicit; }
    var done = watchedCount(id);
    var total = Number(totalEpisodes) || 0;
    if (total > 0 && done >= total) { return 'completed'; }
    if (done > 0) { return 'watching'; }
    return 'planned';
  }

  function setStatus(id, status) {
    if (!id) { return null; }
    var s = read();
    if (!status) { delete s.status[id]; } else {
      s.status[id] = status;
      if (!s.favorites[id]) { s.favorites[id] = { addedAt: Date.now() }; }
    }
    write(s);
    return status || null;
  }

  function explicitStatus(id) { return read().status[id] || null; }

  /* --------------------------------------------------------- 最近浏览 */

  function touchRecent(id) {
    if (!id) { return; }
    var s = read();
    s.recent = (s.recent || []).filter(function (r) { return r.id !== id; });
    s.recent.unshift({ id: id, at: Date.now() });
    s.recent = s.recent.slice(0, 12);
    write(s);
  }

  function recentList() { return read().recent.slice(); }

  /* ------------------------------------------------- 导出 / 导入 / 分享 */

  function exportPayload() {
    return {
      app: 'AnimeDiscovery',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: read()
    };
  }

  /** 合并导入：只增加不覆盖已有进度（进度取并集，状态以导入值为准若本地为空）。 */
  function importPayload(payload) {
    var incoming = payload && payload.data ? payload.data : payload;
    if (!incoming || typeof incoming !== 'object') {
      return { ok: false, message: '文件内容不是有效的追番数据' };
    }
    var s = read();
    var stats = { favorites: 0, progress: 0, status: 0 };

    Object.keys(incoming.favorites || {}).forEach(function (id) {
      if (!s.favorites[id]) {
        s.favorites[id] = { addedAt: (incoming.favorites[id] && incoming.favorites[id].addedAt) || Date.now() };
        stats.favorites += 1;
      }
    });
    Object.keys(incoming.progress || {}).forEach(function (id) {
      var list = (incoming.progress[id] && incoming.progress[id].watched) || [];
      var merged = Array.from(new Set(watchedList(id).concat(list)));
      if (merged.length) {
        s.progress[id] = { watched: merged.sort(function (a, b) { return a - b; }), updatedAt: Date.now() };
        stats.progress += 1;
      }
    });
    Object.keys(incoming.status || {}).forEach(function (id) {
      if (incoming.status[id]) {
        s.status[id] = incoming.status[id];
        if (!s.favorites[id]) { s.favorites[id] = { addedAt: Date.now() }; }
        stats.status += 1;
      }
    });
    write(s);
    return { ok: true, stats: stats };
  }

  /* 分享码：把收藏 / 状态 / 进度编码成一段可复制文本，对方粘贴即可导入。 */

  function toBase64Url(str) {
    return global.btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(str) {
    var s = String(str || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) { s += '='; }
    return decodeURIComponent(escape(global.atob(s)));
  }

  function shareCode() {
    var s = read();
    var items = Object.keys(s.favorites).map(function (id) {
      return {
        i: id,
        s: s.status[id] || null,
        w: (s.progress[id] && s.progress[id].watched) || []
      };
    });
    // 没有收藏但可能有独立进度/状态
    Object.keys(s.progress).forEach(function (id) {
      if (!s.favorites[id]) { items.push({ i: id, s: s.status[id] || null, w: s.progress[id].watched || [] }); }
    });
    return 'AD1.' + toBase64Url(JSON.stringify({ v: 1, at: Date.now(), items: items }));
  }

  function importShareCode(code) {
    var raw = String(code || '').trim();
    if (!raw) { return { ok: false, message: '分享码为空' }; }
    var body = raw.indexOf('AD1.') === 0 ? raw.slice(4) : raw;
    var parsed;
    try {
      parsed = JSON.parse(fromBase64Url(body));
    } catch (e) {
      return { ok: false, message: '分享码无法解析，请检查是否复制完整' };
    }
    if (!parsed || !Array.isArray(parsed.items)) {
      return { ok: false, message: '分享码格式不正确' };
    }
    var favorites = {};
    var progress = {};
    var status = {};
    parsed.items.forEach(function (it) {
      if (!it || !it.i) { return; }
      favorites[it.i] = { addedAt: Date.now() };
      if (it.s) { status[it.i] = it.s; }
      if (it.w && it.w.length) { progress[it.i] = { watched: it.w, updatedAt: Date.now() }; }
    });
    var res = importPayload({ favorites: favorites, progress: progress, status: status });
    if (res.ok) { res.count = parsed.items.length; }
    return res;
  }

  /* --------------------------------------------------------------- 其他 */

  function clearAll() {
    if (!canUse) { memory = emptyState(); return; }
    try { global.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    memory = null;
  }

  function stats() {
    var s = read();
    var ids = Object.keys(s.progress);
    var totalEpisodes = 0;
    ids.forEach(function (id) { totalEpisodes += (s.progress[id].watched || []).length; });
    return {
      favorites: Object.keys(s.favorites).length,
      tracking: ids.length,
      episodes: totalEpisodes
    };
  }

  global.AnimeStore = {
    KEY: KEY,
    isPersistent: canUse,
    all: read,
    isFavorite: isFavorite,
    favoritesCount: favoritesCount,
    favoriteIds: favoriteIds,
    addFavorite: addFavorite,
    removeFavorite: removeFavorite,
    toggleFavorite: toggleFavorite,
    watchedList: watchedList,
    watchedCount: watchedCount,
    setWatched: setWatched,
    toggleEpisode: toggleEpisode,
    setProgressRatio: setProgressRatio,
    clearProgress: clearProgress,
    progressUpdatedAt: progressUpdatedAt,
    getStatus: getStatus,
    setStatus: setStatus,
    explicitStatus: explicitStatus,
    touchRecent: touchRecent,
    recentList: recentList,
    exportPayload: exportPayload,
    importPayload: importPayload,
    shareCode: shareCode,
    importShareCode: importShareCode,
    clearAll: clearAll,
    stats: stats
  };
})(window);
