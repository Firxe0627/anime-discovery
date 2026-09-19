#!/usr/bin/env node
/**
 * work/fetch-anime-data.mjs
 * ---------------------------------------------------------------------------
 * 为 AnimeDiscovery 生成静态数据（一次性脚本，可反复重跑）。
 *
 * 数据来源
 *   - 主资料：AniList GraphQL —— 按「年份轴」分页（2005–2026，每年前 N 部，
 *     sort: POPULARITY_DESC，type: ANIME，format_in: [TV, MOVIE, ONA]，isAdult: false），
 *     每页 50；含封面 URL、简介、分数、集数 / 时长、年份 / 季节、制作公司、
 *     relations、官方 YouTube trailer id（只存视频 id，不下载视频）。
 *   - 中文名 / 中文简介：Bangumi（api.bgm.tv/v0/search/subjects，带 User-Agent，间隔 ≥1.1 秒）。
 *   - 可选回退：Jikan（api.jikan.moe）只在「Bangumi 没匹配上、且该条缺 MAL id」时
 *     补一个 MAL id；连续失败 3 次即熔断，本次运行不再调用（不做无谓等待）。
 *
 * 硬性约束
 *   - 只保存文本与图片 / 视频 URL；**绝不下载图片、视频**（trailer 只存 YouTube 视频 id）。
 *   - 请求间隔 ≥1.1 秒；单请求 20 秒超时；429 / 5xx 按 Retry-After 或指数退避重试；
 *     失败结果写入缓存并保留 10 分钟，期间不再重复打接口。
 *   - 中文名 / 中文简介一律来自 Bangumi，匹配不上就留空（前端显示原名 / 英文简介），不做机翻。
 *   - 抓取结果比现有库少 20% 以上时保留旧 JSON，不覆盖。
 *   - 单文件 < 3MB：超过就拆成 data/anime-1.json / anime-2.json …，前端合并后仍分批渲染。
 *
 * 用法
 *   node work/fetch-anime-data.mjs                    # 每年 150 部，2005–2026，走缓存
 *   node work/fetch-anime-data.mjs --per-year=200     # 改每年前 N 部
 *   node work/fetch-anime-data.mjs --years=2006-2026  # 改年份区间
 *   node work/fetch-anime-data.mjs --no-cache         # 忽略缓存重新请求
 *   node work/fetch-anime-data.mjs --skip-bangumi     # 只跑 AniList
 *   node work/fetch-anime-data.mjs --only=trending    # 只更新热门列表
 *
 * 产物
 *   outputs/anime-discovery/data/anime.json（单文件时是数组，拆文件时是清单）+ anime-*.json
 *   outputs/anime-discovery/data/anime.js（file:// 兜底）
 *   outputs/anime-discovery/data/trending.json + trending.js
 *   work/fetch-report.md
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'outputs', 'anime-discovery', 'data');
const CACHE_DIR = path.join(__dirname, 'api-cache');
const REPORT_PATH = path.join(__dirname, 'fetch-report.md');

/* Bangumi 要求带可识别的 User-Agent */
const UA = 'AnimeDiscovery/1.0 (+https://github.com/Firxe0627/anime-discovery)';

const MIN_INTERVAL_MS = 1100;
const MAX_ATTEMPTS = 4;
const FETCH_TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const FAIL_CACHE_TTL_MS = 10 * 60 * 1000;

/* 主库筛选规则：TV / Movie / ONA，2005 年至今（用户要求 2006–2026，2005 的保留） */
const FORMATS = ['TV', 'MOVIE', 'ONA'];
const MIN_YEAR = 2005;
const MAX_YEAR = 2026;

/* 拆文件目标：单个 part < 3MB（留一点余量） */
const PART_LIMIT_BYTES = 2900000;
/* Jikan 连续失败几次就熔断 */
const JIKAN_BREAK_AFTER = 3;
/* 每页拉多少（AniList 上限 50） */
const PAGE_SIZE = 50;

const argv = process.argv.slice(2);
const argOf = (name) => {
  const hit = argv.find((a) => a.startsWith(name + '='));
  return hit ? hit.split('=')[1] : null;
};
const numOf = (raw, fallback, min) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? Math.round(n) : fallback;
};

const PER_YEAR = numOf(argOf('--per-year'), 150, 20);
const ONLY = argOf('--only') || 'all';
const USE_CACHE = !argv.includes('--no-cache');
const SKIP_BANGUMI = argv.includes('--skip-bangumi');
const SKIP_JIKAN = argv.includes('--skip-jikan');
const TRENDING_LIMIT = numOf(argOf('--trending'), 24, 10);
const LIMIT = argOf('--limit') ? numOf(argOf('--limit'), 0, 1) : 0;

const yearsArg = argOf('--years');
const YEARS = [];
{
  let from = MIN_YEAR;
  let to = MAX_YEAR;
  if (yearsArg) {
    const m = /^(\d{4})\s*-\s*(\d{4})$/.exec(yearsArg.trim());
    if (m) { from = Number(m[1]); to = Number(m[2]); }
  }
  for (let y = Math.max(1900, from); y <= Math.min(2100, to); y += 1) { YEARS.push(y); }
}

const ANIME_FILE = path.join(DATA_DIR, 'anime.json');

