/* 小七投研 · 期权模拟 #/optsim（读 optsim.json + optsim/q_*.json + optsim/today.json，optsim_build.py 生成）
   2026-11-26 老大：「手机 app 以及网页我希望加一个期权模拟的工具，给我一段 k 线和期权的」——配套检验 #/labs/straddle（买入跨式是不是必胜：❌）。
   玩法：随机抽一段历史（TQQQ / QQQ / SPY / NVDA，价格按今天的价位等比换算、先藏日期），看入场前 60 根日K，选策略（买 call / 买 put / 买跨式 / 宽跨式 / 卖 put / 牛市价差 / 熊市价差）、
        到期（7/14/30/45 天）、行权价，按模型算出每张权利金（Black-Scholes + 今天期权链校准的隐含波动率倍数、微笑、按 VXN 分档的买卖价差、手续费 $0.65/张 + $1.99/笔）；
        开仓后「下一天 ▶」逐日推进，收盘看止盈 / 止损，随时可平仓；到期或平仓后结算，揭晓日期和真实价格，并给出「每天都这么开，历史上的胜率 / 平均」。
   今天：用当天 CBOE 真实买价 / 卖价，算现在买一套要多少钱、回本要涨跌多少、明天涨跌几个点大概值多少。
   成绩只存本机 localStorage（xq_optsim_v1），每 20 局一张小结。手机竖屏优先：首屏 = 大字盈亏 + 图 + 大按钮，说明默认折叠。 */
