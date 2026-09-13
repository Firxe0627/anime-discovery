/* ==========================================================================
   detail.js —— 番剧详情：真封面、完整简介、标签、分数、集数进度、
                 MAL / AniList 外链、追番状态
   ========================================================================== */

(function (global) {
  'use strict';

  var D = global.AnimeData;
  var el = global.UI.el;
  var anime = null;
  var episodes = [];
  var allList = [];
  var root = null;
  var favButton = null;
  var progressHost = null;

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

  /* ------------------------------------------------------------ 进度条 */

  function progressBox() {
    var total = D.episodeTotal(anime);
    var ratio = global.AnimeStore.setProgressRatio(anime.id, total);
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
    if (D.episodesEstimated(anime)) {
      wrap.appendChild(el('p', 'faint', '数据源未给出总集数，这里按 24 集占位以便记录进度。'));
    }
    return wrap;
  }

  function renderProgress() {
    if (!progressHost) { return; }
    progressHost.innerHTML = '';
    progressHost.appendChild(progressBox());
  }

  /* ------------------------------------------------------------ 简介区 */

  function synopsisBlock() {
    var wrap = el('div', 'synopsis-block');

    if (anime.summaryZh) {
      var zh = el('div', 'summary-zh');
      zh.appendChild(el('h3', null, '中文速览'));
      zh.appendChild(el('p', null, anime.summaryZh));
      zh.appendChild(el('p', 'faint', '本站编辑整理的概述，非官方简介。'));
      wrap.appendChild(zh);
    }

    wrap.appendChild(el('h3', null, '完整简介'));
    if (anime.synopsis) {
      var p = el('p', 'synopsis synopsis-clamped', anime.synopsis);
      wrap.appendChild(p);
      if (anime.synopsis.length > 320) {
        var toggle = el('button', 'btn btn-sm btn-ghost', '展开全文');
        toggle.type = 'button';
        toggle.addEventListener('click', function () {
          var clamped = p.classList.toggle('synopsis-clamped');
          toggle.textContent = clamped ? '展开全文' : '收起';
        });
        wrap.appendChild(toggle);
      }
      wrap.appendChild(el('p', 'faint',
        '简介文字来自 ' + D.sourceLabel(anime) + '，本站未做改写或增补。'));
    } else {
      wrap.appendChild(el('p', 'faint', '数据源暂未返回简介，本站不做补充或编造。'));
    }

    return wrap;
  }

  /* ------------------------------------------------------------ 顶部信息 */

  function renderFavoriteButton() {
    if (!favButton) { return; }
    var fav = global.AnimeStore.isFavorite(anime.id);
    favButton.textContent = fav ? '♥ 已加入追番' : '♡ 加入我的追番';
    favButton.classList.toggle('btn-primary', !fav);
    favButton.setAttribute('aria-pressed', String(fav));
  }

  function externalButtons() {
    var wrap = el('div', 'link-row');
    D.externalLinks(anime).forEach(function (link) {
      var a = el('a', 'btn btn-sm btn-ext', link.label + ' ↗');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = '在新标签页打开 ' + link.label + ' 的作品页（外部站点）';
      wrap.appendChild(a);
    });
    if (!wrap.children.length) {
      wrap.appendChild(el('span', 'faint', '暂无外部作品页链接'));
    }
    return wrap;
  }

  function renderHero() {
    var hero = el('div', 'detail-hero');

    var coverWrap = el('div', 'detail-cover');
    coverWrap.appendChild(global.UI.buildCover(anime, { tag: D.statusText(anime) }));
    hero.appendChild(coverWrap);

    var info = el('div', 'detail-info');
    info.appendChild(el('p', 'eyebrow', anime.titleEn || anime.title || 'Anime'));
    info.appendChild(el('h1', null, D.displayTitle(anime)));

    var alts = D.altTitles(anime);
    if (alts.length) { info.appendChild(el('p', 'faint', alts.join(' · '))); }

    var meta = el('div', 'meta-line');
    [
      D.yearText(anime),
      (anime.studios || []).join(' / ') || '制作公司未知',
      D.episodesText(anime),
      anime.duration ? '单集 ' + anime.duration : '',
      D.statusText(anime),
      '★ ' + D.scoreText(anime) + (anime.scoredBy ? '（' + Number(anime.scoredBy).toLocaleString('en-US') + ' 人评分）' : '')
    ].filter(Boolean).forEach(function (t) { meta.appendChild(el('span', null, t)); });
    info.appendChild(meta);

    info.appendChild(global.UI.tagNodes(anime.categories || [], 'tag-cat', 6));
    info.appendChild(global.UI.tagNodes([].concat(anime.genres || [], anime.themes || []), '', 8));

    info.appendChild(synopsisBlock());

    var actions = el('div', 'action-row');
    favButton = el('button', 'btn', '');
    favButton.type = 'button';
    favButton.addEventListener('click', function () {
      global.AnimeStore.toggleFavorite(anime.id, D.displayTitle(anime));
      renderFavoriteButton();
      global.UI.refreshBadge();
    });
    renderFavoriteButton();
    actions.appendChild(favButton);

    var statusWrap = el('div', 'status-wrap');
    statusWrap.appendChild(el('span', 'faint', '追番状态'));
    statusWrap.appendChild(global.UI.statusSelect(anime, {
      onChange: function () { renderProgress(); }
    }));
    actions.appendChild(statusWrap);
    info.appendChild(actions);

    info.appendChild(externalButtons());

    var watchLink = el('a', 'btn btn-sm btn-ghost', '哪里能看正片 →');
    watchLink.href = 'about.html';
    var watchRow = el('div', 'link-row');
    watchRow.appendChild(watchLink);
    info.appendChild(watchRow);

    progressHost = el('div');
    progressHost.style.marginTop = '14px';
    info.appendChild(progressHost);
    renderProgress();

    hero.appendChild(info);
    return hero;
  }

  /* -------------------------------------------------------------- 集数 */

  function episodesSection() {
    var section = el('section', 'card');
    section.id = 'episodes';

    var head = el('div', 'section-head');
    head.style.margin = '0 0 14px';
    var titleWrap = el('div');
    titleWrap.appendChild(el('h2', null, '集数进度'));
    titleWrap.appendChild(el('p', 'faint',
      '共 ' + episodes.length + ' 条占位条目 · 仅用于记录你看到第几集，不代表真实剧集标题'));
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

    function renderList() {
      var watched = new Set(global.AnimeStore.watchedList(anime.id));
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
          ensureFavorite();
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

    function ensureFavorite() {
      if (!global.AnimeStore.isFavorite(anime.id)) {
        global.AnimeStore.addFavorite(anime.id, D.displayTitle(anime));
        global.UI.refreshBadge();
        renderFavoriteButton();
      }
    }

    allBtn.addEventListener('click', function () {
      global.AnimeStore.setWatched(anime.id, episodes.map(function (e) { return e.n; }));
      ensureFavorite();
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
    section.__renderList = renderList;
    return section;
  }

  /* ------------------------------------------------------------ 侧边信息 */

  function relatedList() {
    var cats = anime.categories || [];
    return allList.filter(function (item) { return item.id !== anime.id; })
      .map(function (item) {
        var shared = (item.categories || []).filter(function (c) { return cats.indexOf(c) !== -1; }).length;
        return { item: item, shared: shared };
      })
      .filter(function (row) { return row.shared > 0; })
      .sort(function (a, b) {
        if (b.shared !== a.shared) { return b.shared - a.shared; }
        return (b.item.score || 0) - (a.item.score || 0);
      })
      .slice(0, 4)
      .map(function (row) { return row.item; });
  }

  function renderSidePanel() {
    var side = el('div');

    var infoCard = el('div', 'card');
    infoCard.appendChild(el('h2', null, '作品信息'));
    var kv = el('ul', 'kv');
    [
      ['中文名', D.displayTitle(anime)],
      ['原名（罗马字）', anime.title || '—'],
      ['日文名', anime.titleJa || '—'],
      ['英文名', anime.titleEn || '—'],
      ['放送', D.yearText(anime)],
      ['制作公司', (anime.studios || []).join(' / ') || '—'],
      ['状态', D.statusText(anime)],
      ['集数', D.episodesText(anime)],
      ['单集时长', anime.duration || '—'],
      ['类型标签', D.allTags(anime).join(' / ') || '—'],
      ['分数', '★ ' + D.scoreText(anime)],
      ['数据源', anime.source === 'jikan' ? 'Jikan（MAL）' : anime.source === 'anilist' ? 'AniList' : '占位']
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
    notice.appendChild(el('strong', null, '关于观看与版权'));
    notice.appendChild(document.createTextNode(
      '本站只展示公开 API 提供的资料（名称、简介、分数等）与你自己记录的进度，'
      + '不提供播放、不嵌入任何视频源，也不托管封面图片。封面与作品资料版权归原权利人所有。'));
    side.appendChild(notice);

    var related = relatedList();
    if (related.length) {
      var relSection = el('section');
      relSection.style.marginTop = '22px';
      relSection.appendChild(el('h2', null, '相关推荐'));
      var grid = el('div', 'related-grid');
      related.forEach(function (item) {
        var card = el('a', 'related-card');
        card.href = global.UI.detailUrl(item.id);
        card.appendChild(global.UI.buildCover(item, { tag: '', small: true }));
        var label = el('div', 'related-title', D.displayTitle(item));
        card.appendChild(label);
        grid.appendChild(card);
      });
      relSection.appendChild(grid);
      side.appendChild(relSection);
    }

    return side;
  }

  function render() {
    root.innerHTML = '';
    root.appendChild(renderHero());
    var columns = el('div', 'detail-columns');
    var epSection = episodesSection();
    columns.appendChild(epSection);
    columns.appendChild(renderSidePanel());
    root.appendChild(columns);
    epSection.__renderList();
  }

  function init() {
    root = document.getElementById('detailRoot');
    return D.load().then(function (list) {
      allList = list;
      anime = D.find(list, global.UI.qs('id'));
      if (!anime) { notFound(); return; }
      episodes = D.buildEpisodes(anime);
      document.title = D.displayTitle(anime) + ' · 番组发现 AnimeDiscovery';
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
