/* ==========================================================================
   home.js —— 首页：搜索 / 分类筛选 / 排序 / 海报墙 / 继续观看
   ========================================================================== */

(function (global) {
  'use strict';

  var state = { keyword: '', category: '全部', sort: 'rating' };
  var all = [];

  function matches(anime, keyword) {
    if (!keyword) { return true; }
    var haystack = [
      anime.title, anime.titleJa, anime.titleEn, anime.studio, anime.status,
      (anime.tags || []).join(' '),
      (anime.categories || []).join(' '),
      anime.summary || ''
    ].join(' ').toLowerCase();
    return keyword.toLowerCase().split(/\s+/).filter(Boolean).every(function (word) {
      return haystack.indexOf(word) !== -1;
    });
  }

  function sortList(list) {
    var copy = list.slice();
    switch (state.sort) {
      case 'year-desc':
        return copy.sort(function (a, b) { return b.year - a.year; });
      case 'year-asc':
        return copy.sort(function (a, b) { return a.year - b.year; });
      case 'title':
        return copy.sort(function (a, b) { return a.title.localeCompare(b.title, 'zh-Hans-CN'); });
      case 'episodes':
        return copy.sort(function (a, b) { return b.episodes - a.episodes; });
      case 'rating':
      default:
        return copy.sort(function (a, b) { return b.rating - a.rating; });
    }
  }

  function filtered() {
    return sortList(all.filter(function (anime) {
      var byCat = state.category === '全部' || (anime.categories || []).indexOf(state.category) !== -1;
      return byCat && matches(anime, state.keyword);
    }));
  }

  function renderChips() {
    var wrap = document.getElementById('categoryChips');
    wrap.innerHTML = '';
    global.AnimeData.CATEGORIES.forEach(function (name) {
      var chip = global.UI.el('button', 'chip', name);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(name === state.category));
      chip.addEventListener('click', function () {
        state.category = name;
        renderChips();
        render();
      });
      wrap.appendChild(chip);
    });
  }

  function renderContinue() {
    var section = document.getElementById('continueSection');
    var grid = document.getElementById('continueGrid');
    if (!global.AnimeStore) { section.hidden = true; return; }

    var progress = global.AnimeStore.all().progress;
    var rows = Object.keys(progress)
      .map(function (id) {
        return { anime: global.AnimeData.find(all, id), at: progress[id].updatedAt || 0 };
      })
      .filter(function (row) { return row.anime; })
      .sort(function (a, b) { return b.at - a.at; })
      .slice(0, 4);

    if (!rows.length) {
      section.hidden = true;
      grid.innerHTML = '';
      return;
    }

    section.hidden = false;
    grid.innerHTML = '';
    rows.forEach(function (row) {
      grid.appendChild(global.UI.progressItem(row.anime, {
        showClearProgress: true,
        onChange: function () { renderContinue(); render(); }
      }));
    });
  }

  function renderStats() {
    document.getElementById('statTotal').textContent = String(all.length);
    document.getElementById('statCats').textContent = String(global.AnimeData.CATEGORIES.length - 1);
    document.getElementById('statFav').textContent = global.AnimeStore
      ? String(global.AnimeStore.favoritesCount()) : '0';
    document.getElementById('statData').textContent = global.AnimeData.sourceLabel();
  }

  function render() {
    var list = filtered();
    var count = document.getElementById('resultCount');
    var parts = [];
    if (state.category !== '全部') { parts.push('分类：' + state.category); }
    if (state.keyword) { parts.push('关键词：' + state.keyword); }
    count.textContent = (parts.length ? parts.join(' · ') + ' · ' : '') + '共 ' + list.length + ' 部';

    var grid = document.getElementById('posterGrid');
    global.UI.renderGrid(grid, list, {
      emptyTitle: '没有找到匹配的番剧',
      emptyDesc: '试试其他关键词，或点「全部」查看所有番剧。',
      emptyAction: {
        label: '重置筛选',
        onClick: function () {
          state.keyword = '';
          state.category = '全部';
          document.getElementById('searchInput').value = '';
          document.getElementById('searchBox').classList.remove('has-value');
          renderChips();
          render();
        }
      },
      onToggleFavorite: function () { renderStats(); renderContinue(); }
    });
    renderStats();
  }

  function bindSearch() {
    var input = document.getElementById('searchInput');
    var box = document.getElementById('searchBox');
    var clear = document.getElementById('searchClear');

    var onInput = global.UI.debounce(function () {
      state.keyword = input.value.trim();
      box.classList.toggle('has-value', input.value.length > 0);
      render();
    }, 140);

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        state.keyword = input.value.trim();
        render();
      }
      if (ev.key === 'Escape') {
        input.value = '';
        state.keyword = '';
        box.classList.remove('has-value');
        render();
      }
    });

    clear.addEventListener('click', function () {
      input.value = '';
      input.focus();
      state.keyword = '';
      box.classList.remove('has-value');
      render();
    });
  }

  function init() {
    global.AnimeData.load().then(function (list) {
      all = list;
      renderChips();
      bindSearch();

      var sortSelect = document.getElementById('sortSelect');
      sortSelect.addEventListener('change', function () {
        state.sort = sortSelect.value;
        render();
      });

      // 支持 index.html?q=关键词&cat=分类 直接带筛选条件打开
      var q = global.UI.qs('q');
      var cat = global.UI.qs('cat');
      if (q) {
        state.keyword = q;
        document.getElementById('searchInput').value = q;
        document.getElementById('searchBox').classList.add('has-value');
      }
      if (cat && global.AnimeData.CATEGORIES.indexOf(cat) !== -1) {
        state.category = cat;
        renderChips();
      }

      render();
      renderContinue();
    }).catch(function (err) {
      document.getElementById('posterGrid').innerHTML =
        '<div class="empty"><h3>数据加载失败</h3><p>' + global.UI.escapeHtml(err && err.message ? err.message : '请通过本地服务器打开页面。') + '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
