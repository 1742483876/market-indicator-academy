/* 小七投研 · 页面逻辑：今日驾驶舱 / 报告库 / 短线 / 指标看板 / 指标学堂 */
(function () {
  const D = window.DATA;
  // ---------- 按需加载（首屏只下 core.js + app.js；课程内容、曲线、ECharts、报告、短线数据都是打开对应页面才下载） ----------
  const STORE = { s: {}, o: {}, c: {}, h: {} }, WAIT = {};
  D.s = STORE.s; D.ohlc = STORE.o; D.strategies.curves = STORE.c;
  const ver = (D.meta && D.meta.ver) || "";
  function expand(x) {
    if (!x || !x.dd) return x;
    const out = [], t0 = new Date(x.d0 + "T00:00:00Z").getTime();
    let t = t0;
    x.dd.forEach((g) => { t += g * 86400000; out.push(new Date(t).toISOString().slice(0, 10)); });
    const y = { ...x, d: out }; delete y.dd; delete y.d0; return y;
  }
  window.__put = (kind, key, val) => { STORE[kind][key] = expand(val); const w = WAIT[kind + ":" + key]; if (w) w.res(); };
  function loadScript(src, key, kind, ordered) {
    return new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = src; el.async = !ordered;
      if (kind) WAIT[kind + ":" + key] = { res };
      el.onload = () => { if (!kind) res(); };
      el.onerror = () => rej(new Error("加载失败：" + src));
      document.head.appendChild(el);
    });
  }
  const PEND = {};
  function need(kind, key) {
    if (kind === "lib") {
      if (window.echarts) return Promise.resolve();
      return (PEND.lib = PEND.lib || loadScript("echarts.min.js?v=5.5.1").catch((e) => { delete PEND.lib; throw e; }));
    }
    if (!key) return Promise.resolve();
    if (STORE[kind][key]) return Promise.resolve();
    if (!((D.avail || {})[kind] || []).includes(key)) return Promise.resolve();
    const id = kind + ":" + key;
    return (PEND[id] = PEND[id] || loadScript(`d/${kind}_${key}.js?v=${ver}`, key, kind).catch((e) => { delete PEND[id]; throw e; }));
  }
  function needsOf(x) {
    const c = (x && x.chart) || {}, n = [];
    if (c.type && c.type !== "today") n.push(["lib"]);
    if (c.s) n.push(["s", c.s]);
    if (c.idx) n.push(["s", c.idx]);
    (c.keys || []).forEach((k) => n.push(["s", k]));
    if (c.src) n.push(["o", c.src]);
    if (c.type === "twoside") n.push(["o", "hs300"], ["h", "two"]);
    if (c.type === "quad") n.push(c.market === "us" ? ["s", "us_joint_y"] : ["s", "joint_y"], c.market === "us" ? ["s", "us_joint_x"] : ["s", "joint_x"]);
    if (c.type === "strategy") n.push(["c", c.key]);
    if (x && x.tech) n.push(["o", x.tech.src]);
    if (x && x.sl) n.push(["s", x.sl.s]);
    return n;
  }
  let routeToken = 0;
  async function ensure(list) { await Promise.all(list.map(([k, v]) => need(k, v))); }
  // 课程内容（content1/2/3.js）+ 云同步，进学堂相关页面才下载
  let L = null, byId = {}, contentP = null, cloudP = null;
  function needContent() {
    if (L) return Promise.resolve();
    return (contentP = contentP || Promise.all(["content1", "content2", "content3"].map((f) => loadScript(`${f}.js?v=${ver}`, null, null, true)))
      .then(() => { L = window.LESSONS; byId = Object.fromEntries(L.map((x) => [x.id, x])); loadCloud(); })
      .catch((e) => { contentP = null; throw e; }));
  }
  function loadCloud() {
    return (cloudP = cloudP || loadScript(`cloud.js?v=${ver}`).then(() => { if (lastEmit) emit(...lastEmit); }).catch(() => { cloudP = null; }));
  }
  const JC = {};
  function getJSON(url, fresh) {
    const u = url + (url.includes("?") ? "&" : "?") + "v=" + (fresh ? Math.floor(Date.now() / 300000) : ver);
    return (JC[u] = JC[u] || fetch(u).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch((e) => { delete JC[u]; throw e; }));
  }

  const $ = (s) => document.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $("#app");
  const charts = [];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const C = () => ({
    text: css("--text"), sub: css("--sub"), grid: css("--line"), up: "#e5484d", dn: "#2fa86b",
    buy: "rgba(229,72,77,0.13)", sell: "rgba(47,168,107,0.16)", main: css("--accent"), idx: "#9a9a9a",
  });

  // ---------- 工具 ----------
  const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
  const pct = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(d) + "%");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const updn = (v) => (v > 0 ? "up" : v < 0 ? "dn" : "");
  const LOADING = (t = "正在加载…") => `<div class="card loading">${t}</div>`;
  const FAIL = (t = "加载失败：网络不太好") => `<div class="card">${t}，<a href="javascript:location.reload()">点这里重试</a></div>`;
  const DISC = '<p class="disclaimer">仅供学习研究，不构成投资建议。数据来自公开接口，可能有延迟或误差，以交易所和报告原文为准。</p>';
  function since(ser, from) {
    if (!ser) return null;
    if (!from) return ser;
    const i = ser.d.findIndex((x) => x >= from);
    return i < 0 ? ser : { d: ser.d.slice(i), v: ser.v.slice(i) };
  }
  function align(dates, ser) {
    const m = new Map(ser.d.map((d, i) => [d, ser.v[i]]));
    let last = null;
    return dates.map((d) => { if (m.has(d)) last = m.get(d); return last; });
  }
  function disposeCharts() { while (charts.length) charts.pop().dispose(); }
  function mk(el) { const c = echarts.init(el, null, { renderer: "canvas" }); charts.push(c); return c; }
  window.addEventListener("resize", () => charts.forEach((c) => c.resize()));
  const zoom = (n, len, xi = [0]) => [
    { type: "inside", xAxisIndex: xi, startValue: Math.max(0, len - n), endValue: len - 1 },
    { type: "slider", xAxisIndex: xi, startValue: Math.max(0, len - n), endValue: len - 1, height: 18, bottom: 6, textStyle: { color: C().sub } },
  ];
  const axisStyle = () => ({ axisLine: { lineStyle: { color: C().grid } }, axisLabel: { color: C().sub, fontSize: 11 }, splitLine: { lineStyle: { color: C().grid, opacity: 0.5 } } });
  const bjDate = () => new Date(Date.now() + 8 * 3600e3); // 北京时间（用 UTC 字段读）
  const wk = (s) => "日一二三四五六"[new Date(s + "T00:00:00Z").getUTCDay()];

  // ---------- 图表：指标线 ----------
  function lineChart(el, spec) {
    let s = since(D.s[spec.s], spec.since);
    if (!s || !s.d.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const c = C();
    const vals = s.v.filter((x) => x !== null);
    const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.05 || 1;
    const yMin = spec.yr ? spec.yr[0] : lo - pad, yMax = spec.yr ? spec.yr[1] : hi + pad;
    const areas = [];
    if (spec.band) {
      const b = spec.band(D) || {};
      if (b.buy) areas.push([{ yAxis: b.buy[0] ?? yMin, itemStyle: { color: c.buy } }, { yAxis: b.buy[1] ?? yMax }]);
      if (b.sell) areas.push([{ yAxis: b.sell[0] ?? yMin, itemStyle: { color: c.sell } }, { yAxis: b.sell[1] ?? yMax }]);
    }
    const series = [{
      name: spec.name, type: "line", data: s.v, showSymbol: false, step: spec.step ? "end" : false, lineStyle: { width: 1.6, color: c.main }, itemStyle: { color: c.main },
      markArea: { silent: true, data: areas },
      markLine: spec.hl ? { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#8b5cf6" }, label: { color: c.sub, formatter: "{c}" }, data: spec.hl.map((v) => ({ yAxis: v })) } : undefined,
      markPoint: { symbolSize: 34, label: { fontSize: 10, color: "#fff" }, itemStyle: { color: "#e5484d" }, data: [{ coord: [s.d.length - 1, s.v[s.v.length - 1]], value: fmt(s.v[s.v.length - 1], Math.abs(s.v[s.v.length - 1]) >= 100 ? 0 : 2) }] },
    }];
    const yAxis = [{ type: "value", min: yMin, max: yMax, scale: true, ...axisStyle() }];
    if (spec.idx && D.s[spec.idx]) {
      series.push({ name: spec.idxName, type: "line", yAxisIndex: 1, data: align(s.d, D.s[spec.idx]), showSymbol: false, lineStyle: { width: 1, color: c.idx }, itemStyle: { color: c.idx }, z: 1 });
      yAxis.push({ type: "value", scale: true, position: "right", splitLine: { show: false }, axisLabel: { color: c.idx, fontSize: 10 }, axisLine: { show: false } });
    }
    mk(el).setOption({
      animation: false, grid: { left: 48, right: spec.idx ? 52 : 16, top: 30, bottom: 52 },
      tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub, fontSize: 11 } },
      xAxis: { type: "category", data: s.d, ...axisStyle(), splitLine: { show: false } }, yAxis, series,
      dataZoom: zoom(spec.show || Math.min(s.d.length, 750), s.d.length),
    });
  }

  // ---------- 图表：多指数对比 ----------
  function multiChart(el, spec) {
    const c = C(), cols = ["#e5484d", "#2f7fd8", "#e8833a", "#8b5cf6", "#2fa86b"];
    const base = since(D.s[spec.keys[0]], spec.since);
    const series = spec.keys.map((k, i) => {
      const v = align(base.d, D.s[k]);
      const first = v.find((x) => x !== null);
      return { name: spec.names[i], type: "line", showSymbol: false, data: v.map((x) => (x === null ? null : +(x / first * 100).toFixed(2))), lineStyle: { width: 1.4, color: cols[i] }, itemStyle: { color: cols[i] } };
    });
    mk(el).setOption({ animation: false, grid: { left: 44, right: 16, top: 30, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub } },
      xAxis: { type: "category", data: base.d, ...axisStyle(), splitLine: { show: false } }, yAxis: { type: "value", scale: true, ...axisStyle() }, series, dataZoom: zoom(base.d.length, base.d.length) });
  }

  // ---------- 图表：K线 + 叠加 + 副图 ----------
  function klineChart(el, spec) {
    const P = D.ohlc[spec.src];
    if (!P) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const c = C(), n = P.d.length;
    const k = P.d.map((_, i) => [P.open[i], P.close[i], P.low[i], P.high[i]]);
    const main = [{ name: "K线", type: "candlestick", data: k, itemStyle: { color: c.up, color0: c.dn, borderColor: c.up, borderColor0: c.dn } }];
    const line = (name, data, color, extra = {}) => ({ name, type: "line", data, showSymbol: false, lineStyle: { width: 1.1, color, ...(extra.ls || {}) }, itemStyle: { color }, ...extra.opt });
    const maCol = { ma5: "#888", ma10: "#aaa", ma20: "#e8a317", ma60: "#8b5cf6", ma120: "#2fa86b", ma250: "#2f7fd8" };
    (spec.ov || []).forEach((o) => {
      if (o.startsWith("ma")) main.push(line(o.toUpperCase(), P[o], maCol[o]));
      if (o === "boll") {
        main.push(line("布林中轨", P.bm, "#8b5cf6"));
        main.push(line("布林上轨", P.bu, "#8b5cf6", { ls: { type: "dashed" } }));
        main.push(line("布林下轨", P.bl, "#8b5cf6", { ls: { type: "dashed" } }));
      }
      if (o === "ichimoku") {
        const bullLo = [], bullH = [], bearLo = [], bearH = [];
        P.ia.forEach((a, i) => {
          const b = P.ib[i];
          if (a === null || b === null) { bullLo.push(null); bullH.push(null); bearLo.push(null); bearH.push(null); return; }
          if (a >= b) { bullLo.push(b); bullH.push(+(a - b).toFixed(3)); bearLo.push(null); bearH.push(null); }
          else { bearLo.push(a); bearH.push(+(b - a).toFixed(3)); bullLo.push(null); bullH.push(null); }
        });
        const area = (name, stack, data, color, fill) => ({ name, type: "line", stack, data, showSymbol: false, lineStyle: { width: 0 }, areaStyle: fill ? { color } : { color: "transparent" }, itemStyle: { color }, tooltip: { show: false }, connectNulls: false });
        main.push(area("云底", "bull", bullLo, "transparent", false), area("一目云（多）", "bull", bullH, "rgba(229,72,77,0.22)", true));
        main.push(area("云底2", "bear", bearLo, "transparent", false), area("一目云（空）", "bear", bearH, "rgba(47,168,107,0.22)", true));
        main.push(line("转换线", P.tk, "#e8a317"), line("基准线", P.kj, "#2f7fd8"));
      }
    });
    const sub = [];
    let subY = { type: "value", scale: true, gridIndex: 1, ...axisStyle(), splitNumber: 2 };
    const s = spec.sub;
    if (s === "vol") sub.push({ name: "成交量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: P.volume.map((v, i) => ({ value: v, itemStyle: { color: P.close[i] >= P.open[i] ? c.up : c.dn } })) });
    if (s === "macd" || s === "vwmacd") {
      const dif = s === "macd" ? P.dif : P.vdif, dea = s === "macd" ? P.dea : P.vdea;
      sub.push({ name: s === "macd" ? "MACD柱" : "VWMACD柱", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: dif.map((v, i) => (v === null || dea[i] === null ? null : { value: +(v - dea[i]).toFixed(3), itemStyle: { color: v - dea[i] >= 0 ? c.up : c.dn } })) });
      sub.push({ ...line("DIF", dif, c.text), xAxisIndex: 1, yAxisIndex: 1 }, { ...line("DEA", dea, "#e8833a"), xAxisIndex: 1, yAxisIndex: 1 });
    }
    if (s === "kdj") {
      sub.push({ ...line("K", P.k, c.text), xAxisIndex: 1, yAxisIndex: 1, markArea: { silent: true, data: [[{ yAxis: -20, itemStyle: { color: c.buy } }, { yAxis: 20 }], [{ yAxis: 80, itemStyle: { color: c.sell } }, { yAxis: 120 }]] } });
      sub.push({ ...line("D", P.kd, "#e8833a"), xAxisIndex: 1, yAxisIndex: 1 }, { ...line("J", P.j, "#8b5cf6"), xAxisIndex: 1, yAxisIndex: 1 });
      subY = { ...subY, scale: false, min: -20, max: 120 };
    }
    if (s === "rsi") {
      sub.push({ ...line("RSI14", P.rsi, c.text), xAxisIndex: 1, yAxisIndex: 1, markArea: { silent: true, data: [[{ yAxis: 0, itemStyle: { color: c.buy } }, { yAxis: 30 }], [{ yAxis: 70, itemStyle: { color: c.sell } }, { yAxis: 100 }]] } });
      subY = { ...subY, scale: false, min: 0, max: 100 };
    }
    if (s === "bias") sub.push({ name: "20日乖离率%", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: P.bias20.map((v) => (v === null ? null : { value: v, itemStyle: { color: v >= 0 ? c.up : c.dn } })) });
    mk(el).setOption({
      animation: false, tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: { top: 0, textStyle: { color: c.sub, fontSize: 11 }, data: main.concat(sub).map((x) => x.name).filter((x) => x && !x.startsWith("云底")) },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [{ left: 52, right: 14, top: 30, height: "54%" }, { left: 52, right: 14, top: "68%", height: "18%" }],
      xAxis: [{ type: "category", data: P.d, ...axisStyle(), splitLine: { show: false }, axisLabel: { show: false } }, { type: "category", gridIndex: 1, data: P.d, ...axisStyle(), splitLine: { show: false } }],
      yAxis: [{ type: "value", scale: true, ...axisStyle() }, subY],
      series: main.concat(sub), dataZoom: zoom(spec.show || 250, n, [0, 1]),
    });
  }

  // ---------- 图表：四象限 ----------
  function quadChart(el, spec) {
    const ky = spec.market === "us" ? "us_joint_y" : "joint_y", kx = spec.market === "us" ? "us_joint_x" : "joint_x";
    const Y = D.s[ky], X = D.s[kx];
    if (!Y || !X) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const xs = align(Y.d, X), c = C();
    const pts = Y.d.map((d, i) => [xs[i] === null ? null : +(xs[i] / 100).toFixed(3), +(Y.v[i] / 100).toFixed(3), d]).filter((p) => p[0] !== null);
    const yr = pts.slice(-250), rec = pts.slice(-30), now = pts[pts.length - 1];
    const q = (D.today[spec.market] && D.today[spec.market].joint && D.today[spec.market].joint.quad_stats_20d) || {};
    const lab = (k, name) => (q[k] ? `${k}${name}\n后20日 ${pct(q[k][0])} / 胜率${fmt(q[k][1], 0)}%` : k + name);
    mk(el).setOption({
      animation: false, grid: { left: 48, right: 16, top: 16, bottom: 44 },
      tooltip: { formatter: (p) => (p.data && p.data[2] ? `${p.data[2]}<br>趋势分 ${p.data[0]}<br>抄底分 ${p.data[1]}` : "") },
      xAxis: { type: "value", min: -1.05, max: 1.05, name: "趋势分 →", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: c.sub }, ...axisStyle() },
      yAxis: { type: "value", min: -1.05, max: 1.05, name: "抄底分 →", nameLocation: "middle", nameGap: 32, nameTextStyle: { color: c.sub }, ...axisStyle() },
      series: [
        { type: "line", data: yr, showSymbol: false, lineStyle: { color: c.idx, width: 0.8 }, z: 1,
          markArea: { silent: true, label: { color: c.text, fontSize: 11, position: "insideTopLeft" }, data: [
            [{ coord: [-1.05, 0.3], name: lab("①", "左侧抄底"), itemStyle: { color: "rgba(229,72,77,0.14)" } }, { coord: [0, 1.05] }],
            [{ coord: [0, 0.3], name: lab("②", "右侧确认"), itemStyle: { color: "rgba(229,72,77,0.07)" } }, { coord: [1.05, 1.05] }],
            [{ coord: [0, -1.05], name: lab("③", "顺势持有"), itemStyle: { color: "rgba(160,160,160,0.12)" }, label: { position: "insideBottomLeft" } }, { coord: [1.05, 0.3] }],
            [{ coord: [-1.05, -1.05], name: lab("④", "回避"), itemStyle: { color: "rgba(47,168,107,0.14)" }, label: { position: "insideBottomLeft" } }, { coord: [0, 0.3] }]] },
          markLine: { silent: true, symbol: "none", lineStyle: { color: c.sub, type: "solid" }, label: { show: false }, data: [{ yAxis: 0.3 }, { xAxis: 0 }] } },
        { type: "line", data: rec, symbolSize: 4, lineStyle: { color: "#e5484d", width: 1.2 }, itemStyle: { color: "#e5484d" }, z: 3 },
        { type: "scatter", data: [now], symbolSize: 16, itemStyle: { color: "#e5484d", borderColor: "#fff", borderWidth: 2 }, z: 4,
          label: { show: true, position: "right", color: "#e5484d", formatter: () => `今天 ${now[2].slice(5)}` } },
      ],
    });
  }

  // ---------- 图表：策略净值 ----------
  function stratChart(el, key) {
    const cv = D.strategies.curves[key], c = C();
    if (!cv) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    if (key === "dca") {
      const cols = { 普通定投: "#9a9a9a", 估值定投: "#e5484d", 均线偏离定投: "#2f7fd8" };
      const series = [];
      Object.keys(cols).forEach((k) => {
        series.push({ name: k + " 市值", type: "line", showSymbol: false, data: cv[k].value, lineStyle: { color: cols[k], width: 1.5 }, itemStyle: { color: cols[k] } });
        series.push({ name: k + " 投入", type: "line", showSymbol: false, data: cv[k].invested, lineStyle: { color: cols[k], width: 1, type: "dashed" }, itemStyle: { color: cols[k] } });
      });
      mk(el).setOption({ animation: false, grid: { left: 60, right: 16, top: 50, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub, fontSize: 10 } },
        xAxis: { type: "category", data: cv.dates, ...axisStyle(), splitLine: { show: false } }, yAxis: { type: "value", ...axisStyle() }, series, dataZoom: zoom(cv.dates.length, cv.dates.length) });
      return;
    }
    mk(el).setOption({ animation: false, grid: { left: 48, right: 16, top: 30, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub } },
      xAxis: { type: "category", data: cv.dates, ...axisStyle(), splitLine: { show: false } }, yAxis: { type: "value", scale: true, ...axisStyle() },
      series: [{ name: "策略", type: "line", showSymbol: false, data: cv.strat, lineStyle: { color: "#e5484d", width: 1.6 }, itemStyle: { color: "#e5484d" } },
        { name: cv.bench_name + "（基准）", type: "line", showSymbol: false, data: cv.bench, lineStyle: { color: c.idx, width: 1.2 }, itemStyle: { color: c.idx } }],
      dataZoom: zoom(cv.dates.length, cv.dates.length) });
  }

  // ---------- 今日读数（课程页） ----------
  const names = (v) => [].concat(v || []);
  const LESSON_FALLBACK = { cn: { 中证500情绪指标: "mood", 科创50点位: "percentile", 中证1000点位: "percentile" },
    us: { PCR: "pcr", 新高新低强度: "us-trend", 偏离125日线: "us-trend", McClellan广度: "breadth", 阿姆氏TRIN: "trin", AD腾落线: "adl" } };
  function lessonFor(mkt, name) {
    if (!L) return null;
    const l = L.find((y) => y.today && names(y.today[mkt]).includes(name));
    return l ? l.id : (LESSON_FALLBACK[mkt][name] && byId[LESSON_FALLBACK[mkt][name]] ? LESSON_FALLBACK[mkt][name] : null);
  }
  function todayRow(t) {
    if (!t) return "";
    const mkt = t.cn ? "cn" : "us", ns = names(t.cn || t.us), T = D.today[mkt];
    const r = T && (T.rows || []).find((x) => ns.includes(x["指标"]));
    if (!r) return "";
    const z = r["区域"] || "—", cls = z.includes("买") || z.includes("多") ? "buy" : z.includes("卖") || z.includes("空") ? "sell" : "mid";
    return `<div class="today"><div class="th">今天的读数（${mkt === "cn" ? "A股" : "美股"}，数据日期 ${esc(r["数据日期"])}）</div>
      <div class="tv"><b>${esc(r["最新值"])}</b> <span class="tag ${cls}">${esc(z)}</span>${r["历史分位"] != null ? ` <span class="muted">历史分位 ${fmt(r["历史分位"], 0)}%</span>` : ""}</div>
      <div class="muted">${esc(r["解读"])}</div></div>`;
  }
  function slReading(x) {
    const s = D.s[x.sl.s];
    if (!s || !s.v.length) return "";
    const n = s.v.length, v = s.v[n - 1], w = s.v.slice(-60).filter((y) => y !== null);
    const p = w.length ? (w.filter((y) => y <= v).length / w.length) * 100 : null;
    return `<div class="today"><div class="th">今天的读数（${esc(s.d[n - 1])}）</div><div class="tv"><b>${esc(x.sl.name)} ${fmt(v, x.sl.d || 0)}${x.sl.unit}</b>${p !== null ? ` <span class="muted">在近 ${w.length} 个交易日里排 ${fmt(p, 0)}% 分位</span>` : ""}</div>
      <div class="muted"><a href="#/short">去「短线」页看今天的涨停梯队 →</a></div></div>`;
  }
  function techReading(kind, src) {
    const P = D.ohlc[src], i = P.d.length - 1, cl = P.close[i];
    const name = { hs300: "沪深300", zz1k: "中证1000", spx: "标普500" }[src];
    let t = "";
    if (kind === "boll") {
      const z = (cl - P.bm[i]) / (P.bu[i] - P.bm[i]);
      const pos = z > 1 ? "破上轨" : z > 0.7 ? "上轨附近" : z >= 0 ? "中轨上" : z >= -0.7 ? "中轨下" : z >= -1 ? "下轨附近" : "破下轨";
      t = `收盘 ${fmt(cl)}，中轨 ${fmt(P.bm[i])}，上轨 ${fmt(P.bu[i])}，下轨 ${fmt(P.bl[i])} → <b>${pos}</b>`;
    }
    if (kind === "macd") t = `MACD：DIF ${fmt(P.dif[i])}、DEA ${fmt(P.dea[i])} → <b>${P.dif[i] > 0 ? "强" : "弱"} ${P.dif[i] > P.dea[i] ? "多" : "空"}</b>；VWMACD → <b>${P.vdif[i] > 0 ? "强" : "弱"} ${P.vdif[i] > P.vdea[i] ? "多" : "空"}</b>`;
    if (kind === "kdj") t = `K ${fmt(P.k[i], 1)}、D ${fmt(P.kd[i], 1)}、J ${fmt(P.j[i], 1)} → <b>${P.k[i] < 25 || P.j[i] < 0 ? "底部区" : P.k[i] > 75 || P.j[i] > 100 ? "顶部区" : "中间区"}，${P.k[i] > P.kd[i] ? "K在D上（偏多）" : "K在D下（偏空）"}</b>`;
    if (kind === "rsi") t = `RSI(14) = <b>${fmt(P.rsi[i], 1)}</b>（${P.rsi[i] > 70 ? "超买" : P.rsi[i] < 30 ? "超卖" : "中性"}）`;
    if (kind === "ichimoku") {
      const top = Math.max(P.ia[i], P.ib[i]), bot = Math.min(P.ia[i], P.ib[i]);
      t = `收盘 ${fmt(cl)}，云顶 ${fmt(top)}，云底 ${fmt(bot)} → <b>${cl > top ? "云上（多）" : cl < bot ? "云下（空）" : "云中（震荡）"}</b>`;
    }
    return `<div class="today"><div class="th">今天的读数（${name}，${P.d[i]}）</div><div class="tv">${t}</div></div>`;
  }

  const verdictCard = (mkt) => {
    const T = D.today[mkt];
    if (!T || !T.joint) return "";
    const j = T.joint, ts = T.twoside;
    return `<div class="card verdict"><div class="vh">${mkt === "cn" ? "🇨🇳 A股" : "🇺🇸 美股"}<span class="muted">数据截至 ${esc(j.data_date || T.us_date || T.date)}</span></div>
      <div class="vq">${esc(j.quadrant)}<span class="muted"> 抄底分 ${fmt(j.score / 100)} ｜ 趋势分 ${fmt(j.trend / 100)}</span></div>
      <div class="vv">${esc(j.verdict_short || j.verdict)}</div>
      ${ts ? `<div class="muted">两面法：基本面 <b>${esc(ts.fund)}</b> × ${esc(ts.main)} 技术面 <b>${esc(ts.tech[ts.main]["总结"])}</b> → ${esc(ts.verdict)}，上限 ${ts.cap}%</div>` : ""}</div>`;
  };

  // 回测徽章：backtest_badges.json（{cn|us: {指标: [结论, cls, 20日超额, 课程id, 组]}}，约 2KB）
  const BT_ALIAS = { 贪恐指数自建: "贪恐指数", 中证500情绪指标: "中证500情绪", 中证1000情绪指标: "中证1000情绪", "300波指QVIX": "QVIX", "300ETF期权PCR": "期权PCR",
    大阴线计数中证1000: "大阴线", 两市量能: "量能", "300ETF份额国家队": "300ETF份额", 期指机构持仓: "期指机构", IM贴水: "IM基差", 股债性价比ERP: "股债性价比", 科创50点位: "科创50位置" };
  const btName = (n) => BT_ALIAS[String(n || "").replace(/[()（）]/g, "")] || n;
  const sg = (v, d = 1) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d));
  const btBadge = (mk, name, b, tag) => `<span class="btb ${b[1]}" data-bt="#/backtest/${mk}/i/${encodeURIComponent(name)}">${tag ? esc(tag) + " " : ""}回测：${esc(b[0])} ${sg(b[2])}</span>`;
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-bt]"); if (b) { e.preventDefault(); e.stopPropagation(); location.hash = b.dataset.bt; } }, true);
  let lastEmit = null;
  const emit = (page, id) => { lastEmit = [page, id]; if (window.Cloud) window.Cloud.decorate({ page, id }); };

  // =====================================================================
  // 今日驾驶舱（首页）
  // =====================================================================
  const vcls = (v) => (/不推荐/.test(v) ? "no" : /可以考虑/.test(v) ? "yes" : "wait");
  function conclCard(mkt, R) {
    const T = D.today[mkt] || {}, j = T.joint, ts = T.twoside;
    const flag = mkt === "cn" ? "🇨🇳 A股" : "🇺🇸 美股";
    const head = `<div class="ch"><b>${flag}</b>${R ? `<a class="muted" href="#/report/${R.id}">${esc(R.date.slice(5))} ${esc(R.time)} ${esc(R.task)} 原文 ›</a>` : '<span class="muted">指标结论</span>'}</div>`;
    if (R === null) return `<div class="card concl">${head}<div class="skel"></div><div class="skel s2"></div><div class="muted small">正在读取最新报告结论…</div></div>`;
    const F = R && R.fmt;
    if (F && F.goals && F.goals.length) { // 新硬格式：🎯 / 📏 / 💡 / 👜 / ⏱ 原样逐行显示
      const goals = F.goals.map(([lab, v, segs]) => `<div class="vrow"><span class="vlab">${esc(lab)}</span><div><span class="vbig ${vcls(v)}">${esc(v)}</span>${(segs || []).length ? `<div class="vsegs">${segs.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}</div></div>`).join("");
      return `<div class="card concl">${head}${goals}
        ${(F.ruler || []).length ? `<div class="ruler">📏 ${F.ruler.map((x, i) => i === 0 ? `<b>${esc(x)}</b>` : `<span>${esc(x)}</span>`).join("")}</div>` : ""}
        ${R.reason ? `<div class="why">💡 ${esc(R.reason)}</div>` : ""}
        ${F.hold ? `<div class="hold">👜 <b>已持有：</b>${esc(F.hold)}</div>` : ""}
        <div class="meta small">⏱ 数据：${esc(R.dtime || `${R.date} ${R.time}`)}${j ? `；指标截至 ${esc(j.data_date)}` : ""}</div></div>`;
    }
    const vs = R && R.v && R.v.length ? R.v : j ? [["指标", j.verdict_short || j.verdict, ""]] : [];
    const cap = R && R.cap != null ? R.cap : ts ? ts.cap : null;
    const tidy = (seg) => String(seg || "").replace(/^(宽基|题材|美股端|美股|综合结论)\s*[：:]?\s*/, "").replace(/^[「“]?(可以考虑(分批)?买入|等待确认|不推荐买入)[」”]?\s*[，,：:—\-]*\s*/, "").trim();
    // 旧格式只有一句「综合」结论时，把第〇章第一行里的宽基 / 题材那几段也带出来
    const extra = vs.length === 1 && !tidy(vs[0][2]) && R && R.concl && R.concl[0] ? R.concl[0].split(/[｜|]/).map((x) => x.trim()).filter((x) => x && !/^(仓位上限|一句原因)/.test(x) && !/^[「“]?(可以考虑(分批)?买入|等待确认|不推荐买入)[」”]?$/.test(x)).join("｜") : "";
    const rows = vs.map(([lab, v, seg], k) => { const t = tidy(seg) || (k === 0 ? extra : ""); return `<div class="vrow"><span class="vlab">${esc(lab)}</span><div><span class="vbig ${vcls(v)}">${esc(v)}</span>${t ? `<div class="vseg">${esc(t)}</div>` : ""}</div></div>`; }).join("");
    return `<div class="card concl">${head}
      ${rows || '<div class="muted">暂无结论</div>'}
      ${cap != null ? `<div class="cap">总仓位上限 <b>${cap}%</b></div>` : ""}
      ${R && R.reason ? `<div class="why">💡 ${esc(R.reason)}</div>` : ""}
      <div class="meta">${j ? `四象限 <b>${esc(j.quadrant)}</b>（抄底分 ${fmt(j.score / 100)}｜趋势分 ${fmt(j.trend / 100)}）` : ""}${ts ? `<br>两面法 基本面<b>${esc(ts.fund)}</b> × ${esc(ts.main)}技术面<b>${esc(ts.tech[ts.main]["总结"])}</b> → ${esc(ts.verdict)}，上限 ${ts.cap}%` : ""}</div>
      <div class="meta small">⏱ 数据：${esc(R ? R.dtime || `${R.date} ${R.time}` : "—")}${j ? `；指标截至 ${esc(j.data_date)}` : ""}</div>
    </div>`;
  }
  const GRID = [["#/account", "💼", "虚拟账户", "100万模拟盘"], ["#/reports", "📰", "报告库", "每期报告"], ["stock/", "🔎", "个股透视", "一键看懂"], ["stock/#/picks/cn", "🎯", "买卖点", "今日扫描"],
    ["#/short", "🔥", "短线", "涨停情绪"], ["#/board", "📊", "指标看板", "全部指标"], ["#/backtest", "🧪", "回测中心", "指标灵不灵"], ["#/academy", "📚", "指标学堂", "从零学起"], ["#/strategies", "📈", "策略库", "网上策略"]];
  function shortMood(t) {
    if (!t) return null;
    const zt = t.zt, dt = t.dt, zr = t.zb_rate ?? 0, pr = t.prem ?? 0;
    if ((dt >= 30 || pr <= -1) && zt <= 50) return { n: "冰点", c: "ice", t: "亏钱效应大，短线少动手；冰点往往也是新周期起点，只用很小仓位试错。" };
    if (zt >= 100 && zr < 25 && pr >= 3) return { n: "高潮", c: "hot", t: "几乎随便买都赚钱，但高潮次日常分歧：不追高，持有的分批卖。" };
    if (zr >= 40 || (pr < 0.5 && zt >= 40)) return { n: "分歧", c: "mix", t: "封板不稳、接力赚钱效应弱，只做最强的前排，不做后排跟风。" };
    if (pr >= 2 && zt >= 60) return { n: "发酵", c: "warm", t: "接力有赚钱效应，可以关注主线前排；控制单只仓位，设好止损。" };
    return { n: "修复", c: "mix", t: "情绪在恢复中，等主线和空间板更清楚再加大参与。" };
  }
  const STAGE_C = { 冰点: "ice", 退潮: "cool", 分歧: "mix", 修复: "mix", 发酵: "warm", 高潮: "hot", 冰点期: "ice", 退潮期: "cool", 启动期: "mix", 主升期: "warm", 高潮期: "hot" };
  const ymd = (s) => String(s || "").replace(/-/g, "");
  function shortMini(S, H) {
    // S = latest.json 里的 short（shortterm.py 全市场口径）；H = short_hist.json（build.py，盘中也会更新）；谁新用谁
    const i = H && H.d ? H.d.length - 1 : -1, hd = i >= 0 ? ymd(H.d[i]) : "";
    if (S && S.stage && ymd(S.date) >= hd) {
      return `<a href="#/short"><span class="mood ${STAGE_C[S.stage[0]] || "mix"}">${esc(S.stage[0])}</span><span>涨停 <b class="up">${S.zt}</b> · 跌停 <b class="dn">${S.dt}</b> · 炸板率 ${fmt(S.zb_rate, 0)}% · 最高 ${S.top} 板 · 昨涨停今日 <b class="${updn(S.yz_prem)}">${pct(S.yz_prem, 2)}</b></span></a>
        <div class="muted small">${esc(String(S.date).slice(4, 6))}-${esc(String(S.date).slice(6, 8))}${S.intraday ? " 盘中" : " 收盘"}（${esc(String(S.at || "").slice(-5))} 计算）｜${esc(S.stage[1] || "")}</div>`;
    }
    if (i < 0) throw new Error("empty");
    const t = { zt: H.zt[i], dt: H.dt[i], zb_rate: H.zb_rate[i], prem: H.prem[i], max_lb: H.max_lb[i] }, m = shortMood(t);
    return `<a href="#/short"><span class="mood ${m.c}">${m.n}</span><span>涨停 <b class="up">${t.zt}</b> · 跌停 <b class="dn">${t.dt}</b> · 炸板率 ${fmt(t.zb_rate, 0)}% · 最高 ${t.max_lb} 板 · 昨涨停今日 <b class="${updn(t.prem)}">${pct(t.prem, 2)}</b></span></a>
      <div class="muted small">${esc(H.d[i])}${H.time && H.time[H.d[i]] ? " " + esc(H.time[H.d[i]]) + "（盘中）" : ""}｜${m.t}</div>`;
  }
  async function todayPage() {
    document.title = "小七投研 · 今日结论";
    const tok = routeToken;
    app.innerHTML = `
      <div class="grid2" id="concl">${conclCard("cn", null)}${conclCard("us", null)}</div>
      <p class="muted small">结论取自最新一期综合报告第〇章；“仓位上限”指股票类资产占总资金的上限。<a href="#/lesson/report">怎么读结论 ›</a></p>
      <h2>短线情绪 <a class="h2a" href="#/short">详情 ›</a></h2><div id="shortbox" class="card loading">…</div>
      <h2>今日买卖点 <a class="h2a" href="stock/#/picks/cn">全部 ›</a></h2><div id="picksbox" class="card loading">正在读取今日扫描…</div>
      <div class="hsearch sbox"><input id="hq" type="search" enterkeyhint="search" placeholder="🔎 搜个股：600519 / 茅台 / gzmt / NVDA" autocomplete="off"><div id="hsug" class="sug"></div></div>
      <div class="igrid">${GRID.map(([h, i, t, s]) => `<a href="${h}"><span>${i}</span><b>${t}</b><em>${s}</em></a>`).join("")}</div>
      <h2>最新报告 <a class="h2a" href="#/reports">全部 ›</a></h2><div id="recent" class="list">${LOADING()}</div>
      ${DISC}`;
    bindSearch();
    const latestP = getJSON("reports/latest.json", true);
    latestP.then((R) => {
      if (tok !== routeToken) return;
      $("#concl").innerHTML = conclCard("cn", R.cn || undefined) + conclCard("us", R.us || undefined);
      $("#recent").innerHTML = R.recent.map(reportItem).join("") || '<div class="card muted">暂无报告</div>';
    }).catch(() => {
      if (tok !== routeToken) return;
      $("#concl").innerHTML = conclCard("cn", undefined) + conclCard("us", undefined);
      $("#recent").innerHTML = FAIL("报告列表加载失败");
    });
    getJSON("stock/picks_cn.json", true).then((P) => {
      if (tok !== routeToken) return;
      const row = (x, sell) => `<a class="pk" href="stock/#/s/${esc(x.sym)}"><span class="pn">${esc(x.name)}<em>${esc(x.code)}</em></span><span class="pp ${updn(x.pct)}">${pct(x.pct, 2)}</span><span class="ps">${esc((x.signals || []).join("、"))}${sell ? "" : `<em>${esc(x.verdict || "")}</em>`}</span></a>`;
      const b = (P.buys || []).slice(0, 5), s = (P.sells || []).slice(0, 5);
      $("#picksbox").className = "card picks";
      $("#picksbox").innerHTML = `<div class="pcol"><div class="ph up">🟥 买点候选（${(P.buys || []).length}）</div>${b.map((x) => row(x, false)).join("") || '<div class="muted small">今天没有</div>'}</div>
        <div class="pcol"><div class="ph dn">🟩 卖点（${(P.sells || []).length}）</div>${s.map((x) => row(x, true)).join("") || '<div class="muted small">今天没有</div>'}</div>
        <div class="muted small">A股市值前 ${P.universe} 只，扫描于 ${esc(P.computed_at)}${P.intraday ? "（盘中）" : ""}。买点候选≠推荐买入，点进去看完整结论。<a href="stock/#/picks/us">美股 ›</a></div>`;
    }).catch(() => { if (tok === routeToken) { $("#picksbox").className = "card"; $("#picksbox").innerHTML = '今日扫描结果暂未生成。<a href="stock/#/picks/cn">去买卖点页 ›</a>'; } });
    Promise.all([latestP.catch(() => ({})), getJSON("short_hist.json", true).catch(() => null)]).then(([R, H]) => {
      if (tok !== routeToken) return;
      $("#shortbox").className = "card shortmini";
      $("#shortbox").innerHTML = shortMini(R.short, H);
    }).catch(() => { if (tok === routeToken) { $("#shortbox").className = "card"; $("#shortbox").innerHTML = '<a href="#/short">打开短线情绪 ›</a>'; } });
  }
  // 个股搜索：第一次聚焦时才下载 stock/engine.js（腾讯 smartbox 搜索，支持代码 / 名称 / 拼音）
  let engP = null;
  const needEngine = () => window.SSEngine ? Promise.resolve() : (engP = engP || loadScript("stock/engine.js?v=1").catch((e) => { engP = null; throw e; }));
  function bindSearch() {
    const q = $("#hq"), sug = $("#hsug");
    if (!q) return;
    let items = [], timer = null, idx = -1;
    const go = (sym) => { location.href = "stock/#/s/" + encodeURIComponent(sym); };
    q.addEventListener("focus", () => needEngine().catch(() => {}), { once: true });
    q.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const v = q.value.trim();
        if (!v) { sug.style.display = "none"; return; }
        try {
          await needEngine();
          const r = await window.SSEngine.search(v);
          if (v !== q.value.trim()) return;
          items = r || []; idx = -1;
          sug.innerHTML = items.map((it) => `<a href="stock/#/s/${esc(it.sym)}"><span>${esc(it.name)} <span class="m">${esc(it.code)}</span></span><span class="m">${esc(it.market)}·${esc(it.kind)}</span></a>`).join("") || '<div class="muted" style="padding:10px 14px">没找到，换个关键词试试</div>';
          sug.style.display = "block";
        } catch (e) { sug.innerHTML = '<div class="muted" style="padding:10px 14px">搜索暂时不可用，按回车直接去个股透视查</div>'; sug.style.display = "block"; }
      }, 220);
    });
    q.addEventListener("keydown", (e) => {
      const as = $$("a", sug);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!as.length) return; idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + as.length) % as.length; as.forEach((a, i) => a.classList.toggle("on", i === idx)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const it = items[idx >= 0 ? idx : 0];
        if (it) go(it.sym); else if (q.value.trim()) location.href = "stock/#/q/" + encodeURIComponent(q.value.trim());
      }
    });
  }
  document.addEventListener("click", (e) => { if (!e.target.closest(".hsearch")) $$(".hsearch .sug").forEach((s) => (s.style.display = "none")); });

  // =====================================================================
  // 报告库
  // =====================================================================
  const TASK_ORDER = ["集合竞价", "午间复盘", "尾盘决策", "收盘速览", "盘后综合", "美股盘前", "美股开盘", "美股收盘"];
  const MK = { cn: "🇨🇳", us: "🇺🇸" };
  const vchips = (v) => (v || []).map(([lab, x]) => `<span class="vchip ${vcls(x)}">${esc(lab)}·${esc(x)}</span>`).join("");
  const reportItem = (x) => `<a class="card ritem" href="#/report/${x.id}"><div class="rt1"><span class="rtime">${esc(x.date.slice(5))} ${esc(x.time)}</span><span class="rtask ${x.mkt}">${MK[x.mkt] || ""} ${esc(x.task)}</span>${x.cap != null ? `<span class="rcap">仓位≤${x.cap}%</span>` : ""}</div>
    <div class="rtitle">${esc(x.title)}</div>${x.v && x.v.length ? `<div class="vchips">${vchips(x.v)}</div>` : ""}${x.sum ? `<div class="rsum">${esc(x.sum)}</div>` : ""}</a>`;
  const RF = { m: "", t: "", q: "", d: "", mon: "" };
  async function reportsPage() {
    document.title = "报告库 · 小七投研";
    const tok = routeToken;
    app.innerHTML = `<h1>报告库</h1>${LOADING()}`;
    let idx;
    try { idx = await getJSON("reports/index.json", true); } catch (e) { if (tok === routeToken) app.innerHTML = `<h1>报告库</h1>${FAIL()}`; return; }
    if (tok !== routeToken) return;
    const tasks = TASK_ORDER.filter((t) => idx.some((x) => x.task === t)).concat([...new Set(idx.map((x) => x.task))].filter((t) => !TASK_ORDER.includes(t)));
    const days = new Set(idx.map((x) => x.date));
    const months = [...new Set(idx.map((x) => x.date.slice(0, 7)))].sort();
    if (!RF.mon || !months.includes(RF.mon)) RF.mon = months[months.length - 1];
    app.innerHTML = `<h1>报告库 <span class="muted small">共 ${idx.length} 期</span></h1>
      <input id="rq" class="search" type="search" placeholder="搜标题 / 结论关键词，如 中证1000、CPI、光模块" value="${esc(RF.q)}">
      <div class="chips" id="rm">${[["", "全部"], ["cn", "🇨🇳 A股"], ["us", "🇺🇸 美股"]].map(([k, n]) => `<a class="chip" data-m="${k}">${n}</a>`).join("")}</div>
      <div class="chips scroll" id="rt"><a class="chip" data-t="">全部任务</a>${tasks.map((t) => `<a class="chip" data-t="${esc(t)}">${esc(t)}</a>`).join("")}</div>
      <details class="cal" ${RF.d ? "open" : ""}><summary>📅 按日历看${RF.d ? `：${RF.d}` : ""}</summary><div id="calbox"></div></details>
      <div id="rlist"></div>${DISC}`;
    const cal = () => {
      const [y, m] = RF.mon.split("-").map(Number), first = new Date(Date.UTC(y, m - 1, 1)), nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const pad = (first.getUTCDay() + 6) % 7, mi = months.indexOf(RF.mon);
      let cells = "一二三四五六日".split("").map((w) => `<b>${w}</b>`).join("") + "<i></i>".repeat(pad);
      for (let d = 1; d <= nd; d++) {
        const ds = `${RF.mon}-${String(d).padStart(2, "0")}`, n = idx.filter((x) => x.date === ds).length;
        cells += days.has(ds) ? `<a data-d="${ds}" class="${RF.d === ds ? "on" : ""}">${d}<sup>${n}</sup></a>` : `<span>${d}</span>`;
      }
      $("#calbox").innerHTML = `<div class="calh"><a data-mon="${months[mi - 1] || ""}" class="${mi > 0 ? "" : "off"}">‹</a><b>${y} 年 ${m} 月</b><a data-mon="${months[mi + 1] || ""}" class="${mi < months.length - 1 ? "" : "off"}">›</a></div>
        <div class="calg">${cells}</div>${RF.d ? '<a class="chip" data-d="">看全部日期</a>' : ""}`;
    };
    const render = () => {
      $$("#rm .chip").forEach((a) => a.classList.toggle("on", a.dataset.m === RF.m));
      $$("#rt .chip").forEach((a) => a.classList.toggle("on", a.dataset.t === RF.t));
      $(".cal summary").textContent = `📅 按日历看${RF.d ? `：${RF.d}` : ""}`;
      cal();
      const kw = RF.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const xs = idx.filter((x) => (!RF.m || x.mkt === RF.m) && (!RF.t || x.task === RF.t) && (!RF.d || x.date === RF.d) &&
        kw.every((k) => (x.title + x.sum + x.task + x.date + (x.v || []).flat().join("")).toLowerCase().includes(k)));
      const g = {};
      xs.forEach((x) => (g[x.date] = g[x.date] || []).push(x));
      $("#rlist").innerHTML = Object.keys(g).sort().reverse().map((d) => `<h3 class="dhead">${d.slice(5).replace("-", " 月 ")} 日 · 周${wk(d)}<span class="muted small">${g[d].length} 期</span></h3><div class="list">${g[d].map(reportItem).join("")}</div>`).join("")
        || '<div class="card muted">没有符合条件的报告，换个筛选试试。</div>';
    };
    $("#rq").addEventListener("input", (e) => { RF.q = e.target.value; render(); });
    app.onclick = (e) => {
      const a = e.target.closest("[data-m],[data-t],[data-d],[data-mon]");
      if (!a || !app.contains(a)) return;
      e.preventDefault();
      if (a.dataset.m !== undefined) RF.m = a.dataset.m;
      if (a.dataset.t !== undefined) RF.t = a.dataset.t;
      if (a.dataset.d !== undefined) RF.d = RF.d === a.dataset.d ? "" : a.dataset.d;
      if (a.dataset.mon !== undefined) { if (!a.dataset.mon) return; RF.mon = a.dataset.mon; }
      render();
    };
    render();
  }

  async function reportPage(id) {
    const tok = routeToken;
    app.innerHTML = `<div class="crumb"><a href="#/reports">报告库</a></div>${LOADING("正在加载报告…")}`;
    let idx, R;
    try { [idx, R] = await Promise.all([getJSON("reports/index.json", true), getJSON(`reports/${encodeURIComponent(id)}.json`, true)]); }
    catch (e) { if (tok === routeToken) app.innerHTML = `<div class="crumb"><a href="#/reports">报告库</a></div>${FAIL("报告加载失败（可能已下线或网络不好）")}`; return; }
    if (tok !== routeToken) return;
    document.title = R.title + " · 小七投研";
    const i = idx.findIndex((x) => x.id === id), older = idx[i + 1], newer = idx[i - 1];
    const same = idx.filter((x) => x.task === R.task), si = same.findIndex((x) => x.id === id), sOlder = same[si + 1];
    const toc = (R.toc || []).filter((t, k) => t[1] <= 3 && !(k === 0 && t[1] === 1)).map(([hid, lv, t]) => `<a data-h="${hid}" class="l${lv}">${esc(t)}</a>`).join("");
    const pg = (x, dir) => (x ? `<a href="#/report/${x.id}" class="${dir}">${dir === "prev" ? "‹ 上一期" : "下一期 ›"}<em>${esc(x.date.slice(5))} ${esc(x.time)} ${esc(x.task)}</em></a>` : "<span></span>");
    app.innerHTML = `<div class="crumb"><a href="#/reports">报告库</a> / <a href="#/reports" data-task="${esc(R.task)}">${esc(R.task)}</a></div>
      <h1 class="rh">${esc(R.title)}</h1>
      <div class="rmeta"><span class="rtask ${R.mkt}">${MK[R.mkt] || ""} ${esc(R.task)}</span> ${esc(R.date)} ${esc(R.time)}${R.cap != null ? ` · <b>仓位上限 ${R.cap}%</b>` : ""}</div>
      ${R.v && R.v.length ? `<div class="vchips">${vchips(R.v)}</div>` : ""}
      <div class="pager top">${pg(older, "prev")}${pg(newer, "next")}</div>
      ${toc ? `<details class="toc"><summary>📑 目录（点开跳到章节；右下角按钮随时可开）</summary><div class="tocl">${toc}</div></details>` : ""}
      <article class="report">${R.html}</article>
      <div class="pager">${pg(older, "prev")}${pg(newer, "next")}</div>
      ${sOlder ? `<p class="muted small">同类上一期：<a href="#/report/${sOlder.id}">${esc(sOlder.date)} ${esc(sOlder.time)} ${esc(sOlder.title)}</a></p>` : ""}
      ${DISC}
      ${toc ? `<button class="fab" id="fab" aria-label="目录">☰</button><div id="tocpop" class="tocpop"><div class="tocl">${toc}</div></div>` : ""}`;
    const crumbTask = app.querySelector("[data-task]");
    if (crumbTask) crumbTask.addEventListener("click", () => { RF.t = R.task; RF.d = ""; });
    const jump = (e) => {
      const a = e.target.closest("[data-h]");
      if (!a) return;
      e.preventDefault();
      const el = document.getElementById(a.dataset.h);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
      const pop = $("#tocpop"); if (pop) pop.classList.remove("show");
    };
    $$(".tocl").forEach((t) => t.addEventListener("click", jump));
    const fab = $("#fab");
    if (fab) fab.onclick = () => $("#tocpop").classList.toggle("show");
    $$(".report img").forEach((im) => im.addEventListener("click", () => lightbox(im.src, im.alt)));
    $$(".report table").forEach((t) => { if (!t.parentElement.classList.contains("tablewrap")) { const w = document.createElement("div"); w.className = "tablewrap"; t.before(w); w.appendChild(t); } });
  }
  function lightbox(src, alt) {
    let lb = $("#lb");
    if (!lb) {
      lb = document.createElement("div"); lb.id = "lb";
      lb.innerHTML = '<div class="lbbar"><span></span><button>✕ 关闭</button></div><div class="lbimg"><img alt=""></div><div class="lbtip">双指缩放 / 点图片放大，点空白处关闭</div>';
      document.body.appendChild(lb);
      lb.addEventListener("click", (e) => {
        if (e.target.tagName === "IMG") { e.target.classList.toggle("big"); return; }
        lb.classList.remove("show"); document.body.style.overflow = "";
      });
    }
    lb.querySelector("img").src = src; lb.querySelector("img").classList.remove("big"); lb.querySelector(".lbbar span").textContent = alt || "";
    lb.classList.add("show"); document.body.style.overflow = "hidden";
  }

  // 短线页（short.js）、回测中心（bt.js）按需加载，见文件末尾 needMod

  // =====================================================================
  // 指标看板
  // =====================================================================
  const CAT_ORDER = ["基本面·估值", "基本面·资金", "基本面·信用", "基本面·股债", "基本面·广度", "情绪", "技术面", "其他"];
  const normCat = (c) => (/^情绪/.test(c) ? "情绪" : /^技术面/.test(c) ? "技术面" : CAT_ORDER.includes(c) ? c : "其他");
  const zcls = (z) => (/买|偏多|趋势强|多头/.test(z || "") ? "zb" : /卖|偏空|趋势弱|过热|空头/.test(z || "") ? "zs" : "zm");
  function spark(v, cls) {
    const xs = (v || []).filter((x) => x !== null);
    if (xs.length < 3) return '<svg class="spk"></svg>';
    const lo = Math.min(...xs), hi = Math.max(...xs), W = 120, Hh = 34, r = hi - lo || 1;
    const pts = v.map((x, i) => (x === null ? null : [(i / (v.length - 1)) * W, Hh - 3 - ((x - lo) / r) * (Hh - 6)])).filter(Boolean);
    const last = pts[pts.length - 1];
    return `<svg class="spk ${cls}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><polyline points="${pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6"/></svg>`;
  }
  async function boardPage(mkt) {
    mkt = mkt === "us" ? "us" : "cn";
    document.title = "指标看板 · 小七投研";
    const tok = routeToken;
    app.innerHTML = `<h1>指标看板</h1>${LOADING()}`;
    let B, BB;
    try { [B, BB] = await Promise.all([getJSON("board.json"), getJSON("backtest_badges.json", true).catch(() => null), needContent().catch(() => {})]); } catch (e) { if (tok === routeToken) app.innerHTML = `<h1>指标看板</h1>${FAIL()}`; return; }
    if (tok !== routeToken) return;
    const T = D.today[mkt] || {}, j = T.joint, ts = T.twoside;
    const items = B.items.filter((x) => x.m === mkt);
    const g = {};
    items.forEach((x) => (g[normCat(x.cat)] = g[normCat(x.cat)] || []).push(x));
    const card = (x) => {
      const lid = lessonFor(mkt, x.name), zc = zcls(x.zone), sub = x.cat !== normCat(x.cat) && normCat(x.cat) !== "其他" ? x.cat.replace(/^.*?[（(]/, "").replace(/[)）]$/, "") : "";
      const bn = btName(x.name), bb = BB && BB[mkt] && BB[mkt][bn];
      const inner = `<div class="bh"><b>${esc(x.name)}</b><span class="zt ${zc}">${esc(x.zone && x.zone !== "—" ? x.zone : "参考")}</span></div>
        <div class="bv">${esc(x.val)}</div>${spark(x.spark, zc)}
        ${x.pct != null ? `<div class="pbar"><i style="left:${Math.max(0, Math.min(100, x.pct))}%"></i></div><div class="muted small">历史分位 ${fmt(x.pct, 0)}%　数据 ${esc(x.date)}</div>` : `<div class="muted small">数据 ${esc(x.date)}${sub ? " · " + esc(sub) : ""}</div>`}
        <div class="bread">${esc(x.read || "")}</div>${bb ? btBadge(mkt, bn, bb) : ""}${lid ? '<div class="blink">看大图和讲解 ›</div>' : ""}`;
      return lid ? `<a class="bcard ${zc}" href="#/lesson/${lid}">${inner}</a>` : `<div class="bcard ${zc}">${inner}</div>`;
    };
    const cnt = (k) => items.filter((x) => zcls(x.zone) === k).length;
    const techRows = ts && ts.tech ? Object.entries(ts.tech).map(([idx, t]) => `<tr><td><b>${esc(idx)}</b>${idx === ts.main ? " ★" : ""}</td>${["轨道趋势", "轨道内位置", "KDJ", "MACD", "总结"].map((k) => `<td class="${/多|金叉|中轨上|上轨/.test(t[k] || "") && !/空/.test(t[k] || "") ? "up" : /空|死叉|中轨下|下轨/.test(t[k] || "") ? "dn" : ""}">${esc(t[k] || "—")}</td>`).join("")}</tr>`).join("") : "";
    app.innerHTML = `<h1>指标看板</h1>
      <div class="chips"><a class="chip ${mkt === "cn" ? "on" : ""}" href="#/board/cn">🇨🇳 A股</a><a class="chip ${mkt === "us" ? "on" : ""}" href="#/board/us">🇺🇸 美股</a></div>
      ${j ? `<div class="card bsum"><div><span class="muted small">四象限</span><b>${esc(j.quadrant)}</b><span class="muted small">抄底分 ${fmt(j.score / 100)}｜趋势分 ${fmt(j.trend / 100)}</span></div>
        ${ts ? `<div><span class="muted small">两面法</span><b>${esc(ts.verdict)} · 上限 ${ts.cap}%</b><span class="muted small">基本面 ${esc(ts.fund)} × ${esc(ts.main)} 技术面 ${esc(ts.tech[ts.main]["总结"])}</span></div>` : ""}
        <div><span class="muted small">今日分布</span><b><span class="zt zb">买入/偏多 ${cnt("zb")}</span> <span class="zt zs">卖出/偏空 ${cnt("zs")}</span> <span class="zt zm">中性 ${cnt("zm")}</span></b><span class="muted small">指标截至 ${esc(j.data_date || "")}</span></div></div>` : ""}
      <p class="muted small">卡片上的「回测：…」= 这个指标进买入区后 20 日的历史超额（个点），点它看<a href="#/backtest/${mkt}">回测中心</a>详情。颜色按 A 股习惯：<span class="zt zb">红 = 买入区 / 偏多</span> <span class="zt zs">绿 = 卖出区 / 偏空</span> <span class="zt zm">灰 = 中性</span>。迷你线是近半年走势，点卡片看大图和讲解。</p>
      ${CAT_ORDER.filter((k) => g[k]).map((k) => `<h2>${k}</h2><div class="bgrid">${g[k].map(card).join("")}</div>`).join("")}
      ${techRows ? `<h2>技术面（两面法） <a class="h2a" href="#/lesson/twoside">怎么看 ›</a></h2><div class="tablewrap"><table class="tbl"><tr><th>指数</th><th>一目云</th><th>布林位置</th><th>KDJ</th><th>VWMACD</th><th>总结</th></tr>${techRows}</table></div>
        <p class="muted small">★ = 两面法用来定仓位的主指数。</p>` : ""}
      <p class="muted small">看板数据生成于 ${esc(B.built)}，与当天仪表盘一致；盘中不会自动刷新。</p>${DISC}`;
  }

  // =====================================================================
  // 指标学堂（原首页挪到 #/academy，旧路由不变）
  // =====================================================================
  function subnav(on) {
    const items = [["#/academy", "学堂首页"], ...window.CATS.map((c) => ["#/cat/" + c.id, c.name]), ["#/strategies", "策略库"], ["#/glossary", "术语"], ["#/quiz", "测验"], ["#/me", "我的"]];
    return `<div class="chips scroll subnav">${items.map(([h, n]) => `<a class="chip ${h === on ? "on" : ""}" href="${h}">${n}</a>`).join("")}</div>`;
  }
  const crumbA = '<a href="#/academy">学堂</a>';
  function academyHome() {
    document.title = "小七指标学堂 · 七天看懂市场指标";
    const cats = window.CATS.map((c) => {
      const ls = L.filter((x) => x.cat === c.id);
      return `<a class="card cat" href="#/cat/${c.id}"><div class="ct">${c.name}<span class="badge">${ls.length} 课</span></div><div class="muted">${c.desc}</div></a>`;
    }).join("");
    const path = window.PATH.map((p) => `<div class="pday"><div class="pd">${p.day}</div><div><b>${p.t}</b><div class="plinks">${p.items.filter((id) => byId[id]).map((id) => `<a href="#/lesson/${id}">${byId[id].title.split("：")[0]}</a>`).join("")}</div></div></div>`).join("");
    app.innerHTML = `${subnav("#/academy")}
      <section class="hero"><h1>小七指标学堂</h1><p class="tagline">七天看懂市场指标</p><p>每个指标都配真实走势曲线和买卖区域，用今天的数据边看边学。看懂这里，就能看懂每天的综合报告。</p>
        <div class="muted">数据更新：${esc(D.meta.built)}</div></section>
      <div id="myprogress"></div>
      <h2>今天的结论</h2><div class="grid2">${verdictCard("cn")}${verdictCard("us")}</div>
      <p class="muted">只是指标层面的结论，最终结论以每份综合报告第一章为准（还会结合题材、外围和新消息）。<a href="#/">看今日驾驶舱 →</a>　<a href="#/lesson/report">怎么读报告 →</a></p>
      <h2>学习路线</h2><div class="card">${path}</div>
      <h2>按分类学</h2><div class="grid3">${cats}
        <a class="card cat" href="#/strategies"><div class="ct">策略库<span class="badge">${D.strategies.list.length + 1} 个</span></div><div class="muted">网上流行的均线、轮动、RSRS、股债平衡、定投、网格……统一口径回测，看看哪些近两年还有效</div></a>
        <a class="card cat" href="#/glossary"><div class="ct">术语表<span class="badge">${window.GLOSSARY.length} 条</span></div><div class="muted">遇到看不懂的词先查这里</div></a>
        <a class="card cat" href="#/quiz"><div class="ct">小测验<span class="badge">${window.QUIZ.length} 题</span></div><div class="muted">学完测一测，看看是不是真懂了</div></a></div>
      <p class="disclaimer">仅供学习研究，不构成投资建议。所有回测基于历史数据，不代表未来。</p>`;
    emit("home");
  }

  function catPage(id) {
    const c = window.CATS.find((x) => x.id === id);
    if (!c) return academyHome();
    const ls = L.filter((x) => x.cat === id);
    app.innerHTML = `${subnav("#/cat/" + id)}<div class="crumb">${crumbA} / ${c.name}</div><h1>${c.name}</h1><p class="muted">${c.desc}</p>
      <div class="list">${ls.map((x) => `<a class="card item" href="#/lesson/${x.id}"><div class="it">${x.title}<span class="lv">${"●".repeat(x.level)}${"○".repeat(3 - x.level)}</span></div><div class="muted">${x.one}</div></a>`).join("")}</div>`;
    emit("cat", id);
  }

  async function lessonPage(id) {
    const x = byId[id];
    if (!x) return academyHome();
    const tok = ++routeToken;
    document.title = x.title.split("：")[0] + " · 小七指标学堂";
    app.innerHTML = `<div class="crumb">${crumbA}</div><h1>${x.title}</h1><div class="one">${x.one}</div><div class="card loading">正在加载曲线数据…（第一次打开图表需要下载约 1MB 的画图组件，之后会快很多）</div>`;
    try { await ensure(needsOf(x)); } catch (e) {
      if (tok !== routeToken) return;
      app.querySelector(".loading").innerHTML = `加载失败：网络不太好，<a href="javascript:location.reload()">点这里重试</a>`; return;
    }
    if (tok !== routeToken) return;
    const idx = L.indexOf(x), prev = L[idx - 1], next = L[idx + 1];
    const cat = window.CATS.find((c) => c.id === x.cat);
    const ch = x.chart || {};
    let extra = "";
    const H = STORE.h.two;
    if (ch.type === "twoside" && H) {
      const n = H.d.length, cols = ["资本1", "资本2", "AD", "筹码", "基本面总结", "轨道趋势", "轨道内位置", "KDJ", "MACD", "技术面总结", "结论", "仓位上限"];
      extra = `<div class="tablewrap"><table class="tbl"><tr><th>日期</th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${[...Array(Math.min(12, n)).keys()].map((k) => n - 1 - k).map((i) => `<tr><td>${H.d[i].slice(5)}</td>${cols.map((c) => `<td>${esc(H[c] ? H[c][i] ?? "—" : "—")}</td>`).join("")}</tr>`).join("")}</table></div>`;
    }
    if (ch.type === "today") {
      const T = D.today.cn;
      extra = verdictCard("cn") + verdictCard("us") + (T && T.rows ? `<div class="tablewrap"><table class="tbl"><tr><th>A股指标</th><th>最新值</th><th>区域</th><th>解读</th><th>去学</th></tr>${T.rows.map((r) => {
        const l = lessonFor("cn", r["指标"]);
        return `<tr><td>${esc(r["指标"])}</td><td>${esc(r["最新值"])}</td><td>${esc(r["区域"])}</td><td class="small">${esc(r["解读"])}</td><td>${l ? `<a href="#/lesson/${l}">学</a>` : ""}</td></tr>`;
      }).join("")}</table></div>` : "") + '<p><a href="#/board">打开指标看板（卡片版） →</a>　<a href="#/reports">打开报告库 →</a></p>';
    }
    let qs = "";
    if (x.quadStats && D.today[x.quadStats] && D.today[x.quadStats].joint) {
      const j = D.today[x.quadStats].joint, q = j.quad_stats_20d;
      qs = `<div class="today"><div class="th">今天：${esc(j.quadrant)}（抄底分 ${fmt(j.score / 100)}，趋势分 ${fmt(j.trend / 100)}）</div><div class="tv">${esc(j.verdict)}</div>
        <div class="muted">各象限历史后20日（平均 / 上涨概率 / 天数）：${Object.entries(q).map(([k, v]) => `${k} ${pct(v[0])} / ${fmt(v[1], 0)}% / ${v[2]}`).join("；")}</div>
        ${(j.notes || []).length ? `<div class="muted">矛盾点：${j.notes.map(esc).join("；")}</div>` : ""}</div>`;
    }
    const hasChart = ch.type && ch.type !== "today";
    app.innerHTML = `<div class="crumb">${crumbA} / <a href="#/cat/${x.cat}">${cat.name}</a></div>
      <h1>${x.title}</h1><div class="one">${x.one}</div>
      ${hasChart ? `<div class="card chartcard"><div id="chart" class="chart ${ch.type === "kline" || ch.type === "twoside" ? "tall" : ""}"></div>${ch.note ? `<div class="note">${ch.note}</div>` : ""}<div class="legend-tip"><span class="sw buy"></span>浅红区 = 买入区/偏多区　<span class="sw sell"></span>浅绿区 = 卖出区/过热区　<span class="dot"></span>红点 = 最新值</div></div>` : ""}
      ${x.tech ? techReading(x.tech.kind, x.tech.src) : ""}${todayRow(x.today)}<div id="btbox" class="btbox"></div>${x.sl ? slReading(x) : ""}${qs}${extra}
      ${x.calc ? `<div class="sec"><h3>怎么算</h3><div>${x.calc}</div></div>` : ""}
      <div class="sec"><h3>怎么看</h3><div>${x.read}</div></div>
      <div class="sec warn"><h3>常见误区</h3><div>${x.pitfall}</div></div>
      <div class="sec sys"><h3>在我们的体系里</h3><div>${x.sys}</div></div>
      <div id="learnbox" class="learnbox"></div>
      <div class="pager">${prev ? `<a href="#/lesson/${prev.id}">← ${prev.title.split("：")[0]}</a>` : "<span></span>"}${next ? `<a href="#/lesson/${next.id}">${next.title.split("：")[0]} →</a>` : ""}</div>`;
    emit("lesson", id);
    getJSON("backtest_badges.json", true).then((BB) => {
      if (tok !== routeToken || !$("#btbox")) return;
      const hits = [];
      ["cn", "us"].forEach((mk) => Object.entries(BB[mk] || {}).forEach(([n, b]) => { if (b[3] === id) hits.push(btBadge(mk, n, b, `${mk === "cn" ? "A股" : "美股"}·${n}`)); }));
      if (hits.length) $("#btbox").innerHTML = `<span class="muted small">历史回测（买入区后20日超额）：</span>${hits.join("")}`;
    }).catch(() => {});
    const el = $("#chart");
    if (!el) return;
    if (ch.type === "line") lineChart(el, ch);
    if (ch.type === "multi") multiChart(el, ch);
    if (ch.type === "kline") klineChart(el, ch);
    if (ch.type === "quad") quadChart(el, ch);
    if (ch.type === "strategy") stratChart(el, ch.key);
    if (ch.type === "twoside") klineChart(el, { src: "hs300", ov: ["ichimoku", "boll"], sub: "vwmacd", show: 250 });
  }

  async function strategiesPage() {
    const tok = ++routeToken;
    document.title = "策略库 · 小七指标学堂";
    app.innerHTML = LOADING();
    try { await ensure([["lib"], ["c", "dca"]]); } catch (e) { app.innerHTML = FAIL(); return; }
    if (tok !== routeToken) return;
    const S = D.strategies, list = S.list;
    const row = (r) => `<tr data-k="${r.key}"><td><a href="#/strategy/${r.key}">${esc(r["名称"])}</a></td><td>${esc(r["类别"])}</td><td class="${r["年化"] >= 0 ? "up" : "dn"}">${pct(r["年化"])}</td><td>${fmt(r["最大回撤"], 1)}%</td><td>${fmt(r["夏普"])}</td><td class="${r["近两年收益"] >= 0 ? "up" : "dn"}">${pct(r["近两年收益"])}</td><td class="muted small">${esc(r["基准"])} ${pct(r["基准年化"])} / ${fmt(r["基准回撤"], 1)}%</td></tr>`;
    app.innerHTML = `${subnav("#/strategies")}<div class="crumb">${crumbA} / 策略库</div><h1>策略库：网上流行的策略，统一口径回测</h1>
      <p class="muted">口径：收盘出信号、次日起执行；每次调仓单边成本 0.1%；空仓按年化 1.5% 现金；指数为价格指数（不含分红），结果偏保守。参数全部沿用网上公开版本，没有为了好看去调参。“近两年”= 2024-11-11 至今。</p>
      <div class="tablewrap"><table class="tbl"><tr><th>策略</th><th>类别</th><th>年化</th><th>最大回撤</th><th>夏普</th><th>近两年</th><th>基准 年化/回撤</th></tr>${list.map(row).join("")}</table></div>
      <h2>定投三种方式对比（沪深300ETF，每月一次，2015 年起）</h2>
      <div class="card chartcard"><div id="dca" class="chart"></div><div class="note">实线 = 账户市值，虚线 = 累计投入。估值定投：PE 分位越低投越多（0~2000元）；均线偏离定投：低于年线越多投越多。</div></div>
      <div class="tablewrap"><table class="tbl"><tr><th>方式</th><th>累计投入</th><th>当前市值</th><th>收益率</th></tr>${S.dca.map((d) => `<tr><td>${d["方式"]}</td><td>${Math.round(d["累计投入"]).toLocaleString()}</td><td>${Math.round(d["当前市值"]).toLocaleString()}</td><td class="${d["收益率"] >= 0 ? "up" : "dn"}">${pct(d["收益率"])}</td></tr>`).join("")}</table></div>
      <div class="sec sys"><h3>怎么选（我的看法）</h3><div><ul>
        <li><b>打底仓</b>：股债平衡（60/40 或按股债性价比调比例）+ 定期再平衡。收益不惊艳，但回撤小、能拿得住，适合大部分资金。</li>
        <li><b>主动部分</b>：四资产动量轮动是这里近两年表现最好的，因为几个资产之间相关性低；但网上越来越多人在用，小仓位跟踪、别重仓。</li>
        <li><b>加减仓节奏</b>：用每天报告里的四象限 + 两面法定仓位上限，而不是单靠某一个择时策略。</li>
        <li><b>慎用</b>：20 日均线、二八轮动这类短周期择时，近两年在 A 股震荡市里基本失效；网格只适合震荡市，单边行情会卖飞或被套。</li></ul></div></div>
      <p class="disclaimer">回测不代表未来；网格、定投为简化模型，未考虑整手、溢价等细节。</p>`;
    stratChart($("#dca"), "dca");
  }

  async function strategyPage(key) {
    const r = D.strategies.list.find((x) => x.key === key);
    if (!r) return strategiesPage();
    const tok = ++routeToken;
    app.innerHTML = LOADING();
    try { await ensure([["lib"], ["c", key]]); } catch (e) { app.innerHTML = FAIL(); return; }
    if (tok !== routeToken) return;
    document.title = r["名称"] + " · 策略库";
    app.innerHTML = `<div class="crumb">${crumbA} / <a href="#/strategies">策略库</a></div><h1>${esc(r["名称"])}</h1><div class="one">${esc(r["说明"])}</div>
      <div class="card chartcard"><div id="chart" class="chart"></div><div class="note">红线 = 策略净值，灰线 = ${esc(r["基准"])}（都从 1 开始）。</div></div>
      <div class="kpis"><div><span>年化</span><b class="${r["年化"] >= 0 ? "up" : "dn"}">${pct(r["年化"])}</b><em>基准 ${pct(r["基准年化"])}</em></div>
        <div><span>最大回撤</span><b>${fmt(r["最大回撤"], 1)}%</b><em>基准 ${fmt(r["基准回撤"], 1)}%</em></div>
        <div><span>夏普</span><b>${fmt(r["夏普"])}</b><em>&nbsp;</em></div>
        <div><span>近两年</span><b class="${r["近两年收益"] >= 0 ? "up" : "dn"}">${pct(r["近两年收益"])}</b><em>基准 ${pct(r["基准近两年"])}</em></div>
        <div><span>年均调仓</span><b>${fmt(r["年均调仓"], 1)} 次</b><em>起点 ${esc(r["起点"])}</em></div></div>
      <div class="sec"><h3>出处</h3><div>${esc(r["出处"])}</div></div>
      <div class="sec warn"><h3>结论与风险</h3><div>${esc(r["结论"])}</div></div>`;
    stratChart($("#chart"), key);
  }

  function glossary() {
    document.title = "术语表 · 小七指标学堂";
    app.innerHTML = `${subnav("#/glossary")}<div class="crumb">${crumbA} / 术语表</div><h1>术语表</h1><input id="q" class="search" placeholder="搜一下…">
      <div id="gl" class="gl">${window.GLOSSARY.map(([k, v]) => `<div class="gi"><b>${k}</b><div class="muted">${v}</div></div>`).join("")}</div>`;
    $("#q").addEventListener("input", (e) => {
      const t = e.target.value.trim();
      $$(".gi").forEach((n) => { n.style.display = !t || n.textContent.includes(t) ? "" : "none"; });
    });
  }

  function quiz() {
    document.title = "小测验 · 小七指标学堂";
    app.innerHTML = `${subnav("#/quiz")}<div class="crumb">${crumbA} / 小测验</div><h1>小测验</h1><p class="muted">点选项看解释。</p>
      ${window.QUIZ.map((q, i) => `<div class="card qz" data-i="${i}"><div class="qq">${i + 1}. ${q.q}</div>${q.o.map((o, j) => `<button class="opt" data-j="${j}">${o}</button>`).join("")}<div class="qe"></div></div>`).join("")}
      <div id="score" class="card"></div>`;
    let right = 0, done = 0;
    const answers = {};
    $$(".qz").forEach((card) => {
      const q = window.QUIZ[+card.dataset.i];
      $$(".opt", card).forEach((b) => b.addEventListener("click", () => {
        if (card.dataset.done) return;
        card.dataset.done = 1; done++;
        const ok = +b.dataset.j === q.a;
        if (ok) right++;
        b.classList.add(ok ? "ok" : "bad");
        $$(".opt", card)[q.a].classList.add("ok");
        card.querySelector(".qe").innerHTML = (ok ? "✅ 对了。" : "❌ 不对。") + q.e;
        answers[card.dataset.i] = +b.dataset.j;
        $("#score").textContent = `已答 ${done}/${window.QUIZ.length}，答对 ${right} 题`;
        if (done === window.QUIZ.length && window.Cloud && window.Cloud.enabled) window.Cloud.saveQuiz(right, window.QUIZ.length, answers);
      }));
    });
  }

  // =====================================================================
  // 路由 + 统一导航
  // =====================================================================
  const NAV = [["#/", "今日", "today"], ["#/reports", "报告", "reports"], ["stock/", "个股", "stock"], ["stock/#/picks/cn", "买卖点", "picks"],
    ["#/short", "短线", "short"], ["#/board", "看板", "board"], ["#/backtest", "回测", "backtest"], ["#/account", "账户", "account"], ["#/academy", "学堂", "academy"]];
  $("#nav").innerHTML = NAV.map(([h, n, k]) => `<a href="${h}" data-k="${k}">${n}</a>`).join("");
  function setNav(r) {
    const k = !r ? "today" : r === "report" || r === "reports" ? "reports" : ["short", "board", "backtest", "account"].includes(r) ? r : "academy";
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.k === k));
    const on = $("#nav a.on");
    if (on && on.scrollIntoView) { const nav = $("#nav"); nav.scrollLeft = on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2; }
  }
  async function academyRoute(h) {
    const tok = routeToken;
    if (!L) {
      app.innerHTML = LOADING("正在加载课程…");
      try { await needContent(); } catch (e) { if (tok === routeToken) app.innerHTML = FAIL(); return; }
      if (tok !== routeToken) return;
    }
    if (h[0] === "lesson") lessonPage(h[1]);
    else if (h[0] === "cat") catPage(h[1]);
    else if (h[0] === "strategies") strategiesPage();
    else if (h[0] === "strategy") strategyPage(h[1]);
    else if (h[0] === "glossary") glossary();
    else if (h[0] === "quiz") quiz();
    else if (h[0] === "me") {
      app.innerHTML = `${subnav("#/me")}${LOADING()}`;
      await loadCloud();
      if (tok !== routeToken) return;
      if (window.Cloud) emit("me"); else app.innerHTML = `${subnav("#/me")}<h1>我的</h1><div class="card">云同步组件加载失败。</div>`;
    } else academyHome();
  }
  // 按需加载的页面模块（short.js / bt.js）共用这里的工具
  window.__APP = { D, app, $, $$, esc, fmt, pct, sg, updn, LOADING, FAIL, DISC, getJSON, need, mk, C, zoom, axisStyle, expand, wk, bjDate, loadScript,
    tok: () => routeToken, alive: (t) => t === routeToken, shortMood, STAGE_C, lessonFor, needContent, byId: () => byId };
  const MODS = {};
  function modPage(name, title, run) {
    const tok = routeToken;
    if (window["__mod_" + name]) return run(window["__mod_" + name]);
    document.title = title + " · 小七投研";
    app.innerHTML = `<h1>${title}</h1>${LOADING()}`;
    (MODS[name] = MODS[name] || loadScript(`${name}.js?v=${ver}`).catch((e) => { delete MODS[name]; throw e; }))
      .then(() => { if (tok === routeToken) run(window["__mod_" + name]); })
      .catch(() => { if (tok === routeToken) app.innerHTML = `<h1>${title}</h1>${FAIL()}`; });
  }
  function route() {
    disposeCharts();
    routeToken++;
    app.onclick = null;
    const pop = $("#tocpop"); if (pop) pop.remove();
    const lb = $("#lb"); if (lb) { lb.classList.remove("show"); document.body.style.overflow = ""; }
    const h = location.hash.replace(/^#\/?/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    setNav(h[0]);
    if (!h[0]) todayPage();
    else if (h[0] === "reports") reportsPage();
    else if (h[0] === "report") reportPage(h[1]);
    else if (h[0] === "short") modPage("short", "短线情绪", (m) => m.page());
    else if (h[0] === "account") modPage("account", "虚拟账户", (m) => m.page());
    else if (h[0] === "backtest") modPage("bt", "回测中心", (m) => m.page(h[1], h[2], h[3]));
    else if (h[0] === "board") boardPage(h[1]);
    else academyRoute(h);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
