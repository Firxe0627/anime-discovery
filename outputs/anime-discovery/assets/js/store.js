/* ==========================================================================
   store.js —— 追番数据的本地存储（localStorage）
   键名：anime-tracker:v1
   结构：{ favorites: {id: {addedAt}}, progress: {id: {watched:[1,2], updatedAt}}, recent: [{id, at}] }
   隐私说明：所有数据只保存在你自己的浏览器里，不会上传到任何服务器。
   ========================================================================== */

(function (global) {
  'use strict';

  var KEY = 'anime-tracker:v1';
  var memory = null; // localStorage 不可用时的内存兜底（例如隐私模式）

  function emptyState() {
    return { favorites: {}, progress: {}, status: {}, recent: [] };
  }

  function available() {
    try {
      var t = '__t' + Date.now();
      global.localStorage.setItem(t, '1');
      global.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }

  var canUse = available();

  function read() {
    if (!canUse) { return memory || (memory = emptyState()); }
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) { return emptyState(); }
      var parsed = JSON.parse(raw);
      return {
        favorites: parsed.favorites && typeof parsed.favorites === 'object' ? parsed.favorites : {},
        progress: parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
        status: parsed.status && typeof parsed.status === 'object' ? parsed.status : {},
        recent: Array.isArray(parsed.recent) ? parsed.recent : []
      };
    } catch (e) {
      return emptyState();
    }
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

  function isFavorite(id) {
    var s = read();
    return Object.prototype.hasOwnProperty.call(s.favorites, id);
  }

  function favoritesCount() {
    return Object.keys(read().favorites).length;
  }

  function favoriteIds() {
    var favs = read().favorites;
    return Object.keys(favs).sort(function (a, b) {
      return (favs[b].addedAt || 0) - (favs[a].addedAt || 0);
    });
  }

  function addFavorite(id, title) {
    if (!id) { return false; }
    var s = read();
    s.favorites[id] = { addedAt: Date.now(), title: title || '' };
    write(s);
    return true;
  }

  function removeFavorite(id) {
    var s = read();
    if (s.favorites[id]) {
      delete s.favorites[id];
      write(s);
      return true;
    }
    return false;
  }

  function toggleFavorite(id, title) {
    var next = !isFavorite(id);
    if (next) { addFavorite(id, title); } else { removeFavorite(id); }
    return next;
  }

  function watchedList(id) {
    var p = read().progress[id];
    return p && Array.isArray(p.watched) ? p.watched.slice() : [];
  }

  function watchedCount(id) {
    return watchedList(id).length;
  }

  function setWatched(id, episodes) {
    var s = read();
    var cleaned = Array.from(new Set((episodes || []).map(Number).filter(function (n) {
      return n > 0;
    }))).sort(function (a, b) { return a - b; });
    if (!cleaned.length) {
      delete s.progress[id];
    } else {
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

  /* --------- 追番状态：在看 / 看完 / 计划看 --------- */

  /**
   * 取某个番剧的追番状态。没有手动设置时按进度推导：
   * 全部看完 → completed；看过若干集 → watching；否则 → planned。
   */
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
    if (!status) {
      delete s.status[id];
    } else {
      s.status[id] = status;
      if (!s.favorites[id]) { s.favorites[id] = { addedAt: Date.now() }; }
    }
    write(s);
    return status || null;
  }

  function explicitStatus(id) {
    return read().status[id] || null;
  }

  function touchRecent(id) {
    if (!id) { return; }
    var s = read();
    s.recent = (s.recent || []).filter(function (r) { return r.id !== id; });
    s.recent.unshift({ id: id, at: Date.now() });
    s.recent = s.recent.slice(0, 8);
    write(s);
  }

  function recentList() {
    return read().recent.slice();
  }

  function watchedMap() {
    var map = {};
    var p = read().progress;
    Object.keys(p).forEach(function (id) {
      map[id] = (p[id].watched || []).length;
    });
    return map;
  }

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

  function onChange(handler) {
    if (!canUse) { return function () {}; }
    global.addEventListener('storage', function (ev) {
      if (ev.key === KEY) { handler(read()); }
    });
    return function () {};
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
    watchedMap: watchedMap,
    setWatched: setWatched,
    toggleEpisode: toggleEpisode,
    setProgressRatio: setProgressRatio,
    clearProgress: clearProgress,
    getStatus: getStatus,
    setStatus: setStatus,
    explicitStatus: explicitStatus,
    touchRecent: touchRecent,
    recentList: recentList,
    clearAll: clearAll,
    stats: stats,
    onChange: onChange
  };
})(window);
