/* 今天我该做什么 #/todo（按需加载）。数据：todo_build.py → todo.json
   只放检验过有效的：仓位上限（综合报告）、板块分区（sector_zones，有回测）、A股选股 v2 分散组合前 20。
   「我的持仓提醒」是密文（与财富规划同一套：AES-256-CBC + PBKDF2-SHA256 20 万次，同一密码），输入密码后在浏览器本地解密。
   没通过检验的（规则买卖点、跟游资、博主、网红策略…）只在底部折叠区列结论和链接。 */
(function () {
  const A = window.__APP;
  const { app, esc, pct, updn, FAIL, DISC, getJSON } = A;
  if (!document.getElementById("td-css")) {
    const st = document.createElement("style");
    st.id = "td-css";
    st.textContent = `
.td{font-variant-numeric:tabular-nums}
.td h1{margin:4px 0 2px}.td-meta{font-size:12.5px;color:var(--sub);margin:2px 0 12px;line-height:1.6}
.td-hero{border-left:6px solid var(--up);padding:14px 16px}
.td-hero .hl{font-size:17px;font-weight:700;line-height:1.55;margin:0 0 8px}
.td-pos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.td-pos>div{background:var(--soft);border-radius:10px;padding:9px 11px;font-size:13.5px;line-height:1.55;min-width:0}
.td-pos b.cap{font-size:20px;color:var(--text)}.td-pos .w{font-weight:700;margin-left:6px}
.td-pos .w.td-y{color:var(--up)}.td-pos .w.td-w{color:var(--warn)}.td-pos .w.td-n{color:var(--dn)}
.td-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0 4px;align-items:start}
.td-col{background:var(--card);border:1px solid var(--line);border-radius:var(--r);border-top:5px solid var(--sub2);padding:10px 12px 8px;min-width:0}
.td-col.td-y{border-top-color:var(--up)}.td-col.td-w{border-top-color:#e8a317}.td-col.td-n{border-top-color:var(--dn)}
.td-col>h2{font-size:17px;margin:2px 0 2px;display:flex;align-items:baseline;gap:8px}.td-col>h2 em{font-style:normal;font-size:12.5px;color:var(--sub);font-weight:600}
.td-col.td-y>h2{color:var(--up)}.td-col.td-w>h2{color:var(--warn)}.td-col.td-n>h2{color:var(--dn)}
.td-col .cs{font-size:12.5px;color:var(--sub);margin:0 0 6px;line-height:1.55}
.td-sub{font-size:13px;font-weight:700;margin:10px 0 2px;color:var(--text)}
.td-it{display:block;padding:7px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none;min-width:0}
.td-it:first-of-type{border-top:0}
.td-it .n{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}.td-it .n b{font-size:15px}.td-it .n i{font-style:normal;font-size:11.5px;color:var(--sub2)}
.td-it .n .px{margin-left:auto;font-size:13px;color:var(--sub);white-space:nowrap}
.td-it .w{font-size:12.5px;color:var(--sub);line-height:1.5;margin-top:1px;overflow-wrap:anywhere}
.td-it .k{font-size:12.5px;line-height:1.5;margin-top:1px}.td-it .k span{margin-right:10px;white-space:nowrap}.td-it .k .st{color:var(--dn)}
.td-tag{display:inline-block;font-size:11px;line-height:17px;padding:0 5px;border-radius:5px;font-weight:600;background:#f1f2f4;color:var(--sub);white-space:nowrap}
.td-tag.new{background:var(--up-bg);color:var(--up-t)}.td-tag.etf{background:#e8f1fc;color:#1d64b8}
.td details.more>summary{cursor:pointer;font-size:13px;color:var(--brand);padding:6px 0;list-style:none}.td details.more>summary::-webkit-details-marker{display:none}
.td-chips{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 6px}.td-chips a{font-size:12.5px;padding:2px 8px;border-radius:12px;background:var(--dn-bg);color:var(--dn-t);white-space:nowrap}
.td-lock{text-align:center;padding:22px 14px}.td-lock .ic{font-size:30px}.td-lock p{margin:6px 0;color:var(--sub);font-size:13.5px}
.td-lock input[type=password]{font-size:16px;padding:9px 12px;width:min(260px,80%);border:1px solid var(--line);border-radius:10px;margin-top:6px}
.td-lock button,.td-btn{font-size:15px;margin-top:10px;padding:8px 26px;border:0;border-radius:10px;background:var(--up);color:#fff;font-weight:600;cursor:pointer}
.td-btn.ghost{background:#eceef2;color:var(--sub);font-size:12.5px;padding:4px 12px;margin:0}
.td-hold{border-left:6px solid var(--warn)}.td-hold.td-y{border-left-color:var(--up)}.td-hold.td-n{border-left-color:var(--dn)}
.td-hold .big{font-size:17px;font-weight:700;line-height:1.5}.td-hold .act{font-size:16px;font-weight:700;margin:6px 0}
.td-hold .act.td-y{color:var(--up)}.td-hold .act.td-w{color:var(--warn)}.td-hold .act.td-n{color:var(--dn)}
.td-ln{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:baseline;font-size:13.5px;padding:6px 0;border-top:1px solid var(--line)}.td-ln>b:last-child{white-space:nowrap}
.td-kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0}.td-kv div{background:var(--soft);border-radius:8px;padding:6px 8px;font-size:12px;color:var(--sub)}.td-kv b{display:block;font-size:15px;color:var(--text)}
.td-rule{font-size:12.5px;color:var(--sub);line-height:1.6;margin:8px 0 0}
.td-bad{margin:0;padding:0;list-style:none}.td-bad li{padding:8px 0;border-top:1px solid var(--line);font-size:13.5px;line-height:1.55}.td-bad li:first-child{border-top:0}
.td-bad b{display:block}.td-bad span{color:var(--sub)}
.td-src{font-size:12.5px;color:var(--sub);line-height:1.7}
@media (max-width:900px){.td-3{grid-template-columns:1fr}}
@media (max-width:600px){.td-pos{grid-template-columns:1fr}.td-kv{grid-template-columns:repeat(2,minmax(0,1fr))}.td-hero .hl{font-size:16px}}
`;
    document.head.appendChild(st);
  }
  const f2 = (x, n = 2) => (x == null ? "—" : (+x).toFixed(n));
  const md = (s) => String(s || "").slice(5).replace(/^(\d\d)-(\d\d)/, "$1-$2");
  // 组合打分理由白话化（原文：市值偏低(156亿)、20日波动率偏低(1.7%)…）
  const plain = (s) => String(s || "").replace(/市值偏低/g, "公司不大").replace(/20日波动率偏低/g, "近一月涨跌平稳").replace(/换手率偏低/g, "交易冷清").replace(/5日涨幅偏低/g, "近5天跌得多");
  const vcls = (w) => (/不推荐|降风险/.test(w) ? "td-n" : /可以考虑/.test(w) ? "td-y" : "td-w");
  const CC = { yes: "td-y", wait: "td-w", no: "td-n" };

  function item(x) {
    if (x.kind === "sector") {
      const z = x.zone && x.zone.length === 2 ? `买入区 ${f2(x.zone[0], 3)}–${f2(x.zone[1], 3)}` : "";
      return `<a class="td-it" href="${esc(x.href)}"><div class="n"><b>${esc(x.name)}</b><i>${esc(x.code)}</i><span class="td-tag etf">板块</span><span class="px">${f2(x.price, 3)} <em class="${updn(x.pct)}" style="font-style:normal">${x.pct == null ? "" : pct(x.pct, 2)}</em></span></div>
        <div class="w">${esc(x.why || "")}</div>${z || x.stop ? `<div class="k">${z ? `<span>${z}</span>` : ""}${x.stop ? `<span class="st">止损 ${f2(x.stop, 3)}</span>` : ""}</div>` : ""}</a>`;
    }
    const tag = x.kind === "v2" ? (x.new ? '<span class="td-tag new">新进</span>' : '<span class="td-tag">仍在</span>') : x.kind === "v2drop" ? '<span class="td-tag">掉出组合</span>' : '<span class="td-tag">组合缓冲</span>';
    return `<a class="td-it" href="${esc(x.href)}"><div class="n"><b>${esc(x.name)}</b><i>${esc(x.code)}</i>${tag}<span class="px">参考价 ${f2(x.price)}</span></div>
      <div class="w">${esc(x.kind === "v2" ? `第 ${x.rank} 名：${plain(x.why)}` : x.why)}${x.limit_up ? "；今天涨停，开盘涨停不追" : ""}</div>${x.kind === "v2" && x.stop ? `<div class="k"><span class="st">止损参考 ${f2(x.stop)}</span></div>` : ""}</a>`;
  }
  const list = (xs, show) => xs.length <= show + 1 ? xs.map(item).join("") : xs.slice(0, show).map(item).join("") + `<details class="more"><summary>展开另外 ${xs.length - show} 只 ▾</summary>${xs.slice(show).map(item).join("")}</details>`;

  function cols(D) {
    const V = D.v2 || {}, S = D.sector || {}, bt = S.bt || {};
    const sb = D.buy.filter((x) => x.kind === "sector"), vb = D.buy.filter((x) => x.kind === "v2");
    const sw = D.wait.filter((x) => x.kind === "sector"), vk = D.wait.filter((x) => x.kind !== "sector");
    const sn = D.no.filter((x) => x.kind === "sector"), vd = D.no.filter((x) => x.kind !== "sector");
    const buy = `<div class="td-col td-y"><h2>可以考虑买入 <em>${D.buy.length} 个</em></h2>
      ${sb.length ? `<div class="td-sub">板块（处在可买区）</div>${sb.map(item).join("")}` : '<div class="td-sub">板块</div><div class="cs">今天没有处在「可买」区的板块。</div>'}
      ${vb.length ? `<div class="td-sub">A股选股组合 ${vb.length} 只（一篮子分散买）</div>
        <div class="cs">每只 ≤ 2%，${V.n_new ? `今天换仓：新进 ${V.n_new} 只、仍在 ${V.n_keep} 只；` : ""}按下个交易日开盘价买。和板块、宽基加起来不超过上面的总仓位上限，钱不够就每只等比例少买，<b>不要只挑几只</b>。</div>${list(vb, 6)}` : ""}</div>`;
    const wait = `<div class="td-col td-w"><h2>等待确认 <em>${D.wait.length} 个</em></h2><div class="cs">还没到条件，先别买；条件写在每条下面。</div>
      ${sw.length ? `<div class="td-sub">板块 / 宽基</div>${sw.map(item).join("")}` : ""}
      ${vk.length ? `<div class="td-sub">组合缓冲区（已持有的拿着）</div>${vk.map(item).join("")}` : ""}
      ${D.wait.length ? "" : '<div class="cs">今天没有。</div>'}</div>`;
    const av = D.avoid || [];
    const no = `<div class="td-col td-n"><h2>不推荐 / 该减 <em>${D.no.length + av.length} 个</em></h2><div class="cs">别买；手里有的照每条写的处理。</div>
      ${sn.length ? `<div class="td-sub">板块：到目标区或转弱</div>${sn.map(item).join("")}` : ""}
      ${vd.length ? `<div class="td-sub">掉出选股组合 ${vd.length} 只</div>${list(vd, 4)}` : ""}
      ${av.length ? `<div class="td-sub">破位回避 ${av.length} 个（不碰，持有的走）</div><div class="td-chips">${av.map((x) => `<a href="${esc(x.href)}">${esc(x.name.replace(/ETF$/, ""))}</a>`).join("")}</div>` : ""}</div>`;
    const why = `<p class="muted small">为什么只放这两样：板块分区回测 ${bt.from ? `${esc(bt.from.slice(0, 7))}~${esc(String(bt.to || "").slice(0, 7))}` : ""} 进买入区后买 ${bt.n || "—"} 次，平均每次 ${bt.mean == null ? "—" : pct(bt.mean, 2)}、赚钱的占 ${bt.win == null ? "—" : f2(bt.win, 0)}%（统计上站得住，t=${f2(bt.t_stat, 1)}）；
      选股组合样本外（2022-02 起，扣成本）年化 ${V.cagr == null ? "—" : pct(V.cagr, 1)}、比同池股票平均每年多 ${V.excess == null ? "—" : pct(V.excess, 1)}，但 t=${f2(V.t, 1)} <b>不显著</b>、最大回撤 ${f2(V.mdd, 0)}%——所以只能分散买一篮子，单只没有意义。止损参考＝买入价 −7%，回测里机械止损反而降收益，组合规则默认不止损，只作风控参考。
      <a href="#/sectors">板块看板 ›</a>　<a href="stock/#/picks/cn">选股组合详情 ›</a></p>`;
    return `<div class="td-3">${buy}${wait}${no}</div>${why}`;
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
  function lockBox(D) {
    if (!D.lock) return `<div class="card muted">持仓提醒今天没有生成（${esc(D.lock_note || "数据缺失")}）。</div>`;
    return `<div class="card td-lock" id="tdlock"><div class="ic">🔒</div><b>我的持仓提醒</b><p>只有老大能看：内容已加密，输入密码后在这台设备上解密（和「财富规划」同一个密码）。</p>
      <input id="tdpw" type="password" placeholder="输入密码查看" autocomplete="current-password"><br>
      <label class="muted small"><input type="checkbox" id="tdrm" checked> 在这台设备上记住</label><br><button id="tdgo">查看</button><p id="tdmsg" class="small"></p></div>`;
  }
  function holdHTML(B) {
    return B.rows.map((r) => {
      const ln = r.lines.map((l) => {
        const t = l.hit ? "已触发" : l.k === "prot" ? `还要跌 ${f2(l.dist, 1)}%` : `还要涨 ${f2(l.dist, 1)}%`;
        return `<div class="td-ln"><b>${esc(l.name)} $${esc(l.px)}</b><span class="muted">${esc(l.say)}</span><b class="${l.hit ? "up" : l.k === "prot" && l.dist < 5 ? "dn" : ""}">${t}</b></div>`;
      }).join("");
      return `<div class="card td-hold ${CC[r.cls] || "td-w"}"><div class="big">${esc(r.name)}：${esc(r.one)}</div>
        ${r.live ? `<div class="muted small">最新 $${f2(r.live.px)}（美东 ${esc(r.live.t)}）；只看收盘价，盘中跌破不算</div>` : ""}
        <div class="act ${CC[r.cls] || "td-w"}">👉 今天：${esc(r.act)}</div>${ln}
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
    let D;
    try { D = await getJSON("todo.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>今天我该做什么</h1>${FAIL("今天的清单还没生成（每份报告推送后更新）")}`; return; }
    if (!A.alive(tok)) return;
    const P = D.pos || {}, cn = P.cn || {}, us = P.us || {}, V = D.v2 || {}, S = D.sector || {};
    const posBox = (flag, x) => x.cap == null ? "" : `<div><div>${flag} 股票类合计 ≤ <b class="cap">${esc(x.cap)}%</b><span class="w ${vcls(x.word)}">${esc(x.word)}</span></div>
      <div class="muted small">${esc(x.reason)}${x.quad ? `（${esc(x.quad)}）` : ""}　<a href="#/report/${esc(x.id)}">${esc(x.task || "报告")}原文 ›</a></div></div>`;
    app.innerHTML = `<div class="td"><h1>今天我该做什么</h1>
      <div class="td-meta">⏱ 数据时点：A股 ${esc(cn.dtime || "—")}｜板块分区 ${esc(S.date || "—")} 收盘｜选股组合 ${esc(V.computed_at || "—")}｜美股 ${esc(us.dtime || "—")}｜本页 ${esc(D.built)} 生成</div>
      <div class="card td-hero"><div class="hl">${esc(D.headline)}</div><div class="td-pos">${posBox("🇨🇳 A股", cn)}${posBox("🇺🇸 美股", us)}</div>
      <div class="muted small" style="margin-top:6px">仓位上限取自最新综合报告第〇章；下面三栏只放<b>回测检验过有效</b>的两样东西：板块分区、A股选股组合。点名字看详情。</div></div>
      ${cols(D)}
      <h2>🔒 我的持仓提醒</h2><div id="tdhold">${lockBox(D)}</div>
      <details class="card"><summary>🧪 这些我们检验过，没用（所以不放上面）</summary>
        <ul class="td-bad">${(D.invalid || []).map((x) => `<li><b><a href="${esc(x.href)}">${esc(x.name)} ›</a></b><span>${esc(x.res)}${x.date ? `（截至 ${esc(x.date)}）` : ""}</span></li>`).join("")}</ul>
        <p class="muted small">这些页面还留着（导航「研究区」），用来学习和继续跟踪；只是不拿它们当买卖依据。</p></details>
      <h2>数据来源</h2><div class="card td-src">仓位：最新 A股盘后综合 / 美股盘前报告第〇章（${esc(cn.dtime || "—")}；${esc(us.dtime || "—")}）。<br>
        板块分区：sector_zones 当天结果（${esc(S.date || "—")} 收盘），${esc(S.brief || "")}。<br>
        选股组合：v2「经典异象等权」市值前 1000 打分，${esc(V.computed_at || "—")} 计算，上次换仓 ${esc(V.prev_date || "—")}，每 ${esc(V.rebalance || 20)} 个交易日换一次；信号用收盘数据，下个交易日开盘执行。<br>
        持仓提醒：老大确认的持仓记录 + 腾讯行情，加密后才上网站。</div>
      ${DISC}</div>`;
    bindLock(D, tok);
  }
  window.__mod_todo = { page };
})();
