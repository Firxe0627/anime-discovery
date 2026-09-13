/* ==========================================================================
   ui.js —— 通用 UI 工具：封面生成、卡片渲染、导航高亮、小工具函数
   封面全部由 CSS 渐变 + 文字生成，不加载任何外部图片。
   ========================================================================== */

(function (global) {
  'use strict';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function escapeHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function qs(name) {
    var params = new global.URLSearchParams(global.location.search);
    return params.get(name);
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      global.clearTimeout(timer);
      timer = global.setTimeout(function () { fn.apply(self, args); }, wait || 160);
    };
  }

  /**
   * 生成占位封面（渐变 + 表情 + 标题）。
   * @param {Object} anime
   * @param {{small?:boolean, tag?:string}} [opts]
   */
  function buildCover(anime, opts) {
    opts = opts || {};
    var palette = Array.isArray(anime.palette) && anime.palette.length >= 2
      ? anime.palette
      : ['#3a2f70', '#7a3f6b'];

    var cover = el('div', 'cover');
    cover.style.background = 'linear-gradient(150deg, ' + palette[0] + ', ' + palette[1] + ')';
    cover.setAttribute('role', 'img');
    cover.setAttribute('aria-label', anime.title + ' 占位封面');

    var tagText = opts.tag || anime.status;
    if (tagText) {
      cover.appendChild(el('span', 'cover-tag', tagText));
    }

    cover.appendChild(el('span', 'cover-emoji', anime.emoji || '✨'));
    cover.appendChild(el('span', 'cover-title', anime.title));

    var meta = [anime.year ? anime.year + ' 年' : '', (anime.categories || [])[0] || '']
      .filter(Boolean).join(' · ');
    if (meta) { cover.appendChild(el('span', 'cover-meta', meta)); }

    return cover;
  }

  function tagNodes(names, className) {
    var wrap = el('div', 'tag-row');
    (names || []).slice(0, 3).forEach(function (name) {
      wrap.appendChild(el('span', 'tag ' + (className || ''), name));
    });
    return wrap;
  }

  /**
   * 渲染一张海报卡（首页 / 相关推荐共用）。
   */
  function posterCard(anime, opts) {
    opts = opts || {};
    var card = el('article', 'poster-card');

    var coverWrap = el('div', 'cover-wrap');
    var link = el('a', 'cover-link');
    link.href = 'detail.html?id=' + encodeURIComponent(anime.id);
    link.setAttribute('aria-label', '查看《' + anime.title + '》详情');
    link.appendChild(buildCover(anime));
    coverWrap.appendChild(link);

    var favBtn = el('button', 'cover-fav', '♥');
    var fav = global.AnimeStore ? global.AnimeStore.isFavorite(anime.id) : false;
    favBtn.setAttribute('aria-pressed', String(fav));
    favBtn.title = fav ? '取消追番' : '加入我的追番';
    favBtn.setAttribute('aria-label', favBtn.title + '：' + anime.title);
    favBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (!global.AnimeStore) { return; }
      var nowFav = global.AnimeStore.toggleFavorite(anime.id, anime.title);
      favBtn.setAttribute('aria-pressed', String(nowFav));
      favBtn.title = nowFav ? '取消追番' : '加入我的追番';
      favBtn.setAttribute('aria-label', favBtn.title + '：' + anime.title);
      refreshBadge();
      if (typeof opts.onToggleFavorite === 'function') {
        opts.onToggleFavorite(anime, nowFav);
      }
    });
    coverWrap.appendChild(favBtn);
    card.appendChild(coverWrap);

    var body = el('div', 'poster-body');
    var titleLink = el('a', 'poster-title', anime.title);
    titleLink.href = 'detail.html?id=' + encodeURIComponent(anime.id);
    body.appendChild(titleLink);
    body.appendChild(el('div', 'poster-sub',
      [anime.titleJa, anime.year + ' · ' + anime.season].filter(Boolean).join(' · ')));
    body.appendChild(tagNodes(anime.categories || [], 'tag-cat'));

    var metaRow = el('div', 'poster-sub');
    metaRow.appendChild(el('span', 'rating', '★ ' + Number(anime.rating).toFixed(1)));
    metaRow.appendChild(document.createTextNode('  共 ' + anime.episodes + ' 集'));
    body.appendChild(metaRow);

    if (global.AnimeStore) {
      var ratio = global.AnimeStore.setProgressRatio(anime.id, anime.episodes);
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

  function renderGrid(container, list, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!list.length) {
      var empty = el('div', 'empty');
      empty.appendChild(el('h3', null, opts.emptyTitle || '没有找到匹配的番剧'));
      empty.appendChild(el('p', null, opts.emptyDesc || '换个关键词或分类试试。'));
      if (opts.emptyAction) {
        var btn = el('button', 'btn', opts.emptyAction.label);
        btn.addEventListener('click', opts.emptyAction.onClick);
        empty.appendChild(btn);
      }
      container.appendChild(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    list.forEach(function (anime) {
      frag.appendChild(posterCard(anime, opts));
    });
    container.appendChild(frag);
  }

  /**
   * 追番条目卡（我的追番页 / 首页「继续观看」共用）。
   * @param {Object} anime
   * @param {{showRemove?:boolean, showClearProgress?:boolean, onChange?:Function, note?:string}} [opts]
   */
  function progressItem(anime, opts) {
    opts = opts || {};
    var ratio = global.AnimeStore
      ? global.AnimeStore.setProgressRatio(anime.id, anime.episodes)
      : { done: 0, total: anime.episodes, pct: 0 };

    var item = el('article', 'mylist-item');

    var thumb = el('div', 'thumb');
    var thumbLink = el('a', null);
    thumbLink.href = 'detail.html?id=' + encodeURIComponent(anime.id);
    thumbLink.setAttribute('aria-label', '查看《' + anime.title + '》详情');
    thumbLink.appendChild(buildCover(anime, { tag: '' }));
    thumb.appendChild(thumbLink);
    item.appendChild(thumb);

    var body = el('div', 'body');
    var titleLink = el('a', null);
    titleLink.href = 'detail.html?id=' + encodeURIComponent(anime.id);
    var h3 = el('h3', null, anime.title);
    titleLink.appendChild(h3);
    body.appendChild(titleLink);

    body.appendChild(el('div', 'faint', opts.note ||
      [(anime.categories || []).join(' / '), anime.year + ' 年', anime.status].filter(Boolean).join(' · ')));

    var line = el('div', 'progress-line');
    var bar = el('div', 'progress');
    bar.style.setProperty('--pct', ratio.pct + '%');
    bar.appendChild(el('i'));
    line.appendChild(bar);
    line.appendChild(el('span', 'faint', '已看 ' + ratio.done + '/' + ratio.total + ' 集'));
    body.appendChild(line);

    var actions = el('div', 'item-actions');
    var openBtn = el('a', 'btn btn-sm btn-primary', '继续观看');
    openBtn.href = 'detail.html?id=' + encodeURIComponent(anime.id) + '#episodes';
    actions.appendChild(openBtn);

    if (opts.showRemove !== false && global.AnimeStore) {
      var removeBtn = el('button', 'btn btn-sm btn-danger', '取消追番');
      removeBtn.type = 'button';
      removeBtn.addEventListener('click', function () {
        global.AnimeStore.removeFavorite(anime.id);
        refreshBadge();
        if (typeof opts.onChange === 'function') { opts.onChange(); }
      });
      actions.appendChild(removeBtn);
    }

    if (opts.showClearProgress && global.AnimeStore) {
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

  function formatCount(n) {
    return String(n);
  }

  global.UI = {
    el: el,
    qs: qs,
    escapeHtml: escapeHtml,
    debounce: debounce,
    buildCover: buildCover,
    tagNodes: tagNodes,
    posterCard: posterCard,
    renderGrid: renderGrid,
    progressItem: progressItem,
    refreshBadge: refreshBadge,
    initChrome: initChrome,
    formatCount: formatCount
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChrome);
  } else {
    initChrome();
  }
})(window);
