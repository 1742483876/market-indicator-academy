/* 🎬 分时练盘（老大 2026-11-28：「给我一只纳斯达克，盘前盘中盘后一起给我，做成计时的，一分钟一分钟在跳，可以加速；
   我自己看趋势点买入，它自己波动；我更想看分时线；各市场挑一个最主要的，我去感受一下这个波动」）
   数据：tape_build.py → tape/index.json + tape/<mk>/<k>.json（真实历史交易日，日期先藏起来，结束才揭晓）。
   玩法：选市场 → 抽一天 → ▶ 播放（1 秒走 1/5/15/30/60 分钟，或真实速度）→ 随时 买入做多 / 卖出做空 / 平仓 → 收盘后揭晓日期、看成绩。*/
(function () {
  const A = window.__APP;
  const { app, esc, FAIL, DISC, getJSON, mk, C, axisStyle } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const FEE = 0.0003;           // 单边成本 0.03%（指数 ETF / 期货大致水平）
  const CAP = 100000;           // 每笔用 10 万（只是算金额用）
  const SPEEDS = [[0, "真实速度"], [1, "1 秒 1 分钟"], [5, "1 秒 5 分钟"], [15, "1 秒 15 分钟"], [60, "1 秒 1 小时"]];
  if (!document.getElementById("tp-css")) {
    const st = document.createElement("style"); st.id = "tp-css";
    st.textContent = `
.tp-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px}
.tp-tabs a{flex:none;font-size:13.5px;padding:6px 12px;border-radius:20px;background:var(--soft);color:var(--sub);text-decoration:none;font-weight:700;white-space:nowrap}
.tp-tabs a.on{background:var(--brand);color:#fff}
.tp-box{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 12px 10px;margin:0 0 12px}
.tp-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}
.tp-px{font-size:28px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.1}
.tp-px small{font-size:14px;font-weight:700;margin-left:6px}
.tp-clock{text-align:right;font-variant-numeric:tabular-nums}
.tp-clock b{display:block;font-size:22px;font-weight:900}
.tp-clock span{font-size:12px;color:var(--sub)}
.tp-sess{display:inline-block;font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;background:var(--soft);color:var(--sub);margin-top:2px}
.tp-sess.live{background:rgba(229,72,77,.12);color:#e5484d}
.tp-sub{font-size:12.5px;color:var(--sub);margin-top:4px}
.tp-chart{width:100%;height:330px;margin:6px 0 0}
.tp-ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 2px}
.tp-ctl button,.tp-ctl select{font-size:14px;font-weight:800;border-radius:10px;border:1px solid var(--line);background:var(--soft);color:var(--text);padding:8px 12px}
.tp-ctl .play{background:var(--brand);color:#fff;border-color:var(--brand);min-width:84px}
.tp-trade{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:10px 0 4px}
.tp-trade button{font-size:16px;font-weight:900;border-radius:12px;border:0;padding:13px 0;color:#fff}
.tp-trade .b{background:#e5484d}.tp-trade .s{background:#2fa86b}.tp-trade .x{background:#5f6b7a}
.tp-trade button:disabled{opacity:.35}
.tp-pos{display:flex;justify-content:space-between;gap:8px;font-size:14px;background:var(--soft);border-radius:10px;padding:9px 12px;margin-top:6px;font-variant-numeric:tabular-nums}
.tp-pos b{font-size:16px}
.tp-log{font-size:13px;color:var(--sub);line-height:1.7;margin-top:6px;font-variant-numeric:tabular-nums}
.tp-end{border-radius:14px;padding:14px;margin:8px 0 4px;background:linear-gradient(135deg,#5f6b7a,#3f4954);color:#fff}
.tp-end h3{margin:0 0 6px;font-size:18px}.tp-end p{margin:4px 0;font-size:14px;line-height:1.6}
.tp-end .big{font-size:26px;font-weight:900}
.tp-stat{font-size:12.5px;color:var(--sub);margin:6px 0}
.tp-tip{font-size:12px;color:var(--sub2);line-height:1.6;margin-top:8px}
.tp-start{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px}
.tp-start a{font-size:12.5px;padding:5px 10px;border-radius:8px;background:var(--soft);color:var(--sub);text-decoration:none;font-weight:700}
.tp-start a.on{background:var(--text);color:var(--card)}`;
    document.head.appendChild(st);
  }
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const pc = (x) => (x == null || !isFinite(x) ? "—" : (x > 0 ? "+" : "") + x.toFixed(2) + "%");
  const cls = (x) => (x > 0 ? "up" : x < 0 ? "dn" : "");
  const LS = "tp_stats_v1";
  const stats = () => { try { return JSON.parse(localStorage.getItem(LS)) || { n: 0, win: 0, sum: 0, by: {} }; } catch (e) { return { n: 0, win: 0, sum: 0, by: {} }; } };
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  async function page(mkey) {
    document.title = "分时练盘 · 小七投研";
    const tok = A.tok();
    app.innerHTML = `<h1>🎬 分时练盘</h1>${A.LOADING()}`;
    let I;
    try { [I] = await Promise.all([getJSON("tape/index.json", true), A.need("lib")]); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>🎬 分时练盘</h1>${FAIL()}`; return; }
    if (!A.alive(tok)) return;
    let M = I.markets.find((x) => x.key === (mkey || ls("tp_mk"))) || I.markets[0];
    let speed = +(ls("tp_speed") || 1), startAt = ls("tp_start") || "pre";
    let D = null, pos = 0, timer = null, playing = false, hold = null, trades = [], realized = 0, done = false, chart = null, avg = [];

    const draw = () => {
      const isUS = M.key === "us" || M.key === "spx";
      app.innerHTML = `<h1>🎬 分时练盘 <span class="muted small">真实历史某一天，日期练完揭晓</span></h1>
        <div class="tp-tabs">${I.markets.map((x) => `<a href="javascript:;" data-k="${esc(x.key)}" class="${x.key === M.key ? "on" : ""}">${esc(x.flag)} ${esc(x.name)}</a>`).join("")}</div>
        <div class="tp-box">
          <div class="tp-hd"><div><div class="tp-px" id="tpPx">—</div><div class="tp-sub" id="tpSub">点「抽一天」开始</div></div>
            <div class="tp-clock"><b id="tpClk">--:--</b><span>${esc(M.tzname)}时间</span><div class="tp-sess" id="tpSess">—</div></div></div>
          <div class="tp-chart" id="tpChart"></div>
          <div class="tp-ctl"><button class="play" id="tpPlay">▶ 播放</button>
            <select id="tpSpeed">${SPEEDS.map(([v, t]) => `<option value="${v}"${v === speed ? " selected" : ""}>${t}</option>`).join("")}</select>
            <button id="tpJump">${isUS || M.key === "hk" || M.key === "jp" ? "⏭ 跳到开盘" : "⏭ 快进 30 分钟"}</button>
            <button id="tpNew">🎲 抽一天</button></div>
          ${isUS || M.key === "hk" || M.key === "jp" ? `<div class="tp-start">从哪开始：${[["pre", "盘前开头"], ["open", "开盘前 15 分钟"]].map(([k, t]) => `<a href="javascript:;" data-s="${k}" class="${startAt === k ? "on" : ""}">${t}</a>`).join("")}</div>` : ""}
          <div class="tp-trade"><button class="b" id="tpBuy">买入做多</button><button class="s" id="tpShort">卖出做空</button><button class="x" id="tpFlat">平仓</button></div>
          <div class="tp-pos" id="tpPos"><span>空仓</span><span>今天已实现 <b>0.00%</b></span></div>
          <div id="tpEnd"></div>
          <div class="tp-log" id="tpLog"></div>
        </div>
        <div class="tp-stat" id="tpStat"></div>
        <div class="tp-tip">数据：${esc(M.src)}，${esc(M.span)} 年间随机 ${M.n} 天（最近 15 个交易日一定在里面）。每格 ${M.step} 分钟。<br>
        买卖按当前这一分钟的价成交，单边扣 0.03% 成本，每次用 10 万本金、不加杠杆；只能同时持一个方向。黄线 = 当天均价，灰虚线 = 昨收。${isUS ? "盘前盘后是期货价（成交少、跳得更大），17:00–18:00 期货休市一小时。" : ""}</div>${DISC}`;
      $$(".tp-tabs a").forEach((a) => a.addEventListener("click", () => { stop(); M = I.markets.find((x) => x.key === a.dataset.k); ls("tp_mk", M.key); draw(); newDay(); }));
      $$(".tp-start a").forEach((a) => a.addEventListener("click", () => { startAt = a.dataset.s; ls("tp_start", startAt); $$(".tp-start a").forEach((b) => b.classList.toggle("on", b === a)); }));
      $("#tpPlay").addEventListener("click", () => (playing ? stop() : play()));
      $("#tpSpeed").addEventListener("change", (e) => { speed = +e.target.value; ls("tp_speed", speed); if (playing) { stop(); play(); } });
      $("#tpNew").addEventListener("click", () => { stop(); newDay(); });
      $("#tpJump").addEventListener("click", jump);
      $("#tpBuy").addEventListener("click", () => trade(1));
      $("#tpShort").addEventListener("click", () => trade(-1));
      $("#tpFlat").addEventListener("click", () => trade(0));
      chart = mk($("#tpChart"));
      showStat();
    };

    const T = (i) => (D.step === 5 ? D.t[i] : D.t[0] + i);
    const sessOf = (m) => { const s = M.sess.find(([a, b]) => m >= a && m < b); return s ? s[2] : M.key === "cn" || M.key === "hk" ? "已收盘" : "—"; };
    const isLive = (m) => m >= M.open && m < M.close;

    async function newDay() {
      const k = Math.floor(Math.random() * M.n);
      try { D = await getJSON(`tape/${M.key}/${k}.json`, true); } catch (e) { $("#tpSub").textContent = "这一天没加载到，再抽一次"; return; }
      if (!A.alive(tok)) return;
      // 均价线：有成交量用 VWAP，没有（CFD）用当天累计平均
      avg = []; let sp = 0, sv = 0;
      D.p.forEach((p, i) => { const v = D.v.length ? D.v[i] || 0 : 1; sp += p * v; sv += v; avg.push(sv ? +(sp / sv).toFixed(2) : p); });
      hold = null; trades = []; realized = 0; done = false;
      const oi = D.p.findIndex((_, i) => T(i) >= M.open);
      pos = startAt === "open" && oi > 15 && M.open > T(0) ? oi - 15 : Math.min(D.step === 5 ? 1 : 10, D.p.length - 1);
      $("#tpEnd").innerHTML = ""; $("#tpLog").innerHTML = "";
      render(true);
    }

    function render(full) {
      if (!D) return;
      const p = D.p[pos], m = T(pos), chg = (p / D.prev - 1) * 100;
      $("#tpPx").innerHTML = `${p.toFixed(2)}<small class="${cls(chg)}">${pc(chg)}</small>`;
      $("#tpClk").textContent = hhmm(m);
      const sn = sessOf(m), se = $("#tpSess"); se.textContent = sn; se.classList.toggle("live", isLive(m));
      $("#tpSub").textContent = `某个交易日 · 昨收 ${D.prev.toFixed(2)} · 第 ${pos + 1}/${D.p.length} 格`;
      const N = D.p.length, xs = Array.from({ length: N }, (_, i) => hhmm(T(i)));
      const seen = D.p.slice(0, pos + 1);
      const lo = Math.min(D.prev, ...seen), hi = Math.max(D.prev, ...seen), pad = Math.max((hi - lo) * 0.15, D.prev * 0.002);
      const c = C(), col = chg >= 0 ? c.up : c.dn;
      const areas = M.sess.filter(([, , n]) => !/盘中|上午|下午/.test(n)).map(([a, b, n]) => {
        const i0 = D.p.findIndex((_, i) => T(i) >= a), i1 = (() => { let j = -1; for (let i = 0; i < N; i++) if (T(i) < b) j = i; return j; })();
        return i0 >= 0 && i1 > i0 ? [{ xAxis: xs[i0], name: n, itemStyle: { color: M.key === "gold" ? "rgba(0,0,0,0)" : "rgba(140,150,160,0.10)" }, label: { color: c.sub, fontSize: 10, position: "insideTop" } }, { xAxis: xs[i1] }] : null;
      }).filter(Boolean);
      const marks = trades.map((t) => ({ coord: [xs[t.i], t.px], value: t.lab, itemStyle: { color: t.lab.startsWith("买") ? "#e5484d" : t.lab.startsWith("空") ? "#2fa86b" : "#5f6b7a" } }));
      const opt = {
        animation: false, grid: D.v.length ? [{ left: 8, right: 8, top: 10, height: "64%", containLabel: true }, { left: 8, right: 8, top: "78%", bottom: 22, containLabel: true }] : [{ left: 8, right: 8, top: 10, bottom: 8, containLabel: true }],
        tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
        xAxis: [{ type: "category", data: xs, ...axisStyle(), boundaryGap: false, axisLabel: { color: c.sub, fontSize: 10, interval: Math.max(1, Math.floor(N / 6)) } }].concat(D.v.length ? [{ type: "category", gridIndex: 1, data: xs, show: false }] : []),
        yAxis: [{ type: "value", min: +(lo - pad).toFixed(2), max: +(hi + pad).toFixed(2), ...axisStyle(), splitNumber: 4, axisLabel: { color: c.sub, fontSize: 10, showMinLabel: false, showMaxLabel: false, formatter: (v) => (v >= 1000 ? Math.round(v) : v.toFixed(2)) } }].concat(D.v.length ? [{ type: "value", gridIndex: 1, show: false }] : []),
        series: [
          { name: "价格", type: "line", data: seen, showSymbol: false, lineStyle: { width: 1.5, color: col }, itemStyle: { color: col },
            areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: col + "33" }, { offset: 1, color: col + "00" }] } },
            markLine: { symbol: "none", silent: true, data: [{ yAxis: D.prev, lineStyle: { type: "dashed", color: "#9aa3ad" }, label: { formatter: "昨收", position: "insideStartTop", color: c.sub, fontSize: 10 } }].concat(hold ? [{ yAxis: hold.px, lineStyle: { color: hold.dir > 0 ? "#e5484d" : "#2fa86b" }, label: { formatter: (hold.dir > 0 ? "多单 " : "空单 ") + hold.px.toFixed(2), position: "insideStartTop", fontSize: 10 } }] : []) },
            markArea: { silent: true, data: areas },
            markPoint: { symbol: "pin", symbolSize: 34, label: { fontSize: 10, color: "#fff" }, data: marks } },
          { name: "均价", type: "line", data: avg.slice(0, pos + 1), showSymbol: false, lineStyle: { width: 1, color: "#e8a317" } },
        ].concat(D.v.length ? [{ name: "量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: D.v.slice(0, pos + 1).map((v, i) => ({ value: v, itemStyle: { color: i && D.p[i] < D.p[i - 1] ? c.dn : c.up } })) }] : []),
      };
      chart.setOption(opt, full);
      // 持仓
      const fl = hold ? (hold.dir * (p / hold.px - 1) - FEE * 2) * 100 : 0;
      $("#tpPos").innerHTML = hold ? `<span>${hold.dir > 0 ? "多单" : "空单"} @ ${hold.px.toFixed(2)}　浮动 <b class="${cls(fl)}">${pc(fl)}</b>（${fl >= 0 ? "+" : ""}${Math.round(CAP * fl / 100)}）</span><span>已实现 <b class="${cls(realized)}">${pc(realized)}</b></span>`
        : `<span>空仓</span><span>今天已实现 <b class="${cls(realized)}">${pc(realized)}</b></span>`;
      $("#tpBuy").disabled = done || (hold && hold.dir > 0); $("#tpShort").disabled = done || (hold && hold.dir < 0); $("#tpFlat").disabled = done || !hold;
    }

    function trade(dir) {
      if (!D || done) return;
      const p = D.p[pos], m = hhmm(T(pos));
      if (hold) {   // 先平掉原来的
        const r = (hold.dir * (p / hold.px - 1) - FEE * 2) * 100;
        realized += r; trades.push({ i: pos, px: p, lab: "平" });
        $("#tpLog").innerHTML += `<div>${m} 平${hold.dir > 0 ? "多" : "空"} @ ${p.toFixed(2)}　这笔 <b class="${cls(r)}">${pc(r)}</b></div>`;
        hold = null;
      }
      if (dir) {
        hold = { dir, px: p, i: pos }; trades.push({ i: pos, px: p, lab: dir > 0 ? "买" : "空" });
        $("#tpLog").innerHTML += `<div>${m} ${dir > 0 ? "买入做多" : "卖出做空"} @ ${p.toFixed(2)}${isLive(T(pos)) ? "" : "（非盘中，成交少）"}</div>`;
      }
      render(false);
    }

    function play() {
      if (!D || done) return;
      playing = true; $("#tpPlay").textContent = "⏸ 暂停";
      const real = speed === 0;
      const perSec = real ? 1 / 60 : speed;              // 每秒走几分钟
      const stepsPerSec = perSec / D.step;
      const iv = Math.max(40, Math.round(1000 / Math.min(stepsPerSec, 25)));
      const each = real ? 1 : Math.max(1, Math.round(stepsPerSec * iv / 1000));
      timer = setInterval(() => {
        if (!A.alive(tok) || !document.getElementById("tpChart")) { stop(); return; }
        pos = Math.min(pos + each, D.p.length - 1);
        render(false);
        if (pos >= D.p.length - 1) finish();
      }, real ? 60000 * D.step : iv);
    }
    function stop() { playing = false; clearInterval(timer); timer = null; const b = $("#tpPlay"); if (b) b.textContent = "▶ 播放"; }
    function jump() {
      if (!D || done) return;
      const oi = D.p.findIndex((_, i) => T(i) >= M.open);
      const tgt = oi > pos + 1 && (M.key !== "cn" && M.key !== "gold") ? oi : pos + Math.round(30 / D.step);
      pos = Math.min(tgt, D.p.length - 1); render(false);
      if (pos >= D.p.length - 1) finish();
    }
    function finish() {
      stop(); if (done) return;
      if (hold) trade(0);
      done = true; render(false);
      const oi = Math.max(0, D.p.findIndex((_, i) => T(i) >= M.open));
      let ci = D.p.length - 1; for (let i = 0; i < D.p.length; i++) if (T(i) < M.close) ci = i;
      const day = (D.p[ci] / D.prev - 1) * 100, bh = (D.p[ci] / D.p[oi] - 1) * 100;
      const hi = Math.max(...D.p), lo = Math.min(...D.p), amp = (hi - lo) / D.prev * 100;
      const S = stats(); S.n++; S.sum += realized; if (realized > 0) S.win++; S.by[M.key] = (S.by[M.key] || 0) + 1; ls(LS, JSON.stringify(S));
      const wk = "日一二三四五六"[new Date(D.date + "T12:00:00").getDay()];
      $("#tpEnd").innerHTML = `<div class="tp-end"><h3>揭晓：${esc(D.date)}（周${wk}）</h3>
        <p>你今天 <span class="big">${pc(realized)}</span>（10 万本金 ${realized >= 0 ? "+" : ""}${Math.round(CAP * realized / 100)}），${trades.filter((t) => t.lab !== "平").length} 次开仓</p>
        <p>这天${esc(M.name)}：收盘 ${pc(day)}，全天振幅 ${amp.toFixed(2)}%；开盘买进拿到收盘 ${pc(bh)}</p>
        <p style="opacity:.85;font-size:12.5px">${Math.abs(realized) < 0.05 ? "没怎么动也是一种选择。" : realized > bh ? "比开盘买了不动做得好。" : "比开盘买了不动差——多数日内来回操作都会这样，主要是成本和追涨杀跌。"}</p></div>`;
      showStat();
    }
    function showStat() {
      const S = stats();
      const el = $("#tpStat"); if (el) el.textContent = S.n ? `你已经练了 ${S.n} 天：赚钱的 ${S.win} 天（${Math.round(S.win / S.n * 100)}%），平均每天 ${pc(S.sum / S.n)}（成绩只存在这台设备上）` : "";
    }

    draw(); newDay();
  }
  window.__mod_tape = { page };
})();
