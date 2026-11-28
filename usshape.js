/* 美股日内形态 #/usshape（学堂）+ 个股站个股页「📐 日内形态」共用。
   数据：usshape.json（全体：频率排行 / 每种形态叠加图 / 条件概率 / 次日 / 一天的节奏）、usshape/<code>.json（单只：频率、最近一天阶段色块、条件概率）。
   usshape.py 每天美股收盘后生成（daily_publish）。均价线 = 分时图上那条黄线（VWAP），对照线 = 5 分钟 K 的 20 均线。ECharts 滑到 / 点开才加载。 */
(function () {
  let BASE = "";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const n1 = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d));
  const sg = (v, d = 2) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%");
  const cls = (v) => (v == null || isNaN(v) || Math.abs(v) < 0.005 ? "" : v > 0 ? "up" : "dn");
  const UP = "#e5484d", DN = "#1f9d55", YEL = "#f5a524";
  const TAG = { "✅": ["ok", "✅ 可以参考"], "⚠️": ["part", "⚠️ 部分成立"], "❌": ["no", "❌ 不能当信号"] };
  const tag = (v) => `<i class="us-lv ${(TAG[v] || TAG["❌"])[0]}">${(TAG[v] || TAG["❌"])[1]}</i>`;
  const NO = { dip_up: "①", pop_dn: "②", dip_fail: "①′", pop_hold: "②′", trend_up: "③", trend_dn: "④", v_up: "⑤", v_dn: "⑤′", am_up: "⑦", am_dn: "⑦′", range: "⑥", other: "—" };
  const SHORT = { c_dip1: "开盘先跌后，第一次反弹碰到均价线", c_stand: "开盘先跌、拉回后站上均价线（连续 2 根）", c_pop1: "开盘先冲后，第一次回落碰到均价线", c_any_up: "10 点后从下方碰到均价线", c_any_dn: "10 点后从上方碰到均价线" };
  const SCOL = { dip_up: UP, pop_dn: DN, dip_fail: "#7fbf9a", pop_hold: "#f08a8d", trend_up: "#c81e1e", trend_dn: "#15803d", v_up: "#f97316", v_dn: "#0ea5e9", am_up: "#a855f7", am_dn: "#6366f1", range: "#9aa3ad", other: "#c4c9d0" };

  function css() {
    if (document.getElementById("us-css")) return;
    const st = document.createElement("style");
    st.id = "us-css";
    st.textContent = `.us{max-width:1100px;overflow-wrap:anywhere}
.us .sub0{color:var(--sub,#6b7280);font-size:13px;margin:-4px 0 10px;line-height:1.6}
.us .hero{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:14px;padding:4px 16px;margin:8px 0 12px}
.us .hl{padding:12px 0;border-bottom:1px solid var(--line,#e5e7eb)}.us .hl:last-child{border-bottom:0}
.us .hl .big{font-size:20px;font-weight:800;line-height:1.5}.us .hl .sm{font-size:13px;color:var(--sub,#6b7280);line-height:1.6;margin-top:4px}
@media (max-width:600px){.us .hl .big{font-size:17px}}
.us h2{font-size:17px;margin:18px 0 8px}.us h3{font-size:15px;margin:12px 0 6px}
.us .up{color:var(--up,#e5484d)}.us .dn{color:var(--dn,#1f9d55)}.us .mut{color:var(--sub,#6b7280);font-size:12.5px;line-height:1.6}
.us .us-lv{font-style:normal;font-size:12px;font-weight:700;border-radius:6px;padding:2px 7px;white-space:nowrap}
.us .us-lv.ok{background:#e7f6ee;color:#1d7a4c}.us .us-lv.part{background:#fff4d6;color:#8a5a00}.us .us-lv.no{background:#eef0f3;color:#6b7280}
.us .rk{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;margin-bottom:6px;overflow:hidden}
.us .rk>.rh{display:grid;grid-template-columns:62px minmax(0,1fr) 66px;gap:8px;align-items:center;padding:8px 10px;cursor:pointer}
.us .rk>.rh svg{display:block}
.us .rk .nm{font-size:14px;font-weight:700;line-height:1.35}.us .rk .nm i{font-style:normal;color:var(--sub,#6b7280);font-weight:600;margin-right:3px}
.us .rk .bar{height:8px;border-radius:4px;background:var(--soft,#f2f3f5);margin-top:5px;overflow:hidden}.us .rk .bar b{display:block;height:100%;border-radius:4px}
.us .rk .pc{text-align:right;font-size:17px;font-weight:800;white-space:nowrap}.us .rk .pc small{display:block;font-size:11px;color:var(--sub,#6b7280);font-weight:500}
.us .rk.on>.rh{background:var(--soft,#f7f8fa)}
.us .rk .rb{padding:4px 12px 12px;border-top:1px solid var(--line,#e5e7eb)}
.us .ch{width:100%;height:280px}.us .ch.s{height:230px}@media (max-width:600px){.us .ch{height:240px}.us .ch.s{height:200px}}
.us .kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0}@media (min-width:760px){.us .kv{grid-template-columns:repeat(4,minmax(0,1fr))}}
.us .kv>div{background:var(--soft,#f7f8fa);border-radius:10px;padding:7px 10px;min-width:0}.us .kv b{display:block;font-size:18px}.us .kv span{font-size:12px;color:var(--sub,#6b7280);line-height:1.45;display:block}
.us .card{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:10px 14px;margin:8px 0}
.us .card p{margin:4px 0;line-height:1.65;font-size:14px}
.us .fun{display:flex;flex-direction:column;gap:6px;margin:6px 0}
.us .fun .st{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:8px;align-items:center;font-size:13.5px}
.us .fun .st .bb{height:22px;border-radius:6px;background:var(--brand,#2f7fd8);color:#fff;font-size:12px;line-height:22px;padding:0 8px;white-space:nowrap;overflow:hidden;min-width:2px}
.us .fun .st .r{text-align:right;font-weight:700}.us .fun .st .r small{display:block;color:var(--sub,#6b7280);font-weight:500;font-size:11.5px}
.us .split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}.us .split>div{border-radius:10px;padding:8px 10px;color:#fff}.us .split b{font-size:22px;display:block}.us .split span{font-size:12.5px}
.us .cc{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}@media (min-width:760px){.us .cc{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.us .cd{min-width:0;white-space:normal;color:inherit;font-weight:400;background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:12px;padding:10px 12px;border-left:5px solid #c4c9d0}
.us .cd.v-ok{border-left-color:#2fa86b}.us .cd.v-part{border-left-color:#f5a524}
.us .cd .q{font-size:13.5px;line-height:1.55}.us .cd .a{display:flex;gap:12px;flex-wrap:wrap;margin:6px 0 2px;align-items:baseline}.us .cd .a b{font-size:22px}
.us .cd .a span{font-size:12.5px;color:var(--sub,#6b7280)}
.us table.t{width:100%;border-collapse:collapse;font-size:13px}
.us table.t th,.us table.t td{padding:6px 6px;border-bottom:1px solid var(--line,#e5e7eb);text-align:right;white-space:nowrap}
.us table.t th:first-child,.us table.t td:first-child{text-align:left;white-space:normal}
.us table.t th{color:var(--sub,#6b7280);font-weight:600;font-size:12px;white-space:normal}
.us .tw{overflow-x:auto;max-width:100%}
.us details.f{margin:8px 0}.us details.f>summary{cursor:pointer;color:var(--brand,#2f7fd8);font-size:14px;padding:4px 0;list-style:none}
.us details.f>summary::-webkit-details-marker{display:none}
.us details.f .in{font-size:13.5px;line-height:1.7}.us details.f ul{margin:4px 0;padding-left:18px}
.us .seg{display:grid;grid-template-columns:92px minmax(0,1fr);gap:4px 10px;font-size:13.5px;line-height:1.55;padding:7px 0;border-bottom:1px solid var(--line,#e5e7eb)}
.us .seg:last-child{border-bottom:0}.us .seg .tm{font-weight:700}.us .seg .tm small{display:block;font-weight:500;color:var(--sub,#6b7280);font-size:11.5px}
.us .seg .nums{font-size:12px;color:var(--sub,#6b7280)}
.us .cl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}@media (min-width:760px){.us .cl{grid-template-columns:repeat(4,minmax(0,1fr))}}
.us .cl svg{display:block;max-width:100%}.us .cl>div{background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:6px 8px;font-size:12.5px;line-height:1.45;min-width:0}
.us .cl b{font-size:13px}
.us .chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.us .chips button,.us .chips a{border:1px solid var(--line,#e5e7eb);background:var(--card,#fff);border-radius:999px;padding:4px 10px;font-size:13px;cursor:pointer;color:inherit}
.us .chips button.on{background:var(--brand,#2f7fd8);color:#fff;border-color:var(--brand,#2f7fd8)}
.us .days{display:flex;flex-wrap:wrap;gap:4px}.us .days span{display:inline-block;min-width:44px;text-align:center;font-size:11px;border-radius:6px;padding:3px 4px;color:#fff;line-height:1.3}
.us .lg{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--sub,#6b7280);margin:4px 0}.us .lg i{display:inline-block;width:12px;height:8px;border-radius:2px;margin-right:3px;vertical-align:0}
.us .tags{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}@media (min-width:760px){.us .tags{grid-template-columns:repeat(5,minmax(0,1fr))}}
.us .tags>div{background:var(--soft,#f7f8fa);border-radius:10px;padding:6px 9px;font-size:12.5px}.us .tags b{font-size:16px;display:block}`;
    document.head.appendChild(st);
  }

  let echartsP = null;
  function needEcharts() {
    if (window.echarts) return Promise.resolve();
    return (echartsP = echartsP || new Promise((res, rej) => { const el = document.createElement("script"); el.src = BASE + "echarts.min.js?v=5.5.1"; el.onload = res; el.onerror = () => { echartsP = null; rej(new Error("图表组件加载失败")); }; document.head.appendChild(el); }));
  }
  const JC = {};
  const hkey = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 13);
  function getJ(u) { const url = BASE + u + "?h=" + hkey(); return (JC[url] = JC[url] || fetch(url).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch((e) => { delete JC[url]; throw e; })); }
  const charts = [];
  function mk(el) { const old = window.echarts.getInstanceByDom(el); if (old) old.dispose(); const c = window.echarts.init(el); charts.push(c); return c; }
  window.addEventListener("resize", () => charts.forEach((c) => { if (!c.isDisposed()) c.resize(); }));
  function lazy(el, fn) {
    const go = () => needEcharts().then(() => { if (document.body.contains(el)) fn(); }).catch((e) => { el.innerHTML = `<div class="mut" style="padding:10px">${esc(e.message)}，文字结论不受影响。</div>`; });
    if (!("IntersectionObserver" in window)) return go();
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "200px" });
    io.observe(el);
  }
  const T = (() => { const o = []; for (let k = 0; k <= 78; k++) { const m = 570 + 5 * k; o.push(String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0")); } return o; })();
  const axisX = (data, every = 12) => ({ type: "category", data, boundaryGap: false, axisLabel: { fontSize: 10.5, color: "#8a8f98", interval: (i) => i % every === 0 }, axisTick: { show: false }, axisLine: { lineStyle: { color: "#ddd" } } });
  const axisY = (name) => ({ type: "value", scale: true, name, nameTextStyle: { fontSize: 10.5, color: "#8a8f98", align: "left" }, axisLabel: { fontSize: 10.5, color: "#8a8f98" }, splitLine: { lineStyle: { color: "rgba(128,128,128,.15)" } } });

  function spark(th, w = 60, h = 30, mx = 150, col = "#374151") {
    if (!th || !th.length) return "";
    const xs = th.map((_, i) => (i / (th.length - 1)) * (w - 4) + 2), ys = th.map((v) => h / 2 - (Math.max(-mx, Math.min(mx, v)) / mx) * (h / 2 - 2));
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="2" x2="${w - 2}" y1="${h / 2}" y2="${h / 2}" stroke="#d6d9de" stroke-dasharray="2 2"/><polyline fill="none" stroke="${col}" stroke-width="1.8" points="${xs.map((x, i) => x.toFixed(1) + "," + ys[i].toFixed(1)).join(" ")}"/></svg>`;
  }

  // ==================== 学堂页 ====================
  function page(root, S, o) {
    css();
    const fu = S.funnel, rk = S.rank, m = S.meta, cond = Object.fromEntries(S.cond.map((c) => [c.k, c]));
    const touchUp = (fu.close_up / Math.max(1, fu.touch)) * 100;
    const c1 = cond.c_dip1, cs = cond.c_stand, ca = cond.c_anyst_up;
    const mx = Math.max(60, ...rk.map((r) => Math.max(...(r.thumb || [0]).map(Math.abs))));
    const top = rk[0].share;
    root.innerHTML = `<div class="us">
      <p class="sub0">${m.n_codes} 只美股 / ETF、${esc(m.d0)} ~ ${esc(m.d1)} 共 ${m.n_dates} 个交易日（${m.n_days.toLocaleString()} 个「股票·日」），每天 9:30–16:00 的 5 分钟线。<b>均价线</b>＝分时图上那条黄线（开盘以来的成交均价，也叫 VWAP）。</p>
      <div class="hero">
        <div class="hl"><div class="big">${esc(S.headline.big)}</div><div class="sm">每天只归一类（按下面排行的规则先到先得）；「平常振幅」＝这只股票最近 60 天一天高低差的中位数，SPY 约 0.7%、QQQ 约 1.0%、特斯拉约 3.3%。</div></div>
        <div class="hl"><div class="big">您说的「开盘下跌 → 跌狠了拉起 → 拉到均价线 → 站上」：占全部交易日的 <span class="up">${rk.find((r) => r.k === "dip_up").share}%</span>；但开盘先跌、反弹碰到均价线之后，<span class="up">站上收高 ${touchUp.toFixed(0)}%</span>、<span class="dn">被压回 ${(100 - touchUp).toFixed(0)}%</span>——基本一半一半。</div>
          <div class="sm">开盘先跌（10:30 前见低）的日子很多，约 ${((fu.dip / fu.n) * 100).toFixed(0)}% 的交易日；其中 ${((fu.touch / fu.dip) * 100).toFixed(0)}% 都会反弹碰到均价线，问题是碰到之后往哪走猜不出来。</div></div>
        <div class="hl"><div class="big">能不能拿来做：<span class="dn">不能当买入信号</span>。碰到均价线那一刻买，收盘收涨 ${n1(c1.all.pos, 0)}%、平均 ${sg(c1.all.ret)}；等「站上」（连续 2 根 5 分钟收在均价线上）再买，收盘还在均价线上方 ${n1(cs.all.win, 0)}%，但这跟随便哪天站上均价线一样（${n1(ca.all.win, 0)}%），从那一刻买到收盘平均 ${sg(cs.all.ret)}。</div>
          <div class="sm">「站上后多半收在均价线上方」是真的，但那是因为均价线自己也在往上追，不等于价格还会涨。前后两段（2024 / 2025–2026）结论一样。${tag(cs.v)}</div></div>
      </div>

      <h2>📊 形态出现频率排行 <span class="mut">（点一行看叠加图、次日表现）</span></h2>
      <div id="usrk">${rk.map((r, i) => `<div class="rk" data-k="${r.k}"><div class="rh">${spark(r.thumb, 60, 30, Math.max(40, ...(r.thumb || [0]).map(Math.abs)) * 1.1, SCOL[r.k])}
        <div><div class="nm"><i>${NO[r.k] || ""}</i>${esc(r.name)}</div><div class="bar"><b style="width:${((r.share / top) * 100).toFixed(1)}%;background:${SCOL[r.k]}"></b></div></div>
        <div class="pc">${n1(r.share)}%<small>${r.n.toLocaleString()} 次</small></div></div><div class="rb" hidden></div></div>`).join("")}</div>
      <div class="mut">缩略图＝这类日子的中位数走势（9:30 → 16:00，虚线＝开盘价；每张图各自缩放，只看形状）。门槛整体放宽 / 收紧 30%，前两名不变，「震荡」「没有明显形态」的占比变化最大（见检验报告）。</div>
      <h3>不归类、单独数的特征（一天可以同时有几个）</h3>
      <div class="tags">${S.tags.map((t) => `<div><b>${n1(t.share)}%</b>${esc(t.name)}</div>`).join("")}</div>

      <h2>🔎 「开盘先跌」之后怎么走</h2>
      <div class="card">
        <div class="fun">${[["全部交易日", fu.n, 100], ["开盘先跌（10:30 前见低、跌到均价线下方）", fu.dip, (fu.dip / fu.n) * 100], ["之后反弹碰到均价线", fu.touch, (fu.touch / fu.n) * 100], ["站上过均价线（至少 1 根 5 分钟收在上方）", fu.cross, (fu.cross / fu.n) * 100], ["收盘在均价线上方", fu.close_up, (fu.close_up / fu.n) * 100], ["而且早盘低点就是全天最低（标准的①）", fu.close_up_low, (fu.close_up_low / fu.n) * 100]]
          .map(([l, v, p]) => `<div class="st"><div><div style="margin-bottom:2px">${l}</div><div class="bb" style="width:${Math.max(1, p).toFixed(1)}%"></div></div><div class="r">${v.toLocaleString()}<small>${p.toFixed(1)}% 的交易日</small></div></div>`).join("")}</div>
        <div class="split" style="margin-top:8px"><div style="background:${UP}"><b>${touchUp.toFixed(0)}%</b><span>碰到均价线后，收盘站在上方</span></div><div style="background:${DN}"><b>${(100 - touchUp).toFixed(0)}%</b><span>碰到后被压回，收在下方</span></div></div>
        <div class="tw"><table class="t" style="margin-top:8px"><tr><th>拆开看</th><th>开盘先跌的天数</th><th>碰到均价线</th><th>碰到后收在上方</th></tr>
          ${[["几点见底", fu.by_time], ["跌多深才反弹", fu.by_depth], ["什么标的", fu.by_grp], ["哪一段", fu.by_per], ["大盘环境", fu.by_ma], ["恐慌程度", fu.by_vix]].map(([h, xs]) => `<tr><td colspan="4" style="font-weight:700;padding-top:9px">${h}</td></tr>` + xs.map((x) => `<tr><td>${esc(x.lbl)}</td><td>${x.n.toLocaleString()}</td><td>${n1(x.touch, 0)}%</td><td><b>${n1(x.up, 0)}%</b></td></tr>`).join("")).join("")}</table></div>
        <div class="mut">反过来「开盘先冲 → 回落碰到均价线」：${fu.mirror.touch.toLocaleString()} 次里收在均价线下方的 ${((fu.mirror.close_dn / fu.mirror.touch) * 100).toFixed(0)}%。9:45 前就见底的反弹成功率最高（${n1(fu.by_time[0].up, 0)}%），10 点以后才见底的更容易被压回；纳指在 200 日线下或 VIX≥25 时被压回更多。都只差几个百分点。</div>
      </div>

      <h2>🎯 条件概率：当时能看到的情况 → 后来怎么走</h2>
      <p class="mut" style="margin-top:-4px">每张卡都只用「到那一刻为止」的分钟线判断，不偷看收盘。「同类基准」＝不管之前跌没跌、只要做了同一个动作（碰到 / 站上均价线）的所有情况。t 值按天算（同一天几十只股票只算一个样本），≥2 才算不是巧合。</p>
      <div class="cc">${["c_dip1", "c_dip2", "c_dip3", "c_dip1p", "c_stand", "c_stand2", "c_anyst_up", "c_any_up", "c_pop1", "c_popst", "c_dip1_ma", "c_stand_ma"].filter((k) => cond[k]).map((k) => condCard(cond[k])).join("")}</div>

      <h2>⏱ 美股一天的节奏：各个时段在干嘛</h2>
      <div class="card"><div id="usrh" class="ch"></div>
        <div class="lg"><span><i style="background:#9fc3ee"></i>成交量占全天 %（柱）</span><span><i style="background:${UP}"></i>平均波动（线，平常振幅的 %）</span><span><i style="background:#a855f7"></i>议息决议日的波动</span></div>
        ${S.rhythm.seg.map((s) => `<div class="seg"><div class="tm">${esc(s.a)}–${esc(s.b)}<small>${esc(s.name)}</small></div><div>${esc(s.txt)}<div class="nums">${s.mins} 分钟占全天成交 ${n1(s.volshare)}%｜每 5 分钟平均波动 ${n1(s.vol * 100, 1)}% 个振幅｜和之后 30 分钟同方向 ${n1(s.fwd, 0)}%</div></div></div>`).join("")}
        ${rhythmNotes(S)}
      </div>

      <h2>🤖 让数据自己分类（聚类）</h2>
      <div class="card"><p>不给规则，把 ${m.n_days.toLocaleString()} 天的走势丢给电脑自己分 8 类（k-means）。<b>直接分</b>：几乎全按「这天涨了多少 / 跌了多少」分，开盘急跌拉回这类不会单独成一组；<b>扣掉开盘→收盘那条直线、只看中间怎么绕</b>再分：前四大类正好是「早盘先往下绕再追回」「早盘先往上冲再回落」和它们的午前 / 午后版本，和上面的规则形态对得上。</p>
        <h3>只看形状（扣掉涨跌）</h3><div class="cl">${S.clusters2.map((c) => `<div>${spark(c.c, 120, 40, 80, "#374151")}<b>${esc(c.name)}</b><br>${n1(c.share)}%｜收在均价线上 ${n1(c.close_up, 0)}%<br><span class="mut">最常对应：${esc(c.top[0][0])} ${n1(c.top[0][1], 0)}%</span></div>`).join("")}</div>
        <h3>直接分</h3><div class="cl">${S.clusters.map((c) => `<div>${spark(c.c, 120, 40, 260, c.oc > 0 ? UP : DN)}<b>${esc(c.name)}</b><br>${n1(c.share)}%｜开盘到收盘平均 ${sg(c.oc)}</div>`).join("")}</div>
      </div>

      <h2>📐 看单只</h2>
      <div class="card"><div class="mut">每只股票自己的形态排行、最近一个交易日的阶段色块、条件概率，个股页「📐 日内形态」栏目里也有。</div>
        <div class="chips" id="uscodes"></div><div id="usone"></div></div>

      <details class="f"><summary>▸ 按环境 / 标的 / 周几 / 跳空拆开的频率表</summary><div class="in">${splitTable(S)}</div></details>
      <details class="f"><summary>▸ 每种形态的判定规则</summary><div class="in"><ul>${S.defs.map((d) => `<li><b>${esc(d.no)} ${esc(d.name)}</b>：${esc(d.rule)}</li>`).join("")}</ul>
        <ul>${S.tagdefs.map((d) => `<li><b>${esc(d.name)}</b>：${esc(d.rule)}</li>`).join("")}</ul>
        <p>「碰到均价线」＝ 5 分钟收盘价离均价线不到平常振幅的 10%；「站上」＝ 连续 2 根 5 分钟收在均价线上方。全部用 5 分钟收盘价（数据没有每根的最高最低价），所以「最低点」是 5 分钟收盘口径。</p></div></details>
      <details class="f"><summary>▸ 数据和方法、局限</summary><div class="in"><ul>
        <li>数据：CNBC 公开 5 分钟线（相似走势工具已下载的那份，只读复用）。汇总池 ${m.n_codes} 只：${m.pool.map((x) => esc(x[1]) + "（" + esc(x[2]) + "）").join("、")}。不进汇总：${m.nopool.map((x) => esc(x[1]) + "（" + esc(x[2]) + "）").join("、")}。</li>
        <li>${esc(m.vwap_note)}</li>
        <li>大盘环境：纳指100 收盘在不在 200 日均线上；VIX 用前一天收盘（开盘前就知道）；大事日＝议息决议、CPI、非农公布日。</li>
        <li>只有不到 3 年分钟数据、一个大牛市为主（纳指在 200 日线下的只有 ${n1((S.by.ma[1].n / (S.by.ma[0].n + S.by.ma[1].n)) * 100, 0)}% 的日子），熊市里比例可能不同；看了很多组条件，单个 t≈2 的结果要当巧合看待。</li>
        <li>和「美股开盘惯性」是两回事：那边检验开盘 15/30 分钟的方向能不能延续（结论：很弱），这里看的是一整天的形状和均价线。<a href="#/usopen">去看开盘惯性 ›</a>　<a href="#/labs/usshape">检验报告 ›</a></li></ul>
        <p><b>「各时段在干嘛」的解释来源：</b></p><ul>${S.sources.map((s) => `<li>${esc(s.t)}：${esc(s.note)} <a href="${esc(s.u)}" target="_blank" rel="noopener">链接</a></li>`).join("")}</ul>
        <p class="mut">生成时间 ${esc(m.built)}，每天美股收盘后自动更新。仅供研究参考，不构成投资建议。</p></div></details>
    </div>`;
    // 展开形态
    root.querySelector("#usrk").onclick = (e) => {
      const h = e.target.closest(".rh"); if (!h) return;
      const box = h.parentNode, rb = box.querySelector(".rb"), on = !box.classList.contains("on");
      box.classList.toggle("on", on); rb.hidden = !on;
      if (on && !rb.dataset.done) { rb.dataset.done = 1; shapeDetail(rb, rk.find((r) => r.k === box.dataset.k), S); }
    };
    lazy(root.querySelector("#usrh"), () => drawRhythm(root.querySelector("#usrh"), S));
    // 单只
    getJ("usshape/index.json").then((I) => {
      const box = root.querySelector("#uscodes"); if (!box) return;
      const pri = ["usQQQ", "usSPY", "usNVDA", "usTSLA", "usAAPL", "usMSFT", "usAMZN", "usMETA", "usGOOGL", "usAMD", "usAVGO", "usPLTR"];
      const cs = I.codes.slice().sort((a, b) => ((pri.indexOf(a[0]) + 1 || 99) - (pri.indexOf(b[0]) + 1 || 99)));
      box.innerHTML = cs.slice(0, 12).map((c) => `<button data-c="${esc(c[0])}">${esc(c[1])}</button>`).join("")
        + `<select id="ussel" style="font-size:13px;padding:4px 8px;border:1px solid var(--line,#e5e7eb);border-radius:999px;background:var(--card,#fff);color:inherit;max-width:100%"><option value="">更多（共 ${cs.length} 只）…</option>${cs.slice(12).map((c) => `<option value="${esc(c[0])}">${esc(c[1])}</option>`).join("")}</select>`;
      box.querySelector("#ussel").onchange = (e) => { if (e.target.value) pick(e.target.value, true); };
      const pick = (c, user) => { box.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.c === c)); const sl = box.querySelector("#ussel"); if (sl) sl.value = cs.slice(12).some((x) => x[0] === c) ? c : ""; mount(root.querySelector("#usone"), { code: c, link: o.link, inPage: true }); if (user && o.onpick) o.onpick(c); };
      box.onclick = (e) => { const b = e.target.closest("button"); if (b) pick(b.dataset.c, true); };
      pick(o.code && cs.some((x) => x[0] === o.code) ? o.code : "usQQQ");
    }).catch(() => {});
  }

  function condCard(c) {
    const a = c.all, lv = (TAG[c.v] || TAG["❌"])[0];
    const dn = /^(pop|any_dn|anyst_dn)/.test(c.kind);
    const ret = dn ? -a.ret : a.ret, pos = dn ? 100 - a.pos : a.pos;
    const half = (x) => (x && x.n ? `${n1(x.win, 0)}%（${x.n}）` : "—");
    return `<div class="cd v-${lv}"><div class="q">${esc(c.desc)}<span class="mut">（常见在 ${esc(c.t_med || "—")} 前后）</span></div>
      <div class="a"><b>${n1(a.win, 0)}%</b><span>${esc(c.win_def)}${a.base != null ? `｜同类基准 ${n1(a.base, 0)}%` : "｜抛硬币 50%"}</span></div>
      <div class="a" style="margin-top:0"><b class="${cls(ret)}" style="font-size:17px">${sg(ret)}</b><span>${dn ? "这一刻到收盘，价格平均" : "这一刻买到收盘平均"}｜收盘比这一刻高的 ${n1(pos, 0)}%</span></div>
      <div class="mut">${a.n.toLocaleString()} 次 / ${a.nd} 天｜2024：${half(c.a)}｜2025–26：${half(c.b)}｜t（对${a.base != null ? "基准" : " 50%"}）= ${n1(a.t_vs != null ? a.t_vs : a.t_win, 1)} ${tag(c.v)}</div></div>`;
  }

  function rhythmNotes(S) {
    const R = S.rhythm, mg = R.magnet;
    const k14 = R.t.indexOf("14:05"), kop = 0;
    const far = mg.vw[3], farOp = mg.op[3], farMa = mg.ma[3];
    const peak = R.volshare.indexOf(Math.max(...R.volshare.slice(1)));
    return `<div class="mut" style="margin-top:8px;line-height:1.7">
      <b>数据对得上的：</b>成交量是 U 形——开盘第一根 5 分钟占全天 ${n1(R.volshare[0])}%、收盘最后一根 ${n1(R.volshare[77])}%，午间每根只有约 ${n1(R.volshare[40])}%；波动开盘最大（第一根 ${n1(R.vol[0] * 100, 0)}% 个振幅，午间约 ${n1(R.vol[40] * 100, 0)}%）。议息决议日 14:00–14:05 波动是平时的 ${n1(R.vol_fomc[k14] / R.vol_norm[k14], 1)} 倍（${R.n_fomc} 个「股票·议息日」）。10:00–10:05 比前后格子略高一点。<br>
      <b>数据对不上的：</b>CPI / 非农（美东 8:30 盘前公布）那天开盘第一根的波动并不比平时大（${n1(R.vol_macro[0] * 100, 0)}% vs ${n1(R.vol_norm[0] * 100, 0)}%）——消息已经在盘前和开盘跳空里消化了。每个 5 分钟的涨跌和下一个 5 分钟、和之后 30 分钟同方向的比例都在 48~50%，任何时段都没有「顺着走」的惯性。<br>
      <b>均价线「吸」不「吸」价格：</b>价格离均价线超过 0.8 个平常振幅时，之后 30 分钟平均往回走 ${n1(far.back * 100, 1)}% 个振幅（t=${n1(far.t, 1)}），比同样离开盘价很远时往回走（${n1(farOp.back * 100, 1)}%）、离 20 均线很远时（${n1(farMa.back * 100, 1)}%）都明显；但往回走的次数只有 ${n1(far.p, 0)}%——是少数几次大幅回拉撑起的平均，不是每次都会回来。离得不远时没有这个效果。</div>`;
  }

  function splitTable(S) {
    const ks = S.rank.map((r) => r.k);
    const rows = [["标的类型", S.by.grp], ["哪一段", S.by.per], ["纳指100 和 200 日线", S.by.ma], ["恐慌程度（前一天 VIX）", S.by.vix], ["大事日", S.by.ev], ["周几", S.by.wd], ["开盘跳空", S.by.gap]];
    return `<div class="tw"><table class="t"><tr><th>分组</th><th>天数</th>${ks.map((k) => `<th title="${esc(S.rank.find((r) => r.k === k).name)}">${NO[k] || "—"}</th>`).join("")}</tr>
      ${rows.map(([h, xs]) => `<tr><td colspan="${ks.length + 2}" style="font-weight:700;padding-top:9px">${h}</td></tr>` + xs.map((x) => `<tr><td>${esc(x.lbl)}</td><td>${x.n.toLocaleString()}</td>${ks.map((k) => `<td>${n1(x.s[k], 0)}</td>`).join("")}</tr>`).join("")).join("")}</table></div>
      <p class="mut">单位：% 的交易日。列头编号见上面排行（①开盘先跌站上、②开盘先冲跌破、①′先跌被压回、②′先冲守住、③单边涨、④单边跌、⑤V、⑤′倒V、⑦上午涨下午跌、⑦′上午跌下午涨、⑥震荡、—其它）。大部分拆分里各形态占比只差 1~3 个点；跳空大小影响最大（大幅高开 / 低开的日子更多是③④单边）。</p>`;
  }

  function shapeDetail(rb, r, S) {
    const nx = r.next, b = S.base_next;
    rb.innerHTML = `<div class="mut" style="margin:6px 0">${esc((S.defs.find((d) => d.k === r.k) || {}).rule || "")}</div>
      <div class="kv"><div><b>${n1(r.share)}%</b><span>全部｜2024 ${n1(r.a)}%｜2025–26 ${n1(r.b)}%</span></div>
        <div><b>${n1(r.grp.idx)}% / ${n1(r.grp.big)}% / ${n1(r.grp.hv)}%</b><span>指数ETF / 大票 / 高波动股</span></div>
        <div><b class="${cls(r.oc)}">${sg(r.oc)}</b><span>当天开盘到收盘平均</span></div>
        <div><b class="${cls(nx.cc - b.cc)}">${sg(nx.cc)}</b><span>第二天涨跌平均（所有日子 ${sg(b.cc)}，t=${n1(nx.t_cc, 1)}）</span></div></div>
      <div class="ush ch"></div>
      <div class="lg"><span><i style="background:#c3c8cf"></i>${(r.overlay && r.overlay.lines.length) || 0} 个典型的日子</span><span><i style="background:${SCOL[r.k]}"></i>中位数</span><span><i style="background:${YEL}"></i>均价线（中位数）</span><span><i style="background:rgba(120,120,120,.18)"></i>中间一半的范围</span></div>
      <div class="mut">纵轴：相对开盘价，100 ＝ 这只股票平常一天的高低差（各股票换算到同一把尺子）。第二天：跳空平均 ${sg(nx.gap)}（所有日子 ${sg(b.gap)}）、白天 ${sg(nx.oc)}、收涨 ${n1(nx.up, 0)}%（所有日子 ${n1(b.up, 0)}%）；
        前后两段 ${sg(nx.cc_a)} / ${sg(nx.cc_b)}。${Math.abs(nx.t_cc || 0) < 2 && Math.abs(nx.t_up || 0) < 2 ? "和所有日子没有可靠差别——这种形态不预示第二天。" : "有一项 t 超过 2，但前后两段不一致，看了 12 种形态 × 4 个指标，当巧合处理。"}${r.n < 200 ? " ⚠️ 样本少。" : ""}</div>`;
    lazy(rb.querySelector(".ush"), () => {
      const o = r.overlay; if (!o) return;
      const c = mk(rb.querySelector(".ush"));
      c.setOption({ animation: false, grid: { left: 38, right: 10, top: 14, bottom: 24 }, xAxis: axisX(T), yAxis: axisY(""), tooltip: { trigger: "axis", confine: true, formatter: (ps) => `${ps[0].axisValue}<br>中位数 ${o.med[ps[0].dataIndex]}　均价线 ${o.vw[ps[0].dataIndex]}` },
        series: o.lines.map((l) => ({ type: "line", data: l.x, showSymbol: false, silent: true, lineStyle: { width: 1, color: "#b9bec6", opacity: 0.55 }, z: 1 }))
          .concat([{ type: "line", data: o.q25, stack: "q", stackStrategy: "all", showSymbol: false, lineStyle: { opacity: 0 }, silent: true, z: 0 },
            { type: "line", data: o.q75.map((v, i) => v - o.q25[i]), stack: "q", stackStrategy: "all", showSymbol: false, lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(120,120,120,.13)" }, silent: true, z: 0 },
            { type: "line", data: o.vw, showSymbol: false, lineStyle: { width: 2, color: YEL, type: "dashed" }, z: 3 },
            { type: "line", data: o.med, showSymbol: false, lineStyle: { width: 3, color: SCOL[r.k] }, z: 4, markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: "#999", type: "dotted" }, data: [{ yAxis: 0 }] } }]) });
    });
  }

  function drawRhythm(el, S) {
    const R = S.rhythm, c = mk(el);
    const segc = ["rgba(229,72,77,.07)", "rgba(245,165,36,.07)", "rgba(47,127,216,.05)", "rgba(150,150,150,.07)", "rgba(47,127,216,.05)", "rgba(245,165,36,.07)", "rgba(229,72,77,.07)"];
    const idx = (t) => Math.max(0, R.t.indexOf(t));
    c.setOption({ animation: false, grid: { left: 36, right: 36, top: 26, bottom: 24 }, tooltip: { trigger: "axis", confine: true, valueFormatter: (v) => (v == null ? "—" : Number(v).toFixed(1)) },
      xAxis: axisX(R.t, 12), yAxis: [axisY("成交占比 %"), { ...axisY("波动"), splitLine: { show: false } }],
      series: [{ name: "成交量占全天 %", type: "bar", data: R.volshare, itemStyle: { color: "#9fc3ee" }, barCategoryGap: "10%",
        markArea: { silent: true, label: { fontSize: 10, color: "#6b7280", position: "insideTop" }, data: R.seg.map((s, i) => [{ name: s.mins < (window.innerWidth < 600 ? 90 : 45) ? "" : s.name, xAxis: R.t[Math.max(0, idx(s.a) + 1)] || R.t[0], itemStyle: { color: segc[i] } }, { xAxis: s.b }]) } },
        { name: "平均波动（振幅 %）", type: "line", yAxisIndex: 1, data: R.vol.map((v) => v * 100), showSymbol: false, lineStyle: { color: UP, width: 2 } },
        { name: "议息日波动", type: "line", yAxisIndex: 1, data: R.vol_fomc.map((v) => v * 100), showSymbol: false, lineStyle: { color: "#a855f7", width: 1.2, type: "dashed" } }] });
  }

  // ==================== 单只（学堂页下方 + 个股站个股页） ====================
  function mount(root, o = {}) {
    css();
    if (o.base != null) BASE = o.base;
    const code = /^us/i.test(String(o.code || "")) ? "us" + String(o.code).trim().slice(2).replace(/\.(OQ|N|AM)$/i, "").replace(/^\./, "").toUpperCase() : o.code;
    const link = o.link || ((c, n) => esc(n || c));
    root.innerHTML = `<div class="us"><div class="mut">正在读取…</div></div>`;
    if (!/^us/.test(code || "")) { root.innerHTML = `<div class="us"><div class="mut">日内形态目前只做了美股。</div></div>`; return; }
    Promise.all([getJ("usshape/" + code + ".json"), getJ("usshape.json").catch(() => null)]).then(([J, S]) => one(root, J, S, o, link))
      .catch(() => { root.innerHTML = `<div class="us"><div class="card"><b>${esc(code.slice(2))} 还没进形态库</b><div class="mut">形态库目前有 38 只常用美股 / ETF（2024 年起的 5 分钟线）。本机可以用 <code>python3 usshape.py --code ${esc(code)}</code> 下载并生成，下次发布后这里就有了。全体美股的统计见 <a href="${BASE ? BASE + "#/usshape" : "#/usshape"}">学堂「美股日内形态」</a>。</div></div></div>`; });
  }

  function one(root, J, S, o, link) {
    const L = J.last, fr = J.freq, top = Math.max(...fr.map((x) => Math.max(x.share || 0, x.pool || 0)));
    const nm = J.name || J.code.slice(2);
    const ref = L.prev, pct = (v) => (v / ref - 1) * 100;
    const segs = L.phases || [];
    const mine = J.next.me, pool = J.next.pool;
    root.innerHTML = `<div class="us">
      <div class="hl" style="padding:4px 0 8px"><div class="big" style="font-size:18px;font-weight:800;line-height:1.5">${o.inPage ? link(J.code, nm) : esc(nm)} 最近一个交易日（${esc(L.date.slice(5))}）：<span style="color:${SCOL[L.shape]}">${NO[L.shape] || ""} ${esc(L.name)}</span></div>
        <div class="mut">${esc(L.txt)}${L.tags.length ? "　另外：" + L.tags.map(esc).join("、") : ""}。全天 ${sg(L.cc)}（开盘 ${sg(L.gap)}，开盘到收盘 ${sg(L.oc)}）。</div></div>
      <div class="ush1 ch s"></div>
      <div class="lg"><span><i style="background:#1f2328"></i>价格</span><span><i style="background:${YEL}"></i>均价线</span><span><i style="background:#9aa3ad"></i>5 分钟 20 均线</span>${segs.map((s) => `<span><i style="background:${s[3]};opacity:.45"></i>${esc(s[2])} ${T[s[0]]}–${T[s[1]]}</span>`).join("")}</div>
      <h3>这只最常见的形态 <span class="mut">（${esc(J.d0)} ~ ${esc(J.d1)}，${J.n} 天；平常振幅约 ${n1(J.R, 1)}%）</span></h3>
      ${fr.filter((x) => x.n > 0).map((x) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:8px;align-items:center;font-size:13px;margin:3px 0">
        <div><div>${NO[x.k] || ""} ${esc(x.name)}</div><div style="position:relative;height:9px;background:var(--soft,#f2f3f5);border-radius:4px;margin-top:3px"><b style="position:absolute;left:0;top:0;bottom:0;width:${((x.share / top) * 100).toFixed(1)}%;background:${SCOL[x.k]};border-radius:4px"></b>${x.pool != null ? `<i style="position:absolute;top:-2px;bottom:-2px;left:${((x.pool / top) * 100).toFixed(1)}%;width:2px;background:#1f2328"></i>` : ""}</div></div>
        <div style="text-align:right"><b>${n1(x.share)}%</b><div class="mut" style="font-size:11px">全体 ${n1(x.pool)}%</div></div></div>`).join("")}
      <div class="mut">黑色竖线＝全体美股平均。${J.inpool ? "" : "（这只不在全体汇总里，只作对比）"}${J.vw_twap ? " 这是指数，没有成交量，均价线用等权平均代替。" : ""}</div>
      <h3>最近 30 个交易日</h3>
      <div class="days">${J.recent.map((d) => `<span style="background:${SCOL[d.k]}" title="${esc(d.d)} ${esc((S && S.rank.find((r) => r.k === d.k) || {}).name || d.k)}">${esc(d.d.slice(5))}<br>${NO[d.k] || "—"} ${d.cc == null ? "" : (d.cc > 0 ? "+" : "") + d.cc.toFixed(1)}</span>`).join("")}</div>
      <h3>这只的条件概率（和全体对比）</h3>
      <div class="tw"><table class="t"><tr><th>当时的情况</th><th>次数</th><th>结果（这只）</th><th>全体</th><th>这一刻到收盘（价格）</th></tr>
        ${J.cond.map((c) => { const dn = /^c_(pop|any_dn)/.test(c.k), r = c.me.ret == null ? null : dn ? -c.me.ret : c.me.ret; return `<tr><td>${esc(SHORT[c.k] || c.desc)} → ${esc(c.win_def)}${c.small ? " ⚠️ 样本少" : ""}</td><td>${c.me.n || 0}</td><td><b>${n1(c.me.win, 0)}%</b></td><td>${n1(c.pool.win, 0)}%</td><td class="${cls(r)}">${sg(r)}</td></tr>`; }).join("")}</table></div>
      <div class="mut">开盘先跌、反弹碰到均价线后：这只收在均价线上方 ${n1(J.funnel.up_pct, 0)}%（${J.funnel.up}/${J.funnel.touch} 次），全体 ${n1(J.funnel.pool_up, 0)}%。
        「${esc(L.name)}」之后第二天：这只平均 ${sg(mine.cc)}、收涨 ${n1(mine.up, 0)}%（${mine.n} 次）；全体 ${sg(pool && pool.cc)}、收涨 ${n1(pool && pool.up, 0)}%。单只几百天的样本很容易看走眼，以全体为准；全体也没有一种形态能可靠预示第二天。
        ${o.inPage ? "" : `<a href="${BASE}#/usshape/${esc(J.code)}">全体美股的形态统计 ›</a>`}</div>
    </div>`;
    lazy(root.querySelector(".ush1"), () => {
      const c = mk(root.querySelector(".ush1"));
      const pr = L.p.map(pct), vw = L.vw.map(pct), ma = L.ma.map(pct);
      const lo = Math.min(...pr, ...vw), hi = Math.max(...pr, ...vw), pad = (hi - lo) * 0.08 || 0.2;
      c.setOption({ animation: false, grid: { left: 42, right: 10, top: 12, bottom: 24 }, xAxis: axisX(T), yAxis: { ...axisY(""), min: (lo - pad).toFixed(2), max: (hi + pad).toFixed(2), axisLabel: { fontSize: 10.5, color: "#8a8f98", formatter: (v) => v.toFixed(1) + "%" } },
        tooltip: { trigger: "axis", confine: true, formatter: (ps) => { const i = ps[0].dataIndex; return `${T[i]}　${L.p[i]}<br>${L.has_prev ? "相对昨收" : "相对开盘"} ${sg(pr[i])}<br>均价线 ${L.vw[i]}（${sg(vw[i])}）`; } },
        series: [{ type: "line", data: pr, showSymbol: false, lineStyle: { width: 2, color: "#1f2328" }, z: 3,
          markArea: { silent: true, label: { fontSize: 10, color: "#374151", position: "insideTop" }, data: segs.map((s) => [{ name: window.innerWidth < 600 && s[1] - s[0] < 14 ? "" : s[2], xAxis: T[s[0]], itemStyle: { color: s[3], opacity: 0.13 } }, { xAxis: T[s[1]] }]) },
          markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: "#bbb", type: "dotted" }, data: [{ yAxis: 0 }] } },
          { type: "line", data: vw, showSymbol: false, lineStyle: { width: 2, color: YEL }, z: 2 },
          { type: "line", data: ma, showSymbol: false, lineStyle: { width: 1, color: "#9aa3ad", type: "dashed" }, z: 1 }] });
    });
  }

  window.USSHAPE = { mount, setBase: (b) => { BASE = b; } };
  // ---------- 学堂路由 #/usshape[/代码] ----------
  window.__mod_usshape = {
    page(code) {
      const A = window.__APP;
      BASE = "";
      document.title = "美股日内形态 · 小七投研";
      A.app.innerHTML = `<h1>📐 美股日内形态</h1><div id="usroot">${A.LOADING()}</div>${A.DISC}`;
      const tok = A.tok();
      getJ("usshape.json").then((S) => {
        if (!A.alive(tok)) return;
        page(document.getElementById("usroot"), S, { code: code && /^us/.test(code) ? code : null, link: (c, n) => A.stockLink(c, n),
          onpick: (c) => { try { history.replaceState(history.state, "", "#/usshape/" + encodeURIComponent(c)); } catch (e) { /* 不影响 */ } } });
        if (code) setTimeout(() => { const el = document.getElementById("usone"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); }, 300);
      }).catch(() => { if (A.alive(tok)) document.getElementById("usroot").innerHTML = A.FAIL(); });
    },
  };
})();
