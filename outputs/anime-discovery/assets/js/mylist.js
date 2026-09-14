/* ==========================================================================
   mylist.js —— 我的追番
     想看 / 在看 / 看完 / 弃番 四种状态 + 计数、进度条（看到第几集）、
     继续看（按在看进度排序）、猜你也想看（纯前端标签推荐）、
     导出 JSON / 导入 JSON / 复制分享码 / 清空
   ========================================================================== */

(function (global) {
  'use strict';

  var D = global.AnimeData;
  var UI = global.UI;
  var el = UI.el;

  var all = [];
  var state = { filter: 'all' };

  var FILTERS = [
    { key: 'all', label: '全部收藏' },
    { key: 'watching', label: '在看' },
    { key: 'completed', label: '看完' },
    { key: 'planned', label: '想看' },
    { key: 'dropped', label: '弃番' },
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
    var out = { watching: 0, completed: 0, planned: 0, dropped: 0, total: list.length, progress: 0, episodes: 0 };
    list.forEach(function (anime) {
      out[statusOf(anime)] += 1;
      var done = global.AnimeStore.watchedCount(anime.id);
      if (done > 0) { out.progress += 1; }
      out.episodes += done;
    });
    return out;
  }

  function renderStats() {
    var c = counts();
    document.getElementById('statFav').textContent = String(c.total);
    document.getElementById('statPlanned').textContent = String(c.planned);
    document.getElementById('statWatching').textContent = String(c.watching);
    document.getElementById('statCompleted').textContent = String(c.completed);
    document.getElementById('statDropped').textContent = String(c.dropped);
    document.getElementById('statEpisodes').textContent = String(c.episodes);
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
    UI.renderGrid(grid, list, {
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

  /* --------------------------------------------------------- 继续看 */

  function renderContinue() {
    var section = document.getElementById('continueSection');
    var grid = document.getElementById('continueGrid');
    var rows = global.AnimeStore.favoriteIds().map(function (id) {
      return { anime: D.find(all, id), at: global.AnimeStore.progressUpdatedAt(id) };
    }).filter(function (row) {
      return row.anime && global.AnimeStore.watchedCount(row.anime.id) > 0
        && global.AnimeStore.getStatus(row.anime.id, D.episodeTotal(row.anime)) === 'watching';
    }).sort(function (a, b) { return b.at - a.at; });

    if (!rows.length) { section.hidden = true; grid.innerHTML = ''; return; }
    section.hidden = false;
    grid.innerHTML = '';
    rows.slice(0, 6).forEach(function (row) {
      var date = row.at ? new Date(row.at) : null;
      var note = '最近看到于 ' + (date
        ? date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—');
      grid.appendChild(UI.progressItem(row.anime, {
        note: note, showClearProgress: true, onChange: refresh
      }));
    });
  }

  /* --------------------------------------------------- 猜你也想看 */

  function renderRecommend() {
    var section = document.getElementById('recommendSection');
    var grid = document.getElementById('recommendGrid');
    var favorites = favoriteAnimes();
    if (favorites.length < 2) { section.hidden = true; grid.innerHTML = ''; return; }
    var picks = D.recommend(all, favorites, 6);
    if (!picks.length) { section.hidden = true; grid.innerHTML = ''; return; }
    section.hidden = false;
    grid.innerHTML = '';
    picks.forEach(function (a) {
      grid.appendChild(UI.posterCard(a, { onToggleFavorite: refresh }));
    });
  }

  /* ------------------------------------------------------ 最近浏览 */

  function renderRecent() {
    var section = document.getElementById('recentSection');
    var grid = document.getElementById('recentGrid');
    var rows = global.AnimeStore.recentList().map(function (r) {
      return { anime: D.find(all, r.id), at: r.at };
    }).filter(function (row) { return row.anime; });
    if (!rows.length) { section.hidden = true; grid.innerHTML = ''; return; }
    section.hidden = false;
    grid.innerHTML = '';
    rows.slice(0, 8).forEach(function (row) {
      var date = row.at ? new Date(row.at) : null;
      var isFav = global.AnimeStore.isFavorite(row.anime.id);
      grid.appendChild(UI.progressItem(row.anime, {
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
    renderRecommend();
    renderRecent();
    UI.refreshBadge();
  }

  /* --------------------------------------------------- 导入 / 导出 */

  function setMessage(text, kind) {
    var box = document.getElementById('dataMessage');
    box.textContent = text;
    box.className = 'data-message' + (kind ? ' ' + kind : '');
    box.hidden = !text;
  }

  function exportJson() {
    var payload = global.AnimeStore.exportPayload();
    var blob = new global.Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = global.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'anime-tracker-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 1000);
    setMessage('已导出 ' + Object.keys(payload.data.favorites).length + ' 条收藏记录。', 'ok');
  }

  function importFile(file) {
    if (!file) { return; }
    var reader = new global.FileReader();
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(String(reader.result)); } catch (e) {
        setMessage('导入失败：文件不是有效的 JSON。', 'err');
        return;
      }
      var res = global.AnimeStore.importPayload(parsed);
      if (!res.ok) { setMessage('导入失败：' + res.message, 'err'); return; }
      refresh();
      setMessage('导入完成：新增收藏 ' + res.stats.favorites + ' 条、进度 ' + res.stats.progress
        + ' 条、状态 ' + res.stats.status + ' 条（不会删除已有记录）。', 'ok');
    };
    reader.readAsText(file);
  }

  function copyShareCode() {
    var code = global.AnimeStore.shareCode();
    var area = document.getElementById('shareArea');
    area.value = code;
    var done = function () { setMessage('分享码已生成并复制（' + code.length + ' 字符），发给朋友即可导入。', 'ok'); };
    var fail = function () {
      area.focus();
      area.select();
      setMessage('已生成分享码，复制失败请手动全选复制下方文本。', 'warn');
    };
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(code).then(done).catch(fail);
    } else {
      fail();
    }
  }

  function importShareCode() {
    var area = document.getElementById('shareArea');
    var code = (area.value || '').trim();
    if (!code) { setMessage('请先把分享码粘贴到下面的文本框里。', 'warn'); return; }
    var res = global.AnimeStore.importShareCode(code);
    if (!res.ok) { setMessage('导入分享码失败：' + res.message, 'err'); return; }
    refresh();
    setMessage('分享码导入完成：共解析 ' + res.count + ' 条，新增收藏 ' + res.stats.favorites
      + ' 条、进度 ' + res.stats.progress + ' 条。', 'ok');
  }

  function bindDataTools() {
    document.getElementById('exportBtn').addEventListener('click', exportJson);
    document.getElementById('importInput').addEventListener('change', function (ev) {
      importFile(ev.target.files && ev.target.files[0]);
      ev.target.value = '';
    });
    document.getElementById('shareBtn').addEventListener('click', copyShareCode);
    document.getElementById('importShareBtn').addEventListener('click', importShareCode);
    document.getElementById('clearAllBtn').addEventListener('click', function () {
      if (!global.confirm('确定要清空所有本地追番数据吗？此操作不可撤销（建议先导出备份）。')) { return; }
      global.AnimeStore.clearAll();
      state.filter = 'all';
      refresh();
      setMessage('已清空全部本地追番数据。', 'ok');
    });
  }

  function init() {
    var notice = document.getElementById('storageNotice');
    notice.hidden = global.AnimeStore.isPersistent;
    if (!global.AnimeStore.isPersistent) {
      notice.textContent = '提示：当前浏览器禁用了 localStorage（例如隐私模式），'
        + '这次的收藏与进度只保留在本页面内，刷新后会丢失。';
    }
    bindDataTools();
    return D.load().then(function (list) {
      all = list;
      refresh();
    }).catch(function (err) {
      document.getElementById('favoriteGrid').innerHTML =
        '<div class="empty"><h3>数据加载失败</h3><p>' +
        UI.escapeHtml(err && err.message ? err.message : '请通过本地服务器打开页面（node serve.js）。') + '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
