/* 龙虎榜 #/lhb（按需加载）。数据：lhb.py → lhb/index.json（看板 + 合力 + 跟游资检验）、lhb/rank.json（排行）、lhb/seat_<id>.json（详情）。
   #/lhb               今天：一句话看懂 + 知名游资今天买了什么 + 这只票谁在买
   #/lhb/rank          游资排行（近1月/3月/6月/1年，主数字只用「隔日了结」估算）
   #/lhb/heli          合力买入（≥2 个知名游资同一天净买同一只票）
   #/lhb/follow        跟游资有没有用（T+1 开盘买入的回测，柱状图）
   #/lhb/seat/<id>     某个游资 / 营业部详情（每月估算盈亏柱状图、最近买了什么时间线…）
   盈亏只是估算：只看得到上榜那几天的买卖，口径写在页面底部。 */
(function () {
  const A = window.__APP;
  const { app, esc, pct, updn, FAIL, DISC, getJSON } = A;
  if (!document.getElementById("lh-css")) {
    const st = document.createElement("style");
    st.id = "lh-css";
    st.textContent = `
.lh{font-variant-numeric:tabular-nums;animation:lhIn .14s ease-out both}
@keyframes lhIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.lh{animation:none}}
.lh-top{display:flex;align-items:baseline;gap:6px 12px;flex-wrap:wrap;margin:4px 0 2px}.lh-top h1{margin:0}
.lh-meta{font-size:12.5px;color:var(--sub);margin:4px 0 12px;line-height:1.6}
.lh-tabs{display:flex;gap:22px;border-bottom:1px solid var(--line);margin:0 0 16px;overflow-x:auto;scrollbar-width:none;white-space:nowrap}
.lh-tabs::-webkit-scrollbar{display:none}
.lh-tabs a{padding:6px 0 9px;font-size:15px;color:var(--sub);font-weight:600;border-bottom:2px solid transparent;margin-bottom:-1px;flex:none}
.lh-tabs a.on{color:var(--text);border-color:var(--text)}
.lh-sec{display:flex;align-items:baseline;gap:4px 10px;flex-wrap:wrap;margin:26px 0 10px}.lh-sec h2{margin:0;font-size:18px}.lh-sec em{font-style:normal;font-size:12.5px;color:var(--sub)}
.lh-sec .sp{flex:1}
.lh-seg{display:inline-flex;background:#eceef2;border-radius:10px;padding:3px;gap:2px;flex:none;max-width:100%;overflow-x:auto;scrollbar-width:none}
.lh-seg::-webkit-scrollbar{display:none}
.lh-seg a{padding:4px 12px;border-radius:8px;font-size:13.5px;color:var(--sub);font-weight:600;line-height:1.6;white-space:nowrap;cursor:pointer}
.lh-seg a.on{background:var(--card);color:var(--text);box-shadow:0 1px 2px rgba(16,24,40,.1)}
.lh-ctl{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:0 0 14px}
.lh-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh)}
.lh-tag{display:inline-block;font-size:11.5px;line-height:18px;padding:0 6px;border-radius:5px;background:#f1f2f4;color:var(--sub);font-weight:600;white-space:nowrap;vertical-align:1px}
.lh-tag.c3{background:#e8f1fc;color:#1d64b8}.lh-tag.c2{background:#fff4e0;color:#b45309}.lh-tag.c1{background:#f1f2f4;color:#6b7280}
.lh-tag.t-lh{background:#eef2ff;color:#4f46e5}.lh-tag.t-bx{background:#e6f6f4;color:#0f766e}.lh-tag.t-sh{background:#f5f0ff;color:#7c3aed}
.lh em.up,.lh b.up,.lh span.up,.lh i.up{color:var(--up)}.lh em.dn,.lh b.dn,.lh span.dn,.lh i.dn{color:var(--dn)}
/* 术语 */
.lh-q{border-bottom:1px dashed #b9bfc8;cursor:help;white-space:nowrap}
.lh-q::after{content:"?";display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:#eceef2;color:var(--sub);font-size:10px;font-weight:700;margin-left:3px;vertical-align:2px;font-style:normal}
.lh-tip{position:fixed;z-index:999;background:#1f2328;color:#fff;font-size:13px;line-height:1.65;padding:10px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.2);display:none}
.lh-tip b{display:block;font-size:13.5px;margin-bottom:2px}
/* 头像 */
.lh-av{flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:#fff}
.lh-av.lg{width:56px;height:56px;font-size:24px}
/* 一句话 */
.lh-one{padding:14px 16px;margin:0 0 6px;border-left:4px solid var(--text);border-radius:0 var(--r) var(--r) 0}
.lh-one h2{margin:0 0 6px;font-size:16px}
.lh-one p{margin:0;font-size:15.5px;line-height:1.75}
.lh-one p b{font-weight:700}
details.lh-why{margin:8px 0 0;font-size:13.5px;color:var(--sub);line-height:1.75}
details.lh-why summary{cursor:pointer;color:var(--brand);font-weight:600;font-size:13.5px;list-style:none}
details.lh-why summary::-webkit-details-marker{display:none}
details.lh-why summary::before{content:"▸ ";}details.lh-why[open] summary::before{content:"▾ ";}
details.lh-why ol{margin:6px 0 0;padding-left:20px}details.lh-why li{margin:2px 0}
/* 股票胶囊 */
.lh-stk{display:inline-flex;flex-direction:column;gap:1px;padding:6px 10px 6px;border-radius:10px;color:var(--text);min-width:0;line-height:1.3;border:1px solid transparent}
.lh-stk.b{background:var(--up-bg);border-color:#f8d4d4}.lh-stk.s{background:var(--dn-bg);border-color:#cdebd7}
.lh-stk .nm{font-size:15px;font-weight:700;white-space:nowrap}
.lh-stk .am{font-size:13px;font-weight:700;white-space:nowrap}.lh-stk.b .am{color:var(--up-t)}.lh-stk.s .am{color:var(--dn-t)}
.lh-stk .sb{font-size:12px;color:var(--sub);white-space:nowrap}
a.lh-stk:hover{filter:brightness(.97)}
.lh-row{display:flex;gap:8px;align-items:flex-start;margin-top:10px}
.lh-row .lb{flex:none;width:46px;font-size:13px;font-weight:700;padding-top:9px;white-space:nowrap}
.lh-row .lb i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:1px}
.lh-row .lb.b{color:var(--up-t)}.lh-row .lb.b i{background:var(--up)}.lh-row .lb.s{color:var(--dn-t)}.lh-row .lb.s i{background:var(--dn)}
.lh-row .xs{display:flex;flex-wrap:wrap;gap:6px;min-width:0;flex:1}
/* 游资今天卡 */
.lh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lh-grid>*{min-width:0}
.lh-yc{padding:13px 15px 14px}
.lh-yc .hd{display:flex;align-items:center;gap:10px;min-width:0}
.lh-yc .hd .nn{min-width:0;flex:1}
.lh-yc .hd .nn a{font-size:17px;font-weight:700;color:var(--text)}
.lh-yc .hd .nn div{font-size:12.5px;color:var(--sub);margin-top:1px}
.lh-yc .hd .go{flex:none;font-size:12.5px;color:var(--sub)}
/* 个股卡 */
.lh-sk2{padding:13px 15px}
.lh-sk2 .hd{display:flex;align-items:flex-start;gap:8px}
.lh-sk2 .hd .nn{flex:1;min-width:0}.lh-sk2 .hd .nn a{font-size:17px;font-weight:700;color:var(--text)}.lh-sk2 .hd .nn em{font-style:normal;font-size:12px;color:var(--sub2);margin-left:6px}
.lh-sk2 .hd .ch{font-size:24px;font-weight:700;line-height:1.1;white-space:nowrap}
.lh-sk2 .why{font-size:13px;color:var(--sub);margin:3px 0 0;line-height:1.55}
.lh-sk2 .net{font-size:13px;color:var(--sub);margin-top:4px}.lh-sk2 .net b{font-size:14px}
.lh-who{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;padding-top:9px;border-top:1px dashed var(--line)}
.lh-who a,.lh-who span.p{display:inline-flex;align-items:baseline;gap:5px;font-size:13px;padding:3px 9px;border-radius:999px;white-space:nowrap;color:var(--text);background:#f1f2f4}
.lh-who .p.b{background:var(--up-bg)}.lh-who .p.b b{color:var(--up-t)}.lh-who .p.s{background:var(--dn-bg)}.lh-who .p.s b{color:var(--dn-t)}
.lh-who .none{font-size:12.5px;color:var(--sub2)}
.lh-more{display:block;text-align:center;margin:14px auto 0;padding:8px 18px;font-size:13.5px;color:var(--sub);background:var(--card);border:1px solid var(--line);border-radius:999px;width:max-content;cursor:pointer}
/* 排行卡 */
.lh-rk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.lh-rc{padding:13px 15px 13px;display:flex;flex-direction:column;gap:8px;color:var(--text);cursor:pointer;transition:border-color .12s,box-shadow .12s;min-width:0}
.lh-rc:hover{border-color:#cfd4dc;box-shadow:0 6px 16px rgba(16,24,40,.08)}
.lh-rc .h{display:flex;align-items:center;gap:9px;min-width:0}
.lh-rc .no{flex:none;width:22px;font-size:13px;font-weight:700;color:var(--sub2);text-align:center}
.lh-rc .h .nn{min-width:0;flex:1}.lh-rc .h .nn b{display:block;font-size:16.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lh-rc .h .nn span{display:block;font-size:12px;color:var(--sub2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lh-rc .pn b{font-size:30px;letter-spacing:-.5px;line-height:1.15;font-weight:700}.lh-rc .pn span{display:block;font-size:12px;color:var(--sub)}
.lh-rc .fq{display:flex;flex-wrap:wrap;align-items:center;gap:5px;font-size:12.5px;color:var(--sub)}
.lh-rc .fq a{font-size:13.5px;font-weight:600;color:var(--text);background:#f1f2f4;border-radius:999px;padding:2px 9px;white-space:nowrap}
.lh-rc .ft{font-size:12.5px;color:var(--sub)}
/* 详情 */
.lh-crumb{display:flex;gap:6px;font-size:13px;color:var(--sub);margin:0 0 10px;white-space:nowrap;overflow-x:auto;scrollbar-width:none}
.lh-crumb::-webkit-scrollbar{display:none}.lh-crumb a{color:var(--sub)}.lh-crumb i{font-style:normal;color:var(--sub2)}.lh-crumb b{color:var(--text);font-weight:600}
.lh-hero{padding:16px 18px;margin:0 0 6px}
.lh-hero .h1{display:flex;align-items:center;gap:12px;min-width:0}
.lh-hero .h1 .nn{min-width:0}.lh-hero h1{margin:0;font-size:24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lh-hero .al{font-size:12.5px;color:var(--sub);margin-top:2px}
.lh-hero .sty{font-size:14px;color:var(--text);margin:12px 0 12px;line-height:1.65;background:var(--soft);border-radius:10px;padding:9px 12px}
.lh-hero .big{display:flex;align-items:flex-end;gap:6px 14px;flex-wrap:wrap}
.lh-hero .big .v{font-size:36px;font-weight:800;letter-spacing:-.6px;line-height:1.1}
.lh-hero .big .l{font-size:13px;color:var(--sub);padding-bottom:5px}
.lh-hero .sm{font-size:13.5px;color:var(--sub);margin-top:8px;line-height:1.7}.lh-hero .sm b{color:var(--text)}
.lh-chart{padding:12px 12px 8px}
.lh-chart .cv{width:100%;height:230px}
.lh-chart svg{display:block}
.lh-chart svg text{font-size:11px;fill:var(--sub)}
.lh-chart .say{font-size:14.5px;line-height:1.7;padding:6px 6px 2px}
.lh-chart .lg{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--sub);padding:0 6px 4px}.lh-chart .lg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:5px;background:var(--c)}
details.lh-fold{margin:12px 0 0}
details.lh-fold>summary{cursor:pointer;list-style:none;padding:12px 15px;font-size:14.5px;font-weight:600;display:flex;align-items:center;gap:8px}
details.lh-fold>summary::-webkit-details-marker{display:none}
details.lh-fold>summary::after{content:"展开 ▾";flex:none;margin-left:auto;font-size:12.5px;color:var(--sub);font-weight:500}
details.lh-fold[open]>summary::after{content:"收起 ▴"}
details.lh-fold>summary>span{min-width:0;flex:1}details.lh-fold>summary em{display:block;font-style:normal;font-size:12.5px;color:var(--sub);font-weight:400;margin-top:1px}
details.lh-fold .bd{padding:0 15px 14px;font-size:13.5px;line-height:1.75;color:var(--text)}
.lh-day{padding:12px 15px;border-bottom:1px solid var(--line)}.lh-day:last-child{border-bottom:0}
.lh-day .dt{font-size:13.5px;font-weight:700;margin-bottom:8px;display:flex;gap:8px;align-items:baseline}.lh-day .dt em{font-style:normal;font-weight:400;font-size:12.5px;color:var(--sub)}
.lh-day .xs{display:flex;flex-wrap:wrap;gap:6px}
.lh-bars{padding:6px 15px 10px}
.lh-bar{display:grid;grid-template-columns:88px minmax(0,1fr);gap:10px;align-items:center;padding:6px 0}
.lh-bar a{font-size:15px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lh-bar .tr{display:flex;align-items:center;gap:8px;min-width:0}
.lh-bar .tr i{display:block;height:14px;border-radius:4px;background:var(--up);opacity:.8;flex:none}
.lh-bar .tr span{font-size:12.5px;color:var(--sub);white-space:nowrap}.lh-bar .tr span b{color:var(--text)}
.lh-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.lh-two>*{min-width:0}
.lh-two h3{font-size:14px;margin:0;padding:11px 14px 4px;color:var(--sub)}
.lh-li{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--line);color:var(--text);min-width:0}
.lh-li:last-child{border-bottom:0}.lh-li:hover{background:#fafbfc}
.lh-li .n{min-width:0;flex:1}.lh-li .n b{font-size:15px;font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lh-li .n em{display:block;font-style:normal;font-size:12px;color:var(--sub2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lh-li .v{text-align:right;white-space:nowrap;font-weight:700;font-size:15px}.lh-li .v em{display:block;font-style:normal;font-size:12px;color:var(--sub);font-weight:400}
.lh-hold{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.lh-hc{padding:11px 13px;color:var(--text);display:block}
.lh-hc .r1{display:flex;align-items:baseline;gap:6px}.lh-hc .r1 b{font-size:15.5px}.lh-hc .r1 .p{margin-left:auto;font-size:19px;font-weight:700}
.lh-hc .r2{font-size:12.5px;color:var(--sub);margin-top:3px;line-height:1.55}
.lh-seat{padding:11px 0;border-bottom:1px solid var(--line)}
.lh-seat:last-child{border-bottom:0}
.lh-seat .r1{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.lh-seat .r1 b{font-size:14px;font-weight:600}
.lh-seat .r2{font-size:12.5px;color:var(--sub);margin-top:3px;line-height:1.6}
.lh-seat .r2 a{color:var(--sub);text-decoration:underline;text-decoration-color:#d0d4da}
.lh-seat.off{opacity:.62}
.lh-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
.lh-kv div{background:var(--soft);border-radius:10px;padding:8px 11px;min-width:0}.lh-kv span{display:block;font-size:12px;color:var(--sub)}.lh-kv b{font-size:18px;white-space:nowrap}
.lh-note{font-size:12.5px;color:var(--sub);line-height:1.75}
.lh-note p{margin:0 0 6px}.lh-note p:last-child{margin:0}
.lh-warn{font-size:13px;line-height:1.65;padding:10px 14px;border-radius:10px;background:var(--warn-bg);color:var(--warn-t);margin:0 0 14px}
/* 跟游资 */
.lh-vd{padding:16px 18px}
.lh-vd .t{font-size:22px;font-weight:800;line-height:1.4}
.lh-vd p{font-size:14.5px;line-height:1.75;margin:8px 0 0;color:var(--text)}
.lh-vs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 0}
.lh-vs div{background:var(--soft);border-radius:10px;padding:10px 12px;min-width:0}.lh-vs span{display:block;font-size:12.5px;color:var(--sub);line-height:1.5}.lh-vs b{font-size:26px;font-weight:800}
.lh-gc{padding:11px 14px}
.lh-gc .r1{display:flex;align-items:baseline;gap:8px}.lh-gc .r1 b{font-size:15px}.lh-gc .r1 em{margin-left:auto;font-style:normal;font-size:12px;color:var(--sub2)}
.lh-gc .r2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:7px;font-size:12px;color:var(--sub)}.lh-gc .r2 b{display:block;font-size:16px}
.lh-tw{overflow-x:auto}
.lh-tb{width:100%;border-collapse:collapse;font-size:13.5px}
.lh-tb th{font-size:12px;color:var(--sub);font-weight:500;text-align:right;padding:8px 10px;background:var(--soft);border-bottom:1px solid var(--line);white-space:nowrap}
.lh-tb td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.lh-tb tr:last-child td{border-bottom:0}.lh-tb .l{text-align:left}
.lh-sk{border-radius:8px;background:linear-gradient(90deg,#eef0f3 25%,#f7f8fa 50%,#eef0f3 75%);background-size:200% 100%;animation:lhSk 1.2s infinite linear}
@keyframes lhSk{from{background-position:200% 0}to{background-position:-200% 0}}
.lh-empty{padding:22px;text-align:center;color:var(--sub);font-size:13.5px}
@media (max-width:1099px){.lh-rk{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:760px){
  .lh-tabs{gap:18px;margin-bottom:12px}.lh-tabs a{font-size:14.5px}
  .lh-grid,.lh-rk{grid-template-columns:minmax(0,1fr);gap:10px}
  .lh-one{padding:12px 14px}.lh-one p{font-size:15px}
  .lh-yc,.lh-sk2{padding:12px 13px}
  .lh-hero{padding:14px}.lh-hero h1{font-size:22px}.lh-hero .big .v{font-size:32px}
  .lh-chart .cv{height:210px}
  .lh-bar{grid-template-columns:76px minmax(0,1fr)}
  .lh-hold{grid-template-columns:minmax(0,1fr)}
  .lh-vd{padding:14px}.lh-vd .t{font-size:20px}.lh-vs b{font-size:22px}
  .lh-two .lh-li{padding:9px 11px}.lh-two .lh-li .v{font-size:14px}
}`;
    document.head.appendChild(st);
  }

  // ---------- 工具 ----------
  const S = { win: "y1", sort: "pnl", kind: "yz", n: 30, f: "yz", nb: 12, days: 8 };
  try { const o = JSON.parse(localStorage.getItem("lhbS") || "{}"); for (const k of ["win", "sort", "kind", "f"]) if (o[k]) S[k] = o[k]; } catch (e) { /* 忽略 */ }
  if (!["pnl", "n"].includes(S.sort)) S.sort = "pnl";
  const save = () => { try { localStorage.setItem("lhbS", JSON.stringify({ win: S.win, sort: S.sort, kind: S.kind, f: S.f })); } catch (e) { /* 忽略 */ } };
  // 金额：入参单位万元 → 「1.70亿」「3520万」
  const money = (w, sign = true) => {
    if (w == null || Number.isNaN(w)) return "—";
    if (Math.abs(w) < 0.5) return "0万";
    const s = sign && w > 0 ? "+" : w < 0 ? "−" : "", a = Math.abs(w);
    if (a >= 10000) { const y = a / 10000; return `${s}${y.toFixed(y >= 100 ? 0 : y >= 10 ? 1 : 2)}亿`; }
    return `${s}${Math.round(a)}万`;
  };
  const stockUrl = (sym) => `stock/#/s/${encodeURIComponent(sym)}`;
  const H = (...p) => "#/lhb" + (p.length ? "/" + p.map(encodeURIComponent).join("/") : "");
  const wk = (d) => "日一二三四五六"[new Date(d + "T00:00:00Z").getUTCDay()];
  const md = (d) => `${+d.slice(5, 7)}月${+d.slice(8, 10)}日`;
  const CONF = { 高: ["c3", "可信度高"], 中: ["c2", "可信度中"], 低: ["c1", "据传"] };
  const conf = (c) => (CONF[c] ? `<span class="lh-tag ${CONF[c][0]}" title="${c === "低" ? "来源少或互相冲突" : c === "高" ? "两个以上独立公开来源一致" : "只找到一个公开来源"}">${CONF[c][1]}</span>` : "");
  const TT = { 量化: "t-lh", 北向: "t-bx", 散户: "t-sh" };
  const typ = (t, plain) => (t === "游资" && !plain ? "" : `<span class="lh-tag ${TT[t] || ""}">${t === "未知" ? "营业部" : t}</span>`);
  const AVC = ["#e5484d", "#2f7fd8", "#d97706", "#7c3aed", "#0f766e", "#db2777", "#4f46e5", "#b45309", "#0e7490", "#65a30d"];
  const av = (name, lg) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997; return `<span class="lh-av${lg ? " lg" : ""}" style="background:${AVC[h % AVC.length]}">${esc([...name][0] || "?")}</span>`; };
  const wrap = (h) => `<div class="lh">${h}</div>`;
  const TERMS = {
    龙虎榜: "交易所每天收盘后公布的「异动股」名单：当天涨跌特别多、振幅或换手特别大的股票会上榜，同时公布这只票买入、卖出金额最大的 5 家营业部（各 5 家）。",
    营业部: "券商开在各地的网点，比如「国泰海通上海江苏路」。龙虎榜只写营业部名字、不写是谁；一个营业部里有成千上万个账户。",
    游资: "资金量大、专做短线的个人或小团队。圈内按他们常用的营业部起了外号（章盟主、方新侠…）。营业部↔游资的对应来自公开网络资料，不一定准。",
    机构: "龙虎榜上的「机构专用」席位：基金、保险、券商自营、QFII 等机构，统一显示「机构专用」，看不出是哪家。",
    北向: "通过沪股通 / 深股通买 A 股的境外资金，龙虎榜上显示「沪股通专用」「深股通专用」。",
    净买额: "买入额 − 卖出额。正数（红）＝买得比卖得多，负数（绿）＝卖得比买得多。",
    量化: "用程序自动下单的量化私募常用的几家营业部（对照表里归为「量化席位」）。",
    拉萨天团: "东方财富证券拉萨的几家营业部，背后是大量散户账户，常被当成「散户情绪」的代表。",
    隔日了结: "假设每次在榜上净买入的部分，都在下一个交易日收盘卖掉，算出来的赚亏。游资多数「今天买、明天走」，所以用它做主数字；锁仓好几天的会算不准。没上榜的买卖看不到，只是粗略估算。",
  };
  const term = (k, txt) => `<span class="lh-q" data-term="${esc(k)}" role="button" tabindex="0">${esc(txt || k)}</span>`;
  const TABS = [["", "今天"], ["rank", "游资排行"], ["heli", "合力买入"], ["follow", "跟游资有没有用"]];
  const tabs = (cur) => `<nav class="lh-tabs">${TABS.map(([k, n]) => `<a href="${H(...(k ? [k] : []))}" class="${cur === k ? "on" : ""}">${n}</a>`).join("")}</nav>`;
  const head = (I) => `<div class="lh-top"><h1>龙虎榜</h1></div>
    <div class="lh-meta">${md(I.date)}（周${wk(I.date)}）的${term("龙虎榜")} · 每个交易日约 17:30–19:00 公布，没出来时显示上一交易日 · 更新 ${esc(I.built)}</div>`;
  const NOTE = (I) => `<details class="lh-card lh-fold"><summary><span>数据从哪来、盈亏怎么估 <em>（看不懂可以跳过）</em></span></summary><div class="bd lh-note">
    <p><b>数据</b>：东方财富数据中心的每日龙虎榜（上榜个股、每个营业部的买入/卖出额、机构专用席位统计），统计区间 ${esc(I.range[0])} ~ ${esc(I.range[1])}（${I.days} 个交易日）。游资 ↔ 营业部对照是小七整理的公开网络资料（${I.nyz} 位游资，席位可信度 高 ${I.nseat_conf["高"] || 0} / 中 ${I.nseat_conf["中"] || 0} / 据传 ${I.nseat_conf["低"] || 0}）。营业部 ≠ 某个人：一个营业部里有成千上万个账户，游资也会换营业部、借别人的席位，「据传」的席位不并进游资的统计。</p>
    <p><b>盈亏怎么估</b>：只看得到上榜那几天的买卖额。上榜日成交均价 ≈ 当日成交额 ÷ 成交量（前复权），把买入额、卖出额折成股数。<br>
      ①<b>隔日了结</b>（页面主数字）：假设每次榜上净买入的部分都在下一个交易日收盘卖出——接近游资「今天买、明天走」的习惯，对锁仓好几天的游资会算不准。「次日赚钱」＝次日收盘高于买入均价的次数占比。<br>
      ②<b>榜上配对 + 最新价</b>（详情页折叠区）：同一天同一只票先买卖相抵，再按股票先进先出配对，配上的算已实现，没在榜上卖掉的按最新收盘价算浮动。游资隔天卖的那天往往不上榜，于是会被当成一直拿着，浮动盈亏常常严重偏离。<br>
      两种都是<b>估算：没上榜的买卖看不到，真实盈亏可能差很多</b>。「连续三个交易日」类上榜给的是 3 天累计额，已减去前两天记过的部分。</p>
    <p>仅供学习研究，不构成投资建议，也不是在说哪个人赚了或亏了多少钱。</p></div></details>`;
  const SK = () => `<div class="lh"><div class="lh-top"><h1>龙虎榜</h1></div><div class="lh-sk" style="height:14px;width:60%;margin:8px 0 16px"></div>
    <div class="lh-sk" style="height:30px;width:100%;margin-bottom:16px;border-radius:6px"></div>
    <div class="lh-sk" style="height:110px;margin-bottom:18px;border-radius:12px"></div>
    <div class="lh-grid">${"<div class=\"lh-sk\" style=\"height:150px;border-radius:12px\"></div>".repeat(4)}</div></div>`;
  const idx = () => getJSON("lhb/index.json", true);
  const rnk = () => getJSON("lhb/rank.json", true);

  // 股票胶囊：dir b=买（红）s=卖（绿）
  const chip = (sym, name, dir, amt, sub) => `<a class="lh-stk ${dir}" href="${stockUrl(sym)}"><span class="nm">${esc(name)}</span><span class="am">${dir === "b" ? "买" : "卖"} ${money(Math.abs(amt), false)}</span>${sub ? `<span class="sb">${sub}</span>` : ""}</a>`;
  const pc = (v, d = 1) => `<i class="${updn(v)}" style="font-style:normal">${pct(v, d)}</i>`;

  // 上榜原因 → 白话
  function plainWhy(t) {
    const n = (t.match(/(\d+)%/) || [])[1];
    const three = /连续三个交易日|三个交易日内|连续3个交易日/.test(t);
    if (/前5只/.test(t)) return "换手率排当天前 5";
    if (three && /涨幅偏离/.test(t)) return `3 天累计比大盘多涨 ${n}% 以上`;
    if (three && /跌幅偏离/.test(t)) return `3 天累计比大盘多跌 ${n}% 以上`;
    if (/涨幅偏离/.test(t)) return `当天比大盘多涨 ${n}% 以上`;
    if (/跌幅偏离/.test(t)) return `当天比大盘多跌 ${n}% 以上`;
    if (/振幅/.test(t)) return `一天里最高最低差了 ${n}% 以上`;
    if (/换手率/.test(t)) return `一天换手超 ${n}%（交易特别活跃）`;
    if (/涨幅达到/.test(t)) return `当天涨超 ${n}%`;
    if (/跌幅达到/.test(t)) return `当天跌超 ${n}%`;
    if (/无价格涨跌幅限制/.test(t)) return "新股/无涨跌幅限制的票异动";
    return t;
  }

  // ---------- 今天 ----------
  function todayPage(I) {
    const B = I.board || [];
    const nyz = B.filter((r) => r.yz.length).length, njg = B.filter((r) => r.jg && r.jg[2] > 0).length, nbx = B.filter((r) => r.north != null).length;
    const north = B.reduce((s, r) => s + (r.north || 0), 0);
    const heliT = (I.heli || []).filter((x) => x.d === I.date);
    let bb = null, bs = null;
    for (const r of B) for (const z of r.yz) {
      if (z.net > 0 && (!bb || z.net > bb.v)) bb = { v: z.net, z, r };
      if (z.net < 0 && (!bs || -z.net > bs.v)) bs = { v: -z.net, z, r };
    }
    const yzF = (I.follow.groups || []).find((g) => g.id === "yz");
    const up = B.filter((r) => r.chg > 0).length, dn = B.filter((r) => r.chg < 0).length;
    const one = `<div class="lh-card lh-one"><h2>一句话看懂今天</h2>
      <p>${md(I.date)} 共 <b>${B.length}</b> 只股票上了${term("龙虎榜")}（${up} 涨 ${dn} 跌）；${term("游资", "知名游资")}出手 <b>${nyz}</b> 只${bb ? `，买得最多的是 <b>${esc(bb.z.name)}</b> 买入 <a href="${stockUrl(bb.r.sym)}"><b>${esc(bb.r.name)}</b></a> <b class="up">${money(bb.v, false)}</b>` : ""}${bs ? `，卖得最多的是 <b>${esc(bs.z.name)}</b> 卖出 <a href="${stockUrl(bs.r.sym)}"><b>${esc(bs.r.name)}</b></a> <b class="dn">${money(bs.v, false)}</b>` : ""}。
      ${heliT.length ? `有 <b>${heliT.length}</b> 只票是 2 个以上游资一起买的：${heliT.slice(0, 3).map((x) => `<a href="${stockUrl(x.sym)}"><b>${esc(x.name)}</b></a>`).join("、")}。` : "今天没有 2 个以上知名游资一起买的票。"}
      ${term("机构")}净买 ${njg} 只；${term("北向")}在榜上合计 <b class="${updn(north)}">${north >= 0 ? "净买" : "净卖"} ${money(Math.abs(north), false)}</b>。</p>
      <details class="lh-why"><summary>龙虎榜是什么？看它有什么用？</summary><ol>
        <li><b>什么票会上榜</b>：当天涨跌特别多、振幅或换手特别大的票，交易所收盘后公布买得最多、卖得最多的各 5 家${term("营业部")}。</li>
        <li><b>游资是谁</b>：做短线的大资金，圈内按常用营业部起了外号。本页按公开资料把营业部对到游资，<b>不一定准</b>。</li>
        <li><b>为什么看</b>：知道今天的钱在炒什么题材、大资金在买还是在跑。</li>
        <li><b>别直接跟</b>：龙虎榜收盘后才公布，第二天才买得到。近一年知名游资买过的票，第二天开盘跟进持有 1 天平均 <b class="${updn(yzF && yzF.all["1"] && yzF.all["1"].avg)}">${yzF && yzF.all["1"] ? pct(yzF.all["1"].avg, 2) : "—"}</b>（已扣成本），详见「<a href="${H("follow")}">跟游资有没有用</a>」。</li></ol></details></div>`;

    // 知名游资今天买了什么
    const act = I.active || [];
    const ycard = (a) => {
      const st = a.stk.map((x) => ({ sym: x[0], name: x[1], net: x[2], buy: x[3], sell: x[4], chg: x[5] }));
      const b = st.filter((x) => x.net > 0).sort((p, q) => q.net - p.net), s = st.filter((x) => x.net < 0).sort((p, q) => p.net - q.net);
      const c = (x, d) => chip(x.sym, x.name, d, x.net, `当天 ${pc(x.chg)}${x.buy > 0 && x.sell > 0 && Math.min(x.buy, x.sell) > 0.3 * Math.max(x.buy, x.sell) ? " · 有买有卖" : ""}`);
      return `<div class="lh-card lh-yc"><div class="hd">${av(a.name)}<div class="nn"><a href="${H("seat", a.id)}">${esc(a.name)}</a> ${conf(a.conf)}
        <div>买 <b class="up">${money(a.buy, false)}</b> · 卖 <b class="dn">${money(a.sell, false)}</b> · ${st.length} 只票</div></div><a class="go" href="${H("seat", a.id)}">战绩 ›</a></div>
        ${b.length ? `<div class="lh-row"><span class="lb b"><i></i>买入</span><div class="xs">${b.map((x) => c(x, "b")).join("")}</div></div>` : ""}
        ${s.length ? `<div class="lh-row"><span class="lb s"><i></i>卖出</span><div class="xs">${s.map((x) => c(x, "s")).join("")}</div></div>` : ""}</div>`;
    };
    const actH = `<div class="lh-sec"><h2>知名游资今天买了什么</h2><em>按当天买卖总额排 · 金额是${term("净买额")} · 点股票看个股，点名字看战绩</em></div>
      ${act.length ? `<div class="lh-grid">${act.map(ycard).join("")}</div>` : '<div class="lh-card lh-empty">今天没有认出来的知名游资上榜</div>'}`;

    // 这只票谁在买
    const F = [["all", `全部 ${B.length}`], ["yz", `有知名游资 ${nyz}`], ["jg", `机构买 ${njg}`], ["bx", `北向 ${nbx}`]];
    const rows = S.f === "yz" ? B.filter((r) => r.yz.length) : S.f === "jg" ? B.filter((r) => r.jg && r.jg[2] > 0) : S.f === "bx" ? B.filter((r) => r.north != null) : B;
    const who = (r) => {
      const L = [];
      const p = (cls, name, v, href, extra = "") => `<${href ? `a href="${href}"` : 'span'} class="p ${cls}">${name} <b>${v > 0 ? "买" : "卖"} ${money(Math.abs(v), false)}</b>${extra}</${href ? "a" : "span"}>`;
      for (const z of r.yz) if (z.net) L.push(p(z.net > 0 ? "b" : "s", esc(z.name), z.net, H("seat", z.id)));
      if (r.jg && r.jg[2]) L.push(p(r.jg[2] > 0 ? "b" : "s", "机构", r.jg[2], null, `<span style="font-size:11.5px;color:var(--sub)">${r.jg[0]}买${r.jg[1]}卖</span>`));
      if (r.north) L.push(p(r.north > 0 ? "b" : "s", "北向", r.north, H("seat", "north")));
      if (r.quant) L.push(p(r.quant > 0 ? "b" : "s", "量化", r.quant, H("seat", "quant")));
      if (r.lasa) L.push(p(r.lasa > 0 ? "b" : "s", "拉萨天团", r.lasa, H("seat", "lasa")));
      return L.length ? L.join("") : '<span class="none">没认出知名游资 / 机构 / 北向，都是普通营业部</span>';
    };
    const scard = (r) => `<div class="lh-card lh-sk2"><div class="hd"><div class="nn"><a href="${stockUrl(r.sym)}">${esc(r.name)}</a><em>${esc(r.sym.slice(2))}</em>
        <div class="why">上榜原因：${esc([...new Set(r.why.map(plainWhy))].join("；"))}${r.three ? "（金额是 3 天合计）" : ""}</div></div><span class="ch ${updn(r.chg)}">${pct(r.chg, 2)}</span></div>
      <div class="net">龙虎榜${term("净买额")} <b class="${updn(r.net)}">${money(r.net)}</b> · 当天成交 ${money(r.amt, false)}</div>
      <div class="lh-who">${who(r)}</div></div>`;
    const stH = `<div class="lh-sec"><h2>这只票谁在买</h2><em>按龙虎榜净买额排 · 红＝买、绿＝卖</em><span class="sp"></span>
        <div class="lh-seg">${F.map(([k, n]) => `<a data-f="${k}" class="${S.f === k ? "on" : ""}">${n}</a>`).join("")}</div></div>
      ${rows.length ? `<div class="lh-grid">${rows.slice(0, S.nb).map(scard).join("")}</div>${rows.length > S.nb ? `<a class="lh-more" data-nb="1">再看 ${Math.min(20, rows.length - S.nb)} 只（共 ${rows.length} 只）</a>` : ""}` : '<div class="lh-card lh-empty">没有符合条件的票</div>'}`;
    return wrap(`${head(I)}${tabs("")}${one}${actH}${stH}${NOTE(I)}${DISC}`);
  }

  // ---------- 游资排行 ----------
  function rankPage(I, R) {
    const W = R.wlab, list0 = (R.rank[S.win] || []).filter((r) => (S.kind === "yz" ? r.type === "游资" && !r.id.startsWith("y") : true));
    const key = S.sort === "n" ? (r) => r.n : (r) => r.p1;
    const list = list0.slice().sort((a, b) => (key(b) ?? -1e15) - (key(a) ?? -1e15));
    const card = (r, i) => `<div class="lh-card lh-rc" data-go="${H("seat", r.id)}">
      <div class="h"><span class="no">${i + 1}</span>${av(r.name)}<div class="nn"><b>${esc(r.name)}</b><span>${esc(r.seat)}</span></div><span style="flex:none;display:flex;gap:4px">${typ(r.type, r.id.startsWith("y"))}${conf(r.conf)}</span></div>
      <div class="pn"><b class="${updn(r.p1)}">${money(r.p1)}</b><span>${W[S.win]}估算${r.p1 > 0 ? "赚" : r.p1 < 0 ? "亏" : ""}（按买入后第二天卖出算）</span></div>
      ${(r.top || []).length ? `<div class="fq">买得最多：${r.top.map((x) => `<a href="${stockUrl(x[0])}">${esc(x[1])}</a>`).join("")}</div>` : ""}
      <div class="ft">上榜 ${r.n} 次 · 次日赚钱 ${r.w1 == null ? "—" : Math.round(r.w1) + "%"} · 榜上买入 ${money(r.buy, false)}</div></div>`;
    const seg = (k, opts) => `<div class="lh-seg">${opts.map(([v, n]) => `<a data-${k}="${v}" class="${S[k] === v ? "on" : ""}">${n}</a>`).join("")}</div>`;
    const ctl = `<div class="lh-ctl">${seg("win", Object.entries(W))}${seg("sort", [["pnl", "按估算盈亏"], ["n", "按上榜次数"]])}${seg("kind", [["yz", "知名游资"], ["all", "全部（含量化/北向/营业部）"]])}</div>`;
    const win = list.filter((r) => r.p1 > 0).length;
    const sum = list.length ? `${W[S.win]}，${list.length} 个${S.kind === "yz" ? "知名游资" : "游资 / 群组 / 营业部"}里 <b class="up">${win}</b> 个估算赚钱、<b class="dn">${list.filter((r) => r.p1 < 0).length}</b> 个估算亏钱。盈亏按${term("隔日了结", "「买入后第二天卖出」")}估算，单位是人民币（亿 / 万元），只是粗略估算。点卡片看每月盈亏和最近买了什么。` : "";
    return wrap(`${head(I)}${tabs("rank")}${ctl}<div class="lh-meta" style="margin-top:-4px;font-size:13.5px">${sum}</div>
      ${list.length ? `<div class="lh-rk">${list.slice(0, S.n).map(card).join("")}</div>${list.length > S.n ? `<a class="lh-more" data-more="1">再看 ${Math.min(30, list.length - S.n)} 个（共 ${list.length}）</a>` : ""}` : '<div class="lh-card lh-empty">这个时间段没有上榜记录</div>'}
      ${NOTE(I)}${DISC}`);
  }

  // ---------- 合力买入 ----------
  function heliPage(I) {
    const H0 = I.heli || [];
    const today = H0.filter((x) => x.d === I.date);
    const card = (x) => `<div class="lh-card lh-sk2"><div class="hd"><div class="nn"><a href="${stockUrl(x.sym)}">${esc(x.name)}</a><em>${esc(md(x.d))}上榜</em>
        <div class="net">之后第 1 天 <b class="${updn(x.d1)}">${pct(x.d1, 1)}</b> · 到现在 <b class="${updn(x.aft)}">${pct(x.aft, 1)}</b>（相对上榜日收盘）</div></div><span class="ch ${updn(x.chg)}">${pct(x.chg, 2)}</span></div>
      <div class="lh-who">${x.yz.map((z) => `<a class="p b" href="${H("seat", z.id)}">${esc(z.name)} <b>买 ${money(z.net, false)}</b></a>`).join("")}</div></div>`;
    const d1s = H0.filter((x) => x.d1 != null), avg = d1s.length ? d1s.reduce((s, x) => s + x.d1, 0) / d1s.length : null;
    const up = d1s.filter((x) => x.d1 > 0).length;
    const f = (I.follow.groups || []).find((g) => g.id === "heli");
    return wrap(`${head(I)}${tabs("heli")}
      <div class="lh-card lh-one"><h2>什么是合力买入</h2><p>同一天至少 <b>2 个不同的</b>知名游资在同一只票上净买入。最近 20 个交易日共 <b>${H0.length}</b> 次${avg == null ? "" : `，第二天收盘平均 <b class="${updn(avg)}">${pct(avg, 2)}</b>、${up}/${d1s.length} 次上涨`}。</p>
        ${f && f.all["1"] ? `<p style="font-size:14px;color:var(--sub);margin-top:6px">但看到时已经收盘，第二天才买得到：近一年 ${f.n} 次，第二天平均高开 <b class="up">${pct(f.gap, 2)}</b>，开盘买、拿 1 天平均 <b class="${updn(f.all["1"].avg)}">${pct(f.all["1"].avg, 2)}</b>（已扣成本）。详见「<a href="${H("follow")}">跟游资有没有用</a>」。</p>` : ""}</div>
      <div class="lh-sec"><h2>${md(I.date)} 合力买入</h2><em>${today.length} 只</em></div>${today.length ? `<div class="lh-grid">${today.map(card).join("")}</div>` : '<div class="lh-card lh-empty">今天没有 2 个以上知名游资一起买的票</div>'}
      <div class="lh-sec"><h2>最近 20 个交易日</h2><em>涨跌都相对上榜日收盘价，不是你能买到的价格</em></div>
      ${H0.filter((x) => x.d !== I.date).length ? `<div class="lh-grid">${H0.filter((x) => x.d !== I.date).map(card).join("")}</div>` : '<div class="lh-card lh-empty">没有</div>'}${NOTE(I)}${DISC}`);
  }

  // ---------- 跟游资有没有用 ----------
  function followPage(I) {
    const F = I.follow, G = F.groups, base = G.find((g) => g.id === "all"), yz = G.find((g) => g.id === "yz");
    const HS = ["1", "3", "5", "10"];
    const v = (g, k, h) => (g && g[k][h] ? g[k][h].avg : null);
    const y1 = v(yz, "all", "1"), c1 = v(yz, "close", "1"), y10 = v(yz, "all", "10"), b1 = v(base, "all", "1"), b10 = v(base, "all", "10");
    const useless = y1 == null || y1 <= 0.2;
    const vd = `<div class="lh-card lh-vd"><div class="t">${useless ? `跟着买没用：第二天平均高开 <span class="up">${pct(yz.gap, 2)}</span>，把利润吃掉了` : `跟着买略好一点，但很薄：第二天平均高开 ${pct(yz.gap, 2)}`}</div>
      <div class="lh-vs"><div><span>假如能按游资买的那天<b style="font-size:inherit">收盘价</b>买（做不到）<br>拿 1 天</span><b class="${updn(c1)}">${pct(c1, 2)}</b></div>
        <div><span>实际只能<b style="font-size:inherit">第二天开盘</b>买<br>拿 1 天（扣 ${(I.cost * 100).toFixed(1)}% 成本）</span><b class="${updn(y1)}">${pct(y1, 2)}</b></div></div>
      <p>龙虎榜收盘后才公布，等你看到，第二天一开盘价格已经被抬高了。近一年知名游资净买入的票共 ${yz.n} 次，第二天开盘跟进：拿 1 天平均 <b class="${updn(y1)}">${pct(y1, 2)}</b>、胜率 ${yz.all["1"] ? Math.round(yz.all["1"].win) : "—"}%；拿 10 天平均 <b class="${updn(y10)}">${pct(y10, 2)}</b>。随便买一只上榜股是 ${pct(b1, 2)} / ${pct(b10, 2)}——跟游资只是<b>亏得少一点</b>，不是赚钱的办法。</p></div>`;
    const chart = `<div class="lh-sec"><h2>拿 1 / 3 / 5 / 10 天，平均赚多少（%）</h2><em>近一年 · 第二天开盘买、第 N 天收盘卖 · 已扣成本 · 一字涨停买不进的剔除</em></div>
      <div class="lh-card lh-chart"><div class="lg"><span><i style="--c:#1f2328"></i>跟知名游资买</span><span><i style="--c:#b8bec8"></i>随便买一只上榜股</span></div><div class="cv" id="lhfw"></div>
      <div class="say">柱子在 0 线以下＝平均亏钱。拿得越久，两组都亏得越多。</div></div>`;
    const others = G.filter((g) => !["all", "yz"].includes(g.id));
    const gc = (g) => `<div class="lh-card lh-gc"><div class="r1"><b>${esc(g.name)}</b><em>近一年 ${g.n} 次</em></div>
      <div class="r2"><div>第二天高开<b class="${updn(g.gap)}">${pct(g.gap, 2)}</b></div><div>拿 1 天<b class="${updn(v(g, "all", "1"))}">${pct(v(g, "all", "1"), 2)}</b></div><div>拿 5 天<b class="${updn(v(g, "all", "5"))}">${pct(v(g, "all", "5"), 2)}</b></div></div></div>`;
    const sp = F.split;
    const T = (k, title) => `<div style="font-weight:600;margin:12px 0 6px">${title}</div><div class="lh-card lh-tw"><table class="lh-tb"><thead><tr><th class="l">条件</th><th>次数</th><th>高开</th>${HS.map((h) => `<th>拿 ${h} 天</th>`).join("")}</tr></thead><tbody>
      ${G.map((g) => `<tr><td class="l">${esc(g.name)}</td><td>${g.n}</td><td class="${updn(g.gap)}">${pct(g.gap, 2)}</td>${HS.map((h) => { const s = g[k][h]; return s ? `<td><b class="${updn(s.avg)}">${pct(s.avg, 2)}</b><br><span style="font-size:11px;color:var(--sub2)">胜率 ${Math.round(s.win)}%</span></td>` : "<td>—</td>"; }).join("")}</tr>`).join("")}</tbody></table></div>`;
    return wrap(`${head(I)}${tabs("follow")}${vd}${chart}
      <div class="lh-sec"><h2>跟别人买呢？</h2><em>同样的买法（第二天开盘买）</em></div><div class="lh-grid">${others.map(gc).join("")}</div>
      <details class="lh-card lh-fold"><summary><span>完整数据表 <em>前后两半段分开看，结论稳不稳</em></span></summary><div class="bd">
        ${T("all", "近一年")}${T("h1", `前半段 ${sp[0]} ~ ${sp[1]}`)}${T("h2", `后半段 ${sp[2]} ~ ${sp[3]}`)}${T("close", "对照：假如能在上榜日收盘价买（实际做不到）")}
        <p class="lh-note" style="margin-top:10px">${esc(F.note)} 「知名游资」＝对照表里可信度高/中的游资席位（不含量化、北向、拉萨天团）；同一只票同一天只算一次。这是统计平均，不代表每一次；过去的规律未来可能失效。</p></div></details>
      ${NOTE(I)}${DISC}`);
  }

  // ---------- 图 ----------
  const fmtU = (w, unit) => (unit === "亿" ? (Math.abs(w) / 1e4 >= 10 ? (w / 1e4).toFixed(0) : (w / 1e4).toFixed(1)) : Math.round(w).toString()).replace("-", "−");
  function monthSVG(el, M) {   // M: [[YYYY-MM, 万]]
    const w = Math.max(300, el.clientWidth || 600), h = el.clientHeight || 220, pl = 6, pr = 6, pt = 20, pb = 34;
    const mx = Math.max(1, ...M.map((x) => Math.abs(x[1] || 0)));
    const unit = mx >= 10000 ? "亿" : "万";
    let hi = Math.max(0, ...M.map((x) => x[1] || 0)), lo = Math.min(0, ...M.map((x) => x[1] || 0));
    if (hi - lo < 1e-9) hi = 1;
    const nb = lo < 0 ? 16 : 0;   // 负柱下方给数字留位置
    const Y = (v) => pt + (h - pt - pb - nb) * (1 - (v - lo) / (hi - lo));
    const bw = (w - pl - pr) / M.length;
    const bars = M.map((x, i) => {
      const v = x[1] || 0, cx = pl + bw * (i + 0.5), y0 = Y(0), y1 = Y(v), top = Math.min(y0, y1), hh = Math.max(1, Math.abs(y1 - y0));
      const c = v > 0 ? "var(--up)" : v < 0 ? "var(--dn)" : "#c9ced6";
      const lab = `<text x="${cx}" y="${v >= 0 ? top - 5 : top + hh + 12}" text-anchor="middle" style="font-size:${bw < 30 ? 10 : 11}px;font-weight:600;fill:${c}">${bw < 34 ? fmtU(Math.abs(v), unit) : (v > 0 ? "+" : "") + fmtU(v, unit)}</text>`;
      const mo = +x[0].slice(5), yr = x[0].slice(2, 4);
      const xl = `<text x="${cx}" y="${h - 18}" text-anchor="middle">${mo}月</text>${i === 0 || mo === 1 ? `<text x="${cx}" y="${h - 4}" text-anchor="middle" style="font-size:10px;fill:var(--sub2)">${yr}年</text>` : ""}`;
      return `<rect x="${cx - bw * 0.32}" y="${top}" width="${bw * 0.64}" height="${hh}" rx="2" fill="${c}"/>${lab}${xl}`;
    }).join("");
    el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="${pl}" x2="${w - pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa1ab"/>${bars}</svg>`;
    return unit;
  }
  function groupSVG(el, cats, series) {
    const w = Math.max(300, el.clientWidth || 600), h = el.clientHeight || 220, pl = 6, pr = 6, pt = 22, pb = 26;
    const all = series.flatMap((s) => s.v.filter((x) => x != null));
    let hi = Math.max(0, ...all), lo = Math.min(0, ...all);
    if (hi - lo < 0.5) hi = lo + 0.5;
    const nb = lo < 0 ? 18 : 0;
    const Y = (v) => pt + (h - pt - pb - nb) * (1 - (v - lo) / (hi - lo));
    const gw = (w - pl - pr) / cats.length, bw = Math.min(46, gw * 0.38), nar = bw < 40;
    const out = cats.map((c, i) => {
      const gx = pl + gw * (i + 0.5);
      return series.map((s, k) => {
        const v = s.v[i]; if (v == null) return "";
        const x = gx + (k - series.length / 2) * (bw + 3) + 1.5, y0 = Y(0), y1 = Y(v), top = Math.min(y0, y1), hh = Math.max(1, Math.abs(y1 - y0));
        return `<rect x="${x}" y="${top}" width="${bw}" height="${hh}" rx="3" fill="${s.c}"/><text x="${x + bw / 2}" y="${v >= 0 ? top - 5 : top + hh + 13}" text-anchor="middle" style="font-size:${nar ? 10 : 11}px;font-weight:700;fill:${v > 0 ? "var(--up)" : v < 0 ? "var(--dn)" : "var(--sub)"}">${(nar ? pct(v, 2).replace("%", "") : pct(v, 2)).replace("-", "−")}</text>`;
      }).join("") + `<text x="${gx}" y="${h - 6}" text-anchor="middle" style="font-size:12px;fill:var(--text)">${c}</text>`;
    }).join("");
    el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="${pl}" x2="${w - pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa1ab"/>${out}</svg>`;
  }
  function lineSVG(el, xs, vs) {
    const w = Math.max(300, el.clientWidth || 600), h = el.clientHeight || 200, pl = 50, pr = 10, pt = 10, pb = 22;
    const ok = vs.filter((v) => v != null);
    if (!ok.length) { el.innerHTML = '<div class="lh-empty">暂无曲线</div>'; return; }
    let lo = Math.min(0, ...ok), hi = Math.max(0, ...ok);
    if (hi - lo < 1) hi = lo + 1;
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = (i) => pl + (w - pl - pr) * (xs.length > 1 ? i / (xs.length - 1) : 0.5), Y = (v) => pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo));
    const ticks = [lo + pad, hi - pad];
    const xt = [0, Math.floor(xs.length / 2), xs.length - 1];
    const path = vs.map((y, i) => (y == null ? "" : `${i && vs[i - 1] != null ? "L" : "M"}${X(i).toFixed(1)},${Y(y).toFixed(1)}`)).join("");
    const last = vs[vs.length - 1];
    el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${ticks.map((t) => `<line x1="${pl}" x2="${w - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="#eef0f3"/><text x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${money(t)}</text>`).join("")}
      <line x1="${pl}" x2="${w - pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa1ab" stroke-dasharray="4 3"/><text x="${pl - 6}" y="${Y(0) + 4}" text-anchor="end">0</text>
      ${xt.map((i) => `<text x="${X(i)}" y="${h - 5}" text-anchor="${i === 0 ? "start" : i === xs.length - 1 ? "end" : "middle"}">${esc(xs[i])}</text>`).join("")}
      <path d="${path}" fill="none" stroke="${last >= 0 ? "var(--up)" : "var(--dn)"}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  // ---------- 详情 ----------
  function seatPage(I, P) {
    const wkey = P.m[S.win] ? S.win : "y1", M = P.m[wkey], W = I.wlab;
    const p1 = M.p1;
    const hero = `<div class="lh-card lh-hero"><div class="h1">${av(P.name, 1)}<div class="nn"><h1>${esc(P.name)} ${typ(P.type, P.id.startsWith("y"))}${conf(P.conf)}</h1>${P.alias.length ? `<div class="al">又名 ${esc(P.alias.join("、"))}</div>` : ""}</div></div>
      ${P.style ? `<div class="sty">${esc(P.style)}</div>` : ""}
      <div class="lh-ctl" style="margin-bottom:8px"><div class="lh-seg">${Object.entries(W).filter(([k]) => P.m[k]).map(([k, n]) => `<a data-win="${k}" class="${wkey === k ? "on" : ""}">${n}</a>`).join("")}</div></div>
      <div class="big"><span class="v ${updn(p1)}">${money(p1)}</span><span class="l">${W[wkey]}估算${p1 > 0 ? "赚" : p1 < 0 ? "亏" : ""} · 按${term("隔日了结", "「买入后第二天卖出」")}估算</span></div>
      <div class="sm">上榜 <b>${M.n}</b> 次 · 买过 <b>${M.nstk}</b> 只票 · 净买入 <b>${M.nb}</b> 次，其中第二天收盘赚钱的占 <b>${M.w1 == null ? "—" : Math.round(M.w1) + "%"}</b> · 榜上一共买入 <b>${money(M.buy, false)}</b>、卖出 <b>${money(M.sell, false)}</b></div></div>`;
    // 每月
    const mon = P.mon || [];
    let monH = "";
    if (mon.length) {
      const pos = mon.filter((x) => x[1] > 0), neg = mon.filter((x) => x[1] < 0);
      const best = pos.slice().sort((a, b) => b[1] - a[1])[0], worst = neg.slice().sort((a, b) => a[1] - b[1])[0];
      const ml = (x) => `${x[0].slice(0, 4)}年${+x[0].slice(5)}月`;
      const say = `${mon.length} 个月里 <b class="up">${pos.length}</b> 个月估算赚钱${neg.length ? `、<b class="dn">${neg.length}</b> 个月亏钱` : "，没有亏钱的月份"}${best ? `；最赚 ${ml(best)} <b class="up">${money(best[1])}</b>` : ""}${worst ? `，最亏 ${ml(worst)} <b class="dn">${money(worst[1])}</b>` : ""}。`;
      monH = `<div class="lh-sec"><h2 id="lhmt">每月估算盈亏</h2><em id="lhmu">近一年 · 红柱＝赚、绿柱＝亏 · 第一个月和本月都不是整月</em></div>
        <div class="lh-card lh-chart"><div class="cv" id="lhmon"></div><div class="say">${say}</div><div class="lg" style="padding-top:2px"><span><i style="--c:var(--up)"></i>赚</span><span><i style="--c:var(--dn)"></i>亏</span><span>柱上数字＝当月估算盈亏</span></div></div>
        <details class="lh-card lh-fold" id="lhcvf"><summary><span>累计曲线 <em>把每天的估算盈亏累加起来</em></span></summary><div class="bd"><div class="lh-chart" style="padding:0"><div class="cv" id="lhcv" style="height:200px"></div></div></div></details>`;
    }
    // 最近买了什么
    const ops = P.ops || [];
    const days = [...new Set(ops.map((o) => o.d))];
    const opChip = (o) => chip(o.sym, o.name, o.net >= 0 ? "b" : "s", o.net, o.d3 == null ? `当天 ${pc(o.chg)}` : `3天后 ${pc(o.d3)}`);
    const dayRow = (xs, d) => (xs.length ? `<div class="lh-row" style="margin-top:6px"><span class="lb ${d}"><i></i>${d === "b" ? "买入" : "卖出"}</span><div class="xs">${xs.map(opChip).join("")}</div></div>` : "");
    const opsH = `<div class="lh-sec"><h2>最近买了什么</h2><em>最近 ${days.length} 个上榜日 · 金额是当天净额 · 「3天后」＝之后 3 个交易日涨跌（相对当天收盘），还没满 3 天的显示当天涨跌</em></div>
      <div class="lh-card">${days.slice(0, S.days).map((d) => { const xs = ops.filter((o) => o.d === d); return `<div class="lh-day"><div class="dt">${md(d)} 周${wk(d)}<em>买 ${xs.filter((o) => o.net > 0).length} 只 · 卖 ${xs.filter((o) => o.net < 0).length} 只</em></div>${dayRow(xs.filter((o) => o.net >= 0), "b")}${dayRow(xs.filter((o) => o.net < 0), "s")}</div>`; }).join("") || '<div class="lh-empty">近一年没有上榜记录</div>'}</div>
      ${days.length > S.days ? `<a class="lh-more" data-days="1">再看更早的 ${days.length - S.days} 天</a>` : ""}`;
    // 最常买
    const tb = P.topbuy || [];
    const tmx = Math.max(1, ...tb.map((x) => x[3] || 0));
    const topH = tb.length ? `<div class="lh-sec"><h2>买得最多的票</h2><em>近一年 · 条越长＝榜上买入金额越大</em></div>
      <div class="lh-card lh-bars">${tb.map((x) => `<div class="lh-bar"><a href="${stockUrl(x[0])}">${esc(x[1])}</a><div class="tr"><i style="width:${Math.max(2, (x[3] / tmx) * 62)}%"></i><span><b>${money(x[3], false)}</b> · 买 ${x[2]} 次</span></div></div>`).join("")}</div>` : "";
    // 最赚 / 最亏
    const li = (x) => `<a class="lh-li" href="${stockUrl(x.sym)}"><div class="n"><b>${esc(x.name)}</b><em>买过 ${x.nb} 次</em></div><div class="v ${updn(x.p1)}">${money(x.p1)}</div></a>`;
    const bw = `<div class="lh-sec"><h2>最赚 / 最亏的 5 只</h2><em>近一年 · 同样按「买入后第二天卖出」估算</em></div>
      <div class="lh-two"><div class="lh-card"><h3>最赚</h3>${(P.best1 || []).map(li).join("") || '<div class="lh-empty">没有</div>'}</div><div class="lh-card"><h3>最亏</h3>${(P.worst1 || []).map(li).join("") || '<div class="lh-empty">没有</div>'}</div></div>`;
    // 可能还拿着
    const holds = P.holds || [];
    const hc = (x) => `<a class="lh-card lh-hc" href="${stockUrl(x.sym)}"><div class="r1"><b>${esc(x.name)}</b><span class="p ${updn(x.pct)}">${pct(x.pct, 1)}</span></div>
      <div class="r2">${md(x.d)}买入约 ${money(x.amt, false)} · 买入价 ${(+x.cost).toFixed(2)} → 现价 ${(+x.last).toFixed(2)}</div></a>`;
    const holdH = `<div class="lh-sec"><h2>可能还拿着的票</h2><em>只是推测：近 20 个交易日榜上买了、之后榜上没看到卖（榜外卖了看不到）</em></div>
      ${holds.length ? `<div class="lh-hold">${holds.slice(0, 5).map(hc).join("")}</div>${holds.length > 5 ? `<details class="lh-card lh-fold"><summary><span>其余 ${holds.length - 5} 只</span></summary><div class="bd"><div class="lh-hold">${holds.slice(5).map(hc).join("")}</div></div></details>` : ""}` : '<div class="lh-card lh-empty">近 20 个交易日没有榜上买了、之后没在榜上卖的票</div>'}`;
    // 另一种算法
    const alt = `<details class="lh-card lh-fold"><summary><span>另一种算法为什么差这么多？ <em>榜上配对 + 最新价：${money(M.pnl)}</em></span></summary><div class="bd">
      <div class="lh-kv"><div><span>榜上配对 + 最新价</span><b class="${updn(M.pnl)}">${money(M.pnl)}</b></div><div><span>其中已卖掉的</span><b class="${updn(M.real)}">${money(M.real)}</b></div><div><span>其中按现价算的</span><b class="${updn(M.flo)}">${money(M.flo)}</b></div></div>
      <p style="margin:0">这种算法把每次榜上买入和之后<b>榜上</b>的卖出配对；没在榜上看到卖出的，就当一直拿到今天、按最新价算。可游资多数第二天就卖，而卖的那天股票往往不再上榜，<b>我们看不到这笔卖出</b>——于是很多早就卖掉的票被当成一直拿着，龙虎榜上的票事后又多半回落，就会算出很大的「亏损」。所以页面主数字用「买入后第二天卖出」估算，这个数只做参考。</p></div></details>`;
    const src = I.src || {};
    const seats = `<details class="lh-card lh-fold"><summary><span>用的${term("营业部")} <em>${P.seats.length} 家 · 来源与可信度</em></span></summary><div class="bd">${P.seats.map((s) => `<div class="lh-seat ${s.in ? "" : "off"}">
      <div class="r1"><b>${esc(s.short)}</b>${conf(s.conf)}${s.in ? "" : '<span class="lh-tag">不计入统计</span>'}<span style="margin-left:auto;font-size:12.5px;color:var(--sub)">近一年上榜 ${s.n} 次</span></div>
      <div class="r2">${esc(s.name)}${s.note ? ` · ${esc(s.note)}` : ""}${s.src && s.src.length ? `<br>来源：${s.src.map((k) => (src[k] ? `<a href="${esc(src[k][1])}" target="_blank" rel="noopener noreferrer">${esc(src[k][0].replace(/《.*$/, "").slice(0, 14) || k)}</a>` : esc(k))).join("、")}` : ""}
        ${s.em ? `<br>东财统计（近一年买入后）：次日平均 ${pct(s.em.d1, 2)}、3 日 ${pct(s.em.d3, 2)}、5 日 ${pct(s.em.d5, 2)}，次日上涨概率 ${s.em.u1 == null ? "—" : Math.round(s.em.u1) + "%"}` : ""}</div></div>`).join("")}</div></details>`;
    return wrap(`<div class="lh-crumb"><a href="${H()}">龙虎榜</a><i>›</i><a href="${H("rank")}">游资排行</a><i>›</i><b>${esc(P.name)}</b></div>${hero}${monH}${opsH}${topH}${bw}${holdH}
      <div class="lh-sec"><h2>更多</h2></div>${alt}${seats}${NOTE(I)}
      <div class="lh-meta" style="margin-top:14px">数据日期 ${esc(P.date)}</div>${DISC}`);
  }

  // ---------- 术语气泡 ----------
  let tip = null;
  function showTip(el) {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "lh-tip";
      document.body.appendChild(tip);
      document.addEventListener("click", () => (tip.style.display = "none"));
      window.addEventListener("scroll", () => (tip.style.display = "none"), { passive: true });
      window.addEventListener("hashchange", () => (tip.style.display = "none"));
    }
    const k = el.dataset.term;
    tip.innerHTML = `<b>${esc(k)}</b>${esc(TERMS[k] || "")}`;
    const vw = document.documentElement.clientWidth, wd = Math.min(300, vw - 24);
    tip.style.width = wd + "px";
    tip.style.display = "block";
    const r = el.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(12, r.left + r.width / 2 - wd / 2), vw - wd - 12) + "px";
    const th = tip.offsetHeight;
    tip.style.top = (r.bottom + 8 + th > window.innerHeight ? Math.max(8, r.top - th - 8) : r.bottom + 8) + "px";
  }

  // ---------- 入口 ----------
  async function page(a, b) {
    const tok = A.tok();
    const sub = a || "";
    document.title = "龙虎榜 · 小七投研";
    app.innerHTML = SK();
    let I, R, P;
    try {
      [I, R, P] = await Promise.all([idx(), sub === "rank" ? rnk() : null, sub === "seat" && b ? getJSON(`lhb/seat_${encodeURIComponent(b)}.json`, true) : null]);
    } catch (e) {
      if (A.alive(tok)) app.innerHTML = wrap(`<h1>龙虎榜</h1>${sub === "seat" ? `<div class="card">没找到这个游资 / 营业部（可能已不在近一年上榜名单里），<a href="${H("rank")}">回游资排行 ›</a></div>` : FAIL()}`);
      return;
    }
    if (!A.alive(tok)) return;
    const draw = () => {
      if (sub === "seat" && P) {
        const el = document.getElementById("lhmon");
        if (el) { const u = monthSVG(el, P.mon); const m = document.getElementById("lhmu"); if (m) m.textContent = "近一年 · 红柱＝赚、绿柱＝亏 · 第一个月和本月都不是整月"; const t = document.getElementById("lhmt"); if (t) t.textContent = `每月估算盈亏（单位：${u}元）`; }
        const cf = document.getElementById("lhcvf"), cv = document.getElementById("lhcv");
        if (cf && cv && cf.open) lineSVG(cv, P.curve.map((x) => x[0].slice(2)), P.curve.map((x) => x[2]));
        if (cf) cf.ontoggle = () => { if (cf.open) lineSVG(cv, P.curve.map((x) => x[0].slice(2)), P.curve.map((x) => x[2])); };
      }
      if (sub === "follow") {
        const el = document.getElementById("lhfw"), G = I.follow.groups, yz = G.find((g) => g.id === "yz"), base = G.find((g) => g.id === "all");
        const HS = ["1", "3", "5", "10"];
        if (el) groupSVG(el, HS.map((h) => `拿 ${h} 天`), [{ c: "#1f2328", v: HS.map((h) => (yz.all[h] ? yz.all[h].avg : null)) }, { c: "#b8bec8", v: HS.map((h) => (base.all[h] ? base.all[h].avg : null)) }]);
      }
    };
    function render() {
      const y = window.scrollY;
      if (sub === "rank") { app.innerHTML = rankPage(I, R); document.title = "游资排行 · 龙虎榜"; }
      else if (sub === "heli") { app.innerHTML = heliPage(I); document.title = "合力买入 · 龙虎榜"; }
      else if (sub === "follow") { app.innerHTML = followPage(I); document.title = "跟游资有没有用 · 龙虎榜"; }
      else if (sub === "seat" && P) { app.innerHTML = seatPage(I, P); document.title = P.name + " · 龙虎榜"; }
      else { app.innerHTML = todayPage(I); document.title = "龙虎榜 · 小七投研"; }
      draw();
      app.querySelectorAll("[data-win],[data-sort],[data-kind],[data-f]").forEach((x) => (x.onclick = () => {
        for (const k of ["win", "sort", "kind", "f"]) if (x.dataset[k]) S[k] = x.dataset[k];
        S.n = 30; S.nb = 12; save(); render();
      }));
      app.querySelectorAll("[data-more]").forEach((x) => (x.onclick = () => { S.n += 30; render(); }));
      app.querySelectorAll("[data-nb]").forEach((x) => (x.onclick = () => { S.nb += 20; render(); }));
      app.querySelectorAll("[data-days]").forEach((x) => (x.onclick = () => { S.days = 99; render(); }));
      app.querySelectorAll("[data-go]").forEach((x) => (x.onclick = (e) => { if (!e.target.closest("a,[data-term]")) location.hash = x.dataset.go; }));
      app.querySelectorAll("[data-term]").forEach((x) => {
        x.onclick = (e) => { e.preventDefault(); e.stopPropagation(); showTip(x); };
        x.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showTip(x); } };
      });
      if (render.done) { const p = app.querySelector(".lh"); if (p) p.style.animation = "none"; window.scrollTo(0, y); }
      render.done = true;
    }
    S.n = 30; S.nb = 12; S.days = 8;
    render();
    if (sub === "seat" || sub === "follow") {
      let rt = 0, lw = window.innerWidth;
      const onR = () => { clearTimeout(rt); rt = setTimeout(() => { if (!A.alive(tok)) return window.removeEventListener("resize", onR); if (window.innerWidth !== lw) { lw = window.innerWidth; draw(); } }, 200); };
      window.addEventListener("resize", onR);
    }
  }
  window.__mod_lhb = { page };
})();
