/* 小七个股透视 · 前端 */
(function () {
  const $ = (s) => document.querySelector(s);
  const app = $("#app"), q = $("#q"), sug = $("#sug");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const f = (v, d = 2) => (v === null || v === undefined || Number.isNaN(+v) ? "—" : (+v).toFixed(d));
  const pct = (v, d = 2) => (v === null || v === undefined ? "—" : (v >= 0 ? "+" : "") + (+v).toFixed(d) + "%");
  const cls = (v) => (v > 0 ? "up" : v < 0 ? "dn" : "");
  const yi = (v) => (v === null || v === undefined ? "—" : Math.abs(v) >= 1e8 ? (v / 1e8).toFixed(2) + "亿" : (v / 1e4).toFixed(0) + "万");
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const charts = [];
  let A = null, routeTok = 0;

  // ---------- 数据接口：有 Python 后台就走 /api，否则（GitHub Pages 等纯静态托管）用浏览器里的 engine.js ----------
  const H0 = location.hostname;
  const BACKEND_HOST = H0 === "localhost" || H0 === "127.0.0.1" || /\.workbuddy\.host$/.test(H0);
  let backendP = null;
  const useBackend = () => backendP || (backendP = !BACKEND_HOST ? Promise.resolve(false)
    : fetch("/api/health", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => !!(j && j.ok)).catch(() => false));
  async function api(path, params = {}) {
    if (await useBackend()) {
      const qs = new URLSearchParams(params).toString();
      return fetch("/api/" + path + (qs ? "?" + qs : "")).then((x) => x.json());
    }
    const E = window.SSEngine;
    try {
      if (path === "search") return { items: await E.search(params.q || "") };
      if (path === "resolve") return { sym: await E.resolve(params.q || "") };
      if (path === "analyze") {
        const sym = params.sym || (await E.resolve(params.q || ""));
        if (!sym) return { error: "没找到这只股票，换个代码或名称试试" };
        return await E.analyze(sym);
      }
      if (path === "ticks") return (await E.ticks(params.sym || "")) || { error: "逐笔数据只支持 A 股，或今天还没开盘" };
      if (path === "screen") { // 静态版：读每天定时导出的扫描结果
        const mk = params.market === "us" ? "us" : "cn";
        const r = await fetch(`picks_${mk}.json?t=${Math.floor(Date.now() / 60000)}`);
        if (!r.ok) return { status: "error", error: "还没有生成今日扫描结果" };
        return { status: "done", result: await r.json(), static: true };
      }
    } catch (e) {
      if (e instanceof E.ValueError) return { error: e.message };
      console.error(e);
      return { error: `数据源暂时连不上（${e.name || "Error"}），稍后再试` };
    }
    return { error: "未知接口" };
  }

  // ---------- ECharts 按需加载 ----------
  let libP = null;
  const lib = () => window.echarts ? Promise.resolve() : (libP = libP || new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = "echarts.min.js?v=5.5.1"; s.onload = res; s.onerror = () => { libP = null; rej(new Error("图表组件加载失败")); }; document.head.appendChild(s);
  }));
  setTimeout(() => lib().catch(() => {}), 1200);
  const mk = (el) => { const c = echarts.init(el); charts.push(c); return c; };
  window.addEventListener("resize", () => charts.forEach((c) => c.resize()));
  const ax = () => ({ axisLine: { lineStyle: { color: css("--line") } }, axisLabel: { color: css("--sub"), fontSize: 11 }, splitLine: { lineStyle: { color: css("--line"), opacity: 0.6 } } });

  // ---------- 搜索 ----------
  const RECENT_KEY = "ss_recent";
  const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { return []; } };
  const addRecent = (it) => { const r = recent().filter((x) => x.sym !== it.sym); r.unshift(it); localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 12))); };
  let sugItems = [], sugIdx = -1, timer = null;
  async function doSuggest() {
    const v = q.value.trim();
    if (!v) { sug.style.display = "none"; return; }
    try {
      const r = await api("search", { q: v });
      if (v !== q.value.trim()) return; // 输入已经变了，丢弃过期结果
      sugItems = r.items || []; sugIdx = -1;
      sug.innerHTML = sugItems.map((it, i) => `<a href="#/s/${it.sym}" data-i="${i}"><span>${esc(it.name)} <span class="m">${esc(it.code)}</span></span><span class="m">${it.market}·${it.kind}</span></a>`).join("") || '<div class="muted" style="padding:10px 14px">没找到，换个关键词试试</div>';
      sug.style.display = "block";
    } catch (e) { sug.innerHTML = '<div class="err" style="padding:10px 14px">搜索失败，网络不太好</div>'; sug.style.display = "block"; }
  }
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(doSuggest, 220); });
  q.addEventListener("keydown", (e) => {
    const as = sug.querySelectorAll("a");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sugIdx = (sugIdx + (e.key === "ArrowDown" ? 1 : -1) + as.length) % as.length; as.forEach((a, i) => a.classList.toggle("on", i === sugIdx)); }
    if (e.key === "Enter") {
      e.preventDefault();
      const it = sugItems[sugIdx >= 0 ? sugIdx : 0];
      if (it) go(it.sym); else api("resolve", { q: q.value }).then((r) => r.sym && go(r.sym));
    }
  });
  sug.addEventListener("click", () => setTimeout(() => (sug.style.display = "none"), 50));
  document.addEventListener("click", (e) => { if (!e.target.closest(".sbox")) sug.style.display = "none"; });
  const go = (sym) => { sug.style.display = "none"; q.blur(); location.hash = "#/s/" + sym; };

  // ---------- 首页 ----------
  const HOT = [["sh600519", "贵州茅台"], ["sz300750", "宁德时代"], ["sh600715", "文投控股"], ["sh601318", "中国平安"], ["sz002594", "比亚迪"], ["sh688981", "中芯国际"],
    ["usNVDA.OQ", "英伟达"], ["usAAPL.OQ", "苹果"], ["usTSLA.OQ", "特斯拉"], ["usQCOM.OQ", "高通"], ["usINTC.OQ", "英特尔"], ["usMRVL.OQ", "迈威尔"], ["usTQQQ.OQ", "TQQQ"], ["hk00700", "腾讯控股"]];
  function home() {
    const r = recent();
    app.innerHTML = `<section class="hero"><h1>输入一只股票，一键看懂它</h1>
      <p class="muted">A股、美股、港股都能查。自动算趋势、动能、成交量、主力资金（大单/小单）、筹码、相对大盘强弱，给出「可以考虑买入 / 等待确认 / 不推荐买入」的结论，并用这只股票自己的历史检验信号靠不靠谱。</p></section>
      ${r.length ? `<h2>最近看过</h2><div class="chips">${r.map((x) => `<a class="chip" href="#/s/${x.sym}">${esc(x.name)}</a>`).join("")}</div>` : ""}
      <div class="card" style="border-left:6px solid var(--up)"><b>🎯 今日买卖点</b>　<a href="#/picks/cn">A股 →</a>　<a href="#/picks/us">美股 →</a><div class="muted">每天扫描 A股市值前 1000 只和 146 只常用美股，找出刚触发买点/卖点的股票，并用历史数据检验每条规则最近还灵不灵。</div></div>
      <h2>常看的</h2><div class="chips">${HOT.map(([s, n]) => `<a class="chip" href="#/s/${s}">${n}</a>`).join("")}</div>
      <div class="grid3" style="margin-top:18px">
        <div class="card"><b>主力资金（A股）</b><div class="muted">东方财富口径的每日超大单/大单/中单/小单净流入，以及今天每一笔成交按金额分档统计，判断主力在吸筹、拉升、洗盘还是出货。</div></div>
        <div class="card"><b>技术面</b><div class="muted">一目均衡表、均线排列、ADX、MACD、KDJ、RSI、布林带、OBV，都配曲线，可以切换。</div></div>
        <div class="card"><b>美股资金</b><div class="muted">美股没有公开的大单数据，用 CMF、MFI、OBV 和放量日方向推算资金进出。</div></div>
      </div>
      <p class="disclaimer">数据来自腾讯行情、东方财富等公开接口，可能有几秒到几分钟延迟。仅供研究参考，不构成投资建议。</p>`;
  }

  // ---------- 个股页 ----------
  async function stock(sym) {
    const tok = ++routeTok;
    app.innerHTML = `<div class="loadbox">正在分析 ${esc(sym)} …<br><span class="small">第一次大约 2–6 秒</span></div>`;
    let a;
    try {
      a = await api("analyze", { sym });
      if (a.error) throw new Error(a.error);
    } catch (e) {
      if (tok !== routeTok) return;
      app.innerHTML = `<div class="card err">分析失败：${esc(e.message)}　<a href="javascript:location.reload()">重试</a></div>`; return;
    }
    if (tok !== routeTok) return;
    A = a;
    addRecent({ sym: a.sym, name: a.name });
    document.title = `${a.name}(${a.code}) · 小七个股透视`;
    const Q = a.quote || {}, cn = a.market === "A股";
    const gmax = { 趋势: 30, 动能: 15, 资金: 25, 量能: 10, 相对强弱: 10, 位置风险: 10 };
    const gb = Object.keys(gmax).map((g) => {
      const v = a.groups[g] || 0, w = Math.abs(v) / gmax[g] * 50;
      return `<span>${g}</span><div class="gbar"><span class="mid"></span><i style="${v >= 0 ? `left:50%;width:${w}%;background:var(--up)` : `right:50%;width:${w}%;background:var(--dn)`}"></i></div><span class="${cls(v)}">${v > 0 ? "+" : ""}${v}</span>`;
    }).join("");
    const ff = a.fund_flow;
    const facts = [["PE(TTM)", f(Q.pe)], ["PB", f(Q.pb)], ["总市值", Q.total_cap ? f(Q.total_cap, 0) + "亿" : "—"], ["换手", Q.turnover != null ? f(Q.turnover) + "%" : "—"],
      ["量比", f(Q.vol_ratio)], ["振幅", Q.amp != null ? f(Q.amp) + "%" : "—"], ["52周", `${f(a.lo52)}–${f(a.hi52)}`], ["52周位置", f(a.pos52, 0) + "%"]];
    const rets = Object.entries(a.returns).map(([k, v]) => `<span>${k} <b class="${cls(v)}">${pct(v, 1)}</b></span>`).join("");
    const H = a.history;
    app.innerHTML = `
      <div class="head"><h1>${esc(a.name)} <span class="muted">${esc(a.code)}·${a.market}</span></h1>
        <span class="price ${cls(Q.pct)}">${f(Q.price, Q.price > 100 ? 2 : 3)}</span><span class="${cls(Q.pct)}">${pct(Q.pct)}</span>
        ${a.limit_up ? '<span class="tag buy">涨停</span>' : ""}${a.limit_down ? '<span class="tag sell">跌停</span>' : ""}</div>
      <div class="facts">${facts.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join("")}</div>
      <div class="facts">${rets}</div>

      <div class="card verdict ${a.cls}">
        <div class="vt">${esc(a.verdict)}</div>
        <div class="vr">${esc(a.reason)}</div>
        <div class="va">👉 ${esc(a.action)}</div>
        <div class="muted">综合分 <b>${a.score > 0 ? "+" : ""}${a.score}</b>（−100 ~ +100）｜数据时点 ${esc(a.data_time)}｜支撑 ${a.support.map((x) => f(x)).join(" / ") || "—"}｜压力 ${a.resist.map((x) => f(x)).join(" / ") || "—"}｜参考止损 ${f(a.stop)}</div>
        <div class="gbars">${gb}</div>
      </div>

      <div class="card"><b>🕵️ 主力行为：${esc(a.behavior.label)}</b><div class="muted">${esc(a.behavior.desc)}</div>
        ${ff ? `<div class="kv" style="margin-top:8px">
          <div><span>今日主力净流入</span><b class="${cls(ff.last.main)}">${yi(ff.last.main)}</b><span>${pct(ff.last.main_pct, 1)} 成交额</span></div>
          <div><span>5日主力</span><b class="${cls(ff.sum5)}">${yi(ff.sum5)}</b><span>日均 ${pct(ff.pct5, 1)}</span></div>
          <div><span>20日主力</span><b class="${cls(ff.sum20)}">${yi(ff.sum20)}</b><span>日均 ${pct(ff.pct20, 1)}</span></div>
          <div><span>连续</span><b class="${cls(ff.streak)}">${Math.abs(ff.streak)}日${ff.streak > 0 ? "流入" : "流出"}</b><span>&nbsp;</span></div>
          <div><span>5日超大单</span><b class="${cls(ff.huge5)}">${yi(ff.huge5)}</b></div><div><span>5日大单</span><b class="${cls(ff.big5)}">${yi(ff.big5)}</b></div>
          <div><span>5日中单</span><b class="${cls(ff.mid5)}">${yi(ff.mid5)}</b></div><div><span>5日小单</span><b class="${cls(ff.small5)}">${yi(ff.small5)}</b></div></div>
          <div class="muted small">口径：东方财富，按单笔成交额分档——超大单≥100万元、大单20–100万元、中单4–20万元、小单&lt;4万元；主力＝超大单＋大单。“主力”是统计概念，不代表某个具体机构。</div>`
          : `<div class="muted small">${cn ? "资金流数据暂未获取到。" : "美股/港股没有公开的大单小单数据，下面用 CMF、MFI、OBV 和放量日方向推算资金进出。"}</div>`}
      </div>

      <h2>K 线与技术指标</h2>
      <div class="card"><div class="tools" id="ov">${[["ma", "均线"], ["boll", "布林带"], ["ichi", "一目云"]].map(([k, n], i) => `<button data-k="${k}" class="${i === 0 ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="tools" id="subs">${[["vol", "成交量"], ["macd", "MACD"], ["kdj", "KDJ"], ["rsi", "RSI"], ["obv", "OBV"], [cn ? "ff" : "cmf", cn ? "主力资金" : "CMF/MFI"], ["adx", "ADX"]].map(([k, n], i) => `<button data-k="${k}" class="${i === 0 ? "on" : ""}">${n}</button>`).join("")}</div>
        <div id="kc" class="chart tall"></div><div class="muted small">红涨绿跌；可以双指缩放、拖动。下方按钮切换副图。</div></div>

      ${cn ? `<h2>主力资金：每日大单 / 小单净流入</h2><div class="card"><div id="ffc" class="chart mid"></div><div class="muted small">柱子：超大单、大单、中单、小单的每日净流入（万元），叠在一起看；折线：主力（超大＋大单）净流入。主力流入、小单流出，通常说明筹码从散户流向大资金。</div></div>
      <h2>今日逐笔：大单小单是谁在买</h2><div class="card" id="tickbox"><button class="btn" id="tickbtn">统计今天每一笔成交（约 5–10 秒）</button><div class="muted small" style="margin-top:6px">把今天几千笔成交逐笔下载下来，按单笔金额分档，再按「主动买（外盘）/主动卖（内盘）」统计。</div></div>
      ${a.minute && a.minute.rows && a.minute.rows.length ? `<h2>今日分时</h2><div class="card"><div id="mc" class="chart mid"></div></div>` : ""}`
      : `<h2>资金流（量价推算）</h2><div class="card"><div id="cmfc" class="chart mid"></div><div class="muted small">CMF＞0＝收盘偏向当日高点且放量（资金流入）；MFI 是带成交量的 RSI，＞80 过热、＜20 超卖。</div></div>`}

      <h2>筹码分布（估算）</h2><div class="card">${a.chips ? `<div class="kv"><div><span>获利盘</span><b>${f(a.chips.profit_pct, 0)}%</b></div><div><span>平均成本</span><b>${f(a.chips.avg_cost)}</b></div>
        <div><span>90% 筹码区间</span><b>${f(a.chips.band90[0])}–${f(a.chips.band90[1])}</b></div><div><span>筹码最密集</span><b>${f(a.chips.peak)}</b></div></div>
        <div id="chc" class="chart mid"></div><div class="muted small">近 ${a.chips.days} 个交易日的成交量按每日价格区间摊开叠加，没有考虑换手衰减，只能大致看出成本区。获利盘高＝多数人赚钱，上涨时抛压可能变大；套牢盘密集的价位往往是压力。</div>` : "数据不足"}</div>

      <h2>相对强弱：和${esc(a.benchmark)}比</h2><div class="card"><div id="rsc" class="chart mid"></div><div class="muted small">两条线都从图表起点的 100 开始。红线在灰线上方＝跑赢大盘。20日 ${pct(a.rs["20日"], 1)}pct，60日 ${pct(a.rs["60日"], 1)}pct。</div></div>

      <h2>每个指标怎么看</h2><div class="card tablewrap"><table class="tbl"><tr><th>分组</th><th>指标</th><th>数值</th><th>状态</th><th>得分</th><th>说明</th></tr>
        ${a.items.map((it) => `<tr><td>${it.group}</td><td>${it.lesson ? `<a href="${it.lesson}">${esc(it.name)}</a>` : esc(it.name)}</td><td>${esc(it.value)}</td><td>${esc(it.state)}</td><td class="n ${cls(it.pts)}">${it.pts > 0 ? "+" : ""}${it.pts}</td><td class="note">${esc(it.note)}</td></tr>`).join("")}</table>
        <div class="muted small">指标名带链接的，点开可以去「小七指标学堂」看详细讲解和历史曲线。</div></div>

      <h2>这只股票的历史检验</h2><div class="card">${H.strong.n ? `用这只股票过去约 3 年的数据，把每天的技术分（趋势＋动能，不含资金）算出来，看之后 20 个交易日的涨跌：
        <div class="tablewrap"><table class="tbl"><tr><th>情形</th><th>天数</th><th>后20日平均</th><th>上涨概率</th></tr>
        <tr><td>技术分 ≥ 25（强势）</td><td>${H.strong.n}</td><td class="${cls(H.strong.mean)}">${pct(H.strong.mean, 1)}</td><td>${f(H.strong.win, 0)}%</td></tr>
        <tr><td>技术分 ≤ −20（弱势）</td><td>${H.weak.n}</td><td class="${cls(H.weak.mean)}">${pct(H.weak.mean, 1)}</td><td>${H.weak.n ? f(H.weak.win, 0) + "%" : "—"}</td></tr>
        <tr><td>全部交易日（基准）</td><td>${H.all.n}</td><td class="${cls(H.all.mean)}">${pct(H.all.mean, 1)}</td><td>${f(H.all.win, 0)}%</td></tr></table></div>
        <div class="muted small">今天的技术分：${H.now ?? "—"}。如果“强势”那一行还不如“全部交易日”，说明这只股票追涨效果差（常见于题材股、炒作股），结论会自动降为「等待确认」。</div>` : "历史数据不足，无法检验"}</div>

      ${a.errors.length ? `<div class="card muted">⚠️ ${a.errors.map(esc).join("；")}</div>` : ""}
      <p class="disclaimer">结论由公开数据按固定规则自动计算，可能滞后或出错，不考虑公司公告、财报和突发消息。仅供研究参考，不构成投资建议。</p>`;
    $("#ov").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; b.classList.toggle("on"); drawK(); };
    $("#subs").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $("#subs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); drawK(); };
    const tb = $("#tickbtn");
    if (tb) tb.onclick = loadTicks;
    try { await lib(); } catch (e) { app.insertAdjacentHTML("afterbegin", '<div class="card err">图表组件加载失败，文字结论不受影响。</div>'); return; }
    if (tok !== routeTok) return;
    drawK(); drawFF(); drawCMF(); drawMinute(); drawChips(); drawRS();
  }

  // ---------- 图表 ----------
  function drawK() {
    const el = $("#kc"); if (!el || !window.echarts) return;
    const old = echarts.getInstanceByDom(el); if (old) old.dispose();
    const C = A.chart, n = C.d.length, up = css("--up"), dn = css("--dn"), txt = css("--text");
    const on = (k) => $("#ov").querySelector(`[data-k="${k}"]`).classList.contains("on");
    const sub = $("#subs").querySelector("button.on").dataset.k;
    const L = (name, data, color, o = {}) => ({ name, type: "line", data, showSymbol: false, lineStyle: { width: o.w || 1.1, color, type: o.dash ? "dashed" : "solid" }, itemStyle: { color }, xAxisIndex: o.x || 0, yAxisIndex: o.x || 0, z: o.z || 2 });
    const S = [{ name: "K线", type: "candlestick", data: C.d.map((_, i) => [C.o[i], C.c[i], C.l[i], C.h[i]]), itemStyle: { color: up, color0: dn, borderColor: up, borderColor0: dn } }];
    if (on("ma")) [["ma5", "#999"], ["ma20", "#e8a317"], ["ma60", "#8b5cf6"], ["ma250", "#2f7fd8"]].forEach(([k, c]) => S.push(L(k.toUpperCase(), C[k], c)));
    if (on("boll")) { S.push(L("布林上轨", C.bu, "#8b5cf6", { dash: 1 })); S.push(L("布林中轨", C.bm, "#8b5cf6")); S.push(L("布林下轨", C.bl, "#8b5cf6", { dash: 1 })); }
    if (on("ichi")) {
      const lo = C.ia.map((a, i) => (a == null || C.ib[i] == null ? null : Math.min(a, C.ib[i])));
      const th = C.ia.map((a, i) => (a == null || C.ib[i] == null ? null : Math.abs(a - C.ib[i])));
      const bull = C.ia.map((a, i) => a != null && C.ib[i] != null && a >= C.ib[i]);
      S.push({ name: "云底", type: "line", stack: "cloud", data: lo, showSymbol: false, lineStyle: { width: 0 }, tooltip: { show: false } });
      S.push({ name: "一目云", type: "line", stack: "cloud", data: th.map((v, i) => ({ value: v, itemStyle: { color: bull[i] ? "rgba(229,72,77,.25)" : "rgba(26,158,85,.25)" } })), showSymbol: false, lineStyle: { width: 0 }, areaStyle: { color: "rgba(150,150,150,.18)" } });
    }
    const X = { type: "category", data: C.d, axisLine: { lineStyle: { color: css("--line") } }, axisLabel: { color: css("--sub"), fontSize: 10 } };
    const s2 = [], sx = { x: 1 };
    let y2 = { type: "value", scale: true, gridIndex: 1, splitNumber: 2, ...ax() };
    const bar = (name, data, colorFn) => ({ name, type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: data.map((v, i) => (v == null ? null : { value: v, itemStyle: { color: colorFn(v, i) } })) });
    if (sub === "vol") s2.push(bar("成交量", C.v, (v, i) => (C.c[i] >= C.o[i] ? up : dn)), L("5日均量", C.vma5, "#e8a317", sx));
    if (sub === "macd") s2.push(bar("MACD柱", C.macd, (v) => (v >= 0 ? up : dn)), L("DIF", C.dif, txt, sx), L("DEA", C.dea, "#e8833a", sx));
    if (sub === "kdj") { s2.push(L("K", C.k, txt, sx), L("D", C.kd, "#e8833a", sx), L("J", C.j, "#8b5cf6", sx)); y2 = { ...y2, scale: false, min: -20, max: 120 }; }
    if (sub === "rsi") { s2.push({ ...L("RSI14", C.rsi, txt, sx), markLine: { silent: true, symbol: "none", data: [{ yAxis: 30 }, { yAxis: 70 }], lineStyle: { color: "#999", type: "dashed" } } }); y2 = { ...y2, scale: false, min: 0, max: 100 }; }
    if (sub === "obv") s2.push(L("OBV", C.obv, txt, sx), L("OBV 20日均线", C.obv_ma, "#e8833a", sx));
    if (sub === "ff") s2.push(bar("主力净流入(万元)", C.ff_main || [], (v) => (v >= 0 ? up : dn)));
    if (sub === "cmf") { s2.push({ ...L("CMF", C.cmf, txt, sx), markLine: { silent: true, symbol: "none", data: [{ yAxis: 0 }], lineStyle: { color: "#999" } } }); }
    if (sub === "adx") s2.push(L("ADX", C.adx, txt, sx), L("+DI", C.pdi, up, sx), L("−DI", C.ndi, dn, sx));
    mk(el).setOption({
      animation: false, tooltip: { trigger: "axis", axisPointer: { type: "cross" }, confine: true },
      legend: { top: 0, textStyle: { color: css("--sub"), fontSize: 11 }, data: S.concat(s2).map((s) => s.name).filter((x) => x !== "云底") },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [{ left: 50, right: 12, top: 30, height: "56%" }, { left: 50, right: 12, top: "71%", height: "17%" }],
      xAxis: [{ ...X, axisLabel: { show: false } }, { ...X, gridIndex: 1 }], yAxis: [{ type: "value", scale: true, ...ax() }, y2],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1], startValue: Math.max(0, n - 120), endValue: n - 1 }, { type: "slider", xAxisIndex: [0, 1], startValue: Math.max(0, n - 120), endValue: n - 1, height: 16, bottom: 4 }],
      series: S.concat(s2),
    });
  }
  function drawFF() {
    const el = $("#ffc"); if (!el) return;
    if (!A.chart.ff_main) { el.style.height = "auto"; el.innerHTML = '<div class="empty muted small" style="padding:12px 0">资金流数据暂未获取到（东方财富接口偶尔断连），稍后刷新再看。</div>'; return; }
    const C = A.chart, idx = C.d.map((d, i) => i).filter((i) => C.ff_main[i] != null), d = idx.map((i) => C.d[i]);
    const ser = (name, k, color) => ({ name, type: "bar", stack: "ff", data: idx.map((i) => C[k][i]), itemStyle: { color } });
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", confine: true }, legend: { top: 0, textStyle: { color: css("--sub"), fontSize: 11 } }, grid: { left: 56, right: 50, top: 30, bottom: 40 },
      xAxis: { type: "category", data: d, ...ax(), splitLine: { show: false } }, yAxis: [{ type: "value", ...ax(), name: "万元", nameTextStyle: { color: css("--sub") } }, { type: "value", scale: true, splitLine: { show: false }, axisLabel: { color: css("--sub"), fontSize: 10 } }],
      dataZoom: [{ type: "inside", startValue: Math.max(0, d.length - 60) }],
      series: [ser("超大单", "ff_huge", "#c0262d"), ser("大单", "ff_big", "#f08c8f"), ser("中单", "ff_mid", "#9ccfb3"), ser("小单", "ff_small", "#1a9e55"),
        { name: "主力净流入", type: "line", data: idx.map((i) => C.ff_main[i]), showSymbol: false, lineStyle: { color: css("--text"), width: 1.4 }, itemStyle: { color: css("--text") } },
        { name: "收盘价", type: "line", yAxisIndex: 1, data: idx.map((i) => C.c[i]), showSymbol: false, lineStyle: { color: "#aaa", width: 1, type: "dashed" }, itemStyle: { color: "#aaa" } }] });
  }
  function drawCMF() {
    const el = $("#cmfc"); if (!el) return;
    const C = A.chart, n = C.d.length;
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", confine: true }, legend: { top: 0, textStyle: { color: css("--sub") } }, grid: { left: 50, right: 46, top: 30, bottom: 40 },
      xAxis: { type: "category", data: C.d, ...ax(), splitLine: { show: false } }, yAxis: [{ type: "value", ...ax() }, { type: "value", min: 0, max: 100, splitLine: { show: false }, axisLabel: { color: css("--sub") } }],
      dataZoom: [{ type: "inside", startValue: Math.max(0, n - 180) }],
      series: [{ name: "CMF(20)", type: "bar", data: C.cmf.map((v) => (v == null ? null : { value: v, itemStyle: { color: v >= 0 ? css("--up") : css("--dn") } })) },
        { name: "MFI(14)", type: "line", yAxisIndex: 1, data: C.mfi, showSymbol: false, lineStyle: { color: "#8b5cf6" }, itemStyle: { color: "#8b5cf6" }, markLine: { silent: true, symbol: "none", data: [{ yAxis: 20 }, { yAxis: 80 }], lineStyle: { color: "#aaa", type: "dashed" } } }] });
  }
  function drawMinute() {
    const el = $("#mc"); if (!el) return;
    const R = A.minute.rows, up = css("--up"), dn = css("--dn"), prev = A.quote && A.quote.prev;
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", confine: true }, grid: [{ left: 50, right: 12, top: 16, height: "58%" }, { left: 50, right: 12, top: "78%", height: "15%" }],
      xAxis: [{ type: "category", data: R.map((r) => r.t), axisLabel: { show: false }, ...ax() }, { type: "category", gridIndex: 1, data: R.map((r) => r.t), ...ax() }],
      yAxis: [{ type: "value", scale: true, ...ax() }, { type: "value", gridIndex: 1, splitNumber: 2, ...ax() }], axisPointer: { link: [{ xAxisIndex: "all" }] },
      series: [{ name: "价格", type: "line", data: R.map((r) => r.p), showSymbol: false, lineStyle: { color: css("--brand"), width: 1.3 }, markLine: prev ? { silent: true, symbol: "none", data: [{ yAxis: prev }], lineStyle: { color: "#999", type: "dashed" }, label: { formatter: "昨收" } } : undefined },
        { name: "均价", type: "line", data: R.map((r) => r.avg), showSymbol: false, lineStyle: { color: "#e8a317", width: 1 } },
        { name: "成交量(手)", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: R.map((r, i) => ({ value: r.v, itemStyle: { color: i && r.p < R[i - 1].p ? dn : up } })) }] });
  }
  function drawChips() {
    const el = $("#chc"); if (!el || !A.chips) return;
    const B = A.chips.bins, price = A.chart.c[A.chart.c.length - 1];
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true, formatter: (p) => `价位 ${p[0].name}<br>占比 ${p[0].value}%` }, grid: { left: 60, right: 16, top: 10, bottom: 30 },
      yAxis: { type: "category", data: B.map((b) => b.p), ...ax(), splitLine: { show: false } }, xAxis: { type: "value", ...ax(), name: "%" },
      series: [{ type: "bar", data: B.map((b) => ({ value: b.v, itemStyle: { color: b.p <= price ? "rgba(229,72,77,.65)" : "rgba(26,158,85,.6)" } })),
        markLine: { silent: true, symbol: "none", data: [{ yAxis: B.reduce((best, b) => (Math.abs(b.p - price) < Math.abs(best.p - price) ? b : best), B[0]).p + "" }], lineStyle: { color: css("--text") }, label: { formatter: "现价" } } }] });
  }
  function drawRS() {
    const el = $("#rsc"); if (!el || !A.chart.bench) return;
    const C = A.chart, i0 = C.bench.findIndex((x) => x != null); if (i0 < 0) return;
    const n0 = C.c[i0], b0 = C.bench[i0];
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", confine: true }, legend: { top: 0, textStyle: { color: css("--sub") } }, grid: { left: 46, right: 12, top: 30, bottom: 40 },
      xAxis: { type: "category", data: C.d.slice(i0), ...ax(), splitLine: { show: false } }, yAxis: { type: "value", scale: true, ...ax() },
      dataZoom: [{ type: "inside" }],
      series: [{ name: A.name, type: "line", data: C.c.slice(i0).map((v) => +(v / n0 * 100).toFixed(2)), showSymbol: false, lineStyle: { color: css("--up"), width: 1.5 }, itemStyle: { color: css("--up") } },
        { name: A.benchmark, type: "line", data: C.bench.slice(i0).map((v) => (v == null ? null : +(v / b0 * 100).toFixed(2))), showSymbol: false, connectNulls: true, lineStyle: { color: "#999" }, itemStyle: { color: "#999" } }] });
  }
  async function loadTicks() {
    const box = $("#tickbox"), b = $("#tickbtn");
    b.disabled = true; b.textContent = "正在下载今天的每一笔成交…";
    try {
      const t = await api("ticks", { sym: A.sym });
      if (t.error) throw new Error(t.error);
      box.innerHTML = `<div class="muted">今天共 <b>${t.n}</b> 笔成交，成交额 ${yi(t.total)}。主力（超大＋大单）主动买入减主动卖出：<b class="${cls(t.main_net)}">${yi(t.main_net)}</b>，占成交额 ${f(t.main_share, 0)}%。</div>
        <div class="tablewrap"><table class="tbl"><tr><th>档位</th><th>主动买入</th><th>主动卖出</th><th>净额</th><th>买/卖笔数</th><th>成交占比</th></tr>
        ${t.table.map((r) => `<tr><td>${r.tier}</td><td class="n">${yi(r.buy)}</td><td class="n">${yi(r.sell)}</td><td class="n ${cls(r.net)}">${yi(r.net)}</td><td class="n">${r.n_buy}/${r.n_sell}</td><td class="n">${f(r.share, 1)}%</td></tr>`).join("")}</table></div>
        <div id="tkc" class="chart mid"></div><div class="muted small">折线：从开盘起累计的“大单＋超大单 主动买入 − 主动卖出”。一路向上＝大资金持续主动买；价格涨但这条线往下走＝拉高出货的迹象。档位按单笔金额：超大单≥100万、大单20–100万、中单4–20万、小单&lt;4万元。涨停封板时买单排队成交不到，主动卖出会偏多，属正常现象。</div>`;
      await lib();
      const TL = t.timeline, M = (A.minute && A.minute.rows) || [], pm = new Map(M.map((r) => [r.t, r.p]));
      mk($("#tkc")).setOption({ animation: false, tooltip: { trigger: "axis", confine: true }, legend: { top: 0, textStyle: { color: css("--sub") } }, grid: { left: 60, right: 50, top: 30, bottom: 30 },
        xAxis: { type: "category", data: TL.map((r) => r.t), ...ax(), splitLine: { show: false } }, yAxis: [{ type: "value", ...ax(), name: "万元" }, { type: "value", scale: true, splitLine: { show: false }, axisLabel: { color: css("--sub") } }],
        series: [{ name: "大单累计净买入(万元)", type: "line", data: TL.map((r) => +(r.cum / 1e4).toFixed(1)), showSymbol: false, areaStyle: { opacity: 0.15 }, lineStyle: { color: css("--up") }, itemStyle: { color: css("--up") } },
          { name: "价格", type: "line", yAxisIndex: 1, data: TL.map((r) => pm.get(r.t) ?? null), connectNulls: true, showSymbol: false, lineStyle: { color: "#999" }, itemStyle: { color: "#999" } }] });
    } catch (e) { b.disabled = false; b.textContent = "重试"; box.insertAdjacentHTML("beforeend", `<div class="err small">${esc(e.message)}</div>`); }
  }

  // ---------- 今日买卖点 ----------
  async function picks(market) {
    const tok = ++routeTok;
    document.title = "今日买卖点 · 小七个股透视";
    const tabs = `<div class="tools" style="margin:6px 0 10px"><a class="chip ${market === "cn" ? "on" : ""}" href="#/picks/cn">A股（市值前1000）</a><a class="chip ${market === "us" ? "on" : ""}" href="#/picks/us">美股（常用146只）</a></div>`;
    app.innerHTML = `<h1>🎯 今日买卖点</h1>${tabs}<div class="loadbox" id="pl">正在扫描…</div>`;
    let r;
    for (let i = 0; i < 120; i++) {
      try { r = await api("screen", { market }); } catch (e) { r = { status: "error", error: "网络问题" }; }
      if (tok !== routeTok) return;
      if (r.result && r.status !== "running") break;
      if (r.status === "error" && !r.result) { $("#pl").innerHTML = `<span class="err">扫描失败：${esc(r.error)}</span> <a href="javascript:location.reload()">重试</a>`; return; }
      if (r.result && r.status === "running") break;
      $("#pl").innerHTML = `正在扫描整个股票池（A股约 1–3 分钟，美股约 15 秒）…<br><span class="small">${esc(r.progress || "")}</span>`;
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    const R = r.result; if (!R) return;
    const V2 = R.v2 || null;
    const w = (s) => (!s || s.win == null ? "—" : f(s.win, 0) + "%");
    const m = (s) => (!s || s.mean == null ? "—" : pct(s.mean, 1));
    const rules = R.rules.map((x) => x.key === "topflow" ? `<tr><td>${x.name}</td><td>${x.side}</td><td colspan="3" class="note">需要资金数据，没法回测，只作参考</td><td>参考</td></tr>` :
      `<tr><td title="${esc(x.desc)}">${x.name}</td><td>${x.side}</td><td class="n">${m(x.w120)} / ${w(x.w120)}<span class="note">（${(x.w120 || {}).n || 0}次）</span></td><td class="n">${m(x.w250)} / ${w(x.w250)}</td><td class="n">${m(x.all)} / ${w(x.all)}</td><td>${x.valid ? "✅" : x.valid === false ? "❌" : "样本少"}</td></tr>`).join("");
    const B = R.base;
    const row = (x, sell) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a><div class="note">${esc(x.code)}</div></td><td class="n">${f(x.price, x.price > 100 ? 2 : 3)}<div class="note ${cls(x.pct)}">${pct(x.pct)}</div></td>
      <td>${x.signals.map(esc).join("、")}<div class="note">${x.verified ? "✅ 规则当前有效" : sell ? "参考" : "⚠️ 规则近期未验证"}</div></td><td class="n ${cls(x.score)}">${x.score > 0 ? "+" : ""}${x.score}</td><td>${esc(x.behavior)}</td>
      <td>${sell ? `20日 ${pct(x.r20, 1)}` : `${esc(x.verdict)}<div class="note">止损 ${f(x.stop)}</div>`}</td></tr>`;
    const rescan = r.static ? `<div class="muted small" style="margin-top:4px">📌 这是每天定时扫描的结果（扫描于 ${esc(R.computed_at)}），网页版不能在线重新扫描；点股票名进个股透视看的是实时分析。</div>`
      : `　<a href="javascript:void(0)" id="rescan">重新扫描</a>`;
    const oldHtml = `<h2>🟥 买点候选</h2><div class="card tablewrap">${R.buys.length ? `<table class="tbl"><tr><th>股票</th><th>现价</th><th>触发</th><th>综合分</th><th>主力行为</th><th>个股结论</th></tr>${R.buys.map((x) => row(x, false)).join("")}</table>` : "今天没有触发买点规则、且主力没在出货的股票。"}
        <div class="muted small">已排除主力在出货（高位派发/出逃/资金离场）的股票。点名字看完整个股透视。</div></div>
      <h2>🟩 卖点（持有的考虑减仓/止盈）</h2><div class="card tablewrap">${R.sells.length ? `<table class="tbl"><tr><th>股票</th><th>现价</th><th>触发</th><th>综合分</th><th>主力行为</th><th>涨跌</th></tr>${R.sells.map((x) => row(x, true)).join("")}</table>` : "今天没有触发卖点规则的股票。"}</div>
      <h2>这些规则还灵不灵</h2><div class="card tablewrap"><table class="tbl"><tr><th>规则</th><th>方向</th><th>近120日 平均/胜率</th><th>近250日</th><th>近3年</th><th>当前有效</th></tr>${rules}
        <tr><td>全部股票全部日子（基准）</td><td>—</td><td class="n">${m(B.w120)} / ${w(B.w120)}</td><td class="n">${m(B.w250)} / ${w(B.w250)}</td><td class="n">${m(B.all)} / ${w(B.all)}</td><td>—</td></tr></table>
        <div class="muted small">把每条规则放到整个股票池过去 3 年的每一天去算：信号出现后持有 20 个交易日，平均涨跌和上涨概率是多少。<b>“当前有效”只看最近 120 个交易日是否跑赢同期基准</b>，每天滚动重算——市场风格变了，规则会自动被标成失效。鼠标停在规则名上可以看规则定义。</div></div>`;
    const head = `<h1>🎯 今日买卖点</h1>${tabs}
      <div class="muted">数据日期 ${esc(R.date)}${R.intraday ? "（盘中数据，收盘后结果会变）" : ""}｜扫描于 ${esc(R.computed_at)}${rescan}</div>`;
    app.innerHTML = head + (V2 ? v2Html(V2, market) : `<div class="card muted">v2 选股系统的结果还没生成（需要先跑一次导出）。下面是旧版规则扫描。</div>`) +
      `<details class="card" ${V2 ? "" : "open"}><summary><b>旧版：形态规则扫描（v1，仅作参考）</b>　<span class="muted small">股票池 ${R.universe} 只，流动性达标 ${R.valid} 只，今天触发 ${R.triggered} 只${V2 && V2.lab && V2.lab.old_note ? "｜" + esc(V2.lab.old_note) : ""}</span></summary>${oldHtml}</details>
      <p class="disclaimer">v2 名单是按历史统计规律打分的结果，样本外回测也不保证未来；买之前先点进个股透视看完整结论，总仓位服从每天报告给出的仓位上限。仅供研究参考，不构成投资建议。</p>`;
    if ($("#rescan")) $("#rescan").onclick = async () => { await api("screen", { force: 1, market }); picks(market); };
    if (V2 && V2.lab && V2.lab.curves) {
      try { await lib(); } catch (e) { return; }
      if (tok !== routeTok) return;
      drawV2(V2.lab);
    }
  }

  // ---------- v2：多因子选股 ----------
  const sgn = (v, d = 1) => (v == null ? "—" : (v >= 0 ? "+" : "") + (+v).toFixed(d));
  function v2Html(V, market) {
    const S = V.signals || {}, L = V.lab || null;
    const M = L && L.main ? L.main : null, mr = M ? M.row : null, mt = M ? M.timed : null;
    const capTxt = S.exposure_cap != null ? `${Math.round(S.exposure_cap * 100)}%（${esc(S.quadrant || "")}象限）` : "—";
    let card = "";
    if (L && mr) {
      const kv = (k, v, sub) => `<div><span>${k}</span><b class="${cls(parseFloat(v))}">${v}</b>${sub ? `<span>${sub}</span>` : ""}</div>`;
      card = `<div class="card verdict ${esc(L.verdict_cls || "wait")}"><div class="vt">${esc(L.verdict_title || "")}</div><div class="vr">${esc(L.verdict || "")}</div>
        <div class="kv" style="margin-top:10px">
          ${kv("样本外年化（扣成本）", pct(mr.cagr, 1), `${esc(L.oos[0])} ~ ${esc(L.oos[1])}`)}
          ${kv("最大回撤", pct(mr.mdd, 1), `夏普 ${f(mr.sharpe)}`)}
          ${kv("相对股票池等权", pct(mr.excess, 1) + "/年", `周超额 t=${f(mr.t_week)}`)}
          ${kv(`相对${esc(L.bench_name)}`, pct(mr.excess_idx, 1) + "/年", "")}
          ${kv("后半段(挑完方案后)超额", pct(mr.B.excess, 1) + "/年", `${esc(L.split)} 之后`)}
          ${mt ? kv("+四象限择时 年化/回撤", `${pct(mt.cagr, 1)}`, `回撤 ${pct(mt.mdd, 1)}，平均仓位 ${f(mt.avg_expo, 0)}%`) : ""}
        </div>
        <div class="muted small" style="margin-top:6px">方案：${esc(M.label)}｜成本：佣金万2.5双边＋印花税0.05%＋滑点0.1%｜信号用收盘价，次日开盘成交，涨停开盘买不进、跌停开盘卖不出。</div></div>`;
    }
    const buys = (S.buys || []).map((x) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a> <span class="note" style="display:inline">${esc(x.code)}${x.limit_up ? " · 今日涨停" : ""}</span>
      <div class="note">${esc(x.reason || "—")}</div></td>
      <td class="n">${f(x.price, x.price > 100 ? 2 : 3)}</td><td class="n">${x.rank}<div class="note">${sgn(x.score, 2)}</div></td>
      <td class="n">${f(x.weight * 100, 1)}%<div class="note">止损 ${f(x.stop)}</div></td></tr>`).join("");
    const ps = (S.pool_sells || []).map((x) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a><div class="note">${esc(x.code)}</div></td><td class="n">${f(x.price, x.price > 100 ? 2 : 3)}</td>
      <td class="n">${x.prev_rank} → ${x.rank ?? "停牌/出池"}</td><td class="n ${cls(x.chg)}">${x.chg == null ? "—" : pct(x.chg * 100, 1)}</td></tr>`).join("");
    const wts = Object.entries(S.weights || {}).map(([k, v]) => `<span class="chip">${esc((L && L.fname && L.fname[k]) || k)} <b class="${cls(v)}">${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%</b></span>`).join("");
    const fac = L && L.factors ? L.factors.map((r) => `<tr><td title="${esc(r.desc)}">${esc(r.name)}</td>
      <td class="n ${cls(r.rank5 && r.rank5.ic)}">${r.rank5 ? sgn(r.rank5.ic, 3) : "—"}<span class="note">t ${r.rank5 ? sgn(r.rank5.t, 1) : "—"}</span></td>
      <td class="n ${cls(r.ret5 && r.ret5.ic)}">${r.ret5 ? sgn(r.ret5.ic, 3) : "—"}<span class="note">t ${r.ret5 ? sgn(r.ret5.t, 1) : "—"}</span></td>
      <td class="n ${cls(r.ret20 && r.ret20.ic)}">${r.ret20 ? sgn(r.ret20.ic, 3) : "—"}<span class="note">t ${r.ret20 ? sgn(r.ret20.t, 1) : "—"}</span></td>
      <td class="n ${cls(r.q5)}">${r.q5 == null ? "—" : sgn(r.q5, 2) + "%"}</td><td class="n">${r.stable || "—"}</td><td class="n">${r.sel == null ? "—" : f(r.sel * 100, 0) + "%"}</td></tr>`).join("") : "";
    const cmp = L && L.ports ? L.ports.map((p) => `<tr><td>${esc(p.label)}</td><td class="n ${cls(p.cagr)}">${pct(p.cagr, 1)}</td><td class="n">${pct(p.mdd, 1)}</td>
      <td class="n">${f(p.sharpe)}</td><td class="n ${cls(p.excess)}">${pct(p.excess, 1)}</td><td class="n ${cls(p.B)}">${pct(p.B, 1)}</td><td class="n">${f(p.turnover, 0)}%</td></tr>`).join("") : "";
    const yrs = L && L.years ? L.years.map((y) => `<tr><td>${esc(y.year)}</td><td class="n ${cls(y.port)}">${pct(y.port, 1)}</td><td class="n ${cls(y.timed)}">${pct(y.timed, 1)}</td>
      <td class="n ${cls(y.ew)}">${pct(y.ew, 1)}</td><td class="n ${cls(y.idx)}">${pct(y.idx, 1)}</td><td class="n ${cls(y.old)}">${pct(y.old, 1)}</td></tr>`).join("") : "";
    return `${card}
      ${L && L.curves ? `<h2>样本外净值（扣成本）</h2><div class="card"><div id="v2nav" class="chart"></div><div class="muted small">全部是「当时只用过去数据定权重、下一段才检验」的样本外结果拼起来的。虚线竖线左边用来挑方案（N、退出规则），右边是挑完之后没再改过的检验段。股票池等权＝同一批股票每 ${L.main.rebalance} 天等权买入（不计成本）。</div></div>` : ""}
      <h2>🟥 今日买入候选（v2 前 ${S.top || "N"}）</h2><div class="card tablewrap">
        <div class="muted small" style="margin-bottom:6px">数据日期 ${esc(S.date || "")}${S.intraday ? "（盘中数据，收盘后名单可能变）" : ""}｜参与打分 ${S.pool || "—"} 只｜当前仓位上限 ${capTxt}，单只建议权重＝仓位上限 ÷ ${S.top || "N"}</div>
        ${buys ? `<table class="tbl"><tr><th>股票 / 主要驱动</th><th>现价</th><th>排名</th><th>权重</th></tr>${buys}</table>` : "今天没有结果。"}
        <div class="muted small" style="margin-top:6px">${esc(S.rules || "")}</div></div>
      <h2>🟩 卖出 / 减仓</h2><div class="card tablewrap">${ps ? `<div class="muted small">上一个调仓日（${esc(S.prev_date || "")}）的前 ${S.top} 名里，今天排名跌出前 ${2 * (S.top || 0)} 的——如果按名单持有，下个调仓日卖出：</div>
        <table class="tbl"><tr><th>股票</th><th>现价</th><th>排名 上期→今天</th><th>期间涨跌</th></tr>${ps}</table>` : `<div class="muted">上一个调仓日（${esc(S.prev_date || "")}）的前 ${S.top || "N"} 名今天都还在前 ${2 * (S.top || 0)}，没有要卖的。</div>`}
        <div class="muted small" style="margin-top:6px">自己的持仓：点进个股透视看，或在虚拟账户里调用 v2_signals(holdings=[…]) 逐只判断。</div></div>
      <h2>当前采用的因子与权重</h2><div class="card"><div class="muted small" style="margin-bottom:4px">模型：${esc(S.model || "")}</div><div class="chips">${wts || '<span class="muted">—</span>'}</div>
        <div class="muted small">${S.cfg && S.cfg.mode === "fixed" ? "固定权重，不随行情估计：滚动估权重的模型在样本外后半段全部失效（见下方方案对比），所以 A股改用这 4 个经典异象等权。负＝越小越好。"
          : "每次调仓前，用过去 250 个交易日估计各因子和未来收益的关系，|t|≥2 的入选（不足 3 个取最强的 3 个），按 IC 大小定权重；正＝越大越好，负＝越小越好。"}</div></div>
      ${fac ? `<h2>因子体检（${esc(L.period ? L.period[0] : "")} 起，横截面超额）</h2><div class="card tablewrap"><table class="tbl"><tr><th>因子</th><th>Rank IC·5日</th><th>收益IC·5日</th><th>收益IC·20日</th><th>Q5−Q1<span class="note">每5日</span></th><th>前/后半段<span class="note">RankIC·5日</span></th><th>入选率<span class="note">滚动估权重时</span></th></tr>${fac}</table>
        <div class="muted small">IC＞0＝因子越大、之后越跑赢同期股票池；|t|≥2 才算统计上站得住。Rank IC 看「名次」，收益 IC 看「收益均值」（缩尾后）——A股收益右偏，两者经常方向相反，等权买前 N 只吃的是均值，所以 v2 用收益 IC。入选率＝滚动估权重的模型在样本外每次调仓里选中它的比例（越分散＝越说明「最强因子」变来变去）。</div></div>` : ""}
      ${cmp ? `<h2>方案对比（样本外，扣成本）</h2><div class="card tablewrap"><table class="tbl"><tr><th>方案</th><th>年化</th><th>回撤</th><th>夏普</th><th>超额/年</th><th>后半段超额</th><th>换手/年</th></tr>${cmp}</table>
        <div class="muted small">超额＝相对股票池等权。主方案按前半段表现选出，后半段是选完之后的检验。</div></div>` : ""}
      ${yrs ? `<h2>分年度</h2><div class="card tablewrap"><table class="tbl"><tr><th>年份</th><th>v2</th><th>v2+择时</th><th>股票池等权</th><th>${esc(L.bench_name)}</th><th>旧规则</th></tr>${yrs}</table></div>` : ""}
      ${L && L.caveats ? `<h2>局限</h2><div class="card"><ul class="muted" style="margin:0;padding-left:18px">${L.caveats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}`;
  }
  function drawV2(L) {
    const el = $("#v2nav"); if (!el || !window.echarts) return;
    const C = L.curves, ln = (name, data, color, o = {}) => ({ name, type: "line", data, showSymbol: false, lineStyle: { width: o.w || 1.4, color, type: o.dash ? "dashed" : "solid" }, itemStyle: { color } });
    const S = [ln("v2", C.v2, css("--up"), { w: 2 }), ln("v2+四象限择时", C.v2_timed, "#e8a317"), ln("股票池等权", C.ew, "#888"), ln(L.bench_name, C.idx, "#2f7fd8", { dash: 1 })];
    if (C.old) S.push(ln("旧规则", C.old, "#8b5cf6", { dash: 1 }));
    if (C.split) S[0].markLine = { silent: true, symbol: "none", data: [{ xAxis: C.split }], lineStyle: { color: "#aaa", type: "dashed" }, label: { show: false } };
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", confine: true, valueFormatter: (v) => (v == null ? "—" : (+v).toFixed(3)) },
      legend: { top: 0, textStyle: { color: css("--sub"), fontSize: 11 } }, grid: { left: 44, right: 12, top: 48, bottom: 30 },
      xAxis: { type: "category", data: C.dates, ...ax(), splitLine: { show: false } }, yAxis: { type: "value", ...ax(), scale: true }, dataZoom: [{ type: "inside" }], series: S });
  }

  // ---------- 路由 ----------
  function route() {
    while (charts.length) charts.pop().dispose();
    const h = location.hash.replace(/^#\/?/, "").split("/");
    document.querySelectorAll("#nav a[data-k]").forEach((a) => a.classList.toggle("on", a.dataset.k === (h[0] === "picks" ? "picks" : "stock")));
    if (h[0] === "s" && h[1]) stock(decodeURIComponent(h[1]));
    else if (h[0] === "q" && h[1]) { // 从「今日」页搜索框跳过来：按文字解析成代码再进个股页
      const t = decodeURIComponent(h.slice(1).join("/"));
      q.value = t;
      app.innerHTML = `<div class="loadbox">正在查找「${esc(t)}」…</div>`;
      api("resolve", { q: t }).then((r) => { if (r && r.sym) location.replace("#/s/" + r.sym); else app.innerHTML = `<div class="card">没找到「${esc(t)}」，换个代码或名称试试（在上面的搜索框输入）。</div>`; })
        .catch(() => { app.innerHTML = '<div class="card">搜索失败，网络不太好，稍后再试。</div>'; });
    }
    else if (h[0] === "picks") picks(h[1] === "us" ? "us" : "cn");
    else { routeTok++; document.title = "小七个股透视 · 一键看懂一只股票"; home(); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
