#!/usr/bin/env node
/**
 * work/fetch-anime-data.mjs
 * ---------------------------------------------------------------------------
 * 一次性数据抓取脚本：为 AnimeDiscovery 静态站生成番剧元数据。
 *
 * 数据来源：优先 Jikan（MyAnimeList 的公开 API）https://api.jikan.moe/v4
 *           失败时回退 AniList GraphQL https://graphql.anilist.co
 *
 * 重要约束（与站点定位一致）：
 *   - 只抓取**文本元数据**与**图片 URL**，绝不下载任何图片/视频文件到仓库。
 *   - 请求间隔 >= 1 秒；遇到 429 / 5xx 会退避重试。
 *   - 匹配不上的条目保留占位（source: "placeholder"），简介留空，不编造内容。
 *
 * 用法：
 *   node work/fetch-anime-data.mjs            # 使用 work/api-cache 缓存（默认）
 *   node work/fetch-anime-data.mjs --no-cache # 忽略缓存，重新请求 API
 *   node work/fetch-anime-data.mjs --only=trending
 *   node work/fetch-anime-data.mjs --only=anime
 *
 * 产物：
 *   outputs/anime-discovery/data/anime.json      + anime.js（file:// 兜底）
 *   outputs/anime-discovery/data/trending.json   + trending.js
 *   work/fetch-report.md                         本次抓取报告
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(PROJECT_ROOT, 'outputs', 'anime-discovery');
const DATA_DIR = path.join(SITE_DIR, 'data');
const CACHE_DIR = path.join(__dirname, 'api-cache');

const MIN_INTERVAL_MS = 1100;   // 请求间隔下限（要求至少 1 秒）
const MAX_ATTEMPTS = 4;         // 429 / 5xx 重试次数
const FETCH_TIMEOUT_MS = 20000; // 单次请求超时，避免网络异常时长时间挂起
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 缓存 7 天

const argv = process.argv.slice(2);
const USE_CACHE = !argv.includes('--no-cache');
const ONLY = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';

const SEASON_ZH = { winter: '冬季', spring: '春季', summer: '夏季', fall: '秋季' };
const FALLBACK_PALETTES = [
  ['#2f3a6b', '#7a2f52'], ['#1f5c58', '#3a3068'], ['#4a3a6b', '#a2415f'],
  ['#134a72', '#2f7a5a'], ['#5d2f78', '#c2417a'], ['#6b4a24', '#2f3f5c'],
  ['#2b2a5e', '#5a2350'], ['#24406b', '#6b3050'], ['#1f4c5c', '#54306b'],
  ['#3a4a24', '#2b3f6b']
];

/* ------------------------------------------------------------------ 片单 */
/* titleZh 为中文常用名（人工整理，非 API 生成）；summaryZh 仅对最早收录的 12 部
   保留本站编辑整理的中文速览，其余全部以 API 返回的简介为准。            */
