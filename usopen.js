/* 小七投研 · 美股开盘惯性 #/usopen（读 usopen.json，usopen.py 每天美股收盘后生成；检验报告 reports/*_usopen_lab.md → #/labs/usopen）。
   首屏：三行大字结论 + 检验徽标；今晚实时面板（浏览器直接取腾讯美股分时，腾讯接口允许跨域；取不到就用 usopen.json 里的快照）；
   强度 → 后续对照（电脑表格、手机卡片，不横向滚动）+ 柱状图 + 时间段热力图（ECharts 懒加载）；期权快进快出一栏；前瞻记录；说明默认折叠。 */
(function () {
  const A = window.__APP;
  const { esc, stockLink } = A;
  const n = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d));
  const sg = (v, d = 2) => (v == null || isNaN(v) ? "—" : Math.abs(v) < Math.pow(10, -d) / 2 ? (0).toFixed(d) + "%" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(d) + "%");
  const P = (v) => (v == null || isNaN(v) ? "—" : Math.round(v * 100) + "%");
  const cls = (v) => (v == null || isNaN(v) || Math.abs(v) < 0.005 ? "" : v > 0 ? "up" : "dn");
  const C = (v, d = 2) => `<span class="${cls(v)}">${sg(v, d)}</span>`;
  const TAG = { "✅": "ok", "⚠️": "part", "❌": "no" };
  const tag = (v) => `<i class="uolv ${TAG[v] || "no"}">${esc(v === "❌" ? "❌ 不成立" : v === "⚠️" ? "⚠️ 部分成立" : v === "✅" ? "✅ 成立" : v)}</i>`;
  const TX = { QQQ: "usQQQ.OQ", SPY: "usSPY.AM", NVDA: "usNVDA.OQ", TSLA: "usTSLA.OQ" };
  const EDGES = [-1.5, -0.75, -0.25, 0.25, 0.75, 1.5];
  const binOf = (r) => { let i = 0; while (i < EDGES.length && r >= EDGES[i]) i++; return i; };
  let timer = null;
  const mk = (el) => { const old = window.echarts.getInstanceByDom(el); if (old) old.dispose(); return A.mk(el); };

  if (!document.getElementById("uo-css")) {
    const st = document.createElement("style");
    st.id = "uo-css";
    st.textContent = `.uo{max-width:1100px}
.uo h1{margin-bottom:4px}.uo .sub0{color:var(--sub);font-size:13px;margin:0 0 10px}
.uo .hero{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 16px;margin:8px 0 12px}
.uo .hl{padding:12px 0;border-bottom:1px solid var(--line)}.uo .hl:last-child{border-bottom:0}
.uo .hl .big{font-size:20px;font-weight:800;line-height:1.45;overflow-wrap:anywhere}
.uo .hl .sm{font-size:13px;color:var(--sub);line-height:1.6;margin-top:4px}
@media (max-width:600px){.uo .hl .big{font-size:17px}}
.uo .uolv{font-style:normal;font-size:12px;font-weight:700;border-radius:6px;padding:2px 7px;margin-left:6px;white-space:nowrap;vertical-align:2px}
.uo .uolv.ok{background:#e7f6ee;color:#1d7a4c}.uo .uolv.part{background:#fff4d6;color:#8a5a00}.uo .uolv.no{background:#eef0f3;color:#6b7280}
.uo .up{color:var(--up)}.uo .dn{color:var(--dn)}
.uo h2{font-size:17px;margin:18px 0 8px}
.uo .live{display:grid;grid-template-columns:1fr;gap:10px}@media (min-width:760px){.uo .live{grid-template-columns:1fr 1fr}}
.uo .lc{background:var(--card);border:1px solid var(--line);border-left:6px solid #9aa3ad;border-radius:12px;padding:10px 14px}
.uo .lc.u{border-left-color:var(--up)}.uo .lc.d{border-left-color:var(--dn)}
.uo .lc .lh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.uo .lc .lh b{font-size:16px}.uo .lc .lh .pct{font-size:24px;font-weight:800}
.uo .lc .lb{font-size:13.5px;line-height:1.65;margin-top:4px;overflow-wrap:anywhere}.uo .lc .lb .muted{font-size:12.5px}
.uo .uobar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0 8px}
.uo .seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden}
.uo .seg button{white-space:nowrap;border:0;background:var(--card);padding:5px 12px;font-size:13px;color:var(--sub);cursor:pointer}
.uo .seg button.on{background:var(--brand);color:#fff}
.uo table.t{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--card)}
.uo table.t th,.uo table.t td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.uo table.t th:first-child,.uo table.t td:first-child{text-align:left}
.uo table.t th{color:var(--sub);font-weight:600;font-size:12.5px;white-space:normal}
.uo .dk{display:none}@media (min-width:760px){.uo .dk{display:block}.uo .mb{display:none}}
.uo .mb .row{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-bottom:6px}
.uo .mb .row .r1{display:flex;justify-content:space-between;gap:8px;font-weight:700;font-size:14.5px}
.uo .mb .row .r2{font-size:13px;color:var(--sub);line-height:1.6;margin-top:2px;overflow-wrap:anywhere}.uo .mb .row .r2 b{color:var(--text)}
.uo .ch{width:100%;height:300px;background:var(--card);border:1px solid var(--line);border-radius:12px;margin:8px 0}
.uo .ch.hm{height:330px}@media (max-width:600px){.uo .ch.hm{height:300px}}
.uo .card p{margin:4px 0;line-height:1.65;font-size:14px}
.uo .cost{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0}@media (min-width:760px){.uo .cost{grid-template-columns:repeat(4,1fr)}}
.uo .cost div{background:var(--soft);border-radius:10px;padding:8px 10px}.uo .cost b{display:block;font-size:20px}.uo .cost span{font-size:12px;color:var(--sub)}
.uo details.f{margin:8px 0}.uo details.f>summary{cursor:pointer;color:var(--brand);font-size:14px;list-style:none;padding:4px 0}
.uo details.f>summary::-webkit-details-marker{display:none}
.uo details.f ul{margin:4px 0 0;padding-left:18px;font-size:13.5px;line-height:1.7}
.uo .led td:nth-child(2),.uo .led th:nth-child(2){text-align:left}`;
    document.head.appendChild(st);
  }

  // ---------------- 今晚实时 ----------------
  function etNow() {
    const s = new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour12: false });
    const d = new Date(s);
    return { wd: d.getDay(), m: d.getHours() * 60 + d.getMinutes(), d };
  }
  async function txMinute(sym) {
    const r = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/UsMinute/query?code=${TX[sym]}&_=${Date.now()}`, { cache: "no-store" });
    const j = await r.json();
    const x = j.data[TX[sym]], rows = x.data.data, px = {};
    rows.forEach((s) => { const f = s.split(" "); const k = +f[0].slice(0, 2) * 60 + +f[0].slice(2) - 570; if (k >= 0 && k <= 390) px[k] = +f[1]; });
    const qt = (x.qt || {})[TX[sym]] || [];
    const ks = Object.keys(px).map(Number).sort((a, b) => a - b);
    if (!ks.length) throw new Error("空");
    const at = (k) => { let v = null; ks.forEach((q) => { if (q <= k) v = px[q]; }); return v; };
    const p0 = px[ks[0]], kl = ks[ks.length - 1];
    return { sym, date: x.data.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), k: kl, now: (px[kl] / p0 - 1) * 100,
      r5: kl >= 5 ? (at(5) / p0 - 1) * 100 : null, r15: kl >= 15 ? (at(15) / p0 - 1) * 100 : null, r30: kl >= 30 ? (at(30) / p0 - 1) * 100 : null,
      gap: qt[4] ? (p0 / +qt[4] - 1) * 100 : null, live: true };
  }
  function liveCard(J, s) {
    const etf = s.sym === "QQQ" || s.sym === "SPY";
    const N = s.k >= 30 ? 30 : s.k >= 15 ? 15 : s.k >= 5 ? 5 : 0;
    const r = N === 30 ? s.r30 : N === 15 ? s.r15 : N === 5 ? s.r5 : null;
    const hm = (k) => { const m = 570 + k; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
    let body = "";
    if (!N || r == null) body = `<div class="lb muted">开盘还不到 5 分钟，等一会儿再看。</div>`;
    else if (etf) {
      let b = binOf(r);
      let B = (J.bins[s.sym] || {})[String(N)] || [];
      let row = B[b] || {};
      let note = "";
      if ((row.n || 0) < 10 && (b === 0 || b === 6)) { row = B[b === 0 ? 1 : 5] || {}; note = "（超 1.5% 的历史太少，按 0.75~1.5% 档）"; }
      const flat = b === 3, word = r < 0 ? "跌" : "涨";
      body = `<div class="lb">开盘 ${N} 分钟 ${C(r)}，属于「<b>${esc(row.label || "")}</b>」档${note}。</div>
        <div class="lb">按历史（${row.n || 0} 次），接下来 30 分钟中间一半落在 <b>${sg(row.q25)} ~ ${sg(row.q75)}</b>，平均 ${C(row.m30, 3)}；`
        + (flat ? `上涨的概率 ${P(row.up30)}。` : `继续${word}的概率 <b>${P(row.p30)}</b>；到收盘继续${word} ${P(row.pc)}、平均 ${C(row.mc)}。`) + `</div>`;
    } else if (J.stk5) {
      const SE = [-3, -1.5, -0.5, 0.5, 1.5, 3];
      let b = 0; while (b < SE.length && r >= SE[b]) b++;
      const own = ((J.stk5.sym || {})[s.sym] || {})[String(N)] || [];
      const pool = (J.bins["个股"] || {})[String(N)] || [];
      let row = own[b] && own[b].n >= 20 ? own[b] : pool[b] || {};
      const src = own[b] && own[b].n >= 20 ? `${s.sym} 自己 ${J.stk5.span.slice(0, 7)} 起 ${row.n} 次` : `${J.stk5.n} 只大票合并 ${row.n} 次`;
      const flat = b === 3, word = r < 0 ? "跌" : "涨";
      body = `<div class="lb">开盘 ${N} 分钟 ${C(r)}，属于个股「<b>${esc(row.label || "")}</b>」档。</div>
        <div class="lb">按历史（${src}），接下来 30 分钟中间一半落在 <b>${sg(row.q25)} ~ ${sg(row.q75)}</b>，平均 ${C(row.m30, 3)}；`
        + (flat ? `上涨的概率 ${P(row.up30)}。` : `继续${word}的概率 <b>${P(row.p30)}</b>；到收盘继续${word} ${P(row.pc)}、平均 ${C(row.mc)}。`) + `</div>`;
    } else {
      const S = (J.stocks && J.stocks.rows) || [];
      if (N === 30 && S.length) {
        const r30 = s.r30, lab = r30 <= -2 ? 0 : r30 <= -1 ? 1 : r30 <= -0.3 ? 2 : r30 < 0.3 ? 3 : r30 < 1 ? 4 : r30 < 2 ? 5 : 6;
        const x = S[lab] || {};
        body = `<div class="lb">开盘 30 分钟 ${C(r30)}，属于个股「<b>${esc(x.label || "")}</b>」档。</div>
          <div class="lb">最近 78 天 200 只美股（只有这么长）：之后 30 分钟继续同向 ${P(x.p30)}、平均 ${C(x.m30)}；到收盘继续 ${P(x.pc)}、平均 ${C(x.mc)}。<span class="muted">样本只有一段弱势行情，参考价值有限。</span></div>`;
      } else body = `<div class="lb">开盘 ${N} 分钟 ${C(r)}。<span class="muted">个股没有长历史分钟线，30 分钟后才对照最近 78 天的个股统计。</span></div>`;
    }
    const tone = s.now > 0.05 ? "u" : s.now < -0.05 ? "d" : "";
    return `<div class="lc ${tone}"><div class="lh"><b>${stockLink("us" + s.sym, s.sym)}</b><span class="pct ${cls(s.now)}">${sg(s.now)}</span>
      <span class="muted small">开盘至今（${esc(s.date.slice(5))} 美东 ${hm(s.k)}${s.gap != null ? `，跳空 ${sg(s.gap)}` : ""}）${s.live ? "" : "· 快照"}</span></div>${body}</div>`;
  }
  async function loadLive(J, tok) {
    const box = document.getElementById("uolive"), st = document.getElementById("uolivest");
    if (!box) return;
    const syms = ["QQQ", "SPY", "NVDA", "TSLA"];
    const res = await Promise.all(syms.map((s) => txMinute(s).catch(() => null)));
    if (!A.alive(tok) || !document.getElementById("uolive")) return;
    const snap = {}; (J.snap || []).forEach((x) => { snap[x.sym] = x; });
    const got = res.filter(Boolean).length;
    const rows = syms.map((s, i) => res[i] || (snap[s] ? { ...snap[s], r5: null, live: false } : null)).filter(Boolean);
    box.innerHTML = rows.length ? rows.map((s) => liveCard(J, s)).join("") : `<div class="card muted">分时没取到（网络或接口问题），稍后刷新。</div>`;
    const e = etNow(), open = e.wd >= 1 && e.wd <= 5 && e.m >= 570 && e.m < 960;
    if (st) st.innerHTML = (got ? `腾讯美股分时 · ${new Date().toLocaleTimeString("zh-CN", { hour12: false })} 取` : `实时接口没连上，显示 ${esc(J.updated || "")} 生成的快照`)
      + (open ? " · <b>美股交易中</b>，每分钟自动刷新" : " · 现在不在美股交易时段，显示最近一个交易日");
    clearTimeout(timer);
    if (open) timer = setTimeout(() => { if (A.alive(tok)) loadLive(J, tok); }, 60000);
  }

  // ---------------- 强度表 / 图 ----------------
  function binTable(J, etf, N) {
    const B = ((J.bins || {})[etf] || {})[N] || [];
    const ok = B.filter((b) => b.n >= 5);
    const flat = (b) => b.label.startsWith("基本平");
    const pc = (b, k) => (flat(b) ? P(b[k === "p30" ? "up30" : "upc"]) : P(b[k]));
    const w = (b) => (flat(b) ? "上涨" : "继续");
    const dk = `<div class="dk"><table class="t"><thead><tr><th>开盘 ${N} 分钟涨跌</th><th>次数</th><th>之后 30 分钟继续同向（「基本平」= 上涨）</th><th>之后 30 分钟平均</th><th>中间一半落在</th>
      <th>到收盘继续同向</th><th>到收盘平均</th><th>最多再走（中位）</th><th>最多反向（中位）</th></tr></thead><tbody>`
      + B.map((b) => b.n < 5 ? `<tr><td>${esc(b.label)}</td><td>${b.n}</td><td colspan="7" class="muted" style="text-align:left">太少（${N} 分钟很少走这么多）</td></tr>`
        : `<tr><td>${esc(b.label)}</td><td>${b.n}</td><td>${pc(b, "p30")}</td><td>${C(b.m30, 3)}</td><td>${sg(b.q25)} ~ ${sg(b.q75)}</td><td>${pc(b, "pc")}</td><td>${C(b.mc)}</td><td>${b.go ? n(b.go[1], 2) + "%" : "—"}</td><td>${b.back ? n(b.back[1], 2) + "%" : "—"}</td></tr>`).join("")
      + `</tbody></table></div>`;
    const mb = `<div class="mb">` + B.map((b) => b.n < 5 ? `<div class="row"><div class="r1"><span>${esc(b.label)}</span><span class="muted">${b.n} 次，太少</span></div></div>`
      : `<div class="row"><div class="r1"><span>${esc(b.label)}</span><span class="muted" style="font-weight:400">${b.n} 次</span></div>
        <div class="r2">之后 30 分钟：${w(b)} <b>${pc(b, "p30")}</b>，平均 ${C(b.m30, 3)}（中间一半 ${sg(b.q25)} ~ ${sg(b.q75)}）<br>到收盘：${w(b)} <b>${pc(b, "pc")}</b>，平均 ${C(b.mc)}；${b.go ? `最多再走 ${n(b.go[1], 2)}% / 最多反向 ${n(b.back[1], 2)}%（中位）` : ""}</div></div>`).join("") + `</div>`;
    return { html: dk + mb, ok };
  }
  function drawBins(J, etf, N) {
    const el = document.getElementById("uobch");
    if (!el || !window.echarts) return;
    const B = (((J.bins || {})[etf] || {})[N] || []).filter((b) => b.n >= 5);
    const c = mk(el);
    const col = (v) => (v >= 0 ? "#e5484d" : "#1f9d55");
    c.setOption({
      grid: { left: 44, right: 10, top: 36, bottom: 56 }, legend: { top: 4, textStyle: { fontSize: 11 } },
      tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(3) + "%") },
      xAxis: { type: "category", data: B.map((b) => b.label.replace("（±0.25%）", "")), axisLabel: { fontSize: 10, interval: 0, rotate: 30 } },
      yAxis: { type: "value", name: "%", axisLabel: { fontSize: 10 } },
      color: ["#e5484d", "#f2a7a9"],
      series: [{ name: "之后 30 分钟平均", type: "bar", data: B.map((b) => ({ value: b.m30, itemStyle: { color: col(b.m30) } })), label: { show: true, position: "top", fontSize: 10, formatter: (p) => `${B[p.dataIndex].n}次` } },
        { name: "到收盘平均", type: "bar", data: B.map((b) => ({ value: b.mc, itemStyle: { color: col(b.mc), opacity: 0.45 } })) }],
    });
  }
  function drawHeat(J, etf) {
    const el = document.getElementById("uohm");
    if (!el || !window.echarts) return;
    const H = (J.heat || {})[etf];
    if (!H) return;
    const data = [];
    H.N.forEach((N, i) => H.fwd.forEach((f, j) => data.push([j, i, H.same[i][j] == null ? null : +(H.same[i][j] * 100).toFixed(1), H.cont[i][j]])));
    const c = mk(el);
    const narrow = el.clientWidth < 520;
    c.setOption({
      grid: { left: narrow ? 52 : 80, right: 8, top: 10, bottom: narrow ? 92 : 70 },
      tooltip: { formatter: (p) => `开盘后 ${H.N[p.data[1]]} 分钟 → ${H.fwd[p.data[0]]}<br>之后同方向 ${p.data[2]}%<br>平均多走 ${(p.data[3] > 0 ? "+" : "") + (p.data[3] || 0).toFixed(3)}%` },
      xAxis: { type: "category", data: H.fwd, axisLabel: { fontSize: 10, interval: 0, rotate: narrow ? 45 : 0 } },
      yAxis: { type: "category", inverse: true, data: H.N.map((x) => (narrow ? `${x} 分钟` : `开盘后 ${x} 分钟`)), axisLabel: { fontSize: 10 } },
      visualMap: { min: 45, max: 55, dimension: 2, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: narrow ? 160 : 220, itemWidth: 10, text: ["更常延续", "更常反转"], textStyle: { fontSize: 10 }, inRange: { color: ["#2f7fd8", "#f5f6f8", "#e5484d"] } },
      series: [{ type: "heatmap", data, label: { show: true, fontSize: narrow ? 9 : 11, formatter: (p) => `${Math.round(p.data[2])}%` } }],
    });
  }

  function render(J, tok) {
    const H = J.hero || [];
    const O = J.opt || {}, K = O.cost || {}, T = J.trade || {}, L = J.ledger || {};
    const st = { etf: "QQQ", N: "15", hm: "QQQ" };
    const app = document.getElementById("app");
    app.innerHTML = `<div class="uo">
      <h1>⏱ 美股开盘惯性 ${tag(J.verdict)}</h1>
      <p class="sub0">老大的问题：开盘前 30 分钟是不是「越跌越惨、越涨越猛」？用 ${esc(J.span || "")} 检验。<a href="#/labs/usopen">完整检验报告 ›</a></p>
      <div class="hero">${H.map((h) => `<div class="hl"><div class="big">${esc(h.big)}${tag(h.tag)}</div><div class="sm">${esc(h.sub)}</div></div>`).join("")}</div>
      <h2>📡 今晚实时：开盘至今属于哪一档</h2>
      <p class="muted" style="margin:0 0 6px">美股开盘＝北京时间 22:30（冬令时）/ 21:30（夏令时），开盘后 1 小时最有用。QQQ / SPY 对照 16 年指数分档；NVDA / TSLA 对照 2024 年起的个股 5 分钟线（分档更宽：±0.5% / 1.5% / 3%）。<span id="uolivest"></span></p>
      <div class="live" id="uolive"><div class="card muted">读取分时中…</div></div>
      <h2>📊 开盘涨跌 → 之后大概怎么走</h2>
      <div class="uobar"><span class="seg" id="uoetf"><button data-v="QQQ" class="on">QQQ 纳指</button><button data-v="SPY">SPY 标普</button><button data-v="个股">个股 ${(J.stk5 && J.stk5.n) || 22} 只</button></span>
        <span class="seg" id="uon"><button data-v="5">开盘 5 分钟</button><button data-v="15" class="on">15 分钟</button><button data-v="30">30 分钟</button></span></div>
      <p class="muted" id="uobsrc" style="margin:0 0 6px"></p>
      <div id="uobt"></div>
      <div class="ch" id="uobch"></div>
      <p class="muted">红 = 之后平均涨，绿 = 之后平均跌；「继续同向」= 之后往开盘同一方向走的比例（「基本平」档写的是上涨的比例）。「最多再走 / 最多反向」用 1 分钟最高最低价，到收盘为止。</p>
      <h2>🗺 惯性在哪一段：开盘后前几分钟 → 之后同方向的比例</h2>
      <div class="uobar"><span class="seg" id="uohmetf"><button data-v="QQQ" class="on">QQQ</button><button data-v="SPY">SPY</button></span></div>
      <div class="ch hm" id="uohm"></div>
      <p class="muted">50% = 抛硬币。只有「开盘后 5 分钟」那一行和「到收盘」那一列稍红（53% 左右）：头 5 分钟的方向之后略占上风，开盘方向和全天收盘略同向；开盘 15 分钟以后接下来的 5~30 分钟基本是白的——惯性很弱、很快消失。</p>
      <h2>💸 如果想用期权做（买当天到期 call / put，涨 10~20% 就卖）${tag(O.verdict || "❌")}</h2>
      <div class="card"><p>${esc(O.text || "")}</p>
        <div class="cost"><div><span>今天一张 QQQ 当天到期平值</span><b>$${n(K.today_prem, 0)}</b></div><div><span>买卖价差（一买一卖）</span><b>${n(K.today_spr, 1)}%</b></div>
          <div><span>手续费（$0.65/张 + $1.99/笔 × 2）</span><b>${n(K.today_fee, 1)}%</b></div><div><span>合计占 +10% 止盈</span><b>${n(K.share10, 0)}%</b></div></div>
        <p>一来一回先付 <b>${n(K.today_total, 1)}%</b>，等于 +10% 止盈的 <b>${n(K.share10, 0)}%</b>、+15% 的 ${n(K.share15, 0)}%、+20% 的 ${n(K.share20, 0)}%（历史上期权更便宜，中位数 ${n(K.hist_total, 1)}%，占 +10% 的 ${n(K.share10_hist, 0)}%）。
          期权 +10% 只要 QQQ 动 <b>${n(K.move10, 2)}%</b>，几分钟的晃动就能碰到止盈或止损，谁先到基本靠运气；股价不动时，9:45 买的当天到期平值期权到 10:30 自己掉 ${n(K.theta60, 0)}%、到 12:00 掉 ${n(K.theta150, 0)}%。</p>
        <div class="dk"><table class="t"><thead><tr><th>QQQ 开盘 15 分钟涨跌超 0.5% → 当天到期平值，12:00 前平</th><th>笔数</th><th>胜率</th><th>平均每笔</th><th>每笔 $500 平均</th><th>最多连亏</th></tr></thead><tbody>
          ${(O.rows || []).map((r) => `<tr><td>${esc(r.lab)}</td><td>${r.n}</td><td>${P(r.win)}</td><td>${C(r.mean, 1)}</td><td class="${cls(r.usd)}">${r.usd < 0 ? "−" : "+"}$${Math.abs(r.usd).toFixed(0)}</td><td>${r.streak}</td></tr>`).join("")}</tbody></table></div>
        <div class="mb">${(O.rows || []).map((r) => `<div class="row"><div class="r1"><span>${esc(r.lab)}</span><span class="${cls(r.mean)}">${sg(r.mean, 1)}/笔</span></div><div class="r2">${r.n} 笔，胜率 ${P(r.win)}，每笔 $500 平均 ${r.usd < 0 ? "−" : "+"}$${Math.abs(r.usd).toFixed(0)}，最多连亏 ${r.streak}</div></div>`).join("")}</div>
        ${O.year ? `<p class="muted">每笔 $500、止盈止损 ±15%：${n(O.year.years, 0)} 年 ${O.year.all_n} 笔合计 ${O.year.all_usd < 0 ? "−" : "+"}$${Math.abs(O.year.all_usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}；最近一年 ${O.year.n} 笔合计 ${O.year.usd < 0 ? "−" : "+"}$${Math.abs(O.year.usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}。</p>` : ""}
      </div>
      <h2>📈 直接追涨杀跌 QQQ / SPY ${tag(T.verdict || "❌")}</h2>
      <div class="card"><p>${esc(T.text || "")}</p></div>
      <h2>📝 前瞻记录：每天开盘 15 分钟 → 实际到 10:30</h2>
      <p class="muted" style="margin:0 0 6px">只记录、不当信号。到 10:30 和开盘 15 分钟同方向：${L.n ? `${L.hit} / ${L.n} 天` : "积累中"}（抛硬币也会有一半）。</p>
      <div class="card" style="padding:4px 10px"><table class="t led"><thead><tr><th>日期</th><th>开盘 15 分钟（档）</th><th>历史到 10:30</th><th>实际到 10:30</th></tr></thead><tbody>
        ${(L.rows || []).slice(0, 12).map((r) => `<tr><td>${esc(r.date.slice(5))}</td><td style="white-space:normal;text-align:left">${C(r.r15)} <span class="muted small">${esc((r.hist_label || r.label || "").replace("（±0.25%）", "").replace(/（超 1.5%.*?）/, "*"))}</span></td>
          <td>${C(r.hist_mean, 2)}</td><td>${r.act1030 == null ? "—" : C(r.act1030)}${r.same == null ? "" : r.same ? " ✓" : " ✗"}</td></tr>`).join("")}</tbody></table></div>
      <details class="f"><summary>为什么会觉得「越跌越惨」 ▸</summary><ul>${(J.why || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>
      <details class="f"><summary>数据和算法说明 ▸</summary><ul>${(J.notes || []).map((x) => `<li>${esc(x)}</li>`).join("")}
        <li>实时面板：浏览器直接取腾讯美股分时（允许跨域），每分钟刷新；取不到时显示每天收盘后生成的快照。北京 23:45 的「美股开盘扫描」也会写一行开盘惯性。</li>
        <li>更新：${esc(J.updated || "—")}（usopen.py，每天美股收盘后跟着学堂发布）。</li></ul></details>
      ${A.DISC || ""}</div>`;
    const setSeg = (id, v) => document.querySelectorAll(`#${id} button`).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
    const draw = () => {
      const r = binTable(J, st.etf, st.N);
      const src = document.getElementById("uobsrc");
      if (src) src.textContent = st.etf === "个股" ? `个股：${(J.stk5 && J.stk5.syms || []).join("、")}，CNBC 5 分钟线 ${(J.stk5 && J.stk5.span) || ""}（约 ${(J.stk5 && J.stk5.days) || "—"} 天，合并统计；只有 5 分钟收盘价，没有最多再走 / 反向）。分档更宽：±0.5% / 1.5% / 3%。`
        : `${st.etf === "QQQ" ? "纳指100" : "标普500"} 1 分钟线 ${J.span ? J.span.replace(/^.*?1 分钟线 /, "") : ""}。`;
      document.getElementById("uobt").innerHTML = r.html;
      A.need("lib").then(() => { if (A.alive(tok)) { drawBins(J, st.etf, st.N); } }).catch(() => {});
    };
    const drawH = () => A.need("lib").then(() => { if (A.alive(tok)) drawHeat(J, st.hm); }).catch(() => { const e = document.getElementById("uohm"); if (e) e.innerHTML = '<p class="muted" style="padding:12px">图表组件加载失败</p>'; });
    app.onclick = (e) => {
      const b = e.target.closest("button[data-v]");
      if (!b) return;
      const p = b.parentElement.id;
      if (p === "uoetf") { st.etf = b.dataset.v; setSeg("uoetf", st.etf); draw(); }
      else if (p === "uon") { st.N = b.dataset.v; setSeg("uon", st.N); draw(); }
      else if (p === "uohmetf") { st.hm = b.dataset.v; setSeg("uohmetf", st.hm); drawH(); }
    };
    draw();
    drawH();
    loadLive(J, tok);
  }

  window.__mod_usopen = {
    async page() {
      const app = document.getElementById("app");
      document.title = "美股开盘惯性 · 小七投研";
      const tok = A.tok();
      clearTimeout(timer);
      app.innerHTML = `<h1>⏱ 美股开盘惯性</h1>${A.LOADING ? A.LOADING() : ""}`;
      try {
        const J = await A.getJSON("usopen.json", true);
        if (!A.alive(tok)) return;
        render(J, tok);
      } catch (e) {
        if (A.alive(tok)) app.innerHTML = "<h1>⏱ 美股开盘惯性</h1><div class='card muted'>数据暂未生成（运行 usopen.py 后发布）。</div>";
      }
    },
  };
})();
