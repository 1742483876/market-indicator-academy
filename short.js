/* 短线页（按需加载）：以 short_latest.json（shortterm.py 全市场短线：阶段 / 天梯 / 晋级率 / 题材 / 字辈 / 竞价）为主，
   浏览器实时直取东方财富涨停池作为盘中补充；拿不到 json 时退回旧版（实时 / 快照）。 */
(function () {
  const A = window.__APP;
  const { app, $, esc, fmt, pct, updn, LOADING, FAIL, DISC, getJSON, need, mk, C, zoom, axisStyle, bjDate, shortMood, STAGE_C } = A;
  const EMU = "https://push2ex.eastmoney.com/";
  const EMP = { zt: ["getTopicZTPool", "fbt:asc"], dt: ["getTopicDTPool", "fund:asc"], zb: ["getTopicZBPool", "fbt:asc"], yz: ["getYesterdayZTPool", "zs:desc"] };
  const emURL = (k, date) => `${EMU}${EMP[k][0]}?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=500&sort=${EMP[k][1]}&date=${date}`;
  let jpN = 0, SHOW = null, BOUND = false;
  function jsonp(url, ms = 8000) {
    return new Promise((res, rej) => {
      const cb = "__emcb" + ++jpN + "_" + Date.now(), el = document.createElement("script");
      const t = setTimeout(() => { done(); rej(new Error("timeout")); }, ms);
      const done = () => { clearTimeout(t); delete window[cb]; el.remove(); };
      window[cb] = (j) => { done(); res(j); };
      el.src = url + "&cb=" + cb; el.onerror = () => { done(); rej(new Error("jsonp")); };
      document.head.appendChild(el);
    });
  }
  let emMode = "fetch";
  async function emPool(k, date) {
    const url = emURL(k, date);
    if (emMode === "fetch") {
      try {
        const ac = new AbortController(), t = setTimeout(() => ac.abort(), 8000);
        const r = await fetch(url, { credentials: "omit", cache: "no-store", signal: ac.signal });
        clearTimeout(t);
        const j = await r.json();
        return (j.data && j.data.pool) || [];
      } catch (e) { emMode = "jsonp"; }
    }
    const j = await jsonp(url);
    return (j.data && j.data.pool) || [];
  }
  const symOf = (c, m) => (m === 1 ? "sh" : /^(8|4|92)/.test(c) ? "bj" : "sz") + c;
  const normLive = (P) => ({
    zt: P.zt.map((p) => ({ c: p.c, m: p.m, n: p.n, zdp: p.zdp, hy: p.hybk || "", lbc: p.lbc || 1, fbt: p.fbt, lbt: p.lbt, zbc: p.zbc || 0, fund: p.fund, amount: p.amount, days: (p.zttj || {}).days, ct: (p.zttj || {}).ct })),
    dt: P.dt.map((p) => ({ c: p.c, m: p.m, n: p.n, zdp: p.zdp, hy: p.hybk || "", fund: p.fund, amount: p.amount })),
    zb: P.zb.map((p) => ({ c: p.c, m: p.m, n: p.n, zdp: p.zdp, hy: p.hybk || "", zbc: p.zbc, fbt: p.fbt, amount: p.amount })),
    yz: P.yz.map((p) => ({ c: p.c, m: p.m, n: p.n, zdp: p.zdp, hy: p.hybk || "", ylbc: p.ylbc || 1 })),
  });
  const normSnap = (S) => ({
    zt: S.zt.map((r) => ({ c: r[0], m: r[1], n: r[2], zdp: r[3], hy: r[4], lbc: r[5] || 1, fbt: r[6], lbt: r[7], zbc: r[8] || 0, fund: r[9], amount: r[10], days: r[11], ct: r[12] })),
    dt: S.dt.map((r) => ({ c: r[0], m: r[1], n: r[2], zdp: r[3], hy: r[4], fund: r[5], amount: r[6] })),
    zb: S.zb.map((r) => ({ c: r[0], m: r[1], n: r[2], zdp: r[3], hy: r[4], zbc: r[5], fbt: r[6], amount: r[7] })),
    yz: S.yz.map((r) => ({ c: r[0], m: r[1], n: r[2], zdp: r[3], hy: r[4], ylbc: r[5] || 1 })),
  });
  async function liveShort() {
    const now = bjDate();
    for (let i = 0, tried = 0; i < 12 && tried < 6; i++) {
      const d = new Date(now.getTime() - i * 86400e3);
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      tried++;
      const ds = d.toISOString().slice(0, 10).replace(/-/g, "");
      const zt = await emPool("zt", ds);
      if (!zt.length) continue;
      const [dt, zb, yz] = await Promise.all(["dt", "zb", "yz"].map((k) => emPool(k, ds)));
      const iso = `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6)}`, isToday = i === 0;
      const hm = now.getUTCHours() * 60 + now.getUTCMinutes();
      return { date: iso, time: isToday && hm < 15 * 60 + 5 ? `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} 盘中` : "收盘", ...normLive({ zt, dt, zb, yz }), notToday: !isToday };
    }
    throw new Error("最近几天都没有涨停数据");
  }
  function shortStats(P) {
    const n = P.zt.length, z = P.zb.length, yp = P.yz.map((x) => x.zdp).filter((x) => x != null);
    return { zt: n, dt: P.dt.length, zb: z, zb_rate: n + z ? (z / (n + z)) * 100 : null, max_lb: Math.max(0, ...P.zt.map((x) => x.lbc)), lb_cnt: P.zt.filter((x) => x.lbc >= 2).length,
      prem: yp.length ? yp.reduce((a, b) => a + b, 0) / yp.length : null, prem_up: yp.length ? (yp.filter((x) => x > 0).length / yp.length) * 100 : null };
  }
  const hm6 = (t) => { t = String(t || "").padStart(6, "0"); return `${t.slice(0, 2)}:${t.slice(2, 4)}`; };
  const yi = (v) => (v == null ? "—" : Math.abs(v) >= 1e8 ? (v / 1e8).toFixed(1) + "亿" : (v / 1e4).toFixed(0) + "万");
  const stockA = (x, extra = "") => `<a class="sk" href="stock/#/s/${symOf(x.c, x.m)}"><b>${esc(x.n.replace(/\s+/g, ""))}</b>${extra}</a>`;

  // ---------------- 全市场短线（shortterm.py → short_latest.json） ----------------
  const symC = (c) => (/^(8|4|92)/.test(c) ? "bj" : /^[569]/.test(c) ? "sh" : "sz") + c;
  const ymd = (s) => String(s || "").replace(/-/g, "");
  const md = (s) => { s = ymd(s); return `${s.slice(4, 6)}-${s.slice(6, 8)}`; };
  const lvName = (k) => (+k >= 5 ? `${k}板` : +k === 1 ? "首板" : `${k}板`);
  function nameMap(J) {
    const m = {};
    Object.values(J.ladder || {}).forEach((v) => v.forEach((x) => (m[x.n.replace(/\s+/g, "")] = x.c)));
    const a = J.auction || {};
    ["grab", "dump", "heavy"].forEach((k) => (a[k] || []).forEach((x) => { if (x.c) m[x.n.replace(/\s+/g, "")] = x.c; }));
    ((J.open_auction || {}).rows || []).forEach((x) => (m[x.n.replace(/\s+/g, "")] = x.c));
    return m;
  }
  function render(J, H) {
    const s = J.stats || {}, st = J.stage || ["—", ""], N = nameMap(J);
    const nl = (t) => { const raw = String(t || ""), base = raw.replace(/[(（].*$/, "").replace(/\s+/g, ""); return N[base] ? `<a href="stock/#/s/${symC(N[base])}">${esc(raw.replace(/\s+/g, ""))}</a>` : esc(raw.replace(/\s+/g, "")); };
    const names = (xs) => (xs || []).map(nl).join("、") || "—";
    const hist = J.hist || [], last = hist[hist.length - 1] || {}, prev = hist[hist.length - 2];
    let rank = "";
    if (hist.length >= 5) rank = `涨停 ${s.zt} 家在近 ${hist.length} 个交易日里排第 ${hist.filter((h) => h.zt > s.zt).length + 1}${prev ? `，较上一交易日 ${s.zt - prev.zt >= 0 ? "+" : ""}${s.zt - prev.zt} 家` : ""}。`;
    const kp = (k, v, cls = "", sub = "") => `<div><span>${k}</span><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
    const out = [];
    out.push("@ov@" + `<div class="muted small">数据 <b>${md(J.ladder_date || J.date)}</b> ${J.intraday ? "盘中" : "收盘"}（${esc(String(J.computed_at || "").slice(5))} 计算）｜全市场涨停池 + 题材 / 字辈统计</div><div id="slive"></div>
      ${(() => { const ys = (J.yeren || {}).stage; const YC = STAGE_C;
        return ys ? `<div class="card moodcard"><span class="mood big ${YC[ys.name] || "mix"}">${esc(ys.name)}</span><div><b>短线仓位 ${esc(ys.pos)}${ys.switch_day ? "（新老周期切换日）" : ""}</b><div class="small">✅ ${esc(ys.do)}　⛔ ${esc(ys.dont)}</div><div class="muted small">${rank}按《野人哥交易实战笔记》五阶段判定，依据见下方「野人哥视角」。</div></div></div>`
          : `<div class="card moodcard"><span class="mood big ${STAGE_C[st[0]] || "mix"}">${esc(st[0])}</span><div><b>${esc(st[1])}</b><div class="muted small">${rank}阶段怎么判断见 <a href="#/lesson/sl-cycle">情绪周期</a>，只作参考。</div></div></div>`; })()}
      <div class="kpis k4">${kp("涨停", s.zt, "up")}${kp("跌停", s.dt, "dn")}${kp("炸板", s.zb, "", `炸板率 ${fmt(s.zb_rate, 0)}%`)}${kp("最高连板", s.top + " 板", "up", last.n3 != null ? `≥3板 ${last.n3} 只` : "")}
        ${kp("昨涨停今日", pct(s.yz_prem, 2), updn(s.yz_prem), `上涨占比 ${fmt(s.yz_up, 0)}%`)}${(() => { const p1 = (J.promo || []).find((p) => p.lv === 1), p2 = (J.promo || []).find((p) => p.lv === 2); return p1 ? kp("首板晋级率", fmt(p1.rate, 0) + "%", "", p2 ? `2板晋级 ${fmt(p2.rate, 0)}%` : "") : kp("上一交易日涨停", prev ? prev.zt : "—"); })()}</div>`);
    const Y = J.yeren;
    const D = Y && Y.decision;
    if (D) {
      const vc = D.verdict === "可以考虑买入" ? "up" : D.verdict === "不推荐买入" ? "dn" : "mix";
      out.push(`<div class="card concl" style="border-left:6px solid var(--up,#d93025)"><div class="small muted">🎯 短线结论（${esc(D.stage)}，短线总仓位 ≤${fmt(D.cap, 0)}%）</div>
        <div style="font-size:20px;font-weight:700" class="${vc}">${esc(D.verdict)}</div><div class="small">${esc(D.why)}</div>
        ${(D.picks || []).map((p) => `<div class="ml"><div class="mlh"><a href="stock/#/s/${symC(p.code)}"><b>${esc(p.name)}</b></a><span class="badge">${esc(p.role)}·${esc(p.theme)}</span></div>
          <div class="small">${esc(p.board)}｜${esc(p.mode)}</div>
          <div class="small">买入价 <b>${p.buy_lo} – ${p.buy_hi}</b>｜止损 <b class="dn">${p.stop}</b>｜目标 <b class="up">${p.t1} / ${p.t2}</b>｜仓位 ≤${fmt(p.pos, 0)}%</div>
          <div class="muted small">条件：${esc(p.cond)}</div></div>`).join("") || '<div class="muted small">今天没有可买的短线标的。</div>'}
        ${(D.avoid || []).length ? `<div class="small">⛔ 回避：${esc(D.avoid.join("；"))}</div>` : ""}
        <div class="muted small">按《野人哥交易实战笔记》买点规则程序生成：条件不满足就不买；单笔亏损 −5%~−7% 无条件止损。</div></div>`);
    }
    if (Y && Y.stage) {
      const ys = Y.stage, ok = (v) => (v ? "✅" : v === false ? "❌" : "—");
      const YC = STAGE_C;
      out.push("@ov@" + `<h2>🧭 野人哥视角 <span class="muted small">《野人哥交易实战笔记》情绪周期 × 主线五步法</span></h2>
        <div class="card yeren"><div class="small"><b>为什么是「${esc(ys.name)}」</b>：${esc(ys.why)}</div>
          <details><summary>判定数据</summary><table class="tbl">${Object.entries(ys.evidence || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}
          ${(ys.nuke || []).length ? `<tr><td>核按钮</td><td>${names(ys.nuke)}</td></tr>` : ""}</table></details></div>
        <div class="card"><div class="small"><b>主线五步法</b>：②首日异动（涨停≥5 且板块≥3%）→ ③容量中军（≥100亿、趋势向上）→ ④老龙异动 → ⑤次日验证（龙头≥2板、梯队完整、昨涨停红盘率>50%）。①消息级别看报告解读。</div>
          ${(Y.mainline || []).map((m) => `<div class="ml"><div class="mlh"><b>${esc(m.concept)}</b><span class="badge ${/确认/.test(m.verdict) ? "good" : /脉冲/.test(m.verdict) ? "warn" : "gray"}">${esc(m.verdict.replace(/（.*$/, ""))}</span></div>
            <div class="small">${ok(m.s2)} 异动：涨停 ${m.zt}、板块 ${m.board_pct == null ? "—" : pct(m.board_pct, 2)}</div>
            <div class="small">${ok(m.s3)} 中军：${(m.mids || []).map((x) => `${x.ok ? "✅" : "❌"}${esc(x.n)} ${x.mcap}亿 ${pct(x.pct, 1)}`).join("；") || "无百亿中军"}</div>
            <div class="small">${ok(m.s4)} 老龙：${esc(m.old)}</div>
            <div class="small">${ok(m.s5)} 验证：龙头 ${nl(m.lead)}，梯队 ${(m.levels || []).join("/")} 板，昨涨停红盘率 ${m.y_red == null ? "—" : m.y_red + "%"}</div></div>`).join("")}
          <div class="muted small">书中原则：没有中军的主线是短炒脉冲；首日异动≠主线成立；只做龙头/中军，拒绝杂毛跟风；单笔亏损 −5%~−7% 无条件止损。程序判定，仅供参考。</div></div>`);
    }
    const oa = J.open_auction;
    if (oa && oa.n) {
      const rows = oa.rows.filter((x) => x.lbc >= 2).slice(0, 20).concat(oa.rows.filter((x) => x.lbc === 1).sort((a, b) => b.pct - a.pct).slice(0, 10));
      out.push("@auc@" + `<h2>🔔 开盘竞价 <span class="muted small">昨日涨停股今天怎么开（${esc(String((oa.rows[0] || {}).time || "").replace(/^(\d\d)(\d\d)$/, "$1:$2"))}）</span></h2>
        <div class="card"><div class="small">昨日 ${oa.n} 只涨停股：竞价平均 <b class="${updn(oa.avg)}">${pct(oa.avg, 2)}</b>，高开 ${oa.up} 只（≥5% 有 ${oa.high} 只），低开≤−3% 有 ${oa.low} 只。高开多、低开少 = 接力情绪好。</div>
        ${rows.map((x) => `<a class="yr" href="stock/#/s/${symC(x.c)}"><span>${esc(x.n)}<em>${x.lbc >= 2 ? x.lbc + "板" : "首板"} · 竞价 ${yi(x.amt)}</em></span><b class="${updn(x.pct)}">${pct(x.pct, 2)}</b></a>`).join("")}</div>`);
    }
    const ks = Object.keys(J.ladder || {}).map(Number).sort((a, b) => b - a);
    const lad = ks.map((k) => {
      const xs = J.ladder[k];
      const chips = xs.map((x) => `<a class="sk" href="stock/#/s/${symC(x.c)}"><b>${esc(x.n.replace(/\s+/g, ""))}</b><em>${esc(x.board)} · ${esc(x.fbt)}封${x.zbc ? ` · 炸${x.zbc}次` : ""} · ${esc(x.ind)}</em></a>`).join("");
      return k === 1 && xs.length > 12 ? `<details class="lv"><summary><span class="lvn">首板</span>${xs.length} 只（点开看全部）</summary><div class="sks">${chips}</div></details>`
        : `<div class="lv"><div class="lvh"><span class="lvn ${k >= 3 ? "hot" : ""}">${k === 1 ? "首板" : k + " 板"}</span>${xs.length} 只</div><div class="sks">${chips}</div></div>`;
    }).join("");
    out.push("@lad@" + `<h2>连板天梯 <span class="muted small">按高度分层，点名字看个股</span></h2><div class="card ladder">${lad || '<div class="muted">今天没有涨停</div>'}</div>`);
    if ((J.promo || []).length) {
      out.push("@lad@" + `<h2>晋级率 <span class="muted small">昨天涨停的，今天还能接着涨停的比例</span></h2><div class="card promo">${J.promo.map((p) => `<div class="pr">
        <div class="prh"><span class="lvn">昨日${p.lv >= 5 ? "5板+" : lvName(p.lv)}</span><span class="prbar"><i style="width:${Math.min(100, p.rate || 0)}%"></i></span><b>${fmt(p.rate, 0)}%</b></div>
        <div class="muted small">${p.n} 只，今日平均 <b class="${updn(p.chg)}">${pct(p.chg, 2)}</b>｜晋级：${names(p.names)}${(p.broken || []).length ? `｜断板：${names(p.broken)}` : ""}</div></div>`).join("")}
        <div class="note">首板晋级率 &gt;20%、2板晋级率 &gt;40% 说明接力赚钱效应好；连续很低说明高位股在退潮。</div></div>`);
    }
    const hc = (J.hot_concepts || []).slice(0, 10), hmax = Math.max(1, ...hc.map((x) => x.n));
    if (hc.length) out.push("@th@" + `<h2>题材热度 <span class="muted small">今日涨停按概念聚类</span></h2><div class="card hotc">${hc.map((x) => `<div class="hcr">
        <div class="hch"><b>${esc(x.concept)}</b><span class="hcbar"><i style="width:${(x.n / hmax) * 100}%"></i></span><span class="up">${x.n} 家涨停</span></div>
        <div class="muted small">板块 ${x.size || "—"} 只，涨停占比 ${x.ratio != null ? fmt(x.ratio, 1) + "%" : "—"}，近5日涨停 ${x.d5}｜龙头 ${x.lead && x.lead[0] ? nl(x.lead[0]) + (x.lead[1] > 1 ? `（${x.lead[1]}板）` : "") : "—"}</div>
        <div class="mem">${names(x.members)}</div></div>`).join("")}</div>`);
    const nt = J.name_tokens || [];
    if (nt.length) out.push("@th@" + `<h2>🔤 字辈炒作 <span class="muted small">涨停股名字里异常集中的字</span></h2><div class="card">${nt.map((x) => `<div class="tkr">
        <span class="tok">${esc(x.tok)}</span><div><div><b>${fmt(x.lift, 1)} 倍</b> <span class="muted small">近5日涨停 ${x.d5} 只 · 今日 ${x.today} 只</span> <span class="kind ${/字辈/.test(x.kind) ? "warn" : ""}">${esc(x.kind)}</span></div>
        <div class="mem">${names(x.members)}</div></div></div>`).join("")}
        <div class="note">富集倍数 = 近5日涨停股里名字含这个字的比例 ÷ 全A股名字含这个字的比例。≥3 倍且跨行业 = 资金在按名字炒（纯情绪，来得快去得快，别重仓）。</div></div>`);
    const wl = J.watch || [];
    if (wl.length) out.push("@th@" + `<h2>👀 关注清单 <span class="muted small">字辈 / 概念全部成员今天的表现</span></h2><div class="tablewrap"><table class="tbl"><tr><th>分组</th><th>成员</th><th>平均</th><th>上涨占比</th><th>涨停</th><th>最高板</th><th>代表</th></tr>
        ${wl.map((x) => `<tr><td><b>${esc(x.group)}</b></td><td>${x.n}</td><td class="${updn(x.avg)}">${pct(x.avg, 2)}</td><td>${fmt(x.up_ratio, 0)}%</td><td class="${x.zt ? "up" : ""}">${x.zt}</td><td>${x.top ? x.top + "板" : "—"}</td><td class="small">${names(x.stars)}</td></tr>`).join("")}</table></div>`);
    const a = J.auction;
    if (a && a.ok) {
      const ar = (x) => `<a class="yr" href="stock/#/s/${symC(x.c)}"><span>${esc(x.n)}<em>${x.p_cont}→${x.close} · 竞价 ${yi(x.amt)} · 占全天 ${fmt(x.share, 1)}%</em></span><b class="${updn(x.pct)}">${pct(x.pct, 2)}</b></a>`;
      out.push("@auc@" + `<h2>🔔 尾盘竞价 <span class="muted small">14:57 → 15:00 最后 3 分钟</span></h2><div class="card">
        <div class="small">扫描 ${a.scanned} 只：竞价上涨 <b class="up">${a.up}</b> / 下跌 <b class="dn">${a.down}</b> / 平 ${a.flat}；竞价成交 ${yi(a.amt)}，占全天 ${fmt(a.share, 1)}%。</div>
        ${(a.etf || []).length ? `<div class="etfs">${a.etf.map((x) => `<span>${esc(x.n)} <b class="${updn(x.pct)}">${pct(x.pct, 2)}</b><em>竞价 ${yi(x.amt)}</em></span>`).join("")}</div>` : ""}
        <div class="grid2 tight"><div><div class="ph up">🟥 抢筹（竞价拉升）</div>${(a.grab || []).slice(0, 8).map(ar).join("") || '<div class="muted small">没有</div>'}</div>
          <div><div class="ph dn">🟩 砸盘（竞价压低）</div>${(a.dump || []).slice(0, 8).map(ar).join("") || '<div class="muted small">没有</div>'}</div></div>
        ${(a.heavy || []).length ? `<details><summary class="small">竞价成交占全天比例最高的 ${a.heavy.length} 只</summary>${a.heavy.map(ar).join("")}</details>` : ""}
        <div class="note">尾盘竞价是全天最后 3 分钟撮合：大资金在这里抢筹（拉高收盘）或砸盘（压低收盘），次日开盘常有延续，但只是参考。</div></div>`);
    }
    const tb = J.top_boards || [], bb = J.bottom_boards || [];
    if (tb.length) {
      const br = (x) => `<div class="yr"><span>${esc(x.name)}<em>${x.up}涨/${x.down}跌 · 领涨 ${esc(x.lead)}</em></span><b class="${updn(x.pct)}">${pct(x.pct, 2)}</b></div>`;
      out.push("@th@" + `<h2>概念板块涨跌</h2><div class="card"><div class="grid2 tight"><div><div class="ph up">涨幅榜</div>${tb.slice(0, 8).map(br).join("")}</div><div><div class="ph dn">跌幅榜</div>${bb.slice(0, 5).map(br).join("")}</div></div></div>`);
    }
    if (hist.length) out.push("@cyc@" + `<h2>近 ${hist.length} 日情绪周期</h2><div class="tablewrap"><table class="tbl"><tr><th>日期</th><th>涨停</th><th>跌停</th><th>炸板率</th><th>最高板</th><th>≥3板</th><th>昨涨停今日</th></tr>
        ${hist.slice().reverse().map((h) => `<tr><td>${md(h.d)}</td><td class="up">${h.zt}</td><td class="dn">${h.dt}</td><td>${fmt(h.zb_rate, 0)}%</td><td>${h.top}板 <span class="muted small">${esc((h.top_names || []).join("、"))}</span></td><td>${h.n3}</td><td class="${updn(h.yz_prem)}">${pct(h.yz_prem, 2)}</td></tr>`).join("")}</table></div>`);
    if ((J.zb_list || []).length || (J.dt_list || []).length) out.push("@lad@" + `<details class="card"><summary>炸板 ${(J.zb_list || []).length} 只 · 跌停 ${(J.dt_list || []).length} 只</summary>
        <div class="small">炸板（摸过涨停没封住）：${names(J.zb_list)}</div><div class="small">跌停：${names(J.dt_list)}</div></details>`);
    const G = { ov: [], lad: [], th: [], auc: [], cyc: [] };
    out.forEach((x) => { const m = /^@(\w+)@/.exec(x); G[m ? m[1] : "ov"].push(m ? x.slice(m[0].length) : x); });
    // 总览里放一个各分页的速览，点了直接跳
    const lad1 = ks.filter((k) => k >= 2).slice(0, 2).map((k) => `${k}板 ${J.ladder[k].map((x) => esc(x.n.replace(/\s+/g, ""))).join("、")}`).join("；");
    const th1 = hc.slice(0, 3).map((x) => `${esc(x.concept)} ${x.n}`).join("、"), tk1 = nt.slice(0, 2).map((x) => `「${esc(x.tok)}」${fmt(x.lift, 1)}倍`).join("、");
    G.ov.push(`<h2>各分页速览</h2><div class="list">
      <a class="card item" data-go="lad"><b>🪜 天梯</b><div class="muted small">${lad1 || "今天没有连板"}${(J.promo || []).length ? `｜首板晋级 ${fmt(((J.promo || []).find((p) => p.lv === 1) || {}).rate, 0)}%` : ""}</div></a>
      <a class="card item" data-go="th"><b>🔥 题材·字辈</b><div class="muted small">${th1 || "—"}${tk1 ? `｜字辈 ${tk1}` : ""}</div></a>
      <a class="card item" data-go="auc"><b>🔔 竞价</b><div class="muted small">${a && a.ok ? `尾盘竞价 涨${a.up}/跌${a.down}，抢筹 ${(a.grab || []).slice(0, 2).map((x) => esc(x.n)).join("、") || "—"}` : "尾盘竞价 15:00 后更新"}${oa && oa.n ? `｜开盘竞价均 ${pct(oa.avg, 1)}` : ""}</div></a>
      <a class="card item" data-go="cyc"><b>📈 周期</b><div class="muted small">近 ${hist.length} 日：${hist.slice(-5).map((h) => h.top + "板").join("→")}</div></a></div>`);
    return G;
  }

  async function page() {
    document.title = "短线情绪 · 小七投研";
    const tok = A.tok();
    const TABS = [["ov", "🧭 总览"], ["lad", "🪜 天梯"], ["th", "🔥 题材·字辈"], ["auc", "🔔 竞价"], ["cyc", "📈 周期"]];
    const cur = (/^#\/short\/(\w+)/.exec(location.hash) || [])[1];
    let tab = TABS.some((t) => t[0] === cur) ? cur : "ov";
    app.innerHTML = `<h1>短线情绪</h1><div class="subtabs" id="stabs">${TABS.map(([k, t]) => `<a data-t="${k}" class="${k === tab ? "on" : ""}">${t}</a>`).join("")}</div>
      <div id="sjson">${LOADING("正在读取今天的全市场短线数据…")}</div>
      <section class="sp" data-g="cyc" id="scyc"><h2>长周期：涨停 / 跌停 / 连板</h2><div class="card chartcard"><div id="sc1" class="chart"></div><div class="note">红柱 = 涨停家数，绿柱 = 跌停家数，紫线 = 最高连板（右轴）。</div></div>
      <div class="card chartcard"><div id="sc2" class="chart"></div><div class="note">蓝线 = 昨日涨停股今天平均涨幅（接力赚钱效应，左轴 %），橙线 = 炸板率（右轴 %）。</div><div class="note" id="shnote"></div></div>
      <h2>短线课程</h2><div class="list"><a class="card item" href="#/cat/short">短线 8 课：情绪周期、连板梯队、龙头与补涨、集合竞价、首板与接力、炸板、止损、题材生命周期 ›</a></div></section>
      ${DISC}`;
    const show = (k) => {
      tab = k;
      document.querySelectorAll("#stabs a").forEach((x) => x.classList.toggle("on", x.dataset.t === k));
      document.querySelectorAll("section.sp").forEach((x) => { x.style.display = x.dataset.g === k ? "" : "none"; });
      history.replaceState(null, "", "#/short/" + k);
      if (k === "cyc") setTimeout(() => document.querySelectorAll("#scyc .chart").forEach((el) => { const c = window.echarts && echarts.getInstanceByDom(el); if (c) c.resize(); }), 30);
      window.scrollTo(0, 0);
    };
    $("#stabs").onclick = (e) => { const t = e.target.closest("a[data-t]"); if (t) show(t.dataset.t); };
    SHOW = show;
    if (!BOUND) { BOUND = true; app.addEventListener("click", (e) => { const t = e.target.closest("[data-go]"); if (t && SHOW && /^#\/short/.test(location.hash)) { e.preventDefault(); SHOW(t.dataset.go); } }); }
    show(tab);
    const histP = getJSON("short_hist.json", true);
    histP.then(async (H) => { await need("lib"); if (A.alive(tok)) drawShortHist(H); })
      .catch(() => { if (A.alive(tok)) $("#sc1").innerHTML = '<div class="empty">历史数据加载失败</div>'; });
    let J = null;
    try { J = await getJSON("short_latest.json", true); } catch (e) { J = null; }
    if (!A.alive(tok)) return;
    if (J) {
      const G = render(J);
      $("#sjson").innerHTML = ["ov", "lad", "th", "auc"].map((k) => `<section class="sp" data-g="${k}">${G[k].join("") || '<div class="card muted">这一页今天没有数据</div>'}</section>`).join("");
      const cyc = $("#scyc");
      if (G.cyc.length) cyc.insertAdjacentHTML("afterbegin", G.cyc.join(""));
      show(tab);
    }
    // 浏览器实时直取（盘中比每日构建更新）：比 json 新就展示，否则只做一行核对
    let P = null, src = "live", err = "";
    try { P = await liveShort(); } catch (e) {
      err = e.message || "";
      if (!J) { try { const S = await getJSON("short_snap.json", true); P = { date: S.date, time: S.time, ...normSnap(S) }; src = "snap"; } catch (e2) { P = null; } }
    }
    if (!A.alive(tok)) return;
    let H = null;
    try { H = await histP; } catch (e) { /* 没有历史也能显示 */ }
    if (!A.alive(tok)) return;
    if (!J) {
      if (!P) { $("#sjson").innerHTML = FAIL("短线数据暂时取不到"); return; }
      renderShort(P, src, H, err, $("#sjson")); return;
    }
    if (!P) { $("#slive").innerHTML = `<p class="muted small">盘中实时数据暂时连不上（东方财富接口），下面是最近一次构建的数据。</p>`; return; }
    const jd = ymd(J.ladder_date || J.date), pd = ymd(P.date), live = /盘中/.test(P.time);
    const newer = pd > jd || (pd === jd && J.intraday && (!live || P.time.slice(0, 5) > String(J.computed_at || "").slice(-5)));
    const st = shortStats(P);
    if (!newer) { $("#slive").innerHTML = `<p class="muted small">✅ 实时核对（浏览器直取东方财富 ${esc(P.date.slice(5))} ${esc(P.time)}）：涨停 ${st.zt} / 跌停 ${st.dt} / 最高 ${st.max_lb} 板。</p>`; return; }
    const box = document.createElement("div");
    renderShort(P, src, H, err, box);
    $("#slive").innerHTML = `<details class="card live" open><summary>⚡ 盘中实时（${esc(P.date.slice(5))} ${esc(P.time)}，比下面的数据更新）</summary><div class="muted small">下面是 ${md(jd)} ${J.intraday ? "盘中" : "收盘"}的全市场统计；这里是浏览器直接从东方财富取的最新涨停池，情绪阶段为粗估。</div></details>`;
    $("#slive details").appendChild(box);
  }

  function renderShort(P, src, H, err, el) {
    const st = shortStats(P), m = shortMood(st);
    let rank = "";
    if (H && H.zt.length > 20) {
      const w = H.zt.slice(-60).filter((x) => x != null), p = (w.filter((x) => x <= st.zt).length / w.length) * 100;
      rank = `涨停家数在近 ${w.length} 个交易日里排 <b>${fmt(p, 0)}%</b> 分位。`;
    }
    const lad = {};
    P.zt.forEach((x) => (lad[x.lbc] = lad[x.lbc] || []).push(x));
    const levels = Object.keys(lad).map(Number).sort((a, b) => b - a);
    const ladder = levels.map((lv) => {
      const xs = lad[lv].sort((a, b) => (a.fbt || 0) - (b.fbt || 0));
      const chips = xs.map((x) => stockA(x, `<em>${esc(x.hy)}${x.days && x.ct && x.days !== x.ct ? ` · ${x.days}天${x.ct}板` : ""} · ${hm6(x.fbt)}封${x.zbc ? ` · 炸${x.zbc}次` : ""}</em>`)).join("");
      const body = `<div class="sks">${chips}</div>`;
      return lv === 1 && xs.length > 12 ? `<details class="lv"><summary><span class="lvn">首板</span>${xs.length} 只（点开看全部）</summary>${body}</details>`
        : `<div class="lv"><div class="lvh"><span class="lvn ${lv >= 3 ? "hot" : ""}">${lv === 1 ? "首板" : lv + " 连板"}</span>${xs.length} 只</div>${body}</div>`;
    }).join("");
    const hy = {};
    P.zt.forEach((x) => (hy[x.hy || "其他"] = (hy[x.hy || "其他"] || 0) + 1));
    const hys = Object.entries(hy).sort((a, b) => b[1] - a[1]).slice(0, 10), hmax = hys.length ? hys[0][1] : 1;
    const ys = P.yz.slice().sort((a, b) => b.zdp - a.zdp);
    const yrow = (x) => `<a class="yr" href="stock/#/s/${symOf(x.c, x.m)}"><span>${esc(x.n.replace(/\s+/g, ""))}<em>${x.ylbc >= 2 ? x.ylbc + "板" : "首板"} · ${esc(x.hy)}</em></span><b class="${updn(x.zdp)}">${pct(x.zdp, 2)}</b></a>`;
    const kp = (k, v, cls = "", sub = "") => `<div><span>${k}</span><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
    el.innerHTML = `
      <div class="muted small">数据日期 <b>${esc(P.date)}</b>（${esc(P.time)}）${P.notToday ? "｜今天还没开盘或休市，显示最近一个交易日" : ""}｜来源：东方财富涨停板行情，${src === "live" ? "浏览器实时直取" : `每日构建时的快照（实时接口暂时连不上${err ? "：" + esc(err) : ""}）`}</div>
      <div class="card moodcard"><span class="mood big ${m.c}">${m.n}</span><div><b>${m.t}</b><div class="muted small">${rank}判断规则见 <a href="#/lesson/sl-cycle">情绪周期</a>，只作参考。</div></div></div>
      <div class="kpis k4">${kp("涨停", st.zt, "up")}${kp("跌停", st.dt, "dn")}${kp("炸板", st.zb, "", `炸板率 ${fmt(st.zb_rate, 1)}%`)}${kp("最高连板", st.max_lb + " 板", "up", `连板股 ${st.lb_cnt} 只`)}
        ${kp("昨涨停今日", pct(st.prem, 2), updn(st.prem), `红盘率 ${fmt(st.prem_up, 0)}%`)}${kp("昨日涨停", P.yz.length + " 只", "", "今天的表现见下")}</div>
      <h2>连板梯队 <span class="muted small">点名字进个股透视</span></h2><div class="card ladder">${ladder || '<div class="muted">今天没有涨停</div>'}</div>
      <h2>涨停行业分布</h2><div class="card hybars">${hys.map(([k, v]) => `<div class="hb"><span>${esc(k)}</span><i style="width:${(v / hmax) * 100}%"></i><b>${v}</b></div>`).join("")}</div>
      <h2>昨日涨停今日表现（赚钱效应）</h2><div class="card">
        <div class="muted small">昨天涨停的 ${P.yz.length} 只今天平均 <b class="${updn(st.prem)}">${pct(st.prem, 2)}</b>，${fmt(st.prem_up, 0)}% 收红。平均 &gt;3% 说明接力赚钱，连续为负说明亏钱效应。</div>
        <div class="grid2 tight"><div><div class="ph up">表现最好</div>${ys.slice(0, 6).map(yrow).join("")}</div><div><div class="ph dn">表现最差</div>${ys.slice(-6).reverse().map(yrow).join("")}</div></div></div>
      <details class="card"><summary>炸板 ${P.zb.length} 只（摸过涨停没封住）</summary><div class="sks">${P.zb.map((x) => stockA(x, `<em>${pct(x.zdp, 1)} · ${esc(x.hy)}${x.zbc ? ` · 炸${x.zbc}次` : ""}</em>`)).join("") || '<span class="muted">无</span>'}</div></details>
      <details class="card"><summary>跌停 ${P.dt.length} 只</summary><div class="sks">${P.dt.map((x) => stockA(x, `<em>${esc(x.hy)}</em>`)).join("") || '<span class="muted">无</span>'}</div></details>`;
  }
  function drawShortHist(H) {
    const c = C(), n = H.d.length;
    if (!n) return;
    const z = zoom(Math.min(n, 60), n);
    mk($("#sc1")).setOption({ animation: false, grid: { left: 40, right: 36, top: 30, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub, fontSize: 11 } },
      xAxis: { type: "category", data: H.d, ...axisStyle(), splitLine: { show: false } },
      yAxis: [{ type: "value", ...axisStyle() }, { type: "value", position: "right", splitLine: { show: false }, axisLabel: { color: "#8b5cf6", fontSize: 10 }, minInterval: 1 }],
      series: [{ name: "涨停", type: "bar", data: H.zt, itemStyle: { color: "#e5484d" }, barMaxWidth: 10 }, { name: "跌停", type: "bar", data: H.dt, itemStyle: { color: "#2fa86b" }, barMaxWidth: 10 },
        { name: "最高连板", type: "line", yAxisIndex: 1, step: "middle", data: H.max_lb, showSymbol: false, lineStyle: { color: "#8b5cf6", width: 1.5 }, itemStyle: { color: "#8b5cf6" } }], dataZoom: z });
    mk($("#sc2")).setOption({ animation: false, grid: { left: 40, right: 36, top: 30, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub, fontSize: 11 } },
      xAxis: { type: "category", data: H.d, ...axisStyle(), splitLine: { show: false } },
      yAxis: [{ type: "value", ...axisStyle(), axisLabel: { color: c.sub, fontSize: 10, formatter: "{value}%" } }, { type: "value", position: "right", splitLine: { show: false }, axisLabel: { color: "#e8833a", fontSize: 10, formatter: "{value}%" } }],
      series: [{ name: "昨日涨停今日平均涨幅", type: "line", data: H.prem, showSymbol: false, lineStyle: { color: "#2f7fd8", width: 1.6 }, itemStyle: { color: "#2f7fd8" },
        markLine: { silent: true, symbol: "none", lineStyle: { color: c.sub, type: "dashed" }, label: { show: false }, data: [{ yAxis: 0 }] } },
        { name: "炸板率", type: "line", yAxisIndex: 1, data: H.zb_rate, showSymbol: false, lineStyle: { color: "#e8833a", width: 1.2 }, itemStyle: { color: "#e8833a" } }], dataZoom: z });
    const em = H.src.filter((s) => s === "em").length;
    $("#shnote").innerHTML = `共 ${n} 个交易日（${esc(H.d[0])} 起）：最近 ${em} 天为东方财富涨停池口径，更早的由本站用全市场日 K 线推算（ST 股无法识别，属近似）。东财只保留约 15 个交易日，本站每天把新的一天存下来。`;
  }
  window.__mod_short = { page };
})();