const lines = [];
const log = (msg) => { console.log(msg); lines.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 运行统计（写进报告） */
const stats = {
  net: 0, cacheHits: 0, failures: 0, bangumiHits: 0, jikanUsed: 0,
  bgmLegacySearch: 0, bgmDetail: 0
};
let jikanFails = 0;
let jikanBroken = false;
let bgmFails = 0;               // Bangumi 连续失败次数
let bgmCooldowns = 0;           // 连续失败触发过几次冷却
let bgmBroken = false;          // 熔断：本次运行不再打 Bangumi
let bgmV0Fails = 0;             // v0 搜索接口连续失败
let bgmV0Down = false;          // v0 搜索接口不可用：本次运行改走旧版搜索接口
const BGM_FAILS_PER_COOLDOWN = 4;
const BGM_COOLDOWN_MS = 60000;
const BGM_COOLDOWNS_BEFORE_BREAK = 2;
const BGM_V0_FAILS_BEFORE_SWITCH = 3;

/* ------------------------------------------------------------------ 请求层 */

let lastRequestAt = 0;

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) { await sleep(wait); }
  lastRequestAt = Date.now();
}

/** 缓存文件名 = 可读前缀 + key 的哈希，避免日文标题被清洗后互相撞名。 */
const cacheFile = (key) => {
  const safe = key.replace(/[^a-z0-9._-]/gi, '_').slice(0, 60);
  const hash = crypto.createHash('sha1').update(key).digest('hex').slice(0, 10);
  return path.join(CACHE_DIR, `${safe}-${hash}.json`);
};

async function readCache(key) {
  if (!USE_CACHE) { return null; }
  try {
    const stat = await fs.stat(cacheFile(key));
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) { return null; }
    const parsed = JSON.parse(await fs.readFile(cacheFile(key), 'utf8'));
    if (parsed && parsed.__failed && Date.now() - (parsed.at || 0) > FAIL_CACHE_TTL_MS) { return null; }
    return parsed;
  } catch { return null; }
}

async function writeCache(key, value) {
  if (!USE_CACHE) { return; }
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cacheFile(key), JSON.stringify(value), 'utf8');
}

/**
 * 带节流、20 秒超时与 429 / 5xx 退避重试的请求。只返回 JSON。
 * 失败（网络错误、非 2xx、JSON 解析失败）会写一条 __failed 缓存，10 分钟内不再重试同一 key。
 */