const ENTRIES = [
  // ---- 热血 ----
  { id: 'aot', titleZh: '进击的巨人', query: 'Shingeki no Kyojin', expect: 'shingeki no kyojin|attack on titan', malId: 16498,
    categories: ['热血', '奇幻'], emoji: '🛡️', palette: ['#7a2f4a', '#1c2b52'],
    summaryZh: '人类在高墙之内生活了百年，墙外的巨人让墙内世界时刻笼罩在恐惧中。当高墙被突破，少年艾伦与伙伴们被卷入一场关乎人类存亡的战斗。' },
  { id: 'demon-slayer', titleZh: '鬼灭之刃', query: 'Kimetsu no Yaiba', expect: 'kimetsu no yaiba|demon slayer', malId: 38000,
    categories: ['热血', '奇幻'], emoji: '⚔️', palette: ['#1f6b6a', '#3c1e4d'],
    summaryZh: '为了让变成鬼的妹妹恢复人身，少年踏上斩鬼之路，在旅途中结识同伴，也逐渐逼近悲剧的源头。' },
  { id: 'jujutsu-kaisen', titleZh: '咒术回战', query: 'Jujutsu Kaisen', expect: 'jujutsu kaisen', malId: 40748,
    categories: ['热血', '奇幻'], emoji: '🌀', palette: ['#2b2a5e', '#5a2350'],
    summaryZh: '少年吞下禁忌之物后被卷入咒术师的世界，为了保护同伴、也为了掌控自身背负的力量而战。' },
  { id: 'haikyuu', titleZh: '排球少年!!', query: 'Haikyuu!!', expect: 'haikyuu', malId: 20583,
    categories: ['热血', '日常'], emoji: '🏐', palette: ['#134a72', '#2f7a5a'],
    summaryZh: '身材矮小却弹跳惊人的少年加入高中排球部，与曾经的对手成为队友，一起向着更高的舞台冲击。' },
  { id: 'boku-no-hero', titleZh: '我的英雄学院', query: 'Boku no Hero Academia', expect: 'boku no hero academia|my hero academia', malId: 31964,
    categories: ['热血', '科幻'], emoji: '💥' },
  { id: 'one-punch-man', titleZh: '一拳超人', query: 'One Punch Man', expect: 'one punch man|one-punch man', malId: 30276,
    categories: ['热血', '科幻'], emoji: '👊' },
  { id: 'hunter-x-hunter', titleZh: '全职猎人（2011）', query: 'Hunter x Hunter (2011)', expect: 'hunter', malId: 11061,
    categories: ['热血', '奇幻'], emoji: '🎣' },
  { id: 'fmab', titleZh: '钢之炼金术师 FA', query: 'Fullmetal Alchemist: Brotherhood', expect: 'fullmetal alchemist', malId: 5114,
    categories: ['热血', '奇幻'], emoji: '⚗️' },
  { id: 'gurren-lagann', titleZh: '天元突破 红莲螺岩', query: 'Tengen Toppa Gurren Lagann', expect: 'gurren lagann|tengen toppa', malId: 2001,
    categories: ['热血', '科幻'], emoji: '🔩' },
  { id: 'naruto', titleZh: '火影忍者', query: 'Naruto', expect: 'naruto', malId: 20,
    categories: ['热血', '奇幻'], emoji: '🍥' },
  { id: 'one-piece', titleZh: '海贼王', query: 'One Piece', expect: 'one piece', malId: 21,
    categories: ['热血', '奇幻'], emoji: '🏴‍☠️' },

  // ---- 日常 ----
  { id: 'bocchi', titleZh: '孤独摇滚!', query: 'Bocchi the Rock!', expect: 'bocchi', malId: 47917,
    categories: ['日常', '治愈'], emoji: '🎸', palette: ['#5d2f78', '#c2417a'],
    summaryZh: '极度怕生的少女抱着吉他独自练习多年，意外被拉进乐队后，开始笨拙又真诚地与人建立联系。' },
  { id: 'yuru-camp', titleZh: '摇曳露营△', query: 'Yuru Camp', expect: 'yuru camp|laid-back camp', malId: 34798,
    categories: ['日常', '治愈'], emoji: '⛺', palette: ['#1f5c58', '#2b3f6b'],
    summaryZh: '喜欢独自露营的少女与朋友们在冬日湖畔、山间营地度过安静的时光，简单日常里都是温和的余韵。' },
  { id: 'spy-family', titleZh: '间谍过家家', query: 'Spy x Family', expect: 'spy', malId: 50265,
    categories: ['日常', '热血'], emoji: '🕵️', palette: ['#7a3050', '#24406b'],
    summaryZh: '为完成任务而组建的临时家庭，三个人各自藏着秘密，却在鸡飞狗跳的同居生活里慢慢变成了真正的家人。' },
  { id: 'hyouka', titleZh: '冰菓', query: 'Hyouka', expect: 'hyouka', malId: 12189,
    categories: ['日常', '悬疑'], emoji: '🔍', palette: ['#2c3f6e', '#6b3f5c'],
    summaryZh: '奉行节能主义的高中生被好奇心旺盛的同伴拉入古典部的日常谜题，平静校园里藏着温柔又克制的青春。' },
  { id: 'k-on', titleZh: '轻音少女', query: 'K-On!', expect: 'k-on', malId: 5680,
    categories: ['日常', '治愈'], emoji: '🎹' },
  { id: 'nichijou', titleZh: '日常', query: 'Nichijou', expect: 'nichijou', malId: 10165,
    categories: ['日常'], emoji: '🐐' },
  { id: 'nozaki-kun', titleZh: '月刊少女野崎君', query: 'Gekkan Shoujo Nozaki-kun', expect: 'nozaki', malId: 23289,
    categories: ['日常'], emoji: '✏️' },
  { id: 'kaguya-sama', titleZh: '辉夜大小姐想让我告白', query: 'Kaguya-sama wa Kokurasetai', expect: 'kaguya', malId: 37999,
    categories: ['日常'], emoji: '💗' },
  { id: 'danshi-koukousei', titleZh: '男子高中生的日常', query: 'Danshi Koukousei no Nichijou', expect: 'danshi koukousei|daily lives of high school boys', malId: 11843,
    categories: ['日常'], emoji: '😂' },
  { id: 'shirobako', titleZh: '白箱', query: 'Shirobako', expect: 'shirobako', malId: 25835,
    categories: ['日常'], emoji: '🎬' },
  { id: 'haruhi', titleZh: '凉宫春日的忧郁', query: 'Suzumiya Haruhi no Yuuutsu', expect: 'suzumiya haruhi|haruhi', malId: 849,
    categories: ['日常', '科幻'], emoji: '🎒' },

  // ---- 奇幻 ----
  { id: 'frieren', titleZh: '葬送的芙莉莲', query: 'Sousou no Frieren', expect: 'frieren', malId: 52991,
    categories: ['奇幻', '治愈'], emoji: '🌿', palette: ['#245a52', '#3a3068'],
    summaryZh: '勇者一行打倒魔王之后，寿命漫长的精灵魔法使踏上新的旅途，在缓慢流逝的时间里重新认识曾经并肩的伙伴。' },
  { id: 'dungeon-meshi', titleZh: '迷宫饭', query: 'Dungeon Meshi', expect: 'dungeon meshi|delicious in dungeon', malId: 52701,
    categories: ['奇幻', '日常'], emoji: '🍲', palette: ['#6b4a24', '#2f3f5c'],
    summaryZh: '为了救回同伴，冒险者一行决定在迷宫里就地取材，把魔物做成料理，一边下潜一边研究奇幻生态的餐桌。' },
  { id: 'mushoku-tensei', titleZh: '无职转生', query: 'Mushoku Tensei: Isekai Ittara Honki Dasu', expect: 'mushoku tensei', malId: 39535,
    categories: ['奇幻', '热血'], emoji: '📖' },
  { id: 're-zero', titleZh: 'Re:从零开始的异世界生活', query: 'Re:Zero kara Hajimeru Isekai Seikatsu', expect: 're:zero|rezero', malId: 31240,
    categories: ['奇幻', '悬疑'], emoji: '⏳' },
  { id: 'konosuba', titleZh: '为美好的世界献上祝福!', query: 'Kono Subarashii Sekai ni Shukufuku wo!', expect: 'kono subarashii|konosuba', malId: 30831,
    categories: ['奇幻', '日常'], emoji: '🍺' },
  { id: 'madoka', titleZh: '魔法少女小圆', query: 'Mahou Shoujo Madoka Magica', expect: 'madoka', malId: 9756,
    categories: ['奇幻', '悬疑'], emoji: '🌙' },
  { id: 'made-in-abyss', titleZh: '来自深渊', query: 'Made in Abyss', expect: 'made in abyss', malId: 34599,
    categories: ['奇幻', '热血'], emoji: '🕳️' },
  { id: 'spice-and-wolf', titleZh: '狼与香辛料', query: 'Ookami to Koushinryou', expect: 'spice and wolf|ookami to koushinryou', malId: 2966,
    categories: ['奇幻', '日常'], emoji: '🐺' },

  // ---- 治愈 ----
  { id: 'natsume', titleZh: '夏目友人帐', query: 'Natsume Yuujinchou', expect: 'natsume', malId: 4081,
    categories: ['治愈', '奇幻'], emoji: '🍃', palette: ['#2e5c46', '#4a3a6b'],
    summaryZh: '能看见妖怪的少年继承了外婆留下的契约册，与自称保镖的猫咪老师一起，把名字一页页还给妖怪。' },
  { id: 'violet', titleZh: '紫罗兰永恒花园', query: 'Violet Evergarden', expect: 'violet evergarden', malId: 33352,
    categories: ['治愈', '奇幻'], emoji: '💌', palette: ['#3a2f70', '#7a3f6b'],
    summaryZh: '曾作为兵器长大的少女成为代笔人，在替他人书写心意的过程中，一点点学会理解自己的情感。' },
  { id: 'clannad', titleZh: 'CLANNAD', query: 'CLANNAD', expect: 'clannad', malId: 2167,
    categories: ['治愈', '日常'], emoji: '🌾' },
  { id: 'anohana', titleZh: '未闻花名', query: 'Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai', expect: 'anohana|ano hi mita hana', malId: 9989,
    categories: ['治愈', '日常'], emoji: '🌼' },
  { id: 'your-lie-in-april', titleZh: '四月是你的谎言', query: 'Shigatsu wa Kimi no Uso', expect: 'shigatsu wa kimi no uso|your lie in april', malId: 23273,
    categories: ['治愈', '日常'], emoji: '🎻' },

  // ---- 科幻 / 悬疑 ----
  { id: 'steins-gate', titleZh: '命运石之门', query: 'Steins;Gate', expect: 'steins;gate|steins gate', malId: 9253,
    categories: ['科幻', '悬疑'], emoji: '⏱️' },
  { id: 'death-note', titleZh: '死亡笔记', query: 'Death Note', expect: 'death note', malId: 1535,
    categories: ['悬疑', '热血'], emoji: '📓' },
  { id: 'psycho-pass', titleZh: '心理测量者', query: 'Psycho-Pass', expect: 'psycho-pass|psycho pass', malId: 13601,
    categories: ['科幻', '悬疑'], emoji: '🧠' }
];

