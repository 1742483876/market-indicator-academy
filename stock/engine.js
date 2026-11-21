/* 小七个股透视 · 浏览器版分析引擎（engine.py 的逐函数移植，纯前端运行，不依赖 Python 后台）
 *
 * 数据：腾讯行情（搜索 / 实时 / 复权日K / 分时 / 逐笔）+ 东方财富（A股主力/超大/大/中/小单资金流历史；断连时改用腾讯近20日快照 / 东财数据中心最近一天）。
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

  const FF_NOTE = { // 与 engine.py FF_NOTE 一致：资金流来源与口径（不同来源不拼接历史）
    em: "东方财富口径：按单笔成交额分档，超大单≥100万元、大单20–100万元",
    tx: "腾讯口径（东财接口断连时的备用源）：单笔≥20万元或≥6万股＝主力；只有近20日，超大/大/中/小单只有最近一天；占比按日K估算；与东财口径接近但不相同，不和东财历史拼接",
    dc: "东方财富数据中心（东财行情接口断连时的备用源）：只有最近一个交易日，没有5日/20日",
  };
  async function ff_snap(sym) { // export_ff.py 每天导出的腾讯近 20 日主力（同目录 ff/<代码后两位>.json，万元）
    if (!HAS_DOM || typeof fetch === "undefined") return null;
    const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 13);
    const t = await withTimeout(fetch(`ff/${sym.slice(-2)}.json?h=${day}`).then((r) => (r.ok ? r.json() : null)), 8000);
    const s = t && t.s && t.s[sym];
    if (!s) return null;
    const x = (t.x || {})[sym], W = (v) => (isNone(v) ? null : v * 1e4);
    const rows = [];
    t.d.forEach((d, i) => { if (!isNone(s[i])) rows.push({ d, main: W(s[i]), small: null, mid: null, big: null, huge: null, main_pct: null, src: "tx" }); });
    const lr = rows[rows.length - 1];
    if (lr && x && x[0] === lr.d) Object.assign(lr, { huge: W(x[1]), big: W(x[2]), mid: W(x[3]), small: W(x[4]) });
    return rows.length ? rows : null;
  }
  async function ff_dc(sym) { // 东财数据中心（支持跨域）：只有最近一个交易日的主力/超大/大单
    const sc = sym.slice(2) + "." + sym.slice(0, 2).toUpperCase();
    const u = "https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_DMSK_TS_STOCKNEW&columns=TRADE_DATE,PRIME_INFLOW,SUPERDEAL_INFLOW,SUPERDEAL_OUTFLOW,BIGDEAL_INFLOW,BIGDEAL_OUTFLOW&filter=" +
      encodeURIComponent(`(SECUCODE="${sc}")`);
    const r = (((JSON.parse(await http(u, { timeout: 8000 })).result || {}).data) || [])[0];
    if (!r || isNone(r.PRIME_INFLOW)) return null;
    return [{ d: String(r.TRADE_DATE).slice(0, 10), main: r.PRIME_INFLOW, small: null, mid: null,
      big: r.BIGDEAL_INFLOW - r.BIGDEAL_OUTFLOW, huge: r.SUPERDEAL_INFLOW - r.SUPERDEAL_OUTFLOW, main_pct: null, src: "dc" }];
  }
  async function fund_flow(sym) {
    // A股每日主力资金：东方财富 push2his（近120日，主力/超大/大/中/小单 + 占比）→ 腾讯近20日快照（export_ff.py）→ 东财数据中心（仅最近一天）→ null
    if (market_of(sym) !== "cn") return null;
    const secid = (sym.startsWith("sh") ? "1." : "0.") + sym.slice(2);
    try {
      const rows = await cached("ff:" + sym, 600, async () => {
        const u = "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=0&klt=101&secid=" + secid +
          "&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65";
        const j = JSON.parse(await http(u, { timeout: 6000 }));
        return ((j.data || {}).klines || []).map((line) => {
          const f = line.split(",");
          return { d: f[0], main: fnum(f[1], 0), small: fnum(f[2], 0), mid: fnum(f[3], 0), big: fnum(f[4], 0),
            huge: fnum(f[5], 0), main_pct: fnum(f[6], 0), small_pct: fnum(f[7], 0), mid_pct: fnum(f[8], 0),
            big_pct: fnum(f[9], 0), huge_pct: fnum(f[10], 0) };
        });
      });
      if (rows && rows.length) return rows;
    } catch (e) { /* 换下一个源 */ }
    for (const f of [ff_snap, ff_dc]) {
      try { const rows = await cached(f.name + ":" + sym, 600, () => f(sym)); if (rows && rows.length) return rows; } catch (e) { /* 换下一个源 */ }
    }
    return null;
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

  async function minute5(sym) {
    // 最近 5 个交易日分时（腾讯 day/query），每天带前收 prec；2026-11-20 老大要看前一天的分时
    if (market_of(sym) !== "cn") return null;
    try {
      return await cached("m5:" + sym, 60, async () => {
        const j = JSON.parse(await http(`https://web.ifzq.gtimg.cn/appstock/app/day/query?code=${sym}`));
        const days = (j.data[sym] || {}).data || [];
        return days.map((dd) => {
          const out = []; let pv = 0, pa = 0;
          for (const line of dd.data || []) {
            const f = String(line).trim().split(/\s+/);
            if (f.length < 4) continue;
            const cv = fnum(f[2], 0), ca = fnum(f[3], 0);
            out.push({ t: f[0].slice(0, 2) + ":" + f[0].slice(2), p: fnum(f[1]), v: cv - pv, a: ca - pa, avg: cv ? ca / (cv * 100) : null });
            pv = cv; pa = ca;
          }
          return { date: String(dd.date), prev: fnum(dd.prec), rows: out };
        }).filter((d) => d.rows.length).sort((a, b) => (a.date < b.date ? -1 : 1));
      });
    } catch (e) { return null; }
  }

  const TIERS = [["超大单", 1000000], ["大单", 200000], ["中单", 40000], ["小单", 0]];
  const TPG = new Map(); // 逐笔分页缓存：sym -> {day, pages}；盘中刷新只重拉最后一页及之后（前面的页不会再变）

  async function ticks(sym, { fresh = false } = {}) {
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
    if (fresh) _CACHE.delete("t:" + sym);
    try {
      return await cached("t:" + sym, 60, async () => {
        if (HAS_DOM) root[vname] = undefined;
        const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
        const old = TPG.get(sym);
        const pages = old && old.day === day && old.pages.length ? old.pages.slice(0, old.pages.length - 1) : [];
        let p = pages.length;
        const step = pages.length ? 4 : 12; // 增量时每批 4 页就够
        while (p < 400) {
          const batch = await Promise.all(Array.from({ length: step }, (_, k) => page(p + k)));
          for (const b of batch) { if (b.length) pages.push(b); }
          if (batch.some((b) => b.length === 0)) break;
          p += step;
        }
        TPG.set(sym, { day, pages });
        let q = null;
        try { q = await quote(sym); } catch (e) { q = null; }
        return ticks_from_rows([].concat(...pages), q || {});
      });
    } catch (e) { return null; }
  }

  function ticks_from_rows(rows, q = {}) {
    // 逐笔原始行（"序号/时间/价格/涨跌/手数/金额/B|S|M"）→ 分档统计 + 每分钟时间线 + 分段解读。与 engine.py 的同名函数逐字段一致
    const stats = {};
    for (const [n] of TIERS) stats[n] = { buy: 0.0, sell: 0.0, neutral: 0.0, n_buy: 0, n_sell: 0 };
    const timeline = new Map(), seen = new Set();
    let cum = 0.0, ca = 0.0, cv = 0.0, open_p = null, last_p = null;
    for (const r of rows) {
      const f = r.split("/");
      if (f.length < 7 || seen.has(f[0])) continue;
      seen.add(f[0]);
      const t5 = f[1].slice(0, 5);
      const amt = fnum(f[5], 0), side = f[6], tm = t5 < "15:00" ? t5 : "15:00"; // 15:00 之后的盘后成交并到 15:00
      const px = fnum(f[2]), vol = fnum(f[4], 0);
      const tier = (TIERS.find(([, th]) => amt >= th) || TIERS[3])[0];
      const s = stats[tier];
      if (side === "B") { s.buy += amt; s.n_buy += 1; } else if (side === "S") { s.sell += amt; s.n_sell += 1; } else s.neutral += amt;
      if ((tier === "超大单" || tier === "大单") && (side === "B" || side === "S")) cum += side === "B" ? amt : -amt;
      ca += amt; cv += vol;
      if (px) { last_p = px; if (open_p === null) open_p = px; }
      timeline.set(tm, { t: tm, cum, p: last_p, a: ca, vwap: cv ? ca / (cv * 100) : null });
    }
    const total = pySum(Object.values(stats).map((v) => v.buy + v.sell + v.neutral)) || 1;
    const table = TIERS.map(([n]) => {
      const s = stats[n];
      return { tier: n, buy: s.buy, sell: s.sell, net: s.buy - s.sell, n_buy: s.n_buy, n_sell: s.n_sell, share: (s.buy + s.sell + s.neutral) / total * 100 };
    });
    const main_net = pySum(table.slice(0, 2).map((r) => r.net));
    const tl = [...timeline.keys()].sort().map((k) => timeline.get(k));
    const prev = isNone(q.prev) ? null : q.prev, lu = isNone(q.limit_up) ? null : q.limit_up, ld = isNone(q.limit_down) ? null : q.limit_down;
    const seg = tick_segments(tl, open_p, prev, lu, ld, total);
    return { n: seen.size, total, table, main_net, main_share: table[0].share + table[1].share,
      timeline: tl, open: open_p, last: last_p, prev, limit_up: lu, limit_down: ld,
      last_t: tl.length ? tl[tl.length - 1].t : null, closed: !!tl.length && tl[tl.length - 1].t >= "15:00", segs: seg.segs, read: seg.read };
  }

  // ---- 逐笔分段：把一天切成几段，每段判定「价格 × 大单」状态（阈值都是相对量，与 engine.py 相同） ----
  const SEG_WIN = 15, SEG_MAX = 6, TH_PRICE = 0.15, TH_FLOW = 0.04, SEAL_FRAC = 0.6;
  const SEG_STATE = { push: ["资金推升", "推升", 2], dump: ["拉高出货⚠️", "出货⚠", -2], absorb: ["低位承接", "承接", 1], flee: ["资金出逃", "出逃", -2],
    wait: ["震荡/观望", "观望", 0], seal_up: ["涨停封板", "封板", 1], seal_dn: ["跌停", "跌停", -2] };
  const SEG_SHORT = { "横盘吸筹": "吸筹", "横盘派发⚠️": "派发⚠" }; // 图上短标签（变体）
  const SEG_RULES = `每 ${SEG_WIN} 个交易分钟一个窗口；价格变化 ≥ 当日振幅 ${fx(TH_PRICE * 100, 0)}% 算涨/跌，大单净额 ≥ 该段成交额 ${fx(TH_FLOW * 100, 0)}% 算净买/卖；` +
    `相邻同类合并，不足 30 分钟的并入相邻段，最多 ${SEG_MAX} 段；≥${fx(SEAL_FRAC * 100, 0)}% 时间停在涨停/跌停价的段单独标封板`;
  const SEG_MAP = { "1,1": ["push", "资金推升"], "1,-1": ["dump", "拉高出货⚠️"], "-1,1": ["absorb", "低位承接"], "-1,-1": ["flee", "资金出逃"],
    "0,1": ["absorb", "横盘吸筹"], "0,-1": ["dump", "横盘派发⚠️"], "1,0": ["wait", "上涨·大单观望"], "-1,0": ["wait", "下跌·大单观望"], "0,0": ["wait", "震荡/观望"] };
  function _tidx(t) {
    const x = parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
    if (x < 780) return Math.max(0, Math.min(x - 570, 119));
    return 120 + Math.max(0, Math.min(x - 780, 119));
  }
  function _tname(i, end = false) {
    const x = i < 120 || (end && i === 120) ? 570 + i : 780 + i - 120;
    return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0");
  }
  const _wan = (x, sign = true) => {
    const s = Math.abs(x) >= 1e8 ? fx(Math.abs(x) / 1e8, 2) + "亿" : fx(Math.abs(x) / 1e4, 0) + "万";
    return sign ? (x >= 0 ? "+" : "−") + s : s;
  };
  const _px = (p) => (isNone(p) ? "—" : p < 10 ? fx(p, 3) : fx(p, 2));

  function tick_segments(tl, open_p, prev, lu, ld, total) {
    if (tl.length < 5 || !open_p) return { segs: [], read: null };
    const ref = prev || open_p;
    const ps = tl.filter((r) => r.p).map((r) => r.p).concat([open_p]);
    const hi = maxOf(ps), lo = minOf(ps);
    const R = Math.max(hi - lo, ref * 0.005);
    const first = tl[0];
    const st0 = first.t < "09:30" ? [first.p, first.cum, first.a] : [open_p, 0.0, 0.0]; // 集合竞价那一笔不算进第一段
    const W = [];
    tl.forEach((r, i) => {
      if (r.t < "09:30" && i === 0) return;
      const k = Math.floor(_tidx(r.t) / SEG_WIN);
      const sl = !!lu && !isNone(r.p) && r.p >= lu - 0.0015 ? 1 : 0;
      const sd = !!ld && !isNone(r.p) && r.p <= ld + 0.0015 ? 1 : 0;
      const w = W[W.length - 1];
      if (w && w.k1 === k) { w.e = [r.p, r.cum, r.a]; w.n += 1; w.lu += sl; w.ld += sd; w.t_last = r.t; }
      else W.push({ k0: k, k1: k, nw: 1, s: w ? w.e : st0, e: [r.p, r.cum, r.a], n: 1, lu: sl, ld: sd, t_last: r.t });
    });
    if (!W.length) return { segs: [], read: null };
    const classify = (w) => {
      const dp = w.e[0] - w.s[0], dc = w.e[1] - w.s[1], A = w.e[2] - w.s[2];
      const rp = dp / R, rc = A > 0 ? dc / A : 0.0;
      Object.assign(w, { dp, dc, A, rp, rc });
      if (lu && w.lu >= SEAL_FRAC * w.n) { w.cls = "seal_up"; w.label = "涨停封板（大单卖出偏多属正常）"; return w; }
      if (ld && w.ld >= SEAL_FRAC * w.n) { w.cls = "seal_dn"; w.label = "跌停（大单买入偏多也属正常）"; return w; }
      const pd = rp >= TH_PRICE ? 1 : rp <= -TH_PRICE ? -1 : 0;
      const fd = rc >= TH_FLOW ? 1 : rc <= -TH_FLOW ? -1 : 0;
      [w.cls, w.label] = SEG_MAP[pd + "," + fd];
      return w;
    };
    const merge = (a, b) => classify({ k0: a.k0, k1: b.k1, nw: a.nw + b.nw, s: a.s, e: b.e, n: a.n + b.n, lu: a.lu + b.lu, ld: a.ld + b.ld, t_last: b.t_last });
    const S = W.map(classify);
    for (let it = 0; it < 200; it++) {
      let j = 0;
      while (j < S.length - 1) { if (S[j].cls === S[j + 1].cls) S.splice(j, 2, merge(S[j], S[j + 1])); else j += 1; }
      const short = S.map((s, i) => i).filter((i) => S[i].nw < 2 && !S[i].cls.startsWith("seal"));
      const cand = short.length && S.length > 1 ? short : (S.length > SEG_MAX ? S.map((s, i) => i) : []);
      if (!cand.length) break;
      let i = cand[0];
      for (const c of cand) if (S[c].nw < S[i].nw || (S[c].nw === S[i].nw && S[c].A < S[i].A)) i = c;
      let best = null;
      for (const j2 of [i - 1, i + 1]) {
        if (j2 < 0 || j2 >= S.length) continue;
        const m = merge(S[Math.min(i, j2)], S[Math.max(i, j2)]);
        const o = [m.cls === S[j2].cls ? 0 : 1, S[j2].A, j2, m];
        if (!best || o[0] < best[0] || (o[0] === best[0] && (o[1] < best[1] || (o[1] === best[1] && o[2] < best[2])))) best = o;
      }
      const j3 = best[2];
      S.splice(Math.min(i, j3), Math.abs(i - j3) + 1, best[3]);
    }
    const segs = S.map((s, n) => {
      let t1 = _tname((s.k1 + 1) * SEG_WIN, true);
      if (n === S.length - 1 && s.t_last < t1) t1 = s.t_last;
      return { t0: _tname(s.k0 * SEG_WIN), t1, cls: s.cls, label: s.label, short: SEG_SHORT[s.label] || SEG_STATE[s.cls][1],
        p0: s.s[0], p1: s.e[0], dp_pct: s.dp / ref * 100, dc: s.dc, amt: s.A, rc_pct: s.rc * 100 };
    });
    return { segs, read: _seg_read(tl, segs, ref, hi, lo, total, lu, ld, classify) };
  }

  function _seg_read(tl, segs, ref, hi, lo, total, lu, ld, classify) {
    const last = tl[tl.length - 1], cur = segs[segs.length - 1];
    const cums = tl.map((r) => r.cum);
    let pk = 0, tr = 0;
    cums.forEach((c, i) => { if (c > cums[pk]) pk = i; if (c < cums[tr]) tr = i; });
    const peak = cums[pk], trough = cums[tr], cum = last.cum, p = last.p, vw = last.vwap || last.p;
    const closed = last.t >= "15:00";
    const pos = hi > lo ? (p - lo) / (hi - lo) : 0.5;
    const swing = peak - trough, meaningful = swing >= 0.015 * total;
    let div = null;
    const seal = cur.cls.startsWith("seal");
    if (seal) { /* 封板时大单方向失真，不判背离 */ }
    else if (pos >= 0.75 && meaningful && cum <= peak - 0.3 * swing && pk < tl.length - 1) div = "top";
    else if (pos <= 0.25 && meaningful && cum >= trough + 0.3 * swing && tr < tl.length - 1) div = "bottom";
    let j = tl.length - 1;
    while (j > 0 && _tidx(tl[j - 1].t) > _tidx(last.t) - SEG_WIN) j -= 1;
    const rb = j > 0 ? tl[j - 1] : null;
    let recent = null;
    if (rb !== null && j < tl.length - 1) {
      const w = classify({ k0: 0, k1: 0, nw: 1, s: [rb.p, rb.cum, rb.a], e: [p, cum, last.a], n: tl.length - j, lu: 0, ld: 0, t_last: last.t });
      recent = { t0: rb.t, t1: last.t, cls: w.cls, label: w.label, dp_pct: w.dp / ref * 100, dc: w.dc, rc_pct: w.rc * 100 };
    }
    let score = SEG_STATE[cur.cls][2];
    const mr = total ? cum / total : 0;
    score += mr >= 0.03 ? 1 : mr <= -0.03 ? -1 : 0;
    score += p > vw * 1.002 ? 1 : p < vw * 0.998 ? -1 : 0;
    score += div === "top" ? -1 : div === "bottom" ? 1 : 0;
    let bias = score >= 2 ? "偏多" : score <= -2 ? "偏空" : "中性";
    if (seal) bias = cur.cls === "seal_up" ? "偏多" : "偏空";
    const lim = cur.cls === "seal_up" ? lu : ld;
    const hit = seal ? tl.map((r, i) => i).filter((i) => !isNone(tl[i].p) && Math.abs(tl[i].p - lim) <= 0.0015) : [];
    const opened = hit.length ? tl.slice(hit[0]).filter((r) => Math.abs(r.p - lim) > 0.0015).length : 0;
    const V = _px(vw), P = _wan(peak), L = _px(lo), H = _px(hi);
    const story = segs.map((s) => `${s.t0}–${s.t1} ${s.label}`).join(" → ");
    const lines = [`${cur.t0}–${cur.t1}「${cur.label}」：价格 ${sx(cur.dp_pct, 2)}%，大单净${cur.dc >= 0 ? "买" : "卖"} ${_wan(cur.dc, false)}（占这段成交 ${sx(cur.rc_pct, 0)}%）`,
      `大单累计 ${_wan(cum)}（今天最高 ${P}，在 ${tl[pk].t}）；现价 ${_px(p)}（${sx((p / ref - 1) * 100, 2)}%）${p >= vw ? "高于" : "低于"}均价线 ${V}`];
    if (div === "top") lines.push(`⚠️ 价格还在今天高位，但大单累计已从最高 ${P} 回落到 ${_wan(cum)}——价格主要靠中小单撑着，大资金在边拉边卖`);
    else if (div === "bottom") lines.push(`价格在今天低位，但大单累计已从最低 ${_wan(trough)} 回升到 ${_wan(cum)}——下面有大资金在接`);
    if (seal) {
      lines.push((cur.cls === "seal_up" ? "涨停时想买的人排队买不到，成交几乎都是卖方主动砸给排队买单，所以大单显示「净卖」是正常的，不代表出货。"
        : "跌停时想卖的人排队卖不掉，成交几乎都是买方主动去接，所以大单显示「净买」也不代表有人抄底。") +
        (opened ? `今天${cur.cls === "seal_up" ? "封板" : "跌停"}后又打开过 ${opened} 分钟${opened >= 10 ? "（反复开板＝分歧大）" : ""}。` : "封住后没有打开过。"));
    }
    if (recent && recent.cls !== cur.cls && !closed) lines.push(`最近 15 分钟（${recent.t0}–${recent.t1}）转为「${recent.label}」：价格 ${sx(recent.dp_pct, 2)}%，大单 ${_wan(recent.dc)}`);
    const c = cur.cls;
    let up, dn;
    if (c === "seal_up") [up, dn] = ["封到收盘、尾盘不开板 → 强势延续（次日仍要防高开低走）", "开板后大单累计快速往下走 → 炸板出货，别追"];
    else if (c === "seal_dn") [up, dn] = ["跌停打开且大单累计明显回升 → 有资金抄底，但别急着抢", "跌停封死、大单持续卖 → 下一个交易日容易还有下跌惯性"];
    else if (bias === "偏多") [up, dn] = [`大单累计继续创新高（超过 ${P}）且价格${p >= vw ? "守在" : "重新站上"}均价线 ${V} 上方 → 推升延续`, `${p >= vw ? "跌破" : "一直站不回"}均价线 ${V} 且大单累计掉头向下 → 推升失败，不追高，持有的减仓`];
    else if (bias === "偏空" && c === "flee") [up, dn] = [`大单累计止跌回升、价格重新站上均价线 ${V} → 抛压缓解`, `跌破今天低点 ${L} 且大单继续净卖 → 下跌延续，别急着抄底`];
    else if (bias === "偏空") [up, dn] = [`大单累计重新创新高（超过 ${P}）并站稳均价线 ${V} → 只是洗盘，恢复推升`, `价格${p >= vw ? "跌破" : "反抽站不回"}均价线 ${V} 且大单累计继续走低 → 出货确认，持有的减仓`];
    else [up, dn] = [`大单累计创新高（超过 ${P}）并站上均价线 ${V}、突破今天高点 ${H} → 转强`, `跌破均价线 ${V} / 今天低点 ${L} 且大单转为净卖 → 转弱`];
    return { asof: last.t, closed, cls: c, label: cur.label, bias, score, div, price: p, vwap: vw, cum, peak, peak_t: tl[pk].t, trough, trough_t: tl[tr].t,
      story, lines, up, down: dn, recent, rules: SEG_RULES };
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
  const GMMA_S = [3, 5, 8, 10, 12, 15], GMMA_L = [30, 35, 40, 45, 50, 60];

  function indicators(K) {
    const C = K.map((k) => k.c), H = K.map((k) => k.h), L = K.map((k) => k.l), V = K.map((k) => k.v);
    const n = C.length;
    const I = { ma: {} };
    for (const m of [5, 10, 20, 60, 120, 250]) I.ma[m] = sma(C, m);
    I.gmma = {};
    for (const m of GMMA_S.concat(GMMA_L)) I.gmma[m] = ema(C, m); // 顾比均线：短组 6 条 + 长组 6 条收盘价 EMA
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

  // ======================= 个股页大结论：组合视角（v2，已回测）＋ 趋势视角（六组打分） =======================
  // 回测（stockscope/verdict_lab.py）：A股上六组打分越高、之后 20 日反而越弱，所以趋势打分不再单独给「可以考虑买入」，只有进了 v2 分散组合前 N 名的才给。
  const US_BASIS = "美股/港股：这套趋势打分没有做过全市场回测（A股上同一套打分之后反而跑输股票池），结论只作参考。";
  let V2P = null;
  function v2_table() { // export_picks.py 每天生成的 v2 全市场排名（和本文件同目录的 v2_rank_cn.json）；拿不到返回 null
    if (!V2P) {
      const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 13);
      V2P = (typeof fetch === "undefined" || !HAS_DOM ? Promise.resolve(null)
        : withTimeout(fetch(`v2_rank_cn.json?h=${day}`).then((r) => (r.ok ? r.json() : null)), 10000))
        .catch(() => null).then((t) => { if (!t) V2P = null; return t; });
    }
    return V2P;
  }
  function unify(mk, sym, score, tech, stop, V2T) { // 返回 [verdict, cls, action, views, basis]，与 engine.py 的 unify 逐字段一致
    const tl = score >= 35 ? "偏多" : score <= -25 ? "偏空" : "中性";
    const sd = (x) => (x >= 0 ? "+" : "") + x; // {score:+d}
    const BT = (V2T || {}).bt || {};
    if (mk !== "cn") {
      const trend = { label: tl, score, verdict: tech[0], cls: tech[1], text: `趋势视角（短线参考，未做全市场回测）：${tl}（综合分 ${sd(score)}）` };
      return [tech[0], tech[1], tech[2], { v2: null, trend }, US_BASIS];
    }
    const trend = { label: tl, score, verdict: tech[0], cls: tech[1], text: `趋势视角（短线参考，回测：${BT.trend_short || "偏多之后反而跑输"}）：${tl}（综合分 ${sd(score)}）` };
    const top = (V2T || {}).top || 20, buf = 2 * top;
    const e = V2T && V2T.rank ? V2T.rank[sym] : null;
    const rank = e ? e[0] : null;
    const in_top = !!(rank && rank <= top), in_buf = !!(rank && top < rank && rank <= buf);
    let vt;
    if (!V2T) vt = "组合视角（v2 因子，已回测）：今天的组合名次没取到，先按「不在组合里」处理";
    else if (isNone(rank)) {
      const why = (V2T.out || {})[sym];
      vt = why ? `组合视角（v2 因子，已回测）：不在 v2 股票池 ❌（${why}；股票池只排市值前 1000、上市满一年、日均成交额≥1亿的股票）`
        : `组合视角（v2 因子，已回测）：不在 v2 股票池 ❌（只排市值前 1000、上市满一年、日均成交额≥1亿的股票，${V2T.date}）`;
    }
    else vt = `组合视角（v2 因子，已回测）：全市场第 ${rank} 名 / ${V2T.pool} 只（${V2T.date} 收盘）｜前 ${top} 入选 ${in_top ? "✅" : "❌"}` + (in_buf ? `（第 ${top + 1}–${buf} 名是缓冲区）` : "");
    const v2 = { rank, score: e ? e[1] : null, pool: (V2T || {}).pool ?? null, top, date: (V2T || {}).date ?? null, in_top, in_buf, ok: !!V2T, text: vt };
    const cap = (V2T || {}).cap;
    const w = cap ? +pyFixed(cap * 100 / top, 1) : 5; // round(x, 1)；{w:g} 去掉多余的 0
    let verdict, cls, action;
    if (in_top) {
      verdict = `可以考虑买入（分散组合的一只，单只≤${w}%）`; cls = "buy";
      action = `它是 v2 分散组合（每月调仓、一篮子 ${top} 只）的第 ${rank} 名：要买就按组合一起分散买，单只不超过总资金 ${w}%` +
        (cap ? `（仓位上限 ${fx(cap * 100, 0)}% ÷ ${top}）` : "") + `，别单押这一只；拿到下次调仓日，跌出前 ${buf} 名再卖。` +
        (tl === "偏空" ? "趋势视角偏空不用慌：组合挑的就是最近跌过、走得平淡的股票，回测里入选股中趋势偏空的那部分并不比其他入选股差。" : "");
    } else if (in_buf) {
      verdict = "等待确认"; cls = "wait";
      action = `排在组合第 ${rank} 名：前 ${top} 名才新买，第 ${top + 1}–${buf} 名是缓冲区——已经按组合持有的继续拿，没持有的不新买，等下次调仓再看名次。`;
    } else if (score <= -25) {
      verdict = "不推荐买入"; cls = "sell";
      action = "不在 v2 组合里，趋势也偏弱：没有经过回测的买入理由。" + (tech[1] === "sell" ? tech[2] : "");
    } else if (score >= 35) {
      verdict = "等待确认"; cls = "wait";
      action = `趋势好，但它不在 v2 组合里，而历史上追涨没有超额（${BT.trend_buy || "回测里趋势强的股票之后反而跑输"}）。想参与只用小仓位、当短线看，跌破 ${fx(stop, 2)} 离场。`;
    } else {
      verdict = "等待确认"; cls = "wait";
      action = `不在 v2 组合里、趋势也不明确：没有经过回测的买入理由，先观察；已持有的跌破 ${fx(stop, 2)} 离场。`;
    }
    return [verdict, cls, action, { v2, trend }, BT.basis || ""];
  }

  async function analyze(sym) {
    const mk = market_of(sym);
    const [bsym, bname] = benchmark_of(sym);
    const jobs = [["q", () => quote(sym)], ["k", () => kline(sym)], ["b", () => kline(bsym, 400, "")], ["ff", () => fund_flow(sym)], ["m", () => minute(sym)]];
    const LABEL = { q: "实时行情", k: "日K", b: "基准指数", ff: "资金流", m: "分时" };
    const v2p = mk === "cn" ? v2_table() : Promise.resolve(null);
    const settled = await Promise.allSettled(jobs.map(([, fn]) => withTimeout(fn(), 20000)));
    const res = {}, errors = [];
    res.v2 = await v2p;
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
    let FF = res.ff;
    let behavior = null, ff_summary = null;
    if (mk === "cn" && truthy(FF)) {
      const src = ix(FF, -1).src || "em";
      if (src !== "em") { // 备用源没有占比：主力净额 ÷（日K成交量×100股×当天 OHLC 均价）估算
        const km = new Map(K.slice(-60).map((k) => [k.d, k.v * 100 * (k.o + k.h + k.l + k.c) / 4]));
        FF = FF.map((r) => ({ ...r, main_pct: isNone(r.main_pct) && km.get(r.d) ? r.main / km.get(r.d) * 100 : (r.main_pct || 0) }));
        res.ff = FF;
      }
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
      const sm = (k) => pySum(FF.slice(-5).filter((x) => !isNone(x[k])).map((x) => x[k]));
      ff_summary = { last, sum5: s5, sum20: s20, pct5: p5, pct20: p20, streak: streak * sign,
        huge5: sm("huge"), big5: sm("big"), mid5: sm("mid"), small5: sm("small"), src, n: FF.length, note: FF_NOTE[src] };
      item("资金", "主力净流入（超大+大单）", `今日 ${sx(last.main / 1e8, 2)}亿（${sx(last.main_pct, 1)}%）｜5日 ${sx(s5 / 1e8, 2)}亿｜20日 ${sx(s20 / 1e8, 2)}亿`,
        `连续${Math.abs(streak)}日${sign > 0 ? "流入" : "流出"}`, clamp(pyRound(p5 * 1.5 + p20 * 2.5), -15, 15),
        FF_NOTE[src]);
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
      errors.push("资金流未获取（东财、腾讯快照、东财数据中心都没拿到）");
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
    const tech_verdict = verdict, tech_cls = cls;
    let views, basis;
    [verdict, cls, action, views, basis] = unify(mk, sym, score, [verdict, cls, action], stop, res.v2);

    // ---- 图表数据（近 500 根）
    const N = Math.min(500, K.length);
    const sl = (a) => a.slice(K.length - N, K.length);
    const KS = sl(K);
    const keys = ["dif", "dea", "macd", "k", "j", "rsi", "bm", "bu", "bl", "obv", "obv_ma", "mfi", "cmf", "tk", "kj", "ia", "ib", "adx", "pdi", "ndi", "vma5"];
    const chart = { d: KS.map((k) => k.d), o: KS.map((k) => k.o), c: KS.map((k) => k.c), h: KS.map((k) => k.h), l: KS.map((k) => k.l), v: KS.map((k) => k.v) };
    for (const m of [5, 10, 20, 60, 120, 250]) chart["ma" + m] = sl(I.ma[m]).map((x) => rnd(x));
    chart.gmma = {};
    for (const m of GMMA_S.concat(GMMA_L)) chart.gmma[String(m)] = sl(I.gmma[m]).map((x) => rnd(x));
    for (const k of keys) chart[k] = sl(I[k]).map((x) => rnd(x, 4));
    chart.kd = sl(I.d).map((x) => rnd(x, 4)); // KDJ 的 D 线（不能叫 d，d 是日期）
    if (truthy(B)) {
      const bm = new Map(B.map((k) => [k.d, k.c]));
      chart.bench = chart.d.map((d) => (bm.has(d) ? bm.get(d) : null));
    }
    if (truthy(FF)) {
      const fm = new Map(FF.map((x) => [x.d, x]));
      for (const f_ of ["main", "huge", "big", "mid", "small"]) chart["ff_" + f_] = chart.d.map((d) => (fm.has(d) && !isNone(fm.get(d)[f_]) ? rnd(fm.get(d)[f_] / 1e4, 1) : null));
    }

    let dt = (Q || {}).time || ix(K, -1).d;
    if (/^\d{14}$/.test(dt)) dt = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)} ${dt.slice(8, 10)}:${dt.slice(10, 12)}:${dt.slice(12)}`;
    dt = dt.replace(/\//g, "-") + (mk === "us" && dt.includes(":") ? "（美东时间）" : "");
    return {
      sym, limit_up, limit_down: limit_dn, blockers, market: { cn: "A股", us: "美股", hk: "港股" }[mk], name, code, quote: Q,
      data_time: dt, last_bar: ix(K, -1).d, benchmark: bname,
      verdict, cls, score, groups, reason, action,
      views, basis, tech_verdict, tech_cls,
      behavior: { label: behavior[0], desc: behavior[1] }, items, support: support.slice(0, 3), resist: resist.slice(0, 3), stop,
      returns: { "5日": pct_change(C, 5), "20日": r20, "60日": r60, "120日": pct_change(C, 120), "250日": pct_change(C, 250) },
      rs: { "20日": rs20, "60日": rs60 }, pos52: posn, hi52, lo52,
      fund_flow: ff_summary, chips: chips(K), history: hist, chart, minute: res.m, errors,
      kfull: { d: K.map((k) => k.d), o: K.map((k) => k.o), h: K.map((k) => k.h), l: K.map((k) => k.l), c: K.map((k) => k.c), v: K.map((k) => k.v) }, // 买卖点标注（mp_rules.js）用全部日K
    };
  }

  // ======================= 图上白话标注（只用 analyze 的返回值计算，后台模式和纯静态模式都由前端调用） =======================
  function runs(states, minLen) { // 连续同状态区段：[{i0, i1, s}]，s=0 的不要
    const out = [];
    let i0 = 0;
    for (let i = 1; i <= states.length; i++) {
      if (i === states.length || states[i] !== states[i0]) {
        if (states[i0] && i - i0 >= minLen) out.push({ i0, i1: i - 1, s: states[i0] });
        i0 = i;
      }
    }
    return out;
  }
  function chart_notes(a) {
    const C = a.chart, n = C.d.length, N = {};
    const last = n - 1, c = C.c[last];
    const pp = (x) => (isNone(x) ? "—" : x < 10 ? fx(x, 3) : fx(x, 2));
    // ---- 日K：均线排列区段 + 放量突破/破位 + 支撑压力
    const ma = C.d.map((_, i) => {
      const v = [C.ma5[i], C.ma10[i], C.ma20[i], C.ma60[i]];
      if (v.some(isNone)) return 0;
      return v[0] > v[1] && v[1] > v[2] && v[2] > v[3] ? 1 : v[0] < v[1] && v[1] < v[2] && v[2] < v[3] ? -1 : 0;
    });
    const zones = runs(ma, 5).map((z) => ({ ...z, d0: C.d[z.i0], d1: C.d[z.i1], label: z.s > 0 ? "多头排列" : "空头排列" }));
    const marks = [];
    for (let i = Math.max(21, n - 120); i < n; i++) {
      const hh = maxOf(C.h.slice(i - 20, i)), ll = minOf(C.l.slice(i - 20, i)), vm = C.vma5[i - 1];
      if (!vm || C.v[i] < 1.5 * vm) continue;
      if (C.c[i] > hh) marks.push({ i, d: C.d[i], p: C.h[i], kind: "up", label: "放量突破" });
      else if (C.c[i] < ll) marks.push({ i, d: C.d[i], p: C.l[i], kind: "dn", label: "放量破位" });
    }
    const mk = marks.slice(-4);
    let run = 0;
    for (let i = last; i >= 0 && ma[i] === ma[last]; i--) run++;
    const sup = a.support[0], res = a.resist[0];
    const lastMk = mk.length ? mk[mk.length - 1] : null;
    const kRead = [
      ma[last] > 0 ? `均线多头排列（MA5>MA10>MA20>MA60）已 ${run} 天，趋势向上` : ma[last] < 0 ? `均线空头排列已 ${run} 天，趋势向下，反弹先看成压力` : "均线纠缠（没有排好队），处在震荡或转折中",
      `现价 ${pp(c)} 在 MA20（${pp(C.ma20[last])}）${c >= C.ma20[last] ? "上方" : "下方"}、MA60（${pp(C.ma60[last])}）${c >= C.ma60[last] ? "上方" : "下方"}`,
      lastMk ? `最近一次${lastMk.label}：${lastMk.d}（${n - 1 - lastMk.i === 0 ? "就是今天" : (n - 1 - lastMk.i) + " 个交易日前"}）` : "近 120 天没有放量突破 / 破位",
      `上方压力 ${res ? pp(res) + `（${sx((res / c - 1) * 100, 1)}%）` : "—"}，下方支撑 ${sup ? pp(sup) + `（${sx((sup / c - 1) * 100, 1)}%）` : "—"}`,
    ];
    N.k = { zones, marks: mk, support: sup, resist: res, read: kRead.join("；") + "。" };
    // ---- 主力资金：连续流入/流出区段
    if (C.ff_main) {
      const idx = C.d.map((_, i) => i).filter((i) => !isNone(C.ff_main[i]));
      const st = idx.map((i) => (C.ff_main[i] > 0 ? 1 : C.ff_main[i] < 0 ? -1 : 0));
      const fz = runs(st, 3).map((z) => ({ d0: C.d[idx[z.i0]], d1: C.d[idx[z.i1]], s: z.s, len: z.i1 - z.i0 + 1, label: `连续${z.s > 0 ? "流入" : "流出"}${z.i1 - z.i0 + 1}天` }));
      const F = a.fund_flow;
      let today = null;
      if (F && idx.length > 1) {
        const i = idx[idx.length - 1], up = C.c[i] > C.c[i - 1], inflow = C.ff_main[i] > 0;
        today = up && !inflow ? "pump_dump" : !up && inflow ? "absorb" : up && inflow ? "push" : "flee";
      }
      const TN = { pump_dump: "价涨＋主力净流出（日级「拉高出货」）", absorb: "价跌＋主力净流入（日级「低位承接」）", push: "价涨＋主力净流入（资金推升）", flee: "价跌＋主力净流出（资金出逃）" };
      N.ff = { zones: fz, today, today_name: today ? TN[today] : null,
        read: F ? `主力（超大＋大单）${Math.abs(F.streak)} 天连续净${F.streak > 0 ? "流入" : "流出"}；近 5 日 ${sx(F.sum5 / 1e8, 2)}亿、近 20 日 ${sx(F.sum20 / 1e8, 2)}亿` +
          (today ? `；今天属于「${TN[today]}」` : "") + "。" : null };
    }
    // ---- 相对强弱：20 日相对涨跌 ≥2pct 记为跑赢/跑输，连续 ≥10 天成段
    if (C.bench) {
      const rr = C.c.map((x, i) => (isNone(C.bench[i]) ? null : x / C.bench[i]));
      const st = rr.map((x, i) => {
        if (i < 20 || isNone(x) || isNone(rr[i - 20])) return 0;
        const g = (x / rr[i - 20] - 1) * 100;
        return g >= 2 ? 1 : g <= -2 ? -1 : 0;
      });
      const i0 = C.bench.findIndex((x) => !isNone(x));
      const rz = runs(st, 10).filter((z) => z.i0 >= i0).map((z) => ({ d0: C.d[z.i0], d1: C.d[z.i1], s: z.s, label: z.s > 0 ? "跑赢" : "跑输" }));
      const r20 = a.rs["20日"], r60 = a.rs["60日"];
      N.rs = { zones: rz, read: isNone(r20) ? null : `近 20 日${r20 >= 0 ? "跑赢" : "跑输"}${a.benchmark} ${fx(Math.abs(r20), 1)} 个百分点，近 60 日${r60 >= 0 ? "跑赢" : "跑输"} ${fx(Math.abs(r60 || 0), 1)} 个百分点` +
        (r20 >= 0 && r60 >= 0 ? "——强于大盘，资金更愿意待在这里" : r20 < 0 && r60 < 0 ? "——一直弱于大盘，就算大盘涨它也未必跟" : r20 >= 0 ? "——最近开始转强" : "——最近开始转弱") + "。" };
    }
    // ---- 筹码
    const H = a.chips;
    if (H) {
      const price = c, b = H.band90, pos = b[1] > b[0] ? (price - b[0]) / (b[1] - b[0]) * 100 : 50;
      const above = H.bins.filter((x) => x.p > price), below = H.bins.filter((x) => x.p <= price);
      const pk = (xs) => (xs.length ? xs.reduce((m, x) => (x.v > m.v ? x : m)) : null);
      const pa = pk(above), pb = pk(below);
      N.chips = { read: `获利盘 ${fx(H.profit_pct, 0)}%：现价 ${pp(price)} 比平均成本 ${pp(H.avg_cost)} ${price >= H.avg_cost ? "高" : "低"} ${fx(Math.abs(price / H.avg_cost - 1) * 100, 1)}%，` +
        `在 90% 筹码区间（${pp(b[0])}–${pp(b[1])}）的${pos >= 70 ? "上沿" : pos <= 30 ? "下沿" : "中部"}。` +
        (H.profit_pct >= 80 ? "多数人赚钱，再涨容易有人止盈。" : H.profit_pct <= 20 ? "多数人被套，反弹到成本区会有解套卖压。" : "") +
        (pa ? `上方筹码最密的价位 ≈ ${pp(pa.p)}（压力）` : "上方几乎没有套牢盘") + (pb ? `，下方 ≈ ${pp(pb.p)}（支撑）。` : "。") };
    }
    // ---- CMF / MFI（美股港股）
    const cm = C.cmf[last], mf = C.mfi[last];
    if (!isNone(cm)) N.cmf = { read: `CMF ${sx(cm, 3)}（${cm > 0.05 ? "资金净流入" : cm < -0.05 ? "资金净流出" : "进出平衡"}），MFI ${isNone(mf) ? "—" : fx(mf, 0)}（${isNone(mf) ? "" : mf > 80 ? "过热，别追" : mf < 20 ? "超卖，可能有反弹" : "中性"}）。` };
    return N;
  }

  const api = { ACADEMY, ValueError, unify, v2_table, _setV2: (t) => { V2P = Promise.resolve(t); }, search, resolve, quote, kline, fund_flow, minute, minute5, ticks, ticks_from_rows, tick_segments, SEG_STATE, chart_notes, analyze, indicators, chips, tech_score_at,
    benchmark_of, em_secid, market_of, _pyFixed: pyFixed, _pySum: pySum, _pyRound: pyRound };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SSEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