async function request(key, url, init, opts) {
  const cached = await readCache(key);
  if (cached && cached.__failed) { stats.cacheHits += 1; return null; }
  if (cached !== null) { stats.cacheHits += 1; return cached; }

  const maxAttempts = (opts && opts.attempts) || MAX_ATTEMPTS;
  let attempt = 0;
  let backoff = 2000;
  while (attempt < maxAttempts) {
    attempt += 1;
    await throttle();
    let res;
    stats.net += 1;
    try {
      res = await fetch(url, { ...(init || {}), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (err) {
      log(`  ! 网络错误（第 ${attempt} 次）：${err.message}`);
      await sleep(backoff); backoff *= 2;
      continue;
    }

    if (res.status === 429 || res.status === 403 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
      log(`  ! HTTP ${res.status}，等待 ${Math.round(waitMs / 1000)}s 重试（第 ${attempt} 次）`);
      await sleep(waitMs); backoff *= 2;
      continue;
    }

    if (!res.ok) {
      log(`  ! HTTP ${res.status} ${res.statusText} → ${url}`);
      stats.failures += 1;
      await writeCache(key, { __failed: true, at: Date.now(), url, status: res.status });
      return null;
    }

    const json = await res.json().catch(() => null);
    if (json === null) {
      stats.failures += 1;
      await writeCache(key, { __failed: true, at: Date.now(), url, status: res.status });
      return null;
    }
    await writeCache(key, json);
    return json;
  }
  log(`  × 重试 ${maxAttempts} 次仍失败：${url}`);
  stats.failures += 1;
  await writeCache(key, { __failed: true, at: Date.now(), url });
  return null;
}

/* ---------------------------------------------------------------- AniList */

const ANILIST = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  coverImage { extraLarge large medium }
  description(asHtml: false)
  averageScore meanScore popularity favourites
  episodes duration season seasonYear format status
  startDate { year month day }
  genres
  studios(isMain: true) { nodes { name } }
  trailer { id site }
  relations {
    edges {
      relationType
      node { id format type seasonYear title { romaji native } }
    }
  }
`;

/** 年份轴批量查询：每年单独翻页，保证资料库覆盖 2005–2026 的每一年。 */
const YEAR_BULK_QUERY = `query ($page: Int, $perPage: Int, $from: FuzzyDateInt, $to: FuzzyDateInt) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage lastPage hasNextPage }
    media(sort: POPULARITY_DESC, type: ANIME, format_in: [TV, MOVIE, ONA],
          startDate_greater: $from, startDate_lesser: $to, isAdult: false) { ${MEDIA_FIELDS} }
  }
}`;

const TRENDING_QUERY = `query ($perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(sort: TRENDING_DESC, type: ANIME, status: RELEASING, isAdult: false) { ${MEDIA_FIELDS} }
  }
}`;

async function anilist(query, variables, key) {
  const json = await request(key, ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!json || json.errors) {
    if (json && json.errors) { log(`  ! AniList 报错：${JSON.stringify(json.errors[0]).slice(0, 160)}`); }
    return null;
  }
  return json.data;
}

/** 拉某一年的前 N 部（POPULARITY_DESC）。AniList 的 greater / lesser 都是开区间。 */
async function fetchYear(year, want) {
  const from = (year - 1) * 10000 + 1231;
  const to = (year + 1) * 10000 + 101;
  const out = [];
  let page = 1;
  let lastPage = 1;
  while (out.length < want && page <= lastPage) {
    const perPage = Math.min(PAGE_SIZE, want - out.length);
    const data = await anilist(YEAR_BULK_QUERY, { page, perPage, from, to }, `anilist-year-${year}-${page}-${perPage}`);
    if (!data || !data.Page) { log(`  ! ${year} 年第 ${page} 页失败，放弃该年剩余翻页`); break; }
    const media = data.Page.media || [];
    out.push(...media);
    lastPage = data.Page.pageInfo?.lastPage || page;
    if (!data.Page.pageInfo?.hasNextPage) { break; }
    page += 1;
  }
  return out.slice(0, want);
}

/* ---------------------------------------------------------------- Bangumi */

const BANGUMI = 'https://api.bgm.tv';

const stripHtml = (s) => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+\n/g, '\n')
  .trim();

/** 归一化标题用于匹配：只保留拉丁字母、数字与日文 / 中文字符。 */
const normalize = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^0-9a-z\u3040-\u30ff\u4e00-\u9fff]/g, '');

const BGM_HEADERS = { Accept: 'application/json', 'User-Agent': UA };

/** 旧版搜索结果 → 与 v0 搜索结果同形的候选对象 */
const mapLegacySubject = (s) => ({
  id: s.id,
  name: s.name || '',
  name_cn: s.name_cn || '',
  date: s.air_date || '',
  summary: s.summary || ''
});

/**
 * Bangumi 搜索（中文名 / 中文简介的来源）：
 *   ① 首选 v0 接口 POST /v0/search/subjects（返回 name_cn + summary）
 *   ② v0 连续失败 3 次就切到旧版接口 GET /search/subject/{kw}（同一个 Bangumi，只是另一个端点）
 * 两个通道都失败才计入熔断计数。
 */
async function bangumiSearch(keyword) {
  if (!keyword || bgmBroken) { return null; }

  let candidates = null;
  if (!bgmV0Down) {
    const json = await request(`bgm-search-${keyword}`, `${BANGUMI}/v0/search/subjects?limit=5`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...BGM_HEADERS },
      body: JSON.stringify({ keyword, filter: { type: [2] } })
    }, { attempts: 2 });                        // Bangumi 出错时最多退避 2+4 秒，不长时间空等
    if (json && Array.isArray(json.data)) {
      bgmV0Fails = 0;
      candidates = json.data;
    } else {
      bgmV0Fails += 1;
      if (bgmV0Fails >= BGM_V0_FAILS_BEFORE_SWITCH) {
        bgmV0Down = true;
        log(`  ⚡ Bangumi v0 搜索接口连续失败 ${bgmV0Fails} 次，本次运行改用旧版搜索接口（仍是 Bangumi）。`);
      }
    }
  }

  if (!candidates) {
    const legacyKey = `bgm-legacy-${keyword}`;
    const legacy = await request(legacyKey,
      `${BANGUMI}/search/subject/${encodeURIComponent(keyword)}?type=2&responseGroup=small&max_results=5`,
      { headers: BGM_HEADERS }, { attempts: 2 });
    if (legacy && Array.isArray(legacy.list)) {
      candidates = legacy.list.map(mapLegacySubject);
      if (candidates.length) { stats.bgmLegacySearch += 1; }
    } else if (legacy && typeof legacy.results === 'number') {
      candidates = [];                            // 接口正常，只是没有匹配结果
    }
  }

  if (!candidates) {
    bgmFails += 1;
    if (bgmFails >= BGM_FAILS_PER_COOLDOWN) {
      bgmFails = 0;
      bgmCooldowns += 1;
      if (bgmCooldowns > BGM_COOLDOWNS_BEFORE_BREAK) {
        bgmBroken = true;
        log(`  ⚡ Bangumi 连续失败并冷却 ${bgmCooldowns - 1} 次仍不可用，熔断：本次运行不再请求 Bangumi。`);
      } else {
        log(`  ⏳ Bangumi 连续失败，冷却 ${BGM_COOLDOWN_MS / 1000}s 后再试（第 ${bgmCooldowns} 次）`);
        await sleep(BGM_COOLDOWN_MS);
      }
    }
    return null;
  }
  bgmFails = 0;
  return candidates;
}

/** Bangumi 条目详情：拿中文简介（v0 优先，失败退回旧版条目接口，接口同一来源） */
async function bangumiSubject(id) {
  if (!id || bgmBroken) { return null; }
  stats.bgmDetail += 1;
  const json = await request(`bgm-subject-${id}`, `${BANGUMI}/v0/subjects/${id}`,
    { headers: BGM_HEADERS }, { attempts: 2 });
  if (json && typeof json === 'object') { return json; }
  const legacy = await request(`bgm-subject-legacy-${id}`, `${BANGUMI}/subject/${id}?responseGroup=large`,
    { headers: BGM_HEADERS }, { attempts: 1 });
  return legacy && legacy.id ? legacy : null;
}

/**
 * 匹配 Bangumi 条目：优先精确同名（日文原名 / 罗马字 / 英文名），
 * 其次唯一候选且年份相差 ≤1。匹配不上就返回 null（不做任何猜测）。
 */
function pickBangumi(candidates, media) {
  if (!candidates || !candidates.length) { return null; }
  const titles = [media.title?.native, media.title?.romaji, media.title?.english]
    .filter(Boolean).map(normalize);
  let best = null;
  for (const c of candidates) {
    const names = [c.name, c.name_cn].filter(Boolean).map(normalize);
    const exact = names.some((n) => titles.includes(n));
    const yearOk = !c.date || !media.seasonYear
      || Math.abs(Number(String(c.date).slice(0, 4)) - media.seasonYear) <= 1;
    if (exact && yearOk) { best = c; break; }
    if (!best && exact) { best = c; }
  }
  if (best) { return best; }
  if (candidates.length === 1) {
    const c = candidates[0];
    const year = Number(String(c.date || '').slice(0, 4));
    if (!year || !media.seasonYear || Math.abs(year - media.seasonYear) <= 1) { return c; }
  }
  return null;
}

/** Jikan：只在缺少 MAL id 且 Bangumi 没命中时兜底；连续失败 3 次熔断。 */
async function jikanFallback(rec) {
  if (SKIP_JIKAN || jikanBroken) { return null; }
  const q = rec.name_romaji || rec.name_en || rec.name;
  if (!q) { return null; }
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=1&sfw=true`;
  const json = await request(`jikan-search-${q}`, url, {
    headers: { Accept: 'application/json', 'User-Agent': UA }
  }, { attempts: 2 });
  const hit = json && Array.isArray(json.data) ? json.data[0] : null;
  if (!hit) {
    jikanFails += 1;
    if (jikanFails >= JIKAN_BREAK_AFTER) {
      jikanBroken = true;
      log(`  ⚡ Jikan 连续失败 ${jikanFails} 次，熔断：本次运行不再调用 Jikan。`);
    }
    return null;
  }
  jikanFails = 0;
  stats.jikanUsed += 1;
  return hit;
}