/* --------------------------------------------------------------- 基础工具 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = [];
const log = (msg) => { console.log(msg); lines.push(msg); };

let lastRequestAt = 0;

/* Jikan 熔断：仍然遵守「优先 Jikan，失败回退 AniList」，但当 Jikan 连续失败
   （例如当前网络下持续 504）时不再逐条空等，后续条目直接走 AniList。 */
const JIKAN_TRIP_AFTER = 2;
let jikanFailures = 0;
let jikanTripped = false;

function jikanUsable() { return !jikanTripped; }

function noteJikan(ok) {
  if (ok) { jikanFailures = 0; return; }
  jikanFailures += 1;
  if (jikanFailures >= JIKAN_TRIP_AFTER && !jikanTripped) {
    jikanTripped = true;
    log('  ⚠ Jikan 连续失败，判定当前网络不可达：后续条目直接使用 AniList 回退源');
  }
}

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) { await sleep(wait); }
  lastRequestAt = Date.now();
}

function cacheFile(key) {
  return path.join(CACHE_DIR, key.replace(/[^a-z0-9._-]/gi, '_').slice(0, 120) + '.json');
}

async function readCache(key) {
  if (!USE_CACHE) { return null; }
  try {
    const stat = await fs.stat(cacheFile(key));
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) { return null; }
    const parsed = JSON.parse(await fs.readFile(cacheFile(key), 'utf8'));
    // 失败缓存只保留 10 分钟，避免刚刚出错的接口被立刻反复重试
    if (parsed && parsed.__failed && Date.now() - (parsed.at || 0) > 10 * 60 * 1000) { return null; }
    return parsed;
  } catch { return null; }
}

