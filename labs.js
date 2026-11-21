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
    app.innerHTML = `<h1>🔬 网红策略验真</h1>
      <p class="muted lab-sub">抖音、公众号、网上流行的策略和说法，我们一条条复刻，用严格口径重测：不偷看（收盘出信号、次日开盘才成交）、算手续费和滑点、算上退市股、重点看博主发布之后的新数据。</p>
      <div class="card lab-sum">
        <div class="lab-stat"><div><b>${n}</b><em>已检验</em></div><div class="ok"><b>${c.ok}</b><em>✅ 有用</em></div><div class="partial"><b>${c.partial}</b><em>⚠️ 部分成立</em></div><div class="no"><b>${c.no}</b><em>❌ 不成立</em></div></div>
        ${c.testing ? `<div class="muted small lab-testing">另有 ${c.testing} 项检验中，报告出来后自动上架。</div>` : ""}
        <p class="lab-head">${esc(J.headline)}</p>
        <div class="lab-good"><b>真正经得起检验的：</b><ul>${J.good.map((g) => `<li>${esc(g)}</li>`).join("")}</ul></div>
      </div>
      <div id="lab-f"><div class="chips scroll">${lvChips.map(([k, t]) => `<a class="chip" data-lv="${k}">${t}</a>`).join("")}</div>
        <div class="chips scroll"><a class="chip" data-t="">全部类型</a>${J.types.filter(cntT).map((t) => `<a class="chip" data-t="${esc(t)}">${esc(t)} ${cntT(t)}</a>`).join("")}</div></div>
      <p class="muted small">徽章颜色表示结论：绿 = 有用、橙 = 部分成立、红 = 不成立（不是涨跌色）。点「展开详情」看图和完整报告。</p>
      <div id="lab-list" class="list"></div>
      <p class="muted small lab-foot">相关：<a href="#/strategies">策略库（10 个网上策略统一回测）</a> · <a href="#/backtest">回测中心（指标灵不灵）</a> · <a href="#/gurus">博主排行</a>｜更新于 ${esc(J.built)}</p>
      ${DISC}`;
    list();
    app.onclick = (e) => {
      const im = e.target.closest("[data-img]");
      if (im) { lightbox(im.src, im.alt); return; }
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
