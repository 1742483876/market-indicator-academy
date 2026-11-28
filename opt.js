/* 小七投研 · 期权研究 #/opt（读 opt.json，options_research.py 生成；检验报告 reports/*_options_signals_lab.md → #/labs/options_signals）。
   首屏只放结论（A股 / 美股两张温度卡，大字）；品种对比做成总表（电脑表格、手机两行一条，不横向滚动）；说明默认折叠。 */
(function () {
  const A = window.__APP;
  const { esc, stockLink } = A;
  const n = (v, d = 1) => (v == null || isNaN(v) ? "—" : Number(v).toFixed(d));
  const sg = (v, d = 1) => (v == null || isNaN(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d));
  const LV = { "✅": "ok", "⚠️": "part", "❌": "no", "温度计": "temp", "只作温度计": "temp", "检验中": "temp", "不做": "no" };
  const lvTag = (lv) => `<i class="olv ${LV[lv] || "temp"}">${esc(lv === "温度计" ? "只作温度计" : lv)}</i>`;

  if (!document.getElementById("opt-css")) {
    const st = document.createElement("style");
    st.id = "opt-css";
    st.textContent = `.opt .ocards{display:grid;grid-template-columns:1fr;gap:10px;margin:8px 0 12px}
@media (min-width:900px){.opt .ocards{grid-template-columns:1fr 1fr}}
.opt .ocard{background:var(--card,#fff);border:1px solid var(--line,#eee);border-left:6px solid #9aa3ad;border-radius:12px;padding:12px 14px}
.opt .ocard.hot{border-left-color:#e5484d}.opt .ocard.warm{border-left-color:#e8aa00}.opt .ocard.cool{border-left-color:#2f7fd8}
.opt .ocard .oh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.opt .ocard .oh b{font-size:14px;color:var(--sub,#666)}
.opt .ocard .olvl{font-size:26px;font-weight:800;letter-spacing:.5px}
.opt .ocard.hot .olvl{color:#e5484d}.opt .ocard.warm .olvl{color:#c58a00}.opt .ocard.cool .olvl{color:#2f7fd8}
.opt .ocard .oimp{font-size:16px;font-weight:700;line-height:1.55;margin:6px 0 4px}
.opt .ocard .onum{font-size:13px;color:var(--sub,#666);line-height:1.6}
.opt .otags{display:flex;flex-wrap:wrap;gap:5px 8px;margin-top:8px;font-size:12.5px;color:var(--sub,#666)}
.opt .otags span{white-space:nowrap}
.opt .olv{font-style:normal;font-size:11px;font-weight:700;border-radius:5px;padding:1px 5px;margin-left:3px;white-space:nowrap}
.opt .olv.ok{background:#e7f6ee;color:#1d7a4c}.opt .olv.part{background:#fff4d6;color:#8a5a00}.opt .olv.no{background:#eef0f3;color:#6b7280}.opt .olv.temp{background:#eef4fd;color:#2f6bb8}
.opt details.ofold{margin:6px 0}.opt details.ofold>summary{cursor:pointer;color:var(--brand,#2f7fd8);font-size:13.5px;list-style:none;padding:4px 0}
.opt details.ofold>summary::-webkit-details-marker{display:none}
.opt .ofold ul{margin:4px 0 0;padding-left:18px;font-size:13.5px;line-height:1.7}
.opt .ouse{background:var(--card,#fff);border:1px solid var(--line,#eee);border-radius:12px;padding:10px 14px 10px 30px;margin:0 0 10px}
.opt .ouse li{font-size:14.5px;line-height:1.7;margin:3px 0}
.opt .olist{background:var(--card,#fff);border:1px solid var(--line,#eee);border-radius:12px;padding:2px 12px;margin:0 0 10px}
.opt .orow{padding:8px 0;border-bottom:1px solid var(--line,#eee)}.opt .orow:last-child{border-bottom:0}
.opt .o1{display:flex;gap:6px 8px;align-items:baseline;flex-wrap:wrap;font-size:14.5px}.opt .o1 .px{color:var(--sub,#666);font-size:13px}
.opt .o1 .oone{flex-basis:100%;font-size:13.5px;color:var(--text,#222)}
.opt .o2{font-size:12.5px;color:var(--sub,#666);line-height:1.6;margin-top:2px;overflow-wrap:anywhere}.opt .o2 b{color:var(--text,#222);font-weight:600}
.opt .tbl{font-size:12.5px}.opt .tbl td,.opt .tbl th{white-space:nowrap;padding:6px 6px}.opt .tbl td.w{white-space:normal;min-width:150px}.opt .tbl td.em{white-space:normal;min-width:110px}
.opt .dk{overflow-x:auto}
.opt .dk{display:none}@media (min-width:900px){.opt .dk{display:block}.opt .mb{display:none}}
.opt .owall{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px}@media (min-width:900px){.opt .owall{grid-template-columns:1fr 1fr}}
.opt .owall .ocard{border-left-color:#9aa3ad}.opt .owall .kv{display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:4px 0;border-bottom:1px dashed var(--line,#eee)}
.opt .owall .kv:last-child{border-bottom:0}.opt .owall .kv span{color:var(--sub,#666)}
.opt .pro{font-size:13px;line-height:1.6}.opt .pro .pi{padding:8px 0;border-bottom:1px solid var(--line,#eee)}.opt .pro .pi:last-child{border-bottom:0}
.opt .pro .pi b{font-size:14px}.opt .pro .pi div{color:var(--sub,#555)}
.opt .up{color:#e5484d}.opt .dn{color:#2fa86b}
.opt .src{font-size:12px;color:var(--sub,#777);line-height:1.6;padding-left:18px}
.opt .sopt{display:grid;grid-template-columns:1fr;gap:8px;margin:8px 0}@media(min-width:900px){.opt .sopt{grid-template-columns:1fr 1fr}}
.opt .sopt-i{background:var(--card,#fff);border:1px solid var(--line,#eee);border-radius:12px;padding:0}
.opt .sopt-i>summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;cursor:pointer;list-style:none;font-variant-numeric:tabular-nums}
.opt .sopt-i>summary::-webkit-details-marker{display:none}
.opt .sopt-i .so-nm{font-size:14.5px;font-weight:700;flex:1;min-width:110px;color:var(--text,#333)}
.opt .sopt-i .so-iv{font-size:13px;font-weight:800;padding:2px 8px;border-radius:6px;color:#fff}
.opt .sopt-i .so-iv.hot{background:#e5484d}.opt .sopt-i .so-iv.warm{background:#c58a00}.opt .sopt-i .so-iv.cool{background:#2f7fd8}
.opt .sopt-i .so-be{font-size:12px;color:var(--sub,#666)}
.opt .sopt-i>summary em{font-style:normal;color:var(--sub2,#999);transition:transform .15s}
.opt .sopt-i[open]>summary em{transform:rotate(180deg)}
.opt .so-body{padding:0 14px 12px}.opt .so-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 10px}
.opt .so-grid div{background:var(--soft,#f7f7f7);border-radius:8px;padding:7px 9px}
.opt .so-grid span{display:block;font-size:11.5px;color:var(--sub,#777)}.opt .so-grid b{font-size:15px;color:var(--text,#333)}
.opt .so-note{font-size:13.5px;line-height:1.65;background:var(--soft,#f7f7f7);border-radius:8px;padding:9px 11px;margin-bottom:6px;color:var(--text,#333)}`;
    document.head.appendChild(st);
  }

  const link = (r, mkt) => {
    if (mkt === "us") return stockLink("us" + r.sym, `${r.sym} ${r.name}`);
    const idx = { IO: "sh000300", MO: "sh000852", HO: "sh000016" }[r.sym];
    return idx ? stockLink(idx, r.name) : stockLink(r.sym, r.name);
  };
  const termW = (t) => (t == null ? "—" : t >= 1.03 ? `<b class="up">倒挂</b> ${n(t, 2)}` : t <= 0.97 ? `正常 ${n(t, 2)}` : `平 ${n(t, 2)}`);
  const pctW = (r) => (r.iv_pct == null ? (r.iv_days != null ? `积累中（${r.iv_days} 天）` : "—") : `${n(r.iv_pct, 0)}%${r.iv_pct_src && r.iv_pct_src !== "上交所隐波" ? `<span class="muted small">（${esc(r.iv_pct_src)}）</span>` : ""}`);
  const emW = (r) => (r.em ? `±${n(r.em.pct, 1)}%<span class="muted small">（${esc(r.em.ev_date.slice(5))} ${esc(shortEv(r.em.ev))}${r.em.exp ? `，到 ${esc(r.em.exp.slice(5))}` : ""}${r.em.approx ? "，隐波折算" : ""}${r.em.tbd ? "，日期待定" : ""}）</span>` : "—");
  const shortEv = (t) => String(t || "").replace(/（.*?）/g, "").slice(0, 10);
  const pcrW = (r) => (r.pcr_vol == null && r.pcr_oi == null ? "—" : `${n(r.pcr_vol, 2)} / ${n(r.pcr_oi, 2)}`);

  function table(rows, mkt) {
    const head = "<tr><th>标的</th><th>现价</th><th>IV</th><th>IV 分位</th><th>HV20</th><th>IV−HV</th><th>PCR 成交 / 持仓</th><th>期限结构</th><th>偏度</th><th>下一个大事前预期波动</th><th>一句话</th></tr>";
    const body = rows.map((r) => `<tr><td>${link(r, mkt)}</td><td>${n(r.px, mkt === "us" ? 2 : 3)}</td><td>${n(r.iv)}${r.iv_proxy ? '<span class="muted small">≈</span>' : r.iv_approx ? '<span class="muted small">≈</span>' : ""}</td>
      <td>${pctW(r)}</td><td>${n(r.hv20)}</td><td>${sg(r.gap)}</td><td>${pcrW(r)}</td><td>${termW(r.term)}</td><td>${r.skew == null ? "—" : sg(r.skew)}</td><td class="em">${emW(r)}</td><td class="w">${esc(r.one || "—")}</td></tr>`).join("");
    const mob = rows.map((r) => `<div class="orow"><div class="o1"><b>${link(r, mkt)}</b><span class="px">${n(r.px, mkt === "us" ? 2 : 3)}</span><span class="oone">${esc(r.one || "—")}</span></div>
      <div class="o2">IV <b>${n(r.iv)}</b>（分位 ${pctW(r)}）· HV20 ${n(r.hv20)} · IV−HV <b>${sg(r.gap)}</b> · PCR ${pcrW(r)} · 期限 ${termW(r.term)}${r.skew != null ? ` · 偏度 ${sg(r.skew)}` : ""}${r.em ? ` · 大事前 ${emW(r)}` : ""}</div></div>`).join("");
    return `<div class="dk"><table class="tbl">${head}${body}</table></div><div class="mb olist">${mob}</div>`;
  }

  function wallCard(r) {
    const w = r.walls;
    if (!w) return "";
    const gx = w.gex == null ? "—" : `${w.gex >= 0 ? "正" : "负"}（${sg(w.gex / 1e8, 1)} 亿美元 / 每涨跌 1%）`;
    return `<div class="ocard"><div class="oh"><b>${link(r, "us")}</b><span class="muted small">现价 ${n(r.px, 2)}，看 ${esc(w.exp.slice(5))} 月度到期、现价 ±15% 内</span></div>
      <div class="kv"><span>最大痛点</span><b>${n(w.maxpain, 0)}</b></div>
      <div class="kv"><span>认购持仓最多（常被当压力）</span><b>${n(w.call_wall, 0)}<span class="muted small">（${(w.call_wall_oi || 0).toLocaleString()} 张）</span></b></div>
      <div class="kv"><span>认沽持仓最多（常被当支撑）</span><b>${n(w.put_wall, 0)}<span class="muted small">（${(w.put_wall_oi || 0).toLocaleString()} 张）</span></b></div>
      <div class="kv"><span>做市商 gamma 敞口</span><b class="${w.gex >= 0 ? "" : "up"}">${gx}</b></div>
      <div class="onum">最大痛点 = 到期时期权买方整体最亏的价。GEX ${w.gex >= 0 ? "正：做市商倾向「涨了卖、跌了买」，压低波动" : "负：做市商倾向「跌了卖、涨了买」，放大波动"}。${lvTag("温度计")} 近似、未经检验（没有历史期权链，没法回测）。</div></div>`;
  }

  // 个股期权观察卡（stockopt.py → stockopt.json；真实 CBOE 链，约 30 天到期）
  function stockOptCards(SO) {
    if (!SO || !(SO.items || []).length) return "";
    const ivCls = (v) => (v >= 55 ? "hot" : v >= 35 ? "warm" : "cool");
    return `<h2>🔎 个股期权观察 <span class="muted small">真实期权链 · ${esc(String(SO.built || "").slice(5))} · 约30天到期</span></h2>
      <div class="sopt">${SO.items.map((m) => `<details class="sopt-i"><summary>
        <span class="so-nm">${esc(m.name)}</span>
        <span class="so-iv ${ivCls(m.atm_iv)}">IV ${n(m.atm_iv)}%</span>
        <span class="so-be">跨式 ±${n(m.straddle_pct)}% 回本</span><em>▾</em></summary>
        <div class="so-body">
          <div class="so-grid">
            <div><span>现价</span><b>${n(m.price, 2)}</b></div>
            <div><span>平值 IV</span><b>${n(m.atm_iv)}%</b></div>
            <div><span>跨式成本</span><b>${n(m.straddle_pct)}%</b></div>
            <div><span>回本 涨/跌</span><b>+${n(m.be_up)}% / −${n(m.be_dn)}%</b></div>
            <div><span>看跌溢价</span><b class="${m.skew >= 3 ? "dn" : m.skew <= -3 ? "up" : ""}">${sg(m.skew)}pt</b></div>
            <div><span>到期</span><b>${esc(m.exp)}（${m.dte}天）</b></div>
          </div>
          <div class="so-note">💡 ${esc(m.note)}</div>
          <div class="muted small">平值行权价 ${n(m.atm_k, 2)} · call ${n(m.call_mid, 2)} / put ${n(m.put_mid, 2)} · 报价 ${esc(String(m.quote_at || "").slice(5, 16))} · <a href="#/optsim">去模拟买卖 ›</a></div>
        </div></details>`).join("")}</div>
      <p class="muted small">IV＝市场预告的未来波动；跨式成本＝同时买平值 call+put、要涨跌多少才回本；看跌溢价（skew）越大＝买暴跌保险越贵、市场越紧张。都只作温度计，不预测涨跌。</p>`;
  }
  function page(J, SO) {
    const lab = J.lab || {}, tests = lab.tests || [], vrp = lab.vrp || {};
    const cards = (J.cards || []).map((c) => `<div class="ocard ${esc(c.cls)}"><div class="oh"><span>${c.flag}</span><b>${esc(c.title)}</b><span class="olvl">${esc(c.level)}</span><span class="muted small">${esc(c.d || "")}</span></div>
      <div class="oimp">→ ${esc(c.imp)}</div><div class="onum">${esc(c.line.replace(/^[^：]*：[^（]*/, "").replace(/→.*$/, "").trim().replace(/^（/, "").replace(/）$/, ""))}</div>
      <div class="otags">${(c.tags || []).map(([t, lv]) => `<span>${esc(t)}${lvTag(lv)}</span>`).join("")}</div>
      ${(c.why || []).length ? `<details class="ofold"><summary>还看了什么 ▸</summary><ul>${c.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></details>` : ""}</div>`).join("");
    const d = J.daily;
    const vu = vrp.us || {}, vc = vrp.cn50 || {};
    const use = [
      `<b>期权长期比之后真实波动贵</b>${lvTag(lab.vrp_lv || "检验中")}：美股 VIX 平均比之后实际波动高 ${n(vu.mean)} 点（${n(vu.pos, 0)}% 的日子），A股 50ETF 高 ${n(vc.mean)} 点。所以<b>不买期权当长期保险、不买认购追涨</b>（买方长期在付这笔溢价）；卖方占优，但平时小赚、出事一次亏很多（美股最差一天 ${sg(vu.worst, 0)} 点，${esc(vu.worst_d || "")}）。`,
      `<b>唯一部分成立的做法</b>${lvTag("⚠️")}：纳指在 200 日线下 + VIX 恐慌时，卖 TQQQ 约 −15% 的现金担保认沽，赚一半就买回、收盘跌破行权价第二天买回（<a href="#/labs/options">验真 ›</a>）。` +
        (d ? `最新一期（${esc(String(d.date || "").replace(/(\d{4})(\d\d)(\d\d)/, "$2-$3"))}）条件${d.trigger ? "<b>已触发</b>" : "没触发"}；具体做不做、做哪张，看每晚 21:00 美股报告里的「🧾 期权」一行（会按可用现金判断押不押得起）。` : ""),
      `<b>不靠这些猜方向</b>：PCR、SKEW、VIX / QVIX 高低位、期限倒挂、最大痛点、持仓墙、GEX——检验下来对之后涨跌${tests.some((t) => t.lv === "✅") ? "大多" : "都"}没有可靠预测力，只当温度计看「接下来波动大不大、期权贵不贵」。`,
      `<b>A股期权（50ETF / 300ETF 等）个人开户门槛</b>：申请前 20 个交易日日均证券 + 资金 ≥ <b>50 万元</b>（同一家券商托管）、证券账户满 6 个月且有融资融券资格或金融期货交易经历、通过交易所认可的期权知识测试、有期权模拟交易经历、风险承受能力达标（上交所适当性管理指引第七条）。股指期权（中金所 IO / MO / HO）另有：开户前连续 5 个交易日保证金账户可用资金 ≥ 50 万、10 个交易日 20 笔仿真交易等。<b>老大目前不满足资金条件（需核实）</b>，A股这部分只看不做。`,
    ];
    const cn = J.cn || {}, us = J.us || {};
    const walls = (us.rows || []).filter((r) => r.walls).map(wallCard).join("");
    const labRows = tests.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.cname)}</td><td>${t.n} 天（${t.ep} 段）</td><td>${sg(t.diff, 2)}%</td><td>${n(t.t, 1)}</td><td>${lvTag(t.lv)}</td></tr>`).join("");
    const labMob = tests.map((t) => `<div class="orow"><div class="o1"><b>${esc(t.name)}</b>${lvTag(t.lv)}</div><div class="o2">→ ${esc(t.cname)} 之后 20 天比平常 <b>${sg(t.diff, 2)}%</b>（t=${n(t.t, 1)}，${t.n} 天 / ${t.ep} 段）</div></div>`).join("");
    const pro = (J.pro || []).map((p) => `<div class="pi"><b>${esc(p.name)}</b>${lvTag(p.lv)}<div>白话：${esc(p.plain)}</div><div>专业人员怎么用：${esc(p.how)}</div><div>数据：${esc(p.data)}；检验：${esc(p.test)}</div></div>`).join("");
    return `<h1>🌡 期权研究</h1>
      <p class="muted small">A股、美股期权市场每天的「温度」。${esc(J.built || "")} 更新｜结论只用检验过的信号，其余标「只作温度计」｜<a href="#/labs/options_signals">检验报告 ›</a></p>
      <div class="ocards">${cards}</div>
      ${stockOptCards(SO)}
      <h2>我能怎么用</h2><ol class="ouse">${use.map((u) => `<li>${u}</li>`).join("")}</ol>
      <h2>A股期权品种 <span class="muted small">${esc((cn.m && cn.m.pcr_d) || "")}${cn.ev ? `｜下一个大事：${esc(cn.ev.date.slice(5))}${cn.ev.tbd ? "（待定）" : ""} ${esc(shortEv(cn.ev.title))}` : ""}</span></h2>${table(cn.rows || [], "cn")}
      <h2>美股期权品种 <span class="muted small">CBOE 延迟报价${us.ev ? `｜下一个大事：${esc(us.ev.date.slice(5))} ${esc(shortEv(us.ev.title))}` : ""}</span></h2>${table(us.rows || [], "us")}
      <h2>QQQ / SPY：最大痛点、持仓墙、GEX <span class="muted small">未经检验</span></h2><div class="owall">${walls || '<div class="card muted">今天没取到期权链</div>'}</div>
      <h2>信号检验：之后 20 天比平常多涨还是少涨 <a class="h2a" href="#/labs/options_signals">报告 ›</a></h2>
      <div class="dk"><table class="tbl"><tr><th>信号</th><th>标的</th><th>出现</th><th>之后 20 天比平常</th><th>t（已修正重叠）</th><th>判定</th></tr>${labRows}</table></div><div class="mb olist">${labMob}</div>
      <p class="muted small">一共 ${lab.ntest || "—"} 次检验，|t| ≥ 3.3 才过多重比较门槛（✅）；t ≥ 2 且前后两段同向记 ⚠️；其余 ❌。</p>
      <details class="ofold"><summary>专业人员看的指标（白话解释 + 我们的检验结果）▸</summary><div class="card pro">${pro}</div></details>
      <details class="ofold"><summary>表格怎么读 ▸</summary><ul>
        <li><b>IV（隐含波动率）</b>：期权价格倒推出来的「市场预计未来一个月年化波动多大」。A股上交所品种用上交所每日希腊值算的 30 天平值隐波；深交所品种没有免费隐波，用同指数的 QVIX 代替（标 ≈）；中金所股指期权用近月平值期权价自己反推（标 ≈）；美股用 CBOE 的 30 天 IV。</li>
        <li><b>IV 分位</b>：现在的 IV 在近 1 年里排第几。SPY / QQQ / IWM 用 VIX / VXN / RVX 指数；NVDA、TQQQ、SOXL 没有现成历史，从今天起每天攒，满 60 天才显示。</li>
        <li><b>HV20</b>：过去 20 个交易日真实涨跌算出来的年化波动。<b>IV−HV</b> 为正 = 期权比最近实际波动贵。</li>
        <li><b>PCR</b>：认沽（看跌）÷ 认购（看涨），先成交量后持仓量。A股取交易所当天统计；美股取该标的全部期权链合计。</li>
        <li><b>期限结构</b>：近月 ÷ 远月隐波。&gt;1.03 叫倒挂（近月更贵 = 眼前紧张），&lt;0.97 正常。</li>
        <li><b>偏度</b>：约一个月到期、同样「虚」（25 Delta）的认沽隐波 − 认购隐波，单位是波动点；越大 = 买暴跌保险越贵。</li>
        <li><b>下一个大事前预期波动</b>：美股 = 大事后第一个到期日的平值认购 + 平值认沽价格 ÷ 现价（期权给出的「到那天大概涨跌多少」）；A股 = 隐波 × √(天数/365) 折算的 1 倍标准差。</li>
        <li><b>最大痛点 / 持仓墙 / GEX</b>：只能用当天期权链算，没有历史，没法检验；GEX 按「做市商买了认购、卖了认沽」的通行假设（认购算正、认沽算负），实际持仓方向没人知道。</li>
      </ul></details>
      <details class="ofold"><summary>调研来源 ▸</summary><ol class="src">${(J.sources || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details>
      ${A.DISC || ""}`;
  }

  window.__mod_opt = {
    async page() {
      const app = document.getElementById("app");
      document.title = "期权研究 · 小七投研";
      const tok = A.tok();
      app.innerHTML = `<h1>🌡 期权研究</h1>${A.LOADING ? A.LOADING() : ""}`;
      try {
        const [J, SO] = await Promise.all([A.getJSON("opt.json", true), A.getJSON("stockopt.json", true).catch(() => null)]);
        if (!A.alive(tok)) return;
        app.innerHTML = `<a class="card" href="#/optsim" style="display:flex;align-items:center;gap:10px;margin:0 0 10px;border-left:5px solid #c81e1e;text-decoration:none;color:inherit">
          <b style="font-size:16px">🎲 期权模拟</b><span class="muted" style="flex:1">给一段历史 K 线，自己买 call / put / 跨式，逐日推进看盈亏；也能算今天真实买一套要多少钱</span><em style="font-style:normal;color:var(--brand)">›</em></a>
          <div class="opt">${page(J, SO)}</div>`;
      } catch (e) {
        if (A.alive(tok)) app.innerHTML = "<h1>🌡 期权研究</h1><div class='card muted'>期权数据暂未生成（运行 options_research.py --date 今天 后发布）。</div>";
      }
    }
  };
})();
