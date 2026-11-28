/* 小七投研 · 页面逻辑：今日驾驶舱 / 报告库 / 短线 / 指标看板 / 指标学堂 */
(function () {
  const D = window.DATA;
  // ---------- 按需加载（首屏只下 core.js + app.js；课程内容、曲线、ECharts、报告、短线数据都是打开对应页面才下载） ----------
  const STORE = { s: {}, o: {}, c: {}, h: {} }, WAIT = {};
  D.s = STORE.s; D.ohlc = STORE.o; D.strategies.curves = STORE.c;
  const ver = ((D.meta && D.meta.ver) || "") + "u40"; // u40 = 11-28 新增「🎬 分时练盘」#/tape（tape_build.py：纳指/标普含盘前盘后 1 分钟、沪深300/恒指 5 分钟、日经/伦敦金 1 分钟，随机真实一天加速回放、自己点买卖）； u39 = 11-28 报告简版改「图卡」（brief_card.py → R.card：结论色块 + 仓位条 + 3 件事彩色格 + 转好/转坏信号）； u38 = 11-27 首页重做「今日综合」（home_build.py → home.json：报告 × 长期趋势 × 信号 × 新闻 合成每市场一句话，冲突写明按谁）+ #/all 全部功能 + 报告库默认只显示近 3 天 + 侧栏精简； u37 = 11-27 新增「📡 技术信号雷达」#/signals（signals.py → signals.json：6 市场 20 标的 × 顶底背离/RSI/KDJ/MACD/布林/偏离/量价/连涨跌/200日线/均线交叉，附历史灵不灵）+ 首页卡； u36 = 11-27 新增「📡 X 要闻 · 新闻后来怎么走」#/xnews（news_impact.py → newsimpact.json）； u35 = 11-27 报告默认「简版」（report_brief.py：一句话看懂 + 3 件事 + X 要闻 + 每节一句白话），可切完整版； u32 = 11-26 老大反馈「个股数据太多放top、A股美股港日韩黄金top的K线要有带分析、赛马博主龙虎榜个股期权多做、报告去重」：新增「🌍 各市场 TOP K线」#/topk（topk.py → topk.json，6市场13标的近120根K线+MA+三档判断+一句白话；topk.js 真K线页 + 首页缩略K线卡），放进「看行情」主导航 + 首页最显眼位；报告库同题材去重只留最新；手机更多页把赛马/博主/龙虎榜/期权/各市场K线提到第一屏。 u31 = 11-26 新增「期权模拟」#/optsim（optsim.js：历史随机段逐日推进 / 今天的真实价格 / 我的成绩；题库 optsim/q_*.json + optsim/today.json，研究区 + 期权研究页顶部入口）；u30 = 11-25 首页「🌍 各市场看法」9 行总表（A股/美股/港股/日本/韩国/黄金/比特币/原油/美债，偏多·震荡·偏空 + 报告结论；views.json）； u29 = 11-25 新增「K 线训练」#/train（train.js：今日一题 / 自由练 / Joy 方法题 / 我们的信号题 / 我的成绩 / 方法卡；题库 train/q_*.json 按需加载，学一学区）；u28 = 11-25 新增「趋势状态判定」#/trend（trend.js：布鲁斯框架 S1~S5 大状态卡 + 指标表 + 近 60 天状态色带 + 检验徽标，研究区）；u27 = 11-25 做成手机 App（PWA）：manifest.webmanifest + icons/ + sw.js 离线缓存 + pwa.js（添加到桌面提示、新版本提示条、离线角标、桌面 App 下拉刷新/外链新窗口/预取常用页；__APP.ver 给 pwa.js 预取用）；u26 = 11-25 新增「美股日内形态」#/usshape（usshape.js：首屏结论 + 形态频率排行〔缩略图，点开叠加图/次日〕+「开盘先跌」漏斗 + 条件概率卡 + 一天的节奏图 + 聚类 + 看单只；个股页「📐 日内形态」共用，研究区）；u25 = 11-25 新增「美股开盘惯性」#/usopen（usopen.js：三行结论 + 今晚实时分档面板〔腾讯分时〕+ 强度→后续表/柱图 + 时间段热力图 + 期权快进快出成本，研究区）；u24 = 11-25 新增「相似走势」#/analog（analog.js：日内相似日叠加 + 预测锥、两段重叠、日K相似段；历史库 analog/*.bin，研究区）；u23 = 11-25 新增「期权研究」#/opt（opt.js：A股/美股期权温度卡 + 品种总表 + 检验总表，研究区）+ 首页「其它」加一行期权温度；u22 = 11-24 学堂各页「首屏只放结论」改版：#/todo 每条一行动作（买/卖/等+对象+价格+触发，原因折叠）、#/account 持仓总表、#/labs 验真总表、#/sectors 能买的板块表、#/lhb 一行结论+游资总表、#/macro 每个指标加利好/利空、#/backtest 普通人怎么用+策略总表、首页 今日一票→总状态→7 天大事→其它入口一行；u21 = 11-24 新增「🎯 今日一票」#/pick（pick.js：主选+备选、概率、前瞻台账）+ 首页最上面今日一票大卡；u20 = 11-24 新增「财经大事日历」#/cal（cal.js：月历 + 接下来 14 天 + 历史验证，事件详情弹窗）+ 首页「📅 未来 7 天大事」卡；u19 = 11-24 全站股票名/代码可点进个股页（stockLink / 页面文字自动加链接 linkify + stock_names.json；报告正文 build_reports 加链接）；u18 = 11-24 赛马页股票名全部可点进个股页（race.js）；u17 = 11-24 赛马选手卡片改版（持仓/买入价/现价/涨跌大字首屏，规则明细折叠；race.js）；u16 = 11-24 新增「人气榜剖析」#/hot（hot.js，研究区）；u15 未用；u14 = 11-24 博主页首屏排行榜+小结卡（gurus.js）；u13 = 11-23 S 级卡 / #/todo 加「全部 S 级买卖点 ›」；u12 = 11-23 S 级买卖点升为主信号（#/todo、首页），v2 组合降为测试中；u11 = 11-23 「今天我该做什么」改版（结论卡 + 要做的事清单）；u10 = 11-22 新增「国家宏观数据」#/macro（宏观+出海信号）；u9 = 11-20 新增「今天我该做什么」#/todo + 导航研究区分组；u8 = 11-20 龙虎榜页面改版（新手版）；u7 = 11-20 博主页加微博分栏；u2 = 2026-11-18 界面改版；u3 = 同日电脑版侧边栏布局；u4 = 11-19 板块看板；u5 = 同日板块看板加细分；u6 = 同日晚板块看板改三级页面，强制刷新各模块缓存
  function expand(x) {
    if (!x || !x.dd) return x;
    const out = [], t0 = new Date(x.d0 + "T00:00:00Z").getTime();
    let t = t0;
    x.dd.forEach((g) => { t += g * 86400000; out.push(new Date(t).toISOString().slice(0, 10)); });
    const y = { ...x, d: out }; delete y.dd; delete y.d0; return y;
  }
  window.__put = (kind, key, val) => { STORE[kind][key] = expand(val); const w = WAIT[kind + ":" + key]; if (w) w.res(); };
  function loadScript(src, key, kind, ordered) {
    return new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = src; el.async = !ordered;
      if (kind) WAIT[kind + ":" + key] = { res };
      el.onload = () => { if (!kind) res(); };
      el.onerror = () => rej(new Error("加载失败：" + src));
      document.head.appendChild(el);
    });
  }
  const PEND = {};
  function need(kind, key) {
    if (kind === "lib") {
      if (window.echarts) return Promise.resolve();
      return (PEND.lib = PEND.lib || loadScript("echarts.min.js?v=5.5.1").catch((e) => { delete PEND.lib; throw e; }));
    }
    if (!key) return Promise.resolve();
    if (STORE[kind][key]) return Promise.resolve();
    if (!((D.avail || {})[kind] || []).includes(key)) return Promise.resolve();
    const id = kind + ":" + key;
    return (PEND[id] = PEND[id] || loadScript(`d/${kind}_${key}.js?v=${ver}`, key, kind).catch((e) => { delete PEND[id]; throw e; }));
  }
  function needsOf(x) {
    const c = (x && x.chart) || {}, n = [];
    if (c.type && c.type !== "today") n.push(["lib"]);
    if (c.s) n.push(["s", c.s]);
    if (c.idx) n.push(["s", c.idx]);
    (c.keys || []).forEach((k) => n.push(["s", k]));
    if (c.src) n.push(["o", c.src]);
    if (c.type === "twoside") n.push(["o", "hs300"], ["h", "two"]);
    if (c.type === "quad") n.push(c.market === "us" ? ["s", "us_joint_y"] : ["s", "joint_y"], c.market === "us" ? ["s", "us_joint_x"] : ["s", "joint_x"]);
    if (c.type === "strategy") n.push(["c", c.key]);
    if (x && x.tech) n.push(["o", x.tech.src]);
    if (x && x.sl) n.push(["s", x.sl.s]);
    return n;
  }
  let routeToken = 0;
  async function ensure(list) { await Promise.all(list.map(([k, v]) => need(k, v))); }
  // 课程内容（content1/2/3.js）+ 云同步，进学堂相关页面才下载
  let L = null, byId = {}, contentP = null, cloudP = null;
  function needContent() {
    if (L) return Promise.resolve();
    return (contentP = contentP || Promise.all(["content1", "content2", "content3"].map((f) => loadScript(`${f}.js?v=${ver}`, null, null, true)))
      .then(() => { L = window.LESSONS; byId = Object.fromEntries(L.map((x) => [x.id, x])); loadCloud(); })
      .catch((e) => { contentP = null; throw e; }));
  }
  function loadCloud() {
    return (cloudP = cloudP || loadScript(`cloud.js?v=${ver}`).then(() => { if (lastEmit) emit(...lastEmit); }).catch(() => { cloudP = null; }));
  }
  const JC = {};
  function getJSON(url, fresh) {
    const u = url + (url.includes("?") ? "&" : "?") + "v=" + (fresh ? Math.floor(Date.now() / 300000) : ver);
    return (JC[u] = JC[u] || fetch(u).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch((e) => { delete JC[u]; throw e; }));
  }
  // 指标买卖条件（academy/build_rules.py → rules.json；渲染在 rules.js）。失败返回 null，不影响页面其余部分
  let rulesJs = null;
  const needRules = () => Promise.all([getJSON("rules.json", true), window.RULES ? 0 : (rulesJs = rulesJs || loadScript(`rules.js?v=${ver}`).catch((e) => { rulesJs = null; throw e; }))])
    .then(([R]) => R).catch(() => null);

  const $ = (s) => document.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $("#app");
  const charts = [];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const C = () => ({
    text: css("--text"), sub: css("--sub"), grid: css("--line"), up: "#e5484d", dn: "#2fa86b",
    buy: "rgba(229,72,77,0.13)", sell: "rgba(47,168,107,0.16)", main: css("--accent"), idx: "#9a9a9a",
  });

  // ---------- 工具 ----------
  const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
  const pct = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "—" : (v >= 0 ? "+" : "") + Number(v).toFixed(d) + "%");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const updn = (v) => (v > 0 ? "up" : v < 0 ? "dn" : "");
  const LOADING = (t = "正在加载…") => `<div class="card loading">${t}</div>`;
  const FAIL = (t = "加载失败：网络不太好") => `<div class="card">${t}，<a href="javascript:location.reload()">点这里重试</a></div>`;
  const DISC = '<p class="disclaimer">仅供学习研究，不构成投资建议。数据来自公开接口，可能有延迟或误差，以交易所和报告原文为准。</p>';
  function since(ser, from) {
    if (!ser) return null;
    if (!from) return ser;
    const i = ser.d.findIndex((x) => x >= from);
    return i < 0 ? ser : { d: ser.d.slice(i), v: ser.v.slice(i) };
  }
  function align(dates, ser) {
    const m = new Map(ser.d.map((d, i) => [d, ser.v[i]]));
    let last = null;
    return dates.map((d) => { if (m.has(d)) last = m.get(d); return last; });
  }
  function disposeCharts() { while (charts.length) charts.pop().dispose(); }
  function mk(el) { const c = echarts.init(el, null, { renderer: "canvas" }); charts.push(c); return c; }
  window.addEventListener("resize", () => charts.forEach((c) => c.resize()));
  const zoom = (n, len, xi = [0]) => [
    { type: "inside", xAxisIndex: xi, startValue: Math.max(0, len - n), endValue: len - 1 },
    { type: "slider", xAxisIndex: xi, startValue: Math.max(0, len - n), endValue: len - 1, height: 18, bottom: 6, textStyle: { color: C().sub } },
  ];
  const axisStyle = () => ({ axisLine: { lineStyle: { color: C().grid } }, axisLabel: { color: C().sub, fontSize: 11 }, splitLine: { lineStyle: { color: C().grid, opacity: 0.5 } } });
  const bjDate = () => new Date(Date.now() + 8 * 3600e3); // 北京时间（用 UTC 字段读）
  const wk = (s) => "日一二三四五六"[new Date(s + "T00:00:00Z").getUTCDay()];

  // ---------- 股票链接（2026-11-24 老大：涉及股票的地方都能点进个股页）----------
  // 规则：A股 / ETF → sh|sz|bj + 6 位；港股 hk + 5 位；美股 us + ticker（缺 .OQ/.N 后缀时个股站自己补）；指数 sh000001 / sz399006 / hkHSI / usIXIC 等。
  // 只有名称：查 stock_names.json（academy/stocknames.py 生成），查不到就走个股站 #/q/<名称> 搜索。
  const symOf = (code, m) => {
    const c = String(code ?? "").trim(), lo = c.toLowerCase();
    if (/^(sh|sz|bj)\d{6}$/.test(lo) || /^hk\d{5}$/.test(lo)) return lo;
    let x = /^(\d{6})\.(sh|sz|bj)$/.exec(lo); if (x) return x[2] + x[1];
    if (/^us[A-Za-z.\-]+$/.test(c) || /^hkHS/.test(c)) return c;
    if (/^\d{5}$/.test(c)) return "hk" + c;
    if (!/^\d{6}$/.test(c)) return null;
    if (/^(92|8|4)/.test(c)) return "bj" + c;
    return m === 1 || /^[695]/.test(c) ? "sh" + c : "sz" + c;
  };
  const stockHref = (code, name) => { const s = symOf(code); return s ? "stock/#/s/" + encodeURIComponent(s) : name ? "stock/#/q/" + encodeURIComponent(name) : null; };
  const stockLink = (code, name, cls = "stk") => { const h = stockHref(code, name); const t = esc(name ?? code); return h ? `<a class="${cls}" href="${h}">${t}</a>` : t; };
  // 页面文字自动加链接：只在下列页面、只处理不在链接/按钮/切换项里的文字；同一块（段落/格子/列表项）里同一只只链一次
  const LK_ROUTES = new Set(["", "todo", "account", "lhb", "short", "sectors", "board", "labs", "gurus", "macro", "hot", "backtest", "reports", "report", "academy"]);
  const LK_SKIP = "a,button,select,option,label,input,textarea,code,pre,svg,canvas,script,style,h1,.report,.nolink,.chip,.chips,.subtabs,.tocl,.crumb,.pager,[_echarts_instance_],[data-cid],[data-jump],[data-sort],[data-term],[data-tog],[data-bt],[data-bcard],[data-img],[data-lv],[data-t],[data-m],[data-d],[data-mon],[data-h],[data-rk],[data-l2],[data-l3],[data-win],[data-kind],[data-f],[data-more],[data-nb],[data-days],[data-rep],th[data-k],.td-box";
  let NM = null, NMP = null;
  function needNames() {
    return NM ? Promise.resolve(NM) : (NMP = NMP || getJSON("stock_names.json").then((J) => {
      const n = {}, first = {};
      for (const [k, v] of Object.entries(J.n || {})) { if (k === "o") continue; v.split("|").forEach((e) => { n[e.slice(6)] = k + e.slice(0, 6); }); }
      (J.n.o || "").split("|").forEach((e) => { const i = e.indexOf(" "); if (i > 0) n[e.slice(i + 1)] = e.slice(0, i); });
      const stop = new Set(J.x || []);
      for (const k of Object.keys(n)) if (!stop.has(k)) (first[k[0]] = first[k[0]] || new Set()).add(k.length);
      const lens = {}; for (const [c, s] of Object.entries(first)) lens[c] = [...s].sort((a, b) => b - a);
      const c = {}; for (const v of Object.values(n)) if (/^(sh|sz|bj)\d{6}$/.test(v) && !/^(sh000|sz399|bj899)/.test(v)) c[v.slice(2)] = c[v.slice(2)] || v;
      return (NM = { n, stop, lens, c, t: J.t || {} });
    }).catch(() => { NMP = null; return null; }));
  }
  function scanText(s) { // → [[起, 止, sym]]
    const { n, stop, lens, t } = NM, hits = [];
    for (let i = 0; i < s.length;) {
      const ch = s[i], pv = i ? s[i - 1] : "";
      let m = /[sSbB\d]/.test(ch) && !/[A-Za-z0-9]/.test(pv) ? /^(?:(sh|sz|bj)(\d{6})|(\d{6})\.(SH|SZ|BJ))(?![A-Za-z0-9])/.exec(s.slice(i, i + 12)) : null;
      if (m) { hits.push([i, i + m[0].length, m[1] ? m[1] + m[2] : m[4].toLowerCase() + m[3]]); i += m[0].length; continue; }
      let L0 = 0;
      for (const L of lens[ch] || []) {
        const w = s.substr(i, L);
        if (w.length !== L || !n[w] || stop.has(w)) continue;
        const nx = s.slice(i + L, i + L + 2);
        if (/[A-Za-z0-9]$/.test(w) && /^[A-Za-z0-9]/.test(nx) || /^[A-Za-z0-9]/.test(w) && /[A-Za-z0-9]/.test(pv)) continue;
        if (/证券$/.test(w) && /^[\u4e00-\u9fff]/.test(nx) || /^证券/.test(nx)) continue; // 营业部席位：中信证券上海分公司、国泰海通证券…
        if (/^[网间系链]/.test(nx) || /^业(?![绩务])/.test(nx) || /^(概念|产业)/.test(nx)) continue; // 东方财富网 / 银行间 / 腾讯系 / 中国银行业 / 英伟达概念 / 特斯拉产业链
        let e = i + L;
        const cm = /^\s?[（(]?\s?(\d{5,6})(\.(?:SH|SZ|BJ|HK))?\s?[)）]?/.exec(s.slice(e, e + 16));
        let sy = n[w];
        if (cm && n[w].endsWith(cm[1]) && !/^\d/.test(s.slice(e + cm[0].length))) e += cm[0].length; // 名称（代码）一起进链接
        else if (cm && /^\s?[（(]\s?\d{6}\s?[)）]/.test(cm[0]) && symOf(cm[1])) { sy = symOf(cm[1]); e += cm[0].length; } // 括号里写明了代码以代码为准（标普500ETF（513500））
        else if (/^(50|100|300|500|1000|2000)(?!\d)/.test(s.slice(i + L, i + L + 5)) && /^(us|hkHS|sh000|sz399)/.test(n[w])) continue; // 纳指100（基金）这种「指数名+成分数」不链到指数
        hits.push([i, e, sy]); L0 = e - i; break;
      }
      if (L0) { i += L0; continue; }
      if (ch >= "A" && ch <= "Z" && !/[A-Za-z0-9$]/.test(pv)) {
        m = /^[A-Z]{2,5}(?![A-Za-z0-9])/.exec(s.slice(i, i + 6));
        if (m && t[m[0]]) { hits.push([i, i + m[0].length, t[m[0]]]); i += m[0].length; continue; }
      }
      if (/\d/.test(ch) && !/[\d.,]/.test(pv) && /^[（(]$/.test(pv)) { // （600519）这种单独括号里的代码
        m = /^\d{6}(?=[)）])/.exec(s.slice(i, i + 7));
        if (m && NM.c[m[0]]) { hits.push([i, i + 6, NM.c[m[0]]]); i += 6; continue; }
      }
      i++;
    }
    return hits;
  }
  const sameSym = (a, s) => { const h = decodeURIComponent(a.getAttribute("href") || ""); const k = h.replace(/^.*#\/[sq]\//, ""); return k === s || k.replace(/\.(OQ|N|AM)$/, "") === s.replace(/\.(OQ|N|AM)$/, ""); };
  function linkify(root) {
    if (!NM || !root) return 0;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (x) => (x.nodeValue.length > 1 && /[\u4e00-\u9fffA-Z\d]/.test(x.nodeValue) && x.parentElement && !x.parentElement.closest(LK_SKIP) ? 1 : 2) });
    const todo = [];
    for (let x; (x = tw.nextNode());) todo.push(x);
    let k = 0;
    for (const tn of todo) {
      const hits = scanText(tn.nodeValue);
      if (!hits.length) continue;
      const blk = tn.parentElement.closest("td,li,p,dd,dt,blockquote,div") || root;
      const frag = document.createDocumentFragment(), s = tn.nodeValue;
      let at = 0, did = 0;
      for (const [a, b, sym] of hits) {
        const box = /^[\s\w.()（）]*$/.test(s.slice(a, b)) && blk !== root && blk.parentElement ? blk.parentElement : blk; // 单独的代码：看上一层有没有名字链接
        if ([...box.querySelectorAll('a[href*="/s/"]')].some((x) => sameSym(x, sym))) continue; // 同一块里已经有这只的链接（名字旁的代码、第二次出现）
        frag.append(s.slice(at, a));
        const el = document.createElement("a");
        el.className = "stk"; el.href = "stock/#/s/" + encodeURIComponent(sym); el.textContent = s.slice(a, b);
        frag.append(el); at = b; did++;
        tn.parentNode && tn.parentNode.insertBefore(frag, tn); // 先插进去，后面同一节点里的同一只能被上面的检查看到
      }
      if (!did) continue;
      tn.nodeValue = s.slice(at); k += did;
    }
    return k;
  }
  let lkT = 0;
  const lkRoute = () => (location.hash.replace(/^#\/?/, "").split("/")[0] || "");
  new MutationObserver(() => {
    if (!LK_ROUTES.has(lkRoute())) return;
    clearTimeout(lkT);
    lkT = setTimeout(() => needNames().then((N) => { if (N && LK_ROUTES.has(lkRoute())) linkify(app); }), 150);
  }).observe(app, { childList: true, subtree: true });

  // ---------- 图表：指标线 ----------
  function lineChart(el, spec) {
    let s = since(D.s[spec.s], spec.since);
    if (!s || !s.d.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const c = C();
    const vals = s.v.filter((x) => x !== null);
    const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.05 || 1;
    const yMin = spec.yr ? spec.yr[0] : lo - pad, yMax = spec.yr ? spec.yr[1] : hi + pad;
    const areas = [];
    if (spec.band) {
      const b = spec.band(D) || {};
      if (b.buy) areas.push([{ yAxis: b.buy[0] ?? yMin, itemStyle: { color: c.buy } }, { yAxis: b.buy[1] ?? yMax }]);
      if (b.sell) areas.push([{ yAxis: b.sell[0] ?? yMin, itemStyle: { color: c.sell } }, { yAxis: b.sell[1] ?? yMax }]);
    }
    const series = [{
      name: spec.name, type: "line", data: s.v, showSymbol: false, step: spec.step ? "end" : false, lineStyle: { width: 1.6, color: c.main }, itemStyle: { color: c.main },
      markArea: { silent: true, data: areas },
      markLine: spec.hl ? { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#8b5cf6" }, label: { color: c.sub, formatter: "{c}" }, data: spec.hl.map((v) => ({ yAxis: v })) } : undefined,
      markPoint: { symbolSize: 34, label: { fontSize: 10, color: "#fff" }, itemStyle: { color: "#e5484d" }, data: [{ coord: [s.d.length - 1, s.v[s.v.length - 1]], value: fmt(s.v[s.v.length - 1], Math.abs(s.v[s.v.length - 1]) >= 100 ? 0 : 2) }] },
    }];
    const yAxis = [{ type: "value", min: yMin, max: yMax, scale: true, ...axisStyle() }];
    if (spec.idx && D.s[spec.idx]) {
      series.push({ name: spec.idxName, type: "line", yAxisIndex: 1, data: align(s.d, D.s[spec.idx]), showSymbol: false, lineStyle: { width: 1, color: c.idx }, itemStyle: { color: c.idx }, z: 1 });
      yAxis.push({ type: "value", scale: true, position: "right", splitLine: { show: false }, axisLabel: { color: c.idx, fontSize: 10 }, axisLine: { show: false } });
    }
    mk(el).setOption({
      animation: false, grid: { left: 48, right: spec.idx ? 52 : 16, top: 30, bottom: 52 },
      tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub, fontSize: 11 } },
      xAxis: { type: "category", data: s.d, ...axisStyle(), splitLine: { show: false } }, yAxis, series,
      dataZoom: zoom(spec.show || Math.min(s.d.length, 750), s.d.length),
    });
  }

  // ---------- 图表：多指数对比 ----------
  function multiChart(el, spec) {
    const c = C(), cols = ["#e5484d", "#2f7fd8", "#e8833a", "#8b5cf6", "#2fa86b"];
    const base = since(D.s[spec.keys[0]], spec.since);
    const series = spec.keys.map((k, i) => {
      const v = align(base.d, D.s[k]);
      const first = v.find((x) => x !== null);
      return { name: spec.names[i], type: "line", showSymbol: false, data: v.map((x) => (x === null ? null : +(x / first * 100).toFixed(2))), lineStyle: { width: 1.4, color: cols[i] }, itemStyle: { color: cols[i] } };
    });
    mk(el).setOption({ animation: false, grid: { left: 44, right: 16, top: 30, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub } },
      xAxis: { type: "category", data: base.d, ...axisStyle(), splitLine: { show: false } }, yAxis: { type: "value", scale: true, ...axisStyle() }, series, dataZoom: zoom(base.d.length, base.d.length) });
  }

  // ---------- 图表：K线 + 叠加 + 副图 ----------
  const GM_S = [3, 5, 8, 10, 12, 15], GM_L = [30, 35, 40, 45, 50, 60];
  function klineChart(el, spec) {
    const P = D.ohlc[spec.src];
    if (!P) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const c = C(), n = P.d.length;
    const k = P.d.map((_, i) => [P.open[i], P.close[i], P.low[i], P.high[i]]);
    const main = [{ name: "K线", type: "candlestick", data: k, itemStyle: { color: c.up, color0: c.dn, borderColor: c.up, borderColor0: c.dn } }];
    const line = (name, data, color, extra = {}) => ({ name, type: "line", data, showSymbol: false, lineStyle: { width: 1.1, color, ...(extra.ls || {}) }, itemStyle: { color }, ...extra.opt });
    const maCol = { ma5: "#888", ma10: "#aaa", ma20: "#e8a317", ma60: "#8b5cf6", ma120: "#2fa86b", ma250: "#2f7fd8" };
    (spec.ov || []).forEach((o) => {
      if (o.startsWith("ma")) main.push(line(o.toUpperCase(), P[o], maCol[o]));
      if (o === "boll") {
        main.push(line("布林中轨", P.bm, "#8b5cf6"));
        main.push(line("布林上轨", P.bu, "#8b5cf6", { ls: { type: "dashed" } }));
        main.push(line("布林下轨", P.bl, "#8b5cf6", { ls: { type: "dashed" } }));
      }
      if (o === "ichimoku") {
        const bullLo = [], bullH = [], bearLo = [], bearH = [];
        P.ia.forEach((a, i) => {
          const b = P.ib[i];
          if (a === null || b === null) { bullLo.push(null); bullH.push(null); bearLo.push(null); bearH.push(null); return; }
          if (a >= b) { bullLo.push(b); bullH.push(+(a - b).toFixed(3)); bearLo.push(null); bearH.push(null); }
          else { bearLo.push(a); bearH.push(+(b - a).toFixed(3)); bullLo.push(null); bullH.push(null); }
        });
        const area = (name, stack, data, color, fill) => ({ name, type: "line", stack, data, showSymbol: false, lineStyle: { width: 0 }, areaStyle: fill ? { color } : { color: "transparent" }, itemStyle: { color }, tooltip: { show: false }, connectNulls: false });
        main.push(area("云底", "bull", bullLo, "transparent", false), area("一目云（多）", "bull", bullH, "rgba(229,72,77,0.22)", true));
        main.push(area("云底2", "bear", bearLo, "transparent", false), area("一目云（空）", "bear", bearH, "rgba(47,168,107,0.22)", true));
        main.push(line("转换线", P.tk, "#e8a317"), line("基准线", P.kj, "#2f7fd8"));
      }
      if (o === "gmma" && P.g3) {
        GM_S.forEach((m, i) => main.push(line("短期组 EMA3~15", P["g" + m], `hsl(${8 + i * 7},85%,${52 + i * 2}%)`, { ls: { width: 0.9 }, opt: { tooltip: { show: false } } })));
        GM_L.forEach((m, i) => main.push(line("长期组 EMA30~60", P["g" + m], `hsl(${205 + i * 6},70%,${42 + i * 4}%)`, { ls: { width: 0.9 }, opt: { tooltip: { show: false } } })));
      }
    });
    const sub = [];
    let subY = { type: "value", scale: true, gridIndex: 1, ...axisStyle(), splitNumber: 2 };
    const s = spec.sub;
    if (s === "vol") sub.push({ name: "成交量", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: P.volume.map((v, i) => ({ value: v, itemStyle: { color: P.close[i] >= P.open[i] ? c.up : c.dn } })) });
    if (s === "macd" || s === "vwmacd") {
      const dif = s === "macd" ? P.dif : P.vdif, dea = s === "macd" ? P.dea : P.vdea;
      sub.push({ name: s === "macd" ? "MACD柱" : "VWMACD柱", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: dif.map((v, i) => (v === null || dea[i] === null ? null : { value: +(v - dea[i]).toFixed(3), itemStyle: { color: v - dea[i] >= 0 ? c.up : c.dn } })) });
      sub.push({ ...line("DIF", dif, c.text), xAxisIndex: 1, yAxisIndex: 1 }, { ...line("DEA", dea, "#e8833a"), xAxisIndex: 1, yAxisIndex: 1 });
    }
    if (s === "kdj") {
      sub.push({ ...line("K", P.k, c.text), xAxisIndex: 1, yAxisIndex: 1, markArea: { silent: true, data: [[{ yAxis: -20, itemStyle: { color: c.buy } }, { yAxis: 20 }], [{ yAxis: 80, itemStyle: { color: c.sell } }, { yAxis: 120 }]] } });
      sub.push({ ...line("D", P.kd, "#e8833a"), xAxisIndex: 1, yAxisIndex: 1 }, { ...line("J", P.j, "#8b5cf6"), xAxisIndex: 1, yAxisIndex: 1 });
      subY = { ...subY, scale: false, min: -20, max: 120 };
    }
    if (s === "rsi") {
      sub.push({ ...line("RSI14", P.rsi, c.text), xAxisIndex: 1, yAxisIndex: 1, markArea: { silent: true, data: [[{ yAxis: 0, itemStyle: { color: c.buy } }, { yAxis: 30 }], [{ yAxis: 70, itemStyle: { color: c.sell } }, { yAxis: 100 }]] } });
      subY = { ...subY, scale: false, min: 0, max: 100 };
    }
    if (s === "bias") sub.push({ name: "20日乖离率%", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: P.bias20.map((v) => (v === null ? null : { value: v, itemStyle: { color: v >= 0 ? c.up : c.dn } })) });
    mk(el).setOption({
      animation: false, tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: { top: 0, textStyle: { color: c.sub, fontSize: 11 }, data: [...new Set(main.concat(sub).map((x) => x.name))].filter((x) => x && !x.startsWith("云底")) },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [{ left: 52, right: 14, top: 30, height: "54%" }, { left: 52, right: 14, top: "68%", height: "18%" }],
      xAxis: [{ type: "category", data: P.d, ...axisStyle(), splitLine: { show: false }, axisLabel: { show: false } }, { type: "category", gridIndex: 1, data: P.d, ...axisStyle(), splitLine: { show: false } }],
      yAxis: [{ type: "value", scale: true, ...axisStyle() }, subY],
      series: main.concat(sub), dataZoom: zoom(spec.show || 250, n, [0, 1]),
    });
  }

  // ---------- 图表：四象限 ----------
  function quadChart(el, spec) {
    const ky = spec.market === "us" ? "us_joint_y" : "joint_y", kx = spec.market === "us" ? "us_joint_x" : "joint_x";
    const Y = D.s[ky], X = D.s[kx];
    if (!Y || !X) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    const xs = align(Y.d, X), c = C();
    const pts = Y.d.map((d, i) => [xs[i] === null ? null : +(xs[i] / 100).toFixed(3), +(Y.v[i] / 100).toFixed(3), d]).filter((p) => p[0] !== null);
    const yr = pts.slice(-250), rec = pts.slice(-30), now = pts[pts.length - 1];
    const q = (D.today[spec.market] && D.today[spec.market].joint && D.today[spec.market].joint.quad_stats_20d) || {};
    const lab = (k, name) => (q[k] ? `${k}${name}\n后20日 ${pct(q[k][0])} / 胜率${fmt(q[k][1], 0)}%` : k + name);
    mk(el).setOption({
      animation: false, grid: { left: 48, right: 16, top: 16, bottom: 44 },
      tooltip: { formatter: (p) => (p.data && p.data[2] ? `${p.data[2]}<br>趋势分 ${p.data[0]}<br>抄底分 ${p.data[1]}` : "") },
      xAxis: { type: "value", min: -1.05, max: 1.05, name: "趋势分 →", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: c.sub }, ...axisStyle() },
      yAxis: { type: "value", min: -1.05, max: 1.05, name: "抄底分 →", nameLocation: "middle", nameGap: 32, nameTextStyle: { color: c.sub }, ...axisStyle() },
      series: [
        { type: "line", data: yr, showSymbol: false, lineStyle: { color: c.idx, width: 0.8 }, z: 1,
          markArea: { silent: true, label: { color: c.text, fontSize: 11, position: "insideTopLeft" }, data: [
            [{ coord: [-1.05, 0.3], name: lab("①", "左侧抄底"), itemStyle: { color: "rgba(229,72,77,0.14)" } }, { coord: [0, 1.05] }],
            [{ coord: [0, 0.3], name: lab("②", "右侧确认"), itemStyle: { color: "rgba(229,72,77,0.07)" } }, { coord: [1.05, 1.05] }],
            [{ coord: [0, -1.05], name: lab("③", "顺势持有"), itemStyle: { color: "rgba(160,160,160,0.12)" }, label: { position: "insideBottomLeft" } }, { coord: [1.05, 0.3] }],
            [{ coord: [-1.05, -1.05], name: lab("④", "回避"), itemStyle: { color: "rgba(47,168,107,0.14)" }, label: { position: "insideBottomLeft" } }, { coord: [0, 0.3] }]] },
          markLine: { silent: true, symbol: "none", lineStyle: { color: c.sub, type: "solid" }, label: { show: false }, data: [{ yAxis: 0.3 }, { xAxis: 0 }] } },
        { type: "line", data: rec, symbolSize: 4, lineStyle: { color: "#e5484d", width: 1.2 }, itemStyle: { color: "#e5484d" }, z: 3 },
        { type: "scatter", data: [now], symbolSize: 16, itemStyle: { color: "#e5484d", borderColor: "#fff", borderWidth: 2 }, z: 4,
          label: { show: true, position: "right", color: "#e5484d", formatter: () => `今天 ${now[2].slice(5)}` } },
      ],
    });
  }

  // ---------- 图表：策略净值 ----------
  function stratChart(el, key) {
    const cv = D.strategies.curves[key], c = C();
    if (!cv) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
    if (key === "dca") {
      const cols = { 普通定投: "#9a9a9a", 估值定投: "#e5484d", 均线偏离定投: "#2f7fd8" };
      const series = [];
      Object.keys(cols).forEach((k) => {
        series.push({ name: k + " 市值", type: "line", showSymbol: false, data: cv[k].value, lineStyle: { color: cols[k], width: 1.5 }, itemStyle: { color: cols[k] } });
        series.push({ name: k + " 投入", type: "line", showSymbol: false, data: cv[k].invested, lineStyle: { color: cols[k], width: 1, type: "dashed" }, itemStyle: { color: cols[k] } });
      });
      mk(el).setOption({ animation: false, grid: { left: 60, right: 16, top: 50, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub, fontSize: 10 } },
        xAxis: { type: "category", data: cv.dates, ...axisStyle(), splitLine: { show: false } }, yAxis: { type: "value", ...axisStyle() }, series, dataZoom: zoom(cv.dates.length, cv.dates.length) });
      return;
    }
    mk(el).setOption({ animation: false, grid: { left: 48, right: 16, top: 30, bottom: 52 }, tooltip: { trigger: "axis" }, legend: { top: 0, textStyle: { color: c.sub } },
      xAxis: { type: "category", data: cv.dates, ...axisStyle(), splitLine: { show: false } }, yAxis: { type: "value", scale: true, ...axisStyle() },
      series: [{ name: "策略", type: "line", showSymbol: false, data: cv.strat, lineStyle: { color: "#e5484d", width: 1.6 }, itemStyle: { color: "#e5484d" } },
        { name: cv.bench_name + "（基准）", type: "line", showSymbol: false, data: cv.bench, lineStyle: { color: c.idx, width: 1.2 }, itemStyle: { color: c.idx } }],
      dataZoom: zoom(cv.dates.length, cv.dates.length) });
  }

  // ---------- 今日读数（课程页） ----------
  const names = (v) => [].concat(v || []);
  const LESSON_FALLBACK = { cn: { 中证500情绪指标: "mood", 科创50点位: "percentile", 中证1000点位: "percentile" },
    us: { PCR: "pcr", 新高新低强度: "us-trend", 偏离125日线: "us-trend", McClellan广度: "breadth", 阿姆氏TRIN: "trin", AD腾落线: "adl" } };
  function lessonFor(mkt, name) {
    if (!L) return null;
    const l = L.find((y) => y.today && names(y.today[mkt]).includes(name));
    return l ? l.id : (LESSON_FALLBACK[mkt][name] && byId[LESSON_FALLBACK[mkt][name]] ? LESSON_FALLBACK[mkt][name] : null);
  }
  function todayRow(t) {
    if (!t) return "";
    const mkt = t.cn ? "cn" : "us", ns = names(t.cn || t.us), T = D.today[mkt];
    const r = T && (T.rows || []).find((x) => ns.includes(x["指标"]));
    if (!r) return "";
    const z = r["区域"] || "—", cls = z.includes("买") || z.includes("多") ? "buy" : z.includes("卖") || z.includes("空") ? "sell" : "mid";
    return `<div class="today"><div class="th">今天的读数（${mkt === "cn" ? "A股" : "美股"}，数据日期 ${esc(r["数据日期"])}）</div>
      <div class="tv"><b>${esc(r["最新值"])}</b> <span class="tag ${cls}">${esc(z)}</span>${r["历史分位"] != null ? ` <span class="muted">历史分位 ${fmt(r["历史分位"], 0)}%</span>` : ""}</div>
      <div class="muted">${esc(r["解读"])}</div></div>`;
  }
  function slReading(x) {
    const s = D.s[x.sl.s];
    if (!s || !s.v.length) return "";
    const n = s.v.length, v = s.v[n - 1], w = s.v.slice(-60).filter((y) => y !== null);
    const p = w.length ? (w.filter((y) => y <= v).length / w.length) * 100 : null;
    return `<div class="today"><div class="th">今天的读数（${esc(s.d[n - 1])}）</div><div class="tv"><b>${esc(x.sl.name)} ${fmt(v, x.sl.d || 0)}${x.sl.unit}</b>${p !== null ? ` <span class="muted">在近 ${w.length} 个交易日里排 ${fmt(p, 0)}% 分位</span>` : ""}</div>
      <div class="muted"><a href="#/short">去「短线」页看今天的涨停梯队 →</a></div></div>`;
  }
  function techReading(kind, src) {
    const P = D.ohlc[src], i = P.d.length - 1, cl = P.close[i];
    const name = { hs300: "沪深300", zz1k: "中证1000", spx: "标普500" }[src];
    let t = "";
    if (kind === "boll") {
      const z = (cl - P.bm[i]) / (P.bu[i] - P.bm[i]);
      const pos = z > 1 ? "破上轨" : z > 0.7 ? "上轨附近" : z >= 0 ? "中轨上" : z >= -0.7 ? "中轨下" : z >= -1 ? "下轨附近" : "破下轨";
      t = `收盘 ${fmt(cl)}，中轨 ${fmt(P.bm[i])}，上轨 ${fmt(P.bu[i])}，下轨 ${fmt(P.bl[i])} → <b>${pos}</b>`;
    }
    if (kind === "macd") t = `MACD：DIF ${fmt(P.dif[i])}、DEA ${fmt(P.dea[i])} → <b>${P.dif[i] > 0 ? "强" : "弱"} ${P.dif[i] > P.dea[i] ? "多" : "空"}</b>；VWMACD → <b>${P.vdif[i] > 0 ? "强" : "弱"} ${P.vdif[i] > P.vdea[i] ? "多" : "空"}</b>`;
    if (kind === "kdj") t = `K ${fmt(P.k[i], 1)}、D ${fmt(P.kd[i], 1)}、J ${fmt(P.j[i], 1)} → <b>${P.k[i] < 25 || P.j[i] < 0 ? "底部区" : P.k[i] > 75 || P.j[i] > 100 ? "顶部区" : "中间区"}，${P.k[i] > P.kd[i] ? "K在D上（偏多）" : "K在D下（偏空）"}</b>`;
    if (kind === "rsi") t = `RSI(14) = <b>${fmt(P.rsi[i], 1)}</b>（${P.rsi[i] > 70 ? "超买" : P.rsi[i] < 30 ? "超卖" : "中性"}）`;
    if (kind === "ichimoku") {
      const top = Math.max(P.ia[i], P.ib[i]), bot = Math.min(P.ia[i], P.ib[i]);
      t = `收盘 ${fmt(cl)}，云顶 ${fmt(top)}，云底 ${fmt(bot)} → <b>${cl > top ? "云上（多）" : cl < bot ? "云下（空）" : "云中（震荡）"}</b>`;
    }
    if (kind === "gmma" && P.g3) {
      const s = GM_S.map((m) => P["g" + m][i]), l = GM_L.map((m) => P["g" + m][i]);
      const ms = s.reduce((a, b) => a + b) / 6, ml = l.reduce((a, b) => a + b) / 6;
      const lup = l.every((v, k) => k === 0 || l[k - 1] > v), ldn = l.every((v, k) => k === 0 || l[k - 1] < v);
      const st = Math.min(...s) > Math.max(...l) && lup ? "多头发散" : Math.max(...s) < Math.min(...l) ? (ldn ? "空头发散" : "短组全部跌破长组") : ms > ml ? "交织偏多" : "交织偏空";
      t = `短期组均值 ${fmt(ms)}，长期组均值 ${fmt(ml)}（差 ${fmt((ms / ml - 1) * 100, 1)}%），长期组${lup ? "多头排列" : ldn ? "空头排列" : "缠绕"} → <b>${st}</b>`;
    }
    return `<div class="today"><div class="th">今天的读数（${name}，${P.d[i]}）</div><div class="tv">${t}</div></div>`;
  }

  const verdictCard = (mkt) => {
    const T = D.today[mkt];
    if (!T || !T.joint) return "";
    const j = T.joint, ts = T.twoside;
    return `<div class="card verdict"><div class="vh">${mkt === "cn" ? "🇨🇳 A股" : "🇺🇸 美股"}<span class="muted">数据截至 ${esc(j.data_date || T.us_date || T.date)}</span></div>
      <div class="vq">${esc(j.quadrant)}<span class="muted"> 抄底分 ${fmt(j.score / 100)} ｜ 趋势分 ${fmt(j.trend / 100)}</span></div>
      <div class="vv">${esc(j.verdict_short || j.verdict)}</div>
      ${ts ? `<div class="muted">两面法：基本面 <b>${esc(ts.fund)}</b> × ${esc(ts.main)} 技术面 <b>${esc(ts.tech[ts.main]["总结"])}</b> → ${esc(ts.verdict)}，上限 ${ts.cap}%</div>` : ""}</div>`;
  };

  // 回测徽章：backtest_badges.json（{cn|us: {指标: [结论, cls, 20日超额, 课程id, 组]}}，约 2KB）
  const BT_ALIAS = { 贪恐指数自建: "贪恐指数", 中证500情绪指标: "中证500情绪", 中证1000情绪指标: "中证1000情绪", "300波指QVIX": "QVIX", "300ETF期权PCR": "期权PCR",
    大阴线计数中证1000: "大阴线", 两市量能: "量能", "300ETF份额国家队": "300ETF份额", 期指机构持仓: "期指机构", IM贴水: "IM基差", 股债性价比ERP: "股债性价比", 科创50点位: "科创50位置" };
  const btName = (n) => BT_ALIAS[String(n || "").replace(/[()（）]/g, "")] || n;
  const sg = (v, d = 1) => (v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d));
  const btBadge = (mk, name, b, tag) => `<span class="btb ${b[1]}" data-bt="#/backtest/${mk}/i/${encodeURIComponent(name)}">${tag ? esc(tag) + " " : ""}回测：${esc(b[0])} ${sg(b[2])}</span>`;
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("[data-bt]"); if (b) { e.preventDefault(); e.stopPropagation(); location.hash = b.dataset.bt; } }, true);
  let lastEmit = null;
  const emit = (page, id) => { lastEmit = [page, id]; if (window.Cloud) window.Cloud.decorate({ page, id }); };

  // =====================================================================
  // 今日驾驶舱（首页）
  // =====================================================================
  const vcls = (v) => (/不推荐|降风险/.test(v) ? "no" : /可以考虑/.test(v) ? "yes" : "wait");
  function conclCard(mkt, R) {
    const T = D.today[mkt] || {}, j = T.joint, ts = T.twoside;
    const flag = mkt === "cn" ? "🇨🇳 A股" : "🇺🇸 美股";
    const head = `<div class="ch"><b>${flag}</b>${R ? `<a class="muted" href="#/report/${R.id}">${esc(R.date.slice(5))} ${esc(R.time)} ${esc(R.task)} 原文 ›</a>` : '<span class="muted">指标结论</span>'}</div>`;
    if (R === null) return `<div class="card concl">${head}<div class="skel"></div><div class="skel s2"></div><div class="muted small">正在读取最新报告结论…</div></div>`;
    const F = R && R.fmt;
    if (F && F.goals && F.goals.length) { // 新硬格式：🎯 每行 = 色条 + 结论词 + 标的 + 两列小网格；📏 → 仓位条 + 信息条；💡 / 👜 / ⏱
      // 「🟢 一句话看懂」只取 🗣 / 🤔 / 🔄 三行（build_reports.py 的 easy 字段）；💼 你的持仓行一律不显示
      const easy = (R.easy || []).filter(([ic, t]) => /^(🗣|🤔|🔄)/.test(ic) && !/💼|个人持仓部分不公开/.test(t));
      const easyT = easy.length ? `<div class="easy">${easy.map(([ic, t]) => { const m = String(t).match(/^([^：:]{1,10})[：:]\s*(.*)$/); return `<div><i>${esc(ic)}</i><span>${m ? `<b>${esc(m[1])}：</b>${esc(m[2])}` : esc(t)}</span></div>`; }).join("")}</div>` : "";
      const KV = [[/^目标\s*/, "目标", "tgt"], [/^止损\s*/, "止损", "stop"], [/^买入区\s*/, "买入区", ""], [/^仓位\s*/, "仓位", ""]];
      const kv = (s) => {
        for (const [re, lab, c] of KV) if (re.test(s)) return [lab, s.replace(re, ""), c];
        if (/^[≤<≥]?\s*\d+(\.\d+)?\s*%$/.test(s)) return ["仓位", s, ""];
        if (/买入区|回.{0,4}区.{0,3}买|挂\s*[¥$]?\d/.test(s)) return ["买入区", s.replace(/^买入区\s*/, ""), ""];
        return null;
      };
      const goals = F.goals.map(([lab, v, segs]) => {
        const pm = String(v).match(/^([^：:]{1,8})[：:]\s*(.+)$/), tag = pm ? pm[1] : lab, word = pm ? pm[2] : v;
        const wm = word.match(/^(.+?)([（(].*)$/);
        const [first, ...rest] = segs || [];
        const kvs = rest.map((s) => [s, kv(s)]), cells = kvs.filter((x) => x[1]), notes = kvs.filter((x) => !x[1]).map((x) => x[0]);
        return `<div class="goal v-${vcls(v)}"><div class="gh"><span class="gw">${wm ? `${esc(wm[1])}<small>${esc(wm[2])}</small>` : esc(word)}</span><span class="gtg">${esc(tag)}</span></div>
          ${first ? `<div class="gt">${esc(first)}</div>` : ""}
          ${cells.length ? `<div class="gk">${cells.map(([, [l, val, c]]) => `<div><span>${esc(l)}</span><b class="${c}">${esc(val)}</b></div>`).join("")}</div>` : ""}
          ${notes.length ? `<div class="gn">${notes.map(esc).join("；")}</div>` : ""}</div>`;
      }).join("");
      const ic = (s) => { const m = String(s).match(/^(\S{1,4})\s+(.*)$/); return m && !/[\w\u4e00-\u9fa5]/.test(m[1]) ? [m[1], m[2]] : ["•", s]; };
      const ruler = F.ruler || [], cm = ruler.length ? String(ruler[0]).match(/仓位上限\s*[≤<]?\s*(\d+)\s*%/) : null;
      const capT = cm ? `<div class="capr"><span>📏 仓位上限</span><b>${cm[1]}%</b><span class="cb"><i style="width:${Math.min(100, +cm[1])}%"></i></span></div>` : "";
      const strip = ruler.slice(cm ? 1 : 0);
      return `<div class="card concl">${head}<div class="cbody">${easyT}<div class="cl">${goals}</div><div class="cr">${capT}
        ${strip.length ? `<div class="istrip">${strip.map((x) => { const [a, b] = ic(x); return `<div><i>${esc(a)}</i><span>${esc(b)}</span></div>`; }).join("")}</div>` : ""}
        ${R.reason ? `<div class="irow"><i>💡</i><span>${esc(R.reason)}</span></div>` : ""}
        ${F.hold ? `<div class="irow hold2"><i>👜</i><span><b>已持有：</b>${esc(F.hold)}</span></div>` : ""}
        <div class="meta small">⏱ 数据：${esc(R.dtime || `${R.date} ${R.time}`)}${j ? `；指标截至 ${esc(j.data_date)}` : ""}</div></div></div></div>`;
    }
    const vs = R && R.v && R.v.length ? R.v : j ? [["指标", j.verdict_short || j.verdict, ""]] : [];
    const cap = R && R.cap != null ? R.cap : ts ? ts.cap : null;
    const tidy = (seg) => String(seg || "").replace(/^(宽基|题材|美股端|美股|综合结论)\s*[：:]?\s*/, "").replace(/^[「“]?(可以考虑(分批)?买入|等待确认|不推荐买入)[」”]?\s*[，,：:—\-]*\s*/, "").trim();
    // 旧格式只有一句「综合」结论时，把第〇章第一行里的宽基 / 题材那几段也带出来
    const extra = vs.length === 1 && !tidy(vs[0][2]) && R && R.concl && R.concl[0] ? R.concl[0].split(/[｜|]/).map((x) => x.trim()).filter((x) => x && !/^(仓位上限|一句原因)/.test(x) && !/^[「“]?(可以考虑(分批)?买入|等待确认|不推荐买入)[」”]?$/.test(x)).join("｜") : "";
    const rows = vs.map(([lab, v, seg], k) => { const t = tidy(seg) || (k === 0 ? extra : ""); return `<div class="vrow"><span class="vlab">${esc(lab)}</span><div><span class="vbig ${vcls(v)}">${esc(v)}</span>${t ? `<div class="vseg">${esc(t)}</div>` : ""}</div></div>`; }).join("");
    return `<div class="card concl">${head}<div class="cbody"><div class="cl">
      ${rows || '<div class="muted">暂无结论</div>'}</div><div class="cr">
      ${cap != null ? `<div class="cap">总仓位上限 <b>${cap}%</b></div>` : ""}
      ${R && R.reason ? `<div class="why">💡 ${esc(R.reason)}</div>` : ""}
      <div class="meta">${j ? `四象限 <b>${esc(j.quadrant)}</b>（抄底分 ${fmt(j.score / 100)}｜趋势分 ${fmt(j.trend / 100)}）` : ""}${ts ? `<br>两面法 基本面<b>${esc(ts.fund)}</b> × ${esc(ts.main)}技术面<b>${esc(ts.tech[ts.main]["总结"])}</b> → ${esc(ts.verdict)}，上限 ${ts.cap}%` : ""}</div>
      <div class="meta small">⏱ 数据：${esc(R ? R.dtime || `${R.date} ${R.time}` : "—")}${j ? `；指标截至 ${esc(j.data_date)}` : ""}</div>
    </div></div></div>`;
  }
  const GRID = [["#/account", "💼", "虚拟账户", "100万模拟盘"], ["#/reports", "📰", "报告库", "每期报告"], ["stock/", "🔎", "个股透视", "一键看懂"], ["stock/#/picks/cn", "🎯", "买卖点", "今日扫描"],
    ["#/short", "🔥", "短线", "涨停情绪"], ["#/gurus", "🗣️", "博主", "谁说得准"], ["#/board", "📊", "指标看板", "全部指标"], ["#/backtest", "🧪", "回测中心", "指标灵不灵"], ["#/academy", "📚", "指标学堂", "从零学起"], ["#/labs", "🔬", "验真", "网红策略"]];
  function shortMood(t) {
    if (!t) return null;
    const zt = t.zt, dt = t.dt, zr = t.zb_rate ?? 0, pr = t.prem ?? 0;
    if ((dt >= 30 || pr <= -1) && zt <= 50) return { n: "冰点", c: "ice", t: "亏钱效应大，短线少动手；冰点往往也是新周期起点，只用很小仓位试错。" };
    if (zt >= 100 && zr < 25 && pr >= 3) return { n: "高潮", c: "hot", t: "几乎随便买都赚钱，但高潮次日常分歧：不追高，持有的分批卖。" };
    if (zr >= 40 || (pr < 0.5 && zt >= 40)) return { n: "分歧", c: "mix", t: "封板不稳、接力赚钱效应弱，只做最强的前排，不做后排跟风。" };
    if (pr >= 2 && zt >= 60) return { n: "发酵", c: "warm", t: "接力有赚钱效应，可以关注主线前排；控制单只仓位，设好止损。" };
    return { n: "修复", c: "mix", t: "情绪在恢复中，等主线和空间板更清楚再加大参与。" };
  }
  const STAGE_C = { 冰点: "ice", 退潮: "cool", 分歧: "mix", 修复: "mix", 发酵: "warm", 高潮: "hot", 冰点期: "ice", 退潮期: "cool", 启动期: "mix", 主升期: "warm", 高潮期: "hot" };
  const ymd = (s) => String(s || "").replace(/-/g, "");
  function shortMini(S, H) {
    // S = latest.json 里的 short（shortterm.py 全市场口径）；H = short_hist.json（build.py，盘中也会更新）；谁新用谁
    const i = H && H.d ? H.d.length - 1 : -1, hd = i >= 0 ? ymd(H.d[i]) : "";
    if (S && S.stage && ymd(S.date) >= hd) {
      return `<a href="#/short"><span class="mood ${STAGE_C[S.stage[0]] || "mix"}">${esc(S.stage[0])}</span><span>涨停 <b class="up">${S.zt}</b> · 跌停 <b class="dn">${S.dt}</b> · 炸板率 ${fmt(S.zb_rate, 0)}% · 最高 ${S.top} 板 · 昨涨停今日 <b class="${updn(S.yz_prem)}">${pct(S.yz_prem, 2)}</b></span></a>
        <div class="muted small">${esc(String(S.date).slice(4, 6))}-${esc(String(S.date).slice(6, 8))}${S.intraday ? " 盘中" : " 收盘"}（${esc(String(S.at || "").slice(-5))} 计算）｜${esc(S.stage[1] || "")}</div>`;
    }
    if (i < 0) throw new Error("empty");
    const t = { zt: H.zt[i], dt: H.dt[i], zb_rate: H.zb_rate[i], prem: H.prem[i], max_lb: H.max_lb[i] }, m = shortMood(t);
    return `<a href="#/short"><span class="mood ${m.c}">${m.n}</span><span>涨停 <b class="up">${t.zt}</b> · 跌停 <b class="dn">${t.dt}</b> · 炸板率 ${fmt(t.zb_rate, 0)}% · 最高 ${t.max_lb} 板 · 昨涨停今日 <b class="${updn(t.prem)}">${pct(t.prem, 2)}</b></span></a>
      <div class="muted small">${esc(H.d[i])}${H.time && H.time[H.d[i]] ? " " + esc(H.time[H.d[i]]) + "（盘中）" : ""}｜${m.t}</div>`;
  }
  const DESK = () => !!(window.matchMedia && matchMedia("(min-width:900px)").matches);
  // 2026-11-27 u38 首页重做（老大：「网页内容太多了，也不够综合」）：
  //   以前 = 9 个快捷图标 + 信号雷达 + 12 行 K 线缩略 + 9 行市场看法 + 大事 + 「其它」6 项 + 10 宫格 + 报告，6 屏，而且报告和看法互相打架。
  //   现在 = ① 今日综合（home_build.py 把 报告 × 长期趋势 × 信号 × 新闻 合成每个市场一句话）② 今日一票 ③ 今天发生了什么 ④ 接下来 3 天 ⑤ 常用入口 + 全部 ⑥ 最新报告。别的都在「全部功能」里。
  const FEATS = [
    ["看市场", [["#/topk", "🌍", "各市场K线", "A股 / 美股 / 港 / 日韩 / 黄金代表标的，日K + 分时 + 分析"], ["#/signals", "🛰", "技术信号雷达", "顶底背离、超买超卖，各市场哪些指标异常"], ["#/xnews", "📡", "X 要闻", "推特上影响股价的消息 + 后来怎么走"], ["#/labs/views", "🧭", "各市场看法", "9 个市场偏多 / 震荡 / 偏空的依据"], ["#/cal", "📅", "大事日历", "议息 / CPI / 财报：预期、利好利空、结果"], ["#/board", "📊", "指标看板", "估值、资金、广度、情绪、技术面全部指标"], ["#/macro", "🏛", "国家宏观", "CPI / PMI / 出海信号"]]],
    ["短线 · 博主", [["#/race", "🏇", "策略赛马", "同一笔虚拟钱，哪套策略跑得好"], ["#/gurus", "🗣️", "博主", "谁说得准，命中率排名"], ["#/lhb", "🐯", "龙虎榜", "游资在买什么，跟着买有没有用"], ["#/hot", "🔥", "人气榜", "人气前排剖析"], ["#/short", "🪜", "短线情绪", "涨停、连板天梯、情绪周期"], ["#/sectors", "🧩", "板块", "能买的板块 / 回避的板块"]]],
    ["期权", [["#/opt", "🌡", "期权温度 + 个股期权", "贵不贵、恐慌不恐慌；TQQQ / NVDA 隐波"], ["#/optsim", "🎲", "期权模拟", "随机抽一段历史，自己买 call / put / 跨式"]]],
    ["我的", [["#/todo", "✅", "今天该做什么", "要做的事 + 持仓提醒"], ["#/pick", "🎯", "今日一票", "买什么、买入区、止损、概率 + 前瞻台账"], ["#/reports", "📄", "报告库", "每期报告，默认简版"], ["#/account", "💼", "虚拟账户", "100 万模拟盘，逐笔记账"], ["stock/", "🔎", "个股透视", "输入代码，一键看懂一只股票"]]],
    ["研究 · 练习", [["#/tape", "🎬", "分时练盘", "随机一天的真实分时（纳指含盘前盘后），加速回放，自己点买卖"], ["#/trend", "📟", "A股趋势状态", "布鲁斯框架 S1~S5"], ["#/labs", "🔬", "验真库", "网上流传的策略，严格重测"], ["#/backtest", "🧪", "回测中心", "各个指标、策略的历史成绩"], ["#/analog", "〰️", "相似走势", "历史上走得像今天的日子后来怎么走"], ["#/usopen", "⏱", "美股开盘惯性", "开盘 15 / 30 分钟强弱 → 之后怎么走"], ["#/train", "🕹", "K 线训练", "遮住后面逐根推"], ["#/academy", "📚", "学堂", "指标从零学起"]]],
  ];
  const HOMEQ = [["#/signals", "🛰", "信号雷达"], ["#/xnews", "📡", "X要闻"], ["#/topk", "🌍", "各市场K线"], ["#/race", "🏇", "赛马"], ["#/gurus", "🗣️", "博主"], ["#/lhb", "🐯", "龙虎榜"], ["#/opt", "🌡", "期权"], ["#/all", "▦", "全部"]];
  function allPage() {
    document.title = "全部功能 · 小七投研";
    if (!document.getElementById("all-css")) {   // 单独注入：直接打开 #/all 时首页样式还没加载
      const st = document.createElement("style"); st.id = "all-css";
      st.textContent = `.fl{padding:2px 14px}.fr{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);color:var(--text);text-decoration:none}.fr:last-child{border-bottom:0}
.fr i{font-style:normal;font-size:20px;width:28px;text-align:center;flex:none}
.fr .frt{flex:1;min-width:0;display:flex;flex-direction:column}.fr .frn{font-size:15px;font-weight:700;color:var(--text)}
.fr .frs{font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.45;font-style:normal}.fr u{text-decoration:none;color:var(--sub2);flex:none}`;
      document.head.appendChild(st);
    }
    app.innerHTML = `<h1>全部功能 <span class="muted small">${FEATS.reduce((n, g) => n + g[1].length, 0)} 个 · 按用途分组</span></h1>
      ${FEATS.map(([g, xs]) => `<h2>${esc(g)}</h2><div class="card fl">${xs.map(([h, i, t, sub]) => `<a class="fr" href="${h}"><i>${i}</i><span class="frt"><span class="frn">${esc(t)}</span><span class="frs">${esc(sub)}</span></span><u>›</u></a>`).join("")}</div>`).join("")}
      <h2>学一学</h2><div class="card fl"><a class="fr" href="#/glossary"><i>📖</i><span class="frt"><span class="frn">术语</span><span class="frs">看不懂的词查这里</span></span><u>›</u></a><a class="fr" href="#/quiz"><i>✍️</i><span class="frt"><span class="frn">测验</span><span class="frs">学完测一测</span></span><u>›</u></a></div>${DISC}`;
  }
  async function todayPage() {
    document.title = "小七投研 · 今日综合";
    const tok = routeToken;
    app.innerHTML = `
      <div id="combo" class="card combo">${LOADING()}</div>
      <div id="pickbox"></div>
      <div class="tgrid"><div class="tmain">
      <h2>🔥 今天发生了什么</h2><div id="whatbox" class="card">${LOADING()}</div>
      <h2>📅 接下来 3 天 <a class="h2a" href="#/cal">日历 ›</a></h2><div id="calbox" class="card">${LOADING()}</div>
      </div><div class="tside">
      <div class="hsearch sbox"><input id="hq" type="search" enterkeyhint="search" placeholder="🔎 搜个股：600519 / 茅台 / gzmt / NVDA" autocomplete="off"><div id="hsug" class="sug"></div></div>
      <div class="card qkbar">${HOMEQ.map(([h, i, t]) => `<a href="${h}"><i>${i}</i><span>${esc(t)}</span></a>`).join("")}</div>
      <h2>最新报告 <a class="h2a" href="#/reports">全部 ›</a></h2><div id="recent" class="list">${LOADING()}</div>
      </div></div>
      ${DISC}`;
    if (!document.getElementById("home-css")) {
      const st = document.createElement("style"); st.id = "home-css";
      st.textContent = `.qkbar{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 2px;padding:10px 4px;margin:12px 0}
.qkbar a{display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;color:var(--text);font-size:12px;padding:4px 0;border-radius:8px}
.qkbar a:active{background:var(--soft)}.qkbar i{font-style:normal;font-size:22px;line-height:1.1}.qkbar span{white-space:nowrap}
.combo{padding:14px 16px 10px;border-top:5px solid var(--brand);margin:0 0 12px}
.cb-h{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--sub)}.cb-h a{color:var(--brand);font-weight:600}
.cb-one{font-size:21px;font-weight:900;line-height:1.35;margin:6px 0 8px;letter-spacing:.2px}
.cb-m{display:block;padding:10px 0;border-top:1px solid var(--line);color:var(--text);text-decoration:none}
.cb-m .nm{font-size:15px;font-weight:800;margin-right:8px}.cb-m .gw{font-size:17px;font-weight:900;white-space:nowrap}
.cb-m .ln{display:block;font-size:14px;line-height:1.6;margin-top:3px}.cb-m .src{display:block;font-size:12px;color:var(--sub);line-height:1.55;margin-top:2px}
@media(min-width:900px){.cb-m{display:grid;grid-template-columns:52px 86px 1fr;gap:2px 10px;align-items:baseline}.cb-m .ln{margin:0}.cb-m .src{grid-column:3;margin:0}}
.g-buy .gw{color:var(--up)}.g-small .gw{color:var(--warn,#d98a00)}.g-wait .gw{color:var(--sub)}.g-no .gw{color:var(--down,#1f9d55)}
.cb-o{font-size:12.5px;color:var(--sub);padding:9px 0 4px;border-top:1px solid var(--line);line-height:1.7}.cb-o b{font-weight:700}
.cb-r{font-size:13px;line-height:1.6;background:var(--soft);border-radius:8px;padding:7px 10px;margin:6px 0 4px}
.cb-rule{font-size:11.5px;color:var(--sub2);margin-top:6px;line-height:1.5}
.wh{display:block;padding:8px 0;border-bottom:1px solid var(--line);font-size:14.5px;line-height:1.55;color:var(--text);text-decoration:none}.wh:last-child{border-bottom:0}
.wh small{color:var(--sub);font-size:12px}
.fr i{font-style:normal;font-size:20px;width:28px;text-align:center;flex:none}.fr .frt{flex:1;min-width:0;display:flex;flex-direction:column}.fr .frn{font-size:15px;font-weight:700;color:var(--text)}.fr .frs{font-size:12.5px;color:var(--sub);margin-top:2px;line-height:1.45;font-style:normal}.fr u{text-decoration:none;color:var(--sub2);flex:none}`;
      document.head.appendChild(st);
    }
    bindSearch();
    const VW = { up: "看多", flat: "震荡", down: "看空" }, GW = { buy: "可以买", small: "只能小仓", wait: "等", no: "别买" };
    getJSON("home.json", true).then((H) => {
      if (tok !== routeToken || !H) return;
      $("#combo").innerHTML = `<div class="cb-h"><span>今日综合 · ${esc(H.built.slice(5))}</span><a href="#/todo">今天要做的事 ›</a></div>
        <div class="cb-one">${esc(H.head)}</div>
        ${H.markets.map((m) => { const r = m.report || {}, t = m.trend || {};
          return `<a class="cb-m g-${esc(m.grade)}" href="${r.id ? "#/report/" + esc(r.id) : "#/labs/views"}"><span class="nm">${esc(m.name)}</span><span class="gw">${GW[m.grade] || ""}</span><span class="ln">${esc(m.line)}</span>
          <span class="src">报告「${esc(r.word || "—")}」${r.cap != null ? `·仓位≤${esc(r.cap)}%` : ""} × 长期趋势${esc(t.word || "")}${t.d200 != null ? `（离200日线 ${t.d200 > 0 ? "+" : ""}${esc(t.d200)}%）` : ""}${r.task ? ` · ${esc(r.task)} ${esc((r.at || "").slice(5))}` : ""}</span></a>`; }).join("")}
        ${(H.others || []).length ? `<div class="cb-o">其它市场：${H.others.map((o) => `${esc(o.name)} <b class="${o.view === "up" ? "up" : o.view === "down" ? "dn" : ""}">${VW[o.view] || "—"}</b>`).join(" · ")}　<a href="#/labs/views">依据 ›</a></div>` : ""}
        ${H.risk ? `<div class="cb-r">⚠️ ${esc(H.risk)}</div>` : ""}
        <div class="cb-rule">怎么合的：${esc(H.rule)}</div>`;
      const what = [];
      (H.top3 || []).forEach((t) => what.push(`<a class="wh" href="${H.top3_src ? "#/report/" + esc(H.top3_src) : "#/reports"}">${esc(t)}</a>`));
      (H.news || []).slice(0, 2).forEach((x) => what.push(`<a class="wh" href="#/xnews">📡 ${x.dir === "利空" ? "🟢" : x.dir === "利好" ? "🔴" : "🟡"} ${esc(x.zh)} <small>${esc(x.author || "")} ${esc(x.bj || "")}</small></a>`));
      if (H.signals && H.signals.n) what.push(`<a class="wh" href="#/signals">🛰 技术信号：${H.signals.n} 条重要信号（背离 / 200 日线），历史上只当温度计 <small>看各市场 ›</small></a>`);
      $("#whatbox").innerHTML = what.join("") || '<span class="muted">今天还没有新消息</span>';
      const TC = { up: "#e5484d", down: "#2fa86b", mixed: "#e8aa00", flat: "#9aa3ad" }, TT = { up: "利好", down: "利空", mixed: "看结果", flat: "影响小" };
      $("#calbox").innerHTML = (H.events || []).length ? H.events.map((e) => `<a class="wh" href="#/cal/e/${encodeURIComponent(e.id)}" style="border-left:4px solid ${TC[e.tone] || TC.flat};padding-left:10px">
          <b>${esc(e.date.slice(5))} 周${esc(wk(e.date))}${e.time ? " " + esc(e.time) : ""}</b> ${esc(e.flag || "")} ${esc(e.title)} <small>${e.one ? esc(e.one) + "｜" : ""}<b style="color:${TC[e.tone] || TC.flat}">${TT[e.tone] || ""}</b></small></a>`).join("")
        : '<span class="muted">这 3 天没有两星以上的大事</span>';
    }).catch(() => { if (tok === routeToken) $("#combo").innerHTML = '今日综合暂未生成。<a href="#/todo">看今天该做什么 ›</a>'; });
    Promise.all([getJSON("pick.json", true), window.__mod_pick ? 0 : loadScript(`pick.js?v=${ver}`)]).then(([J]) => {
      const el = $("#pickbox"); if (tok !== routeToken || !el || !J || !window.__mod_pick) return;
      el.innerHTML = window.__mod_pick.heroHTML(J);
    }).catch(() => {});
    getJSON("reports/latest.json", true).then((R) => {
      if (tok !== routeToken) return;
      const seen = {}, rec = (R.recent || []).filter((x) => (seen[x.mkt] ? false : (seen[x.mkt] = 1)));
      $("#recent").innerHTML = rec.map(reportItem).join("") || '<div class="card muted">暂无报告</div>';
    }).catch(() => { if (tok === routeToken) $("#recent").innerHTML = FAIL("报告列表加载失败"); });
  }

  // 2026-11-28 简版图卡（老大：「简版还是一堆文字，做成图片形式，标清楚就好，复杂的再点过去看」；数据 brief_card.py → R.card）
  function vcardHTML(c, R) {
    const TN = { up: ["利好", "t-up"], down: ["利空", "t-dn"], mid: ["看结果", "t-md"] };
    const GI = { buy: "▲", small: "◐", wait: "⏸", no: "✕" };
    const cap = c.cap != null ? Math.max(0, Math.min(100, +c.cap)) : null;
    const li = (xs, ic) => xs.map((x) => `<div class="vc-li"><i>${ic}</i><span>${esc(x)}</span></div>`).join("");
    return `<div class="vc g-${esc(c.grade)}">
      <div class="vc-top"><div class="vc-gw"><b>${GI[c.grade] || ""}</b>${esc(c.word)}</div>
        <div class="vc-tt">${esc((c.title || R.title || "").replace(/^[^\u4e00-\u9fa5\\d]+/, ""))}<small>${esc(R.date.slice(5))} ${esc(R.time)}${c.sub ? " · " + esc(c.sub) : ""}</small></div></div>
      ${(c.rows || []).length ? `<div class="vc-rows">${c.rows.map((r) => `<span class="vc-chip g-${esc(r.g)}">${esc(r.k)} <b>${esc(r.w)}</b></span>`).join("")}</div>` : ""}
      ${cap != null ? `<div class="vc-cap"><span>仓位上限</span><div class="bar"><i style="width:${cap}%"></i></div><b>${cap}%</b></div>` : ""}
      ${(c.do || []).length ? `<div class="vc-sec"><h4>✅ 今天怎么做</h4>${li(c.do, "→")}</div>` : ""}
      ${(c.top3 || []).length ? `<div class="vc-sec"><h4>🔥 最重要的 ${c.top3.length} 件事</h4><div class="vc-t3">${c.top3.map((t, i) => `<div class="vc-t ${TN[t.tone] ? TN[t.tone][1] : "t-md"}"><em>${i + 1}</em><span>${esc(t.t)}</span><u>${TN[t.tone] ? TN[t.tone][0] : ""}</u></div>`).join("")}</div></div>` : ""}
      ${c.up || c.dn ? `<div class="vc-ud">${c.up ? `<div class="u"><h5>▲ 转好信号</h5>${esc(c.up)}</div>` : ""}${c.dn ? `<div class="d"><h5>▼ 转坏信号</h5>${esc(c.dn)}</div>` : ""}</div>` : ""}
      ${(c.hold || []).length ? `<div class="vc-sec"><h4>💼 你的持仓</h4>${li(c.hold, "·")}</div>` : ""}
      ${c.pick ? `<div class="vc-sec"><h4>🎯 今日一票</h4><div class="vc-li"><i>·</i><span>${esc(c.pick)}</span></div></div>` : ""}
      ${(c.news || []).length ? `<div class="vc-sec"><h4>📡 X 要闻</h4>${c.news.map((n) => `<div class="vc-n"><u class="${TN[n.tone] ? TN[n.tone][1] : "t-md"}">${TN[n.tone] ? TN[n.tone][0] : ""}</u><span>${esc(n.t)}</span><small>${esc(n.who || "")}</small></div>`).join("")}</div>` : ""}
      ${c.sig ? `<div class="vc-sig">🛰 ${esc(c.sig)}</div>` : ""}
      ${c.why ? `<div class="vc-why">为什么：${esc(c.why)}</div>` : ""}
      <a class="vc-more" href="javascript:;" data-rm="full">看完整版（数字 · 依据 · 图表）›</a>
    </div>`;
  }

  function bindSearch() {
    const q = $("#hq"), sug = $("#hsug");
    if (!q) return;
    let items = [], timer = null, idx = -1;
    const go = (sym) => { location.href = "stock/#/s/" + encodeURIComponent(sym); };
    q.addEventListener("focus", () => needEngine().catch(() => {}), { once: true });
    q.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const v = q.value.trim();
        if (!v) { sug.style.display = "none"; return; }
        try {
          await needEngine();
          const r = await window.SSEngine.search(v);
          if (v !== q.value.trim()) return;
          items = r || []; idx = -1;
          sug.innerHTML = items.map((it) => `<a href="stock/#/s/${esc(it.sym)}"><span>${esc(it.name)} <span class="m">${esc(it.code)}</span></span><span class="m">${esc(it.market)}·${esc(it.kind)}</span></a>`).join("") || '<div class="muted" style="padding:10px 14px">没找到，换个关键词试试</div>';
          sug.style.display = "block";
        } catch (e) { sug.innerHTML = '<div class="muted" style="padding:10px 14px">搜索暂时不可用，按回车直接去个股透视查</div>'; sug.style.display = "block"; }
      }, 220);
    });
    q.addEventListener("keydown", (e) => {
      const as = $$("a", sug);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!as.length) return; idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + as.length) % as.length; as.forEach((a, i) => a.classList.toggle("on", i === idx)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const it = items[idx >= 0 ? idx : 0];
        if (it) go(it.sym); else if (q.value.trim()) location.href = "stock/#/q/" + encodeURIComponent(q.value.trim());
      }
    });
  }
  document.addEventListener("click", (e) => { if (!e.target.closest(".hsearch")) $$(".hsearch .sug").forEach((s) => (s.style.display = "none")); });

  // =====================================================================
  // 报告库
  // =====================================================================
  const TASK_ORDER = ["集合竞价", "午间复盘", "尾盘决策", "收盘速览", "盘后综合", "美股盘前", "美股开盘", "美股收盘", "大类资产"];
  const MK = { cn: "🇨🇳", us: "🇺🇸", gb: "🌐" };
  const vchips = (v) => (v || []).map(([lab, x]) => `<span class="vchip ${vcls(x)}">${esc(lab)}·${esc(x)}</span>`).join("");
  const reportItem = (x) => `<a class="card ritem" href="#/report/${x.id}"><div class="rt1"><span class="rtime">${esc(x.date.slice(5))} ${esc(x.time)}</span><span class="rtask ${x.mkt}">${MK[x.mkt] || ""} ${esc(x.task)}</span>${x.cap != null ? `<span class="rcap">仓位≤${x.cap}%</span>` : ""}</div>
    <div class="rtitle">${esc(x.title)}</div>${x.v && x.v.length ? `<div class="vchips">${vchips(x.v)}</div>` : ""}${x.sum ? `<div class="rsum">${esc(x.sum)}</div>` : ""}</a>`;
  const RF = { m: "", t: "", q: "", d: "", mon: "" };
  async function reportsPage() {
    document.title = "报告库 · 小七投研";
    const tok = routeToken;
    app.innerHTML = `<h1>报告库</h1>${LOADING()}`;
    let idx;
    try { idx = await getJSON("reports/index.json", true); } catch (e) { if (tok === routeToken) app.innerHTML = `<h1>报告库</h1>${FAIL()}`; return; }
    if (tok !== routeToken) return;
    const tasks = TASK_ORDER.filter((t) => idx.some((x) => x.task === t)).concat([...new Set(idx.map((x) => x.task))].filter((t) => !TASK_ORDER.includes(t)));
    const days = new Set(idx.map((x) => x.date));
    const months = [...new Set(idx.map((x) => x.date.slice(0, 7)))].sort();
    if (!RF.mon || !months.includes(RF.mon)) RF.mon = months[months.length - 1];
    app.innerHTML = `<h1>报告库 <span class="muted small">共 ${idx.length} 期</span></h1>
      <input id="rq" class="search" type="search" placeholder="搜标题 / 结论关键词，如 中证1000、CPI、光模块" value="${esc(RF.q)}">
      <div class="chips" id="rm">${[["", "全部"], ["cn", "🇨🇳 A股"], ["us", "🇺🇸 美股"], ["gb", "🌐 大类资产"]].map(([k, n]) => `<a class="chip" data-m="${k}">${n}</a>`).join("")}</div>
      <div class="chips scroll" id="rt"><a class="chip" data-t="">全部任务</a>${tasks.map((t) => `<a class="chip" data-t="${esc(t)}">${esc(t)}</a>`).join("")}</div>
      <details class="cal" ${RF.d ? "open" : ""}><summary>📅 按日历看${RF.d ? `：${RF.d}` : ""}</summary><div id="calbox"></div></details>
      <div id="rlist"></div>${DISC}`;
    const cal = () => {
      const [y, m] = RF.mon.split("-").map(Number), first = new Date(Date.UTC(y, m - 1, 1)), nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const pad = (first.getUTCDay() + 6) % 7, mi = months.indexOf(RF.mon);
      let cells = "一二三四五六日".split("").map((w) => `<b>${w}</b>`).join("") + "<i></i>".repeat(pad);
      for (let d = 1; d <= nd; d++) {
        const ds = `${RF.mon}-${String(d).padStart(2, "0")}`, n = idx.filter((x) => x.date === ds).length;
        cells += days.has(ds) ? `<a data-d="${ds}" class="${RF.d === ds ? "on" : ""}">${d}<sup>${n}</sup></a>` : `<span>${d}</span>`;
      }
      $("#calbox").innerHTML = `<div class="calh"><a data-mon="${months[mi - 1] || ""}" class="${mi > 0 ? "" : "off"}">‹</a><b>${y} 年 ${m} 月</b><a data-mon="${months[mi + 1] || ""}" class="${mi < months.length - 1 ? "" : "off"}">›</a></div>
        <div class="calg">${cells}</div>${RF.d ? '<a class="chip" data-d="">看全部日期</a>' : ""}`;
    };
    const render = () => {
      $$("#rm .chip").forEach((a) => a.classList.toggle("on", a.dataset.m === RF.m));
      $$("#rt .chip").forEach((a) => a.classList.toggle("on", a.dataset.t === RF.t));
      $(".cal summary").textContent = `📅 按日历看${RF.d ? `：${RF.d}` : ""}`;
      cal();
      const kw = RF.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const xs = idx.filter((x) => (!RF.m || x.mkt === RF.m) && (!RF.t || x.task === RF.t) && (!RF.d || x.date === RF.d) &&
        kw.every((k) => (x.title + x.sum + x.task + x.date + (x.v || []).flat().join("")).toLowerCase().includes(k)));
      const g = {};
      xs.forEach((x) => (g[x.date] = g[x.date] || []).push(x));
      const dk = Object.keys(g).sort().reverse(), lim = (RF.q || RF.d || RF.all) ? dk.length : 3;
      $("#rlist").innerHTML = dk.slice(0, lim).map((d) => `<h3 class="dhead">${d.slice(5).replace("-", " 月 ")} 日 · 周${wk(d)}<span class="muted small">${g[d].length} 期</span></h3><div class="list">${g[d].map(reportItem).join("")}</div>`).join("")
        + (dk.length > lim ? `<a class="card" id="rmore" href="javascript:;" style="display:block;text-align:center;font-weight:700;color:var(--brand)">看更早的 ${dk.length - lim} 天 ›</a>` : "")
        || '<div class="card muted">没有符合条件的报告，换个筛选试试。</div>';
      const mo = $("#rmore"); if (mo) mo.addEventListener("click", () => { RF.all = 1; render(); });
    };
    $("#rq").addEventListener("input", (e) => { RF.q = e.target.value; render(); });
    app.onclick = (e) => {
      const a = e.target.closest("[data-m],[data-t],[data-d],[data-mon]");
      if (!a || !app.contains(a)) return;
      e.preventDefault();
      if (a.dataset.m !== undefined) RF.m = a.dataset.m;
      if (a.dataset.t !== undefined) RF.t = a.dataset.t;
      if (a.dataset.d !== undefined) RF.d = RF.d === a.dataset.d ? "" : a.dataset.d;
      if (a.dataset.mon !== undefined) { if (!a.dataset.mon) return; RF.mon = a.dataset.mon; }
      render();
    };
    render();
  }

  async function reportPage(id) {
    const tok = routeToken;
    app.innerHTML = `<div class="crumb"><a href="#/reports">报告库</a></div>${LOADING("正在加载报告…")}`;
    let idx, R;
    try { [idx, R] = await Promise.all([getJSON("reports/index.json", true), getJSON(`reports/${encodeURIComponent(id)}.json`, true)]); }
    catch (e) { if (tok === routeToken) app.innerHTML = `<div class="crumb"><a href="#/reports">报告库</a></div>${FAIL("报告加载失败（可能已下线或网络不好）")}`; return; }
    if (tok !== routeToken) return;
    document.title = R.title + " · 小七投研";
    const i = idx.findIndex((x) => x.id === id), older = idx[i + 1], newer = idx[i - 1];
    const same = idx.filter((x) => x.task === R.task), si = same.findIndex((x) => x.id === id), sOlder = same[si + 1];
    const toc = (R.toc || []).filter((t, k) => t[1] <= 3 && !(k === 0 && t[1] === 1)).map(([hid, lv, t]) => `<a data-h="${hid}" class="l${lv}">${esc(t)}</a>`).join("");
    const pg = (x, dir) => (x ? `<a href="#/report/${x.id}" class="${dir}">${dir === "prev" ? "‹ 上一期" : "下一期 ›"}<em>${esc(x.date.slice(5))} ${esc(x.time)} ${esc(x.task)}</em></a>` : "<span></span>");
    app.innerHTML = `<div class="crumb"><a href="#/reports">报告库</a> / <a href="#/reports" data-task="${esc(R.task)}">${esc(R.task)}</a></div>
      <h1 class="rh">${esc(R.title)}</h1>
      <div class="rmeta"><span class="rtask ${R.mkt}">${MK[R.mkt] || ""} ${esc(R.task)}</span> ${esc(R.date)} ${esc(R.time)}${R.cap != null ? ` · <b>仓位上限 ${R.cap}%</b>` : ""}</div>
      ${R.v && R.v.length ? `<div class="vchips">${vchips(R.v)}</div>` : ""}
      <div class="pager top">${pg(older, "prev")}${pg(newer, "next")}</div>
      ${R.brief || R.card ? `<div class="rmode"><a href="javascript:;" data-rm="brief">🖼 图卡</a><a href="javascript:;" data-rm="full">📚 完整版</a></div>` : ""}
      <div id="rbrief" class="rbody rbrief">${R.card ? vcardHTML(R.card, R) : `<article class="report">${R.brief || ""}</article>`}</div>
      <div id="rfull">
      ${toc ? `<details class="toc"><summary>📑 目录（点开跳到章节；右下角按钮随时可开）</summary><div class="tocl">${toc}</div></details>` : ""}
      <div class="rbody"><article class="report">${R.html}</article>${toc ? `<aside class="rside"><div class="rsh">📑 目录</div><div class="tocl">${toc}</div></aside>` : ""}</div>
      </div>
      <div class="pager">${pg(older, "prev")}${pg(newer, "next")}</div>
      ${sOlder ? `<p class="muted small">同类上一期：<a href="#/report/${sOlder.id}">${esc(sOlder.date)} ${esc(sOlder.time)} ${esc(sOlder.title)}</a></p>` : ""}
      ${DISC}
      ${toc ? `<button class="fab" id="fab" aria-label="目录">☰</button><div id="tocpop" class="tocpop"><div class="tocl">${toc}</div></div>` : ""}`;
    const crumbTask = app.querySelector("[data-task]");
    if (crumbTask) crumbTask.addEventListener("click", () => { RF.t = R.task; RF.d = ""; });
    // 2026-11-27 老大：报告默认简版、能切完整版（记住上次选的）；没有简版的老报告直接显示完整版
    const setMode = (m) => {
      if (!R.brief && !R.card) m = "full";
      const b = $("#rbrief"), f = $("#rfull"), fb = $("#fab");
      if (b) b.style.display = m === "brief" ? "" : "none";
      if (f) f.style.display = m === "full" ? "" : "none";
      if (fb) fb.style.display = m === "full" ? "" : "none";
      $$(".rmode a").forEach((a) => a.classList.toggle("on", a.dataset.rm === m));
      try { localStorage.setItem("rp_mode", m); } catch (e) {}
    };
    $$(".rmode a, .vc-more").forEach((a) => a.addEventListener("click", () => { setMode(a.dataset.rm); window.scrollTo({ top: 0 }); }));
    $$("#rbrief a[href*='#/report/']").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); setMode("full"); window.scrollTo({ top: 0 }); }));
    setMode((() => { try { return localStorage.getItem("rp_mode") || "brief"; } catch (e) { return "brief"; } })());
    const jump = (e) => {
      const a = e.target.closest("[data-h]");
      if (!a) return;
      e.preventDefault();
      const el = document.getElementById(a.dataset.h);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
      const pop = $("#tocpop"); if (pop) pop.classList.remove("show");
    };
    $$(".tocl").forEach((t) => t.addEventListener("click", jump));
    const fab = $("#fab");
    if (fab) fab.onclick = () => $("#tocpop").classList.toggle("show");
    $$(".report img").forEach((im) => im.addEventListener("click", () => lightbox(im.src, im.alt)));
    $$(".report table").forEach((t) => { if (!t.parentElement.classList.contains("tablewrap")) { const w = document.createElement("div"); w.className = "tablewrap"; t.before(w); w.appendChild(t); } });
  }
  // 电脑版报告详情：右侧粘性目录高亮当前章节（.rside 只在 ≥900px 显示）
  let spyRaf = 0;
  window.addEventListener("scroll", () => {
    if (spyRaf) return;
    spyRaf = requestAnimationFrame(() => {
      spyRaf = 0;
      const side = $(".rside");
      if (!side || !side.offsetParent) return;
      const as = $$("a[data-h]", side);
      let cur = null;
      for (const a of as) { const el = document.getElementById(a.dataset.h); if (!el) continue; if (el.getBoundingClientRect().top < 120) cur = a; else break; }
      as.forEach((a) => a.classList.toggle("on", a === cur));
      if (cur && (cur.offsetTop < side.scrollTop || cur.offsetTop > side.scrollTop + side.clientHeight - 40)) side.scrollTop = cur.offsetTop - side.clientHeight / 2;
    });
  }, { passive: true });
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

  // 短线页（short.js）、回测中心（bt.js）按需加载，见文件末尾 needMod

  // =====================================================================
  // 指标看板
  // =====================================================================
  const CAT_ORDER = ["基本面·估值", "基本面·资金", "基本面·信用", "基本面·股债", "基本面·广度", "情绪", "技术面", "其他"];
  const normCat = (c) => (/^情绪/.test(c) ? "情绪" : /^技术面/.test(c) ? "技术面" : CAT_ORDER.includes(c) ? c : "其他");
  const zcls = (z) => (/买|偏多|趋势强|多头/.test(z || "") ? "zb" : /卖|偏空|趋势弱|过热|空头/.test(z || "") ? "zs" : "zm");
  function spark(v, cls) {
    const xs = (v || []).filter((x) => x !== null);
    if (xs.length < 3) return '<svg class="spk"></svg>';
    const lo = Math.min(...xs), hi = Math.max(...xs), W = 120, Hh = 34, r = hi - lo || 1;
    const pts = v.map((x, i) => (x === null ? null : [(i / (v.length - 1)) * W, Hh - 3 - ((x - lo) / r) * (Hh - 6)])).filter(Boolean);
    const last = pts[pts.length - 1];
    return `<svg class="spk ${cls}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><polyline points="${pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6"/></svg>`;
  }
  async function boardPage(mkt) {
    mkt = mkt === "us" ? "us" : "cn";
    document.title = "指标看板 · 小七投研";
    const tok = routeToken;
    app.innerHTML = `<h1>指标看板</h1>${LOADING()}`;
    let B, BB, RL;
    try { [B, BB, , RL] = await Promise.all([getJSON("board.json"), getJSON("backtest_badges.json", true).catch(() => null), needContent().catch(() => {}), needRules()]); } catch (e) { if (tok === routeToken) app.innerHTML = `<h1>指标看板</h1>${FAIL()}`; return; }
    if (tok !== routeToken) return;
    const T = D.today[mkt] || {}, j = T.joint, ts = T.twoside;
    const items = B.items.filter((x) => x.m === mkt);
    const g = {};
    items.forEach((x) => (g[normCat(x.cat)] = g[normCat(x.cat)] || []).push(x));
    const card = (x) => {
      const lid = lessonFor(mkt, x.name), zc = zcls(x.zone), sub = x.cat !== normCat(x.cat) && normCat(x.cat) !== "其他" ? x.cat.replace(/^.*?[（(]/, "").replace(/[)）]$/, "") : "";
      const bn = btName(x.name), bb = BB && BB[mkt] && BB[mkt][bn];
      const inner = `<div class="bh"><b>${esc(x.name)}</b><span class="zt ${zc}">${esc(x.zone && x.zone !== "—" ? x.zone : "参考")}</span></div>
        <div class="bv">${esc(x.val)}</div>${spark(x.spark, zc)}
        ${x.pct != null ? `<div class="pbar"><i style="left:${Math.max(0, Math.min(100, x.pct))}%"></i></div><div class="muted small">历史分位 ${fmt(x.pct, 0)}%　数据 ${esc(x.date)}</div>` : `<div class="pbar nil"></div><div class="muted small">数据 ${esc(x.date)}${sub ? " · " + esc(sub) : ""}</div>`}
        <div class="bread">${esc(x.read || "")}</div>${RL && window.RULES ? window.RULES.mini(window.RULES.find(RL, mkt, bn)) : ""}${bb ? btBadge(mkt, bn, bb) : ""}${lid ? '<div class="blink">看大图和讲解 ›</div>' : ""}`;
      return lid ? `<a class="bcard ${zc}" href="#/lesson/${lid}">${inner}</a>` : `<div class="bcard ${zc}">${inner}</div>`;
    };
    const cnt = (k) => items.filter((x) => zcls(x.zone) === k).length;
    const techRows = ts && ts.tech ? Object.entries(ts.tech).map(([idx, t]) => `<tr><td><b>${esc(idx)}</b>${idx === ts.main ? " ★" : ""}</td>${["轨道趋势", "轨道内位置", "KDJ", "MACD", "总结"].map((k) => `<td class="${/多|金叉|中轨上|上轨/.test(t[k] || "") && !/空/.test(t[k] || "") ? "up" : /空|死叉|中轨下|下轨/.test(t[k] || "") ? "dn" : ""}">${esc(t[k] || "—")}</td>`).join("")}</tr>`).join("") : "";
    const qc = (q) => (/[①]/.test(q || "") ? "yes" : /[②③]/.test(q || "") ? "wait" : /[④]/.test(q || "") ? "no" : "");
    const tc = (v) => (/多|积极|买/.test(v || "") ? "yes" : /空|回避|不/.test(v || "") ? "no" : "wait");
    const nb = cnt("zb"), ns = cnt("zs"), nm = cnt("zm"), nt = nb + ns + nm || 1;
    app.innerHTML = `<h1>指标看板</h1>
      <div class="chips"><a class="chip ${mkt === "cn" ? "on" : ""}" href="#/board/cn">🇨🇳 A股</a><a class="chip ${mkt === "us" ? "on" : ""}" href="#/board/us">🇺🇸 美股</a></div>
      ${j ? `<div class="qcards"><div class="qcard v-${qc(j.quadrant)}"><span>四象限</span><b>${esc(j.quadrant)}</b><em>抄底分 ${fmt(j.score / 100)}｜趋势分 ${fmt(j.trend / 100)}</em></div>
        ${ts ? `<div class="qcard v-${tc(ts.verdict)}"><span>两面法</span><b>${esc(ts.verdict)}</b><em>基本面 ${esc(ts.fund)} × ${esc(ts.main)} 技术面 ${esc(ts.tech[ts.main]["总结"])}</em><div class="qcap">仓位上限 <b>${ts.cap}%</b></div></div>` : ""}
        <div class="qdist"><div class="qt"><span class="muted">今日 ${nt} 个指标</span><span class="muted">指标截至 ${esc(j.data_date || "")}</span></div>
          <div class="qbar"><i class="b" style="width:${(nb / nt) * 100}%"></i><i class="m" style="width:${(nm / nt) * 100}%"></i><i class="s" style="width:${(ns / nt) * 100}%"></i></div>
          <div class="qt"><span class="up">买入/偏多 <b>${nb}</b></span><span class="muted">中性 <b>${nm}</b></span><span class="dn">卖出/偏空 <b>${ns}</b></span></div></div></div>` : ""}
      <details class="howto"><summary>怎么看这些卡片 ⓘ</summary>
      ${RL ? `<p class="muted small">卡片里灰底那行 = <b>回测口径的买卖条件</b>（原始值，<span class="rb" style="color:#c81e1e">买</span> = 进回测买入区，<span style="color:#15803d">卖</span> = 进卖出区），和回测中心逐日核对一致；⚠️ = 看板上方的老读法和回测方向不同，以条件行为准。点卡片看完整条件和「触发后怎么做」。</p>` : ""}
      <p class="muted small">卡片上的「回测：…」= 这个指标进买入区后 20 日的历史超额（个点），点它看<a href="#/backtest/${mkt}">回测中心</a>详情。颜色按 A 股习惯：<span class="zt zb">红 = 买入区 / 偏多</span> <span class="zt zs">绿 = 卖出区 / 偏空</span> <span class="zt zm">灰 = 中性</span>。迷你线是近半年走势，点卡片看大图和讲解。</p></details>
      <div class="bgroups">${CAT_ORDER.filter((k) => g[k]).map((k) => `<section class="bsec n${Math.min(g[k].length, 4)}"><h2>${k}</h2><div class="bgrid">${g[k].map(card).join("")}</div></section>`).join("")}</div>
      ${techRows ? `<h2>技术面（两面法） <a class="h2a" href="#/lesson/twoside">怎么看 ›</a></h2><div class="tablewrap"><table class="tbl"><tr><th>指数</th><th>一目云</th><th>布林位置</th><th>KDJ</th><th>VWMACD</th><th>总结</th></tr>${techRows}</table></div>
        <p class="muted small">★ = 两面法用来定仓位的主指数。📖 怎么读：每行一个指数，四个技术指标各给一个状态（红＝偏多、绿＝偏空），「总结」综合四项；主指数的总结再和基本面一起决定仓位上限。</p>` : ""}
      <p class="muted small">看板数据生成于 ${esc(B.built)}，与当天仪表盘一致；盘中不会自动刷新。</p>${DISC}`;
  }

  // =====================================================================
  // 指标学堂（原首页挪到 #/academy，旧路由不变）
  // =====================================================================
  function subnav(on) {
    const items = [["#/academy", "学堂首页"], ...window.CATS.map((c) => ["#/cat/" + c.id, c.name]), ["#/strategies", "策略库"], ["#/glossary", "术语"], ["#/quiz", "测验"], ["#/me", "我的"]];
    return `<div class="chips scroll subnav">${items.map(([h, n]) => `<a class="chip ${h === on ? "on" : ""}" href="${h}">${n}</a>`).join("")}</div>`;
  }
  const crumbA = '<a href="#/academy">学堂</a>';
  function academyHome() {
    document.title = "小七指标学堂 · 七天看懂市场指标";
    const cats = window.CATS.map((c) => {
      const ls = L.filter((x) => x.cat === c.id);
      return `<a class="card cat" href="#/cat/${c.id}"><div class="ct">${c.name}<span class="badge">${ls.length} 课</span></div><div class="muted">${c.desc}</div></a>`;
    }).join("");
    const path = window.PATH.map((p) => `<div class="pday"><div class="pd">${p.day}</div><div><b>${p.t}</b><div class="plinks">${p.items.filter((id) => byId[id]).map((id) => `<a href="#/lesson/${id}">${byId[id].title.split("：")[0]}</a>`).join("")}</div></div></div>`).join("");
    app.innerHTML = `${subnav("#/academy")}
      <section class="hero"><h1>小七指标学堂</h1><p class="tagline">七天看懂市场指标</p><p>每个指标都配真实走势曲线和买卖区域，用今天的数据边看边学。看懂这里，就能看懂每天的综合报告。</p>
        <div class="muted">数据更新：${esc(D.meta.built)}</div></section>
      <div id="myprogress"></div>
      <h2>今天的结论</h2><div class="grid2">${verdictCard("cn")}${verdictCard("us")}</div>
      <p class="muted">只是指标层面的结论，最终结论以每份综合报告第一章为准（还会结合题材、外围和新消息）。<a href="#/">看今日驾驶舱 →</a>　<a href="#/lesson/report">怎么读报告 →</a></p>
      <h2>学习路线</h2><div class="card">${path}</div>
      <h2>按分类学</h2><div class="grid3">${cats}
        <a class="card cat" href="#/strategies"><div class="ct">策略库<span class="badge">${D.strategies.list.length + 1} 个</span></div><div class="muted">网上流行的均线、轮动、RSRS、股债平衡、定投、网格……统一口径回测，看看哪些近两年还有效</div></a>
        <a class="card cat" href="#/glossary"><div class="ct">术语表<span class="badge">${window.GLOSSARY.length} 条</span></div><div class="muted">遇到看不懂的词先查这里</div></a>
        <a class="card cat" href="#/quiz"><div class="ct">小测验<span class="badge">${window.QUIZ.length} 题</span></div><div class="muted">学完测一测，看看是不是真懂了</div></a></div>
      <p class="disclaimer">仅供学习研究，不构成投资建议。所有回测基于历史数据，不代表未来。</p>`;
    emit("home");
  }

  function catPage(id) {
    const c = window.CATS.find((x) => x.id === id);
    if (!c) return academyHome();
    const ls = L.filter((x) => x.cat === id);
    app.innerHTML = `${subnav("#/cat/" + id)}<div class="crumb">${crumbA} / ${c.name}</div><h1>${c.name}</h1><p class="muted">${c.desc}</p>
      <div class="list">${ls.map((x) => `<a class="card item" href="#/lesson/${x.id}"><div class="it">${x.title}<span class="lv">${"●".repeat(x.level)}${"○".repeat(3 - x.level)}</span></div><div class="muted">${x.one}</div></a>`).join("")}</div>`;
    emit("cat", id);
  }

  async function lessonPage(id) {
    const x = byId[id];
    if (!x) return academyHome();
    const tok = ++routeToken;
    document.title = x.title.split("：")[0] + " · 小七指标学堂";
    app.innerHTML = `<div class="crumb">${crumbA}</div><h1>${x.title}</h1><div class="one">${x.one}</div><div class="card loading">正在加载曲线数据…（第一次打开图表需要下载约 1MB 的画图组件，之后会快很多）</div>`;
    try { await ensure(needsOf(x)); } catch (e) {
      if (tok !== routeToken) return;
      app.querySelector(".loading").innerHTML = `加载失败：网络不太好，<a href="javascript:location.reload()">点这里重试</a>`; return;
    }
    if (tok !== routeToken) return;
    const idx = L.indexOf(x), prev = L[idx - 1], next = L[idx + 1];
    const cat = window.CATS.find((c) => c.id === x.cat);
    const ch = x.chart || {};
    let extra = "";
    const H = STORE.h.two;
    if (ch.type === "twoside" && H) {
      const n = H.d.length, cols = ["资本1", "资本2", "AD", "筹码", "基本面总结", "轨道趋势", "轨道内位置", "KDJ", "MACD", "技术面总结", "结论", "仓位上限"];
      extra = `<div class="tablewrap"><table class="tbl"><tr><th>日期</th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${[...Array(Math.min(12, n)).keys()].map((k) => n - 1 - k).map((i) => `<tr><td>${H.d[i].slice(5)}</td>${cols.map((c) => `<td>${esc(H[c] ? H[c][i] ?? "—" : "—")}</td>`).join("")}</tr>`).join("")}</table></div><div class="note">📖 怎么读：从上往下是最近 12 天；左半边是基本面四项和总结，右半边是技术面四项和总结，最后两列是两者合起来的结论和仓位上限。看「结论」连续几天有没有变化，比看某一天更有用。</div>`;
    }
    if (ch.type === "today") {
      const T = D.today.cn;
      extra = verdictCard("cn") + verdictCard("us") + (T && T.rows ? `<div class="tablewrap"><table class="tbl"><tr><th>A股指标</th><th>最新值</th><th>区域</th><th>解读</th><th>去学</th></tr>${T.rows.map((r) => {
        const l = lessonFor("cn", r["指标"]);
        return `<tr><td>${esc(r["指标"])}</td><td>${esc(r["最新值"])}</td><td>${esc(r["区域"])}</td><td class="small">${esc(r["解读"])}</td><td>${l ? `<a href="#/lesson/${l}">学</a>` : ""}</td></tr>`;
      }).join("")}</table></div><div class="note">📖 怎么读：「区域」是这个指标现在落在买入区 / 中性 / 卖出区；「解读」是一句话含义；点「学」看这个指标的大图和讲解。单个指标说明不了什么，要看多数指标往哪边站。</div>` : "") + '<p><a href="#/board">打开指标看板（卡片版） →</a>　<a href="#/reports">打开报告库 →</a></p>';
    }
    let qs = "";
    if (x.quadStats && D.today[x.quadStats] && D.today[x.quadStats].joint) {
      const j = D.today[x.quadStats].joint, q = j.quad_stats_20d;
      qs = `<div class="today"><div class="th">今天：${esc(j.quadrant)}（抄底分 ${fmt(j.score / 100)}，趋势分 ${fmt(j.trend / 100)}）</div><div class="tv">${esc(j.verdict)}</div>
        <div class="muted">各象限历史后20日（平均 / 上涨概率 / 天数）：${Object.entries(q).map(([k, v]) => `${k} ${pct(v[0])} / ${fmt(v[1], 0)}% / ${v[2]}`).join("；")}</div>
        ${(j.notes || []).length ? `<div class="muted">矛盾点：${j.notes.map(esc).join("；")}</div>` : ""}</div>`;
    }
    const hasChart = ch.type && ch.type !== "today";
    app.innerHTML = `<div class="crumb">${crumbA} / <a href="#/cat/${x.cat}">${cat.name}</a></div>
      <h1>${x.title}</h1><div class="one">${x.one}</div>
      ${hasChart ? `<div class="card chartcard"><div id="chart" class="chart ${ch.type === "kline" || ch.type === "twoside" ? "tall" : ""}"></div>${ch.note ? `<div class="note">${ch.note}</div>` : ""}<div class="legend-tip"><span class="sw buy"></span>浅红区 = 买入区/偏多区　<span class="sw sell"></span>浅绿区 = 卖出区/过热区　<span class="dot"></span>红点 = 最新值</div></div>` : ""}
      ${x.tech ? techReading(x.tech.kind, x.tech.src) : ""}${todayRow(x.today)}<div id="btbox" class="btbox"></div><div id="rulebox"></div>${x.sl ? slReading(x) : ""}${qs}${extra}
      ${x.calc ? `<div class="sec"><h3>怎么算</h3><div>${x.calc}</div></div>` : ""}
      <div class="sec"><h3>怎么看</h3><div>${x.read}</div></div>
      <div class="sec warn"><h3>常见误区</h3><div>${x.pitfall}</div></div>
      <div class="sec sys"><h3>在我们的体系里</h3><div>${x.sys}</div></div>
      <div id="learnbox" class="learnbox"></div>
      <div class="pager">${prev ? `<a href="#/lesson/${prev.id}">← ${prev.title.split("：")[0]}</a>` : "<span></span>"}${next ? `<a href="#/lesson/${next.id}">${next.title.split("：")[0]} →</a>` : ""}</div>`;
    emit("lesson", id);
    getJSON("backtest_badges.json", true).then((BB) => {
      if (tok !== routeToken || !$("#btbox")) return;
      const hits = [];
      ["cn", "us"].forEach((mk) => Object.entries(BB[mk] || {}).forEach(([n, b]) => { if (b[3] === id) hits.push(btBadge(mk, n, b, `${mk === "cn" ? "A股" : "美股"}·${n}`)); }));
      if (hits.length) $("#btbox").innerHTML = `<span class="muted small">历史回测（买入区后20日超额）：</span>${hits.join("")}`;
    }).catch(() => {});
    needRules().then((R) => {
      if (!R || !window.RULES || tok !== routeToken || !$("#rulebox")) return;
      const cs = [];
      ["cn", "us"].forEach((mk) => (R[mk] ? R[mk].items : []).forEach((it) => { if (it.lesson === id) cs.push(window.RULES.card(it, mk, R, { withMk: true })); }));
      if (cs.length) $("#rulebox").innerHTML = `<div class="sec"><h3>📏 买卖条件（原始值，和回测中心同一口径）</h3>${cs.join("")}</div>`;
    });
    const el = $("#chart");
    if (!el) return;
    if (ch.type === "line") lineChart(el, ch);
    if (ch.type === "multi") multiChart(el, ch);
    if (ch.type === "kline") klineChart(el, ch);
    if (ch.type === "quad") quadChart(el, ch);
    if (ch.type === "strategy") stratChart(el, ch.key);
    if (ch.type === "twoside") klineChart(el, { src: "hs300", ov: ["ichimoku", "boll"], sub: "vwmacd", show: 250 });
  }

  async function strategiesPage() {
    const tok = ++routeToken;
    document.title = "策略库 · 小七指标学堂";
    app.innerHTML = LOADING();
    try { await ensure([["lib"], ["c", "dca"]]); } catch (e) { app.innerHTML = FAIL(); return; }
    if (tok !== routeToken) return;
    const S = D.strategies, list = S.list;
    const row = (r) => `<tr data-k="${r.key}"><td><a href="#/strategy/${r.key}">${esc(r["名称"])}</a></td><td>${esc(r["类别"])}</td><td class="${r["年化"] >= 0 ? "up" : "dn"}">${pct(r["年化"])}</td><td>${fmt(r["最大回撤"], 1)}%</td><td>${fmt(r["夏普"])}</td><td class="${r["近两年收益"] >= 0 ? "up" : "dn"}">${pct(r["近两年收益"])}</td><td class="muted small">${esc(r["基准"])} ${pct(r["基准年化"])} / ${fmt(r["基准回撤"], 1)}%</td></tr>`;
    app.innerHTML = `${subnav("#/strategies")}<div class="crumb">${crumbA} / 策略库</div><h1>策略库：网上流行的策略，统一口径回测</h1>
      <p class="muted">口径：收盘出信号、次日起执行；每次调仓单边成本 0.1%；空仓按年化 1.5% 现金；指数为价格指数（不含分红），结果偏保守。参数全部沿用网上公开版本，没有为了好看去调参。“近两年”= 2024-11-11 至今。</p>
      <div class="tablewrap"><table class="tbl"><tr><th>策略</th><th>类别</th><th>年化</th><th>最大回撤</th><th>夏普</th><th>近两年</th><th>基准 年化/回撤</th></tr>${list.map(row).join("")}</table></div>
      <div class="note">📖 怎么读：先看「近两年」是不是还在赚钱（很多策略早年好、最近失效），再拿「年化 / 最大回撤」和最右边的基准比——年化接近但回撤小得多，也是好策略。夏普 &gt;1 算优秀。</div>
      <h2>定投三种方式对比（沪深300ETF，每月一次，2015 年起）</h2>
      <div class="card chartcard"><div id="dca" class="chart"></div><div class="note">实线 = 账户市值，虚线 = 累计投入。估值定投：PE 分位越低投越多（0~2000元）；均线偏离定投：低于年线越多投越多。</div></div>
      <div class="tablewrap"><table class="tbl"><tr><th>方式</th><th>累计投入</th><th>当前市值</th><th>收益率</th></tr>${S.dca.map((d) => `<tr><td>${d["方式"]}</td><td>${Math.round(d["累计投入"]).toLocaleString()}</td><td>${Math.round(d["当前市值"]).toLocaleString()}</td><td class="${d["收益率"] >= 0 ? "up" : "dn"}">${pct(d["收益率"])}</td></tr>`).join("")}</table></div>
      <div class="note">📖 怎么读：三种定投投入的总钱数不同，所以比「收益率」而不是比市值；收益率越高＝同样的钱买得越便宜。</div>
      <div class="sec sys"><h3>怎么选（我的看法）</h3><div><ul>
        <li><b>打底仓</b>：股债平衡（60/40 或按股债性价比调比例）+ 定期再平衡。收益不惊艳，但回撤小、能拿得住，适合大部分资金。</li>
        <li><b>主动部分</b>：四资产动量轮动是这里近两年表现最好的，因为几个资产之间相关性低；但网上越来越多人在用，小仓位跟踪、别重仓。</li>
        <li><b>加减仓节奏</b>：用每天报告里的四象限 + 两面法定仓位上限，而不是单靠某一个择时策略。</li>
        <li><b>慎用</b>：20 日均线、二八轮动这类短周期择时，近两年在 A 股震荡市里基本失效；网格只适合震荡市，单边行情会卖飞或被套。</li></ul></div></div>
      <p class="disclaimer">回测不代表未来；网格、定投为简化模型，未考虑整手、溢价等细节。</p>`;
    stratChart($("#dca"), "dca");
  }

  async function strategyPage(key) {
    const r = D.strategies.list.find((x) => x.key === key);
    if (!r) return strategiesPage();
    const tok = ++routeToken;
    app.innerHTML = LOADING();
    try { await ensure([["lib"], ["c", key]]); } catch (e) { app.innerHTML = FAIL(); return; }
    if (tok !== routeToken) return;
    document.title = r["名称"] + " · 策略库";
    app.innerHTML = `<div class="crumb">${crumbA} / <a href="#/strategies">策略库</a></div><h1>${esc(r["名称"])}</h1><div class="one">${esc(r["说明"])}</div>
      <div class="card chartcard"><div id="chart" class="chart"></div><div class="note">红线 = 策略净值，灰线 = ${esc(r["基准"])}（都从 1 开始）。</div></div>
      <div class="kpis"><div><span>年化</span><b class="${r["年化"] >= 0 ? "up" : "dn"}">${pct(r["年化"])}</b><em>基准 ${pct(r["基准年化"])}</em></div>
        <div><span>最大回撤</span><b>${fmt(r["最大回撤"], 1)}%</b><em>基准 ${fmt(r["基准回撤"], 1)}%</em></div>
        <div><span>夏普</span><b>${fmt(r["夏普"])}</b><em>&nbsp;</em></div>
        <div><span>近两年</span><b class="${r["近两年收益"] >= 0 ? "up" : "dn"}">${pct(r["近两年收益"])}</b><em>基准 ${pct(r["基准近两年"])}</em></div>
        <div><span>年均调仓</span><b>${fmt(r["年均调仓"], 1)} 次</b><em>起点 ${esc(r["起点"])}</em></div></div>
      <div class="sec"><h3>出处</h3><div>${esc(r["出处"])}</div></div>
      <div class="sec warn"><h3>结论与风险</h3><div>${esc(r["结论"])}</div></div>`;
    stratChart($("#chart"), key);
  }

  function glossary() {
    document.title = "术语表 · 小七指标学堂";
    app.innerHTML = `${subnav("#/glossary")}<div class="crumb">${crumbA} / 术语表</div><h1>术语表</h1><input id="q" class="search" placeholder="搜一下…">
      <div id="gl" class="gl">${window.GLOSSARY.map(([k, v]) => `<div class="gi"><b>${k}</b><div class="muted">${v}</div></div>`).join("")}</div>`;
    $("#q").addEventListener("input", (e) => {
      const t = e.target.value.trim();
      $$(".gi").forEach((n) => { n.style.display = !t || n.textContent.includes(t) ? "" : "none"; });
    });
  }

  function quiz() {
    document.title = "小测验 · 小七指标学堂";
    app.innerHTML = `${subnav("#/quiz")}<div class="crumb">${crumbA} / 小测验</div><h1>小测验</h1><p class="muted">点选项看解释。</p>
      ${window.QUIZ.map((q, i) => `<div class="card qz" data-i="${i}"><div class="qq">${i + 1}. ${q.q}</div>${q.o.map((o, j) => `<button class="opt" data-j="${j}">${o}</button>`).join("")}<div class="qe"></div></div>`).join("")}
      <div id="score" class="card"></div>`;
    let right = 0, done = 0;
    const answers = {};
    $$(".qz").forEach((card) => {
      const q = window.QUIZ[+card.dataset.i];
      $$(".opt", card).forEach((b) => b.addEventListener("click", () => {
        if (card.dataset.done) return;
        card.dataset.done = 1; done++;
        const ok = +b.dataset.j === q.a;
        if (ok) right++;
        b.classList.add(ok ? "ok" : "bad");
        $$(".opt", card)[q.a].classList.add("ok");
        card.querySelector(".qe").innerHTML = (ok ? "✅ 对了。" : "❌ 不对。") + q.e;
        answers[card.dataset.i] = +b.dataset.j;
        $("#score").textContent = `已答 ${done}/${window.QUIZ.length}，答对 ${right} 题`;
        if (done === window.QUIZ.length && window.Cloud && window.Cloud.enabled) window.Cloud.saveQuiz(right, window.QUIZ.length, answers);
      }));
    });
  }

  // =====================================================================
  // 路由 + 统一导航
  // =====================================================================
  // 电脑（≥900px）：左侧分组侧边栏；平板（761–899px）：顶部紧凑导航（分组之间细竖线，放不下就换行，不截断）；手机：顶部导航隐藏、用底部 Tab
  const ICO = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  // u38 侧栏按用途分 5 组（和「全部功能」页、App 一致）；术语 / 测验 / 买卖点等在「全部功能」里
  const NAVG = [
    ["常用", [["#/", "今日", "today", "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"],
      ["#/todo", "该做什么", "todo", "M9 6.5h11M9 12h11M9 17.5h11M3.8 6.5l1.4 1.4 2.3-2.6M3.8 12l1.4 1.4 2.3-2.6M3.8 17.5l1.4 1.4 2.3-2.6"],
      ["#/pick", "今日一票", "pick", "M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 11.6v.8"],
      ["#/reports", "报告", "reports", "M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 12.5h7M8.5 16.5h5"]]],
    ["看市场", [["#/topk", "各市场K线", "topk", "M4 18l5-6 3.5 3 6-8M4 4v16h16"],
      ["#/signals", "信号雷达", "signals", "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"],
      ["#/xnews", "X要闻", "xnews", "M4 5h16v11H9.5L5 19.5V16H4zM8 9h8M8 12h5M17 3l2 2"],
      ["#/cal", "大事日历", "cal", "M4 6h16v14H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5M8 14h2M14 14h2M8 17h2"],
      ["#/board", "看板", "board", "M4 4v16h16M8 15l3.5-4 3 2.5L20 7"],
      ["#/macro", "宏观", "macro", "M4 20V10M9 20V4M14 20v-7M19 20V7M2 20h20"]]],
    ["短线 · 博主", [["#/race", "赛马", "race", "M8 21h8M12 16.5V21M7 4h10v5a5 5 0 0 1-10 0zM17 5.5h3V7a3.5 3.5 0 0 1-3.2 3.5M7 5.5H4V7a3.5 3.5 0 0 0 3.2 3.5"],
      ["#/gurus", "博主", "gurus", "M4 5h16v11H9.5L5 19.5V16H4zM8 9.3h8M8 12.3h5"],
      ["#/lhb", "龙虎榜", "lhb", "M3 20.5h18M5 20.5v-7h4v7M10 20.5V7h4v13.5M15 20.5v-10h4v10"],
      ["#/hot", "人气榜", "hot", "M4 20h16M6 20v-5M10 20V9M14 20v-8M18 20V5M4.5 9.5 9 5l4 3 6.5-5"],
      ["#/short", "短线", "short", "M12 3c.6 3.2 5 5.3 5 10a5 5 0 0 1-10 0c0-2.4 1.1-4 2.4-5 .2 1.8 1 2.9 2.1 3.3.3-3.1-.4-5.6.5-8.3z"],
      ["#/sectors", "板块", "sectors", "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"]]],
    ["期权", [["#/opt", "期权", "opt", "M10 4.5a2 2 0 1 1 4 0v9.2a4 4 0 1 1-4 0zM12 17.5v-6"],
      ["#/optsim", "期权模拟", "optsim", "M3 17c3 0 4-10 9-10s6 10 9 10M3 17h18M12 7v10"]]],
    ["研究 · 练习", [["#/tape", "分时练盘", "tape", "M3 12h3l2-5 3 10 3-7 2 4h5M4 4v16h16"],
      ["#/trend", "趋势状态", "trend", "M3 17l5-5 4 3 8-8M15 7h5v5"],
      ["#/labs", "网红策略", "labs", "M12 3l7 3v5.2c0 4.4-2.9 8.1-7 9.8-4.1-1.7-7-5.4-7-9.8V6zM9 12l2.2 2.2L15.5 10"],
      ["#/backtest", "回测", "backtest", "M9.5 3h5M10.5 3v6.2L5.2 18.6A1.6 1.6 0 0 0 6.6 21h10.8a1.6 1.6 0 0 0 1.4-2.4L13.5 9.2V3M7.6 14.5h8.8"],
      ["#/analog", "相似走势", "analog", "M4 4c6 0 6 16 16 16M4 20c6 0 6-16 16-16"],
      ["#/usopen", "开盘惯性", "usopen", "M12 4a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 8.5v4.5l3 2M9.5 2.5h5"],
      ["stock/", "个股", "stock", "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.3 15.3 20 20"],
      ["#/account", "账户", "account", "M4 7.5h15a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11v3.5M16 14h.01"],
      ["#/train", "K线训练", "train", "M7 4v16M17 4v16M4.5 8h5v7h-5zM14.5 6h5v6h-5z"],
      ["#/academy", "学堂", "academy", "M4 5.5c2.7-1.6 5.3-1.6 8 0 2.7-1.6 5.3-1.6 8 0V19c-2.7-1.6-5.3-1.6-8 0-2.7-1.6-5.3-1.6-8 0zM12 5.5V19"]]]];
  $("#nav").innerHTML = NAVG.map(([g, xs]) => `<div class="ng"><span class="ngt">${g}</span>${xs.map(([h, n, k, d]) => `<a href="${h}" data-k="${k}">${ICO(d)}<span>${n}</span></a>`).join("")}</div>`).join("")
    + `<div class="nfoot" id="navfoot">${D.meta && D.meta.built ? `<span>指标数据</span><b>${esc(D.meta.built)}</b>` : ""}</div>`;
  // 侧边栏底部：最新一期报告时间（只在电脑宽度取，手机不多发请求）
  if (window.matchMedia && matchMedia("(min-width:900px)").matches) getJSON("reports/latest.json", true).then((R) => {
    const x = R && R.recent && R.recent[0], f = $("#navfoot");
    if (x && f) f.innerHTML = `<span>最新报告</span><a href="#/report/${esc(x.id)}">${esc(x.date.slice(5))} ${esc(x.time)} · ${esc(x.task)}</a>${D.meta && D.meta.built ? `<span>指标数据</span><b>${esc(D.meta.built)}</b>` : ""}`;
  }).catch(() => {});
  // 手机：底部 5 个 Tab（今日 / 该做什么 / 报告 / 看板 / 更多），其余入口（含研究区：赛马、博主、网红策略、龙虎榜）放「更多」宫格页 #/more
  const TABS = [["#/", "今日", "today", "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"],
    ["#/todo", "该做什么", "todo", "M9 6.5h11M9 12h11M9 17.5h11M3.8 6.5l1.4 1.4 2.3-2.6M3.8 12l1.4 1.4 2.3-2.6M3.8 17.5l1.4 1.4 2.3-2.6"],
    ["#/reports", "报告", "reports", "M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8.5 12.5h7M8.5 16.5h5"],
    ["#/signals", "信号", "signals", "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"],
    ["#/all", "全部", "all", "M4.5 4.5h5.5v5.5H4.5zM14 4.5h5.5v5.5H14zM4.5 14h5.5v5.5H4.5zM14 14h5.5v5.5H14z"]];
  $("#tabbar").innerHTML = TABS.map(([h, n, k, d]) => `<a href="${h}" data-k="${k}">${ICO(d)}<span>${n}</span></a>`).join("");
  const MORE = [
    ["⭐ 常用（每天看）", [["#/topk", "🌍", "各市场TOP K线", "A股/美股/港/日韩/黄金，带分析"], ["#/xnews", "📡", "X 要闻", "最新推特要闻 + 新闻后来怎么走"], ["#/signals", "🛰", "技术信号雷达", "顶底背离/超买超卖，各市场哪些指标异常"], ["#/race", "🏇", "策略赛马", "多套策略实盘记账比较"], ["#/gurus", "🗣️", "博主观点", "谁说得准，命中率排名"], ["#/lhb", "🐯", "龙虎榜", "游资在买什么、跟着买有没有用"], ["#/opt", "🌡", "期权研究", "A股/美股期权温度 + 个股期权"], ["#/optsim", "🎲", "期权模拟", "买 call/put/跨式，逐日推进看盈亏"], ["#/pick", "🎯", "今日一票", "买什么、何时买、买入区、概率"]]],
    ["看行情", [["#/todo", "✅", "今天该做什么", "检验过有效的信号 + 持仓提醒"], ["#/cal", "📅", "财经大事日历", "议息/CPI/财报：预期 + 利好利空 + 结果"], ["stock/", "🔎", "个股透视", "输入代码，一键看懂一只股票"], ["stock/#/picks/cn", "🎯", "今日买卖点", "研究区：全市场扫描（组合测试中）"], ["#/sectors", "🧩", "板块看板", "板块分区 + 里面的知名个股"], ["#/short", "🔥", "短线情绪", "涨停、连板、情绪周期"], ["#/account", "💼", "虚拟账户", "100 万模拟盘，逐笔记账"]]],
    ["验真假", [["#/backtest", "🧪", "回测中心", "每个指标到底灵不灵"], ["#/strategies", "📈", "策略库", "流行策略统一口径回测"]]],
    ["研究区（检验过没用或还在跟踪，不当买卖依据）", [["#/labs", "🔬", "网红策略验真", "网上说法逐条回测"], ["#/macro", "🌐", "国家宏观数据", "社零/GDP/CPI/PMI/出口 + 出海链信号"], ["#/hot", "📣", "人气榜剖析", "为什么上榜、接下来怎么看"], ["#/analog", "🔍", "相似走势", "今天走到一半，历史上最像的几天后来怎么走"], ["#/usopen", "⏱", "美股开盘惯性", "开盘 15/30 分钟涨跌之后大概怎么走（检验：惯性很弱）"], ["#/usshape", "📐", "美股日内形态", "哪种走势最常见、开盘急跌拉回均价线之后怎么走"], ["#/trend", "📟", "趋势状态判定", "布鲁斯框架 S1~S5：现在是下跌确认还是反弹尝试（检验：只作温度计）"]]],
    ["学一学", [["#/train", "🕹", "K 线训练", "遮住后面逐根推：买卖练盘感 + Joy 方法题"], ["#/academy", "📚", "指标学堂", "七天看懂市场指标"], ["#/glossary", "📖", "术语表", "看不懂的词先查这里"], ["#/quiz", "✅", "小测验", "学完测一测"], ["#/me", "👤", "我的", "学习进度与云同步"]]]];
  function morePage() {
    document.title = "更多 · 小七投研";
    app.innerHTML = `<h1>更多</h1>${MORE.map(([g, xs]) => `<h2 class="mgh">${g}</h2><div class="mgrid">${xs.map(([h, i, t, s]) => `<a href="${h}"><span class="mi">${i}</span><b>${t}</b><em>${s}</em></a>`).join("")}</div>`).join("")}
      <p class="muted small">底部「今日 / 该做什么 / 报告 / 看板」是最常用的四页；其余入口都在这里。旧链接（收藏、推送里的）照常能打开。</p>${DISC}`;
  }
  const TAB_ROOT = ["", "todo", "reports", "signals", "all", "more"];
  const PARENT = (r) => (r === "report" ? "#/reports" : ["lesson", "cat", "strategy", "strategies", "glossary", "quiz", "me"].includes(r) ? "#/academy" : "#/all");
  // 返回键：站内有上一页就 history.back()，否则（直接从推送/收藏打开）去上级页。深度记在 history.state 里，浏览器前进后退也准
  let depth = -1;
  const trackDepth = () => { const st = history.state; if (st && st.d != null) depth = st.d; else { depth += 1; try { history.replaceState({ ...(st || {}), d: depth }, ""); } catch (e) {} } };
  $("#back").addEventListener("click", (e) => { if (depth > 0) { e.preventDefault(); history.back(); } });
  function setNav(r) {
    const k = !r ? "today" : r === "report" || r === "reports" ? "reports" : r === "more" || r === "all" ? "" : $(`#nav a[data-k="${r}"]`) ? r : "academy";
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.k === k));
    const on = $("#nav a.on");
    if (on && on.scrollIntoView) { const nav = $("#nav"); nav.scrollLeft = on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2; }
    const tk = !r ? "today" : r === "report" || r === "reports" ? "reports" : r === "signals" || r === "todo" ? r : "all";
    $$("#tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.k === tk));
    const back = $("#back"), root = TAB_ROOT.includes(r || "");
    back.hidden = root; back.href = PARENT(r);
    document.body.classList.toggle("sub", !root);
  }
  async function academyRoute(h) {
    const tok = routeToken;
    if (!L) {
      app.innerHTML = LOADING("正在加载课程…");
      try { await needContent(); } catch (e) { if (tok === routeToken) app.innerHTML = FAIL(); return; }
      if (tok !== routeToken) return;
    }
    if (h[0] === "lesson") lessonPage(h[1]);
    else if (h[0] === "cat") catPage(h[1]);
    else if (h[0] === "strategies") strategiesPage();
    else if (h[0] === "strategy") strategyPage(h[1]);
    else if (h[0] === "glossary") glossary();
    else if (h[0] === "quiz") quiz();
    else if (h[0] === "me") {
      app.innerHTML = `${subnav("#/me")}${LOADING()}`;
      await loadCloud();
      if (tok !== routeToken) return;
      if (window.Cloud) emit("me"); else app.innerHTML = `${subnav("#/me")}<h1>我的</h1><div class="card">云同步组件加载失败。</div>`;
    } else academyHome();
  }
  // 按需加载的页面模块（short.js / bt.js）共用这里的工具
  window.__APP = { D, ver, app, $, $$, esc, fmt, pct, sg, updn, LOADING, FAIL, DISC, getJSON, need, mk, C, zoom, axisStyle, expand, wk, bjDate, loadScript,
    symOf, stockHref, stockLink, linkify, needNames,
    tok: () => routeToken, alive: (t) => t === routeToken, shortMood, STAGE_C, lessonFor, needContent, byId: () => byId, needRules };
  const MODS = {};
  function modPage(name, title, run) {
    const tok = routeToken;
    if (window["__mod_" + name]) return run(window["__mod_" + name]);
    document.title = title + " · 小七投研";
    app.innerHTML = `<h1>${title}</h1>${LOADING()}`;
    (MODS[name] = MODS[name] || loadScript(`${name}.js?v=${ver}`).catch((e) => { delete MODS[name]; throw e; }))
      .then(() => { if (tok === routeToken) run(window["__mod_" + name]); })
      .catch(() => { if (tok === routeToken) app.innerHTML = `<h1>${title}</h1>${FAIL()}`; });
  }
  function route() {
    disposeCharts();
    routeToken++;
    app.onclick = null;
    const pop = $("#tocpop"); if (pop) pop.remove();
    const lb = $("#lb"); if (lb) { lb.classList.remove("show"); document.body.style.overflow = ""; }
    const h = location.hash.replace(/^#\/?/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    trackDepth();
    setNav(h[0]);
    if (!h[0]) todayPage();
    else if (h[0] === "more") allPage();   // u38：旧「更多」合并进「全部功能」
    else if (h[0] === "todo") modPage("todo", "今天我该做什么", (m) => m.page());
    else if (h[0] === "reports") reportsPage();
    else if (h[0] === "report") reportPage(h[1]);
    else if (h[0] === "short") modPage("short", "短线情绪", (m) => m.page());
    else if (h[0] === "gurus") modPage("gurus", "博主观点", (m) => m.page(h[1], h[2]));
    else if (h[0] === "macro") modPage("macro", "国家宏观数据", (m) => m.page());
    else if (h[0] === "account") modPage("account", "虚拟账户", (m) => m.page());
    else if (h[0] === "race") modPage("race", "策略赛马", (m) => m.page());
    else if (h[0] === "backtest") modPage("bt", "回测中心", (m) => m.page(h[1], h[2], h[3]));
    else if (h[0] === "labs") modPage("labs", "网红策略验真", (m) => m.page(h[1]));
    else if (h[0] === "board") boardPage(h[1]);
    else if (h[0] === "sectors") {   // 板块看板三级页面：返回键（无站内历史时）回上一级
      if (h[2]) $("#back").href = "#/sectors/" + h.slice(1, h[2] === "rank" ? 2 : h.length - 1).map(encodeURIComponent).join("/");
      modPage("sectors", "板块看板", (m) => m.page(h[1], h[2], h[3]));
    }
    else if (h[0] === "hot") modPage("hot", "人气榜剖析", (m) => m.page());
    else if (h[0] === "topk") modPage("topk", "各市场 TOP K线", (m) => m.page());
    else if (h[0] === "xnews") modPage("xnews", "X 要闻 · 新闻后来怎么走", (m) => m.page());
    else if (h[0] === "signals") modPage("signals", "技术信号雷达", (m) => m.page());
    else if (h[0] === "all") allPage();
    else if (h[0] === "tape") modPage("tape", "分时练盘", (m) => m.page(h[1]));
    else if (h[0] === "opt") modPage("opt", "期权研究", (m) => m.page());
    else if (h[0] === "optsim") modPage("optsim", "期权模拟", (m) => m.page(h[1]));
    else if (h[0] === "usopen") modPage("usopen", "美股开盘惯性", (m) => m.page());
    else if (h[0] === "usshape") modPage("usshape", "美股日内形态", (m) => m.page(h[1]));
    else if (h[0] === "trend") modPage("trend", "趋势状态判定", (m) => m.page());
    else if (h[0] === "train") modPage("train", "K 线训练", (m) => m.page(h[1], h[2]));
    else if (h[0] === "analog") modPage("analog", "相似走势", (m) => m.page(h[1] && decodeURIComponent(h[1]), h[2], h[3], h[4]));
    else if (h[0] === "cal") modPage("cal", "财经大事日历", (m) => m.page(h[1], h[2]));
    else if (h[0] === "pick") modPage("pick", "🎯 今日一票", (m) => m.page());
    else if (h[0] === "lhb") { if (h[1] === "seat") $("#back").href = "#/lhb/rank"; modPage("lhb", "龙虎榜", (m) => m.page(h[1], h[2])); }
    else academyRoute(h);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
