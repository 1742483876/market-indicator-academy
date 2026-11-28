/* 小七投研 · 🕹 K 线训练 #/train（读 train.json + train/q_*.json，train_build.py 生成）
   2026-11-25 老大：「这个博主教学的也可以整合一下，我需要 k 线训练」——整合抖音「Joy讲交易」《千盘试炼》的玩法与方法卡。
   玩法：随机一段历史（隐藏名称和日期，价格换算成起点 100），先看 120 根日K，逐根往后推；每步可以 买半仓 / 买全仓 / 卖一半 / 全卖 / 观望，可设止损；
        按「下一根开盘价」成交（收盘看到信号、第二天开盘下单），买入当天不能卖（T+1），成本 个股 0.15% / 指数·ETF 0.05% 每边；
        走完 60 根结算：这一局收益 vs 一直拿着、最大回撤、交易次数、胜率；揭晓名称日期，图上标出每笔买卖点。
   出题：今日一题（按日期固定，所有人同一题）/ 自由练 / Joy 方法题（停在形态出现那根，问买·等·卖，揭晓后 20 根 + 方法卡 + 原视频）/ 我们的信号题（附检验结论）。
   成绩只存本机 localStorage（xq_train_v1），每 20 局出一张「你的交易习惯报告」。手机竖屏优先：首屏 = 大字盈亏 + 图 + 大按钮，说明默认折叠。 */