async function writeCache(key, value) {
  if (!USE_CACHE) { return; }
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFile(key), JSON.stringify(value, null, 2), 'utf8');
}

/** 带节流与 429/5xx 退避重试的请求；只返回 JSON，不落盘任何二进制。 */
async function request(key, url, init) {
  const cached = await readCache(key);
  if (cached && cached.__failed) {
    log(`  ↺ 缓存命中（近期请求失败，不再重试） ${key}`);
    return null;
  }
  if (cached) { log(`  ↺ 缓存命中 ${key}`); return cached; }

  let attempt = 0;
  let backoff = 2000;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    await throttle();
    let res;
    try {
      res = await fetch(url, { ...(init || {}), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (err) {
      log(`  ! 网络错误/超时（第 ${attempt} 次）：${err.message}`);
      await sleep(backoff); backoff *= 2;
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
      log(`  ! HTTP ${res.status}，等待 ${Math.round(waitMs / 1000)}s 后重试（第 ${attempt} 次）`);
      await sleep(waitMs);
      backoff *= 2;
      continue;
    }

    if (!res.ok) {
      log(`  ! HTTP ${res.status} ${res.statusText} → ${url}`);
      return null;
    }

    const json = await res.json();
    await writeCache(key, json);
    return json;
  }
  log(`  × 重试 ${MAX_ATTEMPTS} 次仍失败：${url}`);
  await writeCache(key, { __failed: true, at: Date.now(), url });
  return null;
}

/* --------------------------------------------------------------- Jikan API */

const JIKAN = 'https://api.jikan.moe/v4';

function fromJikan(d) {
  const images = d.images || {};
  const jpg = images.jpg || {};
  const webp = images.webp || {};
  return {
    title: d.title || null,
    titleJa: d.title_japanese || null,
    titleEn: d.title_english || null,
    cover: jpg.large_image_url || jpg.image_url || webp.large_image_url || webp.image_url || null,
    coverSmall: jpg.small_image_url || webp.small_image_url || jpg.image_url || null,
    synopsis: d.synopsis ? d.synopsis.trim() : null,
    score: typeof d.score === 'number' ? d.score : null,
    scoredBy: d.scored_by || null,
    rank: d.rank || null,
    episodes: d.episodes || null,
    duration: d.duration || null,
    year: d.year || (d.aired && d.aired.prop && d.aired.prop.from && d.aired.prop.from.year) || null,
    season: d.season || null,
    status: d.status || null,
    rating: d.rating || null,
    genres: (d.genres || []).map((g) => g.name),
    themes: (d.themes || []).map((g) => g.name),
    demographics: (d.demographics || []).map((g) => g.name),
    studios: (d.studios || []).map((s) => s.name),
    malId: d.mal_id || null,
    malUrl: d.url || null,
    anilistId: null,
    anilistUrl: null,
    source: 'jikan'
  };
}

async function jikanById(malId) {
  if (!jikanUsable()) { return null; }
  const json = await request(`jikan-anime-${malId}`, `${JIKAN}/anime/${malId}?sfw`);
  const data = json && json.data ? fromJikan(json.data) : null;
  noteJikan(!!json);
  return data;
}

async function jikanSearch(query) {
  if (!jikanUsable()) { return null; }
  const json = await request(`jikan-search-${query}`, `${JIKAN}/anime?q=${encodeURIComponent(query)}&limit=3&sfw`);
  noteJikan(!!json);
  const list = json && Array.isArray(json.data) ? json.data : [];
  if (!list.length) { return null; }
  return fromJikan(list[0]);
}

async function jikanSeasonNow(limit) {
  if (!jikanUsable()) { return null; }
  const json = await request(`jikan-season-now-${limit}`, `${JIKAN}/seasons/now?limit=${limit}&sfw`);
  noteJikan(!!json);
  return json && Array.isArray(json.data) ? json.data.map(fromJikan) : null;
}

async function jikanTopAiring(limit) {
  if (!jikanUsable()) { return null; }
  const json = await request(`jikan-top-airing-${limit}`, `${JIKAN}/top/anime?filter=airing&limit=${limit}&sfw`);
  noteJikan(!!json);
  return json && Array.isArray(json.data) ? json.data.map(fromJikan) : null;
}

/* ------------------------------------------------------------- AniList API */

const ANILIST = 'https://graphql.anilist.co';
const ANILIST_QUERY = `
query ($search: String, $idMal: Int) {
  Media(search: $search, idMal: $idMal, type: ANIME) {
    id idMal
    title { romaji english native }
    coverImage { extraLarge large medium }
    description(asHtml: false)
    averageScore popularity
    episodes duration
    season seasonYear
    status(version: 2)
    genres
    studios(isMain: true) { nodes { name } }
    siteUrl
  }
}`;

const ANILIST_STATUS_ZH = {
  FINISHED: 'Finished Airing',
  RELEASING: 'Currently Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'On Hiatus'
};

/** AniList 的「近期热门连载」——当 Jikan 的 seasons/now 与 top/anime 都不可用时的回退。 */
const ANILIST_TRENDING_QUERY = `
query ($limit: Int) {
  Page(page: 1, perPage: $limit) {
    media(sort: TRENDING_DESC, type: ANIME, status: RELEASING, isAdult: false) {
      id idMal
      title { romaji english native }
      coverImage { extraLarge large medium }
      description(asHtml: false)
      averageScore popularity
      episodes duration
      season seasonYear
      status(version: 2)
      genres
      studios(isMain: true) { nodes { name } }
      siteUrl
    }
  }
}`;

async function anilistTrending(limit) {
  const json = await request(`anilist-trending-${limit}`, ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ANILIST_TRENDING_QUERY, variables: { limit } })
  });
  const media = json && json.data && json.data.Page ? json.data.Page.media : null;
  if (!Array.isArray(media)) { return null; }
  return media.map(fromAniList).filter(Boolean);
}

