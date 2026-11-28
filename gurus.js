/* 博主观点页（按需加载）：首屏只读 gurus/summary.json；观点明细 calls.json、K 线 k/<code>.json 用到才下载（gurus_eval.py 生成） */
(function () {
  const A = window.__APP;
  const { app, $, $$, esc, fmt, pct, updn, LOADING, FAIL, getJSON, need, wk } = A;
  const UP = "#e5484d", DN = "#2fa86b", GR = "#9aa0a6", BL = "#2f7fd8";
  const DISC = '<p class="disclaimer">观点来自网络博主公开发言的群内转发整理，OCR 识别可能有误，评估为程序按规则计算，不构成投资建议。</p>';
  const TABS = [["rank", "🏆 排行"], ["date", "📅 按日期"], ["b", "👤 按博主"], ["sec", "🧩 按板块"]];
  const DIRN = { bull: ["↑", "看多", "up"], bear: ["↓", "看空", "dn"], neutral: ["→", "中性", "nt"] };
  const HZN = { "1d": "看1天", "3d": "看3天", "1w": "看一周", "2w": "看两周", "1m": "看一个月", long: "长期", unspecified: "没说期限" };
  const SCN = { index: "指数", market: "大盘", sector: "板块", stock: "个股" };
  const LVN = { buy: ["买", UP], sell: ["卖", DN], stop: ["止损", "#d97706"], target: ["目标", "#8b5cf6"] };
  let S = null, CALLS = null, BYID = {};
  const md = (d) => (d ? String(d).slice(5) : "");
  const enc = encodeURIComponent;
  function loadCalls() {
    if (CALLS) return Promise.resolve(CALLS);
    return getJSON("gurus/calls.json", true).then((C) => { CALLS = C; BYID = Object.fromEntries(C.map((c) => [c.id, c])); return C; });
  }
  function setHdr() {
    const h = document.querySelector("header.top");
    if (h) document.documentElement.style.setProperty("--hdr", h.offsetHeight + "px");
  }
  function badge(c) {
    if (c.k === "pnl") return '<span class="gbd gray">自述收益</span>';
    if (c.k === "review") return '<span class="gbd gray">事后回顾</span>';
    if (c.st === "ok") return c.h ? '<span class="gbd ok">✅ 对</span>' : '<span class="gbd bad">❌ 错</span>';
    if (c.st === "pending") return '<span class="gbd wait">⏳ 待验证</span>';
    if (c.st === "untrig") return '<span class="gbd gray">未触发</span>';
    return '<span class="gbd gray">无法验证</span>';
  }
  const tname = (c) => c.tn || c.sec || "—";
  function pnlText(p) {
    if (!p) return "";
    const a = [];
    if (p.equity_wan != null) a.push(`账户 ${p.equity_wan} 万`);
    if (p.day_change_wan != null) a.push(`当日 ${p.day_change_wan >= 0 ? "+" : ""}${p.day_change_wan} 万`);
    if (p.ret_pct != null) a.push(`收益 ${pct(p.ret_pct, 2)}`);
    return a.join("，");
  }
  function card(c, nob) {
    const D = DIRN[c.dir] || DIRN.neutral;
    const who = nob ? "" : `<b>${esc(c.b)}</b> · `;
    const when = `${md(c.d)}${c.t ? " " + esc(c.t) : ""}`;
    if (c.k === "pnl" || c.k === "review") {
      return `<a class="gc gc2" data-cid="${esc(c.id)}"><div class="gch"><span class="gdir nt">${c.k === "pnl" ? "💰" : "📝"}</span><b class="gtn">${c.k === "pnl" ? "自述账户" : esc(tname(c))}</b>${badge(c)}</div>
        <div class="gsm">${esc(c.k === "pnl" ? pnlText(c.pnl) || c.sm : c.sm || c.q)}</div><div class="gmeta">${who}${when}${c.k === "pnl" ? " · 博主自述，未经核实" : " · 不计准确率"}</div></a>`;
    }
    const res = c.st === "ok" ? ` · 期末 <b class="${updn(c.r)}">${pct(c.r, 2)}</b>` : "";
    return `<a class="gc" data-cid="${esc(c.id)}"><div class="gch"><span class="gdir ${D[2]}">${D[0]} ${D[1]}</span><b class="gtn">${esc(tname(c))}</b>${badge(c)}</div>
      <div class="gsm">${esc(c.sm || c.q)}</div>
      <div class="gmeta">${who}${when} · ${HZN[c.hz] || "没说期限"}${c.cnd || c.lv ? " · 条件单" : ""}${res}${c.px ? ` · ${esc(c.px)}` : ""}</div>${c.st === "nodata" && c.note ? `<div class="gmeta">⚠️ ${esc(c.note)}</div>` : ""}</a>`;
  }
  const dots = (l5) => `<span class="gdots" title="最近5条（左旧右新）">${(l5 || []).map((h) => `<i class="${h ? "y" : "n"}"></i>`).join("")}</span>`;
  function hrBar(hr) {
    const v = hr == null ? 0 : hr;
    return `<div class="ghr"><div class="ghrb"><i class="${v >= 50 ? "y" : "n"}" style="width:${Math.max(2, Math.min(100, v))}%"></i><s title="50% = 随便猜"></s></div><b class="${v >= 50 ? "up" : "dn"}">${hr == null ? "—" : fmt(hr, 0) + "%"}</b></div>`;
  }
  const byTxt = (s) => ["大盘", "板块", "个股"].map((g) => (s.by[g] ? `${g} ${s.by[g][0]}/${s.by[g][1]}` : "")).filter(Boolean).join(" · ");

  // ---------------- 排行 ----------------
  // 11-24：首屏总排行榜（summary.board）+ 小结卡（summary.week），原来的博主卡片放在下面，点名字跳过去
  const PLC = { 群: "gxp-q", 抖音: "gxp-d", 微博: "gxp-w" };
  const plTags = (pl) => (pl || []).map((p) => `<i class="gxp ${PLC[p] || ""}">${esc(p)}</i>`).join("");
  const rate = (a) => (a && a[1] ? (a[0] * 100) / a[1] : null);
  function hcell(a, lab) {
    const v = rate(a);
    if (v == null) return `<span class="muted">—</span>`;
    return `${lab ? `<em class="gxl">${lab}</em>` : ""}<b class="${v >= 50 ? "up" : "dn"}">${fmt(v, 0)}%</b><em class="gxn">（${a[1]}）</em><span class="gxbar"><i class="${v >= 50 ? "y" : "n"}" style="width:${Math.max(3, v)}%"></i></span>`;
  }
  const stkTxt = (k) => (k >= 2 ? `<b class="up">连对 ${k}</b>` : k <= -2 ? `<b class="dn">连错 ${-k}</b>` : '<span class="muted">—</span>');
  function lastTxt(x, short) {
    if (!x) return '<span class="muted">还没有方向判断（讲方法类）</span>';
    const D = DIRN[x.dir] || DIRN.neutral, dn = x.dir === "neutral" ? "观望" : D[1];
    return `<a class="gxlast" data-cid="${esc(x.id)}"><span class="gxd">${md(x.d)}</span><span class="gdir ${D[2]}">${D[0]} ${dn}</span><b>${esc(x.tn || x.sec || "—")}</b><span class="gxsm">${esc(x.sm || "")}</span></a>`;
  }
  function updTitle(r) {
    const s = r.src || {}, a = [];
    if (s["群"]) a.push(`群记录整理稿到 ${md(s["群"].latest)}（${md(s["群"].checked)} 查过）`);
    if (s["抖音"]) a.push(`抖音 ${md(s["抖音"].checked)} 查过，最新作品 ${md(s["抖音"].latest)}${s["抖音"].title ? `「${s["抖音"].title}」` : ""}`);
    if (s["微博"]) a.push(`微博 ${md(s["微博"].checked)} 查过，最新原创 ${md(s["微博"].latest)}`);
    return a.join("；");
  }
  const SORTS = [["rk", "名次"], ["m30", "近30天"], ["all", "全部"], ["last", "最近发言"], ["stk", "连对/连错"], ["upd", "更新"]];
  let BSORT = "rk", BDESC = false;
  function sortRows(rows) {
    const k = BSORT, v = (r) => k === "rk" ? -(r.rk || 999) : k === "m30" ? (r.m30[1] ? rate(r.m30) * 1000 + r.m30[1] : -1) : k === "all" ? (r.bay == null ? -1 : r.bay * 1000 + r.all[1])
      : k === "last" ? (r.last ? r.last.d + (r.last.t || "") : "") : k === "stk" ? r.stk : r.upd || "";
    const out = rows.slice().sort((a, b) => (v(a) < v(b) ? 1 : v(a) > v(b) ? -1 : 0));
    return BDESC ? out.reverse() : out;
  }
  function bRow(r) {
    return `<div class="gxr${r.rk ? "" : " gxfew"}"><span class="gxrk">${r.rk || "·"}</span>
      <span class="gxb"><a data-jump="${esc(r.b)}">${esc(r.b)}</a>${plTags(r.pl)}</span>
      <span class="gx30">${hcell(r.m30)}</span><span class="gxall">${hcell(r.all)}</span>
      <span class="gxl1">${lastTxt(r.last)}</span><span class="gxstk">${stkTxt(r.stk)}</span><span class="gxupd" title="${esc(updTitle(r))}">${md(r.upd) || "—"}</span>
      <span class="gxm">${r.m30[1] ? `<em class="gxl">近30天</em>${hcell(r.m30)}` : '<em class="gxl">近30天</em><span class="muted">—</span>'}</span>
      <span class="gxm2">全部 ${rate(r.all) == null ? "—" : `<b class="${rate(r.all) >= 50 ? "up" : "dn"}">${fmt(rate(r.all), 0)}%</b>（${r.all[1]}）`}${Math.abs(r.stk) >= 2 ? ` · ${stkTxt(r.stk)}` : ""} · 更新 ${md(r.upd) || "—"}${r.pend ? ` · 待验证 ${r.pend}` : ""}</span></div>`;
  }
  function boardBody() {
    const B = S.board, top = B.rows.filter((r) => r.rk), few = B.rows.filter((r) => !r.rk);
    const hd = `<div class="gxr gxh"><span class="gxrk" data-sort="rk">#${BSORT === "rk" ? "▾" : ""}</span><span class="gxb">博主（平台）</span>${SORTS.slice(1).map(([k, t]) => {
      const cls = { m30: "gx30", all: "gxall", last: "gxl1", stk: "gxstk", upd: "gxupd" }[k];
      return `<span class="${cls}" data-sort="${k}">${t}${BSORT === k ? (BDESC ? " ▴" : " ▾") : ""}</span>`; }).join("")}</div>`;
    const chips = `<div class="gxsort"><span class="muted small">排序</span>${SORTS.slice(0, 5).map(([k, t]) => `<a class="chip ${BSORT === k ? "on" : ""}" data-sort="${k}">${t}</a>`).join("")}</div>`;
    const ab = B.allbear || [0, 0];
    return `${chips}<div class="gxt">${hd}${sortRows(top).map(bRow).join("")}
      <div class="gxr gxref"><span class="gxrk">⚖</span><span class="gxb">对照：一律看空</span><span class="gx30"></span><span class="gxall">${hcell(ab)}</span><span class="gxl1 muted small">同样这些时点什么都不想、一律看空的命中率；这一年上证跌了 ${fmt(Math.abs(S.meta.mkt || 0), 1)}%，博主要高过它才算有本事</span><span class="gxstk"></span><span class="gxupd"></span><span class="gxm2">同样时点一律看空 <b>${fmt(rate(ab), 0)}%</b>（${ab[1]}）：博主要高过它才算有本事</span></div></div>
      ${few.length ? `<h3 class="gxfh">样本不足（已判定不到 ${B.n} 条，不排名）</h3><div class="gxt gxt2">${few.map(bRow).join("")}</div>` : ""}`;
  }
  function weekCards() {
    const W = S.week;
    if (!W) return "";
    const pc = (h, n) => `${fmt((h * 100) / n, 0)}%`;
    const jb = (b) => `<a data-jump="${esc(b)}">${esc(b)}</a>`;
    const abr = rate(W.allbear);
    const best = W.best.length ? W.best.map(([b, h, n]) => `<li>${jb(b)} <b class="up">${pc(h, n)}</b><em class="gxn"> ${h}/${n}</em></li>`).join("") : '<li class="muted">没人判出 3 条以上且对六成</li>';
    const beat = W.best.filter(([, h, n]) => (h * 100) / n > abr).length;
    const c1 = `<div class="card gxc"><div class="gxct">🎯 这周谁最准<em>近 5 个交易日（${md(W.w0)} 起）判出对错的，≥3 条</em></div><ol>${best}</ol>
      <div class="gxcn">全体 ${W.all[1] ? pc(...W.all) : "—"}，一律看空 ${W.allbear[1] ? pc(...W.allbear) : "—"}${W.allbear[1] && !beat ? "：这周大跌，没人比「一律看空」准" : ""}</div></div>`;
    const cold = W.cold.length ? W.cold.map(([b, k]) => { const r = S.board.rows.find((x) => x.b === b), x = r && r.last; return `<li>${jb(b)} <b class="dn">连错 ${k}</b>${x ? `<span class="muted small gxdk"> · 最近说 ${md(x.d)} ${(DIRN[x.dir] || DIRN.neutral)[1]}${esc(x.tn || "")}</span>` : ""}</li>`; }).join("") : '<li class="muted">没人连错 3 次以上</li>';
    const c2 = `<div class="card gxc"><div class="gxct">🧊 谁连续看错<em>最近几条判断连着错</em></div><ul>${cold}</ul>
      ${W.worst.length ? `<div class="gxcn">这周最不准：${W.worst.map(([b, h, n]) => `${esc(b)} ${pc(h, n)}`).join("、")}</div>` : ""}</div>`;
    const NM = { cn: "A股", us: "美股", hk: "港股" };
    const crow = (g, nm) => { const nb = g.bull.length, ns = g.bear.length, nn = g.neutral.length, t = nb + ns + nn;
      if (!t) return `<div class="gxcr"><span>${nm}</span><span class="muted small">没人说</span></div>`;
      const who = [["看多", g.bull], ["看空", g.bear], ["观望", g.neutral]].filter(([, a]) => a.length).map(([k, a]) => `${k}：${a.map(esc).join("、")}`).join("；");
      return `<div class="gxcr" title="${who}"><span>${nm}</span><span class="gxbb"><i class="b" style="flex:${nb}"></i><i class="n" style="flex:${nn}"></i><i class="s" style="flex:${ns}"></i></span><span class="small"><b class="up">多${nb}</b> <b class="dn">空${ns}</b> <span class="muted">观望${nn}</span></span></div>
        <div class="gxwho gxdk">${who}</div>`; };
    const C = W.cons, T = W.today;
    const secs = C.secs.filter((s) => s.bull.length + s.bear.length >= 2).slice(0, 4);
    const tn = T && T.n ? `<div class="gxcn">今天已有 ${T.n} 人发言：${["cn", "us", "hk"].map((k) => { const g = T[k], a = []; if (g.bull.length) a.push(`多${g.bull.length}`); if (g.bear.length) a.push(`空${g.bear.length}`); if (g.neutral.length) a.push(`观望${g.neutral.length}`); return a.length ? `${NM[k]} ${a.join(" ")}` : ""; }).filter(Boolean).join("；") || "只说了板块"}</div>` : "";
    const c3 = `<div class="card gxc gxw2"><div class="gxct">🧭 博主共识<em>近 7 天（${md(W.c0)} 起）说的，每人每个对象只算最近一次</em></div>${["cn", "us", "hk"].map((k) => crow(C[k], NM[k])).join("")}
      ${secs.length ? `<div class="gxcn">板块集中在：${secs.map((s) => `${esc(s.s)}（<span class="up">多${s.bull.length}</span>/<span class="dn">空${s.bear.length}</span>）`).join("、")}</div>` : ""}${tn}</div>`;
    const KC = { same: ["一致", "gxk-s"], diff: ["相反", "gxk-d"], half: ["部分", "gxk-h"], none: ["—", "gxk-n"] };
    const c4 = `<div class="card gxc gxw2"><div class="gxct">⚖️ 和我们系统结论对照<em>系统结论＝最新一份报告第〇章，和「今天我该做什么」同源</em></div>
      ${W.vs.length ? W.vs.map((v) => `<div class="gxvs" title="${esc(v.t)}"><i class="gxk ${KC[v.k][1]}">${KC[v.k][0]}</i><span><b>${NM[v.m]}</b> 博主${esc(v.tw || "")} · 系统「${esc(v.st || "")}」${v.at ? `<em class="gxn gxdk">（${esc(v.at)}）</em>` : ""}${v.k === "half" && v.w ? `<em class="gxn">：${esc(v.w)}</em>` : ""}</span></div>`).join("") : '<div class="muted small">暂无</div>'}
      <div class="gxcn">博主共识只作参考，买卖以「今天我该做什么」为准。</div></div>`;
    return `<div class="gxcards">${c1}${c2}${c3}${c4}</div>`;
  }
  function rankTab() {
    const m = S.meta, ab = m.allbull || [0, 0];
    const rc = (s) => `<a class="card grc" data-bcard="${esc(s.b)}" href="#/gurus/b/${enc(s.b)}">
      <div class="grh"><span class="grk">${s.rk}</span><b>${esc(s.b)}</b><span class="muted small">${s.n} 条</span>${dots(s.l5)}</div>
      ${hrBar(s.hr)}
      <div class="gst">对 ${s.hit}/${s.n} · 修正 ${fmt(s.bay, 0)}% · 跟着做平均 <b class="${updn(s.avg)}">${pct(s.avg, 2)}</b>/条</div>
      <div class="gst muted">${byTxt(s) || "—"}${s.stk > 1 ? ` · 最长连对 ${s.stk}` : ""}${s.pend ? ` · 待验证 ${s.pend}` : ""}</div></a>`;
    const few = S.few.length ? `<h2>样本太少（不到 ${m.min_n} 条，暂不排名）</h2><div class="card">${S.few.map((s) => `<a class="yr" data-bcard="${esc(s.b)}" href="#/gurus/b/${enc(s.b)}"><span>${esc(s.b)}<em>${s.n ? `对 ${s.hit}/${s.n}` : "还没有到期的判断"}${s.pend ? ` · 待验证 ${s.pend}` : ""}${s.tot ? ` · 共 ${s.tot} 条` : ""}</em></span><b>${s.n ? fmt(s.hr, 0) + "%" : "—"}</b></a>`).join("")}</div>` : "";
    const notes = (S.notes || []).map((n) => { const [h, ...t] = n.t.split("："); return `<details class="card gxnote"><summary>🛠 ${esc(h)}：对错改变 0 条（点开看）</summary><p>${esc(t.join("："))}</p></details>`; }).join("");
    const board = S.board ? `${weekCards()}
      <h2>博主排行榜 <span class="badge">全部 ${S.board.rows.length} 位 · 点表头排序 · 点名字看详情卡 · 点观点看 K 线</span></h2>
      <p class="muted small gxexp">名次按全部已判定观点的修正命中率（已判定 ≥ ${S.board.n} 条才排名）；「近30天」= ${md(S.board.d30)} 以来判出对错的；括号里是条数；连对/连错按发言先后看最近一串；「更新」= 最近一次去他的平台查新内容的日期${(() => { const g = S.board.rows.find((r) => r.src && r.src["群"]); return g && g.src["群"].latest ? `；群聊记录整理稿停在 ${md(g.src["群"].latest)}（采集暂停中），群里博主之后的新观点只来自他们的抖音` : ""; })()}。</p>
      <div id="gxboard">${boardBody()}</div>` : "";
    return `${notes}${board}
      <h2>博主详情卡 <span class="badge">按修正命中率，点进去看每一条</span></h2>
      <div class="card gconcl">${S.concl.map((s) => `<p>${esc(s)}</p>`).join("")}
        ${ab[1] ? `<p class="muted small">对照：同样这些时点如果一律「看多」，命中率 ${fmt((ab[0] * 100) / ab[1], 0)}%——博主要比它高才算真有判断力。</p>` : ""}</div>
      <div class="list">${S.rank.map(rc).join("") || `<div class="card muted">还没有博主攒够 ${m.min_n} 条可验证的判断。</div>`}</div>
      ${few}
      <details class="card gmeth"><summary>📏 怎么算「对」和「跟随收益」（点开）</summary>
        <p><b>基准价</b>：盘前（9:30 前）说的用当天开盘价；盘中说的用当天收盘价（保守，不假设能买在盘中）；收盘后、周末说的用下一交易日开盘价。</p>
        <p><b>观察期</b>：博主说「明天」看 1 个交易日、「这几天」3 个、「下周/一周」5 个、「两周」10 个、「一个月」20 个；没说期限按 5 个。没到期的记 ⏳ 待验证。</p>
        <p><b>对错</b>：看多期末涨了算对，看空期末跌了算对；「震荡/观望」单独统计，不进排名。条件单（如「回踩 3590 再买」）要价格真碰到才算数，没碰到记「未触发」。</p>
        <p><b>跟随收益</b>：看多记 +涨幅，看空记 −涨幅（躲过的跌幅也算价值），没扣手续费；扣 0.2% 往返成本的数字在博主页。</p>
        <p><b>修正命中率</b> = (对的条数+2)÷(总条数+4)：样本少时往 50% 拉，避免「2 条全对」就排第一。</p></details>`;
  }

  // ---------------- 按日期 ----------------
  function idxLine(x) {
    if (x.wait) return '<span class="muted">今天还没收盘，收盘后更新涨跌和评估</span>';
    if (!x.open) return '<span class="muted">休市（周末/节假日）：观点按下一交易日开盘价评估</span>';
    return Object.entries(x.idx).map(([k, v]) => `<span>${esc(k)} <b class="${updn(v)}">${pct(v, 2)}</b></span>`).join("");
  }
  function groupByB(cs, nob) {
    const g = new Map();
    cs.forEach((c) => { if (!g.has(c.b)) g.set(c.b, []); g.get(c.b).push(c); });
    return [...g].map(([b, xs]) => `<div class="ggrp">${nob ? "" : `<div class="ggh"><a href="#/gurus/b/${enc(b)}">👤 ${esc(b)}</a><span class="muted small">${xs.length} 条</span></div>`}<div class="gcs">${xs.map((c) => card(c, true)).join("")}</div></div>`).join("");
  }
  function dateTab(arg) {
    const ds = S.dates;
    if (!ds.length) return '<div class="card muted">暂无观点</div>';
    const cur = ds.find((x) => x.d === arg) || ds[0];
    const sh = (x) => (x.open && x.idx["上证"] != null ? `<span class="${updn(x.idx["上证"])}">上证${pct(x.idx["上证"], 1)}</span>` : `<span class="muted">${x.wait ? "未收盘" : "休市"}</span>`);
    const strip = `<div class="gdays" id="gdays">${ds.map((x) => `<a href="#/gurus/date/${x.d}" class="${x.d === cur.d ? "on" : ""}"><b>${md(x.d)}</b><em>周${wk(x.d)} · ${x.n}条</em>${sh(x)}</a>`).join("")}</div>`;
    const cs = CALLS.filter((c) => c.d === cur.d);
    return `${strip}<div class="card gday"><div class="gdh"><b>${cur.d} 周${wk(cur.d)}</b><span class="muted small">${cur.n} 条观点${cur.ok + cur.bad ? ` · 对 ${cur.ok} 错 ${cur.bad}` : ""}</span></div><div class="gidx">${idxLine(cur)}</div></div>
      ${groupByB(cs)}`;
  }

  // ---------------- 按博主 ----------------
  function bloggerTab(name) {
    const all = [...S.rank, ...S.few];
    if (!all.length) return '<div class="card muted">暂无博主</div>';
    const s = all.find((x) => x.b === name) || all[0];
    const sel = `<div class="chips scroll gsel">${all.map((x) => `<a class="chip ${x.b === s.b ? "on" : ""}" href="#/gurus/b/${enc(x.b)}">${esc(x.b)}${x.rk ? ` <em>#${x.rk}</em>` : ""}</a>`).join("")}</div>`;
    const kp = (k, v, cls = "", sub = "") => `<div><span>${k}</span><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
    const cs = CALLS.filter((c) => c.b === s.b).slice().reverse();
    const g = new Map();
    cs.forEach((c) => { if (!g.has(c.d)) g.set(c.d, []); g.get(c.d).push(c); });
    const tl = [...g].map(([d, xs]) => `<div class="gtl"><div class="gtld"><a href="#/gurus/date/${d}">${md(d)}</a><em>周${wk(d)}</em></div><div class="gcs">${xs.map((c) => card(c, true)).join("")}</div></div>`).join("");
    return `${sel}
      <div class="card"><div class="grh"><b style="font-size:18px">${esc(s.b)}</b>${s.rk ? `<span class="tag buy">第 ${s.rk} 名</span>` : `<span class="tag mid">样本太少</span>`}${dots(s.l5)}</div>
        ${hrBar(s.hr)}<div class="muted small">${s.d0 ? `${md(s.d0)} ~ ${md(s.d1)}` : ""} 共 ${s.tot} 条：看多 ${s.bull}、看空 ${s.bear}；可验证 ${s.n}${s.pend ? `，待验证 ${s.pend}` : ""}${s.untrig ? `，未触发 ${s.untrig}` : ""}${s.nodata ? `，无法验证 ${s.nodata}` : ""}</div></div>
      <div class="kpis gk">${kp("命中率", s.hr == null ? "—" : fmt(s.hr, 0) + "%", "", `对 ${s.hit}/${s.n} · 修正 ${fmt(s.bay, 0)}%`)}${kp("跟着做平均", pct(s.avg, 2), updn(s.avg), `扣成本 ${pct(s.avgc, 2)}`)}
        ${kp("最长连对", s.stk + " 条", "", `最近10条对 ${s.l10[0]}/${s.l10[1]}`)}${kp("分项", byTxt(s) || "—", "gsmall", s.h2 ? `跑赢沪深300 ${s.h2[0]}/${s.h2[1]}` : s.neu[1] ? `震荡判断 ${s.neu[0]}/${s.neu[1]}` : "")}</div>
      ${s.curve.length >= 2 ? `<h2>跟着他做的累计收益 <span class="badge">逐条相加，不扣成本</span></h2><div class="card chartcard"><div id="gcur" class="chart gsm-chart"></div><div class="note">每条可验证的判断按期末涨跌记一次：看多 +涨幅、看空 −涨幅。</div></div>` : ""}
      ${s.pnl.length ? `<h2>他自己说的账户 <span class="badge">博主自述，未经核实</span></h2><div class="card chartcard">${s.pnl.length >= 2 ? '<div id="gpnl" class="chart gsm-chart"></div>' : ""}<div class="note">${s.pnl.slice(-3).map((p) => `${md(p[0])}：${pnlText({ equity_wan: p[1], day_change_wan: p[2], ret_pct: p[3] })}`).join("；")}</div></div>` : ""}
      <h2>时间线 <span class="badge">点任意一条看 K 线</span></h2>${tl || '<div class="card muted">暂无</div>'}`;
  }
  async function bloggerCharts(name, tok) {
    const all = [...S.rank, ...S.few], s = all.find((x) => x.b === name) || all[0];
    if (!s || (s.curve.length < 2 && s.pnl.length < 2)) return;
    await need("lib");
    if (!A.alive(tok)) return;
    const base = { animation: false, grid: { left: 44, right: 12, top: 16, bottom: 26 }, tooltip: { trigger: "axis" } };
    if ($("#gcur")) {
      const c = A.mk($("#gcur"));
      c.setOption({ ...base, xAxis: { type: "category", data: s.curve.map((p) => md(p[0])), ...A.axisStyle() }, yAxis: { type: "value", ...A.axisStyle(), axisLabel: { formatter: "{value}%", color: "#6b7280", fontSize: 10 } },
        series: [{ type: "line", data: s.curve.map((p) => p[1]), symbolSize: 5, lineStyle: { width: 2, color: UP }, itemStyle: { color: UP },
          areaStyle: { color: "rgba(229,72,77,0.08)" }, markLine: { silent: true, symbol: "none", data: [{ yAxis: 0 }], lineStyle: { color: GR, type: "dashed" }, label: { show: false } } }] });
    }
    if ($("#gpnl")) {
      const eq = s.pnl.some((p) => p[1] != null);
      const c = A.mk($("#gpnl"));
      c.setOption({ ...base, xAxis: { type: "category", data: s.pnl.map((p) => md(p[0])), ...A.axisStyle() }, yAxis: { type: "value", scale: true, ...A.axisStyle(), axisLabel: { formatter: eq ? "{value}万" : "{value}万", color: "#6b7280", fontSize: 10 } },
        series: [eq ? { name: "自述账户", type: "line", data: s.pnl.map((p) => p[1]), connectNulls: true, lineStyle: { width: 2, color: "#8b5cf6" }, itemStyle: { color: "#8b5cf6" } }
          : { name: "自述当日盈亏", type: "bar", data: s.pnl.map((p) => ({ value: p[2], itemStyle: { color: p[2] >= 0 ? UP : DN } })) }] });
    }
  }

  // ---------------- 按板块 ----------------
  function secTab(arg) {
    const L = S.sectors;
    if (!L.length) return '<div class="card muted">暂无板块观点</div>';
    if (arg) {
      const r = L.find((x) => x.s === arg);
      if (r) {
        const cs = CALLS.filter((c) => c.k === "call" && (c.sc === "sector" || c.sc === "stock") && ((c.sec || c.tn || "").trim() === r.s)).slice().reverse();
        const bb = {};
        cs.forEach((c) => { const o = (bb[c.b] = bb[c.b] || { n: 0, h: 0, bull: 0, bear: 0 }); if (c.dir === "bull") o.bull++; if (c.dir === "bear") o.bear++; if (c.st === "ok" && c.dir !== "neutral") { o.n++; o.h += c.h; } });
        const rows = Object.entries(bb).sort((a, b) => b[1].n - a[1].n).map(([b, o]) => `<a class="yr" href="#/gurus/b/${enc(b)}"><span>${esc(b)}<em>看多 ${o.bull} · 看空 ${o.bear}</em></span><b>${o.n ? `对 ${o.h}/${o.n}` : "—"}</b></a>`).join("");
        return `<div class="crumb"><a href="#/gurus/sec">全部板块</a> / ${esc(r.s)}</div>
          <div class="card"><div class="grh"><b style="font-size:18px">🧩 ${esc(r.s)}</b><span class="muted small">被提及 ${r.n} 次</span></div>${secBar(r)}
            <div class="gst">提及后 5 个交易日平均 <b class="${updn(r.r5)}">${pct(r.r5, 2)}</b>${r.r5n ? `（${r.r5n} 次有数据）` : ""} · 方向判断对 ${r.hit[0]}/${r.hit[1]}${r.best ? ` · 最准：${esc(r.best[0])} ${r.best[1]}/${r.best[2]}` : ""}</div></div>
          <h2>各博主</h2><div class="card">${rows}</div><h2>全部观点 <span class="badge">点看 K 线</span></h2><div class="gcs">${cs.map((c) => card(c)).join("")}</div>`;
      }
    }
    return `<p class="muted small">板块和个股观点按所属板块归类；「提及后 5 日」= 每次被提到后 5 个交易日的平均涨跌（不分看多看空）。点进去看各博主对它说过什么。</p>
      <div class="list">${L.map((r) => `<a class="card gsr" href="#/gurus/sec/${enc(r.s)}"><div class="grh"><b>${esc(r.s)}</b><span class="muted small">${r.n} 次</span><span class="gr5 ${updn(r.r5)}">${r.r5 == null ? "—" : "5日 " + pct(r.r5, 1)}</span></div>${secBar(r)}
        <div class="gst muted">${r.hit[1] ? `判断对 ${r.hit[0]}/${r.hit[1]}` : "还没有到期的判断"}${r.best ? ` · 最准 ${esc(r.best[0])}` : ""} · ${r.bl.length} 位博主</div></a>`).join("")}</div>`;
  }
  function secBar(r) {
    const t = r.bull + r.bear + r.neu || 1;
    return `<div class="gbb"><i class="b" style="width:${(r.bull * 100) / t}%"></i><i class="n" style="width:${(r.neu * 100) / t}%"></i><i class="s" style="width:${(r.bear * 100) / t}%"></i></div>
      <div class="gbbt"><span class="up">看多 ${r.bull}</span>${r.neu ? `<span class="muted">中性 ${r.neu}</span>` : ""}<span class="dn">看空 ${r.bear}</span></div>`;
  }

  // ---------------- 弹窗：K 线 + 评估 ----------------
  let MOD = null, MCH = null, OPEN = false;
  function closeModal(fromPop) {
    if (!OPEN) return;
    OPEN = false;
    if (MCH) { MCH.dispose(); MCH = null; }
    MOD.classList.remove("show");
    document.body.style.overflow = "";
    if (!fromPop && history.state && history.state.gmod) history.back();
  }
  window.addEventListener("popstate", () => closeModal(true));
  window.addEventListener("hashchange", () => closeModal(true));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  window.addEventListener("resize", () => MCH && MCH.resize());
  const nums = (v) => (v == null ? [] : Array.isArray(v) ? v.filter((x) => typeof x === "number") : typeof v === "number" ? [v] : (String(v).match(/\d+(?:\.\d+)?/g) || []).map(Number));
  function lvText(lv) {
    if (!lv) return "";
    return Object.entries(lv).map(([k, v]) => `${(LVN[k] || [k])[0]} ${nums(v).join("–") || esc(v)}`).join("；");
  }
  function verdict(c) {
    const D = (DIRN[c.dir] || DIRN.neutral)[1];
    if (c.k === "pnl") return "博主自述账户盈亏，未经核实，不计准确率。";
    if (c.k === "review") return "事后回顾/复盘，不是事前判断，不计准确率。";
    if (c.st === "nodata") return `${c.note || "这个对象没有可用的行情代码（或取不到行情）"}。`;
    if (c.st === "untrig") return `条件单：观察期内价格没碰到 ${(c.cond || []).join("–")}，记「未触发」，不计准确率。`;
    if (c.st === "pending") return `还没到期：${c.note || "等行情走出来再判"}。`;
    if (c.dir === "neutral") return `判断「震荡」：期末涨跌 ${pct(c.r, 2)}，${c.h ? "在 ±1.5% 以内，算对" : "超出 ±1.5%，算错"}（中性判断不进排名）。`;
    const mv = c.r > 0 ? "涨了" : c.r < 0 ? "跌了" : "没动";
    return `${D}后 ${c.n} 个交易日${mv} ${pct(Math.abs(c.r), 2).replace("+", "")}，判断${c.h ? "✅ 正确" : "❌ 错误"}；跟着做 ${pct(c.f, 2)}（扣成本 ${pct(c.f - 0.2, 2)}）。`;
  }
  async function openCall(id) {
    try { await loadCalls(); } catch (e) { return; }
    const c = BYID[id];
    if (!c) return;
    if (!MOD) {
      MOD = document.createElement("div");
      MOD.id = "gmod";
      MOD.innerHTML = '<div class="gsheet" role="dialog"><div class="gmh"><b></b><button type="button">✕ 关闭</button></div><div class="gmb"></div></div>';
      document.body.appendChild(MOD);
      MOD.addEventListener("click", (e) => { if (e.target === MOD || e.target.closest(".gmh button")) closeModal(); });
    }
    if (MCH) { MCH.dispose(); MCH = null; }
    const D = DIRN[c.dir] || DIRN.neutral;
    MOD.querySelector(".gmh b").innerHTML = `${c.k === "call" ? `<span class="gdir ${D[2]}">${D[0]} ${D[1]}</span> ` : ""}${esc(c.k === "pnl" ? "自述账户" : tname(c))}${c.tc ? ` <span class="muted small">${esc(/^zb/.test(c.tc) ? c.px || "" : c.tc)}</span>` : ""}`;
    const rk = c.rk ? Object.entries(c.rk).map(([k, v]) => `${k}日 <b class="${updn(v)}">${pct(v, 2)}</b>`).join(" · ") : "";
    const row = (k, v) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : "");
    const other = CALLS.filter((x) => x.b === c.b && x.tc && x.tc === c.tc && x.id !== c.id && x.k === "call").length;
    MOD.querySelector(".gmb").innerHTML = `${c.tc && c.st !== "nodata" ? `<div id="gk" class="gkc"><div class="empty">正在加载 K 线…</div></div>
        <div class="gleg"><span><i class="up">▲</i>看多</span><span><i class="dn">▼</i>看空</span><span><i style="color:${GR}">●</i>中性</span><span><i style="color:${BL}">┅</i>基准价</span><span><i class="gma"></i>观察期</span>${other ? `<span>小点＝他对它的其他 ${other} 条</span>` : ""}${c.st === "pending" && c.bp == null ? "<span>发言日的 K 线还没走出来</span>" : ""}</div>` : ""}
      <div class="gmi">
        <div class="gmw">👤 <a href="#/gurus/b/${enc(c.b)}"><b>${esc(c.b)}</b></a> · ${esc(c.d)}${c.t ? " " + esc(c.t) : ""}${c.fd ? `<span class="muted small">（群里 ${esc(md(c.fd))}${c.ft ? " " + esc(c.ft) : ""} 转发）</span>` : ""}
          <div class="muted small">${esc(SCN[c.sc] || "")}${c.k === "call" ? ` · ${HZN[c.hz] || "没说期限"}` : ""}${c.act ? ` · ${esc(c.act)}` : ""}${c.pos != null ? ` · 仓位 ${esc(c.pos)}%` : ""}${c.conf && c.conf !== "high" ? ` · 署名可信度${c.conf === "low" ? "低" : "中"}` : ""}</div></div>
        <blockquote class="gq">${esc(c.q || c.sm || "")}</blockquote>
        ${c.sm && c.q ? `<div class="small">💡 ${esc(c.sm)}</div>` : ""}
        ${c.cnd || c.lv ? `<div class="small gcond">🎯 条件：${esc(c.cnd || "")}${c.lv ? `${c.cnd ? "；" : ""}价位 ${lvText(c.lv)}` : ""}</div>` : ""}
        ${c.k === "pnl" ? `<div class="small">💰 ${esc(pnlText(c.pnl))}（博主自述，未经核实）</div>` : ""}
        <h3>我们的评估 ${badge(c)}</h3>
        <div class="gv">${verdict(c)}</div>
        ${c.bp != null ? `<table class="mini gmt">${row("基准价", `${fmt(c.bp, c.bp < 10 ? 3 : 2)}（${esc(c.how || "")}，${esc(md(c.bd))}）`)}
          ${row("触发", c.tg ? `${esc(md(c.tg[0]))} 触价 ${c.tg[1]}，基准价改为触发价` : "")}
          ${row("观察期", c.n ? `${c.n} 个交易日${c.ed ? `，到 ${esc(md(c.ed))} 收盘` : ""}` : "")}
          ${row("期末收益", c.r != null ? `<b class="${updn(c.r)}">${pct(c.r, 2)}</b>` : "")}
          ${row("相对沪深300", c.ex != null ? `<b class="${updn(c.ex)}">${pct(c.ex, 2)}</b>（${c.h2 ? "方向对" : "方向错"}）` : "")}
          ${row("1/3/5/10日", rk)}</table>` : ""}
        ${c.note && c.st !== "pending" && c.st !== "nodata" ? `<div class="muted small">注：${esc(c.note)}</div>` : ""}
        <div class="small gml"><a href="#/gurus/b/${enc(c.b)}">看「${esc(c.b)}」的全部观点 ›</a>${c.tc && /^(sh|sz|bj)\d{6}$/.test(c.tc) && !/^(sh000|sz399|bj899)/.test(c.tc) ? ` · <a href="stock/#/s/${esc(c.tc)}">个股透视 ›</a>` : ""}</div>
        <p class="muted small">原话为群内转发截图/视频的识别摘录（≤120字），可能有识别误差；评估是程序按统一规则算的，不构成投资建议。</p>
      </div>`;
    MOD.querySelector(".gsheet").scrollTop = 0;
    if (!OPEN) { history.pushState({ gmod: 1 }, ""); }
    OPEN = true;
    MOD.classList.add("show");
    document.body.style.overflow = "hidden";
    if (!c.tc || c.st === "nodata") return;
    let K;
    try { [K] = await Promise.all([getJSON(`gurus/k/${c.tc}.json`, true), need("lib")]); } catch (e) {
      if ($("#gk")) $("#gk").innerHTML = '<div class="empty">K 线加载失败（网络不好），关掉再点一次试试</div>';
      return;
    }
    if (!OPEN || !$("#gk") || BYID[id] !== c) return;
    drawK(c, K);
  }
  function drawK(c, K) {
    const R = K.d, ds = R.map((r) => r[0]), n = R.length;
    const at = (d) => { const j = ds.findIndex((x) => x >= d); return j < 0 ? -1 : j; };
    const i = at(c.d) < 0 ? n - 1 : at(c.d);
    const mark = (x, big) => {
      const j = at(x.d);
      if (j < 0) return null;
      const r = R[j], bull = x.dir === "bull", bear = x.dir === "bear", col = bull ? UP : bear ? DN : GR;
      return { coord: [ds[j], bull ? r[3] : bear ? r[2] : r[4]], value: big ? (bull ? "看多" : bear ? "看空" : "中性") : "",
        symbol: bull || bear ? "arrow" : "circle", symbolSize: big ? [13, 17] : bull || bear ? [7, 9] : 6, symbolRotate: bear ? 180 : 0,
        symbolOffset: [0, bull ? (big ? 13 : 8) : bear ? (big ? -13 : -8) : 0], itemStyle: { color: col, opacity: big ? 1 : 0.6, borderColor: "#fff", borderWidth: big ? 1 : 0 },
        label: { show: !!big, position: bull ? "bottom" : "top", distance: 4, color: col, fontSize: 11, fontWeight: 700, formatter: "{c}" } };
    };
    const others = CALLS.filter((x) => x.b === c.b && x.tc === c.tc && x.id !== c.id && x.k === "call").map((x) => mark(x, false)).filter(Boolean);
    const main = mark(c, true);
    const pts = [...others, main].filter(Boolean);
    if (c.tg) pts.push({ coord: [c.tg[0], c.tg[1]], value: "触发", symbol: "pin", symbolSize: 26, itemStyle: { color: "#d97706" }, label: { show: true, fontSize: 9, color: "#fff", formatter: "触" } });
    const vis = R.slice(Math.max(0, i - 40), Math.min(n, i + 21));
    const lo = Math.min(...vis.map((r) => r[3])), hi = Math.max(...vis.map((r) => r[2]));
    const lines = [];
    if (c.bp != null) lines.push({ yAxis: c.bp, lineStyle: { color: BL, type: "dashed", width: 1.4 }, label: { formatter: `基准 ${c.bp}`, color: BL, position: "insideEndBottom" } });
    Object.entries(c.lv || {}).forEach(([k, v]) => nums(v).forEach((p) => {
      if (p < lo * 0.85 || p > hi * 1.15) return; // 价位是指数点位等对不上标的价格的，不画
      const [nm, col] = LVN[k] || [k, GR];
      lines.push({ yAxis: p, lineStyle: { color: col, type: "dotted", width: 1.2 }, label: { formatter: `${nm} ${p}`, color: col } }); }));
    const ib = c.bd ? ds.indexOf(c.bd) : -1;
    const s0 = ib < 0 ? i : ib; // 从基准K线到期末K线
    const e0 = c.ed ? ds.indexOf(c.ed) : c.st === "pending" ? n - 1 : -1;
    const area = c.bp != null && e0 > s0 ? [[{ xAxis: ds[s0] }, { xAxis: ds[e0] }]] : [];
    if (c.bp != null && e0 === s0 && e0 >= 0) lines.push({ xAxis: ds[s0], lineStyle: { color: "rgba(47,127,216,0.35)", type: "solid", width: 7 }, label: { show: false } });
    const el = $("#gk");
    el.innerHTML = "";
    MCH = echarts.init(el, null, { renderer: "canvas" });
    const axis = A.axisStyle();
    MCH.setOption({
      animation: false,
      grid: [{ left: 50, right: 10, top: 14, height: "64%" }, { left: 50, right: 10, top: "80%", height: "11%" }],
      tooltip: { trigger: "axis", axisPointer: { type: "cross" }, confine: true, textStyle: { fontSize: 12 },
        formatter: (ps) => { const p = ps.find((x) => x.seriesType === "candlestick") || ps[0]; const j = p.dataIndex, r = R[j], pv = j > 0 ? R[j - 1][4] : r[1];
          return `${r[0]}<br>开 ${r[1]}　收 <b style="color:${r[4] >= pv ? UP : DN}">${r[4]}</b><br>高 ${r[2]}　低 ${r[3]}<br>涨跌 ${pct((r[4] / pv - 1) * 100, 2)}`; } },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      xAxis: [{ type: "category", data: ds, ...axis, splitLine: { show: false }, axisLabel: { show: false }, boundaryGap: true },
        { type: "category", gridIndex: 1, data: ds, ...axis, splitLine: { show: false }, axisLabel: { color: "#6b7280", fontSize: 10, formatter: (v) => v.slice(5) } }],
      yAxis: [{ type: "value", scale: true, ...axis, splitNumber: 4, axisLabel: { color: "#6b7280", fontSize: 10 } }, { type: "value", gridIndex: 1, scale: true, axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false } }],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1], startValue: Math.max(0, i - 40), endValue: Math.min(n - 1, i + 20) },
        { type: "slider", xAxisIndex: [0, 1], startValue: Math.max(0, i - 40), endValue: Math.min(n - 1, i + 20), height: 14, bottom: 2, textStyle: { fontSize: 9, color: "#6b7280" }, brushSelect: false }],
      series: [{ type: "candlestick", name: K.n, data: R.map((r) => [r[1], r[4], r[3], r[2]]), itemStyle: { color: UP, color0: DN, borderColor: UP, borderColor0: DN },
        markPoint: { data: pts, animation: false }, markLine: { symbol: "none", silent: true, data: lines, label: { position: "insideStartTop", fontSize: 10 } },
        markArea: { silent: true, itemStyle: { color: "rgba(47,127,216,0.10)" }, label: { show: false }, data: area } },
      { type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: R.map((r, j) => ({ value: r[5], itemStyle: { color: r[4] >= (j ? R[j - 1][4] : r[1]) ? "rgba(229,72,77,.55)" : "rgba(47,168,107,.55)" } })) }],
    });
  }

  // ---------------- 抖音博主（说法验真，不进命中率排名；gurus/build_douyin.py → gurus/douyin.json） ----------------
  // on：false=群里博主、true=抖音、"wb"=微博（2026-11-20 加微博分栏）
  const seg = (on) => `<div class="gseg"><a href="#/gurus" class="${on ? "" : "on"}">🗣️ 群里博主<em>荐股命中率</em></a><a href="#/gurus/dy" class="${on === true ? "on" : ""}">📱 抖音博主<em>说法验真</em></a><a href="#/gurus/wb" class="${on === "wb" ? "on" : ""}">🧣 微博红人<em>名言+命中率</em></a></div>`;
  function dyCss() {
    if (document.getElementById("gdy-css")) return;
    const st = document.createElement("style");
    st.id = "gdy-css";
    st.textContent = `.gseg{display:flex;gap:6px;margin:2px 0 8px}.gseg a{flex:1 1 0;min-width:0;text-align:center;padding:7px 4px;border-radius:10px;border:1px solid var(--line,#e3e6ea);background:#fff;font-size:14px;line-height:1.3;color:var(--text,#222)}
.gseg a em{display:block;font-style:normal;font-size:11px;color:#6b7280}.gseg a.on{border-color:var(--up,#d93025);background:#fff5f4;font-weight:600}.gseg a.on em{color:var(--up,#d93025)}
.gdy{overflow:hidden}.gdyh{display:flex;align-items:center;gap:10px}.gav{flex:0 0 42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700;color:#fff}
.gdyh .nm{flex:1;min-width:0;overflow-wrap:anywhere}.gdyh .nm b{font-size:17px}.gdyf{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 4px}.gdyf span{font-size:12px;padding:2px 8px;border-radius:999px;background:#f1f3f5;color:#444}
.gdyw{font-size:12px;color:#6b7280;overflow-wrap:anywhere}.gdyr{display:flex;gap:8px;padding:8px 0;border-top:1px dashed var(--line,#e3e6ea)}.gdyr>i{font-style:normal;flex:0 0 20px;font-size:15px}
.gdyr>div{min-width:0;flex:1;overflow-wrap:anywhere}.gdyr b{font-weight:600;font-size:14px}.gdyr .small{color:#4b5563;margin-top:2px}.gdyl{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.gdyp{padding:10px;border-radius:8px;background:#f8fafc;color:#6b7280;font-size:13px;margin-top:8px}
.gxcards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:6px 0 4px}.gxc{padding:12px 14px;min-width:0}
.gxct{font-weight:700;font-size:15px}.gxct em{display:block;font-style:normal;font-weight:400;font-size:11px;color:var(--sub)}
.gxc ol,.gxc ul{margin:6px 0 4px;padding-left:20px}.gxc li{margin:3px 0;overflow-wrap:anywhere}.gxc a[data-jump],.gxb a{cursor:pointer;color:var(--text);font-weight:600}
.gxcn{font-size:12px;color:var(--sub);margin-top:6px;overflow-wrap:anywhere}
.gxcr{display:flex;align-items:center;gap:8px;margin-top:8px}.gxcr>span:first-child{flex:0 0 58px;font-size:13px}.gxcr .small{flex:none;white-space:nowrap}
.gxbb{flex:1;display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--soft);min-width:24px}.gxbb i{display:block}.gxbb .b{background:var(--up)}.gxbb .s{background:var(--dn)}.gxbb .n{background:#c9ced6}
.gxwho{font-size:11px;color:var(--sub);margin:2px 0 0 66px;overflow-wrap:anywhere}
.gxvs{display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:13px}.gxvs span{min-width:0;overflow-wrap:anywhere}
.gxk{flex:none;font-style:normal;font-size:12px;padding:1px 7px;border-radius:999px;font-weight:600}.gxk-s{background:#e8f1fb;color:#1d5fa8}.gxk-d{background:var(--warn-bg);color:var(--warn-t)}.gxk-h,.gxk-n{background:var(--soft);color:var(--sub)}
.gxt{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.gxr{display:grid;grid-template-columns:34px minmax(140px,1.3fr) 112px 112px minmax(200px,3.2fr) 66px 50px;gap:0 10px;align-items:center;padding:8px 12px;border-top:1px solid var(--line);font-size:13px}
.gxr:first-child{border-top:0}.gxh{background:var(--soft);font-size:12px;color:var(--sub);font-weight:600}.gxh [data-sort]{cursor:pointer;user-select:none}.gxh [data-sort]:hover{color:var(--brand)}
.gxrk{font-weight:700;text-align:center;color:var(--sub)}.gxb{min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:3px}.gxb a{font-size:14px;margin-right:2px;overflow-wrap:anywhere}
.gxp{font-style:normal;font-size:10px;padding:0 5px;border-radius:4px;line-height:16px}.gxp-q{background:#eef2ff;color:#4338ca}.gxp-d{background:#1f2328;color:#fff}.gxp-w{background:#fff1e6;color:#c2410c}
.gx30,.gxall,.gxm{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 2px;min-width:0}.gxn{font-style:normal;font-size:11px;color:var(--sub)}.gxl{font-style:normal;font-size:10px;color:var(--sub);margin-right:3px}
.gxbar{flex:0 0 100%;height:4px;background:var(--soft);border-radius:2px;position:relative;margin-top:3px}.gxbar i{display:block;height:100%;border-radius:2px}.gxbar i.y{background:var(--up)}.gxbar i.n{background:var(--dn)}
.gxbar:after{content:"";position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#9aa0a6}
.gxl1{min-width:0}.gxlast{display:block;color:var(--text);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gxlast:hover b{color:var(--brand)}
.gxlast .gxd{color:var(--sub);margin-right:5px}.gxlast .gdir{margin-right:5px}.gxlast b{margin-right:5px}.gxsm{color:var(--sub)}.gxupd{color:var(--sub);font-size:12px}
.gxm,.gxm2{display:none}.gxfew .gxrk{color:var(--sub2)}.gxref{background:#fafbfc}.gxref .gxb{color:var(--sub);font-weight:600}
.gxsort{display:none}.gxfh{font-size:14px;margin:14px 0 6px;color:var(--sub)}.gxexp{margin:-4px 0 8px}
.gxnote{padding:10px 14px;margin-bottom:8px}.gxnote summary{cursor:pointer;font-size:13px}.gxnote p{font-size:13px;color:var(--sub);margin:8px 0 0}
.gxflash{outline:2px solid var(--brand);outline-offset:2px}
@media (max-width:1100px){.gxcards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){.gxcards{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.gxw2{grid-column:1/-1}.gxdk{display:none}.gxc{padding:10px 11px}.gxct{font-size:14px}.gxc ol,.gxc ul{padding-left:16px;margin:4px 0 2px}.gxcr{margin-top:6px}.gxh{display:none}.gxsort{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}.gxsort .chip{padding:3px 10px}
.gxr{grid-template-columns:24px minmax(0,1fr) auto;grid-template-areas:"rk b m" "rk m2 m2" "rk l l";gap:3px 8px;padding:9px 10px}
.gxrk{grid-area:rk;align-self:start;padding-top:2px}.gxb{grid-area:b}.gx30,.gxall,.gxstk,.gxupd{display:none}
.gxm{display:flex;grid-area:m;justify-self:end;width:116px}.gxm2{display:block;grid-area:m2;font-size:12px;color:var(--sub);overflow-wrap:anywhere}
.gxl1{grid-area:l}.gxlast{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:13px}.gxref .gxl1{display:none}}`;
    document.head.appendChild(st);
  }
  const VV = { ok: ["✅", "成立"], partial: ["⚠️", "部分成立"], no: ["❌", "不成立"] };
  const AVC = ["#e5484d", "#2f7fd8", "#8b5cf6", "#d97706", "#2fa86b", "#0ea5e9"];
  const wan = (n) => (n == null ? "" : n >= 10000 ? fmt(n / 10000, 1) + " 万" : String(n));
  function dyCard(x, i) {
    const w = x.works || {};
    const wl = [w.recent30 != null ? `近 30 天 ${w.recent30} 条` : "", w.total ? `共 ${w.total} 条` : "", w.latest_date ? `最新 ${md(w.latest_date)}${w.latest_title ? `「${esc(w.latest_title)}」` : ""}` : ""].filter(Boolean).join(" · ");
    const rows = x.claims.map((c) => `<div class="gdyr"><i title="${VV[c.v][1]}">${VV[c.v][0]}</i><div><b>${esc(c.c)}</b><div class="small">${esc(c.n)}${c.auto ? "（自动摘自报告）" : ""}</div></div></div>`).join("");
    const st = x.status === "pending" ? '<span class="tag mid">🔬 检验中</span>' : `<span class="tag">${x.cnt.ok ? `✅${x.cnt.ok} ` : ""}${x.cnt.partial ? `⚠️${x.cnt.partial} ` : ""}${x.cnt.no ? `❌${x.cnt.no}` : ""}</span>`;
    return `<div class="card gdy"><div class="gdyh"><span class="gav" style="background:${AVC[i % AVC.length]}">${esc(x.ini)}</span>
        <div class="nm"><b>${esc(x.name)}</b><div class="gdyw">抖音号 ${esc(x.dy_id || "—")}${x.followers ? ` · 粉丝 ${wan(x.followers)}` : ""}</div></div>${st}</div>
      ${x.fields.length ? `<div class="gdyf">${x.fields.map((f) => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
      ${x.style ? `<div class="gdyw">${esc(x.style)}</div>` : ""}${wl ? `<div class="gdyw">📹 ${wl}</div>` : ""}
      ${rows ? `<div style="margin-top:6px">${rows}</div>` : `<div class="gdyp">🔬 检验中：正在逐条复刻他视频里的方法和说法，报告出来后这里自动显示「说法｜结论｜一句话」。</div>`}
      <div class="gdyl">${x.lab ? `<a class="chip" href="#/labs/${esc(x.lab)}">🔬 看完整验真 ›</a>` : `<a class="chip" href="#/labs">🔬 验真列表 ›</a>`}${x.rank ? `<a class="chip" href="#/gurus/b/${enc(x.name)}">🏆 已进荐股排名${x.rank.rk ? ` #${x.rank.rk}` : ""} ›</a>` : ""}</div></div>`;
  }
  async function dyPage(tok, head) {
    dyCss();
    app.innerHTML = head + seg(true) + LOADING();
    let Y;
    try { Y = await getJSON("gurus/douyin.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = head + seg(true) + FAIL("抖音博主数据暂未生成或加载失败"); return; }
    if (!A.alive(tok)) return;
    const c = Y.cnt || {};
    const sub = `<p class="muted small gsub">抖音这几位多是讲方法、讲观点，不喊具体买卖，所以<b>不算命中率</b>，只把视频里的说法拿真实数据验一遍：✅ 成立 ${c.ok || 0} · ⚠️ 部分成立 ${c.partial || 0} · ❌ 不成立 ${c.no || 0}${Y.pending ? ` · 🔬 检验中 ${Y.pending} 位` : ""}。以后谁说出具体的看多/看空，再放进「群里博主」那边一起排名。更新于 ${esc(Y.built)}</p>`;
    app.innerHTML = head + seg(true) + sub + `<div class="list">${(Y.items || []).map(dyCard).join("") || '<div class="card muted">暂无</div>'}</div>` +
      '<p class="disclaimer">说法摘自博主公开视频（语音转写可能有误），验真为程序按统一口径复刻计算，只检验能检验的部分，不构成投资建议。</p>';
  }

  // ---------------- 微博红人（gurus/build_weibo.py → gurus/weibo.json；判断照常进排名，这里另给「一律看多」对照和名言验真） ----------------
  function wbCard(x, i) {
    const w = x.works || {}, t = x.stats || {};
    const wl = [w.fetched != null ? `抓取原创 ${w.fetched} 条（${md(w.first_date)} ~ ${md(w.latest_date)}）` : "", w.recent30 != null ? `近 30 天 ${w.recent30} 条` : ""].filter(Boolean).join(" · ");
    const p = (a) => (a && a[1] ? `${a[0]}/${a[1]}（${fmt((a[0] / a[1]) * 100, 0)}%）` : "—");
    const st = t.n ? `<div class="gdyp" style="color:#374151">🎯 到期可验证 <b>${t.n}</b> 条，对 <b>${p([t.hit, t.n])}</b>；同样时间点<b>一律看多</b> ${p(t.allbull)}、一律看空 ${p(t.allbear)}${t.pend ? ` · 待验证 ${t.pend}` : ""}${t.verdict ? `<br>${esc(t.verdict)}` : ""}</div>`
      : `<div class="gdyp">${t.tot ? `有方向的判断 ${t.tot} 条，还没有到期的` : "抓到的微博里几乎没有可打分的大盘/板块方向判断"}${t.verdict ? `：${esc(t.verdict)}` : ""}</div>`;
    const rows = x.claims.map((c) => `<div class="gdyr"><i title="${VV[c.v][1]}">${VV[c.v][0]}</i><div><b>${esc(c.c)}</b><div class="small">${c.dd ? esc(c.dd) + " · " : ""}${esc(c.n)}</div></div></div>`).join("");
    return `<div class="card gdy"><div class="gdyh"><span class="gav" style="background:${AVC[i % AVC.length]}">${esc(x.ini)}</span>
        <div class="nm"><b>${esc(x.name)}</b><div class="gdyw">微博 @${esc(x.wb_name || x.name)}${x.followers ? ` · 粉丝 ${wan(x.followers)}` : ""}</div></div>${x.claims.length ? `<span class="tag">${x.cnt.ok ? `✅${x.cnt.ok} ` : ""}${x.cnt.partial ? `⚠️${x.cnt.partial} ` : ""}${x.cnt.no ? `❌${x.cnt.no}` : ""}</span>` : ""}</div>
      ${x.fields.length ? `<div class="gdyf">${x.fields.map((f) => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
      ${x.style ? `<div class="gdyw">${esc(x.style)}</div>` : ""}${x.recent ? `<div class="gdyw">🧭 最近怎么看：${esc(x.recent)}</div>` : ""}${wl ? `<div class="gdyw">📝 ${wl}</div>` : ""}
      ${st}${rows ? `<div style="margin-top:6px">${rows}</div>` : ""}
      <div class="gdyl">${x.rank ? `<a class="chip" href="#/gurus/b/${enc(x.name)}">🏆 看他的每条判断${x.rank.rk ? `（排名 #${x.rank.rk}）` : ""} ›</a>` : t.tot ? `<a class="chip" href="#/gurus/b/${enc(x.name)}">👤 看他的每条判断 ›</a>` : ""}${x.uid ? `<a class="chip" href="https://weibo.com/u/${esc(x.uid)}" target="_blank" rel="noopener">🧣 微博主页 ›</a>` : ""}</div></div>`;
  }
  async function wbPage(tok, head) {
    dyCss();
    app.innerHTML = head + seg("wb") + LOADING();
    let Y;
    try { Y = await getJSON("gurus/weibo.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = head + seg("wb") + FAIL("微博红人数据暂未生成或加载失败"); return; }
    if (!A.alive(tok)) return;
    const c = Y.cnt || {};
    const sub = `<p class="muted small gsub">网上有名的炒股红人，抓他们自己发的微博（原创），有明确看多/看空的判断按「群里博主」同一套规则打分（也进排行），再和「同样时间点一律看多/看空」比一比——<b>一直看多的人在涨的时候也会显得很准</b>。名言（如「钻石底」）单独查说完之后 20/60/120 个交易日指数涨跌：✅ 成立 ${c.ok || 0} · ⚠️ 部分成立 ${c.partial || 0} · ❌ 不成立 ${c.no || 0}。更新于 ${esc(Y.built)}</p>`;
    app.innerHTML = head + seg("wb") + sub + `<div class="list">${(Y.items || []).map(wbCard).join("") || '<div class="card muted">暂无</div>'}</div>` +
      '<p class="disclaimer">内容摘自博主公开微博（原创，不含转发），判断由程序按统一口径对照真实行情计算，只检验能检验的部分，不构成投资建议。</p>';
  }

  function jumpTo(name) {
    const el = [...document.querySelectorAll("[data-bcard]")].find((x) => x.dataset.bcard === name);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("gxflash");
      setTimeout(() => el.classList.remove("gxflash"), 1600);
      return;
    }
    const r = S && S.board && S.board.rows.find((x) => x.b === name);
    location.hash = r && r.pl.includes("微博") ? "#/gurus/wb" : r && r.pl.includes("抖音") ? "#/gurus/dy" : `#/gurus/b/${enc(name)}`;
  }

  // ---------------- 页面 ----------------
  async function page(tab, arg) {
    document.title = "博主观点 · 小七投研";
    const tok = A.tok();
    setHdr();
    dyCss();
    const head = '<h1>🗣️ 博主观点：谁说得准？</h1>';
    if (tab === "dy") return dyPage(tok, head);
    if (tab === "wb") return wbPage(tok, head);
    tab = TABS.some((t) => t[0] === tab) ? tab : "rank";
    const tabs = `<div class="subtabs">${TABS.map(([k, t]) => `<a href="#/gurus${k === "rank" ? "" : "/" + k}" class="${k === tab ? "on" : ""}">${t}</a>`).join("")}</div>`;
    app.innerHTML = head + seg(false) + tabs + LOADING();
    app.onclick = (e) => {
      const so = e.target.closest("[data-sort]");
      if (so && $("#gxboard")) { const k = so.dataset.sort; if (BSORT === k) BDESC = !BDESC; else { BSORT = k; BDESC = false; } $("#gxboard").innerHTML = boardBody(); return; }
      const j = e.target.closest("[data-jump]");
      if (j) { e.preventDefault(); jumpTo(j.dataset.jump); return; }
      const t = e.target.closest("[data-cid]"); if (t) { e.preventDefault(); openCall(t.dataset.cid); } };
    try {
      S = await getJSON("gurus/summary.json", true);
      if (tab !== "rank") await loadCalls();
    } catch (e) { if (A.alive(tok)) app.innerHTML = head + seg(false) + tabs + FAIL("博主数据暂未生成或加载失败"); return; }
    if (!A.alive(tok)) return;
    const m = S.meta;
    const sub = `<p class="muted small gsub">把网上博主说过的「看多/看空」拿真实行情对一遍。覆盖 ${md(m.d0)} ~ ${md(m.d1)}（${m.tdays} 个交易日），${m.calls} 条观点、${m.bloggers} 位博主，已到期可验证 ${m.ok} 条。更新于 ${esc(m.built)}</p>`;
    const body = tab === "rank" ? rankTab() : tab === "date" ? dateTab(arg) : tab === "b" ? bloggerTab(arg) : secTab(arg);
    app.innerHTML = head + seg(false) + sub + tabs + body + DISC;
    if (tab === "date") { const on = $("#gdays a.on"), st = $("#gdays"); if (on && st) st.scrollLeft = on.offsetLeft - st.clientWidth / 2 + on.clientWidth / 2; }
    if (tab === "b") { const on = $(".gsel .chip.on"), st = $(".gsel"); if (on && st) st.scrollLeft = on.offsetLeft - st.clientWidth / 2 + on.clientWidth / 2; bloggerCharts(arg, tok); }
  }
  window.__mod_gurus = { page, openCall };
})();
