/* 网红策略验真页（按需加载）：列表只读 labs.json；完整报告 labs/r_<key>.json 点开才下（academy/build_labs.py 生成） */
(function () {
  const A = window.__APP;
  const { app, $, $$, esc, LOADING, FAIL, DISC, getJSON } = A;
  const LV = { ok: ["✅", "有用"], partial: ["⚠️", "部分成立"], no: ["❌", "不成立"], testing: ["🔬", "检验中"] };
  const F = { lv: "", t: "" };
  const OPEN = new Set();
  let J = null;
  const md = (d) => (d ? String(d).slice(5) : "");
  function lightbox(src, alt) {
    let lb = $("#lb");
    if (!lb) {
      lb = document.createElement("div"); lb.id = "lb";
      lb.innerHTML = '<div class="lbbar"><span></span><button>✕ 关闭</button></div><div class="lbimg"><img alt=""></div><div class="lbtip">双指缩放 / 点图片放大，点空白处关闭</div>';
      document.body.appendChild(lb);
      lb.addEventListener("click", (e) => {
        if (e.target.tagName === "IMG") { e.target.classList.toggle("big"); return; }
        lb.classList.remove("show"); document.body.style.overflow = "";
      });
    }
    lb.querySelector("img").src = src; lb.querySelector("img").classList.remove("big"); lb.querySelector(".lbbar span").textContent = alt || "";
    lb.classList.add("show"); document.body.style.overflow = "hidden";
  }
  const badge = (lv, big) => `<span class="lab-badge ${lv}${big ? " big" : ""}">${LV[lv][0]} ${LV[lv][1]}</span>`;
  if (!document.getElementById("lab-css2")) {
    const st = document.createElement("style"); st.id = "lab-css2";
    st.textContent = `
.lab-tbl{padding:2px 0;overflow:hidden}
.lab-r{display:grid;grid-template-columns:92px minmax(0,1.3fr) minmax(0,1.6fr) minmax(0,1.1fr);gap:0 12px;align-items:center;padding:9px 14px;border-top:1px solid var(--line);color:var(--text);text-decoration:none;font-size:14px;line-height:1.45;cursor:pointer}
.lab-r:first-child{border-top:0}
.lab-r.h{font-size:12px;color:var(--sub2);cursor:default;padding:7px 14px;background:var(--soft)}.lab-r.h span:last-child{text-align:right}
.lab-r.lv-ok{background:#f0fdf4}.lab-r.lv-partial{background:#fff8ec}
.lab-r .t{font-weight:700;min-width:0;overflow-wrap:anywhere}.lab-r .t i{font-style:normal;font-size:11px;font-weight:700;color:#fff;background:var(--up);border-radius:4px;padding:0 4px;margin-left:5px;vertical-align:1px}
.lab-r .o{color:var(--text);min-width:0}
.lab-r .k{min-width:0;text-align:right}.lab-r .k b{display:block;font-size:14.5px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.lab-r .k small{display:block;font-size:11px;color:var(--sub2);line-height:1.3}
.lab-r .bd .lab-badge{white-space:nowrap}
.lab-intro{margin:0 0 10px}.lab-intro>summary{cursor:pointer;color:var(--brand);font-size:13.5px;list-style:none}.lab-intro>summary::-webkit-details-marker{display:none}
.lab-sum1{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;margin:0 0 8px;color:var(--sub)}.lab-sum1 b{font-size:18px}
.lab-sum1 .ok b{color:#15803d}.lab-sum1 .partial b{color:#c2410c}.lab-sum1 .no b{color:#b91c1c}
@media (max-width:640px){
  .lab-r{grid-template-columns:76px minmax(0,1fr);grid-template-areas:"b t" "b o" "b k";gap:2px 10px;padding:9px 12px;align-items:start}
  .lab-r.h{display:none}
  .lab-r .bd{grid-area:b}.lab-r .t{grid-area:t;font-size:14.5px}.lab-r .o{grid-area:o;font-size:13px;color:var(--sub)}.lab-r .k{grid-area:k;text-align:left}
  .lab-r .k b{display:inline;font-size:14px}.lab-r .k small{display:inline;margin-left:6px}
  .lab-r .bd .lab-badge{font-size:11.5px;padding:1px 5px}
}`;
    document.head.appendChild(st);
  }
  // 一句话（≤25 字）：取结论第一句，超长在逗号处截断
  const one = (v) => {
    let t = String(v || "").split(/[；。]/)[0].trim();
    if (t.length <= 25) return t;
    const i = t.lastIndexOf("，", 25);
    return i >= 8 ? t.slice(0, i) : t.slice(0, 24) + "…";
  };
  const RANK = { ok: 0, partial: 1, testing: 2, no: 3 };
  function table(xs, latest) {
    const rows = xs.slice().sort((a, b) => RANK[a.level] - RANK[b.level] || String(b.date || "").localeCompare(String(a.date || "")));
    return `<div class="card lab-tbl"><div class="lab-r h"><span>结论</span><span>策略 / 说法</span><span>一句话</span><span>关键数字（实测）</span></div>
      ${rows.map((x) => { const n = (x.nums || [])[0];
        return `<a class="lab-r lv-${x.level}" ${x.href ? `href="${esc(x.href)}"` : `data-go="${esc(x.key)}"`}><span class="bd">${badge(x.level)}</span><span class="t">${esc(x.title.split(/[（(]/)[0])}${x.date && x.date === latest ? "<i>新</i>" : ""}</span>
          <span class="o">${esc(one(x.verdict))}</span><span class="k">${n ? `<b>${esc(n[2])}</b><small>${esc(n[0])}</small>` : `<small>${esc(x.type || "")}</small>`}</span></a>`; }).join("")}</div>`;
  }
  // 事件检验（财经大事日历的历史验证，数据在 events.json，不在 labs.json）
  async function eventRow() {
    try {
      const E = await getJSON("events.json", true), L = E && E.lab;
      if (!L || !L.fomc) return null;
      const m = (k) => (L[k] ? L[k].mult : null);
      return { key: "events", href: "#/cal", level: "partial", type: "事件", date: String(E.updated || "").slice(0, 10), title: "财经大事：议息 / CPI / 非农当天能不能押方向",
        verdict: "波动会变大，方向五五开，事前不押涨跌", nums: [["FOMC / CPI 当天波动是平时的", `${m("fomc")} / ${m("cpi")} 倍`, `${m("fomc")} / ${m("cpi")} 倍（加息周期）`]] };
    } catch (e) { return null; }
  }
  function nums(x) {
    if (!x.nums || !x.nums.length) return "";
    const c = x.cols || ["", "说法", "实测"];
    return `<div class="lab-nums"><div class="lab-nh"><span>${esc(c[0] || "关键数字")}</span><span><i class="lab-said">${esc(c[1])}</i> → <b>${esc(c[2])}</b></span></div>
      ${x.nums.map(([k, a, b]) => `<div class="lab-nr"><div class="lab-nk">${esc(k)}</div><div class="lab-nv">${a && a !== "—" ? `<i class="lab-said">${esc(a)}</i><span class="lab-arr">→</span>` : ""}<b>${esc(b)}</b></div></div>`).join("")}</div>`;
  }
  function detail(x) {
    const li = (a) => a.map((t) => `<li>${esc(t)}</li>`).join("");
    const imgs = (x.imgs || []).map((im) => `<figure class="lab-fig"><img loading="lazy" src="${esc(im.src)}" width="${im.w}" height="${im.h}" alt="${esc(im.cap)}" data-img><figcaption>${esc(im.cap)}</figcaption></figure>`).join("");
    const links = (x.links || []).map(([h, t]) => `<a class="chip" href="${esc(h)}">${esc(t)} ›</a>`);
    if (x.report) links.unshift(`<a class="chip lab-rep" href="#/labs/${esc(x.key)}">📄 完整报告</a>`);
    return `<div class="lab-sec"><h4>我们怎么测</h4><p>${esc(x.how)}</p>${x.period ? `<p class="muted small">样本：${esc(x.period)}</p>` : ""}</div>
      ${imgs ? `<div class="lab-imgs">${imgs}</div>` : ""}
      ${x.points && x.points.length ? `<div class="lab-sec"><h4>要点</h4><ul>${li(x.points)}</ul></div>` : ""}
      ${x.concl && x.concl.length && x.key !== "gurus" ? `<div class="lab-sec"><h4>报告原文结论（摘录）</h4><ul class="lab-q">${li(x.concl.slice(0, 3))}</ul></div>` : ""}
      ${x.limits && x.limits.length ? `<div class="lab-sec"><h4>局限</h4><ul class="muted">${li(x.limits)}</ul></div>` : ""}
      ${links.length ? `<div class="chips lab-links">${links.join("")}</div>` : ""}
      <button class="lab-tog" data-tog="${esc(x.key)}">收起详情 ▴</button>`;
  }
  function card(x) {
    const on = OPEN.has(x.key), t = x.level === "testing";
    return `<div class="card lab-card lv-${x.level}${on ? " open" : ""}" id="lab-${esc(x.key)}">
      <div class="lab-hd">${badge(x.level, true)}<span class="lab-type">${esc(x.type)}</span><span class="lab-date">${x.date ? md(x.date) + " 检验" : "进行中"}</span></div>
      <div class="lab-title">${esc(x.title)}</div>
      <div class="lab-src">来源：${esc(x.src)}</div>
      <div class="lab-cv"><div class="lab-claim"><span class="lab-tag">他说</span>${esc(x.claim)}</div>
        <div class="lab-verdict"><span class="lab-tag ${x.level}">实测</span><b>${esc(x.verdict)}</b>${x.auto ? '<span class="muted small">（自动判读，待人工确认）</span>' : ""}</div></div>
      ${nums(x)}
      <div class="lab-use">👉 <b>对你的用处：</b>${esc(x.use)}</div>
      ${t && !x.report ? "" : `<button class="lab-tog" data-tog="${esc(x.key)}" aria-expanded="${on}">${on ? "收起详情 ▴" : "展开详情：图、要点、局限、完整报告 ▾"}</button>`}
      <div class="lab-detail">${on ? detail(x) : ""}</div>
    </div>`;
  }
  function list() {
    const xs = J.items.filter((x) => (!F.lv || x.level === F.lv) && (!F.t || x.type === F.t));
    $("#lab-list").innerHTML = xs.map(card).join("") || '<div class="card muted">没有符合条件的检验，换个筛选试试。</div>';
    $$("#lab-f [data-lv]").forEach((a) => a.classList.toggle("on", a.dataset.lv === F.lv));
    $$("#lab-f [data-t]").forEach((a) => a.classList.toggle("on", a.dataset.t === F.t));
  }
  async function listPage() {
    document.title = "网红策略验真 · 小七投研";
    const tok = A.tok();
    app.innerHTML = `<h1>🔬 网红策略验真</h1>${LOADING()}`;
    try { J = await getJSON("labs.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>🔬 网红策略验真</h1>${FAIL("验真数据暂未生成或加载失败")}`; return; }
    if (!A.alive(tok)) return;
    const c = J.cnt, n = J.n;
    const cntT = (t) => J.items.filter((x) => x.type === t).length;
    const lvChips = [["", `全部 ${J.items.length}`], ["ok", `✅ 有用 ${c.ok}`], ["partial", `⚠️ 部分成立 ${c.partial}`], ["no", `❌ 不成立 ${c.no}`]].concat(c.testing ? [["testing", `🔬 检验中 ${c.testing}`]] : []);
    const EV = await eventRow();
    if (!A.alive(tok)) return;
    const all = EV ? J.items.concat([EV]) : J.items;
    const latest = J.items.map((x) => x.date || "").sort().pop();
    app.innerHTML = `<h1>🔬 网红策略验真</h1>
      <div class="lab-sum1"><span>已检验 <b>${all.length}</b> 条：</span><span class="ok">✅ 有用 <b>${c.ok}</b></span><span class="partial">⚠️ 部分成立 <b>${c.partial + (EV ? 1 : 0)}</b></span><span class="no">❌ 不成立 <b>${c.no}</b></span></div>
      ${table(all, latest)}
      <details class="lab-intro"><summary>说明：怎么测的、哪些真正经得起检验 ▸</summary><div class="card lab-sum" style="margin-top:8px">
        <p class="muted lab-sub">抖音、公众号、网上流行的策略和说法，我们一条条复刻，用严格口径重测：不偷看（收盘出信号、次日开盘才成交）、算手续费和滑点、算上退市股、重点看博主发布之后的新数据。</p>
        ${c.testing ? `<div class="muted small lab-testing">另有 ${c.testing} 项检验中，报告出来后自动上架。</div>` : ""}
        <p class="lab-head">${esc(J.headline)}</p>
        <div class="lab-good"><b>真正经得起检验的：</b><ul>${J.good.map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div>
        <p class="muted small">徽章颜色表示结论：绿 = 有用、橙 = 部分成立、红 = 不成立（不是涨跌色）。总表里点一行，跳到下面那条的详情。</p></div></details>
      <h2>逐条详情</h2>
      <div id="lab-f"><div class="chips scroll">${lvChips.map(([k, t]) => `<a class="chip" data-lv="${k}">${t}</a>`).join("")}</div>
        <div class="chips scroll"><a class="chip" data-t="">全部类型</a>${J.types.filter(cntT).map((t) => `<a class="chip" data-t="${esc(t)}">${esc(t)} ${cntT(t)}</a>`).join("")}</div></div>
      <div id="lab-list" class="list"></div>
      <p class="muted small lab-foot">相关：<a href="#/strategies">策略库（10 个网上策略统一回测）</a> · <a href="#/backtest">回测中心（指标灵不灵）</a> · <a href="#/gurus">博主排行</a> · <a href="#/cal">大事日历（事件检验）</a>｜更新于 ${esc(J.built)}</p>
      ${DISC}`;
    list();
    app.onclick = (e) => {
      const im = e.target.closest("[data-img]");
      if (im) { lightbox(im.src, im.alt); return; }
      const go = e.target.closest("[data-go]");
      if (go) {
        e.preventDefault(); const k = go.dataset.go;
        F.lv = ""; F.t = ""; OPEN.add(k); list();
        const el = $("#lab-" + k); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
        return;
      }
      const a = e.target.closest("[data-lv],[data-t]");
      if (a && $("#lab-f").contains(a)) {
        e.preventDefault();
        if (a.dataset.lv !== undefined) F.lv = a.dataset.lv;
        if (a.dataset.t !== undefined) F.t = a.dataset.t;
        list();
        return;
      }
      const tg = e.target.closest("[data-tog]");
      if (tg) {
        const k = tg.dataset.tog, x = J.items.find((i) => i.key === k), el = $("#lab-" + k);
        if (!x || !el) return;
        const on = !OPEN.has(k);
        if (on) OPEN.add(k); else OPEN.delete(k);
        el.classList.toggle("open", on);
        el.querySelector(".lab-detail").innerHTML = on ? detail(x) : "";
        const top = el.querySelector(".lab-tog");
        top.setAttribute("aria-expanded", on);
        top.textContent = on ? "收起详情 ▴" : "展开详情：图、要点、局限、完整报告 ▾";
        if (!on && el.getBoundingClientRect().top < 0) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70 });
      }
    };
  }
  async function reportPage(key) {
    const tok = A.tok();
    const crumb = '<div class="crumb"><a href="#/labs">🔬 网红策略验真</a></div>';
    app.innerHTML = crumb + LOADING("正在加载报告…");
    let R, x;
    try {
      J = J || await getJSON("labs.json", true);
      x = J.items.find((i) => i.key === key);
      if (!x || !x.report) throw new Error("no report");
      R = await getJSON(x.report.json, true);
    } catch (e) { if (A.alive(tok)) app.innerHTML = crumb + FAIL("报告加载失败（可能还没出或网络不好）"); return; }
    if (!A.alive(tok)) return;
    document.title = R.title + " · 网红策略验真";
    OPEN.add(key);
    const toc = (R.toc || []).filter((t, k) => !(k === 0 && t[1] === 1)).map(([hid, lv, t]) => `<a data-h="${hid}" class="l${lv}">${esc(t)}</a>`).join("");
    app.innerHTML = `${crumb}
      <div class="card lab-rcard"><div class="lab-hd">${badge(x.level, true)}<span class="lab-type">${esc(x.type)}</span><span class="lab-date">报告日期 ${esc(R.date)}</span></div>
        <div class="lab-verdict"><b>${esc(x.verdict)}</b></div><div class="lab-use">👉 <b>对你的用处：</b>${esc(x.use)}</div></div>
      ${toc ? `<details class="toc"><summary>📑 目录（点开跳到章节）</summary><div class="tocl">${toc}</div></details>` : ""}
      <article class="report">${R.html}</article>
      <p class="muted small">原始报告：${esc(R.file)}｜<a href="#/labs">‹ 回到验真列表</a></p>${DISC}`;
    app.onclick = (e) => {
      const im = e.target.closest(".report img");
      if (im) { lightbox(im.src, im.alt); return; }
      const a = e.target.closest("[data-h]");
      if (!a) return;
      e.preventDefault();
      const el = document.getElementById(a.dataset.h);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
    };
  }
  function page(key) { return key ? reportPage(key) : listPage(); }
  window.__mod_labs = { page };
})();
