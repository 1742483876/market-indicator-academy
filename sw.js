/* 小七投研 Service Worker（2026-11-25，PWA：装到手机桌面 + 断网能看上次的数据）
 * 作用范围：站点根（线上 /market-indicator-academy/，本地 http.server 根目录），含个股站 stock/。
 * 缓存策略：
 *   页面（导航）           network-first，4 秒超时回退缓存（离线也能打开首页 / 个股页外壳）
 *   静态资源 js/css/图标    cache-first（按完整 URL 含 ?v= 存；同一路径换了版本号就存新的、删旧的；超过 30 分钟的副本后台再核对一次）
 *   数据 json（今日结论等）   network-first，4 秒超时回退缓存，回退时通知页面显示「离线 · 数据时间 HH:MM」
 *   报告正文 / 个股数据等    同上，按需缓存，最多 200 条、50MB，按最近使用（LRU）清理
 *   analog/*.bin 路径库    用到才缓存，cache-first（URL 带版本号），单独上限 20MB，LRU 清理
 *   跨域请求（腾讯/新浪/CBOE 实时行情等）与站点范围外的请求：不经过缓存，直接走网络
 * 加密的财富规划页在另一个仓库（/xiaobai-wealth/），不在本 SW 范围内，不会被缓存或拦截；#/todo 的持仓段只缓存密文 todo.json，解密在页面里做。
 * 更新：新 sw 安装后进入 waiting，页面弹「有新版本，点此刷新」→ postMessage SKIP_WAITING → skipWaiting → 页面 controllerchange 时刷新。
 */
const VERSION = "u27";
const CN = { pages: "xq-pages-1", static: "xq-static-1", data: "xq-data-1", more: "xq-more-1", analog: "xq-analog-1" };
const LIMIT = { more: { n: 200, bytes: 50 << 20 }, analog: { n: 400, bytes: 20 << 20 } };
const TIMEOUT = 4000;
const STALE_STATIC = 30 * 60 * 1000;
const SCOPE = new URL(self.registration.scope);
const BASE = SCOPE.pathname; // 以 / 结尾

// 按需缓存的目录（单条多、总量大）
const MORE_RE = /^(reports\/\d|r\/|labs\/|lhb\/|gurus\/k\/|s_hist\/|sectors\/|usshape\/|stock\/ff\/)/;
const STATIC_RE = /\.(js|css|png|jpg|jpeg|svg|ico|webp|woff2?|webmanifest)$/i;

self.addEventListener("install", (e) => {
  e.waitUntil(precache().catch(() => {}));
  // 第一次安装（没有旧 SW）直接激活；有旧版本时等页面点「刷新」再接管
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keep = new Set(Object.values(CN));
    for (const k of await caches.keys()) if (k.startsWith("xq-") && !keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  else if (d.type === "VERSION" && e.source) e.source.postMessage({ type: "sw-version", v: VERSION });
  else if (d.type === "CLEAR") e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("xq-")) await caches.delete(k);
    if (e.source) e.source.postMessage({ type: "sw-cleared" });
  })());
});

