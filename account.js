/* 虚拟账户页（按需加载）：读 paper.json（paper.py report 生成） */
(function () {
  const A = window.__APP;
  const { app, $, esc, fmt, pct, updn, LOADING, FAIL, DISC, getJSON, need } = A;
  let SL = { core: "宽基", sector: "板块ETF", stock: "个股", v2: "选股组合", theme: "题材短线" };
  let CUR = "";
  const money = (v) => (v == null ? "—" : CUR + Number(v).toLocaleString("zh-CN", { maximumFractionDigits: 0 }));
  async function page() {
    document.title = "虚拟账户 · 小七投研";
    const tok = A.tok();
    const US = /^#\/account\/us/.test(location.hash);
    SL = US ? { core: "指数ETF", sector: "板块ETF", stock: "个股", theme: "题材" } : { core: "宽基", sector: "板块ETF", stock: "个股", v2: "选股组合", theme: "题材短线" };
    CUR = US ? "$" : "";
    const TABS = `<div class="subtabs"><a href="#/account" class="${US ? "" : "on"}">🇨🇳 A股账户（¥100万）</a><a href="#/account/us" class="${US ? "on" : ""}">🇺🇸 美股账户（$15万）</a></div>`;
    app.innerHTML = `<h1>💼 虚拟账户</h1>${TABS}${LOADING("读取账户…")}`;
    let P;
    try { P = await getJSON(US ? "paper_us.json" : "paper.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>💼 虚拟账户</h1>${TABS}${FAIL("账户数据暂未生成")}`; return; }
    if (!A.alive(tok)) return;
    const b = P.bench || {}, BN = P.bench_names || ["中证1000", "沪深300"];
    const kp = (k, v, cls = "", sub = "") => `<div><span>${k}</span><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
    const pos = (P.pos || []).map((r) => `<tr><td><a href="stock/#/s/${esc(r.sym)}">${esc(r.name)}</a><div class="note">${esc(r.sym.slice(2))} · ${SL[r.sleeve] || r.sleeve}</div></td>
      <td class="n">${r.qty}</td><td class="n">${fmt(r.cost, US ? 2 : 3)}<div class="note">现 ${r.px}</div></td><td class="n">${money(r.value)}<div class="note">${fmt(r.weight, 1)}%</div></td>
      <td class="n ${updn(r.pnl)}">${r.pnl >= 0 ? "+" : ""}${money(r.pnl)}<div class="note">${pct(r.pnl_pct, 2)}</div></td><td class="n">${r.stop || "—"}</td></tr>`).join("");
    const tr = (P.trades || []).slice(0, 40).map((t) => `<tr><td>${esc(t.date.slice(5))} ${esc(String(t.time).slice(0, 5))}</td><td class="${t.side === "买入" ? "up" : "dn"}">${esc(t.side)}</td>
      <td>${esc(t.name)}</td><td class="n">${t.qty} @ ${t.price}</td><td class="n">${money(t.amount)}</td><td class="small">${esc(SL[t.sleeve] || t.sleeve)}｜${esc(t.reason)}</td></tr>`).join("");
    app.innerHTML = `<h1>💼 虚拟账户 <span class="muted small">本金 ${money(P.init)}，${esc(P.open_date)} 开户</span></h1>${TABS}
      <div class="card moodcard"><div><b class="${updn(P.ret)}" style="font-size:26px">${pct(P.ret, 2)}</b><div class="small">总资产 ${money(P.equity)}｜同期 ${BN[0]} ${pct(b[BN[0]], 2)}、${BN[1]} ${pct(b[BN[1]], 2)}</div>
        <div class="muted small">更新于 ${esc(P.updated)}｜照每份报告「〇、结论」真实下单：按实时行情成交，${US ? "佣金0.03%+滑点，1股起买、可当天卖，只在美股正常交易时段（北京22:30–05:00）成交，盘外下单开盘执行" : "含佣金/印花税/滑点，100股一手、T+1、涨停买不进跌停卖不出"}。模拟盘，不构成投资建议。</div></div></div>
      <div class="kpis k4">${kp("仓位", fmt(P.exposure, 1) + "%", "", `上限 ${P.cap ?? "—"}%`)}${kp("现金", money(P.cash))}${kp("最大回撤", fmt(P.mdd, 2) + "%", "dn")}${kp("已实现盈亏", money(P.realized), updn(P.realized))}</div>
      <h2>净值走势</h2><div class="card chartcard"><div id="pnav" class="chart"></div><div class="note">红线 = 虚拟账户累计收益，虚线 = 指数同期；下方柱 = 每日仓位。</div></div>
      <h2>持仓（${(P.pos || []).length} 只）</h2><div class="card tablewrap">${pos ? `<table class="tbl"><tr><th>股票</th><th>数量</th><th>成本</th><th>市值/占比</th><th>浮盈</th><th>止损</th></tr>${pos}</table>` : '<div class="muted">空仓</div>'}
        <div class="note">${US ? "指数ETF/个股按报告止损价自动止损（只在美股交易时段检查）。" : "宽基、题材按报告止损价自动止损；选股组合（v2）每 20 个交易日调仓，止损价只作参考。"}</div></div>
      ${(P.pending || []).length ? `<h2>挂单（等回踩）</h2><div class="card">${P.pending.map((o) => `<div class="yr"><span>${o.side === "buy" ? "买入" : "卖出"} ${esc(o.sym.slice(2))}<em>${esc(o.reason || "")}</em></span><b>${o.side === "buy" ? "≤" + o.limit : ""}</b></div>`).join("")}<div class="note">价格回落到限价时自动成交（每次报告执行 check 时检查），过期自动撤单。</div></div>` : ""}
      <h2>成交记录</h2><div class="card tablewrap">${tr ? `<table class="tbl"><tr><th>时间</th><th>方向</th><th>股票</th><th>数量@价</th><th>金额</th><th>理由</th></tr>${tr}</table>` : '<div class="muted">还没有成交</div>'}</div>
      ${(P.closed || []).length ? `<h2>已清仓</h2><div class="card">${P.closed.map((c) => `<div class="yr"><span>${esc(c.name)}<em>${esc(c.open)} → ${esc(c.close)} · ${SL[c.sleeve] || c.sleeve}</em></span><b class="${updn(c.pnl)}">${c.pnl >= 0 ? "+" : ""}${money(c.pnl)}</b></div>`).join("")}</div>` : ""}
      ${DISC}`;
    const N = P.nav || [];
    if (N.length < 2) { $("#pnav").innerHTML = '<div class="empty">开户第一天，收盘记账后开始画净值曲线</div>'; return; }
    await need("lib");
    if (!A.alive(tok)) return;
    const x = N.map((r) => r.date.slice(5)), b0 = (k) => Number(N[0][k]);
    const c = echarts.init($("#pnav"));
    c.setOption({ grid: [{ left: 44, right: 12, top: 30, height: "58%" }, { left: 44, right: 12, top: "76%", height: "16%" }],
      legend: { top: 0, textStyle: { fontSize: 11 } }, tooltip: { trigger: "axis" },
      xAxis: [{ type: "category", data: x, gridIndex: 0, axisLabel: { show: false } }, { type: "category", data: x, gridIndex: 1 }],
      yAxis: [{ type: "value", gridIndex: 0, axisLabel: { formatter: "{value}%" } }, { type: "value", gridIndex: 1, max: 100, axisLabel: { fontSize: 9 } }],
      series: [{ name: "虚拟账户", type: "line", data: N.map((r) => +((r.nav - 1) * 100).toFixed(2)), lineStyle: { width: 2.5, color: "#D0021B" }, itemStyle: { color: "#D0021B" } },
        ...BN.map((k, i) => ({ name: k, type: "line", data: N.map((r) => (r[k] ? +((r[k] / b0(k) - 1) * 100).toFixed(2) : null)), lineStyle: { type: "dashed", width: 1.2, color: i ? "#4A7BD0" : "#888" }, itemStyle: { color: i ? "#4A7BD0" : "#888" }, symbol: "none" })),
        { name: "仓位%", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: N.map((r) => +r.exposure), itemStyle: { color: "#F08C7A" } }] });
    window.addEventListener("resize", () => c.resize());
  }
  window.__mod_account = { page };
})();
