/* ==========================================================================
   ui.js —— 通用 UI 组件
     封面（远程图 + 文字兜底）、海报卡、热门卡、追番条目卡、骨架屏、
     卡片分页追加、导航徽标

   封面只使用 API 返回的图片 URL（<img src>），懒加载；加载失败或离线时
   自动回退到「渐变 + 标题」的文字占位封面。列表页不加载任何视频。
   ========================================================================== */

(function (global) {
  'use strict';

  var FALLBACK_PALETTES = [
    ['#2f3a6b', '#7a2f52'], ['#1f5c58', '#3a3068'], ['#4a3a6b', '#a2415f'],
    ['#134a72', '#2f7a5a'], ['#5d2f78', '#c2417a'], ['#6b4a24', '#2f3f5c'],
    ['#2b2a5e', '#5a2350'], ['#24406b', '#6b3050'], ['#1f4c5c', '#54306b'],
    ['#3a4a24', '#2b3f6b']
  ];
  var CATEGORY_EMOJI = { '热血': '🔥', '日常': '☕', '奇幻': '✨', '治愈': '🌿', '科幻': '🛰️', '悬疑': '🔍' };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function hashPalette(seed) {
    var s = String(seed || 'anime');
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 100000; }
    return FALLBACK_PALETTES[h % FALLBACK_PALETTES.length];
  }

  function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function qs(name) { return new global.URLSearchParams(global.location.search).get(name); }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      global.clearTimeout(timer);
      timer = global.setTimeout(function () { fn.apply(self, args); }, wait || 160);
    };
  }

  /* ---------------------------------------------------------------- 封面 */

  function buildCover(anime, opts) {
    opts = opts || {};
    var D = global.AnimeData;
    var title = D.displayTitle(anime);
    var palette = Array.isArray(anime.palette) && anime.palette.length >= 2
      ? anime.palette : hashPalette(anime.id || title);

    var cover = el('div', 'cover');
    cover.setAttribute('role', 'img');
    cover.setAttribute('aria-label', title + ' 封面');

    var fallback = el('div', 'cover-fallback');
    fallback.style.background = 'linear-gradient(150deg, ' + palette[0] + ', ' + palette[1] + ')';
    fallback.appendChild(el('span', 'cover-emoji', anime.emoji || CATEGORY_EMOJI[(anime.categories || [])[0]] || '✨'));
    fallback.appendChild(el('span', 'cover-title', title));
    var metaText = [anime.year ? anime.year + ' 年' : '', D.formatText(anime)].filter(Boolean).join(' · ');
    if (metaText && !opts.small) { fallback.appendChild(el('span', 'cover-meta', metaText)); }
    cover.appendChild(fallback);

    var src = opts.small ? (anime.coverSmall || anime.cover) : (anime.cover || anime.coverSmall);
    if (src) {
      var img = el('img', 'cover-img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.addEventListener('load', function () { cover.classList.add('has-image'); });
      img.addEventListener('error', function () {
        if (img.parentNode) { img.parentNode.removeChild(img); }
        cover.classList.add('cover-broken');
      });
      cover.appendChild(img);
    } else {
      cover.classList.add('cover-broken');
    }

    var tagText = opts.tag === undefined ? D.statusText(anime) : opts.tag;
    if (tagText) { cover.appendChild(el('span', 'cover-tag', tagText)); }
    return cover;
  }

  function tagNodes(names, className, limit) {
    var wrap = el('div', 'tag-row');
    (names || []).slice(0, limit || 4).forEach(function (name) {
      wrap.appendChild(el('span', 'tag ' + (className || ''), name));
    });
    return wrap;
  }

  function detailUrl(id) { return 'detail.html?id=' + encodeURIComponent(id); }

  /* -------------------------------------------------------------- 海报卡 */

  function posterCard(anime, opts) {
    opts = opts || {};
    var D = global.AnimeData;
    var card = el('article', 'poster-card');

    var coverWrap = el('div', 'cover-wrap');
    var link = el('a', 'cover-link');
    link.href = detailUrl(anime.id);
    link.setAttribute('aria-label', '查看《' + D.displayTitle(anime) + '》详情');
    link.appendChild(buildCover(anime));
    coverWrap.appendChild(link);

    var favBtn = el('button', 'cover-fav', '♥');
    var fav = global.AnimeStore ? global.AnimeStore.isFavorite(anime.id) : false;
    favBtn.type = 'button';
    favBtn.setAttribute('aria-pressed', String(fav));
    favBtn.title = fav ? '取消收藏' : '加入我的追番';
    favBtn.setAttribute('aria-label', favBtn.title + '：' + D.displayTitle(anime));
    favBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      var nowFav = global.AnimeStore.toggleFavorite(anime.id);
      favBtn.setAttribute('aria-pressed', String(nowFav));
      favBtn.title = nowFav ? '取消收藏' : '加入我的追番';
      refreshBadge();
      if (typeof opts.onToggleFavorite === 'function') { opts.onToggleFavorite(anime, nowFav); }
    });
    coverWrap.appendChild(favBtn);
    card.appendChild(coverWrap);

    var body = el('div', 'poster-body');
    var titleLink = el('a', 'poster-title', D.displayTitle(anime));
    titleLink.href = detailUrl(anime.id);
    body.appendChild(titleLink);

    var sub = [anime.name_cn ? anime.name : anime.name_romaji, anime.year ? anime.year + ' 年' : D.formatText(anime)]
      .filter(Boolean).join(' · ');
    body.appendChild(el('div', 'poster-sub', sub || D.formatText(anime)));
    body.appendChild(tagNodes(anime.categories || [], 'tag-cat', 3));

    var metaRow = el('div', 'poster-sub meta-row');
    metaRow.appendChild(el('span', 'rating', '★ ' + D.scoreText(anime)));
    metaRow.appendChild(el('span', null, D.episodesText(anime)));
    body.appendChild(metaRow);

    if (global.AnimeStore) {
      var ratio = global.AnimeStore.setProgressRatio(anime.id, D.episodeTotal(anime));
      if (ratio.done > 0) {
        var line = el('div', 'progress-line');
        var bar = el('div', 'progress');
        bar.style.setProperty('--pct', ratio.pct + '%');
        bar.appendChild(el('i'));
        line.appendChild(bar);
        line.appendChild(el('span', 'faint', ratio.done + '/' + ratio.total));
        body.appendChild(line);
      }
    }

    card.appendChild(body);
    return card;
  }

  /** 一次性渲染（结果集较小时使用） */
  function renderGrid(container, list, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!list.length) { container.appendChild(emptyBox(opts)); return; }
    var frag = document.createDocumentFragment();
    list.forEach(function (a) { frag.appendChild(posterCard(a, opts)); });
    container.appendChild(frag);
  }

  function emptyBox(opts) {
    var empty = el('div', 'empty');
    empty.appendChild(el('h3', null, opts.emptyTitle || '没有找到匹配的番剧'));
    empty.appendChild(el('p', null, opts.emptyDesc || '换个关键词或筛选条件试试。'));
    if (opts.emptyAction) {
      var btn = el('button', 'btn', opts.emptyAction.label);
      btn.type = 'button';
      btn.addEventListener('click', opts.emptyAction.onClick);
      empty.appendChild(btn);
    }
    return empty;
  }

  /** 骨架屏（列表加载中占位，纯 CSS，无动画闪烁） */
  function skeletonGrid(container, count) {
    container.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var card = el('article', 'poster-card skeleton-card');
      card.appendChild(el('div', 'skeleton skeleton-cover'));
      var body = el('div', 'poster-body');
      body.appendChild(el('div', 'skeleton skeleton-line w80'));
      body.appendChild(el('div', 'skeleton skeleton-line w60'));
      body.appendChild(el('div', 'skeleton skeleton-line w40'));
      card.appendChild(body);
      frag.appendChild(card);
    }
    container.appendChild(frag);
  }

  /* -------------------------------------------------------------- 热门卡 */

  /** 热门卡：始终进入站内详情页（数据由脚本保证都能在站内打开）。 */
  function trendingCard(item) {
    var D = global.AnimeData;
    var card = el('article', 'trend-card');
    var link = el('a', 'trend-link');
    link.href = detailUrl(item.id);
    link.setAttribute('aria-label', '查看《' + (item.name_cn || item.name) + '》详情');
    link.appendChild(buildCover({
      id: item.id,
      name_cn: item.name_cn,
      name: item.name_original || item.name,
      cover: item.cover,
      coverSmall: item.coverSmall,
      categories: item.categories,
      emoji: item.emoji || CATEGORY_EMOJI[(item.categories || [])[0]] || '✨',
      status: 'RELEASING',
      format: item.format
    }, { tag: '', small: true }));
    link.appendChild(el('span', 'trend-rank', '#' + item.rank));
    card.appendChild(link);

    var body = el('div', 'trend-body');
    var titleEl = el('a', 'trend-title', item.name_cn || item.name);
    titleEl.href = detailUrl(item.id);
    body.appendChild(titleEl);
    if (item.name_cn && item.name && item.name_cn !== item.name) {
      body.appendChild(el('div', 'faint trend-sub', item.name));
    }
    body.appendChild(el('div', 'faint',
      ['★ ' + (typeof item.score === 'number' ? item.score.toFixed(1) : '—'),
        item.episodes ? '全 ' + item.episodes + ' 集' : '连载中',
        item.year ? item.year + ' 年' : ''].filter(Boolean).join(' · ')));
    card.appendChild(body);
    return card;
  }

  /* --------------------------------------------------------- 追番条目卡 */

  function statusSelect(anime, opts) {
    opts = opts || {};
    var D = global.AnimeData;
    var current = global.AnimeStore.getStatus(anime.id, D.episodeTotal(anime));
    var select = el('select', 'status-select');
    select.setAttribute('aria-label', '设置《' + D.displayTitle(anime) + '》的追番状态');
    D.TRACK_ORDER.forEach(function (key) {
      var opt = el('option', null, D.trackStatusText(key));
      opt.value = key;
      if (key === current) { opt.selected = true; }
      select.appendChild(opt);
    });
    select.addEventListener('change', function () {
      global.AnimeStore.setStatus(anime.id, select.value);
      refreshBadge();
      if (typeof opts.onChange === 'function') { opts.onChange(); }
    });
    return select;
  }

  function progressItem(anime, opts) {
    opts = opts || {};
    var D = global.AnimeData;
    var total = D.episodeTotal(anime);
    var ratio = global.AnimeStore.setProgressRatio(anime.id, total);
    var statusKey = global.AnimeStore.getStatus(anime.id, total);

    var item = el('article', 'mylist-item');
    var thumb = el('div', 'thumb');
    var thumbLink = el('a');
    thumbLink.href = detailUrl(anime.id);
    thumbLink.appendChild(buildCover(anime, { tag: '', small: true }));
    thumb.appendChild(thumbLink);
    item.appendChild(thumb);

    var body = el('div', 'body');
    var titleLink = el('a');
    titleLink.href = detailUrl(anime.id);
    titleLink.appendChild(el('h3', null, D.displayTitle(anime)));
    body.appendChild(titleLink);

    body.appendChild(el('div', 'faint', opts.note ||
      [D.primaryStudio(anime), D.yearText(anime), D.formatText(anime)].filter(Boolean).join(' · ')));

    var chipRow = el('div', 'track-row');
    chipRow.appendChild(el('span', 'tag status-tag status-' + statusKey, D.trackStatusText(statusKey)));
    chipRow.appendChild(el('span', 'faint', '看到第 ' + ratio.done + ' / ' + ratio.total + ' 集'));
    chipRow.appendChild(el('span', 'rating', '★ ' + D.scoreText(anime)));
    body.appendChild(chipRow);

    var line = el('div', 'progress-line');
    var bar = el('div', 'progress');
    bar.style.setProperty('--pct', ratio.pct + '%');
    bar.appendChild(el('i'));
    line.appendChild(bar);
    line.appendChild(el('span', 'faint', ratio.pct + '%'));
    body.appendChild(line);

    var actions = el('div', 'item-actions');
    var openBtn = el('a', 'btn btn-sm btn-primary', '继续观看');
    openBtn.href = detailUrl(anime.id) + '#episodes';
    actions.appendChild(openBtn);
    actions.appendChild(statusSelect(anime, opts));

    if (opts.showRemove !== false) {
      var removeBtn = el('button', 'btn btn-sm btn-danger', '取消收藏');
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', function () {
        global.AnimeStore.removeFavorite(anime.id);
        refreshBadge();
        if (typeof opts.onChange === 'function') { opts.onChange(); }
      });
      actions.appendChild(removeBtn);
    }
    if (opts.showClearProgress) {
      var clearBtn = el('button', 'btn btn-sm btn-ghost', '清空进度');
      clearBtn.type = 'button';
      clearBtn.addEventListener('click', function () {
        global.AnimeStore.clearProgress(anime.id);
        if (typeof opts.onChange === 'function') { opts.onChange(); }
      });
      actions.appendChild(clearBtn);
    }

    body.appendChild(actions);
    item.appendChild(body);
    return item;
  }

  /* ------------------------------------------------------------- 页面外壳 */

  function refreshBadge() {
    var badge = document.querySelector('[data-fav-count]');
    if (!badge || !global.AnimeStore) { return; }
    var n = global.AnimeStore.favoritesCount();
    badge.textContent = String(n);
    badge.style.display = n > 0 ? 'inline-block' : 'none';
  }

  function initChrome() {
    var page = document.body.getAttribute('data-page');
    if (page) {
      var link = document.querySelector('.site-nav a[data-nav="' + page + '"]');
      if (link) { link.classList.add('active'); }
    }
    refreshBadge();
    var year = document.querySelector('[data-year]');
    if (year) { year.textContent = String(new Date().getFullYear()); }
  }

  global.UI = {
    el: el, qs: qs, escapeHtml: escapeHtml, debounce: debounce,
    hashPalette: hashPalette, buildCover: buildCover, tagNodes: tagNodes,
    posterCard: posterCard, renderGrid: renderGrid, emptyBox: emptyBox,
    skeletonGrid: skeletonGrid, trendingCard: trendingCard,
    progressItem: progressItem, statusSelect: statusSelect,
    detailUrl: detailUrl, refreshBadge: refreshBadge, initChrome: initChrome
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChrome);
  } else {
    initChrome();
  }
})(window);
