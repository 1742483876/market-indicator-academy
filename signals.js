/* 📡 各市场技术信号雷达（老大 2026-11-27 02:06：「比较重要的信号，比如顶背离，分下各个指标哪些出现了异常，然后汇报，各个股市都可以」）
   数据：signals.py → signals.json（20 个标的 × 23 种信号 + 历史上灵不灵）。
   #/signals：结论卡 → 重要信号 → 各市场「标的 × 指标」矩阵（点一行看原始数值） → 历史统计。
   另导出 window.__mod_signals.homeHTML() 给首页小卡。颜色按 A 股习惯：▲看涨（超跌 / 底背离）红、▼看跌（过热 / 顶背离）绿。*/
(function () {
  const A = window.__APP;
  const { app, esc, FAIL, DISC, getJSON } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  if (!document.getElementById("sg-css")) {
    const st = document.createElement("style"); st.id = "sg-css";
    st.textContent = `
.sg{overflow-wrap:anywhere}
.sg-v{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--brand);border-radius:var(--r);padding:12px 14px;margin:0 0 12px;color:var(--text)}
.sg-v b.w{display:block;font-size:17px;font-weight:800;margin-bottom:4px}
.sg-v p{margin:5px 0;font-size:14px;line-height:1.7;white-space:normal}
.sg-tabs{display:flex;gap:6px;margin:0 0 10px}
.sg-tabs a{flex:1;text-align:center;font-size:13.5px;font-weight:700;padding:8px 0;border-radius:9px;background:var(--soft);color:var(--sub);text-decoration:none}
.sg-tabs a.on{background:var(--brand);color:#fff}
.sg-h{display:flex;gap:8px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px;line-height:1.6}
.sg-h:last-child{border-bottom:0}
.sg-t{flex:none;font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;color:#fff !important;line-height:1.5;margin-top:1px}
.sg-t.bear{background:var(--down,#1f9d55)}.sg-t.bull{background:var(--up,#d93a3a)}.sg-t.neu{background:#9aa3ad}
.sg-h .m{white-space:normal}.sg-h .m em{display:block;font-style:normal;font-size:12.5px;color:var(--sub)}
.sg-mk{margin:14px 0 6px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.sg-mk b{font-size:16px;font-weight:800}.sg-mk span{font-size:12.5px;font-weight:700;padding:2px 8px;border-radius:6px;background:var(--soft);color:var(--sub)}
.sg-mk span.bear{color:var(--down,#1f9d55)}.sg-mk span.bull{color:var(--up,#d93a3a)}
.sg-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:10px;background:var(--card)}
.sg-tb{border-collapse:collapse;font-size:12.5px;min-width:720px;width:100%}
.sg-tb th,.sg-tb td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:center;white-space:nowrap}
.sg-tb th{font-size:11.5px;color:var(--sub);font-weight:700;background:var(--soft)}
.sg-tb td.n{text-align:left;font-weight:700;position:sticky;left:0;background:var(--card);cursor:pointer}
.sg-tb td.n small{display:block;font-weight:400;font-size:11px;color:var(--sub2);font-variant-numeric:tabular-nums}
.sg-c{display:inline-block;font-size:11.5px;font-weight:700;padding:1px 6px;border-radius:5px;margin:1px 0;white-space:nowrap}
.sg-c.bear{background:rgba(31,157,85,.13);color:var(--down,#1f9d55)}.sg-c.bull{background:rgba(217,58,58,.12);color:var(--up,#d93a3a)}.sg-c.neu{background:var(--soft);color:var(--sub)}
.sg-c.l2{outline:1.5px solid currentColor}
.sg-dot{color:var(--sub2)}
.sg-detbox:not(:empty){background:var(--soft);border-radius:10px;padding:10px 12px;margin-top:6px;font-size:13px;line-height:1.7}
.sg-near{font-size:12.5px;color:var(--sub);margin:6px 2px 0;line-height:1.7}
.sg-st{border-collapse:collapse;font-size:12.5px;min-width:640px;width:100%}
.sg-st th,.sg-st td{padding:7px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.sg-st th:first-child,.sg-st td:first-child{text-align:left}
.sg-st th:last-child,.sg-st td:last-child{text-align:left;white-space:normal;min-width:150px}
.sg-st th{font-size:11.5px;color:var(--sub);background:var(--soft)}
.sg-up{color:var(--up,#d93a3a)}.sg-dn{color:var(--down,#1f9d55)}
.sgh-i{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px;line-height:1.55;text-decoration:none;color:var(--text)}
.sgh-i:last-of-type{border-bottom:0}
`;
    document.head.appendChild(st);
  }
  const pc = (x) => (x == null ? "—" : (x > 0 ? "+" : "") + Number(x).toFixed(2) + "%");
  const ud = (x) => (x == null ? "" : x > 0 ? "sg-up" : x < 0 ? "sg-dn" : "");
  const TAG = { bear: "▼看跌", bull: "▲看涨", neu: "提示" };
  const tag = (side) => `<span class="sg-t ${side}">${TAG[side] || "提示"}</span>`;
  const when = (a) => (a === 0 ? "今天" : `${a} 天前`);
  const VC = { ok: "有点用", rev: "反着走", no: "只是温度计", few: "样本少" };

  function headsHTML(J, n) {
    const hs = (J.heads || []).slice(0, n || 99);
    if (!hs.length) return `<div class="muted" style="padding:8px 0">今天没有背离 / 200 日线 / 均线交叉这类重要信号</div>`;
    return hs.map((h) => `<div class="sg-h">${tag(h.side)}<div class="m"><b>${esc(h.mk)} · ${esc(h.who)}</b>「${esc(h.sname)}」${when(h.ago)}
      <em>${esc(h.val)}　历史：${esc(VC[h.verdict] || "")}</em></div></div>`).join("");
  }

  function matrix(M, J) {
    const cols = J.cols;
    const rows = M.items.map((it, i) => {
      if (it.err) return `<tr><td class="n">${esc(it.name)}<small>取数失败</small></td>${cols.map(() => "<td>—</td>").join("")}</tr>`;
      const by = {};
      (it.sigs || []).forEach((s) => (by[s.col] = by[s.col] || []).push(s));
      const cells = cols.map((c) => `<td>${(by[c] || []).map((s) => `<span class="sg-c ${s.side} ${s.lvl >= 2 ? "l2" : ""}">${esc(s.name.replace(/\(.*\)/, ""))}</span>`).join("<br>") || '<span class="sg-dot">·</span>'}</td>`).join("");
      const ind = it.ind || {};
      return `<tr data-i="${i}"><td class="n">${esc(it.name)} ›<small><span class="${ud(it.chg)}">${pc(it.chg)}</span> · RSI ${ind.rsi ?? "—"} · J ${ind.j ?? "—"}</small></td>${cells}</tr>`;
    }).join("");
    return `<div class="sg-wrap"><table class="sg-tb"><thead><tr><th style="text-align:left">标的（点开看数值）</th>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function detail(it, J) {
    const ind = it.ind || {};
    const S = (it.sigs || []).map((s) => `<div style="margin:4px 0">${tag(s.side)} <b>${esc(s.name)}</b>（${when(s.ago)}）：${esc(s.val)}<br>
      <span class="muted">${esc(s.expl)}。历史 ${s.hist.n} 次，之后 20 天平均 <b class="${ud(s.hist.f20)}">${pc(s.hist.f20)}</b>（平时 ${pc(J.base.mean.f20)}），下跌概率 ${s.hist.down20 ?? "—"}% → ${esc(s.hist.vword || "")}</span></div>`).join("") || "<div>没有异常信号</div>";
    return `<div><b>${esc(it.name)}</b> ${esc(it.date || "")} 收 ${esc(it.close)}　RSI ${ind.rsi ?? "—"} · KDJ J ${ind.j ?? "—"} · DIF ${ind.dif ?? "—"} / DEA ${ind.dea ?? "—"} · 离20日线 ${pc(ind.d20)} · 离200日线 ${pc(ind.d200)}</div>${S}
      ${(it.near || []).length ? `<div class="muted" style="margin-top:4px">快触发：${it.near.map(esc).join("；")}</div>` : ""}`;
  }

  function statsHTML(J) {
    const S = J.stats, K = J.kinds, B = J.base;
    const ks = Object.keys(S).sort((a, b) => Math.abs(S[b].t20 || 0) - Math.abs(S[a].t20 || 0));
    return `<p class="muted" style="font-size:13px;line-height:1.7">同样的规则在这 ${J.n_assets} 个标的近 8 年（日韩 4 年）日线上跑一遍：信号出现后拿 20 天，和「平时随便哪天拿 20 天」（平均 ${pc(B.mean.f20)}、下跌概率 ${B.down.f20}%）比。同一周多个标的一起出信号只算一个样本；|t|≥2 且前后两段方向一致才算有点用。只是事件统计，没扣成本。</p>
      <div class="sg-wrap"><table class="sg-st"><thead><tr><th>信号</th><th>方向</th><th>次数</th><th>之后20天</th><th>比平时</th><th>下跌概率</th><th>t</th><th>结论</th></tr></thead><tbody>
      ${ks.map((k) => { const s = S[k]; return `<tr><td>${esc(K[k].name)}</td><td>${TAG[K[k].side] || ""}</td><td>${s.n}</td><td class="${ud(s.f20)}">${pc(s.f20)}</td><td class="${ud(s.x20)}">${pc(s.x20)}</td><td>${s.down20 ?? "—"}%</td><td>${s.t20}</td><td>${esc(s.vword)}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }

  function divNote(J) {
    const t = J.stats.top_div_macd || {}, b = J.stats.bot_div_macd || {}, B = J.base;
    return `<b>顶背离别当卖出信号</b>：历史上 MACD 顶背离出现后 20 天平均 ${pc(t.f20)}、下跌概率 ${t.down20}%，平时是 ${pc(B.mean.f20)}、${B.down.f20}%——强的往往继续强；底背离之后 20 天 ${pc(b.f20)}，也没有明显更好。`;
  }

  async function page() {
    document.title = "技术信号雷达 · 小七投研";
    const tok = A.tok();
    app.innerHTML = `<h1>📡 技术信号雷达</h1>${A.LOADING()}`;
    let J;
    try { J = await getJSON("signals.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>📡 技术信号雷达</h1>${FAIL()}`; return; }
    if (!A.alive(tok)) return;
    const hs = J.heads || [];
    const nb = hs.filter((h) => h.side === "bear").length, nu = hs.filter((h) => h.side === "bull").length;
    app.innerHTML = `<div class="sg"><h1>📡 技术信号雷达 <a class="h2a" href="#/">首页 ›</a></h1>
      <div class="sg-v"><b class="w">重要信号 ${hs.length} 条：▼看跌 ${nb} · ▲看涨 ${nu}</b>
        <p>${J.markets.map((M) => `${esc(M.name)}：${esc(M.word)}`).join("；")}</p>
        <p>${divNote(J)}</p>
        <p class="muted" style="font-size:12px">${J.n_assets} 个标的 · 数据 ${esc(J.built)} · 只是温度计，不单独构成买卖建议</p></div>
      <div class="sg-tabs"><a href="javascript:;" data-t="now" class="on">今天的异常</a><a href="javascript:;" data-t="hist">历史上灵不灵</a></div>
      <div id="sgbody"></div>${DISC}</div>`;
    const draw = (t) => {
      $$(".sg-tabs a").forEach((a) => a.classList.toggle("on", a.dataset.t === t));
      const body = $("#sgbody");
      if (t === "hist") { body.innerHTML = statsHTML(J); return; }
      body.innerHTML = `<h2>🔥 重要信号（背离 / 200日线 / 50·200 交叉）</h2><div class="card">${headsHTML(J)}</div>
        <h2>📋 各市场 × 各指标</h2><p class="muted" style="font-size:12.5px;margin:0 0 4px">表格能左右滑；带框的是重要信号；点标的名字看原始数值和历史表现。</p>
        ${J.markets.map((M, mi) => `<div class="sg-mk"><b>${esc(M.name)}</b><span class="${M.tone}">${esc(M.word)}</span></div>
          <div data-m="${mi}">${matrix(M, J)}<div class="sg-detbox"></div></div>
          ${M.items.some((it) => (it.near || []).length) ? `<div class="sg-near">⏳ 快触发：${M.items.flatMap((it) => (it.near || []).slice(0, 2).map((n) => `${esc(it.name)} ${esc(n)}`)).slice(0, 5).join("；")}</div>` : ""}`).join("")}`;
      $$("[data-m]").forEach((box) => {
        const M = J.markets[+box.dataset.m];
        const db = $(".sg-detbox", box);
        $$("tr[data-i]", box).forEach((tr) => tr.querySelector("td.n").addEventListener("click", () => {
          // 详情放在表格下面（放进表格行会跟着 720px 宽表格横向溢出、手机上看不全）
          if (db.dataset.i === tr.dataset.i && db.innerHTML) { db.innerHTML = ""; db.dataset.i = ""; return; }
          db.dataset.i = tr.dataset.i;
          db.innerHTML = detail(M.items[+tr.dataset.i], J);
        }));
      });
    };
    $$(".sg-tabs a").forEach((a) => a.addEventListener("click", () => draw(a.dataset.t)));
    draw("now");
  }

  // 首页只放 5 条：先每个市场轮流挑一条（不然全被 A 股几个指数同时底背离占满）
  function pickHeads(hs, n) {
    const by = {}, order = [];
    hs.forEach((h) => { if (!by[h.mk]) { by[h.mk] = []; order.push(h.mk); } by[h.mk].push(h); });
    const out = [];
    for (let r = 0; out.length < n && r < 10; r++) order.forEach((m) => { if (out.length < n && by[m][r]) out.push(by[m][r]); });
    return out;
  }

  function homeHTML(J) {
    if (!J || !J.markets) return "";
    return `<div style="font-size:12.5px;color:var(--sub);margin:2px 0 4px">${J.markets.map((M) => `${esc(M.name)} <b class="${M.tone === "bear" ? "sg-dn" : M.tone === "bull" ? "sg-up" : ""}">${esc(M.word.replace(/（.*）/, ""))}</b>`).join(" · ")}</div>`
      + pickHeads(J.heads || [], 5).map((h) => `<a class="sgh-i" href="#/signals">${tag(h.side)}<span><b>${esc(h.mk)}·${esc(h.who)}</b> ${esc(h.sname)}（${when(h.ago)}）</span></a>`).join("")
      + `<div style="font-size:12px;color:var(--sub);margin-top:6px;line-height:1.6">📌 顶背离历史上不是卖出信号（之后 20 天反而平均 ${pc((J.stats.top_div_macd || {}).f20)}），这些只当温度计</div>`;
  }

  window.__mod_signals = { page, homeHTML };
})();
