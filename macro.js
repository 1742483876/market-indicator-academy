/* 小七投研 · 国家宏观数据 + 出海信号（读 macro.json，netmacro.py 生成）。A股涨红跌绿。 */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d));
  const sg = (v, d = 1) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d));
  const cl = (v, base) => (v == null ? "" : v > (base == null ? 0 : base) ? "up" : v < (base == null ? 0 : base) ? "dn" : "");

  if (!document.getElementById("macro-css")) {
    const st = document.createElement("style");
    st.id = "macro-css";
    st.textContent = `.mcr .up{color:#e5484d}.mcr .dn{color:#2fa86b}
.mcr .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:10px 0}
.mcr .mcard{background:var(--card,#fff);border:1px solid var(--line,#eee);border-radius:10px;padding:12px 14px}
.mcr .mcard h3{margin:0 0 2px;font-size:14px}.mcr .mcard .when{font-size:11px;color:var(--sub,#888);margin-bottom:6px}
.mcr .mcard .big{font-size:25px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2}
.mcr .mcard .unit{font-size:12px;color:var(--sub,#888);font-weight:400;margin-left:3px}
.mcr .mcard .sub{font-size:12px;color:var(--sub,#888);margin-top:5px;line-height:1.5}
.mcr .spark{height:34px;margin-top:8px;display:flex;align-items:flex-end;gap:2px}
.mcr .spark i{flex:1;min-width:2px;border-radius:1px 1px 0 0;background:#bbb;position:relative}
.mcr .spark i.up{background:#e5484d}.mcr .spark i.dn{background:#2fa86b}
.mcr .sig{border-left:5px solid #888;padding:12px 16px;border-radius:8px;margin:12px 0}
.mcr .sig.good{border-left-color:#e5484d}.mcr .sig.bad{border-left-color:#2fa86b}
.mcr .sig .lv{font-size:20px;font-weight:700}.mcr .sig .rs{margin:6px 0 0;padding-left:0;list-style:none}
.mcr .sig .rs li{font-size:13px;line-height:1.7;padding-left:14px;position:relative;color:var(--text,#222)}
.mcr .sig .rs li::before{content:"·";position:absolute;left:2px;color:var(--sub,#888)}
.mcr .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.mcr .chips span{font-size:12px;padding:3px 10px;border-radius:999px;background:rgba(229,72,77,.08);color:#e5484d;border:1px solid rgba(229,72,77,.25)}
.mcr .note{font-size:12px;color:var(--sub,#888);line-height:1.6;margin-top:8px}
.mcr .bread{font-size:13px;color:var(--sub,#888);line-height:1.6;margin:6px 0 2px}
.mcr .imp{font-size:13px;line-height:1.5;margin-top:6px;color:var(--text,#222)}.mcr .imp i{font-style:normal;font-size:11.5px;font-weight:700;border-radius:5px;padding:1px 6px;margin-right:6px;color:#fff;background:#9aa1ab}
.mcr .imp.good i{background:#e5484d}.mcr .imp.bad i{background:#2fa86b}
.mcr .mpts{margin:4px 0 10px;padding:12px 14px 12px 32px;background:var(--card,#fff);border:1px solid var(--line,#eee);border-radius:10px;font-size:15px;line-height:1.75}
.mcr .mpts .imp{display:inline;margin:0}.mcr .mpts b{font-size:16px}
.mcr .mcal{display:block;background:#fff7e8;border:1px solid #f5d9a8;color:#8a5a00;border-radius:10px;padding:9px 13px;font-size:15px;font-weight:700;margin:0 0 6px}
.mcr .mfold{margin-top:8px}.mcr .mfold>summary{cursor:pointer;color:var(--brand,#2f7fd8);font-size:13px;list-style:none}.mcr .mfold>summary::-webkit-details-marker{display:none}`;
    document.head.appendChild(st);
  }

  function spark(vals) {
    if (!vals || !vals.length) return "";
    const vs = vals.map((x) => x.v).filter((x) => x != null);
    if (!vs.length) return "";
    const lo = Math.min(...vs, 0), hi = Math.max(...vs, 0), span = hi - lo || 1;
    return `<div class="spark">${vals.map((x) => {
      if (x.v == null) return "<i></i>";
      const h = 4 + Math.abs(x.v - lo) / span * 28;
      return `<i class="${x.v > 0 ? "up" : x.v < 0 ? "dn" : ""}" style="height:${h}px" title="${esc(x.d)} ${sg(x.v)}"></i>`;
    }).join("")}</div>`;
  }

  // 2026-11-24 u22：每个指标「对我有什么影响」（规则写死、只看方向；good 利好 / bad 利空 / mid 中性）
  const prevOf = (x) => { const t = (x && x.trend) || []; return t.length > 1 ? t[t.length - 2].v : null; };
  function impact(k, L, G) {
    if (!L) return null;
    const p = prevOf(G);
    if (k === "retail") return L.yoy < 2 ? ["bad", "内需偏弱：消费股缺业绩支撑，出海链相对占优"] : L.yoy >= 5 ? ["good", "消费回暖：利好消费、零售"] : ["mid", "消费温和，影响不大"];
    if (k === "gdp") return L.yoy >= 5 ? ["good", "经济增速稳，大盘有业绩托底"] : p != null && L.yoy < p ? ["bad", "增速在放缓：大盘缺业绩推动，政策托底预期升温"] : ["mid", "增速平稳，影响不大"];
    if (k === "cpi") return L.v <= 0 ? ["bad", "物价在跌：企业利润承压"] : L.v > 3 ? ["bad", "通胀偏高：降息空间小"] : ["mid", "物价温和：不卡货币政策"];
    if (k === "ppi") return L.v > 0 ? ["good", "工业品涨价：资源、周期股利润改善"] : ["bad", "工业品跌价：上游企业利润收缩"];
    if (k === "pmi") return L.v >= 50 ? ["good", "制造业在扩张：顺周期板块受益"] : ["bad", "制造业在收缩（<50）：顺周期板块偏弱"];
    if (k === "export") return L.v > 5 ? ["good", "出口不错：出海链（家电/汽车/机械）受益"] : L.v < 0 ? ["bad", "出口转负：出海链承压"] : ["mid", "出口平稳"];
    if (k === "import") return L.v < 0 ? ["bad", "进口下滑：内需和原料需求弱"] : ["mid", "进口正增长：需求尚可"];
    if (k === "usd") return L.chg20 > 1 ? ["mid", "美元走强：出口换汇受益，但外资流入偏弱"] : L.chg20 < -1 ? ["good", "美元走弱：外资更愿意买 A股"] : ["mid", "美元平稳，影响不大"];
    return null;
  }
  const TONE = { good: "利好", bad: "利空", mid: "中性" };
  const SHORT = { retail: "社零", gdp: "GDP", cpi: "CPI", ppi: "PPI", pmi: "PMI", export: "出口", import: "进口", usd: "美元指数" };
  const bigOf = (k, L) => (!L ? "—" : k === "retail" || k === "gdp" ? num(L.yoy) + "%" : k === "pmi" || k === "usd" ? num(L.v) : num(L.v) + "%");

  function card(k, latest, extra) {
    let big = "—", unit = "", when = "", sub = "";
    if (latest) {
      if (k === "retail") { big = num(latest.yoy); unit = "% 同比"; when = latest.month; sub = `当月 ${num(latest.amount, 0)} 亿　累计同比 ${sg(latest.cum_yoy)}%`; }
      else if (k === "gdp") { big = num(latest.yoy); unit = "% 同比"; when = latest.q; sub = `总量 ${num(latest.amount, 0)} 亿　二产 ${sg(latest.sec)}%　三产 ${sg(latest.third)}%`; }
      else if (k === "pmi") { big = num(latest.v); unit = "点"; when = latest.d; sub = `非制造业 ${num(latest.non_man)}　${latest.v >= 50 ? "制造业在扩张区间" : "制造业在收缩区间(<50)"}`; }
      else if (k === "usd") { big = num(latest.v); unit = "点"; when = latest.d; sub = `近20日 ${sg(latest.chg20)}%　${latest.chg20 > 0 ? "美元走强→利好出口换汇" : "美元走弱"}`; }
      else { big = num(latest.v); unit = "%"; when = latest.d; sub = extra && extra.latest && extra.latest.prev != null ? `上期 ${num(extra.latest.prev)}%` : ""; }
    }
    const clsBig = (k === "pmi" && latest) ? (latest.v >= 50 ? "up" : "dn") : cl(parseFloat(big));
    const im = impact(k, latest, extra), old = k === "export" || k === "import" ? latest && latest.d && latest.d < "2026" : false;
    return `<div class="mcard"><h3>${esc(extra.title)}</h3><div class="when">${esc(when || "—")}　${esc(extra.unit || "")}</div>
      <div class="big ${clsBig}">${big}<span class="unit">${esc(unit)}</span></div>
      ${im ? `<div class="imp ${im[0]}"><i>${TONE[im[0]]}</i>${esc(im[1])}${old ? "（数据较旧）" : ""}</div>` : ""}
      <div class="sub">${sub}</div>${spark(extra.trend)}</div>`;
  }

  function page(data) {
    const g = data.groups || {}, sig = data.signal || {};
    const lv = sig.level || "—";
    const good = /利好/.test(lv), bad = /利空/.test(lv);
    const cards = ["retail", "gdp", "cpi", "ppi", "pmi", "export", "import", "usd"].map((k) => card(k, g[k] && g[k].latest, g[k] || {})).join("");
    const fx = g.usdcny && g.usdcny.v != null ? `<div class="mcard"><h3>美元人民币</h3><div class="when">实时参考</div><div class="big">${num(g.usdcny.v, 4)}</div><div class="sub">离岸/在岸参考价，人民币走贬利好出口企业换汇收入。</div></div>` : "";
    const reasons = (sig.reasons || []).map((r) => `<li>${esc(r)}</li>`).join("");
    const chips = (sig.sectors || []).map((s) => `<span>${esc(s)}</span>`).join("");
    const KS = ["retail", "gdp", "cpi", "ppi", "pmi", "export", "import", "usd"];
    const im = KS.map((k) => [k, g[k] && g[k].latest, impact(k, g[k] && g[k].latest, g[k] || {})]).filter((x) => x[2]);
    const lst = (t) => im.filter((x) => x[2][0] === t && !(["export", "import"].includes(x[0]) && x[1].d && x[1].d < "2026"))
      .map(([k, L, r]) => `${SHORT[k]} <b>${bigOf(k, L)}</b>（${esc(r[1].split("：")[0])}）`).join("、");
    const pts = [`出海链信号：<b class="${good ? "up" : bad ? "dn" : ""}">${esc(lv)}</b>${sig.reasons && sig.reasons[0] ? `　${esc(sig.reasons[0].split("：")[0])}` : ""}`,
      `<span class="imp good"><i>利好</i></span>${lst("good") || "暂无"}`, `<span class="imp bad"><i>利空</i></span>${lst("bad") || "暂无"}`];
    return `<h1>🌐 国家宏观数据</h1>
      <ul class="mpts">${pts.map((t) => `<li>${t}</li>`).join("")}</ul>
      <a class="mcal" href="#/cal">📅 未来 7 天大事（议息 / CPI / 非农 / 财报）›</a>
      <h2>核心指标 <span class="muted small">每个后面写了对股市的影响</span></h2><div class="mgrid">${cards}${fx}</div>
      <div class="sig ${good ? "good" : bad ? "bad" : ""}"><div class="lv">出海链信号：${esc(lv)} <span class="muted small">（打分 ${sig.score == null ? "—" : sig.score}）</span></div>
        <div class="chips">${chips}</div>
        <details class="mfold"><summary>为什么 ▸</summary><ul class="rs">${reasons}</ul><div class="note">${esc(sig.note || "")}</div></details></div>
      <details class="mfold"><summary>说明：数据来源和怎么读 ▸</summary>
      <div class="bread">数据时点 ${esc(data.meta && data.meta.built)}　来源 ${esc(data.meta && data.meta.sources)}。统计局口径更新到最近月；进出口为财联社快报口径、时点为发布日（可能滞后，已如实标注）。</div>
      <div class="note">怎么读：柱状条是最近若干期走势（红＝正值/上行、绿＝负值/下行，A股惯例）。社零＝内需，GDP＝整体景气，CPI/PPI＝通胀与成本，PMI 50 是荣枯线，出口同比＋美元走强＝出海企业换汇改善。「利好 / 利空」是按固定规则给的方向提示（没有回测），具体个股要看财报，且受关税、海外需求影响。仅供研究，不构成投资建议。</div></details>`;
  }

  window.__mod_macro = {
    async page() {
      const app = document.getElementById("app");
      if (!app) return;
      app.innerHTML = "<h1>🌐 国家宏观数据</h1><div class='card muted'>正在读取宏观数据…</div>";
      try {
        const r = await fetch("macro.json?t=" + Math.floor(Date.now() / 3600000));
        if (!r.ok) throw new Error("no data");
        app.innerHTML = `<div class="mcr">${page(await r.json())}</div>`;
      } catch (e) {
        app.innerHTML = "<h1>🌐 国家宏观数据</h1><div class='card muted'>宏观数据暂未生成（在题材复盘推送目录运行 netmacro.py 后发布）。</div>";
      }
    }
  };
  window.renderMacro = (el, d) => { if (el) { el.className = "mcr"; el.innerHTML = page(d); } };
})();