/* -------------------------------------------------------------- 类型映射 */

const CATEGORY_RULES = [
  [/action|adventure|martial arts|super power|sports|mecha/i, '热血'],
  [/slice of life|comedy|music|school|performing arts/i, '日常'],
  [/fantasy|supernatural|magic|isekai|adventure|demons/i, '奇幻'],
  [/drama|romance|iyashikei|healing/i, '治愈'],
  [/sci-?fi|space|mecha|virtual reality|cyberpunk/i, '科幻'],
  [/mystery|thriller|suspense|horror|psychological|crime/i, '悬疑']
];

function categoriesOf(genres) {
  const out = [];
  CATEGORY_RULES.forEach(([re, name]) => {
    if ((genres || []).some((g) => re.test(g)) && !out.includes(name)) { out.push(name); }
  });
  return out.slice(0, 3);
}

const EMOJI_BY_CATEGORY = { '热血': '🔥', '日常': '☕', '奇幻': '✨', '治愈': '🌿', '科幻': '🛰️', '悬疑': '🔍' };
const PALETTES = [
  ['#2f3a6b', '#7a2f52'], ['#1f5c58', '#3a3068'], ['#4a3a6b', '#a2415f'],
  ['#134a72', '#2f7a5a'], ['#5d2f78', '#c2417a'], ['#6b4a24', '#2f3f5c'],
  ['#2b2a5e', '#5a2350'], ['#24406b', '#6b3050'], ['#1f4c5c', '#54306b'],
  ['#3a4a24', '#2b3f6b']
];
const hashOf = (s) => {
  let h = 0;
  for (let i = 0; i < String(s).length; i += 1) { h = (h * 31 + String(s).charCodeAt(i)) % 100000; }
  return h;
};

const slugify = (s) => String(s || '')
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

const truncate = (s, max) => {
  const t = String(s || '').trim();
  if (!t) { return null; }
  return t.length <= max ? t : t.slice(0, max).replace(/\s+\S*$/, '') + '…';
};

/* ------------------------------------------------------------- 记录构造 */

const RELATION_KEEP = new Set([
  'PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'ALTERNATIVE', 'SPIN_OFF', 'ADAPTATION'
]);
const RELATION_ZH = {
  PREQUEL: '前作', SEQUEL: '续作', PARENT: '正篇', SIDE_STORY: '外传',
  ALTERNATIVE: '剧场版/替代版本', SPIN_OFF: '衍生', ADAPTATION: '原作'
};

function relationsOf(media) {
  const edges = media.relations?.edges || [];
  const out = [];
  for (const e of edges) {
    const n = e.node;
    if (!n || n.type !== 'ANIME') { continue; }
    if (!RELATION_KEEP.has(e.relationType)) { continue; }
    const name = n.title?.native || n.title?.romaji;
    if (!name) { continue; }
    out.push({
      anilistId: n.id,
      name,
      relation: e.relationType,
      relationZh: RELATION_ZH[e.relationType] || e.relationType,
      format: n.format || null,
      year: n.seasonYear || null
    });
    if (out.length >= 8) { break; }
  }
  // 前作 / 续作优先展示
  const priority = { PREQUEL: 0, SEQUEL: 0, PARENT: 1, SIDE_STORY: 2, ALTERNATIVE: 3, SPIN_OFF: 4, ADAPTATION: 5 };
  return out.sort((a, b) => (priority[a.relation] ?? 9) - (priority[b.relation] ?? 9));
}

function trailerOf(media) {
  const t = media.trailer;
  if (!t || t.site !== 'youtube' || !t.id) { return null; }
  const id = String(t.id).trim();          // AniList 偶尔带空白字符
  return /^[\w-]{6,20}$/.test(id) ? id : null;
}

const yearOf = (m) => m.seasonYear || m.startDate?.year || null;

function toRecord(media) {
  const genres = media.genres || [];
  const slug = slugify(media.title?.romaji || media.title?.english || '') || 'ani';
  const year = yearOf(media);
  const cats = categoriesOf(genres);
  return {
    anilistId: media.id,
    malId: media.idMal || null,
    bgmId: null,
    slug,
    name: media.title?.native || media.title?.romaji || media.title?.english || null,
    name_cn: null,
    name_en: media.title?.english || null,
    name_romaji: media.title?.romaji || null,
    cover: media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || null,
    coverSmall: media.coverImage?.medium || media.coverImage?.large || null,
    summary_en: truncate(stripHtml(media.description), 900),
    summary_cn: null,
    summary_cn_short: null,
    score: typeof media.averageScore === 'number' ? Math.round(media.averageScore) / 10 : null,
    scoredBy: media.popularity || null,
    genres,
    categories: cats.length ? cats : ['日常'],
    episodes: media.episodes || null,
    year,
    season: media.season ? String(media.season).toLowerCase() : null,
    format: media.format || null,
    status: media.status || null,
    studios: (media.studios?.nodes || []).map((n) => n.name),
    relations: relationsOf(media),
    trailer: trailerOf(media),
    emoji: EMOJI_BY_CATEGORY[cats[0]] || '✨',
    palette: PALETTES[hashOf(media.id) % PALETTES.length],
    has_cn: false
  };
}

