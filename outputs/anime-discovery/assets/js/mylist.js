/* ==========================================================================
   mylist.js —— 我的追番：收藏 / 观看进度 / 最近浏览 / 导出与清空
   ========================================================================== */

(function (global) {
  'use strict';

  var el = global.UI.el;
  var all = [];

  function renderStats() {
    var s = global.AnimeStore.stats();
    document.getElementById('statFav').textContent = String(s.favorites);
    document.getElementById('statTracking').textContent = String(s.tracking);
    document.getElementById('statEpisodes').textContent = String(s.episodes);
  }

  function renderContinue() {
    var section = document.getElementById('continueSection');
    var grid = document.getElementById('continueGrid');
    var progress = global.AnimeStore.all().progress;

    var rows = Object.keys(progress).map(function (id) {
      return { anime: global.AnimeData.find(all, id), at: progress[id].updatedAt || 0 };
    }).filter(function (row) { return row.anime; })
      .sort(function (a, b) { return b.at - a.at; });

    if (!rows.length) {
      section.hidden = true;
      grid.innerHTML = '';
      return;
    }

    section.hidden = false;
    grid.innerHTML = '';
    rows.forEach(function (row) {
      var date = row.at ? new Date(row.at) : null;
      var note = '最近更新：' + (date
        ? date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—');
      grid.appendChild(global.UI.progressItem(row.anime, {
        note: note,
        showClearProgress: true,
        onChange: refresh
      }));
    });
  }

  function renderFavorites() {
    var grid = document.getElementById('favoriteGrid');
    var ids = global.AnimeStore.favoriteIds();
    var list = ids.map(function (id) { return global.AnimeData.find(all, id); })
      .filter(function (item) { return item; });

    global.UI.renderGrid(grid, list, {
      emptyTitle: '还没有收藏任何番剧',
      emptyDesc: '去首页点封面右上角的 ♥，或在详情页点「加入我的追番」。',
      emptyAction: {
        label: '去首页看看',
        onClick: function () { global.location.href = 'index.html'; }
      },
      onToggleFavorite: function () { refresh(); }
    });
  }

  function renderRecent() {
    var section = document.getElementById('recentSection');
    var grid = document.getElementById('recentGrid');
    var rows = global.AnimeStore.recentList().map(function (r) {
      return { anime: global.AnimeData.find(all, r.id), at: r.at };
    }).filter(function (row) { return row.anime; });

    if (!rows.length) {
      section.hidden = true;
      grid.innerHTML = '';
      return;
    }

    section.hidden = false;
    grid.innerHTML = '';
    rows.forEach(function (row) {
      var date = row.at ? new Date(row.at) : null;
      var isFav = global.AnimeStore.isFavorite(row.anime.id);
      grid.appendChild(global.UI.progressItem(row.anime, {
        note: '浏览于 ' + (date
          ? date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—') + (isFav ? ' · 已收藏' : ' · 未收藏'),
        showRemove: false,
        onChange: refresh
      }));
    });
  }

  function refresh() {
    renderStats();
    renderContinue();
    renderFavorites();
    renderRecent();
    global.UI.refreshBadge();
  }

  function exportData() {
    var payload = {
      exportedAt: new Date().toISOString(),
      note: '番组发现 AnimeDiscovery 本地追番数据（浏览器 localStorage）',
      data: global.AnimeStore.all()
    };
    var blob = new global.Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = global.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'anime-tracker-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
  }

  function init() {
    document.getElementById('storageNotice').hidden = global.AnimeStore.isPersistent;
    if (!global.AnimeStore.isPersistent) {
      document.getElementById('storageNotice').textContent =
        '提示：当前浏览器禁用了 localStorage（例如隐私模式），这次的收藏与进度只保留在本页面内，刷新后会丢失。';
    }

    document.getElementById('exportBtn').addEventListener('click', exportData);

    document.getElementById('clearAllBtn').addEventListener('click', function () {
      var ok = global.confirm('确定要清空所有本地追番数据吗？此操作不可撤销。');
      if (!ok) { return; }
      global.AnimeStore.clearAll();
      refresh();
    });

    global.AnimeData.load().then(function (list) {
      all = list;
      refresh();
    }).catch(function (err) {
      document.getElementById('favoriteGrid').innerHTML =
        '<div class="empty"><h3>数据加载失败</h3><p>' +
        global.UI.escapeHtml(err && err.message ? err.message : '请通过本地服务器打开页面。') + '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
