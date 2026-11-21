/* 策略赛马页（按需加载）：读 race.json（race.py report 生成）。每个选手各 10 万虚拟本金，开赛后逐日真实记账并排比较；
   选手按组（股票组 / ETF·择时组 / 板块组）分块、可折叠，人数不写死；每个选手有自己的开赛日和对照选手 */
(function () {
  const A = window.__APP;
  const { app, $, $$, esc, fmt, pct, updn, LOADING, FAIL, DISC, getJSON, need } = A;
  const num = (v) => (v == null ? "—" : Math.round(v).toLocaleString("zh-CN"));
  const wan = (v) => (v == null ? "—" : Math.abs(v) >= 1e4 ? fmt(v / 1e4, 2) + "万" : num(v));
  const md5 = (d) => (d ? String(d).slice(5) : "");
  const how = (t) => `<div class="acc-how"><b>怎么看</b>${t}</div>`;
  if (!document.getElementById("race-css2")) {   // 分组/对照标签的样式随模块下发（style.css 有版本号缓存，--reports-only 不刷新）
    const st = document.createElement("style");
    st.id = "race-css2";
    st.textContent = `.race-grp{margin:4px 0}.race-grp>summary{list-style:none;cursor:pointer}.race-grp>summary::-webkit-details-marker{display:none}
.race-grp>summary h2::after{content:" ▾";font-size:13px;color:var(--sub)}.race-grp:not([open])>summary h2::after{content:" ▸"}
.race-grp .chartcard{margin-top:10px}
.race-ctl{font-style:normal;font-size:11px;font-weight:600;color:var(--sub);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:6px;vertical-align:2px}
.race-ref{font-size:12px;color:var(--sub);margin-top:3px}
.race-leg i.c{background:none;border-top:2px dashed;height:0}
.race-nav.race-nav0{height:auto}`;
    document.head.appendChild(st);
  }

  function mdLite(s) {
    const inl = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
    let out = "", list = null;
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    String(s || "").split("\n").forEach((ln) => {
      let m;
      if ((m = ln.match(/^#{1,2} (.*)/))) { close(); out += `<h3>${inl(m[1])}</h3>`; }
      else if ((m = ln.match(/^#{3,} (.*)/))) { close(); out += `<h4>${inl(m[1])}</h4>`; }
      else if ((m = ln.match(/^\s*- (.*)/))) { if (list !== "ul") { close(); out += "<ul>"; list = "ul"; } out += `<li>${inl(m[1])}</li>`; }
      else if ((m = ln.match(/^\d+\. (.*)/))) { if (list !== "ol") { close(); out += "<ol>"; list = "ol"; } out += `<li>${inl(m[1])}</li>`; }
      else if ((m = ln.match(/^> ?(.*)/))) { close(); out += `<p class="race-q">${inl(m[1])}</p>`; }
      else if (ln.trim()) { close(); out += `<p>${inl(ln)}</p>`; }
    });
    close();
    return out;
  }

  const pid = (x) => +String(x.id).replace(/\D/g, "") || 0;
  const short = (n) => String(n || "").replace(/（[^）]*）/g, "");

  function card(x, J) {
    const pre = x.pre != null ? x.pre : J.pre;
    const exLab = !x.ref ? "比随便买" : x.ref === "p1" ? "比随便买" : "比对照";
    const ex = !x.ref ? '<em class="race-base">基准</em>' : `<b class="${updn(x.excess)}">${pre ? "—" : pct(x.excess, 2)}</b>`;
    const tag = x.ctrl && !/对照|基准/.test(x.name) ? '<em class="race-ctl">对照</em>' : "";
    const refT = (x.ref && x.ref !== "p1" ? `<div class="race-ref">对照：${esc(x.ref_name || x.ref)}（同一段时间比）</div>` : "")
      + (x.ref2 ? `<div class="race-ref">另比：${esc(x.ref2_name || x.ref2)} <b class="${updn(x.excess2)}">${pre ? "—" : pct(x.excess2, 2)}</b>（同一段时间比）</div>` : "");
    const sig = x.signal || {};
    const pend = x.pending || [];
    const posT = (x.pos || []).length ? `<div class="race-pos">${x.pos.map((p) => `<a class="race-pr" href="stock/#/s/${esc(p.sym)}"><div><b>${esc(p.name)}</b><span>${esc(p.sym.slice(2))} · ${p.qty} 股 · 成本 ${fmt(p.cost, 3)} → ${p.px}</span></div>
      <div class="race-pv"><b class="${updn(p.pnl_pct)}">${pct(p.pnl_pct, 2)}</b><span>占 ${fmt(p.weight, 1)}%</span></div></a>`).join("")}</div>`
      : '<div class="muted">空仓（全部现金）</div>';
    const pendT = pend.length ? `<ul class="race-ul">${pend.map((o) => `<li><b class="${o.act === "买入" ? "up" : "dn"}">${o.act}</b> ${esc(o.name)}${o.act === "买入" && o.w != null ? ` <span class="muted">目标 ${fmt(o.w, 1)}%≈${wan(o.amt)}元</span>` : ""}${o.carry ? ' <i class="race-tag">顺延</i>' : ""}<div class="muted small">${esc(o.reason)}</div></li>`).join("")}</ul>` : '<div class="muted">没有待成交单</div>';
    const tr = (x.trades || []).slice(0, 12);
    const trT = tr.length ? `<ul class="race-ul">${tr.map((t) => `<li><span class="muted">${md5(t.date)}</span> <b class="${t.side === "买入" ? "up" : t.side === "卖出" ? "dn" : ""}">${esc(t.side)}</b> ${esc(t.name)} ${t.qty}${t.side === "分红" ? "股" : ""} @ ${t.price} ≈ ${wan(+t.amount)}元${t.pnl != null ? ` <span class="${updn(t.pnl)}">盈亏 ${t.pnl > 0 ? "+" : ""}${num(t.pnl)}</span>` : ""}<div class="muted small">${esc(t.reason || "")}${t.fee ? `｜费用 ${fmt(t.fee, 2)}` : ""}</div></li>`).join("")}</ul>` : '<div class="muted">还没有成交</div>';
    const ms = (x.misses || []).slice(0, 6);
    const msT = ms.length ? `<h4>没成交的单</h4><ul class="race-ul">${ms.map((m) => `<li><span class="muted">${md5(m.date)}</span> ${esc(m.side)} ${esc(m.name)}：${esc(m.why)}</li>`).join("")}</ul>` : "";
    return `<details class="card race-card${x.ctrl ? " race-c" : ""}" style="--rc:${x.color}">
      <summary>
        <div class="race-r1"><span class="race-rk">${pre || x.rank == null ? "·" : x.rank}</span><span class="race-nm"><i></i>${esc(x.name)}${tag}</span>
          <span class="race-ret ${updn(x.ret)}">${pre ? "待开赛" : pct(x.ret, 2)}</span></div>
        ${pre ? "" : `<div class="race-kp">
          <div><span>今日</span><b class="${updn(x.today)}">${x.today == null ? "—" : pct(x.today, 2)}</b></div>
          <div><span>最大回撤</span><b class="${x.mdd < 0 ? "dn" : ""}">${fmt(x.mdd, 2)}%</b></div>
          <div><span>仓位</span><b>${fmt(x.exp, 0)}%</b></div>
          <div><span>${exLab}</span>${ex}</div>
        </div>`}
        <div class="race-rule">${esc(x.rule)}</div>${refT}
        ${pre && !J.pre && x.start ? `<div class="race-ref">⏳ ${esc(md5(x.signal0))} 收盘出第一批信号，${esc(md5(x.start))} 开盘首次成交</div>` : ""}
        <div class="race-more">展开看持仓与成交 ›</div>
      </summary>
      <div class="race-body">
        <div class="race-sig"><b>${esc(md5(sig.date))} 收盘信号</b>${esc(sig.text || "—")}</div>
        <div class="race-mini"><span>总资产 <b>${num(x.equity)}</b></span><span>现金 <b>${num(x.cash)}</b></span><span>已实现 <b class="${updn(x.realized)}">${x.realized > 0 ? "+" : ""}${num(x.realized)}</b></span><span>开赛 <b>${x.days}</b> 天${x.start ? `（${esc(md5(x.start))} 起）` : ""}</span></div>
        <h4>${pre ? "下一开盘首次成交" : "下一开盘待成交"}（${pend.length} 单）</h4>${pendT}
        <h4>持仓（${(x.pos || []).length} 只）</h4>${posT}
        <h4>最近成交</h4>${trT}${msT}
      </div></details>`;
  }

  function drawNav(J, P, id) {
    const el = $("#" + id);
    if (!el) return;
    P = P.slice().sort((a, b) => pid(a) - pid(b));
    const dates = [...new Set(P.flatMap((x) => x.nav.map((r) => r.d)))].sort();
    if (dates.length < 2 || !P.some((x) => x.nav.length >= 2)) { el.innerHTML = '<div class="empty">开赛第一天收盘记账后开始画净值曲线</div>'; el.classList.add("race-nav0"); return; }
    const b0 = J.bench && J.bench[0] && J.bench[0].close;
    const bmap = Object.fromEntries((J.bench || []).map((r) => [r.date, r.close]));
    const c = A.mk(el);
    c.setOption({
      grid: { left: 44, right: 12, top: 12, bottom: 26 },
      tooltip: { trigger: "axis", confine: true, order: "valueDesc", valueFormatter: (v) => (v == null ? "—" : pct(v, 2)) },
      xAxis: { type: "category", data: dates.map(md5), boundaryGap: false, axisLine: { lineStyle: { color: "#d0d4da" } }, axisTick: { show: false }, axisLabel: { color: "#8a9099", fontSize: 10, hideOverlap: true } },
      yAxis: { type: "value", scale: true, splitNumber: 4, axisLabel: { formatter: "{value}%", color: "#8a9099", fontSize: 10 }, splitLine: { lineStyle: { color: "#f0f1f3" } } },
      series: [
        ...P.map((x) => { const m = Object.fromEntries(x.nav.map((r) => [r.d, r.v])); return { name: x.name, type: "line", data: dates.map((d) => (m[d] == null ? null : m[d])), smooth: 0.2, showSymbol: dates.length < 25, symbolSize: 4,
          lineStyle: { width: x.ctrl ? 1.6 : 2.2, color: x.color, type: x.ctrl ? "dashed" : "solid" }, itemStyle: { color: x.color } }; }),
        ...(b0 ? [{ name: J.bench_name, type: "line", data: dates.map((d) => (bmap[d] ? +((bmap[d] / b0 - 1) * 100).toFixed(2) : null)), symbol: "none", smooth: 0.2,
          lineStyle: { width: 1.2, type: "dotted", color: "#555" }, itemStyle: { color: "#555" } }] : []),
      ],
    });
  }

  async function page() {
    document.title = "策略赛马 · 小七投研";
    const tok = A.tok();
    app.innerHTML = `<h1>🏇 策略赛马</h1>${LOADING("读取赛况…")}`;
    let J;
    try { J = await getJSON("race.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>🏇 策略赛马</h1>${FAIL("赛况数据暂未生成")}`; return; }
    if (!A.alive(tok)) return;
    const P = J.players || [];
    const n = J.n || P.length;
    const G = (J.groups && J.groups.length ? J.groups : [{ key: "all", name: "全部选手" }]).map((g) => ({ ...g, P: P.filter((x) => g.key === "all" || x.group === g.key) })).filter((g) => g.P.length);
    const leg = (Q) => Q.slice().sort((a, b) => pid(a) - pid(b)).map((x) => `<span><i class="${x.ctrl ? "c" : ""}" style="${x.ctrl ? `border-color:${x.color}` : `background:${x.color}`}"></i>${esc(x.name)}</span>`).join("") + `<span><i class="d"></i>${esc(J.bench_name)}</span>`;
    const later = (J.batches || []).slice(1).filter((b) => P.some((x) => x.batch === b.batch && x.pre));
    // 顶部只留一张摘要卡：开赛天数｜基准｜随便买｜选手数，新增选手合并成一行，运气提醒收进卡片底部
    const byStart = {};
    later.forEach((b) => { const k = b.start ? md5(b.start) : "下一交易日"; byStart[k] = (byStart[k] || 0) + (b.n || 0); });
    const laterT = Object.keys(byStart).length ? `<div class="rs-n">🆕 新增 ${Object.entries(byStart).map(([s, k]) => `<b>${k}</b> 位（${esc(s)} 开盘首次成交）`).join("、")}，卡片上标「待开赛」。</div>` : "";
    const head = J.pre
      ? `<div class="card race-sum"><div class="rs-n" style="margin-top:0">⏳ ${esc(md5(J.last_date))} 收盘已出第一批信号，<b>${esc(md5(J.start))} 开盘首次成交</b>，当天收盘后开始排名。下面每个选手展开能看到明天开盘要买什么、买多少。</div>${laterT}</div>`
      : `<div class="card race-sum"><div class="rs4"><div><span>开赛</span><b>第 ${J.days} 天</b></div><div><span>${esc(J.bench_name)}</span><b class="${updn(J.bench_ret)}">${pct(J.bench_ret, 2)}</b></div><div><span>随便买</span><b class="${updn(J.random_ret)}">${pct(J.random_ret, 2)}</b></div><div><span>选手</span><b>${n} 位</b></div></div>
        <div class="rs-n">${esc(J.start)} 起，记账至 ${esc(J.last_date)}</div>${laterT}
        ${J.days != null && J.days < 60 ? `<div class="rs-w">⚠️ 开赛不足 60 个交易日，排名主要是运气，至少看 3 个月。</div>` : ""}</div>`;
    const grpT = G.map((g) => `<details class="race-grp" open><summary><h2>${esc(g.name)} <span class="muted">${g.P.length} 位${g.P.some((x) => x.ctrl) ? "，含对照" : ""}</span></h2></summary>
      <div class="race-list">${g.P.map((x) => card(x, J)).join("")}</div>
      <div class="card chartcard"><div id="racenav-${esc(g.key)}" class="race-nav"></div><div class="race-leg">${leg(g.P)}</div></div></details>`).join("");
    app.innerHTML = `<h1>🏇 策略赛马</h1>
      ${head}
      ${J.rules_changed ? '<div class="race-warn">规则文件在开赛后被改动过：旧选手仍按开赛时的规则跑，改动只对新开的选手有效。</div>' : ""}
      <details class="howto"><summary>怎么比的 ⓘ</summary><p class="muted small">${n} 个选手各拿 10 万元虚拟本金，从各自的开赛日起每天收盘出信号、第二天开盘按真实开盘价成交，扣佣金、印花税、滑点，涨停买不进、跌停卖不出。不回测、不回填——历史回测都可能有偏差，这里只认开赛后真实记下来的成绩。红色=赚、绿色=亏。</p></details>
      <h2>排行榜 <span class="muted small">按累计收益，名次是全体排名</span></h2>
      ${grpT}
      ${how("「比随便买 / 比对照」= 这个选手的累计收益 − 对照选手在同一段时间（从这个选手的信号日收盘算起）的收益。每个会选股的选手都配了一个「同一个股票池随便买」的对照（标「对照」、净值图里是虚线）：长期跑不赢它，说明这套规则没本事；跑赢了还要看回撤是不是更大。黑色点线是沪深300指数（价格指数，不含分红）。点卡片展开看持仓、明天的待成交单和每一笔成交；点组名可以折叠。")}
      <h2>规则原文 <span class="muted">开赛前写死${J.rules_commit ? `，git ${esc(J.rules_commit.split(" ")[0])}` : ""}</span></h2>
      <details class="card race-rules"><summary>展开看完整规则（改规则只能新开选手）</summary><div class="race-md">${mdLite(J.rules_md)}</div></details>
      <p class="muted small">成本：${esc(J.cost)}。更新于 ${esc(J.updated)}。模拟盘，不构成投资建议。<a href="#/account">💼 小七虚拟账户 ›</a>　<a href="stock/#/picks/cn">🎯 买卖点 ›</a></p>${DISC}`;
    await need("lib");
    if (!A.alive(tok)) return;
    G.forEach((g) => drawNav(J, g.P, "racenav-" + g.key));
  }
  window.__mod_race = { page };
})();