/* ----------------------------------------------------------- 过滤规则 */

/**
 * 「不要短篇广告」：AniList 里有一些 1–6 分钟的 ONA，本质是 CM / PV / 宣传短片。
 * 用「时长 + 标题关键词」两条保守规则挡掉；剧场版单独判断正片时长。
 */
const PROMO_TITLE = /(\bCM\b|\bTVCM\b|\bPV\b|promo(tion)?\s*video|\bteaser\b|web\s*cm)/i;

function isShortPromo(m) {
  const dur = Number(m.duration) || 0;
  if (m.format === 'MOVIE') { return dur > 0 && dur <= 12; }
  if (dur > 0 && dur <= 6) { return true; }
  const title = `${m.title?.romaji || ''} ${m.title?.native || ''}`;
  return PROMO_TITLE.test(title);
}

/* --------------------------------------------------- 与旧数据合并（保中文） */

/** 兼容两种旧格式：anime.json 是数组（单文件）或 { parts: [...] }（拆文件）。 */
async function loadExisting() {
  const empty = { byAniId: new Map(), byMalId: new Map(), raw: [] };
  try {
    const json = JSON.parse(await fs.readFile(ANIME_FILE, 'utf8'));
    let raw = [];
    if (Array.isArray(json)) { raw = json; }
    else if (json && Array.isArray(json.parts)) {
      for (const part of json.parts) {
        const rel = typeof part === 'string' ? part : part.file;
        if (!rel) { continue; }
        try {
          const chunk = JSON.parse(await fs.readFile(path.join(DATA_DIR, path.basename(rel)), 'utf8'));
          if (Array.isArray(chunk)) { raw.push(...chunk); }
        } catch { /* 单个 part 读不到就跳过 */ }
      }
    }
    if (!raw.length) {
      log('现有 anime.json 里没有可复用的条目（首次运行或文件被清空）');
      return empty;
    }
    const byAniId = new Map();
    const byMalId = new Map();
    for (const item of raw) {
      if (item.anilistId) { byAniId.set(item.anilistId, item); }
      if (item.malId) { byMalId.set(item.malId, item); }
    }
    log(`读取旧数据 ${raw.length} 条，用于保留中文名 / 中文简介 / 配色`);
    return { byAniId, byMalId, raw };
  } catch {
    log('没有可读的旧 anime.json（首次运行）');
    return empty;
  }
}

const findOld = (curated, rec) => curated.byAniId.get(rec.anilistId)
  || (rec.malId ? curated.byMalId.get(rec.malId) : null);

function mergeCurated(rec, curated) {
  const old = findOld(curated, rec);
  if (!old) { return rec; }
  return {
    ...rec,
    slug: old.id || rec.slug,
    bgmId: rec.bgmId || old.bgmId || null,
    name_cn: old.name_cn || null,
    summary_cn: old.summary_cn || null,
    summary_cn_short: old.summary_cn_short || null,
    emoji: old.emoji || rec.emoji,
    palette: old.palette || rec.palette,
    categories: old.categories?.length ? old.categories : rec.categories,
    has_cn: !!(old.name_cn || old.summary_cn)
  };
}

/* ------------------------------------------------------------------ 主流程 */

function asJson(value) { return JSON.stringify(value) + '\n'; }   // 压缩输出，减小仓库体积
const asJsArray = (globalName, value) =>
  '/* 由 work/fetch-anime-data.mjs 生成，供 file:// 打开时兜底，请勿手改。 */\n'
  + `window.${globalName} = ${JSON.stringify(value)};\n`;

/**
 * 按字节切分主库：单个 part 目标 < 3MB（不会把一条记录切成两半）。
 * 前端并行 fetch 多个小文件再合并，避免出现 5MB+ 的单文件。
 */
function splitParts(entries, limitBytes) {
  const parts = [];
  let cur = [];
  let curBytes = 2;                       // "[]"
  for (const rec of entries) {
    // 按 UTF-8 字节数算（中文一个字 3 字节），否则很容易超出 3MB 上限
    const size = Buffer.byteLength(JSON.stringify(rec), 'utf8') + (cur.length ? 1 : 0);
    if (cur.length && curBytes + size > limitBytes) {
      parts.push(cur); cur = []; curBytes = 2;
    }
    cur.push(rec);
    curBytes += size;
  }
  if (cur.length) { parts.push(cur); }
  return parts;
}

async function cleanStaleParts(keepNames) {
  let files = [];
  try { files = await fs.readdir(DATA_DIR); } catch { return; }
  for (const name of files) {
    if (!/^anime-\d+\.(json|js)$/.test(name)) { continue; }
    if (keepNames.has(name)) { continue; }
    await fs.unlink(path.join(DATA_DIR, name)).then(
      () => log(`  · 删除上次遗留的分片 data/${name}`),
      () => { /* ignore */ }
    );
  }
}

