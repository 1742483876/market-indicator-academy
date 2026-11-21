/* 小七投研 · 今日预期卡（读 outlook.json，open_outlook.py 生成）。纯 CSS 区间条，A股涨红跌绿。 */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sg = (v, d = 2) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%");
  const cl = (v) => (v > 0.05 ? "up" : v < -0.05 ? "dn" : "");
  const px = (r, v) => (r.kind === "broad" ? Math.round(v) : Number(v).toFixed(3));
  const short = (n) => String(n || "").replace("ETF", "");
  if (!document.getElementById("olk-css")) {
    const st = document.createElement("style");
    st.id = "olk-css";
    st.textContent = `.olk .oh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px}.olk .oh b{font-size:16px}
.olk .hl{font-size:14px;line-height:1.55;margin:6px 0 8px;font-weight:600}
.olk .orow{display:grid;grid-template-columns:7.6em 1fr 2.8em;gap:6px;align-items:center;padding:5px 0;border-top:1px solid var(--line,#eee);font-size:13px}
.olk .orow .on{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.olk .orow .on em{display:block;font-style:normal;font-size:11px;color:var(--sub,#888)}
.olk .orow .op{text-align:right;font-variant-numeric:tabular-nums;font-size:12px}
.olk .trk{position:relative;height:14px;background:transparent}
.olk .trk i{position:absolute;top:3px;height:8px;border-radius:2px}.olk .trk .b80{opacity:.22}.olk .trk .b50{opacity:.6}
.olk .trk .z{position:absolute;top:0;bottom:0;width:1px;background:var(--sub,#999);opacity:.6}
.olk .trk .m{position:absolute;top:0;width:2px;height:14px;background:var(--text,#111)}
.olk .up{color:#e5484d}.olk .dn{color:#2fa86b}.olk .bg-up{background:#e5484d}.olk .bg-dn{background:#2fa86b}.olk .bg-0{background:#999}
.olk .sub{font-size:12px;color:var(--sub,#888);margin-top:2px}.olk .lbl{font-size:12px;color:var(--sub,#888);margin:10px 0 2px}
.olk .chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}.olk .chips span{font-size:12px;padding:2px 8px;border-radius:10px;background:var(--card2,rgba(127,127,127,.1))}
.olk .rv{font-size:12.5px;line-height:1.6;margin-top:8px;padding-top:6px;border-top:1px dashed var(--line,#ddd)}
.olk details summary{cursor:pointer;font-size:13px;margin-top:8px;color:var(--accent,#c33)}
.olk .trust{font-size:11.5px;color:var(--sub,#888);line-height:1.5;margin-top:8px}`;
    document.head.appendChild(st);
  }
  function bars(rows, M) {
    const x = (v) => Math.max(0, Math.min(100, 50 + (v / M) * 50));
    return rows.map((r) => {
      const c = r.g > 0.05 ? "bg-up" : r.g < -0.05 ? "bg-dn" : "bg-0";
      const seg = (a, b, k) => `<i class="${k} ${c}" style="left:${x(a)}%;width:${Math.max(1, x(b) - x(a))}%"></i>`;
      const prob = r._ok ? `${Math.round(r.p * 100)}%` : "—";
      const tag = r.strength === "偏强" ? " ▲" : r.strength === "偏弱" ? " ▼" : "";
      return `<div class="orow" title="${esc(r.word)}"><span class="on">${esc(short(r.name))}${tag}<em>开≈${px(r, r.open)} <b class="${cl(r.g)}">${sg(r.g)}</b></em></span>
        <span class="trk">${seg(r.lo80, r.hi80, "b80")}${seg(r.lo50, r.hi50, "b50")}<span class="z" style="left:50%"></span><span class="m" style="left:calc(${x(r.g)}% - 1px)"></span></span>
        <span class="op">${prob}</span></div>`;
    }).join("");
  }
  window.renderOutlook = function (el, J) {
    const ok = J.prob_ok || {};
    const rows = (J.rows || []).map((r) => Object.assign({}, r, { _ok: r.pshow != null ? !!r.pshow : !!ok[r.kind] }));
    const by = Object.fromEntries(rows.map((r) => [r.sym, r]));
    const broad = rows.filter((r) => r.kind === "broad");
    const sect = rows.filter((r) => r.kind === "sector").sort((a, b) => (b.score ?? -9) - (a.score ?? -9));
    const cross = rows.filter((r) => r.kind === "cross");
    const top = (J.strong || []).map((s) => by[s]).filter(Boolean), bot = (J.weak || []).map((s) => by[s]).filter(Boolean);
    const M = Math.max(1, ...broad.concat(top, bot, cross).map((r) => Math.max(Math.abs(r.lo80), Math.abs(r.hi80)))) * 1.05;
    const Ma = Math.max(1, ...sect.map((r) => Math.max(Math.abs(r.lo80), Math.abs(r.hi80)))) * 1.05;
    const sh = by.sh000001;
    const d = String(J.date || "");
    const R = J.review, rb = R && R.roll && R.roll.broad, rs = R && R.roll && R.roll.sector;
    let rv = "";
    if (R && R.rows && R.rows.length) {
      const y = R.rows.find((x) => x.sym === "sh000001") || R.rows[0];
      rv = `<div class="rv">🔁 <b>昨天（${esc(R.date.slice(4, 6))}/${esc(R.date.slice(6))}）预期 vs 实际</b>：${esc(y.name)} 预计开 ${Math.round(y.pred_open)}（${sg(y.pred_gap)}），实际 ${Math.round(y.act_open)}（<span class="${cl(y.act_gap)}">${sg(y.act_gap)}</span>）${y.gap_hit ? "✅" : "❌"}；收盘 <span class="${cl(y.act_ret)}">${sg(y.act_ret)}</span>，${y.in50 ? "落在" : "不在"} 50% 区间、${y.in80 ? "在" : "不在"} 80% 区间。
        ${rb ? `<br>滚动 ${R.roll.days} 天：开盘方向命中 ${Math.round(rb.gap_hit)}%，收盘落在 50% 区间 ${Math.round(rb.in50)}%（应≈50%）、80% 区间 ${Math.round(rb.in80)}%（应≈80%）${rs ? `；板块 ${Math.round(rs.in50)}% / ${Math.round(rs.in80)}%` : ""}${R.roll.spread != null ? `；偏强比偏弱多涨 ${sg(R.roll.spread)}` : ""}。` : ""}</div>`;
    } else rv = `<div class="rv muted">🔁 昨天预期 vs 实际：还没有对账记录，收盘后自动对账。</div>`;
    el.className = "card olk";
    el.innerHTML = `<div class="oh"><b>📅 ${esc(d.slice(4, 6))}/${esc(d.slice(6))} 今日预期</b><span class="muted small">${esc(String(J.computed_at || "").slice(5))} 计算</span></div>
      ${sh ? `<div class="hl">上证预计开 <span class="${cl(sh.g)}">${Math.round(sh.open)}（${sg(sh.g)}）</span>，一半的日子收在 ${Math.round(sh.px_lo50)}–${Math.round(sh.px_hi50)}，十天八天收在 ${Math.round(sh.px_lo80)}–${Math.round(sh.px_hi80)}；${sh._ok ? `收涨概率 ${Math.round(sh.p * 100)}%（接近五五开）` : "涨跌方向没把握"}</div>` : ""}
      <div class="sub">${esc(J.asof || "")}</div>
      <div class="obody"><div class="lbl">宽基（竖线＝预计开盘；深色＝50% 收盘区间，浅色＝80%；右列＝收涨概率）</div>${bars(broad, M)}
      <div class="lbl">行业板块偏强 ▲（相对上证，强弱多在开盘兑现）</div>${bars(top, M)}
      <div class="lbl">行业板块偏弱 ▼</div>${bars(bot, M)}
      ${cross.length ? `<div class="lbl">跨境·商品（跟隔夜海外走）</div>${bars(cross, M)}` : ""}</div>
      <details><summary>全部 ${sect.length} 个行业板块（按强弱排序）</summary>${bars(sect, Ma)}</details>
      ${rv}
      <div class="trust">${esc(J.trust || "")}<br>只是统计上的「大概率范围」，不是买卖建议；买卖以报告「〇、结论」为准。</div>`;
  };
})();
