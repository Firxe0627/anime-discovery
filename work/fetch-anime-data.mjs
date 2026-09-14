#!/usr/bin/env node
/**
 * work/fetch-anime-data.mjs
 * ---------------------------------------------------------------------------
 * 为 AnimeDiscovery 生成静态数据（一次性脚本，可反复重跑）。
 *
 * 数据来源
 *   - 主资料来源：AniList GraphQL（批量分页，含封面 URL、简介、分数、集数、
 *     年份、季节、制作公司、relations、官方 YouTube trailer id）
 *   - 中文名 / 中文简介：Bangumi（api.bgm.tv，带文档要求的 User-Agent，间隔 ≥1 秒）
 *   - 可选回退：Jikan（api.jikan.moe）。仅在需要补齐 MAL id 时使用，失败直接跳过。
 *
 * 硬性约束
 *   - 只保存文本与图片 URL；**绝不下载图片、视频**（trailer 只存 YouTube 视频 id）。
 *   - 请求间隔 ≥ 1 秒；429/5xx 按 Retry-After 或指数退避重试。
 *   - 中文名/中文简介一律来自 Bangumi，匹配不上就留空（前端显示原名/英文简介），不做机翻。
 *   - 抓取失败时保留旧 JSON，不写坏数据。
 *
 * 用法
 *   node work/fetch-anime-data.mjs                    # 目标 520 部，走缓存
 *   node work/fetch-anime-data.mjs --limit=450        # 指定目标条数
 *   node work/fetch-anime-data.mjs --no-cache         # 忽略缓存重新请求
 *   node work/fetch-anime-data.mjs --skip-bangumi     # 只跑 AniList
 *   node work/fetch-anime-data.mjs --only=trending    # 只更新热门列表
 *
 * 产物
 *   outputs/anime-discovery/data/anime.json + anime.js
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
const FETCH_TIMEOUT_MS = 25000;
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const FAIL_CACHE_TTL_MS = 10 * 60 * 1000;

/* 主库筛选规则：TV / Movie / ONA，2005 年以后 */
const FORMATS = ['TV', 'MOVIE', 'ONA'];
const MIN_YEAR = 2005;

const argv = process.argv.slice(2);
const argOf = (name) => {
  const hit = argv.find((a) => a.startsWith(name + '='));
  return hit ? hit.split('=')[1] : null;
};
const TARGET = Math.max(50, Number(argOf('--limit')) || 520);
const ONLY = argOf('--only') || 'all';
const USE_CACHE = !argv.includes('--no-cache');
const SKIP_BANGUMI = argv.includes('--skip-bangumi');
const ANIME_FILE = path.join(DATA_DIR, 'anime.json');
const MIN_HEALTHY_ENTRIES = 300;

const lines = [];
const log = (msg) => { console.log(msg); lines.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** 带节流、超时与 429/5xx 退避重试的请求。只返回 JSON。 */
async function request(key, url, init) {
  const cached = await readCache(key);
  if (cached && cached.__failed) { return null; }
  if (cached !== null) { return cached; }

  let attempt = 0;
  let backoff = 2000;
  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    await throttle();
    let res;
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
      await writeCache(key, { __failed: true, at: Date.now(), url, status: res.status });
      return null;
    }

    const json = await res.json().catch(() => null);
    if (json === null) {
      await writeCache(key, { __failed: true, at: Date.now(), url, status: res.status });
      return null;
    }
    await writeCache(key, json);
    return json;
  }
  log(`  × 重试 ${MAX_ATTEMPTS} 次仍失败：${url}`);
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