(function () {
  const A = window.__APP;
  const { esc } = A;
  const KEY = "xq_train_v1";
  const sg = (v, d = 2) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%");
  const pp = (v) => (v == null || isNaN(v) ? "—" : Math.abs(v).toFixed(1) + " 个点");
  const cls = (v) => (v == null || isNaN(v) || Math.abs(v) < 0.005 ? "" : v > 0 ? "up" : "dn");
  const UP = "#e5484d", DN = "#1f9d55";
  const MAC = { 5: "#f0a020", 10: "#2f7fd8", 20: "#a855f7", 40: "#0ea5a4", 60: "#64748b" };
  let META = null, MOUNT = null;
  const SH = {};

  if (!document.getElementById("trn-css")) {
    const st = document.createElement("style");
    st.id = "trn-css";
    st.textContent = `.trn{max-width:980px;overflow-wrap:anywhere}
.trn .modes{display:flex;gap:6px;overflow-x:auto;margin:2px 0 8px;padding-bottom:2px;scrollbar-width:none}.trn .modes::-webkit-scrollbar{display:none}
.trn .modes a{flex:none;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 12px;font-size:14px;color:var(--text);white-space:nowrap}
.trn .modes a.on{background:#1f2328;color:#fff;border-color:#1f2328}
.trn .hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 2px 4px}
.trn .big{font-size:34px;font-weight:900;line-height:1.05;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.trn .big small{display:block;font-size:12px;font-weight:600;color:var(--sub);margin-top:2px;letter-spacing:0}
.trn .hs{font-size:13px;color:var(--sub);text-align:right;line-height:1.45;font-variant-numeric:tabular-nums}
.trn .hs b{color:var(--text)}
.trn .up{color:var(--up)}.trn .dn{color:var(--dn)}
.trn .ch{width:100%;height:430px;background:var(--card);border:1px solid var(--line);border-radius:12px}
@media (max-width:600px){.trn .ch{height:320px}.trn .big{font-size:30px}.trn .mas .mh{display:none}.trn .btns button{min-height:50px}.trn .toast{font-size:12.5px;margin-bottom:4px}.trn h1{font-size:20px}}
.trn .mas{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px;align-items:center;font-size:12.5px;color:var(--sub)}
.trn .mas button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:3px 8px;font-size:12.5px;color:var(--sub);cursor:pointer}
.trn .mas button.on{color:#fff;border-color:transparent}
.trn .btns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}
.trn .btns button{min-height:54px;border-radius:12px;border:0;font-size:17px;font-weight:800;cursor:pointer;color:#fff;touch-action:manipulation}
.trn .btns button small{display:block;font-size:11.5px;font-weight:600;opacity:.9}
.trn .btns .b{background:var(--up)}.trn .btns .s{background:var(--dn)}.trn .btns .n{background:#1f2328}.trn .btns .g{background:#eef0f3;color:var(--text)}
.trn .btns button:disabled{opacity:.35;cursor:default}
.trn .stp{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:var(--sub);margin:2px 0 6px}
.trn .stp button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:5px 10px;font-size:13px;cursor:pointer;color:var(--text)}
.trn .stp button.on{background:#fff4e0;border-color:#d97706;color:#b45309;font-weight:700}
.trn .toast{font-size:13.5px;color:var(--sub);min-height:20px;margin:2px 2px 6px;line-height:1.5}
.trn .res{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin:8px 0}
.trn .res h3{margin:0 0 6px;font-size:17px}
.trn .kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}
.trn .kv div{background:var(--soft);border-radius:10px;padding:8px 10px}.trn .kv b{display:block;font-size:19px;font-variant-numeric:tabular-nums}.trn .kv span{font-size:12px;color:var(--sub)}
@media (max-width:420px){.trn .kv{grid-template-columns:repeat(2,minmax(0,1fr))}}
.trn .reveal{font-size:15px;line-height:1.6;margin:6px 0}
.trn .err{font-size:13.5px;line-height:1.6;margin:4px 0;padding-left:18px}
.trn .card2{background:var(--card);border:1px solid var(--line);border-left:5px solid #7c3aed;border-radius:12px;padding:10px 14px;margin:8px 0}
.trn .card2 h4{margin:0 0 4px;font-size:16px}.trn .card2 .one{font-size:15px;margin:4px 0 6px;border:0;padding:0;background:none}
.trn .card2 ol,.trn .card2 ul{margin:4px 0;padding-left:20px;font-size:13.5px;line-height:1.7}
.trn .card2 .q{font-size:12.5px;color:var(--sub);line-height:1.6;margin-top:4px}
.trn .lv{font-style:normal;font-size:12px;font-weight:700;border-radius:6px;padding:2px 7px;white-space:nowrap}
.trn .lv.ok{background:#e7f6ee;color:#1d7a4c}.trn .lv.part{background:#fff4d6;color:#8a5a00}.trn .lv.no{background:#eef0f3;color:#6b7280}
.trn .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
.trn .pick{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}
.trn .pick a{border:1px solid var(--line);border-radius:8px;padding:4px 9px;font-size:13px;background:var(--card);color:var(--text)}
.trn .pick a.on{border-color:#7c3aed;color:#7c3aed;font-weight:700}
.trn details.f{margin:10px 0}.trn details.f>summary{cursor:pointer;color:var(--brand);font-size:14px;list-style:none;padding:4px 0}
.trn details.f>summary::-webkit-details-marker{display:none}
.trn details.f ul,.trn details.f ol{margin:4px 0 0;padding-left:20px;font-size:13.5px;line-height:1.75}
.trn .lst{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:2px 12px}
.trn .lst .r{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px;line-height:1.5}.trn .lst .r:last-child{border-bottom:0}
.trn .lst .r span:last-child{white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
.trn .rep{background:linear-gradient(135deg,#312e81,#7c3aed);color:#fff;border-radius:16px;padding:14px 16px;margin:8px 0}
.trn .rep h3{margin:0 0 6px;font-size:18px}.trn .rep p{margin:5px 0;font-size:14.5px;line-height:1.6}.trn .rep b{font-size:16px}
.trn .qa{font-size:17px;font-weight:800;margin:6px 2px}`;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- 数据
  const dec = (x) => { try { return JSON.parse(decodeURIComponent(escape(atob(x)))); } catch (e) { return { n: "?", s: "", t: "" }; } };
  function dates(q) {
    const out = [q.d0];
    let t = new Date(q.d0 + "T00:00:00Z").getTime();
    q.dd.forEach((g) => { t += g * 86400000; out.push(new Date(t).toISOString().slice(0, 10)); });
    return out;
  }
  function shard(name) {
    if (SH[name]) return Promise.resolve(SH[name]);
    return A.getJSON("train/" + name).then((x) => (SH[name] = x));
  }
  function getQ(id) {
    const c = META.cat.find((r) => r[0] === id);
    if (!c) return Promise.reject(new Error("没有这道题"));
    return shard(c[1]).then((L) => prep(L[c[2]]));
  }
  function prep(q) {
    if (q._p) return q;
    const k = q.k, n = k.length;
    q.O = k.map((r) => r[0] / 100); q.H = k.map((r) => r[1] / 100); q.L = k.map((r) => r[2] / 100); q.C = k.map((r) => r[3] / 100); q.V = k.map((r) => r[4]);
    const ema = (x, p) => { const a = 2 / (p + 1), o = []; x.forEach((v, i) => o.push(i ? a * v + (1 - a) * o[i - 1] : v)); return o; };
    const ma = (p) => { const o = []; let s = 0; for (let i = 0; i < n; i++) { s += q.C[i]; if (i >= p) s -= q.C[i - p]; o.push(i >= p - 1 ? s / p : null); } return o; };
    const e12 = ema(q.C, 12), e26 = ema(q.C, 26);
    q.dif = e12.map((v, i) => v - e26[i]); q.dea = ema(q.dif, 9); q.mh = q.dif.map((v, i) => 2 * (v - q.dea[i]));
    q.ma = {}; [5, 10, 20, 40, 60].forEach((p) => (q.ma[p] = ma(p)));
    q.info = dec(q.x); q.D = dates(q);
    q.stk = q.info.t === "big" || q.info.t === "stk";
    q._p = 1;
    return q;
  }
  const store = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { games: [], seen: [] }; } catch (e) { return { games: [], seen: [] }; } };
  const save = (S) => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 存不下就算了 */ } };
  const bj = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  function todayId() {
    const fr = META.cat.filter((r) => r[3] === "free");
    let h = 2166136261;
    for (const ch of bj()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return fr[h % fr.length][0];
  }
  function pickId(m, c) {
    const S = store(), seen = new Set(S.seen || []);
    let L = META.cat.filter((r) => r[3] === m && (!c || r[4] === c));
    if (!L.length) return null;
    const fresh = L.filter((r) => !seen.has(r[0]));
    if (fresh.length) L = fresh;
    return L[Math.floor(Math.random() * L.length)][0];
  }
  const cardOf = (k) => (META.cards || []).find((c) => c.key === k) || (META.cards || []).find((c) => c.q === k);
  const ourOf = (k) => (META.our || []).find((c) => c.key === k);
  const lvTag = (v) => (v === "✅" ? '<i class="lv ok">✅ 成立</i>' : v === "⚠️" ? '<i class="lv part">⚠️ 部分成立</i>' : v ? '<i class="lv no">❌ 不成立</i>' : '<i class="lv no">没有检验</i>');

  // ---------------------------------------------------------------- 图
  let chart = null, MAON = { 5: 1, 10: 1, 20: 1, 40: 0, 60: 0 };
  try { const m = JSON.parse(localStorage.getItem(KEY + "_ma")); if (m) MAON = m; } catch (e) { /* 默认 */ }
  function draw(el, q, upto, o = {}) {
    const s0 = q.w, idx = [];
    for (let i = s0; i <= upto; i++) idx.push(i);
    const X = o.reveal ? idx.map((i) => q.D[i].slice(2)) : idx.map((i) => String(i - s0 + 1));
    const kd = idx.map((i) => [q.O[i], q.C[i], q.L[i], q.H[i]]);
    const series = [{ name: "K", type: "candlestick", data: kd, xAxisIndex: 0, yAxisIndex: 0, barMaxWidth: 10,
      itemStyle: { color: UP, color0: DN, borderColor: UP, borderColor0: DN }, markPoint: { data: [], symbolSize: 26, label: { fontSize: 10, fontWeight: 700 } }, markLine: { data: [], symbol: "none", silent: true } }];
    [5, 10, 20, 40, 60].forEach((p) => { if (MAON[p]) series.push({ name: "MA" + p, type: "line", data: idx.map((i) => q.ma[p][i]), showSymbol: false, lineStyle: { width: 1.2, color: MAC[p] }, xAxisIndex: 0, yAxisIndex: 0, silent: true }); });
    series.push({ name: "量", type: "bar", data: idx.map((i) => ({ value: q.V[i], itemStyle: { color: q.C[i] >= q.O[i] ? UP : DN, opacity: 0.7 } })), xAxisIndex: 1, yAxisIndex: 1, barMaxWidth: 10, silent: true });
    series.push({ name: "MACD", type: "bar", data: idx.map((i) => ({ value: +q.mh[i].toFixed(3), itemStyle: { color: q.mh[i] >= 0 ? UP : DN } })), xAxisIndex: 2, yAxisIndex: 2, barMaxWidth: 6, silent: true,
      markLine: { data: [{ yAxis: 0 }], symbol: "none", silent: true, lineStyle: { color: "#9aa1ab", type: "solid", width: 0.8 }, label: { show: false } } });
    series.push({ name: "DIF", type: "line", data: idx.map((i) => +q.dif[i].toFixed(3)), showSymbol: false, lineStyle: { width: 1, color: "#1f2328" }, xAxisIndex: 2, yAxisIndex: 2, silent: true });
    series.push({ name: "DEA", type: "line", data: idx.map((i) => +q.dea[i].toFixed(3)), showSymbol: false, lineStyle: { width: 1, color: "#f0a020" }, xAxisIndex: 2, yAxisIndex: 2, silent: true });
    const mp = series[0].markPoint.data, ml = series[0].markLine.data;
    (o.fills || []).forEach((f) => {
      if (f.i < s0 || f.i > upto) return;
      const b = f.side === "b";
      mp.push({ coord: [f.i - s0, b ? q.L[f.i] : q.H[f.i]], value: b ? "买" : "卖", symbol: "pin", symbolRotate: b ? 180 : 0, symbolOffset: [0, b ? 14 : -14],
        itemStyle: { color: b ? UP : DN }, label: { color: "#fff", offset: [0, b ? 3 : 0] } });
    });
    if (o.stop) ml.push({ yAxis: o.stop, lineStyle: { color: "#d97706", type: "dashed", width: 1.2 }, label: { formatter: "止损", color: "#b45309", fontSize: 10, position: "insideStartTop" } });
    if (o.cost) ml.push({ yAxis: o.cost, lineStyle: { color: "#7c3aed", type: "dotted", width: 1 }, label: { formatter: "成本", color: "#7c3aed", fontSize: 10, position: "insideEndTop" } });
    if (o.cut != null) ml.push({ xAxis: o.cut - s0, lineStyle: { color: "#7c3aed", type: "dashed", width: 1 }, label: { formatter: o.cutLabel || "", color: "#7c3aed", fontSize: 10 } });
    const len = idx.length;
    let span = o.span || (window.innerWidth < 600 ? 90 : 140);
    if (chart && !o.fresh) {
      try { const z = chart.getOption().dataZoom[0]; if (z && z.endValue != null) span = Math.max(20, z.endValue - z.startValue); } catch (e) { /* 用默认 */ }
    }
    const ax = (gi, show) => ({ type: "category", data: X, gridIndex: gi, boundaryGap: true, axisLine: { lineStyle: { color: "#e7e9ee" } }, axisTick: { show: false },
      axisLabel: { show, color: "#9aa1ab", fontSize: 10, hideOverlap: true }, splitLine: { show: false } });
    const yx = (gi, n) => ({ scale: true, gridIndex: gi, splitNumber: n, position: "right", axisLabel: { color: "#9aa1ab", fontSize: 10, inside: false, formatter: gi === 1 ? () => "" : undefined },
      splitLine: { lineStyle: { color: "#eef0f3" } }, axisLine: { show: false } });
    const opt = {
      animation: false,
      grid: [{ left: 4, right: 44, top: 8, height: "58%" }, { left: 4, right: 44, top: "66%", height: "10%" }, { left: 4, right: 44, top: "79%", height: "16%" }],
      xAxis: [ax(0, false), ax(1, false), ax(2, true)],
      yAxis: [yx(0, 4), yx(1, 1), yx(2, 2)],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1, 2], startValue: Math.max(0, len - 1 - span), endValue: len - 1, minValueSpan: 20 }],
      tooltip: { trigger: "axis", axisPointer: { type: "cross", link: [{ xAxisIndex: "all" }] }, confine: true, textStyle: { fontSize: 11 },
        formatter: (ps) => { const p = ps.find((x) => x.seriesName === "K"); if (!p) return ""; const i = idx[p.dataIndex]; const pc = i > 0 ? q.C[i - 1] : q.O[i];
          return `${o.reveal ? q.D[i] : "第 " + (i - s0 + 1) + " 根"}<br>开 ${q.O[i].toFixed(2)} 收 ${q.C[i].toFixed(2)}<br>高 ${q.H[i].toFixed(2)} 低 ${q.L[i].toFixed(2)}<br>涨跌 ${sg((q.C[i] / pc - 1) * 100)}`; } },
      series,
    };
    if (!chart || o.fresh) { if (chart) { try { chart.dispose(); } catch (e) { /* 已释放 */ } } chart = A.mk(el); }
    chart.setOption(opt, true);
  }
  function maBar(onchange) {
    return `<div class="mas" id="tmas">均线 ${[5, 10, 20, 40, 60].map((p) => `<button data-ma="${p}" class="${MAON[p] ? "on" : ""}" style="${MAON[p] ? "background:" + MAC[p] : ""}">${p}</button>`).join("")}
      <span class="mh" style="margin-left:auto">量 · MACD 在下面</span></div>`;
  }
  function bindMa(root, redraw) {
    root.querySelectorAll("[data-ma]").forEach((b) => b.addEventListener("click", () => {
      const p = +b.dataset.ma; MAON[p] = MAON[p] ? 0 : 1;
      try { localStorage.setItem(KEY + "_ma", JSON.stringify(MAON)); } catch (e) { /* 忽略 */ }
      b.classList.toggle("on", !!MAON[p]); b.style.background = MAON[p] ? MAC[p] : "";
      redraw();
    }));
  }

  // ---------------------------------------------------------------- 自由练 / 今日一题
  function game(q, mode) {
    const S0 = q.w + q.v - 1, END = q.k.length - 1, fee = q.stk ? 0.0015 : 0.0005;
    const G = { i: S0, cash: 1, sh: 0, cost: 0, stopPct: 0, fills: [], eq: [], trips: [], cur: null, err: { chase: 0, early: 0, hold: 0 }, holdFlag: false, msg: "" };
    const price = (i) => q.C[i];
    const equity = (i) => G.cash + G.sh * price(i);
    const posFrac = (i) => (G.sh * price(i)) / equity(i);
    const stopPx = () => (G.sh > 0 && G.stopPct ? G.cost * (1 - G.stopPct) : null);
    function fill(side, frac, t, px, why) {
      // side b：把仓位加到 frac（0.5 / 1）；s：卖掉持仓的 frac（0.5 / 1）
      const eq0 = G.cash + G.sh * px;
      if (side === "b") {
        const want = eq0 * frac - G.sh * px;
        if (want <= eq0 * 0.01) return false;
        const amt = Math.min(want, G.cash), sh = amt / (px * (1 + fee));
        G.cost = (G.cost * G.sh + amt) / (G.sh + sh); G.sh += sh; G.cash -= amt;
        if (!G.cur) G.cur = { i: t, inv: 0, out: 0 };
        G.cur.inv += amt;
        const ma20 = q.ma[20][t - 1];
        if ((ma20 && q.C[t - 1] > ma20 * 1.12) || (t >= 6 && q.C[t - 1] / q.C[t - 6] - 1 > 0.12)) G.err.chase++;
      } else {
        if (G.sh <= 0) return false;
        const sh = frac >= 1 ? G.sh : G.sh * frac, got = sh * px * (1 - fee);
        if (px > G.cost) { let mx = 0; for (let j = t; j <= Math.min(END, t + 10); j++) mx = Math.max(mx, q.H[j]); if (mx > px * 1.1) G.err.early++; }
        G.sh -= sh; G.cash += got; G.cur.out += got;
        if (G.sh < 1e-9) { G.sh = 0; G.trips.push({ pnl: G.cur.out / G.cur.inv - 1, hold: t - G.cur.i }); G.cur = null; G.cost = 0; G.holdFlag = false; }
      }
      G.fills.push({ i: t, side, frac, px, why });
      return true;
    }
    function step(order) {
      if (G.i >= END) return;
      const t = G.i + 1;
      let msg = "";
      if (order) {
        const ok = fill(order[0], order[1], t, q.O[t], "");
        msg = ok ? `已按开盘价 ${q.O[t].toFixed(2)} ${order[0] === "b" ? (order[1] >= 1 ? "买到全仓" : "加半仓") : (order[1] >= 1 ? "全部卖出" : "卖出一半")}` : (order[0] === "b" ? "已经满仓了" : "没有持仓");
      }
      // 止损（买入当天不能卖：T+1）
      const sp = stopPx();
      if (sp && !G.fills.some((f) => f.i === t && f.side === "b")) {
        if (q.O[t] <= sp) { fill("s", 1, t, q.O[t], "stop"); msg = `跳空跌破止损，开盘 ${q.O[t].toFixed(2)} 卖出`; }
        else if (q.L[t] <= sp) { fill("s", 1, t, sp, "stop"); msg = `盘中碰到止损 ${sp.toFixed(2)}，卖出`; }
      }
      if (G.sh > 0 && !G.stopPct && !G.holdFlag && q.C[t] < G.cost * 0.9) { G.err.hold++; G.holdFlag = true; }
      G.i = t;
      G.eq.push(equity(t));
      G.msg = msg;
    }
    return { G, S0, END, fee, step, fill, equity, posFrac, stopPx };
  }

  function freeView(root, q, mode) {
    const g = game(q, mode), G = g.G;
    const tag = mode === "today" ? "今日一题（今天所有人同一题）" : "自由练";
    root.innerHTML = `<div class="hd"><div class="big" id="tbig">0.00%<small>这一局</small></div><div class="hs" id="ths"></div></div>
      <div class="ch" id="tch"></div>${maBar()}
      <div class="toast" id="tmsg">${tag}：看图判断，点按钮下单（按下一根开盘价成交）。</div>
      <div id="tctl"></div><div id="tres"></div>`;
    const el = root.querySelector("#tch");
    const redraw = (fresh) => draw(el, q, G.i, { fills: G.fills, stop: g.stopPx(), cost: G.sh > 0 ? G.cost : null, reveal: G.i >= g.END, fresh, cut: G.i >= g.END ? g.S0 : null, cutLabel: "开始" });
    bindMa(root, () => redraw(false));
    function head() {
      const eq = g.equity(G.i), r = (eq - 1) * 100, bh = G.i > g.S0 ? (q.C[G.i] / q.O[g.S0 + 1] - 1) * 100 : 0;
      const pf = G.sh > 0 ? g.posFrac(G.i) : 0;
      root.querySelector("#tbig").innerHTML = `<span class="${cls(r)}">${sg(r)}</span><small>这一局</small>`;
      const fl = G.sh > 0 ? ((q.C[G.i] / G.cost - 1) * 100) : null;
      root.querySelector("#ths").innerHTML = `第 <b>${G.i - g.S0}</b> / ${g.END - g.S0} 根 · <b>${pf > 0.95 ? "全仓" : pf > 0.05 ? Math.round(pf * 100) + "% 仓" : "空仓"}</b>`
        + `<br>${fl != null ? `持仓 <b class="${cls(fl)}">${sg(fl, 1)}</b> · ` : ""}一直拿着 <b class="${cls(bh)}">${sg(bh, 1)}</b>`;
    }
    function ctl() {
      const done = G.i >= g.END, has = G.sh > 0, full = has && g.posFrac(G.i) > 0.95;
      if (done) { root.querySelector("#tctl").innerHTML = ""; return; }
      root.querySelector("#tctl").innerHTML = `<div class="btns">
        <button class="b" data-o="b0.5" ${full ? "disabled" : ""}>买半仓<small>加 50%</small></button>
        <button class="b" data-o="b1" ${full ? "disabled" : ""}>买全仓<small>加到 100%</small></button>
        <button class="n" data-o="next">下一根 ▶<small>观望 / 拿着</small></button>
        <button class="s" data-o="s0.5" ${has ? "" : "disabled"}>卖一半</button>
        <button class="s" data-o="s1" ${has ? "" : "disabled"}>全卖</button>
        <button class="g" data-o="j5">跳 5 根 ⏩<small>不操作</small></button></div>
        <div class="stp">止损线：${[0, 0.05, 0.08, 0.1].map((p) => `<button data-sp="${p}" class="${G.stopPct === p ? "on" : ""}">${p ? "−" + p * 100 + "%" : "不设"}</button>`).join("")}</div>`;
      root.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => act(b.dataset.o)));
      root.querySelectorAll("[data-sp]").forEach((b) => b.addEventListener("click", () => { G.stopPct = +b.dataset.sp; ctl(); redraw(false); }));
    }
    function act(o) {
      if (o === "next") g.step(null);
      else if (o === "j5") { for (let k = 0; k < 5 && G.i < g.END; k++) g.step(null); }
      else g.step([o[0], +o.slice(1)]);
      root.querySelector("#tmsg").textContent = G.msg || `第 ${G.i - g.S0} 根：收 ${q.C[G.i].toFixed(2)}（${sg((q.C[G.i] / q.C[G.i - 1] - 1) * 100)}）`;
      head(); ctl();
      if (G.i >= g.END) settle(); else redraw(false);
    }
    function settle() {
      if (G.sh > 0) { G.cur && G.trips.push({ pnl: (G.cur.out + G.sh * q.C[g.END] * (1 - g.fee)) / G.cur.inv - 1, hold: g.END - G.cur.i + 1, open: 1 }); }
      const eq = g.equity(g.END), ret = (eq - 1) * 100, bh = (q.C[g.END] / q.O[g.S0 + 1] - 1) * 100;
      let pk = 1, mdd = 0; G.eq.forEach((v) => { pk = Math.max(pk, v); mdd = Math.min(mdd, v / pk - 1); });
      const n = G.trips.length, w = G.trips.filter((t) => t.pnl > 0).length, hold = n ? G.trips.reduce((a, t) => a + t.hold, 0) / n : 0;
      const rec = { id: q.id, m: mode, t: Date.now(), d: bj(), ret: +ret.toFixed(2), bh: +bh.toFixed(2), mdd: +(mdd * 100).toFixed(2), n, w, hold: +hold.toFixed(1), fills: G.fills.length, err: G.err, r: q.r };
      const S = store(); S.games.push(rec); S.seen = [...(S.seen || []), q.id].slice(-400); save(S);
      redraw(true);
      const nm = q.info.n, rg = { bull: "上涨段", bear: "下跌段", range: "震荡段" }[q.r] || "";
      const errs = [];
      if (G.err.chase) errs.push(`追高 ${G.err.chase} 次：买的时候已经比 20 日线高 12% 以上或 5 天涨了 12% 以上。`);
      if (G.err.early) errs.push(`过早止盈 ${G.err.early} 次：赚钱卖出后 10 根内又涨了 10% 以上。`);
      if (G.err.hold) errs.push(`扛单 ${G.err.hold} 次：亏到 10% 还没设止损、没卖。`);
      if (!G.fills.length) errs.push("这局一笔都没做——空仓也是一种选择，但要想清楚是「没看到机会」还是「不敢动」。");
      const beat = ret - bh;
      root.querySelector("#tres").innerHTML = `<div class="res"><h3>结算 · ${beat >= 0 ? "跑赢" : "跑输"}一直拿着 ${pp(beat)}</h3>
        <div class="reveal">揭晓：<b>${esc(nm)}</b>（${esc(q.info.s)}）· ${q.D[g.S0 + 1]} ~ ${q.D[g.END]} · ${rg}</div>
        <div class="kv"><div><b class="${cls(ret)}">${sg(ret)}</b><span>这一局收益</span></div><div><b class="${cls(bh)}">${sg(bh)}</b><span>同期一直拿着</span></div>
          <div><b class="${cls(mdd)}">${sg(mdd * 100)}</b><span>最大回撤</span></div><div><b>${n}</b><span>交易笔数（一买一卖算一笔）</span></div>
          <div><b>${n ? Math.round((w / n) * 100) + "%" : "—"}</b><span>胜率</span></div><div><b>${n ? hold.toFixed(1) : "—"}</b><span>平均拿几根</span></div></div>
        ${errs.length ? `<ul class="err">${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : '<p class="muted">没发现追高、过早止盈、扛单。</p>'}
        <div class="btns" style="grid-template-columns:1fr 1fr"><button class="n" id="again">再来一局 ▶</button><button class="g" id="tome">看我的成绩</button></div>
        <p class="muted small">图上红「买」绿「卖」是你的每一笔；紫色虚线左边是开局时给你看的部分。价格已换算成起点 100（真实价格不同，涨跌幅一样）。成本按每边 ${(g.fee * 100).toFixed(2)}% 扣。</p></div>`;
      root.querySelector("#again").addEventListener("click", () => go("free"));
      root.querySelector("#tome").addEventListener("click", () => { location.hash = "#/train/me"; });
      root.querySelector("#tmsg").textContent = "60 根走完，结算如下 👇";
      const S2 = store(); if (S2.games.length % 20 === 0) root.querySelector("#tres").insertAdjacentHTML("afterbegin", `<div class="rep"><h3>🎉 满 ${S2.games.length} 局了</h3><p>你的交易习惯报告出来了，<a style="color:#fff;text-decoration:underline" href="#/train/me">点这里看</a>。</p></div>`);
    }
    head(); ctl(); redraw(true);
  }

  // ---------------------------------------------------------------- Joy 方法题 / 我们的信号题
  function quizView(root, q) {
    const isJoy = q.m === "joy", S0 = q.w + q.v - 1, END = q.k.length - 1;
    const card = isJoy ? cardOf(q.c) : ourOf(q.c);
    root.innerHTML = `<div class="qa">${isJoy ? "Joy 方法题" : "我们的信号题"}：看到这里，现在 <span class="up">买</span>、<span style="color:var(--sub)">等</span> 还是 <span class="dn">卖</span>？</div>
      <div class="ch" id="tch"></div>${maBar()}
      <div class="toast" id="tmsg">最后一根就是「关键位置」。想好了再点；点完揭晓后面 ${END - S0} 根。</div>
      <div id="tctl"><div class="btns"><button class="b" data-a="buy">买入<small>看涨</small></button><button class="g" data-a="wait">等等看<small>不动</small></button><button class="s" data-a="sell">卖出 / 不碰<small>看跌</small></button></div></div><div id="tres"></div>`;
    const el = root.querySelector("#tch");
    let upto = S0, rev = false;
    const redraw = (fresh) => draw(el, q, upto, { reveal: rev, fresh, cut: rev ? S0 : null, cutLabel: "出题位置", fills: rev && ans === "buy" ? [{ i: S0 + 1, side: "b" }, { i: xi, side: "s" }] : [] });
    let ans = null, xi = END;
    bindMa(root, () => redraw(false));
    redraw(true);
    root.querySelectorAll("[data-a]").forEach((b) => b.addEventListener("click", () => {
      ans = b.dataset.a; rev = true; upto = END;
      const e = S0 + 1, fwd = (q.C[END] / q.O[e] - 1) * 100;
      // 按这张卡 / 这个信号自己的卖法走一遍
      let x = END, why = `拿满 ${END - S0} 根`;
      const stp = q.st != null ? q.st / 100 : null;
      for (let t = e; t <= END; t++) {
        if (q.c === "sgrade") { const ep = q.O[e]; if (q.L[t] <= ep * 0.97) { x = t; why = "碰到止损 3%"; break; } if (q.H[t] >= ep * 1.06) { x = t; why = "碰到止盈 6%"; break; } if (t - e >= 9) { x = t; why = "拿满 10 天"; break; } continue; }
        if (q.c === "etfdip") { if (q.ma[5][t] && q.C[t] > q.ma[5][t]) { x = t; why = "收盘站上 5 日线就卖"; break; } if (t - e >= 9) { x = t; why = "拿满 10 天"; break; } continue; }
        if (q.c === "hot") { if (t - e >= 4) { x = t; why = "拿满 5 天"; break; } continue; }
        const lim = stp != null ? stp : q.O[e] * 0.92;
        if (q.C[t] < lim) { x = t; why = "收盘跌破止损"; break; }
        if (t > e && q.dif[t] < q.dea[t] && q.dif[t - 1] >= q.dea[t - 1]) { x = t; why = "MACD 死叉"; break; }
      }
      xi = x;
      let rr;
      if (q.c === "sgrade") { const ep = q.O[e]; rr = why.includes("止损") ? -3 : why.includes("止盈") ? 6 : (q.C[x] / ep - 1) * 100; }
      else rr = (q.C[x] / q.O[e] - 1) * 100;
      const cost = q.stk ? 0.3 : 0.1;
      rr -= cost;
      const right = fwd > 3 ? "buy" : fwd < -3 ? "sell" : "wait";
      const ok = ans === right || (right === "wait" && ans !== "buy" && Math.abs(fwd) <= 3) || (ans === "wait" && right === "sell");
      const S = store(); S.games.push({ id: q.id, m: q.m, c: q.c, t: Date.now(), d: bj(), ans, ok, fwd: +fwd.toFixed(2), rule: +rr.toFixed(2) }); S.seen = [...(S.seen || []), q.id].slice(-400); save(S);
      redraw(true);
      root.querySelector("#tctl").innerHTML = "";
      const L = isJoy ? (META.lab || {})[q.c] : null;
      const lab = isJoy ? (L ? `${lvTag(L.v)} 我们在 A股日线上测过这类形态（按规则走）：${L.ie ? `指数/ETF ${L.ie.n} 次、每笔扣成本 ${sg(L.ie.net)}、比随便买 ${sg(L.ie.ex)}` : ""}${L.big ? `；个股 ${L.big.n} 次、每笔 ${sg(L.big.net)}、比随便买 ${sg(L.big.ex)}` : ""}。<a href="#/labs/joy">完整检验 ›</a>` : "")
        : `${esc(card.lab)} <a href="${esc(card.link)}">检验报告 ›</a>`;
      const nm = q.info.n;
      root.querySelector("#tmsg").innerHTML = `你选了 <b>${{ buy: "买入", wait: "等等看", sell: "卖出 / 不碰" }[ans]}</b>。`;
      root.querySelector("#tres").innerHTML = `<div class="res"><h3>${ok ? "✅ 这次判断对了" : "❌ 这次判断错了"}</h3>
        <div class="kv"><div><b class="${cls(fwd)}">${sg(fwd)}</b><span>后面 ${END - S0} 根（次日开盘买、拿到最后）</span></div>
          <div><b class="${cls(rr)}">${sg(rr)}</b><span>按${isJoy ? "这张卡" : "这个信号"}的规则走（${esc(why)}，扣成本）</span></div>
          <div><b>${right === "buy" ? "买" : right === "sell" ? "卖 / 不碰" : "等"}</b><span>事后看最合适（±3% 以内算等）</span></div></div>
        <div class="reveal">揭晓：<b>${esc(nm)}</b>（${esc(q.info.s)}）· 出题那天 ${q.D[S0]}${q.rl ? ` · 触发规则「${esc(q.rl)}」` : ""}</div>
        <p class="muted small">一道题对错有很大运气成分；看的是做很多题之后的比例，以及「按规则走」平均赚不赚。</p></div>
        ${isJoy ? cardHtml(card, true) : `<div class="card2"><h4>📡 ${esc(card.name)}</h4><div class="q">来源：${esc(card.src)}</div><p class="one">${esc(card.rule)}</p></div>`}
        <div class="card2" style="border-left-color:#64748b"><h4>🔬 检验结论</h4><p style="font-size:14px;line-height:1.65;margin:4px 0">${lab}</p></div>
        <div class="btns" style="grid-template-columns:1fr 1fr"><button class="n" id="again">下一题 ▶</button><button class="g" id="tome">看我的成绩</button></div>`;
      root.querySelector("#again").addEventListener("click", () => go(q.m, (location.hash.split("/")[3] || "")));
      root.querySelector("#tome").addEventListener("click", () => { location.hash = "#/train/me"; });
    }));
  }

  function cardHtml(c, open) {
    if (!c) return "";
    const L = c.q ? (META.lab || {})[c.q] : null;
    return `<div class="card2"><h4>🎓 ${esc(c.name)} ${c.q ? lvTag(L && L.v) : '<i class="lv no">没有检验</i>'}</h4><p class="one">${esc(c.one)}</p>
      <details ${open ? "open" : ""}><summary class="muted small" style="cursor:pointer">判断步骤 · 常见错误 · 原视频</summary>
      <ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="q">我们怎么量化：${esc(c.rule)}</div>
      ${c.mistakes && c.mistakes.length ? `<div class="q">常见错误：${c.mistakes.map(esc).join("；")}</div>` : ""}
      ${c.unclear ? `<div class="q">⚠️ ${esc(c.unclear)}</div>` : ""}
      <div class="q">原视频：${c.videos.map(([t, id]) => `<a href="${META.vid}${id}" target="_blank" rel="noopener">${esc(t)} ↗</a>`).join("　")}</div></details></div>`;
  }

  // ---------------------------------------------------------------- 我的成绩
  function habit(gs) {
    const F = gs.filter((g) => g.m === "free" || g.m === "today"), Qz = gs.filter((g) => g.m === "joy" || g.m === "our");
    const n = F.length, avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const trips = F.reduce((a, g) => a + g.n, 0), wins = F.reduce((a, g) => a + g.w, 0);
    const holdA = avg(F.filter((g) => g.n).map((g) => g.hold));
    const err = { chase: 0, early: 0, hold: 0 }; F.forEach((g) => Object.keys(err).forEach((k) => (err[k] += (g.err || {})[k] || 0)));
    const cum = F.reduce((a, g) => a * (1 + g.ret / 100), 1) - 1, cumBh = F.reduce((a, g) => a * (1 + g.bh / 100), 1) - 1;
    const beat = F.filter((g) => g.ret > g.bh).length;
    const byR = {}; ["bull", "bear", "range"].forEach((r) => { const x = F.filter((g) => g.r === r); byR[r] = { n: x.length, ex: avg(x.map((g) => g.ret - g.bh)), r: avg(x.map((g) => g.ret)) }; });
    return { n, trips, wins, holdA, err, cum: cum * 100, cumBh: cumBh * 100, beat, avgRet: avg(F.map((g) => g.ret)), avgBh: avg(F.map((g) => g.bh)), byR,
      qn: Qz.length, qok: Qz.filter((g) => g.ok).length, qrule: avg(Qz.map((g) => g.rule)), idle: F.filter((g) => !g.fills).length };
  }
  function advice(h) {
    const out = [];
    const top = Object.entries(h.err).sort((a, b) => b[1] - a[1])[0];
    const nm = { chase: "追高", early: "过早止盈", hold: "扛单" };
    if (top && top[1] > 0) out.push(`最常犯的错是「${nm[top[0]]}」（${top[1]} 次）。` + (top[0] === "chase" ? "下次想买前先看离 20 日线多远，远超 10% 就等回踩（Joy 的攻击性三步曲第三步）。"
      : top[0] === "early" ? "赚了一点就跑，后面大涨没拿住。试试「先卖一半、剩下的跌破 10 日线再走」。" : "亏了不认。开局先点一个止损线（−8%），让规则替你卖。"));
    if (h.byR.bear.n >= 3 && h.byR.bear.ex != null) out.push(h.byR.bear.ex > 0 ? `下跌段你比一直拿着多赚 ${pp(h.byR.bear.ex)}——躲跌做得不错。` : `下跌段你还比一直拿着少 ${pp(h.byR.bear.ex)}，说明下跌时还在抄底。`);
    if (h.byR.bull.n >= 3 && h.byR.bull.ex != null) out.push(h.byR.bull.ex > 0 ? `上涨段你跑赢了一直拿着 ${pp(h.byR.bull.ex)}。` : `上涨段你比一直拿着少赚 ${pp(h.byR.bull.ex)}——涨的时候拿不住，是大多数人的通病。`);
    if (h.holdA != null) out.push(`平均每笔拿 ${h.holdA.toFixed(1)} 根。` + (h.holdA < 4 ? "偏短，成本和噪音会吃掉很多。" : ""));
    if (h.qn >= 5) out.push(`方法题 / 信号题答了 ${h.qn} 道，对 ${Math.round((h.qok / h.qn) * 100)}%；照规则走平均每题 ${sg(h.qrule)}。`);
    return out;
  }
  function meView(root) {
    const S = store(), gs = S.games || [];
    if (!gs.length) { root.innerHTML = `<div class="res"><h3>还没有成绩</h3><p class="muted">先去 <a href="#/train/today">做今日一题</a> 或 <a href="#/train/free">自由练</a>。成绩只存在这台设备的浏览器里。</p></div>`; return; }
    const h = habit(gs);
    const blocks = Math.floor(gs.length / 20);
    let rep = "";
    if (blocks >= 1) {
      const seg = gs.slice((blocks - 1) * 20, blocks * 20), hh = habit(seg);
      rep = `<div class="rep"><h3>📋 你的交易习惯报告（第 ${(blocks - 1) * 20 + 1}~${blocks * 20} 局）</h3>
        <p>自由练 ${hh.n} 局：平均每局 <b>${sg(hh.avgRet, 1)}</b>，一直拿着 ${sg(hh.avgBh, 1)}；跑赢 ${hh.beat} 局。笔数胜率 ${hh.trips ? Math.round((hh.wins / hh.trips) * 100) + "%" : "—"}。</p>
        ${advice(hh).map((x) => `<p>· ${esc(x)}</p>`).join("")}</div>`;
    } else rep = `<div class="res"><h3>再做 ${20 - gs.length} 局出第一张「交易习惯报告」</h3></div>`;
    root.innerHTML = `${rep}
      <div class="kv"><div><b>${h.n}</b><span>自由练局数</span></div><div><b class="${cls(h.cum)}">${sg(h.cum, 1)}</b><span>累计收益（连乘）</span></div><div><b class="${cls(h.cumBh)}">${sg(h.cumBh, 1)}</b><span>同期一直拿着</span></div>
        <div><b>${h.trips ? Math.round((h.wins / h.trips) * 100) + "%" : "—"}</b><span>胜率（${h.trips} 笔）</span></div><div><b>${h.holdA != null ? h.holdA.toFixed(1) : "—"}</b><span>平均拿几根</span></div>
        <div><b>${h.qn ? Math.round((h.qok / h.qn) * 100) + "%" : "—"}</b><span>方法题答对（${h.qn} 道）</span></div></div>
      <div class="res"><h3>常犯错误</h3><div class="kv"><div><b>${h.err.chase}</b><span>追高</span></div><div><b>${h.err.early}</b><span>过早止盈</span></div><div><b>${h.err.hold}</b><span>扛单</span></div></div>
        ${advice(h).map((x) => `<p style="font-size:14px;margin:4px 0">· ${esc(x)}</p>`).join("")}</div>
      <h2 style="font-size:16px;margin:14px 0 6px">最近 30 局</h2><div class="lst">${gs.slice(-30).reverse().map((g) => (g.m === "joy" || g.m === "our")
        ? `<div class="r"><span>${g.d.slice(5)} ${g.m === "joy" ? "Joy 题" : "信号题"} · ${esc((g.m === "joy" ? (cardOf(g.c) || {}).name : (ourOf(g.c) || {}).name) || g.c)} · 选${{ buy: "买", wait: "等", sell: "卖" }[g.ans]} ${g.ok ? "✅" : "❌"}</span><span class="${cls(g.fwd)}">后 20 根 ${sg(g.fwd, 1)}</span></div>`
        : `<div class="r"><span>${g.d.slice(5)} ${g.m === "today" ? "今日一题" : "自由练"} · ${g.n} 笔</span><span><b class="${cls(g.ret)}">${sg(g.ret, 1)}</b> <small class="muted">拿着 ${sg(g.bh, 1)}</small></span></div>`).join("")}</div>
      <p class="muted small" style="margin-top:8px">成绩只存在这台设备的浏览器里（换浏览器 / 清缓存会没有）。<a href="javascript:void(0)" id="tclr">清空成绩</a></p>`;
    root.querySelector("#tclr").addEventListener("click", () => { if (confirm("清空这台设备上的全部训练成绩？")) { save({ games: [], seen: [] }); meView(root); } });
  }

  // ---------------------------------------------------------------- 卡片页
  function cardsView(root, sel) {
    const L = META.lab || {};
    root.innerHTML = `<div class="res" style="border-left:5px solid #7c3aed"><h3>🎓 Joy讲交易 · 方法卡</h3>
      <p style="font-size:14px;line-height:1.65;margin:4px 0">抖音「${esc(META.blogger.name)}」（${esc(META.blogger.fans)}粉丝）的${esc(META.blogger.series)}：拿一段历史 K 线、遮住后面、逐根往前推、边看边判断。下面是从他最近 100 多集里整理的 ${META.cards.length} 张方法卡；
      能写成规则的 7 条我们在 A股日线上检验了（共 ${META.ntest || 42} 组）：${Object.entries(L).map(([k, v]) => `${esc((META.rules[k] || [k])[0].replace(/（.*?）/g, ""))} ${v.v || ""}`).join("、")}。<a href="#/labs/joy">完整检验 ›</a></p>
      <p class="muted small">他是教学类博主，不荐具体股票；视频里的个股都是隐藏名称的历史走势。方法卡是我们的整理，原意以视频为准。</p></div>
      <div class="cards">${META.cards.map((c) => cardHtml(c, c.key === sel)).join("")}</div>`;
  }

  // ---------------------------------------------------------------- 路由
  const MODES = [["today", "📅 今日一题"], ["free", "🎲 自由练"], ["joy", "🎓 Joy 方法题"], ["our", "📡 我们的信号题"], ["me", "📋 我的成绩"], ["cards", "📚 方法卡"]];
  function go(m, c) { const h = "#/train/" + m + (c ? "/" + c : ""); if (location.hash === h) render(m, c); else location.hash = h; }
  function render(m, c) {
    const root = MOUNT;
    if (!root) return;
    const tok = A.tok();
    chart = null;
    root.innerHTML = `<div class="modes">${MODES.map(([k, t]) => `<a href="#/train/${k}" class="${k === m ? "on" : ""}">${t}</a>`).join("")}</div>
      ${m === "joy" ? `<div class="pick"><a href="#/train/joy" class="${!c ? "on" : ""}">随机</a>${META.cards.filter((x) => x.q && x.key === x.q).map((x) => `<a href="#/train/joy/${x.q}" class="${c === x.q ? "on" : ""}">${esc(x.name.replace(/（.*?）/g, ""))}</a>`).join("")}</div>` : ""}
      ${m === "our" ? `<div class="pick"><a href="#/train/our" class="${!c ? "on" : ""}">随机</a>${META.our.map((x) => `<a href="#/train/our/${x.key}" class="${c === x.key ? "on" : ""}">${esc(x.name)}</a>`).join("")}</div>` : ""}
      <div id="tbody">${A.LOADING()}</div>
      <details class="f"><summary>怎么玩、规则和数据（点开）</summary><ul>
        <li>随机抽一段历史日K（指数 / 宽基与板块 ETF / 市值前 300 个股，${META.n.free} 段自由练：上涨段 ${META.reg.bull}、下跌段 ${META.reg.bear}、震荡段 ${META.reg.range}），名称和日期先藏起来，价格换算成起点 100。</li>
        <li>先给你看 120 根，然后一根根往后推。点「买 / 卖」= 收盘后下单、<b>下一根开盘价成交</b>；买入当天不能卖（T+1）；成本每边 个股 0.15%、指数/ETF 0.05%。</li>
        <li>止损线 = 跌破持仓成本多少自动卖（盘中碰到就按止损价卖，跳空低开按开盘价）。走完 60 根结算，和「第一根开盘买入一直拿着」比。</li>
        <li>Joy 方法题 ${META.n.joy} 道、我们的信号题 ${META.n.our} 道：停在形态 / 信号出现那一根，问你买、等还是卖，揭晓后面 20 根 + 讲解 + 检验结论。</li>
        <li>常犯错误怎么算：追高 = 买时比 20 日线高 12% 以上或 5 天涨超 12%；过早止盈 = 赚钱卖出后 10 根内又涨 10% 以上；扛单 = 亏到 10% 还没止损。</li>
        <li>今日一题每天换一题，所有人同一题；成绩只存在这台设备里，每 20 局出一张「交易习惯报告」。题库 ${META.built} 生成，随机种子 ${META.seed}（可复现）。</li>
        <li>这是练盘感的工具，不是选股：历史上的结果不代表以后；揭晓的股票不构成推荐。</li></ul></details>`;
    const body = root.querySelector("#tbody");
    if (m === "me") { meView(body); return; }
    if (m === "cards") { cardsView(body, c); return; }
    let id = null;
    if (m === "today") id = todayId();
    else if (m === "q") id = c;
    else if (m === "joy" || m === "our") id = pickId(m, c);
    else id = pickId("free");
    if (!id) { body.innerHTML = '<div class="res">这一类暂时没有题。</div>'; return; }
    A.need("lib").then(() => getQ(id)).then((q) => {
      if (!A.alive(tok)) return;
      q.id = id;
      if (q.m === "free") freeView(body, q, m === "today" ? "today" : "free");
      else quizView(body, q);
      if (m === "today") {
        const done = (store().games || []).some((g) => g.id === id && g.d === bj());
        if (done) body.insertAdjacentHTML("afterbegin", '<div class="toast">今天这题你已经做过了，可以再练一遍（成绩会再记一次），或去「自由练」。</div>');
      }
    }).catch(() => { if (A.alive(tok)) body.innerHTML = A.FAIL("题库加载失败"); });
  }

  window.__mod_train = {
    page(m, c) {
      document.title = "K 线训练 · 小七投研";
      A.app.innerHTML = `<div class="trn"><h1 style="margin-bottom:4px">🕹 K 线训练</h1><div id="troot">${A.LOADING()}</div></div>${A.DISC}`;
      MOUNT = null;
      const tok = A.tok();
      A.getJSON("train.json").then((M) => {
        if (!A.alive(tok)) return;
        META = M; MOUNT = document.getElementById("troot");
        render(MODES.some(([k]) => k === m) || m === "q" ? m : "today", c);
      }).catch(() => { if (A.alive(tok)) document.getElementById("troot").innerHTML = A.FAIL(); });
    },
  };
})();
