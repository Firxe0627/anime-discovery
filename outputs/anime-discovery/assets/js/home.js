/* ==========================================================================
   home.js —— 首页
     一套筛选：搜索（按钮 / 回车 / 300ms 防抖）+ 分类 / 年份 / 季度 / 制作公司 / 类型 / 排序
     命中数量（分面计数，0 命中灰掉或隐藏）、条件标签可单条去掉、URL 可分享、
     分批渲染 + 接近底部自动加载（按钮仅作后备）、随机一部、本季热门快照说明
   ========================================================================== */

(function (global) {
  'use strict';

  var D = global.AnimeData;
  var UI = global.UI;

  var PAGE_SIZE = 48;
  var SEARCH_DEBOUNCE = 300;        // 输入停顿 300ms 即自动筛选
  var SCROLL_KEY = D.SCROLL_KEY || 'anime-tracker:scroll';
  var RETURN_KEY = D.RETURN_KEY || 'anime-tracker:return';
  var HEADER_OFFSET = 84;           // 吸顶导航高度 + 余量
  var SEASONS = ['winter', 'spring', 'summer', 'fall'];
  var FORMATS = ['TV', 'MOVIE', 'ONA'];

  var state = D.defaultFilters();
  var all = [];
  var trending = { items: [] };
  var filtered = [];
  var rendered = 0;
  var facets = { category: {}, year: {}, season: {}, format: {} };
  var studioCounts = null;          // 制作公司命中数量：懒计算，筛选变化后失效
  var hintTimer = null;
  var scrollSaveTimer = null;
  var reduceMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ------------------------------------------------------------ 筛选逻辑 */

  function matches(a, s) {
    if (s.category !== '全部' && (a.categories || []).indexOf(s.category) === -1) { return false; }
    if (s.year && String(a.year || '') !== String(s.year)) { return false; }
    if (s.season && a.season !== s.season) { return false; }
    if (s.format && a.format !== s.format) { return false; }
    if (s.studio && (a.studios || []).indexOf(s.studio) === -1) { return false; }
    if (s.keyword) {
      var hay = D.searchText(a);
      var words = String(s.keyword).toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(words[i]) === -1) { return false; }
      }
    }
    return true;
  }

  function merge(base, patch) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(patch || {}).forEach(function (k) { out[k] = patch[k]; });
    return out;
  }

  /** 在「其它条件不变、只替换某一维」的前提下统计命中数量，供选项旁显示 */
  function countWith(patch) {
    var probe = merge(state, patch);
    var n = 0;
    for (var i = 0; i < all.length; i++) {
      if (matches(all[i], probe)) { n += 1; }
    }
    return n;
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

  function sortLabel(value) {
    var hit = (D.SORTS || []).filter(function (s) { return s.value === value; })[0];
    return hit ? hit.label : value;
  }

  function formatLabel(value) { return D.formatText({ format: value }); }

  function applyFilters() {
    filtered = sortList(all.filter(function (a) { return matches(a, state); }));
    studioCounts = null;
    computeFacets();
  }

  function computeFacets() {
    var next = { category: {}, year: {}, season: {}, format: {} };
    D.CATEGORIES.forEach(function (name) { next.category[name] = countWith({ category: name }); });
    D.yearList(all).forEach(function (y) { next.year[String(y)] = countWith({ year: String(y) }); });
    SEASONS.forEach(function (s) { next.season[s] = countWith({ season: s }); });
    FORMATS.forEach(function (f) { next.format[f] = countWith({ format: f }); });
    facets = next;
  }

  /** 制作公司命中数量：首次用到时才算，之后缓存到下次筛选变化 */
  function studioCount(name) {
    if (!studioCounts) {
      studioCounts = {};
      D.studioList(all).forEach(function (row) { studioCounts[row.name] = countWith({ studio: row.name }); });
    }
    return studioCounts[name] || 0;
  }

  /* --------------------------------------------------------- URL 与记忆 */

  function syncUrl() {
    var qs = D.filtersToQuery(state);
    var url = global.location.pathname + (qs ? '?' + qs : '');
    try { global.history.replaceState({}, '', url); } catch (e) { /* file:// 下可能受限，忽略 */ }
    D.rememberFilters(state);
  }

  function saveScroll() {
    try { global.sessionStorage.setItem(SCROLL_KEY, String(Math.round(global.scrollY || 0))); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------- 结果区顶部信息 */

  function conditionParts() {
    var parts = [];
    if (state.keyword) { parts.push('搜索「' + state.keyword + '」'); }
    if (state.category !== '全部') { parts.push('分类 ' + state.category); }
    if (state.year) { parts.push(state.year + ' 年'); }
    if (state.season) { parts.push(D.seasonZh(state.season)); }
    if (state.studio) { parts.push(D.studioLabel(state.studio)); }
    if (state.format) { parts.push(formatLabel(state.format)); }
    return parts;
  }

  function conditionSummary() {
    var parts = conditionParts();
    return parts.length ? parts.join(' · ') : '未设置筛选';
  }

  function renderResultHead() {
    document.getElementById('resultCount').textContent = '共 ' + filtered.length + ' 部';
  }

  function renderLibraryMeta() {
    var cn = all.filter(function (a) { return a.name_cn; }).length;
    var pv = all.filter(function (a) { return a.trailer; }).length;
    document.getElementById('libraryMeta').textContent =
      '资料库 ' + all.length + ' 部 · ' + cn + ' 部有中文名 · ' + pv + ' 部有官方 PV · 数据来源 ' + (D.animeSource() || '—');
    var total = document.getElementById('statTotalInline');
    if (total) { total.textContent = String(all.length); }
  }

  /** 当前条件标签：每颗可单独去掉（桌面与手机都显示，作为「已选条件」摘要） */
  function renderActiveChips() {
    var wrap = document.getElementById('activeChips');
    var clearBtn = document.getElementById('clearAllBtn');
    var countBadge = document.getElementById('filterCount');
    wrap.innerHTML = '';

    var chips = [];
    if (state.keyword) { chips.push({ key: 'keyword', label: '搜索：' + state.keyword }); }
    if (state.category !== '全部') { chips.push({ key: 'category', label: '分类：' + state.category }); }
    if (state.year) { chips.push({ key: 'year', label: state.year + ' 年' }); }
    if (state.season) { chips.push({ key: 'season', label: '季度：' + D.seasonZh(state.season) }); }
    if (state.studio) { chips.push({ key: 'studio', label: '公司：' + D.studioLabel(state.studio) }); }
    if (state.format) { chips.push({ key: 'format', label: '类型：' + formatLabel(state.format) }); }
    if (state.sort !== 'score') { chips.push({ key: 'sort', label: '排序：' + sortLabel(state.sort) }); }

    wrap.hidden = !chips.length;
    clearBtn.hidden = !chips.length;
    if (countBadge) {
      countBadge.textContent = String(chips.length);
      countBadge.hidden = !chips.length;
    }

    chips.forEach(function (chip) {
      var node = UI.el('span', 'filter-chip');
      node.appendChild(UI.el('span', 'filter-chip-label', chip.label));
      var x = UI.el('button', 'filter-chip-x', '✕');
      x.type = 'button';
      x.setAttribute('aria-label', '去掉筛选条件：' + chip.label);
      x.addEventListener('click', function () { removeChip(chip.key); });
      node.appendChild(x);
      wrap.appendChild(node);
    });
  }

  function removeChip(key) {
    if (key === 'sort') { state.sort = 'score'; }
    else if (key === 'category') { state.category = '全部'; }
    else { state[key] = ''; }
    if (key === 'keyword') { syncSearchInput(); }
    refresh({ scroll: true });
  }

  function clearAll() {
    state = D.defaultFilters();
    syncSearchInput();
    syncStudioInput(true);
    refresh({ scroll: true });
  }

  function hint(text) {
    var box = document.getElementById('filterHint');
    if (!box) { return; }
    box.textContent = text || '';
    box.hidden = !text;
    global.clearTimeout(hintTimer);
    if (text) {
      hintTimer = global.setTimeout(function () { box.textContent = ''; box.hidden = true; }, 5000);
    }
  }

  /* ------------------------------------------------------------- 筛选控件 */

  function chipLabel(name, count) {
    var node = UI.el('span', null, name + ' ');
    node.appendChild(UI.el('span', 'chip-count', String(count)));
    return node;
  }

  function renderCategoryChips() {
    var wrap = document.getElementById('categoryChips');
    wrap.innerHTML = '';
    D.CATEGORIES.forEach(function (name) {
      var count = facets.category[name] || 0;
      var active = name === state.category;
      var chip = UI.el('button', 'chip chip-cat');
      chip.type = 'button';
      chip.appendChild(chipLabel(name, count));
      chip.setAttribute('aria-pressed', String(active));
      chip.setAttribute('aria-label', '分类 ' + name + '，当前条件下 ' + count + ' 部');
      if (!count && !active) {
        chip.disabled = true;
        chip.className += ' is-empty';
        chip.title = '当前筛选条件下没有作品';
      }
      chip.addEventListener('click', function () {
        state.category = name;
        refresh({ scroll: true });
      });
      wrap.appendChild(chip);
    });
  }

  function fillSelect(select, items, keepValue) {
    select.innerHTML = '';
    items.forEach(function (item) {
      var opt = UI.el('option', null, item.label);
      opt.value = item.value;
      if (item.hidden) { opt.hidden = true; opt.disabled = true; }
      else if (item.disabled) { opt.disabled = true; }
      select.appendChild(opt);
    });
    select.value = keepValue;
  }

  function renderYearSelect() {
    var select = document.getElementById('yearSelect');
    var items = [{ value: '', label: '全部年份（' + filtered.length + '）' }];
    D.yearList(all).forEach(function (y) {
      var count = facets.year[String(y)] || 0;
      var selected = String(state.year) === String(y);
      items.push({ value: String(y), label: y + ' 年（' + count + '）', hidden: !count && !selected });
    });
    fillSelect(select, items, state.year || '');
  }

  function renderSeasonSelect() {
    var select = document.getElementById('seasonSelect');
    var items = [{ value: '', label: '全部季度' }];
    SEASONS.forEach(function (s) {
      var count = facets.season[s] || 0;
      var selected = state.season === s;
      items.push({ value: s, label: D.seasonZh(s) + '（' + count + '）', hidden: !count && !selected });
    });
    fillSelect(select, items, state.season || '');
  }

  function renderFormatSelect() {
    var select = document.getElementById('formatSelect');
    var items = [{ value: '', label: '全部类型' }];
    FORMATS.forEach(function (f) {
      var count = facets.format[f] || 0;
      var selected = state.format === f;
      items.push({ value: f, label: formatLabel(f) + '（' + count + '）', hidden: !count && !selected });
    });
    fillSelect(select, items, state.format || '');
  }

  function renderSortSelect() {
    var select = document.getElementById('sortSelect');
    select.innerHTML = '';
    (D.SORTS || []).forEach(function (s) {
      var opt = UI.el('option', null, s.label);
      opt.value = s.value;
      select.appendChild(opt);
    });
    select.value = state.sort;
  }

  function syncSearchInput() {
    var input = document.getElementById('searchInput');
    if (input.value !== state.keyword) { input.value = state.keyword || ''; }
    document.getElementById('searchBox').classList.toggle('has-value', !!state.keyword);
  }

  function syncStudioInput(force) {
    var input = document.getElementById('studioInput');
    if (!force && document.activeElement === input) { return; }
    input.value = state.studio ? D.studioLabel(state.studio) : '';
  }

  function renderFiltersUI() {
    renderCategoryChips();
    renderYearSelect();
    renderSeasonSelect();
    renderFormatSelect();
    renderSortSelect();
    syncStudioInput(false);
  }

  /* --------------------------------------------------- 制作公司可搜索下拉 */

  function studioQueryRows(query) {
    var rows = D.studioList(all).map(function (row) {
      return { name: row.name, label: row.label, count: studioCount(row.name) };
    });
    var q = String(query || '').trim();
    if (!q) { return rows; }
    var hit = D.matchStudios(rows, q);
    return hit.exact.concat(hit.partial);
  }

  function renderStudioList(query) {
    var list = document.getElementById('studioList');
    var rows = studioQueryRows(query);
    list.innerHTML = '';

    var allRow = UI.el('button', 'combo-item combo-item-all');
    allRow.type = 'button';
    allRow.setAttribute('role', 'option');
    if (!state.studio) { allRow.className += ' is-selected'; }
    allRow.appendChild(UI.el('span', 'combo-item-label', '全部制作公司'));
    allRow.appendChild(UI.el('span', 'combo-item-count', filtered.length + ' 部'));
    allRow.addEventListener('click', function () { pickStudio(''); });
    list.appendChild(allRow);

    if (!rows.length) {
      list.appendChild(UI.el('div', 'combo-empty',
        '没有匹配的制作公司。支持中文（如「京都动画」「京阿尼」）与英文（如 Kyoto Animation）。'));
      return;
    }

    rows.forEach(function (row) {
      var item = UI.el('button', 'combo-item');
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(row.name === state.studio));
      if (row.name === state.studio) { item.className += ' is-selected'; }
      item.appendChild(UI.el('span', 'combo-item-label', row.label));
      item.appendChild(UI.el('span', 'combo-item-count', row.count + ' 部'));
      if (!row.count) {
        item.disabled = true;
        item.className += ' is-empty';
        item.title = '当前筛选条件下该公司的作品为 0 部';
      }
      item.addEventListener('click', function () { pickStudio(row.name); });
      list.appendChild(item);
    });
  }

  function openStudioList(query) {
    var list = document.getElementById('studioList');
    renderStudioList(query);
    list.hidden = false;
    document.getElementById('studioInput').setAttribute('aria-expanded', 'true');
  }

  function closeStudioList() {
    var list = document.getElementById('studioList');
    if (!list || list.hidden) { return; }
    list.hidden = true;
    document.getElementById('studioInput').setAttribute('aria-expanded', 'false');
  }

  function pickStudio(name) {
    state.studio = name || '';
    closeStudioList();
    syncStudioInput(true);
    hint(name
      ? '已按制作公司筛选：' + D.studioLabel(name) + '（当前条件下 ' + studioCount(name) + ' 部）'
      : '已取消制作公司筛选');
    refresh({ scroll: true });
  }

  /* --------------------------------------------------------------- 空状态 */

  function renderEmpty() {
    var grid = document.getElementById('posterGrid');
    grid.style.minHeight = '';
    grid.classList.remove('is-updating');
    grid.innerHTML = '';
    grid.appendChild(UI.emptyBox({
      emptyTitle: '没有符合的作品',
      emptyDesc: '当前条件：' + conditionSummary() + ' —— 资料库里没有同时满足这些条件的作品。',
      emptyAction: { label: '清除筛选', onClick: clearAll }
    }));
    document.getElementById('loadMoreBtn').hidden = true;
  }

  /* ---------------------------------------------------------- 列表与分页 */

  function renderGrid(reset) {
    var grid = document.getElementById('posterGrid');
    if (reset) {
      // 先保留当前高度再重绘：筛选变化时不整页闪白、高度不跳
      var prevHeight = grid.offsetHeight;
      grid.style.minHeight = prevHeight ? prevHeight + 'px' : '';
      grid.classList.add('is-updating');
      grid.innerHTML = '';
      rendered = 0;
    }
    var slice = filtered.slice(rendered, rendered + PAGE_SIZE);
    var frag = document.createDocumentFragment();
    slice.forEach(function (a) { frag.appendChild(UI.posterCard(a, {})); });
    grid.appendChild(frag);
    rendered += slice.length;

    if (reset) {
      global.requestAnimationFrame(function () {
        grid.style.minHeight = '';
        grid.classList.remove('is-updating');
      });
    }
    updateLoadMore();
    autoLoad();
  }

  function updateLoadMore() {
    var btn = document.getElementById('loadMoreBtn');
    var left = filtered.length - rendered;
    var show = left > 0;
    btn.hidden = !show;
    if (show) { btn.textContent = '显示更多（还剩 ' + left + ' 部）'; }
  }

  function loadMore() {
    if (rendered >= filtered.length) { updateLoadMore(); return; }
    renderGrid(false);
  }

  /** 接近底部就自动加载下一批；按钮只是后备入口 */
  function autoLoad() {
    if (!filtered.length || rendered >= filtered.length) { return; }
    var sentinel = document.getElementById('gridSentinel');
    if (!sentinel) { return; }
    var rect = sentinel.getBoundingClientRect();
    if (rect.top < global.innerHeight + 520) { renderGrid(false); }
  }

  /** 滚动 / 观察哨：接近列表底部就自动加载，不必点按钮 */
  function bindAutoLoad() {
    var ticking = false;
    global.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      global.requestAnimationFrame(function () { ticking = false; autoLoad(); });
    }, { passive: true });
    if (!global.IntersectionObserver) { return; }
    var sentinel = document.getElementById('gridSentinel');
    if (!sentinel) { return; }
    var io = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { autoLoad(); } });
    }, { rootMargin: '520px 0px' });
    io.observe(sentinel);
  }

  function scrollToResults() {
    var head = document.getElementById('resultsHead');
    if (!head) { return; }
    var rect = head.getBoundingClientRect();
    if (rect.top >= HEADER_OFFSET && rect.top <= global.innerHeight - 80) { return; }
    var top = Math.max(0, Math.round(rect.top + (global.scrollY || 0) - HEADER_OFFSET));
    if (reduceMotion) { global.scrollTo(0, top); return; }
    try { global.scrollTo({ top: top, behavior: 'smooth' }); } catch (e) { global.scrollTo(0, top); }
  }

  /* ---------------------------------------------------------------- 搜索 */

  /** 输入的公司名能否唯一匹配某家公司：能则自动套用公司筛选 */
  function uniqueStudioMatch(keyword) {
    var q = String(keyword || '').trim();
    if (!D.matchStudios || q.length < 2) { return { row: null, others: 0 }; }
    var rows = D.studioList(all).map(function (row) { return { name: row.name, label: row.label }; });
    var hit = D.matchStudios(rows, q);
    if (hit.exact.length === 1) { return { row: hit.exact[0], others: hit.exact.length + hit.partial.length - 1 }; }
    if (!hit.exact.length && hit.partial.length === 1) { return { row: hit.partial[0], others: 0 }; }
    return { row: null, others: hit.exact.length + hit.partial.length };
  }

  function commitSearch(opts) {
    opts = opts || {};
    var input = document.getElementById('searchInput');
    var keyword = String(input.value || '').trim();
    var hit = uniqueStudioMatch(keyword);

    if (hit.row) {
      state.keyword = '';
      state.studio = hit.row.name;
      syncSearchInput();
      syncStudioInput(true);
      hint('「' + keyword + '」唯一匹配制作公司，已自动套用筛选：' + D.studioLabel(hit.row.name)
        + ' · 当前条件下 ' + studioCount(hit.row.name) + ' 部');
    } else {
      state.keyword = keyword;
      syncSearchInput();
      if (hit.others > 1) {
        hint('「' + keyword + '」能匹配到多个制作公司，可在「制作公司」下拉里精确选择。');
      }
    }
    refresh({ scroll: opts.scroll !== false });
  }

  function bindSearch() {
    var input = document.getElementById('searchInput');
    var box = document.getElementById('searchBox');
    var clear = document.getElementById('searchClear');
    var timer = null;

    function flush() {
      global.clearTimeout(timer);
      commitSearch({ scroll: true });
    }

    input.addEventListener('input', function () {
      box.classList.toggle('has-value', input.value.length > 0);
      global.clearTimeout(timer);
      timer = global.setTimeout(flush, SEARCH_DEBOUNCE);   // 300ms 防抖：停顿即筛选
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); flush(); }
      else if (ev.key === 'Escape') {
        input.value = '';
        state.keyword = '';
        box.classList.remove('has-value');
        flush();
      }
    });
    clear.addEventListener('click', function () {
      input.value = '';
      state.keyword = '';
      box.classList.remove('has-value');
      input.focus();
      flush();
    });
    document.getElementById('searchBtn').addEventListener('click', flush);
  }

  /* ------------------------------------------------------------ 其它交互 */

  function bindControls() {
    document.getElementById('yearSelect').addEventListener('change', function (ev) {
      state.year = ev.target.value;
      refresh({ scroll: true });
    });
    document.getElementById('seasonSelect').addEventListener('change', function (ev) {
      state.season = ev.target.value;
      refresh({ scroll: true });
    });
    document.getElementById('formatSelect').addEventListener('change', function (ev) {
      state.format = ev.target.value;
      refresh({ scroll: true });
    });
    document.getElementById('sortSelect').addEventListener('change', function (ev) {
      state.sort = ev.target.value;
      refresh({ scroll: true });
    });
    document.getElementById('clearAllBtn').addEventListener('click', clearAll);
    document.getElementById('loadMoreBtn').addEventListener('click', loadMore);
    document.getElementById('randomBtn').addEventListener('click', randomAnime);
    document.getElementById('trendingAllBtn').addEventListener('click', showTrendingSeason);

    var toggle = document.getElementById('filterToggleBtn');
    toggle.addEventListener('click', function () {
      var bar = document.getElementById('filterBar');
      var open = bar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.filter-toggle-text').textContent = open ? '收起筛选' : '筛选';
    });

    bindStudioCombo();
  }

  function bindStudioCombo() {
    var input = document.getElementById('studioInput');
    var list = document.getElementById('studioList');
    var combo = document.getElementById('studioCombo');

    input.addEventListener('focus', function () {
      input.select();
      openStudioList(state.studio && input.value === D.studioLabel(state.studio) ? '' : input.value);
    });
    input.addEventListener('input', function () { openStudioList(input.value); });
    input.addEventListener('keydown', function (ev) {
      var items = Array.prototype.filter.call(list.querySelectorAll('.combo-item'), function (n) { return !n.disabled; });
      var active = items.indexOf(list.querySelector('.combo-item.is-focus'));
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (list.hidden) { openStudioList(input.value); return; }
        if (!items.length) { return; }
        var next = ev.key === 'ArrowDown' ? active + 1 : active - 1;
        if (next < 0) { next = items.length - 1; }
        if (next >= items.length) { next = 0; }
        items.forEach(function (n) { n.classList.remove('is-focus'); });
        items[next].classList.add('is-focus');
        if (items[next].scrollIntoView) { items[next].scrollIntoView({ block: 'nearest' }); }
      } else if (ev.key === 'Enter') {
        if (active >= 0) { ev.preventDefault(); items[active].click(); }
        else if (items.length === 1) { ev.preventDefault(); items[0].click(); }
      } else if (ev.key === 'Escape') {
        closeStudioList();
        syncStudioInput(true);
      }
    });
    combo.addEventListener('focusout', function () {
      global.setTimeout(function () {
        if (!combo.contains(document.activeElement)) {
          closeStudioList();
          syncStudioInput(true);
        }
      }, 150);
    });
    document.addEventListener('click', function (ev) {
      if (!combo.contains(ev.target)) { closeStudioList(); }
    });
  }

  function randomAnime() {
    if (!filtered.length) {
      hint('当前筛选结果是 0 部，先清除筛选再随机。');
      scrollToResults();
      return;
    }
    var pick = filtered[Math.floor(Math.random() * filtered.length)];
    global.location.href = UI.detailUrl(pick.id);
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (ev) {
      var target = ev.target || {};
      var tag = target.tagName || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
      if (typing) { return; }                     // 搜索框 / 下拉聚焦时按 r 不随机
      if (ev.key === '/') {
        ev.preventDefault();
        var bar = document.getElementById('filterBar');
        if (bar) { bar.classList.add('is-open'); }
        document.getElementById('searchInput').focus();
      } else if (ev.key === 'r' || ev.key === 'R') {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) { return; }
        ev.preventDefault();
        randomAnime();
      }
    });
  }

  function bindHistory() {
    global.addEventListener('popstate', function () {
      state = D.filtersFromQuery(global.location.search);
      syncSearchInput();
      syncStudioInput(true);
      refresh({ scroll: false });
    });
  }

  function bindScrollMemory() {
    global.addEventListener('pagehide', saveScroll);
    global.addEventListener('scroll', function () {
      global.clearTimeout(scrollSaveTimer);
      scrollSaveTimer = global.setTimeout(saveScroll, 200);
    }, { passive: true });
  }

  /** 从详情页返回时恢复滚动位置（筛选由 localStorage / 网址参数恢复） */
  function restoreScrollIfReturning() {
    var returning = false;
    var saved = 0;
    try {
      returning = global.sessionStorage.getItem(RETURN_KEY) === '1';
      saved = Number(global.sessionStorage.getItem(SCROLL_KEY) || 0);
      if (returning) { global.sessionStorage.removeItem(RETURN_KEY); }
    } catch (e) { /* ignore */ }
    var type = '';
    try { type = (global.performance.getEntriesByType('navigation')[0] || {}).type || ''; } catch (e) { /* ignore */ }
    if (!returning && type !== 'back_forward') { return; }
    if (!isFinite(saved) || saved <= 0) { return; }
    var apply = function () { global.scrollTo(0, Math.round(saved)); };
    global.requestAnimationFrame(function () { apply(); global.setTimeout(apply, 80); });
  }

  /* ------------------------------------------------------------ 本季热门 */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function formatStamp(iso) {
    if (!iso) { return ''; }
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
      + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** 热门快照对应的年份 / 季节：取条目里出现最多的组合，不猜、不编造 */
  function trendingSeason() {
    var items = (trending && trending.items) || [];
    var tally = {};
    items.forEach(function (item) {
      if (!item.year || !item.season) { return; }
      var key = item.year + '|' + item.season;
      tally[key] = (tally[key] || 0) + 1;
    });
    var best = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; })[0];
    if (!best) { return null; }
    var parts = best.split('|');
    return { year: Number(parts[0]), season: parts[1] };
  }

  function renderTrending() {
    var section = document.getElementById('trendingSection');
    var strip = document.getElementById('trendingStrip');
    var items = (trending && trending.items) || [];
    var btn = document.getElementById('trendingAllBtn');
    if (!items.length) { section.hidden = true; btn.hidden = true; return; }
    section.hidden = false;
    strip.innerHTML = '';
    items.forEach(function (item) { strip.appendChild(UI.trendingCard(item)); });

    // 小字说明：这是抓取快照；有生成时间就显示，没有就沿用现有季节文案（不编造日期）
    var notes = ['这是上次抓取的快照，不会随新一季自动更换'];
    var stamp = formatStamp(trending.generatedAt);
    if (stamp) { notes.push('生成时间 ' + stamp + '（本地时间）'); }
    else if (trending.season) { notes.push(trending.season); }
    notes.push('数据源：' + (trending.source || 'AniList'));
    notes.push('共 ' + items.length + ' 部，全部可在站内打开详情');
    document.getElementById('trendingMeta').textContent = notes.join(' · ');

    var target = trendingSeason();
    var inLibrary = target ? all.filter(function (a) {
      return String(a.year) === String(target.year) && a.season === target.season;
    }).length : 0;
    btn.hidden = !(target && inLibrary > 0);      // 该季在库中没有作品就不显示
    if (target && inLibrary) {
      btn.textContent = '查看本季全部（' + inLibrary + ' 部）';
      btn.title = '按 ' + target.year + ' 年' + D.seasonZh(target.season) + ' 筛选资料库';
    }
  }

  function showTrendingSeason() {
    var target = trendingSeason();
    if (!target) { return; }
    var keepSort = state.sort;
    state = D.defaultFilters();
    state.sort = keepSort;
    state.year = String(target.year);
    state.season = target.season;
    syncSearchInput();
    syncStudioInput(true);
    hint('已按 ' + target.year + ' 年' + D.seasonZh(target.season) + ' 筛选资料库（排序：' + sortLabel(keepSort) + '）');
    refresh({ scroll: true });
  }

  /* ------------------------------------------------------------ 继续观看 */

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
        onChange: function () { renderContinue(); }
      }));
    });
  }

  /* ---------------------------------------------------------- 主刷新流程 */

  function refresh(opts) {
    opts = opts || {};
    applyFilters();
    syncUrl();
    renderFiltersUI();
    renderResultHead();
    renderActiveChips();
    if (!filtered.length) { renderEmpty(); }
    else { renderGrid(true); }
    updateLoadMore();
    if (opts.scroll) { scrollToResults(); }
  }

  /* ---------------------------------------------------------------- 启动 */

  function initFilters() {
    var hasUrl = !!global.location.search.replace(/^\?/, '');
    state = hasUrl ? D.filtersFromQuery(global.location.search)
      : (D.readRememberedFilters() || D.filtersFromQuery(''));
    var years = D.yearList(all).map(String);
    var studios = D.studioList(all).map(function (r) { return r.name; });
    if (state.year && years.indexOf(String(state.year)) === -1) { state.year = ''; }
    if (state.season && SEASONS.indexOf(state.season) === -1) { state.season = ''; }
    if (state.studio && studios.indexOf(state.studio) === -1) { state.studio = ''; }
    if (state.format && FORMATS.indexOf(state.format) === -1) { state.format = ''; }
  }

  function init() {
    UI.skeletonGrid(document.getElementById('posterGrid'), 12);
    return Promise.all([D.load(), D.loadTrending()]).then(function (res) {
      all = res[0];
      trending = res[1] || { items: [] };

      initFilters();
      syncSearchInput();
      syncStudioInput(true);
      renderLibraryMeta();
      renderTrending();
      renderContinue();
      bindSearch();
      bindControls();
      bindKeyboard();
      bindHistory();
      bindScrollMemory();
      bindAutoLoad();
      refresh({ scroll: false });
      restoreScrollIfReturning();
    }).catch(function (err) {
      document.getElementById('posterGrid').innerHTML =
        '<div class="empty"><h3>数据加载失败</h3><p>' +
        UI.escapeHtml(err && err.message ? err.message : '请通过本地服务器打开页面（node serve.js）。') +
        '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }

  // 只读自测接口：控制台 / 自动化测试可检查当前筛选状态与命中数量
  global.AnimeDiscoveryHome = {
    state: function () { return merge(state, {}); },
    count: function () { return filtered.length; },
    rendered: function () { return rendered; },
    trendingSeason: trendingSeason,
    studioMatch: function (q) { return uniqueStudioMatch(q); }
  };
})(window);