(function () {
  const A = window.__APP;
  const { esc } = A;
  const KEY = "xq_optsim_v1";
  const UP = "#e5484d", DN = "#1f9d55";
  const sg = (v, d = 1) => (v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%");
  const usd = (v, d = 0) => (v == null || !isFinite(v) ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const usdS = (v) => (v > 0 ? "+" : "") + usd(v);
  const cls = (v) => (v == null || !isFinite(v) || Math.abs(v) < 1e-9 ? "" : v > 0 ? "up" : "dn");
  let META = null, TODAY = null;
  const SH = {};
  const charts = {};

  if (!document.getElementById("osm-css")) {
    const st = document.createElement("style");
    st.id = "osm-css";
    st.textContent = `.osm{max-width:980px;overflow-wrap:anywhere}
.osm .modes,.osm .pills{display:flex;gap:6px;overflow-x:auto;margin:2px 0 8px;padding-bottom:2px;scrollbar-width:none}.osm .modes::-webkit-scrollbar,.osm .pills::-webkit-scrollbar{display:none}
.osm .modes a{flex:none;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 12px;font-size:14px;color:var(--text);white-space:nowrap}
.osm .modes a.on{background:#1f2328;color:#fff;border-color:#1f2328}
.osm .pills button{flex:none;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:6px 10px;font-size:13.5px;color:var(--text);cursor:pointer;white-space:nowrap}
.osm .pills button.on{border-color:#c81e1e;color:#c81e1e;font-weight:700;background:#fdecec}
.osm .lab{font-size:12.5px;color:var(--sub);margin:6px 2px 2px}
.osm .hd{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin:4px 2px}
.osm .big{font-size:34px;font-weight:900;line-height:1.05;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.osm .big small{display:block;font-size:12px;font-weight:600;color:var(--sub);margin-top:2px;letter-spacing:0}
.osm .hs{font-size:13px;color:var(--sub);text-align:right;line-height:1.5;font-variant-numeric:tabular-nums}.osm .hs b{color:var(--text)}
.osm .up{color:var(--up)}.osm .dn{color:var(--dn)}
.osm .ch{width:100%;height:300px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.osm .ch2{width:100%;height:220px;background:var(--card);border:1px solid var(--line);border-radius:12px;margin-top:8px}
@media (max-width:600px){.osm .ch{height:250px}.osm .ch2{height:190px}.osm .big{font-size:30px}.osm h1{font-size:20px}}
.osm .btns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}
.osm .btns button{min-height:52px;border-radius:12px;border:0;font-size:16.5px;font-weight:800;cursor:pointer;color:#fff;touch-action:manipulation}
.osm .btns button small{display:block;font-size:11.5px;font-weight:600;opacity:.9}
.osm .btns .b{background:var(--up)}.osm .btns .s{background:var(--dn)}.osm .btns .n{background:#1f2328}.osm .btns .g{background:#eef0f3;color:var(--text)}
.osm .btns button:disabled{opacity:.35;cursor:default}
.osm .kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}
.osm .kv div{background:var(--soft);border-radius:10px;padding:8px 10px;min-width:0}.osm .kv b{display:block;font-size:17px;font-variant-numeric:tabular-nums}.osm .kv span{font-size:12px;color:var(--sub)}
@media (max-width:420px){.osm .kv{grid-template-columns:repeat(2,minmax(0,1fr))}}
.osm .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin:8px 0}
.osm .card h3{margin:0 0 6px;font-size:16px}
.osm .stp{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--sub);margin:4px 0}
.osm .stp button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:5px 9px;font-size:13px;cursor:pointer;color:var(--text)}
.osm .stp button.on{background:#fff4e0;border-color:#d97706;color:#b45309;font-weight:700}
.osm .kp{display:flex;align-items:center;gap:8px;font-size:14px;margin:4px 0}
.osm .kp button{width:38px;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--card);font-size:18px;cursor:pointer}
.osm .kp b{font-size:16px;font-variant-numeric:tabular-nums}
.osm .toast{font-size:13.5px;color:var(--sub);min-height:20px;margin:4px 2px;line-height:1.5}
.osm details.f{margin:10px 0}.osm details.f>summary{cursor:pointer;color:var(--brand);font-size:14px;list-style:none;padding:4px 0}
.osm details.f>summary::-webkit-details-marker{display:none}
.osm details.f ul{margin:4px 0 0;padding-left:20px;font-size:13.5px;line-height:1.75}
.osm table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.osm th,.osm td{padding:5px 4px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.osm th:first-child,.osm td:first-child{text-align:left;white-space:normal}
.osm .tw{overflow-x:auto}
.osm .rep{background:linear-gradient(135deg,#7f1d1d,#c81e1e);color:#fff;border-radius:16px;padding:12px 14px;margin:8px 0}
.osm .rep h3{margin:0 0 4px;font-size:17px}.osm .rep p{margin:4px 0;font-size:14px;line-height:1.6}
.osm .warn{background:#fff4e0;color:#8a5a00;border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.55;margin:6px 0}`;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- 模型（与 optsim_build.py / straddle_lab.py 同一公式）
  function ncdf(x) {
    const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return 0.5 * (1 + Math.sign(x) * y);
  }
  function bs(S, K, T, iv, cp) {
    if (T <= 0) return cp === "C" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    const sq = Math.max(iv * Math.sqrt(T), 1e-9), d1 = (Math.log(S / K) + 0.5 * sq * sq) / sq, d2 = d1 - sq;
    const c = S * ncdf(d1) - K * ncdf(d2);
    return cp === "C" ? c : c - S + K;
  }
  function interp(x, xs, ys) {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    return ys[ys.length - 1];
  }
  const gfac = (g9, g91, t) => (t <= 30 ? g9 * (1 - Math.min(Math.max((t - 9) / 21, 0), 1)) + Math.min(Math.max((t - 9) / 21, 0), 1) : (1 - Math.min((t - 30) / 61, 1)) + g91 * Math.min((t - 30) / 61, 1));
  function atmIV(p, v, tauTd) { const tc = Math.max(tauTd, 0.5) * 365 / 252; return v[0] * gfac(v[1], v[2], tc) * interp(tc, META.dcal, p.R); }
  function relSpread(p, tauCal, otm, vxn) {
    const tier = META.tier.find((t) => vxn < t[0])[1];
    return interp(tauCal, META.dcal, p.spr) * (1 + p.slope * Math.max(otm, 0)) * tier;
  }
  // 一条腿在某天收盘：中间价、买价、卖价（每股）
  function legQ(p, v, S, K, tauTd, cp) {
    let mid;
    if (tauTd <= 0) return { mid: cp === "C" ? Math.max(S - K, 0) : Math.max(K - S, 0), bid: null, ask: null, exp: true };
    const a = atmIV(p, v, tauTd), T = tauTd / 252, z = Math.log(K / S) / (a * Math.sqrt(T));
    mid = bs(S, K, T, a * interp(z, p.sz, p.sr), cp);
    const otm = cp === "C" ? Math.log(K / S) : Math.log(S / K);
    const hs = Math.max(mid * relSpread(p, Math.max(tauTd, 1) * 365 / 252, otm, v[3] || 20), META.floor) / 2;
    return { mid, bid: Math.max(mid - hs, 0), ask: mid + hs, iv: a };
  }

  // ---------------------------------------------------------------- 存档
  const store = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { games: [], seen: [] }; } catch (e) { return { games: [], seen: [] }; } };
  const save = (S) => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 存不下就算了 */ } };
  const pref = () => { try { return JSON.parse(localStorage.getItem(KEY + "_p")) || {}; } catch (e) { return {}; } };
  const setPref = (o) => { try { localStorage.setItem(KEY + "_p", JSON.stringify({ ...pref(), ...o })); } catch (e) { /* 忽略 */ } };
  const dec = (x) => { try { return JSON.parse(atob(x)); } catch (e) { return {}; } };
  function shard(nm) { return SH[nm] ? Promise.resolve(SH[nm]) : A.getJSON("optsim/" + nm).then((x) => (SH[nm] = x)); }
  function pickQ(sym) {
    const S = store(), seen = new Set(S.seen || []);
    let L = META.cat.filter((r) => r[3] === sym);
    const fresh = L.filter((r) => !seen.has(r[0]));
    if (fresh.length) L = fresh;
    const r = L[Math.floor(Math.random() * L.length)];
    return shard(r[1]).then((arr) => { const q = arr[r[2]]; q.info = dec(q.x); return q; });
  }
  function qDates(q) {
    const out = [q.info.d0]; let t = new Date(q.info.d0 + "T00:00:00Z").getTime();
    (q.info.dd || []).forEach((g) => { t += g * 86400000; out.push(new Date(t).toISOString().slice(0, 10)); });
    return out;
  }

  // ---------------------------------------------------------------- 图
  function mk(id) { const el = document.getElementById(id); if (!el) return null; if (charts[id]) { try { charts[id].dispose(); } catch (e) { /* 已释放 */ } } charts[id] = A.mk(el); return charts[id]; }
  function drawK(id, bars, opts = {}) {
    const c = mk(id); if (!c) return;
    const X = bars.map((b, i) => (opts.dates ? opts.dates[i].slice(2) : String(i - (opts.e || 0))));
    const lines = (opts.lines || []).map(([y, nm, col, dash]) => ({ yAxis: y, lineStyle: { color: col, type: dash ? "dashed" : "solid", width: 1 }, label: { formatter: nm, color: col, fontSize: 10, position: "insideStartTop" } }));
    if (opts.e != null) lines.push({ xAxis: opts.e, lineStyle: { color: "#7c3aed", type: "dashed", width: 1 }, label: { formatter: "开仓", color: "#7c3aed", fontSize: 10 } });
    c.setOption({
      animation: false, grid: { left: 4, right: 46, top: 10, bottom: 22 },
      xAxis: { type: "category", data: X, axisLabel: { color: "#9aa1ab", fontSize: 10, hideOverlap: true }, axisLine: { lineStyle: { color: "#e7e9ee" } }, axisTick: { show: false } },
      yAxis: { scale: true, position: "right", splitNumber: 4, axisLabel: { color: "#9aa1ab", fontSize: 10 }, splitLine: { lineStyle: { color: "#eef0f3" } } },
      tooltip: { trigger: "axis", confine: true, textStyle: { fontSize: 11 } },
      series: [{ type: "candlestick", data: bars.map((b) => [b[0], b[3], b[2], b[1]]), barMaxWidth: 9, itemStyle: { color: UP, color0: DN, borderColor: UP, borderColor0: DN },
        markLine: { symbol: "none", silent: true, data: lines } }],
    }, true);
  }
  function drawPay(id, P, S0, nowCurve, opts = {}) {
    const c = mk(id); if (!c) return;
    const w = P.sym === "TQQQ" || P.sym === "NVDA" ? 0.5 : 0.2, xs = [];
    for (let k = 0; k <= 120; k++) xs.push(S0 * (1 - w + (2 * w * k) / 120));
    const exp = xs.map((S) => [S, payoffAt(P, S)]);
    const ser = [{ name: "到期时", type: "line", data: exp, showSymbol: false, lineStyle: { width: 2.2, color: "#c0392b" }, areaStyle: { opacity: 0.06, color: "#c0392b" } }];
    if (nowCurve) ser.push({ name: opts.nowName || "现在", type: "line", data: xs.map((S) => [S, nowCurve(S)]), showSymbol: false, lineStyle: { width: 1.4, type: "dashed", color: "#2f7fd8" } });
    const be = breakevens(P, xs);
    ser[0].markLine = { symbol: "none", silent: true, data: [{ yAxis: 0, lineStyle: { color: "#9aa1ab", width: 1 }, label: { show: false } },
      ...be.map((x) => ({ xAxis: x, lineStyle: { color: "#c0392b", type: "dotted" }, label: { formatter: `回本 ${x.toFixed(2)}\n${sg((x / S0 - 1) * 100, 0)}`, fontSize: 10, color: "#c0392b", position: "insideStartTop" } })),
      ...(opts.cur ? [{ xAxis: opts.cur, lineStyle: { color: "#7c3aed", type: "dashed" }, label: { formatter: "现在", fontSize: 10, color: "#7c3aed", position: "insideEndTop" } }] : [])] };
    c.setOption({ animation: false, grid: { left: 52, right: 14, top: 28, bottom: 24 }, legend: { top: 2, left: 52, textStyle: { fontSize: 11 }, itemHeight: 8 },
      xAxis: { type: "value", min: xs[0], max: xs[xs.length - 1], axisLabel: { fontSize: 10, color: "#9aa1ab", formatter: (v) => v.toFixed(0) }, splitLine: { show: false } },
      yAxis: { type: "value", axisLabel: { fontSize: 10, color: "#9aa1ab", formatter: (v) => usd(v) }, splitLine: { lineStyle: { color: "#eef0f3" } } },
      tooltip: { trigger: "axis", confine: true, textStyle: { fontSize: 11 }, formatter: (ps) => `标的 ${ps[0].value[0].toFixed(2)}<br>${ps.map((p) => `${p.seriesName} ${usd(p.value[1])}`).join("<br>")}` },
      series: ser }, true);
  }
  // 到期盈亏（美元，含两边手续费；到期按内在价值结算，不再扣价差）
  function payoffAt(P, S) {
    let v = 0; P.legs.forEach((l) => { v += l.q * (l.cp === "C" ? Math.max(S - l.K, 0) : Math.max(l.K - S, 0)); });
    return (v - P.entry) * 100 * P.n - P.feeIn;
  }
  function breakevens(P, xs) {
    const out = []; let prev = payoffAt(P, xs[0]);
    for (let i = 1; i < xs.length; i++) { const cur = payoffAt(P, xs[i]); if ((prev < 0) !== (cur < 0)) { const a = xs[i - 1], b = xs[i]; out.push(a + (b - a) * (-prev) / (cur - prev)); } prev = cur; }
    return out;
  }

  // ---------------------------------------------------------------- 仓位
  function buildPos(sym, key, dcal, shift, n, S0, v, quote) {
    const p = META.params[sym], st = META.strats[key], step = p.step;
    const legs = st.legs.map(([cp, m, q]) => ({ cp, q, K: Math.max(step, Math.round((S0 * (1 + m)) / step) * step + shift * step) }));
    let entry = 0, mid0 = 0;
    legs.forEach((l) => {
      const Q = quote ? quote(l) : legQ(p, v, S0, l.K, META.td[dcal], l.cp);
      l.mid0 = Q.mid; l.px0 = l.q > 0 ? Q.ask : Q.bid; l.iv = Q.iv;
      entry += l.q * l.px0; mid0 += l.q * Q.mid;
    });
    const feeSide = legs.length * META.fee.c * n + META.fee.o;
    const shortK = Math.max(0, ...legs.filter((l) => l.q < 0 && l.cp === "P").map((l) => l.K));
    const cap = entry > 0 ? entry * 100 * n + feeSide : shortK * 100 * n;
    return { sym, key, dcal, n, legs, entry, mid0, feeIn: feeSide, feeSide, cap, S0, credit: entry < 0 };
  }
  // 第 j 天收盘：中间价（App 显示的浮盈）与「现在平仓能拿到」
  function valueAt(P, v, S, tauTd) {
    const p = META.params[P.sym]; let mark = 0, close = 0, exp = tauTd <= 0;
    P.legs.forEach((l) => {
      const Q = legQ(p, v, S, l.K, tauTd, l.cp);
      mark += l.q * Q.mid;
      close += exp ? l.q * Q.mid : l.q * (l.q > 0 ? Q.bid : Q.ask);
    });
    const markPnl = (mark - P.entry) * 100 * P.n - P.feeIn;
    const closePnl = (close - P.entry) * 100 * P.n - P.feeIn - (exp ? 0 : P.feeSide);
    return { mark, close, markPnl, closePnl, markPct: (markPnl / P.cap) * 100, closePct: (closePnl / P.cap) * 100 };
  }

  // ---------------------------------------------------------------- 历史随机
  let G = null;
  function setupView(root) {
    const pr = pref();
    const sym = pr.sym || "TQQQ", key = pr.key || "straddle", dcal = pr.dcal || 30;
    root.innerHTML = A.LOADING("抽一段历史…");
    pickQ(sym).then((q) => {
      G = { q, sym, key, dcal, shift: 0, n: 1, j: 0, tp: pr.tp ?? 0.2, sl: pr.sl ?? null, done: false, log: [] };
      renderSetup(root);
    }).catch(() => { root.innerHTML = A.FAIL("题库加载失败"); });
  }
  function pills(name, items, cur) { return `<div class="pills" data-g="${name}">${items.map(([v, t]) => `<button data-v="${v}" class="${String(v) === String(cur) ? "on" : ""}">${t}</button>`).join("")}</div>`; }
  function renderSetup(root) {
    const q = G.q, e = q.e, p = META.params[G.sym], S0 = q.k[e][3];
    const P = buildPos(G.sym, G.key, G.dcal, G.shift, G.n, S0, q.v[e]);
    G.P = P;
    const be = breakevens(P, Array.from({ length: 241 }, (_, k) => S0 * (0.4 + k * 0.005)));
    const st = META.stats[`${G.sym}|${G.key}|${G.dcal}`];
    root.innerHTML = `<div class="lab">标的</div>${pills("sym", META.syms.map((s) => [s, s]), G.sym)}
      <div class="lab">做法</div>${pills("key", Object.entries(META.strats).map(([k, s]) => [k, s.name.replace(/（.*）/, "")]), G.key)}
      <div class="lab">到期</div>${pills("dcal", META.dcal.map((d) => [d, d + " 天"]), G.dcal)}
      <div class="hd"><div class="big">${usd(P.credit ? -P.entry * 100 * P.n : P.entry * 100 * P.n + P.feeIn)}<small>${P.credit ? "先收到（扣手续费前）· 押金 " + usd(P.cap) : "一共要付（含手续费）"}</small></div>
        <div class="hs">现价 <b>${S0.toFixed(2)}</b><br>${be.length ? "回本 " + be.map((x) => `<b>${x.toFixed(2)}</b>（${sg((x / S0 - 1) * 100, 0)}）`).join(" / ") : "—"}</div></div>
      <div class="kp">行权价 <button data-k="-1">−</button><b>${P.legs.map((l) => `${l.q > 0 ? "买" : "卖"} ${l.K} ${l.cp === "C" ? "call" : "put"}`).join(" + ")}</b><button data-k="1">+</button></div>
      <div class="kp">几套 <button data-n="-1">−</button><b>${G.n}</b><button data-n="1">+</button><span class="muted small">1 套 = 每条腿 1 张（100 股）</span></div>
      <div class="ch" id="osk"></div>
      <div class="ch2" id="osp"></div>
      <div class="btns" style="grid-template-columns:2fr 1fr"><button class="b" id="go">开仓 ▶<small>按今天收盘价成交，之后逐日推进</small></button><button class="g" id="another">换一段 ↻</button></div>
      <div class="card"><b>${esc(META.strats[G.key].name)}</b>：${esc(META.strats[G.key].one)}
        <div class="muted small" style="margin-top:4px">每张：${P.legs.map((l) => `${l.K} ${l.cp === "C" ? "call" : "put"} 中间价 ${l.mid0.toFixed(2)}、${l.q > 0 ? "按卖价买" : "按买价卖"} ${l.px0.toFixed(2)}`).join("；")}；
          平值隐含波动率约 ${(atmIV(p, q.v[e], META.td[G.dcal]) * 100).toFixed(0)}%（VXN ${q.v[e][3]}）。</div>
        ${st ? `<div class="muted small" style="margin-top:4px">历史参考（2011 起每天都开一套、拿到剩 1/4 时间卖，扣价差手续费）：胜率 <b>${Math.round(st.win * 100)}%</b>、平均 <b class="${cls(st.avg)}">${sg(st.avg * 100)}</b>、中位数 ${sg(st.med * 100)}。</div>` : ""}</div>`;
    root.querySelectorAll(".pills").forEach((g) => g.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const k = g.dataset.g, v = b.dataset.v;
      if (k === "sym") { setPref({ sym: v }); setupView(root); return; }
      if (k === "key") { G.key = v; G.shift = 0; setPref({ key: v }); }
      if (k === "dcal") { G.dcal = +v; setPref({ dcal: +v }); }
      renderSetup(root);
    })));
    root.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { G.shift += +b.dataset.k; renderSetup(root); }));
    root.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => { G.n = Math.max(1, Math.min(10, G.n + +b.dataset.n)); renderSetup(root); }));
    root.querySelector("#another").addEventListener("click", () => setupView(root));
    root.querySelector("#go").addEventListener("click", () => { G.j = 0; playView(root); });
    const bars = q.k.slice(0, e + 1);
    drawK("osk", bars, { lines: P.legs.map((l) => [l.K, `${l.K}${l.cp === "C" ? "C" : "P"}`, l.cp === "C" ? UP : DN, true]).concat(be.map((x) => [x, "回本", "#7c3aed", true])) });
    const T0 = META.td[G.dcal];
    drawPay("osp", P, S0, (S) => valueAt(P, q.v[e], S, T0 - 1).markPnl, { nowName: "明天（隐含波动率不变）" });
  }
  function playView(root) {
    const q = G.q, e = q.e, P = G.P, n = META.td[G.dcal];
    root.innerHTML = `<div class="hd"><div class="big" id="obig">—<small>浮盈亏</small></div><div class="hs" id="ohs"></div></div>
      <div class="ch" id="osk"></div><div class="toast" id="omsg"></div>
      <div id="octl"></div><div class="ch2" id="osp"></div><div id="ores"></div>`;
    function cur() {
      const j = G.j, i = e + j, S = q.k[i][3], tau = n - j;
      return { j, i, S, tau, V: valueAt(P, q.v[i], S, tau) };
    }
    function head() {
      const c = cur(), chg = (q.k[c.i][3] / q.k[c.i - 1][3] - 1) * 100;
      document.getElementById("obig").innerHTML = `<span class="${cls(c.V.markPnl)}">${sg(c.V.markPct)}</span><small>浮盈亏 ${usdS(c.V.markPnl)}（按中间价，券商 App 显示的）</small>`;
      document.getElementById("ohs").innerHTML = `第 <b>${c.j}</b>/${n} 天 · 剩 <b>${c.tau}</b> 天<br>${G.sym} <b>${c.S.toFixed(2)}</b> <span class="${cls(chg)}">${c.j ? sg(chg) : ""}</span>（开仓 ${P.S0.toFixed(2)}，${sg((c.S / P.S0 - 1) * 100)}）<br>现在平仓能拿到 <b class="${cls(c.V.closePnl)}">${usdS(c.V.closePnl)}</b>`;
      drawK("osk", q.k.slice(0, c.i + 1), { e, lines: P.legs.map((l) => [l.K, `${l.K}${l.cp}`, l.cp === "C" ? UP : DN, true]) });
      drawPay("osp", P, P.S0, (S) => valueAt(P, q.v[c.i], S, c.tau).markPnl, { nowName: `第 ${c.j} 天（还剩 ${c.tau} 天）`, cur: c.S });
    }
    function ctl() {
      if (G.done) { document.getElementById("octl").innerHTML = ""; return; }
      document.getElementById("octl").innerHTML = `<div class="btns"><button class="n" data-a="next">下一天 ▶</button><button class="g" data-a="j5">跳 5 天 ⏩</button><button class="s" data-a="close">平仓<small>按收盘卖价</small></button></div>
        <div class="stp">止盈 ${[0.1, 0.2, 0.3, 0.5, 1, null].map((t) => `<button data-tp="${t}" class="${G.tp === t ? "on" : ""}">${t == null ? "不设" : "+" + Math.round(t * 100) + "%"}</button>`).join("")}</div>
        <div class="stp">止损 ${[0.3, 0.5, null].map((t) => `<button data-sl="${t}" class="${G.sl === t ? "on" : ""}">${t == null ? "不设" : "−" + Math.round(t * 100) + "%"}</button>`).join("")}<span class="small">（每天收盘按浮盈亏判断，碰到就按收盘价平）</span></div>`;
      const box = document.getElementById("octl");
      box.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => act(b.dataset.a)));
      box.querySelectorAll("[data-tp]").forEach((b) => b.addEventListener("click", () => { G.tp = b.dataset.tp === "null" ? null : +b.dataset.tp; setPref({ tp: G.tp }); ctl(); }));
      box.querySelectorAll("[data-sl]").forEach((b) => b.addEventListener("click", () => { G.sl = b.dataset.sl === "null" ? null : +b.dataset.sl; setPref({ sl: G.sl }); ctl(); }));
    }
    function step() {
      if (G.j >= n) return;
      G.j += 1;
      const c = cur();
      if (c.tau <= 0) return finish("expiry");
      const pct = c.V.markPct / 100;
      if (G.tp != null && pct >= G.tp) return finish("tp");
      if (G.sl != null && pct <= -G.sl) return finish("sl");
    }
    function act(a) {
      if (a === "close") return finish("manual");
      const k = a === "j5" ? 5 : 1;
      for (let t = 0; t < k && !G.done; t++) step();
      if (!G.done) { head(); document.getElementById("omsg").textContent = `第 ${G.j} 天收盘。${G.tp != null ? "止盈 +" + Math.round(G.tp * 100) + "%" : "没设止盈"}${G.sl != null ? "，止损 −" + Math.round(G.sl * 100) + "%" : ""}。`; }
    }
    function finish(how) {
      G.done = true;
      const c = cur(), V = c.V, ret = V.closePct, pnl = V.closePnl;
      head(); ctl();
      const why = { expiry: "到期了，按内在价值结算", tp: "收盘碰到止盈，按收盘卖价平仓", sl: "收盘碰到止损，按收盘卖价平仓", manual: "你按收盘卖价平仓" }[how];
      document.getElementById("omsg").textContent = why + "。";
      const ds = qDates(q), f = q.info.f || 1, reg = { up: "上涨段", down: "下跌段", range: "震荡段", crash: "暴跌段" }[q.r] || "";
      const st = META.stats[`${G.sym}|${G.key}|${G.dcal}`];
      const lab = META.lab && G.key === "straddle" && (G.sym === "TQQQ" || G.sym === "QQQ") ? META.lab.sim[`${G.sym}|${G.dcal}|0.0|${G.tp == null ? "none" : G.tp === 1 ? "1.0" : G.tp}`] : null;
      const S = store();
      S.games.push({ id: q.id, s: G.sym, k: G.key, d: G.dcal, n: G.n, ret: +ret.toFixed(2), pnl: Math.round(pnl), days: c.j, how, tp: G.tp, sl: G.sl, r: q.r, t: Date.now() });
      S.seen = [...(S.seen || []), q.id].slice(-500); save(S);
      document.getElementById("ores").innerHTML = `<div class="card"><h3>结算：<span class="${cls(pnl)}">${usdS(pnl)}（${sg(ret)}）</span></h3>
        <div class="kv"><div><b>${usd(P.credit ? -P.entry * 100 * P.n : P.entry * 100 * P.n + P.feeIn)}</b><span>${P.credit ? "开仓收到" : "开仓付出"}</span></div><div><b>${c.j} 天</b><span>拿了几天</span></div>
          <div><b class="${cls(c.S - P.S0)}">${sg((c.S / P.S0 - 1) * 100)}</b><span>${G.sym} 这段涨跌</span></div></div>
        <p style="font-size:14.5px;line-height:1.6;margin:6px 0">揭晓：<b>${ds[e + 1] || ""} ~ ${ds[c.i] || ""}</b>（${reg}）。开仓那天 ${G.sym} 真实收盘（复权价）$${q.info.px}，VXN ${q.info.vx}；图上价格按今天价位乘了 ${(f).toFixed(2)} 倍。</p>
        ${st ? `<p class="muted" style="margin:4px 0">如果每天都这么开（2011 起、拿到剩 1/4 时间卖、扣价差手续费）：胜率 <b>${Math.round(st.win * 100)}%</b>、平均 <b class="${cls(st.avg)}">${sg(st.avg * 100)}</b>、中位数 ${sg(st.med * 100)}；最差的一成 ${sg(st.p10 * 100, 0)}、最好的一成 ${sg(st.p90 * 100, 0)}。</p>` : ""}
        ${lab ? `<p class="muted" style="margin:4px 0">同样「每天都开、${G.tp == null ? "不止盈" : "止盈 +" + Math.round(G.tp * 100) + "%"}」、一次只拿一套：${lab.n} 笔，胜率 <b>${Math.round(lab.win * 100)}%</b>、平均 <b class="${cls(lab.avg)}">${sg(lab.avg * 100)}</b>。<a href="#/labs/straddle">完整检验 ›</a></p>` : ""}
        <div class="btns" style="grid-template-columns:1fr 1fr"><button class="n" id="again">再来一局 ▶</button><button class="g" id="tome">我的成绩</button></div></div>`;
      document.getElementById("again").addEventListener("click", () => setupView(root));
      document.getElementById("tome").addEventListener("click", () => { location.hash = "#/optsim/me"; });
      drawK("osk", q.k.slice(0, Math.min(q.k.length, c.i + 6)), { e, dates: ds, lines: P.legs.map((l) => [l.K, `${l.K}${l.cp}`, l.cp === "C" ? UP : DN, true]) });
      if (S.games.length % 20 === 0) document.getElementById("ores").insertAdjacentHTML("afterbegin", `<div class="rep"><h3>满 ${S.games.length} 局了</h3><p>你的小结出来了，<a style="color:#fff;text-decoration:underline" href="#/optsim/me">点这里看</a>。</p></div>`);
    }
    head(); ctl();
    document.getElementById("omsg").textContent = `开仓：${P.legs.map((l) => `${l.q > 0 ? "买" : "卖"} ${l.K} ${l.cp === "C" ? "call" : "put"}`).join(" + ")}，${G.dcal} 天到期。点「下一天」往后走。`;
  }

  // ---------------------------------------------------------------- 今天（真实链）
  function todayView(root) {
    const pr = pref(), sym = pr.tsym || "TQQQ", key = pr.key || "straddle";
    const T = TODAY && TODAY.syms[sym];
    if (!T || !T.exps.length) { root.innerHTML = '<div class="card">今天的期权报价还没取到（每次网站发布时刷新）。</div>'; return; }
    const exps = T.exps.filter((x) => x.dte >= 3);
    const want = pr.texp && exps.find((x) => x.exp === pr.texp) ? pr.texp : (exps.slice().sort((a, b) => Math.abs(a.dte - 30) - Math.abs(b.dte - 30))[0] || exps[0]).exp;
    const E = exps.find((x) => x.exp === want), S0 = T.S;
    const rows = E.k, Ks = rows.map((r) => r[0]);
    const st = META.strats[key];
    const shift = +(pr.tshift || 0);
    const near = (k) => Ks.reduce((bi, x, i) => (Math.abs(x - k) < Math.abs(Ks[bi] - k) ? i : bi), 0);
    const legs0 = st.legs.map(([cp, m, q]) => ({ cp, q, i: Math.max(0, Math.min(Ks.length - 1, near(S0 * (1 + m)) + shift)) }));
    const quote = (l) => { const r = rows[l.i]; const b = l.cp === "C" ? r[1] : r[3], a = l.cp === "C" ? r[2] : r[4]; return { mid: (a + b) / 2, bid: b, ask: a, iv: l.cp === "C" ? r[5] : r[6] }; };
    const P = { sym, key, dcal: E.dte, n: 1, S0 };
    P.legs = legs0.map((l) => { const Q = quote(l); return { cp: l.cp, q: l.q, K: Ks[l.i], bid: Q.bid, ask: Q.ask, mid0: Q.mid, px0: l.q > 0 ? Q.ask : Q.bid, iv: Q.iv, spr: (Q.ask - Q.bid) / Math.max(Q.mid, 0.01) }; });
    P.entry = P.legs.reduce((s, l) => s + l.q * l.px0, 0);
    P.feeSide = P.legs.length * META.fee.c + META.fee.o; P.feeIn = P.feeSide; P.credit = P.entry < 0;
    const shortK = Math.max(0, ...P.legs.filter((l) => l.q < 0 && l.cp === "P").map((l) => l.K));
    P.cap = P.entry > 0 ? P.entry * 100 + P.feeIn : shortK * 100;
    const be = breakevens(P, Array.from({ length: 241 }, (_, k) => S0 * (0.4 + k * 0.005)));
    const wide = P.legs.some((l) => l.spr > 0.15);
    const tdays = Math.max(E.dte * 252 / 365, 0.5);
    const after = (S, d) => { // d 个交易日后，隐含波动率不变、按当前价差比例卖出
      let v = 0; P.legs.forEach((l) => { const tt = Math.max(tdays - d, 0) / 252, m = bs(S, l.K, tt, l.iv, l.cp), hs = m * Math.min(l.spr, 0.3) / 2; v += l.q * (l.q > 0 ? Math.max(m - hs, 0) : m + hs); });
      return (v - P.entry) * 100 - P.feeIn - P.feeSide;
    };
    const mv = sym === "TQQQ" || sym === "NVDA" ? [0.04, 0.08, 0.15] : [0.01, 0.02, 0.04];
    root.innerHTML = `<div class="lab">标的</div>${pills("tsym", META.syms.map((s) => [s, s]), sym)}
      <div class="lab">做法</div>${pills("key", Object.entries(META.strats).map(([k, s]) => [k, s.name.replace(/（.*）/, "")]), key)}
      <div class="lab">到期日（剩几天）</div>${pills("texp", exps.map((x) => [x.exp, `${x.exp.slice(5)}（${x.dte}${x.m ? "·月" : ""}）`]), want)}
      <div class="hd"><div class="big">${usd(P.credit ? -P.entry * 100 : P.entry * 100 + P.feeIn)}<small>${P.credit ? "先收到 · 押金 " + usd(P.cap) : "买一套要付（按卖价 + 手续费）"}</small></div>
        <div class="hs">${sym} 现价 <b>${S0.toFixed(2)}</b><br>${be.length ? "到期回本 " + be.map((x) => `<b>${x.toFixed(2)}</b>（${sg((x / S0 - 1) * 100, 0)}）`).join(" / ") : "—"}</div></div>
      <div class="kp">行权价 <button data-k="-1">−</button><b>${P.legs.map((l) => `${l.q > 0 ? "买" : "卖"} ${l.K} ${l.cp === "C" ? "call" : "put"}`).join(" + ")}</b><button data-k="1">+</button></div>
      ${wide ? '<div class="warn">这份报价买卖价差很宽（多半是收盘后或盘前的报价），真实成交价可能好一些；盘中再看一次。</div>' : ""}
      <div class="ch" id="osk"></div><div class="ch2" id="osp"></div>
      <div class="card"><h3>明天 ${sym} 涨跌多少，这一套大概赚亏多少</h3><div class="muted small">隐含波动率不变、按卖价平仓、扣两边手续费</div>
        <div class="tw"><table><tr><th>明天</th><th>盈亏</th><th>明天</th><th>盈亏</th></tr>
        ${mv.map((m) => { const a = after(S0 * (1 - m), 1), b = after(S0 * (1 + m), 1); return `<tr><td>跌 ${Math.round(m * 100)}%</td><td class="${cls(a)}">${usdS(a)}</td><td>涨 ${Math.round(m * 100)}%</td><td class="${cls(b)}">${usdS(b)}</td></tr>`; }).join("")}
        <tr><td>不动</td><td class="${cls(after(S0, 1))}">${usdS(after(S0, 1))}</td><td>一周不动</td><td class="${cls(after(S0, 5))}">${usdS(after(S0, 5))}</td></tr></table></div>
        <div class="muted small">每张真实报价：${P.legs.map((l) => `${l.K} ${l.cp === "C" ? "call" : "put"} 买 ${l.bid.toFixed(2)} / 卖 ${l.ask.toFixed(2)}、隐含波动率 ${(l.iv * 100).toFixed(0)}%`).join("；")}。CBOE 延迟报价 ${esc(T.ts)}（UTC）。</div></div>`;
    root.querySelectorAll(".pills").forEach((g) => g.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const k = g.dataset.g, v = b.dataset.v;
      if (k === "tsym") setPref({ tsym: v, texp: null, tshift: 0 });
      if (k === "key") setPref({ key: v, tshift: 0 });
      if (k === "texp") setPref({ texp: v });
      todayView(root);
    })));
    root.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { setPref({ tshift: shift + +b.dataset.k }); todayView(root); }));
    if (T.bars && T.bars.length) drawK("osk", T.bars.map((r) => [r[1], r[2], r[3], r[4]]), { dates: T.bars.map((r) => r[0]), lines: P.legs.map((l) => [l.K, `${l.K}${l.cp}`, l.cp === "C" ? UP : DN, true]).concat(be.map((x) => [x, "回本", "#7c3aed", true])) });
    drawPay("osp", P, S0, (S) => after(S, 5), { nowName: "1 周后（隐含波动率不变）" });
  }

  // ---------------------------------------------------------------- 我的成绩
  function meView(root) {
    const S = store(), gs = S.games || [];
    if (!gs.length) { root.innerHTML = '<div class="card">还没玩过。去「历史随机」开一局吧。</div>'; return; }
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const by = {};
    gs.forEach((g) => { (by[g.k] = by[g.k] || []).push(g); });
    const last20 = gs.slice(-20), w20 = last20.filter((g) => g.pnl > 0).length;
    const avg20 = sum(last20.map((g) => g.ret)) / last20.length;
    const hit = last20.filter((g) => g.how === "tp").length;
    const main = Object.entries(by).sort((a, b) => b[1].length - a[1].length)[0];
    const st = main && META.stats[`${main[1][0].s}|${main[0]}|${main[1][0].d}`];
    root.innerHTML = `<div class="rep"><h3>最近 ${last20.length} 局</h3>
        <p>赚钱 <b>${w20}</b> 局（${Math.round((w20 / last20.length) * 100)}%），平均每局 <b>${sg(avg20)}</b>，合计 <b>${usdS(sum(last20.map((g) => g.pnl)))}</b>；碰到止盈 ${hit} 次。</p>
        ${st ? `<p>你最常玩的「${esc(META.strats[main[0]].name)}」，历史上每天都开：胜率 ${Math.round(st.win * 100)}%、平均 ${sg(st.avg * 100)}。${last20.length < 10 ? "局数还少，结果主要是运气，多玩几局再比。" : avg20 > st.avg * 100 + 5 ? "你这几局比历史平均好——多半是运气，样本太少，再玩 20 局看看。" : avg20 < st.avg * 100 - 5 ? "你这几局比历史平均差，看看是不是拿太久、或者总在止损。" : "和历史平均差不多：这就是这种做法的真实样子。"}</p>` : ""}</div>
      <div class="card"><div class="tw"><table><tr><th>做法</th><th>局数</th><th>胜率</th><th>平均</th><th>合计</th></tr>
        ${Object.entries(by).map(([k, L]) => `<tr><td>${esc(META.strats[k] ? META.strats[k].name : k)}</td><td>${L.length}</td><td>${Math.round((L.filter((g) => g.pnl > 0).length / L.length) * 100)}%</td><td class="${cls(sum(L.map((g) => g.ret)))}">${sg(sum(L.map((g) => g.ret)) / L.length)}</td><td class="${cls(sum(L.map((g) => g.pnl)))}">${usdS(sum(L.map((g) => g.pnl)))}</td></tr>`).join("")}</table></div></div>
      <div class="card"><h3>最近 10 局</h3><div class="tw"><table><tr><th>标的 · 做法</th><th>天数</th><th>怎么结束</th><th>盈亏</th></tr>
        ${gs.slice(-10).reverse().map((g) => `<tr><td>${g.s} · ${esc((META.strats[g.k] || {}).name || g.k).replace(/（.*）/, "")} · ${g.d} 天</td><td>${g.days}</td><td>${{ tp: "止盈", sl: "止损", expiry: "到期", manual: "手动平" }[g.how] || ""}</td><td class="${cls(g.pnl)}">${usdS(g.pnl)}（${sg(g.ret)}）</td></tr>`).join("")}</table></div>
        <p class="muted small">成绩只存在这台设备里。<a href="javascript:void 0" id="reset">清空成绩</a></p></div>`;
    root.querySelector("#reset").addEventListener("click", () => { if (confirm("清空期权模拟的全部成绩？")) { save({ games: [], seen: [] }); meView(root); } });
  }

  // ---------------------------------------------------------------- 页面
  const MODES = [["", "历史随机"], ["today", "今天的真实价格"], ["me", "我的成绩"]];
  function render(m) {
    const root = document.getElementById("oroot");
    const head = document.getElementById("omodes");
    head.innerHTML = MODES.map(([k, t]) => `<a href="#/optsim${k ? "/" + k : ""}" class="${(m || "") === k ? "on" : ""}">${t}</a>`).join("");
    Object.keys(charts).forEach((k) => { try { charts[k].dispose(); } catch (e) { /* 已释放 */ } delete charts[k]; });
    if (m === "today") {
      root.innerHTML = A.LOADING("读取今天的期权报价…");
      (TODAY ? Promise.resolve(TODAY) : A.getJSON("optsim/today.json", true).then((t) => (TODAY = t))).then(() => todayView(root)).catch(() => { root.innerHTML = A.FAIL("今天的报价加载失败"); });
    } else if (m === "me") meView(root);
    else setupView(root);
  }
  window.__mod_optsim = {
    page(m) {
      document.title = "期权模拟 · 小七投研";
      const L = (META && META.lab) || null;
      A.app.innerHTML = `<div class="osm"><h1 style="margin-bottom:4px">期权模拟</h1><div class="modes" id="omodes"></div><div id="oroot">${A.LOADING()}</div>
        <details class="f"><summary>怎么玩 · 价格怎么算的 ›</summary><ul>
          <li>历史随机：从 2011 年以来抽一段（TQQQ 300 段、QQQ / SPY / NVDA 各 150 段，上涨 / 下跌 / 震荡 / 暴跌大约各占一份），先给你看开仓前 60 根日K，价格按今天的价位等比换算、日期藏起来。</li>
          <li>选做法、到期天数、行权价、几套，点「开仓」按当天收盘成交；之后每点一次「下一天」走一个交易日，大字是券商 App 会显示的浮盈亏（按中间价），「现在平仓能拿到」是按买价卖出、扣手续费后的真实到手。</li>
          <li>止盈 / 止损每天收盘判断，碰到就按收盘价平（真实里可以挂单盘中成交，见检验报告第六节）。到期按内在价值结算。</li>
          <li>没有历史期权报价，价格是模型算的：Black-Scholes；平值隐含波动率 = VXN（SPY 用 VIX）× 期限因子 × 倍数（TQQQ 约 2.6 倍，用今天的真实期权链和网上 5 个时点校准；NVDA 再乘它相对纳指的波动）；
            价外 put 更贵（微笑）；买卖价差按 VXN 高低分档（平静时 ×0.6）；手续费每张 $0.65 + 每笔 $1.99。NVDA 财报前期权会更贵，模型没算。</li>
          <li>「今天的真实价格」用 CBOE 延迟报价的买价 / 卖价，每次网站发布刷新；收盘后的报价价差会变宽。</li>
          ${L ? `<li>检验结论：TQQQ 一个月平值跨式「每天都开 + 止盈 +20%」${L.main.n} 笔，胜率 ${Math.round(L.main.win * 100)}%、平均 ${sg(L.main.avg * 100)}，不是必胜（<a href="#/labs/straddle">#/labs/straddle</a>）。</li>` : ""}
          <li>成绩只存在这台设备里，每 20 局出一张小结。这是练习工具，不是买卖建议。</li></ul></details></div>${A.DISC}`;
      const tok = A.tok();
      Promise.all([A.getJSON("optsim.json"), A.need("lib")]).then(([M]) => {
        if (!A.alive(tok)) return;
        META = M;
        render(m || "");
      }).catch(() => { if (A.alive(tok)) document.getElementById("oroot").innerHTML = A.FAIL(); });
    },
  };
})();
