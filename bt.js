/* 回测中心（按需加载）：#/backtest/<cn|us>            单独看（排行榜）
                         #/backtest/<cn|us>/combo      结合看（单独vs结合 / 四象限 / 投票 / 两两组合 / 两面法 / 系统仓位）
                         #/backtest/<cn|us>/i/<指标>   单个指标详情
   数据：backtest_cn.json / backtest_us.json（backtest.py 生成），详情页再取 backtest_*_curves.json。结论文字全部由数据生成。 */
(function () {
  const A = window.__APP;
  const { app, $, $$, esc, fmt, pct, sg, LOADING, FAIL, DISC, getJSON, need, mk, C, axisStyle, expand } = A;
  const MKN = { cn: "A股", us: "美股" };
  const RED = "#e5484d", GREEN = "#2fa86b", GRAY = "#9aa1ab", INK = "#1f2328";
  const col = (v) => (v == null ? GRAY : v > 0 ? RED : v < 0 ? GREEN : GRAY);
  const ud = (v) => (v > 0 ? "up" : v < 0 ? "dn" : "");
  const catOf = (c) => (/^基本面/.test(c) ? "基本面" : /^情绪/.test(c) ? "情绪" : /^技术/.test(c) ? "技术面" : "其他");
  const halves = (x) => [x.halves.early.buy_ex, x.halves.late.buy_ex];
  const minHalf = (x) => { const [e, l] = halves(x); return e == null || l == null ? -99 : Math.min(e, l); };
  const same = (e, l) => (e == null || l == null ? null : (e > 0) === (l > 0));
  const okMark = (e, l) => { const s = same(e, l); return s === null ? '<span class="muted">半段样本不足</span>' : s ? '<span class="ok">✓ 一致</span>' : '<span class="no">✗ 不一致</span>'; };
  const zoneTag = (z) => `<span class="zt ${z === "买入区" ? "zb" : z === "卖出区" ? "zs" : "zm"}">今日 ${esc(z)}</span>`;
  const vb = (x) => `<span class="vb ${x.cls}">${esc(x.verdict)}</span>`;
  const shortN = (n) => String(n).replace(/^中证/, "").replace("新高新低强度", "新高新低").replace("McClellan广度", "McClellan");
  const href = (mkt, n) => `#/backtest/${mkt}/i/${encodeURIComponent(n)}`;
  let io = null, DRAW = {};

  // ---------------- 自动结论 ----------------
  function conclusions(d) {
    const I = d.indicators, c = d.combo || {}, mk = MKN[d.market], out = [];
    const qs = (c.quads || []).filter((q) => q.ex20 != null);
    const st = (q) => q.early > 0 && q.late > 0;
    const bq = qs.filter(st).sort((a, b) => b.ex20 - a.ex20)[0] || qs.slice().sort((a, b) => b.ex20 - a.ex20)[0];
    const scored = I.filter((x) => x.group !== "参考组" && x.buy_ex != null && x.episodes >= 5).sort((a, b) => b.buy_ex - a.buy_ex);
    const bs = scored[0];
    if (bq) {
      const half = st(bq) ? `前后半段都成立（${sg(bq.early)} / ${sg(bq.late)}）` : `但前后半段不一致（${sg(bq.early)} / ${sg(bq.late)}）`;
      let t = bs && bq.ex20 > bs.buy_ex
        ? `<b>${mk}：结合看（四象限）比任何一个打分指标单独看都${bq.ex20 >= bs.buy_ex * 1.5 && bq.ex20 - bs.buy_ex >= 1 ? "强得多" : bq.ex20 - bs.buy_ex < 0.3 ? "略强一点（差距不大）" : "强一些"}</b>：${esc(bq.k)}之后 20 个交易日平均超额 <b class="${ud(bq.ex20)}">${sg(bq.ex20)} 个点</b>、胜率 ${fmt(bq.s[20].win, 0)}%，${half}；单独看最好的${esc(bs.name)}是 ${sg(bs.buy_ex)}。`
        : `<b>${mk}：结合看没有明显优势</b>：四象限里最好的${esc(bq.k)}后 20 日超额 ${sg(bq.ex20)} 个点，${half}；单个指标${bs ? esc(bs.name) + "（" + sg(bs.buy_ex) + "）" : ""}更高。`;
      const hiQ = qs.filter((q) => q !== bq && !st(q) && q.ex20 > bq.ex20).sort((a, b) => b.ex20 - a.ex20)[0];
      if (hiQ) t += `（${esc(hiQ.k)}超额更高 ${sg(hiQ.ex20)}，但前后半段不一致 ${sg(hiQ.early)} / ${sg(hiQ.late)}，只有 ${hiQ.episodes} 次独立信号）`;
      const ref = I.filter((x) => x.group === "参考组" && x.buy_ex != null && x.buy_ex > bq.ex20);
      if (ref.length) t += `（参考组的${ref.map((x) => `${esc(x.name)}更高 ${sg(x.buy_ex)}，但只有 ${x.episodes} 次独立信号`).join("、")}，不参与打分，别单靠它）`;
      out.push(t);
    }
    const stable = I.filter((x) => x.cls === "good" && x.episodes >= 5).sort((a, b) => minHalf(b) - minHalf(a)).slice(0, 3);
    if (stable.length) {
      const weak = Math.max(...stable.map((x) => x.buy_ex)) < 1;
      out.push(`<b>单个指标里最稳的</b>是 ${stable.map((x) => `<a href="${href(d.market, x.name)}">${esc(x.name)}</a>（${x.group === "参考组" ? "参考组，" : ""}${sg(x.buy_ex)}）`).join("、")}：前后半段都有效、独立信号 ≥5 次${weak ? "，但超额都不到 1 个点，作用有限" : ""}。`);
    } else out.push("<b>没有一个单独指标</b>能做到前后半段都有效且信号够多——单看哪一个都不靠谱。");
    const none = I.filter((x) => x.verdict === "无明显作用"), rev = I.filter((x) => x.verdict === "反向"), warn = I.filter((x) => x.cls === "warn");
    const nm = (xs) => xs.map((x) => `<a href="${href(d.market, x.name)}">${esc(x.name)}</a>`).join("、");
    const parts = [];
    if (none.length) parts.push(`<b>无效的</b>：${nm(none)}（买入区后和平时差不多，建议降权 / 仅作参考）`);
    if (rev.length) parts.push(`<b>反向的</b>：${nm(rev)}（买入区后反而跑输）`);
    if (warn.length) parts.push(`<b>时灵时不灵</b>：${nm(warn)}（只有一段时间有效或样本太少）`);
    if (parts.length) out.push(parts.join("；") + "。");
    const S = c.system || {}, rows = S.rows || [];
    const sy = rows.find((r) => /系统/.test(r.k)) || rows[0], bh = rows.find((r) => r.k === "满仓持有");
    if (sy && bh) {
      const best = rows.filter((r) => r.k !== "满仓持有").sort((a, b) => b.ann - a.ann)[0];
      let t = sy.ann > bh.ann
        ? `<b>系统仓位</b>（四象限 × 两面法，两者取小）：年化 <b class="up">${fmt(sy.ann, 1)}%</b> / 最大回撤 ${fmt(sy.mdd, 1)}%；同样平均仓位（${fmt(sy.exposure, 0)}%）的固定持有只有 ${fmt(sy.const_ann, 1)}% / ${fmt(sy.const_mdd, 1)}%，满仓持有 ${fmt(bh.ann, 1)}% / ${fmt(bh.mdd, 1)}%。`
        : `<b>${mk}：系统跑输满仓持有</b>（年化 ${fmt(sy.ann, 1)}% vs ${fmt(bh.ann, 1)}%）${bh.ann >= 8 ? "，长牛市场择时代价大" : ""}；好处是最大回撤从 ${fmt(bh.mdd, 1)}% 降到 ${fmt(sy.mdd, 1)}%${sy.const_ann != null && sy.ann < sy.const_ann ? `，但也不如同样 ${fmt(sy.exposure, 0)}% 平均仓位的固定持有（${fmt(sy.const_ann, 1)}%）` : ""}。`;
      if (best && best !== sy && best.ann > sy.ann + 0.3) t += `单用${esc(best.k)}更好：年化 ${fmt(best.ann, 1)}% / 回撤 ${fmt(best.mdd, 1)}%。`;
      out.push(t);
    }
    const tq = c.today && c.today.quad, qr = (c.quads || []).find((q) => q.k === tq);
    if (qr) {
      const sc = I.filter((x) => x.group !== "参考组"), nb = sc.filter((x) => x.today_zone === "买入区").length, ns = sc.filter((x) => x.today_zone === "卖出区").length;
      out.push(`<b>今天在${esc(tq)}</b>（抄底分 ${fmt(c.today.y)} / 趋势分 ${fmt(c.today.x)}）：历史上这个象限后 20 日平均 ${pct(qr.s[20].mean, 1)}、超额 ${sg(qr.ex20)} 个点；打分的 ${sc.length} 个指标里 ${nb} 个在买入区、${ns} 个在卖出区${c.votes_today ? `（净票 ${esc(c.votes_today)}）` : ""}。`);
    }
    return out;
  }

  function explain(d) {
    return `<details class="card bthow"><summary>📖 怎么看这页（口径说明，第一次看先点开）</summary><ul>
      <li><b>买入区 / 卖出区</b>：每个指标按看板同一套规则打 −1～+1 分，<b>≥0.5 = 买入区</b>，≤−0.5 = 卖出区，中间 = 中性。趋势组已经把方向统一成「分高 = 好」。</li>
      <li><b>看什么</b>：进入买入区之后，${esc(d.index)}未来 20 个交易日（约 1 个月）平均涨多少、上涨的概率（胜率）多少。也给了 5 日、60 日。</li>
      <li><b>超额（个点）</b>= 买入区的平均涨幅 − 同一段时间所有日子的平均涨幅。+2 就是「比随便哪天买多赚 2 个百分点」。这样比较公平：牛市里什么时候买都涨。</li>
      <li><b>独立次数</b>：连续好多天都在买入区只算 1 次（两次间隔不到 20 个交易日就合并）。<b>少于 5 次的结论看看就好</b>，可能是运气。</li>
      <li><b>前后半段</b>：把每个指标的历史切成两半各算一次超额，<b>两段都为正才算「稳定」</b>；只有一段好，多半是那几年碰巧。</li>
      <li><b>结论徽章</b>：<span class="vb good">有效·稳定</span> 超额 ≥0.5 且两段都正；<span class="vb warn">有效·不稳定</span> 超额 ≥0.5 但只有一段；<span class="vb gray">无明显作用</span> 超额在 ±0.5 内；<span class="vb bad">反向</span> 买入区后反而更差；样本少 = 独立信号 &lt;3 次。</li>
      <li><b>策略净值</b>：出买入信号次日买入、持有 20 个交易日（期间再出信号就顺延），出卖出信号提前卖；单边成本 0.05%。和「一直满仓拿着」比。</li>
      <li><b>注意：这是样本内结果，会偏乐观。</b>指标分组方向和阈值是用同一段历史定的，未来大概率要打折扣；前后半段一致是最起码的检验。</li></ul></details>`;
  }

  function head(d, mkt, tab) {
    const I = d.indicators, since = I.map((x) => x.since).sort()[0] || "";
    const sw = (m) => `<a class="chip ${m === mkt ? "on" : ""}" href="#/backtest/${m}${tab === "combo" ? "/combo" : ""}">${m === "cn" ? "🇨🇳 A股" : "🇺🇸 美股"}</a>`;
    return `<h1>回测中心 <span class="muted small">指标到底灵不灵</span></h1>
      <div class="chips">${sw("cn")}${sw("us")}</div>
      <div class="muted small">标的：${esc(d.index)}（信号出现后 5 / 20 / 60 个交易日涨跌）｜数据 ${esc(since.slice(0, 7))} 至 ${esc(d.data_to)}｜生成 ${esc(d.built || "")}</div>
      <div class="card btsum"><div class="bth">📌 结论 <span class="muted small">由回测数据自动生成，每天更新</span></div><ol>${conclusions(d).map((t) => `<li>${t}</li>`).join("")}</ol></div>
      ${explain(d)}
      <a class="card" href="stock/#/picks/${mkt}" style="display:block;text-decoration:none;color:inherit">🎯 <b>选股组合回测（个股层面）→</b>
        <div class="muted small">这里回测的是「大盘指标」择时；个股层面的多因子选股（因子 IC、样本外组合净值、扣成本超额、退出规则对比、今日买入候选）在个股透视的「买卖点」页。</div></a>
      <div class="tabs"><a class="${tab !== "combo" ? "on" : ""}" href="#/backtest/${mkt}">单独看<em>${I.length} 个指标排行</em></a><a class="${tab === "combo" ? "on" : ""}" href="#/backtest/${mkt}/combo">结合看<em>四象限·投票·组合·系统</em></a></div>`;
  }

  // ---------------- 单独看 ----------------
  const F = { g: "", c: "", sort: "" };
  function singleList(d) {
    const mkt = d.market;
    let xs = d.indicators.filter((x) => (!F.g || x.group === F.g) && (!F.c || catOf(x.cat) === F.c));
    const key = { ex: (x) => x.buy_ex ?? -99, win: (x) => (x.buy[20].win ?? -99), stable: minHalf }[F.sort];
    if (key) xs = xs.slice().sort((a, b) => key(b) - key(a));
    const S = Math.max(2, ...d.indicators.map((x) => Math.abs(x.buy_ex || 0)));
    return xs.map((x) => {
      const b = x.buy[20], [e, l] = halves(x), w = Math.min(50, (Math.abs(x.buy_ex || 0) / S) * 50);
      return `<a class="btr ${x.cls}" href="${href(mkt, x.name)}">
        <div class="btr1"><b>${esc(x.name)}</b><span class="ctag">${esc(x.cat)}</span><span class="gtag">${esc(x.group)}</span>${vb(x)}</div>
        <div class="btr2">${zoneTag(x.today_zone)}<span>买入区后20日 <b class="${ud(b.mean)}">${pct(b.mean, 1)}</b> · 胜率 <b>${fmt(b.win, 0)}%</b></span></div>
        <div class="btr3"><span class="lab">超额</span><span class="exbar"><i class="${(x.buy_ex || 0) >= 0 ? "p" : "n"}" style="${(x.buy_ex || 0) >= 0 ? `left:50%` : `left:${50 - w}%`};width:${w}%"></i></span><b class="${ud(x.buy_ex)}">${sg(x.buy_ex)}</b></div>
        <div class="btr4">独立 <b>${x.episodes}</b> 次${x.episodes < 5 ? "（少）" : ""} · 前/后半段 ${sg(e)} / ${sg(l)} ${okMark(e, l)}</div></a>`;
    }).join("") || '<div class="card muted">没有符合条件的指标</div>';
  }
  function single(d, mkt) {
    document.title = `回测中心 · ${MKN[mkt]} · 小七投研`;
    const chip = (k, v, n) => `<a class="chip ${F[k] === v ? "on" : ""}" data-f="${k}" data-v="${v}">${n}</a>`;
    app.innerHTML = `${head(d, mkt, "single")}
      <div class="btf"><div class="chips scroll">${chip("g", "", "全部组")}${chip("g", "抄底组", "抄底组")}${chip("g", "趋势组", "趋势组")}${chip("g", "参考组", "参考组")}</div>
        <div class="chips scroll">${chip("c", "", "全部类别")}${chip("c", "基本面", "基本面")}${chip("c", "情绪", "情绪")}${chip("c", "技术面", "技术面")}</div>
        <div class="chips scroll"><span class="muted small">排序</span>${chip("sort", "", "按组")}${chip("sort", "ex", "超额高→低")}${chip("sort", "win", "胜率")}${chip("sort", "stable", "最稳")}</div></div>
      <p class="muted small">超额条：<span class="up">红 = 买入区后比平时多涨</span>，<span class="dn">绿 = 反而少涨</span>；点一行看详情（5/20/60 日对比、前后半段、策略净值）。</p>
      <div id="btl" class="btl">${singleList(d)}</div>${DISC}`;
    app.onclick = (e) => {
      const a = e.target.closest("[data-f]");
      if (!a) return;
      e.preventDefault();
      F[a.dataset.f] = a.dataset.v;
      $$(`[data-f="${a.dataset.f}"]`).forEach((x) => x.classList.toggle("on", x.dataset.v === a.dataset.v));
      $("#btl").innerHTML = singleList(d);
    };
  }

  // ---------------- 单个指标详情 ----------------
  async function detail(d, mkt, name, tok) {
    const I = d.indicators, i = I.findIndex((x) => x.name === name), x = I[i];
    if (!x) return single(d, mkt);
    document.title = `${name} · 回测中心 · 小七投研`;
    const b = x.buy[20], bs = x.base[20], [e, l] = halves(x), H = x.halves, s = x.strat || {}, bh = x.bh || {};
    const yrs = s.years || ((new Date(d.data_to) - new Date(x.since)) / 3.156e10).toFixed(1);
    const said = `过去约 ${fmt(yrs, 1)} 年（${esc(x.since.slice(0, 7))} 起），${esc(name)}进入买入区的日子占 ${fmt(x.buy_days_pct, 0)}%，算下来是 <b>${x.episodes} 次独立信号</b>。
      买入区之后 20 个交易日，${esc(d.index)}平均 <b class="${ud(b.mean)}">${pct(b.mean, 2)}</b>，比所有日子的平均（${pct(bs.mean, 2)}）${x.buy_ex >= 0 ? "多" : "少"} <b>${fmt(Math.abs(x.buy_ex ?? 0), 2)} 个点</b>，胜率 ${fmt(b.win, 0)}%；
      前半段 ${sg(e)}、后半段 ${sg(l)}，${same(e, l) === null ? "有一段没有信号，没法检验稳定性" : same(e, l) ? "两段方向一致" : "两段方向相反"} → <b>${esc(x.verdict)}</b>。${x.episodes < 5 ? "独立信号不到 5 次，结论参考价值有限。" : ""}`;
    const S = Math.max(1, Math.abs(e || 0), Math.abs(l || 0));
    const hb = (lab, h) => `<div class="hbr"><span>${lab}<em>${esc(h.from)}～${esc(h.to)} · ${h.n} 天</em></span><span class="exbar"><i class="${(h.buy_ex || 0) >= 0 ? "p" : "n"}" style="${(h.buy_ex || 0) >= 0 ? "left:50%" : `left:${50 - Math.min(50, Math.abs(h.buy_ex || 0) / S * 50)}%`};width:${Math.min(50, Math.abs(h.buy_ex || 0) / S * 50)}%"></i></span><b class="${ud(h.buy_ex)}">${sg(h.buy_ex)}</b></div>`;
    const prev = I[i - 1], next = I[i + 1];
    const kp = (k, v, cls = "", sub = "") => `<div><span>${k}</span><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
    app.innerHTML = `<div class="crumb"><a href="#/backtest/${mkt}">回测中心</a> / ${MKN[mkt]} / ${esc(x.group)}</div>
      <h1>${esc(name)} <span class="ctag">${esc(x.cat)}</span> ${vb(x)}</h1>
      <div class="one">${said}</div>
      <div class="btr2">${zoneTag(x.today_zone)}<span class="muted small">今日打分 ${fmt(x.today, 2)}（≥0.5 买入区，≤−0.5 卖出区）</span></div>
      <div class="kpis k4">${kp("20日超额", sg(x.buy_ex) + " 点", ud(x.buy_ex), "买入区 − 平时")}${kp("买入区胜率", fmt(b.win, 0) + "%", "", `平时 ${fmt(bs.win, 0)}%`)}${kp("独立信号", x.episodes + " 次", "", `卖出信号 ${x.sell_episodes} 次`)}
        ${kp("60日超额", sg(x.buy_ex60) + " 点", ud(x.buy_ex60), "看得更长")}${x.sell_ex == null ? kp("卖出区超额", "—", "", "没有卖出信号") : kp("卖出区超额", sg(x.sell_ex) + " 点", ud(x.sell_ex), "负 = 卖出信号有用")}${kp("相关性 IC", fmt(x.ic, 3), "", "周频秩相关，>0.05 才算有点用")}</div>
      <h2>买入区 / 中性 / 卖出区 / 平时：之后平均涨多少</h2>
      <div class="card chartcard"><div id="bt1" class="chart sm"></div><div class="note">柱子 = 信号出现后 5 / 20 / 60 个交易日 ${esc(d.index)} 的平均涨跌；点柱子看胜率和天数。买入区柱子比「全部日子」高才说明指标有用。</div></div>
      <h2>前后半段：是不是一直有效 ${okMark(e, l)}</h2>
      <div class="card">${hb("前半段", H.early)}${hb("后半段", H.late)}<div class="note">两段都为正（红）才算稳定。只有一段好，多半是那几年碰巧。</div></div>
      <h2>按信号操作 vs 一直满仓</h2>
      <div class="card chartcard"><div id="bt2" class="chart"></div><div class="note">红线 = 出买入信号就买、拿 20 个交易日（出卖出信号提前卖）；灰线 = 一直满仓拿着 ${esc(d.index)}；下方红色色块 = 处在买入区的周。周频，从 1 开始。</div></div>
      <div class="tablewrap"><table class="tbl"><tr><th></th><th>年化</th><th>最大回撤</th><th>夏普</th><th>平均仓位</th><th>总收益</th></tr>
        <tr><td><b>按信号</b></td><td class="${ud(s.ann)}">${fmt(s.ann, 1)}%</td><td>${fmt(s.mdd, 1)}%</td><td>${fmt(s.sharpe)}</td><td>${fmt(s.exposure, 0)}%</td><td class="${ud(s.total)}">${pct(s.total, 0)}</td></tr>
        <tr><td>满仓持有</td><td class="${ud(bh.ann)}">${fmt(bh.ann, 1)}%</td><td>${fmt(bh.mdd, 1)}%</td><td>${fmt(bh.sharpe)}</td><td>100%</td><td class="${ud(bh.total)}">${pct(bh.total, 0)}</td></tr></table></div>
      <p class="muted small">仓位低（只有 ${fmt(s.exposure, 0)}% 的时间在场）却${s.ann > bh.ann ? "年化更高" : "年化更低"}、回撤${s.mdd > bh.mdd ? "更小" : "更大"}。单指标策略只是检验工具，实际仓位看「结合看」里的系统仓位。</p>
      ${x.lesson ? `<a class="card item" href="#/lesson/${x.lesson}">📚 去学堂看这个指标怎么读、买卖区怎么定 ›</a>` : ""}
      <div class="pager">${prev ? `<a href="${href(mkt, prev.name)}">← ${esc(prev.name)}</a>` : "<span></span>"}${next ? `<a href="${href(mkt, next.name)}" class="next">${esc(next.name)} →</a>` : ""}</div>
      <p class="muted small"><a href="#/backtest/${mkt}">‹ 回到排行榜</a>　<a href="#/backtest/${mkt}/combo">看结合看 ›</a></p>${DISC}`;
    try { await need("lib"); } catch (err) { $("#bt1").innerHTML = '<div class="empty">画图组件加载失败，刷新重试</div>'; return; }
    if (!A.alive(tok)) return;
    drawHorizon($("#bt1"), x, d);
    getJSON(`backtest_${mkt}_curves.json`, true).then((CV) => { if (A.alive(tok)) { if (CV[name]) drawEquity($("#bt2"), CV[name], d); else $("#bt2").innerHTML = '<div class="empty">暂无净值数据</div>'; } })
      .catch(() => { if (A.alive(tok)) $("#bt2").innerHTML = '<div class="empty">净值曲线加载失败</div>'; });
  }
  const legendS = () => ({ top: 0, textStyle: { color: C().sub, fontSize: 11 }, itemWidth: 14, itemHeight: 8 });
  function drawHorizon(el, x, d) {
    const c = C(), H = ["5", "20", "60"];
    const ser = [["买入区", x.buy, RED], ["中性", x.neutral, "#c3c8cf"], ["卖出区", x.sell, GREEN], ["全部日子", x.base, "#5b6b82"]];
    mk(el).setOption({
      animation: false, grid: { left: 42, right: 8, top: 34, bottom: 26 }, legend: legendS(),
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps) => ps[0].axisValue + "<br>" + ps.map((p) => `${p.marker}${p.seriesName}：${p.data.value == null ? "无信号" : `${pct(p.data.value, 2)}，胜率 ${fmt(p.data.win, 0)}%（${p.data.n} 天）`}`).join("<br>") },
      xAxis: { type: "category", data: ["5日后", "20日后", "60日后"], ...axisStyle(), splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle(), axisLabel: { color: c.sub, fontSize: 10, formatter: "{value}%" } },
      series: ser.map(([n, s, color]) => ({ name: n, type: "bar", barMaxWidth: 18, barGap: "12%", itemStyle: { color },
        label: { show: true, position: "top", fontSize: 9, color: c.sub, formatter: (p) => (p.data.value == null ? "" : fmt(p.data.value, 1)) },
        data: H.map((h) => ({ value: s[h] && s[h].n ? s[h].mean : null, win: s[h] && s[h].win, n: s[h] && s[h].n })) })),
    });
  }
  function drawEquity(el, cv, d) {
    const X = expand(cv), [st, bh, buy] = X.s, c = C();
    mk(el).setOption({
      animation: false, legend: { ...legendS(), data: ["按信号操作", "满仓持有"] }, axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: { trigger: "axis", formatter: (ps) => ps[0].axisValue + "<br>" + ps.filter((p) => p.seriesName !== "买入区").map((p) => `${p.marker}${p.seriesName}：${fmt(p.value, 3)}`).join("<br>") + (buy[ps[0].dataIndex] ? '<br><span style="color:#e5484d">● 处在买入区</span>' : "") },
      grid: [{ left: 44, right: 10, top: 28, bottom: 62 }, { left: 44, right: 10, height: 14, bottom: 26 }],
      xAxis: [{ type: "category", data: X.d, ...axisStyle(), splitLine: { show: false }, axisLabel: { show: false } },
        { type: "category", gridIndex: 1, data: X.d, ...axisStyle(), splitLine: { show: false }, axisTick: { show: false } }],
      yAxis: [{ type: "value", scale: true, ...axisStyle() }, { type: "value", gridIndex: 1, min: 0, max: 1, show: false }],
      series: [{ name: "按信号操作", type: "line", data: st, showSymbol: false, lineStyle: { color: RED, width: 1.6 }, itemStyle: { color: RED } },
        { name: "满仓持有", type: "line", data: bh, showSymbol: false, lineStyle: { color: GRAY, width: 1.2 }, itemStyle: { color: GRAY } },
        { name: "买入区", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: buy, barWidth: "100%", barCategoryGap: 0, itemStyle: { color: "rgba(229,72,77,0.6)" }, silent: true }],
      dataZoom: [{ type: "inside", xAxisIndex: [0, 1] }],
    });
  }

  // ---------------- 结合看 ----------------
  function combo(d, mkt, tok) {
    document.title = `结合看 · 回测中心 · ${MKN[mkt]} · 小七投研`;
    const c = d.combo || {}, I = d.indicators, tq = c.today && c.today.quad;
    const ax = c.axes || [], qs = c.quads || [];
    const bs = I.filter((x) => x.group !== "参考组" && x.buy_ex != null && x.episodes >= 5).sort((a, b) => b.buy_ex - a.buy_ex)[0];
    const q1 = qs[0], ay = ax[0];
    const qrow = (q) => `<tr class="${q.k === tq ? "now" : ""}"><td><b>${esc(q.k)}</b>${q.k === tq ? ' <span class="nowtag">今天</span>' : ""}</td><td>${q.days}<span class="muted small">（${fmt(q.pct_days, 0)}%）</span></td><td>${q.episodes}</td>
      <td class="${ud(q.s[20].mean)}">${pct(q.s[20].mean, 2)}</td><td>${fmt(q.s[20].win, 0)}%</td><td class="${ud(q.ex20)}"><b>${sg(q.ex20)}</b></td><td>${sg(q.early)} / ${sg(q.late)} ${okMark(q.early, q.late)}</td></tr>`;
    const v = c.votes || [], vt = c.votes_today, pos = v.filter((r) => /^\+[1-9]|^≥/.test(r.k)), neg = v.filter((r) => /^-|^≤/.test(r.k));
    const avg = (xs) => { const w = xs.reduce((a, r) => a + r.days, 0); return w ? xs.reduce((a, r) => a + r.days * (r.s[20].mean || 0), 0) / w : null; };
    const mono = pos.every((r, k) => k === 0 || (r.s[20].mean ?? 0) >= (pos[k - 1].s[20].mean ?? 0));
    const vrow = v.find((r) => r.k === vt);
    const pb = c.pairs_best || [];
    const tw = c.twoside || {}, sys = c.system || {};
    const nScored = (c.pairs && c.pairs.names || []).length;
    app.innerHTML = `${head(d, mkt, "combo")}
      <p class="muted small">抄底分 = 抄底组指标打分的平均（高 = 便宜 / 恐慌）；趋势分 = 趋势组打分的平均（高 = 趋势转强）。四象限就是把两条轴<b>合起来看</b>。</p>
      <h2>a) 单独看 vs 结合看 <span class="muted small">20 日超额（个点）</span></h2>
      <div class="card chartcard"><div class="chart sm" data-draw="cmp"></div>
        <div class="note">${q1 && ay ? `同样是「抄底分高」，再按趋势分一拆：${esc(q1.k)}（抄底分高 且 趋势还弱）超额 <b class="${ud(q1.ex20)}">${sg(q1.ex20)}</b>，只看抄底分是 ${sg(ay.ex20)}，只看趋势分是 ${sg((ax[2] || {}).ex20)}${bs ? `；单个指标最好的${esc(bs.name)}是 ${sg(bs.buy_ex)}` : ""}。` : ""}</div></div>
      <h2>b) 四象限 <span class="muted small">${esc(c.since || "")} 起，前后半段以 ${esc(c.split || "")} 为界</span></h2>
      <div class="tablewrap"><table class="tbl bttbl"><tr><th>象限</th><th>天数</th><th>独立次数</th><th>后20日</th><th>胜率</th><th>超额</th><th>前/后半段超额</th></tr>${qs.map(qrow).join("")}</table></div>
      <p class="muted small">今天：<b>${esc(tq || "—")}</b>（抄底分 ${fmt(c.today && c.today.y)}，趋势分 ${fmt(c.today && c.today.x)}）。全部日子后 20 日平均 ${pct(c.base && c.base[20] && c.base[20].mean, 2)}。<a href="#/lesson/${mkt === "us" ? "quad-us" : "quad"}">四象限怎么用 ›</a></p>
      <h2>c) 投票：同时在买入区的指标越多越好吗？</h2>
      <div class="card chartcard"><div class="chart sm" data-draw="votes"></div>
        <div class="note">净票数 = 在买入区的指标个数 − 在卖出区的个数（抄底组 + 趋势组共 ${nScored} 个，至少 5 个有数据才算）。柱 = 后 20 日平均涨跌，线 = 胜率。
          净票为正的日子平均 ${pct(avg(pos), 2)}，为负的 ${pct(avg(neg), 2)}；${mono ? "票数越多越好，基本单调。" : "<b>但不是票越多越好</b>（不单调）——指标之间高度相关，简单数票会重复计算，所以体系里用四象限而不是数票。"}
          ${vrow ? `今天净票 <b>${esc(vt)}</b>，历史上这一档后 20 日平均 ${pct(vrow.s[20].mean, 2)}、胜率 ${fmt(vrow.s[20].win, 0)}%。` : ""}</div></div>
      <h2>d) 两两组合：哪两个一起出现最灵</h2>
      <div class="card chartcard"><div class="chart" data-draw="pairs" style="height:${Math.max(320, nScored * 27 + 110)}px"></div>
        <div class="note">格子 = 两个指标<b>同时</b>在买入区时，后 20 日超额（个点；红 = 好，绿 = 差）；对角线 = 单独一个。灰格 = 独立次数不到 3 次，不算。</div></div>
      ${pb.length ? `<div class="card pbl"><div class="bth">「1+1&gt;2」的组合（同时出现 ≥4 次，按超额排序）</div>${pb.map((p) => {
        const win = p.ex > Math.max(p.a_alone ?? -99, p.b_alone ?? -99);
        return `<div class="pbr"><div><b>${esc(p.a)} + ${esc(p.b)}</b>${win ? '<span class="vb good">1+1&gt;2</span>' : ""}</div>
          <div class="small">同时 ${p.n} 次 · 超额 <b class="${ud(p.ex)}">${sg(p.ex)}</b> · 胜率 ${fmt(p.win, 0)}%<span class="muted">｜单独：${esc(p.a)} ${sg(p.a_alone)}、${esc(p.b)} ${sg(p.b_alone)}</span></div></div>`;
      }).join("")}<div class="note">次数都不多（4～10 次），当作「两个一起亮灯时更值得重视」的提示，不要当成新规则。</div></div>` : ""}
      ${tw["技术面总结"] ? `<h2>e) 两面法：基本面 × 技术面 <span class="muted small">看 ${esc(d.ref)}，${esc(tw.since || "")} 起</span></h2>
        <div class="card chartcard"><div class="chart sm" data-draw="tech"></div><div class="note">只看技术面总结（一目云 + 布林 + KDJ + VWMACD）各档之后 20 日的超额。</div></div>
        <div class="card chartcard"><div class="chart" data-draw="matrix" style="height:330px"></div><div class="note">行 = 基本面总结，列 = 技术面总结；格子 = 后 20 日超额（个点），括号里是天数；灰格 = 不到 20 天，不算。</div></div>
        <details class="card"><summary>其他分档（基本面总结 / 轨道 / KDJ / MACD / 结论）</summary>${["基本面总结", "轨道趋势", "轨道内位置", "KDJ", "MACD", "结论"].filter((k) => tw[k]).map((k) => `<div class="tablewrap"><table class="tbl"><tr><th>${esc(k)}</th><th>天数</th><th>后20日</th><th>胜率</th><th>超额</th></tr>${tw[k].map((r) => `<tr><td>${esc(r.k)}</td><td>${r.days}</td><td class="${ud(r.s[20].mean)}">${pct(r.s[20].mean, 2)}</td><td>${fmt(r.s[20].win, 0)}%</td><td class="${ud(r.ex20)}">${sg(r.ex20)}</td></tr>`).join("")}</table></div>`).join("")}</details>` : ""}
      ${(sys.rows || []).length ? `<h2>f) 系统仓位：按体系定仓位，长期下来怎么样 <span class="muted small">${esc(sys.from || "")} 起</span></h2>
        <div class="tablewrap"><table class="tbl bttbl"><tr><th>方案</th><th>年化</th><th>最大回撤</th><th>夏普</th><th>平均仓位</th><th>同仓位固定持有<br>年化 / 回撤</th></tr>${sys.rows.map((r) => `<tr class="${/系统/.test(r.k) ? "now" : ""}"><td><b>${esc(r.k)}</b></td><td class="${ud(r.ann)}">${fmt(r.ann, 1)}%</td><td>${fmt(r.mdd, 1)}%</td><td>${fmt(r.sharpe)}</td><td>${fmt(r.exposure, 0)}%</td><td>${r.const_ann != null ? `${fmt(r.const_ann, 1)}% / ${fmt(r.const_mdd, 1)}%` : "—"}</td></tr>`).join("")}</table></div>
        <div class="card chartcard"><div class="chart tall" data-draw="sys"></div><div class="note">上：净值（从 1 开始）；下：回撤（离最高点跌了多少）。点图例可以打开 / 关掉某条线。「固定 x% 仓」= 一直拿着和系统同样平均仓位的${esc(d.index)}，用来区分「择时的功劳」和「仓位低的功劳」。</div></div>
        <p class="muted small">四象限仓位上限：①40% ②70% ③50% ④20%；两面法仓位上限见<a href="#/lesson/twoside">两面法</a>；系统 = 两者取小。</p>` : ""}
      ${DISC}`;
    DRAW = {
      cmp: (el) => drawCmp(el, d, bs), votes: (el) => drawVotes(el, c), pairs: (el) => drawPairs(el, c.pairs),
      tech: (el) => drawBuckets(el, tw["技术面总结"]), matrix: (el) => drawMatrix(el, tw.matrix), sys: (el) => drawSys(el, sys),
    };
    need("lib").then(() => { if (A.alive(tok)) lazy(tok); }).catch(() => { $$("[data-draw]").forEach((el) => (el.innerHTML = '<div class="empty">画图组件加载失败，刷新重试</div>')); });
  }
  function lazy(tok) {
    if (io) io.disconnect();
    const els = $$("[data-draw]");
    const go = (el) => {
      if (!A.alive(tok) || el.dataset.done) return;
      el.dataset.done = 1;
      try { DRAW[el.dataset.draw](el); } catch (e) { el.innerHTML = `<div class="empty">图表出错：${esc(e.message)}</div>`; console.error(e); }
    };
    if (!("IntersectionObserver" in window)) { els.forEach(go); return; }
    io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); go(e.target); } }), { rootMargin: "300px 0px" });
    els.forEach((el) => io.observe(el));
  }
  const barLabel = (c) => ({ show: true, position: "right", fontSize: 10, color: c.text, formatter: (p) => sg(p.value) });
  function hbars(el, rows, c, left = 124) {
    const h = Math.max(200, rows.length * 34 + 30);
    el.style.height = h + "px";
    mk(el).setOption({
      animation: false, grid: { left, right: 44, top: 8, bottom: 22 },
      tooltip: { trigger: "item", formatter: (p) => `${p.name}<br>20 日超额 ${sg(p.value)} 个点${p.data.sub ? "<br>" + p.data.sub : ""}` },
      xAxis: { type: "value", ...axisStyle(), axisLabel: { color: c.sub, fontSize: 10 } },
      yAxis: { type: "category", inverse: true, data: rows.map((r) => r.k), ...axisStyle(), axisLabel: { color: c.text, fontSize: 11, width: left - 8, overflow: "break" }, axisTick: { show: false } },
      series: [{ type: "bar", barMaxWidth: 18, label: barLabel(c), data: rows.map((r) => ({ value: r.v, sub: r.sub, itemStyle: { color: r.hi ? (r.v >= 0 ? RED : GREEN) : r.v >= 0 ? "rgba(229,72,77,0.55)" : "rgba(47,168,107,0.55)" } })) }],
    });
  }
  function drawCmp(el, d, bs) {
    const c = d.combo, ax = c.axes || [], rows = [];
    if (ax[0]) rows.push({ k: "只看抄底分（≥0.3）", v: ax[0].ex20, sub: `${ax[0].days} 天 / ${ax[0].episodes} 次` });
    if (ax[2]) rows.push({ k: "只看趋势分（≥0）", v: ax[2].ex20, sub: `${ax[2].days} 天 / ${ax[2].episodes} 次` });
    if (bs) rows.push({ k: `单个最好：${shortN(bs.name)}`, v: bs.buy_ex, sub: `${bs.episodes} 次` });
    (c.quads || []).forEach((q) => rows.push({ k: `结合：${q.k}`, v: q.ex20, hi: true, sub: `${q.days} 天 / ${q.episodes} 次，胜率 ${fmt(q.s[20].win, 0)}%` }));
    hbars(el, rows, C(), 132);
  }
  function drawBuckets(el, rows) {
    hbars(el, rows.map((r) => ({ k: `${r.k}（${r.days}天）`, v: r.ex20, hi: true, sub: `后20日 ${pct(r.s[20].mean, 2)}，胜率 ${fmt(r.s[20].win, 0)}%` })), C(), 96);
  }
  function drawVotes(el, c) {
    const v = c.votes || [], t = v.findIndex((r) => r.k === c.votes_today), cc = C();
    mk(el).setOption({
      animation: false, grid: { left: 40, right: 36, top: 34, bottom: 40 }, legend: { ...legendS(), data: ["后20日平均", "胜率"] },
      tooltip: { trigger: "axis", formatter: (ps) => { const r = v[ps[0].dataIndex]; return `净票 ${r.k}：${r.days} 天 / ${r.episodes} 次<br>后20日平均 ${pct(r.s[20].mean, 2)}，胜率 ${fmt(r.s[20].win, 0)}%<br>超额 ${sg(r.ex20)}`; } },
      xAxis: { type: "category", data: v.map((r) => r.k), name: "净票数", nameLocation: "middle", nameGap: 24, nameTextStyle: { color: cc.sub, fontSize: 11 }, ...axisStyle(), splitLine: { show: false } },
      yAxis: [{ type: "value", ...axisStyle(), axisLabel: { color: cc.sub, fontSize: 10, formatter: "{value}%" } }, { type: "value", min: 0, max: 100, position: "right", splitLine: { show: false }, axisLabel: { color: "#2f7fd8", fontSize: 10, formatter: "{value}%" } }],
      series: [{ name: "后20日平均", type: "bar", barMaxWidth: 24, itemStyle: { color: RED },
        data: v.map((r, i) => ({ value: r.s[20].mean, itemStyle: { color: col(r.s[20].mean), opacity: i === t ? 1 : 0.6, borderColor: i === t ? INK : undefined, borderWidth: i === t ? 2 : 0 } })),
        markPoint: t >= 0 ? { symbol: "pin", symbolSize: 40, itemStyle: { color: INK }, label: { color: "#fff", fontSize: 10, formatter: "今天" }, data: [{ coord: [t, v[t].s[20].mean] }] } : undefined },
        { name: "胜率", type: "line", yAxisIndex: 1, data: v.map((r) => r.s[20].win), symbolSize: 5, lineStyle: { color: "#2f7fd8", width: 1.4 }, itemStyle: { color: "#2f7fd8" } }],
    });
  }
  function heat(el, xs, ys, cell, opt = {}) {
    // cell(i行, j列) → {v, label, tip}；v 为 null 画灰格
    const cc = C(), num = [], gray = [];
    ys.forEach((_, i) => xs.forEach((__, j) => { const o = cell(i, j); (o.v == null ? gray : num).push({ value: [j, i, o.v == null ? 0 : o.v], label: o.label, tip: o.tip, itemStyle: opt.diag && i === j ? { borderColor: INK, borderWidth: 1.5 } : undefined }); }));
    const lim = opt.lim || 4;
    mk(el).setOption({
      animation: false, grid: { left: opt.left || 80, right: 8, top: opt.top || 8, bottom: opt.bottom || 64 },
      tooltip: { formatter: (p) => p.data.tip },
      xAxis: { type: "category", data: xs, position: opt.xTop ? "top" : "bottom", axisLabel: { color: cc.text, fontSize: 10, rotate: opt.rot ?? 50, interval: 0 }, axisTick: { show: false }, axisLine: { show: false }, splitArea: { show: false } },
      yAxis: { type: "category", data: ys, inverse: true, axisLabel: { color: cc.text, fontSize: 10, interval: 0 }, axisTick: { show: false }, axisLine: { show: false } },
      visualMap: { show: false, seriesIndex: 0, min: -lim, max: lim, dimension: 2, inRange: { color: [GREEN, "#a8dcbf", "#f7f7f7", "#f6b3b5", RED] } },
      series: [{ type: "heatmap", data: num, label: { show: true, fontSize: opt.fs || 9, color: cc.text, formatter: (p) => p.data.label }, itemStyle: { borderColor: "#fff", borderWidth: 1 } },
        { type: "heatmap", data: gray, label: { show: !!opt.grayLabel, fontSize: 9, color: "#b0b5bd", formatter: (p) => p.data.label }, itemStyle: { color: "#eef0f3", borderColor: "#fff", borderWidth: 1 } }],
    });
  }
  function drawPairs(el, P) {
    if (!P || !P.names) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const ns = P.names.map(shortN);
    heat(el, ns, ns, (i, j) => {
      const m = P.m[i][j], a = P.names[i], b = P.names[j];
      return { v: m.ex, label: m.ex == null ? "" : fmt(m.ex, 1),
        tip: i === j ? `${esc(a)} 单独：${m.n} 次，超额 ${sg(m.ex)}，胜率 ${fmt(m.win, 0)}%` : `${esc(a)} + ${esc(b)} 同时在买入区：${m.n} 次<br>超额 ${m.ex == null ? "（次数太少不算）" : sg(m.ex)}，胜率 ${fmt(m.win, 0)}%` };
    }, { left: 78, bottom: 70, lim: 4, diag: true });
  }
  function drawMatrix(el, M) {
    if (!M || !M.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const F_ = ["多", "中偏多", "中", "中偏空", "空"], T = ["多头", "偏多", "中性", "偏空", "空头"];
    heat(el, T.map((x) => "技术" + x), F_.map((x) => "基本面" + x), (i, j) => {
      const m = M[i][j];
      return { v: m.ex, label: m.ex == null ? (m.days ? `${m.days}天` : "") : `${sg(m.ex)}\n(${m.days}天)`, tip: `基本面${F_[i]} × 技术${T[j]}：${m.days} 天<br>超额 ${m.ex == null ? "（不到 20 天不算）" : sg(m.ex)}，胜率 ${fmt(m.win, 0)}%` };
    }, { left: 68, bottom: 30, top: 8, rot: 0, fs: 10, lim: 2.5, grayLabel: true });
  }
  function drawSys(el, S) {
    const cv = S.curve;
    if (!cv) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const X = expand(cv), cc = C();
    const names = cv.names || [...S.rows.filter((r) => r.k !== "满仓持有").map((r) => r.k), "固定仓位", "满仓持有"];
    const color = (n) => (/系统/.test(n) ? RED : /^固定/.test(n) ? "#2f7fd8" : n === "满仓持有" ? GRAY : /四象限/.test(n) ? "#e8833a" : "#8b5cf6");
    const hasSys = names.some((n) => /系统/.test(n));
    const sel = Object.fromEntries(names.map((n) => [n, !hasSys || /系统|^固定|满仓/.test(n)]));
    const dd = (s) => { let m = -Infinity; return s.map((v) => { if (v == null) return null; m = Math.max(m, v); return +((v / m - 1) * 100).toFixed(2); }); };
    const series = [];
    names.forEach((n, k) => {
      const s = X.s[k];
      series.push({ name: n, type: "line", data: s, showSymbol: false, lineStyle: { color: color(n), width: /系统/.test(n) ? 2 : 1.3 }, itemStyle: { color: color(n) } });
      series.push({ name: n, type: "line", xAxisIndex: 1, yAxisIndex: 1, data: dd(s), showSymbol: false, lineStyle: { color: color(n), width: 1 }, itemStyle: { color: color(n) }, areaStyle: /系统|满仓/.test(n) ? { color: color(n), opacity: 0.12 } : undefined });
    });
    mk(el).setOption({
      animation: false, legend: { ...legendS(), data: names, selected: sel }, axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: { trigger: "axis", formatter: (ps) => ps[0].axisValue + "<br>" + ps.map((p) => `${p.marker}${p.seriesName}：${p.seriesIndex % 2 ? fmt(p.value, 1) + "%" : fmt(p.value, 3)}`).join("<br>") },
      grid: [{ left: 44, right: 10, top: 56, height: "50%" }, { left: 44, right: 10, top: "72%", bottom: 26 }],
      xAxis: [{ type: "category", data: X.d, ...axisStyle(), splitLine: { show: false }, axisLabel: { show: false } }, { type: "category", gridIndex: 1, data: X.d, ...axisStyle(), splitLine: { show: false } }],
      yAxis: [{ type: "value", scale: true, ...axisStyle() }, { type: "value", gridIndex: 1, max: 0, ...axisStyle(), axisLabel: { color: cc.sub, fontSize: 10, formatter: "{value}%" }, splitNumber: 2 }],
      series, dataZoom: [{ type: "inside", xAxisIndex: [0, 1] }],
    });
  }

  async function page(mkt, sub, arg) {
    mkt = mkt === "us" ? "us" : "cn";
    const tok = A.tok();
    if (io) { io.disconnect(); io = null; }
    document.title = "回测中心 · 小七投研";
    app.innerHTML = `<h1>回测中心</h1>${LOADING("正在读取回测结果…")}`;
    let d;
    try { d = await getJSON(`backtest_${mkt}.json`, true); } catch (e) { if (A.alive(tok)) app.innerHTML = `<h1>回测中心</h1>${FAIL("回测结果加载失败")}`; return; }
    if (!A.alive(tok)) return;
    if (sub === "i" && arg) return detail(d, mkt, arg, tok);
    if (sub === "combo") return combo(d, mkt, tok);
    return single(d, mkt);
  }
  window.__mod_bt = { page };
})();