async function enrichWithBangumi(entries) {
  if (SKIP_BANGUMI) {
    log('\n== 跳过 Bangumi（--skip-bangumi）==');
    return;
  }
  log('\n== Bangumi 补中文名 / 中文简介（间隔 ≥1.1s，命中的旧条目直接沿用、不重复请求）==');
  let done = 0;
  let stopped = false;
  for (const rec of entries) {
    done += 1;
    if (bgmBroken) { stopped = true; break; }   // 熔断后不再空等，直接用已有中文资料
    // 已有中文名 + 中文简介（上次跑出来的）就不再查，省时间
    if (rec.name_cn && rec.summary_cn) {
      rec.has_cn = true;
      stats.bangumiHits += 1;
    } else {
      const keyword = rec.name || rec.name_romaji || rec.name_en;
      const candidates = await bangumiSearch(keyword);
      const hit = pickBangumi(candidates, {
        title: { native: rec.name, romaji: rec.name_romaji, english: rec.name_en },
        seasonYear: rec.year
      });
      if (hit) {
        rec.bgmId = rec.bgmId || hit.id;
        if (!rec.name_cn && hit.name_cn) { rec.name_cn = String(hit.name_cn).trim(); }
        if (!rec.summary_cn) {
          let summary = stripHtml(hit.summary);
          // 旧版搜索接口不带简介，需要再查一次条目详情（v0 优先，同一来源）
          if (!summary && hit.id) {
            const detail = await bangumiSubject(hit.id);
            if (detail) {
              summary = stripHtml(detail.summary);
              if (!rec.name_cn && detail.name_cn) { rec.name_cn = String(detail.name_cn).trim(); }
            }
          }
          rec.summary_cn = truncate(summary, 700);
        }
        rec.has_cn = !!(rec.name_cn || rec.summary_cn);
        if (rec.has_cn) { stats.bangumiHits += 1; }
      } else if (!rec.malId) {
        // 可选回退：Bangumi 没命中、又缺 MAL id 时才问一次 Jikan（连续失败会熔断）
        const jikan = await jikanFallback(rec);
        if (jikan && jikan.mal_id) { rec.malId = jikan.mal_id; }
      }
    }
    if (done % 50 === 0 || done === entries.length) {
      log(`  · Bangumi 进度 ${done}/${entries.length}，有中文 ${stats.bangumiHits}`
        + `，网络请求 ${stats.net}，缓存命中 ${stats.cacheHits}`
        + `，旧版搜索 ${stats.bgmLegacySearch}，条目详情 ${stats.bgmDetail}`);
    }
  }
  log(`  ✓ 有中文资料 ${stats.bangumiHits}/${entries.length}`
    + (stopped ? `（Bangumi 已熔断，剩余 ${entries.length - done + 1} 条本轮没有补中文，可稍后重跑脚本续补）` : ''));
}

/** ① 年份轴拉全量元数据（AniList） */
async function fetchAllYears() {
  log(`\n== AniList 年份轴分页（${YEARS[0]}–${YEARS[YEARS.length - 1]}，每年最多 ${PER_YEAR} 部，`
    + 'POPULARITY_DESC，TV/MOVIE/ONA）==');
  const all = [];
  for (const year of YEARS) {
    const list = await fetchYear(year, PER_YEAR);
    all.push(...list);
    log(`  · ${year} 年：拉取 ${list.length} 部（累计 ${all.length}）`);
  }
  return all;
}

/** ② 过滤 / 去重 / 转记录 */
function buildRecords(mediaList) {
  log('\n== 过滤 / 去重 ==');
  const seenAni = new Set();
  const seenTitle = new Set();
  const records = [];
  const skipped = { duplicate: 0, format: 0, year: 0, promo: 0, adult: 0 };
  for (const m of mediaList) {
    if (!m || !m.id) { continue; }
    if (seenAni.has(m.id)) { skipped.duplicate += 1; continue; }
    if (m.isAdult) { skipped.adult += 1; continue; }
    if (!FORMATS.includes(m.format)) { skipped.format += 1; continue; }
    const year = yearOf(m);
    if (!year || year < MIN_YEAR || year > MAX_YEAR) { skipped.year += 1; continue; }
    if (isShortPromo(m)) { skipped.promo += 1; continue; }
    const key = normalize(m.title?.romaji || m.title?.native || '');
    if (key && seenTitle.has(key)) { skipped.duplicate += 1; continue; }
    seenAni.add(m.id);
    if (key) { seenTitle.add(key); }
    records.push(toRecord(m));
    if (LIMIT && records.length >= LIMIT) { break; }
  }
  log(`  ✓ 过滤后 ${records.length} 条（跳过：重复 ${skipped.duplicate} / 非 TV·剧场·ONA ${skipped.format}`
    + ` / 年份不符 ${skipped.year} / 疑似短篇广告 ${skipped.promo}）`);
  return records;
}

async function buildTrending(limit) {
  log('\n== 拉取「本季 / 热门」（AniList TRENDING_DESC, RELEASING）==');
  const data = await anilist(TRENDING_QUERY, { perPage: limit }, `anilist-trending-${limit}`);
  const media = data?.Page?.media || [];
  if (!media.length) {
    log('  × 热门列表拉取失败：保留旧 trending.json');
    return null;
  }
  log(`  ✓ 拿到 ${media.length} 条`);
  return media;
}

function trendingSeasonLabel(media) {
  const m = media.find((x) => x.seasonYear && x.season);
  if (!m) { return null; }
  const zh = { WINTER: '冬季', SPRING: '春季', SUMMER: '夏季', FALL: '秋季' }[m.season] || m.season;
  return `${m.seasonYear} ${zh}`;
}

