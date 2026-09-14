/* ==========================================================================
   home.js —— 首页：筛选（关键词 / 分类 / 年份 / 季度 / 制作公司）、排序、
               URL 可分享、年份轴、季度表、随机一部、分页渲染、本季热门
   ========================================================================== */

(function (global) {
  'use strict';

  var D = global.AnimeData;
  var UI = global.UI;
  var PAGE_SIZE = 48;
  var FILTER_KEY = 'anime-tracker:filters';

  var state = {
    keyword: '', category: '全部', year: '', season: '', studio: '', sort: 'score', format: ''
  };
  var all = [];
  var trending = { items: [] };
  var filteredCache = [];
  var rendered = 0;

  /* ------------------------------------------------------------ 筛选逻辑 */

  function matches(anime) {
    if (state.category !== '全部' && (anime.categories || []).indexOf(state.category) === -1) { return false; }
    if (state.year && String(anime.year || '') !== String(state.year)) { return false; }
    if (state.season && anime.season !== state.season) { return false; }
    if (state.format && anime.format !== state.format) { return false; }
    if (state.studio && (anime.studios || []).indexOf(state.studio) === -1) { return false; }
    if (state.keyword) {
      var hay = D.searchText(anime);
      var words = state.keyword.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(words[i]) === -1) { return false; }
      }
    }
    return true;
  }

  function sortList(list) {
    var copy = list.slice();
    switch (state.sort) {
      case 'popularity':
        return copy.sort(function (a, b) { return (b.scoredBy || 0) - (a.scoredBy || 0); });
      case 'year-desc':
        return copy.sort(function (a, b) { return (b.year || 0) - (a.year || 0) || (b.score || 0) - (a.score || 0); });
      case 'year-asc':
        return copy.sort(function (a, b) { return (a.year || 9999) - (b.year || 9999) || (b.score || 0) - (a.score || 0); });
      case 'name':
        return copy.sort(function (a, b) {
          return D.displayTitle(a).localeCompare(D.displayTitle(b), 'zh-Hans-CN');
        });
      case 'episodes':
        return copy.sort(function (a, b) { return (b.episodes || 0) - (a.episodes || 0); });
      case 'score':
      default:
        return copy.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    }
  }

  function applyFilters() {
    filteredCache = sortList(all.filter(matches));
    return filteredCache;
  }

  /* --------------------------------------------------------- URL 与记忆 */

  function stateToParams() {
    var p = new global.URLSearchParams();
    if (state.keyword) { p.set('q', state.keyword); }
    if (state.category !== '全部') { p.set('genre', state.category); }
    if (state.year) { p.set('year', state.year); }
    if (state.season) { p.set('season', state.season); }
    if (state.studio) { p.set('studio', state.studio); }
    if (state.format) { p.set('format', state.format); }
    if (state.sort !== 'score') { p.set('sort', state.sort); }
    return p.toString();
  }

  function syncUrl(replace) {
    var qs = stateToParams();
    var url = global.location.pathname + (qs ? '?' + qs : '');
    try {
      global.history[replace === false ? 'pushState' : 'replaceState']({}, '', url);
    } catch (e) { /* file:// 下可能受限，忽略 */ }
    try {
      global.localStorage.setItem(FILTER_KEY, JSON.stringify(state));
    } catch (e) { /* ignore */ }
  }

  function readStateFromUrl() {
    var p = new global.URLSearchParams(global.location.search);
    var s = { keyword: '', category: '全部', year: '', season: '', studio: '', sort: 'score', format: '' };
    if (p.get('q')) { s.keyword = p.get('q'); }
    if (p.get('genre') && D.CATEGORIES.indexOf(p.get('genre')) !== -1) { s.category = p.get('genre'); }
    if (p.get('year')) { s.year = p.get('year'); }
    if (p.get('season')) { s.season = p.get('season'); }
    if (p.get('studio')) { s.studio = p.get('studio'); }
    if (p.get('format')) { s.format = p.get('format'); }
    if (p.get('sort')) { s.sort = p.get('sort'); }
    return s;
  }

  function hasUrlFilters() { return !!global.location.search.replace(/^\?/, ''); }

  function restoreRemembered() {
    try {
      var raw = global.localStorage.getItem(FILTER_KEY);
      if (!raw) { return null; }
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') { return null; }
      return {
        keyword: s.keyword || '', category: s.category || '全部', year: s.year || '',
        season: s.season || '', studio: s.studio || '', sort: s.sort || 'score', format: s.format || ''
      };
    } catch (e) { return null; }
  }

  /* -------------------------------------------------------------- 视图 */

  function renderChips() {
    var wrap = document.getElementById('categoryChips');
    wrap.innerHTML = '';
    D.CATEGORIES.forEach(function (name) {
      var chip = UI.el('button', 'chip', name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(name === state.category));
      chip.addEventListener('click', function () {
        state.category = name;
        resetAndRender(false);
      });
      wrap.appendChild(chip);
    });
  }

  function renderYearAxis() {
    var wrap = document.getElementById('yearAxis');
    wrap.innerHTML = '';
    var years = D.yearList(all);
    var allChip = UI.el('button', 'chip chip-sm', '全部年份');
    allChip.type = 'button';
    allChip.setAttribute('aria-pressed', String(!state.year));
    allChip.addEventListener('click', function () { state.year = ''; resetAndRender(false); });
    wrap.appendChild(allChip);
    years.forEach(function (y) {
      var chip = UI.el('button', 'chip chip-sm', String(y));
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(String(state.year) === String(y)));
      chip.addEventListener('click', function () {
        state.year = String(state.year) === String(y) ? '' : String(y);
        resetAndRender(false);
      });
      wrap.appendChild(chip);
    });
  }

  function renderStudioOptions() {
    var select = document.getElementById('studioSelect');
    var studios = D.studioList(all);
    select.innerHTML = '';
    var optAll = UI.el('option', null, '全部制作公司');
    optAll.value = '';
    select.appendChild(optAll);
    studios.filter(function (s) { return s.count >= 2; }).forEach(function (s) {
      var opt = UI.el('option', null, s.label + ' · ' + s.count + ' 部');
      opt.value = s.name;
      if (s.name === state.studio) { opt.selected = true; }
      select.appendChild(opt);
    });
    if (state.studio) { select.value = state.studio; }
  }

  function renderSeasonBoard() {
    var board = document.getElementById('seasonBoard');
    var year = state.year ? Number(state.year) : new Date().getFullYear();
    var seasons = ['winter', 'spring', 'summer', 'fall'];
    var counts = {};
    seasons.forEach(function (s) { counts[s] = 0; });
    all.forEach(function (a) {
      if (a.year === year && a.season && counts[a.season] !== undefined) { counts[a.season] += 1; }
    });
    var total = seasons.reduce(function (n, s) { return n + counts[s]; }, 0);
    if (!total) {
      board.hidden = true;
      return;
    }
    board.hidden = false;
    document.getElementById('seasonBoardTitle').textContent = year + ' 年季度表';
    var wrap = document.getElementById('seasonChips');
    wrap.innerHTML = '';
    seasons.forEach(function (s) {
      var active = state.season === s && String(state.year) === String(year);
      var chip = UI.el('button', 'chip', D.seasonZh(s) + ' ' + counts[s]);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(active));
      chip.addEventListener('click', function () {
        if (active) { state.season = ''; } else { state.season = s; state.year = String(year); }
        resetAndRender(false);
      });
      wrap.appendChild(chip);
    });
  }

  function renderList(reset) {
    var grid = document.getElementById('posterGrid');
    if (reset) {
      grid.innerHTML = '';
      rendered = 0;
      UI.skeletonGrid(grid, Math.min(PAGE_SIZE, filteredCache.length || PAGE_SIZE));
    }
    var slice = filteredCache.slice(rendered, rendered + PAGE_SIZE);
    if (reset) { grid.innerHTML = ''; }
    var frag = document.createDocumentFragment();
    slice.forEach(function (a) { frag.appendChild(UI.posterCard(a, { onToggleFavorite: refreshStats })); });
    grid.appendChild(frag);
    rendered += slice.length;

    var more = document.getElementById('loadMoreBtn');
    var left = filteredCache.length - rendered;
    more.hidden = left <= 0;
    if (left > 0) { more.textContent = '加载更多（还有 ' + left + ' 部）'; }
    document.getElementById('resultCount').textContent = summaryText();
  }

  function summaryText() {
    var parts = [];
    if (state.keyword) { parts.push('关键词「' + state.keyword + '」'); }
    if (state.category !== '全部') { parts.push(state.category); }
    if (state.year) { parts.push(state.year + ' 年'); }
    if (state.season) { parts.push(D.seasonZh(state.season)); }
    if (state.studio) { parts.push(state.studio); }
    if (state.format) { parts.push(state.format); }
    return (parts.length ? parts.join(' · ') + ' · ' : '') + '共 ' + filteredCache.length + ' 部';
  }

  function renderEmpty() {
    var grid = document.getElementById('posterGrid');
    grid.innerHTML = '';
    grid.appendChild(UI.emptyBox({
      emptyTitle: '没有找到匹配的番剧',
      emptyDesc: '试试别的关键词，或点下面的按钮清空筛选。',
      emptyAction: { label: '重置全部筛选', onClick: resetAll }
    }));
    document.getElementById('loadMoreBtn').hidden = true;
    document.getElementById('resultCount').textContent = '共 0 部';
  }

  function renderFiltersUI() {
    renderChips();
    renderYearAxis();
    renderStudioOptions();
    renderSeasonBoard();
    var sortSelect = document.getElementById('sortSelect');
    sortSelect.value = state.sort;
    var formatSelect = document.getElementById('formatSelect');
    if (formatSelect) { formatSelect.value = state.format; }
    var input = document.getElementById('searchInput');
    if (input.value !== state.keyword) { input.value = state.keyword; }
    document.getElementById('searchBox').classList.toggle('has-value', !!state.keyword);
  }

  function renderAll(reset) {
    renderFiltersUI();
    applyFilters();
    if (!filteredCache.length) { renderEmpty(); return; }
    renderList(reset !== false);
  }

  function resetAndRender(push) {
    syncUrl(push === true ? false : true);
    renderAll(true);
  }

  function resetAll() {
    state = { keyword: '', category: '全部', year: '', season: '', studio: '', sort: 'score', format: '' };
    resetAndRender(false);
  }

  function refreshStats() {
    document.getElementById('statFav').textContent = String(global.AnimeStore.favoritesCount());
  }

  /* ---------------------------------------------------------------- 区块 */

  function renderTrending() {
    var section = document.getElementById('trendingSection');
    var strip = document.getElementById('trendingStrip');
    var items = (trending && trending.items) || [];
    if (!items.length) { section.hidden = true; return; }
    section.hidden = false;
    strip.innerHTML = '';
    items.forEach(function (item) { strip.appendChild(UI.trendingCard(item)); });
    document.getElementById('trendingMeta').textContent =
      '数据源：' + (trending.source || 'AniList') + (trending.season ? ' · ' + trending.season : '')
      + ' · 共 ' + items.length + ' 部，全部可在站内打开详情';
  }

  function renderContinue() {
    var section = document.getElementById('continueSection');
    var grid = document.getElementById('continueGrid');
    var progress = global.AnimeStore.all().progress;
    var rows = Object.keys(progress).map(function (id) {
      return { anime: D.find(all, id), at: global.AnimeStore.progressUpdatedAt(id) };
    }).filter(function (r) { return r.anime; })
      .sort(function (a, b) { return b.at - a.at; })
      .slice(0, 4);
    if (!rows.length) { section.hidden = true; grid.innerHTML = ''; return; }
    section.hidden = false;
    grid.innerHTML = '';
    rows.forEach(function (row) {
      grid.appendChild(UI.progressItem(row.anime, {
        showClearProgress: true,
        onChange: function () { renderContinue(); refreshStats(); }
      }));
    });
  }

  function renderStats() {
    document.getElementById('statTotal').textContent = String(all.length);
    document.getElementById('statCn').textContent = String(all.filter(function (a) { return a.name_cn; }).length);
    document.getElementById('statPv').textContent = String(all.filter(function (a) { return a.trailer; }).length);
    document.getElementById('statFav').textContent = String(global.AnimeStore.favoritesCount());
    document.getElementById('statData').textContent = D.animeSource() || '—';
  }

  /* ---------------------------------------------------------------- 交互 */

  function bindSearch() {
    var input = document.getElementById('searchInput');
    var box = document.getElementById('searchBox');
    var clear = document.getElementById('searchClear');
    var onInput = UI.debounce(function () {
      state.keyword = input.value.trim();
      box.classList.toggle('has-value', input.value.length > 0);
      resetAndRender(true);
    }, 180);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { state.keyword = input.value.trim(); resetAndRender(true); }
      if (ev.key === 'Escape') {
        input.value = ''; state.keyword = '';
        box.classList.remove('has-value'); resetAndRender(true);
      }
    });
    clear.addEventListener('click', function () {
      input.value = ''; state.keyword = '';
      box.classList.remove('has-value');
      input.focus();
      resetAndRender(true);
    });
  }

  function bindControls() {
    document.getElementById('sortSelect').addEventListener('change', function (ev) {
      state.sort = ev.target.value;
      resetAndRender(true);
    });
    var formatSelect = document.getElementById('formatSelect');
    if (formatSelect) {
      formatSelect.addEventListener('change', function (ev) {
        state.format = ev.target.value;
        resetAndRender(true);
      });
    }
    document.getElementById('studioSelect').addEventListener('change', function (ev) {
      state.studio = ev.target.value;
      resetAndRender(true);
    });
    document.getElementById('loadMoreBtn').addEventListener('click', function () { renderList(false); });
    document.getElementById('randomBtn').addEventListener('click', randomAnime);
    document.getElementById('resetBtn').addEventListener('click', resetAll);
  }

  function randomAnime() {
    var pool = filteredCache.length ? filteredCache : all;
    if (!pool.length) { return; }
    var pick = pool[Math.floor(Math.random() * pool.length)];
    global.location.href = UI.detailUrl(pick.id);
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target && ev.target.tagName) || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.target.isContentEditable;
      if (typing) { return; }
      if (ev.key === '/') {
        ev.preventDefault();
        document.getElementById('searchInput').focus();
      } else if (ev.key === 'r' || ev.key === 'R') {
        ev.preventDefault();
        randomAnime();
      }
    });
  }

  function bindInfiniteScroll() {
    var more = document.getElementById('loadMoreBtn');
    if (!global.IntersectionObserver) { return; }
    var io = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !more.hidden && rendered < filteredCache.length) { renderList(false); }
      });
    }, { rootMargin: '400px' });
    io.observe(more);
  }

  function bindHistory() {
    global.addEventListener('popstate', function () {
      state = readStateFromUrl();
      renderAll(true);
    });
  }

  /* ---------------------------------------------------------------- 启动 */

  function init() {
    global.UI.skeletonGrid(document.getElementById('posterGrid'), 12);
    return Promise.all([D.load(), D.loadTrending()]).then(function (res) {
      all = res[0];
      trending = res[1] || { items: [] };

      state = hasUrlFilters() ? readStateFromUrl() : (restoreRemembered() || readStateFromUrl());
      if (state.year && !D.yearList(all).some(function (y) { return String(y) === String(state.year); })) { state.year = ''; }

      renderTrending();
      renderStats();
      renderContinue();
      bindSearch();
      bindControls();
      bindKeyboard();
      bindHistory();
      renderAll(true);
      bindInfiniteScroll();
    }).catch(function (err) {
      document.getElementById('posterGrid').innerHTML =
        '<div class="empty"><h3>数据加载失败</h3><p>' +
        UI.escapeHtml(err && err.message ? err.message : '请通过本地服务器打开页面（node serve.js）。') +
        '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
