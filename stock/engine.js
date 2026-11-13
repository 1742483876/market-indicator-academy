/* 小七个股透视 · 浏览器版分析引擎（engine.py 的逐函数移植，纯前端运行，不依赖 Python 后台）
 *
 * 数据：腾讯行情（搜索 / 实时 / 复权日K / 分时 / 逐笔）+ 东方财富（A股主力/超大/大/中/小单资金流历史）。
 * 网络：有 CORS 的接口用 fetch；没有 CORS 的（腾讯搜索 smartbox、逐笔 stock.gtimg.cn）用 <script> 注入读全局变量。
 * 计算：指标公式、打分、阈值、文案、返回字段与 engine.py 保持一致（求和按 Python 3.12+ 的补偿求和，round 按银行家舍入）。
 * 在 Node 里也能运行（用于和 Python 结果对比）：没有 document 时，script 注入改为直接 fetch 文本再解析。
 * 仅供研究参考，不构成投资建议。
 */
(function (root) {
  "use strict";
  const HAS_DOM = typeof document !== "undefined";
  const ACADEMY = "../#/lesson/"; // 指标学堂在个股透视的上一级目录（WorkBuddy：/ 与 /stock/；GitHub Pages：/repo/ 与 /repo/stock/）

  class ValueError extends Error { constructor(m) { super(m); this.name = "ValueError"; } }

  // ======================= Python 语义小工具 =======================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ix = (a, i) => a[i < 0 ? a.length + i : i]; // a[-1]
  const isNone = (x) => x === null || x === undefined;
  const truthy = (x) => (Array.isArray(x) ? x.length > 0 : !!x); // Python 真值（列表空为假）
  function pySum(xs) { // Python 3.12+ 内置 sum 对浮点用 Neumaier 补偿求和
    let f = 0, c = 0;
    for (const x of xs) {
      const t = f + x;
      if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x; else c += (x - t) + f;
      f = t;
    }
    return c && Number.isFinite(c) ? f + c : f;
  }
  function pyFixed(x, d) { // Python f"{x:.{d}f}"：按精确十进制值、平分时取偶
    if (!Number.isFinite(x)) return x !== x ? "nan" : (x > 0 ? "inf" : "-inf");
    const neg = x < 0 || Object.is(x, -0), a = Math.abs(x);
    let s = a.toFixed(d);
    if (a < 1e21) {
      const full = a.toFixed(Math.min(100, d + 60)), dot = full.indexOf(".");
      const tail = full.slice(dot + 1 + d);
      if (/^50*$/.test(tail)) { // 正好在中间：JS 向上取，Python 取偶
        const trunc = d ? full.slice(0, dot + 1 + d) : full.slice(0, dot);
        if (+trunc.slice(-1) % 2 === 0) s = trunc;
      }
    }
    return (neg ? "-" : "") + s;
  }
  const fx = (x, d) => pyFixed(x, d); // {x:.2f}
  const sx = (x, d) => { const s = pyFixed(x, d); return s[0] === "-" ? s : "+" + s; }; // {x:+.2f}
  const pyRound = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : r; }; // round(x)
  const rnd = (x, n = 3) => (isNone(x) ? null : +pyFixed(x, n));
  function fnum(x, dflt = null) {
    if (isNone(x)) return dflt;
    if (typeof x === "number") return Number.isFinite(x) ? x : dflt;
    const s = String(x).trim();
    if (!s || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return dflt;
    const v = Number(s);
    return Number.isFinite(v) ? v : dflt;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const maxOf = (a) => a.reduce((m, x) => (x > m ? x : m)); // Python max：取第一个最大值
  const minOf = (a) => a.reduce((m, x) => (x < m ? x : m));

  // ======================= 网络 =======================
  async function http(url, { enc = "utf-8", timeout = 12000 } = {}) {
    let last = null;
    for (let i = 0; i < 2; i++) { // 数据源偶发 5xx / 断连，重试一次（多数据源之间还会再切换）
      const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
      const tm = setTimeout(() => ac && ac.abort(), timeout);
      try {
        const r = await fetch(url, { signal: ac ? ac.signal : undefined, credentials: "omit" });
        if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { name: "HTTPError" });
        const buf = await r.arrayBuffer();
        return new TextDecoder(enc).decode(buf);
      } catch (e) {
        last = e.name === "AbortError" ? Object.assign(new Error("timeout"), { name: "TimeoutError" }) : e;
        await sleep(300 * (i + 1));
      } finally { clearTimeout(tm); }
    }
    throw last;
  }

  // 没有 CORS 的接口：<script> 注入后在 onload 里同步读全局变量（脚本执行与 load 事件在同一个任务里，中间不会插入别的脚本）
  function loadScript(url, read, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      let done = false;
      const fin = () => { done = true; clearTimeout(tm); s.onload = s.onerror = null; s.remove(); };
      const tm = setTimeout(() => { if (!done) { fin(); reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })); } }, timeout);
      s.onload = () => { let v, err; try { v = read(); } catch (e) { err = e; } fin(); err ? reject(err) : resolve(v); };
      s.onerror = () => { fin(); reject(Object.assign(new Error("script load failed"), { name: "URLError" })); };
      s.src = url;
      (document.head || document.documentElement).appendChild(s);
    });
  }
  async function loadScriptRetry(url, read, timeout) {
    let last;
    for (let i = 0; i < 2; i++) {
      try { return await loadScript(url, read, timeout); } catch (e) { last = e; await sleep(300 * (i + 1)); }
    }
    throw last;
  }
  const queues = {}; // 同一个全局变量名的请求串行，避免互相覆盖
  function serial(name, fn) {
    const p = (queues[name] || Promise.resolve()).then(fn, fn);
    queues[name] = p.catch(() => {});
    return p;
  }

  const _CACHE = new Map();
  async function cached(key, ttl, fn) {
    const now = Date.now() / 1000;
    const hit = _CACHE.get(key);
    if (hit && now - hit[0] < ttl) return hit[1];
    const val = await fn();
    _CACHE.set(key, [now, val]);
    if (_CACHE.size > 3000) {
      [..._CACHE.entries()].sort((a, b) => a[1][0] - b[1][0]).slice(0, 1000).forEach(([k]) => _CACHE.delete(k));
    }
    return val;
  }

  // ======================= 代码与搜索 =======================
  const market_of = (sym) => (sym.startsWith("us") ? "us" : sym.startsWith("hk") ? "hk" : "cn");

  async function hintRaw(q) { // 返回 v_hint 的内容（已经是解码后的字符串），没有时返回 null
    const url = "https://smartbox.gtimg.cn/s3/?v=2&t=all&q=" + encodeURIComponent(q);
    if (!HAS_DOM) {
      const t = await http(url);
      const m = /v_hint="(.*)"/.exec(t);
      return m ? JSON.parse('"' + m[1].replace(/"/g, '\\"') + '"') : null;
    }
    return serial("v_hint", () => { root.v_hint = undefined; return loadScriptRetry(url, () => root.v_hint); });
  }

  async function search(q) {
    q = (q || "").trim();
    if (!q) return [];
    return cached("s:" + q.toLowerCase(), 3600, async () => {
      const raw = await hintRaw(q);
      if (isNone(raw) || raw === "N" || raw === "") return [];
      const out = [];
      for (const item of String(raw).split("^")) {
        const f = item.split("~");
        if (f.length < 5) continue;
        const [mk, code, name, , typ] = f;
        if (!["sh", "sz", "bj", "us", "hk"].includes(mk)) continue;
        if (!["GP", "ETF", "LOF", "FJ", "ZS", "KJ"].some((x) => typ.includes(x))) continue;
        let sym, show;
        if (mk === "us") { sym = "us" + code.toUpperCase(); show = code.split(".")[0].toUpperCase(); } else { sym = mk + code; show = code; }
        const kind = typ.includes("ZS") ? "指数" : (["ETF", "LOF", "FJ", "KJ"].some((x) => typ.includes(x)) ? "ETF/基金" : "股票");
        out.push({ sym, code: show, name, market: { us: "美股", hk: "港股" }[mk] || "A股", kind });
      }
      return out.slice(0, 20);
    });
  }

  async function resolve(text) {
    const t = (text || "").trim();
    if (/^(sh|sz|bj)\d{6}$/.test(t.toLowerCase())) return t.toLowerCase();
    if (/^hk\d{5}$/.test(t.toLowerCase())) return t.toLowerCase();
    if (/^us[A-Za-z.\-]+$/.test(t) && t.includes(".")) return "us" + t.slice(2).toUpperCase();
    const res = await search(t);
    if (!res.length) return null;
    if (/^[A-Za-z.\-]{1,6}$/.test(t)) for (const r of res) if (r.market === "美股" && r.code === t.toUpperCase()) return r.sym;
    if (/^\d{6}$/.test(t)) for (const r of res) if (r.code === t && r.market === "A股") return r.sym;
    return res[0].sym;
  }

  // ======================= 数据 =======================
  async function quote(sym) {
    const qsym = sym.startsWith("us") ? sym.split(".")[0] : sym;
    return cached("q:" + sym, 8, async () => {
      const t = await http(`https://qt.gtimg.cn/q=${qsym}`, { enc: "gbk" });
      const m = /"(.*)"/.exec(t);
      if (!m) return null;
      const f = m[1].split("~");
      if (f.length < 3) throw Object.assign(new Error("list index out of range"), { name: "IndexError" });
      const mk = market_of(sym);
      const g = (i) => (f.length > i ? fnum(f[i]) : null);
      const q = { name: f[1], code: f[2], price: g(3), prev: g(4), open: g(5), vol: g(6), chg: g(31), pct: g(32),
        high: g(33), low: g(34), time: f.length > 30 ? f[30] : "", pe: g(39), amp: g(43) };
      if (mk === "cn") {
        Object.assign(q, { outer: g(7), inner: g(8), amount: (g(37) || 0) * 1e4, turnover: g(38), float_cap: g(44), total_cap: g(45),
          pb: g(46), limit_up: g(47), limit_down: g(48), vol_ratio: g(49), avg_price: g(51),
          pe_dyn: g(52), pe_static: g(53), currency: "CNY", vol_unit: "手" });
      } else if (mk === "us") {
        Object.assign(q, { amount: g(37), turnover: g(38), float_cap: g(44), total_cap: g(45), hi52: g(48), lo52: g(49),
          currency: f.length > 35 ? f[35] : "USD", vol_unit: "股", en_name: f.length > 46 ? f[46] : "" });
      } else {
        Object.assign(q, { amount: g(37), float_cap: g(44), total_cap: g(45), hi52: g(48), lo52: g(49), currency: "HKD", vol_unit: "股" });
      }
      return q;
    });
  }

  function em_secid(sym) {
    if (sym.startsWith("us")) {
      const rest = sym.slice(2), k = rest.indexOf(".");
      const t = k < 0 ? rest : rest.slice(0, k), ex = k < 0 ? "" : rest.slice(k + 1);
      return ({ OQ: "105.", N: "106.", AM: "107." }[ex] || "105.") + t.replace(/-/g, "_");
    }
    if (sym.startsWith("hk")) return (!/^\d+$/.test(sym.slice(2)) ? "100." : "116.") + sym.slice(2);
    return (sym.startsWith("sh") ? "1." : "0.") + sym.slice(2);
  }

  function _rows(rows) {
    const out = [];
    for (const r of rows) {
      const o = fnum(r[1]), c = fnum(r[2]), h = fnum(r[3]), l = fnum(r[4]), v = fnum(r[5]);
      if ([o, c, h, l, v].some(isNone)) continue;
      out.push({ d: r[0], o, c, h, l, v });
    }
    return out;
  }

  async function kline(sym, n = 750, fq = "qfq") {
    // 复权日K。三个数据源依次尝试：腾讯 ifzq → 腾讯 proxy → 东方财富（任何一个被限流时自动切换）
    const tx = async (host, path) => {
      const t = await http(`https://${host}${path}?param=${sym},day,,,${n},${fq}`, { timeout: 8000 });
      const d = JSON.parse(t).data[sym];
      return _rows([d.qfqday, d.day].find(truthy) || []);
    };
    const em = async () => {
      const u = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${em_secid(sym)}&klt=101&fqt=${fq ? 1 : 0}` +
        `&lmt=${n}&end=20500101&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56`;
      const j = JSON.parse(await http(u, { timeout: 8000 }));
      return _rows(((j.data || {}).klines || []).map((x) => x.split(",")));
    };
    return cached(`k:${sym}:${n}:${fq}`, 300, async () => {
      let last = null;
      for (const f of [() => tx("web.ifzq.gtimg.cn", "/appstock/app/fqkline/get"),
        () => tx("proxy.finance.qq.com", "/ifzqgtimg/appstock/app/newfqkline/get"), em]) {
        try { const rows = await f(); if (rows.length) return rows; } catch (e) { last = e; }
      }
      throw last || new ValueError("日K数据为空");
    });
  }

  function benchmark_of(sym) {
    if (sym.startsWith("us")) return sym.endsWith(".OQ") ? ["usQQQ.OQ", "纳指100ETF(QQQ)"] : ["usSPY.AM", "标普500ETF(SPY)"];
    if (sym.startsWith("hk")) return ["hkHSI", "恒生指数"];
    const code = sym.slice(2);
    if (code.startsWith("688")) return ["sh000688", "科创50"];
    if (code.startsWith("300") || code.startsWith("301")) return ["sz399006", "创业板指"];
    if (sym.startsWith("bj")) return ["sh000852", "中证1000"];
    return ["sh000300", "沪深300"];
  }

  async function fund_flow(sym) {
    // 东方财富：每日 主力/超大单/大单/中单/小单 净流入（元）与占成交额比例
    if (market_of(sym) !== "cn") return null;
    const secid = (sym.startsWith("sh") ? "1." : "0.") + sym.slice(2);
    try {
      return await cached("ff:" + sym, 600, async () => {
        const u = "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&secid=" + secid +
          "&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65";
        const j = JSON.parse(await http(u));
        return ((j.data || {}).klines || []).map((line) => {
          const f = line.split(",");
          return { d: f[0], main: fnum(f[1], 0), small: fnum(f[2], 0), mid: fnum(f[3], 0), big: fnum(f[4], 0),
            huge: fnum(f[5], 0), main_pct: fnum(f[6], 0), small_pct: fnum(f[7], 0), mid_pct: fnum(f[8], 0),
            big_pct: fnum(f[9], 0), huge_pct: fnum(f[10], 0) };
        });
      });
    } catch (e) { return null; }
  }

  async function minute(sym) {
    if (market_of(sym) !== "cn") return null;
    try {
      return await cached("m:" + sym, 30, async () => {
        const j = JSON.parse(await http(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${sym}`));
        const d = j.data[sym].data;
        const out = [];
        let pv = 0, pa = 0;
        for (const line of d.data || []) {
          const f = line.trim().split(/\s+/);
          if (f.length < 4) continue;
          const cv = fnum(f[2], 0), ca = fnum(f[3], 0);
          out.push({ t: f[0].slice(0, 2) + ":" + f[0].slice(2), p: fnum(f[1]), v: cv - pv, a: ca - pa, avg: cv ? ca / (cv * 100) : null });
          pv = cv; pa = ca;
        }
        return { date: isNone(d.date) ? null : d.date, rows: out };
      });
    } catch (e) { return null; }
  }

  const TIERS = [["超大单", 1000000], ["大单", 200000], ["中单", 40000], ["小单", 0]];

  async function ticks(sym) {
    // 当天逐笔成交：按单笔金额分 超大单(≥100万) / 大单(20–100万) / 中单(4–20万) / 小单(<4万)，按主动买(B)/主动卖(S)统计
    if (market_of(sym) !== "cn") return null;
    const vname = "v_detail_data_" + sym;
    const page = async (p) => {
      const url = `https://stock.gtimg.cn/data/index.php?appn=detail&action=data&c=${sym}&p=${p}`;
      if (!HAS_DOM) {
        const t = await http(url, { timeout: 10000 });
        const m = /"(.*)"/.exec(t);
        return !m || !m[1] ? [] : m[1].split("|");
      }
      // 同一个变量名会被并发的各页覆盖：在 onload 里同步读取，并核对页号（超出范围的页返回空内容，变量不会被改写）
      const v = await loadScriptRetry(url + "&_=" + Date.now(), () => root[vname], 10000);
      return Array.isArray(v) && +v[0] === p && v[1] ? String(v[1]).split("|") : [];
    };
    try {
      return await cached("t:" + sym, 60, async () => {
        if (HAS_DOM) root[vname] = undefined;
        const rows = [];
        let p = 0;
        while (p < 400) {
          const batch = await Promise.all(Array.from({ length: 12 }, (_, k) => page(p + k)));
          for (const b of batch) rows.push(...b);
          if (batch.some((b) => b.length === 0)) break;
          p += 12;
        }
        const stats = {};
        for (const [n] of TIERS) stats[n] = { buy: 0.0, sell: 0.0, neutral: 0.0, n_buy: 0, n_sell: 0 };
        const timeline = new Map(), seen = new Set();
        let cum = 0.0;
        for (const r of rows) {
          const f = r.split("/");
          if (f.length < 7 || seen.has(f[0])) continue;
          seen.add(f[0]);
          const amt = fnum(f[5], 0), side = f[6], tm = f[1].slice(0, 5);
          const tier = (TIERS.find(([, th]) => amt >= th) || TIERS[3])[0];
          const s = stats[tier];
          if (side === "B") { s.buy += amt; s.n_buy += 1; } else if (side === "S") { s.sell += amt; s.n_sell += 1; } else s.neutral += amt;
          if ((tier === "超大单" || tier === "大单") && (side === "B" || side === "S")) cum += side === "B" ? amt : -amt;
          timeline.set(tm, cum);
        }
        const total = pySum(Object.values(stats).map((v) => v.buy + v.sell + v.neutral)) || 1;
        const table = TIERS.map(([n]) => {
          const s = stats[n];
          return { tier: n, buy: s.buy, sell: s.sell, net: s.buy - s.sell, n_buy: s.n_buy, n_sell: s.n_sell, share: (s.buy + s.sell + s.neutral) / total * 100 };
        });
        const main_net = pySum(table.slice(0, 2).map((r) => r.net));
        return { n: seen.size, total, table, main_net, main_share: table[0].share + table[1].share,
          timeline: [...timeline.keys()].sort().map((k) => ({ t: k, cum: timeline.get(k) })) };
      });
    } catch (e) { return null; }
  }

  // ======================= 指标 =======================
  function sma(a, n) {
    const out = new Array(a.length).fill(null), q = [];
    let s = 0.0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      q.push(x); s += x;
      if (q.length > n) s -= q.shift();
      if (q.length === n) out[i] = s / n;
    }
    return out;
  }
  function ema(a, n) {
    const out = new Array(a.length).fill(null), k = 2 / (n + 1);
    let e = null;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (isNone(x)) continue;
      e = isNone(e) ? x : e + k * (x - e);
      out[i] = e;
    }
    return out;
  }
  function wilder(a, n) {
    const out = new Array(a.length).fill(null);
    let e = null, cnt = 0, acc = 0.0;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      if (isNone(x)) continue;
      if (isNone(e)) {
        acc += x; cnt += 1;
        if (cnt === n) { e = acc / n; out[i] = e; }
      } else { e = (e * (n - 1) + x) / n; out[i] = e; }
    }
    return out;
  }
  const rolling = (a, n, fn) => a.map((_, i) => (i >= n - 1 ? fn(a.slice(i - n + 1, i + 1)) : null));
  const zip = (a, b, fn) => a.map((x, i) => fn(x, b[i]));
  const shift26 = (a) => new Array(26).fill(null).concat(a.slice(0, Math.max(0, a.length - 26)));

  function indicators(K) {
    const C = K.map((k) => k.c), H = K.map((k) => k.h), L = K.map((k) => k.l), V = K.map((k) => k.v);
    const n = C.length;
    const I = { ma: {} };
    for (const m of [5, 10, 20, 60, 120, 250]) I.ma[m] = sma(C, m);
    const e12 = ema(C, 12), e26 = ema(C, 26);
    const dif = zip(e12, e26, (a, b) => (!isNone(a) && !isNone(b) ? a - b : null));
    const dea = ema(dif, 9);
    I.dif = dif; I.dea = dea;
    I.macd = zip(dif, dea, (a, b) => (!isNone(a) && !isNone(b) ? 2 * (a - b) : null));
    // KDJ
    let k_ = 50.0, d_ = 50.0;
    const K_ = [], D_ = [], J_ = [];
    for (let i = 0; i < n; i++) {
      const lo = minOf(L.slice(Math.max(0, i - 8), i + 1)), hi = maxOf(H.slice(Math.max(0, i - 8), i + 1));
      const rsv = hi > lo ? (C[i] - lo) / (hi - lo) * 100 : 50;
      k_ = k_ * 2 / 3 + rsv / 3;
      d_ = d_ * 2 / 3 + k_ / 3;
      K_.push(k_); D_.push(d_); J_.push(3 * k_ - 2 * d_);
    }
    I.k = K_; I.d = D_; I.j = J_;
    // RSI
    const up = [null], dn = [null];
    for (let i = 1; i < n; i++) { up.push(Math.max(C[i] - C[i - 1], 0)); dn.push(Math.max(C[i - 1] - C[i], 0)); }
    const au = wilder(up, 14), ad = wilder(dn, 14);
    I.rsi = zip(au, ad, (a, b) => (isNone(a) || isNone(b) ? null : (b === 0 ? 100.0 : 100 - 100 / (1 + a / b))));
    // BOLL
    const mid = sma(C, 20);
    const sd = rolling(C, 20, (w) => Math.sqrt(pySum(w.map((x) => { const t = x - pySum(w) / 20; return t * t; })) / 19));
    I.bm = mid;
    I.bu = zip(mid, sd, (m, s) => (m && s ? m + 2 * s : null));
    I.bl = zip(mid, sd, (m, s) => (m && s ? m - 2 * s : null));
    // ATR / ADX
    const tr = [H[0] - L[0]], pdm = [0], ndm = [0];
    for (let i = 1; i < n; i++) {
      tr.push(Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1])));
      const u = H[i] - H[i - 1], dd = L[i - 1] - L[i];
      pdm.push(u > dd && u > 0 ? u : 0);
      ndm.push(dd > u && dd > 0 ? dd : 0);
    }
    const atr = wilder(tr, 14), sp = wilder(pdm, 14), sn = wilder(ndm, 14);
    const pdi = zip(sp, atr, (a, t) => (!isNone(a) && t ? 100 * a / t : null));
    const ndi = zip(sn, atr, (a, t) => (!isNone(a) && t ? 100 * a / t : null));
    const dx = zip(pdi, ndi, (a, b) => (!isNone(a) && !isNone(b) && (a + b) ? 100 * Math.abs(a - b) / (a + b) : null));
    I.atr = atr; I.pdi = pdi; I.ndi = ndi; I.adx = wilder(dx, 14);
    // OBV / MFI / CMF
    const obv = [];
    let o = 0.0;
    for (let i = 0; i < n; i++) {
      if (i) o += C[i] > C[i - 1] ? V[i] : (C[i] < C[i - 1] ? -V[i] : 0);
      obv.push(o);
    }
    I.obv = obv; I.obv_ma = sma(obv, 20);
    const tp = C.map((_, i) => (H[i] + L[i] + C[i]) / 3);
    const mf = tp.map((t, i) => t * V[i]);
    const pos = mf.map((x, i) => (i && tp[i] > tp[i - 1] ? x : 0));
    const neg = mf.map((x, i) => (i && tp[i] < tp[i - 1] ? x : 0));
    I.mfi = C.map((_, i) => {
      if (i < 14) return null;
      const sn_ = pySum(neg.slice(i - 13, i + 1));
      return sn_ ? 100 - 100 / (1 + pySum(pos.slice(i - 13, i + 1)) / sn_) : 100.0;
    });
    const mfv = C.map((_, i) => (H[i] > L[i] ? ((C[i] - L[i]) - (H[i] - C[i])) / (H[i] - L[i]) * V[i] : 0));
    I.cmf = C.map((_, i) => {
      if (i < 19) return null;
      const sv = pySum(V.slice(i - 19, i + 1));
      return !sv ? null : pySum(mfv.slice(i - 19, i + 1)) / sv;
    });
    I.vma5 = sma(V, 5); I.vma20 = sma(V, 20);
    // 一目均衡表（先行带向前平移26日，这里存“当日对应的云”）
    const tk = zip(rolling(H, 9, maxOf), rolling(L, 9, minOf), (a, b) => (!isNone(a) ? (a + b) / 2 : null));
    const kj = zip(rolling(H, 26, maxOf), rolling(L, 26, minOf), (a, b) => (!isNone(a) ? (a + b) / 2 : null));
    const sa = zip(tk, kj, (a, b) => (!isNone(a) && !isNone(b) ? (a + b) / 2 : null));
    const sb = zip(rolling(H, 52, maxOf), rolling(L, 52, minOf), (a, b) => (!isNone(a) ? (a + b) / 2 : null));
    I.tk = tk; I.kj = kj;
    I.ia = shift26(sa); I.ib = shift26(sb);
    return I;
  }

  function chips(K, days = 120, bins = 40) {
    // 筹码分布估算：近 N 日每日成交量按当日最低–最高价均匀分布（不考虑换手衰减），得到成本分布
    const seg = K.slice(-days);
    const lo = minOf(seg.map((k) => k.l)), hi = maxOf(seg.map((k) => k.h));
    if (hi <= lo) return null;
    const w = (hi - lo) / bins;
    const hist = new Array(bins).fill(0.0);
    for (const k of seg) {
      let a = Math.trunc((k.l - lo) / w), b = Math.trunc((k.h - lo) / w);
      a = Math.min(a, bins - 1); b = Math.min(b, bins - 1);
      const share = k.v / (b - a + 1);
      for (let i = a; i <= b; i++) hist[i] += share;
    }
    const tot = pySum(hist) || 1;
    const price = ix(K, -1).c;
    const profit = pySum(hist.filter((h, i) => lo + (i + 0.5) * w <= price)) / tot * 100;
    const avg = pySum(hist.map((h, i) => (lo + (i + 0.5) * w) * h)) / tot;
    let acc = 0, lo90 = null, hi90 = null;
    hist.forEach((h, i) => {
      acc += h / tot;
      if (lo90 === null && acc >= 0.05) lo90 = lo + i * w;
      if (hi90 === null && acc >= 0.95) hi90 = lo + (i + 1) * w;
    });
    let peak = 0;
    for (let i = 1; i < bins; i++) if (hist[i] > hist[peak]) peak = i;
    return { days, profit_pct: profit, avg_cost: avg, band90: [lo90, hi90], peak: lo + (peak + 0.5) * w,
      bins: hist.map((h, i) => ({ p: rnd(lo + (i + 0.5) * w, 3), v: rnd(h / tot * 100, 3) })) };
  }

  // ======================= 打分 =======================
  const pct_change = (a, n) => (a.length > n && ix(a, -1 - n) ? (ix(a, -1) / ix(a, -1 - n) - 1) * 100 : null);

  function tech_score_at(i, C, I) {
    // 只用价格/成交量的技术分（趋势+动能+量能），用于本股历史检验
    if (i < 80 || isNone(I.ma[60][i]) || isNone(I.ia[i]) || isNone(I.ib[i])) return null;
    let s = 0;
    const c = C[i];
    const top = Math.max(I.ia[i], I.ib[i]), bot = Math.min(I.ia[i], I.ib[i]);
    s += c > top ? 10 : (c < bot ? -10 : 0);
    const m5 = I.ma[5][i], m10 = I.ma[10][i], m20 = I.ma[20][i], m60 = I.ma[60][i];
    s += m5 > m10 && m10 > m20 && m20 > m60 ? 8 : (m5 < m10 && m10 < m20 && m20 < m60 ? -8 : (c > m60 ? 4 : -4));
    const adx = I.adx[i], pdi = I.pdi[i], ndi = I.ndi[i];
    if (adx && adx > 25) s += pdi > ndi ? 7 : -7;
    const m60p = I.ma[60][i - 10];
    if (m60p) s += m60 > m60p ? 5 : -5;
    const dif = I.dif[i], dea = I.dea[i];
    s += dif > dea ? 5 : -5;
    s += dif > 0 ? 3 : -3;
    const r = I.rsi[i] || 50;
    s += r >= 50 && r <= 70 ? 4 : (r > 80 ? -4 : (r < 25 ? 2 : -2));
    return s;
  }

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })), ms))]);

  async function analyze(sym) {
    const mk = market_of(sym);
    const [bsym, bname] = benchmark_of(sym);
    const jobs = [["q", () => quote(sym)], ["k", () => kline(sym)], ["b", () => kline(bsym, 400, "")], ["ff", () => fund_flow(sym)], ["m", () => minute(sym)]];
    const LABEL = { q: "实时行情", k: "日K", b: "基准指数", ff: "资金流", m: "分时" };
    const settled = await Promise.allSettled(jobs.map(([, fn]) => withTimeout(fn(), 20000)));
    const res = {}, errors = [];
    jobs.forEach(([k], i) => {
      const s = settled[i];
      if (s.status === "fulfilled") res[k] = s.value;
      else { res[k] = null; errors.push(LABEL[k] + `未获取（${(s.reason && s.reason.name) || "Error"}）`); }
    });
    const Q = res.q, K = res.k;
    if (!K || K.length < 30) throw new ValueError("这只标的的历史数据不足（可能是新股、停牌或代码有误）");
    const I = indicators(K);
    const C = K.map((k) => k.c), V = K.map((k) => k.v);
    const c = ix(C, -1);
    const price = (Q || {}).price || c;
    const ma = {};
    for (const m of Object.keys(I.ma)) ma[m] = ix(I.ma[m], -1);
    const items = [], groups = {};
    const item = (group, name, value, state, pts, note, lesson = null) => {
      items.push({ group, name, value, state, pts, note, lesson: lesson ? ACADEMY + lesson : null });
      groups[group] = (groups[group] || 0) + pts;
    };
    let st, p;

    // ---- 趋势
    const ia = ix(I.ia, -1), ib = ix(I.ib, -1);
    let top = null, bot = null;
    if (!isNone(ia) && !isNone(ib)) {
      top = Math.max(ia, ib); bot = Math.min(ia, ib);
      st = c > top ? "云上（多）" : (c < bot ? "云下（空）" : "云中（震荡）");
      item("趋势", "一目均衡表", `云顶 ${fx(top, 2)} / 云底 ${fx(bot, 2)}`, st, c > top ? 10 : (c < bot ? -10 : 0),
        "价格在云上方＝中期多头；云下方＝中期空头", "ichimoku");
    }
    const m5 = ma[5], m10 = ma[10], m20 = ma[20], m60 = ma[60];
    if (m60) {
      if (m5 > m10 && m10 > m20 && m20 > m60) { st = "多头排列"; p = 8; }
      else if (m5 < m10 && m10 < m20 && m20 < m60) { st = "空头排列"; p = -8; }
      else { st = c > m60 ? "价格在60日线上" : "价格在60日线下"; p = c > m60 ? 4 : -4; }
      item("趋势", "均线排列", `MA20 ${fx(m20, 2)} / MA60 ${fx(m60, 2)}`, st, p, "MA5>MA10>MA20>MA60 且向上＝趋势健康", "ma");
      const m60p = ix(I.ma[60], -11);
      if (m60p) {
        item("趋势", "60日线方向", `10日${sx((m60 / m60p - 1) * 100, 2)}%`, m60 > m60p ? "向上" : "向下", m60 > m60p ? 5 : -5,
          "中期成本线的方向", "ma");
      }
    }
    const adx = ix(I.adx, -1), pdi = ix(I.pdi, -1), ndi = ix(I.ndi, -1);
    if (adx) {
      const strong = adx > 25;
      p = strong ? (pdi > ndi ? 7 : -7) : 0;
      item("趋势", "ADX 趋势强度", `ADX ${fx(adx, 1)}｜+DI ${fx(pdi, 1)} −DI ${fx(ndi, 1)}`,
        (strong ? "强趋势·" : "无明显趋势·") + (pdi > ndi ? "多方占优" : "空方占优"), p,
        "ADX>25 说明有趋势，+DI/−DI 看方向；<20 多为震荡市");
    }
    // ---- 动能
    const dif = ix(I.dif, -1), dea = ix(I.dea, -1);
    let cross = "";
    if (!isNone(ix(I.dif, -2)) && !isNone(ix(I.dea, -2))) {
      if (dif > dea && ix(I.dif, -2) <= ix(I.dea, -2)) cross = "·刚金叉";
      else if (dif < dea && ix(I.dif, -2) >= ix(I.dea, -2)) cross = "·刚死叉";
    }
    item("动能", "MACD", `DIF ${fx(dif, 3)} / DEA ${fx(dea, 3)}`, (dif > 0 ? "强" : "弱") + (dif > dea ? " 多" : " 空") + cross,
      (dif > dea ? 5 : -5) + (dif > 0 ? 3 : -3), "零轴上方的金叉更可靠", "macd");
    const r = ix(I.rsi, -1) || 50;
    item("动能", "RSI(14)", fx(r, 1), r > 80 ? "超买" : (r >= 50 ? "偏强" : (r < 25 ? "超卖" : "偏弱")),
      r >= 50 && r <= 70 ? 4 : (r > 80 ? -4 : (r < 25 ? 2 : -2)), ">80 过热别追，<25 超卖", "rsi");
    const kk = ix(I.k, -1), dd = ix(I.d, -1), jj = ix(I.j, -1);
    let kcross = "";
    if (kk > dd && ix(I.k, -2) <= ix(I.d, -2)) kcross = "金叉";
    else if (kk < dd && ix(I.k, -2) >= ix(I.d, -2)) kcross = "死叉";
    const zone = kk < 25 || jj < 0 ? "底部" : (kk > 75 || jj > 100 ? "顶部" : "");
    p = zone === "底部" && kcross === "金叉" ? 3 : (zone === "顶部" && kcross === "死叉" ? -3 : 0);
    item("动能", "KDJ", `K ${fx(kk, 1)} D ${fx(dd, 1)} J ${fx(jj, 1)}`, (zone + kcross) || (kk > dd ? "K在D上" : "K在D下"), p, "底部金叉＝短线买点，顶部死叉＝短线卖点", "kdj");
    // ---- 量能
    const limit_up = !!(Q && Q.limit_up && price >= Q.limit_up - 0.0015);
    const limit_dn = !!(Q && Q.limit_down && price <= Q.limit_down + 0.0015);
    let vr = ix(I.vma5, -2) ? ix(V, -1) / ix(I.vma5, -2) : null;
    if (Q && Q.vol_ratio) vr = Q.vol_ratio;
    const chg1 = (ix(C, -1) / ix(C, -2) - 1) * 100;
    if (vr && limit_up) {
      [st, p] = vr < 1 ? ["缩量涨停（封板惜售）", 4] : ["放量涨停（分歧中封板）", 2];
      item("量能", "量比 / 量价", `量比 ${fx(vr, 2)}｜当日 ${sx(chg1, 2)}%（涨停）`, st, p, "涨停封板时卖的人少，量自然缩小，属于强势", "volume");
    } else if (vr && limit_dn) {
      item("量能", "量比 / 量价", `量比 ${fx(vr, 2)}｜当日 ${sx(chg1, 2)}%（跌停）`, "跌停", -8, "跌停说明卖盘踩踏，次日往往还有惯性", "volume");
    } else if (vr) {
      if (chg1 > 0 && vr > 1.2) [st, p] = ["放量上涨", 5];
      else if (chg1 < 0 && vr > 1.5) [st, p] = ["放量下跌", -6];
      else if (chg1 < 0 && vr < 0.8) [st, p] = ["缩量回调", 2];
      else if (chg1 > 0 && vr < 0.8) [st, p] = ["缩量上涨", -2];
      else [st, p] = ["量价平稳", 0];
      item("量能", "量比 / 量价", `量比 ${fx(vr, 2)}｜当日 ${sx(chg1, 2)}%`, st, p, "放量上涨可信，放量下跌危险，缩量回调健康", "volume");
    }
    const obv = ix(I.obv, -1), obvm = ix(I.obv_ma, -1);
    if (!isNone(obvm)) {
      const upv = obv > obvm;
      item("量能", "OBV 能量潮", upv ? "在20日均线上方" : "在20日均线下方", upv ? "资金在进" : "资金在出", upv ? 3 : -3,
        "上涨日成交量记正、下跌日记负累加；和价格背离时要警惕");
    }
    // ---- 资金 / 主力行为
    const FF = res.ff;
    let behavior = null, ff_summary = null;
    if (mk === "cn" && truthy(FF)) {
      const last = ix(FF, -1);
      const s5 = pySum(FF.slice(-5).map((x) => x.main));
      const s20 = pySum(FF.slice(-20).map((x) => x.main));
      const p5 = pySum(FF.slice(-5).map((x) => x.main_pct)) / Math.min(5, FF.length);
      const p20 = pySum(FF.slice(-20).map((x) => x.main_pct)) / Math.min(20, FF.length);
      let streak = 0;
      const sign = last.main > 0 ? 1 : -1;
      for (let i = FF.length - 1; i >= 0; i--) {
        if ((FF[i].main > 0) === (sign > 0)) streak += 1; else break;
      }
      ff_summary = { last, sum5: s5, sum20: s20, pct5: p5, pct20: p20, streak: streak * sign,
        huge5: pySum(FF.slice(-5).map((x) => x.huge)), big5: pySum(FF.slice(-5).map((x) => x.big)),
        mid5: pySum(FF.slice(-5).map((x) => x.mid)), small5: pySum(FF.slice(-5).map((x) => x.small)) };
      item("资金", "主力净流入（超大+大单）", `今日 ${sx(last.main / 1e8, 2)}亿（${sx(last.main_pct, 1)}%）｜5日 ${sx(s5 / 1e8, 2)}亿｜20日 ${sx(s20 / 1e8, 2)}亿`,
        `连续${Math.abs(streak)}日${sign > 0 ? "流入" : "流出"}`, clamp(pyRound(p5 * 1.5 + p20 * 2.5), -15, 15),
        "东方财富口径：按单笔成交额分档，超大单≥100万元、大单20–100万元");
    } else if (mk !== "cn") {
      const cmf = ix(I.cmf, -1), mfi = ix(I.mfi, -1);
      if (!isNone(cmf)) {
        item("资金", "CMF 资金流(20日)", sx(cmf, 3), cmf > 0.05 ? "资金净流入" : (cmf < -0.05 ? "资金净流出" : "均衡"),
          clamp(pyRound(cmf * 60), -12, 12), "收盘越靠近当日高点、成交越大，记为流入；美股没有公开的大单数据，用它近似");
      }
      if (!isNone(mfi)) {
        item("资金", "MFI 资金流量指标", fx(mfi, 1), mfi > 80 ? "过热" : (mfi < 20 ? "恐慌" : "中性"),
          mfi > 80 ? -3 : (mfi < 20 ? 3 : 0), "带成交量的 RSI，>80 过热、<20 超卖");
      }
      let bu = 0, bd = 0;
      for (let j = K.length - 20; j < K.length; j++) {
        const vm = I.vma20[j - 1 < 0 ? K.length + j - 1 : j - 1];
        if (vm && V[j] > 2 * vm && C[j] > C[j - 1]) bu++;
        if (vm && V[j] > 2 * vm && C[j] < C[j - 1]) bd++;
      }
      item("资金", "近20日放量日方向", `放量上涨 ${bu} 天 / 放量下跌 ${bd} 天`, bu > bd ? "大资金偏买" : (bd > bu ? "大资金偏卖" : "无明显方向"),
        clamp((bu - bd) * 2, -5, 5), "成交量超过20日均量2倍的日子，通常有机构参与");
    } else {
      errors.push("资金流未获取");
    }
    if (Q && Q.outer && Q.inner && !limit_up && !limit_dn) {
      const ob = Q.outer / (Q.outer + Q.inner) * 100;
      item("资金", "外盘 / 内盘（今日）", `外盘占 ${fx(ob, 0)}%`, ob > 55 ? "主动买盘占优" : (ob < 45 ? "主动卖盘占优" : "买卖均衡"),
        ob > 55 ? 2 : (ob < 45 ? -2 : 0), "外盘＝主动按卖价买入的量，内盘＝主动按买价卖出的量");
    }
    // ---- 相对强弱
    const B = res.b;
    let rs20 = null, rs60 = null;
    const r20 = pct_change(C, 20), r60 = pct_change(C, 60);
    if (B && B.length > 61) {
      const BC = B.map((k) => k.c);
      const b20 = pct_change(BC, 20), b60 = pct_change(BC, 60);
      rs20 = !isNone(r20) ? r20 - b20 : null;
      rs60 = !isNone(r60) ? r60 - b60 : null;
      if (!isNone(rs20) && !isNone(rs60)) {
        item("相对强弱", `相对${bname}`, `20日 ${sx(rs20, 1)}pct｜60日 ${sx(rs60, 1)}pct`, rs20 > 0 ? "强于大盘" : "弱于大盘",
          clamp(pyRound(rs20 * 0.5 + rs60 * 0.2), -10, 10), "个股涨幅减去基准涨幅；强于大盘的股票更值得关注", "style");
      }
    }
    // ---- 位置 / 风险
    const W = K.slice(-250);
    const hi52 = maxOf(W.map((k) => k.h)), lo52 = minOf(W.map((k) => k.l));
    const posn = hi52 > lo52 ? (c - lo52) / (hi52 - lo52) * 100 : 50;
    const dd52 = (c / hi52 - 1) * 100;
    p = 0;
    if (posn > 90 && r > 75) p = -6;
    else if (posn < 20 && (isNone(top) || c >= bot)) p = 4;
    if (dd52 < -50) p -= 4;
    item("位置风险", "52周位置", `${fx(posn, 0)}%（高 ${fx(hi52, 2)} / 低 ${fx(lo52, 2)}，距高点 ${sx(dd52, 1)}%）`,
      posn > 80 ? "高位" : (posn < 20 ? "低位" : "中间"), p, "0%＝一年最低，100%＝一年最高", "percentile");
    const bm_ = ix(I.bm, -1);
    const zb = ix(I.bu, -1) && ix(I.bu, -1) !== bm_ ? (c - bm_) / (ix(I.bu, -1) - bm_) : 0;
    if (!isNone(r20) && r20 > 30 && zb > 0.9) {
      item("位置风险", "短期涨幅", `20日 ${sx(r20, 1)}%，在布林上轨附近或上方`, "短期涨幅过大", -8, "短期暴涨后追进去，回撤往往很快，风险收益比差", "boll");
    } else if (!isNone(r20) && r20 < -25 && zb < -0.9) {
      item("位置风险", "短期跌幅", `20日 ${sx(r20, 1)}%，在布林下轨附近或下方`, "短期超跌", 3, "超跌后有反弹需求，但不代表见底", "boll");
    }
    const atr = ix(I.atr, -1);
    const atrp = atr ? atr / c * 100 : null;
    if (atrp) {
      item("位置风险", "波动率 ATR", `${fx(atr, 2)}（日均波动 ${fx(atrp, 1)}%）`, atrp > 6 ? "波动很大" : (atrp > 3.5 ? "波动偏大" : "波动正常"),
        atrp > 6 ? -3 : 0, "用来设止损：一般放在 2 倍 ATR 之外");
    }
    const bu_ = ix(I.bu, -1), bl_ = ix(I.bl, -1);
    if (bu_ && bl_) {
      const z = bu_ !== ix(I.bm, -1) ? (c - ix(I.bm, -1)) / (bu_ - ix(I.bm, -1)) : 0;
      const pos = z > 1 ? "破上轨" : (z > 0.7 ? "上轨附近" : (z >= 0 ? "中轨上" : (z >= -0.7 ? "中轨下" : (z >= -1 ? "下轨附近" : "破下轨"))));
      item("位置风险", "布林带", `上 ${fx(bu_, 2)} / 中 ${fx(ix(I.bm, -1), 2)} / 下 ${fx(bl_, 2)}`, pos, 0, "看价格在跑道里的位置", "boll");
    }

    // ---- 主力行为判定
    const r5 = pct_change(C, 5) || 0;
    const r20v = r20 || 0;
    const vr20 = ix(I.vma20, -6) ? (pySum(V.slice(-5)) / 5) / ix(I.vma20, -6) : 1;
    const up_trend = !!(m20 && m60 && m20 > m60);
    if (mk === "cn" && ff_summary) {
      const f5 = ff_summary.pct5, f20 = ff_summary.pct20;
      if (posn < 40 && r20v <= 3 && f20 > 1 && vr20 <= 1.1) behavior = ["低位吸筹", "价格低位横盘或下跌，主力却持续净流入、成交不放大——典型的悄悄建仓", 6];
      else if (r20v > 8 && f5 > 0 && vr20 > 1.2) behavior = ["拉升", "放量上涨且主力净流入，资金在主动推升", 5];
      else if (posn > 70 && (f5 < -2 || f20 < -1) && r20v > -3) behavior = ["高位派发", "价格在高位，主力却在持续净流出——警惕边拉边出", -8];
      else if (up_trend && r5 < -3 && vr20 < 1 && f5 > -3) behavior = ["洗盘", "上升趋势中的缩量回调，主力没有大幅出逃", 3];
      else if (r20v < -5 && f20 < -1) behavior = ["出逃", "价格下跌、主力持续净流出，资金在离场", -6];
      else behavior = ["无明显主力动作", "资金流和价格没有形成清晰配合", 0];
    } else {
      const cm = ix(I.cmf, -1) || 0;
      const obv_up = !isNone(ix(I.obv_ma, -1)) && ix(I.obv, -1) > ix(I.obv_ma, -1);
      if (posn < 40 && r20v <= 3 && cm > 0.05 && obv_up) behavior = ["低位吸筹（量价推算）", "价格低位，但资金流指标转正、OBV 抬头", 5];
      else if (r20v > 8 && cm > 0.05) behavior = ["资金推升", "上涨伴随资金流入", 4];
      else if (posn > 70 && cm < -0.05) behavior = ["高位派发（量价推算）", "高位资金流转负", -6];
      else if (r20v < -5 && cm < -0.05) behavior = ["资金离场", "下跌伴随资金流出", -5];
      else if (up_trend && r5 < -3 && vr20 < 1) behavior = ["缩量回调", "上升趋势中的缩量调整", 2];
      else behavior = ["无明显方向", "资金流和价格没有形成清晰配合", 0];
    }
    groups["资金"] = (groups["资金"] || 0) + behavior[2];

    // ---- 汇总
    const caps = { 趋势: 30, 动能: 15, 资金: 25, 量能: 10, 相对强弱: 10, 位置风险: 10 };
    for (const g of Object.keys(groups)) groups[g] = clamp(groups[g], -(caps[g] || 10), caps[g] || 10);
    const score = Object.values(groups).reduce((a, b) => a + b, 0);
    const uniq = (xs) => [...new Set(xs)];
    const support = uniq([m20, m60, bl_, minOf(K.slice(-20).map((k) => k.l))].filter((x) => x && x < price).map((x) => rnd(x, 3))).sort((a, b) => b - a);
    const resist = uniq([bu_, maxOf(K.slice(-20).map((k) => k.h)), maxOf(K.slice(-60).map((k) => k.h)), top].filter((x) => x && x > price).map((x) => rnd(x, 3))).sort((a, b) => a - b);
    const stopC = [m20, atr ? price - 2 * atr : null].filter((x) => x && x < price);
    const stop = maxOf(stopC.length ? stopC : [price * 0.92]);
    const code = (Q || {}).code || sym.slice(2);
    const name = (Q || {}).name || code;
    const wait_for = [];
    if (top && c <= top) wait_for.push(`站上一目云顶 ${fx(top, 2)}`);
    if (dif <= dea) wait_for.push("MACD 金叉");
    if (mk === "cn" && ff_summary && ff_summary.pct5 <= 0) wait_for.push("主力5日转为净流入");
    if (resist.length) wait_for.push(`放量突破 ${fx(resist[0], 2)}`);
    // 本股历史检验先算，用于结论把关
    const ts = C.map((_, j) => tech_score_at(j, C, I));
    const fwd = C.map((_, j) => (j + 20 < C.length ? (C[j + 20] / C[j] - 1) * 100 : null));
    const bucket = (cond) => {
      const xs = [];
      for (let j = 0; j < C.length; j++) if (!isNone(ts[j]) && !isNone(fwd[j]) && cond(ts[j])) xs.push(fwd[j]);
      return { n: xs.length, mean: xs.length ? pySum(xs) / xs.length : null, win: xs.length ? xs.filter((x) => x > 0).length / xs.length * 100 : null };
    };
    const hist = { strong: bucket((s) => s >= 25), weak: bucket((s) => s <= -20), all: bucket(() => true), now: ix(ts, -1) };
    const bad_behavior = ["高位派发", "出逃", "资金离场"].some((x) => behavior[0].startsWith(x));
    const hs_ = hist.strong, ha_ = hist.all;
    const momentum_fails = !!(hs_.n >= 30 && !isNone(hs_.mean) && !isNone(ha_.mean) && hs_.mean < ha_.mean - 0.5);
    const near = support.filter((x) => (price - x) / price <= 0.10);
    const blockers = [];
    if (bad_behavior) blockers.push(`主力行为是「${behavior[0]}」`);
    if (momentum_fails) blockers.push(`这只股票历史上技术面强势后20日平均 ${sx(hs_.mean, 1)}%，还不如平时（${sx(ha_.mean, 1)}%），追涨胜率低`);
    if (items.some((it) => it.state === "短期涨幅过大")) blockers.push("短期涨幅过大");
    let verdict, cls, action;
    if (score >= 35 && (isNone(bot) || c >= bot) && !blockers.length) {
      verdict = `可以考虑买入 ${name}(${code})`; cls = "buy";
      if (near.length) action = `分批买入，回踩 ${fx(near[0], 2)} 附近不破可加；跌破 ${fx(stop, 2)} 止损。单只股票仓位不超过总资金 20%。`;
      else action = `趋势和资金都好，但离均线支撑较远（MA20 ${fx(m20, 2)}），不追高，等回踩 MA10 ${fx(ma[10], 2)} 附近再分批；跌破 ${fx(stop, 2)} 止损。单只股票仓位不超过总资金 20%。`;
    } else if (score >= 35 && blockers.length) {
      verdict = "等待确认"; cls = "wait";
      action = "趋势偏强，但" + blockers.join("；") + `。不追高，等回踩 MA10 ${fx(ma[10], 2)} / MA20 ${fx(m20, 2)} 附近企稳再看；已持有的跌破 ${fx(stop, 2)} 止盈止损。`;
    } else if (score <= -25) {
      verdict = "不推荐买入"; cls = "sell";
      action = "趋势和资金都偏弱，已持有的考虑逢反弹减仓" + (support.length ? `；跌破 ${fx(support[0], 2)} 再降一档。` : "。");
    } else {
      verdict = "等待确认"; cls = "wait";
      action = "先观察，等这些条件出现再考虑：" + (wait_for.slice(0, 3).join("、") || "趋势和资金同向") + "。想参与最多小仓位试探，跌破 " + `${fx(stop, 2)} 离场。`;
    }
    const gtxt = Object.entries(groups).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const pos_g = gtxt.filter(([, v]) => v > 3).map(([g]) => g).slice(0, 2);
    const neg_g = gtxt.filter(([, v]) => v < -3).map(([g]) => g).slice(0, 2);
    let reason = [pos_g.length ? "偏多：" + pos_g.join("、") : "", neg_g.length ? "偏空：" + neg_g.join("、") : ""].filter((x) => x).join("；") || "各方面信号都不强";
    reason += `；主力行为：${behavior[0]}`;

    // ---- 图表数据（近 500 根）
    const N = Math.min(500, K.length);
    const sl = (a) => a.slice(K.length - N, K.length);
    const KS = sl(K);
    const keys = ["dif", "dea", "macd", "k", "j", "rsi", "bm", "bu", "bl", "obv", "obv_ma", "mfi", "cmf", "tk", "kj", "ia", "ib", "adx", "pdi", "ndi", "vma5"];
    const chart = { d: KS.map((k) => k.d), o: KS.map((k) => k.o), c: KS.map((k) => k.c), h: KS.map((k) => k.h), l: KS.map((k) => k.l), v: KS.map((k) => k.v) };
    for (const m of [5, 10, 20, 60, 120, 250]) chart["ma" + m] = sl(I.ma[m]).map((x) => rnd(x));
    for (const k of keys) chart[k] = sl(I[k]).map((x) => rnd(x, 4));
    chart.kd = sl(I.d).map((x) => rnd(x, 4)); // KDJ 的 D 线（不能叫 d，d 是日期）
    if (truthy(B)) {
      const bm = new Map(B.map((k) => [k.d, k.c]));
      chart.bench = chart.d.map((d) => (bm.has(d) ? bm.get(d) : null));
    }
    if (truthy(FF)) {
      const fm = new Map(FF.map((x) => [x.d, x]));
      for (const f_ of ["main", "huge", "big", "mid", "small"]) chart["ff_" + f_] = chart.d.map((d) => (fm.has(d) ? rnd(fm.get(d)[f_] / 1e4, 1) : null));
    }

    let dt = (Q || {}).time || ix(K, -1).d;
    if (/^\d{14}$/.test(dt)) dt = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)} ${dt.slice(8, 10)}:${dt.slice(10, 12)}:${dt.slice(12)}`;
    dt = dt.replace(/\//g, "-") + (mk === "us" && dt.includes(":") ? "（美东时间）" : "");
    return {
      sym, limit_up, limit_down: limit_dn, blockers, market: { cn: "A股", us: "美股", hk: "港股" }[mk], name, code, quote: Q,
      data_time: dt, last_bar: ix(K, -1).d, benchmark: bname,
      verdict, cls, score, groups, reason, action,
      behavior: { label: behavior[0], desc: behavior[1] }, items, support: support.slice(0, 3), resist: resist.slice(0, 3), stop,
      returns: { "5日": pct_change(C, 5), "20日": r20, "60日": r60, "120日": pct_change(C, 120), "250日": pct_change(C, 250) },
      rs: { "20日": rs20, "60日": rs60 }, pos52: posn, hi52, lo52,
      fund_flow: ff_summary, chips: chips(K), history: hist, chart, minute: res.m, errors,
    };
  }

  const api = { ACADEMY, ValueError, search, resolve, quote, kline, fund_flow, minute, ticks, analyze, indicators, chips, tech_score_at,
    benchmark_of, em_secid, market_of, _pyFixed: pyFixed, _pySum: pySum, _pyRound: pyRound };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SSEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
