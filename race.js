/* 策略赛马页（按需加载）：读 race.json（race.py report 生成）。每个选手各 10 万虚拟本金，开赛后逐日真实记账并排比较。
   首屏 = 小结卡 + 总排行榜（可按组筛选）+ 净值曲线；下面每位选手一张卡片：状态 + 总资产/今天/累计大字 + 持仓表（买入价/现价/涨跌/盈亏），
   盘中按估算成交显示今天开盘买进的票，规则、对照、信号、成交明细折叠（2026-11-24 改版）。
   盘中估算（2026-11-24）：A股交易时段每 20 秒批量拉腾讯实时价（qt.gtimg.cn，带 CORS，失败时改用 <script> 注入），
   按「现金 + Σ 持仓股数 × 实时价」估算每位选手；今天开盘待成交的单按今天开盘价、照 race.py execute() 同一口径估算成交
   （先卖后买、滑点、佣金、印花税、整手、开盘涨停作废/跌停顺延、高开不追、买入区间）。只在浏览器里算，不写回记账；收盘后以记账为准。 */
(function () {
  const A = window.__APP;
  const { app, $, $$, esc, fmt, pct, updn, LOADING, FAIL, DISC, getJSON, need } = A;
  const num = (v) => (v == null ? "—" : Math.round(v).toLocaleString("zh-CN"));
  const wan = (v) => (v == null ? "—" : Math.abs(v) >= 1e4 ? fmt(v / 1e4, 2) + "万" : num(v));
  const md5 = (d) => (d ? String(d).slice(5) : "");
  const how = (t) => `<div class="acc-how"><b>怎么看</b>${t}</div>`;
  if (!document.getElementById("race-css5")) {   // 样式随模块下发（style.css 有版本号缓存，--reports-only 不刷新）
    const st = document.createElement("style");
    st.id = "race-css5";
    st.textContent = `.race-grp{margin:4px 0}.race-grp>summary{list-style:none;cursor:pointer}.race-grp>summary::-webkit-details-marker{display:none}
.race-grp>summary h2::after{content:" ▾";font-size:13px;color:var(--sub)}.race-grp:not([open])>summary h2::after{content:" ▸"}
.race-ctl{font-style:normal;font-size:11px;font-weight:600;color:var(--sub);background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:6px;vertical-align:2px}
.race-ref{font-size:12px;color:var(--sub);margin-top:3px}
.rc-sum .rs-n b{font-weight:600}
.rc-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}.rc-chips::-webkit-scrollbar{display:none}
.rc-chips button{flex:none;border:1px solid var(--line);background:var(--card);color:var(--sub);border-radius:999px;padding:3px 11px;font-size:13px;cursor:pointer;font-family:inherit}
.rc-chips button.on{background:var(--text);color:#fff;border-color:var(--text)}
.rc-stamp{font-size:12.5px;color:var(--sub);margin:0 2px 6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.5}
.rc-stamp b{color:var(--text)}
.rc-stamp .dot{width:8px;height:8px;border-radius:50%;background:var(--up);flex:none;animation:rcblink 1.6s infinite}
.rc-stamp.err{color:var(--warn-t)}
@keyframes rcblink{50%{opacity:.2}}
.rc-board{padding:0;overflow:hidden}
.rc-row{display:grid;grid-template-columns:34px minmax(0,1fr) 84px 66px 72px;align-items:center;gap:0 8px;padding:7px 12px;border-bottom:1px solid var(--line);cursor:pointer;position:relative;background:var(--card)}
.rc-row:last-child{border-bottom:0}
.rc-hd{cursor:default;font-size:11.5px;color:var(--sub);padding:5px 12px;background:var(--soft)}
.rc-hd span{text-align:right}.rc-hd span:first-child{text-align:center}.rc-hd span:nth-child(2){text-align:left}
.rc-rk{font-weight:700;font-size:15px;text-align:center;font-variant-numeric:tabular-nums;line-height:1.15}
.rc-rk.t3{color:#b7791f}
.rc-rk small{display:block;font-size:10px;font-weight:600}
.rc-nm{min-width:0}
.rc-nm b{display:block;font-size:14px;font-weight:600;line-height:1.35}
.rc-nm b i.c{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:1px}
.rc-nm span{display:block;font-size:11.5px;color:var(--sub);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rc-nm span.ok{color:#8a5a00}
.rc-v{text-align:right;font-variant-numeric:tabular-nums;font-size:13.5px;white-space:nowrap}
.rc-v.big{font-weight:700;font-size:14.5px}
.rc-v small,.rc-hd small{display:none;font-size:11px;font-weight:400;color:var(--sub)}
.rc-new{font-style:normal;font-size:10.5px;font-weight:700;color:#fff;background:var(--up);border-radius:4px;padding:0 4px;margin-left:4px;vertical-align:1px}
.rc-ct{font-style:normal;font-size:10.5px;font-weight:600;color:var(--sub);border:1px solid var(--line);border-radius:4px;padding:0 3px;margin-left:4px;vertical-align:1px}
.rc-flash{animation:rcfl 1.4s}
@keyframes rcfl{from{background:#fff3c4}to{background:var(--card)}}
.rc-chart{margin-top:10px}
.rc-chart h3{font-size:14.5px;margin:0 0 4px}
.rc-nav{height:280px}.rc-intra{height:210px}
.rc-leg{display:flex;flex-wrap:wrap;gap:5px 6px;padding:8px 0 0}
.rc-leg button{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:1px 8px 1px 6px;font-size:12px;color:var(--text);cursor:pointer;font-family:inherit;line-height:20px}
.rc-leg button i{display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:4px;vertical-align:middle}
.rc-leg button i.d{background:none!important;border-top:2px dotted #555;height:0}
.rc-leg button.off{opacity:.38}
.rc-leg-n{font-size:11.5px;color:var(--sub);margin-top:4px}
@media(max-width:560px){.rc-row{grid-template-columns:26px minmax(0,1fr) 58px 74px;padding:7px 10px;gap:0 6px}.rc-hd{padding:5px 10px}.rc-row .rc-amt{display:none}.rc-v small,.rc-hd small{display:block}.rc-v{font-size:13px}.rc-v.big{font-size:14.5px;line-height:1.25}.rc-nm b{font-size:13.5px}.rc-nav{height:250px}}
.rc-nm>span{-webkit-line-clamp:1;font-size:11px}
.rc-nm b{display:flex;align-items:center;min-width:0}.rc-nm b i.c,.rc-nm b em{flex:none}.rc-nm b .t{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:inherit;color:inherit;-webkit-line-clamp:unset}
.rk-card{padding:12px 14px 10px;border-left:4px solid var(--rc,#9aa3ad)}
.rk-h{display:flex;align-items:center;gap:8px}
.rk-nm{flex:1;min-width:0;font-weight:700;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-st{flex:none;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;background:var(--soft);color:var(--sub);white-space:nowrap}
.rk-st.on{background:#e8f1fc;color:#1d5fae}.rk-st.wait{background:var(--warn-bg);color:var(--warn-t)}
.rk-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--up);margin-right:5px;vertical-align:1px;animation:rcblink 1.6s infinite}
.rk-big{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px;margin:10px 0 4px}
.rk-big>div{display:flex;flex-direction:column;min-width:0}
.rk-big span{font-size:12px;color:var(--sub)}
.rk-big b{font-size:25px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2;white-space:nowrap}
.rk-sub{font-size:12.5px;color:var(--sub);display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}.rk-sub b{color:var(--text)}
.rk-ex{font-style:normal;font-weight:600;font-size:12px;border-radius:4px;padding:0 6px;background:var(--soft)}
.rk-ex.up{color:var(--up-t);background:var(--up-bg)}.rk-ex.dn{color:var(--dn-t);background:var(--dn-bg)}
.rk-pos{margin-top:10px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.rk-pr{display:grid;grid-template-columns:minmax(0,1fr) 62px 62px 72px 70px 48px;align-items:center;gap:0 6px;padding:8px 12px;border-top:1px solid var(--line);color:var(--text);font-variant-numeric:tabular-nums;font-size:14.5px}
.rk-pr>*:not(.nm){text-align:right;white-space:nowrap}
.rk-pr.rk-ph>span:first-child{text-align:left}
.rk-pr.rk-ph{border-top:0;background:var(--soft);font-size:12px;color:var(--sub);padding:5px 12px}
.rk-ph small{font-size:11px}
.rk-pr .nm{min-width:0;display:flex;align-items:center;gap:2px 5px}
.rk-pr .nm b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.rk-pr b.v{font-size:16.5px;font-weight:700}
.rk-pr .mb{display:none}
.rk-tg{font-style:normal;font-size:11px;font-weight:600;color:#fff;background:var(--brand);border-radius:4px;padding:0 4px;flex:none}
.rk-all{display:block;width:100%;border:0;border-top:1px solid var(--line);background:var(--card);color:var(--brand);font-size:13px;padding:7px;cursor:pointer;font-family:inherit}
.rk-pn{font-size:11.5px;color:var(--sub2);padding:4px 12px 5px;border-top:1px solid var(--line);background:var(--soft)}
.rk-empty{margin-top:10px;border:1px dashed var(--line);border-radius:10px;padding:8px 12px;display:flex;flex-direction:column;gap:2px}
.rk-empty b{font-size:20px}.rk-empty span{font-size:12.5px;color:var(--sub);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rk-ln{font-size:13.5px;line-height:1.55;margin-top:8px;padding:6px 10px;border-radius:8px;background:var(--soft);color:#374151}
.rk-todo{background:var(--warn-bg);color:var(--warn-t)}.rk-todo b{color:inherit}
.rk-more{margin-top:8px}
.rk-more>summary{cursor:pointer;font-size:13px;color:var(--brand);list-style:none}
.rk-more>summary::-webkit-details-marker{display:none}
.rk-more>summary::after{content:" ▸"}.rk-more[open]>summary::after{content:" ▾"}
.rk-more .race-body{border-top:0;padding:6px 0 0}
.rk-refs{color:var(--sub);font-size:12.5px}
a.rk-s{color:var(--brand);text-decoration:none;border-bottom:1px dotted currentColor;cursor:pointer}a.rk-s:hover{border-bottom-style:solid}
@media(max-width:560px){.rk-card{padding:11px 12px 9px}.rk-big{gap:6px}.rk-big b{font-size:20px}.rk-nm{font-size:15px}
.rk-pr{grid-template-columns:minmax(0,1fr) 60px 70px 66px;padding:7px 10px;gap:0 6px;font-size:13.5px}.rk-pr.rk-ph{padding:5px 10px}
.rk-pr .nm{flex-wrap:wrap}.rk-pr .nm b{max-width:calc(100% - 34px)}.rk-pr .dk{display:none}.rk-pr .mb{display:block;width:100%;font-size:11px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rk-pr b.v{font-size:15px}.rk-pr .nm b{font-size:14px}}`;
    document.head.appendChild(st);
  }

  // ---------------- 股票 / ETF 名字 → 个股页链接（2026-11-24：页面上出现的每个股票名都能点进个股页） ----------------
  let NM = {}, SHORT = {}, NRX = null;   // NM 全名→代码；SHORT 板块简称（银行→银行ETF 的代码），只在「（银行、消费）」这类括号列表里用
  const ETF0 = { "沪深300ETF": "sh510300", "中证500ETF": "sh510500", "中证1000ETF": "sh512100", "创业板ETF": "sz159915", "红利低波ETF": "sh512890", "科创50ETF": "sh588000" };
  function initNames(J, SG) {
    NM = { ...ETF0 }; SHORT = {};
    ((SG && SG.pool_list) || []).forEach((o) => { if (o.code && o.name && o.market === "CN") NM[o.name.replace(/\s/g, "")] = o.code; });   // S 级执行池（「一手较贵跳过」的名单）
    (J.players || []).forEach((x) => ["pos", "pending", "trades", "misses"].forEach((k) => (x[k] || []).forEach((o) => { if (o.sym && o.name) NM[o.name] = o.sym; })));
    Object.entries(NM).forEach(([n, s]) => { const m = n.match(/^(.{1,5})ETF$/); if (m && !/\d/.test(m[1])) SHORT[m[1]] = s; });
    const ks = Object.keys(NM).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    NRX = new RegExp(`(跳过 \\d+ 只：)([^；。\\n]+)|（([^（）\\n]+)）${ks.length ? `|(${ks.join("|")})` : ""}`, "g");
  }
  // 美股代码没带交易所后缀（usAMD）时个股页会先解析成 usAMD.OQ，这里直接用代码；没有代码的名字走个股页的按名搜索 #/q/
  const lk = (name, sym) => {
    const n = String(name || ""), s = sym || NM[n.replace(/\s/g, "")];
    return `<a class="rk-s" href="stock/#/${s ? "s/" + esc(s) : "q/" + encodeURIComponent(n.replace(/\s/g, ""))}">${esc(n)}</a>`;
  };
  function linkify(raw) {   // 自由文本（信号说明、规则）里认出股票名加链接；其余照常转义
    const s = String(raw == null ? "" : raw);
    if (!NRX) return esc(s);
    let out = "", i = 0;
    for (const m of s.matchAll(NRX)) {
      out += esc(s.slice(i, m.index));
      if (m[1]) out += esc(m[1]) + m[2].split("、").map((n) => (/^[\u4e00-\u9fa5A-Za-z\s]{2,12}$/.test(n.trim()) ? lk(n.trim()) : linkify(n))).join("、");
      else if (m[3] != null) { const ps = m[3].split("、"); out += "（" + (ps.every((p) => SHORT[p]) ? ps.map((p) => lk(p, SHORT[p])).join("、") : linkify(m[3])) + "）"; }
      else out += lk(m[4]);
      i = m.index + m[0].length;
    }
    return out + esc(s.slice(i));
  }

  function mdLite(s) {
    const inl = (t) => linkify(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
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

  // ---------------- 北京时间与交易时段 ----------------
  const BJ = () => {
    const d = new Date(Date.now() + 8 * 3600e3), iso = d.toISOString();
    return { ymd: iso.slice(0, 10), hms: iso.slice(11, 19), wd: d.getUTCDay(), hm: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 };
  };
  const tmin = (hm) => Math.max(0, Math.min(240, hm <= 690 ? hm - 570 : hm < 780 ? 120 : hm - 660));   // 09:30→0，11:30/13:00→120，15:00→240
  const mlab = (m) => { const t = m <= 120 ? 570 + m : 660 + m; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`; };
  function phase(J, now) {   // booked=今天已记账 closed=周末/休市 pre=开盘前 open=盘中 lunch=午休 after=15:00 后待记账
    if (J.last_date >= now.ymd) return "booked";
    if (now.wd === 0 || now.wd === 6) return "closed";
    if (now.hm < 570) return "pre";
    if (now.hm < 690 || (now.hm >= 780 && now.hm < 900)) return "open";
    return now.hm < 780 ? "lunch" : "after";
  }

  // ---------------- 腾讯实时行情 ----------------
  function parseQ(txt) {
    const Q = {};
    String(txt).replace(/v_([a-z]{2}\d{6})="([^"]*)"/g, (_, s, body) => {
      const f = body.split("~");
      if (f.length > 33) Q[s] = { name: f[1], c: +f[3] || 0, pre: +f[4] || 0, o: +f[5] || 0, t: f[30] || "", up: +f[47] || 0, dn: +f[48] || 0 };
      return "";
    });
    return Q;
  }
  async function viaFetch(list) {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch("https://qt.gtimg.cn/q=" + list.join(","), { cache: "no-store", signal: ac.signal });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return parseQ(new TextDecoder("gbk").decode(await r.arrayBuffer()));
    } finally { clearTimeout(tm); }
  }
  function viaScript(list) {   // 兜底：<script> 注入后读全局变量 v_xxx（脚本执行与 load 事件同一个任务，中间不会插入别的脚本）
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      let done = false;
      const fin = (ok) => {
        if (done) return; done = true; s.remove();
        if (!ok) return rej(new Error("script load failed"));
        const Q = {};
        list.forEach((sym) => { const v = window["v_" + sym]; if (typeof v === "string") Object.assign(Q, parseQ(`v_${sym}="${v}"`)); try { delete window["v_" + sym]; } catch (e) { window["v_" + sym] = undefined; } });
        res(Q);
      };
      s.charset = "gbk";
      s.src = "https://qt.gtimg.cn/q=" + list.join(",") + "&_=" + Date.now();
      s.onload = () => fin(true); s.onerror = () => fin(false);
      setTimeout(() => fin(false), 10000);
      document.head.appendChild(s);
    });
  }
  async function getQ(syms) {
    const parts = [];
    for (let i = 0; i < syms.length; i += 50) parts.push(syms.slice(i, i + 50));
    const R = await Promise.all(parts.map((l) => viaFetch(l).catch(() => viaScript(l).catch(() => ({})))));
    return Object.assign({}, ...R);
  }

  // ---------------- 估算（口径同 race.py execute / mark） ----------------
  function est(x, Q, L) {
    const etf = new Set(L.etf || []), lot = L.lot || 100;
    const r3 = (v) => Math.round(v * 1000) / 1000, r2 = (v) => Math.round(v * 100) / 100;
    const lots = (v) => Math.floor(v / lot + 0.5) * lot;
    const fee = (sym, side, amt) => r2(amt * L.comm + (side === "sell" && !etf.has(sym) ? amt * L.stamp : 0));
    const bar = (s) => (Q[s] && Q[s].o > 0 ? Q[s] : null);
    const upL = (b, s) => (b.up > 0 ? b.up : +(b.pre * 1.1).toFixed(etf.has(s) ? 3 : 2));
    const dnL = (b, s) => (b.dn > 0 ? b.dn : +(b.pre * 0.9).toFixed(etf.has(s) ? 3 : 2));
    let cash = x.cash;
    const pos = {};
    (x.pos || []).forEach((p) => { pos[p.sym] = { qty: p.qty, last: p.px, cost: p.cost, name: p.name }; });
    const fills = [], miss = [];
    const no = (o, why) => miss.push({ name: o.name, sym: o.sym, why });
    const orders = x.pending || [];
    if (orders.length) {
      const eqOpen = cash + Object.entries(pos).reduce((s, [k, p]) => s + p.qty * (bar(k) ? bar(k).o : p.last), 0);
      const sells = [], buys = [];
      orders.forEach((o) => {
        const k = o.x || {}, p = pos[o.sym], b = bar(o.sym);
        const px = b ? b.o : p ? p.last : null, have = p ? p.qty : 0;
        if ((k.a || (o.act === "卖出" ? "sell" : "target")) === "sell") { if (have) sells.push([o, have]); return; }
        if (k.w == null && k.value == null) return;   // 老版 race.json 没有 x 字段，没法估
        const tgt = k.value != null ? k.value : k.w * eqOpen, diff = tgt - have * (px || 0);
        if (Math.abs(diff) <= (k.tol || 0) * eqOpen) return;
        if (diff < 0) { const q = k.w <= 0 ? have : Math.min(have, lots(-diff / px)); if (q > 0) sells.push([o, q]); }
        else buys.push([o, diff]);
      });
      sells.forEach(([o, q]) => {
        const k = o.x || {}, b = bar(o.sym), p = pos[o.sym];
        if (!b) { no(o, "停牌，卖不出（顺延）"); return; }
        if (b.pre && b.o <= dnL(b, o.sym) + 1e-9) { no(o, "开盘跌停，卖不出（顺延）"); return; }
        const px = r3(b.o * (1 - (k.slip != null ? k.slip : L.slip))), amt = r2(q * px), f = fee(o.sym, "sell", amt);
        cash = r2(cash + amt - f);
        fills.push({ side: "卖", name: o.name, sym: o.sym, q, px, pnl: r2(amt - f - p.cost * q) });
        p.qty -= q;
        if (p.qty <= 0) delete pos[o.sym];
      });
      buys.sort((a, b) => ((a[0].x || {}).prio || 0) - ((b[0].x || {}).prio || 0)).forEach(([o, diff]) => {
        const k = o.x || {}, b = bar(o.sym);
        if (!b) { no(o, "停牌，没买成（作废）"); return; }
        if (b.pre && b.o >= upL(b, o.sym) - 1e-9) { no(o, "开盘涨停，没买成（作废）"); return; }
        const lim = b.up > 0 && b.pre > 0 ? Math.round((b.up / b.pre - 1) * 100) / 100 : 0.1;
        if (k.gap && b.pre && b.o / b.pre - 1 >= k.gap * lim - 1e-9) { no(o, `高开 ${pct((b.o / b.pre - 1) * 100, 1)} 不追，没买（作废）`); return; }
        const px = r3(b.o * (1 + (k.slip != null ? k.slip : L.slip)));
        if (k.zone && !(k.zone[0] - 1e-9 <= px && px <= k.zone[1] + 1e-9)) { no(o, "开盘价不在买入区间，没买（作废）"); return; }
        let q = k.value != null ? Math.floor(diff / (px * (1 + L.comm)) / lot) * lot : lots(diff / px);
        while (q > 0 && q * px * (1 + L.comm) > cash + 1e-6) q -= lot;
        if (q <= 0) { no(o, "现金不够一手，没买"); return; }
        const amt = r2(q * px), f = fee(o.sym, "buy", amt);
        cash = r2(cash - amt - f);
        const p = pos[o.sym];
        if (p) { p.cost = (p.cost * p.qty + amt + f) / (p.qty + q); p.qty += q; p.add = true; }
        else pos[o.sym] = { qty: q, last: b.c, cost: (amt + f) / q, name: o.name, today: true };
        fills.push({ side: "买", name: o.name, sym: o.sym, q, px });
      });
    }
    let mv = 0, stale = 0;
    const hold = Object.entries(pos).map(([s, p]) => {
      const q = Q[s], ok = q && q.c > 0, c = ok ? q.c : p.last;
      mv += p.qty * c; if (!ok) stale++;
      return { sym: s, name: p.name || (q && q.name) || s, qty: p.qty, cost: p.cost, px: c, up: q && q.up, today: !!p.today, add: !!p.add };
    });
    const eq = cash + mv;
    hold.forEach((h) => { h.value = h.qty * h.px; h.weight = (h.value / eq) * 100; h.pnl = h.qty * (h.px - h.cost); h.pnl_pct = (h.px / h.cost - 1) * 100; });
    return { eq, cash, fills, miss, stale, hold };
  }

  function bookedView(J) {
    const rows = (J.players || []).map((x) => ({ x, eq: x.equity, today: x.today, ret: x.ret, rank: x.rank }));
    rows.sort((a, b) => (a.rank == null) - (b.rank == null) || (a.rank || 0) - (b.rank || 0) || pid(a.x) - pid(b.x));
    const B = J.bench || [];
    const bt = B.length > 1 ? (B[B.length - 1].close / B[B.length - 2].close - 1) * 100 : null;
    return { live: false, rows, bench: { ret: J.bench_ret, today: bt } };
  }
  function liveView(J, Q, L) {
    const by = {};
    const rows = (J.players || []).map((x) => {
      const e = est(x, Q, L), base = x.pre ? J.init : x.equity;
      return (by[x.id] = { x, e, eq: e.eq, today: (e.eq / base - 1) * 100, ret: (e.eq / J.init - 1) * 100 });
    });
    rows.sort((a, b) => b.ret - a.ret || pid(a.x) - pid(b.x));
    rows.forEach((r, i) => { r.rank = i + 1; });
    rows.forEach((r) => {   // 比对照（同一段时间）：对照在本选手信号日收盘的金额 e0 = 对照最新记账金额 /(1+对照同期收益)
      const x = r.x, rf = x.ref && by[x.ref];
      if (!rf) return;
      const e0 = x.pre ? rf.x.equity : x.ref_ret != null ? rf.x.equity / (1 + x.ref_ret / 100) : null;
      if (e0) r.excess = r.ret - (rf.eq / e0 - 1) * 100;
    });
    const q = Q[L.bench_sym], B = J.bench || [];
    const bench = q && q.c > 0 && B.length ? { ret: (q.c / B[0].close - 1) * 100, today: (q.c / B[B.length - 1].close - 1) * 100 } : { ret: J.bench_ret, today: null };
    return { live: true, rows, bench, by };
  }

  // ---------------- 选手卡片：首屏 = 状态 + 三个大数字 + 持仓表 + 没成交/要做的事各一行；规则、对照、信号、成交明细折叠 ----------------
  const ZT_HOLD = new Set(["p20", "p21", "p23"]);   // 收盘涨停继续拿、没涨停次日开盘卖
  const TAIL = { p22: "尾盘抢筹", p24: "尾盘砸盘" }; // 收盘不在当天榜单前 3 → 次日开盘卖
  const pxf = (v, etf) => (v == null ? "—" : fmt(v, etf ? 3 : 2));
  const sgn = (v) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v)));
  const nextDay = (wd) => (wd >= 1 && wd <= 4 ? "明天" : "下周一");
  const names = (a, n = 3) => { const L = a.map((o) => lk(o.name, o.sym)); return a.length <= n ? L.join("、") : `${L.slice(0, 2).join("、")} 等 ${a.length} 只`; };
  function card(x, C) {
    const { J, today, ph, live, r, etf } = C, e = live ? r.e : null;
    const pre = !live && (x.pre != null ? x.pre : J.pre);
    const lastLab = md5(J.last_date);
    // 第一行：名字 + 状态
    const badge = live ? (ph === "open" ? ['<i class="rk-dot"></i>运行中·估算', "on"] : ph === "lunch" ? ["午休·估算", "on"] : ["已收盘·待记账", "on"])
      : pre ? (x.start && x.start <= today && J.last_date < today ? ["今天开盘首次成交", "wait"] : [`待开赛 · ${md5(x.start)} 开盘首次成交`, "wait"])
      : [`已记账 ${lastLab}`, ""];
    const tag = x.ctrl && !/对照|基准/.test(x.name) ? '<em class="race-ctl">对照</em>' : "";
    // 三个大数字
    const eq = live ? r.eq : x.equity, cash = live ? e.cash : x.cash;
    const td = live ? r.today : pre ? null : x.today, ret = live ? r.ret : pre ? null : x.ret;
    const rank = live ? r.rank : pre ? null : x.rank;
    const exv = live ? r.excess : pre ? null : x.excess;
    const exB = x.ref && exv != null ? `<em class="rk-ex ${updn(exv)}" title="和「${esc(x.ref_name || "随便买")}」同一段时间比">比${x.ref === "p1" ? "随便买" : "对照"} ${exv > 0 ? "+" : ""}${fmt(exv, 2)} 个点</em>` : "";
    const tdLab = live ? "今天(估)" : J.last_date >= today ? "今天" : `${lastLab} 当日`;
    const big = `<div class="rk-big"><div><span>${live ? "估算总资产" : "总资产"}</span><b>¥${num(eq)}</b></div>
      <div><span>${tdLab}</span><b class="${updn(td)}">${td == null ? "—" : pct(td, 2)}</b></div>
      <div><span>累计${live ? "(估)" : ""}</span><b class="${updn(ret)}">${ret == null ? "—" : pct(ret, 2)}</b></div></div>
      <div class="rk-sub">现金 ¥${num(cash)} · 仓位 ${fmt(eq ? ((eq - cash) / eq) * 100 : 0, 0)}%${rank != null ? ` · 第 <b>${rank}</b> 名` : ""}${exB}</div>`;
    // 持仓表
    const H = live ? e.hold.map((h) => ({ ...h, tag: h.today ? "今开" : h.add ? "今加" : "" }))
      : (x.pos || []).map((p) => ({ sym: p.sym, name: p.name, qty: p.qty, cost: p.cost, px: p.px, weight: p.weight, pnl_pct: p.pnl_pct, pnl: p.qty * (p.px - p.cost), tag: p.open === J.last_date ? `${lastLab}买` : "" }));
    H.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    const all = C.showAll.has(x.id), shown = all ? H : H.slice(0, 5);
    const sig = x.signal || {};
    const posT = H.length ? `<div class="rk-pos"><div class="rk-pr rk-ph"><span>持仓 <small>${H.length} 只</small></span><span class="dk">买入价</span><span>现价</span><span>涨跌</span><span>盈亏¥</span><span class="dk">占比</span></div>
      ${shown.map((h) => { const E = etf.has(h.sym); return `<a class="rk-pr" href="stock/#/s/${esc(h.sym)}"><span class="nm"><b>${esc(h.name)}</b>${h.tag ? `<i class="rk-tg">${esc(h.tag)}</i>` : ""}<small class="mb">买入 ${pxf(h.cost, E)}</small></span>
        <span class="dk">${pxf(h.cost, E)}</span><span class="v">${pxf(h.px, E)}</span><b class="v ${updn(h.pnl_pct)}">${pct(h.pnl_pct, 2)}</b><span class="v ${updn(h.pnl)}">${sgn(h.pnl)}</span><span class="dk">${fmt(h.weight, 1)}%</span></a>`; }).join("")}
      ${H.length > 5 ? `<button class="rk-all" data-all="${esc(x.id)}">${all ? "收起，只看前 5 只 ▴" : `展开全部 ${H.length} 只 ▾`}</button>` : ""}
      <div class="rk-pn">${H.length > 1 ? "按盈亏额大小排；" : ""}买入价含手续费；涨跌、盈亏都是现价比买入价${live ? "（现价=腾讯实时价）" : `（现价=${lastLab} 收盘价）`}</div></div>`
      : `<div class="rk-empty"><b>空仓</b><span>${sig.text ? `${esc(md5(sig.date))} 信号：${linkify(sig.text)}` : "全部现金"}</span></div>`;
    // 一句话：没成交的单 / 今天卖掉的 / 接下来要做的
    const lines = [];
    const miss = live ? e.miss : (x.misses || []).filter((m) => m.date === J.last_date).map((m) => ({ name: m.name, sym: m.sym, why: m.why }));
    if (miss.length) lines.push(["miss", miss.map((m) => `${lk(m.name, m.sym)}：${esc(m.why)}`).join("；")]);
    const sold = live ? e.fills.filter((f) => f.side === "卖") : (x.trades || []).filter((t) => t.date === J.last_date && t.side === "卖出").map((t) => ({ name: t.name, sym: t.sym, pnl: t.pnl }));
    if (sold.length) lines.push(["sold", `${live ? "今天开盘" : lastLab + " 开盘"}已卖：${sold.slice(0, 4).map((f) => `${lk(f.name, f.sym)}${f.pnl != null ? `（<span class="${updn(f.pnl)}">${sgn(f.pnl)}</span>）` : ""}`).join("、")}${sold.length > 4 ? ` 等 ${sold.length} 只` : ""}`]);
    if (live) {
      if (ZT_HOLD.has(x.id) && H.length) {
        const zt = H.filter((h) => h.up > 0 && h.px >= h.up - 1e-6), nz = H.filter((h) => !zt.includes(h));
        const ls = (a) => a.map((h) => lk(h.name, h.sym)).join("、");
        lines.push(["todo", `收盘没涨停 → ${nextDay(C.wd)}开盘卖。${nz.length ? `现在没涨停：<b>${ls(nz)}</b>` : ""}${nz.length && zt.length ? "；" : ""}${zt.length ? `现在涨停：${ls(zt)}（封住就继续拿）` : ""}`]);
      } else if (TAIL[x.id] && H.length) lines.push(["todo", `收盘不在今天${TAIL[x.id]}前 3 → ${nextDay(C.wd)}开盘卖（一般只拿一晚）`]);
    } else if ((x.pending || []).length) {
      const when = J.last_date < today && C.wd >= 1 && C.wd <= 5 ? "今天" : nextDay(C.wd);
      const S = x.pending.filter((o) => o.act === "卖出"), B = x.pending.filter((o) => o.act !== "卖出");
      const rs = S.length && S.every((o) => o.reason === S[0].reason) && S[0].reason.length <= 14 ? `（${esc(S[0].reason)}）` : "";
      lines.push(["todo", `${when}开盘要做：${S.length ? `卖 <b>${names(S)}</b>${rs}` : ""}${S.length && B.length ? "；" : ""}${B.length ? `买 <b>${names(B)}</b>` : ""}`]);
    }
    const lineT = lines.map(([k, t]) => `<div class="rk-ln rk-${k}">${t}</div>`).join("");
    // 折叠：规则与明细
    const refT = [[x.ref, x.ref_name, exv], [x.ref2, x.ref2_name, live ? null : x.excess2], [x.ref3, x.ref3_name, live ? null : x.excess3]].filter((a) => a[0])
      .map(([id, nm, v], i) => `<li>${i ? "另比" : "对照"}：${esc(nm || id)}${v != null ? ` <b class="${updn(v)}">${pct(v, 2)}</b>` : ""}（同一段时间比）</li>`).join("");
    const pend = x.pending || [];
    const pendT = pend.length ? `<h4>${live ? "今天开盘的单（已按开盘价估算成交，见上面持仓）" : (J.last_date < today ? "今天" : "下一交易日") + "开盘待成交"}（${pend.length} 单）</h4><ul class="race-ul">${pend.map((o) => `<li><b class="${o.act === "买入" ? "up" : "dn"}">${o.act}</b> ${lk(o.name, o.sym)}${o.act === "买入" && o.w != null ? ` <span class="muted">目标 ${fmt(o.w, 1)}%≈${wan(o.amt)}元</span>` : ""}${o.carry ? ' <i class="race-tag">顺延</i>' : ""}<div class="muted small">${linkify(o.reason)}</div></li>`).join("")}</ul>` : "";
    const fillT = live && e.fills.length ? `<h4>今天开盘估算成交（${e.fills.length} 笔）</h4><ul class="race-ul">${e.fills.map((f) => `<li><b class="${f.side === "买" ? "up" : "dn"}">${f.side}</b> ${lk(f.name, f.sym)} ${f.q} 股 @ ${pxf(f.px, etf.has(f.sym))}</li>`).join("")}</ul>` : "";
    const tr = (x.trades || []).slice(0, 12);
    const trT = tr.length ? `<ul class="race-ul">${tr.map((t) => `<li><span class="muted">${md5(t.date)}</span> <b class="${t.side === "买入" ? "up" : t.side === "卖出" ? "dn" : ""}">${esc(t.side)}</b> ${lk(t.name, t.sym)} ${t.qty}${t.side === "分红" ? "股" : ""} @ ${t.price} ≈ ${wan(+t.amount)}元${t.pnl != null ? ` <span class="${updn(t.pnl)}">盈亏 ${t.pnl > 0 ? "+" : ""}${num(t.pnl)}</span>` : ""}<div class="muted small">${linkify(t.reason || "")}${t.fee ? `｜费用 ${fmt(t.fee, 2)}` : ""}</div></li>`).join("")}</ul>` : '<div class="muted">还没有记账的成交</div>';
    const ms = (x.misses || []).slice(0, 6);
    const msT = ms.length ? `<h4>没成交的单</h4><ul class="race-ul">${ms.map((m) => `<li><span class="muted">${md5(m.date)}</span> ${esc(m.side)} ${lk(m.name, m.sym)}：${esc(m.why)}</li>`).join("")}</ul>` : "";
    const more = `<details class="rk-more" data-more="${esc(x.id)}"${C.openMore.has(x.id) ? " open" : ""}><summary>规则与明细</summary><div class="race-body">
      <div class="race-rule">${linkify(x.rule)}</div>${refT ? `<ul class="race-ul rk-refs">${refT}</ul>` : ""}
      <div class="race-sig"><b>${esc(md5(sig.date))} 收盘信号</b>${sig.text ? linkify(sig.text) : "—"}</div>
      <div class="race-mini"><span>最大回撤 <b>${fmt(x.mdd, 2)}%</b></span><span>已实现 <b class="${updn(x.realized)}">${x.realized > 0 ? "+" : ""}${num(x.realized)}</b></span><span>开赛 <b>${x.days}</b> 天${x.start ? `（${esc(md5(x.start))} 起）` : ""}</span></div>
      ${fillT}${pendT}<h4>最近成交（记账）</h4>${trT}${msT}</div></details>`;
    return `<div class="rk-h"><span class="rk-nm">${esc(x.name)}${tag}</span><span class="rk-st ${badge[1]}">${badge[0]}</span></div>${big}${posT}${lineT}${more}`;
  }

  async function page() {
    document.title = "策略赛马 · 小七投研";
    const tok = A.tok();
    app.innerHTML = `<h1>🏇 策略赛马</h1>${LOADING("读取赛况…")}`;
    let J;
    const SP = getJSON("s_signals.json", true).catch(() => null);
    try { J = await getJSON("race.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>🏇 策略赛马</h1>${FAIL("赛况数据暂未生成")}`; return; }
    if (!A.alive(tok)) return;
    const P = J.players || [];
    const n = J.n || P.length;
    const L = J.live;
    initNames(J, await SP);
    if (!A.alive(tok)) return;
    const now0 = BJ(), today = now0.ymd;
    const GN = Object.fromEntries((J.groups || []).map((g) => [g.key, g.name]));
    const G = (J.groups && J.groups.length ? J.groups : [{ key: "all", name: "全部选手" }]).map((g) => ({ ...g, P: P.filter((x) => g.key === "all" || x.group === g.key) })).filter((g) => g.P.length);
    const isNew = (x) => x.pre || (x.days != null && x.days <= 3);
    let grp = "all", view = bookedView(J), prevRank = {}, closedToday = false, errMsg = "", lastFetch = null, lunchDone = false, afterDone = false;
    const LSK = "race_live_v1";
    let pts = [];
    try { const o = JSON.parse(localStorage.getItem(LSK) || "null"); if (o && o.d === today && o.base === J.last_date) pts = o.pts || []; } catch (e) { /* 无痕模式等 */ }
    const savePts = () => {
      for (let k = 0; k < 3; k++) {
        try { localStorage.setItem(LSK, JSON.stringify({ d: today, base: J.last_date, pts })); return; } catch (e) { pts = pts.filter((_, i) => i % 2 === 0); }
      }
    };

    // ---------- 骨架 ----------
    const grpT = G.map((g) => `<details class="race-grp" data-g="${esc(g.key)}" open><summary><h2>${esc(g.name)} <span class="muted">${g.P.length} 位${g.P.some((x) => x.ctrl) ? "，含对照" : ""}</span></h2></summary>
      <div class="race-list">${g.P.map((x) => `<div class="card race-card rk-card${x.ctrl ? " race-c" : ""}" id="rc-c-${esc(x.id)}" style="--rc:${esc(x.color)}"></div>`).join("")}</div></details>`).join("");
    const ETF = new Set((L && L.etf) || []), openMore = new Set(), showAll = new Set();
    function renderCards() {
      const ph = phase(J, BJ()), by = Object.fromEntries(view.rows.map((r) => [r.x.id, r]));
      const C = { J, today, ph, live: view.live, etf: ETF, openMore, showAll, wd: BJ().wd };
      P.forEach((x) => { const el = document.getElementById("rc-c-" + x.id); if (el) el.innerHTML = card(x, { ...C, r: by[x.id] }); });
    }
    const chips = [["all", `全部 ${n}`], ...G.filter((g) => g.key !== "all").map((g) => [g.key, `${g.name} ${g.P.length}`])];
    app.innerHTML = `<h1>🏇 策略赛马</h1>
      <div id="rc-sum"></div>
      ${J.rules_changed ? '<div class="race-warn">规则文件在开赛后被改动过：旧选手仍按开赛时的规则跑，改动只对新开的选手有效。</div>' : ""}
      <h2>排行榜 <span class="muted small">名次是全体排名，点一行看持仓</span></h2>
      <div class="rc-chips" id="rc-chips">${chips.map(([k, t]) => `<button data-g="${esc(k)}" class="${k === grp ? "on" : ""}">${esc(t)}</button>`).join("")}</div>
      <div class="rc-stamp" id="rc-stamp"></div>
      <div class="card rc-board" id="rc-board"></div>
      <div class="card rc-chart"><h3>累计收益曲线 <span class="muted small" id="rc-navn"></span></h3><div id="rc-nav" class="rc-nav"></div><div class="rc-leg" id="rc-leg"></div><div class="rc-leg-n">点名字显示/隐藏；默认只显示前 5 名 + 随便买 + 沪深300。</div></div>
      <div class="card rc-chart" id="rc-intra-c" hidden><h3>今天分时 <span class="muted small">各选手今天估算涨跌，从 09:30 起</span></h3><div id="rc-intra" class="rc-intra"></div></div>
      ${how("<b>盘中估算</b>：交易时段每 20 秒取一次腾讯实时价，按「现金 + 持仓股数 × 实时价」算；今天开盘要成交的单按今天开盘价、同样的滑点和手续费估算（开盘涨停的作废）。只是估算，收盘后 17:40 记账为准。<br>「比随便买 / 比对照」= 这个选手的累计收益 − 对照选手在同一段时间的收益。曲线上实线是收盘记账，虚线是今天盘中估算；黑色点线是沪深300指数（价格指数，不含分红）。")}
      <details class="howto"><summary>怎么比的 ⓘ</summary><p class="muted small">${n} 个选手各拿 10 万元虚拟本金，从各自的开赛日起每天收盘出信号、第二天开盘按真实开盘价成交，扣佣金、印花税、滑点，涨停买不进、跌停卖不出。不回测、不回填——历史回测都可能有偏差，这里只认开赛后真实记下来的成绩。红色=赚、绿色=亏。</p></details>
      <h2>每位选手的持仓 <span class="muted small">点股票进个股页，点组名折叠</span></h2>
      <div id="rc-cards">${grpT}</div>
      <h2>规则原文 <span class="muted">开赛前写死${J.rules_commit ? `，git ${esc(J.rules_commit.split(" ")[0])}` : ""}</span></h2>
      <details class="card race-rules"><summary>展开看完整规则（改规则只能新开选手）</summary><div class="race-md">${mdLite(J.rules_md)}</div></details>
      <p class="muted small">成本：${esc(J.cost)}。记账更新于 ${esc(J.updated)}。模拟盘，不构成投资建议。<a href="#/account">💼 小七虚拟账户 ›</a>　<a href="stock/#/picks/cn">🎯 买卖点 ›</a></p>${DISC}`;

    // ---------- 小结卡 ----------
    function renderSum() {
      const V = view, R = V.rows, rnd = R.find((r) => r.x.id === "p1");
      const live = V.live, ranked = R.filter((r) => r.rank != null);
      const lead = ranked[0], last = ranked[ranked.length - 1];
      const pickers = ranked.filter((r) => !r.x.ctrl && r.x.ref && (live ? r.excess != null : r.x.excess != null) && !(live ? false : r.x.pre));
      const beat = pickers.filter((r) => (live ? r.excess : r.x.excess) > 0).length;
      const later = (J.batches || []).slice(1).filter((b) => P.some((x) => x.batch === b.batch && x.pre));
      const byStart = {};
      later.forEach((b) => { const k = b.start ? (b.start <= today ? "今天" : md5(b.start)) : "下一交易日"; byStart[k] = (byStart[k] || 0) + (b.n || 0); });
      const laterT = Object.keys(byStart).length ? `🆕 新开赛 ${Object.entries(byStart).map(([s, k]) => `<b>${k}</b> 位（${esc(s)}开盘首次成交${s === "今天" ? "，收盘后记账" : ""}）`).join("、")}，榜上标「新」` : "";
      const dayN = J.days + (live ? 1 : 0);
      if (J.pre && !live) {
        $("#rc-sum").innerHTML = `<div class="card race-sum rc-sum"><div class="rs-n" style="margin-top:0">⏳ ${esc(md5(J.last_date))} 收盘已出第一批信号，<b>${esc(md5(J.start))} 开盘首次成交</b>，当天收盘后开始排名。</div>${laterT ? `<div class="rs-n">${laterT}</div>` : ""}</div>`;
        return;
      }
      const lab = live ? "(估)" : "";
      $("#rc-sum").innerHTML = `<div class="card race-sum rc-sum"><div class="rs4"><div><span>开赛</span><b>第 ${dayN} 天</b></div><div><span>沪深300${lab}</span><b class="${updn(V.bench.ret)}">${pct(V.bench.ret, 2)}</b></div><div><span>随便买${lab}</span><b class="${updn(rnd && rnd.ret)}">${pct(rnd && rnd.ret, 2)}</b></div><div><span>选手</span><b>${n} 位</b></div></div>
        <div class="rs-n">${lead ? `🥇 ${live ? "盘中领先" : "领先"} <b>${esc(lead.x.name)}</b> <b class="${updn(lead.ret)}">${pct(lead.ret, 2)}</b>，垫底 ${esc(last.x.name)} <b class="${updn(last.ret)}">${pct(last.ret, 2)}</b>` : ""}${pickers.length ? `；会选股/择时的 ${pickers.length} 位里 <b>${beat}</b> 位跑赢自己的「随便买」对照` : ""}${live && V.bench.today != null ? `；沪深300 今天 <b class="${updn(V.bench.today)}">${pct(V.bench.today, 2)}</b>` : ""}${laterT ? "<br>" + laterT : ""}</div>
        ${J.days != null && J.days < 60 ? `<div class="rs-w">⚠️ 开赛不足 60 个交易日，排名主要靠运气</div>` : ""}</div>`;
    }

    // ---------- 排行榜 ----------
    function statusOf(r) {
      const x = r.x;
      if (view.live) {
        const e = r.e;
        if (e && (x.pending || []).length) {
          const nb = e.fills.filter((f) => f.side === "买").length, ns = e.fills.length - nb;
          return [`今开${nb ? " 买" + nb : ""}${ns ? " 卖" + ns : ""}${!e.fills.length ? " 没成交" : ""}${e.miss.length ? ` · ${e.miss.length} 单没成` : ""} · 持 ${e.hold.length} 只`, "ok"];
        }
      } else if (x.pre) {
        return x.start && x.start <= today && J.last_date < today ? ["今天开盘首次成交", "ok"] : [`${md5(x.start)} 开盘首次成交`, "ok"];
      }
      const ex = view.live ? r.excess : x.excess;
      return [`${GN[x.group] || ""}${x.ref && ex != null ? ` · 比${x.ref === "p1" ? "随便买" : "对照"} ${pct(ex, 2)}` : !x.ref ? " · 基准" : ""}`, ""];
    }
    function renderBoard() {
      const el = $("#rc-board");
      if (!el) return;
      const live = view.live;
      const R = view.rows.filter((r) => grp === "all" || r.x.group === grp);
      const old = {};
      $$(".rc-row[data-id]", el).forEach((d) => { old[d.dataset.id] = d.getBoundingClientRect().top; });
      const amtH = live ? "估算金额" : "总资产";
      const hd = `<div class="rc-row rc-hd"><span>名次</span><span>选手</span><span class="rc-amt">${amtH}</span><span>${live ? "今天(估)" : md5(J.last_date) + " 当日"}</span><span>${live ? "累计(估)" : "累计"}<small>${amtH}</small></span></div>`;
      el.innerHTML = hd + R.map((r) => {
        const x = r.x, [st, cls] = statusOf(r);
        let mv = "";
        const r0 = x.pre ? null : x.rank;   // 和上一次收盘记账的名次比（新选手标「新」，不比）
        if (live && r0 != null && r.rank !== r0) { const d = r0 - r.rank; mv = `<small class="${d > 0 ? "up" : "dn"}">${d > 0 ? "↑" : "↓"}${Math.abs(d)}</small>`; }
        const pending = !live && x.pre;
        return `<div class="rc-row" data-id="${esc(x.id)}"><div class="rc-rk${!pending && r.rank <= 3 ? " t3" : ""}">${pending ? "·" : r.rank}${mv}</div>
          <div class="rc-nm"><b><i class="c" style="background:${esc(x.color)}"></i><span class="t">${esc(x.name)}</span>${isNew(x) ? '<em class="rc-new">新</em>' : ""}${x.ctrl && !/对照|基准/.test(x.name) ? '<em class="rc-ct">对照</em>' : ""}</b><span class="${cls}">${st}</span></div>
          <div class="rc-v rc-amt">${num(r.eq)}</div>
          <div class="rc-v ${updn(r.today)}">${r.today == null ? "—" : pct(r.today, 2)}</div>
          <div class="rc-v big ${updn(r.ret)}">${pending ? (x.start && x.start <= today && J.last_date < today ? "今天起" : "待开赛") : pct(r.ret, 2)}<small>${num(r.eq)}</small></div></div>`;
      }).join("");
      // 名次变化：FLIP 平移动画 + 闪一下
      $$(".rc-row[data-id]", el).forEach((d) => {
        const id = d.dataset.id, t0 = old[id];
        const rk = view.rows.find((r) => r.x.id === id).rank;
        if (t0 != null) {
          const dy = t0 - d.getBoundingClientRect().top;
          if (Math.abs(dy) > 1) {
            d.style.transform = `translateY(${dy}px)`; d.style.transition = "none"; d.style.zIndex = 1;
            requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transition = "transform .6s ease"; d.style.transform = ""; }));
            setTimeout(() => { d.style.zIndex = ""; }, 700);
          }
        }
        if (prevRank[id] != null && prevRank[id] !== rk) d.classList.add("rc-flash");
      });
      prevRank = Object.fromEntries(view.rows.map((r) => [r.x.id, r.rank]));
    }
    function renderStamp() {
      const el = $("#rc-stamp");
      if (!el) return;
      const ph = phase(J, BJ());
      el.className = "rc-stamp" + (errMsg ? " err" : "");
      if (view.live) {
        el.innerHTML = ph === "open" ? `<i class="dot"></i><span><b>盘中估算</b> · ${esc(lastFetch)} 更新 · 收盘后以记账为准${errMsg ? `　⚠️ ${esc(errMsg)}` : ""}</span>`
          : ph === "lunch" ? `<span><b>午间休市</b> · 估算截至 ${esc(lastFetch)}（13:00 继续刷新）· 收盘后以记账为准</span>`
          : `<span><b>已收盘</b> · 按收盘价估算（${esc(lastFetch)} 取价）· 17:40 左右记账后以记账为准</span>`;
        return;
      }
      const why = errMsg ? `⚠️ ${errMsg}，先显示记账数据` : closedToday ? "今天休市" : ph === "pre" ? "09:30 开盘后自动切换为盘中估算" : ph === "after" ? "今天已收盘，17:40 左右记账后更新" : ph === "closed" ? "休市" : "";
      el.innerHTML = `<span><b>数据截至 ${esc(md5(J.last_date))} 收盘</b>${why ? " · " + esc(why) : ""}</span>`;
    }

    // ---------- 曲线 ----------
    const dates = [...new Set([...(J.bench || []).map((r) => r.date), ...P.flatMap((x) => (x.nav || []).map((r) => r.d))])].sort();
    const idx = Object.fromEntries(dates.map((d, i) => [d, i]));
    const N = dates.length;
    const b0 = J.bench && J.bench[0] && J.bench[0].close;
    let SEL = null, cNav = null, cIn = null;
    const BN = J.bench_name || "沪深300";
    const shownP = () => P.filter((x) => grp === "all" || x.group === grp);
    function initSel() {
      const R = view.rows.filter((r) => r.rank != null || view.live);
      const keep = grp === "all" ? new Set([...R.filter((r) => !r.x.pre || view.live).slice(0, 5).map((r) => r.x.id), "p1"]) : new Set(shownP().map((x) => x.id));
      SEL = { [BN]: true };
      P.forEach((x) => { SEL[x.name] = keep.has(x.id); });
    }
    const showTail = () => view.live && pts.length > 0;
    function navOpt() {
      const W = Math.max(1, Math.round((N - 1) / 3));   // 今天盘中段占的宽度（按交易日计），开赛天数多了也看得清
      const xmax = showTail() ? N - 1 + W : N - 1;
      const lab = (v) => { if (Math.abs(v - Math.round(v)) > 1e-6) return ""; const i = Math.round(v); return i < N ? md5(dates[i]) : i === xmax ? "今天" : ""; };
      const tipLab = (v) => (v > N - 1 + 1e-6 ? "今天 " + mlab(((v - (N - 1)) / W) * 240) + "（估算）" : md5(dates[Math.round(v)]) + " 收盘");
      const S = [];
      shownP().sort((a, b) => pid(a) - pid(b)).forEach((x) => {
        S.push({ id: "b-" + x.id, name: x.name, type: "line", data: (x.nav || []).map((r) => [idx[r.d], r.v]), smooth: 0.2, showSymbol: N < 25, symbolSize: 4,
          lineStyle: { width: x.ctrl ? 1.5 : 2.2, color: x.color }, itemStyle: { color: x.color }, emphasis: { focus: "series" } });
        const tail = showTail() ? [[N - 1, x.ret], ...pts.filter((p) => p.v[x.id]).map((p) => [N - 1 + (p.m / 240) * W, p.v[x.id][0]])] : [];
        S.push({ id: "l-" + x.id, name: x.name, type: "line", data: tail.map((d, i) => (i === tail.length - 1 && i ? { value: d, symbol: "circle", symbolSize: 6 } : d)), symbol: "none",
          lineStyle: { width: 1.8, color: x.color, type: [4, 3], opacity: 0.8 }, itemStyle: { color: x.color } });
      });
      if (b0) {
        S.push({ id: "b-bench", name: BN, type: "line", data: (J.bench || []).map((r) => [idx[r.date], +((r.close / b0 - 1) * 100).toFixed(2)]), symbol: "none", smooth: 0.2,
          lineStyle: { width: 1.2, type: "dotted", color: "#555" }, itemStyle: { color: "#555" } });
        const bt = showTail() ? [[N - 1, J.bench_ret], ...pts.filter((p) => p.b).map((p) => [N - 1 + (p.m / 240) * W, p.b[0]])] : [];
        S.push({ id: "l-bench", name: BN, type: "line", data: bt, symbol: "none", lineStyle: { width: 1.2, type: "dotted", color: "#999" }, itemStyle: { color: "#555" } });
      }
      return {
        animation: false,
        legend: { show: false, data: S.map((s) => s.name).filter((v, i, a) => a.indexOf(v) === i), selected: SEL },
        grid: { left: 44, right: 14, top: 12, bottom: 26 },
        tooltip: { trigger: "axis", confine: true, axisPointer: { type: "line" },
          formatter: (ps) => {
            if (!ps.length) return "";
            const xv = ps[0].axisValue, best = {};
            ps.forEach((p) => { const v = p.value && (p.value.value || p.value); if (!v || v[1] == null) return; const d = Math.abs(v[0] - xv); if (!best[p.seriesName] || d < best[p.seriesName].d) best[p.seriesName] = { d, v: v[1], m: p.marker }; });
            return `${tipLab(xv)}<br>` + Object.entries(best).sort((a, b) => b[1].v - a[1].v).slice(0, 12).map(([k, o]) => `${o.m}${esc(k)} ${pct(o.v, 2)}`).join("<br>");
          } },
        xAxis: { type: "value", min: 0, max: xmax, interval: Math.max(1, Math.ceil((N - 1) / 6)), axisLine: { lineStyle: { color: "#d0d4da" } }, axisTick: { show: false }, splitLine: { show: false },
          axisLabel: { color: "#8a9099", fontSize: 10, formatter: lab, showMaxLabel: true } },
        yAxis: { type: "value", scale: true, splitNumber: 4, axisLabel: { formatter: "{value}%", color: "#8a9099", fontSize: 10 }, splitLine: { lineStyle: { color: "#f0f1f3" } } },
        series: S,
      };
    }
    function inOpt() {
      const few = pts.length < 3;
      const S = shownP().sort((a, b) => pid(a) - pid(b)).map((x) => ({ id: "i-" + x.id, name: x.name, type: "line", symbol: few ? "circle" : "none", symbolSize: 5, data: pts.filter((p) => p.v[x.id]).map((p) => [p.m, p.v[x.id][1]]),
        lineStyle: { width: x.ctrl ? 1.3 : 1.8, color: x.color }, itemStyle: { color: x.color } }));
      S.push({ id: "i-bench", name: BN, type: "line", symbol: "none", data: pts.filter((p) => p.b).map((p) => [p.m, p.b[1]]), lineStyle: { width: 1.2, type: "dotted", color: "#555" }, itemStyle: { color: "#555" } });
      return {
        animation: false,
        legend: { show: false, data: S.map((s) => s.name), selected: SEL },
        grid: { left: 44, right: 14, top: 10, bottom: 24 },
        tooltip: { trigger: "axis", confine: true, formatter: (ps) => `${mlab(ps[0].axisValue)}<br>` + ps.filter((p) => p.value).sort((a, b) => b.value[1] - a.value[1]).slice(0, 12).map((p) => `${p.marker}${esc(p.seriesName)} ${pct(p.value[1], 2)}`).join("<br>") },
        xAxis: { type: "value", min: 0, max: 240, interval: 60, axisLine: { lineStyle: { color: "#d0d4da" } }, axisTick: { show: false }, splitLine: { show: false },
          axisLabel: { color: "#8a9099", fontSize: 10, formatter: (v) => (v === 120 ? "11:30/13:00" : mlab(v)) } },
        yAxis: { type: "value", scale: true, splitNumber: 3, axisLabel: { formatter: "{value}%", color: "#8a9099", fontSize: 10 }, splitLine: { lineStyle: { color: "#f0f1f3" } } },
        series: S,
      };
    }
    function renderLeg() {
      const el = $("#rc-leg");
      if (!el) return;
      const ord = Object.fromEntries(view.rows.map((r, i) => [r.x.id, i]));
      const Q = shownP().sort((a, b) => ord[a.id] - ord[b.id]);
      el.innerHTML = Q.map((x) => `<button data-n="${esc(x.name)}" class="${SEL[x.name] ? "" : "off"}"><i style="background:${esc(x.color)}"></i>${esc(x.name)}</button>`).join("")
        + `<button data-n="${esc(BN)}" class="${SEL[BN] ? "" : "off"}"><i class="d"></i>${esc(BN)}</button>`;
    }
    function drawCharts(reset) {
      if (!window.echarts) return;
      if (N < 2 && !showTail()) { const el = $("#rc-nav"); if (el && !cNav) el.innerHTML = '<div class="empty">开赛第一天收盘记账后开始画净值曲线</div>'; }
      else {
        if (!cNav && $("#rc-nav")) cNav = A.mk($("#rc-nav"));
        if (cNav) cNav.setOption(navOpt(), reset ? { notMerge: true } : { replaceMerge: ["series"] });
      }
      const ph = phase(J, BJ());
      const showIn = pts.length > 0 && (view.live || ph === "after");
      const box = $("#rc-intra-c");
      if (box) box.hidden = !showIn;
      if (showIn) {
        if (ph === "after" && !view.live) box.querySelector("h3 .muted").textContent = "今天盘中估算回放（收盘后以记账为准）";
        if (!cIn && $("#rc-intra")) cIn = A.mk($("#rc-intra"));
        if (cIn) { cIn.setOption(inOpt(), reset ? { notMerge: true } : { replaceMerge: ["series"] }); cIn.resize(); }
      }
      const nn = $("#rc-navn");
      if (nn) nn.textContent = showTail() ? "实线=收盘记账，虚线=今天盘中估算" : `从开赛到 ${md5(J.last_date)} 收盘`;
    }
    function renderAll(resetCharts) { renderSum(); renderStamp(); renderBoard(); renderCards(); drawCharts(resetCharts); }

    // ---------- 实时刷新 ----------
    const SYMS = L ? [...new Set([L.bench_sym, ...P.flatMap((x) => [...(x.pos || []).map((p) => p.sym), ...(x.pending || []).map((o) => o.sym)])])] : [];
    let busy = false;
    async function refresh() {
      if (busy || !L) return;
      busy = true;
      try {
        const Q = await getQ(SYMS);
        if (!A.alive(tok)) return;
        const bq = Q[L.bench_sym];
        if (!bq) { errMsg = "实时行情没取到"; if (!view.live) renderStamp(); else renderStamp(); return; }
        errMsg = "";
        const qd = bq.t.slice(0, 8), td = today.replace(/-/g, "");
        if (qd && qd !== td) { closedToday = true; view = bookedView(J); renderAll(false); return; }
        const first = !view.live;
        view = liveView(J, Q, L);
        const now = BJ();
        lastFetch = now.hms;
        const qt = bq.t.length >= 14 ? +bq.t.slice(8, 10) * 60 + +bq.t.slice(10, 12) + +bq.t.slice(12, 14) / 60 : now.hm;
        const m = +tmin(qt).toFixed(2);
        const mkPt = (V, mm, t) => ({ m: mm, t, v: Object.fromEntries(V.rows.map((r) => [r.x.id, [+r.ret.toFixed(3), +r.today.toFixed(3)]])), b: V.bench.today != null ? [+V.bench.ret.toFixed(3), +V.bench.today.toFixed(3)] : null });
        if (!pts.length && m > 1) {   // 当天第一次打开：用今天开盘价补一个 09:30 的起点，分时图从开盘画起
          const Q0 = Object.fromEntries(Object.entries(Q).map(([k, q]) => [k, q.o > 0 ? { ...q, c: q.o } : q]));
          pts.push(mkPt(liveView(J, Q0, L), 0, "09:30:00"));
        }
        const pt = mkPt(view, m, now.hms);
        if (pts.length && Math.abs(pts[pts.length - 1].m - m) < 0.05) pts[pts.length - 1] = pt; else pts.push(pt);
        pts.sort((a, b) => a.m - b.m);
        savePts();
        if (first) initSel();
        renderAll(first);
        if (first) renderLeg();
      } catch (e) {
        errMsg = "实时行情获取失败";
        renderStamp();
      } finally { busy = false; }
    }
    async function tick() {
      if (!A.alive(tok)) { stop(); return; }
      if (document.hidden || !L || closedToday) return;
      const ph = phase(J, BJ());
      if (ph === "open") { lunchDone = false; await refresh(); }
      else if (ph === "lunch") { if (!lunchDone) { lunchDone = true; await refresh(); } }
      else if (ph === "after") { if (!afterDone) { afterDone = true; await refresh(); } }   // 收盘后、记账前：按收盘价再估一次，今天成交的单继续显示成持仓
      else if (view.live) { view = bookedView(J); initSel(); renderAll(true); renderLeg(); }
      else renderStamp();
    }
    const onVis = () => { if (!A.alive(tok)) { stop(); return; } if (!document.hidden) tick(); };
    const timer = setInterval(tick, 20000);
    document.addEventListener("visibilitychange", onVis);
    function stop() { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); }

    // ---------- 交互 ----------
    $("#rc-chips").onclick = (ev) => {
      const b = ev.target.closest("button[data-g]");
      if (!b || b.dataset.g === grp) return;
      grp = b.dataset.g;
      $$("#rc-chips button").forEach((z) => z.classList.toggle("on", z === b));
      $$("#rc-cards .race-grp").forEach((d) => { d.hidden = grp !== "all" && d.dataset.g !== grp; });
      prevRank = {};
      initSel(); renderBoard(); renderLeg(); drawCharts(true);
    };
    $("#rc-leg").onclick = (ev) => {
      const b = ev.target.closest("button[data-n]");
      if (!b) return;
      const k = b.dataset.n;
      SEL[k] = !SEL[k];
      b.classList.toggle("off", !SEL[k]);
      [cNav, cIn].forEach((c) => c && c.setOption({ legend: { selected: SEL } }));
    };
    $("#rc-board").onclick = (ev) => {
      const r = ev.target.closest(".rc-row[data-id]");
      if (!r) return;
      const c = document.getElementById("rc-c-" + r.dataset.id);
      if (!c) return;
      const g = c.closest(".race-grp");
      if (g) { g.hidden = false; g.open = true; }
      c.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const cardsEl = $("#rc-cards");
    cardsEl.onclick = (ev) => {
      const b = ev.target.closest("button[data-all]");
      if (!b) return;
      const id = b.dataset.all;
      if (showAll.has(id)) showAll.delete(id); else showAll.add(id);
      renderCards();
    };
    cardsEl.addEventListener("toggle", (ev) => {   // toggle 不冒泡，用捕获；记住「规则与明细」展开状态，每 20 秒重画卡片时保持
      const d = ev.target;
      if (!d.dataset || !d.dataset.more) return;
      if (d.open) openMore.add(d.dataset.more); else openMore.delete(d.dataset.more);
    }, true);

    // ---------- 首次渲染 ----------
    initSel();
    renderSum(); renderStamp(); renderBoard(); renderCards(); renderLeg();
    await need("lib");
    if (!A.alive(tok)) { stop(); return; }
    drawCharts(true);
    const ph0 = phase(J, now0);
    if (L && (ph0 === "open" || ph0 === "lunch" || ph0 === "after")) {
      const st = $("#rc-stamp");
      if (st) st.innerHTML = `<span>正在取实时行情，稍后切换为盘中估算…</span>`;
      if (ph0 === "lunch") lunchDone = true;
      if (ph0 === "after") afterDone = true;
      await refresh();
      if (!view.live) renderStamp();
    }
  }
  window.__mod_race = { page, est };   // est 导出仅供本地核对估算口径
})();
