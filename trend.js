/* 小七投研 · 📟 趋势状态判定 #/trend（读 trend.json，trend_state.py 生成：盘中 / 盘后各跑一次，daily_publish 也会跑）。
   参照「布鲁斯交易系统·趋势状态判定日报」：首屏大状态卡（状态色块 + 一句话操作含义 + 反弹 Day 计数 + 检验徽标）→ 指标表（数值｜判定，红涨绿跌）
   → 近 60 天状态时间线（色带叠上证走势，ECharts 滑到才加载）→ 检验结论（reports/*_trend_state_lab.md → #/labs/trend_state）→ 说明默认折叠。
   手机 390 宽：指标表用两行卡片，不横向滚动。 */
(function () {
  const A = window.__APP;
  const { esc } = A;
  const n = (v, d = 2) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d));
  const sg = (v, d = 2) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%");
  const cls = (v) => (v == null || isNaN(v) || Math.abs(v) < 0.005 ? "" : v > 0 ? "up" : "dn");
  const TAG = { "✅": ["ok", "✅ 成立"], "⚠️": ["part", "⚠️ 部分成立"], "❌": ["no", "❌ 不成立"], "温度计": ["no", "样本少"] };
  const tag = (v) => `<i class="trlv ${(TAG[v] || TAG["❌"])[0]}">${(TAG[v] || TAG["❌"])[1]}</i>`;

  if (!document.getElementById("tr-css")) {
    const st = document.createElement("style");
    st.id = "tr-css";
    st.textContent = `.tr{max-width:1000px;overflow-wrap:anywhere}
.tr .sub0{color:var(--sub);font-size:13px;margin:-2px 0 10px;line-height:1.6}
.tr .hero{border-radius:16px;padding:16px 18px;margin:8px 0 12px;color:#fff;position:relative}
.tr .hero .s{font-size:13px;font-weight:700;opacity:.9;letter-spacing:.5px}
.tr .hero .big{font-size:26px;font-weight:900;line-height:1.3;margin:2px 0 8px}
.tr .hero .chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.tr .hero .chips span{background:rgba(255,255,255,.22);border-radius:999px;padding:3px 10px;font-size:13px;font-weight:700;white-space:nowrap}
.tr .hero .op{background:rgba(0,0,0,.16);border-radius:10px;padding:9px 12px;font-size:15.5px;font-weight:700;line-height:1.55}
.tr .hero .hm{font-size:12.5px;color:#fff;opacity:.95;margin-top:8px;line-height:1.6}
.tr .day{display:flex;gap:4px;margin:8px 0 2px}.tr .day i{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.25)}.tr .day i.on{background:#fff}.tr .day i.ftd{outline:2px solid #ffd45c}
@media (max-width:600px){.tr .hero .big{font-size:21px}.tr .hero .op{font-size:14.5px}}
.tr .chk{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:14px;line-height:1.65}
.tr .trlv{font-style:normal;font-size:12px;font-weight:700;border-radius:6px;padding:2px 7px;white-space:nowrap;margin-right:4px}
.tr .trlv.ok{background:#e7f6ee;color:#1d7a4c}.tr .trlv.part{background:#fff4d6;color:#8a5a00}.tr .trlv.no{background:#eef0f3;color:#6b7280}
.tr .up{color:var(--up)}.tr .dn{color:var(--dn)}
.tr h2{font-size:17px;margin:18px 0 8px}
.tr .ind{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.tr .ind .r{display:grid;grid-template-columns:minmax(0,10em) minmax(0,9em) minmax(0,1fr);gap:10px;padding:9px 12px;border-bottom:1px solid var(--line);align-items:baseline}
.tr .ind .r:last-child{border-bottom:0}.tr .ind .k{font-size:14px;color:var(--sub)}.tr .ind .v{font-size:16px;font-weight:800;white-space:nowrap}.tr .ind .j{font-size:14px;line-height:1.5}
.tr .ind .k small{display:block;font-size:11.5px;color:var(--sub);opacity:.85;line-height:1.4}
@media (max-width:640px){.tr .ind .r{grid-template-columns:minmax(0,1fr) auto;gap:2px 8px}.tr .ind .j{grid-column:1/-1;font-size:13.5px;color:var(--sub)}.tr .ind .k small{display:none}}
.tr .bl{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 14px;margin:8px 0}
.tr .bl p{margin:5px 0;font-size:14px;line-height:1.65}.tr .bl b{white-space:nowrap}
.tr .ch{width:100%;height:280px;background:var(--card);border:1px solid var(--line);border-radius:12px}
@media (max-width:600px){.tr .ch{height:240px}}
.tr .lg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12.5px;color:var(--sub);margin:6px 2px}.tr .lg i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:4px}
.tr .lab{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.tr .lab>div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;border-left:5px solid #ccc}
.tr .lab b{font-size:14px}.tr .lab .x{font-size:12.5px;color:var(--sub);line-height:1.55;margin-top:3px}
.tr .lst{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px 12px}
.tr .lst .r{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px;line-height:1.5}.tr .lst .r:last-child{border-bottom:0}
.tr .lst .r span:first-child{min-width:0}.tr .lst .r span:last-child{white-space:nowrap;text-align:right}
.tr details.f{margin:10px 0}.tr details.f>summary{cursor:pointer;color:var(--brand);font-size:14px;list-style:none;padding:4px 0}
.tr details.f>summary::-webkit-details-marker{display:none}
.tr details.f ol,.tr details.f ul{margin:4px 0 0;padding-left:20px;font-size:13.5px;line-height:1.75}`;
    document.head.appendChild(st);
  }

  function hero(J) {
    const live = J.mode === "盘中";
    const days = J.state === "S1" || J.state === "S2" || J.state === "S3";
    const dots = days ? `<div class="day">${[1, 2, 3, 4, 5, 6].map((k) => `<i class="${k <= J.day_n ? "on" : ""} ${k === 4 ? "ftd" : ""}"></i>`).join("")}</div>
      <div class="hm">反弹尝试 Day${J.day_n || 0}${J.day_n ? "" : "（今天没收涨，未开始计数）"}｜黄框 = Day4：从这天起才可能出现「确认日」（上证涨 ≥1.2% 且放量）</div>` : "";
    return `<div class="hero" style="background:${esc(J.color)}">
      <div class="s">${esc(J.state)} · ${esc(J.dir)}</div>
      <div class="big">${esc(J.name)}</div>
      <div class="chips"><span>置信度 ${esc(J.conf)}</span>${days ? `<span>反弹尝试 Day${J.day_n || 0}</span><span>${esc(J.panic)}</span><span>${esc(J.ftd)}</span>` : ""}</div>
      <div class="op">${esc(J.op)}</div>${dots}
      <div class="hm">数据 ${esc(J.date)} ${esc(J.time)}${live ? "（盘中暂判，以收盘后为准）" : "（盘后）"}</div>
    </div>`;
  }

  function check(J) {
    const lab = J.lab || {};
    const s = (lab.states || {})[J.state];
    return `<div class="chk">${tag(s ? s.mark : "❌")}<b>检验：</b>${esc((lab.weight_line || "检验未跑").replace(/^[❌⚠️✅]\uFE0F?\s*/u, ""))}${s ? `；${esc(J.state)} 之后沪深300 10 天平均 <span class="${cls(s.hs10)}">${sg(s.hs10)}</span>（比其他日子 ${sg(s.hs10_diff)}，t=${n(s.t, 1)}）` : ""}。
      ${J.quad_note ? `<br><b>对照四象限：</b>${esc(J.quad_note)}` : ""}</div>`;
  }

  function rows(J) {
    return `<div class="ind">${(J.rows || []).map((r) => `<div class="r"><div class="k">${esc(r.k)}${r.help ? `<small>${esc(r.help)}</small>` : ""}</div>
      <div class="v ${r.t === "up" ? "up" : r.t === "down" ? "dn" : ""}">${esc(r.v || "")}</div><div class="j">${esc(r.j)}</div></div>`).join("")}</div>`;
  }

  function basis(J) {
    return `<div class="bl"><p><b>背离：</b>${esc(J.div)}</p><p><b>防守共振：</b>${esc(J.resonance)}</p>
      <p><b>技术对照：</b>${esc(J.tech)}（只展示，不参与判定）</p><p><b>判定依据：</b>${(J.why || []).map(esc).join("；")}</p></div>`;
  }

  function timeline(J) {
    const st = J.states || {};
    const lg = Object.keys(st).map((k) => `<span><i style="background:${esc(st[k].color)}"></i>${esc(k)} ${esc(st[k].name)}</span>`).join("");
    return `<h2>近 60 天状态</h2><div class="ch" id="trch"></div><div class="lg">${lg}</div>`;
  }

  function drawTL(J) {
    const el = document.getElementById("trch");
    if (!el) return;
    const T = J.timeline || [];
    const st = J.states || {};
    const segs = [];
    T.forEach((x, i) => { if (!segs.length || segs[segs.length - 1].s !== x.s) segs.push({ s: x.s, a: i, b: i }); else segs[segs.length - 1].b = i; });
    const c = A.mk(el);
    const css = getComputedStyle(document.documentElement);
    const sub = (css.getPropertyValue("--sub") || "#888").trim();
    c.setOption({
      animation: false, grid: { left: 44, right: 12, top: 16, bottom: 26 },
      tooltip: { trigger: "axis", confine: true, formatter: (ps) => { const x = T[ps[0].dataIndex]; return `${x.d}<br>上证 ${x.c}<br>${x.s} ${(st[x.s] || {}).name || ""}`; } },
      xAxis: { type: "category", data: T.map((x) => x.d.slice(5)), boundaryGap: false, axisLabel: { fontSize: 10.5, color: sub }, axisTick: { show: false } },
      yAxis: { type: "value", scale: true, axisLabel: { fontSize: 10.5, color: sub }, splitLine: { lineStyle: { color: "rgba(128,128,128,.15)" } } },
      series: [{ type: "line", data: T.map((x) => x.c), showSymbol: false, lineStyle: { width: 2, color: "#333" },
        markArea: { silent: true, data: segs.map((g) => [{ xAxis: T[g.a].d.slice(5), itemStyle: { color: (st[g.s] || {}).color || "#ccc", opacity: 0.28 } }, { xAxis: T[Math.min(g.b + 1, T.length - 1)].d.slice(5) }]) } }],
    });
  }

  function labBox(J) {
    const lab = J.lab || {};
    if (!lab.states) return "";
    const st = J.states || {};
    const S = Object.keys(lab.states).map((k) => { const x = lab.states[k]; return `<div style="border-left-color:${esc((st[k] || {}).color || "#ccc")}"><b>${esc(k)} ${esc((st[k] || {}).name || "")}</b>
      <div class="x">${tag(x.mark)}之后 10 天沪深300 <span class="${cls(x.hs10)}">${sg(x.hs10)}</span>，比其他日子 ${sg(x.hs10_diff)}（t=${n(x.t, 1)}，${x.n} 天）</div></div>`; }).join("");
    const I = Object.keys(lab.ind || {}).map((k) => { const x = lab.ind[k]; return `<div class="r"><span>${esc(k)}</span><span>${tag(x.mark)}10 天 ${sg(x.hs10_diff)}（t=${n(x.t, 1)}）</span></div>`; }).join("");
    const s = (lab.strategy || {})["上证"] || {};
    const f = lab.ftd || {};
    return `<h2>检验：这套状态能不能用（${esc(lab.period || "")}）</h2>
      <div class="chk"><b>${esc(lab.weight_line || "")}</b><br>
        「S1/S2 不持有」：上证年化 ${sg(s.a1, 1)}、最大回撤 ${sg(s.d1, 1)}，一直拿着 ${sg(s.ab, 1)} / ${sg(s.db, 1)}；不在场的日子里，避开的下跌合计 ${n(s.lost_dn, 0)} 个百分点、错过的上涨合计 +${n(s.miss_up, 0)} 个百分点（按日累加，净算错过约 ${n(s.off_sum, 0)}%）。<br>
        确认日 ${f.n || 0} 次（失败 ${f.failed || 0} 次），之后 20 天上证平均 ${sg(f.sh20)}，下跌状态里随便哪天 ${sg(f.bear_sh20)}。<br>
        和四象限：相关程度 ${n((lab.quad || {}).cramer, 2)}（0~1），合在一起没有多出可靠信息。<br>
        <a href="#/labs/trend_state">完整检验报告 ›</a></div>
      <div class="lab">${S}</div>
      <h2>单个指标之后 10 天（沪深300，比平常）</h2><div class="lst">${I}</div>`;
  }

  function notes(J) {
    return `<details class="f"><summary>▸ 状态机规则、数据源和口径（点开）</summary><ol>${(J.state_doc || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      <ul><li>宽度 R = 上涨家数 ÷ 下跌家数（布鲁斯 11-24 的 0.558 = 1951 ÷ 3498，与新浪全市场快照完全一致）；上涨比 = 上涨 ÷（上涨+下跌）。</li>
      <li>TRIN 用成交额口径（11-24 = 0.547，与截图一致）；量能 Vr = 两市成交额 ÷ 前 10 日均额（11-24 = 1.077，截图 1.076）。</li>
      <li>期权 PCR / IV 是上交所 300ETF 期权（16:00 后才有当天）；席位净空是中金所 IF 主力合约前 20 会员（17:00 前后出当天）；两融收盘后只能拿到前一天。</li>
      <li>布鲁斯没有公开全部规则，这里按他的日报截图和视频说法复刻，阈值照搬、没有拿收益调参；不等于他本人的系统。博主本人判断的命中率见 <a href="#/gurus">博主观点</a>。</li>
      <li>只作温度计：仓位上限仍以四象限 / 总状态为准；不构成投资建议。</li></ul></details>`;
  }

  window.__mod_trend = {
    async page() {
      const app = A.app;
      document.title = "趋势状态判定 · 小七投研";
      app.innerHTML = `<div class="tr"><h1>📟 趋势状态判定</h1>${A.LOADING()}</div>`;
      const tok = A.tok();
      try {
        const J = await A.getJSON("trend.json", true);
        if (!A.alive(tok)) return;
        app.innerHTML = `<div class="tr"><h1>📟 趋势状态判定</h1>
          <p class="sub0">参照「布鲁斯交易系统 · 趋势状态判定日报」的框架，每天盘中、盘后各算一次。只作温度计，不改四象限结论。</p>
          ${hero(J)}${check(J)}<h2>指标（数值｜判定，红涨绿跌）</h2>${rows(J)}${basis(J)}${timeline(J)}${labBox(J)}${notes(J)}</div>${A.DISC}`;
        const el = document.getElementById("trch");
        const go = () => A.need("lib").then(() => { if (A.alive(tok)) drawTL(J); }).catch(() => { el.innerHTML = '<p class="muted" style="padding:12px">图表组件加载失败，文字结论不受影响</p>'; });
        if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: "200px" }); io.observe(el); } else go();
      } catch (e) {
        if (A.alive(tok)) app.innerHTML = "<div class='tr'><h1>📟 趋势状态判定</h1><div class='chk'>数据暂未生成（运行 trend_state.py 后发布）。</div></div>";
      }
    },
  };
})();
