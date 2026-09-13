/* ==========================================================================
   detail.js —— 番剧详情页：资料 / 标签 / 集数清单（占位数据）/ 追番与进度
   ========================================================================== */

(function (global) {
  'use strict';

  var el = global.UI.el;
  var anime = null;
  var episodes = [];
  var root = null;

  function notFound() {
    root.innerHTML = '';
    var empty = el('div', 'empty');
    empty.appendChild(el('h3', null, '没有找到这部番剧'));
    empty.appendChild(el('p', null, '链接里的 id 参数无效，或者数据里没有这条记录。'));
    var back = el('a', 'btn btn-primary', '回到首页');
    back.href = 'index.html';
    empty.appendChild(back);
    root.appendChild(empty);
  }

  function progressBox() {
    var ratio = global.AnimeStore.setProgressRatio(anime.id, anime.episodes);
    var wrap = el('div');
    var line = el('div', 'progress-line');
    var bar = el('div', 'progress');
    bar.style.setProperty('--pct', ratio.pct + '%');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(ratio.total));
    bar.setAttribute('aria-valuenow', String(ratio.done));
    bar.appendChild(el('i'));
    line.appendChild(bar);
    line.appendChild(el('span', 'faint', ratio.done + ' / ' + ratio.total + ' 集'));
    wrap.appendChild(line);
    return wrap;
  }

  function episodesSection() {
    var section = el('section', 'card');
    section.id = 'episodes';

    var head = el('div', 'section-head');
    head.style.margin = '0 0 14px';
    var titleWrap = el('div');
    titleWrap.appendChild(el('h2', null, '集数列表'));
    titleWrap.appendChild(el('p', 'faint', '共 ' + anime.episodes + ' 集 · 以占位数据演示，不含任何真实剧集信息'));
    head.appendChild(titleWrap);

    var headerProgress = el('div');
    headerProgress.style.minWidth = '150px';
    function renderHeaderProgress() {
      headerProgress.innerHTML = '';
      headerProgress.appendChild(progressBox());
    }
    renderHeaderProgress();
    head.appendChild(headerProgress);
    section.appendChild(head);

    var actions = el('div', 'ep-actions');
    var allBtn = el('button', 'btn btn-sm', '全部标记已看');
    allBtn.type = 'button';
    var noneBtn = el('button', 'btn btn-sm btn-ghost', '清空本作进度');
    noneBtn.type = 'button';
    actions.appendChild(allBtn);
    actions.appendChild(noneBtn);
    section.appendChild(actions);

    var list = el('ul', 'episode-list');

    function watchedSet() {
      return new Set(global.AnimeStore.watchedList(anime.id));
    }

    function renderList() {
      var watched = watchedSet();
      list.innerHTML = '';
      episodes.forEach(function (ep) {
        var li = el('li', 'episode' + (watched.has(ep.n) ? ' watched' : ''));
        li.tabIndex = 0;
        li.setAttribute('role', 'checkbox');
        li.setAttribute('aria-checked', String(watched.has(ep.n)));
        li.appendChild(el('div', 'ep-num', String(ep.n)));

        var text = el('div', 'ep-text');
        text.appendChild(el('strong', null, ep.title));
        text.appendChild(el('span', null, ep.desc));
        li.appendChild(text);
        li.appendChild(el('div', 'ep-check', '✓'));

        function toggle() {
          global.AnimeStore.toggleEpisode(anime.id, ep.n);
          if (!global.AnimeStore.isFavorite(anime.id)) {
            global.AnimeStore.addFavorite(anime.id, anime.title);
            global.UI.refreshBadge();
            renderFavoriteButton();
          }
          renderList();
          renderProgress();
          renderHeaderProgress();
        }

        li.addEventListener('click', toggle);
        li.addEventListener('keydown', function (ev) {
          if (ev.key === ' ' || ev.key === 'Enter') {
            ev.preventDefault();
            toggle();
          }
        });

        list.appendChild(li);
      });
    }

    allBtn.addEventListener('click', function () {
      global.AnimeStore.setWatched(anime.id, episodes.map(function (e) { return e.n; }));
      if (!global.AnimeStore.isFavorite(anime.id)) {
        global.AnimeStore.addFavorite(anime.id, anime.title);
        global.UI.refreshBadge();
        renderFavoriteButton();
      }
      renderList();
      renderProgress();
      renderHeaderProgress();
    });

    noneBtn.addEventListener('click', function () {
      global.AnimeStore.clearProgress(anime.id);
      renderList();
      renderProgress();
      renderHeaderProgress();
    });

    section.appendChild(list);

    // 暴露给外部（初始渲染）使用
    section.__renderList = renderList;
    return section;
  }

  var favButton = null;

  function renderFavoriteButton() {
    if (!favButton) { return; }
    var fav = global.AnimeStore.isFavorite(anime.id);
    favButton.textContent = fav ? '♥ 已加入追番' : '♡ 加入我的追番';
    favButton.classList.toggle('btn-primary', !fav);
    favButton.setAttribute('aria-pressed', String(fav));
  }

  var progressHost = null;

  function renderProgress() {
    if (!progressHost) { return; }
    progressHost.innerHTML = '';
    progressHost.appendChild(progressBox());
  }

  function renderInfo() {
    var hero = el('div', 'detail-hero');

    var coverWrap = el('div', 'detail-cover');
    coverWrap.appendChild(global.UI.buildCover(anime, { tag: anime.status }));
    hero.appendChild(coverWrap);

    var info = el('div', 'detail-info');
    info.appendChild(el('p', 'eyebrow', anime.titleEn || 'Anime'));
    info.appendChild(el('h1', null, anime.title));
    if (anime.titleJa) {
      info.appendChild(el('p', 'faint', anime.titleJa + ' · ' + anime.titleEn));
    }

    var meta = el('div', 'meta-line');
    [
      anime.year + ' 年 ' + anime.season,
      anime.studio,
      '全 ' + anime.episodes + ' 集',
      '单集 ' + anime.duration,
      anime.status,
      '★ ' + Number(anime.rating).toFixed(1) + '（示例评分）'
    ].forEach(function (t) { meta.appendChild(el('span', null, t)); });
    info.appendChild(meta);

    info.appendChild(global.UI.tagNodes(anime.categories || [], 'tag-cat'));
    info.appendChild(el('div', null)).style.height = '8px';
    info.appendChild(global.UI.tagNodes(anime.tags || []));

    var syn = el('p', 'synopsis');
    syn.style.marginTop = '16px';
    syn.textContent = anime.summary;
    info.appendChild(syn);

    var actions = el('div', 'action-row', null);
    favButton = el('button', 'btn', '');
    favButton.type = 'button';
    favButton.addEventListener('click', function () {
      global.AnimeStore.toggleFavorite(anime.id, anime.title);
      renderFavoriteButton();
      global.UI.refreshBadge();
    });
    renderFavoriteButton();
    actions.appendChild(favButton);

    var link = el('a', 'btn btn-ghost', '哪里能看正片 →');
    link.href = 'about.html';
    actions.appendChild(link);
    info.appendChild(actions);

    progressHost = el('div');
    progressHost.style.marginTop = '14px';
    info.appendChild(progressHost);
    renderProgress();

    hero.appendChild(info);
    return hero;
  }

  function renderSidePanel() {
    var side = el('div');

    var infoCard = el('div', 'card');
    infoCard.appendChild(el('h2', null, '作品信息'));
    var kv = el('ul', 'kv');
    [
      ['原名', anime.titleJa || '—'],
      ['英文名', anime.titleEn || '—'],
      ['放送年份', anime.year + ' 年（' + anime.season + '）'],
      ['制作公司', anime.studio],
      ['状态', anime.status],
      ['集数', '全 ' + anime.episodes + ' 集'],
      ['单集时长', anime.duration],
      ['分类', (anime.categories || []).join(' / ')],
      ['评分', '★ ' + Number(anime.rating).toFixed(1) + '（示例）']
    ].forEach(function (row) {
      var li = el('li');
      li.appendChild(el('span', null, row[0]));
      li.appendChild(el('span', null, row[1]));
      kv.appendChild(li);
    });
    infoCard.appendChild(kv);
    side.appendChild(infoCard);

    var notice = el('div', 'notice');
    notice.style.marginTop = '16px';
    notice.appendChild(el('strong', null, '关于观看'));
    notice.appendChild(document.createTextNode(
      '本站只展示资料与你的追番进度，不提供播放、不嵌入任何视频源。想看正片请前往正版平台。'));
    side.appendChild(notice);

    var related = relatedList();
    if (related.length) {
      var relSection = el('section');
      relSection.style.marginTop = '22px';
      relSection.appendChild(el('h2', null, '相关推荐'));
      var grid = el('div', 'related-grid');
      related.forEach(function (item) {
        var card = el('a', 'related-card');
        card.href = 'detail.html?id=' + encodeURIComponent(item.id);
        card.appendChild(global.UI.buildCover(item, { tag: '' }));
        grid.appendChild(card);
      });
      relSection.appendChild(grid);
      side.appendChild(relSection);
    }

    return side;
  }

  var allList = [];

  function relatedList() {
    var cats = anime.categories || [];
    var scored = allList.filter(function (item) { return item.id !== anime.id; })
      .map(function (item) {
        var shared = (item.categories || []).filter(function (c) { return cats.indexOf(c) !== -1; }).length;
        return { item: item, shared: shared };
      })
      .filter(function (row) { return row.shared > 0; })
      .sort(function (a, b) {
        if (b.shared !== a.shared) { return b.shared - a.shared; }
        return b.item.rating - a.item.rating;
      })
      .slice(0, 4);
    return scored.map(function (row) { return row.item; });
  }

  function render() {
    root.innerHTML = '';
    root.appendChild(renderInfo());

    var columns = el('div', 'detail-columns');
    var epSection = episodesSection();
    columns.appendChild(epSection);
    columns.appendChild(renderSidePanel());
    root.appendChild(columns);

    epSection.__renderList();
  }

  function init() {
    root = document.getElementById('detailRoot');
    global.AnimeData.load().then(function (list) {
      allList = list;
      var id = global.UI.qs('id');
      anime = global.AnimeData.find(list, id);
      if (!anime) { notFound(); return; }

      episodes = global.AnimeData.buildEpisodes(anime);
      document.title = anime.title + ' · 番组发现 AnimeDiscovery';
      global.AnimeStore.touchRecent(anime.id);
      render();
    }).catch(function (err) {
      root.innerHTML = '<div class="empty"><h3>数据加载失败</h3><p>' +
        global.UI.escapeHtml(err && err.message ? err.message : '请通过本地服务器打开页面。') + '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
