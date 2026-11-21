/* 指标买卖条件（按需加载）：rules.json（academy/build_rules.py 生成）→ 看板 / 回测 / 学堂 / 今日页共用的渲染。
   口径 = 回测中心买入区（打分 ≥0.5）/ 卖出区（≤−0.5），换成原始值；分位类阈值每天随窗口滚动。 */
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const zc = (z) => (z === "买入区" ? "zb" : z === "卖出区" ? "zs" : "zm");
  const MK = { cn: "A股", us: "美股" };
  const st = document.createElement("style");
  st.textContent = `
.rcard{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0;background:var(--card,#fff)}
.rcard .rh{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}.rcard .rh b{font-size:15px}
.rcard .dtag{font-size:11.5px;border-radius:6px;padding:0 6px;background:#eef2ff;color:#4338ca;font-weight:600;line-height:1.7}
.rrow{display:grid;grid-template-columns:5em 1fr;gap:6px;padding:5px 0;border-top:1px dashed var(--line);font-size:13.5px;line-height:1.6}
.rrow>span{color:var(--sub);font-size:12.5px;padding-top:1px}.rrow .rb{color:#c81e1e;font-weight:700}.rrow .rs{color:#15803d;font-weight:700}
.rrow em{font-style:normal;color:var(--sub);font-size:12px}
.rwarn{background:#fff7e6;border-radius:8px;padding:6px 9px;font-size:12.5px;color:#92400e;margin:6px 0 2px;line-height:1.55}
.rmeta{font-size:11.5px;color:var(--sub);margin-top:6px;line-height:1.5}
.rmini{font-size:11.5px;line-height:1.5;margin:4px 0 2px;padding:4px 6px;border-radius:6px;background:#f7f8fa}
.rmini .rb{color:#c81e1e;font-weight:600}.rmini .rs{color:#15803d;font-weight:600}.rmini .rw{color:#b45309}
.rlist{display:grid;gap:6px}.rli{display:flex;gap:8px;align-items:baseline;font-size:13px;line-height:1.55;text-decoration:none;color:inherit}
.rli b{white-space:nowrap}.rli .muted{font-size:12px}
.rcol h4{margin:8px 0 4px;font-size:13px}.rcol+.rcol{border-top:1px solid var(--line);margin-top:8px;padding-top:4px}
.rgrp{display:grid;grid-template-columns:5.4em 1fr;gap:6px;margin:6px 0;font-size:12.5px}.rlab{font-weight:600;padding-top:3px}
.rchip{display:inline-block;margin:0 6px 6px 0;padding:3px 8px;border-radius:8px;background:#f7f8fa;border-left:3px solid #c3c8cf;text-decoration:none;color:inherit;line-height:1.45}
.rchip.good{border-left-color:#e5484d}.rchip.warn{border-left-color:#f59e0b}.rchip em{display:block;font-style:normal;color:var(--sub);font-size:11.5px}`;
  document.head.appendChild(st);

  const find = (R, mk, name) => (R && R[mk] ? R[mk].items.find((x) => x.name === name) : null);
  const vb = (x) => `<span class="vb ${esc(x.cls)}">回测：${esc(x.verdict)}</span>`;
  const agreeTxt = (x, R, mk) => (x.agree ? `原始值条件与回测买入/卖出区逐日核对 ${x.agree.days} 天，一致率 ${x.agree.rate}%` : "");

  // 完整卡片：买入条件 / 卖出条件 / 今天离触发多远 / 触发后怎么做
  function card(x, mk, R, opt = {}) {
    if (!x) return "";
    const strong = (s) => (s ? `<br><em>更强：${esc(s)}</em>` : "");
    return `<div class="rcard">
      <div class="rh">${opt.title !== false ? `<b>${opt.withMk ? MK[mk] + "·" : ""}${esc(x.name)}</b>` : ""}<span class="dtag">${esc(x.dir)}：${esc(x.dir_t)}</span>${vb(x)}<span class="zt ${zc(x.rule_zone)}">今天 ${esc(x.rule_zone)}</span></div>
      ${x.conflict ? `<div class="rwarn">⚠️ ${esc(x.conflict)}</div>` : ""}
      <div class="rrow"><span>🔴 买入</span><div><span class="rb">${esc(x.cond_buy)}</span>${strong(x.strong_buy)}</div></div>
      <div class="rrow"><span>🟢 卖出</span><div>${x.cond_sell ? `<span class="rs">${esc(x.cond_sell)}</span>${strong(x.strong_sell)}` : '<em>没有卖出区</em>'}</div></div>
      <div class="rrow"><span>📍 今天</span><div>${esc(x.next)}<br><em>数据 ${esc(x.date)}${x.pct != null ? ` · 近 ${x.w} 日分位 ${x.pct}%` : ""}</em></div></div>
      <div class="rrow"><span>进买入区<br>怎么做</span><div>${esc(x.do_buy)}</div></div>
      <div class="rrow"><span>进卖出区<br>怎么做</span><div>${esc(x.do_sell)}</div></div>
      ${opt.full ? `<div class="rrow"><span>机械做法</span><div class="small">${esc(x.strat)}</div></div><div class="rrow"><span>怎么算</span><div class="small">${esc(x.how)}</div></div>` : ""}
      <div class="rmeta">✔ ${esc(agreeTxt(x))}（买入区 = 回测打分 ≥0.5，卖出区 ≤−0.5）。${x.zone_note ? esc(x.zone_note) : ""}${opt.link !== false ? ` <a href="#/backtest/${mk}/i/${encodeURIComponent(x.name)}">回测详情 ›</a>` : ""}</div>
    </div>`;
  }

  // 看板卡片里的一小行
  function mini(x) {
    if (!x) return "";
    const g = x.rule_zone === "买入区" ? "已在买入区" : `离买入：${x.gap_buy}`;
    return `<div class="rmini"><span class="rb">买</span> ${esc(x.buy_s)}${x.sell_s ? `　<span class="rs">卖</span> ${esc(x.sell_s)}` : ""}<br>
      <span class="zt ${zc(x.rule_zone)}">回测口径 ${esc(x.rule_zone)}</span> ${esc(g)}${x.conflict ? '<br><span class="rw">⚠️ 和上面的老读法方向不同</span>' : ""}</div>`;
  }

  // 回测排行榜里的一行
  function line(x) {
    if (!x) return "";
    return `<div class="btr5 small"><span style="color:#c81e1e;font-weight:600">买</span> ${esc(x.buy_s)}${x.sell_s ? `　<span style="color:#15803d;font-weight:600">卖</span> ${esc(x.sell_s)}` : ""}　<span class="muted">今天 ${esc(x.value_s)}</span></div>`;
  }

  // 今日页：今天在买入区 / 快触发 / 卖出区的指标（只列打分组 + 回测有效的参考指标）
  function today(R) {
    const out = [];
    ["cn", "us"].forEach((mk) => {
      if (!R[mk]) return;
      const I = R[mk].items.filter((x) => x.group !== "参考组" || x.cls === "good");
      const chip = (x, t) => `<a class="rchip ${esc(x.cls)}" href="#/backtest/${mk}/i/${encodeURIComponent(x.name)}"><b>${esc(x.name)}</b> ${esc(x.value_s.replace(/（.*$/, ""))}<em>${esc(t)}</em></a>`;
      const buy = I.filter((x) => x.rule_zone === "买入区"), sell = I.filter((x) => x.rule_zone === "卖出区");
      const near = I.filter((x) => x.rule_zone !== "买入区" && x.gap_pts != null && x.gap_pts <= 12).sort((a, b) => a.gap_pts - b.gap_pts);
      const good = (xs) => xs.filter((x) => x.cls === "good").length;
      const sellUse = sell.filter((x) => /卖出区有用/.test(x.do_sell));
      const row = (lab, xs, f, tip) => (xs.length ? `<div class="rgrp"><span class="rlab">${lab}</span><div>${xs.map(f).join("")}${tip ? `<div class="muted small">${tip}</div>` : ""}</div></div>` : "");
      out.push(`<div class="rcol"><h4>${mk === "cn" ? "🇨🇳 A股" : "🇺🇸 美股"} <span class="muted small">数据至 ${esc(R[mk].data_to)}</span></h4>
        ${row(`🔴 买入区 ${buy.length}`, buy, (x) => chip(x, x.buy_s), `其中回测「有效·稳定」${good(buy)} 个${buy.length - good(buy) ? "，其余回测不稳定或无作用，别单凭它买" : ""}`)}
        ${row(`⏳ 快触发 ${near.length}`, near, (x) => chip(x, `买 ${x.buy_s}，${x.gap_buy}`))}
        ${row(`🟢 卖出区 ${sell.length}`, sell, (x) => chip(x, x.sell_s || ""), sell.length ? (sellUse.length ? `回测里卖出区真有用的只有：${sellUse.map((x) => esc(x.name)).join("、")}；其余卖出区后和平时差不多甚至更好，别因此卖` : "这些指标的卖出区回测都没用（之后和平时差不多甚至更好），别因此卖") : "")}
        ${!buy.length && !near.length && !sell.length ? '<span class="muted small">今天没有指标触发</span>' : ""}</div>`);
    });
    return out.join("") + `<div class="muted small" style="margin-top:6px">条件 = 回测中心买入 / 卖出区换成原始值（逐日核对一致）；徽章颜色：<span class="vb good">有效·稳定</span> <span class="vb warn">不稳定</span> <span class="vb gray">无作用</span>。单个指标不单独定仓位，以四象限 + 系统仓位上限为准。点指标看「触发后怎么做」。</div>`;
  }

  window.RULES = { card, mini, line, today, find };
})();
