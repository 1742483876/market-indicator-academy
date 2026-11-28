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
      if (path === "ticks") return (await E.ticks(params.sym || "", { fresh: !!params.fresh })) || { error: "逐笔数据只支持 A 股，或今天还没开盘" };
      if (path === "minute") return (await E.minute(params.sym || "")) || { error: "分时只支持 A 股" };
      if (path === "minute5") return (await E.minute5(params.sym || "")) || { error: "分时只支持 A 股" };
      if (path === "quote") return (await E.quote(params.sym || "")) || { error: "没有报价" };
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
  window.addEventListener("resize", () => charts.forEach((c) => { if (!c.isDisposed()) c.resize(); }));
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
      <p class="muted">A股、美股、港股都能查。自动算趋势、动能、成交量、主力资金（大单/小单）、筹码、相对大盘强弱，给出「可以考虑买入 / 等待确认 / 不推荐买入」的结论（A股按回测过的分散组合名次＋趋势两个视角合成），并用这只股票自己的历史检验信号靠不靠谱。</p></section>
      ${r.length ? `<h2>最近看过</h2><div class="chips">${r.map((x) => `<a class="chip" href="#/s/${x.sym}">${esc(x.name)}</a>`).join("")}</div>` : ""}
      <div class="card" style="border-left:6px solid var(--up)"><b>🎯 今日买卖点</b>　<a href="#/picks/cn">A股 →</a>　<a href="#/picks/us">美股 →</a><div class="muted">最上面是 <b>⭐ S 级买卖点</b>（market-pulse 右侧确认，A股 34 只 / 美股 58 只 / 港股 3 只执行池，买卖依据）；下面是研究区。A股：每天给出「分散组合」（每月调仓的一篮子 20 只，测试中、不作为买卖依据）、市值前 1000 只的趋势扫描，以及全部 A股（约 4000 只）12 套规则买卖点与检验结果；美股扫标普500+纳指100，只作参考。</div></div>
      <h2>常看的</h2><div class="chips">${HOT.map(([s, n]) => `<a class="chip" href="#/s/${s}">${n}</a>`).join("")}</div>
      <div class="grid3" style="margin-top:18px">
        <div class="card"><b>主力资金（A股）</b><div class="muted">东方财富口径的每日超大单/大单/中单/小单净流入，以及今天每一笔成交按金额分档统计，判断主力在吸筹、拉升、洗盘还是出货。</div></div>
        <div class="card"><b>技术面</b><div class="muted">一目均衡表、均线排列、ADX、MACD、KDJ、RSI、布林带、OBV，都配曲线，可以切换。</div></div>
        <div class="card"><b>美股资金</b><div class="muted">美股没有公开的大单数据，用 CMF、MFI、OBV 和放量日方向推算资金进出。</div></div>
      </div>
      <p class="disclaimer">数据来自腾讯行情、东方财富等公开接口，可能有几秒到几分钟延迟。仅供研究参考，不构成投资建议。</p>`;
  }

  // ---------- 个股页 ----------
  const SEGC = { push: ["rgba(229,72,77,.17)", "#c0262d"], dump: ["rgba(240,140,30,.24)", "#b35900"], absorb: ["rgba(240,140,140,.12)", "#d0575c"],
    flee: ["rgba(26,158,85,.16)", "#12804a"], wait: ["rgba(150,150,150,.10)", "#8a8a8a"], seal_up: ["rgba(229,72,77,.30)", "#a3171e"], seal_dn: ["rgba(26,158,85,.30)", "#0b6b3a"] };
  const SEGN = { push: "资金推升", dump: "拉高出货", absorb: "承接/吸筹", flee: "资金出逃", wait: "观望", seal_up: "涨停封板", seal_dn: "跌停" };
  const FLOWKEY = { dump: "pump_dump", absorb: "absorb", push: "push", flee: "flee" };
  const how = (h, now, id) => `<div class="how">🔎 <b>怎么看</b>　${h}</div><div class="nowline" ${id ? `id="${id}"` : ""}>${now ? `📍 <b>现在</b>　${esc(now)}` : ""}</div>`;
  let TK = null, NT = {}, PH = { phases: [], hasFF: false }, FL = null, FLP = null;
  const flowLab = () => FLP || (FLP = fetch(`flow_lab.json?d=${new Date().toISOString().slice(0, 10)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => (FL = j)));
  function flText(key) { // 日级回测一句话（stockscope/flow_lab.py 每次运行生成 flow_lab.json）
    const c = FL && FL.conds && FL.conds[key]; if (!c) return "";
    const s = c.s[3] || c.s["3"], b = FL.base[3] || FL.base["3"]; if (!s || !s.n) return "";
    return `日级回测（${FL.stocks} 只大市值股，${FL.period[0].slice(5)}~${FL.period[1].slice(5)}，${s.n} 次）：「${c.name.replace(/（.*$/, "")}」之后 3 天平均 ${pct(s.mean)}、胜率 ${f(s.win, 0)}%（全部日子 ${pct(b.mean)} / ${f(b.win, 0)}%），扣掉大盘后 ${pct(s.ex)}（t=${f(s.t, 1)}）——${c.verdict}。`;
  }

  async function stock(sym) {
    const tok = ++routeTok;
    app.innerHTML = `<div class="loadbox">正在分析 ${esc(sym)} …<br><span class="small">第一次大约 2–6 秒</span></div>`;
    let a;
    try {
      a = await api("analyze", { sym });
      if (a.error) throw new Error(a.error);
    } catch (e) {
      if (tok !== routeTok) return;
      if (/历史数据不足/.test(e.message)) { // 2026-11-24：新股 / 次新股（日K 不到 30 根）从学堂各页点进来，不显示「分析失败」，给报价 + 说明
        let q = null;
        try { q = await api("quote", { sym }); } catch (e2) { q = null; }
        if (tok !== routeTok) return;
        const ok = q && !q.error && q.price != null;
        document.title = `${ok ? q.name : sym} · 小七个股透视`;
        app.innerHTML = `<div class="card">${ok ? `<h1 style="margin:0 0 4px">${esc(q.name)} <span class="muted small">${esc(q.code || sym)}</span></h1><div style="font-size:22px;font-weight:700" class="${cls(q.pct)}">${f(q.price, q.price > 100 ? 2 : 3)} <span style="font-size:15px">${pct(q.pct)}</span></div>` : `<h1 style="margin:0 0 4px">${esc(sym)}</h1>`}
          <p>这只上市时间太短（日 K 线不到 30 根，多是新股 / 次新股），均线、资金、回测这些都还算不出来，暂时没有完整分析。过几周再来看；新股波动大，别只凭涨跌追。</p><p class="muted small"><a href="javascript:location.reload()">刷新报价</a></p></div>`;
        return;
      }
      app.innerHTML = `<div class="card err">分析失败：${esc(e.message)}　<a href="javascript:location.reload()">重试</a></div>`; return;
    }
    if (tok !== routeTok) return;
    A = a; TK = null; SGM = null;
    try { NT = window.SSEngine.chart_notes(a); } catch (e) { console.error(e); NT = {}; }
    try { PH = window.SSEngine.manipPhases ? window.SSEngine.manipPhases(a) : { phases: [], hasFF: false }; } catch (e) { console.error(e); PH = { phases: [], hasFF: false }; }
    await flowLab();
    if (tok !== routeTok) return;
    addRecent({ sym: a.sym, name: a.name });
    document.title = `${a.name}(${a.code}) · 小七个股透视`;
    const Q = a.quote || {}, cn = a.market === "A股";
    const gmax = { 趋势: 30, 动能: 15, 资金: 25, 量能: 10, 相对强弱: 10, 位置风险: 10 };
    const gb = Object.keys(gmax).map((g) => {
      const v = a.groups[g] || 0, w = Math.abs(v) / gmax[g] * 50;
      return `<span>${g}</span><div class="gbar"><span class="mid"></span><i style="${v >= 0 ? `left:50%;width:${w}%;background:var(--up)` : `right:50%;width:${w}%;background:var(--dn)`}"></i></div><span class="${cls(v)}">${v > 0 ? "+" : ""}${v}</span>`;
    }).join("");
    const ff = a.fund_flow, V = a.views || {};
    const facts = [["PE(TTM)", f(Q.pe)], ["PB", f(Q.pb)], ["总市值", Q.total_cap ? f(Q.total_cap, 0) + "亿" : "—"], ["换手", Q.turnover != null ? f(Q.turnover) + "%" : "—"],
      ["量比", f(Q.vol_ratio)], ["振幅", Q.amp != null ? f(Q.amp) + "%" : "—"], ["52周", `${f(a.lo52)}–${f(a.hi52)}`], ["52周位置", f(a.pos52, 0) + "%"]];
    const rets = Object.entries(a.returns).filter(([k]) => k !== "5日" && k !== "20日").map(([k, v]) => `<span>${k} <b class="${cls(v)}">${pct(v, 1)}</b></span>`).join("");
    const H = a.history;
    const hasMin = !!(cn && a.minute && a.minute.rows && a.minute.rows.length);
    const legend = Object.keys(SEGN).map((k) => `<span><i style="background:${SEGC[k][0].replace(/[\d.]+\)$/, ".55)")}"></i>${SEGN[k]}</span>`).join("");
    app.innerHTML = `
      <div class="head"><h1>${esc(a.name)} <span class="muted">${esc(a.code)}·${a.market}</span></h1>
        <span class="price ${cls(Q.pct)}" id="hp">${f(Q.price, Q.price > 100 ? 2 : 3)}</span><span class="${cls(Q.pct)}" id="hpct">${pct(Q.pct)}</span>
        ${a.limit_up ? '<span class="tag buy">涨停</span>' : ""}${a.limit_down ? '<span class="tag sell">跌停</span>' : ""}<span id="live" class="live"></span></div>
      ${quickTiles()}
      <div class="facts">${facts.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join("")}</div>
      <div class="facts">${rets}</div>

      <div class="card verdict ${a.cls}">
        <div class="vt">${esc(a.verdict)}</div>
        ${V.v2 ? `<div class="vr">🧺 ${esc(V.v2.text)}</div>` : ""}
        ${V.trend ? `<div class="vr">📈 ${esc(V.trend.text)}<span class="muted small">｜${esc(a.reason)}</span></div>` : `<div class="vr">${esc(a.reason)}</div>`}
        <div class="va">👉 ${esc(a.action)}</div>
        ${a.basis ? `<div class="muted small">📊 ${esc(a.basis)} <a href="#/picks/${cn ? "cn" : "us"}">看组合名单 →</a></div>` : ""}
        <div class="muted">综合分 <b>${a.score > 0 ? "+" : ""}${a.score}</b>（−100 ~ +100）｜数据时点 ${esc(a.data_time)}｜支撑 ${a.support.map((x) => f(x)).join(" / ") || "—"}｜压力 ${a.resist.map((x) => f(x)).join(" / ") || "—"}｜参考止损 ${f(a.stop)}</div>
        <div class="gbars">${gb}</div>
        <div class="muted small">怎么读：六组打分，往右的红条＝加分、往左的绿条＝减分；每组有上限（趋势±30、动能±15、资金±25、量能±10、相对强弱±10、位置风险±10），加起来就是综合分（＝上面的「趋势视角」）。${cn ? "A股回测里这个分数越高、之后反而越弱，所以大结论只认 v2 分散组合：进了前 20 名才说「可以考虑买入」；不在组合里的，趋势偏空说「不推荐买入」，其余「等待确认」。" : "≥35 且没有硬伤才会给「可以考虑买入」（美股/港股没做过全市场回测，只作参考）。"}</div>
      </div>

      <h2>⭐ S 级记录 <span class="muted small">（market-pulse 右侧买卖点）</span></h2>
      <div class="card" id="sgcard"><div class="muted small">正在读取这只票的 S 级买卖点历史…</div></div>

      ${hasMin ? `<h2>分时：价格 × 大单在干什么</h2><div class="card" id="intra">
        <div class="mdays" id="mdays"><span class="muted small">正在取最近 5 天的分时…</span></div>
        <div class="mhead" id="mhead"></div>
        <div class="seglegend" id="seglegend">${legend}</div>
        <div id="mc" class="chart intra"></div>
        <div id="segnow" class="segnow"><div class="muted small">正在下载今天每一笔成交，统计大单方向（约 5–10 秒）…</div></div>
        <div id="seglist" class="seglist"></div>
        <div class="how">🔎 <b>怎么看</b>　上图黑线＝价格、黄线＝均价线（今天所有成交的平均成本）、灰虚线＝昨收；中图＝大单＋超大单（单笔≥20万）「主动买 − 主动卖」从开盘起的累计，往上＝大资金在买。
          色块是程序切出的阶段：<b class="c-push">红＝资金推升</b>（涨＋大单买）、<b class="c-dump">橙＝拉高出货</b>（涨或横盘，但大单在卖）、<b class="c-absorb">粉＝承接/吸筹</b>（跌或横盘，但大单在买）、<b class="c-flee">绿＝资金出逃</b>（跌＋大单卖）、灰＝观望。<b>价格创新高而中图不跟＝背离，最要小心。</b></div>
        <div class="muted small" id="segrules"></div>
        <div id="tickbox"></div></div>` : ""}

      <div class="card"><b>🕵️ 主力行为：${esc(a.behavior.label)}</b><div class="muted">${esc(a.behavior.desc)}</div>
        ${ff ? `<div class="kv" style="margin-top:8px">
          <div><span>${ff.n > 1 || !ff.src || ff.src === "em" ? "今日" : esc(ff.last.d.slice(5)) + " "}主力净流入</span><b class="${cls(ff.last.main)}">${yi(ff.last.main)}</b><span>${pct(ff.last.main_pct, 1)} 成交额${ff.src && ff.src !== "em" ? "（估算）" : ""}</span></div>
          ${(ff.n || 99) >= 5 ? `<div><span>5日主力</span><b class="${cls(ff.sum5)}">${yi(ff.sum5)}</b><span>日均 ${pct(ff.pct5, 1)}</span></div>` : `<div><span>5日主力</span><b>—</b><span>备用源只有 ${ff.n} 天</span></div>`}
          ${(ff.n || 99) >= 20 ? `<div><span>20日主力</span><b class="${cls(ff.sum20)}">${yi(ff.sum20)}</b><span>日均 ${pct(ff.pct20, 1)}</span></div>` : `<div><span>20日主力</span><b>—</b><span>备用源只有 ${ff.n} 天</span></div>`}
          <div><span>连续</span><b class="${cls(ff.streak)}">${Math.abs(ff.streak)}日${ff.streak > 0 ? "流入" : "流出"}</b><span>&nbsp;</span></div>
          ${!ff.src || ff.src === "em" ? `<div><span>5日超大单</span><b class="${cls(ff.huge5)}">${yi(ff.huge5)}</b></div><div><span>5日大单</span><b class="${cls(ff.big5)}">${yi(ff.big5)}</b></div>
          <div><span>5日中单</span><b class="${cls(ff.mid5)}">${yi(ff.mid5)}</b></div><div><span>5日小单</span><b class="${cls(ff.small5)}">${yi(ff.small5)}</b></div>`
          : [["huge", "超大单"], ["big", "大单"], ["mid", "中单"], ["small", "小单"]].map(([k, n]) => ff.last[k] != null ? `<div><span>${esc(ff.last.d.slice(5))} ${n}</span><b class="${cls(ff.last[k])}">${yi(ff.last[k])}</b></div>` : `<div><span>${n}</span><b>—</b></div>`).join("")}</div>
          <div class="muted small">${!ff.src || ff.src === "em" ? "口径：东方财富，按单笔成交额分档——超大单≥100万元、大单20–100万元、中单4–20万元、小单&lt;4万元；主力＝超大单＋大单。" : "⚠️ 来源与口径：" + esc(ff.note || "") + "。"}“主力”是统计概念，不代表某个具体机构。</div>`
          : `<div class="muted small">${cn ? "资金流数据暂未获取到。" : "美股/港股没有公开的大单小单数据，下面用 CMF、MFI、OBV 和放量日方向推算资金进出。"}</div>`}
      </div>

      <h2>🕰️ 主力操盘阶段 <span class="muted small">（近半年逐日判定）</span></h2>
      <div class="card" id="phasebox"></div>

      <h2>📝 文章总结 <span class="muted small">（基于本页数据自动生成）</span></h2>
      <div class="card"><div class="tools" style="margin-bottom:8px"><button id="genArticle" class="on">✨ 生成文章总结</button><button id="copyArticle">复制全文</button><button id="dlArticle">下载 .md</button></div>
        <div id="articlebox"><div class="muted small">点「生成文章总结」，把结论、主力操盘阶段、技术面、资金面、买卖点和风险拼成一篇可直接转发/留档的文章。</div></div></div>

      <h2>K 线与技术指标</h2>
      <div class="card"><div class="tools" id="ov">${[["ma", "均线"], ["boll", "布林带"], ["ichi", "一目云"], ["gmma", "顾比"], ["ann", "标注"], ["sg", "⭐S级"]].map(([k, n], i) => `<button data-k="${k}" class="${i === 0 || k === "ann" || k === "sg" ? "on" : ""}">${n}</button>`).join("")}</div>
        <div class="tools" id="subs">${[["vol", "成交量"], ["macd", "MACD"], ["kdj", "KDJ"], ["rsi", "RSI"], ["obv", "OBV"], [cn ? "ff" : "cmf", cn ? "主力资金" : "CMF/MFI"], ["adx", "ADX"]].map(([k, n], i) => `<button data-k="${k}" class="${i === 0 ? "on" : ""}">${n}</button>`).join("")}</div>
        <div id="mplg" class="mp-lg"></div>
        <div id="kc" class="chart tall"></div>
        <div id="dstrip" class="rg-strip"></div>
        <div class="rg-box"><div class="rg-sh"><b>区间统计</b><span>点下面的按钮，或在K线上拖动/双指缩放＝自选</span></div>
          <div class="rg-chips" id="rgchips">${RGS.map(([k, n]) => `<button data-k="${k}">${n}</button>`).join("")}</div><div id="rgcard" class="rg-card"></div>
          <div class="rg-note">区间涨跌＝最后一天收盘 ÷ 区间前一天收盘 − 1；超额＝区间涨跌 − 同期大盘涨跌，正数＝跑赢大盘；上涨天数＝收盘比前一天高的天数。</div></div>
        ${how("红涨绿跌，双指缩放/拖动。浅红底＝均线多头排列（MA5>MA10>MA20>MA60，趋势向上），浅绿底＝空头排列；▲突破＝放量（量≥5日均量1.5倍）收盘创20日新高，▼破位＝放量创20日新低；虚线＝最近的压力/支撑。点「标注」可以关掉这些。点「顾比」叠加顾比均线：暖色 6 条＝短期组 EMA3~15，冷色 6 条＝长期组 EMA30~60，两组分开＝趋势清楚，缠在一起＝没方向（只用来看图：回测里「顾比金叉」「回踩再发散」择时不比 MACD/60 日线好，选股买进去平均跑输，见「验真」页）。", NT.k && NT.k.read)}</div>

      <h2 id="anh">🔍 相似走势 <span class="muted small">（今天走到一半，历史上最像的几天后来怎么走；<a href="../#/analog/${esc(a.sym)}">在学堂打开 ›</a>）</span></h2><div class="card" id="anbox"><div class="muted small">滑到这里自动加载…</div></div>

      ${a.sym.startsWith("us") ? `<h2 id="ush">📐 日内形态 <span class="muted small">（这只最常见哪种日内走势、最近一天走到哪一段；<a href="../#/usshape/${esc(a.sym)}">全体美股统计 ›</a>）</span></h2><div class="card" id="usbox"><div class="muted small">滑到这里自动加载…</div></div>` : ""}

      <h2 id="mph">📍 买卖点标注（我的规则 + 12 套预置规则）</h2><div class="card" id="mpbox"><div class="muted small">正在按每条规则重算这只股票的历史买卖点…</div></div>

      ${cn ? `<h2>主力资金：每日大单 / 小单净流入</h2><div class="card"><div id="ffc" class="chart mid"></div>
        ${how("柱子＝超大单、大单、中单、小单每天的净流入（万元）叠在一起；黑线＝主力（超大＋大单）净流入，虚线＝收盘价。底色＝主力连续 ≥3 天同向（红＝连续流入、绿＝连续流出）。主力流入、小单流出，说明筹码从散户流向大资金；价格涨而主力连续流出＝要警惕。",
          NT.ff && NT.ff.read ? NT.ff.read + " " + (NT.ff.today ? flText(NT.ff.today) : "") : null)}</div>`
      : `<h2>资金流（量价推算）</h2><div class="card"><div id="cmfc" class="chart mid"></div>
        ${how("CMF＞0＝收盘偏向当天高点且放量（资金流入）；紫线 MFI 是带成交量的 RSI，＞80 过热、＜20 超卖。美股港股没有公开的大单数据，只能这样近似。", NT.cmf && NT.cmf.read)}</div>`}

      ${isLhbStock(a.sym) ? `<h2>🐯 龙虎榜记录</h2><div class="card" id="lhbbox"><div class="muted small">正在查这只股票近一年的龙虎榜…</div></div>` : ""}

      <h2>筹码分布（估算）</h2><div class="card">${a.chips ? `<div class="kv"><div><span>获利盘</span><b>${f(a.chips.profit_pct, 0)}%</b></div><div><span>平均成本</span><b>${f(a.chips.avg_cost)}</b></div>
        <div><span>90% 筹码区间</span><b>${f(a.chips.band90[0])}–${f(a.chips.band90[1])}</b></div><div><span>筹码最密集</span><b>${f(a.chips.peak)}</b></div></div>
        <div id="chc" class="chart mid"></div>
        ${how(`横条越长＝这个价位买进的人越多（近 ${a.chips.days} 个交易日的成交量按每日价格区间摊开，没考虑换手衰减，只能大致看成本区）。红＝现价下方（这些人赚钱），绿＝现价上方（这些人被套）。获利盘高＝上涨时抛压可能变大；上方绿条密集处往往是压力。`, NT.chips && NT.chips.read)}` : "数据不足"}</div>

      <h2>相对强弱：和${esc(a.benchmark)}比</h2><div class="card"><div id="rsc" class="chart mid"></div>
        ${how("两条线都从图表起点的 100 开始。红线在灰线上方＝这段时间跑赢大盘。底色＝连续 10 天以上 20 日相对涨幅 ≥2pct（浅红＝跑赢）或 ≤−2pct（浅绿＝跑输）的区段。", NT.rs && NT.rs.read)}</div>

      <h2>每个指标怎么看</h2><div class="card tablewrap"><div class="muted small" style="margin-bottom:6px">怎么读：「数值」是指标现在的读数，「状态」是程序的判断，「得分」是它对综合分的贡献（红＝加分、绿＝减分），「说明」是看这个指标的要点。</div>
        <table class="tbl"><tr><th>分组</th><th>指标</th><th>数值</th><th>状态</th><th>得分</th><th>说明</th></tr>
        ${a.items.map((it) => `<tr><td>${it.group}</td><td>${it.lesson ? `<a href="${it.lesson}">${esc(it.name)}</a>` : esc(it.name)}</td><td>${esc(it.value)}</td><td>${esc(it.state)}</td><td class="n ${cls(it.pts)}">${it.pts > 0 ? "+" : ""}${it.pts}</td><td class="note">${esc(it.note)}</td></tr>`).join("")}</table>
        <div class="muted small">指标名带链接的，点开可以去「小七指标学堂」看详细讲解和历史曲线。</div></div>

      <h2>这只股票的历史检验</h2><div class="card">${H.strong.n ? `用这只股票过去约 3 年的数据，把每天的技术分（趋势＋动能，不含资金）算出来，看之后 20 个交易日的涨跌：
        <div class="tablewrap"><table class="tbl"><tr><th>情形</th><th>天数</th><th>后20日平均</th><th>上涨概率</th></tr>
        <tr><td>技术分 ≥ 25（强势）</td><td>${H.strong.n}</td><td class="${cls(H.strong.mean)}">${pct(H.strong.mean, 1)}</td><td>${f(H.strong.win, 0)}%</td></tr>
        <tr><td>技术分 ≤ −20（弱势）</td><td>${H.weak.n}</td><td class="${cls(H.weak.mean)}">${pct(H.weak.mean, 1)}</td><td>${H.weak.n ? f(H.weak.win, 0) + "%" : "—"}</td></tr>
        <tr><td>全部交易日（基准）</td><td>${H.all.n}</td><td class="${cls(H.all.mean)}">${pct(H.all.mean, 1)}</td><td>${f(H.all.win, 0)}%</td></tr></table></div>
        <div class="muted small">怎么读：拿「强势」行和「基准」行比——强势行的平均涨幅和上涨概率都更高，说明这只股票过去顺势买还行；反过来就说明追涨效果差（常见于题材股、炒作股），趋势视角会降为「等待确认」。注意：单只股票几百天的样本很容易看走眼——放到全市场 1000 只一起回测，「技术分高就买」整体是跑输的${cn ? "（见上面结论卡的回测依据）" : ""}。今天的技术分：${H.now ?? "—"}。</div>` : "历史数据不足，无法检验"}</div>

      ${a.errors.length ? `<div class="card muted">⚠️ ${a.errors.map(esc).join("；")}</div>` : ""}
      <p class="disclaimer">结论和图上的阶段标注都由公开数据按固定规则自动计算，只是概率倾向，可能滞后或出错，不考虑公司公告、财报和突发消息。仅供研究参考，不构成投资建议。</p>`;
    RG = { k: "20", prog: false, raf: 0 }; rangeChips(); rangeCard(); dailyStrip();
    bindArticle(a, tok);
    $("#rgchips").onclick = (e) => { const b = e.target.closest("button"); if (b) rangePick(b.dataset.k); };
    $("#ov").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; b.classList.toggle("on"); drawK(); };
    $("#subs").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; $("#subs").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); drawK(); };
    if (hasMin) liveStart(tok);
    MP = null;
    try { const mkm = /^(sh|sz)/.test(a.sym) ? "cn" : a.sym.startsWith("us") ? "us" : "hk"; const meta = mkm === "hk" ? null : await mpMeta(mkm); if (tok !== routeTok) return; MP = mpInit(a, meta, mkm); }
    catch (e) { console.error(e); MP = null; }
    mpBox();
    renderPhases(a, PH);
    renderLhb(a, tok);
    sgStock(a, tok);
    analogBox(a, tok);
    usshapeBox(a, tok);
    try { await lib(); } catch (e) { app.insertAdjacentHTML("afterbegin", '<div class="card err">图表组件加载失败，文字结论不受影响。</div>'); return; }
    if (tok !== routeTok) return;
    MDAY = null;
    drawIntra(); drawK(); drawFF(); drawCMF(); drawChips(); drawRS();
    if (hasMin) { loadTicks(tok); loadMin5(tok); }
  }

  // ---------- 🕰️ 主力操盘阶段 渲染 ----------
  function renderPhases(a, ph) {
    const box = $("#phasebox"); if (!box) return;
    const ps = (ph && ph.phases) || [];
    if (!ps.length) { box.innerHTML = `<div class="muted small">近半年没有连续 ≥3 天的清晰主力阶段（逐日判定没有形成连续同向的资金＋价格配合）。可看下面「主力资金」图和「🕵️ 主力行为」卡片。</div>`; return; }
    const todayS = ph.today;
    const TN = { 1: "吸筹", 2: "拉升", 3: "派发", 4: "洗盘", 5: "出逃" };
    const rows = ps.slice().reverse().map((p) => {
      const ago = p.ago === 0 ? "进行中" : p.ago + "天前结束";
      const ret = p.ret == null ? "" : `<span class="${cls(p.ret)}">区间 ${pct(p.ret, 1)}</span>`;
      const ff = ph.hasFF && p.mainSum != null ? `<span>主力净额 <b class="${cls(p.mainSum)}">${yi(p.mainSum * 1e4)}</b></span>` : "";
      return `<div class="phase-row"><span class="phase-tag ${p.tone}">${esc(p.name)}</span>
        <span class="phase-date">${esc(p.d0.slice(5))} → ${esc(p.d1.slice(5))} <span class="muted">· ${p.len}天 · ${ago}</span></span>
        <span class="phase-meta">${ret} ${ff}</span>
        <div class="phase-note">${esc(p.note)}</div></div>`;
    }).join("");
    box.innerHTML = `${!ph.hasFF ? `<div class="muted small" style="margin-bottom:8px">⚠️ 没有拿到按天的大单数据，这里用 CMF/量价推算资金方向（口径与东财主力不同，仅看大致倾向）。</div>` : ""}
      ${todayS ? `<div class="nowline" style="margin-bottom:8px">📍 <b>当前阶段倾向</b>　${esc(TN[todayS] || "—")}</div>` : ""}
      <div class="phase-list">${rows}</div>
      <div class="muted small" style="margin-top:8px">口径：对每一天用「价格位置＋20日涨跌＋主力资金5/20日方向＋量能」判定状态（吸筹/拉升/派发/洗盘/出逃），连续同状态 ≥3 天才记为一个阶段。是概率倾向、不是精确标签，主力可以反复骗线，务必结合公告和趋势看。</div>`;
  }

  // ---------- 📝 文章总结：模板拼接（纯前端，离线可用） ----------
  function composeArticle(a, ph) {
    const Q = a.quote || {}, V = a.views || {}, ff = a.fund_flow;
    const C = a.chart;
    const L = [];
    const dt = (a.data_time || "").slice(0, 16);
    L.push(`# ${a.name}（${a.code}·${a.market}）个股透视`, "");
    L.push(`> 数据时点：${dt}　|　现价 ${f(Q.price, Q.price > 100 ? 2 : 3)}　|　${pct(Q.pct)}　|　综合分 ${a.score > 0 ? "+" : ""}${a.score}`, "");

    L.push("## 一、结论", "");
    L.push(`**${a.verdict}**。${a.action}`);
    if (V.v2 || V.trend) {
      L.push("");
      if (V.v2) L.push(`- 分散组合视角：${V.v2.text}`);
      if (V.trend) L.push(`- 趋势视角：${V.trend.text}`);
    }
    L.push(`- 综合分 ${a.score > 0 ? "+" : ""}${a.score}（−100~+100），六项打分：${Object.entries(a.groups || {}).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).map(([g, v]) => `${g} ${v > 0 ? "+" : ""}${v}`).join("、")}。`);
    L.push(`- 参考位：支撑 ${a.support.map((x) => f(x)).join(" / ") || "—"}，压力 ${a.resist.map((x) => f(x)).join(" / ") || "—"}，止损参考 ${f(a.stop)}。`);
    L.push("");

    L.push("## 二、主力行为与操盘阶段", "");
    L.push(`当前主力行为判定：**${a.behavior.label}** —— ${a.behavior.desc}。`);
    if (ff) {
      L.push("");
      L.push(`- 今日主力净流入 ${yi(ff.last && ff.last.main)}；近 5 日 ${yi(ff.sum5)}、近 20 日 ${yi(ff.sum20)}。`);
      L.push(`- 连续 ${Math.abs(ff.streak || 0)} 日净${ff.streak > 0 ? "流入" : "流出"}。`);
      if (NT.ff && NT.ff.read) L.push(`- ${NT.ff.read}`);
    }
    const ps = (ph && ph.phases) || [];
    if (ps.length) {
      L.push("");
      L.push("按天滚动判定的操盘阶段（近→远）：");
      L.push("");
      ps.slice().reverse().forEach((p) => {
        const r = p.ret == null ? "" : `，区间${pct(p.ret, 1)}`;
        L.push(`- **${p.name}**｜${p.d0.slice(5)}→${p.d1.slice(5)}（${p.len}天${r}）：${p.note}。`);
      });
    } else {
      L.push("近半年没有形成连续 ≥3 天的清晰主力阶段。");
    }
    L.push("");

    L.push("## 三、技术面", "");
    if (NT.k && NT.k.read) L.push(NT.k.read);
    const r = a.returns || {};
    L.push(`区间收益：5日 ${pct(r["5日"], 1)}、20日 ${pct(r["20日"], 1)}、60日 ${pct(r["60日"], 1)}、120日 ${pct(r["120日"], 1)}、250日 ${pct(r["250日"], 1)}。`);
    L.push(`相对大盘：20日 ${pct((a.rs || {})["20日"], 1)}、60日 ${pct((a.rs || {})["60日"], 1)}；52周位置 ${f(a.pos52, 0)}%（区间 ${f(a.lo52)}~${f(a.hi52)}）。`);
    if (a.chips) {
      const ch = a.chips;
      L.push(`筹码：获利比例约 ${ch.profit_pct != null ? f(ch.profit_pct, 0) + "%" : "—"}，平均成本约 ${f(ch.avg)}，90% 成本带 ${ch.band90 ? f(ch.band90[0]) + "~" + f(ch.band90[1]) : "—"}。`);
    }
    L.push("");

    L.push("## 四、基本面速览", "");
    L.push(`PE(TTM) ${f(Q.pe)}｜PB ${f(Q.pb)}｜总市值 ${Q.total_cap ? f(Q.total_cap, 0) + "亿" : "—"}｜换手 ${Q.turnover != null ? f(Q.turnover) + "%" : "—"}｜量比 ${f(Q.vol_ratio)}｜振幅 ${Q.amp != null ? f(Q.amp) + "%" : "—"}。`);
    L.push("");

    L.push("## 五、风险提示", "");
    L.push("1. 以上结论由公开行情按固定规则自动计算，只反映概率倾向，可能滞后或出错。");
    L.push("2. 不考虑公司公告、财报、行业突发消息和系统性风险，主力资金是统计概念、不代表某个具体机构，也可能反复骗线。");
    L.push("3. A股回测显示趋势分数越高之后反而越弱，因此大结论以分散组合为主；任何买入都要设止损、控制仓位。");
    L.push("");
    L.push("---", "");
    L.push(`*本文由小七投研个股透视页自动生成 · ${new Date().toLocaleString("zh-CN")} · 仅供研究参考，不构成投资建议。*`);
    return L.join("\n");
  }

  function bindArticle(a, tok) {
    const btn = $("#genArticle"), box = $("#articlebox");
    if (!btn || !box) return;
    btn.onclick = () => {
      if (tok !== routeTok) return;
      const md = composeArticle(a, PH);
      window.__articleMd = md;
      box.innerHTML = `<div class="article-md">${mdToHtml(md)}</div>`;
    };
    const cp = $("#copyArticle"), dl = $("#dlArticle");
    if (cp) cp.onclick = () => {
      const md = window.__articleMd || composeArticle(a, PH);
      const done = () => { const old = cp.textContent; cp.textContent = "已复制 ✓"; setTimeout(() => (cp.textContent = old), 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(done).catch(() => fallbackCopy(md, done));
      else fallbackCopy(md, done);
    };
    if (dl) dl.onclick = () => {
      const md = window.__articleMd || composeArticle(a, PH);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob), a2 = document.createElement("a");
      a2.href = url; a2.download = `${a.name}_${a.code}_个股透视_${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) {} ta.remove();
  }
  // 轻量 Markdown→HTML（只处理本文用到的标题/引用/列表/加粗/斜体/分隔线）
  function mdToHtml(md) {
    const esc2 = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const inline = (s) => esc2(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
    const out = [];
    for (const line of md.split("\n")) {
      if (/^### /.test(line)) out.push("<h4>" + inline(line.slice(4)) + "</h4>");
      else if (/^## /.test(line)) out.push("<h3>" + inline(line.slice(3)) + "</h3>");
      else if (/^# /.test(line)) out.push("<h2>" + inline(line.slice(2)) + "</h2>");
      else if (/^> /.test(line)) out.push('<div class="article-quote">' + inline(line.slice(2)) + "</div>");
      else if (/^- /.test(line)) out.push("<div class=\"article-li\">• " + inline(line.slice(2)) + "</div>");
      else if (/^\d+\. /.test(line)) out.push("<div class=\"article-li\">" + inline(line) + "</div>");
      else if (/^---$/.test(line)) out.push("<hr>");
      else if (line.trim()) out.push("<p>" + inline(line) + "</p>");
    }
    return out.join("");
  }

  // ---------- 🐯 龙虎榜记录（lhb.py 每天导出 ../lhb/stock/<代码后两位>.json，近一年每次上榜） ----------
  const isLhbStock = (sym) => /^(sh6[08]|sz00|sz30)\d{4}$/.test(sym);
  const LHB_G = { jg: "机构", north: "北向", quant: "量化", lasa: "拉萨天团" };
  const wanTxt = (v) => (v == null ? "—" : Math.abs(v) >= 1e4 ? (Math.abs(v) / 1e4).toFixed(2) + "亿" : Math.abs(v).toFixed(0) + "万");
  // 🔍 相似走势（学堂 analog.js 共用：日内相似日 / 两段重叠 / 日K相似段；滑到才加载，历史库 ../analog/）
  let anJs = null;
  function analogBox(a, tok) {
    const box = $("#anbox"); if (!box) return;
    const go = () => {
      anJs = anJs || new Promise((res, rej) => { const el = document.createElement("script"); el.src = "../analog.js?v=20261125a"; el.onload = res; el.onerror = () => { anJs = null; rej(new Error("相似走势模块加载失败")); }; document.head.appendChild(el); });
      anJs.then(() => { if (tok !== routeTok || !document.body.contains(box)) return; window.ANALOG.setBase("../"); window.ANALOG.mount(box, { code: a.sym, name: a.name, embed: true, link: (c, n) => (c === a.sym ? esc(n || c) : `<a href="#/s/${esc(c)}">${esc(n || c)}</a>`) }); })
        .catch((e) => { if (tok === routeTok) box.innerHTML = `<div class="muted small">${esc(e.message)}，<a href="../#/analog/${esc(a.sym)}">去学堂打开 ›</a></div>`; });
    };
    if (!("IntersectionObserver" in window)) return go();
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "300px" });
    io.observe(box);
  }
  // 📐 日内形态（学堂 usshape.js 共用；数据 ../usshape/<代码>.json，usshape.py 每天美股收盘后生成；滑到才加载）
  let usJs = null;
  function usshapeBox(a, tok) {
    const box = $("#usbox"); if (!box) return;
    const go = () => {
      usJs = usJs || new Promise((res, rej) => { const el = document.createElement("script"); el.src = "../usshape.js?v=20261125a"; el.onload = res; el.onerror = () => { usJs = null; rej(new Error("日内形态模块加载失败")); }; document.head.appendChild(el); });
      usJs.then(() => { if (tok !== routeTok || !document.body.contains(box)) return; window.USSHAPE.mount(box, { code: a.sym, base: "../", link: (c, n) => (c === a.sym ? esc(n || c) : `<a href="#/s/${esc(c)}">${esc(n || c)}</a>`) }); })
        .catch((e) => { if (tok === routeTok) box.innerHTML = `<div class="muted small">${esc(e.message)}，<a href="../#/usshape/${esc(a.sym)}">去学堂打开 ›</a></div>`; });
    };
    if (!("IntersectionObserver" in window)) return go();
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "300px" });
    io.observe(box);
  }
  async function renderLhb(a, tok) {
    const box = $("#lhbbox"); if (!box) return;
    let B;
    try {
      const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 13);
      const r = await fetch(`../lhb/stock/${a.sym.slice(-2)}.json?h=${day}`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      B = await r.json();
    } catch (e) {
      if (tok === routeTok) box.innerHTML = `<div class="muted small">龙虎榜记录暂时读不到（${esc(e.message || "网络错误")}），稍后刷新再看。</div>`;
      return;
    }
    if (tok !== routeTok || !$("#lhbbox")) return;
    const R = (B.s || {})[a.sym] || [];
    if (!R.length) { box.innerHTML = `<div class="muted small">近一年（${esc((B.range || [])[0] || "")} 起）没上过龙虎榜。</div>`; return; }
    const pill = (name, v, href) => {
      const c = v > 0 ? "b" : v < 0 ? "s" : "";
      const t = `<span class="nm">${esc(name)}</span><span class="am">${v > 0 ? "买" : v < 0 ? "卖" : ""} ${wanTxt(v)}</span>`;
      return href ? `<a class="lhp ${c}" href="${href}">${t}</a>` : `<span class="lhp ${c}">${t}</span>`;
    };
    const row = (x) => {
      const ps = (x.yz || []).map(([id, nm, v, has]) => pill(nm, v, has ? `../#/lhb/seat/${encodeURIComponent(id)}` : null))
        .concat(Object.entries(x.g || {}).filter(([, v]) => v).map(([k, v]) => pill(LHB_G[k] || k, v, null)));
      const a3 = x.a ? x.a[1] : null, a1 = x.a ? x.a[0] : null;
      const aft = a3 != null ? `之后3天 <b class="${cls(a3)}">${pct(a3, 1)}</b>` : a1 != null ? `第二天 <b class="${cls(a1)}">${pct(a1, 1)}</b>（还没满3天）` : `<span>刚上榜，之后涨跌还没出来</span>`;
      return `<div class="lhr"><div class="lhh"><b>${esc(x.d.slice(2))}</b><span class="lhw">${esc((x.why || []).join("；"))}</span><b class="${cls(x.chg)} lhc">${pct(x.chg, 1)}</b></div>
        <div class="lhs muted small">龙虎榜净买 <b class="${cls(x.net)}">${x.net > 0 ? "+" : x.net < 0 ? "−" : ""}${wanTxt(x.net)}</b>　${aft}</div>
        ${ps.length ? `<div class="lhps">${ps.join("")}</div>` : `<div class="muted small">榜上前五没有知名游资、机构、北向、量化</div>`}</div>`;
    };
    const n3 = R.filter((x) => x.a && x.a[1] != null), up3 = n3.filter((x) => x.a[1] > 0).length;
    box.innerHTML = `<div class="muted small" style="margin-bottom:6px">近一年上榜 <b>${R.length}</b> 次${n3.length ? `，之后 3 天上涨 ${up3}/${n3.length} 次` : ""}（数据到 ${esc(B.date || "")}）。红＝买、绿＝卖，金额是榜上前五里这家的净额；游资名字可点进去看战绩。</div>
      ${R.slice(0, 10).map(row).join("")}
      ${R.length > 10 ? `<details class="lhmore"><summary>更早的 ${R.length - 10} 次</summary>${R.slice(10).map(row).join("")}</details>` : ""}
      <div class="muted small" style="margin-top:6px">龙虎榜只公布买卖前五的营业部，看不到没上榜的买卖；「之后3天」＝上榜日收盘到 3 个交易日后收盘。检验过：跟着知名游资第二天开盘买，平均没有优势（见学堂龙虎榜「跟游资有没有用」）。</div>`;
  }

  // ---------- 图表 ----------
  const mkOrGet = (el) => echarts.getInstanceByDom(el) || mk(el);
  const zoneArea = (zones, colorFn, labelFn, minLen) => ({ silent: true, data: zones.map((z) => [{ xAxis: z.d0, itemStyle: { color: colorFn(z) },
    label: { show: !!labelFn && (z.len || 99) >= (minLen || 0), position: "insideTop", formatter: labelFn ? labelFn(z) : "", color: z.s > 0 ? "#c0262d" : "#12804a", fontSize: 10 } }, { xAxis: z.d1 }]) });
  function drawK() {
    const el = $("#kc"); if (!el || !window.echarts) return;
    const old = echarts.getInstanceByDom(el); if (old) old.dispose();
    const C = A.chart, n = C.d.length, up = css("--up"), dn = css("--dn"), txt = css("--text");
    const on = (k) => $("#ov").querySelector(`[data-k="${k}"]`).classList.contains("on");
    const sub = $("#subs").querySelector("button.on").dataset.k;
    const L = (name, data, color, o = {}) => ({ name, type: "line", data, showSymbol: false, lineStyle: { width: o.w || 1.1, color, type: o.dash ? "dashed" : "solid" }, itemStyle: { color }, xAxisIndex: o.x || 0, yAxisIndex: o.x || 0, z: o.z || 2 });
    const S = [{ name: "K线", type: "candlestick", data: C.d.map((_, i) => [C.o[i], C.c[i], C.l[i], C.h[i]]), itemStyle: { color: up, color0: dn, borderColor: up, borderColor0: dn } }];
    const K = NT.k;
    if (on("ann") && K) {
      const idx = new Map(C.d.map((d, i) => [d, i]));
      S[0].markArea = zoneArea(K.zones.map((z) => ({ ...z, len: z.i1 - z.i0 + 1 })), (z) => (z.s > 0 ? "rgba(229,72,77,.08)" : "rgba(26,158,85,.09)"), (z) => z.label, 15);
      S[0].markPoint = { silent: true, data: K.marks.filter((m) => idx.has(m.d)).map((m) => ({ coord: [m.d, m.p], value: m.kind === "up" ? "▲突破" : "▼破位", symbol: "circle", symbolSize: 1,
        label: { show: true, formatter: m.kind === "up" ? "▲突破" : "▼破位", position: m.kind === "up" ? "top" : "bottom", distance: 4, color: m.kind === "up" ? "#c0262d" : "#12804a", fontSize: 10, fontWeight: 700 } })) };
      const ml = [];
      if (K.resist) ml.push({ yAxis: K.resist, lineStyle: { color: "#12804a", type: "dashed" }, label: { formatter: "压力 " + f(K.resist), position: "insideEndTop", color: "#12804a", fontSize: 10 } });
      if (K.support) ml.push({ yAxis: K.support, lineStyle: { color: "#c0262d", type: "dashed" }, label: { formatter: "支撑 " + f(K.support), position: "insideEndBottom", color: "#c0262d", fontSize: 10 } });
      if (ml.length) S[0].markLine = { silent: true, symbol: "none", data: ml };
    }
    if (on("ma")) [["ma5", "#999"], ["ma20", "#e8a317"], ["ma60", "#8b5cf6"], ["ma250", "#2f7fd8"]].forEach(([k, c]) => S.push(L(k.toUpperCase(), C[k], c)));
    if (on("boll")) { S.push(L("布林上轨", C.bu, "#8b5cf6", { dash: 1 })); S.push(L("布林中轨", C.bm, "#8b5cf6")); S.push(L("布林下轨", C.bl, "#8b5cf6", { dash: 1 })); }
    if (on("gmma") && C.gmma) {
      GS.forEach((m, i) => S.push({ ...L("顾比短组", C.gmma[m], `hsl(${8 + i * 7},85%,${52 + i * 2}%)`, { w: 0.9 }), id: "gm" + m }));
      GL.forEach((m, i) => S.push({ ...L("顾比长组", C.gmma[m], `hsl(${205 + i * 6},70%,${42 + i * 4}%)`, { w: 0.9 }), id: "gm" + m }));
    }
    if (on("ichi")) {
      const lo = C.ia.map((a, i) => (a == null || C.ib[i] == null ? null : Math.min(a, C.ib[i])));
      const th = C.ia.map((a, i) => (a == null || C.ib[i] == null ? null : Math.abs(a - C.ib[i])));
      const bull = C.ia.map((a, i) => a != null && C.ib[i] != null && a >= C.ib[i]);
      S.push({ name: "云底", type: "line", stack: "cloud", data: lo, showSymbol: false, lineStyle: { width: 0 }, tooltip: { show: false } });
      S.push({ name: "一目云", type: "line", stack: "cloud", data: th.map((v, i) => ({ value: v, itemStyle: { color: bull[i] ? "rgba(229,72,77,.25)" : "rgba(26,158,85,.25)" } })), showSymbol: false, lineStyle: { width: 0 }, areaStyle: { color: "rgba(150,150,150,.18)" } });
    }
    S.push({ id: "rg", name: "区间", type: "line", data: [], silent: true, tooltip: { show: false }, markArea: { silent: true, data: [] } });
    const X = { type: "category", data: C.d, axisLine: { lineStyle: { color: css("--line") } }, axisLabel: { color: css("--sub"), fontSize: 10 } };
    const s2 = [], sx = { x: 1 };
    let y2 = { type: "value", scale: true, gridIndex: 1, splitNumber: 2, ...ax(), axisLabel: { color: css("--sub"), fontSize: 10, formatter: (v) => (Math.abs(v) >= 1e8 ? +(v / 1e8).toFixed(1) + "亿" : Math.abs(v) >= 1e4 ? +(v / 1e4).toFixed(0) + "万" : v) } };
    const bar = (name, data, colorFn) => ({ name, type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: data.map((v, i) => (v == null ? null : { value: v, itemStyle: { color: colorFn(v, i) } })) });
    if (sub === "vol") s2.push(bar("成交量", C.v, (v, i) => (C.c[i] >= C.o[i] ? up : dn)), L("5日均量", C.vma5, "#e8a317", sx));
    if (sub === "macd") s2.push(bar("MACD柱", C.macd, (v) => (v >= 0 ? up : dn)), L("DIF", C.dif, txt, sx), L("DEA", C.dea, "#e8833a", sx));
    if (sub === "kdj") { s2.push(L("K", C.k, txt, sx), L("D", C.kd, "#e8833a", sx), L("J", C.j, "#8b5cf6", sx)); y2 = { ...y2, scale: false, min: -20, max: 120 }; }
    if (sub === "rsi") { s2.push({ ...L("RSI14", C.rsi, txt, sx), markLine: { silent: true, symbol: "none", data: [{ yAxis: 30 }, { yAxis: 70 }], lineStyle: { color: "#999", type: "dashed" } } }); y2 = { ...y2, scale: false, min: 0, max: 100 }; }
    if (sub === "obv") s2.push(L("OBV", C.obv, txt, sx), L("OBV 20日均线", C.obv_ma, "#e8833a", sx));
    if (sub === "ff") s2.push(bar("主力净流入(万元)", C.ff_main || [], (v) => (v >= 0 ? up : dn)));
    if (sub === "cmf") { s2.push({ ...L("CMF", C.cmf, txt, sx), markLine: { silent: true, symbol: "none", data: [{ yAxis: 0 }], lineStyle: { color: "#999" } } }); }
    if (sub === "adx") s2.push(L("ADX", C.adx, txt, sx), L("+DI", C.pdi, up, sx), L("−DI", C.ndi, dn, sx));
    if (MP) S.push(...mpSeries());
    if (on("sg")) S.push(...sgSeries());
    const kc = mk(el);
    kc.on("click", (p) => { if (p.data && p.data.ref) mpPop(p.data.ref); });
    kc.setOption({
      animation: false, tooltip: { trigger: "axis", axisPointer: { type: "cross" }, confine: true, formatter: kTip },
      legend: { type: "scroll", top: 0, textStyle: { color: css("--sub"), fontSize: 11 }, data: [...new Set(S.concat(s2).map((s) => s.name))].filter((x) => x !== "云底" && x !== "区间" && !/ (买|卖)$/.test(x)) },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [{ left: 50, right: 12, top: 34, height: "55%" }, { left: 50, right: 12, top: "71%", height: "17%" }],
      xAxis: [{ ...X, axisLabel: { show: false } }, { ...X, gridIndex: 1 }], yAxis: [{ type: "value", scale: true, ...ax() }, y2],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1], startValue: Math.max(0, n - 120), endValue: n - 1 }, { type: "slider", xAxisIndex: [0, 1], startValue: Math.max(0, n - 120), endValue: n - 1, height: 16, bottom: 4 }],
      series: S.concat(s2),
    });
    rangeBind(kc);
  }
  // ---------- 买卖点标注：「我的规则」（自己组合条件）+ market-pulse 的 12 套预置规则 ----------
  // 2026-11-20 老大：「做成自己筛选的规则，然后标的时候标清楚买还是卖，然后级别」。
  // 信号判定全部复用 static/mp_rules.js（与每日扫描 mp_scan.py 同一算法）的 compute / entrySignals / exitSignals / assess / simulate，
  // 这里只做：组合、按级别筛选、合并同一根 K 线上的标记、画图和弹层。
  const MPC = ["#e5484d", "#f76b15", "#c99a06", "#8b5cf6", "#2f7fd8", "#0e9f9a", "#db2777", "#65a30d", "#6d28d9", "#0284c7", "#b45309", "#9f1239"];
  const MYC = ["#111827", "#0f766e", "#4338ca", "#a21caf", "#9a3412", "#15803d", "#475569", "#be123c"];
  const MPS = { pass: ["✅ 通过检验", "mp-pass"], fail: ["未通过检验，仅参考", "mp-fail"], insufficient: ["样本不足，仅参考", "mp-ins"] };
  const MPOOL = { big: "A股大盘（点时市值前1000）", small: "A股中小盘", us: "美股（标普500+纳指100）" };
  const GR = { S: 4, A: 3, B: 2, C: 1 };
  const GCOL = { S: "#9f1239", A: "#e5484d", B: "#e07b00", C: "#8a9099" };
  const LVN = [[0, "全部"], [2, "B 及以上"], [3, "A 及以上"], [4, "只要 S"]];
  const lvName = (v) => (LVN.find((x) => x[0] === v) || LVN[0])[1];
  const XR = (r) => (/止损/.test(r) ? "止损" : /止盈/.test(r) ? "止盈" : /到期/.test(r) ? "到期" : "指标");
  const XCOL = { 止盈: "#c0262d", 止损: "#12804a", 到期: "#8a9099", 指标: "#6b7280", 多种: "#6b7280" };
  const XKEY = { 止盈: "tp", 止损: "sl", 到期: "ex", 指标: "ind", 多种: "ind" };
  let MP = null;
  const metaP = {};
  const mpMeta = (m) => metaP[m] || (metaP[m] = fetch(`mp_meta_${m}.json?d=${new Date().toISOString().slice(0, 13)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const isMy = (k) => k.startsWith("my:");
  const myIdx = (k) => MP.my.findIndex((r) => "my:" + r.id === k);
  const mpName = (k) => (isMy(k) ? (MP.my[myIdx(k)] || {}).name || "我的规则" : window.MPRules.RULES[k][0]);
  const mpColor = (k) => (isMy(k) ? MYC[Math.max(0, myIdx(k)) % MYC.length] : MPC[window.MPRules.ORDER.indexOf(k)]);
  // 2026-11-20 老大：「为什么买卖点不标出来 我想看」→ 默认要有标记；随后「太多看不清」→ 预置规则默认只标「系统综合判断」一条（有通过检验的就标通过的），
  // 主角是上面的「我的规则」；用户点过的选择记在 mp_sel_v1
  const MPSEL_KEY = "mp_sel_v1", MYR_KEY = "mp_myrules_v1", MPLV_KEY = "mp_lv_v1";
  function mpDefaultSel(keys, vmap) {
    try { const v = JSON.parse(localStorage.getItem(MPSEL_KEY) || "null");
      if (v === "all") return new Set(keys); if (v === "pass") return new Set(keys.filter((k) => vmap[k] === "pass"));
      if (Array.isArray(v)) return new Set(keys.filter((k) => v.includes(k))); } catch (e) {}
    const ok = keys.filter((k) => vmap[k] === "pass");
    return new Set(ok.length ? ok : keys.includes("mp_auto") ? ["mp_auto"] : []);
  }
  const mpSave = (v) => { try { localStorage.setItem(MPSEL_KEY, JSON.stringify(v)); } catch (e) {} };
  // ---- 我的规则：存 localStorage（mp_myrules_v1） ----
  const myBlank = () => ({ id: "", name: "", on: true, sig: [], match: "all", cond: {}, lv: 0, stop: 3, take: 6, hold: 10, exit: "rule" });
  const MYSEED = [ // 示例：S 级要求趋势/动量/量能/盈亏比/位置五项几乎满分，单只股票几年里常常一次都没有，所以示例用「A 级以上」
    { id: "ex1", name: "MACD+KDJ 共振 · A级以上", sig: ["mp_macd"], cond: { kd: "up" }, lv: 3 },
    { id: "ex2", name: "放量突破 · A级以上", sig: ["mp_breakout"], cond: {}, lv: 3 },
  ];
  const clampN = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  function myNorm(r) { // localStorage 是用户可改的：逐项校验
    const o = { ...myBlank(), ...r }, c = r.cond || {}, M = window.MPRules, cc = {};
    o.id = String(o.id).slice(0, 24); o.name = String(o.name || "").slice(0, 30); o.on = o.on !== false;
    o.sig = (Array.isArray(o.sig) ? o.sig : []).filter((k) => M.RULES[k] && k !== "mp_auto");
    o.match = o.match === "any" ? "any" : "all"; o.lv = [0, 2, 3, 4].includes(+o.lv) ? +o.lv : 0;
    o.stop = clampN(o.stop, 0.5, 30, 3); o.take = clampN(o.take, 0.5, 100, 6); o.hold = Math.round(clampN(o.hold, 1, 120, 10));
    o.exit = ["none", "rule", "ma20"].includes(o.exit) ? o.exit : "rule";
    for (const k of ["ma20", "ma60", "kd"]) if (c[k] === "up" || c[k] === "dn") cc[k] = c[k];
    if (c.macd === "pos" || c.macd === "neg") cc.macd = c.macd;
    if (Array.isArray(c.rsi)) cc.rsi = [clampN(c.rsi[0], 0, 100, 0), clampN(c.rsi[1], 0, 100, 100)];
    if (Array.isArray(c.j)) cc.j = [clampN(c.j[0], -100, 200, -100), clampN(c.j[1], -100, 200, 200)];
    if (c.vr != null) cc.vr = clampN(c.vr, 0.1, 20, 1.5);
    if (Array.isArray(c.chg)) cc.chg = [Math.round(clampN(c.chg[0], 1, 250, 5)), clampN(c.chg[1], -100, 1000, -100), clampN(c.chg[2], -100, 1000, 1000)];
    o.cond = cc; return o;
  }
  function myLoad() {
    try { const v = JSON.parse(localStorage.getItem(MYR_KEY) || "null"); if (Array.isArray(v)) return v.filter((r) => r && r.id).slice(0, 30).map(myNorm); } catch (e) {}
    return MYSEED.map(myNorm);
  }
  const mySave = () => { try { localStorage.setItem(MYR_KEY, JSON.stringify(MP.my)); } catch (e) {} };
  const SIGN = (k) => window.MPRules.RULES[k][0];
  function myDesc(r) { // 一句话描述：买什么、卖什么
    const c = r.cond, cs = [];
    const sd = { up: "上方", dn: "下方" };
    if (c.ma20) cs.push(`收盘在 MA20 ${sd[c.ma20]}`);
    if (c.ma60) cs.push(`收盘在 MA60 ${sd[c.ma60]}`);
    if (c.macd) cs.push(c.macd === "pos" ? "MACD 柱 >0" : "MACD 柱 <0");
    if (c.kd) cs.push(c.kd === "up" ? "KDJ 的 K 在 D 上方" : "KDJ 的 K 在 D 下方");
    if (c.rsi) cs.push(`RSI14 在 ${c.rsi[0]}~${c.rsi[1]}`);
    if (c.j) cs.push(`J 在 ${c.j[0]}~${c.j[1]}`);
    if (c.vr != null) cs.push(`量比 ≥${c.vr}`);
    if (c.chg) cs.push(`近 ${c.chg[0]} 日涨跌幅 ${c.chg[1]}%~${c.chg[2]}%`);
    const sg = r.sig.map(SIGN).join(r.match === "all" ? " 且 " : " 或 ");
    let buy = r.sig.length ? (r.sig.length > 1 ? `${sg}（${r.match === "all" ? "同一天都出现" : "任一出现"}）` : sg) : (cs.length ? "条件刚全部成立的那天" : "（还没选条件）");
    if (cs.length) buy += (r.sig.length ? "，且 " : "：") + cs.join("、");
    buy += r.lv ? `；只要 ${lvName(r.lv)}` : "；不限级别";
    let sell = `止损 ${r.stop}%、止盈 ${r.take}%、最长 ${r.hold} 根`;
    if (r.exit === "rule" && r.sig.length) sell += "；或所选信号自己的卖点（出现后次日开盘卖）";
    if (r.exit === "ma20") sell += "；或收盘跌破 MA20（次日开盘卖）";
    return { buy, sell };
  }
  function myCondFns(c) {
    const B = MP.B, I = B.I, C = MP.K.c, V = MP.K.v, fs = [], fin = Number.isFinite;
    const side = (a, w) => (w === "up" ? (t) => fin(a[t]) && C[t] > a[t] : (t) => fin(a[t]) && C[t] < a[t]);
    if (c.ma20) fs.push(side(I.ma20, c.ma20));
    if (c.ma60) fs.push(side(I.ma60, c.ma60));
    if (c.macd) fs.push(c.macd === "pos" ? (t) => t >= 34 && I.macd[t] > 0 : (t) => t >= 34 && I.macd[t] < 0);
    if (c.kd) fs.push(c.kd === "up" ? (t) => I.k[t] > I.d[t] : (t) => I.k[t] < I.d[t]);
    if (c.rsi) fs.push((t) => I.rsi[t] >= c.rsi[0] && I.rsi[t] <= c.rsi[1]);
    if (c.j) fs.push((t) => I.j[t] >= c.j[0] && I.j[t] <= c.j[1]);
    if (c.vr != null) fs.push((t) => { if (t < 20) return false; let s = 0; for (let q = t - 20; q < t; q++) s += V[q]; return s > 0 && V[t] > 0 && V[t] / (s / 20) >= c.vr; });
    if (c.chg) fs.push((t) => { const N = c.chg[0]; if (t < N || !(C[t - N] > 0)) return false; const p = (C[t] / C[t - N] - 1) * 100; return p >= c.chg[1] && p <= c.chg[2]; });
    return fs;
  }
  function mpRun(sig, sl, gr, ex, plans) { // 与 analyze() 相同的成交与「明天该卖」判定
    const M = window.MPRules, K = MP.K, n = K.c.length;
    const [trades, pos] = M.simulate(K.o, K.h, K.l, K.c, K.v, sig, ex, plans, A.sym, MP.cnm);
    let exitNext = null;
    if (pos !== null) { const last = n - 1; if (ex && ex[last]) exitNext = "指标退出"; else if (last + 1 - pos[1] >= pos[5]) exitNext = "持有到期"; }
    return { sig: sl, grade: gr, trades, open: pos, exit_next: exitNext, plans };
  }
  function mpPreset(k) { // 预置规则按全局级别筛选：低于级别的信号去掉后重新模拟成交
    const R = MP.res[k], lv = MP.lv; if (!lv) return R;
    const ck = k + "|" + lv; if (MP.cache[ck]) return MP.cache[ck];
    const n = MP.K.c.length, sig = new Array(n).fill(false), sl = [], gr = {};
    for (const t of R.sig) { const g = R.grade[t]; if (g && GR[g[0]] >= lv) { sig[t] = true; sl.push(t); gr[t] = g; } }
    let ex = MP.B.X[k];
    if (k === "mp_auto") { const K = MP.K; MP.B.ax = MP.B.ax || window.MPRules.autoSignals(K.o, K.h, K.l, K.c, K.v)[1]; ex = MP.B.ax; }
    return (MP.cache[ck] = mpRun(sig, sl, gr, ex, R.plans));
  }
  function mpCustom(r) {
    const M = window.MPRules, K = MP.K, B = MP.B, n = K.c.length, I = B.I;
    const keys = r.sig.filter((k) => B.S[k] && (!M.RULES[k][4] || MP.cnm));
    if (r.sig.length && !keys.length) return null; // 例：只选了「弱转强」但这是美股
    const fs = myCondFns(r.cond), lv = Math.max(r.lv, MP.lv);
    if (!keys.length && !fs.length) return null;
    const cok = (t) => fs.every((fn) => fn(t));
    const sig = new Array(n).fill(false), sl = [], gr = {};
    let prev = false;
    for (let t = 21; t < n; t++) {
      let hit;
      if (keys.length) {
        hit = keys.filter((k) => B.S[k][t]);
        if (!(r.match === "all" ? hit.length === keys.length : hit.length > 0) || !cok(t)) continue;
      } else { const now = cok(t), was = prev; prev = now; if (!now || was) continue; hit = []; } // 只有条件：条件「刚成立」那天算信号
      // 级别：每个同时出现的信号各用 assess() 打分，取最高分那个；只有条件没有信号时按通用口径打一次分
      let g = null;
      for (const k of hit.length ? hit : ["custom"]) { const x = M.assess(K.o, K.h, K.l, K.c, K.v, I, t, k, A.sym, MP.cnm); if (!g || x[1] > g[1]) g = x; }
      if (GR[g[0]] < lv) continue;
      sig[t] = true; sl.push(t); gr[t] = g;
    }
    let ex = null;
    if (r.exit === "rule" && keys.length) { ex = new Array(n).fill(false); for (let t = 0; t < n; t++) ex[t] = keys.some((k) => B.X[k][t]); }
    else if (r.exit === "ma20") { ex = new Array(n).fill(false); const m = I.ma20, C = K.c; for (let t = 1; t < n; t++) ex[t] = Number.isFinite(m[t - 1]) && Number.isFinite(m[t]) && C[t - 1] >= m[t - 1] && C[t] < m[t]; }
    return mpRun(sig, sl, gr, ex, new Array(n).fill([r.stop, r.take, r.hold]));
  }
  function mpCalc() { // 当前要显示/上表的每条规则的结果
    MP.cur = {};
    if (!MP.B) return;
    for (const r of MP.my) { const R = mpCustom(r); if (R) MP.cur["my:" + r.id] = R; }
    for (const k of MP.keys) MP.cur[k] = mpPreset(k);
  }
  function mpInit(a, meta, m) {
    const M = window.MPRules; if (!M) return null;
    const K = a.kfull || a.chart, cnm = m === "cn";
    const res = M.analyze(a.sym, K, cnm);
    let pool = null;
    if (meta) pool = m === "us" ? "us" : m === "cn" ? (((a.quote || {}).total_cap || 0) >= (meta.cap_cut || 0) ? "big" : "small") : null;
    const vmap = {}, mrow = {};
    if (meta && pool) for (const r of meta.rules) { vmap[r.key] = r.valid[pool]; mrow[r.key] = r.all[pool]; }
    const keys = M.ORDER.filter((k) => res[k]);
    let B = null;
    if (K.c.length >= 30) { const I = M.compute(K.o, K.h, K.l, K.c, K.v); B = { I, S: M.entrySignals(K.o, K.h, K.l, K.c, K.v, I, cnm), X: M.exitSignals(K.o, K.h, K.l, K.c, K.v, I, cnm), ax: null }; }
    let lv = 0; try { lv = +localStorage.getItem(MPLV_KEY) || 0; } catch (e) {}
    if (![0, 2, 3, 4].includes(lv)) lv = 0;
    return { K, res, meta, pool, vmap, mrow, keys, sel: mpDefaultSel(keys, vmap), di: new Map(a.chart.d.map((d, i) => [d, i])), m, cnm, B, lv, my: myLoad(), cache: {}, cur: {}, marks: { b: new Map(), s: new Map() } };
  }
  const mpVisible = () => [...MP.my.filter((r) => r.on).map((r) => "my:" + r.id), ...MP.keys.filter((k) => MP.sel.has(k))].filter((k) => MP.cur[k]);
  // 图上标记：同一根 K 线上所有规则的买点合并成一个 ▲（标签＝买+最高级别+×N），卖点合并成一个 ▼（标签＝卖·原因）
  const fade = (h) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},.45)`;
  const MPRICH = (() => {
    const r = { t: { color: "#1f2328", fontSize: 10, fontWeight: 700 }, td: { color: "#9aa1ab", fontSize: 10, fontWeight: 700 }, n: { color: "#6b7280", fontSize: 9 } };
    for (const g of "SABC") { r["g" + g] = { color: GCOL[g], fontSize: 11, fontWeight: 800 }; r["g" + g + "d"] = { color: fade(GCOL[g]), fontSize: 11, fontWeight: 800 }; }
    for (const x of Object.keys(XKEY)) r["x" + XKEY[x]] = { color: XCOL[x], fontSize: 10, fontWeight: 700 };
    return r;
  })();
  function mpSeries() {
    const K = MP.K, n = K.d.length, bm = new Map(), sm = new Map();
    const push = (m, i, x) => { if (!m.has(i)) m.set(i, []); m.get(i).push(x); };
    for (const k of mpVisible()) {
      const R = MP.cur[k], bySig = new Set(R.trades.map((t) => t[0])), openSig = R.open ? R.open[0] : -1;
      for (const t of R.sig) if (MP.di.has(K.d[t])) push(bm, t, { k, t, g: R.grade[t] || ["C", 0], live: bySig.has(t) || t === openSig || t === n - 1 });
      for (const tr of R.trades) if (MP.di.has(K.d[tr[2]])) push(sm, tr[2], { k, t: tr[0], tr, r: XR(tr[6]) });
    }
    for (const xs of bm.values()) xs.sort((a, b) => b.g[1] - a.g[1] || b.live - a.live);
    MP.marks = { b: bm, s: sm };
    const SZ = { S: 16, A: 13, B: 11, C: 10 }; // 级别越高三角越大（重叠时也优先显示高级别的标签）
    const buys = [...bm.entries()].map(([t, xs]) => {
      const top = xs[0], g = top.g[0], live = xs.some((x) => x.live);
      return { value: [K.d[t], K.l[t] * 0.982], ref: { b: t }, symbolSize: SZ[g], itemStyle: { color: mpColor(top.k), opacity: live ? 1 : 0.35, borderColor: "#fff", borderWidth: 0.8 },
        label: { formatter: `{${live ? "t" : "td"}|买}{g${g}${live ? "" : "d"}|${g}}${xs.length > 1 ? `{n|×${xs.length}}` : ""}` } };
    });
    const sells = [...sm.entries()].map(([i, xs]) => {
      const rs = [...new Set(xs.map((x) => x.r))], r = rs.length === 1 ? rs[0] : "多种";
      return { value: [K.d[i], K.h[i] * 1.018], ref: { s: i }, itemStyle: { color: XCOL[r], borderColor: "#fff", borderWidth: 0.8 },
        label: { formatter: `{x${XKEY[r]}|卖${r === "多种" ? "" : "·" + r}}${xs.length > 1 ? `{n|×${xs.length}}` : ""}` } };
    });
    const lab = (pos) => ({ show: true, position: pos, distance: 3, rich: MPRICH, backgroundColor: "rgba(255,255,255,.85)", borderRadius: 3, padding: [1, 2] });
    return [
      { id: "mpb", name: "规则 买", type: "scatter", symbol: "triangle", z: 6, data: buys, tooltip: { show: false }, cursor: "pointer", label: lab("bottom"), labelLayout: { hideOverlap: true } },
      { id: "mpx", name: "规则 卖", type: "scatter", symbol: "triangle", symbolRotate: 180, symbolSize: 10, z: 6, data: sells, tooltip: { show: false }, cursor: "pointer", label: lab("top"), labelLayout: { hideOverlap: true } },
    ];
  }
  const mpPx = (v) => f(v, v > 100 ? 2 : 3);
  const mpRD = (k) => { if (!isMy(k)) return window.MPRules.RULES[k]; const r = MP.my[myIdx(k)], d = myDesc(r); return [r.name, d.buy, d.sell]; };
  const mpTag = (k) => (isMy(k) ? '<span class="tag mp-mytag">我的规则 · 只在这只股票上回测</span>' : MP.vmap[k] ? `<span class="tag ${MPS[MP.vmap[k]][1]}">${MPS[MP.vmap[k]][0]}</span>` : "");
  const gTxt = (g) => `<b class="mp-g" style="color:${GCOL[g[0]]}">${g[0]} 级</b>（${g[1]} 分）`;
  function mpBuyItem(x, many) {
    const K = MP.K, n = K.d.length, k = x.k, t = x.t, R = MP.cur[k], RD = mpRD(k);
    const tr = R.trades.find((y) => y[0] === t), op = R.open && R.open[0] === t ? R.open : null;
    const plan = R.plans[t] || window.MPRules.FIXED;
    const row = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    let body = "";
    if (tr || op) {
      const e = tr ? tr[3] : op[2], ei = tr ? tr[1] : op[1];
      body += `<div class="kv mp-kv">${row("次日开盘入场", `${mpPx(e)}<span class="note">${K.d[ei]}（含滑点）</span>`)}${row("保护价（止损）", `${mpPx(e * (1 - plan[0] / 100))}<span class="note">−${f(plan[0], 2)}%</span>`)}
        ${row("止盈", `${mpPx(e * (1 + plan[1] / 100))}<span class="note">+${f(plan[1], 2)}%</span>`)}${row("最长持有", `${plan[2]} 根日K`)}</div>`;
      if (tr) body += `<div class="mp-res ${cls(tr[5])}">样本内回测：<b>${K.d[tr[2]]}</b> 卖出（${esc(tr[6])}），出场 ${mpPx(tr[4])}，持有 ${tr[2] - tr[1]} 根，扣成本后 <b>${pct(tr[5] * 100)}</b></div>`;
      else body += `<div class="mp-res ${cls(K.c[n - 1] / op[2] - 1)}">仍持有：按最新收盘 ${mpPx(K.c[n - 1])} 浮动 <b>${pct((K.c[n - 1] / op[2] - 1) * 100)}</b>${R.exit_next ? `；<b>明天开盘按计划卖出（${esc(R.exit_next)}）</b>` : ""}</div>`;
    } else if (t === n - 1) {
      body += `<div class="kv mp-kv">${row("参考价（今收）", mpPx(K.c[t]))}${row("参考止损", `${mpPx(K.c[t] * (1 - plan[0] / 100))}<span class="note">−${f(plan[0], 2)}%</span>`)}${row("参考止盈", `${mpPx(K.c[t] * (1 + plan[1] / 100))}<span class="note">+${f(plan[1], 2)}%</span>`)}${row("最长持有", `${plan[2]} 根日K`)}</div>
        <div class="mp-res">今天收盘刚出现：按规则是<b>下一个交易日开盘</b>买入，保护价按实际买价重算${MP.cnm ? "；开盘涨停就不买" : ""}。</div>`;
    } else {
      const ni = t + 1, held = R.trades.some((y) => y[1] < ni && y[2] >= ni) || (R.open && R.open[1] < ni);
      const why = held ? "当时已经按这条规则持有（或当天刚卖出），这次信号不重复买" : MP.cnm && K.o[ni] >= K.c[t] * (1 + (/^(sh68|sz30)/.test(A.sym) ? 0.2 : 0.1)) * 0.998 ? "次日开盘涨停，买不进" : K.v[ni] <= 0 ? "次日停牌" : "没有成交";
      body += `<div class="mp-res">这次信号没有成交（图上淡色）：${why}。</div>`;
    }
    const exitTxt = isMy(k) ? RD[2] : `${String(RD[2]).replace(/。$/, "")}；另有止损、止盈、最长持有期`;
    return `<div class="mp-item"><div class="mp-it"><i style="background:${mpColor(k)}"></i><b>${esc(RD[0])}</b>${mpTag(k)}</div>
      ${many ? `<div class="small">这条规则的级别：${gTxt(x.g)}</div>` : ""}
      <div class="mp-cond">📥 买入条件：${esc(RD[1])}</div>${body}
      <div class="mp-cond">📤 卖出：${esc(exitTxt)}，先到先走（同一天同时碰到止损止盈按止损）。</div></div>`;
  }
  function mpSellItem(x) {
    const K = MP.K, k = x.k, tr = x.tr, RD = mpRD(k);
    return `<div class="mp-item"><div class="mp-it"><i style="background:${mpColor(k)}"></i><b>${esc(RD[0])}</b>${mpTag(k)}</div>
      <div class="kv mp-kv"><div><span>买入</span><b>${mpPx(tr[3])}<span class="note">${K.d[tr[1]]} 开盘（信号日 ${K.d[tr[0]]}${MP.cur[k].grade[tr[0]] ? " · " + MP.cur[k].grade[tr[0]][0] + " 级" : ""}）</span></b></div>
        <div><span>卖出</span><b>${mpPx(tr[4])}<span class="note">${K.d[tr[2]]}（${esc(tr[6])}）</span></b></div>
        <div><span>持有</span><b>${tr[2] - tr[1]} 根日K</b></div><div><span>这笔扣成本后</span><b class="${cls(tr[5])}">${pct(tr[5] * 100)}</b></div></div>
      <div class="mp-cond">📤 卖出规则：${esc(isMy(k) ? RD[2] : String(RD[2]).replace(/。$/, "") + "；另有止损、止盈、最长持有期")}</div></div>`;
  }
  function mpPop(ref) {
    const K = MP.K, buy = ref.b != null, i = buy ? ref.b : ref.s, xs = (buy ? MP.marks.b : MP.marks.s).get(i);
    if (!xs || !xs.length) return;
    let head, items;
    if (buy) {
      const g = xs[0].g;
      head = `<div class="mp-big">买入信号${xs.length > 1 ? ` <span class="mp-n">×${xs.length}</span>` : ""} · ${xs.length > 1 ? "最高 " : ""}${gTxt(g)}</div>
        <div class="muted small">信号日 <b>${K.d[i]}</b>（收盘 ${mpPx(K.c[i])}）${xs.length > 1 ? `｜同一天 ${xs.length} 条规则出信号，按级别从高到低列出` : ""}</div>
        <div class="mp-gnote">级别是技术条件打分（趋势、动量、量能、盈亏比、离均线远近），<b>不是胜率</b>；全市场检验里 S/A/B/C 各级扣成本后平均都跑输同池，级别高不等于能赚钱。</div>`;
      items = xs.map((x) => mpBuyItem(x, xs.length > 1)).join("");
    } else {
      const rs = [...new Set(xs.map((x) => x.r))], r = rs.length === 1 ? rs[0] : rs.join(" / ");
      head = `<div class="mp-big">卖出${xs.length > 1 ? ` <span class="mp-n">×${xs.length}</span>` : ""} · <b style="color:${XCOL[rs.length === 1 ? rs[0] : "多种"]}">${esc(r)}</b></div>
        <div class="muted small">卖出日 <b>${K.d[i]}</b>（开盘 ${mpPx(K.o[i])}）｜止盈＝赚钱走（红）、止损＝亏钱走（绿）、到期＝持有满规定根数、指标＝出现卖出信号后次日开盘卖</div>`;
      items = xs.map(mpSellItem).join("");
    }
    const html = `<div class="mp-pop-in" role="dialog" aria-label="买卖点详情"><button class="mp-x" aria-label="关闭">×</button>${head}${items}
      <div class="muted small">样本内回测＝用这只股票近 ${K.d.length} 根日K、同一套规则事后复盘，下一根开盘成交、${MP.cnm ? "T+1、开盘涨停不买/跌停不卖、佣金万2.5双边+印花税0.05%+滑点0.1%" : "滑点0.05%"}；不代表以后。</div></div>`;
    mpOverlay(html);
  }
  function mpOverlay(html) {
    let el = $("#mppop");
    if (!el) { el = document.createElement("div"); el.id = "mppop"; el.className = "mp-pop"; document.body.appendChild(el); el.addEventListener("click", (e) => { if (e.target === el || e.target.closest(".mp-x")) mpClose(); }); }
    el.innerHTML = html; el.style.display = "flex"; document.body.classList.add("mp-lock");
    return el;
  }
  const mpClose = () => { const el = $("#mppop"); if (el) el.style.display = "none"; document.body.classList.remove("mp-lock"); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") mpClose(); });
  // ---- 规则编辑器（电脑居中弹窗，手机底部弹出面板） ----
  function mpEdit(id, dup) {
    const M = window.MPRules, src = id ? MP.my.find((r) => r.id === id) : null;
    const r = src ? myNorm({ ...src, cond: { ...src.cond } }) : myNorm({ ...myBlank(), id: "n" });
    if (dup) r.name = (r.name + " 副本").slice(0, 30);
    const c = r.cond, sigs = M.ORDER.filter((k) => k !== "mp_auto" && (!M.RULES[k][4] || MP.cnm));
    const sel3 = (id_, v, opts) => `<select id="${id_}">${opts.map(([a, b]) => `<option value="${a}" ${v === a ? "selected" : ""}>${b}</option>`).join("")}</select>`;
    const num = (id_, v, st, w) => `<input id="${id_}" type="number" inputmode="decimal" step="${st}" value="${v}" style="width:${w || 64}px">`;
    const seg = (id_, opts, v) => `<div class="mp-seg" id="${id_}">${opts.map(([a, b]) => `<button type="button" data-v="${a}" class="${String(v) === String(a) ? "on" : ""}">${b}</button>`).join("")}</div>`;
    const ud = [["", "不限"], ["up", "在上方"], ["dn", "在下方"]];
    const html = `<div class="mp-pop-in mp-ed" role="dialog" aria-label="编辑规则"><button class="mp-x" aria-label="关闭">×</button>
      <div class="mp-big">${src && !dup ? "编辑规则" : "新建规则"}</div>
      <label class="mp-f"><span class="mp-fl">名称</span><input id="ed_name" maxlength="30" placeholder="不填就按条件自动起名" value="${esc(dup || src ? r.name : "")}"></label>
      <div class="mp-f"><span class="mp-fl">① 买入信号 <em>可多选；不选＝只用 ② 的条件（条件刚全部成立那天买）</em></span>
        <div class="mp-chips">${sigs.map((k) => `<label class="mp-ck"><input type="checkbox" name="ed_sig" value="${k}" ${r.sig.includes(k) ? "checked" : ""}>${esc(M.RULES[k][0])}</label>`).join("")}</div>
        ${seg("ed_match", [["all", "全部满足（同一天都出现）"], ["any", "任一满足"]], r.match)}</div>
      <div class="mp-f"><span class="mp-fl">② 附加条件 <em>勾了的都要满足</em></span><div class="mp-cg">
        <label>收盘 vs MA20 ${sel3("ed_ma20", c.ma20 || "", ud)}</label><label>收盘 vs MA60 ${sel3("ed_ma60", c.ma60 || "", ud)}</label>
        <label>MACD 柱 ${sel3("ed_macd", c.macd || "", [["", "不限"], ["pos", ">0（红柱）"], ["neg", "<0（绿柱）"]])}</label>
        <label>KDJ ${sel3("ed_kd", c.kd || "", [["", "不限"], ["up", "K 在 D 上方"], ["dn", "K 在 D 下方"]])}</label>
        <div class="mp-rg"><label><input type="checkbox" id="ed_rsi_on" ${c.rsi ? "checked" : ""}>RSI14 在</label>${num("ed_rsi_lo", c.rsi ? c.rsi[0] : 40, 1, 56)}~${num("ed_rsi_hi", c.rsi ? c.rsi[1] : 70, 1, 56)}</div>
        <div class="mp-rg"><label><input type="checkbox" id="ed_j_on" ${c.j ? "checked" : ""}>KDJ 的 J 在</label>${num("ed_j_lo", c.j ? c.j[0] : 0, 1, 56)}~${num("ed_j_hi", c.j ? c.j[1] : 50, 1, 56)}</div>
        <div class="mp-rg"><label><input type="checkbox" id="ed_vr_on" ${c.vr != null ? "checked" : ""}>量比 ≥</label>${num("ed_vr", c.vr != null ? c.vr : 1.5, 0.1, 56)}倍<em>（对前 20 日均量）</em></div>
        <div class="mp-rg"><label><input type="checkbox" id="ed_chg_on" ${c.chg ? "checked" : ""}>近</label>${num("ed_chg_n", c.chg ? c.chg[0] : 5, 1, 50)}日涨跌幅在${num("ed_chg_lo", c.chg ? c.chg[1] : -10, 1, 56)}%~${num("ed_chg_hi", c.chg ? c.chg[2] : 10, 1, 56)}%</div>
      </div></div>
      <div class="mp-f"><span class="mp-fl">③ 最低级别 <em>低于这个级别的信号不买、不标</em></span>${seg("ed_lv", LVN.map(([a, b]) => [a, b]), r.lv)}</div>
      <div class="mp-f"><span class="mp-fl">④ 怎么卖 <em>先到先走</em></span><div class="mp-cg">
        <label>止损 ${num("ed_stop", r.stop, 0.5)}%</label><label>止盈 ${num("ed_take", r.take, 0.5)}%</label><label>最长持有 ${num("ed_hold", r.hold, 1)}根</label>
        <label class="mp-wide">指标卖点 ${sel3("ed_exit", r.exit, [["none", "不用（只按止损/止盈/持有期）"], ["rule", "所选信号自己的卖点"], ["ma20", "收盘跌破 MA20"]])}</label></div></div>
      <div id="ed_prev" class="mp-prev"></div>
      <div class="mp-ed-a"><button type="button" class="mp-go" id="ed_save">保存并标到 K 线</button><button type="button" class="mp-btn2" id="ed_cancel">取消</button></div></div>`;
    const el = mpOverlay(html), box = el.querySelector(".mp-ed");
    const V = (s) => box.querySelector(s);
    box.querySelectorAll(".mp-seg").forEach((sg) => sg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; sg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); prev(); }));
    const read = () => {
      const segv = (s) => (V(s + " button.on") || {}).dataset.v;
      const o = { ...r, name: V("#ed_name").value.trim(), sig: [...box.querySelectorAll('input[name="ed_sig"]:checked')].map((x) => x.value), match: segv("#ed_match") || "all", lv: +segv("#ed_lv") || 0,
        stop: V("#ed_stop").value, take: V("#ed_take").value, hold: V("#ed_hold").value, exit: V("#ed_exit").value, cond: {} };
      for (const k of ["ma20", "ma60", "macd", "kd"]) if (V("#ed_" + k).value) o.cond[k] = V("#ed_" + k).value;
      if (V("#ed_rsi_on").checked) o.cond.rsi = [V("#ed_rsi_lo").value, V("#ed_rsi_hi").value];
      if (V("#ed_j_on").checked) o.cond.j = [V("#ed_j_lo").value, V("#ed_j_hi").value];
      if (V("#ed_vr_on").checked) o.cond.vr = V("#ed_vr").value;
      if (V("#ed_chg_on").checked) o.cond.chg = [V("#ed_chg_n").value, V("#ed_chg_lo").value, V("#ed_chg_hi").value];
      const x = myNorm(o);
      for (const k of ["rsi", "j"]) if (x.cond[k] && x.cond[k][0] > x.cond[k][1]) x.cond[k].reverse();
      if (x.cond.chg && x.cond.chg[1] > x.cond.chg[2]) x.cond.chg = [x.cond.chg[0], x.cond.chg[2], x.cond.chg[1]];
      return x;
    };
    const autoName = (x) => (x.sig.length ? x.sig.map((k) => M.RULES[k][5] === "M" ? "MACD" : SIGN(k).replace(/\(.*\)/, "")).join(x.match === "all" ? "+" : "/") : "条件") + (x.lv ? ` · ${lvName(x.lv).replace(" 及以上", "+").replace("只要 ", "")}级` : "");
    function prev() {
      const x = read(), pv = V("#ed_prev"), t0 = performance.now();
      if (!x.sig.length && !Object.keys(x.cond).length) { pv.innerHTML = "先选至少一个买入信号或附加条件。"; return; }
      const save = MP.my; MP.my = [x]; const R = mpCustom(x); MP.my = save;
      const ms = performance.now() - t0;
      if (!R) { pv.innerHTML = "所选信号在这个市场不可用（「弱转强」只限 A股）。"; return; }
      const P = window.MPRules.perf(R.trades, MP.K.c, 0);
      pv.innerHTML = `在这只股票近 ${MP.K.c.length} 根日K上：<b>${R.sig.length}</b> 个买入信号、成交 <b>${P.n}</b> 笔，胜率 ${P.win == null ? "—" : f(P.win, 0) + "%"}，平均每笔 <b class="${cls(P.avg)}">${P.avg == null ? "—" : pct(P.avg, 2)}</b>，累计 <b class="${cls(P.cum)}">${pct(P.cum, 1)}</b>，最大回撤 ${pct(P.mdd, 1)}（同期持有 ${pct(P.hold, 1)}）<span class="note">· 用时 ${ms.toFixed(0)} ms${MP.lv > x.lv ? `；面板上的全局级别筛选「${lvName(MP.lv)}」更严，图上按它` : ""}${x.exit === "rule" && !x.sig.length ? "；没选信号，「所选信号自己的卖点」不生效" : ""}</span>`;
    }
    box.addEventListener("input", prev); box.addEventListener("change", prev); prev();
    V("#ed_cancel").onclick = mpClose;
    V("#ed_save").onclick = () => {
      const x = read();
      if (!x.sig.length && !Object.keys(x.cond).length) { V("#ed_prev").innerHTML = "<b>还没选条件</b>：先勾至少一个买入信号或附加条件。"; return; }
      if (!x.name) x.name = autoName(x);
      if (src && !dup) { x.id = src.id; x.on = src.on; MP.my[MP.my.indexOf(src)] = x; }
      else { x.id = "r" + Date.now().toString(36); x.on = true; const at = src ? MP.my.indexOf(src) + 1 : MP.my.length; MP.my.splice(at, 0, x); }
      mySave(); mpClose(); mpBox(); drawK();
    };
  }
  function mpLegend() {
    const lg = $("#mplg"); if (!lg) return;
    if (!MP || !mpVisible().length) { lg.innerHTML = MP ? '<span class="muted">买卖点标注已全部关闭（在下面「📍 买卖点标注」里打开）</span>' : ""; return; }
    lg.innerHTML = `<span><b class="mp-tri">▲</b>买${"SABC".split("").map((g) => `<em style="color:${GCOL[g]}">${g}</em>`).join("")}</span>
      <span><b style="color:${XCOL.止盈}">▼</b>卖·止盈</span><span><b style="color:${XCOL.止损}">▼</b>卖·止损</span><span><b style="color:${XCOL.到期}">▼</b>卖·到期/指标</span>
      <span class="muted">三角颜色＝哪条规则；淡色＝没成交；×N＝同一天 N 条规则；点标记看详情</span>`;
  }
  function mpBox() {
    const box = $("#mpbox"); if (!box) return;
    if (!MP) { box.innerHTML = `<div class="muted small">${window.MPRules ? "这只标的暂时算不了买卖点标注。" : "买卖点标注组件没加载成功，刷新试试。"}</div>`; mpLegend(); return; }
    const t0 = performance.now();
    mpCalc();
    MP.ms = performance.now() - t0;
    const M = window.MPRules, K = MP.K, n = K.d.length;
    const npass = MP.keys.filter((k) => MP.vmap[k] === "pass").length;
    const P0 = M.perf([], K.c, 0);
    const pf = (k) => { const R = MP.cur[k]; return R ? M.perf(R.trades, K.c, 0) : null; };
    const myCards = MP.my.map((r) => {
      const k = "my:" + r.id, R = MP.cur[k], P = pf(k), d = myDesc(r);
      const st = !R ? `<span class="muted">${MP.B ? "这个市场用不了所选信号（「弱转强」只限 A股）" : "日K不足 30 根，算不了"}</span>` : `${R.sig.length} 个信号 · 成交 ${P.n} 笔 · 胜率 ${P.win == null ? "—" : f(P.win, 0) + "%"} · 平均 <b class="${cls(P.avg)}">${P.avg == null ? "—" : pct(P.avg, 2)}</b> · 累计 <b class="${cls(P.cum)}">${pct(P.cum, 1)}</b>${R.open ? " · <b>持有中</b>" : ""}`;
      return `<div class="mp-my ${r.on ? "" : "off"}" data-id="${esc(r.id)}"><div class="mp-my-h"><i style="background:${mpColor(k)}"></i><b>${esc(r.name)}</b>
          <label class="mp-sw" title="标在 K 线上"><input type="checkbox" data-my="tog" ${r.on ? "checked" : ""}><span></span>标在图上</label></div>
        <div class="mp-my-d"><span>买</span>${esc(d.buy)}</div><div class="mp-my-d"><span>卖</span>${esc(d.sell)}</div>
        <div class="mp-my-p">${st}</div>
        <div class="mp-my-a"><button data-my="edit">编辑</button><button data-my="dup">复制</button><button data-my="del">删除</button></div></div>`;
    }).join("");
    const chips = MP.keys.map((k) => { const st = MP.vmap[k], R = MP.cur[k]; return `<button data-mp="${k}" class="mp-chip ${MP.sel.has(k) ? "on" : ""} ${st && st !== "pass" ? "dim" : ""}" title="${esc(M.RULES[k][1])}"><i style="background:${mpColor(k)}"></i>${esc(M.RULES[k][0])}<span>${R ? R.sig.length : 0}</span>${st ? `<em class="${MPS[st][1]}">${st === "pass" ? "✅" : st === "fail" ? "未通过" : "样本少"}</em>` : ""}</button>`; }).join("");
    const trow = (k) => {
      const R = MP.cur[k]; if (!R) return "";
      const P = pf(k), my = isMy(k), st = my ? null : MP.vmap[k], last = R.sig.length ? K.d[R.sig[R.sig.length - 1]] : "—", on = my ? MP.my[myIdx(k)].on : MP.sel.has(k);
      const vs = P.n && P0.hold != null ? P.cum - P0.hold : null;
      return `<tr class="${(st && st !== "pass") || !on ? "mp-dim" : ""}"><td><i class="mp-dot" style="background:${mpColor(k)}"></i>${esc(mpName(k))}${my ? '<div class="note">我的规则</div>' : st ? `<div class="note ${MPS[st][1]}">${MPS[st][0]}</div>` : ""}</td>
        <td class="n">${P.n}</td><td class="n">${P.win == null ? "—" : f(P.win, 0) + "%"}</td><td class="n ${cls(P.avg)}">${P.avg == null ? "—" : pct(P.avg, 2)}</td>
        <td class="n ${cls(P.cum)}">${pct(P.cum, 1)}</td><td class="n">${pct(P.mdd, 1)}</td><td class="n ${cls(vs)}">${vs == null ? "—" : (vs >= 0 ? "+" : "") + f(vs, 1)}</td><td class="n">${last}${R.open ? '<div class="note">持有中</div>' : ""}</td></tr>`;
    };
    const rows = [...MP.my.map((r) => "my:" + r.id), ...MP.keys].map(trow).join("");
    const pool = MP.pool ? MPOOL[MP.pool] : null, mt = MP.meta;
    box.innerHTML = `<div class="mp-lvbar"><span class="mp-fl">级别筛选（全部规则）</span><div class="mp-seg" id="mplv">${LVN.map(([v, s]) => `<button data-lv="${v}" class="${MP.lv === v ? "on" : ""}">${s}</button>`).join("")}</div>
        <span class="muted small">只买、只标这个级别及以上的信号，成绩表跟着重算。级别是技术条件打分，不是胜率。</span></div>
      <div class="mp-sec"><div class="mp-sh"><b>⭐ 我的规则</b><span class="muted small">自己挑信号和条件、定最低级别和卖法，马上在这只股票上回测并标到 K 线；规则存在这台设备的浏览器里，换股票也能用</span>
        <button class="mp-go" data-my="new">＋ 新建规则</button></div>
        <div class="mp-mylist">${myCards || '<div class="muted small">还没有规则，点「＋ 新建规则」。</div>'}</div></div>
      <div class="mp-sec"><div class="mp-sh"><b>预置规则（market-pulse）</b><span class="muted small">${pool ? `这只股票归在 <b>${pool}</b>：${npass ? `该池里通过检验的有 ${npass} 条。` : "该池里 12 条规则在我们的口径下<b>都没通过检验</b>（扣成本后跑不赢同池等权），标出来只作参考。"}` : "港股没做过全池检验，只作参考。"}点按钮开关，选择会记住；按钮上的数字＝按当前级别筛选后的信号数。</span></div>
        <div class="mp-chips">${chips}</div>
        <div class="tools"><button data-mpa="pass">只看通过的</button><button data-mpa="all">全部显示（仅参考）</button><button data-mpa="none">清空</button>${mt ? `<a class="small" href="#/picks/${MP.m === "us" ? "us" : "cn"}" style="margin-left:auto">全市场检验结果 →</a>` : ""}</div></div>
      <div class="tablewrap"><table class="tbl mp-tbl"><tr><th>规则</th><th>次数</th><th>胜率</th><th>平均每笔</th><th>按笔复利累计</th><th>最大回撤</th><th>比持有</th><th>最近信号</th></tr>${rows}
        <tr><td>同期买入持有</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n ${cls(P0.hold)}">${pct(P0.hold, 1)}</td><td class="n">—</td><td class="n">—</td><td class="n">${K.d[0]} 起</td></tr></table></div>
      <div class="muted small">这只股票近 ${n} 根日K（${K.d[0]} ~ ${K.d[n - 1]}）上的样本内成绩：每条规则只做多、同时最多一笔，信号出现后下一根开盘买、扣成本；胜率＝净收益 &gt;0 的笔数占比；比持有＝累计 − 同期买入持有（百分点）。
        级别：预置规则用 market-pulse 的打分（系统综合判断用它自己的五项分）；我的规则在同一天有几个所选信号同时出现时，每个信号各打一次分、取最高分那个。级别筛选＝我的规则自己的最低级别和上面的全局筛选取更严的那个。
        单只股票几十笔很容易看走眼，预置规则以全市场检验（${pool || "—"}）为准；我的规则没有做全市场检验。<span class="note">（重算 ${MP.ms.toFixed(0)} ms）</span></div>`;
    mpLegend();
    const redraw = () => { mpBox(); drawK(); };
    box.querySelectorAll("[data-lv]").forEach((b) => { b.onclick = () => { MP.lv = +b.dataset.lv; try { localStorage.setItem(MPLV_KEY, String(MP.lv)); } catch (e) {} redraw(); }; });
    box.querySelectorAll("[data-mp]").forEach((b) => { b.onclick = () => { const k = b.dataset.mp; MP.sel.has(k) ? MP.sel.delete(k) : MP.sel.add(k); mpSave([...MP.sel]); redraw(); }; });
    box.querySelectorAll("[data-mpa]").forEach((b) => { b.onclick = () => { const w = b.dataset.mpa; MP.sel = new Set(w === "all" ? MP.keys : w === "pass" ? MP.keys.filter((k) => MP.vmap[k] === "pass") : []); mpSave(w === "none" ? [] : w); redraw(); }; });
    box.querySelector('[data-my="new"]').onclick = () => mpEdit(null, false);
    box.querySelectorAll(".mp-my").forEach((cd) => {
      const id = cd.dataset.id, r = MP.my.find((x) => x.id === id);
      cd.querySelector('[data-my="tog"]').onchange = (e) => { r.on = e.target.checked; mySave(); redraw(); };
      cd.querySelector('[data-my="edit"]').onclick = () => mpEdit(id, false);
      cd.querySelector('[data-my="dup"]').onclick = () => mpEdit(id, true);
      const del = cd.querySelector('[data-my="del"]');
      del.onclick = () => { if (!del.classList.contains("cf")) { del.classList.add("cf"); del.textContent = "再点一次确认删除"; return; } MP.my = MP.my.filter((x) => x.id !== id); mySave(); redraw(); };
    });
  }
  // ---------- 每日涨跌 / 区间统计（K 线下方） ----------
  const WDN = "日一二三四五六";
  const wd = (d) => "周" + WDN[new Date(d + "T00:00:00").getDay()];
  const RGS = [["5", "5日"], ["20", "20日"], ["60", "60日"], ["ytd", "今年"], ["1y", "1年"], ["custom", "自选"]];
  let RG = { k: "20", prog: false, raf: 0 };
  const dayPct = (i) => { const C = A.chart; return i > 0 && C.c[i - 1] ? (C.c[i] / C.c[i - 1] - 1) * 100 : null; };
  const curName = () => ({ USD: "美元", HKD: "港元" }[(A.quote || {}).currency] || "");
  function ytdPct() {
    const C = A.chart, n = C.d.length, y = C.d[n - 1].slice(0, 4), i = C.d.findIndex((d) => d.slice(0, 4) === y);
    return i > 0 ? (C.c[n - 1] / C.c[i - 1] - 1) * 100 : null;
  }
  function rangeIdx(k) { // 返回 [基准日下标(区间前一天), 区间最后一天下标]
    const C = A.chart, last = C.d.length - 1;
    if (k === "ytd") { const y = C.d[last].slice(0, 4); return [Math.max(0, C.d.findIndex((d) => d.slice(0, 4) === y) - 1), last]; }
    if (k === "1y") {
      const t = new Date(C.d[last] + "T00:00:00Z"); t.setUTCFullYear(t.getUTCFullYear() - 1);
      const s = t.toISOString().slice(0, 10), i = C.d.findIndex((d) => d > s);
      return [Math.max(0, i - 1), last];
    }
    return [Math.max(0, last - +k), last];
  }
  const near = (arr, i) => { for (let j = i; j >= 0; j--) if (arr[j] != null) return arr[j]; return null; };
  function rangeStats(i0, i1) {
    const C = A.chart;
    let hi = -Infinity, hd = "", lo = Infinity, ld = "", up = 0, peak = C.c[i0], mdd = 0;
    for (let i = i0 + 1; i <= i1; i++) {
      if (C.h[i] > hi) { hi = C.h[i]; hd = C.d[i]; }
      if (C.l[i] < lo) { lo = C.l[i]; ld = C.d[i]; }
      if (C.c[i] > C.c[i - 1]) up++;
      peak = Math.max(peak, C.c[i]); mdd = Math.min(mdd, C.c[i] / peak - 1);
    }
    const r = (C.c[i1] / C.c[i0] - 1) * 100, days = i1 - i0;
    let br = null;
    if (C.bench) { const b0 = near(C.bench, i0), b1 = near(C.bench, i1); if (b0 && b1) br = (b1 / b0 - 1) * 100; }
    return { r, hi, hd, lo, ld, up, days, mdd: mdd * 100, br, ex: br == null ? null : r - br, d0: C.d[i0 + 1], d1: C.d[i1] };
  }
  const pd = (v) => f(v, v >= 100 ? 2 : 3);
  function rangeCard() {
    const box = $("#rgcard"); if (!box || !A) return;
    const [i0, i1] = RG.i || rangeIdx(RG.k);
    if (i1 <= i0) { box.innerHTML = '<div class="muted small">区间太短，放大一点再看。</div>'; return; }
    const S = rangeStats(i0, i1), lab = (RGS.find((x) => x[0] === RG.k) || [])[1];
    const short = RG.k === "1y" && S.days < 200 ? `（只有 ${S.days} 个交易日的数据）` : "";
    box.innerHTML = `<div class="rg-h"><span><b>${{ 自选: "自选区间", 今年: "今年以来" }[lab] || "近" + lab}</b> ${S.d0.slice(2)} → ${S.d1.slice(2)}</span><em>${S.days} 个交易日${short}</em></div>
      <div class="rg-main"><div><span>区间涨跌</span><b class="${cls(S.r)}">${pct(S.r)}</b></div>
        ${S.br != null ? `<div><span>同期${esc((/\((\w+)\)/.exec(A.benchmark) || [])[1] || A.benchmark)}</span><b class="${cls(S.br)}">${pct(S.br)}</b></div><div><span>超额（跑${S.ex >= 0 ? "赢" : "输"}）</span><b class="${cls(S.ex)}">${S.ex >= 0 ? "+" : ""}${f(S.ex)}<i>个点</i></b></div>` : ""}</div>
      <div class="rg-grid">
        <div><span>最高</span><b>${pd(S.hi)}</b><em>${S.hd.slice(S.days > 150 ? 2 : 5)} ${wd(S.hd)}</em></div>
        <div><span>最低</span><b>${pd(S.lo)}</b><em>${S.ld.slice(S.days > 150 ? 2 : 5)} ${wd(S.ld)}</em></div>
        <div><span>最大回撤</span><b class="${S.mdd < 0 ? "dn" : ""}">${f(S.mdd)}%</b><em>期间从高点最多跌了多少</em></div>
        <div><span>上涨天数</span><b>${S.up}/${S.days}</b><em><i class="rg-ub"><i style="width:${(S.up / S.days) * 100}%"></i></i>${f((S.up / S.days) * 100, 0)}%</em></div>
      </div>`;
  }
  function rangeChips() {
    const el = $("#rgchips"); if (el) el.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === RG.k));
  }
  function rangeMark(c) { // 图上用浅蓝底高亮选中区间（自选＝整个可见区间，不再另外高亮）
    const C = A.chart; if (!c || c.isDisposed()) return;
    let data = [];
    if (RG.k !== "custom") {
      const [i0, i1] = rangeIdx(RG.k);
      if (i1 > i0) data = [[{ xAxis: C.d[i0 + 1], itemStyle: { color: "rgba(47,127,216,.10)", borderColor: "rgba(47,127,216,.45)", borderWidth: 1, borderType: "dashed" },
        label: { show: true, position: "insideBottomRight", formatter: `${RGS.find((x) => x[0] === RG.k)[1]} ${pct((C.c[i1] / C.c[i0] - 1) * 100, 1)}`, color: "#1d4ed8", fontSize: 10, fontWeight: 700 } }, { xAxis: C.d[i1] }]];
    }
    c.setOption({ series: [{ id: "rg", markArea: { silent: true, data } }] });
  }
  function rangePick(k) {
    RG.k = k; RG.i = null; rangeChips();
    const c = echarts.getInstanceByDom($("#kc") || document.body);
    if (k === "custom") { rangeFromZoom(c); return; }
    rangeCard(); rangeMark(c);
    if (c) { // 把图缩放到「选中区间＋前面一段参照」，区间约占右侧 2/3
      const [i0, i1] = rangeIdx(k), w = Math.max(60, Math.round((i1 - i0) * 1.5));
      RG.prog = true; c.dispatchAction({ type: "dataZoom", startValue: Math.max(0, i1 - w), endValue: A.chart.d.length - 1 }); RG.prog = false;
    }
  }
  function rangeFromZoom(c) {
    if (!c || c.isDisposed()) return;
    const z = c.getOption().dataZoom[0], n = A.chart.d.length;
    const s = Math.max(0, Math.round(z.startValue ?? 0)), e = Math.min(n - 1, Math.round(z.endValue ?? n - 1));
    RG.i = [Math.max(0, s - 1), e]; rangeCard(); rangeMark(c);
  }
  function rangeBind(c) {
    c.on("datazoom", () => {
      if (RG.prog) return;
      if (RG.k !== "custom") { RG.k = "custom"; rangeChips(); }
      cancelAnimationFrame(RG.raf); RG.raf = requestAnimationFrame(() => rangeFromZoom(c));
    });
    if (RG.k === "custom") rangeFromZoom(c); else rangePick(RG.k);
  }
  function dailyStrip() {
    const el = $("#dstrip"); if (!el) return;
    const C = A.chart, n = C.d.length, from = Math.max(1, n - 20);
    const cells = [];
    for (let i = from; i < n; i++) {
      const p = dayPct(i), a = Math.min(1, Math.abs(p || 0) / 5) * 0.75 + 0.12;
      const bg = p > 0 ? `rgba(229,72,77,${a})` : p < 0 ? `rgba(26,158,85,${a})` : "#eef0f3";
      cells.push(`<button data-i="${i}" style="--c:${bg}" class="${Math.abs(p) >= 2.5 ? "strong" : ""}"><em>${C.d[i].slice(5)}</em><b>${p == null ? "—" : (p > 0 ? "+" : "") + p.toFixed(1)}</b><span>${wd(C.d[i]).slice(1)}</span></button>`);
    }
    const up = cells.length ? [...Array(n - from).keys()].filter((k) => dayPct(from + k) > 0).length : 0;
    el.innerHTML = `<div class="rg-sh"><b>近 ${n - from} 个交易日每日涨跌（%）</b><span>涨 <i class="up">${up}</i> 天 · 跌 <i class="dn">${n - from - up}</i> 天</span></div><div class="dstrip">${cells.join("")}</div>`;
    const s = el.querySelector(".dstrip"); s.scrollLeft = s.scrollWidth;
    s.onclick = (e) => { // 点某一天：图上弹出这天的明细（不在可见范围就先把图挪过去）
      const b = e.target.closest("button"), c = b && window.echarts && echarts.getInstanceByDom($("#kc")); if (!c) return;
      const i = +b.dataset.i, z = c.getOption().dataZoom[0];
      if (i < z.startValue || i > z.endValue) {
        const w = Math.max(30, z.endValue - z.startValue), e1 = Math.min(n - 1, i + Math.round(w / 3));
        RG.prog = true; c.dispatchAction({ type: "dataZoom", startValue: Math.max(0, e1 - w), endValue: e1 }); RG.prog = false;
        if (RG.k === "custom") rangeFromZoom(c);
      }
      setTimeout(() => c.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: i }), 30);
    };
  }
  function quickTiles() {
    const Q = A.quote || {}, R = A.returns || {};
    const t = (k, v, id) => `<div><span>${k}</span><b ${id ? `id="${id}"` : ""} class="${cls(v)}">${pct(v)}</b></div>`;
    return `<div class="rg-quick">${t("今日", Q.pct, "qtoday")}${t("近5日", R["5日"])}${t("近20日", R["20日"])}${t("年初至今", ytdPct())}</div>`;
  }
  function kTip(ps) {
    const C = A.chart, i = ps[0].dataIndex, p = dayPct(i), cn = A.market === "A股", cur = curName();
    const col = (v) => (v > 0 ? css("--up") : v < 0 ? css("--dn") : css("--text"));
    let h = `<div style="font-size:12px;line-height:1.6"><b>${C.d[i]}</b> ${wd(C.d[i])}<br>涨跌 <b style="color:${col(p)};font-size:14px">${p == null ? "—" : pct(p)}</b><br>`;
    h += `开 ${pd(C.o[i])}　收 <b style="color:${col(p)}">${pd(C.c[i])}</b><br>高 ${pd(C.h[i])}　低 ${pd(C.l[i])}`;
    // 日K只有成交量：成交额按「量×当日均价(高+低+收)/3」估算；换手按今天的「换手÷成交量」折算（股本近似不变）
    const Q = A.quote || {}, amt = C.v[i] * (cn ? 100 : 1) * (C.h[i] + C.l[i] + C.c[i]) / 3;
    h += `<br>成交额 约${yi(amt)}${cur}`;
    if (Q.turnover > 0 && Q.vol > 0) h += `　换手 约${f((C.v[i] / Q.vol) * Q.turnover)}%`;
    const rest = ps.filter((x) => x.seriesType !== "candlestick" && !["云底", "成交量"].includes(x.seriesName) && x.seriesId !== "rg" && !String(x.seriesId).startsWith("gm") && x.value != null && typeof x.value !== "object");
    const nv = (v) => (Math.abs(v) >= 1e8 ? f(v / 1e8) + "亿" : Math.abs(v) >= 1e5 ? f(v / 1e4, 1) + "万" : f(v, Math.abs(v) >= 100 ? 1 : 2));
    const it = rest.map((x) => `${x.marker}${esc(x.seriesName)} ${nv(x.value)}`);
    for (let k = 0; k < it.length; k += 2) h += "<br>" + it.slice(k, k + 2).join("　");
    if (ps.some((x) => String(x.seriesId).startsWith("gm"))) { const g = gmmaState(i); if (g) h += `<br>顾比：短组均 ${nv(g.ms)}　长组均 ${nv(g.ml)}<br>　→ <b>${g.txt}</b>`; }
    return h + "</div>";
  }
  // 顾比均线状态（与 gmma_lab.py 同口径）：短组全部在长组上方且长组多头排列＝多头发散；短组全部跌到长组下方＝空头；其余＝交织
  const GS = ["3", "5", "8", "10", "12", "15"], GL = ["30", "35", "40", "45", "50", "60"];
  function gmmaState(i) {
    const G = (A.chart || {}).gmma; if (!G) return null;
    const s = GS.map((m) => G[m][i]), l = GL.map((m) => G[m][i]);
    if (s.concat(l).some((v) => v == null)) return null;
    const ms = s.reduce((a, b) => a + b) / 6, ml = l.reduce((a, b) => a + b) / 6;
    const lup = l.every((v, k) => k === 0 || l[k - 1] > v), ldn = l.every((v, k) => k === 0 || l[k - 1] < v);
    const txt = Math.min(...s) > Math.max(...l) && lup ? "多头发散（短组全在长组上方，长组多头排列）"
      : Math.max(...s) < Math.min(...l) ? (ldn ? "空头发散（短组全在长组下方，长组空头排列）" : "短组全部跌破长组")
      : ms > ml ? "交织偏多（短组均值在长组上方）" : "交织偏空（短组均值在长组下方）";
    return { ms, ml, txt };
  }
  function drawFF() {
    const el = $("#ffc"); if (!el) return;
    if (!A.chart.ff_main) { el.style.height = "auto"; el.innerHTML = '<div class="empty muted small" style="padding:12px 0">资金流暂无：东方财富接口断连，腾讯快照里也没有这只（北交所/新股没有），稍后刷新再看。</div>'; return; }
    const F = A.fund_flow;
    if (F && F.src && F.src !== "em" && !$("#ffsrc")) el.insertAdjacentHTML("afterend", `<div id="ffsrc" class="muted small">⚠️ 东方财富资金流接口断连，这张图改用${F.src === "tx" ? "腾讯近 20 日主力净流入（柱子拆分只有最近一天），口径与东财接近但不相同，没和东财历史拼在一起" : "东财数据中心（同为东财口径），只有最近一个交易日"}。</div>`);
    const C = A.chart, idx = C.d.map((d, i) => i).filter((i) => C.ff_main[i] != null), d = idx.map((i) => C.d[i]);
    const ser = (name, k, color) => ({ name, type: "bar", stack: "ff", data: idx.map((i) => C[k][i]), itemStyle: { color } });
    const main = { name: "主力净流入", type: "line", data: idx.map((i) => C.ff_main[i]), showSymbol: false, lineStyle: { color: css("--text"), width: 1.4 }, itemStyle: { color: css("--text") } };
    if (NT.ff && NT.ff.zones.length) main.markArea = zoneArea(NT.ff.zones, (z) => (z.s > 0 ? "rgba(229,72,77,.10)" : "rgba(26,158,85,.11)"), (z) => `${z.s > 0 ? "入" : "出"}${z.len}天`, 4);
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", confine: true }, legend: { type: "scroll", top: 0, textStyle: { color: css("--sub"), fontSize: 11 } }, grid: { left: 56, right: 50, top: 44, bottom: 40 },
      xAxis: { type: "category", data: d, ...ax(), splitLine: { show: false } }, yAxis: [{ type: "value", ...ax() }, { type: "value", scale: true, splitLine: { show: false }, axisLabel: { color: css("--sub"), fontSize: 10 } }],
      dataZoom: [{ type: "inside", startValue: Math.max(0, d.length - 60) }],
      series: [ser("超大单", "ff_huge", "#c0262d"), ser("大单", "ff_big", "#f08c8f"), ser("中单", "ff_mid", "#9ccfb3"), ser("小单", "ff_small", "#1a9e55"), main,
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

  // 今日盘中：价格＋均价线（带阶段色块）/ 大单累计 / 成交量，三栏共用时间轴
  function segAreas(X, segs, withLabel) {
    const out = [];
    segs.forEach((s) => {
      let i0 = X.findIndex((t) => t >= s.t0); let i1 = -1;
      for (let i = X.length - 1; i >= 0; i--) if (X[i] <= s.t1) { i1 = i; break; }
      if (i0 < 0 || i1 < 0 || i1 < i0) return;
      out.push({ s, i0, i1 });
    });
    let alt = 0;
    return out.map(({ s, i0, i1 }) => {
      const narrow = (i1 - i0) / X.length < 0.16;
      const off = narrow ? (alt++ % 2) * 14 : 0;
      if (!narrow) alt = 0;
      const [bg, fg] = SEGC[s.cls] || SEGC.wait;
      return [{ xAxis: X[i0], itemStyle: { color: bg }, label: withLabel ? { show: true, position: "insideTop", formatter: s.short, color: fg, fontSize: 11, fontWeight: 700, offset: [0, 2 + off] } : { show: false } }, { xAxis: X[i1] }];
    });
  }
  let MDAY = null; // 分时看哪天
  function mHead(M, prev, five, dayObj, isToday) {
    const el = $("#mhead"); if (!el) return;
    const last = M[M.length - 1].p, hi = Math.max(...M.map((r) => r.p)), lo = Math.min(...M.map((r) => r.p));
    const pc = prev ? (last / prev - 1) * 100 : null, c = pc > 0 ? "up" : pc < 0 ? "dn" : "";
    const ds = (d) => `${String(d).slice(4, 6)}-${String(d).slice(6, 8)}`, sp = (x) => (x > 0 ? "+" : "") + x.toFixed(2) + "%";
    const D5 = A.min5 || [];
    const lbl = five ? `近 ${D5.length} 天（${ds(D5[0].date)} ~ ${ds(D5[D5.length - 1].date)}）` : isToday ? `今天${A.minute && A.minute.date ? "（" + ds(A.minute.date) + "）" : ""}` : ds(dayObj.date);
    const st = isToday && !five && LV && session(bjNow()) === "open" ? "现价" : "收盘";
    el.innerHTML = `<b>${lbl}</b>　${st} <b class="${c}">${(+last).toFixed(last < 10 ? 3 : 2)}</b>　<b class="${c} big">${pc == null ? "—" : (pc > 0 ? "+" : "") + pc.toFixed(2) + "%"}</b>
      <span class="muted small">${five ? "相对第一天前收" : "前收"} ${prev ? (+prev).toFixed(prev < 10 ? 3 : 2) : "—"}｜最高 ${(+hi).toFixed(hi < 10 ? 3 : 2)}（${prev ? sp((hi / prev - 1) * 100) : ""}）｜最低 ${(+lo).toFixed(lo < 10 ? 3 : 2)}（${prev ? sp((lo / prev - 1) * 100) : ""}）${isToday && !five ? "" : "｜历史日没有逐笔数据，大单累计只看今天"}</span>`;
  }
  function mDays() {
    const el = $("#mdays"); if (!el) return;
    const D5 = A.min5 || [], today = A.minute && String(A.minute.date);
    if (!D5.length) { el.innerHTML = ""; return; }
    const ds = (d) => `${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const pcs = (d) => { const l = d.rows[d.rows.length - 1].p, x = (l / d.prev - 1) * 100; return `<i class="${x > 0 ? "up" : x < 0 ? "dn" : ""}">${x > 0 ? "+" : ""}${x.toFixed(1)}%</i>`; };
    const cur = MDAY || today;
    const days = [...D5].reverse();
    el.innerHTML = days.map((d) => `<button class="mday ${cur === d.date ? "on" : ""}" data-md="${d.date}">${d.date === today ? "今天" : ds(d.date)}${pcs(d)}</button>`).join("") +
      (D5.length > 1 ? `<button class="mday ${MDAY === "5d" ? "on" : ""}" data-md="5d">5日连看</button>` : "");
    el.querySelectorAll("[data-md]").forEach((b) => { b.onclick = () => { const v = b.dataset.md; MDAY = v === today ? null : v; mDays(); drawIntra(); }; });
  }
  async function loadMin5(tok) {
    try { const d = await api("minute5", { sym: A.sym }); if (tok !== routeTok || !Array.isArray(d)) { const el = $("#mdays"); if (el && tok === routeTok) el.innerHTML = ""; return; } A.min5 = d; mDays(); drawIntra(); }
    catch (e) { const el = $("#mdays"); if (el) el.innerHTML = ""; }
  }
  function drawIntra() {
    const el = $("#mc"); if (!el || !window.echarts) return;
    // MDAY：null＝今天（实时）；"5d"＝5日连看；"YYYYMMDD"＝某一天（历史日没有逐笔，大单累计不画）
    const D5 = A.min5 || [], today = A.minute && String(A.minute.date);
    const isToday = !MDAY || MDAY === today;
    const dayObj = !isToday && MDAY !== "5d" ? D5.find((d) => d.date === MDAY) : null;
    let M, X, prev, T = isToday ? TK : null, five = MDAY === "5d" && D5.length > 1;
    if (five) {
      M = []; X = [];
      for (const d of D5) for (const r of d.rows) if (r.t <= "15:00") { M.push(r); X.push(d.date.slice(4, 6) + "-" + d.date.slice(6, 8) + " " + r.t); }
      prev = D5[0].prev;
    } else {
      M = ((dayObj ? dayObj.rows : (A.minute && A.minute.rows)) || []).filter((r) => r.t <= "15:00"); // 15:00 以后是盘后固定价格交易，不画
      X = M.map((r) => r.t);
      prev = dayObj ? dayObj.prev : ((A.quote && A.quote.prev) || (TK && TK.prev) || ((D5.find((d) => d.date === today) || {}).prev));
    }
    if (!M.length) return;
    const up = css("--up"), dn = css("--dn");
    mHead(M, prev, five, dayObj, isToday);
    for (const id of ["#seglegend", "#segnow", "#seglist", "#segrules", "#tickbox"]) { const e = $(id); if (e) e.style.display = T ? "" : "none"; }
    const hw = document.querySelector("#intra .how"); if (hw) hw.style.display = T ? "" : "none";
    let rng = 0; if (prev) for (const r of M) rng = Math.max(rng, Math.abs(r.p / prev - 1)); rng = Math.max(rng * 1.08, 0.005);
    const dayStarts = five ? X.map((x, i) => (i === 0 || x.slice(0, 5) !== X[i - 1].slice(0, 5) ? i : -1)).filter((i) => i >= 0) : [];
    const pctOf = (v) => (prev && v != null ? (v / prev - 1) * 100 : null);
    let cum = null;
    if (!five && T && T.timeline && T.timeline.length) {
      const tm = new Map(T.timeline.map((r) => [r.t, r.cum]));
      const pre = T.timeline.filter((r) => r.t < X[0]);
      let lc = pre.length ? pre[pre.length - 1].cum : null;
      cum = X.map((t) => { if (tm.has(t)) lc = tm.get(t); return lc == null || t > T.last_t ? null : +(lc / 1e4).toFixed(1); });
    }
    const segs = (T && T.segs) || [];
    const segAt = (t) => segs.find((s) => t >= s.t0 && t <= s.t1);
    const wan = (v) => (Math.abs(v) >= 1e4 ? (v / 1e4).toFixed(2) + "亿" : Math.round(v) + "万");
    const pd = (v) => (v == null ? "—" : (+v).toFixed(v < 10 ? 3 : 2));
    const series = [
      { name: "价格", type: "line", data: M.map((r) => r.p), showSymbol: false, lineStyle: { color: css("--text"), width: 1.4 }, itemStyle: { color: css("--text") }, z: 3,
        markArea: segs.length ? { silent: true, data: segAreas(X, segs, true) } : undefined,
        markLine: prev ? { silent: true, symbol: "none", data: [{ yAxis: prev, lineStyle: { color: "#aaa", type: "dashed" } }, ...dayStarts.slice(1).map((i) => ({ xAxis: X[i], lineStyle: { color: "#ddd", type: "solid" } }))], label: { show: false } } : undefined },
      { name: "均价线", type: "line", data: M.map((r) => r.avg), showSymbol: false, lineStyle: { color: "#e8a317", width: 1.2 }, itemStyle: { color: "#e8a317" } },
      { name: "大单累计", type: "line", xAxisIndex: 1, yAxisIndex: 1, data: cum || [], showSymbol: false, connectNulls: false, lineStyle: { color: "#c0262d", width: 1.3 }, itemStyle: { color: "#c0262d" },
        areaStyle: { opacity: 0.12 }, markArea: segs.length ? { silent: true, data: segAreas(X, segs, false) } : undefined,
        markLine: cum ? { silent: true, symbol: "none", data: [{ yAxis: 0 }], lineStyle: { color: "#bbb" }, label: { show: false } } : undefined },
      { name: "成交量", type: "bar", xAxisIndex: 2, yAxisIndex: 2, data: M.map((r, i) => ({ value: r.v, itemStyle: { color: i && r.p < M[i - 1].p ? dn : up } })) },
    ];
    const grids = T ? [{ left: 50, right: 46, top: 26, height: "47%" }, { left: 50, right: 46, top: "62%", height: "19%" }, { left: 50, right: 46, top: "85%", height: "8%" }]
      : [{ left: 50, right: 46, top: 26, height: "64%" }, { left: 50, right: 46, top: "76%", height: "0.5%", show: false }, { left: 50, right: 46, top: "79%", height: "14%" }]; // 历史日/5日：没有大单累计，价格图放大
    const xa = (g, show) => ({ type: "category", gridIndex: g, data: X, ...ax(), axisLabel: { show, color: css("--sub"), fontSize: 10, interval: five ? (i) => dayStarts.includes(i) : (i, v) => ["09:30", "10:30", "11:30", "14:00", "15:00"].includes(v), formatter: five ? (v) => v.slice(0, 5) : undefined }, splitLine: { show: false }, axisTick: { show: false } });
    mkOrGet(el).setOption({ animation: false, axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: { trigger: "axis", confine: true, formatter: (ps) => { const t = ps[0].axisValue, sg = segAt(t); const g = (n) => ps.find((p) => p.seriesName === n);
        const pv = g("价格") && g("价格").value, pc = pctOf(pv);
        return `<b>${t}</b>${sg ? `　<span style="color:${SEGC[sg.cls][1]}">${sg.label}</span>` : ""}<br>价格 ${pd(pv)}${pc == null ? "" : ` <b style="color:${pc > 0 ? up : pc < 0 ? dn : "inherit"}">${pc > 0 ? "+" : ""}${pc.toFixed(2)}%</b>`}　均价 ${pd(g("均价线") && g("均价线").value)}` +
          (g("大单累计") && g("大单累计").value != null ? `<br>大单累计 ${wan(g("大单累计").value)}` : "") + (g("成交量") ? `<br>成交 ${g("成交量").value} 手` : ""); } },
      graphic: T ? [{ type: "text", left: 54, top: "62%", style: { text: cum ? "大单＋超大单 累计净买入" : "大单累计：统计中…", fill: "#999", fontSize: 10 } }] : [],
      grid: grids, xAxis: [xa(0, false), xa(1, false), xa(2, true)],
      yAxis: [prev ? { type: "value", min: +(prev * (1 - rng)).toFixed(3), max: +(prev * (1 + rng)).toFixed(3), interval: +(prev * rng / 2).toFixed(4), ...ax(), axisLabel: { color: css("--sub"), fontSize: 10, formatter: (v) => pd(v) } } : { type: "value", scale: true, ...ax(), splitNumber: 4 }, { type: "value", gridIndex: 1, splitNumber: 2, ...ax(), axisLabel: { color: css("--sub"), fontSize: 10, formatter: (v) => (Math.abs(v) >= 1e4 ? (v / 1e4).toFixed(1) + "亿" : v + "万") } },
        { type: "value", gridIndex: 2, splitNumber: 1, ...ax(), axisLabel: { show: false }, splitLine: { show: false } },
        ...(prev ? [{ type: "value", gridIndex: 0, position: "right", min: -rng * 100, max: rng * 100, interval: rng * 50, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { fontSize: 10, formatter: (v) => (Math.abs(v) < 1e-9 ? "0%" : (v > 0 ? "+" : "") + v.toFixed(Math.abs(v) < 1 ? 2 : 1) + "%"), color: (v) => (v > 1e-9 ? up : v < -1e-9 ? dn : css("--sub")) } }] : [])],
      series: prev ? [...series, { name: "_pct", type: "line", yAxisIndex: 3, data: [], silent: true }] : series }, true);
  }
  function renderTicks() {
    const T = TK, box = $("#segnow"); if (!box) return;
    const md = A.minute && A.minute.date ? `${String(A.minute.date).slice(4, 6)}-${String(A.minute.date).slice(6, 8)} ` : "";
    if (!T.read) { box.innerHTML = `<div class="muted small">今天成交还太少（${T.n} 笔），开盘十几分钟后再分段。</div>`; $("#seglist").innerHTML = ""; }
    else {
      const R = T.read, bc = R.bias === "偏多" ? "up" : R.bias === "偏空" ? "dn" : "";
      const [ok, ng] = R.bias === "偏多" ? [["✅ 确认", R.up], ["❌ 失效", R.down]] : R.bias === "偏空" ? [["✅ 确认", R.down], ["❌ 失效", R.up]] : [["↗ 转强", R.up], ["↘ 转弱", R.down]];
      if (R.closed) { ok[0] += "（明天看）"; ng[0] += "（明天看）"; }
      const fk = FLOWKEY[R.cls], ft = fk ? flText(fk) : "";
      box.innerHTML = `<div class="nt">📍 ${R.closed ? "收盘" : "现在"}（${md}${R.asof}）：<b style="color:${SEGC[R.cls][1]}">${esc(R.label)}</b> → <span class="nw">${R.closed ? "明天" : "接下来"}<b class="${bc}">${R.bias}</b></span><span class="muted small">（概率倾向，不是确定结论）</span></div>
        <ul>${R.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        <div class="cond"><b>${ok[0]}</b>　${esc(ok[1])}</div><div class="cond"><b>${ng[0]}</b>　${esc(ng[1])}</div>
        <div class="story"><b>全天：</b>${esc(R.story)}</div>
        <div class="muted small">⚖️ 盘中分段没有历史逐笔数据，<b>无法回测</b>，只能当参考。${ft ? "最接近的日级检验：" + esc(ft) : ""}</div>`;
      $("#seglist").innerHTML = T.segs.map((s) => `<span class="seg" style="border-color:${SEGC[s.cls][1]};background:${SEGC[s.cls][0]}"><b>${s.t0}–${s.t1}</b> <span style="color:${SEGC[s.cls][1]}">${esc(s.label.replace(/（.*）/, ""))}</span><i>价 ${pct(s.dp_pct)} · 大单 ${s.dc >= 0 ? "+" : "−"}${yi(Math.abs(s.dc))}（${pct(s.rc_pct, 0)}）</i></span>`).join("");
      $("#segrules").textContent = "分段规则：" + R.rules + "。“大单”按腾讯逐笔（3 秒一笔快照）的单笔金额 ≥20 万元统计。";
    }
    $("#tickbox").innerHTML = `<h3 class="sub">今天逐笔分档：谁在主动买</h3><div class="muted small">今天共 <b>${T.n}</b> 笔成交，成交额 ${yi(T.total)}。主力（超大＋大单）主动买入减主动卖出：<b class="${cls(T.main_net)}">${yi(T.main_net)}</b>，大单成交占 ${f(T.main_share, 0)}%。</div>
      <div class="tablewrap"><table class="tbl"><tr><th>档位<span class="note">单笔金额</span></th><th>主动买入<span class="note">按卖价成交</span></th><th>主动卖出<span class="note">按买价成交</span></th><th>净额<span class="note">买−卖</span></th><th>买/卖笔数</th><th>成交占比</th></tr>
      ${T.table.map((r) => `<tr><td>${r.tier}<span class="note">${{ 超大单: "≥100万", 大单: "20–100万", 中单: "4–20万", 小单: "<4万" }[r.tier]}</span></td><td class="n">${yi(r.buy)}</td><td class="n">${yi(r.sell)}</td><td class="n ${cls(r.net)}">${yi(r.net)}</td><td class="n">${r.n_buy}/${r.n_sell}</td><td class="n">${f(r.share, 1)}%</td></tr>`).join("")}</table></div>
      <div class="muted small">怎么读：「主动买入」＝买方着急、直接按卖一价吃单；「主动卖出」＝卖方着急、直接按买一价砸单。净额为正＝这一档在买。通常把大单＋超大单看作「主力」，小单看作散户——但腾讯逐笔是 3 秒快照，几个散户的单子也可能凑成一笔「大单」，只能看大概。涨停封板时买单排队成交不到，主动卖出会偏多，属正常。</div>`;
  }
  async function loadTicks(tok) {
    const box = $("#segnow");
    try {
      const t = await api("ticks", { sym: A.sym });
      if (tok !== routeTok) return;
      if (t.error) throw new Error(t.error);
      TK = t; if (LV) LV.lastTicks = Date.now();
      renderTicks(); drawIntra();
    } catch (e) {
      if (tok !== routeTok || !box) return;
      box.innerHTML = `<div class="err small">逐笔成交没拿到：${esc(e.message)}　<a href="javascript:void(0)" id="tkretry">重试</a></div>`;
      $("#tkretry").onclick = () => { box.innerHTML = '<div class="muted small">重新下载中…</div>'; loadTicks(tok); };
    }
  }

  // ---------- 盘中实时：A股交易时段每 60 秒刷新报价＋分时，约每 2 分钟增量刷新逐笔；后台标签页暂停 ----------
  let LV = null;
  const bjNow = () => { const d = window.SS_NOW ? window.SS_NOW() : new Date(), b = new Date(d.getTime() + 8 * 3600e3);
    return { ymd: b.toISOString().slice(0, 10).replace(/-/g, ""), hm: b.getUTCHours() * 60 + b.getUTCMinutes(), wd: b.getUTCDay() }; };
  const session = (n) => (n.wd === 0 || n.wd === 6 ? "weekend" : n.hm < 570 ? "pre" : n.hm <= 691 ? "open" : n.hm < 780 ? "lunch" : n.hm <= 901 ? "open" : "after");
  const hms = (d) => { const b = new Date(d.getTime() + 8 * 3600e3); return b.toISOString().slice(11, 19); };
  function livePill() {
    const el = $("#live"); if (!el || !LV) return;
    const n = bjNow(), s = session(n), today = A.minute && String(A.minute.date) === n.ymd;
    let t, c = "";
    if (document.hidden) t = "已暂停（页面在后台）";
    else if (s === "open" && !today) t = LV.misses > 5 ? "今天休市 · 显示最近一个交易日" : "等待今天的数据…";
    else if (s === "open") { t = `实时 · 更新于 ${hms(LV.at)}`; c = "on"; }
    else if (s === "lunch") t = "午间休市 · 13:00 继续刷新";
    else if (s === "pre") t = "未开盘 · 9:30 起自动刷新";
    else if (s === "after" && today) t = "已收盘 · 显示全天结论";
    else t = "休市 · 显示最近一个交易日";
    el.className = "live " + c; el.textContent = t;
  }
  function liveStart(tok) {
    liveStop();
    LV = { tok, timer: setInterval(liveTick, 60000), lastTicks: 0, at: new Date(), wasOpen: false, final: false, busy: false, misses: 0 };
    livePill();
  }
  function liveStop() { if (LV) clearInterval(LV.timer); LV = null; }
  document.addEventListener("visibilitychange", () => { if (!LV) return; if (document.hidden) livePill(); else liveTick(); });
  async function liveTick() {
    if (!LV) return;
    if (LV.tok !== routeTok) return liveStop();
    if (document.hidden) return livePill();
    const n = bjNow(), s = session(n);
    if (s !== "open") { // 刚收盘/午休：最后补拉一次全量，然后停止刷新
      if (LV.wasOpen && !LV.final) { LV.final = true; await liveRefresh(true); }
      return livePill();
    }
    if (LV.misses > 5) return livePill(); // 工作日但一直拿不到今天的数据＝节假日休市
    LV.wasOpen = true; LV.final = false;
    await liveRefresh(Date.now() - LV.lastTicks >= 115000);
  }
  async function liveRefresh(withTicks) {
    if (!LV || LV.busy) return;
    const L0 = LV, tok = L0.tok, sym = A.sym;
    L0.busy = true;
    try {
      const [q, m] = await Promise.all([api("quote", { sym }), api("minute", { sym })]);
      if (LV !== L0 || tok !== routeTok) return;
      if (q && !q.error && q.price) { A.quote = { ...A.quote, ...q }; updHead(); }
      if (m && m.rows && m.rows.length) A.minute = m;
      L0.misses = String(A.minute && A.minute.date) === bjNow().ymd ? 0 : L0.misses + 1;
      if (withTicks && !L0.misses) {
        const t = await api("ticks", { sym, fresh: 1 });
        if (LV !== L0 || tok !== routeTok) return;
        if (t && !t.error) { TK = t; L0.lastTicks = Date.now(); renderTicks(); }
      }
      drawIntra();
      L0.at = new Date();
    } catch (e) { console.warn("实时刷新失败", e); } finally { L0.busy = false; livePill(); }
  }
  function updHead() {
    const Q = A.quote, hp = $("#hp"), hq = $("#hpct"); if (!hp || !Q) return;
    hp.textContent = f(Q.price, Q.price > 100 ? 2 : 3); hq.textContent = pct(Q.pct);
    hp.className = "price " + cls(Q.pct); hq.className = cls(Q.pct);
    const qt = $("#qtoday"); if (qt) { qt.textContent = pct(Q.pct); qt.className = cls(Q.pct); }
  }
  function drawChips() {
    const el = $("#chc"); if (!el || !A.chips) return;
    const B = A.chips.bins, price = A.chart.c[A.chart.c.length - 1];
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine: true, formatter: (p) => `价位 ${p[0].name}<br>占比 ${p[0].value}%` }, grid: { left: 60, right: 16, top: 10, bottom: 30 },
      yAxis: { type: "category", data: B.map((b) => b.p), ...ax(), splitLine: { show: false } }, xAxis: { type: "value", ...ax(), name: "%" },
      series: [{ type: "bar", data: B.map((b) => ({ value: b.v, itemStyle: { color: b.p <= price ? "rgba(229,72,77,.65)" : "rgba(26,158,85,.6)" } })),
        markLine: { silent: true, symbol: "none", data: [{ yAxis: B.reduce((best, b) => (Math.abs(b.p - price) < Math.abs(best.p - price) ? b : best), B[0]).p + "" }], lineStyle: { color: css("--text") }, label: { formatter: "现价", position: "insideEndTop" } } }] });
  }
  function drawRS() {
    const el = $("#rsc"); if (!el || !A.chart.bench) return;
    const C = A.chart, i0 = C.bench.findIndex((x) => x != null); if (i0 < 0) return;
    const n0 = C.c[i0], b0 = C.bench[i0];
    const me = { name: A.name, type: "line", data: C.c.slice(i0).map((v) => +(v / n0 * 100).toFixed(2)), showSymbol: false, lineStyle: { color: css("--up"), width: 1.5 }, itemStyle: { color: css("--up") } };
    if (NT.rs && NT.rs.zones.length) me.markArea = zoneArea(NT.rs.zones.map((z) => ({ ...z, len: C.d.indexOf(z.d1) - C.d.indexOf(z.d0) + 1 })), (z) => (z.s > 0 ? "rgba(229,72,77,.09)" : "rgba(26,158,85,.10)"), (z) => z.label, 25);
    mk(el).setOption({ animation: false, tooltip: { trigger: "axis", confine: true }, legend: { top: 0, textStyle: { color: css("--sub") } }, grid: { left: 46, right: 12, top: 30, bottom: 40 },
      xAxis: { type: "category", data: C.d.slice(i0), ...ax(), splitLine: { show: false } }, yAxis: { type: "value", scale: true, ...ax() },
      dataZoom: [{ type: "inside" }],
      series: [me, { name: A.benchmark, type: "line", data: C.bench.slice(i0).map((v) => (v == null ? null : +(v / b0 * 100).toFixed(2))), showSymbol: false, connectNulls: true, lineStyle: { color: "#999" }, itemStyle: { color: "#999" } }] });
  }

  // ---------- ⭐ S 级买卖点（market-pulse 右侧确认；学堂 ../s_signals.json + ../s_hist/，tools/mp/export_s.py 每次发布前导出） ----------
  // 11-23 老大：「买卖点这里，是不是可以点击查看到 S 级这套系统的」。仓位规则照推送规范 2.8，总状态取 ../todo.json（与 #/todo 同一份）。
  let SGP = null, SGM = null;
  const sgHour = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 13);
  const sgJ = (u) => fetch(`${u}?h=${sgHour()}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const sgData = () => SGP || (SGP = Promise.all([sgJ("../s_signals.json"), sgJ("../s_hist/index.json"), sgJ("../todo.json")]).then(([G, I, T]) => ({ G, I, T })));
  const SGMK = { CN: "A股", HK: "港股", US: "美股" };
  const sgCode = (sym) => String(sym || "").split(".")[0];
  const sgPx = (v) => (v == null ? "—" : f(v, v >= 100 ? 2 : v >= 1 ? 2 : 3));
  const sgRep = `<a href="../#/labs/s_grade">回测报告 ›</a>`;
  function sgPos(T, mk) { // 2.8：可以考虑买入 单只≤10%、等待确认 ≤5%、不推荐 不新买；合计 ≤ 仓位上限×40%
    const P = ((T || {}).pos || {})[mk.toLowerCase()], al = (T || {}).alloc || {};
    if (!P) return `${SGMK[mk]}现在没有当天的总状态（港股看工作日 16:20 的港股日韩报告）：没有报告结论前不新买。`;
    const mult = ((al.s_mult || {})[P.level]), one = mult == null ? null : 10 * mult, tot = P.cap != null ? P.cap * (al.s_share || 0.4) : null;
    const head = `${SGMK[mk]}现在「${esc(P.word || "—")}」（${esc((P.at || "").slice(5))} 报告）`;
    if (!one) return `${head} → S 级买点<b>不新买</b>，S 级卖点照常执行。`;
    return `${head} → S 级买点单只 ≤ <b>${f(one, 0)}%</b>${tot != null ? `、合计 ≤ <b>${f(tot, 0)}%</b>（仓位上限 ${P.cap}% × 40%）` : ""}；确认后下一个交易日、现价在买入区间内才买，错过不追；买了以后照原计划卖（止损、止盈、最多 10 个交易日、转弱就卖）。`;
  }
  function sgBuyState(x, q) { // 买点今天该怎么做
    const px = q && q.price != null ? q.price : x.last_close, z = x.zone || [];
    const inz = px != null && z.length === 2 && px >= z[0] && px <= z[1];
    const qd = q && q.time ? String(q.time).replace(/\D/g, "").slice(0, 8) : "", buyDay = qd && qd > (x.date || "").replace(/-/g, "");
    if (x.bars_since >= 1) return ["已错过，不追", "", `确认后第 ${x.bars_since + 1} 个交易日了，买入日已过`];
    if (!buyDay) return ["下一交易日看开盘", "wait", `下一个交易日开盘价在 ${sgPx(z[0])}–${sgPx(z[1])} 内才买，跳出去就不追`];
    if (inz) return ["现价在买入区间，可以买", "buy", "今天是买入日"];
    return px > z[1] ? ["现价高于买入区间，不追", "", `今天是买入日，但现价 ${sgPx(px)} 已经涨出区间，错过不追`]
      : ["现价低于买入区间，不买", "", `今天是买入日，但现价 ${sgPx(px)} 跌到区间下面了，离止损太近，按规则不买`];
  }
  function sgRow(x, q, held) {
    const buy = x.side === "buy", st = buy ? sgBuyState(x, q) : (x.bars_since >= 1 ? [`${x.bars_since} 天前已出，持有的应已卖`, "", ""] : ["持有的下一交易日开盘卖", "sell", ""]);
    if (buy && held && x.bars_since >= 1) st[2] = "买入日开盘在区间内、按规则已买的照原计划拿着";
    const px = q && q.price != null ? q.price : null;
    const kv = buy ? `<span>确认 <b>${esc((x.date || "").slice(5))}</b> 收盘</span><span>参考价 <b>${sgPx(x.ref)}</b></span>${px != null ? `<span>现价 <b class="${cls(q.pct)}">${sgPx(px)}</b></span>` : `<span>最新收盘 <b>${sgPx(x.last_close)}</b></span>`}
        <span>买入区间 <b>${sgPx(x.zone[0])}–${sgPx(x.zone[1])}</b></span><span>止损 <b class="dn">${sgPx(x.stop)}</b><em>−${f(x.stop_pct, 1)}%</em></span><span>止盈 <b class="up">${sgPx(x.take)}</b><em>+${f(x.take_pct, 1)}%</em></span>`
      : `<span>确认 <b>${esc((x.date || "").slice(5))}</b> 收盘</span><span>当天收盘 <b>${sgPx(x.ref)}</b></span>${px != null ? `<span>现价 <b class="${cls(q.pct)}">${sgPx(px)}</b></span>` : `<span>最新收盘 <b>${sgPx(x.last_close)}</b></span>`}`;
    return `<a class="sg-row${st[1] ? "" : " sg-dim"}" href="#/s/${esc(x.code)}"><div class="sg-nm"><b>${esc(x.name)}</b><span class="muted">${esc(x.code.replace(/^us/, ""))}${x.industry ? " · " + esc(x.industry) : ""}</span><span class="sg-g sg-${x.grade}">${x.grade} 级${buy ? "买点" : "卖点"}</span><span class="tag ${st[1]}">${esc(st[0])}</span></div>
      <div class="sg-kv">${kv}</div><div class="sg-why">${esc(x.why || "")}${st[2] ? `<span class="muted">｜${esc(st[2])}</span>` : ""}</div></a>`;
  }
  function sgPoolHtml(G, I, mk) {
    const L = (G.pool_list || []).filter((x) => x.market === mk), st = {};
    for (const x of (I && I.items) || []) st[x.code] = x.s;
    if (!L.length) return "";
    return `<details class="sg-pool"><summary>盯哪些票：${SGMK[mk]} ${L.length} 只（点开看名单和每只 2023 年以来 S 级成绩）</summary><div class="sg-chips">${L.map((x) => {
      const s = st[x.code]; return `<a href="#/s/${esc(x.code)}">${esc(x.name)}<em>${s && s.n ? `${s.n} 次 · 胜率 ${f(s.win * 100, 0)}% · 每笔 ${pct(s.avg * 100, 1)}` : "2023 年起没成交过 S 级"}</em></a>`;
    }).join("")}</div></details>`;
  }
  function sgMarketHtml(D, mk, Q, small) {
    const G = D.G, its = (G.items || []).filter((x) => x.market === mk);
    const S = its.filter((x) => x.grade === "S"), B = S.filter((x) => x.side === "buy"), X = S.filter((x) => x.side === "sell"), A_ = its.filter((x) => x.grade === "A");
    const n = (G.pool || {})[mk] || {}, end = (G.data_end || {})[mk], held = {};
    for (const x of (D.I && D.I.items) || []) if (x.hold) held[x.code] = 1;
    const body = `${B.length ? `<div class="sg-sub up">🎯 S 级买点 ${B.length} 个</div>${B.map((x) => sgRow(x, Q[x.code], held[x.code])).join("")}` : `<div class="sg-sub">🎯 S 级买点：最近 5 个交易日没有新确认的</div>`}
      ${X.length ? `<div class="sg-sub dn">⚠️ S 级卖点 ${X.length} 个（没持有的不用管）</div>${X.map((x) => sgRow(x, Q[x.code])).join("")}` : `<div class="sg-sub">⚠️ S 级卖点：最近 5 个交易日没有</div>`}
      ${A_.length ? `<details class="sg-a"><summary>A 级买点 ${A_.length} 个（条件少一项，只作参考、不买）</summary>${A_.map((x) => sgRow(x, Q[x.code], 0)).join("")}</details>` : ""}`;
    return `${small ? `<div class="sg-mh">${SGMK[mk]}（执行池 ${n.exec || 0} 只，数据到 ${esc(end || "—")}）</div>` : ""}
      <p class="sg-use">💡 <b>怎么用</b>　${sgPos(D.T, mk)}</p>${body}${sgPoolHtml(G, D.I, mk)}`;
  }
  async function sgPicks(market, tok) {
    const box = $("#sgbox"); if (!box) return;
    const D = await sgData(); if (tok !== routeTok || !$("#sgbox")) return;
    const G = D.G;
    if (!G) { box.innerHTML = `<div class="muted">S 级买卖点暂时读不到（学堂每次发布时导出）。可以先看 <a href="../#/todo">今天该做什么 ›</a></div>`; return; }
    const mks = market === "us" ? ["US"] : ["CN", "HK"], Q = {};
    const want = (G.items || []).filter((x) => mks.includes(x.market) && x.grade === "S" && !x.bars_since).map((x) => x.code);
    await Promise.all(want.map((c) => api("quote", { sym: c }).then((q) => { if (q && !q.error) Q[c] = q; }).catch(() => {})));
    if (tok !== routeTok || !$("#sgbox")) return;
    const bt = G.bt, n = G.pool || {};
    box.innerHTML = `<div class="sg-intro"><b>这套是什么</b>　market-pulse 的右侧买点：股价站上 20 日和 60 日均线、均线向上、MACD 转强以后，<b>放量突破前 10 天高点</b>或<b>回踩 20 日线后收阳</b>，五项全满分才叫 S 级；每天收盘后确认。
        只盯它的执行池：A股 ${(n.CN || {}).exec || 0} 只、港股 ${(n.HK || {}).exec || 0} 只、美股 ${(n.US || {}).exec || 0} 只（大银行、长江电力、茅台、宽基 ETF、美股大票这类）。${G.stale ? `<br>⚠️ ${esc(G.stale_note || "数据没更新，沿用上一份")}` : ""}</div>
      ${market === "us" ? sgMarketHtml(D, "US", Q) : sgMarketHtml(D, "CN", Q) + `<div class="sg-hk">${sgMarketHtml(D, "HK", Q, true)}</div>`}
      ${bt ? `<p class="sg-bt">📊 <b>回测说实话</b>　A股执行池 ${bt.pool} 只、${esc(String(bt.from).slice(0, 4))}–${esc(String(bt.to).slice(0, 4))} 年：${bt.n} 笔，赚钱的占 ${f(bt.win * 100, 0)}%，每笔扣费后 ${pct(bt.avg * 100, 2)}，比直接拿着同一批股票每笔${bt.ex < 0 ? "少" : "多"} ${f(Math.abs(bt.ex * 100), 2)} 个点。右侧、亏得少（大部分时间空仓），但不是「更准」，所以不加仓位。${sgRep}</p>` : ""}
      <div class="muted small">${esc(G.scanned_at || "—")} 按 market-pulse 规则 ${esc(G.version || "")} 复算（每次发布前更新）；点名字看个股页的 S 级历史记录。买多少、能不能买，最终以 <a href="../#/todo">今天该做什么 ›</a> 为准。</div>`;
  }

  // 个股页：⭐ S 级记录卡 + K 线 ▲▼
  function sgLive(K, cn, sym) { // 不在执行池的：浏览器里按同一规则现算（mp_rules.js 的 autoSignals = 复制的 auto-1.0.1），买法同 2.8
    const M = window.MPRules; if (!M || !K || K.c.length < 150) return null;
    let n = K.c.length;
    const last = K.d[n - 1], now = new Date();
    const zt = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(now).replace(",", "");
    const [td, hm] = zt(sym.startsWith("us") ? "America/New_York" : "Asia/Shanghai").split(" "), gate = sym.startsWith("us") || sym.startsWith("hk") ? "16:10" : "15:10";
    if (last >= td && hm < gate) n -= 1; // 今天还没收盘的那根不算
    const sl = (a) => a.slice(0, n), O = sl(K.o), H = sl(K.h), L = sl(K.l), C = sl(K.c), V = sl(K.v), D = sl(K.d);
    const [buy, ex, gr, , st] = M.autoSignals(O, H, L, C, V);
    const fund = /^(sh5|sz15|sz16)/.test(sym), lim = cn ? (/^(sh68|sz30)/.test(sym) ? 0.2 : 0.1) : null, slip = 0.001;
    const bc = cn ? 0.0003 + (fund ? 0 : 0.00001) : sym.startsWith("hk") ? 0.0013 : 0.0003, scst = cn ? 0.0003 + (fund ? 0 : 0.00051) : bc;
    const out = { live: true, data_end: D[n - 1], from: D[Math.min(n - 1, 125)] };
    for (const g of ["S", "A"]) {
      const R = { trades: [], skips: [], open: null }; let pos = null;
      for (let i = 125; i < n; i++) {
        let sold = false;
        if (pos && i > pos.i) {
          let ev = null;
          if (O[i] <= pos.stop) ev = [O[i], "跳空止损"]; else if (O[i] >= pos.take) ev = [O[i], "跳空止盈"]; else if (ex[i - 1]) ev = [O[i], "转弱退出"];
          else if (i - pos.i >= 10) ev = [O[i], "到期"]; else if (L[i] <= pos.stop) ev = [pos.stop, "止损"]; else if (H[i] >= pos.take) ev = [pos.take, "止盈"];
          if (ev && V[i] > 0 && (lim == null || O[i] > C[i - 1] * (1 - lim) * 1.002)) {
            const px = ev[0] * (1 - slip);
            R.trades.push({ sd: D[pos.s], bd: D[pos.i], bp: pos.e, xd: D[i], xp: px, ret: px * (1 - scst) / (pos.e * (1 + bc)) - 1, days: i - pos.i, why: ev[1] });
            pos = null; sold = true;
          }
        }
        const t = i - 1;
        if (pos || sold || !buy[t] || gr[t] !== g) continue;
        const ref = C[t], half = ref * st[t] / 200;
        if (lim != null && !(V[i] > 0 && O[i] * (1 + slip) < C[t] * (1 + lim) * 0.998)) { R.skips.push({ sd: D[t], op: O[i], why: "开盘涨停" }); continue; }
        if (O[i] < ref - half || O[i] > ref + half) { R.skips.push({ sd: D[t], op: O[i], zone: [ref - half, ref + half], why: O[i] > ref + half ? "开盘高于买入区间" : "开盘低于买入区间" }); continue; }
        const e = O[i] * (1 + slip);
        pos = { s: t, i, e, stop: e * (1 - st[t] / 100), take: e * (1 + 2 * st[t] / 100) };
      }
      if (pos) R.open = { sd: D[pos.s], bd: D[pos.i], bp: pos.e, stop: pos.stop, take: pos.take, held: n - 1 - pos.i, left: Math.max(0, 10 - (n - 1 - pos.i)), float: C[n - 1] / pos.e - 1, exit_next: !!ex[n - 1] || n - 1 - pos.i >= 10 };
      const rs = R.trades.map((x) => x.ret);
      R.stat = rs.length ? { n: rs.length, win: rs.filter((x) => x > 0).length / rs.length, avg: rs.reduce((a, b) => a + b, 0) / rs.length, sum: rs.reduce((a, b) => a + b, 0) } : { n: 0 };
      R.signals = R.trades.length + R.skips.length + (R.open ? 1 : 0);
      out[g] = R;
    }
    const t = n - 1;
    out.pending = buy[t] && (gr[t] === "S" || gr[t] === "A") ? { d: D[t], grade: gr[t], ref: C[t], zone: [C[t] * (1 - st[t] / 200), C[t] * (1 + st[t] / 200)], stop: C[t] * (1 - st[t] / 100), take: C[t] * (1 + st[t] / 50) } : null;
    return out;
  }
  function sgMarks(H, sig) { // K 线上的 ⭐ 标记：S 级成交的买▲ / 卖▼，没买成的（开盘不在区间）淡色▲，刚确认待买的 ▲待买
    const S = H.S || {}, b = [], s = [];
    for (const t of S.trades || []) { b.push({ d: t.bd, k: "buy", tip: `S 级买 ${t.bd.slice(5)} ${sgPx(t.bp)}` }); s.push({ d: t.xd, k: "sell", ret: t.ret, why: t.why }); }
    for (const t of S.skips || []) b.push({ d: t.sd, k: "skip" });
    if (S.open) b.push({ d: S.open.bd, k: "buy" });
    const p = sig || (H.pending && H.pending.grade === "S" ? { date: H.pending.d } : null);
    if (p) b.push({ d: p.date, k: "pend" });
    return { b, s };
  }
  function sgSeries() {
    if (!SGM || !A) return [];
    const C = A.chart, idx = new Map(C.d.map((d, i) => [d, i]));
    const B = SGM.b.filter((x) => idx.has(x.d)).map((x) => {
      const i = idx.get(x.d), fade = x.k === "skip";
      return { value: [x.d, C.l[i] * 0.955], symbolSize: fade ? 11 : 15, itemStyle: { color: fade ? "rgba(217,119,6,.35)" : "#d97706", borderColor: "#fff", borderWidth: 1 },
        label: { formatter: x.k === "skip" ? "⭐没买" : x.k === "pend" ? "⭐待买" : "⭐买", color: fade ? "#c08a3e" : "#b45309" } };
    });
    const X = SGM.s.filter((x) => idx.has(x.d)).map((x) => {
      const i = idx.get(x.d);
      return { value: [x.d, C.h[i] * 1.03], symbolSize: 13, itemStyle: { color: x.ret > 0 ? "#c0262d" : "#12804a", borderColor: "#fff", borderWidth: 1 },
        label: { formatter: `⭐卖 ${x.ret > 0 ? "+" : ""}${(x.ret * 100).toFixed(1)}%`, color: x.ret > 0 ? "#c0262d" : "#12804a" } };
    });
    const lab = (pos) => ({ show: true, position: pos, distance: 3, fontSize: 10, fontWeight: 700, backgroundColor: "rgba(255,255,255,.85)", borderRadius: 3, padding: [1, 2] });
    return [{ id: "sgb", name: "S级 买", type: "scatter", symbol: "triangle", z: 7, data: B, tooltip: { show: false }, silent: true, label: lab("bottom") },
      { id: "sgx", name: "S级 卖", type: "scatter", symbol: "triangle", symbolRotate: 180, z: 7, data: X, tooltip: { show: false }, silent: true, label: lab("right") }];
  }
  function sgCardHtml(a, H, sig, D, inPool) {
    const S = H.S || { stat: { n: 0 }, trades: [], skips: [] }, A_ = H.A || { stat: { n: 0 } }, st = S.stat || { n: 0 }, mk = a.sym.startsWith("us") ? "US" : a.sym.startsWith("hk") ? "HK" : "CN";
    let now;
    if (S.open && !(sig && sig.side === "sell")) now = `<b>持有中</b>（按规则）：${esc(S.open.sd.slice(5))} 的 S 级买点，${esc(S.open.bd.slice(5))} 开盘买入 ${sgPx(S.open.bp)}，止损 ${sgPx(S.open.stop)}、止盈 ${sgPx(S.open.take)}，${S.open.exit_next ? "<b>下一个交易日开盘卖</b>" : `最多还拿 ${S.open.left} 个交易日`}；按最新收盘浮动 <b class="${cls(S.open.float)}">${pct(S.open.float * 100, 1)}</b>`;
    else if (sig && sig.side === "buy") { const s2 = sgBuyState(sig, a.quote); now = `<b class="sg-g sg-${sig.grade}">${sig.grade} 级买点</b> ${esc(sig.date.slice(5))} 收盘确认：买入区间 <b>${sgPx(sig.zone[0])}–${sgPx(sig.zone[1])}</b>、止损 <b>${sgPx(sig.stop)}</b>、止盈 <b>${sgPx(sig.take)}</b> —— <b>${esc(s2[0])}</b>${sig.grade === "A" ? "（A 级只作参考，不买）" : ""}`; }
    else if (sig && sig.side === "sell") now = `<b class="sg-g sg-S">S 级卖点</b> ${esc(sig.date.slice(5))} 收盘确认（四项全部转弱）：${sig.bars_since >= 1 ? "已经过去几天，持有的应已卖出" : "持有的下一个交易日开盘卖"}`;
    else if (H.pending) now = `<b class="sg-g sg-${H.pending.grade}">${H.pending.grade} 级买点</b> ${esc(H.pending.d.slice(5))} 收盘刚出现：下一个交易日开盘在 ${sgPx(H.pending.zone[0])}–${sgPx(H.pending.zone[1])} 内才算买入（执行池外，仅参考）`;
    else now = `<b>等待</b>：最近没有 S 级信号。要等它站上 20/60 日线、放量突破或回踩确认、五项全满分才出买点。`;
    const rows = [...(S.trades || []).map((t) => ({ d: t.sd, h: `<tr><td>${esc(t.sd.slice(2))}</td><td>${esc(t.bd.slice(5))} ${sgPx(t.bp)}</td><td>${esc(t.xd.slice(5))} ${sgPx(t.xp)}<span class="note">${esc(t.why)} · ${t.days} 天</span></td><td class="n ${cls(t.ret)}"><b>${pct(t.ret * 100, 2)}</b></td></tr>` })),
      ...(S.skips || []).map((t) => ({ d: t.sd, h: `<tr class="sg-dim"><td>${esc(t.sd.slice(2))}</td><td colspan="2">没买：${esc(t.why)}（开盘 ${sgPx(t.op)}${t.zone ? `，区间 ${sgPx(t.zone[0])}–${sgPx(t.zone[1])}` : ""}）</td><td class="n">—</td></tr>` }))]
      .sort((x, y) => (x.d < y.d ? 1 : -1));
    const SHOW = 6;
    const tbl = rows.length ? `<div class="tablewrap"><table class="tbl sg-tbl"><tr><th>确认日</th><th>买入</th><th>卖出</th><th>这笔</th></tr>${rows.slice(0, SHOW).map((r) => r.h).join("")}</table></div>
      ${rows.length > SHOW ? `<details class="sg-more"><summary>更早的 ${rows.length - SHOW} 次</summary><div class="tablewrap"><table class="tbl sg-tbl">${rows.slice(SHOW).map((r) => r.h).join("")}</table></div></details>` : ""}` : "";
    const pool = (D.G && D.G.pool) || {}, from = (H.from || "").slice(0, 7);
    const head = inPool ? "" : `<div class="sg-out">这只不在 S 级系统盯的名单里（market-pulse 执行池：A股 ${(pool.CN || {}).exec || 34} 只、港股 ${(pool.HK || {}).exec || 3} 只、美股 ${(pool.US || {}).exec || 58} 只）。<a href="#/picks/${mk === "US" ? "us" : "cn"}">看名单和今天的 S 级买卖点 ›</a>
      <div class="muted small" style="margin-top:4px">下面是<b>执行池外，仅参考</b>：按同一套规则在这只票${from ? " " + from + " 以来" : "近 2 年多"}的日K上现算，系统本身不会对它出信号。</div></div>`;
    return `${head}<div class="nowline">📍 <b>现在</b>　${now}</div>
      <div class="kv sg-k"><div><span>${esc(from)} 起 S 级买点</span><b>${S.signals || 0} 次</b><span>买了 ${st.n} 次${(S.skips || []).length ? `、${S.skips.length} 次开盘不在区间没买` : ""}</span></div>
        <div><span>胜率</span><b>${st.n ? f(st.win * 100, 0) + "%" : "—"}</b><span>${st.n ? `赚 ${Math.round(st.win * st.n)} 次 / 亏 ${st.n - Math.round(st.win * st.n)} 次` : "还没成交过"}</span></div>
        <div><span>平均每笔（扣费后）</span><b class="${cls(st.avg)}">${st.n ? pct(st.avg * 100, 2) : "—"}</b><span>${st.n ? `加起来 ${pct(st.sum * 100, 1)}` : "&nbsp;"}</span></div>
        <div><span>当前状态</span><b>${sig && sig.side === "sell" ? "S 级卖点" : S.open ? "持有中" : sig ? (sig.grade === "S" ? (sig.bars_since ? "S 级·已错过" : "S 级买点") : "A 级参考") : H.pending ? "刚出信号" : "等待"}</b><span>${inPool ? "执行池内" : "执行池外，仅参考"}</span></div></div>
      ${tbl}
      ${A_.stat && A_.stat.n ? `<p class="muted small">A 级（条件少一项，只作参考）：同期成交 ${A_.stat.n} 次，胜率 ${f(A_.stat.win * 100, 0)}%，平均每笔 ${pct(A_.stat.avg * 100, 2)}。</p>` : ""}
      <div class="how">🔎 <b>怎么算的</b>　S 级＝站上 20/60 日线、均线向上、MACD 转强、放量突破或回踩确认，五项全满分；收盘确认后<b>下一个交易日开盘价在买入区间内才买</b>（区间＝信号收盘价 ± 半个止损距离，跳出去就不追），照原计划卖：止损 1.5 倍日均波动（1.5%~8%）、止盈 2 倍止损、最多 10 个交易日、转弱就卖；扣佣金、印花税和 0.1% 滑点。图上 <b style="color:#b45309">⭐买▲</b> / <b>⭐卖▼</b>（红赚绿亏）就是这些成交，淡色 ⭐没买 是开盘不在区间的。
        单只票几笔交易看不出好坏：整个执行池回测每笔只有 +0.17%、比直接拿着少 0.25 个点。${sgRep}</div>`;
  }
  async function sgStock(a, tok) {
    const box = $("#sgcard"); if (!box) return;
    const D = await sgData(); if (tok !== routeTok || !$("#sgcard")) return;
    const code = sgCode(a.sym), G = D.G || {}, inPool = (G.pool_list || []).some((x) => x.code === code);
    const sig = (G.items || []).find((x) => x.code === code) || null;
    let H = null;
    if (inPool) H = await sgJ(`../s_hist/${code}.json`);
    if (tok !== routeTok || !$("#sgcard")) return;
    if (!H) {
      try { H = sgLive(a.kfull || a.chart, /^(sh|sz)/.test(a.sym), a.sym); } catch (e) { console.error(e); H = null; }
    }
    if (!H) { box.innerHTML = `<div class="muted small">日K不够长（至少要 150 根），算不了 S 级记录。${inPool ? "" : `这只也不在 S 级系统盯的名单里。<a href="#/picks/cn">看名单 ›</a>`}</div>`; return; }
    box.innerHTML = sgCardHtml(a, H, sig, D, inPool && !H.live);
    SGM = sgMarks(H, sig && sig.grade === "S" && sig.side === "buy" && !sig.bars_since ? sig : null);
    if (window.echarts && $("#kc")) drawK();
  }

  // ---------- 今日买卖点 ----------
  async function picks(market) {
    const tok = ++routeTok;
    document.title = "今日买卖点 · 小七个股透视";
    const tabs = `<div class="tools" style="margin:6px 0 10px"><a class="chip ${market === "cn" ? "on" : ""}" href="#/picks/cn">A股（全市场）</a><a class="chip ${market === "us" ? "on" : ""}" href="#/picks/us">美股（标普500+纳指100）</a></div>`;
    const mpP = fetch(`mp_${market}.json?t=${Math.floor(Date.now() / 60000)}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
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
    const MPD = await mpP; if (tok !== routeTok) return;
    MPV = { D: MPD, pool: MPD ? Object.keys(MPD.pools)[0] : null, market };
    const V2 = R.v2 || null;
    const w = (s) => (!s || s.win == null ? "—" : f(s.win, 0) + "%");
    const m = (s) => (!s || s.mean == null ? "—" : pct(s.mean, 1));
    const rules = R.rules.map((x) => x.key === "topflow" ? `<tr><td>${x.name}</td><td>${x.side}</td><td colspan="3" class="note">需要资金数据，没法回测，只作参考</td><td>参考</td></tr>` :
      `<tr><td title="${esc(x.desc)}">${x.name}</td><td>${x.side}</td><td class="n">${m(x.w120)} / ${w(x.w120)}<span class="note">（${(x.w120 || {}).n || 0}次）</span></td><td class="n">${m(x.w250)} / ${w(x.w250)}</td><td class="n">${m(x.all)} / ${w(x.all)}</td><td>${x.valid ? "✅" : x.valid === false ? "❌" : "样本少"}</td></tr>`).join("");
    const B = R.base;
    const row = (x, sell) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a><div class="note">${esc(x.code)}</div></td><td class="n">${f(x.price, x.price > 100 ? 2 : 3)}<div class="note ${cls(x.pct)}">${pct(x.pct)}</div></td>
      <td>${x.signals.map(esc).join("、")}<div class="note">${x.verified ? "✅ 规则当前有效" : sell ? "参考" : "⚠️ 规则近期未验证"}</div></td><td class="n ${cls(x.score)}">${x.score > 0 ? "+" : ""}${x.score}</td><td>${esc(x.behavior)}</td>
      <td>${sell ? `${vtag(x)}<div class="note">20日 ${pct(x.r20, 1)}</div>` : `${vtag(x)}<div class="note">止损 ${f(x.stop)}</div>`}</td></tr>`;
    const rescan = r.static ? `<div class="muted small" style="margin-top:4px">📌 这是每天定时扫描的结果（扫描于 ${esc(R.computed_at)}），网页版不能在线重新扫描；点股票名进个股透视看的是实时分析。</div>`
      : `　<a href="javascript:void(0)" id="rescan">重新扫描</a>`;
    const oldHtml = `<h2>旧版形态买点（触发规则≠推荐买入，以「个股结论」列为准）</h2><div class="card tablewrap">${R.buys.length ? `<table class="tbl"><tr><th>股票</th><th>现价</th><th>触发</th><th>综合分</th><th>主力行为</th><th>个股结论</th></tr>${R.buys.map((x) => row(x, false)).join("")}</table>` : "今天没有触发买点规则、且主力没在出货的股票。"}
        <div class="muted small">已排除主力在出货（高位派发/出逃/资金离场）的股票。点名字看完整个股透视。</div></div>
      <h2>🟩 卖点（持有的考虑减仓/止盈）</h2><div class="card tablewrap">${R.sells.length ? `<table class="tbl"><tr><th>股票</th><th>现价</th><th>触发</th><th>综合分</th><th>主力行为</th><th>个股页结论</th></tr>${R.sells.map((x) => row(x, true)).join("")}</table>` : "今天没有触发卖点规则的股票。"}</div>
      <h2>这些规则还灵不灵</h2><div class="card tablewrap"><table class="tbl"><tr><th>规则</th><th>方向</th><th>近120日 平均/胜率</th><th>近250日</th><th>近3年</th><th>当前有效</th></tr>${rules}
        <tr><td>全部股票全部日子（基准）</td><td>—</td><td class="n">${m(B.w120)} / ${w(B.w120)}</td><td class="n">${m(B.w250)} / ${w(B.w250)}</td><td class="n">${m(B.all)} / ${w(B.all)}</td><td>—</td></tr></table>
        <div class="muted small">把每条规则放到整个股票池过去 3 年的每一天去算：信号出现后持有 20 个交易日，平均涨跌和上涨概率是多少。<b>“当前有效”只看最近 120 个交易日是否跑赢同期基准</b>，每天滚动重算——市场风格变了，规则会自动被标成失效。鼠标停在规则名上可以看规则定义。</div></div>`;
    const head = `<h1>🎯 今日买卖点</h1>${tabs}
      <div class="muted">数据日期 ${esc(R.date)}${R.intraday ? "（盘中数据，收盘后结果会变）" : ""}｜扫描于 ${esc(R.computed_at)}${rescan}</div>`;
    const TR = market === "cn" ? R.trend : null;
    if (TR && V2 && V2.lab && V2.lab.verdict_bt) TR.bt = V2.lab.verdict_bt;
    const jump = `<div class="chips" style="margin:6px 0"><a class="chip" href="javascript:void(0)" data-j="sgh">⭐ S 级买卖点</a>${MPD ? '<a class="chip" href="javascript:void(0)" data-j="mp">🧪 全市场规则买卖点</a>' : ""}${V2 ? '<a class="chip" href="javascript:void(0)" data-j="v2list">🧺 分散组合前 ' + ((V2.signals || {}).top || 20) + "（测试中）</a>" : ""}<a class="chip" href="javascript:void(0)" data-j="near">🔜 接近买卖点</a><a class="chip" href="javascript:void(0)" data-j="v1">🎯 规则买卖点</a>${market === "cn" && TR ? '<a class="chip" href="javascript:void(0)" data-j="trendlist">📈 趋势偏多不在组合</a>' : ""}${market === "cn" ? '<a class="chip" href="javascript:void(0)" data-j="why">❓ 为什么和个股页不一样</a>' : ""}</div>`;
    app.innerHTML = head + jump + `<h2 id="sgh">⭐ S 级买卖点（右侧确认）</h2><div class="card sg-box" id="sgbox"><div class="muted small">正在读取 S 级买卖点…</div></div>` + `<div id="mpwrap">${mpHtml()}</div>` + sumHtml(R, V2, market) + lookupHtml(TR) + (V2 ? v2Html(V2, market) : `<div class="card muted">v2 选股系统的结果还没生成（需要先跑一次导出）。下面是旧版规则扫描。</div>`) + nearHtml(R) + trendHtml(TR) + (market === "cn" ? WHY : "") +
      `<details class="card" id="v1" ${V2 ? "" : "open"}><summary><b>旧版：形态规则扫描（v1，仅作参考）</b>　<span class="muted small">股票池 ${R.universe} 只，流动性达标 ${R.valid} 只，今天触发 ${R.triggered} 只${R.stale_v1 ? "｜⚠️ 今天的旧版扫描没跑成（数据源连不上），沿用 " + esc(R.computed_at) + " 的名单，「个股结论」列已按今天的口径刷新" : ""}${V2 && V2.lab && V2.lab.old_note ? "｜" + esc(V2.lab.old_note) : ""}</span></summary>${oldHtml}</details>
      <p class="disclaimer">v2 名单是按历史统计规律打分的结果，样本外回测也不保证未来；买之前先点进个股透视看完整结论，总仓位服从每天报告给出的仓位上限。仅供研究参考，不构成投资建议。</p>`;
    if ($("#rescan")) $("#rescan").onclick = async () => { await api("screen", { force: 1, market }); picks(market); };
    lookupBind(TR); mpBind(); sgPicks(market, tok);
    app.querySelectorAll("[data-j]").forEach((a) => { a.onclick = () => { const el = document.getElementById(a.dataset.j); if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView({ behavior: "smooth" }); } }; });
    if (V2 && V2.lab && V2.lab.curves) {
      try { await lib(); } catch (e) { return; }
      if (tok !== routeTok) return;
      drawV2(V2.lab);
    }
  }

  // ---------- 全市场规则买卖点（mp_scan.py → mp_cn.json / mp_us.json） ----------
  let MPV = null;
  const MPST = { pass: ["✅ 通过", "mp-pass"], fail: ["❌ 未通过", "mp-fail"], insufficient: ["样本不足", "mp-ins"], baseline: ["对照", "mp-ins"] };
  function mpHtml() {
    const D = MPV && MPV.D, cn = MPV && MPV.market === "cn";
    if (!D) return `<h2 id="mp">🧪 全市场规则买卖点</h2><div class="card muted">全市场规则扫描（stockscope/mp_scan.py）今天的结果还没生成，下次每日更新后出现。</div>`;
    const P = MPV.pool, pools = Object.keys(D.pools);
    const nm = (p) => ({ big: "大盘", small: "中小盘", us: "美股" }[p] || p);
    const rules = D.rules.filter((r) => r.stats[P]);
    const base = rules.find((r) => r.baseline), bx = base ? base.stats[P].all.ex : null;
    const npass = (p) => D.rules.filter((r) => !r.baseline && r.stats[p] && r.stats[p].valid === "pass").length;
    const nrule = D.rules.filter((r) => !r.baseline).length;
    const buysP = D.buys.filter((b) => b.pool === P), okB = buysP.filter((b) => b.valid === "pass");
    const kv = (j, n, t, sub) => `<a href="javascript:void(0)" data-j="${j}" class="mp-kvbox"><span class="muted small">${t}</span><b>${n}</b><span class="muted small">${sub}</span></a>`;
    const ptab = pools.length > 1 ? `<div class="tools">${pools.map((p) => `<button data-mpp="${p}" class="${p === P ? "on" : ""}">${esc(D.pool_names[p])} · ${D.pools[p]} 只</button>`).join("")}</div>` : "";
    const s2 = (S, k) => (S && S.n ? (k === "t" ? (S.t == null ? "—" : sgn(S.t, 1)) : pct(S[k], 2)) : "—");
    const trs = rules.map((r) => {
      const S = r.stats[P], A_ = S.all, st = MPST[S.valid];
      return `<tr class="${S.valid === "pass" ? "" : "mp-dim"}${r.baseline ? " mp-base" : ""}"><td title="${esc(r.rule)}"><b>${esc(r.name)}</b><div class="note">${esc(r.rule)}</div></td><td><span class="tag ${st[1]}">${st[0]}</span></td>
        <td class="n">${A_.n || 0}</td><td class="n">${A_.n ? f(A_.win, 0) + "%" : "—"}</td><td class="n ${cls(A_.ret)}">${s2(A_, "ret")}</td><td class="n ${cls(A_.ex)}"><b>${s2(A_, "ex")}</b></td><td class="n ${cls(A_.exg)}">${s2(A_, "exg")}</td>
        <td class="n ${cls(bx == null || !A_.n ? null : A_.ex - bx)}">${r.baseline || bx == null || !A_.n ? "—" : (A_.ex - bx >= 0 ? "+" : "") + f(A_.ex - bx, 2) + "%"}</td><td class="n">${s2(A_, "t")}</td>
        <td class="n">${s2(S.first, "ex")} / ${s2(S.second, "ex")}</td><td class="n">${s2(S.w250, "ex")} / ${s2(S.w120, "ex")}</td></tr>`;
    }).join("");
    const G = (D.grades || {})[P] || {};
    const gl = "SABC".split("").map((g) => (G[g] && G[g].n ? `${g} 级 ${G[g].n} 笔、平均超额 <b class="${cls(G[g].ex)}">${pct(G[g].ex, 2)}</b>` : "")).filter(Boolean).join("；");
    const byRule = {};
    for (const b of buysP) (byRule[b.rule] = byRule[b.rule] || []).push(b);
    const btr = (b) => `<tr><td><a href="#/s/${b.sym}">${esc(b.name)}</a><div class="note">${esc(b.sym.replace(/^(sh|sz|us)/, ""))}</div></td><td class="n">${f(b.price, b.price > 100 ? 2 : 3)}<div class="note ${cls(b.pct)}">${pct(b.pct)}</div></td>
      <td class="n"><b>${b.grade || "—"}</b><div class="note">${b.score ?? ""} 分</div></td><td class="n">${f(b.stop, b.stop > 100 ? 2 : 3)} / ${f(b.take, b.take > 100 ? 2 : 3)}<div class="note">−${f(b.stop_pct, 1)}% / +${f(b.take_pct, 1)}%</div></td><td class="n">${b.hold} 根</td></tr>`;
    const bhead = "<tr><th>股票</th><th>收盘</th><th>信号质量</th><th>参考止损 / 止盈</th><th>最长</th></tr>";
    const groups = rules.filter((r) => !r.baseline && byRule[r.key]).map((r) => {
      const xs = byRule[r.key], v = r.stats[P].valid, st = MPST[v];
      return `<details class="card mp-grp ${v === "pass" ? "" : "mp-off"}" ${v === "pass" ? "open" : ""}><summary><b>${esc(r.name)}</b> · ${xs.length} 只 <span class="tag ${st[1]}">${v === "pass" ? "✅ 通过检验" : v === "fail" ? "未通过检验，仅参考" : "样本不足，仅参考"}</span></summary>
        <div class="muted small">交易计划：${esc(r.plan)}；指标退出：${esc(r.exit)}</div>
        <div class="tablewrap"><table class="tbl">${bhead}${xs.slice(0, 20).map(btr).join("")}</table>${xs.length > 20 ? `<details><summary class="small">展开其余 ${xs.length - 20} 只</summary><table class="tbl">${bhead}${xs.slice(20).map(btr).join("")}</table></details>` : ""}</div></details>`;
    }).join("");
    const ex = D.exits.filter((x) => x.pool === P);
    const etr = (x) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a><div class="note">${esc(window.MPRules ? window.MPRules.RULES[x.rule][0] : x.rule)}</div></td><td class="n">${esc(x.buy_d)}<div class="note">${f(x.entry, x.entry > 100 ? 2 : 3)}</div></td>
      <td class="n ${cls(x.pnl)}">${pct(x.pnl, 1)}</td><td><b>${esc(x.when)}</b> ${esc(x.why)}</td></tr>`;
    const oldTxt = D.old && D.old.universe ? `原来的买卖点扫描只看 ${cn ? "市值前 " + D.old.universe : "常用 " + D.old.universe} 只，` : "";
    const verdictTxt = npass(P) ? `${nm(P)}里有 ${npass(P)} 条规则通过检验，它们今天的买点默认展开。` :
      `<b>${nm(P)}里 ${nrule} 条规则在我们的口径下都没通过检验</b>：扣成本后平均每笔都跑输同池等权${bx != null ? `（随便买同样的止损止盈是 ${pct(bx, 2)}/笔，多数规则只比它好一点或更差）` : ""}。所以今天的买点全部折叠、标「仅参考」——这不是数据没加载，是规则本身扣成本后没有超额。`;
    return `<h2 id="mp">🧪 全市场规则买卖点（吸收 market-pulse 12 套规则）</h2>
      <div class="card"><div class="mp-kvs">${kv("mp", D.scanned, "今日扫描", cn ? `大盘 ${D.pools.big} · 中小盘 ${D.pools.small}（参与检验）` : `参与检验 ${D.pools.us} 只`)}
        ${kv("mpbuy", `${buysP.length}`, `今日买点 · ${nm(P)}`, `通过检验的 ${okB.length} 条`)}${kv("mpexit", ex.length, `持有提醒 · ${nm(P)}`, "按规则持有的该卖了")}
        ${kv("mp", `${npass(P)}/${nrule}`, `通过检验的规则 · ${nm(P)}`, pools.length > 1 ? pools.map((p) => `${nm(p)} ${npass(p)}`).join(" · ") : "前后两段+近250日都要成立")}</div>
        <div class="muted small" style="margin-top:8px">数据日期 <b>${esc(D.date)}</b>｜扫描于 ${esc(D.computed_at)}｜用时 ${D.seconds} 秒｜${oldTxt}现在扫${cn ? "全部 A股（沪深主板+创业板+科创板，剔除 ST）" : "标普500+纳指100"}共 ${D.universe} 只、有日K ${D.scanned} 只；参与检验和今日买点的要求当天有成交、上市满 120 根、近 20 日日均成交额 ≥${cn ? "5000 万元" : "2000 万美元"}。</div>
        ${D.offline ? `<div class="small" style="margin-top:6px;color:var(--warn,#b45309)">⚠️ 这次运行时行情接口不通，全部用本机缓存的日K，数据日期停在 ${esc(D.date)}；${D.stale ? `${D.stale} 只没有这一天的K线，没参与今日买点。` : ""}${!cn && D.universe < 400 ? "美股名单本该约 520 只，缓存里只有 " + D.universe + " 只有日K。" : ""}</div>` : ""}
        <div class="vr">${verdictTxt}</div></div>
      ${ptab}
      <div class="card tablewrap"><b>这些规则灵不灵（${esc(D.pool_names[P])}，${esc(D.period[0])} ~ ${esc(D.period[1])}）</b>
        <table class="tbl mp-rt"><tr><th>规则</th><th>结论</th><th>笔数</th><th>胜率</th><th>平均净收益</th><th>超额<span class="note">扣成本</span></th><th>扣成本前</th><th>比随便买</th><th>t</th><th>前段 / 后段<span class="note">超额</span></th><th>近250日 / 近120日</th></tr>${trs}</table>
        <div class="muted small">${esc(D.method)} 前后两段以 ${esc(D.split)} 分界；近 250 日从 ${esc(D.w250)}、近 120 日从 ${esc(D.w120)} 起（按信号日）。「比随便买」＝该规则超额 − 随便买同样交易计划的超额，看信号本身有没有一点东西。</div>
        ${gl ? `<div class="muted small" style="margin-top:4px">信号质量分级的实际表现（全部规则合计）：${gl}。${esc(D.grade_note)}</div>` : ""}</div>
      <h2 id="mpbuy">今日买点（按规则分组，${esc(nm(P))}）</h2>${groups || '<div class="card muted">今天这个池子没有规则触发买点。</div>'}
      <details class="card" id="mpexit"><summary><b>🟩 持有提醒：按规则买入的仓位该卖了（${ex.length}${D.n_exits > D.exits.length ? `，每条规则最多列 40 条，全部 ${D.n_exits} 条` : ""}）</b></summary>
        <div class="muted small">「明天开盘」＝今天收盘出现指标退出或到了最长持有期；「今天已触发」＝今天盘中碰到了止损/止盈。只对按这条规则买入的人有意义。</div>
        <div class="tablewrap"><table class="tbl"><tr><th>股票 / 规则</th><th>买入日 / 价</th><th>盈亏</th><th>怎么做</th></tr>${ex.slice(0, 60).map(etr).join("")}</table></div></details>
      <details class="card"><summary><b>口径与局限</b></summary><ul class="muted small" style="margin:6px 0;padding-left:18px">${(D.caveats || []).map((c) => `<li>${esc(c)}</li>`).join("")}
        <li>规则、指标退出、保护价（固定 3%/6%/10 根；综合判断用 1.5×ATR、2R、10 根）和 S/A/B/C 分级照抄 market-pulse，成交与成本换成我们的口径；个股页的标注用同一份算法在浏览器里重算（与 Python 抽 50 只逐笔比对一致）。</li></ul></details>`;
  }
  function mpBind() {
    const w = $("#mpwrap"); if (!w) return;
    w.querySelectorAll("[data-mpp]").forEach((b) => { b.onclick = () => { MPV.pool = b.dataset.mpp; w.innerHTML = mpHtml(); mpBind(); }; });
    w.querySelectorAll("[data-j]").forEach((a) => { a.onclick = () => { const el = document.getElementById(a.dataset.j); if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView({ behavior: "smooth" }); } }; });
  }
  // ---------- 一眼看清今天有多少 + 为什么少；接近买点/卖点（离触发 ≤3%，screener.near_at 算） ----------
  function sumHtml(R, V2, market) {
    const cn = market === "cn", S = (V2 && V2.signals) || {};
    const rules = (R.rules || []).filter((x) => x.key !== "topflow");
    const ok = rules.filter((x) => x.valid), okB = ok.filter((x) => x.side === "买");
    const NC = R.near_counts || {}, nb = (NC.pullback || 0) + (NC.breakout || 0) + (NC.oversold || 0), ns = NC.breakdown || 0;
    const want = cn ? 1000 : 146;
    const warn = [];
    if (R.stale_v1) warn.push(`今天的规则扫描没跑成，沿用 ${esc(R.computed_at)} 的名单`);
    if (R.universe && R.universe < want * 0.95) warn.push(`股票池只拿到 ${R.universe} 只（设计 ${want} 只）`);
    if (R.analyze_failed) warn.push(`触发的 ${R.triggered} 只里有 ${R.analyze_failed} 只完整分析失败、没列出来`);
    if (R.universe_src && R.universe_src !== "live") warn.push(`股票池名单用的是${esc(R.universe_src.replace(/^cache /, "缓存 "))}，市值排名可能差一天`);
    const kv = (j, n, t, sub) => `<a href="javascript:void(0)" data-j="${j}" style="display:block;color:inherit;background:var(--bg);border-radius:10px;padding:8px 12px;text-decoration:none"><span class="muted small" style="display:block">${t}</span><b style="font-size:21px">${n}</b><span class="muted small" style="display:block">${sub}</span></a>`;
    const few = (R.buys || []).length + (R.sells || []).length < 8;
    return `<div class="card"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
        ${V2 ? kv("v2list", (S.buys || []).length, "🧺 分散组合", `v2 打分前 ${S.top || 20} 名`) : ""}
        ${kv("v1", `${(R.buys || []).length} / ${(R.sells || []).length}`, "🎯 规则买点 / 卖点", `触发 ${R.triggered} 只`)}
        ${kv("near", `${nb} / ${ns}`, "🔜 接近买点 / 卖点", `离触发 ≤${R.near_pct || 3}%`)}
        ${cn && R.trend ? kv("trendlist", R.trend.n_bull_out || 0, "📈 趋势偏多不在组合", "只当短线参考") : ""}</div>
      <div class="muted small" style="margin-top:8px">${few ? "<b>今天规则买卖点少，是因为规则严格，不是数据没加载：</b>" : ""}股票池 ${R.universe} 只全部扫过，流动性达标 ${R.valid} 只，
        8 条形态规则今天一共触发 ${R.triggered} 只${R.analyzed != null ? `（已全部完整分析 ${R.analyzed} 只）` : ""}；再排除主力在出货、综合分太弱的，剩下买点 ${(R.buys || []).length} 只。
        规则里近 120 个交易日回测还跑赢基准的只有 ${ok.length} 条（${ok.map((x) => esc(x.name)).join("、") || "无"}），其中买入规则 ${okB.length} 条。想多看几只，看上面的分散组合和下面的「接近买点」。</div>
      ${warn.length ? `<div class="small" style="margin-top:6px;color:var(--warn,#b45309)">⚠️ ${warn.join("；")}</div>` : ""}</div>`;
  }
  function nearHtml(R) {
    if (!R.near_buys && !R.near_sells) return `<h2 id="near">🔜 接近买点 / 卖点</h2><div class="card muted">这份扫描结果是旧版本生成的，还没有「接近买点」字段，下次每日更新后出现。</div>`;
    const ok = (x) => (x.valid ? '<span class="note">✅ 规则当前有效</span>' : x.valid === false ? '<span class="note">⚠️ 规则近 120 日回测没跑赢基准</span>' : '<span class="note">样本少</span>');
    const tr = (x) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a><div class="note">${esc(x.code)}</div></td>
      <td class="n">${f(x.price, x.price > 100 ? 2 : 3)}<div class="note ${cls(x.pct)}">${pct(x.pct)}</div></td>
      <td style="white-space:normal">${esc(x.rule)}<div>${ok(x)}</div>${x.need && x.key !== "oversold" ? `<div class="note">还需：${esc(x.need)}</div>` : ""}</td><td class="n"><b>${f(x.dist, 1)}%</b><div class="note">${x.side === "买" && x.key === "breakout" ? "涨到" : "跌到"} ${f(x.trigger, x.trigger > 100 ? 2 : 3)}</div></td></tr>`;
    const head = "<tr><th>股票</th><th>现价</th><th>差哪条规则</th><th>离触发</th></tr>";
    const NC = R.near_counts || {};
    const tot = (ks) => ks.reduce((a, k) => a + (NC[k] || 0), 0);
    const tb = (xs, nTot, empty) => (xs && xs.length ? `<table class="tbl">${head}${xs.slice(0, 15).map(tr).join("")}</table>${xs.length > 15 ? `<details><summary class="small">展开其余 ${xs.length - 15} 只</summary><table class="tbl">${head}${xs.slice(15).map(tr).join("")}</table></details>` : ""}${nTot > xs.length ? `<div class="note">一共 ${nTot} 只，每条规则最多列 15 只（规则当前有效的排前面，同一规则按离触发由近到远）。</div>` : ""}` : `<div class="muted">${empty}</div>`);
    return `<h2 id="near">🔜 接近买点（离触发 ≤${R.near_pct || 3}%）</h2><div class="card tablewrap">
        <div class="vr" style="margin-top:0">还没触发、但价格再走 ${R.near_pct || 3}% 以内就会触发的。<b>这不是买点</b>，只是提前放进自选、到价再看；规则判定口径和上面的买卖点完全一样，没有放松。</div>
        ${tb(R.near_buys, tot(["pullback", "breakout", "oversold"]), "今天没有离买点规则 3% 以内的股票。")}</div>
      <h2>🔜 接近卖点（离触发 ≤${R.near_pct || 3}%）</h2><div class="card tablewrap">${tb(R.near_sells, tot(["breakdown"]), "今天没有离卖点规则 3% 以内的股票。")}
        <div class="muted small" style="margin-top:6px">怎么算的：只对「主要靠一个价格门槛触发」的规则算距离——趋势回踩（回落到 20 日线上方 1.5% 内）、放量突破（涨过 60 日最高）、超跌低位（一天跌到 RSI(14)&lt;25 且在一年区间最低 15%）、放量破位（跌破 60 日线 1%，卖）；规则里的其他条件（均线排列、缩量等）今天已满足才列。成交量条件要到当天才知道，写在「还需要」里。底部启动、DMI 转多、顶背离、短期过热由指标交叉决定，算不出价格距离，不列。</div></div>`;
  }

  // ---------- v2：多因子选股 ----------
  const sgn = (v, d = 1) => (v == null ? "—" : (v >= 0 ? "+" : "") + (+v).toFixed(d));
  const vtag = (x) => (x && x.verdict ? `<span class="tag vtag ${esc(x.cls || "wait")}">${esc(x.verdict)}</span>` : '<span class="muted small">点进去看</span>');
  const WHY = `<h2 id="why">为什么个股结论和组合名单会不一样？</h2><div class="card"><ul style="margin:0;padding-left:18px">
    <li><b>两套东西回答的问题不同。</b>组合（v2）问的是「一篮子 20 只拿一个月，能不能比随便买好一点」；个股页的六组打分（趋势、动能、资金、量能、相对强弱、位置）问的是「这只股票现在走得强不强」。</li>
    <li><b>走得强 ≠ 之后涨得多。</b>把个股页的打分放到 A股市值前 1000 只、2021 年以来每一天去回测：分数越高，之后 20 天反而越弱；以前会说「可以考虑买入」的那些，之后 20 天平均跑输同期股票池约 1%（统计上站得住）。A股短期是「涨多了回落、跌多了反弹」的市场。</li>
    <li><b>组合挑的恰恰是最近跌过、走得平淡的股票</b>，所以点进去趋势视角多半「偏空」。回测里，入选股中趋势偏空的那部分并不比其他入选股差，所以不拿趋势去剔除它们。</li>
    <li><b>现在两边用同一套结论：</b>进了组合前 20 名 →「可以考虑买入（分散组合的一只）」；第 21–40 名 →「等待确认」（已持有的继续拿）；不在组合里 → 趋势偏空「不推荐买入」，其余「等待确认」——趋势再好也只是短线参考，因为历史上追涨没有超额。</li>
    <li>组合本身的超额也不显著（样本外每年比股票池等权多几个点，t≈1），它最大的用处是<b>分散</b>——不要因为看到「可以考虑买入」就单押一只。</li></ul></div>`;
  function trendHtml(T) {
    if (!T || !T.list) return "";
    const L = T.list, BT = T.bt || {};
    const tr = (x) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a><div class="note">${esc(x.code)}${x.why_out ? " · 不在股票池" : ""}</div></td>
      <td class="n ${cls(x.score)}">${sgn(x.score, 0)}<div class="note ${cls(x.r20)}">20日 ${pct(x.r20, 1)}</div></td><td>${esc(x.behavior)}${x.ff ? "" : '<div class="note">未含主力资金</div>'}</td>
      <td class="n">${x.v2rank ?? "—"}</td><td>${vtag(x)}</td></tr>`;
    const head = `<tr><th>股票</th><th>综合分</th><th>主力行为</th><th>组合名次</th><th>个股页结论</th></tr>`;
    return `<h2 id="trendlist">📈 趋势视角「偏多」但不在组合里（${L.length} 只）</h2><div class="card tablewrap">
      <div class="vr" style="margin-top:0">这些股票个股页的六组打分 ≥35（趋势偏多），以前会显示「可以考虑买入」。现在统一显示<b>「等待确认」</b>：${esc(BT.trend_buy || "回测里趋势强的股票之后反而跑输")}。想参与只用小仓位当短线看。</div>
      <div class="muted small" style="margin-bottom:6px">扫描 ${T.scanned || "—"} 只（今天市值前 ${T.universe || 1000}，含不在股票池的），偏多 ${(T.counts || {})["偏多"] || 0} / 中性 ${(T.counts || {})["中性"] || 0} / 偏空 ${(T.counts || {})["偏空"] || 0}｜前 ${T.ff_top} 名补了东财主力资金${T.ff_n ? `（拿到 ${T.ff_n} 只）` : "（今天没拿到，主力行为用量价推算）"}，其余只用日K，所以综合分和个股页可能差几分，结论一样。</div>
      <table class="tbl">${head}${L.slice(0, 30).map(tr).join("")}</table>
      ${L.length > 30 ? `<details><summary class="small">展开其余 ${L.length - 30} 只</summary><table class="tbl">${head}${L.slice(30).map(tr).join("")}</table></details>` : ""}</div>`;
  }
  function lookupHtml(T) {
    if (!T || !T.all) return "";
    return `<div class="card"><b>🔍 查一只：它在组合里吗？个股页会怎么说？</b>
      <div class="lk"><input id="lkq" placeholder="输入名称或代码，如 威高血净 / 603014" autocomplete="off"></div><div id="lkres" class="lkres muted small">在今天市值前 ${T.universe || 1000} 的 A股里查（${esc(T.date || "")} 收盘）。</div></div>`;
  }
  function lookupBind(T) {
    const inp = $("#lkq"); if (!inp || !T || !T.all) return;
    const rows = Object.entries(T.all).map(([sym, a]) => ({ sym, code: sym.slice(2), name: a[0], score: a[1], trend: a[2], verdict: a[3], cls: a[4], v2rank: a[5], why: a[6] }));
    inp.oninput = () => {
      const v = inp.value.trim().toLowerCase(), box = $("#lkres");
      if (!v) { box.innerHTML = "输入名称或代码。"; return; }
      const hit = rows.filter((r) => r.name.toLowerCase().includes(v) || r.code.includes(v) || r.sym.includes(v)).slice(0, 8);
      box.innerHTML = hit.length ? `<table class="tbl"><tr><th>股票</th><th>组合</th><th>趋势</th><th>个股页结论</th></tr>${hit.map((r) => `<tr><td><a href="#/s/${r.sym}">${esc(r.name)}</a><div class="note">${esc(r.code)}</div></td>
        <td>${r.v2rank ? `第 ${r.v2rank} 名${r.v2rank <= 20 ? " ✅" : r.v2rank <= 40 ? "（缓冲区）" : " ❌"}` : `不在股票池<div class="note">${esc(r.why || "")}</div>`}</td><td>${esc(r.trend)} ${sgn(r.score, 0)}</td><td>${vtag(r)}</td></tr>`).join("")}</table>
        <div class="note">为什么没进推荐：组合只认 v2 前 20 名；趋势偏多但不在前 20 的一律「等待确认」（历史上追涨没有超额）；不在股票池的（成交额不到 1 亿、上市不满一年）不参与组合打分。</div>`
        : `没找到。这里只有今天市值前 ${T.universe || 1000} 的 A股（不含 ST），其他股票请直接在顶部搜索框查。`;
    };
  }
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
    const cn = market === "cn";
    const buys = (S.buys || []).map((x) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a> <span class="note" style="display:inline">${esc(x.code)}${x.limit_up ? " · 今日涨停" : ""}</span>
      <div class="note">${esc(x.reason || "—")}</div></td>
      <td class="n">${f(x.price, x.price > 100 ? 2 : 3)}</td><td class="n">${x.rank}<div class="note">${sgn(x.score, 2)}</div></td>
      <td class="n">${f(x.weight * 100, 1)}%<div class="note">止损 ${f(x.stop)}</div></td>
      ${cn ? `<td>${vtag(x)}<div class="note">趋势${esc(x.trend || "—")}${x.tscore != null ? " " + sgn(x.tscore, 0) : ""}</div></td>` : ""}</tr>`).join("");
    const ps = (S.pool_sells || []).map((x) => `<tr><td><a href="#/s/${x.sym}">${esc(x.name)}</a><div class="note">${esc(x.code)}</div></td><td class="n">${f(x.price, x.price > 100 ? 2 : 3)}</td>
      <td class="n">${x.prev_rank} → ${x.rank ?? "停牌/出池"}</td><td class="n ${cls(x.chg)}">${x.chg == null ? "—" : pct(x.chg * 100, 1)}</td>${cn ? `<td>${vtag(x)}</td>` : ""}</tr>`).join("");
    const wt = S.exposure_cap != null ? f(S.exposure_cap * 100 / (S.top || 20), 1) + "%" : "仓位上限 ÷ " + (S.top || "N");
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
      <h2 id="v2list">🧺 分散组合（每月调仓，一篮子 ${S.top || 20} 只）<span class="tag" style="margin-left:6px;font-size:12px;background:#fff1e0;color:#b45a00;padding:1px 6px;border-radius:5px">测试中，不作为买卖依据</span></h2><div class="muted small" style="margin:-6px 0 8px">11-23 起买卖依据改看 market-pulse 的 S 级买卖点（<a href="../#/todo">今天该做什么 ›</a>）；这个组合样本外超额不显著，只留作测试记录。</div>${cn ? '<div class="muted small" style="margin:-6px 0 8px"><a href="../#/race">🏇 这套组合正在「策略赛马」里和随便买、宽基ETF 等对手每天实盘记账比成绩 ›</a></div>' : ""}<div class="card tablewrap">
        <div class="vr" style="margin-top:0">${cn ? `为什么这些股票点进去走势多半偏弱？因为组合就是按「<b>最近 5 天跌过、波动小、换手低、市值偏小</b>」打分挑出来的——A股 1–4 周有反转效应，这类股票整篮子拿一个月，历史上略好于随便买（不显著）。所以它们在个股页的「趋势视角」多数是偏空，这不是矛盾；要买就整篮子分散买，单只≈${wt}，别只挑一两只。`
          : "美股名单只作参考：样本外没跑赢股票池等权，想要美股暴露直接拿指数 ETF 更好。"}</div>
        <div class="muted small" style="margin-bottom:6px">数据日期 ${esc(S.date || "")}${S.intraday ? "（盘中数据，收盘后名单可能变）" : ""}｜参与打分 ${S.pool || "—"} 只｜当前仓位上限 ${capTxt}，单只建议权重＝仓位上限 ÷ ${S.top || "N"}</div>
        ${buys ? `<table class="tbl"><tr><th>股票 / 主要驱动</th><th>现价</th><th>排名</th><th>权重</th>${cn ? "<th>个股页结论</th>" : ""}</tr>${buys}</table>` : "今天没有结果。"}
        <div class="muted small" style="margin-top:6px">${esc(S.rules || "")}</div></div>
      <h2>🟩 卖出 / 减仓</h2><div class="card tablewrap">${ps ? `<div class="muted small">上一个调仓日（${esc(S.prev_date || "")}）的前 ${S.top} 名里，今天排名跌出前 ${2 * (S.top || 0)} 的——如果按名单持有，下个调仓日卖出：</div>
        <table class="tbl"><tr><th>股票</th><th>现价</th><th>排名 上期→今天</th><th>期间涨跌</th>${cn ? "<th>个股页结论</th>" : ""}</tr>${ps}</table>` : `<div class="muted">上一个调仓日（${esc(S.prev_date || "")}）的前 ${S.top || "N"} 名今天都还在前 ${2 * (S.top || 0)}，没有要卖的。</div>`}
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
    liveStop();
    while (charts.length) { const c = charts.pop(); if (!c.isDisposed()) c.dispose(); }
    const h = location.hash.replace(/^#\/?/, "").split("/");
    document.querySelectorAll("#nav a[data-k]").forEach((a) => a.classList.toggle("on", a.dataset.k === (h[0] === "picks" ? "picks" : "stock")));
    if (h[0] === "s" && /^us[A-Za-z\-]+$/.test(decodeURIComponent(h[1] || ""))) { // 美股没带交易所后缀（学堂 / S 级名单里是 usAMD）：先解析成 usAMD.OQ
      const t = decodeURIComponent(h[1]).slice(2), tok = ++routeTok;
      app.innerHTML = `<div class="loadbox">正在查找 ${esc(t)} …</div>`;
      api("resolve", { q: t }).then((r) => { if (tok !== routeTok) return; if (r && r.sym && r.sym.includes(".")) location.replace("#/s/" + r.sym); else stock("us" + t); }).catch(() => { if (tok === routeTok) stock("us" + t); });
    }
    else if (h[0] === "s" && h[1]) stock(decodeURIComponent(h[1]));
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
