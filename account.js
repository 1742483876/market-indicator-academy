/* 虚拟账户页（按需加载）：读 paper.json（paper.py report 生成），卡片式展示 */
(function () {
  const A = window.__APP;
  const { app, $, esc, fmt, pct, updn, LOADING, FAIL, DISC, getJSON, need } = A;
  const GC = { core: "#2f7fd8", sector: "#f08c3a", stock: "#8b5cf6", v2: "#14b8a6", theme: "#e8a317", cash: "#dfe3e8" };
  const WD = "日一二三四五六";
  let SL = {}, CUR = "";
  const num = (v, d = 0) => Number(v).toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d });
  const money = (v, d = 0) => (v == null ? "—" : (v < 0 ? "-" : "") + CUR + num(Math.abs(v), d));
  const sgn = (v, d = 0) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "-" : "") + CUR + num(Math.abs(v), d));
  const wan = (v) => (CUR === "$" ? "$" + num(v) : Math.abs(v) >= 1e4 ? fmt(v / 1e4, 1) + "万" : num(v));
  const days = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
  const how = (t) => `<div class="acc-how"><b>怎么看</b>${t}</div>`;

  // 指数同期涨跌：nav 只记到上一收盘，盘中/收盘未记账时用 bench_now 补上今天
  function liveBench(P) {
    const N = P.nav || [], b = { ...(P.bench || {}) }, last = N[N.length - 1];
    if (P.bench_now && N.length && P.today && last.date < P.today)
      (P.bench_names || []).forEach((k) => { if (P.bench_now[k] && +N[0][k]) b[k] = (P.bench_now[k] / +N[0][k] - 1) * 100; });
    return b;
  }
  function hero(P, US) {
    const BN = P.bench_names || [], b = liveBench(P);
    const pe = P.prev_equity || P.init, dp = P.equity - pe, dpp = (P.equity / pe - 1) * 100;
    const cum = P.equity - P.init;
    const vs = BN.map((k) => {
      if (b[k] == null) return "";
      const ex = P.ret - b[k];
      return `<div class="acc-vs"><span>${esc(k)} <b class="${updn(b[k])}">${pct(b[k], 2)}</b></span>${Math.abs(ex) < 0.005 ? '<em class="even">持平</em>' : `<em class="${ex > 0 ? "win" : "lose"}">${ex > 0 ? "跑赢" : "跑输"} ${fmt(Math.abs(ex), 2)} 个点</em>`}</div>`;
    }).join("");
    const age = P.today ? days(P.open_date, P.today) + 1 : null;
    return `<div class="acc-hero ${P.ret > 0 ? "pos" : P.ret < 0 ? "neg" : ""}">
      <div class="acc-hl">总资产（${US ? "美元" : "元"}）<span>${esc(P.updated)} 更新</span></div>
      <div class="acc-eq">${money(P.equity)}</div>
      <div class="acc-two">
        <div><span>累计收益</span><b class="${updn(P.ret)}">${pct(P.ret, 2)}</b><em class="${updn(cum)}">${sgn(cum)}</em></div>
        <div><span>今日盈亏${P.prev_date ? "" : "（首日）"}</span><b class="${updn(dp)}">${sgn(dp)}</b><em class="${updn(dpp)}">${pct(dpp, 2)}</em></div>
      </div>
      ${vs ? `<div class="acc-vsw"><div class="acc-vst">同期指数（开户以来）</div>${vs}</div>` : ""}
      <div class="acc-mini">
        <div><span>现金</span><b>${money(P.cash)}</b></div>
        <div><span>最大回撤</span><b class="${P.mdd < 0 ? "dn" : ""}">${fmt(P.mdd, 2)}%</b></div>
        <div><span>已实现盈亏</span><b class="${updn(P.realized)}">${sgn(P.realized)}</b></div>
        <div><span>开户</span><b>${age ? age + " 天" : esc(P.open_date)}</b></div>
      </div>
    </div>`;
  }

  function donut(P) {
    const g = {};
    (P.pos || []).forEach((r) => { g[r.sleeve] = (g[r.sleeve] || 0) + r.value; });
    const parts = Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, name: SL[k] || k, v, c: GC[k] || "#9aa3ad" }));
    parts.push({ k: "cash", name: "现金", v: P.cash, c: GC.cash });
    const tot = P.equity || parts.reduce((s, x) => s + x.v, 0);
    const over = P.cap != null && P.exposure > P.cap + 0.5;
    const tv = g.theme ? (g.theme / tot) * 100 : 0;
    const tover = P.theme_cap != null && tv > P.theme_cap + 0.5;
    const warn = [over ? `总仓位 ${fmt(P.exposure, 1)}% 超过报告上限 ${P.cap}%，下一份报告会提示减仓` : "",
      tover ? `题材短线 ${fmt(tv, 1)}% 超过野人哥周期上限 ${P.theme_cap}%` : ""].filter(Boolean);
    const leg = parts.map((x) => `<div class="acc-lg"><i style="background:${x.c}"></i><span>${esc(x.name)}</span><b>${fmt((x.v / tot) * 100, 1)}%</b><em>${wan(x.v)}</em></div>`).join("");
    return { parts, html: `<div class="card acc-pie${over ? " over" : ""}">
      <div class="acc-pw"><div id="accpie" class="acc-pc"></div><div class="acc-pmid"><span>仓位</span><b class="${over ? "warn" : ""}">${fmt(P.exposure, 1)}%</b><em>上限 ${P.cap ?? "—"}%</em></div></div>
      <div class="acc-legs">${leg}</div>
      ${warn.map((w) => `<div class="acc-warn">⚠️ ${esc(w)}</div>`).join("")}
      ${P.cap != null ? `<div class="acc-capbar"><i style="width:${Math.min(100, (P.exposure / Math.max(P.cap, 1)) * 100)}%" class="${over ? "over" : P.exposure > P.cap * 0.9 ? "near" : ""}"></i></div><div class="acc-capt"><span>已用仓位额度 ${fmt((P.exposure / Math.max(P.cap, 1)) * 100, 0)}%</span><span>还能买约 ${wan(Math.max(0, ((P.cap - P.exposure) / 100) * tot))}</span></div>` : ""}
    </div>` };
  }

  function posCard(r, P, US) {
    const chg = (P.pos_chg || {})[r.sym];
    const maxW = Math.max(...P.pos.map((x) => x.weight), 1);
    let stop = "";
    if (r.stop) {
      const d = (r.px / r.stop - 1) * 100;
      const lvl = d <= 2 ? "dang" : d <= 5 ? "near" : "safe";
      const lo = r.stop, hi = Math.max(r.cost, r.px) * 1.03, pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
      stop = `<div class="acc-stop ${lvl}"><div class="acc-st1"><span>${d <= 0 ? "已跌破止损" : `离止损还有 <b>${fmt(d, 1)}%</b>`}</span><em>${r.sleeve === "v2" ? "止损仅参考 · 按调仓卖" : `跌到 ${r.stop} 自动卖`}</em></div>
        <div class="acc-sbar"><i style="width:${pos(r.px)}%"></i><s style="left:${pos(r.cost)}%" title="成本"></s></div>
        <div class="acc-st2"><span>止损 ${r.stop}</span><span>▲成本 ${fmt(r.cost, US ? 2 : 3)}</span></div></div>`;
    }
    return `<a class="acc-pos" href="stock/#/s/${esc(r.sym)}" style="--gc:${GC[r.sleeve] || "#9aa3ad"}">
      <div class="acc-p1"><div class="acc-pn"><b>${esc(r.name)}</b><span><i class="acc-tag" style="background:${GC[r.sleeve] || "#9aa3ad"}1f;color:${GC[r.sleeve] || "#6b7280"}">${esc(SL[r.sleeve] || r.sleeve)}</i>${esc(r.sym.slice(2))} · ${r.qty} ${US || !["core", "sector"].includes(r.sleeve) ? "股" : "份"}</span></div>
        <div class="acc-pp ${updn(r.pnl)}"><b>${pct(r.pnl_pct, 2)}</b><em>${sgn(r.pnl)}</em></div></div>
      <div class="acc-p2"><span>成本 ${fmt(r.cost, US ? 2 : 3)} → 现价 <b>${r.px}</b>${chg != null ? ` <em class="${updn(chg)}">今日 ${pct(chg, 2)}</em>` : ""}</span></div>
      <div class="acc-p3"><span>市值 ${money(r.value)}</span><div class="acc-wbar"><i style="width:${(r.weight / maxW) * 100}%"></i></div><b>${fmt(r.weight, 1)}%</b></div>
      ${stop}
    </a>`;
  }

  function timeline(T, US) {
    if (!T.length) return '<div class="card muted">还没有成交</div>';
    const SHOW = 8;
    const grp = (list, cont) => {
      const by = [];
      list.forEach((t) => { const g = by[by.length - 1]; if (g && g.d === t.date) g.l.push(t); else by.push({ d: t.date, l: [t] }); });
      return by.map((g) => {
        const nb = g.l.filter((t) => t.side === "买入").length, ns = g.l.length - nb;
        return `<div class="acc-td"><div class="acc-tdh">${esc(g.d.slice(5))} 周${WD[new Date(g.d + "T00:00:00").getDay()]}${cont === g.d ? "（续）" : ""}<span>${nb ? `买 ${nb}` : ""}${nb && ns ? " · " : ""}${ns ? `卖 ${ns}` : ""}</span></div>
          ${g.l.map((t) => { const buy = t.side === "买入"; return `<div class="acc-ti ${buy ? "b" : "s"}"><i></i><div><div class="acc-ti1"><span class="acc-tt">${esc(String(t.time).slice(0, 5))}</span><b class="${buy ? "up" : "dn"}">${esc(t.side)}</b> <a href="stock/#/s/${esc(t.sym)}">${esc(t.name)}</a><span class="acc-tq">${t.qty}${US ? "股" : ""} @ ${t.price} ≈ ${wan(+t.amount)}</span></div>
            <div class="acc-tr"><i class="acc-tag" style="background:${GC[t.sleeve] || "#9aa3ad"}1f;color:${GC[t.sleeve] || "#6b7280"}">${esc(SL[t.sleeve] || t.sleeve)}</i>${esc(t.reason)}</div></div></div>`; }).join("")}</div>`;
      }).join("");
    };
    const more = T.length > SHOW ? `<details class="acc-more"><summary>展开更早的 ${T.length - SHOW} 笔</summary>${grp(T.slice(SHOW), T[SHOW - 1].date)}</details>` : "";
    return `<div class="card acc-tl">${grp(T.slice(0, SHOW))}${more}</div>`;
  }

  async function page() {
    document.title = "虚拟账户 · 小七投研";
    const tok = A.tok();
    const US = /^#\/account\/us/.test(location.hash);
    SL = US ? { core: "指数ETF", sector: "板块ETF", stock: "个股", theme: "题材" } : { core: "宽基", sector: "板块ETF", stock: "个股", v2: "选股组合", theme: "题材短线" };
    CUR = US ? "$" : "¥";
    const TABS = `<div class="subtabs"><a href="#/account" class="${US ? "" : "on"}">🇨🇳 A股账户（¥100万）</a><a href="#/account/us" class="${US ? "on" : ""}">🇺🇸 美股账户（$15万）</a></div>`;
    app.innerHTML = `<h1>💼 虚拟账户</h1>${TABS}${LOADING("读取账户…")}`;
    let P;
    try { P = await getJSON(US ? "paper_us.json" : "paper.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>💼 虚拟账户</h1>${TABS}${FAIL("账户数据暂未生成")}`; return; }
    if (!A.alive(tok)) return;
    const BN = P.bench_names || ["中证1000", "沪深300"];
    const pos = P.pos || [];
    const D = donut(P);
    const closed = P.closed || [];
    app.innerHTML = `<h1>💼 虚拟账户</h1>${TABS}
      <a class="race-link" href="#/race">🏇 策略赛马：7 套策略各 10 万实盘记账，谁更靠谱 ›</a>
      ${hero(P, US)}
      ${how(`红色=赚、绿色=亏（A股习惯）。「跑赢 X 个点」= 账户累计收益减去同期指数涨跌，正数说明比直接买指数强。本金 ${money(P.init)}，${esc(P.open_date)} 开户，照每份报告的结论真实下单。`)}
      <div class="acc-row"><div><h2>仓位分布</h2>${D.html}
      ${how(`环中间是「股票占总资产的比例」。报告每天给一个仓位上限（市场越弱上限越低），超过会标黄提醒；灰色部分是现金，现金多说明在等机会。`)}
      </div><div><h2>净值走势</h2><div class="card chartcard acc-navc"><div id="pnav" class="acc-nav"></div>
        <div class="acc-nleg"><span><i style="background:#e5484d"></i>虚拟账户</span>${BN.map((k, i) => `<span><i class="d" style="border-color:${i ? "#4A7BD0" : "#9aa3ad"}"></i>${esc(k)}</span>`).join("")}<span><b class="up">▲</b>买入</span><span><b class="dn">▼</b>卖出</span></div></div>
      ${how("实线是账户从开户到现在的累计涨跌，虚线是同期指数。实线在虚线上方 = 跑赢指数。小三角是当天有买入（红▲）/卖出（绿▼），点一下看明细。")}</div></div>
      <h2>持仓 <span class="muted">${pos.length} 只 · 市值 ${money(pos.reduce((s, r) => s + r.value, 0))}</span></h2>
      ${pos.length ? `<div class="acc-plist">${pos.map((r) => posCard(r, P, US)).join("")}</div>` : '<div class="card muted">空仓，全部是现金</div>'}
      ${how(US ? "大字是这只股票的浮动盈亏（还没卖，所以叫「浮盈」）。下面的条是离止损价还有多远：蓝色=安全，橙色=离止损不到 5%，红色=不到 2%，跌到止损价会自动卖出（只在美股交易时段检查）。" : "大字是这只股票的浮动盈亏（还没卖，所以叫「浮盈」）。下面的条是离止损价还有多远：蓝色=安全，橙色=离止损不到 5%，红色=不到 2%。宽基、题材跌到止损价会自动卖出；选股组合每 20 个交易日按排名调仓。")}
      ${(P.pending || []).length ? `<h2>挂单 <span class="muted">等价格回踩再买</span></h2><div class="acc-pend">${P.pending.map((o) => `<div class="card acc-pd"><div><b class="${o.side === "buy" ? "up" : "dn"}">${o.side === "buy" ? "买入" : "卖出"}</b> ${esc(o.name || o.sym.slice(2))}${o.side === "buy" && o.limit ? `<span class="acc-lim">价格 ≤ ${o.limit} 才买</span>` : ""}</div><div class="acc-tr">${esc(o.reason || "")}${o.expire ? `<em>有效至 ${esc(o.expire)}</em>` : ""}</div></div>`).join("")}</div>
        ${how("挂单 = 报告说「等回落到某个价再买」。价格没到就一直等，到期没成交自动撤销，不追高。")}` : ""}
      <h2>成交记录 <span class="muted">最近 ${(P.trades || []).length} 笔</span></h2>${timeline(P.trades || [], US)}
      ${how(US ? "按日期从新到旧。红点=买入，绿点=卖出，下面一行是下单理由（出自哪份报告）。佣金0.03%+滑点，只在美股交易时段（北京22:30–05:00）成交。" : "按日期从新到旧。红点=买入，绿点=卖出，下面一行是下单理由（出自哪份报告）。成交价已含佣金/印花税/滑点，100股一手、T+1，涨停买不进跌停卖不出。")}
      ${closed.length ? `<h2>已清仓 <span class="muted">${closed.length} 笔 · 合计 <b class="${updn(closed.reduce((s, c) => s + c.pnl, 0))}">${sgn(closed.reduce((s, c) => s + c.pnl, 0))}</b></span></h2>
        <div class="acc-cl">${closed.map((c) => `<a class="card acc-cc" href="stock/#/s/${esc(c.sym)}"><div><b>${esc(c.name)}</b><span>${esc(c.open.slice(5))} → ${esc(c.close.slice(5))} · 拿了 ${Math.max(1, days(c.open, c.close))} 天 · ${esc(SL[c.sleeve] || c.sleeve)}</span></div><b class="${updn(c.pnl)}">${sgn(c.pnl)}</b></a>`).join("")}</div>
        ${how("已经卖完的股票，最后落袋的盈亏（已扣手续费）。")}` : ""}
      <p class="muted small">模拟盘，不构成投资建议。</p>${DISC}`;
    await need("lib");
    if (!A.alive(tok)) return;
    const pie = echarts.init($("#accpie"));
    pie.setOption({ animationDuration: 500, series: [{ type: "pie", radius: ["66%", "92%"], avoidLabelOverlap: false, label: { show: false }, silent: true, itemStyle: { borderColor: "#fff", borderWidth: 2 },
      data: D.parts.filter((x) => x.v > 0).map((x) => ({ name: x.name, value: +x.v.toFixed(2), itemStyle: { color: x.c } })) }] });
    drawNav(P, BN);
    window.addEventListener("resize", () => { pie.resize(); const c = echarts.getInstanceByDom($("#pnav") || document.body); c && c.resize(); });
  }

  function drawNav(P, BN) {
    const el = $("#pnav");
    const N = (P.nav || []).map((r) => ({ date: r.date, v: +((r.nav - 1) * 100).toFixed(2), exp: +r.exposure, b: BN.map((k) => (r[k] ? +r[k] : null)) }));
    if (P.today && (!N.length || N[N.length - 1].date < P.today)) N.push({ date: P.today, v: +P.ret.toFixed(2), exp: +P.exposure, b: BN.map((k) => (P.bench_now || {})[k] || null), live: true });
    if (N.length < 2) { el.innerHTML = '<div class="empty">开户第一天，收盘记账后开始画净值曲线</div>'; return; }
    const b0 = BN.map((_, i) => (N.find((r) => r.b[i]) || {}).b?.[i]);
    const td = {};
    (P.trades || []).forEach((t) => { const o = (td[t.date] = td[t.date] || { b: [], s: [] }); (t.side === "买入" ? o.b : o.s).push(t.name); });
    const idx = Object.fromEntries(N.map((r, i) => [r.date, i]));
    const mk = (kind) => Object.entries(td).filter(([d, o]) => idx[d] != null && o[kind].length).map(([d, o]) => ({
      coord: [idx[d], N[idx[d]].v], symbol: "triangle", symbolSize: 10, symbolRotate: kind === "b" ? 0 : 180,
      symbolOffset: [0, kind === "b" ? 11 : -11], itemStyle: { color: kind === "b" ? "#e5484d" : "#1f9d55" } }));
    const ys = N.map((r) => r.v);
    const c = echarts.init(el);
    c.setOption({
      grid: { left: 42, right: 14, top: 18, bottom: 26 },
      tooltip: { trigger: "axis", confine: true, formatter: (ps) => {
        const r = N[ps[0].dataIndex], o = td[r.date];
        let h = `<b>${r.date}${r.live ? "（盘中）" : ""}</b><br>账户 <b style="color:${r.v >= 0 ? "#e5484d" : "#1f9d55"}">${pct(r.v, 2)}</b>　仓位 ${fmt(r.exp, 1)}%`;
        ps.slice(1).forEach((p) => { if (p.value != null) h += `<br>${p.seriesName} ${pct(p.value, 2)}`; });
        if (o) { if (o.b.length) h += `<br><span style="color:#e5484d">▲买 ${o.b.length} 笔</span>：${esc(o.b.slice(0, 4).join("、"))}${o.b.length > 4 ? "…" : ""}`; if (o.s.length) h += `<br><span style="color:#1f9d55">▼卖 ${o.s.length} 笔</span>：${esc(o.s.slice(0, 4).join("、"))}${o.s.length > 4 ? "…" : ""}`; }
        return h; } },
      xAxis: { type: "category", data: N.map((r) => r.date.slice(5)), boundaryGap: false, axisLine: { lineStyle: { color: "#d0d4da" } }, axisTick: { show: false }, axisLabel: { color: "#8a9099", fontSize: 10, hideOverlap: true } },
      yAxis: { type: "value", scale: true, splitNumber: 4, axisLabel: { formatter: "{value}%", color: "#8a9099", fontSize: 10 }, splitLine: { lineStyle: { color: "#f0f1f3" } } },
      series: [
        { name: "虚拟账户", type: "line", data: ys, smooth: 0.25, showSymbol: N.length < 30, symbolSize: 5, lineStyle: { width: 2.4, color: "#e5484d" }, itemStyle: { color: "#e5484d" },
          areaStyle: { origin: "start", color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(229,72,77,0.22)" }, { offset: 1, color: "rgba(229,72,77,0.02)" }]) },
          markPoint: { data: [...mk("b"), ...mk("s")], label: { show: false }, silent: true },
          markLine: { silent: true, symbol: "none", data: [{ yAxis: 0 }], lineStyle: { color: "#c4c8ce", type: "solid", width: 1 }, label: { show: false } } },
        ...BN.map((k, i) => ({ name: k, type: "line", data: N.map((r) => (r.b[i] && b0[i] ? +((r.b[i] / b0[i] - 1) * 100).toFixed(2) : null)), connectNulls: false, smooth: 0.25,
          lineStyle: { type: "dashed", width: 1.3, color: i ? "#4A7BD0" : "#9aa3ad" }, itemStyle: { color: i ? "#4A7BD0" : "#9aa3ad" }, symbol: "none" })),
      ] });
  }
  window.__mod_account = { page };
})();