function fromAniList(m) {
  if (!m) { return null; }
  return {
    title: m.title && (m.title.romaji || m.title.english) ? (m.title.romaji || m.title.english) : null,
    titleJa: m.title ? m.title.native : null,
    titleEn: m.title ? m.title.english : null,
    cover: m.coverImage ? (m.coverImage.extraLarge || m.coverImage.large || m.coverImage.medium) : null,
    coverSmall: m.coverImage ? (m.coverImage.medium || m.coverImage.large) : null,
    synopsis: m.description ? String(m.description).replace(/<[^>]+>/g, '').trim() : null,
    score: typeof m.averageScore === 'number' ? Math.round((m.averageScore / 10) * 100) / 100 : null,
    scoredBy: m.popularity || null,
    rank: null,
    episodes: m.episodes || null,
    duration: m.duration ? `${m.duration} min per ep` : null,
    year: m.seasonYear || null,
    season: m.season ? String(m.season).toLowerCase() : null,
    status: m.status ? (ANILIST_STATUS_ZH[m.status] || m.status) : null,
    rating: null,
    genres: m.genres || [],
    themes: [],
    demographics: [],
    studios: m.studios && m.studios.nodes ? m.studios.nodes.map((n) => n.name) : [],
    malId: m.idMal || null,
    malUrl: m.idMal ? `https://myanimelist.net/anime/${m.idMal}` : null,
    anilistId: m.id || null,
    anilistUrl: m.siteUrl || null,
    source: 'anilist'
  };
}

