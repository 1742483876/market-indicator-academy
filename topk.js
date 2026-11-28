/* 🌍 各市场 TOP 标的 K线 + 分析（按需加载；老大 2026-11-26 03:00：「A股美股港日韩黄金这些 top 的 k线要有，要带上分析」）
   数据：topk.py → topk.json（6 市场 / 13 标的，近 120 根 OHLC + MA + 三档趋势 + 一句白话）。
   首页 #/topk 完整页：市场切换 → 每个标的真·K线（ECharts candlestick + MA20/50/200）+ 分析；
   另导出 window.__mod_topk.thumbHTML() 给首页小卡用（纯 SVG 缩略 K 线，不初始化图表）。*/
(function () {
  const A = window.__APP;
  const { app, esc, FAIL, DISC, getJSON, mk, C, axisStyle } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  if (!document.getElementById("tk-css")) {
    const st = document.createElement("style"); st.id = "tk-css";
    st.textContent = `
.tk-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px;-webkit-overflow-scrolling:touch}
.tk-tabs a{flex:none;font-size:13.5px;padding:6px 12px;border-radius:20px;background:var(--soft);color:var(--sub);text-decoration:none;font-weight:600;white-space:nowrap}
.tk-tabs a.on{background:var(--brand);color:#fff}
.tk-mode{display:flex;gap:6px;margin:0 0 10px}
.tk-mode a{flex:1;text-align:center;font-size:13.5px;font-weight:700;padding:8px 0;border-radius:9px;background:var(--soft);color:var(--sub);text-decoration:none}
.tk-mode a.on{background:var(--brand);color:#fff}
.tk-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;margin:0 0 12px}
.tk-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:2px}
.tk-h b{font-size:17px;font-weight:800}.tk-h em{font-style:normal;font-size:12px;color:var(--sub)}
.tk-px{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;margin:6px 0 2px}
.tk-px small{font-size:13px;font-weight:600;margin-left:6px}
.tk-meta{font-size:12.5px;color:var(--sub);line-height:1.6;font-variant-numeric:tabular-nums}
.tk-meta b{color:var(--text)}
.tk-vw{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:6px;color:#fff;vertical-align:middle}
.tk-vw.up{background:var(--up)}.tk-vw.down{background:var(--down,#2fa86b)}.tk-vw.flat{background:#9aa3ad}
.tk-chart{width:100%;height:260px;margin:8px 0 4px}
.tk-note{font-size:13.5px;line-height:1.7;color:var(--text);background:var(--soft);border-radius:8px;padding:9px 12px;margin-top:6px}
.tk-legend{font-size:11.5px;color:var(--sub2);margin-top:2px}
/* 首页缩略卡 */
.tkm-i{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--text)}
.tkm-i:last-child{border-bottom:0}
.tkm-nm{flex:0 0 92px;font-size:13.5px;font-weight:700;line-height:1.3}
.tkm-nm em{display:block;font-style:normal;font-size:11px;color:var(--sub2);font-weight:400;margin-top:2px}
.tkm-svg{flex:1;min-width:0;height:34px}
.tkm-svg svg{width:100%;height:34px;display:block}
/* 有分时时：日K 缩略压到上半、分时小线放下面一行，两块都铺满同一宽度 */
.tkm-svg.has-min{height:46px;display:flex;flex-direction:column;justify-content:space-between}
.tkm-svg.has-min>svg{height:22px}
.tkm-min{display:block;height:22px}
.tkm-min svg{width:100%;height:22px;display:block}
.tkm-end{flex:0 0 78px;text-align:right}
.tkm-end b{display:block;font-size:14px;font-variant-numeric:tabular-nums}
.tkm-end span{font-size:11.5px;color:var(--sub)}
`;
    document.head.appendChild(st);
  }
  const upCls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "flat");
  const pc = (v, d = 1) => (v == null ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(d) + "%");
  const vcls = (v) => (v === "up" ? "up" : v === "down" ? "down" : "flat");
  const vword = (v) => (v === "up" ? "偏多" : v === "down" ? "偏空" : "震荡");
  // 分时形态短标签（fenshi.py 的 shape → 中文），日K 卡里顺带点一句
  const SHAPEW = {
    strong: "单边走强", weak: "单边走弱", tail_up: "尾盘拉升", tail_down: "尾盘跳水",
    high_fade: "冲高回落", low_recover: "低开回升", close_high: "收最高", close_low: "收最低",
    chop: "震荡", flat: "横盘",
  };

  // 缩略 K 线（SVG）：ox/oc/ol/oh 来自 [d,o,c,l,h]
  function thumbSVG(k) {
    if (!k || k.length < 5) return "";
    const arr = k.slice(-40), W = 120, H = 34;
    const hi = Math.max(...arr.map((x) => x[4])), lo = Math.min(...arr.map((x) => x[3]));
    const r = hi - lo || 1, step = W / arr.length, bw = Math.max(1.2, step * 0.62);
    const y = (v) => H - 2 - ((v - lo) / r) * (H - 4);
    let s = "";
    arr.forEach((x, i) => {
      const cx = i * step + step / 2, up = x[2] >= x[1];
      const col = up ? "#e5484d" : "#2fa86b";
      s += `<line x1="${cx.toFixed(1)}" y1="${y(x[4]).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${y(x[3]).toFixed(1)}" stroke="${col}" stroke-width="0.8"/>`;
      const t = Math.min(y(x[1]), y(x[2])), hgt = Math.max(1, Math.abs(y(x[1]) - y(x[2])));
      s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${t.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${col}"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${s}</svg>`;
  }

  function heroSVG(k) {
    if (!k || k.length < 5) return "";
    const arr = k.slice(-60), W = 680, H = 260;
    const hi = Math.max(...arr.map((x) => x[4])), lo = Math.min(...arr.map((x) => x[3]));
    const r = hi - lo || 1, step = W / arr.length, bw = Math.max(2, step * 0.6);
    const y = (v) => H - 16 - ((v - lo) / r) * (H - 30);
    let s = "";
    arr.forEach((x, i) => {
      const cx = i * step + step / 2, up = x[2] >= x[1], col = up ? "#e5484d" : "#2fa86b";
      s += `<line x1="${cx.toFixed(1)}" y1="${y(x[4]).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${y(x[3]).toFixed(1)}" stroke="${col}" stroke-width="1"/>`;
      const t = Math.min(y(x[1]), y(x[2])), hgt = Math.max(1.5, Math.abs(y(x[1]) - y(x[2])));
      s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${t.toFixed(1)}" width="${bw.toFixed(1)}" height="${hgt.toFixed(1)}" fill="${col}"/>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:260px">${s}</svg>`;
  }

  // 分时缩略线（SVG）：价格线 + 昨收基准，红涨绿跌
  function minSVG(f) {
    if (!f || !f.pts || f.pts.length < 8) return "";
    const W = 120, H = 24, arr = f.pts, ps = arr.map((x) => x[1]);
    const hi = Math.max(...ps, f.base), lo = Math.min(...ps, f.base);
    const r = hi - lo || 1, step = W / (arr.length - 1 || 1);
    const y = (v) => H - 1.5 - ((v - lo) / r) * (H - 3);
    const col = (f.chg || 0) >= 0 ? "#e5484d" : "#2fa86b";
    const d = arr.map((x, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${y(x[1]).toFixed(1)}`).join(" ");
    const by = y(f.base).toFixed(1);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" y1="${by}" x2="${W}" y2="${by}" stroke="#c9d0d8" stroke-width="0.7" stroke-dasharray="2 2"/><path d="${d}" fill="none" stroke="${col}" stroke-width="1.1"/></svg>`;
  }

  // 首页小卡：每个市场一行 top（最多3只），日K 缩略 + 分时缩略 + 最新价 + 趋势
  function thumbHTML(J, F) {
    if (!J || !J.markets) return "";
    const fmap = {};
    if (F && F.markets) F.markets.forEach((m) => (m.items || []).forEach((it) => { if (it && it.code && it.kind !== "na") fmap[it.code] = it; }));
    let h = "";
    J.markets.forEach((m) => {
      h += `<div style="font-size:13px;font-weight:700;color:var(--sub);padding:8px 0 2px">${esc(m.flag)} ${esc(m.name)}</div>`;
      (m.items || []).slice(0, 3).forEach((it) => {
        const f = fmap[it.code];
        h += `<a class="tkm-i" href="#/topk"><span class="tkm-nm">${esc(it.name)}<em>${esc(it.typ)}${f ? ` · 分时 ${pc(f.chg, 2)}` : ""}</em></span>
          <span class="tkm-svg${f ? " has-min" : ""}">${thumbSVG(it.k)}${f ? `<i class="tkm-min">${minSVG(f)}</i>` : ""}</span>
          <span class="tkm-end"><b class="${upCls(it.chg)}">${esc(it.close)}</b><span class="tk-vw ${vcls(it.view)}" style="font-size:10px;padding:1px 6px">${vword(it.view)}</span></span></a>`;
      });
    });
    return h;
  }

  async function page() {
    document.title = "各市场 TOP K线 · 小七投研";
    const tok = A.tok();
    app.innerHTML = `<h1>🌍 各市场 TOP K线 + 分析</h1>${A.LOADING()}`;
    let J, F = null;
    try { J = await getJSON("topk.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>🌍 各市场 TOP K线</h1>${FAIL()}`; return; }
    try { F = await getJSON("fenshi.json", true); } catch (e) { F = null; }  // 分时缺了不影响日K
    if (!A.alive(tok)) return;
    try { await A.need("lib"); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>各市场 TOP K线</h1>${FAIL("图表组件加载失败，请刷新重试")}`; return; }
    if (!A.alive(tok)) return;
    // 分时按代码索引（同一份标的清单，topk.py / fenshi.py 共用 MARKETS）
    const fmap = {};
    if (F && F.markets) F.markets.forEach((m) => (m.items || []).forEach((it) => { if (it && it.code && it.kind !== "na") fmap[it.code] = it; }));
    const hasMin = Object.keys(fmap).length > 0;
    let mode = localStorage.getItem("tk_mode") === "min" && hasMin ? "min" : "day";
    const cur0 = J.markets[0];

    const drawFenshi = (el, f) => {
      const c = C();
      const times = f.pts.map((p) => p[0]);
      const price = f.pts.map((p) => p[1]);
      const avg = f.pts.map((p) => p[2]);
      const vol = (f.vol || []).slice(0, times.length);
      while (vol.length < times.length) vol.push(0);
      const up = (f.chg || 0) >= 0, col = up ? c.up : c.dn;
      const chart = mk(el);
      chart.setOption({
        animation: false,
        tooltip: { trigger: "axis", axisPointer: { type: "cross" },
          formatter: (ps) => {
            const i = ps[0].dataIndex;
            return `${times[i]}<br/>价 ${price[i]}<br/>均价 ${avg[i] == null ? "—" : avg[i]}<br/>量 ${vol[i]} 万手`;
          } },
        grid: [{ left: 50, right: 14, top: 12, height: "58%" }, { left: 50, right: 14, top: "74%", height: "16%" }],
        xAxis: [
          { type: "category", data: times, ...axisStyle(), splitLine: { show: false }, axisLabel: { ...(axisStyle().axisLabel || {}), interval: Math.max(1, Math.floor(times.length / 4)) } },
          { type: "category", gridIndex: 1, data: times, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
        ],
        yAxis: [
          { type: "value", scale: true, ...axisStyle(), splitNumber: 4 },
          { type: "value", gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false } },
        ],
        series: [
          { name: "价", type: "line", data: price, showSymbol: false, lineStyle: { width: 1.6, color: col }, itemStyle: { color: col },
            areaStyle: { color: up ? "rgba(229,72,77,.10)" : "rgba(47,168,107,.10)" },
            markLine: { silent: true, symbol: "none", data: [{ yAxis: f.base }],
              lineStyle: { type: "dashed", width: 1, color: "#9aa3ad" },
              label: { formatter: "昨收 " + f.base, position: "insideEndTop", color: "#9aa3ad", fontSize: 10 } } },
          { name: "均价", type: "line", data: avg, showSymbol: false, smooth: true, lineStyle: { width: 1.1, color: "#e8a317" }, itemStyle: { color: "#e8a317" } },
          { name: "量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: vol, itemStyle: { color: up ? "rgba(229,72,77,.55)" : "rgba(47,168,107,.55)" } },
        ],
      });
    };

    const drawCard = (body, it, idx, m) => {
      const f = fmap[it.code];
      const card = document.createElement("div");
      card.className = "tk-card";
      const isMin = mode === "min" && f;
      const head = `<div class="tk-h"><b>${esc(it.name)}</b><em>${esc(it.typ)} · ${esc(it.code)}</em><span class="tk-vw ${vcls(it.view)}">${vword(it.view)}</span></div>`;
      if (isMin) {
        const fc = (f.chg || 0) >= 0;
        card.innerHTML = `${head}
          <div class="tk-px ${upCls(f.chg)}">${esc(f.last)}<small>${pc(f.chg, 2)} 日内</small></div>
          <div class="tk-meta">开 <b>${esc(f.open)}</b> · 高 <b>${esc(f.high)}</b> · 低 <b>${esc(f.low)}</b> · 振幅 <b>${f.amp}%</b> · 均价 <b>${f.avg == null ? "—" : f.avg}</b> · ${esc(f.date)}（${f.kind === "min5" ? "5分钟" : "1分钟"}）</div>
          <div class="tk-chart" id="tkc${idx}"></div>
          <div class="tk-note">💡 ${esc(f.note)}</div>
          <div class="tk-legend">${fc ? "红" : "绿"}＝价格线 · 黄＝均价线 · 灰虚线＝昨收 ${esc(f.base)}　｜　下方为成交量</div>`;
        body.appendChild(card);
        drawFenshi($("#tkc" + idx, card), f);
        return;
      }
      card.innerHTML = `${head}
        <div class="tk-px ${upCls(it.chg)}">${esc(it.close)}<small>${pc(it.chg, 2)} 今日</small></div>
        <div class="tk-meta">近20日 <b class="${upCls(it.chg20)}">${pc(it.chg20)}</b> · 离200日线 <b>${it.d200 == null ? "—" : it.d200 + "%"}</b> · RSI <b>${it.rsi == null ? "—" : it.rsi}</b> · ${esc(it.date)}${f ? ` · 分时 <b>${pc(f.chg, 2)}</b> ${esc(SHAPEW[f.shape] || "")}` : ""}</div>
        <div class="tk-chart" id="tkc${idx}"></div>
        <div class="tk-note">💡 ${esc(it.note)}</div>
        <div class="tk-legend">MA20 黄 · MA50 灰 · MA200 蓝　｜　红涨绿跌　｜　鼠标拖动看区间</div>`;
      body.appendChild(card);
      const el = $("#tkc" + idx, card), c = C();
      const chart = mk(el);
      const kd = it.k.map((x) => [x[1], x[2], x[3], x[4]]); // [o,c,l,h]
      const dates = it.k.map((x) => x[0]);
      const cl = it.k.map((x) => x[2]);
      const mline = (n, color) => cl.map((_, i) => (i >= n - 1 ? cl.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n : null));
      chart.setOption({
        animation: false,
        tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
        grid: { left: 52, right: 14, top: 12, bottom: 46 },
        xAxis: { type: "category", data: dates, ...axisStyle(), splitLine: { show: false } },
        yAxis: { type: "value", scale: true, ...axisStyle(), splitNumber: 4 },
        dataZoom: [
          { type: "inside", start: 45, end: 100 },
          { type: "slider", start: 45, end: 100, height: 16, bottom: 6, textStyle: { color: c.sub } },
        ],
        series: [
          { name: "K线", type: "candlestick", data: kd, itemStyle: { color: c.up, color0: c.dn, borderColor: c.up, borderColor0: c.dn } },
          { name: "MA20", type: "line", data: mline(20), showSymbol: false, smooth: true, lineStyle: { width: 1.2, color: "#e8a317" }, itemStyle: { color: "#e8a317" } },
          { name: "MA50", type: "line", data: mline(50), showSymbol: false, smooth: true, lineStyle: { width: 1.1, color: "#9aa3ad" }, itemStyle: { color: "#9aa3ad" } },
          { name: "MA200", type: "line", data: mline(200), showSymbol: false, smooth: true, lineStyle: { width: 1.3, color: "#2f7fd8" }, itemStyle: { color: "#2f7fd8" } },
        ],
      });
    };

    const draw = (m) => {
      app.innerHTML = `<h1>🌍 各市场 TOP K线 + 分析 <a class="h2a" href="#/">首页 ›</a></h1>
        <div class="po-meta">每个市场挑最有代表性的宽基 + 龙头股。三档判断只作温度计：<b>偏多</b>＝收盘在 200 日线上、50 日线在 200 日线上、20 日线向上；<b>偏空</b>＝三条反过来。红涨绿跌。日K 数据 ${esc(J.built)}${F ? `，分时 ${esc(F.built)}` : ""}</div>
        <div class="tk-tabs">${J.markets.map((x) => `<a href="javascript:;" data-k="${esc(x.key)}" class="${x.key === m.key ? "on" : ""}">${esc(x.flag)} ${esc(x.name)}</a>`).join("")}</div>
        ${hasMin ? `<div class="tk-mode"><a href="javascript:;" data-md="day" class="${mode === "day" ? "on" : ""}">📊 日K（120根）</a><a href="javascript:;" data-md="min" class="${mode === "min" ? "on" : ""}">📈 分时走势</a></div>` : ""}
        <div id="tkbody"></div>${DISC}`;
      $$(".tk-tabs a").forEach((a) => a.addEventListener("click", () => {
        const nm = J.markets.find((x) => x.key === a.dataset.k); if (nm) draw(nm);
      }));
      $$(".tk-mode a").forEach((a) => a.addEventListener("click", () => {
        mode = a.dataset.md; try { localStorage.setItem("tk_mode", mode); } catch (e) {}
        draw(m);
      }));
      const body = $("#tkbody");
      if (mode === "min" && !hasMin) body.innerHTML = `<div class="card muted">分时数据还没生成，先看日K。</div>`;
      (m.items || []).forEach((it, idx) => drawCard(body, it, idx, m));
    };
    draw(cur0);
  }
  window.__mod_topk = { page, thumbHTML, heroSVG };
})();