const BULK_QUERY = `query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage lastPage hasNextPage }
    media(sort: POPULARITY_DESC, type: ANIME, format_in: [TV, MOVIE, ONA],
          startDate_greater: 20050101, isAdult: false) { ${MEDIA_FIELDS} }
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

async function fetchBulkMedia(perPage) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  do {
    const data = await anilist(BULK_QUERY, { page, perPage }, `anilist-bulk-${page}-${perPage}`);
    if (!data || !data.Page) { log(`  ! 第 ${page} 页失败，停止翻页`); break; }
    const media = data.Page.media || [];
    all.push(...media);
    lastPage = data.Page.pageInfo?.lastPage || page;
    log(`  · 第 ${page}/${lastPage} 页：累计 ${all.length} 条`);
    page += 1;
    // 多抓一些余量，后面按年份/格式过滤或去重会掉一部分
  } while (all.length < TARGET * 1.15 && page <= lastPage && page <= 30);
  return all;
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

/** 归一化标题用于匹配：只保留拉丁字母、数字与日文/中文字符。 */
const normalize = (s) => String(s || '')
  .toLowerCase()
  .replace(/[^0-9a-z\u3040-\u30ff\u4e00-\u9fff]/g, '');

async function bangumiSearch(keyword) {
  if (!keyword) { return null; }
  const json = await request(`bgm-search-${keyword}`, `${BANGUMI}/v0/search/subjects?limit=5`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      Accept: 'application/json'
    },
    body: JSON.stringify({ keyword, filter: { type: [2] } })
  });
  if (!json || !Array.isArray(json.data)) { return null; }
  return json.data;
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
  // 前作/续作优先展示
  const priority = { PREQUEL: 0, SEQUEL: 0, PARENT: 1, SIDE_STORY: 2, ALTERNATIVE: 3, SPIN_OFF: 4, ADAPTATION: 5 };
  return out.sort((a, b) => (priority[a.relation] ?? 9) - (priority[b.relation] ?? 9));
}

function trailerOf(media) {
  const t = media.trailer;
  if (!t || t.site !== 'youtube' || !t.id) { return null; }
  const id = String(t.id).trim();          // AniList 偶尔带空白字符
  return /^[\w-]{6,20}$/.test(id) ? id : null;
}

function toRecord(media) {
  const genres = media.genres || [];
  const slug = slugify(media.title?.romaji || media.title?.english || '') || 'ani';
  const year = media.seasonYear || null;
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

/* --------------------------------------------------- 与旧数据合并（保中文） */

async function loadCurated() {
  try {
    const raw = JSON.parse(await fs.readFile(ANIME_FILE, 'utf8'));
    const byAniId = new Map();
    const byMalId = new Map();
    for (const item of raw) {
      if (item.anilistId) { byAniId.set(item.anilistId, item); }
      if (item.malId) { byMalId.set(item.malId, item); }
    }
    log(`读取旧数据 ${raw.length} 条，用于保留中文名/编辑速览/配色`);
    return { byAniId, byMalId, raw };
  } catch {
    log('没有可读的旧 anime.json（首次运行）');
    return { byAniId: new Map(), byMalId: new Map(), raw: [] };
  }
}

function mergeCurated(rec, curated) {
  const old = curated.byAniId.get(rec.anilistId)
    || (rec.malId ? curated.byMalId.get(rec.malId) : null);
  if (!old) { return rec; }
  return {
    ...rec,
    slug: old.id || rec.slug,
    name_cn: old.titleZh || old.name_cn || null,
    summary_cn_short: old.summaryZh || old.summary_cn_short || null,
    emoji: old.emoji || rec.emoji,
    palette: old.palette || rec.palette,
    categories: old.categories?.length ? old.categories : rec.categories
  };
}

/* ------------------------------------------------------------------ 主流程 */

function asJson(value) { return JSON.stringify(value) + '\n'; }   // 压缩输出，减小仓库体积
function asJs(globalName, value) {
  return '/* 由 work/fetch-anime-data.mjs 生成，供 file:// 打开时兜底，请勿手改。 */\n'
    + `window.${globalName} = ${JSON.stringify(value)};\n`;
}

async function enrichWithBangumi(entries) {
  if (SKIP_BANGUMI) {
    log('\n== 跳过 Bangumi（--skip-bangumi）==');
    return;
  }
  log('\n== Bangumi 补中文名 / 中文简介（间隔 ≥1s）==');
  let matched = 0;
  let done = 0;
  for (const rec of entries) {
    done += 1;
    const keyword = rec.name || rec.name_romaji || rec.name_en;
    const candidates = await bangumiSearch(keyword);
    const hit = pickBangumi(candidates, {
      title: { native: rec.name, romaji: rec.name_romaji, english: rec.name_en },
      seasonYear: rec.year
    });
    if (hit) {
      rec.bgmId = hit.id;
      rec.name_cn = rec.name_cn || (hit.name_cn ? hit.name_cn.trim() : null);
      rec.summary_cn = truncate(stripHtml(hit.summary), 700);
      rec.has_cn = !!(rec.name_cn || rec.summary_cn);
      matched += 1;
    }
    if (done % 25 === 0 || done === entries.length) {
      log(`  · Bangumi 进度 ${done}/${entries.length}，命中中文 ${matched}`);
    }
  }
  log(`  ✓ Bangumi 命中 ${matched}/${entries.length}`);
}

async function buildLibrary() {
  log('== 从 AniList 批量拉取（POPULARITY_DESC，TV/Movie/ONA，≥2005）==');
  const media = await fetchBulkMedia(50);
  if (!media.length) {
    throw new Error('AniList 批量接口没有返回任何数据，可能是网络问题；保留旧 JSON。');
  }

  log('\n== 过滤 / 去重 ==');
  const seenAni = new Set();
  const seenMal = new Set();
  const seenTitle = new Set();
  const records = [];
  for (const m of media) {
    if (!m || !m.id || seenAni.has(m.id)) { continue; }
    if (!FORMATS.includes(m.format)) { continue; }
    const year = m.seasonYear || m.startDate?.year || 0;
    if (year && year < MIN_YEAR) { continue; }
    const key = normalize(m.title?.romaji || m.title?.native || '');
    if (key && seenTitle.has(key)) { continue; }
    seenAni.add(m.id);
    if (m.idMal) { seenMal.add(m.idMal); }
    if (key) { seenTitle.add(key); }
    records.push(toRecord(m));
    if (records.length >= TARGET) { break; }
  }
  log(`  ✓ 过滤后 ${records.length} 条（目标 ${TARGET}）`);
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

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  log('# 番剧数据抓取报告\n');
  log(`- 运行时间：${new Date().toISOString()}`);
  log(`- 目标条数：${TARGET}；缓存：${USE_CACHE ? '启用' : '禁用'}；Bangumi：${SKIP_BANGUMI ? '跳过' : '启用'}`);
  log(`- 请求间隔下限：${MIN_INTERVAL_MS}ms，超时 ${FETCH_TIMEOUT_MS}ms，429/403/5xx 最多重试 ${MAX_ATTEMPTS} 次\n`);

  const curated = await loadCurated();

  let entries = [];
  if (ONLY !== 'trending') {
    entries = await buildLibrary();
    entries = entries.map((r) => mergeCurated(r, curated));
  } else {
    log('== --only=trending：复用现有 anime.json，只更新热门列表 ==');
    entries = curated.raw || [];
    if (!entries.length) { throw new Error('没有可复用的 anime.json，无法只更新热门'); }
  }

  // 热门列表：并入主库，保证首页点进去有站内详情页
  let trendingMedia = [];
  if (ONLY !== 'anime') { trendingMedia = (await buildTrending(24)) || []; }

  if (trendingMedia.length && entries !== curated.raw) {
    const known = new Set(entries.map((e) => e.anilistId));
    const mergedCount = { added: 0, dropped: 0 };
    for (const m of trendingMedia) {
      if (known.has(m.id)) { continue; }
      const year = m.seasonYear || 0;
      if (!FORMATS.includes(m.format) || (year && year < MIN_YEAR)) { mergedCount.dropped += 1; continue; }
      const rec = mergeCurated(toRecord(m), curated);
      rec.trending = true;
      entries.push(rec);
      known.add(m.id);
      mergedCount.added += 1;
    }
    log(`\n== 热门条目并入主库：新增 ${mergedCount.added}，因不符合筛选跳过 ${mergedCount.dropped} ==`);
  }

  if (ONLY !== 'trending') { await enrichWithBangumi(entries); }

  /* --- 统计 --- */
  const slugSeen = new Map();
  for (const rec of entries) {
    const base = rec.slug || 'ani';
    const n = slugSeen.get(base) || 0;
    slugSeen.set(base, n + 1);
    rec.id = n === 0 ? base : `${base}-${rec.anilistId}`;
  }
  const withCn = entries.filter((e) => e.name_cn).length;
  const withCnSummary = entries.filter((e) => e.summary_cn).length;
  const withTrailer = entries.filter((e) => e.trailer).length;
  const withRelations = entries.filter((e) => (e.relations || []).length).length;
  const withBgm = entries.filter((e) => e.bgmId).length;
  const byFormat = entries.reduce((acc, e) => { acc[e.format] = (acc[e.format] || 0) + 1; return acc; }, {});
  const years = entries.map((e) => e.year).filter(Boolean).sort();

  log('\n== 汇总 ==');
  log(`- 主库条数：${entries.length}`);
  log(`- 有中文名：${withCn}；有中文简介：${withCnSummary}；命中 Bangumi：${withBgm}`);
  log(`- 有官方 YouTube PV：${withTrailer}`);
  log(`- 有 relations：${withRelations}`);
  log(`- 格式分布：${Object.entries(byFormat).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  log(`- 年份范围：${years[0] || '—'} – ${years[years.length - 1] || '—'}`)

  if (ONLY !== 'trending') {
    if (entries.length < MIN_HEALTHY_ENTRIES) {
      log(`\n⚠ 条数 ${entries.length} < ${MIN_HEALTHY_ENTRIES}，判定为抓取不完整：保留旧 JSON，不写入。`);
      await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
      process.exitCode = 2;
      return;
    }
    await fs.writeFile(path.join(DATA_DIR, 'anime.json'), asJson(entries), 'utf8');
    await fs.writeFile(path.join(DATA_DIR, 'anime.js'), asJs('__ANIME_DATA__', entries), 'utf8');
    log(`\n已写入 data/anime.json（${entries.length} 条）与 data/anime.js`);
  }

  if (trendingMedia.length) {
    const byAniId = new Map(entries.map((e) => [e.anilistId, e]));
    const items = [];
    trendingMedia.forEach((m, i) => {
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
      log(`⚠ 热门列表只匹配到 ${items.length} 条（<10），保留旧 trending.json 不覆盖`);
      await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
      return;
    }
    await fs.writeFile(path.join(DATA_DIR, 'trending.json'), asJson(trending), 'utf8');
    await fs.writeFile(path.join(DATA_DIR, 'trending.js'), asJs('__TRENDING_DATA__', trending), 'utf8');
    log(`已写入 data/trending.json（${items.length} 条，全部可在站内打开详情）`);
  }

  log('\n说明：封面与 PV 只保存远程 URL / 官方 YouTube 视频 id，脚本不下载任何图片或视频；'
    + '中文名与中文简介来自 Bangumi（api.bgm.tv），匹配不上则留空，前端显示原名或英文简介，不做机翻。');
  await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log('\n报告已写入 work/fetch-report.md');
}

function trendingSeasonLabel(media) {
  const m = media.find((x) => x.seasonYear && x.season);
  if (!m) { return null; }
  const zh = { WINTER: '冬季', SPRING: '春季', SUMMER: '夏季', FALL: '秋季' }[m.season] || m.season;
  return `${m.seasonYear} ${zh}`;
}

main().catch(async (err) => {
  console.error('抓取失败：', err.message);
  lines.push(`\n## 运行失败\n\n${err.message}\n\n（旧 JSON 未被覆盖）`);
  try { await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8'); } catch { /* ignore */ }
  process.exitCode = 1;
});