async function anilistFetch(variables, key) {
  const json = await request(key, ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables })
  });
  return json && json.data ? fromAniList(json.data.Media) : null;
}

/* ---------------------------------------------------------------- 匹配逻辑 */

function titlesOf(d) {
  return [d.title, d.titleEn, d.titleJa].filter(Boolean).join(' | ').toLowerCase();
}

function matches(d, expect) {
  if (!d) { return false; }
  if (!expect) { return true; }
  const haystack = titlesOf(d);
  return new RegExp(expect, 'i').test(haystack);
}

function hashPalette(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) { h = (h * 31 + seed.charCodeAt(i)) % 100000; }
  return FALLBACK_PALETTES[h % FALLBACK_PALETTES.length];
}

async function resolveEntry(entry) {
  log(`• ${entry.titleZh} (${entry.id})  query="${entry.query}"`);

  // 1) Jikan：已知 malId 直接取，否则搜索
  let data = entry.malId ? await jikanById(entry.malId) : null;
  if (!data) { data = await jikanSearch(entry.query); }
  if (data && !matches(data, entry.expect)) {
    log(`  ! Jikan 结果与预期不符：${data.title}`);
    data = null;
  }

  // 2) 回退 AniList
  if (!data) {
    log('  → 回退 AniList');
    data = entry.malId
      ? await anilistFetch({ idMal: entry.malId }, `anilist-idmal-${entry.malId}`)
      : null;
    if (!data) { data = await anilistFetch({ search: entry.query }, `anilist-search-${entry.query}`); }
    if (data && !matches(data, entry.expect)) {
      log(`  ! AniList 结果与预期不符：${data.title}`);
      data = null;
    }
  }

  const base = {
    id: entry.id,
    titleZh: entry.titleZh,
    categories: entry.categories,
    emoji: entry.emoji || '✨',
    palette: entry.palette || hashPalette(entry.id),
    summaryZh: entry.summaryZh || null
  };

  if (!data) {
    log('  × 两个数据源都没有匹配结果 → 保留占位（不生成简介）');
    return {
      ...base,
      title: null, titleJa: null, titleEn: null,
      cover: null, coverSmall: null, synopsis: null,
      score: null, scoredBy: null, rank: null,
      episodes: null, duration: null, year: null, season: null,
      status: null, rating: null,
      genres: [], themes: [], demographics: [], studios: [],
      malId: entry.malId || null, malUrl: null, anilistId: null, anilistUrl: null,
      source: 'placeholder'
    };
  }

  const merged = { ...base, ...data, id: entry.id, titleZh: entry.titleZh, categories: entry.categories,
    emoji: base.emoji, palette: base.palette, summaryZh: base.summaryZh };
  log(`  ✓ [${merged.source}] ${merged.title} · 分数 ${merged.score ?? '—'} · ${merged.episodes ?? '—'} 集 · ${merged.year ?? '—'}`);
  return merged;
}

