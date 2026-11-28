/* 相似走势检索 #/analog（学堂）+ 个股站个股页「🔍 相似走势」共用。
   历史库：analog/<code>.bin（analog.py --build 生成，gzip，5 分钟一个点）；当天走势：浏览器直接取腾讯分时（允许跨域）；日 K：腾讯日 K（允许跨域）。
   相似度公式与 analog.py 完全一致（tools/analog_parity.cjs 自检）。 */
(function () {
  // ==================== 引擎（纯函数） ====================
  const WT = { e: 0.45, c: 0.25, g: 0.10, w: 0.20, v: 0.15 };
  const mktOf = (c) => (c.startsWith("hk") ? "hk" : c.startsWith("us") ? "us" : "cn");
  const NPT = { cn: 48, hk: 66, us: 78 };
  function labels(m) {
    const seg = m === "cn" ? [[570, 24], [780, 24]] : m === "hk" ? [[570, 30], [780, 36]] : [[570, 78]];
    const out = [seg[0][0]];
    seg.forEach(([s, n]) => { for (let i = 0; i < n; i++) out.push(s + 5 * (i + 1)); });
    return out.map((x) => String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"));
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const std0 = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length); };
  const std1 = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / Math.max(1, a.length - 1)); };
  const median = (a) => { const b = a.slice().sort((x, y) => x - y), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
  function wq(a, p) { // (n+1)p 位置插值（weibull），和 numpy 一致
    const b = a.slice().sort((x, y) => x - y), n = b.length;
    const h = (n + 1) * p - 1;
    if (h <= 0) return b[0];
    if (h >= n - 1) return b[n - 1];
    const i = Math.floor(h); return b[i] + (h - i) * (b[i + 1] - b[i]);
  }
  function corr(a, b) {
    const ma = mean(a), mb = mean(b); let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < a.length; i++) { xy += (a[i] - ma) * (b[i] - mb); xx += (a[i] - ma) ** 2; yy += (b[i] - mb) ** 2; }
    const d = Math.sqrt(xx * yy); return d > 1e-9 ? xy / d : 0;
  }
  function dist(y, x, k, sig, vy, vx) {
    let s = 0; const a = [];
    for (let j = 0; j <= k; j++) { a.push(y[j]); s += (y[j] - x[j]) ** 2; }
    const c = corr(a, x.slice(0, k + 1));
    let d = WT.e * Math.sqrt(s / (k + 1)) / sig + WT.c * (1 - c) + WT.g * Math.abs(y[0] - x[0]) / sig + WT.w * Math.abs(y[k] - x[k]) / sig;
    if (vx) { const cl = (z) => Math.min(20, Math.max(0.05, z)); d += WT.v * (vy ? Math.abs(Math.log(cl(vx) / cl(vy))) : 1); }
    return [d, c];
  }
  /* rows: [{code,name,date,R:[],vol,flag,vr,next,scale}]，只用 date < upto */
  function search(rows, x, k, K, sx, upto, vx, vseg) {
    const pool = rows.filter((r) => r.date < upto && r.vol > 0);
    if (pool.length < 30) return null;
    const sig = Math.max(std0(pool.map((r) => r.R[k])), 0.05);
    const S = pool.map((r) => { const [d, c] = dist(r.R, x, k, sig, vx ? r.vr && r.vr[vseg] : 0, vx); return { r, d, c }; });
    S.sort((a, b) => a.d - b.d);
    const top = S.slice(0, K).map((o) => {
      const f = Math.min(2, Math.max(0.5, sx / o.r.vol)), base = 1 + o.r.R[k] / 100;
      const rem = o.r.R.slice(k).map((v) => ((1 + v / 100) / base - 1) * 100);
      return { ...o, sim: 100 * Math.exp(-o.d), f, rem, remS: rem.map((v) => v * f) };
    });
    return { top, n: pool.length, sig };
  }
  function summary(S, x, k) {
    const m = S.top[0].rem.length, q = [[], [], []];
    for (let j = 0; j < m; j++) { const a = S.top.map((t) => t.remS[j]); q[0].push(wq(a, .25)); q[1].push(wq(a, .5)); q[2].push(wq(a, .75)); }
    const end = S.top.map((t) => t.remS[m - 1]), now = x[k], to = (a) => ((1 + now / 100) * (1 + a / 100) - 1) * 100;
    return { n: end.length, up: end.filter((v) => v > 0).length, mean: mean(end), med: median(end), lo: q[0][m - 1], hi: q[2][m - 1], q, to, closeLo: to(q[0][m - 1]), closeHi: to(q[2][m - 1]), closeMed: to(median(end)) };
  }
  // 日 K 相似段（同 analog.py seg_search）
  function segSearch(close, N, K, H = 20, iEnd = null) {
    const c = close.map(Math.log), n = c.length, i = iEnd == null ? n - 1 : iEnd;
    const cs = [0], cs2 = [0]; for (let t = 1; t < n; t++) { const r = c[t] - c[t - 1]; cs.push(cs[t - 1] + r); cs2.push(cs2[t - 1] + r * r); }
    const W = 60, sd = (e) => { const a = (cs[e] - cs[e - W]) / W, b = (cs2[e] - cs2[e - W]) / W; return Math.sqrt(Math.max(b - a * a, 1e-8)); };
    if (i < W + 1) return null;
    const s0 = sd(i), rt = Math.sqrt(N), x = []; for (let j = -N; j <= 0; j++) x.push((c[i + j] - c[i - N]) / (s0 * rt));
    const L = [];
    for (let e = Math.max(N, 60); e <= i - H; e++) {
      const sv = sd(e), y = []; let s = 0;
      for (let j = -N; j <= 0; j++) { const v = (c[e + j] - c[e - N]) / (sv * rt); y.push(v); s += (v - x[j + N]) ** 2; }
      const cc = corr(y, x);
      L.push({ e, d: 0.6 * Math.sqrt(s / (N + 1)) + 0.4 * (1 - cc), c: cc, sv });
    }
    if (L.length < 60) return null;
    const tot = L.length; L.sort((a, b) => a.d - b.d);
    const gap = Math.max(5, Math.floor(N / 2)), pick = [];
    for (const o of L) { if (pick.every((p) => Math.abs(p.e - o.e) >= gap)) { pick.push(o); if (pick.length >= K) break; } }
    return { n: tot, top: pick.map((o) => { const f = Math.min(2, Math.max(.5, s0 / o.sv)), fut = [], futS = []; for (let h = 0; h <= H; h++) { const z = c[o.e + h] - c[o.e]; fut.push((Math.exp(z) - 1) * 100); futS.push((Math.exp(z * f) - 1) * 100); } return { ...o, sim: 100 * Math.exp(-o.d), f, fut, futS }; }) };
  }
  // 历史库解码
  async function gunzip(buf) {
    if (typeof DecompressionStream === "undefined") throw new Error("浏览器版本太旧，读不了历史库（请升级到 iOS 16.4+ / 新版 Chrome）");
    const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  function decode(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), hl = dv.getUint32(0, true);
    const H = JSON.parse(new TextDecoder().decode(u8.subarray(4, 4 + hl))), n = H.n, w = H.np + 1;
    let o = 4 + hl;
    const dates = []; for (let i = 0; i < n; i++, o += 4) dates.push(dv.getInt32(o, true));
    const lo = u8.subarray(o, o + n * w); o += n * w;
    const hi = u8.subarray(o, o + n * w); o += n * w;
    const vo = []; for (let i = 0; i < n; i++, o += 2) vo.push(dv.getUint16(o, true) / 1000);
    const fl = u8.subarray(o, o + n); o += n;
    const vr = u8.subarray(o, o + n * 8);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const R = new Array(w); let a = 0;
      for (let j = 0; j < w; j++) { const v = lo[j * n + i] | (hi[j * n + i] << 8); a += v >= 32768 ? v - 65536 : v; R[j] = a * H.q / 100; }
      const V = []; for (let j = 0; j < 8; j++) { const b = vr[j * n + i]; V.push(b ? Math.pow(2, (b - 128) / 30) : null); }
      rows.push({ code: H.code, name: H.name, date: dates[i], R, vol: vo[i], flag: fl[i] === 2 ? null : fl[i] === 1, vr: V });
    }
    for (let i = 0; i < n - 1; i++) rows[i].next = rows[i + 1];
    return { H, rows };
  }
  // 当天分时 → 5 分钟路径（同 analog.py parse_live）
  function parseLive(m, date, prev, rows) {
    const lab = labels(m).map((x) => x.replace(":", "")), mp = new Map(rows.map((r) => [r[0], r])), keys = [...mp.keys()].sort();
    const last = rows[rows.length - 1][0], path = [], vols = [];
    lab.forEach((t, j) => {
      if (j === 0) { path.push((mp.get("0931") || mp.get(keys[0]))[1]); return; }
      if (t > last || path.length < j) return;
      let kk = null; for (const x of keys) { if (x <= t) kk = x; else break; }
      path.push(kk ? mp.get(kk)[1] : path[path.length - 1]); vols.push(kk ? mp.get(kk)[2] : 0);
    });
    const k = path.length - 1;
    return { date: +date, prev, R: path.map((p) => (p / prev - 1) * 100), k, price: rows[rows.length - 1][1], done: k >= NPT[m], cumv: vols[vols.length - 1] || 0, last };
  }
  const engine = { WT, labels, dist, search, summary, segSearch, decode, parseLive, wq, corr, std1, dailyK: (c) => dailyK(c) };

  // ==================== 取数 ====================
  let BASE = "";
  const JCACHE = {};
  const getJ = (u) => (JCACHE[u] = JCACHE[u] || fetch(u).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch((e) => { delete JCACHE[u]; throw e; }));
  const hourV = () => Math.floor(Date.now() / 1800000);
  const index = () => getJ(`${BASE}analog/index.json?v=${hourV()}`);
  const norm = (c) => { c = String(c || "").trim(); if (/^us/i.test(c)) return "us" + c.slice(2).replace(/\.(OQ|N|AM)$/i, "").replace(/^\./, "").toUpperCase(); return /^hk/i.test(c) ? "hk" + c.slice(2).toUpperCase() : c.toLowerCase(); };
  const LIB = {};
  async function lib(code) {
    const idx = await index().catch(() => null);
    const it = idx && idx.list.find((x) => x[0] === code);
    if (it) return (LIB[code] = LIB[code] || fetch(`${BASE}analog/${code}.bin?v=${it[4]}`).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); }).then(gunzip).then(decode).catch((e) => { delete LIB[code]; throw e; }));
    if (mktOf(code) === "cn" && /^(sh|sz)\d{6}$/.test(code)) return (LIB[code] = LIB[code] || txM5(code).catch((e) => { delete LIB[code]; throw e; }));
    return null;
  }
  // 不在库里的 A股：腾讯 5 分钟线往前翻（2026-11-25 实测每页 800 根、最多约 6000 根 ≈ 最近 125 个交易日）
  async function txM5(code) {
    const days = new Map(); let end = "";
    for (let p = 0; p < 8; p++) {
      let b; try { const j = await (await fetch(`https://ifzq.gtimg.cn/appstock/app/kline/mkline?param=${code},m5,${end},800`)).json(); b = j.data[code].m5; } catch (e) { break; }
      if (!b || !b.length) break;
      b.forEach((r) => { const d = r[0].slice(0, 8); if (!days.has(d)) days.set(d, new Map()); days.get(d).set(r[0].slice(8, 12), [+r[1], +r[2], +r[5]]); });
      const f = b[0][0]; if (end && f >= end) break; end = f;
      if (b.length < 300) break;
    }
    const lab = labels("cn").map((x) => x.replace(":", "")), ds = [...days.keys()].sort(), rows = []; let prev = null;
    for (const d of ds) {
      const M = days.get(d); if (M.size < 46) { prev = null; continue; }
      const p = [], first = M.get("0935") || [...M.values()][0]; let last = first[0]; p.push(first[0]);
      lab.slice(1).forEach((t) => { if (M.has(t)) last = M.get(t)[1]; p.push(last); });
      if (prev) rows.push({ code, name: code, date: +d, R: p.map((v) => (v / prev - 1) * 100) });
      prev = last;
    }
    rows.forEach((r, i) => { const a = rows.slice(Math.max(0, i - 20), i).map((x) => x.R[48]); r.vol = a.length >= 10 ? Math.max(0.05, std1(a)) : 0; r.next = rows[i + 1]; r.flag = null; });
    if (rows.length < 40) throw new Error("历史分时太少");
    return { H: { code, name: code, n: rows.length, np: 48, peers: [], first: rows[0].date, last: rows[rows.length - 1].date, t: "tx", live: 1 }, rows };
  }
  async function live(code) {
    const m = mktOf(code);
    const cs = m !== "us" ? [code] : /^us(IXIC|INX|DJI|NDX)$/.test(code) ? ["us." + code.slice(2)] : [code + ".OQ", code + ".N", code + ".AM", code];
    for (const c of cs) {
      try {
        const j = (await (await fetch(`https://web.ifzq.gtimg.cn/appstock/app/${m === "us" ? "UsMinute" : "minute"}/query?code=${c}&_=${Math.floor(Date.now() / 20000)}`)).json()).data[c];
        const rows = j.data.data.map((s) => s.trim().split(/\s+/)).filter((r) => r.length >= 2 && r[0].length === 4).map((r) => [r[0], +r[1], +(r[2] || 0)]);
        if (rows.length < 2) continue;
        const q = j.qt[c];
        const L = parseLive(m, j.data.date, +q[4], rows); L.name = q[1]; return L;
      } catch (e) { /* 换下一个 */ }
    }
    return null;
  }
  const DK = {};
  function dailyK(code) { return (DK[code] = DK[code] || _daily(code).catch((e) => { delete DK[code]; throw e; })); }
  async function pagesK(url, keys, cands) { // 腾讯日K翻页（一次 640 根）；同 analog.py _pages
    let out = [], end = "", c = null;
    for (let p = 0; p < 14; p++) {
      let b = null;
      for (const cc of c ? [c] : cands) {
        try { const d = (await (await fetch(url(cc, end))).json()).data[cc]; b = keys.map((k) => d[k]).find((x) => x && x.length) || null; } catch (e) { b = null; }
        if (b) { c = cc; break; }
      }
      if (!b) break;
      const rows = b.map((r) => [r[0].replace(/-/g, ""), +r[1], +r[3], +r[4], +r[2]]).filter((r) => !out.length || r[0] < out[0][0]);
      if (!rows.length) break;
      out = rows.concat(out);
      if (rows[0][0] <= "20050110" || b.length < 600) break;
      const t = new Date(rows[0][0].replace(/(\d{4})(\d\d)(\d\d)/, "$1-$2-$3") + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - 1); end = t.toISOString().slice(0, 10);
    }
    return { rows: out, c };
  }
  /* 腾讯复权是「加减法」（复权价 = M×原价 + B），直接用会把涨跌算歪；同 analog.py adjust：复权价只用来认出除权日和除权后的昨收，其余用原价涨跌连乘（等比前复权） */
  function adjustK(raw, adj) {
    const A = new Map(adj.map((r) => [r[0], r])), T = raw.filter((r) => A.has(r[0])), n = raw.length, pos = new Map(raw.map((r, i) => [r[0], i]));
    const f = new Array(n).fill(1), X = T.map((r) => r.slice(1, 5)), Y = T.map((r) => A.get(r[0]).slice(1, 5)), m = T.length, tol = 0.0075;
    const fit = (lo, hi) => {
      const x = [], y = []; for (let t = lo; t < hi; t++) for (let j = 0; j < 4; j++) { x.push(X[t][j]); y.push(Y[t][j]); }
      if (x.length < 12) return null;
      const mx = mean(x), my = mean(y); let vx = 0, cxy = 0; for (let i = 0; i < x.length; i++) { vx += (x[i] - mx) ** 2; cxy += (x[i] - mx) * (y[i] - my); }
      vx /= x.length; cxy /= x.length; if (Math.sqrt(vx) < 1e-6) return null;
      const M = cxy / vx, B = my - M * mx; let e = 0; for (let i = 0; i < x.length; i++) e = Math.max(e, Math.abs(y[i] - M * x[i] - B));
      return [M, B, e];
    };
    for (let t = 1; t < m; t++) {
      const dr = X[t][3] - X[t - 1][3], da = Y[t][3] - Y[t - 1][3];
      const ok = t >= 2 && Math.abs(dr) > 1e-9 && Math.abs(da - dr * (Y[t][1] - Y[t][2]) / Math.max(X[t][1] - X[t][2], 1e-9)) < 2.2 * tol + 0.02 * Math.abs(da);
      if (ok) continue;
      const a = fit(t, Math.min(m, t + 8)), b = fit(Math.max(0, t - 8), t);
      if (a && b && a[0] > 0 && a[2] < tol && b[2] < tol) {
        const g = (Y[t - 1][3] - a[1]) / a[0] / X[t - 1][3];
        if (g > 0.02 && g < 50 && Math.abs(g - 1) > Math.max(0.003, 3 * tol / Math.max(a[0] * X[t - 1][3], 1e-9))) f[pos.get(T[t][0])] = g;
      }
    }
    const cf = new Array(n).fill(1); for (let t = n - 2; t >= 0; t--) cf[t] = cf[t + 1] * f[t + 1];
    return raw.map((r, i) => [r[0]].concat(r.slice(1).map((v) => v * cf[i])));
  }
  async function _daily(code) { // 等比前复权（指数原值）；翻页拿全历史；和 analog.py daily 同一算法
    const m = mktOf(code), idx = /^(sh000|sz399)/.test(code) || /^hkHS/.test(code) || /^us(IXIC|INX|DJI|NDX)$/.test(code);
    const cs = m === "us" ? (idx ? ["us." + code.slice(2)] : [code + ".OQ", code + ".N", code + ".AM"]) : [code];
    const P = "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/";
    const R = await pagesK((cc, end) => `${P}newfqkline/get?param=${cc},day,,${end},640,`, ["day", "qfqday"], cs);
    let out = R.rows;
    if (out.length && !idx) {
      const ad = m === "us" ? "qfq" : "hfq";
      const J = await pagesK((cc, end) => `${P}${m === "cn" ? "new" : m}fqkline/get?param=${cc},day,,${end},640,${ad}`, [ad + "day"], [R.c]);
      if (J.rows.length) out = adjustK(out, J.rows);
    }
    out = out.filter((r) => r.slice(1).every((v) => v > 0));
    if (out.length < 30) throw new Error("日 K 拿不到");
    return out;
  }

  // ==================== 页面 ====================
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pc = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d) + "%");
  const cl = (v) => (v > 0 ? "up" : v < 0 ? "dn" : "");
  const fd = (d) => String(d).replace(/(\d{4})(\d\d)(\d\d)/, "$1-$2-$3");
  const px = (v) => (v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3));
  const QUICK = [["sh000300", "沪深300"], ["sh510050", "上证50ETF"], ["sh513180", "恒生科技ETF"], ["sz399006", "创业板指"], ["sh000688", "科创50"], ["sh600519", "贵州茅台"], ["sz300750", "宁德时代"], ["hkHSI", "恒生指数"], ["hk00700", "腾讯"], ["usQQQ", "QQQ"], ["usSPY", "SPY"], ["usNVDA", "英伟达"], ["usTSLA", "特斯拉"], ["usTQQQ", "TQQQ"]];
  function css() {
    if (document.getElementById("an-css")) return;
    const st = document.createElement("style"); st.id = "an-css";
    st.textContent = `
.an{font-variant-numeric:tabular-nums;min-width:0}.an *{box-sizing:border-box}
.an .up{color:var(--up,#e5484d)}.an .dn{color:var(--dn,#2fa86b)}
.an-q{display:flex;gap:8px;margin:0 0 8px}.an-q input{flex:1;min-width:0;font-size:16px;padding:9px 12px;border:1px solid var(--line,#e5e7eb);border-radius:10px;background:var(--card,#fff);color:inherit}
.an-sug{position:relative}.an-sug div{position:absolute;z-index:30;left:0;right:0;background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:280px;overflow:auto}
.an-sug a{display:flex;justify-content:space-between;gap:8px;padding:9px 12px;text-decoration:none;color:inherit;border-bottom:1px solid var(--line,#eee);font-size:14px}.an-sug em{font-style:normal;color:var(--sub,#6b7280);font-size:12px}
.an-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin:0 0 8px;scrollbar-width:none}.an-chips::-webkit-scrollbar{display:none}
.an-chips button,.an-seg button{flex:none;border:1px solid var(--line,#e5e7eb);background:var(--card,#fff);color:inherit;border-radius:999px;font-size:13px;line-height:1;padding:7px 11px;cursor:pointer;font-family:inherit}
.an-chips button.on,.an-seg button.on{background:var(--text,#111);color:var(--card,#fff);border-color:var(--text,#111)}
.an-seg{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.an-seg>span{font-size:13px;color:var(--sub,#6b7280)}
.an-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--line,#e5e7eb);border-radius:10px;overflow:hidden;margin:0 0 10px}
.an-tabs button{border:0;background:var(--card,#fff);color:inherit;padding:9px 4px;font-size:14px;font-family:inherit;cursor:pointer}.an-tabs button.on{background:var(--text,#111);color:var(--card,#fff);font-weight:700}
.an-one{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-left:4px solid var(--text,#111);border-radius:0 12px 12px 0;padding:11px 14px;margin:0 0 8px;font-size:15.5px;line-height:1.7}
.an-one .h{font-weight:700;font-size:16px;display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline}.an-one .h em{font-style:normal;font-weight:400;font-size:12.5px;color:var(--sub,#6b7280)}
.an-one b.big{font-size:18px}
.an-bdg{display:block;white-space:normal;overflow-wrap:anywhere;border-radius:8px;padding:6px 10px;font-size:13px;line-height:1.6;margin:6px 0 0;background:#fff7e6;color:#8a5a00}.an-bdg.no{background:#fdecec;color:#a32020}.an-bdg.ok{background:#e8f6ee;color:#1c7a45}
.an-box{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:8px 8px 4px;margin:0 0 8px;position:relative;min-width:0}
.an-ch{width:100%;height:400px}.an-ch.s{height:240px}
.an-tip{position:absolute;pointer-events:none;z-index:9;background:rgba(17,24,39,.93);color:#fff;border-radius:8px;padding:6px 9px;font-size:12.5px;line-height:1.55;white-space:nowrap;display:none}
.an-lg{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:12px;color:var(--sub,#6b7280);padding:2px 4px 4px}.an-lg i{display:inline-block;width:16px;height:0;border-top:2px solid;vertical-align:middle;margin-right:4px}
.an-t{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--card,#fff)}.an-t th{font-weight:600;color:var(--sub,#6b7280);font-size:12px;text-align:right;padding:6px 6px;border-bottom:1px solid var(--line,#e5e7eb);white-space:nowrap}
.an-t td{padding:7px 6px;text-align:right;border-bottom:1px solid var(--line,#f0f0f0);white-space:nowrap}.an-t th:first-child,.an-t td:first-child{text-align:left}.an-t tbody tr{cursor:pointer}.an-t tbody tr:hover,.an-t tr.on{background:var(--soft,#f7f8fa)}
.an details{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:0 12px;margin:0 0 8px}.an summary{cursor:pointer;padding:10px 0;font-size:14px;font-weight:600}.an details p,.an details li{font-size:13.5px;line-height:1.75;margin:4px 0}.an details .in{padding:0 0 10px}
.an-mut{font-size:12.5px;color:var(--sub,#6b7280);line-height:1.7}
.an input[type=date],.an select,.an input.sm{font-size:14px;padding:6px 8px;border:1px solid var(--line,#e5e7eb);border-radius:8px;background:var(--card,#fff);color:inherit;max-width:100%;font-family:inherit}
.an input[type=range]{width:100%}
.an-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.an-2>div{min-width:0;border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:8px 10px;background:var(--card,#fff)}.an-2 label{display:block;font-size:12.5px;color:var(--sub,#6b7280);margin:4px 0 2px}.an-2 input,.an-2 select{width:100%}
.an-btn{border:0;background:var(--text,#111);color:var(--card,#fff);border-radius:10px;font-size:14px;padding:9px 16px;cursor:pointer;font-family:inherit}
@media (max-width:760px){.an-ch{height:262px}.an-ch.s{height:200px}.an-2{grid-template-columns:1fr}.an-one{font-size:15px}.an-t .x{display:none}.an-t th,.an-t td{padding:7px 4px;font-size:13px}}`;
    document.head.appendChild(st);
  }
  let echartsP = null;
  function needEcharts() {
    if (window.echarts) return Promise.resolve();
    return (echartsP = echartsP || new Promise((res, rej) => { const el = document.createElement("script"); el.src = BASE + "echarts.min.js?v=5.5.1"; el.onload = res; el.onerror = () => { echartsP = null; rej(new Error("图表组件加载失败")); }; document.head.appendChild(el); }));
  }
  const UP = "#e5484d", DN = "#2fa86b", BLK = "#111827";
  let INST = 0;

  function mount(root, o = {}) {
    css();
    const id = ++INST, S = { code: norm(o.code || "sh000300"), name: o.name || "", mode: o.mode || "day", date: o.date ? +o.date : 0, time: o.time || "", K: 10, ma: "", vol: false, peers: false, span: 0, N: 20, dK: 10, hide: !!o.embed };
    const charts = [];
    const alive = () => document.body.contains(root) && root.dataset.an === String(id);
    root.dataset.an = String(id);
    const mk = (el) => { const old = window.echarts.getInstanceByDom(el); if (old) old.dispose(); const c = window.echarts.init(el); charts.push(c); return c; };
    const onrs = () => charts.forEach((c) => { if (!c.isDisposed()) c.resize(); });
    window.addEventListener("resize", onrs);
    root.innerHTML = `<div class="an">
      ${o.embed ? "" : `<div class="an-q"><input id="anq${id}" type="search" placeholder="🔎 代码 / 名称，如 600519、沪深300、QQQ、00700" autocomplete="off"></div><div class="an-sug" id="ansug${id}"></div><div class="an-chips" id="anqk${id}"></div>`}
      <div class="an-tabs" id="antab${id}">${[["day", "日内相似日"], ["seg", "两段重叠"], ["dk", "日K相似段"]].map(([k, n]) => `<button data-m="${k}">${n}</button>`).join("")}</div>
      <div id="anb${id}"><p class="an-mut">正在读取…</p></div></div>`;
    const B = root.querySelector(`#anb${id}`);
    const $ = (s) => B.querySelector(s);
    root.querySelector(`#antab${id}`).onclick = (e) => { const b = e.target.closest("button"); if (b) { S.mode = b.dataset.m; render(); } };
    const setHash = () => { if (o.onstate) o.onstate(S); };
    if (!o.embed) {
      const qk = root.querySelector(`#anqk${id}`), q = root.querySelector(`#anq${id}`), sg = root.querySelector(`#ansug${id}`);
      qk.innerHTML = QUICK.map(([c, n]) => `<button data-c="${c}">${n}</button>`).join("");
      qk.onclick = (e) => { const b = e.target.closest("button"); if (b) pick(b.dataset.c); };
      const find = async (t) => {
        t = t.trim(); if (!t) return [];
        const idx = await index().catch(() => ({ list: [] })), T = t.toUpperCase(), out = [];
        for (const x of idx.list) { if (x[0].toUpperCase().includes(T) || x[1].toUpperCase().includes(T)) out.push([x[0], x[1], `${x[3]} 天`]); if (out.length > 12) break; }
        if (/^\d{6}$/.test(t)) { const c = (/^(5|6|9)/.test(t) ? "sh" : "sz") + t; if (!out.some((x) => x[0] === c)) out.push([c, c, "不在历史库"]); }
        else if (o.names && out.length < 8) { try { const N = await o.names(); if (N) for (const [nm, c] of Object.entries(N.n)) { if (nm.toUpperCase().includes(T) && /^(sh|sz)\d{6}$/.test(c) && !out.some((x) => x[0] === c)) { out.push([c, nm, "不在历史库"]); if (out.length > 12) break; } } } catch (e) { /* 没有名称表就只查库 */ } }
        return out;
      };
      let tm = 0;
      q.oninput = () => { clearTimeout(tm); tm = setTimeout(async () => { const r = await find(q.value); sg.innerHTML = r.length ? `<div>${r.map((x) => `<a href="javascript:void 0" data-c="${esc(x[0])}" data-n="${esc(x[1])}"><span>${esc(x[1])} <em>${esc(x[0])}</em></span><em>${esc(x[2])}</em></a>`).join("")}</div>` : ""; }, 150); };
      q.onkeydown = async (e) => { if (e.key === "Enter") { const r = await find(q.value); if (r[0]) pick(r[0][0], r[0][1]); } };
      sg.onclick = (e) => { const a = e.target.closest("a"); if (a) pick(a.dataset.c, a.dataset.n); };
      var pick = (c, n) => { S.code = norm(c); S.name = n || ""; S.date = 0; S.time = ""; sg.innerHTML = ""; q.value = ""; setHash(); render(); };
    }
    const nameLink = (code, name) => (o.link ? o.link(code, name) : esc(name || code));
    const onTab = () => { root.querySelectorAll(".an-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.m === S.mode)); const qk = root.querySelector(`#anqk${id}`); if (qk) qk.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.c === S.code)); };
    let tok = 0, timer = 0;
    function render() {
      clearInterval(timer); tok++;
      while (charts.length) { const c = charts.pop(); if (!c.isDisposed()) c.dispose(); }
      onTab();
      const t = tok, go = S.mode === "day" ? dayMode : S.mode === "seg" ? segMode : dkMode;
      B.innerHTML = `<div class="an-box" style="min-height:120px"><p class="an-mut">正在读取历史走势…</p></div>`;
      go(t).catch((e) => { if (t === tok && alive()) B.innerHTML = `<div class="an-box"><p class="an-mut">读取失败：${esc(e.message)}。<a href="javascript:void 0" id="rt">重试</a></p></div>`, $("#rt").onclick = render; });
    }
    const badgeOf = (idx, kind, t) => { const L = (idx && idx.lab && idx.lab[kind]) || null; if (!L) return `<span class="an-bdg">还没有检验结果，只能当参考。</span>`; const bt = (L.by_type && L.by_type[t]) || ""; return `<span class="an-bdg ${L.cls || ""}">${esc(L.mark || "")} ${esc(L.badge)}${bt ? `<br>${esc(bt)}` : ""} <a href="${BASE}#/labs/analog">检验报告 ›</a></span>`; };
    // ---------- 1. 日内相似日 ----------
    async function dayMode(t) {
      await needEcharts();
      const m = mktOf(S.code), lab = labels(m), idx = await index().catch(() => null);
      const [LB, LV] = await Promise.all([lib(S.code).catch((e) => ({ err: e })), live(S.code)]);
      if (t !== tok || !alive()) return;
      if (!LB || LB.err) {
        B.innerHTML = `<div class="an-one"><div class="h">${nameLink(S.code, S.name || (LV && LV.name) || S.code)}</div>这只还没进历史库${LB && LB.err ? `（${esc(LB.err.message)}）` : ""}，网页上查不了日内相似日。<br>「日K相似段」「两段重叠（日K）」照样能用；在电脑上可以跑：<br><code>python3 analog.py --code ${esc(S.code)}</code></div>`;
        return;
      }
      const H = LB.H, rows = LB.rows; S.name = H.name !== S.code ? H.name : S.name || (LV && LV.name) || S.code;
      const lastLib = rows[rows.length - 1].date;
      // 当天：实时优先；否则库里最近一天
      let date = S.date || (LV ? LV.date : lastLib), full = null, isLive = false, prev = null;
      const r0 = rows.find((r) => r.date === date);
      if (LV && LV.date === date && !(r0 && LV.done)) { full = LV.R; isLive = true; prev = LV.prev; }
      else if (r0) { full = r0.R; if (LV && LV.date === date) prev = LV.prev; }
      else if (LV && LV.date === date) { full = LV.R; prev = LV.prev; }
      if (!full) { const d2 = rows.filter((r) => r.date <= date).pop(); if (!d2) throw new Error("这天没有数据"); date = d2.date; full = d2.R; }
      const kmax = full.length - 1, done = kmax >= NPT[m], noon = m === "us" ? "12:00" : m === "hk" ? "12:00" : "11:30";
      let k;
      if (S.time) { k = 0; lab.forEach((l, j) => { if (l <= S.time) k = j; }); k = Math.min(k, kmax); } else k = done ? lab.indexOf(noon) : kmax;
      if (k < 2) { B.innerHTML = `<div class="an-one"><div class="h">${nameLink(S.code, S.name)} <em>${fd(date)}</em></div>今天刚开盘，走势还太短（不到 10 分钟），过一会儿再查；或者选一个历史日期看看。</div>`; return; }
      const x = full.slice(0, k + 1);
      let pool = rows;
      if (S.span) pool = pool.slice(-S.span);
      if (S.ma) pool = pool.filter((r) => r.flag === (S.ma === "up"));
      const before = rows.filter((r) => r.date < date), sx = Math.max(0.05, std1(before.slice(-20).map((r) => r.R[r.R.length - 1])));
      let peerN = 0;
      if (S.peers && H.peers && H.peers.length) {
        const P = await Promise.all(H.peers.map(([c]) => lib(c).catch(() => null)));
        if (t !== tok || !alive()) return;
        P.forEach((p) => { if (!p) return; peerN++; p.rows.forEach((r) => { if (r.vol > 0 && (!S.ma || r.flag === (S.ma === "up"))) { const g = sx / r.vol; pool = pool.concat([{ ...r, R: r.R.map((v) => v * g), vol: sx, scaled: g }]); } }); });
      }
      const vseg = Math.min(7, Math.max(0, Math.floor(k * 8 / NPT[m]) - 1));
      let vx = 0;
      if (S.vol) { if (r0 && r0.vr) vx = r0.vr[vseg]; }
      const R = search(pool, x, k, S.K, sx, date, vx, vseg);
      if (!R) { B.innerHTML = `<div class="an-one">符合条件的历史天数不到 30 天，把筛选放宽一点。</div>` + opts(); bind(); return; }
      const Z = summary(R, x, k), now = x[k], ccy = prev;
      const act = done && k < kmax ? full : null, actEnd = act ? ((1 + act[kmax] / 100) / (1 + now / 100) - 1) * 100 : null;
      const tz = m === "us" ? "America/New_York" : m === "hk" ? "Asia/Hong_Kong" : "Asia/Shanghai";
      let loc = ""; try { loc = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()).replace(/-/g, ""); } catch (e) { /* 老浏览器不显示「今天」 */ }
      const isToday = LV && LV.date === date && String(date) === loc;
      const best = R.top[0].sim, worst = R.top[R.top.length - 1].sim;
      const price = ccy ? ` 现价 ${px(ccy * (1 + now / 100))}` : "";
      const rng = ccy ? `（约 ${px(ccy * (1 + Z.closeLo / 100))} ~ ${px(ccy * (1 + Z.closeHi / 100))}）` : "";
      B.innerHTML = `
        <div class="an-one"><div class="h">${nameLink(S.code, S.name)} <em>${isToday ? "今天 " : ""}${fd(date)} 截至 ${lab[k]}${isLive && !done && !S.time ? "（实时，每分钟刷新）" : ""}</em></div>
          <div>现在 <b class="${cl(now)}">${pc(now)}</b>${price}。最像的 ${Z.n} 天里，有 <b class="big">${Z.up}</b> 天收盘比这一刻高；${k >= lab.indexOf(noon) ? "剩下的时间" : "后半段"}平均 <b class="${cl(Z.mean)}">${pc(Z.mean)}</b>（中位 ${pc(Z.med)}）。<br>一半情形收在 <b>${pc(Z.closeLo)} ~ ${pc(Z.closeHi)}</b>${rng}。${act ? `<br>后来实际：收盘 <b class="${cl(act[kmax])}">${pc(act[kmax])}</b>，这一刻之后 ${pc(actEnd)}，${actEnd >= Z.lo && actEnd <= Z.hi ? "落在" : "没落在"}上面的范围里。` : ""}</div>
          ${badgeOf(idx, "intraday", H.t)}
          ${best < 55 ? `<span class="an-bdg no">⚠️ 今天的走势很少见：最像的一天相似度也只有 ${best.toFixed(0)}，参考价值更低。</span>` : ""}
          ${H.live ? `<span class="an-bdg">这只不在历史库，临时用腾讯 5 分钟线，只有近 ${rows.length} 天（${fd(rows[0].date)} 起），除权日会有假跳空，参考价值更低。</span>` : ""}</div>
        <div class="an-box"><div class="an-ch" id="c1"></div><div class="an-tip" id="tip"></div>
          <div class="an-lg"><span><i style="border-color:${BLK};border-top-width:3px"></i>${isToday ? "今天" : fd(date)}</span>${act ? `<span><i style="border-color:${BLK};border-top-style:dotted"></i>后来实际</span>` : ""}<span><i style="border-color:${UP}"></i>那天后来涨</span><span><i style="border-color:${DN}"></i>那天后来跌</span><span><i style="border-color:#d97706;border-top-style:dashed"></i>中位数</span><span><i style="border-color:#f5b041;border-top-width:8px"></i>中间一半的范围</span></div></div>
        <div class="an-seg" id="tms"><span>截到</span>${timeBtns(m, done, kmax, lab)}</div>
        <div class="an-box" style="padding:0;overflow:hidden"><table class="an-t"><thead><tr><th>哪一天</th><th>相似度</th><th class="x">那天此刻</th><th>之后到收盘</th><th>当天收盘</th><th>次日</th></tr></thead><tbody>${R.top.map((o, i) => { const r = o.r, g = r.scaled || 1, e = r.R[r.R.length - 1] / g, nx = r.next && r.next.date < date ? r.next.R[r.next.R.length - 1] : null; return `<tr data-i="${i}"><td>${fd(r.date)}${r.code !== S.code ? ` <span class="an-mut">${esc(r.name)}</span>` : ""}</td><td>${o.sim.toFixed(0)}</td><td class="x ${cl(r.R[k])}">${pc(r.R[k] / g)}</td><td class="${cl(o.rem[o.rem.length - 1])}">${pc(o.rem[o.rem.length - 1])}</td><td class="${cl(e)}">${pc(e)}</td><td class="${cl(nx)}">${nx == null ? "—" : pc(nx)}</td></tr>`; }).join("")}</tbody></table></div>
        <div class="an-mut" style="margin:-2px 2px 8px">点一行看那天的完整分时、日 K 位置和第二天。比了 ${R.n} 天${peerN ? `（含走势最同步的 ${peerN} 只）` : ""}，${fd(rows[0].date)} 起；相似度 ${worst.toFixed(0)}~${best.toFixed(0)}（100＝一模一样）。</div>
        <div id="det"></div>${opts()}${explain(idx)}`;
      bind();
      draw1(lab, x, k, R, Z, act, date);
      $(".an-t").onclick = (e) => { const tr = e.target.closest("tr[data-i]"); if (!tr) return; B.querySelectorAll(".an-t tr").forEach((q) => q.classList.toggle("on", q === tr)); detail(R.top[+tr.dataset.i], k, lab, LB); };
      $("#tms").onclick = (e) => { const b = e.target.closest("button"); if (b) { S.time = b.dataset.t; setHash(); render(); } };
      if (isLive && !done && !S.time) timer = setInterval(() => { if (!alive()) return clearInterval(timer); if (document.hidden) return; const y = window.scrollY, tt = ++tok; dayMode(tt).then(() => window.scrollTo(0, y)).catch(() => {}); clearInterval(timer); }, 60000);
      S._dates = rows.map((r) => r.date); S._cur = date;
    }
    function timeBtns(m, done, kmax, lab) {
      const ts = m === "cn" ? ["10:00", "10:30", "11:00", "11:30", "13:30", "14:00", "14:30"] : m === "hk" ? ["10:30", "11:00", "12:00", "13:30", "14:30", "15:30"] : ["10:30", "11:00", "12:00", "13:00", "14:30", "15:30"];
      const a = ts.filter((t) => lab.indexOf(t) <= kmax && lab.indexOf(t) > 0);
      return (done ? "" : `<button data-t="" class="${S.time ? "" : "on"}">现在</button>`) + a.map((t) => `<button data-t="${t}" class="${S.time === t || (done && !S.time && t === (m === "cn" ? "11:30" : "12:00")) ? "on" : ""}">${t}</button>`).join("");
    }
    function opts() {
      const seg = (k, xs) => xs.map(([v, n]) => `<button data-k="${k}" data-v="${v}" class="${String(S[k] === true ? 1 : S[k] === false ? "" : S[k]) === String(v) ? "on" : ""}">${n}</button>`).join("");
      return `<details id="ops" ${S._ops ? "open" : ""}><summary>换日期 / 换条件</summary><div class="in"><div class="an-seg"><span>日期</span><input type="date" id="dt" value="${S.date ? fd(S.date) : S._cur ? fd(S._cur) : ""}"><button data-k="date" data-v="0">回到最新</button></div>
        <div class="an-seg"><span>找几天</span>${seg("K", [[5, "5"], [10, "10"], [20, "20"], [30, "30"]])}</div>
        <div class="an-seg"><span>去哪找</span>${seg("peers", [["", "只找自己"], [1, "加上走势最同步的 8 只"]])}</div>
        <div class="an-seg"><span>多久以内</span>${seg("span", [[0, "全部"], [250, "近 1 年"], [500, "近 2 年"]])}</div>
        <div class="an-seg"><span>大盘背景</span>${seg("ma", [["", "不限"], ["up", "前一天大盘在 20 日线上"], ["dn", "在 20 日线下"]])}</div>
        <div class="an-seg"><span>量能</span>${seg("vol", [["", "不看"], [1, "也算进相似度（历史日期可用）"]])}</div></div></details>`;
    }
    function bind() {
      const op = $("#ops"); if (!op) return;
      op.ontoggle = () => { S._ops = op.open; };
      op.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const k = b.dataset.k, v = b.dataset.v; S[k] = k === "K" || k === "span" || k === "date" ? +v : k === "peers" || k === "vol" ? !!v : v; setHash(); render(); };
      $("#dt").onchange = (e) => { const d = +e.target.value.replace(/-/g, ""); if (d) { S.date = d; setHash(); render(); } };
    }
    function explain(idx) {
      return `<details><summary>怎么算的、为什么只能当参考</summary><div class="in"><ul><li>把走势变成「相对昨天收盘涨跌多少」的一条线，5 分钟一个点，和历史每一天截至同一时刻的线比。</li><li>相似度＝两条线的平均距离（45%）＋形状相关（25%）＋开盘高低开差多少（10%）＋现在涨跌差多少（20%），都除以这只平时的波动；100＝一模一样。</li><li>黄色区域：这几天后半段的涨跌，按「最近波动 ÷ 那时波动」缩放后，取中间一半。意思是历史上大约一半时候收在里面、一半在外面。</li><li>只用这天之前的历史，不偷看后面。</li><li>检验结论写在上面的徽标里：方向不可信，范围可以当「接下来大概的波动」看。</li><li>历史库：${idx ? `${idx.n} 只、更新到 ${esc(idx.built)}，共 ${(idx.bytes / 1e6).toFixed(1)} MB` : "—"}；A股分时来自通达信，港美股来自 CNBC，当天走势来自腾讯。</li></ul></div></details>`;
    }
    function draw1(lab, x, k, R, Z, act, date) {
      const el = $("#c1"), c = mk(el), n = lab.length, q = Z.q.map((a) => a.map(Z.to));
      const pad = (a) => Array(k).fill(null).concat(a);
      const lines = R.top.map((t, i) => ({ name: "d" + i, type: "line", data: t.r.R, showSymbol: false, triggerLineEvent: true, lineStyle: { width: 1.1, color: t.rem[t.rem.length - 1] > 0 ? UP : DN, opacity: 0.5 }, emphasis: { focus: "none", lineStyle: { width: 2.6, opacity: 1 } }, z: 2 }));
      const all = R.top.flatMap((t) => t.r.R).concat(x, q[0], q[2]);
      const lo = Math.min(...all), hi = Math.max(...all), p = (hi - lo) * 0.04 || .1;
      const step = el.clientWidth < 500 ? 12 : 6;
      c.setOption({ animation: false, grid: { left: 46, right: 12, top: 12, bottom: 24 }, xAxis: { type: "category", data: lab, boundaryGap: false, axisLabel: { color: "#8a8f98", fontSize: 11, interval: (i) => i % step === 0 }, axisTick: { show: false }, axisLine: { lineStyle: { color: "#d1d5db" } } },
        yAxis: { type: "value", min: +(lo - p).toFixed(2), max: +(hi + p).toFixed(2), axisLabel: { color: "#8a8f98", fontSize: 11, formatter: (v) => v.toFixed(Math.abs(hi - lo) > 4 ? 0 : 1) + "%" }, splitLine: { lineStyle: { color: "rgba(128,128,128,.15)" } } },
        series: lines.concat([
          { name: "lo", type: "line", stack: "cone", stackStrategy: "all", data: pad(q[0]), showSymbol: false, lineStyle: { opacity: 0 }, silent: true, z: 1 },
          { name: "rng", type: "line", stack: "cone", stackStrategy: "all", data: pad(q[2].map((v, j) => v - q[0][j])), showSymbol: false, lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(245,176,65,.42)" }, silent: true, z: 1 },
          { name: "med", type: "line", data: pad(q[1]), showSymbol: false, lineStyle: { width: 2, type: "dashed", color: "#d97706" }, silent: true, z: 4 },
          act ? { name: "act", type: "line", data: act.map((v, j) => (j < k ? null : v)), showSymbol: false, lineStyle: { width: 1.8, type: "dotted", color: BLK }, silent: true, z: 5 } : null,
          { name: "now", type: "line", data: x.concat(Array(n - k - 1).fill(null)), showSymbol: false, lineStyle: { width: 3.2, color: BLK }, silent: true, z: 6, markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: "#9ca3af", type: "solid", width: 1 }, data: [{ xAxis: k }, { yAxis: 0 }] }, markPoint: { silent: true, symbol: "circle", symbolSize: 9, itemStyle: { color: BLK }, label: { show: false }, data: [{ coord: [k, x[k]] }] } }].filter(Boolean)) });
      const tip = $("#tip");
      const show = (ev) => { const i = /^d(\d+)$/.exec(ev.seriesName || ""); if (!i) return; const o = R.top[+i[1]], r = o.r, g = r.scaled || 1, nx = r.next && r.next.date < date ? r.next.R[r.next.R.length - 1] : null; tip.innerHTML = `<b>${fd(r.date)}</b>${r.code !== S.code ? " " + esc(r.name) : ""}<br>相似度 ${o.sim.toFixed(0)}　相关 ${o.c.toFixed(2)}<br>当天收盘 ${pc(r.R[r.R.length - 1] / g)}<br>这一刻之后 ${pc(o.rem[o.rem.length - 1])}<br>次日 ${nx == null ? "—" : pc(nx)}`; tip.style.display = "block"; const X = ev.event ? ev.event.offsetX : 60, Y = ev.event ? ev.event.offsetY : 30; tip.style.left = Math.min(Math.max(4, X + 14), el.clientWidth - 150) + "px"; tip.style.top = Math.max(4, Y - 60) + "px"; };
      c.on("mouseover", show);
      c.on("click", (ev) => { show(ev); const i = /^d(\d+)$/.exec(ev.seriesName || ""); if (i) { const tr = B.querySelector(`.an-t tr[data-i="${i[1]}"]`); if (tr) tr.click(); } });
      c.on("mouseout", () => { tip.style.display = "none"; });
      c.getZr().on("click", (ev) => { if (!ev.target) tip.style.display = "none"; });
    }
    function detail(o, k, lab, LB) {
      const r = o.r, own = r.code === S.code ? LB.rows : null, g = r.scaled || 1, D = $("#det");
      const nx = r.next;
      D.innerHTML = `<div class="an-box"><div style="padding:4px 6px;font-size:14.5px"><b>${fd(r.date)}${r.code !== S.code ? " " + esc(r.name) : ""}</b>：收盘 <b class="${cl(r.R[r.R.length - 1])}">${pc(r.R[r.R.length - 1] / g)}</b>${nx ? `，第二天 ${fd(nx.date)} 开盘 ${pc(nx.R[0])}、收盘 <b class="${cl(nx.R[nx.R.length - 1])}">${pc(nx.R[nx.R.length - 1])}</b>` : ""} <a href="javascript:void 0" id="godate">用这天当「今天」再找 ›</a></div>
        <div class="an-mut" style="padding:0 6px">那天完整分时（竖线＝对应的这一刻）${nx ? "，接着是第二天" : ""}</div><div class="an-ch s" id="c2"></div>${own ? `<div class="an-mut" style="padding:0 6px">日 K 位置（箭头＝那天，前 40 根、后 20 根；用 5 分钟线拼的，不复权影响已扣）</div><div class="an-ch s" id="c3"></div>` : ""}</div>`;
      $("#godate").onclick = () => { if (r.code !== S.code) { S.code = r.code; S.name = r.name; } S.date = r.date; S.time = lab[k]; S._ops = false; setHash(); render(); window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 60 }); };
      const a = r.R.map((v) => v / g), base = 1 + a[a.length - 1] / 100;
      const b = nx ? nx.R.map((v) => (base * (1 + v / 100) - 1) * 100) : [];
      const xs = lab.concat(nx ? lab.map((l) => "次日 " + l) : []);
      mk($("#c2")).setOption({ animation: false, grid: { left: 46, right: 12, top: 10, bottom: 22 }, tooltip: { trigger: "axis", confine: true, valueFormatter: (v) => (v == null ? "—" : pc(v)) }, xAxis: { type: "category", data: xs, boundaryGap: false, axisLabel: { fontSize: 10, color: "#8a8f98", interval: (i) => i % 24 === 0 } }, yAxis: { type: "value", scale: true, axisLabel: { fontSize: 10, color: "#8a8f98", formatter: (v) => v.toFixed(1) + "%" }, splitLine: { lineStyle: { color: "rgba(128,128,128,.15)" } } }, series: [{ name: "那天", type: "line", data: a, showSymbol: false, lineStyle: { width: 2, color: BLK }, markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: "#9ca3af" }, data: [{ xAxis: k }, { xAxis: lab.length - 1 }] } }, { name: "次日", type: "line", data: Array(lab.length).fill(null).concat(b), showSymbol: false, lineStyle: { width: 2, color: "#2563eb" } }] });
      if (own) {
        const i = own.indexOf(own.find((q) => q.date === r.date)), s = Math.max(0, i - 40), e = Math.min(own.length, i + 21);
        let p = 100; const K = [], ds = [];
        for (let j = s; j < e; j++) { const v = own[j].R.map((z) => p * (1 + z / 100)); K.push([v[0], v[v.length - 1], Math.min(...v), Math.max(...v)].map((z) => +z.toFixed(3))); ds.push(fd(own[j].date).slice(2)); p = v[v.length - 1]; }
        mk($("#c3")).setOption({ animation: false, grid: { left: 46, right: 12, top: 18, bottom: 22 }, tooltip: { trigger: "axis", confine: true }, xAxis: { type: "category", data: ds, axisLabel: { fontSize: 10, color: "#8a8f98" } }, yAxis: { type: "value", scale: true, axisLabel: { fontSize: 10, color: "#8a8f98" }, splitLine: { lineStyle: { color: "rgba(128,128,128,.15)" } } }, series: [{ type: "candlestick", data: K, itemStyle: { color: UP, color0: DN, borderColor: UP, borderColor0: DN }, markPoint: { symbol: "arrow", symbolSize: 13, symbolOffset: [0, -9], symbolRotate: 180, itemStyle: { color: "#2563eb" }, label: { show: false }, data: [{ coord: [i - s, K[i - s][3]] }] } }] });
      }
      D.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    // ---------- 2. 两段重叠 ----------
    const G = S.G = { type: "in", a: { code: S.code, date: 0, t0: "09:30", t1: "", n: 20 }, b: { code: S.code, date: 0, t0: "09:30", t1: "", n: 20 }, shift: 0 };
    async function segMode(t) {
      await needEcharts();
      if (!G.init || G.a.code !== S.code) { G.a = { code: S.code, date: 0, t0: "09:30", t1: "", n: 20 }; G.b = { code: S.code, date: 0, t0: "09:30", t1: "", n: 20 }; G.init = 1; G.shift = 0; }
      const form = (k, nm) => { const s = G[k]; return `<div><b>${nm}</b><label>标的</label><input class="sm" data-s="${k}" data-f="code" value="${esc(s.code)}" placeholder="sh510300 / hk00700 / usQQQ"><label>${G.type === "in" ? "日期（空＝最新一天）" : "截止日期（空＝最新）"}</label><input type="date" data-s="${k}" data-f="date" value="${s.date ? fd(s.date) : ""}">${G.type === "in" ? `<label>从几点到几点（空＝到最后）</label><div style="display:flex;gap:6px"><input class="sm" data-s="${k}" data-f="t0" value="${s.t0}"><input class="sm" data-s="${k}" data-f="t1" value="${s.t1}" placeholder="11:30"></div>` : `<label>往前数几根</label><input class="sm" type="number" data-s="${k}" data-f="n" value="${s.n}" min="5" max="250">`}</div>`; };
      B.innerHTML = `<div id="r2"><p class="an-mut">正在读取…</p></div>
        <div class="an-box"><div class="an-ch" id="c1"></div><div style="padding:2px 8px 8px"><div class="an-mut">左右拖动，平移 B 段对齐（也可以直接在图上左右拖）：<b id="shv">0</b></div><input type="range" id="sh" min="-24" max="24" step="1" value="${G.shift}"><div class="an-seg"><button id="best">自动找最像的对齐</button><button id="zero">归零</button></div></div></div>
        <details open><summary>选两段</summary><div class="in"><div class="an-seg"><button data-ty="in" class="${G.type === "in" ? "on" : ""}">日内分时</button><button data-ty="dk" class="${G.type === "dk" ? "on" : ""}">日 K</button></div><div class="an-2">${form("a", "A 段（粗线）")}${form("b", "B 段（细线）")}</div><div style="margin-top:8px"><button class="an-btn" id="go2">叠在一起看</button></div></div></details>
        <details><summary>怎么看</summary><div class="in"><p>两段都从起点 100 开始画，可以平移 B 段找最好的对齐。相关系数 1＝形状一模一样，0＝没关系，−1＝完全相反。B 段虚线部分是「B 段之后怎么走」，只是历史，不是预测。两段看着像，不代表后面也像（检验见日内相似日的徽标）。</p></div></details>`;
      B.querySelectorAll("[data-ty]").forEach((b) => (b.onclick = () => { G.type = b.dataset.ty; G.shift = 0; render(); }));
      B.querySelectorAll("[data-s]").forEach((el) => (el.onchange = () => { const s = G[el.dataset.s], f = el.dataset.f; s[f] = f === "date" ? +el.value.replace(/-/g, "") : f === "n" ? Math.max(5, +el.value || 20) : f === "code" ? codeOf(el.value) : el.value.trim(); if (f === "code") el.value = s[f]; }));
      $("#go2").onclick = () => { G.shift = 0; S.code = G.a.code; render(); };
      const [A1, B1] = [await segData(G.a, 0), await segData(G.b, 1)];
      if (t !== tok || !alive()) return;
      const draw = () => drawSeg(A1, B1);
      $("#sh").oninput = (e) => { G.shift = +e.target.value; draw(); };
      $("#zero").onclick = () => { G.shift = 0; $("#sh").value = 0; draw(); };
      $("#best").onclick = () => { let bs = 0, bc = -2; for (let s = -24; s <= 24; s++) { const c = segCorr(A1, B1, s); if (c.n >= Math.max(5, A1.v.length * .6) && c.c > bc) { bc = c.c; bs = s; } } G.shift = bs; $("#sh").value = bs; draw(); };
      draw();
      const zr = charts[charts.length - 1].getZr(); let down = null;
      zr.on("mousedown", (e) => { down = [e.offsetX, G.shift]; }); zr.on("mouseup", () => { down = null; }); zr.on("globalout", () => { down = null; });
      zr.on("mousemove", (e) => { if (!down) return; const w = $("#c1").clientWidth - 60, s = Math.max(-24, Math.min(24, Math.round(down[1] + (e.offsetX - down[0]) / w * (G.span || 48)))); if (s !== G.shift) { G.shift = s; $("#sh").value = s; draw(); } });
    }
    function codeOf(v) { v = v.trim(); if (/^\d{6}$/.test(v)) return (/^(5|6|9)/.test(v) ? "sh" : "sz") + v; if (/^\d{5}$/.test(v)) return "hk" + v; if (/^[A-Za-z]{1,5}$/.test(v) && !/^(sh|sz|hk|us)/i.test(v)) return "us" + v.toUpperCase(); return norm(v); }
    async function segData(s, isB) {
      const code = norm(s.code);
      if (G.type === "in") {
        const m = mktOf(code), lab = labels(m), [L, V] = await Promise.all([lib(code).catch(() => null), live(code)]);
        let d = s.date, R = null, nm = (L && L.H.name) || (V && V.name) || code;
        if (!d) { if (isB && G.a._d && L) { const k = Math.min(...[lab.length - 1, (G.a._R || []).length - 1]); const pool = L.rows.filter((r) => !(code === norm(G.a.code) && r.date >= G.a._d)); const x = G.a._R; const sx = 1; const z = x && x.length > 3 ? search(pool, x, x.length - 1, 1, sx, 99999999) : null; d = z ? z.top[0].r.date : pool.length ? pool[pool.length - 1].date : 0; } else d = V ? V.date : L ? L.rows[L.rows.length - 1].date : 0; }
        if (V && V.date === d) R = V.R; else if (L) { const r = L.rows.filter((q) => q.date <= d).pop(); if (r) { R = r.R; d = r.date; } }
        if (!R) throw new Error(`${code} ${d ? fd(d) : ""} 没有分时数据（不在历史库）`);
        let i0 = 0, i1 = R.length - 1; lab.forEach((l, j) => { if (l <= (s.t0 || "09:30")) i0 = j; if (s.t1 && l <= s.t1) i1 = Math.min(j, R.length - 1); });
        if (!isB) { G.a._d = d; G.a._R = R.slice(0, i1 + 1); }
        if (isB && !s.t1 && G.a._R) i1 = Math.min(i1, i0 + Math.max(4, G.a._R.length - 1));
        const P = R.map((v) => 1 + v / 100), b = P[i0];
        return { name: nm, code, tag: `${fd(d)} ${lab[i0]}~${lab[i1]}`, v: P.slice(i0, i1 + 1).map((p) => p / b * 100), after: P.slice(i1).map((p) => p / b * 100), lab: lab.slice(i0) };
      }
      const K = await dailyK(code), idx = await index().catch(() => null), nm = ((idx && idx.list.find((x) => x[0] === code)) || [])[1] || code;
      let e = K.length - 1; if (s.date) { e = 0; K.forEach((r, j) => { if (+r[0] <= s.date) e = j; }); } else if (isB) { const c = K.map((r) => r[4]), z = code === norm(G.a.code) ? segSearch(c, Math.min(G.a.n, 120), 1, 20) : null; if (z) e = z.top[0].e; }
      const i0 = Math.max(0, e - s.n + 1), b = K[i0][4], c = K.map((r) => r[4] / b * 100);
      return { name: nm, code, tag: `${fd(K[i0][0])} ~ ${fd(K[e][0])}（${e - i0 + 1} 根）`, v: c.slice(i0, e + 1), after: c.slice(e, e + 21), lab: K.slice(i0, e + 1).map((r) => fd(r[0]).slice(2)) };
    }
    function segCorr(A1, B1, s) { const a = [], b = []; for (let i = 0; i < A1.v.length; i++) { const j = i - s; if (j >= 0 && j < B1.v.length) { a.push(A1.v[i]); b.push(B1.v[j]); } } return { c: a.length > 3 ? corr(a, b) : NaN, n: a.length }; }
    function drawSeg(A1, B1) {
      const s = G.shift, c = segCorr(A1, B1, s), n = Math.max(A1.v.length, B1.v.length + Math.max(0, s)) + Math.min(20, Math.max(A1.after.length, B1.after.length) - 1);
      G.span = n;
      // 重叠部分的起点都归一到 100
      const a0 = Math.max(0, s), an = A1.v[Math.min(a0, A1.v.length - 1)], bn = B1.v[Math.min(Math.max(0, -s), B1.v.length - 1)];
      const arr = (v, off, base) => { const o = Array(n).fill(null); v.forEach((z, i) => { if (i + off >= 0 && i + off < n) o[i + off] = +(z / base * 100).toFixed(3); }); return o; };
      const xs = Array.from({ length: n }, (_, i) => (i < A1.lab.length ? A1.lab[i] : "+" + (i - A1.v.length + 1)));
      const c1 = charts.find((z) => !z.isDisposed() && z.getDom() === $("#c1")) || mk($("#c1"));
      c1.setOption({ animation: false, grid: { left: 46, right: 12, top: 12, bottom: 24 }, tooltip: { trigger: "axis", confine: true, valueFormatter: (v) => (v == null ? "—" : (+v).toFixed(2)) }, xAxis: { type: "category", data: xs, boundaryGap: false, axisLabel: { fontSize: 11, color: "#8a8f98" } }, yAxis: { type: "value", scale: true, axisLabel: { fontSize: 11, color: "#8a8f98" }, splitLine: { lineStyle: { color: "rgba(128,128,128,.15)" } } },
        series: [{ name: "A " + A1.name, type: "line", data: arr(A1.v, 0, an), showSymbol: false, lineStyle: { width: 3.2, color: BLK }, itemStyle: { color: BLK }, z: 5 }, { name: "A 之后", type: "line", data: arr(A1.after, A1.v.length - 1, an), showSymbol: false, lineStyle: { width: 1.6, color: BLK, type: "dotted" }, itemStyle: { color: BLK } }, { name: "B " + B1.name, type: "line", data: arr(B1.v, s, bn), showSymbol: false, lineStyle: { width: 2, color: "#2563eb" }, itemStyle: { color: "#2563eb" }, z: 4 }, { name: "B 之后", type: "line", data: arr(B1.after, s + B1.v.length - 1, bn), showSymbol: false, lineStyle: { width: 1.6, color: "#2563eb", type: "dashed" }, itemStyle: { color: "#2563eb" } }] }, true);
      $("#shv").textContent = s === 0 ? "没平移" : `B 段${s > 0 ? "右移" : "左移"} ${Math.abs(s)} 格`;
      const ea = A1.v[A1.v.length - 1] / A1.v[0] * 100 - 100, eb = B1.v[B1.v.length - 1] / B1.v[0] * 100 - 100, eaft = B1.after.length > 1 ? B1.after[B1.after.length - 1] / B1.after[0] * 100 - 100 : null;
      $("#r2").innerHTML = `<div class="an-one"><div class="h">两段相关系数 <b class="big">${Number.isNaN(c.c) ? "—" : c.c.toFixed(2)}</b> <em>重叠 ${c.n} 个点</em></div><div>A：${nameLink(A1.code, A1.name)} ${A1.tag}，<b class="${cl(ea)}">${pc(ea)}</b>　B：${nameLink(B1.code, B1.name)} ${B1.tag}，<b class="${cl(eb)}">${pc(eb)}</b>${eaft == null ? "" : `；B 段之后${G.type === "dk" ? ` ${B1.after.length - 1} 天` : "到收盘"} <b class="${cl(eaft)}">${pc(eaft)}</b>`}</div></div>`;
    }

    // ---------- 3. 日K相似段 ----------
    async function dkMode(t) {
      await needEcharts();
      const [K, idx] = await Promise.all([dailyK(S.code), index().catch(() => null)]);
      if (t !== tok || !alive()) return;
      const it = idx && idx.list.find((x) => x[0] === S.code); if (it) S.name = it[1];
      const c = K.map((r) => r[4]); let iE = K.length - 1;
      if (S.ddate) K.forEach((r, j) => { if (+r[0] <= S.ddate) iE = j; });
      const R = segSearch(c, S.N, S.dK, 20, iE);
      if (!R) { B.innerHTML = `<div class="an-one">${nameLink(S.code, S.name || S.code)} 日 K 太短（${K.length} 根），找不了相似段。</div>`; return; }
      const H3 = [5, 10, 20], col = (h) => R.top.map((o) => o.futS[h]), st = H3.map((h) => ({ h, up: R.top.filter((o) => o.fut[h] > 0).length, med: median(col(h)), lo: wq(col(h), .25), hi: wq(col(h), .75) })), s10 = st[1];
      const act = iE + 10 < K.length ? (c[iE + 10] / c[iE] - 1) * 100 : null;
      B.innerHTML = `<div class="an-one"><div class="h">${nameLink(S.code, S.name || S.code)} <em>截至 ${fd(K[iE][0])}，最近 ${S.N} 根日 K</em></div>
        <div>全历史（${fd(K[0][0])} 起）最像的 ${R.top.length} 段里，之后 10 天 <b class="big">${s10.up}</b> 段上涨；中位 <b class="${cl(s10.med)}">${pc(s10.med, 1)}</b>，一半情形在 <b>${pc(s10.lo, 1)} ~ ${pc(s10.hi, 1)}</b>。${act == null ? "" : `<br>后来实际 10 天：<b class="${cl(act)}">${pc(act, 1)}</b>`}</div>${badgeOf(idx, "daily", it && it[2])}</div>
        <div class="an-box"><div class="an-ch" id="c1"></div><div class="an-tip" id="tip"></div><div class="an-lg"><span><i style="border-color:${BLK};border-top-width:3px"></i>最近 ${S.N} 根</span><span><i style="border-color:${UP}"></i>之后 10 天涨</span><span><i style="border-color:${DN}"></i>之后 10 天跌</span><span><i style="border-color:#d97706;border-top-style:dashed"></i>中位数</span><span><i style="border-color:#f5b041;border-top-width:8px"></i>中间一半的范围</span></div></div>
        <div class="an-seg" id="ns"><span>看最近</span>${[10, 20, 60].map((n) => `<button data-n="${n}" class="${S.N === n ? "on" : ""}">${n} 根</button>`).join("")}<span>找几段</span>${[5, 10, 20].map((n) => `<button data-kk="${n}" class="${S.dK === n ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="an-box" style="padding:0;overflow:hidden"><table class="an-t" style="cursor:default"><thead><tr><th>之后</th><th>上涨</th><th>中位</th><th>中间一半</th></tr></thead><tbody>${st.map((s) => `<tr style="cursor:default"><td>${s.h} 天</td><td>${s.up}/${R.top.length}</td><td class="${cl(s.med)}">${pc(s.med, 1)}</td><td>${pc(s.lo, 1)} ~ ${pc(s.hi, 1)}</td></tr>`).join("")}</tbody></table></div>
        <details><summary>这 ${R.top.length} 段是哪些</summary><div class="in"><table class="an-t"><thead><tr><th>哪一段</th><th>相似度</th><th>5天</th><th>10天</th><th>20天</th></tr></thead><tbody>${R.top.map((o) => `<tr data-e="${o.e}"><td>${fd(K[o.e - S.N][0])}<br><span class="an-mut">~ ${fd(K[o.e][0])}</span></td><td>${o.sim.toFixed(0)}</td>${H3.map((h) => `<td class="${cl(o.fut[h])}">${pc(o.fut[h], 1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>
        <details><summary>换截止日期 / 怎么算的</summary><div class="in"><div class="an-seg"><span>截止日期</span><input type="date" id="dd" value="${fd(K[iE][0])}"><button id="dl">回到最新</button></div><p>最近 N 根收盘价的走势（按最近 60 天波动缩放）和历史每一段比：平均距离 60% ＋ 形状相关 40%；选出来的段之间至少隔 N/2 根，免得全挑同一段；只用「之后 20 天已经走完」的段。之后的涨跌按波动缩放后取中间一半。</p></div></details>`;
      $("#ns").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.n) S.N = +b.dataset.n; else S.dK = +b.dataset.kk; render(); };
      $("#dd").onchange = (e) => { S.ddate = +e.target.value.replace(/-/g, ""); render(); }; $("#dl").onclick = () => { S.ddate = 0; render(); };
      const el = $("#c1"), ch = mk(el), N = S.N, xs = Array.from({ length: N + 21 }, (_, i) => i - N), Q = [.25, .5, .75].map((p) => xs.map((x) => (x < 0 ? null : 100 + wq(R.top.map((o) => o.futS[x]), p))));
      const ln = (e) => xs.map((x) => (c[e + x] == null ? null : +(c[e + x] / c[e] * 100).toFixed(3)));
      ch.setOption({ animation: false, grid: { left: 44, right: 12, top: 12, bottom: 24 }, xAxis: { type: "category", data: xs.map((x) => (x === 0 ? "现在" : x > 0 ? "+" + x : String(x))), boundaryGap: false, axisLabel: { fontSize: 11, color: "#8a8f98", interval: (i) => (i - N) % (N > 30 ? 20 : 5) === 0 } }, yAxis: { type: "value", scale: true, axisLabel: { fontSize: 11, color: "#8a8f98" }, splitLine: { lineStyle: { color: "rgba(128,128,128,.15)" } } },
        series: R.top.map((o, i) => ({ name: "d" + i, type: "line", data: ln(o.e), showSymbol: false, triggerLineEvent: true, lineStyle: { width: 1.1, opacity: .5, color: o.fut[10] > 0 ? UP : DN }, emphasis: { lineStyle: { width: 2.6, opacity: 1 } }, z: 2 })).concat([{ name: "lo", type: "line", stack: "cone", stackStrategy: "all", data: Q[0], showSymbol: false, lineStyle: { opacity: 0 }, silent: true, z: 1 }, { name: "rng", type: "line", stack: "cone", stackStrategy: "all", data: Q[2].map((v, j) => (v == null ? null : v - Q[0][j])), showSymbol: false, lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(245,176,65,.42)" }, silent: true, z: 1 }, { name: "med", type: "line", data: Q[1], showSymbol: false, silent: true, lineStyle: { width: 2, type: "dashed", color: "#d97706" }, z: 4 }, { name: "now", type: "line", data: xs.map((x) => (x <= 0 ? +(c[iE + x] / c[iE] * 100).toFixed(3) : null)), showSymbol: false, silent: true, lineStyle: { width: 3.2, color: BLK }, z: 6, markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: "#9ca3af", type: "solid" }, data: [{ xAxis: N }] } }, iE + 1 < K.length ? { name: "act", type: "line", silent: true, showSymbol: false, data: xs.map((x) => (x >= 0 && c[iE + x] != null ? +(c[iE + x] / c[iE] * 100).toFixed(3) : null)), lineStyle: { width: 1.8, type: "dotted", color: BLK }, z: 5 } : null].filter(Boolean)) });
      const tip = $("#tip");
      const show = (ev) => { const i = /^d(\d+)$/.exec(ev.seriesName || ""); if (!i) return; const o = R.top[+i[1]]; tip.innerHTML = `<b>${fd(K[o.e - N][0])} ~ ${fd(K[o.e][0])}</b><br>相似度 ${o.sim.toFixed(0)}　相关 ${o.c.toFixed(2)}<br>之后 5/10/20 天 ${pc(o.fut[5], 1)} / ${pc(o.fut[10], 1)} / ${pc(o.fut[20], 1)}`; tip.style.display = "block"; tip.style.left = Math.min(Math.max(4, ev.event.offsetX + 14), el.clientWidth - 215) + "px"; tip.style.top = Math.max(4, ev.event.offsetY - 50) + "px"; };
      ch.on("mouseover", show); ch.on("click", show); ch.on("mouseout", () => { tip.style.display = "none"; });
    }
    render();
    return { render, S };
  }
  window.ANALOG = { mount, engine, setBase: (b) => { BASE = b; }, norm };
  // ---------- 学堂路由 #/analog[/代码[/日期[/时刻]]] ----------
  window.__mod_analog = {
    page(code, date, time, mode) {
      const A = window.__APP;
      document.title = "相似走势 · 小七投研";
      A.app.innerHTML = `<h1>🔍 相似走势</h1><p class="an-mut" style="margin:-4px 0 10px">今天走到一半，去历史里找截至同一时刻最像的几天，叠在一起看。方向别当真，看「大概的波动范围」。</p><div id="anroot"></div>${A.DISC}`;
      const t = /^\d{1,2}[:.]?\d\d$/.test(time || "") ? time.replace(".", ":").replace(/^(\d{2})(\d{2})$/, "$1:$2") : "";
      mount(document.getElementById("anroot"), { code: code || "sh000300", date: /^\d{8}$/.test(date || "") ? date : 0, time: t, mode: ["day", "seg", "dk"].includes(mode) ? mode : "day", names: A.needNames, link: (c, n) => A.stockLink(c, n),
        onstate: (S) => { try { history.replaceState(history.state, "", `#/analog/${encodeURIComponent(S.code)}${S.date ? "/" + S.date + (S.time ? "/" + S.time : "") : ""}`); } catch (e) { /* 地址栏不更新也不影响 */ } } });
    },
  };
})();
