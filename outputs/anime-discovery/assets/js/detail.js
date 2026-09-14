/* ==========================================================================
   detail.js —— 番剧详情页
     大封面、中文速览 + 完整简介（默认收起）、标签、分数、制作公司、
     集数进度、追番状态、数据来源徽章、官方 PV（点击才加载 iframe）、
     同系列时间轴、相关推荐、外链按钮
   ========================================================================== */

(function (global) {
  'use strict';

  var D = global.AnimeData;
  var UI = global.UI;
  var el = UI.el;

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
    empty.appendChild(el('p', null, '链接里的 id 参数无效，或者资料库里没有这条记录。'));
    var back = el('a', 'btn btn-primary', '回到首页');
    back.href = UI.homeUrl();
    empty.appendChild(back);
    root.appendChild(empty);
  }

  /** 「返回首页」带上当前筛选条件；并标记这次是从详情页回去，方便首页恢复滚动位置 */
  function bindBackHome() {
    var href = UI.homeUrl();
    var link = document.getElementById('backHomeLink');
    if (link) { link.href = href; }
    var navHome = document.querySelector('.site-nav a[data-nav="home"]');
    if (navHome) { navHome.href = href; }
    try { global.sessionStorage.setItem(D.RETURN_KEY || 'anime-tracker:return', '1'); } catch (e) { /* ignore */ }
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
    line.appendChild(el('span', 'faint', '看到第 ' + ratio.done + ' / ' + ratio.total + ' 集'));
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

  /* -------------------------------------------------------------- 简介 */

  function collapsible(label, text, clampClass) {
    var block = el('div', 'syn-block');
    block.appendChild(el('h3', null, label));
    var p = el('p', 'synopsis' + (clampClass ? ' ' + clampClass : ''), text);
    block.appendChild(p);
    var btn = el('button', 'btn btn-sm btn-ghost', '展开全文');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      var clamped = p.classList.toggle('synopsis-clamped');
      btn.textContent = clamped ? '展开全文' : '收起';
    });
    block.appendChild(btn);
    return block;
  }

  function synopsisBlock() {
    var wrap = el('div', 'synopsis-block');

    if (anime.summary_cn_short) {
      var zh = el('div', 'summary-zh');
      zh.appendChild(el('h3', null, '中文速览'));
      zh.appendChild(el('p', null, anime.summary_cn_short));
      zh.appendChild(el('p', 'faint', '本站编辑整理的概述，非官方简介。'));
      wrap.appendChild(zh);
    }

    if (anime.summary_cn) {
      wrap.appendChild(collapsible('中文简介', anime.summary_cn,
        anime.summary_cn.length > 180 ? 'synopsis-clamped' : ''));
    }

    if (anime.summary_en) {
      wrap.appendChild(collapsible(anime.summary_cn ? '英文简介（原文）' : '简介（英文原文）',
        anime.summary_en, anime.summary_en.length > 240 ? 'synopsis-clamped' : ''));
    }

    if (!anime.summary_cn && !anime.summary_en) {
      wrap.appendChild(el('p', 'faint', '数据源没有返回简介，本站不做补充或编造。'));
    }

    wrap.appendChild(el('p', 'faint',
      '简介原文来自 ' + D.sourceLabel(anime) + '，本站未做翻译或改写；'
      + '中文缺失时显示原名与英文原文。'));
    return wrap;
  }

  /* ---------------------------------------------------------------- PV */

  function pvSection() {
    if (!anime.trailer) { return null; }
    var section = el('section', 'card pv-card');
    section.appendChild(el('h2', null, 'PV / 宣传影像'));

    var player = el('div', 'pv-player');
    var placeholder = el('div', 'pv-placeholder');
    placeholder.appendChild(el('span', 'pv-icon', '▶'));
    placeholder.appendChild(el('p', 'faint', '为避免列表页与详情页自动加载视频，PV 需要点击后才载入。'));
    var playBtn = el('button', 'btn btn-primary', '播放 PV');
    playBtn.type = 'button';
    placeholder.appendChild(playBtn);
    player.appendChild(placeholder);

    playBtn.addEventListener('click', function () {
      var iframe = el('iframe', 'pv-frame');
      iframe.src = D.trailerEmbedUrl(anime, true);
      iframe.title = D.displayTitle(anime) + ' 官方 PV';
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      player.innerHTML = '';
      player.appendChild(iframe);
      note.textContent = 'PV 为官方 YouTube 嵌入，默认静音播放，可在播放器里打开声音。';
    });

    section.appendChild(player);
    var note = el('p', 'faint', 'PV 为 AniList 标注的官方 YouTube 视频，本站不托管、不下载任何视频文件。');
    section.appendChild(note);
    return section;
  }

  /* -------------------------------------------------------- 顶部信息区 */

  function renderFavoriteButton() {
    if (!favButton) { return; }
    var fav = global.AnimeStore.isFavorite(anime.id);
    favButton.textContent = fav ? '♥ 已加入追番' : '♡ 加入我的追番';
    favButton.classList.toggle('btn-primary', !fav);
    favButton.setAttribute('aria-pressed', String(fav));
  }

  function badgeRow() {
    var row = el('div', 'badge-row');
    var src = el('span', 'badge badge-source',
      anime.bgmId ? '数据：AniList + Bangumi' : '数据：AniList');
    src.title = D.sourceLabel(anime);
    row.appendChild(src);
    if (!anime.name_cn) {
      row.appendChild(el('span', 'badge badge-warn', '暂无中文名，显示原名'));
    }
    if (anime.trailer) { row.appendChild(el('span', 'badge', '有官方 PV')); }
    return row;
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
    return wrap;
  }

  function renderHero() {
    var hero = el('div', 'detail-hero');

    var coverWrap = el('div', 'detail-cover');
    coverWrap.appendChild(UI.buildCover(anime, { tag: D.statusText(anime) }));
    hero.appendChild(coverWrap);

    var info = el('div', 'detail-info');
    info.appendChild(el('p', 'eyebrow', anime.name_en || anime.name_romaji || 'Anime'));
    info.appendChild(el('h1', null, D.displayTitle(anime)));

    var alts = D.altTitles(anime);
    if (alts.length) { info.appendChild(el('p', 'faint', alts.join(' · '))); }
    info.appendChild(badgeRow());

    var meta = el('div', 'meta-line');
    [
      D.yearText(anime),
      D.primaryStudio(anime) ? D.studioLabel(D.primaryStudio(anime)) : '制作公司未知',
      D.formatText(anime),
      D.episodesText(anime),
      anime.duration ? '单集 ' + anime.duration + ' 分钟' : '',
      D.statusText(anime),
      '★ ' + D.scoreText(anime) + (anime.scoredBy ? '（' + Number(anime.scoredBy).toLocaleString('en-US') + ' 人收藏/评分为参考）' : '')
    ].filter(Boolean).forEach(function (t) { meta.appendChild(el('span', null, t)); });
    info.appendChild(meta);

    info.appendChild(UI.tagNodes(anime.categories || [], 'tag-cat', 6));
    info.appendChild(UI.tagNodes(anime.genres || [], '', 10));
    info.appendChild(synopsisBlock());

    var actions = el('div', 'action-row');
    favButton = el('button', 'btn');
    favButton.type = 'button';
    favButton.addEventListener('click', function () {
      global.AnimeStore.toggleFavorite(anime.id);
      renderFavoriteButton();
      UI.refreshBadge();
    });
    renderFavoriteButton();
    actions.appendChild(favButton);

    var statusWrap = el('div', 'status-wrap');
    statusWrap.appendChild(el('span', 'faint', '追番状态'));
    statusWrap.appendChild(UI.statusSelect(anime, {
      onChange: function () { renderProgress(); }
    }));
    actions.appendChild(statusWrap);
    info.appendChild(actions);

    info.appendChild(externalButtons());

    var watchRow = el('div', 'link-row');
    var watchLink = el('a', 'btn btn-sm btn-ghost', '哪里能看正片 →');
    watchLink.href = 'about.html';
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
      '共 ' + episodes.length + ' 条占位条目 · 只用于记录你看到第几集，不代表真实剧集标题'));
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

    function ensureFavorite() {
      if (!global.AnimeStore.isFavorite(anime.id)) {
        global.AnimeStore.addFavorite(anime.id);
        UI.refreshBadge();
        renderFavoriteButton();
      }
    }

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
          if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggle(); }
        });
        list.appendChild(li);
      });
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

  /* ------------------------------------------------------ 同系列时间轴 */

  function timelineSection() {
    var rows = D.resolveRelations(anime, allList);
    if (!rows.length) { return null; }
    var section = el('section');
    section.style.marginTop = '22px';
    section.appendChild(el('h2', null, '同系列 / 时间轴'));
    section.appendChild(el('p', 'faint', '按前作 / 续作 / 剧场版整理；库内作品可直接点进详情，库外只在 AniList 打开。'));

    var list = el('ul', 'timeline');
    rows.forEach(function (r) {
      var li = el('li', 'timeline-item' + (r.local ? ' in-library' : ''));
      var dot = el('span', 'timeline-dot');
      li.appendChild(dot);
      var body = el('div', 'timeline-body');
      var line = el('div', 'timeline-head');
      line.appendChild(el('span', 'tag relation-tag', r.relationZh || r.relation));
      if (r.year) { line.appendChild(el('span', 'faint', r.year + ' 年')); }
      if (r.formatZh) { line.appendChild(el('span', 'faint', r.formatZh)); }
      body.appendChild(line);

      var title = r.local ? el('a', 'timeline-title', r.name) : el('span', 'timeline-title', r.name);
      if (r.local) { title.href = UI.detailUrl(r.local.id); }
      body.appendChild(title);
      if (r.local && r.originalName && r.originalName !== r.name) {
        body.appendChild(el('div', 'faint', r.originalName));
      }
      if (!r.local) {
        var ext = el('a', 'btn btn-sm btn-ghost', '在 AniList 打开 ↗');
        ext.href = r.url;
        ext.target = '_blank';
        ext.rel = 'noopener noreferrer';
        body.appendChild(ext);
      } else {
        body.appendChild(el('span', 'faint', '✓ 站内已有'));
      }
      li.appendChild(body);
      list.appendChild(li);
    });
    section.appendChild(list);
    return section;
  }

  /* ------------------------------------------------------------ 侧边栏 */

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
      .slice(0, 6)
      .map(function (row) { return row.item; });
  }

  function renderSidePanel() {
    var side = el('div');

    var infoCard = el('div', 'card');
    infoCard.appendChild(el('h2', null, '作品信息'));
    var kv = el('ul', 'kv');
    [
      ['中文名', anime.name_cn || '—（无中文名，显示原名）'],
      ['原名', anime.name || '—'],
      ['罗马字', anime.name_romaji || '—'],
      ['英文名', anime.name_en || '—'],
      ['放送', D.yearText(anime)],
      ['制作公司', (anime.studios || []).map(D.studioLabel).join(' / ') || '—'],
      ['类型', D.formatText(anime)],
      ['状态', D.statusText(anime)],
      ['集数', D.episodesText(anime)],
      ['单集时长', anime.duration ? anime.duration + ' 分钟' : '—'],
      ['类型标签', D.tagsOf(anime).join(' / ') || '—'],
      ['分数', '★ ' + D.scoreText(anime)],
      ['数据来源', D.sourceLabel(anime)]
    ].forEach(function (row) {
      var li = el('li');
      li.appendChild(el('span', null, row[0]));
      li.appendChild(el('span', null, row[1]));
      kv.appendChild(li);
    });
    infoCard.appendChild(kv);
    side.appendChild(infoCard);

    var timeline = timelineSection();
    if (timeline) { side.appendChild(timeline); }

    var notice = el('div', 'notice');
    notice.style.marginTop = '18px';
    notice.appendChild(el('strong', null, '关于观看与版权'));
    notice.appendChild(document.createTextNode(
      '本站只展示公开 API 提供的资料与你自己记录的进度，不提供播放、不嵌入未授权视频源，也不托管封面或视频；'
      + '仅详情页可点击加载 AniList 标注的官方 YouTube PV。名称、简介、封面与 PV 版权归原权利人所有。'));
    side.appendChild(notice);

    var related = relatedList();
    if (related.length) {
      var relSection = el('section');
      relSection.style.marginTop = '22px';
      relSection.appendChild(el('h2', null, '相关推荐'));
      var grid = el('div', 'related-grid');
      related.forEach(function (item) {
        var card = el('a', 'related-card');
        card.href = UI.detailUrl(item.id);
        card.appendChild(UI.buildCover(item, { tag: '', small: true }));
        card.appendChild(el('div', 'related-title', D.displayTitle(item)));
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

    var pv = pvSection();
    if (pv) { root.appendChild(pv); }

    var columns = el('div', 'detail-columns');
    var epSection = episodesSection();
    columns.appendChild(epSection);
    columns.appendChild(renderSidePanel());
    root.appendChild(columns);
    epSection.__renderList();
  }

  function init() {
    root = document.getElementById('detailRoot');
    bindBackHome();
    return D.load().then(function (list) {
      allList = list;
      anime = D.find(list, UI.qs('id'));
      if (!anime) { notFound(); return; }
      episodes = D.buildEpisodes(anime);
      document.title = D.displayTitle(anime) + ' · 番组发现 AnimeDiscovery';
      global.AnimeStore.touchRecent(anime.id);
      render();
    }).catch(function (err) {
      root.innerHTML = '<div class="empty"><h3>数据加载失败</h3><p>' +
        UI.escapeHtml(err && err.message ? err.message : '请通过本地服务器打开页面（node serve.js）。') + '</p></div>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
