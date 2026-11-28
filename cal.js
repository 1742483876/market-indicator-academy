/* 财经大事日历 #/cal（按需加载；2026-11-24 老大：「做一个日历，可以点击查看，历史的你也标注进去……一些是利好哪些是利空，用不同颜色和程度标注出来」）
   数据：events.py → events.json（最近 45 天 + 未来 3 个月 + 待定）、events_hist.json（更早，切到老月份才下载）。
   颜色 = 方向（A股习惯：红 = 利好、绿 = 利空、黄 = 方向不定/看结果、灰 = 影响小），深浅 = 程度（强/中/弱），⭐ = 重要度。
   已公布的事件按实际落在哪个情景上色，并用当天指数涨跌验证事前判断（✅/❌）。手机 390 宽：月历格子只放色块，点格子看当天列表，点事件弹详情。 */
(function () {
  const A = window.__APP;
  const { app, $, esc, getJSON, FAIL, DISC, stockLink } = A;
  const TC = { up: "229,72,77", down: "47,168,107", mixed: "232,170,0", flat: "140,148,158" };
  const TT = { up: "利好", down: "利空", mixed: "方向不定·看结果", flat: "影响小" };
  const TE = { up: "🔴", down: "🟢", mixed: "🟡", flat: "⚪" };
  const DA = { 强: 1, 中: 0.72, 弱: 0.42 };
  const MK = [["all", "全部"], ["cn", "A股"], ["us", "美股"], ["hk", "港股"], ["jpkr", "日韩"], ["fx", "大宗与汇率"]];
  const WKD = "一二三四五六日";
  if (!document.getElementById("cal-css")) {
    const st = document.createElement("style");
    st.id = "cal-css";
    st.textContent = `
.cal{font-variant-numeric:tabular-nums}
.cal-meta{font-size:12.5px;color:var(--sub);margin:2px 0 10px;line-height:1.6}
.cal-hit{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--text);border-radius:0 var(--r) var(--r) 0;padding:10px 14px;margin:0 0 10px;font-size:14px;line-height:1.65}
.cal-hit b{font-size:16px}
.cal-leg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12.5px;color:var(--sub);margin:6px 0 10px;align-items:center}
.cal-leg i{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:4px}
.cal-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.cal-chips button{border:1px solid var(--line);background:var(--card);color:var(--text);border-radius:999px;padding:4px 12px;font-size:13.5px;cursor:pointer}
.cal-chips button.on{background:var(--text);color:#fff;border-color:var(--text)}
.cal-mh{display:flex;align-items:center;justify-content:space-between;margin:8px 0 6px}
.cal-mh b{font-size:17px}
.cal-mh button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:5px 12px;font-size:14px;cursor:pointer;color:var(--text)}
.cal-g{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:4px}
.cal-wd{font-size:11.5px;color:var(--sub);text-align:center;padding:3px 0}
.cal-c{min-height:74px;border-radius:7px;padding:3px 3px 4px;background:var(--soft);cursor:pointer;min-width:0;overflow:hidden;position:relative}
.cal-c.o{opacity:.35}.cal-c.t{outline:2px solid var(--text)}.cal-c.sel{background:#fff7d6}
.cal-c .dn{font-size:12px;font-weight:700;color:var(--sub);line-height:16px}
.cal-c.t .dn{color:var(--text)}
.cal-e{display:block;font-size:11px;line-height:16px;border-radius:4px;padding:0 3px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:clip;cursor:pointer}
.cal-e.s3{font-weight:700;box-shadow:inset 0 0 0 1.5px rgba(0,0,0,.35)}
.cal-e em{font-style:normal;font-size:10px;margin-left:1px}
.cal-e .l{display:none}@media(min-width:900px){.cal-e .s{display:none}.cal-e .l{display:inline}.cal-c{min-height:92px}}
.cal-more{font-size:10.5px;color:var(--sub);margin-top:1px}
.cal-sec{display:flex;align-items:baseline;gap:4px 10px;flex-wrap:wrap;margin:22px 0 8px}.cal-sec h2{margin:0;font-size:18px}.cal-sec em{font-style:normal;font-size:12.5px;color:var(--sub)}
.cal-list{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.cal-r{display:block;padding:9px 12px 9px 14px;border-bottom:1px solid var(--line);border-left:5px solid #ccc;cursor:pointer;font-size:14px;line-height:1.55;color:var(--text);overflow-wrap:anywhere}
.cal-r:last-child{border-bottom:0}.cal-r:hover{background:#fafbfc}
.cal-r .d{font-weight:700;margin-right:4px}.cal-r .s{color:#c58a00;font-size:12px;margin-right:2px}
.cal-r .x{color:var(--sub);font-size:13px}
.cal-r .v{font-size:12px;font-weight:700;margin-left:4px}
.cal-empty{padding:12px 14px;color:var(--sub);font-size:13.5px}
.cal-ov{position:fixed;inset:0;background:rgba(20,24,28,.45);z-index:200;display:flex;align-items:flex-end;justify-content:center}
@media(min-width:700px){.cal-ov{align-items:center}}
.cal-m{background:var(--card);width:100%;max-width:640px;max-height:88vh;overflow-y:auto;border-radius:14px 14px 0 0;padding:14px 16px 20px;box-sizing:border-box;-webkit-overflow-scrolling:touch}
@media(min-width:700px){.cal-m{border-radius:14px}}
.cal-m h3{margin:2px 34px 6px 0;font-size:18px;line-height:1.4}
.cal-x{position:sticky;top:0;float:right;border:0;background:var(--soft);border-radius:50%;width:30px;height:30px;font-size:18px;cursor:pointer;color:var(--text)}
.cal-kv{font-size:14px;line-height:1.7;margin:4px 0}.cal-kv b{color:var(--sub);font-weight:600;margin-right:6px}
.cal-tag{display:inline-block;font-size:12px;font-weight:700;line-height:20px;padding:0 8px;border-radius:6px;margin-right:4px;color:#fff}
.cal-st{width:100%;border-collapse:collapse;font-size:13.5px;margin:6px 0;table-layout:fixed}
.cal-st td,.cal-st th{border-bottom:1px solid var(--line);padding:6px 5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.cal-st th{font-size:12px;color:var(--sub);font-weight:600}
.cal-st tr.hit td{background:#fff7d6;font-weight:600}
.cal-mv{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
.cal-mv span{background:var(--soft);border-radius:6px;padding:2px 8px;font-size:13px}
.cal-mv .up{color:var(--up)}.cal-mv .dn{color:var(--dn)}
.cal-box{background:var(--soft);border-radius:8px;padding:8px 11px;margin:8px 0;font-size:13.5px;line-height:1.65}
.cal-src a{display:block;font-size:12.5px;line-height:1.6;overflow-wrap:anywhere}
`;
    document.head.appendChild(st);
  }
  let J = null, HIST = null, histP = null;
  const S = { month: null, mk: "all", sel: null };
  const bg = (e, a) => `rgba(${TC[e.tone] || TC.flat},${a ?? DA[e.deg] ?? 0.6})`;
  const fg = (e) => ((DA[e.deg] ?? 0.6) >= 0.7 ? "#fff" : "#1f2328");
  const wk = (d) => "周" + WKD[(new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7];
  const all = () => (HIST ? HIST.concat(J.events) : J.events);
  const vis = (e) => S.mk === "all" || (e.mkts || []).includes(S.mk);
  const byDay = () => { const m = {}; all().forEach((e) => { if (!e.tbd && vis(e)) (m[e.date] = m[e.date] || []).push(e); }); return m; };
  const ver = (e) => (e.pre_ok == null ? "" : e.pre_ok ? "✅" : "❌");
  function needHist() {
    if (HIST) return Promise.resolve();
    return (histP = histP || getJSON("events_hist.json", true).then((H) => { HIST = (H && H.events) || []; }).catch(() => { HIST = []; }));
  }
  function effLine(e) {
    if (e.result) return e.result;
    const sc = e.scen || [], flat = sc.find((s) => s.tone === "flat"), oth = sc.filter((s) => s.tone === "up" || s.tone === "down");
    const cb = /^(kr_bok|us_fomc|jp_boj|ea_ecb|uk_boe|cn_lpr)$/.test(e.key);
    let t = TE[e.tone] + " " + (flat && flat.name === "符合预期" ? "符合预期影响小" : TT[e.tone]);
    if (oth.length) { const o = cb ? oth[oth.length - 1] : oth[0]; t += `，${cb ? o.when.split(" / ")[0] : o.name} → ${o.eff.split("；")[0].split("｜")[0]}`; }
    return t;
  }
  function row(e, withDate = true) {
    const d = e.tbd ? `${e.date.slice(0, 7)} 待定` : `${e.date.slice(5)} ${wk(e.date)}${e.time ? " " + e.time : ""}`;
    return `<a class="cal-r" data-id="${esc(e.id)}" style="border-left-color:${bg(e, Math.max(0.55, DA[e.deg] || 0.6))}">
      ${withDate ? `<span class="d">${esc(d)}</span>` : e.time ? `<span class="d">${esc(e.time)}</span>` : ""}<span class="s">${"⭐".repeat(e.star)}</span>${esc(e.flag)} <b>${esc(e.title)}</b>${ver(e) ? `<span class="v">预判${ver(e)}</span>` : ""}
      ${e.one ? `<div class="x">预期：${esc(e.one)}</div>` : ""}<div class="x">${esc(effLine(e))}${e.tbd && e.date_note ? "｜" + esc(e.date_note) : ""}</div></a>`;
  }
  function monthGrid() {
    const [y, m] = S.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7;
    const start = new Date(first.getTime() - lead * 864e5), M = byDay(), today = J.today;
    let h = WKD.split("").map((w) => `<div class="cal-wd">${w}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start.getTime() + i * 864e5), ds = dt.toISOString().slice(0, 10);
      if (i >= 35 && dt.getUTCMonth() !== m - 1) break;
      const xs = (M[ds] || []).slice().sort((a, b) => b.star - a.star || (a.time || "99").localeCompare(b.time || "99"));
      const show = xs.slice(0, 3);
      h += `<div class="cal-c${dt.getUTCMonth() !== m - 1 ? " o" : ""}${ds === today ? " t" : ""}${ds === S.sel ? " sel" : ""}" data-day="${ds}"><div class="dn">${dt.getUTCDate()}</div>
        ${show.map((e) => `<span class="cal-e${e.star >= 3 ? " s3" : ""}" data-id="${esc(e.id)}" style="background:${bg(e)};color:${fg(e)}" title="${esc(e.title)}"><span class="s">${esc(e.short || e.title.slice(0, 4))}</span><span class="l">${esc(e.title.replace(/（.*$/, ""))}</span>${e.pre_ok != null ? `<em>${e.pre_ok ? "✓" : "✗"}</em>` : ""}</span>`).join("")}
        ${xs.length > 3 ? `<div class="cal-more">+${xs.length - 3}</div>` : ""}</div>`;
    }
    return h;
  }
  function render() {
    const tok = A.tok();
    const T = J.today, E = all().filter(vis), H = J.hit || {};
    const t14 = new Date(new Date(T + "T00:00:00Z").getTime() + 14 * 864e5).toISOString().slice(0, 10);
    const b30 = new Date(new Date(T + "T00:00:00Z").getTime() - 30 * 864e5).toISOString().slice(0, 10);
    const next = E.filter((e) => !e.tbd && e.date >= T && e.date <= t14 && (e.star >= 2 || /休市|交割/.test(e.cat)));
    const tbd = E.filter((e) => e.tbd && e.date >= T.slice(0, 7));
    const past = E.filter((e) => !e.tbd && e.date < T && e.date >= b30 && e.star >= 2 && (e.result || e.pre_ok != null)).reverse();
    const sel = (byDay()[S.sel] || []).slice().sort((a, b) => (a.time || "99").localeCompare(b.time || "99") || b.star - a.star);
    const pr = (x) => (x && x.n ? `${x.ok}/${x.n}（${Math.round((x.ok / x.n) * 100)}%）` : "还没有");
    const lab = Object.values(J.lab || {}).map((x) => `<div>· ${esc(x.note)}</div>`).join("");
    app.innerHTML = `<div class="cal"><h1>📅 财经大事日历</h1>
      <div class="cal-meta">议息、通胀、就业、重要会议、财报、休市……带市场预期、前值、「符合 / 超预期 / 低于预期」各利好利空谁，公布后自动回填结果并验证。更新 ${esc(J.updated)}</div>
      <div class="cal-hit">🎯 事前判断命中 <b>${pr(H.pre)}</b>　·　按情景表看方向命中 <b>${pr(H.scen)}</b><br>
        <span class="muted small">含用同一套规则回填的历史；11-24 起真实事前写下并锁定的：${pr(H.pre_live)}。乱猜大约一半——目前的判断只比乱猜好一点，主要用来提醒「哪天可能大波动」，别当买卖理由。</span></div>
      <div class="cal-leg"><span><i style="background:rgb(${TC.up})"></i>利好</span><span><i style="background:rgb(${TC.down})"></i>利空</span><span><i style="background:rgb(${TC.mixed})"></i>方向不定·看结果</span><span><i style="background:rgb(${TC.flat})"></i>影响小</span><span>颜色越深 = 影响越大；⭐ = 重要度；✓✗ = 事后验证</span></div>
      <div class="cal-chips" id="calmk">${MK.map(([k, n]) => `<button data-mk="${k}" class="${S.mk === k ? "on" : ""}">${n}</button>`).join("")}</div>
      <div class="cal-mh"><button data-mv="-1">‹ 上月</button><b>${S.month.replace("-", " 年 ")} 月</b><button data-mv="1">下月 ›</button></div>
      <div class="cal-g" id="calg">${monthGrid()}</div>
      <div class="cal-sec"><h2>${S.sel ? esc(S.sel.slice(5)) + " " + wk(S.sel) : ""}</h2><em>点上面的日子换一天；点事件看详情</em></div>
      <div class="cal-list" id="calsel">${sel.length ? sel.map((e) => row(e, false)).join("") : '<div class="cal-empty">这天没有收录的大事</div>'}</div>
      <div class="cal-sec"><h2>接下来 14 天</h2><em>两星以上 + 休市 / 交割</em></div>
      <div class="cal-list">${next.length ? next.map((e) => row(e)).join("") : '<div class="cal-empty">没有</div>'}</div>
      ${tbd.length || (J.pending || []).length ? `<div class="cal-sec"><h2>待定</h2><em>日期没官宣 / 新闻里没写日期</em></div>
      <div class="cal-list">${tbd.map((e) => row(e)).join("")}${(J.pending || []).slice(-6).reverse().map((x) => `<a class="cal-r" ${x.url ? `href="${esc(x.url)}" target="_blank" rel="noopener"` : ""} style="border-left-color:#ccc">📰 <span class="x">${esc(x.t.slice(5, 16))} ${esc(x.src)}</span> ${esc(x.title)}</a>`).join("")}</div>` : ""}
      <div class="cal-sec"><h2>最近 30 天：结果 vs 预判</h2><em>颜色 = 实际属于哪种情况</em></div>
      <div class="cal-list">${past.length ? past.map((e) => row(e)).join("") : '<div class="cal-empty">没有</div>'}</div>
      <details class="card" style="margin-top:16px"><summary><b>颜色和程度是怎么定的？</b></summary><div class="small" style="line-height:1.7;margin-top:6px">
        检验过的 4 类（美联储议息、美国CPI、非农、中国LPR）按历史当天波动是平时几倍定程度（≥1.5 倍强、1.2~1.5 中、<1.2 弱），方向五五开的事前一律标黄色「看结果」，不硬标红绿：${lab}
        其余类别（韩国/日本/欧洲央行、会议、财报、休市、交割、解禁、新闻）是经验判断。情景表里「超预期 → 利空」这类说法在日线收盘上大多不成立（每条后面附了历史平均），所以别拿颜色当买卖理由。</div></details>
      ${DISC}</div>`;
    if (tok !== A.tok()) return;
    app.onclick = (ev) => {
      const t = ev.target.closest("[data-id],[data-day],[data-mk],[data-mv]");
      if (!t) return;
      if (t.dataset.id) { ev.preventDefault(); return openEv(t.dataset.id); }
      if (t.dataset.mk) { S.mk = t.dataset.mk; return render(); }
      if (t.dataset.mv) {
        const [y, m] = S.month.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + +t.dataset.mv, 1));
        S.month = d.toISOString().slice(0, 7);
        if (S.month + "-31" < J.hist_before && !HIST) { needHist().then(() => { if (tok === A.tok()) render(); }); return; }
        return render();
      }
      if (t.dataset.day) { S.sel = t.dataset.day; render(); const el = $("#calsel"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    };
  }
  function openEv(id) {
    const e = all().find((x) => x.id === id);
    if (!e) return;
    const old = document.getElementById("calov"); if (old) old.remove();
    const sc = e.scen || [];
    const mv = (e.moves || []).map((m) => `<span>${esc(m.n)} <b class="${m.r > 0 ? "up" : m.r < 0 ? "dn" : ""}">${m.r > 0 ? "+" : ""}${m.r.toFixed(2)}%</b> <em class="muted small">${esc(m.d.slice(5))}，平时 ±${m.base.toFixed(2)}%</em></span>`).join("");
    const when = e.tbd ? `${e.date.slice(0, 7)} 待定（${esc(e.date_note || "日期未官宣")}）` : `${e.date} ${wk(e.date)}${e.time ? " " + e.time + "（北京时间）" : e.when ? "（" + e.when + "）" : ""}`;
    const tag = (tn, txt) => `<span class="cal-tag" style="background:rgb(${TC[tn] || TC.flat})">${esc(txt)}</span>`;
    const ov = document.createElement("div");
    ov.className = "cal-ov"; ov.id = "calov";
    ov.innerHTML = `<div class="cal-m" role="dialog" aria-modal="true"><button class="cal-x" aria-label="关闭">×</button>
      <h3>${esc(e.flag)} ${esc(e.title)} <span style="color:#c58a00;font-size:14px">${"⭐".repeat(e.star)}</span></h3>
      <div>${tag(e.pre_tone, "事前：" + TT[e.pre_tone] + "·" + e.deg)}${e.result && e.tone !== e.pre_tone ? tag(e.tone, "实际：" + TT[e.tone]) : ""}<span class="muted small">${esc(e.cat)}｜${esc(e.basis || "经验判断")}${e.backfill && e.date < J.today ? "｜预判为回填" : e.pre_at ? "｜预判写于 " + esc(e.pre_at) : ""}</span></div>
      <div class="cal-kv"><b>时间</b>${when}</div>
      ${e.one ? `<div class="cal-kv"><b>预期</b>${esc(e.one)}</div>` : ""}
      ${e.expect ? `<div class="cal-kv"><b>预期来源</b><span class="small">${esc(e.expect)}</span></div>` : ""}
      ${e.prev ? `<div class="cal-kv"><b>前值</b>${esc(e.prev)}</div>` : ""}
      ${(e.notes || []).length ? `<div class="cal-kv"><b>备注</b><span class="small">${esc([...new Set(e.notes)].join("；"))}</span></div>` : ""}
      ${(e.newsnote || []).length ? `<div class="cal-kv"><b>新闻</b><span class="small">${esc(e.newsnote.slice(-3).join("；"))}</span></div>` : ""}
      ${sc.length ? `<div class="cal-kv" style="margin-top:8px"><b>情景表（公布后会是哪种？各利好利空谁）</b></div>
      <table class="cal-st"><colgroup><col style="width:36%"><col></colgroup><tr><th>情景</th><th>影响</th></tr>${sc.map((s, i) => `<tr class="${e.hit_scen === i ? "hit" : ""}"><td class="tn" style="border-left:5px solid rgb(${TC[s.tone]})"><b>${esc(s.name)}</b> <span style="color:rgb(${TC[s.tone]});font-size:12px;font-weight:700">${TT[s.tone]}</span><div class="muted small">${esc(s.when)}</div></td><td>${esc(s.eff)}${e.hit_scen === i ? " ← 实际" : ""}</td></tr>`).join("")}</table>` : ""}
      ${e.result ? `<div class="cal-box"><b>结果</b>　${esc(e.result)}</div>` : e.date < J.today && !e.tbd ? `<div class="cal-box muted">没有拿到公布值（数据源没给），只看当天行情</div>` : ""}
      ${mv ? `<div class="cal-kv"><b>当天实际涨跌</b>（事件后第一个交易日）</div><div class="cal-mv">${mv}</div>` : ""}
      ${e.pre_why ? `<div class="cal-box">${e.pre_ok ? "✅" : "❌"} ${esc(e.pre_why)}${e.scen_why ? `<br>${e.scen_ok ? "✅" : "❌"} ${esc(e.scen_why)}` : ""}</div>` : ""}
      ${e.lab_note ? `<div class="cal-kv small"><b>历史检验</b>${esc(e.lab_note)}</div>` : `<div class="cal-kv small muted">这类事件没做历史检验，颜色是经验判断。</div>`}
      ${(e.stocks || []).length ? `<div class="cal-kv"><b>相关</b>${e.stocks.map((s) => stockLink(s.code, s.name)).join("、")}</div>` : ""}
      ${(e.src || []).length ? `<div class="cal-kv"><b>来源</b></div><div class="cal-src">${e.src.map((s) => (s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.t)} ↗</a>` : `<div class="small">${esc(s.t)}</div>`)).join("")}</div>` : ""}
      <p class="muted small" style="margin-top:10px">仅供参考，不构成投资建议。</p></div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    const close = () => { ov.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", esc_); if (/^#\/cal\/e\//.test(location.hash)) history.replaceState(history.state, "", "#/cal"); };
    const esc_ = (k) => { if (k.key === "Escape") close(); };
    ov.addEventListener("click", (k) => { if (k.target === ov || k.target.classList.contains("cal-x")) close(); });
    document.addEventListener("keydown", esc_);
    window.addEventListener("hashchange", () => { if (document.body.contains(ov)) { ov.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", esc_); } }, { once: true });
  }
  async function page(sub, id) {
    const tok = A.tok();
    document.title = "财经大事日历 · 小七投研";
    try { J = await getJSON("events.json", true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>📅 财经大事日历</h1>${FAIL("日历数据加载失败（每天发布时更新）")}`; return; }
    if (!A.alive(tok)) return;
    if (!S.month) { S.month = J.today.slice(0, 7); S.sel = J.today; }
    if (sub === "e" && id) {
      const e = J.events.find((x) => x.id === id);
      if (!e) await needHist();
      const x = all().find((y) => y.id === id);
      if (x && !x.tbd) { S.month = x.date.slice(0, 7); S.sel = x.date; }
      if (S.month + "-31" < J.hist_before) await needHist();
      if (!A.alive(tok)) return;
      render(); openEv(id); return;
    }
    render();
  }
  window.__mod_cal = { page, openEv: (id) => openEv(id) };
})();