/** 写入主库：单 part 直接写数组（老格式），多个 part 写清单 + 分片。 */
async function writeLibrary(entries) {
  const parts = splitParts(entries, PART_LIMIT_BYTES);
  const keep = new Set();
  const manifestParts = [];
  for (let i = 0; i < parts.length; i += 1) {
    const chunk = parts[i];
    const json = asJson(chunk);
    const js = asJsArray(`__ANIME_PART_${i + 1}__`, chunk);
    const jsonName = `anime-${i + 1}.json`;
    const jsName = `anime-${i + 1}.js`;
    keep.add(jsonName); keep.add(jsName);
    await fs.writeFile(path.join(DATA_DIR, jsonName), json, 'utf8');
    await fs.writeFile(path.join(DATA_DIR, jsName), js, 'utf8');
    manifestParts.push({
      file: `data/${jsonName}`,
      script: `data/${jsName}`,
      count: chunk.length,
      bytes: Buffer.byteLength(json, 'utf8')
    });
  }
  await cleanStaleParts(keep);

  if (parts.length === 1) {
    // 单文件：保持老格式（anime.json 就是数组），前端与旧逻辑完全兼容
    const json = asJson(entries);
    await fs.writeFile(path.join(DATA_DIR, 'anime.json'), json, 'utf8');
    await fs.writeFile(path.join(DATA_DIR, 'anime.js'), asJsArray('__ANIME_DATA__', entries), 'utf8');
    return { parts: 1, bytes: Buffer.byteLength(json, 'utf8'), manifestParts };
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    source: 'anilist:POPULARITY_DESC（年份轴分页）',
    parts: manifestParts
  };
  await fs.writeFile(path.join(DATA_DIR, 'anime.json'), asJson(manifest), 'utf8');
  // file:// 兜底：anime.js 只声明分片列表，真正的数据在 anime-1.js / anime-2.js …（每个也 < 3MB）
  const loader = '/* 由 work/fetch-anime-data.mjs 生成，供 file:// 打开时兜底，请勿手改。 */\n'
    + `window.__ANIME_PARTS__ = ${JSON.stringify(manifestParts.map((p) => p.script))};\n`
    + `window.__ANIME_MANIFEST__ = ${JSON.stringify(manifest)};\n`;
  await fs.writeFile(path.join(DATA_DIR, 'anime.js'), loader, 'utf8');
  return { parts: parts.length, bytes: manifestParts.reduce((n, p) => n + p.bytes, 0), manifestParts };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  log('# 番剧数据抓取报告\n');
  log(`- 运行时间：${new Date().toISOString()}`);
  log(`- 年份区间：${YEARS[0]}–${YEARS[YEARS.length - 1]}；每年上限：${PER_YEAR} 部${LIMIT ? `；总上限：${LIMIT}` : ''}`);
  const bgmPolicy = `连续失败 ${BGM_FAILS_PER_COOLDOWN} 次冷却 ${BGM_COOLDOWN_MS / 1000}s，`
    + `冷却 ${BGM_COOLDOWNS_BEFORE_BREAK} 次后熔断`;
  log(`- 缓存：${USE_CACHE ? '启用' : '禁用'}；Bangumi：${SKIP_BANGUMI ? '跳过' : `启用（${bgmPolicy}）`}；`
    + `Jikan 回退：${SKIP_JIKAN ? '禁用' : `启用（连续失败 ${JIKAN_BREAK_AFTER} 次熔断）`}`);
  log(`- 请求间隔下限：${MIN_INTERVAL_MS}ms，超时 ${FETCH_TIMEOUT_MS}ms，429/403/5xx 最多重试 ${MAX_ATTEMPTS} 次，`
    + `失败缓存 ${FAIL_CACHE_TTL_MS / 60000} 分钟\n`);

  const curated = await loadExisting();
  const oldCount = curated.raw.length;

  let entries = [];
  if (ONLY !== 'trending') {
    const all = await fetchAllYears();
    if (!all.length) {
      throw new Error('AniList 年份轴接口没有返回任何数据，可能是网络问题；保留旧 JSON。');
    }
    entries = buildRecords(all).map((r) => mergeCurated(r, curated));
  } else {
    log('== --only=trending：复用现有 anime.json，只更新热门列表 ==');
    entries = curated.raw || [];
    if (!entries.length) { throw new Error('没有可复用的 anime.json，无法只更新热门'); }
  }

  // 热门列表：并入主库，保证首页点进去有站内详情页
  let trendingMedia = [];
  if (ONLY !== 'anime') { trendingMedia = (await buildTrending(TRENDING_LIMIT)) || []; }

  if (trendingMedia.length && entries !== curated.raw) {
    const known = new Set(entries.map((e) => e.anilistId));
    const merged = { added: 0, dropped: 0 };
    for (const m of trendingMedia) {
      if (known.has(m.id)) { continue; }
      const year = yearOf(m);
      if (!FORMATS.includes(m.format) || m.isAdult || !year || year < MIN_YEAR || year > MAX_YEAR || isShortPromo(m)) {
        merged.dropped += 1; continue;
      }
      const rec = mergeCurated(toRecord(m), curated);
      rec.trending = true;
      entries.push(rec);
      known.add(m.id);
      merged.added += 1;
    }
    log(`\n== 热门条目并入主库：新增 ${merged.added}，因不符合筛选跳过 ${merged.dropped} ==`);
  }

  // 旧库里、这次年份轴没覆盖到的条目：保留，保证资料库只增不减
  if (ONLY !== 'trending' && curated.raw.length) {
    const known = new Set(entries.map((e) => e.anilistId));
    let kept = 0;
    for (const old of curated.raw) {
      if (!old || !old.anilistId || known.has(old.anilistId)) { continue; }
      if (!FORMATS.includes(old.format)) { continue; }
      if (!old.year || old.year < MIN_YEAR || old.year > MAX_YEAR) { continue; }
      const rec = { ...old, keptFromPrevious: true };
      delete rec.trending;
      entries.push(rec);
      known.add(old.anilistId);
      kept += 1;
    }
    if (kept) { log(`\n== 沿用旧库里本次未重新拉到的条目：${kept} 条（资料库只增不减）==`); }
  }

  if (ONLY !== 'trending') { await enrichWithBangumi(entries); }

  /* --- 稳定 id --- */
  const slugSeen = new Map();
  for (const rec of entries) {
    const base = rec.slug || 'ani';
    const n = slugSeen.get(base) || 0;
    slugSeen.set(base, n + 1);
    rec.id = n === 0 ? base : `${base}-${rec.anilistId}`;
  }

  /* --- 统计 --- */
  const withCn = entries.filter((e) => e.name_cn).length;
  const withCnSummary = entries.filter((e) => e.summary_cn).length;
  const withTrailer = entries.filter((e) => e.trailer).length;
  const withRelations = entries.filter((e) => (e.relations || []).length).length;
  const withBgm = entries.filter((e) => e.bgmId).length;
  const byFormat = entries.reduce((acc, e) => { acc[e.format] = (acc[e.format] || 0) + 1; return acc; }, {});
  const perYear = {};
  entries.forEach((e) => { if (e.year) { perYear[e.year] = (perYear[e.year] || 0) + 1; } });
  const years = Object.keys(perYear).map(Number).sort((a, b) => a - b);
  const missingYears = YEARS.filter((y) => !perYear[y]);

  log('\n== 汇总 ==');
  log(`- 主库条数：${entries.length}（旧库 ${oldCount} 条）`);
  log(`- 有中文名：${withCn}；有中文简介：${withCnSummary}；命中 Bangumi：${withBgm}`);
  log(`- 有官方 YouTube PV：${withTrailer}`);
  log(`- 有 relations：${withRelations}`);
  log(`- 格式分布：${Object.entries(byFormat).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  log(`- 年份范围：${years[0] || '—'} – ${years[years.length - 1] || '—'}；覆盖 ${years.length} 个年份`
    + (missingYears.length ? `；缺失：${missingYears.join(', ')}` : '；无缺失年份'));
  log(`- 每年条数：${years.map((y) => `${y}:${perYear[y]}`).join(' ')}`);
  const bgmChannel = bgmV0Down
    ? `v0 搜索接口连续失败，本次改用旧版搜索接口（旧版命中 ${stats.bgmLegacySearch} 次，条目详情 ${stats.bgmDetail} 次）`
    : 'v0 搜索接口正常';
  log(`- 本次主源：AniList（年份轴 POPULARITY_DESC 分页）；中文名/简介：Bangumi（${bgmChannel}）；`
    + `Jikan：${jikanBroken ? '熔断' : (SKIP_JIKAN ? '禁用' : `使用 ${stats.jikanUsed} 次`)}`);
  log(`- Bangumi 状态：${SKIP_BANGUMI ? '跳过' : (bgmBroken ? '中途熔断（剩余条目本轮未补中文）' : '可用')}；`
    + `有中文名的条数 ${withCn}，有中文简介的条数 ${withCnSummary}`);
  log(`- 请求统计：网络 ${stats.net} 次 / 缓存命中 ${stats.cacheHits} 次 / 失败 ${stats.failures} 次`);

  /* --- 写入（含健康检查） --- */
  if (ONLY !== 'trending') {
    const threshold = Math.max(300, Math.floor(oldCount * 0.8));
    if (entries.length < threshold) {
      log(`\n⚠ 条数 ${entries.length} < ${threshold}（旧库 ${oldCount} 条的 80%），判定为抓取不完整：保留旧 JSON，不写入。`);
      await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
      process.exitCode = 2;
      return;
    }
    const written = await writeLibrary(entries);
    log('\n== 写入 ==');
    log(`- 拆文件：${written.parts > 1 ? `是，${written.parts} 个分片（前端合并）` : '否，单文件'}`);
    written.manifestParts.forEach((p, i) => {
      log(`  · data/anime-${i + 1}.json：${p.count} 条，${(p.bytes / 1024 / 1024).toFixed(2)} MB`);
    });
    log(`- data/anime.json：${written.parts > 1 ? '分片清单（manifest）' : `${entries.length} 条`}`);
    log(`- 主库总字节：${(written.bytes / 1024 / 1024).toFixed(2)} MB`);
  }

  if (trendingMedia.length) {
    const byAniId = new Map(entries.map((e) => [e.anilistId, e]));
    const items = [];
    trendingMedia.forEach((m) => {
      const local = byAniId.get(m.id);
      if (!local) { return; }   // 没能进主库的不展示，避免整卡跳外站
      items.push({
        rank: items.length + 1,
        id: local.id,
        anilistId: m.id,
        name: local.name_cn || local.name || local.name_romaji,
        name_original: local.name,
        name_cn: local.name_cn,
        cover: local.cover,
        coverSmall: local.coverSmall,
        score: local.score,
        episodes: local.episodes,
        year: local.year,
        season: local.season,
        format: local.format,
        genres: (local.genres || []).slice(0, 3),
        categories: local.categories
      });
    });
    const trending = {
      generatedAt: new Date().toISOString(),
      source: 'anilist:TRENDING_DESC (status: RELEASING)',
      season: trendingSeasonLabel(trendingMedia),
      items
    };
    if (items.length < 10) {
      log(`\n⚠ 热门列表只匹配到 ${items.length} 条（<10），保留旧 trending.json 不覆盖`);
      await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
      return;
    }
    await fs.writeFile(path.join(DATA_DIR, 'trending.json'), asJson(trending), 'utf8');
    await fs.writeFile(path.join(DATA_DIR, 'trending.js'), asJsArray('__TRENDING_DATA__', trending), 'utf8');
    log(`- data/trending.json（${items.length} 条，全部可在站内打开详情）`);
  }

  log('\n说明：封面与 PV 只保存远程 URL / 官方 YouTube 视频 id，脚本不下载任何图片或视频；'
    + '中文名与中文简介来自 Bangumi（api.bgm.tv），匹配不上则留空，前端显示原名或英文简介，不做机翻。');
  await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log('\n报告已写入 work/fetch-report.md');
}

main().catch(async (err) => {
  console.error('抓取失败：', err.message);
  lines.push(`\n## 运行失败\n\n${err.message}\n\n（旧 JSON 未被覆盖）`);
  try { await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
  process.exitCode = 1;
});
