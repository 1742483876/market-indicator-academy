/* 人气榜剖析 #/hot（按需加载）。数据：hot_rank.py → hot.json（同花顺人气前 20 + 为什么上榜 + 接下来看多/看空/观望 + 热门概念 × 板块全景 + 飙升榜 + 检验结论）。
   「接下来」只有白名单信号（S 级 / 短线结论 / ≥5 板不追）才写看多/看空，其余一律「观察（未经检验）」。手机：紧凑列表、无横向滚动；点一行展开细节，点名字进个股页。 */
(function () {
  const A = window.__APP;
  const { app, esc, pct, updn, FAIL, DISC, getJSON } = A;
  if (!document.getElementById("hr-css")) {
    const st = document.createElement("style");
    st.id = "hr-css";
    st.textContent = `
.hr{font-variant-numeric:tabular-nums}
.hr-meta{font-size:12.5px;color:var(--sub);margin:2px 0 12px;line-height:1.6}
.hr-one{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--text);border-radius:0 var(--r) var(--r) 0;padding:12px 15px;margin:0 0 8px}
.hr-one p{margin:3px 0;font-size:15px;line-height:1.7}
.hr-sec{display:flex;align-items:baseline;gap:4px 10px;flex-wrap:wrap;margin:24px 0 10px}.hr-sec h2{margin:0;font-size:18px}.hr-sec em{font-style:normal;font-size:12.5px;color:var(--sub)}
.hr-list{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.hr-hd,.hr-r{display:grid;grid-template-columns:34px 112px 62px minmax(0,1fr) minmax(0,1.05fr);gap:10px;align-items:start;padding:9px 12px}
.hr-hd{font-size:12px;color:var(--sub);background:var(--soft);border-bottom:1px solid var(--line);font-weight:600}
.hr-r{border-bottom:1px solid var(--line);cursor:pointer}.hr-r:last-of-type{border-bottom:0}
.hr-r:hover{background:#fafbfc}
.hr-rk{font-weight:700;color:var(--sub);font-size:15px}
.hr-nm a{font-weight:700;color:var(--text);font-size:15px;white-space:nowrap}.hr-nm div{font-size:11.5px;color:var(--sub2)}
.hr-p{font-weight:700;font-size:15px;text-align:right;white-space:nowrap}.hr-p.up{color:var(--up)}.hr-p.dn{color:var(--dn)}
.hr-why{font-size:13.5px;line-height:1.55;color:var(--text);min-width:0;overflow-wrap:anywhere}
.hr-nx{font-size:13px;line-height:1.55;min-width:0;overflow-wrap:anywhere;color:var(--sub)}
.hr-v{display:inline-block;font-size:12px;font-weight:700;line-height:19px;padding:0 7px;border-radius:6px;margin-right:4px;white-space:nowrap}
.hr-v.d-看多{background:var(--up-bg);color:var(--up-t)}.hr-v.d-看空{background:var(--dn-bg);color:var(--dn-t)}.hr-v.d-等条件{background:var(--warn-bg);color:var(--warn-t)}.hr-v.d-观望{background:#eef0f3;color:#4b5563}
.hr-w{font-size:11px;color:var(--sub2);white-space:nowrap}
.hr-x{grid-column:1/-1;display:none;font-size:13px;line-height:1.7;color:var(--text);background:var(--soft);border-radius:8px;padding:8px 11px;margin-top:2px}
.hr-r.open .hr-x{display:block}.hr-x div{margin:2px 0}.hr-x b{color:var(--sub);font-weight:600;margin-right:4px}
.hr-tag{display:inline-block;font-size:11.5px;line-height:18px;padding:0 6px;border-radius:5px;background:#f1f2f4;color:var(--sub);font-weight:600;white-space:nowrap;margin:0 3px 2px 0}
.hr-pl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hr-pl>*{min-width:0}
.hr-pc{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:10px 13px}
.hr-pc .t{display:flex;justify-content:space-between;gap:8px;font-weight:700;font-size:15px}.hr-pc .s{font-size:12.5px;color:var(--sub);line-height:1.6;margin-top:2px}
.hr-ok{color:var(--up-t);font-weight:700}.hr-no{color:var(--sub2)}
.hr-lab{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 15px;font-size:14px;line-height:1.75}
.hr-lab .k{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}.hr-lab .k div{background:var(--soft);border-radius:8px;padding:7px 10px;font-size:12.5px;color:var(--sub)}.hr-lab .k b{display:block;font-size:18px;color:var(--text)}
@media (max-width:760px){
 .hr-hd{display:none}
 .hr-r{grid-template-columns:24px minmax(0,1fr) auto;gap:2px 8px;padding:10px 11px}
 .hr-rk{grid-row:1;font-size:14px;padding-top:1px}.hr-nm{grid-column:2}.hr-p{grid-column:3;grid-row:1}
 .hr-nm div{display:inline;margin-left:6px}
 .hr-why{grid-column:2/4;font-size:13px;color:var(--sub);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .hr-r.open .hr-why{display:block}
 .hr-nx{grid-column:2/4;font-size:12.5px}
 .hr-pl{grid-template-columns:1fr}.hr-lab .k{grid-template-columns:1fr 1fr 1fr;gap:6px}.hr-lab .k b{font-size:16px}
}`;
    document.head.appendChild(st);
  }
  const stockUrl = (sym) => `stock/#/s/${encodeURIComponent(sym)}`;
  const yi = (v) => (v == null ? "—" : (v >= 0 ? "+" : "") + (v / 1e8).toFixed(2) + " 亿");
  const p2 = (v) => (v == null ? "—" : Number(v).toFixed(2));
  function row(r) {
    const v = r.v || {}, k = r.k || {}, n = r.news;
    const x = [];
    x.push(`<div><b>人气</b>同花顺第 ${r.rank}${r.chg ? `（较上期 ${r.chg > 0 ? "+" : ""}${r.chg}）` : ""}｜${r.em_rank ? `东财第 ${r.em_rank}` : "东财不在前 100"}${r.em_streak ? `，连续 ${r.em_streak} 天在东财前 100` : ""}${r.ptag ? `｜${esc(r.ptag)}` : ""}</div>`);
    if ((r.concepts || []).length) x.push(`<div><b>概念</b>${r.concepts.map((c) => `<span class="hr-tag">${esc(c)}</span>`).join("")}</div>`);
    if (r.analyse) x.push(`<div><b>同花顺解读（AI 生成）</b>${esc(r.analyse.replace(/\n/g, " ").slice(0, 260))}${r.analyse.length > 260 ? "…" : ""}</div>`);
    x.push(`<div><b>最新消息</b>${n && n.title ? `${esc(n.title)} <span class="hr-w">${esc(n.src || "")} ${esc(n.time || "")}</span>` : "近 4 天没找到相关新闻"}</div>`);
    x.push(`<div><b>资金</b>主力净流入 ${yi(r.ff)}${r.lhb ? `｜龙虎榜：${esc(r.lhb.why)}，净买 ${yi(r.lhb.net)}` : ""}${r.unlock && r.unlock.ratio >= 0.01 ? `｜⚠️ ${esc(r.unlock.date)} 解禁约占流通盘 ${(r.unlock.ratio * 100).toFixed(1)}%` : ""}</div>`);
    if (k.close) x.push(`<div><b>价位</b>现价 ${p2(k.close)}，20 日线 ${p2(k.ma20)}，近 5 天 ${pct(k.r5, 0)}、近 20 天 ${pct(k.r20, 0)}${k.zone ? `｜回踩参考 ${p2(k.zone[0])}–${p2(k.zone[1])}、参考止损 ${p2(k.stop)}（个股不在检验池，只作参考）` : ""}</div>`);
    if (r.etf) x.push(`<div><b>对应板块基金</b>${esc(r.etf.name)}（${esc(r.etf.code)}）${r.etf.ok ? '<span class="hr-ok">走势健康</span>' : '<span class="hr-no">走势未成</span>'} ${esc(r.etf.status || "")}</div>`);
    x.push(`<div><b>接下来</b>${esc(v.dir || "")}｜${esc(v.word || "")}——${esc(v.basis || "")}（${v.wl ? "✅ 检验过的信号：" : "⚪ 未经检验："}${esc(v.src || "")}）</div>`);
    return `<div class="hr-r" data-r="${r.rank}">
      <div class="hr-rk">${r.rank}</div>
      <div class="hr-nm"><a href="${stockUrl(r.sym)}" onclick="event.stopPropagation()">${esc(r.name)}</a><div>${esc(r.code)}</div></div>
      <div class="hr-p ${updn(r.pct)}">${pct(r.pct, 1)}</div>
      <div class="hr-why">${esc(r.why || "")}</div>
      <div class="hr-nx"><span class="hr-v d-${esc(v.dir)}">${esc(v.dir)}</span>${esc(v.word || "")}<span class="hr-w">${v.wl ? " ✅" : " ⚪未经检验"}</span><br>${esc((v.basis || "").slice(0, 70))}${(v.basis || "").length > 70 ? "…" : ""}</div>
      <div class="hr-x">${x.join("")}</div></div>`;
  }
  function plate(c) {
    const o = c.ours;
    return `<div class="hr-pc"><div class="t"><span>${c.rank}. ${esc(c.name)}</span><span class="${updn(c.pct)}" style="color:var(--${c.pct >= 0 ? "up" : "dn"})">${pct(c.pct, 2)}</span></div>
      <div class="s">${esc(c.tag || "")} ${esc(c.hot || "")}${c.flow != null ? `｜主力 ${c.flow >= 0 ? "+" : ""}${c.flow.toFixed(1)} 亿` : ""}</div>
      <div class="s">${o ? `${o.ok ? '<span class="hr-ok">✅ ' : '<span class="hr-no">× '}${esc(o.name)}</span>：${esc(o.status || "")}` : `同花顺挂钩 ${esc(c.etf || "—")}（不在我们 27 只板块基金里）`}</div></div>`;
  }
  async function page() {
    const tok = A.tok();
    document.title = "人气榜剖析 · 小七投研";
    let J;
    try { J = await getJSON("hot.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>人气榜剖析</h1>${FAIL("人气榜数据还没生成（工作日 12:00、15:40 更新）")}`; return; }
    if (!A.alive(tok)) return;
    const S = J.sum || {}, L = J.lab, st = J.state || {};
    const one = [];
    one.push(`🗣 大家最关注：<b>${esc(J.rows.slice(0, 5).map((r) => r.name).join("、"))}</b>；热门方向 ${esc((S.themes || []).join("、"))}。`);
    one.push(S.bull && S.bull.length ? `✅ 有检验过买点的：<b>${esc(S.bull.join("、"))}</b>（看下面「接下来」的买入区和止损）。` : "✅ 榜上今天<b>没有</b>一只出现检验过的买点——上榜本身不是买入理由。");
    if (S.cond && S.cond.length) one.push(`⏳ 有条件单：${esc(S.cond.join("、"))}（条件不满足就不买）。`);
    if (S.avoid && S.avoid.length) one.push(`⛔ 最挤、别追：${esc(S.avoid.join("、"))}。`);
    if (L) one.push(`🤔 为什么不追：过去一年人气前 20 第二天买、拿两周平均 <b class="dn">${pct(L.t20_10, 1)}</b>，只有 ${L.t20_10_win}% 赚钱；随便买一只 ${pct(L.rnd_10, 1)}。`);
    one.push(S.ok_etf && S.ok_etf.length ? `🧩 想跟热门方向，看板块基金：${esc(S.ok_etf.join("、"))} 走势健康。` : "🧩 热门方向对应的板块基金今天没有走势健康的。");
    app.innerHTML = `<div class="hr">
      <h1>人气榜剖析</h1>
      <div class="hr-meta">同花顺人气榜 · ${esc(J.session)} · 数据 ${esc((J.at || "").slice(5))}${J.session === "盘中版" ? "（上午数据，以 15:40 收盘版为准）" : ""}｜大盘总状态「${esc(st.state || "—")}」，仓位上限 ${st.cap != null ? st.cap + "%" : "—"}｜同花顺前 20 与东财前 20 重合 ${J.overlap ? J.overlap.n : "—"} 只</div>
      <div class="hr-one">${one.map((x) => `<p>${x}</p>`).join("")}</div>
      <div class="hr-sec"><h2>人气前 ${J.rows.length}</h2><em>点一行看上榜理由、消息、资金、价位；点名字进个股页。✅ = 检验过的信号，⚪ = 未经检验只能观察</em></div>
      <div class="hr-list"><div class="hr-hd"><div>名次</div><div>股票</div><div style="text-align:right">涨跌</div><div>为什么上榜</div><div>接下来</div></div>${J.rows.map(row).join("")}</div>
      <div class="hr-sec"><h2>热门概念 × 板块全景</h2><em>热不等于能买：✅ 对应板块基金走势健康才可能买</em></div>
      <div class="hr-pl">${(J.concept || []).slice(0, 10).map(plate).join("")}</div>
      <div class="hr-sec"><h2>飙升榜</h2><em>关注度涨得最快，多是当天突发消息</em></div>
      <div class="hr-list">${(J.soar || []).map((s) => `<div class="hr-r" style="cursor:default"><div class="hr-rk">${s.rank}</div><div class="hr-nm"><a href="${stockUrl(s.sym)}">${esc(s.name)}</a><div>${esc(s.code)}</div></div><div class="hr-p ${updn(s.pct)}">${pct(s.pct, 1)}</div><div class="hr-why">${esc(s.ptag ? s.ptag + "，" : "")}${esc(s.title || (s.concepts || []).slice(0, 2).join("/"))}</div><div class="hr-nx">${s.chg ? `名次${s.chg > 0 ? "上升 " + s.chg : "下降 " + (-s.chg)}` : ""}</div></div>`).join("")}</div>
      ${L ? `<div class="hr-sec"><h2>上了人气榜之后会怎样</h2><em>东财人气榜 ${esc(L.start)}~${esc(L.end)} 检验</em></div>
      <div class="hr-lab">第二天开盘买、拿两周（扣成本）：
        <div class="k"><div>人气前 20<b class="dn">${pct(L.t20_10, 1)}</b></div><div>随便买一只<b>${pct(L.rnd_10, 1)}</b></div><div>比随便买<b class="dn">${pct(L.t20_ex10, 1)}</b></div></div>
        上榜股、涨停股都一样跑输（涨停股随便买比随便买 ${pct(L.zt_ex10, 1)}）；「拥挤」和「掉榜」也没有更差，只当提示。所以这页的「看多」只来自 S 级买卖点、短线结论这些检验过的信号。
        <a href="#/labs/hot_rank">看完整检验 ›</a></div>` : ""}
      <p class="muted small">数据：同花顺热榜（个股/飙升/概念，含 AI 解读）、东方财富人气榜与个股新闻、东财实时主力资金、龙虎榜（${esc(J.lhb_date || "最近一期")}）、限售解禁（未来 30 天）；板块全景 ${esc(J.sector_date || "—")}。工作日 12:00（盘中）、15:40（收盘）更新。</p>
      ${DISC}</div>`;
    app.onclick = (e) => { const r = e.target.closest(".hr-r[data-r]"); if (r) r.classList.toggle("open"); };
  }
  window.__mod_hot = { page };
})();
