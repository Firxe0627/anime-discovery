/* ==========================================================================
   mylist.js —— 我的追番：收藏、按集进度、状态筛选（在看 / 看完 / 计划看）、
                导出 JSON、清空
   ========================================================================== */

(function (global) {
  'use strict';

  var D = global.AnimeData;
  var el = global.UI.el;
  var all = [];
  var state = { filter: 'all' };

  var FILTERS = [
    { key: 'all', label: '全部收藏' },
    { key: 'watching', label: '在看' },
    { key: 'completed', label: '看完' },
    { key: 'planned', label: '计划看' },
    { key: 'progress', label: '有进度' }
  ];

  function favoriteAnimes() {
    return global.AnimeStore.favoriteIds()
      .map(function (id) { return D.find(all, id); })
      .filter(Boolean);
  }

  function statusOf(anime) {
    return global.AnimeStore.getStatus(anime.id, D.episodeTotal(anime));
  }

  function counts() {
    var list = favoriteAnimes();
    var out = { watching: 0, completed: 0, planned: 0, total: list.length, progress: 0 };
    list.forEach(function (anime) {
      out[statusOf(anime)] += 1;
      if (global.AnimeStore.watchedCount(anime.id) > 0) { out.progress += 1; }
    });
    return out;
  }

  function renderStats() {
    var c = counts();
    document.getElementById('statFav').textContent = String(c.total);
    document.getElementById('statWatching').textContent = String(c.watching);
    document.getElementById('statCompleted').textContent = String(c.completed);
    document.getElementById('statPlanned').textContent = String(c.planned);
  }

  function renderFilterChips() {
    var wrap = document.getElementById('statusChips');
    var c = counts();
    wrap.innerHTML = '';
    FILTERS.forEach(function (f) {
      var n = f.key === 'all' ? c.total : f.key === 'progress' ? c.progress : c[f.key];
      var chip = el('button', 'chip', f.label + ' ' + n);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(state.filter === f.key));
      chip.addEventListener('click', function () {
        state.filter = f.key;
        renderFilterChips();
        renderFavorites();
      });
      wrap.appendChild(chip);
    });
  }

  function filteredFavorites() {
    var list = favoriteAnimes();
    if (state.filter === 'all') { return list; }
    if (state.filter === 'progress') {
      return list.filter(function (a) { return global.AnimeStore.watchedCount(a.id) > 0; });
    }
    return list.filter(function (a) { return statusOf(a) === state.filter; });
  }

  function renderFavorites() {
    var grid = document.getElementById('favoriteGrid');
    var list = filteredFavorites();
    global.UI.renderGrid(grid, list, {
      emptyTitle: state.filter === 'all' ? '还没有收藏任何番剧' : '这个筛选下没有作品',
      emptyDesc: state.filter === 'all'
        ? '去首页点封面右上角的 ♥，或在详情页点「加入我的追番」。'
        : '换个状态标签看看，或到详情页调整追番状态。',
      emptyAction: state.filter === 'all'
        ? { label: '去首页看看', onClick: function () { global.location.href = 'index.html'; } }
        : { label: '显示全部', onClick: function () { state.filter = 'all'; renderFilterChips(); renderFavorites(); } },
      onToggleFavorite: function () { refresh(); }
    });
  }

  function progressRows() {
    var progress = global.AnimeStore.all().progress;
    return Object.keys(progress).map(function (id) {
      return { anime: D.find(all, id), at: progress[id].updatedAt || 0 };
    }).filter(function (row) { return row.anime; })
      .sort(function (a, b) { return b.at - a.at; });
  }

  function renderContinue() {
    var section = document.getElementById('continueSection');
    var grid = document.getElementById('continueGrid');
    var rows = progressRows();

    if (!rows.length) {
      section.hidden = true;
      grid.innerHTML = '';
      return;
    }
    section.hidden = false;
    grid.innerHTML = '';
    rows.slice(0, 6).forEach(function (row) {
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

  function renderRecent() {
    var section = document.getElementById('recentSection');
    var grid = document.getElementById('recentGrid');
    var rows = global.AnimeStore.recentList().map(function (r) {
      return { anime: D.find(all, r.id), at: r.at };
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
    renderFilterChips();
    renderFavorites();
    renderContinue();
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
    var notice = document.getElementById('storageNotice');
    notice.hidden = global.AnimeStore.isPersistent;
    if (!global.AnimeStore.isPersistent) {
      notice.textContent = '提示：当前浏览器禁用了 localStorage（例如隐私模式），'
        + '这次的收藏与进度只保留在本页面内，刷新后会丢失。';
    }

    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('clearAllBtn').addEventListener('click', function () {
      if (!global.confirm('确定要清空所有本地追番数据吗？此操作不可撤销。')) { return; }
      global.AnimeStore.clearAll();
      state.filter = 'all';
      refresh();
    });

    return D.load().then(function (list) {
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