// 首次安装：存首页外壳 + 它引用的 css/js + 图表库 + 图标，断网时至少能打开首页
async function precache() {
  const pages = await caches.open(CN.pages), st = await caches.open(CN.static);
  const r = await fetch(BASE, { cache: "no-cache" });
  if (!r.ok) return;
  const html = await r.clone().text();
  await stampPut(pages, BASE, r);
  const urls = new Set(["echarts.min.js?v=5.5.1", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon-180.png"]);
  html.replace(/(?:src|href)="([^"#:]+\.(?:js|css|png|webmanifest)(?:\?[^"]*)?)"/g, (_, u) => { urls.add(u); return _; });
  await Promise.all([...urls].map(async (u) => {
    const full = new URL(u, SCOPE).href;
    try { const x = await fetch(full); if (x.ok) await stampPut(st, full, x); } catch (err) { /* 单个失败不影响安装 */ }
  }));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(BASE)) return; // 跨域 / 范围外：直接走网络
  if (req.headers.get("range")) return;
  const rel = url.pathname.slice(BASE.length);
  if (rel === "sw.js") return;
  if (req.mode === "navigate") { e.respondWith(navFirst(e, url)); return; }
  const noq = url.origin + url.pathname;
  if (/^analog\/.+\.bin$/.test(rel)) { e.respondWith(cacheFirst(e, req, CN.analog, url.href, { lru: LIMIT.analog, sameVer: true })); return; }
  if (/\.json$/i.test(rel)) { e.respondWith(netFirst(e, req, MORE_RE.test(rel) ? CN.more : CN.data, noq, MORE_RE.test(rel) ? LIMIT.more : null)); return; }
  if (MORE_RE.test(rel) && /\.(webp|png|jpe?g|gif)$/i.test(rel)) { e.respondWith(cacheFirst(e, req, CN.more, noq, { lru: LIMIT.more })); return; }
  if (STATIC_RE.test(rel)) { e.respondWith(cacheFirst(e, req, CN.static, url.href, { sameVer: true, stale: url.search ? STALE_STATIC : 0 })); return; }
  // 其它（未知类型）：不缓存
});

// ---------- 工具 ----------
const now = () => Date.now();
const ts = (r) => +(r && r.headers.get("x-sw-ts")) || 0;
async function stampPut(cache, key, resp, lru) {
  if (!resp || !resp.ok || resp.status !== 200 || (resp.type !== "basic" && resp.type !== "default")) return;
  const buf = await resp.arrayBuffer();
  const h = new Headers(resp.headers);
  h.set("x-sw-ts", String(now()));
  h.set("x-sw-size", String(buf.byteLength));
  await cache.put(key, new Response(buf, { status: 200, statusText: resp.statusText, headers: h }));
  if (lru) await trim(cache, lru);
}
async function dropOtherVersions(cache, key) {
  const p = new URL(key).pathname;
  for (const k of await cache.keys()) if (k.url !== key && new URL(k.url).pathname === p) await cache.delete(k);
}
// LRU：按 x-sw-ts（最近一次存入/使用时间）从旧到新删，直到条数与体积都在上限内
let trimming = null;
function trim(cache, lim) {
  return (trimming = (trimming || Promise.resolve()).then(async () => {
    const keys = await cache.keys();
    const rows = [];
    let total = 0;
    for (const k of keys) {
      const r = await cache.match(k);
      const sz = +(r && r.headers.get("x-sw-size")) || 0;
      rows.push([k, ts(r), sz]);
      total += sz;
    }
    rows.sort((a, b) => a[1] - b[1]);
    let n = rows.length;
    for (const [k, , sz] of rows) {
      if (n <= lim.n && total <= lim.bytes) break;
      await cache.delete(k); n -= 1; total -= sz;
    }
  }).catch(() => {}));
}
// 命中时更新「最近使用」时间（同一条 1 小时内只更新一次，避免反复写）
async function touch(cache, key, hit) {
  if (now() - ts(hit) < 3600e3) return;
  try {
    const h = new Headers(hit.headers); h.set("x-sw-ts", String(now()));
    await cache.put(key, new Response(await hit.clone().arrayBuffer(), { status: 200, statusText: hit.statusText, headers: h }));
  } catch (err) { /* ignore */ }
}
async function tell(e, msg) {
  try {
    const id = e.clientId || e.resultingClientId;
    const c = id && (await self.clients.get(id));
    const list = c ? [c] : await self.clients.matchAll({ type: "window" });
    list.forEach((x) => x.postMessage(msg));
  } catch (err) { /* ignore */ }
}
function withTimeout(p) {
  let t;
  return Promise.race([p.then((r) => { clearTimeout(t); return r; }), new Promise((res) => { t = setTimeout(() => res("timeout"), TIMEOUT); })]);
}

async function netFirst(e, req, name, key, lru) {
  const cache = await caches.open(name);
  const net = fetch(req).then((r) => {
    if (r.ok) e.waitUntil(stampPut(cache, key, r.clone(), lru).catch(() => {}));
    return r;
  });
  let why = "offline";
  try {
    const r = await withTimeout(net);
    if (r !== "timeout") { tell(e, { type: "sw-online" }); return r; }
    why = "slow";
  } catch (err) { why = "offline"; }
  e.waitUntil(net.catch(() => {}));
  const hit = await cache.match(key);
  if (hit) {
    tell(e, { type: "sw-fallback", why, ts: ts(hit), path: new URL(key).pathname.slice(BASE.length) });
    if (lru) e.waitUntil(touch(cache, key, hit));
    return hit;
  }
  return net; // 没缓存：慢就继续等网络，断网就照常报错
}

function navKey(url) {
  let p = url.pathname;
  if (p.endsWith("/index.html")) p = p.slice(0, -10);
  return url.origin + p;
}
async function navFirst(e, url) {
  const cache = await caches.open(CN.pages), key = navKey(url);
  const net = fetch(e.request).then((r) => { if (r.ok && r.type === "basic") e.waitUntil(stampPut(cache, key, r.clone()).catch(() => {})); return r; });
  let why = "offline";
  try {
    const r = await withTimeout(net);
    if (r !== "timeout") return r;
    why = "slow";
  } catch (err) { why = "offline"; }
  e.waitUntil(net.catch(() => {}));
  const hit = await cache.match(key);
  if (hit) { tell(e, { type: "sw-fallback", why, ts: ts(hit), path: "page" }); return hit; }
  if (why === "slow") return net;
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>离线 · 小七投研</title>
<body style="font:16px/1.7 -apple-system,sans-serif;padding:40px 20px;color:#1f2328;background:#f5f6f8;text-align:center">
<p style="font-size:40px;margin:0">📴</p><h2>现在没有网络</h2><p>这一页之前没打开过，所以没有存下来。</p>
<p><a href="${BASE}" style="color:#2f7fd8">回首页（看上次的数据）</a>　<a href="" onclick="location.reload();return false" style="color:#2f7fd8">重试</a></p></body>`,
    { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function cacheFirst(e, req, name, key, o) {
  const cache = await caches.open(name);
  const hit = await cache.match(key);
  const refresh = () => fetch(req).then((r) => {
    if (r.ok) e.waitUntil(stampPut(cache, key, r.clone(), o.lru).then(() => o.sameVer && dropOtherVersions(cache, key)).catch(() => {}));
    return r;
  });
  if (hit) {
    if (o.stale !== undefined && now() - ts(hit) > o.stale) e.waitUntil(refresh().catch(() => {}));
    else if (o.lru) e.waitUntil(touch(cache, key, hit));
    return hit;
  }
  return refresh();
}