/* ------------------------------------------------------ 本季 / 热门 列表 */

function toTrendingItem(d, index) {
  return {
    rank: index + 1,
    malId: d.malId,
    title: d.title,
    titleEn: d.titleEn,
    cover: d.cover,
    score: d.score,
    episodes: d.episodes,
    year: d.year,
    season: d.season,
    status: d.status,
    genres: d.genres,
    categories: guessCategories(d),
    malUrl: d.malUrl,
    anilistUrl: d.anilistUrl
  };
}

/** 依据 MAL 类型粗略映射到站点分类（仅用于热播列表的配色标签）。 */
function guessCategories(d) {
  const g = [...(d.genres || []), ...(d.themes || [])].map((s) => s.toLowerCase());
  const cats = [];
  const has = (k) => g.some((x) => x.includes(k));
  if (has('action') || has('sports') || has('martial')) { cats.push('热血'); }
  if (has('fantasy') || has('supernatural') || has('magic') || has('isekai')) { cats.push('奇幻'); }
  if (has('slice of life') || has('comedy') || has('romance')) { cats.push('日常'); }
  if (has('drama') || has('healing')) { cats.push('治愈'); }
  if (has('sci-fi') || has('mecha') || has('space')) { cats.push('科幻'); }
  if (has('mystery') || has('suspense') || has('thriller') || has('horror')) { cats.push('悬疑'); }
  return [...new Set(cats)].slice(0, 2);
}

async function buildTrending(limit) {
  if (ONLY === 'anime') { return null; }
  log('\n== 拉取「本季 / 热门」列表 ==');
  let items = await jikanSeasonNow(limit);
  let source = 'jikan:seasons/now';
  if (!items || !items.length) {
    log('  ! seasons/now 无数据，改用 top/anime?filter=airing');
    items = await jikanTopAiring(limit);
    source = 'jikan:top/anime?filter=airing';
  }
  if (!items || !items.length) {
    log('  ! Jikan 不可用，改用 AniList（TRENDING_DESC + RELEASING）');
    items = await anilistTrending(limit);
    source = 'anilist:trending(releasing)';
  }
  if (!items || !items.length) {
    log('  × 本季/热门列表拉取失败，将写入空列表（站点会自动隐藏该区块）');
    return { generatedAt: new Date().toISOString(), source: null, season: null, items: [] };
  }
  const season = items[0].season ? `${items[0].year || ''} ${SEASON_ZH[items[0].season] || items[0].season}`.trim() : null;
  log(`  ✓ ${source} · ${items.length} 条 · ${season || '季节未知'}`);
  return {
    generatedAt: new Date().toISOString(),
    source,
    season,
    items: items.map(toTrendingItem)
  };
}

/* ------------------------------------------------------------- 输出文件 */

