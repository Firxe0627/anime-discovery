/* ==========================================================================
   data.js —— 番剧数据加载
   1) 正常（本地服务器）时读取 data/anime.json
   2) 直接双击 HTML（file://）时 fetch 会被浏览器拦截，改用下面同内容的内置数组
   数据为示例用途，集数列表由 buildEpisodes() 生成占位内容。
   ========================================================================== */

(function (global) {
  'use strict';

  var ANIME_FALLBACK = [
    {
      id: 'aot',
      title: '进击的巨人',
      titleJa: '進撃の巨人',
      titleEn: 'Attack on Titan',
      year: 2013,
      season: '春季',
      studio: 'WIT STUDIO / MAPPA',
      status: '已完结',
      rating: 9.1,
      duration: '24 分钟',
      episodes: 12,
      categories: ['热血', '奇幻'],
      tags: ['巨人类', '世界观宏大', '剧情向', '动作'],
      emoji: '🛡️',
      palette: ['#7a2f4a', '#1c2b52'],
      summary: '人类在高墙之内生活了百年，墙外的巨人让墙内世界时刻笼罩在恐惧中。当高墙被突破，少年艾伦与伙伴们被卷入一场关乎人类存亡的战斗。示例数据仅用于站点演示，剧情简介为概括性说明。'
    },
    {
      id: 'demon-slayer',
      title: '鬼灭之刃',
      titleJa: '鬼滅の刃',
      titleEn: 'Demon Slayer',
      year: 2019,
      season: '春季',
      studio: 'ufotable',
      status: '连载中',
      rating: 8.9,
      duration: '24 分钟',
      episodes: 26,
      categories: ['热血', '奇幻'],
      tags: ['和风', '剑戟', '兄妹羁绊', '作画'],
      emoji: '⚔️',
      palette: ['#1f6b6a', '#3c1e4d'],
      summary: '为了让变成鬼的妹妹恢复人身，少年踏上斩鬼之路，在旅途中结识同伴，也逐渐逼近悲剧的源头。示例数据仅用于站点演示。'
    },
    {
      id: 'jujutsu-kaisen',
      title: '咒术回战',
      titleJa: '呪術廻戦',
      titleEn: 'Jujutsu Kaisen',
      year: 2020,
      season: '秋季',
      studio: 'MAPPA',
      status: '连载中',
      rating: 8.8,
      duration: '24 分钟',
      episodes: 24,
      categories: ['热血', '奇幻'],
      tags: ['现代异能', '咒术', '校园', '战斗'],
      emoji: '🌀',
      palette: ['#2b2a5e', '#5a2350'],
      summary: '少年吞下禁忌之物后被卷入咒术师的世界，为了保护同伴、也为了掌控自身背负的力量而战。示例数据仅用于站点演示。'
    },
    {
      id: 'haikyuu',
      title: '排球少年!!',
      titleJa: 'ハイキュー!!',
      titleEn: 'Haikyu!!',
      year: 2014,
      season: '春季',
      studio: 'Production I.G',
      status: '已完结',
      rating: 9.0,
      duration: '24 分钟',
      episodes: 25,
      categories: ['热血', '日常'],
      tags: ['运动', '排球', '青春', '团队'],
      emoji: '🏐',
      palette: ['#134a72', '#2f7a5a'],
      summary: '身材矮小却弹跳惊人的少年加入高中排球部，与曾经的对手成为队友，一起向着更高的舞台冲击。示例数据仅用于站点演示。'
    },
    {
      id: 'bocchi',
      title: '孤独摇滚!',
      titleJa: 'ぼっち・ざ・ろっく！',
      titleEn: 'Bocchi the Rock!',
      year: 2022,
      season: '秋季',
      studio: 'CloverWorks',
      status: '已完结',
      rating: 9.0,
      duration: '23 分钟',
      episodes: 12,
      categories: ['日常', '治愈'],
      tags: ['音乐', '校园', '社恐', '乐队'],
      emoji: '🎸',
      palette: ['#5d2f78', '#c2417a'],
      summary: '极度怕生的少女抱着吉他独自练习多年，意外被拉进乐队后，开始笨拙又真诚地与人建立联系。示例数据仅用于站点演示。'
    },
    {
      id: 'yuru-camp',
      title: '摇曳露营△',
      titleJa: 'ゆるキャン△',
      titleEn: 'Laid-Back Camp',
      year: 2018,
      season: '冬季',
      studio: 'C-Station',
      status: '连载中',
      rating: 8.7,
      duration: '23 分钟',
      episodes: 12,
      categories: ['日常', '治愈'],
      tags: ['露营', '风景', '慢生活', '治愈系'],
      emoji: '⛺',
      palette: ['#1f5c58', '#2b3f6b'],
      summary: '喜欢独自露营的少女与朋友们在冬日湖畔、山间营地度过安静的时光，简单日常里都是温和的余韵。示例数据仅用于站点演示。'
    },
    {
      id: 'natsume',
      title: '夏目友人帐',
      titleJa: '夏目友人帳',
      titleEn: "Natsume's Book of Friends",
      year: 2008,
      season: '夏季',
      studio: "Brain's Base",
      status: '连载中',
      rating: 8.9,
      duration: '24 分钟',
      episodes: 13,
      categories: ['治愈', '奇幻'],
      tags: ['妖怪', '温情', '单元剧', '日式奇幻'],
      emoji: '🍃',
      palette: ['#2e5c46', '#4a3a6b'],
      summary: '能看见妖怪的少年继承了外婆留下的契约册，与自称保镖的猫咪老师一起，把名字一页页还给妖怪。示例数据仅用于站点演示。'
    },
    {
      id: 'violet',
      title: '紫罗兰永恒花园',
      titleJa: 'ヴァイオレット・エヴァーガーデン',
      titleEn: 'Violet Evergarden',
      year: 2018,
      season: '冬季',
      studio: '京都动画',
      status: '已完结',
      rating: 8.9,
      duration: '24 分钟',
      episodes: 13,
      categories: ['治愈', '奇幻'],
      tags: ['书信', '成长', '情感', '美术'],
      emoji: '💌',
      palette: ['#3a2f70', '#7a3f6b'],
      summary: '曾作为兵器长大的少女成为代笔人，在替他人书写心意的过程中，一点点学会理解自己的情感。示例数据仅用于站点演示。'
    },
    {
      id: 'hyouka',
      title: '冰菓',
      titleJa: '氷菓',
      titleEn: 'Hyouka',
      year: 2012,
      season: '春季',
      studio: '京都动画',
      status: '已完结',
      rating: 8.8,
      duration: '25 分钟',
      episodes: 22,
      categories: ['日常'],
      tags: ['推理', '校园', '青春', '节能主义'],
      emoji: '🔍',
      palette: ['#2c3f6e', '#6b3f5c'],
      summary: '奉行节能主义的高中生被好奇心旺盛的同伴拉入古典部的日常谜题，平静校园里藏着温柔又克制的青春。示例数据仅用于站点演示。'
    },
    {
      id: 'frieren',
      title: '葬送的芙莉莲',
      titleJa: '葬送のフリーレン',
      titleEn: "Frieren: Beyond Journey's End",
      year: 2023,
      season: '秋季',
      studio: 'MADHOUSE',
      status: '连载中',
      rating: 9.2,
      duration: '24 分钟',
      episodes: 28,
      categories: ['奇幻', '治愈'],
      tags: ['冒险后日谈', '精灵', '魔法', '时间与告别'],
      emoji: '🌿',
      palette: ['#245a52', '#3a3068'],
      summary: '勇者一行打倒魔王之后，寿命漫长的精灵魔法使踏上新的旅途，在缓慢流逝的时间里重新认识曾经并肩的伙伴。示例数据仅用于站点演示。'
    },
    {
      id: 'spy-family',
      title: '间谍过家家',
      titleJa: 'SPY×FAMILY',
      titleEn: 'SPY×FAMILY',
      year: 2022,
      season: '春季',
      studio: 'WIT STUDIO / CloverWorks',
      status: '连载中',
      rating: 8.7,
      duration: '24 分钟',
      episodes: 25,
      categories: ['日常'],
      tags: ['喜剧', '家庭', '间谍', '超能力'],
      emoji: '🕵️',
      palette: ['#7a3050', '#24406b'],
      summary: '为完成任务而组建的临时家庭，三个人各自藏着秘密，却在鸡飞狗跳的同居生活里慢慢变成了真正的家人。示例数据仅用于站点演示。'
    },
    {
      id: 'dungeon-meshi',
      title: '迷宫饭',
      titleJa: 'ダンジョン飯',
      titleEn: 'Delicious in Dungeon',
      year: 2024,
      season: '冬季',
      studio: 'TRIGGER',
      status: '连载中',
      rating: 8.8,
      duration: '25 分钟',
      episodes: 24,
      categories: ['奇幻', '日常'],
      tags: ['迷宫', '美食', '幻想', '冒险'],
      emoji: '🍲',
      palette: ['#6b4a24', '#2f3f5c'],
      summary: '为了救回同伴，冒险者一行决定在迷宫里就地取材，把魔物做成料理，一边下潜一边研究奇幻生态的餐桌。示例数据仅用于站点演示。'
    }
  ];

  var CATEGORIES = ['全部', '热血', '日常', '奇幻', '治愈'];

  var cache = null;
  var sourceLabel = '内置兜底数据';

  function fetchJson() {
    // file:// 下 fetch 本地文件会被 CORS 拦截，直接使用内置数据
    if (global.location && global.location.protocol === 'file:') {
      return Promise.resolve(null);
    }
    if (typeof global.fetch !== 'function') {
      return Promise.resolve(null);
    }
    return global.fetch('data/anime.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) { return null; }
        return res.json();
      })
      .catch(function () { return null; });
  }

  function normalize(list) {
    if (!Array.isArray(list) || !list.length) { return ANIME_FALLBACK; }
    return list.filter(function (item) {
      return item && item.id && item.title;
    });
  }

  /**
   * 加载番剧列表。
   * @returns {Promise<Array>} 番剧数组
   */
  function loadAnime() {
    if (cache) { return Promise.resolve(cache); }
    return fetchJson().then(function (json) {
      var list = normalize(json);
      sourceLabel = list === ANIME_FALLBACK ? '内置兜底数据' : 'data/anime.json';
      cache = list.slice();
      return cache;
    });
  }

  function getSourceLabel() { return sourceLabel; }

  function findAnime(list, id) {
    if (!id) { return null; }
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { return list[i]; }
    }
    return null;
  }

  /**
   * 生成占位集数列表（不含任何真实剧集信息）。
   * @param {Object} anime
   * @returns {Array<{n:number,title:string,desc:string}>}
   */
  function buildEpisodes(anime) {
    var total = Math.max(1, Math.min(60, Number(anime.episodes) || 12));
    var list = [];
    for (var i = 1; i <= total; i++) {
      list.push({
        n: i,
        title: '第 ' + i + ' 集',
        desc: '占位简介：这里将显示第 ' + i + ' 集的剧情概要（示例数据，非真实剧集信息）。'
      });
    }
    return list;
  }

  global.AnimeData = {
    CATEGORIES: CATEGORIES,
    load: loadAnime,
    sourceLabel: getSourceLabel,
    find: findAnime,
    buildEpisodes: buildEpisodes
  };
})(window);
