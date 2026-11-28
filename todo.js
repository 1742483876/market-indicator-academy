/* 今天我该做什么 #/todo（按需加载）。数据：todo_build.py → todo.json（page 字段是本页直接用的白话）
   2026-11-23 改版：一张结论卡（大字 A股/美股 + 为什么 + 改主意 + 仓位最多）→ 今天要做的事（≤5 条勾选清单）→ S 级买点（market-pulse 右侧信号）
   → 等信号再买（板块紧凑表）→ 手里有的怎么办（S 级卖点 / 卖 / 减 / 止损）→ 先别碰（灰色标签）→ 🔒 我的持仓（密文，与财富规划同一套）
   → 底部折叠（检验过没用的、听谁的、数据时点）。
   口径：总状态与仓位上限只取 verdict（最新一份报告第〇章）；S 级买点的仓位按推送规范 2.8；A股 v2 组合 11-23 起「测试中」，不进本页清单。 */
(function () {
  const A = window.__APP;
  const { app, esc, pct, updn, FAIL, DISC, getJSON } = A;
  if (!document.getElementById("td-css")) {
    const st = document.createElement("style");
    st.id = "td-css";
    st.textContent = `
.wrap:has(>.td){max-width:1200px}
.td{font-variant-numeric:tabular-nums;--c-buy:var(--up);--c-wait:var(--warn);--c-no:#7b828c}
.td h1{margin:2px 0 10px}
.td .num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.td-grid{display:flex;flex-direction:column;gap:12px}
.td-l,.td-r{display:contents}
.td-hero{order:1}.td-todo{order:2}.td-wait{order:3}.td-hold{order:4}.td-chip{order:5}
.td .card{margin:0}
.td-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 8px}
.td-h b{font-size:16.5px}.td-h span{font-size:12px;color:var(--sub)}
/* 结论卡 */
.td-hero{padding:14px 16px 12px;border-top:5px solid var(--c-wait)}
.td-hero.lv-buy{border-top-color:var(--c-buy)}.td-hero.lv-no{border-top-color:var(--c-no)}
.td-say{display:flex;flex-direction:column;gap:4px;margin:2px 0 10px}
.td-say>div{display:flex;align-items:baseline;gap:10px}
.td-say .mk{font-size:13px;font-weight:700;color:var(--sub);min-width:30px}
.td-say b{font-size:22px;line-height:1.3;letter-spacing:.5px}
.c-buy{color:var(--c-buy)}.c-wait{color:var(--c-wait)}.c-no{color:var(--c-no)}
.td-dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 10px;margin:0;font-size:13.5px;line-height:1.55}
.td-dl dt{color:var(--sub);font-weight:600;white-space:nowrap}
.td-dl dd{margin:0;min-width:0}
.td-dl dd p{margin:0}.td-dl dd p+p{margin-top:2px}
.td-dl i{font-style:normal;font-size:11.5px;font-weight:700;color:var(--sub);background:var(--soft);border-radius:4px;padding:0 4px;margin-right:5px}
.td-dl .cap{font-size:16px}
.td-src{margin-top:10px;padding-top:8px;border-top:1px dashed var(--line);font-size:12px;color:var(--sub2);line-height:1.6}
.td-src a{color:var(--sub)}
/* 今天要做的事 */
.td-todo ol{list-style:none;margin:0;padding:0}
.td-todo li{display:flex;gap:10px;padding:9px 0;border-top:1px solid var(--line);align-items:flex-start}
.td-todo li:first-child{border-top:0;padding-top:2px}
.td-box{flex:none;width:20px;height:20px;margin-top:1px;border:2px solid #c9ced6;border-radius:6px;cursor:pointer;display:grid;place-items:center;font-size:13px;color:#fff;background:#fff}
.td-todo li.done .td-box{background:var(--dn);border-color:var(--dn)}
.td-todo li.done .tt{text-decoration:line-through;color:var(--sub2)}
.td-todo .tx{min-width:0;flex:1}
.td-todo .tt{font-size:15px;font-weight:600;line-height:1.45}
.td-todo .tt em{font-style:normal;color:var(--sub2);font-weight:700;margin-right:4px}
.td-todo .lv-no .tt{color:var(--text)}
.td-todo .ss{font-size:12.5px;color:var(--sub);line-height:1.5;margin-top:1px}
.td-todo details{font-size:12.5px;color:var(--sub);margin-top:2px}
.td-todo details summary{color:var(--brand);cursor:pointer;list-style:none;display:inline}
.td-todo details summary::-webkit-details-marker{display:none}
.td-todo details div{margin-top:3px;line-height:1.6;color:var(--text)}
.td-todo li.lock{cursor:pointer}.td-todo li.lock .td-box{border-style:dashed}
.td-none{font-size:16px;font-weight:700;color:var(--dn);padding:6px 0}
/* 表格：窄时三行一条，宽时一行一条 */
.td-tb{container-type:inline-size}
.td-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 10px;padding:8px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none;font-size:13.5px;line-height:1.5}
.td-row:first-child{border-top:0}
.td-row .nm{min-width:0}.td-row .nm b{font-size:14.5px}.td-row .nm small{color:var(--sub2);margin-left:5px;font-size:11.5px}
.td-row .px{text-align:right;white-space:nowrap}
.td-row .px>em{font-style:normal;margin-left:6px;font-size:12.5px}
.td-row .cd{grid-column:1/-1;color:var(--text);font-size:13px}
.td-row .zs{grid-column:1/-1;color:var(--sub);font-size:12px}
.td-row .zs span{white-space:nowrap;margin-right:12px}
.td-row .zs .lb{font-weight:400}
.td-th{display:none}
.td-tag{display:inline-block;font-size:11px;line-height:17px;padding:0 5px;border-radius:5px;font-weight:600;background:#f1f2f4;color:var(--sub);white-space:nowrap;margin-left:5px;vertical-align:1px}
.td-tag.buy{background:var(--up-bg);color:var(--up-t)}
.td-tag.new{background:#e8f1fc;color:#1d64b8}
.td-tag.s{background:#fff1e0;color:#b45a00}
.td-s .td-row .cd small{display:block;color:var(--sub);font-size:12px;line-height:1.45}
.td-s .aref{font-size:12px;color:var(--sub);margin:8px 0 0;line-height:1.55}
@container (min-width:520px){
  .td-th,.td-wait .td-row{display:grid;grid-template-columns:minmax(96px,1fr) 62px minmax(0,1.9fr) 90px 44px;gap:0 12px;align-items:center}
  .td-th{font-size:11.5px;color:var(--sub2);padding:0 0 4px;border-bottom:1px solid var(--line)}
  .td-th>:nth-child(2),.td-th>:nth-child(4),.td-th>:nth-child(5){text-align:right}
  .td-wait .td-row .nm small{display:block;margin:0;line-height:1.3}
  .td-wait .td-row .nm .td-tag{margin:2px 0 0}
  .td-wait .td-row .px>*{display:block;margin:0;line-height:1.35}
  .td-wait .td-row .cd{grid-column:auto;font-size:13px;line-height:1.45}
  .td-wait .td-row .zs{display:contents}
  .td-wait .td-row .zs span{margin:0;text-align:right;font-size:13px;color:var(--text)}
  .td-wait .td-row .zs span.st{color:var(--sub)}
  .td-wait .td-row .lb{display:none}
}
.td-note{font-size:12.5px;color:var(--sub);line-height:1.55;margin:0 0 6px;background:var(--soft);border-radius:8px;padding:6px 9px}
.td-combo{border-top:1px solid var(--line)}
.td-combo>summary{list-style:none;cursor:pointer}.td-combo>summary::-webkit-details-marker{display:none}
.td-combo>summary .td-row{border-top:0}
.td-combo .more{color:var(--brand);font-size:12.5px;white-space:nowrap}
.td-pl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 14px;padding:2px 0 10px;font-size:13px}
.td-pl a{display:flex;align-items:baseline;gap:4px;color:inherit;text-decoration:none;min-width:0;padding:3px 0;border-bottom:1px dotted var(--line)}
.td-pl a b{font-weight:600;white-space:nowrap}
.td-pl a small{color:var(--sub2);font-size:11px}.td-pl a .num{margin-left:auto;color:var(--sub)}
.td-pl .td-tag{margin-left:2px}
@container (max-width:420px){.td-pl a small{display:none}}
@container (min-width:520px){.td-pl{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container (min-width:760px){.td-pl{grid-template-columns:repeat(4,minmax(0,1fr))}}
/* 手里有的怎么办：左名称+现价，右动作+距离 */
.td-hold .td-row{align-items:start}
.td-hold .td-row .nm small{display:block;margin:0;line-height:1.35}
.td-hold .td-row .ac{font-weight:600;text-align:right;white-space:nowrap}
.td-hold .td-row .ac small{display:block;font-weight:400;font-size:11.5px;color:var(--sub);line-height:1.35}
.td-hold .td-row .ac small.near{color:var(--c-wait);font-weight:700}
.td-hold .td-row .ac.sell{color:var(--text)}
.td-hold details.more>summary{cursor:pointer;font-size:12.5px;color:var(--brand);padding:6px 0 0;list-style:none}.td-hold details.more>summary::-webkit-details-marker{display:none}
.td-foot{font-size:12px;color:var(--sub2);line-height:1.55;margin:6px 0 0}
/* 先别碰 */
.td-chips{display:flex;flex-wrap:wrap;gap:5px;margin:2px 0 8px}
.td-chips a{font-size:12.5px;padding:1px 8px;border-radius:12px;background:#eef0f3;color:var(--sub);white-space:nowrap;text-decoration:none}
.td-chips.br a{background:#e3e6ea;color:#4b5260}
.td-chip .lb{font-size:12.5px;color:var(--sub);margin:0}
/* 持仓 */
.td-lockc{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:12px 16px}
.td-lockc .ic{font-size:24px}.td-lockc .tx{flex:1;min-width:180px;font-size:13px;color:var(--sub);line-height:1.5}.td-lockc .tx b{color:var(--text);font-size:15px}
.td-lockc .fm{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.td-lockc input[type=password]{font-size:16px;padding:7px 11px;width:180px;border:1px solid var(--line);border-radius:10px}
.td-lockc button,.td-btn{font-size:14.5px;padding:7px 20px;border:0;border-radius:10px;background:var(--text);color:#fff;font-weight:600;cursor:pointer}
.td-lockc label{font-size:12px;color:var(--sub)}
.td-btn.ghost{background:#eceef2;color:var(--sub);font-size:12.5px;padding:4px 12px;margin:0}
#tdmsg{flex-basis:100%;margin:0;font-size:12.5px}#tdmsg:empty{display:none}
.td-hc{border-left:5px solid var(--c-wait)}.td-hc.lv-buy{border-left-color:var(--c-buy)}.td-hc.lv-no{border-left-color:var(--c-no)}
.td-hc .big{font-size:16px;font-weight:700;line-height:1.5}.td-hc .act{font-size:15.5px;font-weight:700;margin:6px 0}
.td-hc .act.lv-buy{color:var(--c-buy)}.td-hc .act.lv-wait{color:var(--c-wait)}.td-hc .act.lv-no{color:var(--text)}
.td-ln{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:baseline;font-size:13.5px;padding:6px 0;border-top:1px solid var(--line)}.td-ln>b:last-child{white-space:nowrap}
.td-kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0}.td-kv div{background:var(--soft);border-radius:8px;padding:6px 8px;font-size:12px;color:var(--sub)}.td-kv b{display:block;font-size:15px;color:var(--text)}
.td-rule{font-size:12.5px;color:var(--sub);line-height:1.6;margin:8px 0 0}
/* u22 动作行 */
.td-say>div{flex-wrap:wrap}
.td-say .capx{margin-left:auto;font-size:13px;color:var(--sub);white-space:nowrap}.td-say .capx b{font-size:17px;color:var(--text);letter-spacing:0}
.td-why{margin-top:2px;font-size:13px}.td-why>summary{cursor:pointer;color:var(--brand);list-style:none;font-size:13px}.td-why>summary::-webkit-details-marker{display:none}.td-why .td-dl{margin-top:6px}
.td-todo .tt{font-size:16.5px;font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.td-todo .tt a{color:var(--text)}
.vb{display:inline-block;min-width:30px;text-align:center;font-size:13.5px;font-weight:800;color:#fff;border-radius:6px;padding:0 6px;margin-right:7px;line-height:22px;vertical-align:1px;background:#7b828c}
.vb.v-buy{background:var(--up)}.vb.v-sell{background:var(--dn)}.vb.v-wait{background:var(--warn)}.vb.v-watch{background:#4b5260}.vb.v-no{background:#a3a9b1}
.td-todo .pv{display:flex;flex-wrap:wrap;gap:2px 14px;margin:3px 0 1px;font-size:13px;color:var(--sub)}
.td-todo .pv b{font-size:16px;color:var(--text);font-variant-numeric:tabular-nums}.td-todo .pv b.up{color:var(--up)}.td-todo .pv b.dn{color:var(--dn)}
.td-todo .ss{font-size:13px;color:var(--text);opacity:.85}
/* 底部折叠 */
.td-folds{display:flex;flex-direction:column;gap:8px;margin-top:18px}
.td-folds details{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:10px 14px}
.td-folds summary{cursor:pointer;font-size:14px;font-weight:600;color:var(--text)}
.td-folds .bd{font-size:13px;line-height:1.65;color:var(--sub);margin-top:6px}
.td-bad{margin:0;padding:0;list-style:none}.td-bad li{padding:7px 0;border-top:1px solid var(--line)}.td-bad li:first-child{border-top:0}
.td-bad b{display:block;color:var(--text)}
.td-folds ol{margin:0;padding-left:0;list-style:none}.td-folds ol li{padding:3px 0}
@media (min-width:900px){
  .td-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:14px;align-items:start}
  .td-l,.td-r{display:flex;flex-direction:column;gap:14px;min-width:0}
}
@media (max-width:600px){
  .td h1{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .td-cash{display:none}
  .td-dl dt{font-size:12.5px}
  .td-hero{padding:12px 13px 10px}
  .td-say b{font-size:20px}
  .td-dl{font-size:13px;gap:5px 8px}
  .td-kv{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;
    document.head.appendChild(st);
  }
  const f3 = (x) => (x == null ? "—" : (+x).toFixed(3));
  const f2 = (x, n = 2) => (x == null ? "—" : (+x).toFixed(n));
  const LVC = { buy: "c-buy", wait: "c-wait", no: "c-no" };
  const NO = "①②③④⑤⑥";

  // ---------- 结论卡（2026-11-24 u22：只留大字结论 + 仓位上限；为什么 / 改主意折叠，依据移到底部）
  function hero(P, D) {
    const H = P.hero || {}, ms = ["cn", "us"].filter((k) => H[k]);
    if (!ms.length) return `<div class="card td-hero">今天还没有报告结论。</div>`;
    const top = ms.some((k) => H[k].lv === "buy") ? "buy" : ms.some((k) => H[k].lv === "wait") ? "wait" : "no";
    const two = ms.length > 1;
    const by = (f) => ms.filter((k) => H[k][f]).map((k) => `<p>${two ? `<i>${esc(H[k].name)}</i>` : ""}${esc(H[k][f])}</p>`).join("");
    const chg = ms.map((k) => { const c = H[k].change || `等下一份报告（${H[k].next || "—"}）`; return `<p>${two ? `<i>${esc(H[k].name)}</i>` : ""}${esc(c)}</p>`; }).join("");
    return `<div class="card td-hero lv-${top}">
      <div class="td-say">${ms.map((k) => `<div><span class="mk">${esc(H[k].name)}</span><b class="${LVC[H[k].lv]}">${esc(H[k].say)}</b><span class="capx">仓位最多 <b>${esc(H[k].cap)}%</b></span></div>`).join("")}</div>
      <details class="td-why"><summary>为什么 · 什么时候改主意 ▸</summary>
      <dl class="td-dl"><dt>为什么</dt><dd>${by("why") || "<p>见报告原文</p>"}</dd>${ms.some((k) => H[k].s) ? `<dt>S 级</dt><dd>${by("s")}</dd>` : ""}<dt>改主意</dt><dd>${chg}</dd>
        <dt>仓位</dt><dd>${ms.map((k) => `${esc(H[k].name)}${k === "cn" ? "股票类" : ""} ≤ ${esc(H[k].cap)}%`).join("；")}，其余放现金</dd></dl></details></div>`;
  }
  const srcLine = (P, D) => {
    const H = P.hero || {}, ms = ["cn", "us"].filter((k) => H[k]);
    const src = ms.map((k) => `<a href="#/report/${esc(H[k].id)}">${esc(H[k].task.startsWith(H[k].name) ? H[k].task.replace(H[k].name, H[k].name + " ") : H[k].name + " " + H[k].task)} ${esc(H[k].at.slice(5))} ›</a>`).join(" · ");
    const nx = ms.filter((k) => H[k].next).map((k) => esc(H[k].next.replace(/^今天 /, ""))).join("、");
    return `依据：${src} · ${esc(D.built.slice(11))} 更新${nx ? ` · 下一份 ${nx}` : ""}`;
  };

  // ---------- 今天的动作（每条一行：买/卖/等/盯/不买 + 对象 + 价格 + 触发条件；原因折叠）
  const DK = "td_done";
  function doneSet(day) { try { const o = JSON.parse(localStorage.getItem(DK) || "{}"); return o.d === day ? new Set(o.k || []) : new Set(); } catch (e) { return new Set(); } }
  const p3 = (v) => (v == null ? "—" : v < 50 ? (+v).toFixed(3) : (+v).toFixed(2));
  const VB = { 买: "v-buy", 卖: "v-sell", 等: "v-wait", 盯: "v-watch", 不买: "v-no" };
  function actions(P, D, J) {
    const { stockLink } = A, H = P.hero || {}, done = doneSet(D.built.slice(0, 10)), R = [];
    const kv = (xs) => `<div class="pv">${xs.filter((x) => x[1] != null).map(([l, v, c]) => `<span>${l} <b class="${c || ""}">${v}</b></span>`).join("")}</div>`;
    const add = (k, vb, obj, px, when, why) => R.push({ k, vb, obj, px, when, why });
    // ① 今日一票（和首页大卡同一份 pick.json）
    const PK = J && J.pick;
    if (PK) {
      const c = PK.main, d = (PK.for_date || "").slice(5).replace("-", "/");
      if (c) add("pick", "买", `${stockLink(c.sym, c.name)} <span class="td-tag s">🎯 今日一票</span>`,
        kv([["买入区", `${p3(c.zone[0])}–${p3(c.zone[1])}`, "up"], ["目标", c.ex === "MA5" || c.ex === "MA5S" ? "站上 5 日线卖" : p3(c.t1), "up"], ["止损", c.stop ? p3(c.stop) : "不设", "dn"]]),
        `${d} 开盘在买入区内才买（高开不追），仓位 ${c.pos}%，最多拿 ${c.hold} 天`, `${esc(PK.headline || "")}<br>信号：${esc(c.sig_txt || "")}；${esc(c.ex_txt || "")}。<a href="#/pick">今日一票台账 ›</a>`);
      else add("pick", "不买", `🎯 今日一票：今天不买`, "", esc((PK.headline || "").slice(0, 40)), `${esc(PK.none_reason || PK.headline || "")} <a href="#/pick">详情 ›</a>`);
    }
    // ② S 级买点
    (P.sbuy || []).forEach((x) => add("sb_" + x.code, x.st === "ready" ? "买" : x.st === "missed" ? "不买" : "等", `${stockLink(x.code, x.name)} <span class="td-tag">S 级</span>`,
      kv([["买入区", `${f2(x.zone && x.zone[0])}–${f2(x.zone && x.zone[1])}`, "up"], ["止盈", f2(x.take), "up"], ["止损", f2(x.stop), "dn"]]),
      x.st === "ready" ? `现价 ${f2(x.px)} 在买入区内才买，单只 ≤ 10%，最多拿 ${esc(x.hold || 10)} 天` : esc(x.say || ""), `${esc((x.date || "").slice(5))} 收盘确认：${esc(x.why || "")}`));
    // ③ 卖：S 级卖点、已破位基金
    const ss = P.ssell || [];
    if (ss.length) add("ssell", "卖", ss.map((x) => stockLink(x.code, x.name)).join("、"), "", "手里有才卖：下一个交易日开盘卖", ss.map((x) => `${esc(x.name)}：${esc(x.why || "")}`).join("<br>"));
    const br = (P.chips || []).filter((x) => x.why === "破位");
    if (br.length) add("avoid", "卖", `已破位的 ${br.length} 个基金`, "", "手里有才卖（定投、长期配置不跟）", br.map((x) => stockLink(x.code, x.name)).join("、"));
    // ④ 手里的离止损很近（<1%）
    const near = (P.holds || []).filter((x) => x.kind === "stop" && x.dist < 1);
    if (near.length) add("near", "盯", near.map((x) => stockLink(x.code, x.name)).join("、"), kv(near.slice(0, 3).map((x) => [esc(x.name), `跌破 ${p3(x.stop)}`, "dn"])), "手里有的：收盘跌破就卖（离止损不到 1%）", "全部止损价见下面「手里有的怎么办」。");
    // ⑤ 等：板块
    const W = P.waits || [];
    if (W.length) add("waits", W.some((x) => x.ready) ? "买" : "等", W.slice(0, 3).map((x) => stockLink(x.code, x.name)).join("、") + (W.length > 3 ? ` 等 ${W.length} 个板块` : ""),
      kv(W.slice(0, 2).map((x) => [esc(x.name), `${p3(x.zone && x.zone[0])}–${p3(x.zone && x.zone[1])}`, "up"])), "到条件再买，每只的条件见下面「板块」表", W.map((x) => `${esc(x.name)}：${esc(x.cond)}`).join("<br>"));
    // ⑥ 市场改主意条件
    ["cn", "us"].filter((k) => H[k]).forEach((k) => {
      const h = H[k], c = (h.change || "").split("；")[0];
      if (h.lv === "no") add("mk_" + k, "不买", `${esc(h.name)}新仓`, "", c ? esc(c) : `等下一份报告（${esc(h.next || "—")}）`, esc(h.change || h.why || ""));
      else if (c) add("mk_" + k, "盯", `${esc(h.name)}止损线`, "", esc(c), esc(h.change));
    });
    const li = R.map((x) => `<li class="${done.has(x.k) ? "done" : ""}" data-k="${esc(x.k)}"><span class="td-box" role="checkbox" aria-checked="${done.has(x.k)}" tabindex="0">✓</span><div class="tx">
      <div class="tt"><span class="vb ${VB[x.vb] || ""}">${x.vb}</span>${x.obj}</div>${x.px || ""}${x.when ? `<div class="ss">${x.when}</div>` : ""}${x.why ? `<details><summary>为什么 ▸</summary><div>${x.why}</div></details>` : ""}</div></li>`).join("");
    const lock = `<li class="lock" data-go="tdhold-h"><span class="td-box"></span><div class="tx"><div class="tt"><span class="vb v-no">🔒</span>我的持仓：输入密码看要不要动</div></div></li>`;
    return `<div class="card td-todo"><div class="td-h"><b>今天的动作</b><span>做完点方框打勾</span></div>
      ${R.length ? "" : `<div class="td-none">今天什么都不用做 ✅</div>`}<ol>${li}${D.lock ? lock : ""}</ol></div>`;
  }
  function bindTodo(D) {
    const day = D.built.slice(0, 10);
    document.querySelectorAll(".td-todo li[data-k]").forEach((li) => {
      const bx = li.querySelector(".td-box");
      const flip = () => {
        const s = doneSet(day), k = li.dataset.k;
        s.has(k) ? s.delete(k) : s.add(k);
        li.classList.toggle("done", s.has(k)); bx.setAttribute("aria-checked", s.has(k));
        try { localStorage.setItem(DK, JSON.stringify({ d: day, k: [...s] })); } catch (e) {}
      };
      bx.onclick = flip; bx.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } };
    });
    document.querySelectorAll(".td-todo li[data-go]").forEach((li) => { li.onclick = () => document.getElementById(li.dataset.go)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }

  // ---------- S 级买点（market-pulse，右侧确认；推送规范 2.8）
  function sblock(P, D) {
    const B = P.sbuy || [], M = P.smeta || {}, al = D.alloc || {}, cn = (P.hero || {}).cn || {};
    const row = (x) => `<a class="td-row" href="${esc(x.href)}"><div class="nm"><b>${esc(x.name)}</b><small>${esc(x.code.replace(/^us/, ""))} · ${esc(x.ind || "")}</small>${x.st === "ready" ? '<span class="td-tag buy">现在可以买</span>' : `<span class="td-tag">${x.st === "missed" ? "错过不追" : x.st === "blocked" ? "今天不买" : "不在区间"}</span>`}</div>
      <div class="px"><span class="num">${f2(x.px)}</span><em class="num ${updn(x.pct)}">${x.pct == null ? "" : pct(x.pct, 2)}</em></div>
      <div class="cd">${esc(x.say)}<small>${esc((x.date || "").slice(5))} 收盘确认：${esc(x.why || "")}；止盈 ${f2(x.take)}（+${f2(x.take_pct, 1)}%），最多拿 ${esc(x.hold || 10)} 个交易日</small></div>
      <div class="zs"><span class="num"><b class="lb">买入 </b>${f2(x.zone && x.zone[0])}–${f2(x.zone && x.zone[1])}</span><span class="num st"><b class="lb">止损 </b>${f2(x.stop)}</span></div></a>`;
    const tot = al.s_total != null ? `今天 A股 S 级合计 ≤ ${f2(al.s_total, 0)}%（仓位上限 ${esc(al.cap)}% 的四成）。` : "";
    const rule = `只在确认后的下一个交易日、现价在买入区间内才买，错过不追；单只 ≤ 总资金 10%、按止损最多亏 0.5%，报告「等待确认」减半、「不推荐买入」不买。${tot}买了以后：跌到止损卖、到止盈卖、最多拿 10 个交易日，跌破 20 日线且转弱也卖。`;
    const bt = M.bt;
    const btl = bt ? `回测（A股执行池 ${bt.pool} 只，${esc(String(bt.from).slice(0, 4))}–${esc(String(bt.to).slice(0, 7))}）：${bt.n} 笔，赚钱的占 ${f2(bt.win * 100, 0)}%，每笔扣费后 ${pct(bt.avg * 100, 2)}，比直接拿着同一批股票每笔 ${pct(bt.ex * 100, 2)}；回撤小主要因为大部分时间空仓——是「看得懂的右侧信号」，不是「更准」。` : "";
    const A = (M.aref || []).filter((x) => x.status !== "expired");
    return `<div class="card td-wait td-s"><div class="td-h"><b>S 级买点（右侧，确认后才买）</b><span>点名字看走势</span></div>
      ${M.stale ? `<p class="td-note">⚠️ ${esc(M.stale_note || "数据没更新")}</p>` : ""}
      <p class="td-note">${esc(rule)}</p>
      ${B.length ? `<div class="td-tb"><div class="td-th"><span>名称</span><span>现价 / 今天</span><span>今天怎么做</span><span>买入价</span><span>止损</span></div>${B.map(row).join("")}</div>`
        : `<p class="muted">最近没有新确认的 S 级买点（A股 34 只、美股 58 只执行池，每天收盘后扫一遍）。现在 A股是「${esc(cn.word || "—")}」。</p>`}
      ${A.length ? `<p class="aref">A 级（条件少一项，只作参考、不买）：${A.map((x) => `${esc(x.name)} ${esc((x.date || "").slice(5))}`).join("、")}</p>` : ""}
      ${btl ? `<p class="td-foot">${btl}</p>` : ""}
      <p class="td-foot"><a href="stock/#/picks/cn">全部 S 级买卖点 ›</a>（A股 / 港股 / 美股、A 级参考、每只票的历史记录）</p></div>`;
  }

  // ---------- 等信号再买（板块；v2 组合 11-23 起不放这里）
  function waits(P, D) {
    const W = P.waits || [], cn = (P.hero || {}).cn || {};
    const anyReady = W.some((x) => x.ready);
    const row = (x) => `<a class="td-row" href="${esc(x.href)}"><div class="nm"><b>${esc(x.name)}</b><small>${esc(x.code)}</small>${x.ready ? '<span class="td-tag buy">现在可以买</span>' : ""}</div>
      <div class="px"><span class="num">${f3(x.price)}</span><em class="num ${updn(x.pct)}">${x.pct == null ? "" : pct(x.pct, 2)}</em></div>
      <div class="cd">${esc(x.cond)}</div><div class="zs"><span class="num"><b class="lb">买入 </b>${f3(x.zone && x.zone[0])}–${f3(x.zone && x.zone[1])}</span><span class="num st"><b class="lb">止损 </b>${f3(x.stop)}</span></div></a>`;
    const gate = anyReady ? "标了「现在可以买」的，条件已经齐了；其余等那一行自己的条件。" : `每一样都要等两件事：① 报告转「可以买」（现在 A股是「${esc(cn.word || "—")}」）；② 那一行写的条件。`;
    return `<div class="card td-wait"><div class="td-h"><b>${anyReady ? "板块：可以买 / 等信号再买" : "板块：等信号再买"}</b><span>点名字看走势</span></div>
      <p class="td-note">${gate}</p>
      <div class="td-tb"><div class="td-th"><span>名称</span><span>现价 / 今天</span><span>买的条件</span><span>买入价</span><span>止损</span></div>
      ${W.map(row).join("")}</div>
      ${W.length ? "" : '<p class="muted">今天没有在等的。</p>'}</div>`;
  }

  // ---------- 手里有的怎么办
  function holds(P) {
    const H = P.holds || [], ss = P.ssell || [], av = (P.chips || []).filter((x) => x.why === "破位");
    const half = H.filter((x) => x.kind === "half"), stops = H.filter((x) => x.kind === "stop");
    const r = (x) => `<a class="td-row" href="${esc(x.href)}"><div class="nm"><b>${esc(x.name)}</b><small>现价 ${f3(x.price)}</small></div>
      <div class="ac">${esc(x.act)}<small class="${x.kind === "stop" && x.dist < 2 ? "near" : ""}">${x.kind === "stop" ? (x.dist < 0.05 ? "就在线上，盯收盘" : `离止损还差 ${f2(x.dist, 1)}%`) : `还要涨 ${f2(x.dist, 1)}%`}</small></div></a>`;
    const SHOW = 5;
    const rows = [];
    if (av.length) rows.push(`<div class="td-row"><div class="nm"><b>已破位的 ${av.length} 个基金</b><small>名单见「先别碰」深色那行</small></div><div class="ac sell">卖掉<small>破位就不拿</small></div></div>`);
    ss.forEach((x) => rows.push(`<a class="td-row" href="${esc(x.href)}"><div class="nm"><b>${esc(x.name)}</b><span class="td-tag s">S 级卖点</span><small>${esc((x.date || "").slice(5))} 收盘 ${f2(x.price)} · ${esc(x.ind || "")}</small></div><div class="ac sell">下个交易日开盘卖<small>四项全部转弱</small></div></a>`));
    half.forEach((x) => rows.push(r(x)));
    stops.slice(0, SHOW).forEach((x) => rows.push(r(x)));
    const rest = stops.slice(SHOW);
    return `<div class="card td-hold"><div class="td-h"><b>手里有的怎么办</b><span>没有就跳过</span></div>
      <div class="td-tb">${rows.join("") || '<p class="muted">今天没有要卖或要减的。</p>'}</div>
      ${rest.length ? `<details class="more"><summary>其余 ${rest.length} 个的止损价 ▾</summary><div class="td-tb">${rest.map(r).join("")}</div></details>` : ""}
      <p class="td-foot">只管照 S 级买点 / 板块看板买进的仓位；S 级卖点只看 market-pulse 执行池（A股 34 只 + 美股 58 只），没持有的不用管；定投、长期配置按财富规划走。止损价看收盘价、每天跟着价格重算；报告里给模拟账户写的价可能差几厘，不一样时以最新报告为准。</p></div>`;
  }

  // ---------- 先别碰
  function chips(P) {
    const C = P.chips || [], wk = C.filter((x) => x.why === "走弱"), br = C.filter((x) => x.why === "破位");
    if (!C.length) return "";
    const cl = (xs) => xs.map((x) => `<a href="${esc(x.href)}">${esc(x.name.replace(/ETF$/, ""))}</a>`).join("");
    return `<div class="card td-chip"><div class="td-h"><b>先别碰</b><span>不买；点开看原因</span></div>
      ${wk.length ? `<p class="lb">走弱 ${wk.length} 个（还没跌破止损，不买）</p><div class="td-chips">${cl(wk)}</div>` : ""}
      ${br.length ? `<p class="lb">已破位 ${br.length} 个（不买，照看板买进的卖掉）</p><div class="td-chips br">${cl(br)}</div>` : ""}</div>`;
  }

  // ---------- 底部折叠
  function folds(D) {
    const P = D.page || {}, V = D.v2 || {}, S = D.sector || {}, bt = S.bt || {}, cn = (D.pos || {}).cn || {}, us = (D.pos || {}).us || {};
    const sb = (P.smeta || {}).bt;
    const why = `<p style="margin:0 0 6px">上面只放两样东西：<b>S 级买卖点</b>（老大认可的 market-pulse 右侧信号${sb ? `；回测 ${esc(String(sb.from).slice(0, 4))} 年起 ${sb.n} 笔、每笔扣费后 ${pct(sb.avg * 100, 2)}、比同一批股票直接拿着每笔 ${pct(sb.ex * 100, 2)}、组合最大回撤 ${pct(sb.mdd * 100, 1)}（平均只用 ${f2(sb.util * 100, 0)}% 的钱），右侧、名字都认识、亏得少，但不比拿着强，所以不加仓位上限` : ""}）；
      <b>板块分区</b>（${bt.from ? `${esc(bt.from.slice(0, 7))}~${esc(String(bt.to || "").slice(0, 7))} ` : ""}进买入区后买 ${bt.n || "—"} 次，平均每次 ${bt.mean == null ? "—" : pct(bt.mean, 2)}、赚钱的占 ${bt.win == null ? "—" : f2(bt.win, 0)}%，统计上站得住）。
      能买多少、今天能不能买，只看最新一份报告的结论。<a href="#/sectors">板块看板 ›</a></p>
      <p style="margin:6px 0 2px"><b>测试中（不作为买卖依据）</b>：A股选股组合 v2（样本外比同一批股票每年多 ${V.excess == null ? "—" : pct(V.excess, 1)}，但不显著；老大 11-23：名字陌生、准确率感受差）。<a href="stock/#/picks/cn">去研究区看 ›</a></p>
      <p style="margin:6px 0 2px">下面这些检验过，<b>没用</b>（页面还在「研究区」，只用来学习，不当买卖依据）：</p>
      <ul class="td-bad">${(D.invalid || []).map((x) => `<li><b><a href="${esc(x.href)}">${esc(x.name)} ›</a></b>${esc(x.res)}${x.date ? `（截至 ${esc(x.date)}）` : ""}</li>`).join("")}</ul>`;
    const pri = D.verdict ? `<ol>${D.verdict.priority.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "";
    const tm = `<p style="margin:0 0 4px">${srcLine(P, D)}</p><ol><li>A股结论：${esc(cn.task || "—")} ${esc(cn.at || "—")} 报告，数据 ${esc(cn.dtime || "—")}</li><li>美股结论：${esc(us.task || "—")} ${esc(us.at || "—")} 报告，数据 ${esc(us.dtime || "—")}</li>
      <li>板块分区：${esc(S.date || "—")}（${esc(P.sector_at || "—")} 算；盘中算的到收盘会变）</li><li>S 级买卖点：market-pulse ${esc((P.smeta || {}).scanned_at || "—")} 扫描，${esc((P.smeta || {}).built || "—")} 导出${(P.smeta || {}).stale ? "（服务没连上，沿用旧结果）" : ""}；A 级是本机按同一规则复算</li>
      <li>本页：${esc(D.built)} 生成；持仓提醒是老大确认的持仓记录 + 腾讯行情，加密后才上网站</li></ol>`;
    return `<div class="td-folds">
      <details><summary>🧪 为什么只看这几样（检验过没用的信号）▸</summary><div class="bd">${why}</div></details>
      <details><summary>⚖️ 说法打架时听谁的 ▸</summary><div class="bd">${pri}</div></details>
      <details><summary>⏱ 数据依据与时点 ▸</summary><div class="bd">${tm}</div></details></div>`;
  }

  // ---------- 加密区（与财富规划 build.py 同口径：openssl Salted__ + PBKDF2-SHA256 20 万次 → AES-256-CBC key+iv）
  async function dec(D64, pw) {
    const raw = Uint8Array.from(atob(D64), (c) => c.charCodeAt(0)), salt = raw.slice(8, 16), ct = raw.slice(16);
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, k, 384));
    const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-CBC", false, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-CBC", iv: bits.slice(32, 48) }, key, ct));
  }
  const LK = "xbw"; // 与财富规划页同一个键（同域名下记住一次两边都能开）
  const CC = { yes: "lv-buy", wait: "lv-wait", no: "lv-no" };
  function lockBox(D) {
    if (!D.lock) return `<div class="card muted">持仓提醒今天没有生成（${esc(D.lock_note || "数据缺失")}）。</div>`;
    return `<div class="card td-lockc" id="tdlock"><span class="ic">🔒</span><div class="tx">只有老大能看：内容加密，输入密码后在这台设备上解开（和「财富规划」同一个密码）。</div>
      <div class="fm"><input id="tdpw" type="password" placeholder="输入密码" autocomplete="current-password"><button id="tdgo">查看</button>
      <label><input type="checkbox" id="tdrm" checked> 记住</label></div><p id="tdmsg"></p></div>`;
  }
  function holdHTML(B) {
    return B.rows.map((r) => {
      const ln = r.lines.map((l) => {
        const t = l.hit ? "已触发" : l.k === "prot" ? `还要跌 ${f2(l.dist, 1)}%` : `还要涨 ${f2(l.dist, 1)}%`;
        return `<div class="td-ln"><b>${esc(l.name)} $${esc(l.px)}</b><span class="muted">${esc(l.say)}</span><b class="${l.hit ? "up" : l.k === "prot" && l.dist < 5 ? "dn" : ""}">${t}</b></div>`;
      }).join("");
      return `<div class="card td-hc ${CC[r.cls] || "lv-wait"}"><div class="big">${esc(r.name)}：${esc(r.one)}</div>
        ${r.live ? `<div class="muted small">最新 $${f2(r.live.px)}（美东 ${esc(r.live.t)}）；只看收盘价，盘中跌破不算</div>` : ""}
        <div class="act ${CC[r.cls] || "lv-wait"}">👉 今天：${esc(r.act)}</div>${ln}
        <div class="td-kv"><div>持有<b>${esc(r.shares)} 股</b></div><div>成本<b>$${f2(r.cost)}</b></div><div>市值<b>$${f2(r.mv, 0)}</b></div><div>浮动盈亏<b class="${updn(r.pnl)}">${r.pnl >= 0 ? "+" : "−"}$${f2(Math.abs(r.pnl), 0)}（${pct(r.pnl_pct, 1)}）</b></div></div>
        <div class="td-rule">📜 计划原文（老大定的，这里不改）：<br>${r.rules.map(esc).join("<br>")}</div></div>`;
    }).join("") + `<p class="muted small">${esc(B.note)}　<a href="${esc(B.wealth)}" target="_blank" rel="noopener">财富规划 ›</a><br>⏱ ${esc(B.asof)} 计算；来源：${esc(B.src)}。　<button class="td-btn ghost" id="tdoff">锁上</button></p>`;
  }
  function bindLock(D, tok) {
    const box = document.getElementById("tdlock");
    if (!box) return;
    const open = async (pw, auto) => {
      try {
        const B = JSON.parse(await dec(D.lock, pw));
        if (!A.alive(tok)) return;
        if (!auto && document.getElementById("tdrm")?.checked !== false) localStorage.setItem(LK, pw);
        const wrap = document.getElementById("tdhold");
        wrap.innerHTML = holdHTML(B);
        document.getElementById("tdoff").onclick = () => { localStorage.removeItem(LK); wrap.innerHTML = lockBox(D); bindLock(D, tok); };
      } catch (e) {
        if (auto) { localStorage.removeItem(LK); return; }
        const m = document.getElementById("tdmsg"); if (m) { m.textContent = window.crypto && crypto.subtle ? "密码不对" : "这个浏览器不支持解密（需要 https）"; m.style.color = "var(--up)"; }
      }
    };
    document.getElementById("tdgo").onclick = () => open(document.getElementById("tdpw").value);
    document.getElementById("tdpw").onkeydown = (e) => { if (e.key === "Enter") open(e.target.value); };
    const saved = localStorage.getItem(LK);
    if (saved) open(saved, true);
  }

  async function page() {
    const tok = A.tok();
    document.title = "今天我该做什么 · 小七投研";
    let D, J = null;
    try { [D, J] = await Promise.all([getJSON("todo.json", true), getJSON("pick.json", true).catch(() => null)]); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>今天我该做什么</h1>${FAIL("今天的清单还没生成（每份报告推送后更新）")}`; return; }
    if (!A.alive(tok)) return;
    const P = D.page;
    if (!P) { app.innerHTML = `<h1>今天我该做什么</h1>${FAIL("清单格式是旧版，等下一次更新")}`; return; }
    app.innerHTML = `<div class="td"><h1>今天我该做什么</h1>
      <div class="td-grid"><div class="td-l">${hero(P, D)}${actions(P, D, J)}${chips(P)}</div><div class="td-r">${sblock(P, D)}${waits(P, D)}${holds(P)}</div></div>
      <h2 id="tdhold-h">🔒 我的持仓提醒</h2><div id="tdhold">${lockBox(D)}</div>
      ${folds(D)}
      ${DISC}</div>`;
    bindTodo(D);
    bindLock(D, tok);
  }
  window.__mod_todo = { page };
})();
