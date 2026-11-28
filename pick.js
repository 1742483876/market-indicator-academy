/* 🎯 今日一票 #/pick（按需加载；2026-11-24 老大：「你可以告我今天建议买什么、什么时候买、买入范围、卖出范围，然后概率多少」）
   数据：pick_one.py → pick.json（今天的主选 + 备选、没选上的原因、前瞻台账：预测概率 vs 实际、累计盈亏）。
   概率 = winrate_lab 同一信号、同一卖法的历史统计；台账每天按同一规则用真实日K结算。手机 390 宽无横向滚动。 */
(function () {
  const A = window.__APP;
  const { app, esc, FAIL, DISC, getJSON, stockLink } = A;
  if (!document.getElementById("po-css")) {
    const st = document.createElement("style");
    st.id = "po-css";
    st.textContent = `
.po{font-variant-numeric:tabular-nums}
.po-meta{font-size:12.5px;color:var(--sub);margin:2px 0 12px;line-height:1.6}
.po-hero{background:var(--card);border:1px solid var(--line);border-left:6px solid var(--up);border-radius:0 var(--r) var(--r) 0;padding:13px 15px;margin:0 0 12px}
.po-hero.none{border-left-color:#7b828c}
.po-one{font-size:16px;line-height:1.6;font-weight:700;margin:0 0 8px;overflow-wrap:anywhere}
.po-nm{font-size:22px;font-weight:800;line-height:1.3}.po-nm a{color:var(--text)}.po-nm em{font-style:normal;font-size:13px;color:var(--sub);font-weight:400;margin-left:6px}
.po-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0 6px}
.po-g div{background:var(--soft);border-radius:8px;padding:7px 10px;font-size:12.5px;color:var(--sub);min-width:0}
.po-g b{display:block;font-size:18px;color:var(--text);line-height:1.35;overflow-wrap:anywhere}
.po-g .po-bz b{color:var(--up-t)}.po-g .po-sl b{color:var(--dn-t)}
.po-p{font-size:13.5px;line-height:1.7;color:var(--text);overflow-wrap:anywhere}
.po-p b{color:var(--up-t)}
.po-w{font-size:12.5px;color:var(--sub);line-height:1.65;margin-top:6px;overflow-wrap:anywhere}
.po-alt{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:10px 13px;margin:0 0 8px;font-size:13.5px;line-height:1.65;overflow-wrap:anywhere}
.po-alt .t{display:flex;justify-content:space-between;gap:8px;font-weight:700;font-size:15px}
.po-sec{margin:22px 0 10px;font-size:18px}
.po-st{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 10px}
.po-st div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:12px;color:var(--sub);min-width:0}
.po-st b{display:block;font-size:19px;color:var(--text)}
.po-led{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.po-r{display:grid;grid-template-columns:62px minmax(0,1fr) 52px 74px;gap:8px;padding:8px 11px;border-bottom:1px solid var(--line);font-size:13px;align-items:center}
.po-r:last-child{border-bottom:0}.po-r.h{background:var(--soft);color:var(--sub);font-size:12px;font-weight:600}
.po-r .n{min-width:0;overflow-wrap:anywhere}.po-r .n i{font-style:normal;font-size:11px;color:var(--sub2);margin-left:4px}
.po-r .v{text-align:right;font-weight:700}.po-r .v.up{color:var(--up)}.po-r .v.dn{color:var(--dn)}
.po-svg{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:8px}
.po-skip{font-size:12.5px;color:var(--sub);line-height:1.7;margin:4px 2px}
.po-why{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:11px 14px;font-size:13.5px;line-height:1.75}
`;
    document.head.appendChild(st);
  }
  const p3 = (v) => (v == null ? "—" : v < 50 ? Number(v).toFixed(3) : Number(v).toFixed(2));
  const pc = (v, d = 0) => (v == null ? "—" : Number(v).toFixed(d) + "%");
  const sg = (v, d = 2) => (v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(d) + "%");
  const nm = (c) => stockLink(c.sym, c.name);
  const sellTxt = (c) => (c.ex === "MA5" || c.ex === "MA5S" ? `收盘站上 5 日线（今天约 ¥${p3(c.ma5)}）→ 第二天开盘卖` : c.t2 ? `¥${p3(c.t1)} 先卖一半 / ¥${p3(c.t2)}` : `¥${p3(c.t1)}`);
  const stopTxt = (c) => (c.stop ? `¥${p3(c.stop)}` : "不设（只用小仓位）");
  const whenTxt = (P, c) => {
    const d = (P.for_date || "").slice(5).replace("-", "/");
    if (P.mode === "intraday") return "今天 14:50 前在买入区内买";
    if (c.entry === "limit") return `${d} 9:30 起挂 ¥${p3(c.zone[1])} 限价，当天没成交作废`;
    return `${d} 9:30–10:00 开盘附近，在买入区内才买，高开超出不追`;
  };
  const probTxt = (c) => {
    if (c.kind === "S") return `历史同类（S 级）<b>赢 ${pc(c.p_win)}</b>（${c.n} 笔，前后两段 ${pc(c.p_win_a)}/${pc(c.p_win_b)}），先到止盈 ${pc(c.p_hit)}；每笔 ${sg(c.avg)}（扣成本）`;
    let s = `历史同类信号 ${c.hold} 天内<b>赢 ${pc(c.p_win)}</b>`;
    if (c.p_hit != null) s += `、先到目标 ${pc(c.p_hit)}`;
    s += `（${c.n} 笔/${c.episodes} 段行情，前后两段 ${pc(c.p_win_a)}/${pc(c.p_win_b)}），${c.q_n} 天后上涨 ${pc(c.q_up)}；每笔 ${sg(c.avg)}（扣成本）`;
    if (c.year) s += `，今年 ${c.year[1]} 笔 ${sg(c.year[2])}`;
    if (c.worst != null) s += `，最坏一笔 ${sg(c.worst, 1)}`;
    if (c.edge != null) s += `；比同样卖法随便买赢的比例高 ${Math.round(c.edge)} 个点`;
    if (c.small) s += "（样本少，仅供参考）";
    return s;
  };

  // 首页大卡（app.js 调用：window.__mod_pick.hero(el)）
  function heroHTML(J) {
    const P = J.pick || {}, c = P.main;
    const head = `<div class="muted small" style="display:flex;justify-content:space-between;gap:8px"><span>🎯 今日一票 · ${esc((P.for_date || "").slice(5))} 用（${esc(P.made_at || "")}）</span><a href="#/pick">台账 ›</a></div>`;
    if (!c) return `<div class="po-hero none">${head}<div class="po-one">${esc(P.headline || "今天不买")}</div><div class="po-w">${esc((P.us && P.us.line) || "")}</div></div>`;
    return `<div class="po-hero">${head}
      <div class="po-nm">${nm(c)}<em>${esc(c.code)}｜仓位 ${c.pos}%</em></div>
      <div class="po-g"><div class="po-bz">买入区<b>¥${p3(c.zone[0])}–${p3(c.zone[1])}</b></div><div>赢的比例（历史）<b>${pc(c.p_win)}</b></div>
        <div style="grid-column:1/-1">卖出<b style="font-size:15px">${esc(sellTxt(c))}</b></div><div class="po-sl">止损<b style="font-size:${c.stop ? 18 : 15}px">${esc(stopTxt(c))}</b></div><div>最长拿<b>${c.hold} 天</b></div></div>
      <div class="po-w">${esc(P.headline || "")}</div></div>`;
  }

  function curveSVG(cv) {
    if (!cv || cv.length < 2) return '<div class="muted" style="padding:10px">台账还在攒（结束 2 笔以上才画曲线）。</div>';
    const W = 360, H = 150, ys = cv.map((x) => x[1]), lo = Math.min(0, ...ys), hi = Math.max(0, ...ys), sp = hi - lo || 1;
    const X = (i) => 30 + (i * (W - 40)) / (cv.length - 1), Y = (v) => 10 + ((hi - v) * (H - 30)) / sp;
    const pts = cv.map((x, i) => `${X(i).toFixed(1)},${Y(x[1]).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="累计每笔收益"><line x1="30" x2="${W - 10}" y1="${Y(0)}" y2="${Y(0)}" stroke="#ccc"/>
      <polyline fill="none" stroke="${ys[ys.length - 1] >= 0 ? "#e5484d" : "#1f9d55"}" stroke-width="2" points="${pts}"/>
      <text x="2" y="${Y(hi) + 4}" font-size="10" fill="#888">${hi.toFixed(1)}%</text><text x="2" y="${Y(lo)}" font-size="10" fill="#888">${lo.toFixed(1)}%</text>
      <text x="30" y="${H - 4}" font-size="10" fill="#888">${esc(cv[0][0].slice(5))}</text><text x="${W - 50}" y="${H - 4}" font-size="10" fill="#888">${esc(cv[cv.length - 1][0].slice(5))}</text></svg>`;
  }

  function page() {
    document.title = "🎯 今日一票 · 小七投研";
    app.innerHTML = '<h1>🎯 今日一票</h1><p class="muted">正在读取…</p>';
    getJSON("pick.json", true).then((J) => {
      const P = J.pick || {}, S = J.stats || {}, c = P.main;
      let h = `<div class="po"><h1>🎯 今日一票</h1><div class="po-meta">${esc((P.for_date || "").slice(5))} 用｜${esc({ post: "盘后版", pre: "盘前版", intraday: "盘中版" }[P.mode] || "")}｜数据截至 ${esc(P.data_date || "")}｜生成 ${esc(P.made_at || "")}｜总状态：${esc((P.verdict || {}).state || "—")}（仓位上限 ${esc(String((P.verdict || {}).cap ?? "—"))}%）</div>`;
      h += heroHTML(J);
      if (c) {
        h += `<div class="po-alt"><div class="t"><span>主选 ${nm(c)}</span><span class="muted">${esc(c.tag || "")}</span></div>
          <div>⏰ ${esc(whenTxt(P, c))}</div><div>📤 卖出：${esc(sellTxt(c))}；止损 ${esc(stopTxt(c))}；最长拿 ${c.hold} 天</div>
          <div class="po-p">📊 ${probTxt(c)}</div><div class="po-w">依据：${esc(c.sig_txt)}｜卖法：${esc(c.ex_txt)}</div></div>`;
        (P.alts || []).forEach((x, i) => {
          h += `<div class="po-alt"><div class="t"><span>备选${i + 1} ${nm(x)}</span><span class="muted">仓位 ${x.pos}%</span></div>
            <div>买入区 ¥${p3(x.zone[0])}–${p3(x.zone[1])}｜卖出：${esc(sellTxt(x))}｜止损 ${esc(stopTxt(x))}</div><div class="po-p">📊 ${probTxt(x)}</div></div>`;
        });
        if ((P.alts || []).length && P.alts[0].sig === c.sig) h += '<div class="po-skip">主选和备选是同一种信号，历史上同组里先买哪只没检验过；想分散就各买一半仓位。</div>';
      }
      if (P.us && P.us.line) h += `<div class="po-alt">${esc(P.us.line)}</div>`;
      if ((P.skipped || []).length) h += `<div class="po-skip"><b>没选上的：</b>${P.skipped.map((s) => `${esc(s.name)}——${esc(s.why)}`).join("；")}</div>`;
      h += `<h2 class="po-sec">📒 前瞻台账：预测准不准</h2>
        <div class="po-st"><div>主选已结束<b>${S.main_closed ?? 0}</b>笔</div><div>实际赢的比例<b>${S.main_win == null ? "—" : S.main_win + "%"}</b></div><div>当时预测<b>${S.main_pred == null ? "—" : S.main_pred + "%"}</b></div></div>
        <div class="po-meta">没成交 ${S.main_nofill ?? 0}｜进行中 ${S.main_open ?? 0}｜不买的日子 ${S.none_days ?? 0}｜主选+备选合计结束 ${S.all_closed ?? 0} 笔：实际 ${S.all_win ?? "—"}% vs 预测 ${S.all_pred ?? "—"}%。攒够 30 笔再判断概率准不准。</div>
        <div class="po-svg">${curveSVG(S.curve)}</div><div class="po-meta">曲线 = 主选每笔收益（扣成本）累加。</div>
        <div class="po-led"><div class="po-r h"><span>买入日</span><span>标的</span><span>预测</span><span style="text-align:right">结果</span></div>`;
      (J.ledger || []).slice(0, 60).forEach((e) => {
        if (e.role === "none") { h += `<div class="po-r"><span>${esc(e.for_date.slice(5))}</span><span class="n">不买<i>${esc((e.why || "").slice(0, 24))}</i></span><span>—</span><span class="v">—</span></div>`; return; }
        const st = e.status === "closed" ? sg(e.ret) : e.status === "open" ? (e.mark_ret != null ? "持有 " + sg(e.mark_ret, 1) : "持有中") : e.status === "nofill" ? "没成交" : "待成交";
        const cls = e.status === "closed" ? (e.ret > 0 ? "up" : "dn") : "";
        h += `<div class="po-r"><span>${esc(e.for_date.slice(5))}</span><span class="n">${stockLink(e.sym, e.name)}<i>${e.role === "main" ? "主选" : "备选"}${e.result ? "·" + esc(e.result) : ""}</i></span><span>${pc(e.p_win)}</span><span class="v ${cls}">${esc(st)}</span></div>`;
      });
      h += `</div><h2 class="po-sec">❓ 为什么不是「上涨概率 90%」</h2><div class="po-why">
        随便买一只 A 股拿 10 天，收盘比买入价高的比例只有约 46%；我们检验过最好的信号（ETF 急跌/超卖后反弹）也就 6~7 成，而且一年只出现几次。
        胜率 90% 的做法都是「涨一点就卖、跌很多才认」，长期是亏的。能做的是：只买检验过的信号、赚多亏少、每只小仓位，并用上面的台账检验概率准不准。
        <a href="#/labs/winrate">看完整检验 ›</a></div></div>${DISC}`;
      app.innerHTML = h;
    }).catch(() => { app.innerHTML = "<h1>🎯 今日一票</h1>" + FAIL(); });
  }
  window.__mod_pick = { page, heroHTML };
})();