function asJsonFile(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

/** file:// 直接双击打开时 fetch 本地 JSON 会被拦，用同名 .js 做兜底。 */
function asJsFile(globalName, value) {
  return `/* 由 work/fetch-anime-data.mjs 生成，供 file:// 打开时兜底使用，请勿手改。 */\n` +
    `window.${globalName} = ${JSON.stringify(value, null, 2)};\n`;
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  log(`# 番剧数据抓取报告\n`);
  log(`- 运行时间：${new Date().toISOString()}`);
  log(`- 缓存：${USE_CACHE ? '启用 work/api-cache' : '禁用（--no-cache）'}`);
  log(`- 请求间隔下限：${MIN_INTERVAL_MS}ms，单次超时 ${FETCH_TIMEOUT_MS}ms，429/5xx 最多重试 ${MAX_ATTEMPTS} 次`);
  log(`- 数据源优先级：Jikan（MAL）→ AniList；Jikan 连续失败 ${JIKAN_TRIP_AFTER} 次后熔断\n`);
  const results = [];
  if (ONLY === 'trending') {
    log('== 跳过番剧元数据抓取（--only=trending）==');
  } else {
    log('== 逐条抓取番剧元数据 ==');
    for (const entry of ENTRIES) {
      results.push(await resolveEntry(entry));
    }
  }

  if (results.length) {
    const dupes = {};
    results.forEach((r) => {
      if (r.malId) { dupes[r.malId] = (dupes[r.malId] || []).concat(r.id); }
    });
    const dupList = Object.entries(dupes).filter(([, ids]) => ids.length > 1);

    const stats = {
      total: results.length,
      jikan: results.filter((r) => r.source === 'jikan').length,
      anilist: results.filter((r) => r.source === 'anilist').length,
      placeholder: results.filter((r) => r.source === 'placeholder').length,
      withCover: results.filter((r) => r.cover).length,
      withSynopsis: results.filter((r) => r.synopsis).length
    };

    log(`\n== 汇总 ==`);
    log(`- 条目：${stats.total}（Jikan ${stats.jikan} · AniList ${stats.anilist} · 占位 ${stats.placeholder}）`);
    log(`- 有封面 URL：${stats.withCover} / ${stats.total}`);
    log(`- 有简介：${stats.withSynopsis} / ${stats.total}`);
    if (dupList.length) {
      log(`- ⚠ 重复的 MAL id：${dupList.map(([id, ids]) => `${id} → ${ids.join(',')}`).join('; ')}`);
    }
    const placeholders = results.filter((r) => r.source === 'placeholder').map((r) => r.titleZh);
    if (placeholders.length) { log(`- 占位条目：${placeholders.join('、')}`); }

    await fs.writeFile(path.join(DATA_DIR, 'anime.json'), asJsonFile(results), 'utf8');
    await fs.writeFile(path.join(DATA_DIR, 'anime.js'), asJsFile('__ANIME_DATA__', results), 'utf8');
    log(`\n已写入 data/anime.json（${results.length} 条）与 data/anime.js（file:// 兜底）`);
  }

  const trending = await buildTrending(18);
  if (trending) {
    await fs.writeFile(path.join(DATA_DIR, 'trending.json'), asJsonFile(trending), 'utf8');
    await fs.writeFile(path.join(DATA_DIR, 'trending.js'), asJsFile('__TRENDING_DATA__', trending), 'utf8');
    log(`已写入 data/trending.json（${trending.items.length} 条）与 data/trending.js`);
  }

  const actual = results.length
    ? `本次番剧元数据实际来源：Jikan ${results.filter((r) => r.source === 'jikan').length} 条、`
      + `AniList ${results.filter((r) => r.source === 'anilist').length} 条、`
      + `占位 ${results.filter((r) => r.source === 'placeholder').length} 条。`
    : '本次只更新了热门列表，未重抓番剧元数据。';
  log(`\n说明：封面与图片只保存 URL，脚本不会下载任何图片文件；简介、分数、集数等来自 Jikan(MAL)，`
    + `Jikan 不可用时回退 AniList（AniList 数据标注进站内「关于」页）；无匹配条目保留占位且不编造简介。\n${actual}`);

  await fs.writeFile(path.join(__dirname, 'fetch-report.md'), lines.join('\n') + '\n', 'utf8');
  console.log('\n报告已写入 work/fetch-report.md');
}

main().catch((err) => {
  console.error('抓取失败：', err);
  process.exitCode = 1;
});
