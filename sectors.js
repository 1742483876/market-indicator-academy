/* 板块看板 #/sectors（按需加载）。u6（2026-11-19 晚）改成像 App 一样一级级点进新页面，不再在卡片里折叠展开：
   第 1 级 #/sectors[/us]           板块热力格子（按分区分组）；另一个 Tab #/sectors/<mkt>/rank＝赛道排行
   第 2 级 #/sectors/<mkt>/<etf>     板块页：英雄区 + ETF 走势 + 赛道卡片 + 前十大重仓
   第 3 级 #/sectors/<mkt>/<etf>/<赛道>  赛道页：英雄区 + 赛道走势 + 全部成分股（电脑表格 / 手机卡片）
   数据：总览 sector_board.json；板块页和赛道成分 sectors/<mkt>_<etf>.json（sector_board.py 每天生成，按需加载）。
   A股分区来自 sector_zones（已回测）；美股强/中性/弱只是趋势描述（未回测）；赛道 领涨/跟随/落后 只是描述（未回测）。 */
(function () {
  const A = window.__APP;
  const { app, esc, pct, updn, FAIL, DISC, getJSON } = A;
  if (!document.getElementById("sb-css")) {   // 样式随模块下发（style.css 有版本号缓存，--reports-only 不刷新）
    const st = document.createElement("style");
    st.id = "sb-css";
    st.textContent = `
.sb-page{animation:sbIn .14s ease-out both}
@keyframes sbIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.sb-page{animation:none}}
.sb-page{font-variant-numeric:tabular-nums}
.sb-crumb{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--sub);margin:0 0 12px;white-space:nowrap;overflow-x:auto;scrollbar-width:none}
.sb-crumb::-webkit-scrollbar{display:none}
.sb-crumb a{color:var(--sub);padding:2px 0}.sb-crumb a:hover{color:var(--text)}
.sb-crumb i{font-style:normal;color:var(--sub2)}.sb-crumb b{color:var(--text);font-weight:600}
.sb-top{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;margin:4px 0 2px}
.sb-top h1{margin:0;flex:1 1 auto;min-width:0}
.sb-seg{display:inline-flex;background:#eceef2;border-radius:10px;padding:3px;gap:2px;flex:none}
.sb-seg a{padding:4px 14px;border-radius:8px;font-size:13.5px;color:var(--sub);font-weight:600;line-height:1.5}
.sb-seg a.on{background:var(--card);color:var(--text);box-shadow:0 1px 2px rgba(16,24,40,.1)}
.sb-meta{font-size:12.5px;color:var(--sub);margin:6px 0 14px;line-height:1.6}
.sb-tabs{display:flex;gap:24px;border-bottom:1px solid var(--line);margin:0 0 16px}
.sb-tabs a{padding:6px 0 9px;font-size:15px;color:var(--sub);font-weight:600;border-bottom:2px solid transparent;margin-bottom:-1px}
.sb-tabs a.on{color:var(--text);border-color:var(--text)}
.sb-tabs a em{font-style:normal;font-weight:400;font-size:12px;color:var(--sub2);margin-left:4px}
.sb-brief{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--sub);margin:0 0 12px}
.sb-brief span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.sb-brief i,.sb-zh i,.sb-broad i{display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--zc);flex:none}
.sb-brief b{color:var(--text);font-weight:600}
.sb-broad{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 0 22px;padding:2px 1px 4px}
.sb-broad::-webkit-scrollbar{display:none}
.sb-broad .lb{flex:none;align-self:center;font-size:12px;color:var(--sub2);margin-right:2px}
.sb-broad a{flex:none;display:flex;align-items:center;gap:7px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 12px 4px 10px;font-size:13px;color:var(--text);box-shadow:var(--sh);white-space:nowrap}
.sb-broad a em{font-style:normal;font-size:11.5px;color:var(--sub)}
.sb-zones{--cols:6;display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:22px 12px}
.sb-zone{grid-column:1/-1;min-width:0}
.sb-zh{display:flex;align-items:center;gap:7px;margin:0 0 9px;font-size:14px;white-space:nowrap;overflow:hidden}
.sb-zh b{font-weight:600}.sb-zh span{color:var(--sub2);font-size:13px}
.sb-heat{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:12px}
.sb-tile{position:relative;display:flex;flex-direction:column;aspect-ratio:1.32/1;border-radius:var(--r);padding:12px 13px 10px;background:var(--tb);color:var(--tt);box-shadow:var(--sh);transition:transform .15s,box-shadow .15s;overflow:hidden;min-width:0}
.sb-tile:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(16,24,40,.13)}
.sb-tile:active{transform:scale(.98)}
.sb-tile .tn{font-size:17px;font-weight:700;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-tile .ts{font-size:11.5px;font-weight:600;opacity:.8;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-tile .tp{font-size:23px;font-weight:700;line-height:1.1;margin-top:auto;letter-spacing:-.3px}
.sb-tile .tf{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px;margin-top:5px;white-space:nowrap}
.sb-tile .tf>span{opacity:.88;overflow:hidden;text-overflow:ellipsis}
.sb-tile .tl{flex:none;font-style:normal;font-size:11px;font-weight:700;padding:0 6px;border-radius:6px;background:rgba(255,255,255,.24);line-height:18px}
.sb-tile.lt .tl{background:rgba(31,35,40,.07)}
.sb-tile.dk .up,.sb-tile.dk .dn{color:inherit}
.sb-tile.lt .tp.up,.sb-tile.lt .tf .up{color:var(--up-t)}.sb-tile.lt .tp.dn,.sb-tile.lt .tf .dn{color:var(--dn-t)}
@media (min-width:1100px){.sb-zone.n1{grid-column:span 1;--cols:1}.sb-zone.n2{grid-column:span 2;--cols:2}.sb-zone.n3{grid-column:span 3;--cols:3}.sb-zone.n4{grid-column:span 4;--cols:4}.sb-zone.n5{grid-column:span 5;--cols:5}}
@media (max-width:1099px){.sb-zones{--cols:4}}
@media (min-width:761px) and (max-width:1099px){.sb-zone.n1{grid-column:span 1;--cols:1}.sb-zone.n2{grid-column:span 2;--cols:2}.sb-zone.n3{grid-column:span 3;--cols:3}}
@media (max-width:760px){.sb-zones{--cols:3;gap:18px 8px}.sb-zone.n1{grid-column:span 1;--cols:1}.sb-zone.n2{grid-column:span 2;--cols:2}
  .sb-heat{gap:8px}.sb-tile{aspect-ratio:1.12/1;padding:9px 9px 8px;border-radius:10px}.sb-tile .tn{font-size:15px}.sb-tile .ts{font-size:10.5px}
  .sb-tile .tp{font-size:18px}.sb-tile .tf{font-size:11px;margin-top:3px}.sb-tile .tl{position:absolute;top:8px;right:8px;font-size:10px;min-width:17px;text-align:center;padding:0 4px;line-height:17px;border-radius:9px}.sb-tile .tl span{display:none}.sb-tile .tl.z{opacity:.55}.sb-tile .tn{padding-right:20px}
  .sb-zh{font-size:13px;margin-bottom:7px}.sb-tabs{gap:20px;margin-bottom:12px}.sb-meta{font-size:11.5px;margin:4px 0 10px}.sb-brief{font-size:12.5px;gap:4px 12px}
  .sb-broad{margin:0 -12px 16px;padding:2px 12px 4px}}
/* 赛道排行 */
.sb-sorts{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.sb-sorts .lb{font-size:12.5px;color:var(--sub);margin-right:2px}
.sb-sorts a{font-size:13px;padding:3px 12px;border-radius:999px;color:var(--sub);background:var(--card);border:1px solid var(--line);white-space:nowrap}
.sb-sorts a.on{background:var(--text);border-color:var(--text);color:#fff}
.sb-sorts .sp{flex:1}
.sb-list{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);overflow:hidden}
.sb-lh,.sb-lr{display:grid;grid-template-columns:34px minmax(0,1fr) 78px 78px 86px 96px 120px;align-items:center;gap:0 10px;padding:0 18px 0 0}
.sb-lh{font-size:12px;color:var(--sub);padding-top:9px;padding-bottom:9px;border-bottom:1px solid var(--line);background:var(--soft)}
.sb-lh span,.sb-lr .v{text-align:right}.sb-lh span:nth-child(2){text-align:left}
.sb-lr{position:relative;min-height:58px;color:var(--text);border-bottom:1px solid var(--line);transition:background .12s}
.sb-lr:last-child{border-bottom:0}.sb-lr:hover{background:#fafbfc}
.sb-lr::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--lc)}
.sb-lr .rk{text-align:center;font-size:12px;color:var(--sub2)}
.sb-lr .nm{min-width:0;padding:8px 0}
.sb-lr .nm b{display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden}
.sb-lr .nm small{display:block;font-size:12px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.5}
.sb-lr .v{font-size:14px;white-space:nowrap}.sb-lr .v.bd{font-weight:700;font-size:15px}
.sb-lr .v.br{display:flex;align-items:center;gap:6px;justify-content:flex-end;font-size:12.5px;color:var(--sub)}
.sb-tag{display:inline-block;flex:none;font-size:11px;font-style:normal;font-weight:600;line-height:18px;padding:0 6px;border-radius:6px}
.sb-tag.lead{background:var(--up-bg);color:var(--up-t)}.sb-tag.lag{background:var(--dn-bg);color:var(--dn-t)}.sb-tag.mid{background:#f1f2f4;color:#6b7280}
.sb-pg{display:inline-block;width:56px;height:6px;border-radius:3px;background:#edf0f3;overflow:hidden;vertical-align:middle;flex:none}
.sb-pg i{display:block;height:100%;border-radius:3px;background:var(--pc,#9aa1ab)}
@media (max-width:760px){.sb-lh,.sb-lr{grid-template-columns:minmax(0,1fr) 64px 60px;padding:0 12px 0 14px}.sb-lr{min-height:56px}.sb-lh{padding-top:7px;padding-bottom:7px}
  .sb-lr .rk,.sb-lr .dk,.sb-lr .v.dk,.sb-lh .dk{display:none}.sb-lr .v{font-size:13.5px}.sb-lr .nm b{font-size:14px}}
/* 英雄区 */
.sb-hero{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);padding:18px 20px 16px;margin:0 0 14px}
.sb-h1{display:flex;align-items:flex-start;gap:12px 20px;flex-wrap:wrap}
.sb-h1 .nm{flex:1 1 220px;min-width:0}
.sb-h1 h1{margin:0;font-size:26px;line-height:1.25}
.sb-h1 .cd{font-size:13px;color:var(--sub);margin-top:3px;line-height:1.6}
.sb-h1 .cd a{color:var(--text);font-weight:600}.sb-h1 .cd>span{white-space:nowrap}
.sb-h1 .px{text-align:right;flex:none}
.sb-h1 .px b{display:block;font-size:30px;font-weight:700;line-height:1.15;letter-spacing:-.4px}
.sb-pill{display:inline-block;font-size:13px;font-weight:700;padding:1px 10px;border-radius:999px;margin-top:4px;background:#f1f2f4;color:#4b5563}
.sb-pill.up{background:var(--up-bg);color:var(--up-t)}.sb-pill.dn{background:var(--dn-bg);color:var(--dn-t)}
.sb-kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0 0}
.sb-kv.k5{grid-template-columns:repeat(5,minmax(0,1fr))}
.sb-kv>div{background:var(--soft);border-radius:10px;padding:9px 12px;min-width:0}
.sb-kv span{display:block;font-size:12px;color:var(--sub);white-space:nowrap}
.sb-kv b{display:block;font-size:18px;font-weight:700;line-height:1.35;white-space:nowrap}
.sb-kv .sb-pg{width:100%;height:5px;margin-top:5px;display:block}
.sb-zbar{display:flex;align-items:center;gap:10px;margin:14px 0 0;padding:10px 12px;border-radius:10px;background:var(--zb);color:var(--zt);font-size:13.5px;line-height:1.55}
.sb-zbar .zl{flex:none;font-weight:700;font-size:13px;padding:1px 9px;border-radius:6px;background:var(--zc);color:#fff}
.sb-zbar.lt .zl{color:var(--zt);background:rgba(31,35,40,.08)}
.sb-zbar span:last-child{min-width:0}
.sb-zp{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
.sb-zp span{font-size:12.5px;color:var(--sub);background:var(--soft);border-radius:999px;padding:3px 11px;white-space:nowrap}
.sb-zp b{color:var(--text);font-weight:600;margin-left:4px}.sb-zp .st b{color:var(--dn-t)}.sb-zp .tg b{color:var(--up-t)}
.sb-rings{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.sb-ring{display:flex;align-items:center;gap:8px}
.sb-ring svg{width:46px;height:46px;flex:none}
.sb-ring .bg{fill:none;stroke:#edf0f3;stroke-width:3.6}.sb-ring .fg{fill:none;stroke:var(--rc);stroke-width:3.6;stroke-linecap:round}
.sb-ring text{font-size:9.5px;font-weight:700;fill:var(--text);text-anchor:middle;dominant-baseline:central}
.sb-ring span{font-size:12.5px;color:var(--sub);line-height:1.4}.sb-ring span b{display:block;color:var(--text);font-size:13px}
.sb-h3x{display:flex;gap:14px 28px;flex-wrap:wrap;align-items:center;margin-top:14px}
/* 区块 */
.sb-sec{margin:26px 0 12px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.sb-sec h2{margin:0;font-size:18px}
.sb-sec em{font-style:normal;font-size:12.5px;color:var(--sub)}
.sb-sec .sb-sorts{margin:0 0 0 auto}
.sb-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh)}
.sb-chart{padding:12px 14px 8px;position:relative}
.sb-chart .lg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--sub);margin:0 0 4px}
.sb-chart .lg i{display:inline-block;width:14px;height:2px;border-radius:1px;background:var(--c);vertical-align:middle;margin-right:5px}
.sb-chart .lg i.ds{background:repeating-linear-gradient(90deg,var(--c) 0 4px,transparent 4px 7px)}
.sb-chart svg{display:block;width:100%}
.sb-chart .ax{font-size:10.5px;fill:var(--sub2)}
.sb-chart .tip{position:absolute;pointer-events:none;background:rgba(31,35,40,.92);color:#fff;font-size:12px;line-height:1.5;padding:5px 9px;border-radius:8px;white-space:nowrap;display:none;z-index:2}
.sb-subs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.sb-sc{display:block;background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);padding:14px 16px 13px;color:var(--text);position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s}
.sb-sc::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--lc)}
.sb-sc:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(16,24,40,.09)}
.sb-sc .r1{display:flex;align-items:center;gap:8px}
.sb-sc .r1 b{font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.sb-sc .r1 .big{margin-left:auto;font-size:21px;font-weight:700;white-space:nowrap}
.sb-sc .r2{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:12.5px;color:var(--sub);margin-top:2px}
.sb-sc .r2 b{font-weight:600}.sb-sc .r2 .bx{margin-left:auto}
.sb-sc .r3{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sub);margin-top:10px}
.sb-sc .r3 .sb-pg{flex:1;width:auto}.sb-sc .r3 b{color:var(--text);font-weight:600;min-width:34px;text-align:right}
.sb-sc .r4{font-size:12.5px;color:var(--sub);margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-sc .r4 span{color:var(--text)}.sb-sc .r4 em{font-style:normal;margin-left:3px}
.sb-hold{padding:4px 0}
.sb-hr{display:grid;grid-template-columns:minmax(0,1fr) 170px 76px 86px;align-items:center;gap:0 14px;padding:10px 18px;color:var(--text);border-bottom:1px solid var(--line)}
.sb-hr:last-child{border-bottom:0}.sb-hr:hover{background:#fafbfc}
.sb-hr .nm{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;font-size:14px}
.sb-hr .nm em{font-style:normal;font-weight:400;font-size:12px;color:var(--sub2);margin-left:6px}
.sb-hr .wb{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--sub)}
.sb-hr .wb .sb-pg{flex:1;width:auto;--pc:#c5cbd3}
.sb-hr .v{text-align:right;font-size:14px;white-space:nowrap}.sb-hr .v small{font-size:11px;color:var(--sub2);margin-right:4px}
.sb-m{display:inline-block;font-size:10.5px;font-style:normal;line-height:16px;padding:0 5px;border-radius:5px;margin-left:5px;vertical-align:1px;font-weight:600;white-space:nowrap}
.sb-m.b{background:var(--up-bg);color:var(--up-t)}.sb-m.s{background:var(--dn-bg);color:var(--dn-t)}
.sb-m.nb{box-shadow:inset 0 0 0 1px #f3b4b4;color:var(--up-t)}.sb-m.ns{box-shadow:inset 0 0 0 1px #9fd8b3;color:var(--dn-t)}
.sb-m.v{background:#e8f1fc;color:#1d64b8}.sb-m.e{background:#f1f2f4;color:#4b5563}
.sb-foot{font-size:12px;color:var(--sub2);line-height:1.75;margin:22px 0 0}
.sb-foot p{margin:0 0 4px}
/* 第 3 级：成分表 */
.sb-tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
.sb-tb{width:100%;border-collapse:collapse;font-size:13.5px;white-space:nowrap}
.sb-tb th{position:sticky;top:0;background:var(--soft);font-size:12px;font-weight:600;color:#4b5563;text-align:right;padding:9px 10px;border-bottom:1px solid var(--line);cursor:pointer;user-select:none}
.sb-tb th.l,.sb-tb td.l{text-align:left}
.sb-tb th:hover{color:var(--text)}.sb-tb th.on{color:var(--text)}
.sb-tb th.on::after{content:"↓";margin-left:3px;font-size:11px}.sb-tb th.on.asc::after{content:"↑"}
.sb-tb th.nos{cursor:default}
.sb-tb td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:right}
.sb-tb tr:last-child td{border-bottom:0}
.sb-tb tbody tr{cursor:pointer;transition:background .1s}.sb-tb tbody tr:hover td{background:#f7f9fb}
.sb-tb td.nm b{font-weight:600;color:var(--text)}.sb-tb td.nm em{font-style:normal;font-size:11.5px;color:var(--sub2);margin-left:6px}
.sb-tb td.mu{color:var(--sub)}
.sb-tb .p52{display:inline-flex;align-items:center;gap:6px}.sb-tb .p52 .sb-pg{width:46px;--pc:#9aa1ab}
.sb-stl{display:none}
@media (max-width:760px){
  .sb-hero{padding:14px 14px 13px}.sb-h1{flex-wrap:nowrap;gap:10px}.sb-h1 .nm{flex:1 1 0}.sb-h1 h1{font-size:22px}.sb-h1 .px b{font-size:24px}.sb-h1 .cd{font-size:12.5px}
  .sb-kv.k5{grid-template-columns:repeat(6,minmax(0,1fr))}.sb-kv.k5>div{grid-column:span 2}.sb-kv.k5>div:nth-child(n+4){grid-column:span 3}
  .sb-kv{gap:6px;margin-top:12px}.sb-kv>div{padding:7px 9px}.sb-kv b{font-size:15.5px}.sb-kv span{font-size:11px}
  .sb-zbar{font-size:13px;padding:9px 10px;align-items:flex-start}.sb-zp span{font-size:12px;padding:2px 9px}
  .sb-subs{grid-template-columns:minmax(0,1fr);gap:9px}.sb-sc{padding:12px 13px 11px}.sb-sc .r1 .big{font-size:19px}
  .sb-sec{margin:22px 0 10px}.sb-sec h2{font-size:17px}.sb-sec .sb-sorts{margin:4px 0 0;width:100%;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
  .sb-hr{grid-template-columns:minmax(0,1fr) 64px 70px;padding:10px 13px;gap:0 8px}.sb-hr .wb{display:none}.sb-hr .nm{font-size:13.5px}
  .sb-hr .nm small{display:block;font-weight:400;font-size:11.5px;color:var(--sub)}
  .sb-chart{padding:10px 10px 6px}
  .sb-tw{display:none}.sb-stl{display:grid;gap:8px}
  .sb-stc{display:block;background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);padding:11px 13px 10px;color:var(--text)}
  .sb-stc .r1{display:flex;align-items:center;gap:6px;min-width:0}
  .sb-stc .r1 b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .sb-stc .r1 em{font-style:normal;font-size:11.5px;color:var(--sub2);flex:none}
  .sb-stc .r1 .big{margin-left:auto;font-size:18px;font-weight:700;flex:none;padding-left:6px}
  .sb-stc .r2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:7px}
  .sb-stc .r2 span{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sb-stc .r2 small{display:block;font-size:10.5px;color:var(--sub2);line-height:1.3}
  .sb-ring svg{width:42px;height:42px}.sb-h3x{gap:12px 20px}.sb-dko{display:none}
}
@media (min-width:761px) and (max-width:1099px){.sb-hr{grid-template-columns:minmax(0,1fr) 120px 70px 80px}.sb-lh,.sb-lr{grid-template-columns:30px minmax(0,1fr) 70px 70px 80px 90px}.sb-lr>.v.br,.sb-lh>span:last-child{display:none}}
@media (min-width:761px){.sb-hr .nm small{display:none}.sb-sec .sb-mo{display:none}}
/* 骨架屏 */
.sb-sk{background:linear-gradient(90deg,#eceef2 25%,#f5f6f8 37%,#eceef2 63%);background-size:400% 100%;animation:sbSk 1.3s ease infinite;border-radius:var(--r)}
@keyframes sbSk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.sb-sk.ln{height:14px;border-radius:7px;margin:8px 0}`;
    document.head.appendChild(st);
  }

  // ---------- 配色：底色按分区（红涨绿跌：可买红、等回踩橙、到目标区黄、观察浅灰、弱势浅绿、回避绿） ----------
  // [色块底色, 色块文字, 是否深底, 浅底色（分区条）, 深字色]
  const Z = {
    buy: ["#e5484d", "#fff", 1, "#fdecec", "#c81e1e"], wait: ["#f08c2b", "#fff", 1, "#fff1e0", "#b45309"], hold: ["#f5c544", "#5c4300", 0, "#fff7e0", "#8a6100"],
    watch: ["#eceef2", "#1f2328", 0, "#f1f2f4", "#4b5563"], left: ["#efe6b8", "#5f5110", 0, "#f8f4dc", "#6b5a10"],
    weak: ["#d3eedd", "#14532d", 0, "#eef8f1", "#2f855a"], avoid: ["#23a063", "#fff", 1, "#e7f6ec", "#15803d"],
    up: ["#e5484d", "#fff", 1, "#fdecec", "#c81e1e"], mid: ["#eceef2", "#1f2328", 0, "#f1f2f4", "#4b5563"], down: ["#23a063", "#fff", 1, "#e7f6ec", "#15803d"],
    na: ["#eceef2", "#6b7280", 0, "#f1f2f4", "#6b7280"] };
  const zc = (g) => Z[g] || Z.na;
  const ZD = { hold: "#f0b429", watch: "#b4bac3", left: "#d4c26a", weak: "#86cfa3", mid: "#b4bac3", na: "#d0d4da" };
  const zvars = (g) => { const c = zc(g); return `--zc:${ZD[g] || c[0]};--zb:${c[3]};--zt:${c[4]};--tb:${c[0]};--tt:${c[1]}`; };
  const CN_G = [["buy", "可买", "走势健康、价格在买入区"], ["wait", "等回踩", "走势健康、价格高于买入区，挂单等回踩"], ["hold", "到目标区", "不买，持有的分批止盈"],
    ["watch", "观察", "相对强、趋势没确认"], ["left", "左侧", "趋势未成"], ["weak", "弱势", "趋势未成，不买"], ["avoid", "回避", "破位或跌破止损"]];
  const US_G = [["up", "强", "站上 50 日和 200 日线"], ["mid", "中性", "两条线一上一下"], ["down", "弱", "跌破 50 日和 200 日线"], ["na", "数据不足", ""]];
  const LC = { lead: "var(--up)", lag: "var(--dn)", mid: "#c9ced6", na: "#e3e6ea" };
  const TAG = { lead: "领涨", mid: "跟随", lag: "落后" };
  const tag = (k) => (TAG[k] ? `<i class="sb-tag ${k}">${TAG[k]}</i>` : "");
  const rel = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + (+v).toFixed(1));
  const n3 = (v) => (v == null ? "—" : v >= 1000 ? (+v).toFixed(0) : v >= 100 ? (+v).toFixed(1) : v >= 10 ? (+v).toFixed(2) : (+v).toFixed(3));
  const fmc = (v, us) => (v == null ? "—" : (us ? "$" : "") + (v >= 10000 ? (v / 10000).toFixed(2) + "万亿" : v >= 100 ? v.toFixed(0) + "亿" : v.toFixed(1) + "亿"));
  const famt = (v) => (v == null ? "—" : v >= 100 ? v.toFixed(0) + "亿" : v >= 1 ? v.toFixed(2) + "亿" : (v * 10000).toFixed(0) + "万");
  const pg = (v, c) => `<span class="sb-pg"${c ? ` style="--pc:${c}"` : ""}><i style="width:${Math.max(0, Math.min(100, v || 0))}%"></i></span>`;
  const pgc = (v) => (v == null ? "#c9ced6" : v >= 60 ? "var(--up)" : v <= 40 ? "var(--dn)" : "#9aa1ab");
  const stockUrl = (sym) => "stock/#/s/" + encodeURIComponent(sym);
  const MK = { "买点": "b", "卖点": "s", "近买点": "nb", "近卖点": "ns" };
  const marks = (x, etf) => (x.marks || []).filter((m, i, a) => a.indexOf(m) === i).map((m) => `<i class="sb-m ${MK[m] || ""}">${m}</i>`).join("")
    + (x.v2 ? `<i class="sb-m v" title="v2 分散组合今天第 ${x.v2} 名">组合${x.v2}</i>` : "")
    + (etf && (x.etf || []).includes(etf) ? `<i class="sb-m e" title="在这个板块 ETF 最新披露的前十大重仓里">重仓</i>` : "");
  const sname = (s, us) => (us ? s.name.replace(/（.*$/, "") : s.name.replace(/ETF$/, ""));
  const skey = (s, us) => (us ? s.state : s.group);
  const H = (mk, ...p) => "#/sectors/" + [mk, ...p].map(encodeURIComponent).join("/");
  const wrap = (html) => `<div class="sb-page">${html}</div>`;
  const S = { rk: "rel", l2: "rel", l3: "mc", l3d: -1 };

  // ---------- 骨架屏 ----------
  const sk = (h, extra = "") => `<div class="sb-sk" style="height:${h}px;${extra}"></div>`;
  const SK1 = () => `<div class="sb-top"><h1>板块看板</h1></div>${sk(14, "width:60%;margin:10px 0 18px;border-radius:7px")}
    <div class="sb-zones">${Array.from({ length: 12 }, () => `<div style="grid-column:span 1">${sk(0, "aspect-ratio:1.3/1")}</div>`).join("")}</div>`;
  const SK2 = () => `${sk(14, "width:180px;border-radius:7px;margin:0 0 14px")}${sk(190)}<div style="height:14px"></div>${sk(240)}
    <div class="sb-subs" style="margin-top:26px">${sk(118)}${sk(118)}${sk(118)}${sk(118)}</div>`;

  // ---------- 数据 ----------
  const overview = () => getJSON("sector_board.json", true);
  const detail = (mk, code) => getJSON(`sectors/${mk}_${encodeURIComponent(code)}.json`, true);
  async function subStocks(mk, code, sw, v) {
    if (!v.split) return v.stocks || [];
    const P = await getJSON(`sectors/${mk}_${encodeURIComponent(code)}_${encodeURIComponent(sw)}.json`, true);
    return P.stocks || [];
  }

  function timeLine(D, M, us) {
    const pm = M.picks || {};
    return us ? `美股行情 ${esc((M.quote_time || "").slice(0, 16))}（美东时间）· 页面生成 ${esc(D.built)} · 强/中性/弱只是趋势描述（未回测）`
      : `分区 ${esc(M.data_date || "")} 收盘（sector_zones，已回测）· 个股行情 ${esc(D.built)} · 买卖点角标 ${esc(pm.computed_at || "—")}${pm.stale ? "（⚠️ 沿用旧名单）" : ""}`;
  }
  function header(D, mk, tab) {
    const us = mk === "us", M = us ? D.us : D.cn;
    const nsub = Object.keys((M && M.subcats) || {}).length;
    const tabH = (t) => (t === "rank" ? H(mk, "rank") : us ? "#/sectors/us" : "#/sectors");
    const mkH = (m) => (tab === "rank" ? H(m, "rank") : m === "us" ? "#/sectors/us" : "#/sectors");
    return `<div class="sb-top"><h1>板块看板</h1><div class="sb-seg"><a data-rep href="${mkH("cn")}" class="${us ? "" : "on"}">A股</a><a data-rep href="${mkH("us")}" class="${us ? "on" : ""}">美股</a></div></div>
      <div class="sb-meta">${M ? timeLine(D, M, us) : ""}</div>
      <div class="sb-tabs"><a data-rep href="${tabH("heat")}" class="${tab === "rank" ? "" : "on"}">板块热力<em>${M ? M.sectors.length : ""}</em></a><a data-rep href="${tabH("rank")}" class="${tab === "rank" ? "on" : ""}">赛道排行<em>${nsub || ""}</em></a></div>`;
  }
  function bindRep() {   // 市场/Tab 切换不新增历史记录：返回键直接回上一级
    app.querySelectorAll("a[data-rep]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); if (location.hash !== a.getAttribute("href")) location.replace(a.getAttribute("href")); }));
  }

  // ---------- 第 1 级：热力格子 ----------
  function tile(s, mk, M) {
    const us = mk === "us", g = skey(s, us), c = zc(g);
    const subs = (s.subs || []).filter((x) => (M.subcats || {})[x.code]);
    const nl = subs.filter((x) => x.st === "lead").length;
    const st = us ? (s.slabel || "").split("：")[0] : s.glabel;
    return `<a class="sb-tile ${c[2] ? "dk" : "lt"}" style="${zvars(g)}" href="${H(mk, s.code)}" title="${esc(s.name)}｜${esc(us ? s.slabel : s.status + "｜" + s.action)}">
      <div class="tn">${esc(sname(s, us))}</div><div class="ts">${esc(us ? s.code + " · " + st : st)}</div>
      <div class="tp ${updn(s.pct)}">${pct(s.pct, 2)}</div>
      <div class="tf"><span>20日 <span class="${updn(s.r20)}">${pct(s.r20, 1)}</span></span>${subs.length ? `<i class="tl${nl ? "" : " z"}" title="${subs.length} 个赛道里 ${nl} 个领涨（20 日比板块强 ≥3 个百分点）"><span>领涨 </span>${nl}</i>` : ""}</div></a>`;
  }
  function heatPage(D, mk) {
    const us = mk === "us", M = us ? D.us : D.cn;
    if (!M) return wrap(`${header(D, mk, "heat")}<div class="card muted">${us ? "美股" : "A股"}数据还没生成。</div>`);
    const G = us ? US_G : CN_G;
    const by = {};
    M.sectors.forEach((s) => (by[skey(s, us)] = by[skey(s, us)] || []).push(s));
    Object.values(by).forEach((xs) => xs.sort((a, b) => (b.pct ?? -99) - (a.pct ?? -99)));
    const groups = G.filter(([k]) => (by[k] || []).length);
    const brief = groups.map(([k, n]) => `<span style="${zvars(k)}"><i></i>${n} <b>${by[k].length}</b></span>`).join("");
    const broad = !us && (M.broad || []).length ? `<div class="sb-broad"><span class="lb">宽基</span>${M.broad.map((b) =>
      `<a href="${stockUrl(b.sym)}" style="${zvars(b.group)}" title="${esc(b.glabel)}｜${esc(b.status)}｜${esc(b.action)}"><i></i>${esc(b.name.replace(/ETF$/, ""))} <span class="${updn(b.pct)}">${pct(b.pct, 2)}</span><em>${esc(b.glabel)}</em></a>`).join("")}</div>` : "";
    const zones = groups.map(([k, n, d]) => `<section class="sb-zone n${Math.min(by[k].length, 6)}" style="${zvars(k)}"><div class="sb-zh" title="${esc(d)}"><i></i><b>${n}</b><span>${by[k].length}</span></div>
      <div class="sb-heat">${by[k].map((s) => tile(s, mk, M)).join("")}</div></section>`).join("");
    const bt = !us && M.bt && M.bt.zone ? M.bt.zone : null;
    return wrap(`${header(D, mk, "heat")}<div class="sb-brief">${brief}</div>${broad}<div class="sb-zones">${zones}</div>
      <div class="sb-foot">${us ? `<p>美股的「强 / 中性 / 弱」只看价格相对 50 / 200 日线，是趋势描述，没有回测，不是买卖区。</p>`
        : `<p>分区来自 sector_zones（已回测）：走势健康＝收盘在 20 日线上、20 日线向上且在 60 日线上；价格在买入区＝可买，高于买入区＝等回踩、不追。${bt ? `回测 ${esc(bt.from)}~${esc(bt.to)} 共 ${bt.n} 笔（含成本）：等回踩到买入区再买平均每笔 ${pct(bt.mean, 2)}、胜率 ${Math.round(bt.win)}%。` : ""}同一分区内谁排前面历史上和随便挑差别不显著。</p>`}
        <p>色块里：板块名、今日涨跌、20 日涨跌、状态；角标「领涨 N」（手机上只显示数字）＝这个板块里 20 日比板块强 ≥3 个百分点的赛道数（只是描述，未回测）。点色块进板块页。</p></div>${DISC}`);
  }

  // ---------- 第 1 级 Tab：赛道排行 ----------
  function rankPage(D, mk) {
    const us = mk === "us", M = us ? D.us : D.cn;
    if (!M) return wrap(`${header(D, mk, "rank")}<div class="card muted">数据还没生成。</div>`);
    const SC = M.subcats || {};
    const ORD = Object.fromEntries((us ? US_G : CN_G).map(([k], i) => [k, i]));
    const secs = M.sectors.slice().sort((a, b) => (ORD[skey(a, us)] ?? 9) - (ORD[skey(b, us)] ?? 9));
    const seen = {}, rows = [];
    for (const s of secs) for (const x of s.subs || []) {
      if (!SC[x.code]) continue;
      if (seen[x.code]) { seen[x.code].also.push(s); continue; }
      rows.push((seen[x.code] = { s, x, v: SC[x.code], also: [] }));
    }
    const key = { rel: (r) => r.x.rel, r20: (r) => r.v.r20, pct: (r) => r.v.pct }[S.rk] || ((r) => r.x.rel);
    rows.sort((a, b) => (key(b) ?? -999) - (key(a) ?? -999));
    const cnt = (k) => rows.filter((r) => r.x.st === k).length;
    const SORTS = [["rel", "相对板块"], ["r20", "20日"], ["pct", "今日"]];
    const list = rows.map((r, i) => {
      const { s, x, v } = r;
      const sub = `${esc(sname(s, us))}${r.also.length ? ` 等 ${r.also.length + 1} 个板块` : ""} · ${us ? esc(v.en || "") : "申万二级 " + esc(v.parent || "")}`;
      return `<a class="sb-lr" style="--lc:${LC[x.st] || LC.na}" href="${H(mk, s.code, x.code)}" title="${esc([s, ...r.also].map((y) => sname(y, us)).join("、"))}">
        <span class="rk">${i + 1}</span><div class="nm"><b>${esc(v.name)}${tag(x.st)}</b><small>${sub}</small></div>
        <span class="v dk ${updn(v.pct)}">${pct(v.pct, 2)}</span><span class="v dk ${updn(v.r5)}">${pct(v.r5, 1)}</span>
        <span class="v ${S.rk === "r20" ? "bd " : ""}${updn(v.r20)}">${pct(v.r20, 1)}</span>
        <span class="v ${S.rk === "rel" ? "bd " : ""}${updn(x.rel)}">${rel(x.rel)}</span>
        <span class="v br dk">${pg(v.a20, pgc(v.a20))}${v.a20 ?? "—"}%</span></a>`;
    }).join("");
    return wrap(`${header(D, mk, "rank")}
      <div class="sb-sorts"><span class="lb">排序</span>${SORTS.map(([k, n]) => `<a href="javascript:" data-rk="${k}" class="${S.rk === k ? "on" : ""}">${n}</a>`).join("")}<span class="sp"></span>
        <span class="lb">${rows.length} 个赛道：领涨 ${cnt("lead")} · 跟随 ${cnt("mid")} · 落后 ${cnt("lag")}</span></div>
      <div class="sb-list"><div class="sb-lh"><span class="dk"></span><span>赛道 · 所属板块</span><span class="dk">今日</span><span class="dk">5日</span><span>20日</span><span title="赛道 20 日涨跌 − 所属板块 ETF 20 日涨跌">相对板块</span><span class="dk">站上20日线</span></div>${list}</div>
      <div class="sb-foot"><p>「相对板块」＝赛道 20 日涨跌 − 所属板块 ETF 20 日涨跌（百分点）。≥ +3 领涨、≤ −3 落后、其余跟随——<b>只描述现在强弱，没有回测，不是买卖信号</b>。左侧细色条：红＝领涨，绿＝落后。</p>
        <p>同一个赛道挂在几个板块下（如半导体和芯片）只列一次，按分区靠前的板块算「相对板块」。口径：${esc((M.sub_meta || {}).method || "")}。${us ? "美股赛道是 GICS 子行业，代表股手工整理。" : ""}</p></div>${DISC}`);
  }

  // ---------- 走势图（轻量 SVG） ----------
  function chartHTML(id, legend) {
    return `<div class="sb-card sb-chart" id="${id}"><div class="lg">${legend.map(([n, c, ds]) => `<span><i class="${ds ? "ds" : ""}" style="--c:${c}"></i>${n}</span>`).join("")}</div><div class="cv"></div><div class="tip"></div></div>`;
  }
  function drawChart(id, dates, series, fmtV) {
    const box = document.getElementById(id);
    if (!box || !dates || !dates.length) { if (box) box.remove(); return; }
    const cv = box.querySelector(".cv"), tip = box.querySelector(".tip");
    const W = Math.max(280, cv.clientWidth), Hh = W < 500 ? 180 : 240, pl = 6, pr = 52, pt = 8, pb = 22;
    const all = series.flatMap((s) => s.v.filter((x) => x != null));
    let lo = Math.min(...all), hi = Math.max(...all);
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const n = dates.length, X = (i) => pl + (W - pl - pr) * (n === 1 ? 0 : i / (n - 1)), Y = (v) => pt + (Hh - pt - pb) * (1 - (v - lo) / (hi - lo));
    const path = (v) => { let d = "", on = false; v.forEach((y, i) => { if (y == null) { on = false; return; } d += (on ? "L" : "M") + X(i).toFixed(1) + " " + Y(y).toFixed(1); on = true; }); return d; };
    let g = "";
    for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * (0.1 + 0.8 * k / 3), y = Y(v); g += `<line x1="${pl}" x2="${W - pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#eef0f3"/><text class="ax" x="${W - pr + 6}" y="${(y + 3.5).toFixed(1)}">${fmtV(v)}</text>`; }
    [0, Math.floor((n - 1) / 2), n - 1].forEach((i, j) => { g += `<text class="ax" x="${X(i).toFixed(1)}" y="${Hh - 6}" text-anchor="${j === 0 ? "start" : j === 2 ? "end" : "middle"}">${esc(dates[i].slice(5))}</text>`; });
    const lines = series.map((s) => `<path d="${path(s.v)}" fill="none" stroke="${s.c}" stroke-width="${s.w || 1.4}" ${s.ds ? 'stroke-dasharray="4 3"' : ""} stroke-linejoin="round" stroke-linecap="round"/>`).join("");
    cv.innerHTML = `<svg width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${g}${lines}<line class="xh" y1="${pt}" y2="${Hh - pb}" stroke="#c9ced6" stroke-dasharray="3 3" style="display:none"/></svg>`;
    const svg = cv.querySelector("svg"), xh = svg.querySelector(".xh");
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      const i = Math.max(0, Math.min(n - 1, Math.round((x - pl) / (W - pl - pr) * (n - 1))));
      xh.setAttribute("x1", X(i)); xh.setAttribute("x2", X(i)); xh.style.display = "";
      tip.innerHTML = `<b>${esc(dates[i])}</b>` + series.map((s) => `<br>${esc(s.n)} ${s.v[i] == null ? "—" : fmtV(s.v[i])}`).join("");
      tip.style.display = "block";
      const bx = box.getBoundingClientRect(), tx = r.left - bx.left + X(i);
      tip.style.left = Math.min(Math.max(4, tx + 12), bx.width - tip.offsetWidth - 4) + "px"; tip.style.top = "34px";
    };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", () => { tip.style.display = "none"; xh.style.display = "none"; });
    svg.addEventListener("touchend", () => { tip.style.display = "none"; xh.style.display = "none"; });
  }

  // ---------- 第 2 级：板块页 ----------
  function crumb(mk, parts) {
    const root = `<a href="${mk === "us" ? "#/sectors/us" : "#/sectors"}">${mk === "us" ? "美股板块" : "板块"}</a>`;
    return `<nav class="sb-crumb">${[root, ...parts].join("<i>›</i>")}</nav>`;
  }
  function kv(label, v, cls = "") { return `<div><span>${label}</span><b class="${cls}">${v}</b></div>`; }
  function sectorPage(D, F, mk) {
    const us = mk === "us", s = F.sector, g = skey(s, us), c = zc(g);
    const p52 = F.p52;
    const zoneTxt = us ? `<div class="sb-zbar ${c[2] ? "" : "lt"}" style="${zvars(g)}"><span class="zl">${esc((s.slabel || "").split("：")[0] || "—")}</span><span>${esc(s.slabel || "")}${(s.slabel || "").includes("：") ? "" : ""}。这是趋势描述，<b>没有回测</b>。</span></div>`
      : `<div class="sb-zbar ${c[2] ? "" : "lt"}" style="${zvars(g)}"><span class="zl">${esc(s.glabel)}</span><span>${esc(s.status)}｜<b>${esc(s.action)}</b>${s.trend_days ? `｜走势健康第 ${s.trend_days} 天` : ""}</span></div>
        <div class="sb-zp"><span>买入区<b>${n3((s.zone || [])[0])}–${n3((s.zone || [])[1])}</b></span><span class="tg">目标<b>${n3(s.t1)}</b></span><span class="st">止损<b>${n3(s.stop)}</b></span>${(s.heat || []).length ? `<span>今日热点<b>${esc(s.heat.slice(0, 3).join("、"))}</b></span>` : ""}</div>`;
    const hero = `<div class="sb-hero"><div class="sb-h1"><div class="nm"><h1>${esc(sname(s, us))}</h1><div class="cd"><span>${us ? esc(s.en || "") : esc(s.name)} · ${esc(s.code)}</span> · <span><a href="${stockUrl(s.sym)}">看 ETF 详情 ›</a></span></div></div>
        <div class="px"><b>${n3(s.price)}</b><span class="sb-pill ${updn(s.pct)}">${us ? "最新 " : "今日 "}${pct(s.pct, 2)}</span></div></div>
      <div class="sb-kv">${kv("5日", pct(s.r5, 1), updn(s.r5))}${kv("20日", pct(s.r20, 1), updn(s.r20))}${kv("60日", pct(F.r60, 1), updn(F.r60))}
        <div><span>52周位置</span><b>${p52 == null ? "—" : Math.round(p52) + "%"}</b>${p52 == null ? "" : pg(p52, "#9aa1ab")}</div></div>${zoneTxt}</div>`;
    const SC = F.subs || {};
    const subs = (s.subs || []).filter((x) => SC[x.code]);
    const key = { rel: (x) => x.rel, r20: (x) => SC[x.code].r20, pct: (x) => SC[x.code].pct }[S.l2] || ((x) => x.rel);
    subs.sort((a, b) => (key(b) ?? -999) - (key(a) ?? -999));
    const cards = subs.map((x) => {
      const v = SC[x.code];
      const ld = (v.leaders || []).map((y) => `<span>${esc(us ? y.name : y.name.replace(/\s+/g, ""))}</span><em class="${updn(y.pct)}">${pct(y.pct, 1)}</em>`).join("　");
      return `<a class="sb-sc" style="--lc:${LC[x.st] || LC.na}" href="${H(mk, s.code, x.code)}">
        <div class="r1"><b>${esc(v.name)}</b>${tag(x.st)}<span class="big ${updn(v.r20)}">${pct(v.r20, 1)}</span></div>
        <div class="r2"><span>相对板块 <b class="${updn(x.rel)}">${rel(x.rel)}</b></span><span>今日 <b class="${updn(v.pct)}">${pct(v.pct, 2)}</b></span><span>${us ? "代表股" : "成分"} ${v.n} 只</span><span class="bx">20日</span></div>
        <div class="r3"><span>站上20日线</span>${pg(v.a20, pgc(v.a20))}<b>${v.a20 ?? "—"}%</b></div>
        <div class="r4">龙头　${ld || "—"}</div></a>`;
    }).join("");
    const SORTS = [["rel", "相对强弱"], ["r20", "20日"], ["pct", "今日"]];
    const subSec = subs.length ? `<div class="sb-sec"><h2>赛道</h2><em>${subs.length} 个 · ${us ? "GICS 子行业（手工整理）" : "申万三级"}</em>
        <div class="sb-sorts">${SORTS.map(([k, n]) => `<a href="javascript:" data-l2="${k}" class="${S.l2 === k ? "on" : ""}">${n}</a>`).join("")}</div></div><div class="sb-subs">${cards}</div>`
      : `<div class="sb-sec"><h2>赛道</h2></div><div class="card muted">${esc(s.subs_none || (us ? "这个 ETF 没有整理子行业。" : "这个板块不做申万细分（黄金 / 恒生科技 / 纳指这类 ETF 成分不是 A股行业）。"))}</div>`;
    const top = F.top || [];
    const wmax = Math.max(1, ...top.map((x) => x.w || 0));
    const hold = top.length ? `<div class="sb-sec"><h2>${us ? "代表持仓" : "ETF 前十大重仓"}</h2><em>${us ? "手工整理（2026-11），没有权重" : esc(s.period || "") + " 季报披露"}</em></div>
      <div class="sb-card sb-hold">${top.map((x) => `<a class="sb-hr" href="${stockUrl(x.sym)}"><span class="nm">${esc(x.name)}<em>${esc(x.code)}</em>${marks(x)}<small>${x.w != null ? "权重 " + x.w + "%" : ""}</small></span>
        <span class="wb">${x.w != null ? `${pg(x.w / wmax * 100)}<span>${x.w.toFixed(2)}%</span>` : ""}</span>
        <span class="v ${updn(x.pct)}">${pct(x.pct, 2)}</span><span class="v ${updn(x.r20)}"><small>20日</small>${pct(x.r20, 1)}</span></a>`).join("")}</div>`
      : `<div class="sb-sec"><h2>ETF 成分</h2></div><div class="card muted">${esc(s.src || "持仓暂缺")}</div>`;
    const ch = F.chart;
    const chart = ch ? `<div class="sb-sec"><h2>走势</h2><em>近 ${ch.c.length} 个交易日 · 前复权</em></div>${chartHTML("sbc2", [["收盘", "var(--text)"], ["20日线", "#f08c2b"], ["60日线", "#7c8ea8"]])}` : "";
    const foot = `<div class="sb-foot">${us ? "<p>美股强/中性/弱只是趋势描述（价格相对 50/200 日线），没有回测。</p>" : "<p>分区、买入区、目标、止损来自 sector_zones（已回测口径）。</p>"}
      <p>赛道的「领涨 / 跟随 / 落后」＝赛道 20 日涨跌 − 板块 ETF 20 日涨跌，≥ +3 领涨、≤ −3 落后——<b>只是描述，未回测，不是买卖信号</b>。点赛道卡片看里面的全部个股。</p></div>`;
    return wrap(`${crumb(mk, [`<b>${esc(sname(s, us))}</b>`])}${hero}${chart}${subSec}${hold}${foot}${DISC}`);
  }
  function drawSector(F) {
    const ch = F.chart;
    if (!ch) return;
    const up = ch.c[ch.c.length - 1] >= ch.c[0];
    drawChart("sbc2", ch.d, [{ n: "收盘", v: ch.c, c: up ? "var(--up)" : "var(--dn)", w: 1.8 }, { n: "20日线", v: ch.m20, c: "#f08c2b", w: 1.2 }, { n: "60日线", v: ch.m60, c: "#7c8ea8", w: 1.2 }], n3);
    const lg = document.querySelector("#sbc2 .lg i");
    if (lg) lg.style.setProperty("--c", up ? "var(--up)" : "var(--dn)");
  }

  // ---------- 第 3 级：赛道页 ----------
  const ring = (v, label, sub) => {
    const c = pgc(v);
    return `<div class="sb-ring" style="--rc:${c}"><svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15.915"/>${v ? `<circle class="fg" cx="18" cy="18" r="15.915" stroke-dasharray="${v} ${100 - v}" transform="rotate(-90 18 18)"/>` : ""}<text x="18" y="18">${v == null ? "—" : v + "%"}</text></svg><span><b>${label}</b>${sub}</span></div>`;
  };
  const L3COL = [["name", "名称 / 代码", "l"], ["price", "现价"], ["pct", "今日"], ["r5", "5日"], ["r20", "20日"], ["r60", "60日"], ["d20", "距20日线"], ["p52", "52周位置"],
    ["mc", "总市值"], ["pe", "PE(TTM)"], ["tr", "换手"], ["amt", "成交额"], ["mk", "标记", "l nos"]];
  const L3M = [["mc", "市值"], ["pct", "今日"], ["r20", "20日"], ["d20", "距均线"]];
  function sortStocks(xs) {
    const k = S.l3, d = S.l3d;
    if (k === "name") return xs.slice().sort((a, b) => d * String(a.name).localeCompare(String(b.name), "zh"));
    return xs.slice().sort((a, b) => { const x = a[k], y = b[k]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return d * (x - y); });
  }
  function stockTable(xs, us, etf) {
    const cell = (x) => `<tr data-u="${esc(stockUrl(x.sym))}"><td class="l nm"><a href="${stockUrl(x.sym)}"><b>${esc(x.name)}</b></a><em>${esc(x.code)}</em></td>
      <td>${n3(x.price)}</td><td class="${updn(x.pct)}">${pct(x.pct, 2)}</td><td class="${updn(x.r5)}">${pct(x.r5, 1)}</td><td class="${updn(x.r20)}">${pct(x.r20, 1)}</td>
      <td class="${updn(x.r60)}">${pct(x.r60, 1)}</td><td class="${updn(x.d20)}">${pct(x.d20, 1)}</td>
      <td>${x.p52 == null ? "—" : `<span class="p52">${pg(x.p52)}<span>${Math.round(x.p52)}%</span></span>`}</td>
      <td>${fmc(x.mc, us)}</td><td class="mu">${x.pe == null ? "—" : x.pe.toFixed(1)}</td><td class="mu">${x.tr == null ? "—" : x.tr.toFixed(2) + "%"}</td><td class="mu">${famt(x.amt)}</td>
      <td class="l">${marks(x, etf) || '<span class="muted">—</span>'}</td></tr>`;
    return `<div class="sb-card sb-tw"><table class="sb-tb"><thead><tr>${L3COL.map(([k, n, c]) => `<th class="${c || ""}${S.l3 === k ? " on" + (S.l3d > 0 ? " asc" : "") : ""}" ${c && c.includes("nos") ? "" : `data-k="${k}"`}>${n}</th>`).join("")}</tr></thead>
      <tbody>${xs.map(cell).join("")}</tbody></table></div>`;
  }
  function stockCards(xs, us, etf) {
    return `<div class="sb-stl">${xs.map((x) => `<a class="sb-stc" href="${stockUrl(x.sym)}"><div class="r1"><b>${esc(x.name)}</b><em>${esc(x.code)}</em>${marks(x, etf)}<span class="big ${updn(x.pct)}">${pct(x.pct, 2)}</span></div>
      <div class="r2"><span class="${updn(x.r20)}"><small>20日</small>${pct(x.r20, 1)}</span><span class="${updn(x.r60)}"><small>60日</small>${pct(x.r60, 1)}</span>
        <span class="${updn(x.d20)}"><small>距20日线</small>${pct(x.d20, 1)}</span><span><small>总市值</small>${fmc(x.mc, us)}</span></div></a>`).join("")}</div>`;
  }
  function subPage(D, F, mk, sw, stocks) {
    const us = mk === "us", s = F.sector, v = F.subs[sw];
    const x = (s.subs || []).find((y) => y.code === sw) || {};
    const xs = sortStocks(stocks);
    const hero = `<div class="sb-hero"><div class="sb-h1"><div class="nm"><h1>${esc(v.name)} ${tag(x.st)}</h1>
        <div class="cd"><span>${us ? esc(v.en || "") + " · GICS 子行业（手工整理）" : "申万二级 " + esc(v.parent || "—")}</span> · <span>所属板块 <a href="${H(mk, s.code)}">${esc(sname(s, us))}</a></span> · <span>${us ? "代表股" : "成分股"} ${v.n} 只</span></div></div>
        <div class="px"><b class="${updn(v.pct)}">${pct(v.pct, 2)}</b><span class="sb-pill" title="成分按${us ? "总市值" : "流通市值"}加权">${us ? "最新" : "今日"}<span class="sb-dko"> · ${us ? "市值" : "流通市值"}加权</span></span></div></div>
      <div class="sb-kv k5">${kv("5日", pct(v.r5, 1), updn(v.r5))}${kv("20日", pct(v.r20, 1), updn(v.r20))}${kv("60日", pct(v.r60, 1), updn(v.r60))}
        ${kv("板块 20日", pct(s.r20, 1), updn(s.r20))}${kv("相对板块", rel(x.rel), updn(x.rel))}</div>
      <div class="sb-h3x">${ring(v.a20, "站上 20 日线", `${us ? "代表股" : "成分"}里的占比`)}${ring(v.a60, "站上 60 日线", `${us ? "代表股" : "成分"}里的占比`)}</div></div>`;
    const ch = F.chart, idx = v.idx;
    const chart = idx && ch && idx.length === ch.d.length ? `<div class="sb-sec"><h2>赛道走势</h2><em>起点 100 · 成分日收益按${us ? "市值" : "流通市值"}加权串起来，和板块 ETF 对比</em></div>
      ${chartHTML("sbc3", [[v.name, "var(--text)"], [sname(s, us) + " ETF", "#9aa1ab", 1]])}` : "";
    const list = `<div class="sb-sec"><h2>${us ? "代表股" : "全部成分"}</h2><em>${xs.length} 只${us ? " · 手工整理，取不到的写「—」" : " · 申万三级成分"} · 点个股进个股透视</em>
      <div class="sb-sorts sb-mo">${L3M.map(([k, n]) => `<a href="javascript:" data-l3="${k}" class="${S.l3 === k ? "on" : ""}">${n}</a>`).join("")}</div></div>
      ${stockTable(xs, us, s.code)}${stockCards(xs, us, s.code)}`;
    const meta = (us ? D.us : D.cn) || {};
    const foot = `<div class="sb-foot"><p>口径：${esc((meta.sub_meta || {}).method || "")}。「相对板块」＝赛道 20 日 − 板块 ETF 20 日（百分点）；领涨/跟随/落后只是描述，<b>未回测</b>。</p>
      <p>表里：距20日线＝现价相对 20 日均线的偏离；52周位置＝现价在近一年最低到最高之间的位置（0%＝最低）；<i class="sb-m b">买点</i><i class="sb-m s">卖点</i><i class="sb-m nb">近买点</i><i class="sb-m ns">近卖点</i>来自个股站「今日买卖点」规则扫描（只覆盖它的股票池）${us ? "" : '；<i class="sb-m v">组合N</i>＝v2 分散组合第 N 名'}；<i class="sb-m e">重仓</i>＝在 ${esc(sname(s, us))} ETF 的${us ? "代表持仓" : "前十大重仓"}里。</p></div>`;
    return wrap(`${crumb(mk, [`<a href="${H(mk, s.code)}">${esc(sname(s, us))}</a>`, `<b>${esc(v.name)}</b>`])}${hero}${chart}${list}${foot}${DISC}`);
  }
  function drawSub(F, sw) {
    const ch = F.chart, v = F.subs[sw];
    if (!ch || !v.idx || v.idx.length !== ch.d.length) return;
    const b0 = ch.c[0], etf = ch.c.map((c) => (b0 ? +(c / b0 * 100).toFixed(3) : null));
    const up = v.idx[v.idx.length - 1] >= 100;
    drawChart("sbc3", ch.d, [{ n: "ETF", v: etf, c: "#9aa1ab", w: 1.2, ds: 1 }, { n: v.name, v: v.idx, c: up ? "var(--up)" : "var(--dn)", w: 1.8 }], (y) => (+y).toFixed(1));
    const lg = document.querySelector("#sbc3 .lg i");
    if (lg) lg.style.setProperty("--c", up ? "var(--up)" : "var(--dn)");
  }

  // ---------- 入口 ----------
  async function page(a, b, c) {
    const tok = A.tok();
    const mk = a === "us" ? "us" : "cn";
    const lvl = !b ? 1 : b === "rank" ? 1 : c ? 3 : 2;
    document.title = "板块看板 · 小七投研";
    app.innerHTML = wrap(lvl === 1 ? SK1() : SK2());
    let D, F;
    try {
      [D, F] = await Promise.all([overview(), lvl > 1 ? detail(mk, b) : null]);
    } catch (e) { if (A.alive(tok)) app.innerHTML = wrap(`${lvl > 1 ? crumb(mk, ["<b>加载失败</b>"]) : "<h1>板块看板</h1>"}${FAIL()}`); return; }
    if (!A.alive(tok)) return;
    let stocks = null;
    if (lvl === 3) {
      const v = (F.subs || {})[c];
      if (!v) { app.innerHTML = wrap(`${crumb(mk, [`<a href="${H(mk, b)}">${esc(sname(F.sector, mk === "us"))}</a>`, "<b>没找到</b>"])}<div class="card">这个赛道今天没有数据（可能映射调整过），<a href="${H(mk, b)}">回板块页 ›</a></div>`); return; }
      try { stocks = await subStocks(mk, b, c, v); } catch (e) { if (A.alive(tok)) app.innerHTML = wrap(FAIL()); return; }
      if (!A.alive(tok)) return;
    }
    function render() {
      const y = window.scrollY;
      if (lvl === 1) {
        app.innerHTML = b === "rank" ? rankPage(D, mk) : heatPage(D, mk);
        bindRep();
        app.querySelectorAll("[data-rk]").forEach((x) => (x.onclick = () => { S.rk = x.dataset.rk; render(); }));
        document.title = (b === "rank" ? "赛道排行" : "板块看板") + " · 小七投研";
      } else if (lvl === 2) {
        app.innerHTML = sectorPage(D, F, mk);
        drawSector(F);
        app.querySelectorAll("[data-l2]").forEach((x) => (x.onclick = () => { S.l2 = x.dataset.l2; render(); }));
        document.title = sname(F.sector, mk === "us") + " · 板块看板";
      } else {
        app.innerHTML = subPage(D, F, mk, c, stocks);
        drawSub(F, c);
        app.querySelectorAll("th[data-k]").forEach((x) => (x.onclick = () => { const k = x.dataset.k; if (S.l3 === k) S.l3d = -S.l3d; else { S.l3 = k; S.l3d = k === "name" ? 1 : -1; } render(); }));
        app.querySelectorAll("[data-l3]").forEach((x) => (x.onclick = () => { S.l3 = x.dataset.l3; S.l3d = -1; render(); }));
        app.querySelectorAll(".sb-tb tbody tr").forEach((tr) => (tr.onclick = (e) => { if (!e.target.closest("a")) location.href = tr.dataset.u; }));
        document.title = F.subs[c].name + " · 板块看板";
      }
      if (render.done) { const p = app.querySelector(".sb-page"); if (p) p.style.animation = "none"; window.scrollTo(0, y); }
      render.done = true;
    }
    render();
    let rt = 0;
    const onR = () => { clearTimeout(rt); rt = setTimeout(() => { if (!A.alive(tok)) return window.removeEventListener("resize", onR); if (lvl === 2) drawSector(F); else if (lvl === 3) drawSub(F, c); }, 150); };
    if (lvl > 1) window.addEventListener("resize", onR);
  }
  window.__mod_sectors = { page };
})();
