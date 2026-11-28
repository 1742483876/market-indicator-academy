/* 📡 X 要闻 + 新闻→后续走势 #/xnews（读 newsimpact.json，news_impact.py 生成）
   老大 2026-11-27：「用 aihub 去看 X 上的新闻……推送的时候多看最新新闻；结合历史新闻和对应股票后续的走势也做一下」
   三块：① 一句结论（跟着新闻做有没有用）② 最新 X 要闻（48 小时，原推链接 + 已经走出来的涨跌）③ 历史统计与例子（默认折叠细节）。 */
(function () {
  const A = window.__APP;
  const { app, esc, FAIL, DISC, getJSON } = A;
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  if (!document.getElementById("xn-css")) {
    const st = document.createElement("style"); st.id = "xn-css";
    st.textContent = `
.xn-v{color:var(--text);border-radius:14px;padding:14px 16px;margin:6px 0 14px;background:var(--card);border:1px solid var(--line);border-left:6px solid #9aa3ad}
.xn-v.xv-no{border-left-color:#1f9d55}.xn-v details{margin-top:6px}.xn-v summary{font-size:13px;color:var(--brand);cursor:pointer}.xn-v.xv-part{border-left-color:#e8a317}.xn-v b.w{font-size:19px;display:block;margin-bottom:6px}
.xn{overflow-wrap:anywhere}.xn-v p,.xn-i .m,.xn-i .h b{white-space:normal}.xn-v p{margin:4px 0;font-size:14.5px;line-height:1.7}.xn-v p b{white-space:normal}
.xn-tabs{display:flex;gap:6px;margin:4px 0 10px}.xn-tabs a{flex:1;text-align:center;padding:8px 0;border-radius:10px;background:var(--soft);color:var(--sub);font-weight:700;font-size:14px;text-decoration:none}
.xn-tabs a.on{background:var(--brand);color:#fff}
.xn-i{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin:0 0 9px}
.xn-i .h{display:flex;gap:6px;align-items:flex-start}.xn-i .h b{flex:1;font-size:15px;line-height:1.55}
.xn-tag{flex:none;font-size:12px;font-weight:800;padding:2px 8px;border-radius:6px;color:#fff !important;margin-top:2px;line-height:1.5}
.xn-tag.up{background:#e5484d}.xn-tag.dn{background:#1f9d55}.xn-tag.mid{background:#9aa3ad}
.xn-i .m{font-size:12.5px;color:var(--sub);margin-top:4px;line-height:1.6}.xn-i .m a{color:var(--brand)}
.xn-i .mv{font-size:12.5px;margin-top:4px}.xn-i .mv span{display:inline-block;margin-right:10px;font-variant-numeric:tabular-nums}
.xn-rumor{font-size:11px;color:#b7791f;font-weight:700;margin-left:4px}
.xn table{width:100%;border-collapse:collapse;font-size:13px}.xn th,.xn td{padding:6px 5px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.xn th:first-child,.xn td:first-child{text-align:left}.xn .tw{overflow-x:auto}
.xn .up{color:#e5484d}.xn .dn{color:#1f9d55}
`;
    document.head.appendChild(st);
  }
  const cls = (v) => (v == null ? "" : v > 0 ? "up" : v < 0 ? "dn" : "");
  const pc = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + Number(v).toFixed(1) + "%");
  const tag = (d) => (d === "利好" ? `<span class="xn-tag up">利好</span>` : d === "利空" ? `<span class="xn-tag dn">利空</span>` : `<span class="xn-tag mid">看结果</span>`);
  const cell = (s) => (!s || !s.n ? "—" : `<span class="${cls(s.mean)}">${s.mean > 0 ? "+" : ""}${s.mean.toFixed(2)}%</span><br><small class="muted">胜${s.win}% · n${s.n}${Math.abs(s.t) >= 2 ? " · <b>t" + s.t + "</b>" : ""}</small>`);

  function latestHTML(J) {
    const L = J.latest || [];
    if (!L.length) return `<div class="card muted">近 48 小时还没有存档的 X 要闻（X 快讯任务每 2 小时搜一次）。</div>`;
    return (J.latest_sum ? `<p class="muted" style="margin:0 0 8px">💬 ${esc(J.latest_sum)}（截至 ${esc(J.latest_at || "")} 北京）</p>` : "") +
      L.map((x) => {
        const mv = (x.moves || []).filter((m) => m.x0 != null).map((m) => `<span>${esc(m.tk)} 当天 <b class="${cls(m.x0)}">${pc(m.x0)}</b>${m.x5 != null ? ` · 5天后 <b class="${cls(m.x5)}">${pc(m.x5)}</b>` : ""}</span>`).join("");
        return `<div class="xn-i"><div class="h">${tag(x.dir)}<b>${esc(x.zh)}${x.rumor ? `<span class="xn-rumor">⚠️传闻</span>` : ""}</b></div>
          ${x.impact ? `<div class="m">影响：${esc(x.impact)}${(x.tickers || []).length ? " · " + esc(x.tickers.join("/")) : ""}</div>` : ""}
          ${mv ? `<div class="mv">相对大盘：${mv}</div>` : ""}
          <div class="m">${esc(x.author)} · ${esc(x.bj)} 北京 · 重要度 ${x.imp} · <a href="${esc(x.url)}" target="_blank" rel="noopener">看原推 ›</a></div></div>`;
      }).join("");
  }

  function statHTML(J) {
    const T = J.tables || {};
    const row = (name, g) => (!g || !g.n ? "" : `<tr><td>${esc(name)}</td><td>${g.n}</td><td>${cell(g.react)}</td><td>${cell(g.f1)}</td><td>${cell(g.f5)}</td><td>${cell(g.f10)}</td></tr>`);
    const head = `<tr><th>分组</th><th>n</th><th>当天<br><small>顺新闻方向</small></th><th>跟着做<br>1天</th><th>5天</th><th>10天</th></tr>`;
    let h = `<h2>按方向 / 市场</h2><div class="tw"><table>${head}${row("全部有方向", T.all)}${row("利好", (T.by_dir || {})["利好"])}${row("利空", (T.by_dir || {})["利空"])}${row("重要度≥4", T.big)}${row("传闻", (T.rumor || {})["传闻"])}${row("非传闻", (T.rumor || {})["非传闻"])}${row("美股", (T.by_mk || {}).us)}${row("A股", (T.by_mk || {}).cn)}${row("港股", (T.by_mk || {}).hk)}</table></div>`;
    const cats = Object.entries(T.by_cat || {}).filter(([, g]) => g.n >= 3).sort((a, b) => b[1].n - a[1].n);
    if (cats.length) h += `<h2>按新闻类型</h2><div class="tw"><table>${head}${cats.map(([c, g]) => row(c, g)).join("")}</table></div>`;
    const ab = T.after_big || {};
    h += `<h2>当天已经大涨 / 大跌之后</h2><div class="tw"><table><tr><th>情况</th><th>n</th><th>之后1天</th><th>5天</th><th>10天</th></tr>${Object.entries(ab).map(([k, g]) => `<tr><td>${esc(k)}</td><td>${g.n}</td><td>${cell(g.f1)}</td><td>${cell(g.f5)}</td><td>${cell(g.f10)}</td></tr>`).join("")}</table></div>`;
    h += `<p class="muted small">「当天」= 新闻后第一个收盘相对前一天（含新闻冲击，你基本吃不到）；「跟着做」= 当天收盘才按新闻方向买（利好）或卖（利空），之后 N 天相对大盘，已扣往返成本（美股 0.10%、A/港 0.25%）。t≥2 才算站得住；分类多、样本少，单个分类好看可能是运气。</p>`;
    return h;
  }

  function examplesHTML(J) {
    const R = (J.rows || []).slice(0, 80);
    if (!R.length) return `<div class="card muted">还没有可统计的例子。</div>`;
    return R.map((r) => `<div class="xn-i"><div class="h">${tag(r.dir)}<b>${esc(r.zh)}${r.rumor ? `<span class="xn-rumor">⚠️传闻</span>` : ""}</b></div>
      <div class="mv"><span><b>${esc(r.tk)}</b> ${esc(r.d0)}</span><span>当天 <b class="${cls(r.x0)}">${pc(r.x0)}</b></span><span>1天 <b class="${cls(r.x1)}">${pc(r.x1)}</b></span><span>5天 <b class="${cls(r.x5)}">${r.x5 == null ? "未到" : pc(r.x5)}</b></span></div>
      <div class="m">${esc(r.cat)} · ${esc(r.author)} · ${esc(r.t)} UTC · <a href="${esc(r.url)}" target="_blank" rel="noopener">原推 ›</a>（涨跌均为相对大盘）</div></div>`).join("");
  }

  async function page() {
    document.title = "X 要闻 · 新闻后来怎么走 · 小七投研";
    const tok = A.tok();
    app.innerHTML = `<h1>📡 X 要闻 · 新闻后来怎么走</h1>${A.LOADING()}`;
    let J;
    try { J = await getJSON("newsimpact.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>📡 X 要闻</h1>${FAIL("还没生成（运行 news_impact.py）")}`; return; }
    if (!A.alive(tok)) return;
    const v = J.verdict || {};
    const P = (l) => `<p>${esc(l).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</p>`;
    const vc = (v.word || "").includes("❌") ? "no" : (v.word || "").includes("⚠️") ? "part" : "";
    let tab = "latest";
    const draw = () => {
      app.innerHTML = `<div class="xn"><h1>📡 X 要闻 · 新闻后来怎么走</h1>
        <div class="xn-v xv-${vc}"><b class="w">${esc(v.word || "")}</b>${(v.lines || []).slice(0, 2).map(P).join("")}
          ${(v.lines || []).length > 2 ? `<details><summary>更多说明（利空后反弹、样本偏差）</summary>${v.lines.slice(2).map(P).join("")}</details>` : ""}
          <p class="muted small">样本 ${J.n_news} 条 X 新闻 / ${J.n_rows} 个「新闻×股票」，反应日 ${esc((J.span || [])[0] || "—")} ~ ${esc((J.span || [])[1] || "—")} · 数据 ${esc(J.built)}</p></div>
        <div class="xn-tabs"><a href="javascript:;" data-t="latest" class="${tab === "latest" ? "on" : ""}">最新要闻</a><a href="javascript:;" data-t="stat" class="${tab === "stat" ? "on" : ""}">历史统计</a><a href="javascript:;" data-t="ex" class="${tab === "ex" ? "on" : ""}">历史例子</a></div>
        <div id="xnb">${tab === "latest" ? latestHTML(J) : tab === "stat" ? statHTML(J) : examplesHTML(J)}</div>${DISC}</div>`;
      $$(".xn-tabs a").forEach((a) => a.addEventListener("click", () => { tab = a.dataset.t; draw(); window.scrollTo({ top: 0 }); }));
    };
    draw();
  }
  window.__mod_xnews = { page };
})();
