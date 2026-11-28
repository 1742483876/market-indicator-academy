/* 吸收自 market-pulse 的 12 套买卖点规则 —— 与 stockscope/mp_rules.py 逐行对应（求和一律从左到右累加）。
 * 用于个股页 K 线标注、各规则成绩小表、「我的指标回测」组合；每日扫描与规则检验由 Python 版完成，
 * tools/mp_consistency.cjs 抽 50 只比对两边信号与成交是否一致。 */
(function (root) {
  "use strict";
  const NAN = NaN;
  const isnan = (x) => x !== x;
  const sum = (xs) => { let s = 0.0; for (const x of xs) s += x; return s; };
  const mx = (a, i, j) => { let m = -Infinity; for (let q = i; q < j; q++) if (a[q] > m) m = a[q]; return m; };
  const mn = (a, i, j) => { let m = Infinity; for (let q = i; q < j; q++) if (a[q] < m) m = a[q]; return m; };
  const sumr = (a, i, j) => { let s = 0.0; for (let q = i; q < j; q++) s += a[q]; return s; };
  const pyRound4 = (x) => { // Python round(x, 4)：银行家舍入近似（此处只用于展示性的止损百分比）
    const f = 1e4, y = x * f, r = Math.round(y);
    return (Math.abs(y - Math.trunc(y)) === 0.5 && r % 2 !== 0 ? r - 1 : r) / f;
  };

  function ema(vals, n) {
    const out = [], a = 2 / (n + 1); let prev = null;
    for (const v of vals) { prev = prev === null ? v : a * v + (1 - a) * prev; out.push(prev); }
    return out;
  }
  function sma(vals, n) {
    const out = [];
    for (let i = 0; i < vals.length; i++) out.push(i >= n - 1 ? sumr(vals, i - n + 1, i + 1) / n : NAN);
    return out;
  }
  function compute(O, H, L, C, V) {
    const n = C.length;
    const fast = ema(C, 12), slow = ema(C, 26);
    const dif = fast.map((a, i) => a - slow[i]), dea = ema(dif, 9);
    const R = { ma5: sma(C, 5), ma10: sma(C, 10), ma20: sma(C, 20), ma60: sma(C, 60), dif, dea, macd: dif.map((a, i) => 2 * (a - dea[i])), k: [], d: [], j: [], rsi: [], bu: [], bl: [], atr: [] };
    R.bm = R.ma20;
    let k = 50.0, d = 50.0, gain = 0.0, loss = 0.0, atr = 0.0;
    const tr = [];
    for (let i = 0; i < n; i++) {
      if (i >= 8) {
        const h = mx(H, i - 8, i + 1), l = mn(L, i - 8, i + 1);
        const rsv = h !== l ? (C[i] - l) / (h - l) * 100 : 50;
        k = (2 * k + rsv) / 3; d = (2 * d + k) / 3;
        R.k.push(k); R.d.push(d); R.j.push(3 * k - 2 * d);
      } else { R.k.push(NAN); R.d.push(NAN); R.j.push(NAN); }
      if (i < 14) R.rsi.push(NAN);
      else {
        if (i === 14) {
          let g = 0.0, l_ = 0.0;
          for (let j = 1; j < 15; j++) { const ch = C[j] - C[j - 1]; g += Math.max(ch, 0); l_ += Math.max(-ch, 0); }
          gain = g / 14; loss = l_ / 14;
        } else {
          const ch = C[i] - C[i - 1];
          gain = (13 * gain + Math.max(ch, 0)) / 14; loss = (13 * loss + Math.max(-ch, 0)) / 14;
        }
        R.rsi.push(loss ? 100 - 100 / (1 + gain / loss) : (gain ? 100 : 50));
      }
      if (i >= 19) {
        const mid = R.ma20[i]; let s = 0.0;
        for (let q = i - 19; q < i + 1; q++) s += (C[q] - mid) ** 2;
        const sd = Math.sqrt(s / 20);
        R.bu.push(mid + 2 * sd); R.bl.push(mid - 2 * sd);
      } else { R.bu.push(NAN); R.bl.push(NAN); }
      const pc = i ? C[i - 1] : C[i];
      tr.push(Math.max(H[i] - L[i], Math.abs(H[i] - pc), Math.abs(L[i] - pc)));
      if (i < 13) R.atr.push(NAN);
      else { atr = i === 13 ? sumr(tr, 0, 14) / 14 : (atr * 13 + tr[i]) / 14; R.atr.push(atr); }
    }
    return R;
  }
  function cross(a, b, i, up = true) {
    if (i < 1) return false;
    const a1 = a[i - 1], a0 = a[i];
    const b1 = typeof b === "number" ? b : b[i - 1], b0 = typeof b === "number" ? b : b[i];
    if (isnan(a1) || isnan(a0) || isnan(b1) || isnan(b0)) return false;
    return up ? (a1 <= b1 && a0 > b0) : (a1 >= b1 && a0 < b0);
  }

  // key: [名称, 买入条件, 指标退出, 预热, 只限A股, 图上短名]
  const RULES = {
    mp_breakout: ["放量突破(20日)", "收盘超过此前 20 根最高价，成交量 ≥ 前 20 根均量的 1.5 倍。", "收盘向下穿越 MA10。", 21, false, "突"],
    mp_pullback: ["缩量回踩MA5", "MA5 > MA20；最低价触及 MA5 上方 0.5% 内，收盘重新站上 MA5 且收阳；量 < 前 5 根均量。", "收盘向下穿越 MA20。", 21, false, "踩"],
    mp_rebound: ["超跌反弹", "前一根 RSI14 < 30；本根收阳且收盘超过前一根最高价。", "RSI14 上穿 70 或收盘下穿 MA5。", 21, false, "反"],
    mp_weak: ["弱转强(日线近似)", "仅A股：前日涨 9.7%~10.3% 且量 ≥ 前前日 1.5 倍，今日高开 0~5%，收盘突破前日最高价。不是龙头打板的完整复现。", "收盘跌破前一根最低价。", 21, true, "弱"],
    mp_macd: ["MACD金叉", "DIF(EMA12−EMA26) 上穿 DEA(9)；至少 35 根预热。", "DIF 下穿 DEA（死叉）。", 34, false, "M"],
    mp_kdj: ["低位KDJ金叉", "KDJ(9,3,3) 的 K 上穿 D，且 K < 50。", "K 下穿 D（死叉）。", 21, false, "K"],
    mp_rsi: ["RSI超卖修复", "Wilder RSI14 从 30 以下上穿 30。", "RSI14 上穿 70，或跌回 30 以下。", 21, false, "R"],
    mp_boll: ["BOLL下轨回归", "前根收盘在 BOLL(20,2) 下轨下方，本根收盘重新站回下轨。", "收盘上穿中轨（止盈），或跌回下轨（失效）。", 21, false, "下"],
    mp_bollup: ["BOLL放量上破", "收盘上穿 BOLL(20,2) 上轨，量 ≥ 前 20 根均量 1.2 倍。", "收盘下穿 BOLL 中轨。", 21, false, "上"],
    mp_ma: ["MA5/20金叉", "5 日均线上穿 20 日均线。", "MA5 下穿 MA20。", 21, false, "均"],
    mp_conf: ["趋势+动量+量能", "MA20 > MA60、DIF > DEA、RSI14 在 45~70、量 ≥ 1.3 倍，收盘突破前 10 根最高价。", "MACD 死叉或收盘下穿 MA20。", 59, false, "合"],
    mp_auto: ["系统综合判断", "趋势、动量、量能、价格确认、不追高五项同时满足、总分 ≥75，且前 5 根都不满足（新信号）；每个时点只用最近 120 根。", "收盘低于 MA20 且（MACD 转弱或 RSI<45），或收盘低于 MA60 且 RSI<40。", 124, false, "综"],
  };
  const ORDER = Object.keys(RULES);
  const FIXED = [3.0, 6.0, 10];
  const COST = { cn: { slip: 0.001, buy: 0.00025, sell: 0.00075 }, us: { slip: 0.0005, buy: 0.0, sell: 0.0 } };
  const limitPct = (sym) => (/^(sh68|sz30)/.test(sym) ? 0.2 : 0.1);

  function entrySignals(O, H, L, C, V, I, cn) {
    const n = C.length, S = {};
    for (const k of ORDER) if (k !== "mp_auto") S[k] = new Array(n).fill(false);
    for (let i = 21; i < n; i++) {
      const avg = sumr(V, i - 20, i) / 20;
      if (V[i] <= 0 || avg <= 0) continue;
      const c = C[i], vr = V[i] / avg;
      S.mp_breakout[i] = c > mx(H, i - 20, i) && vr >= 1.5;
      const ma5 = sumr(C, i - 4, i + 1) / 5, ma20 = sumr(C, i - 19, i + 1) / 20, v5 = sumr(V, i - 5, i) / 5;
      S.mp_pullback[i] = ma5 > ma20 && L[i] <= ma5 * 1.005 && c > ma5 && c > O[i] && V[i] < v5;
      const pr = I.rsi[i - 1];
      S.mp_rebound[i] = !isnan(pr) && pr < 30 && c > H[i - 1] && c > O[i];
      if (cn && i >= 2) {
        const pct = (C[i - 1] / C[i - 2] - 1) * 100, gap = O[i] / C[i - 1] - 1;
        S.mp_weak[i] = pct >= 9.7 && pct <= 10.3 && V[i - 1] >= 1.5 * V[i - 2] && gap > 0 && gap < 0.05 && c > H[i - 1];
      }
      S.mp_macd[i] = i >= 34 && cross(I.dif, I.dea, i);
      S.mp_kdj[i] = cross(I.k, I.d, i) && I.k[i] < 50;
      S.mp_rsi[i] = cross(I.rsi, 30, i);
      S.mp_boll[i] = cross(C, I.bl, i);
      S.mp_bollup[i] = cross(C, I.bu, i) && vr >= 1.2;
      S.mp_ma[i] = cross(I.ma5, I.ma20, i);
      if (i >= 59) S.mp_conf[i] = I.ma20[i] > I.ma60[i] && I.dif[i] > I.dea[i] && I.rsi[i] >= 45 && I.rsi[i] <= 70 && vr >= 1.3 && c > mx(H, i - 10, i);
    }
    return S;
  }
  function exitSignals(O, H, L, C, V, I, cn) {
    const n = C.length, X = {};
    for (const k of ORDER) if (k !== "mp_auto") X[k] = new Array(n).fill(false);
    for (let i = 21; i < n; i++) {
      const dn = (key) => cross(C, I[key], i, false);
      X.mp_breakout[i] = dn("ma10");
      X.mp_pullback[i] = dn("ma20");
      X.mp_rebound[i] = dn("ma5") || cross(I.rsi, 70, i);
      X.mp_weak[i] = cn && C[i] < L[i - 1];
      X.mp_macd[i] = i >= 34 && cross(I.dif, I.dea, i, false);
      X.mp_kdj[i] = cross(I.k, I.d, i, false);
      X.mp_rsi[i] = cross(I.rsi, 70, i) || cross(I.rsi, 30, i, false);
      X.mp_boll[i] = cross(C, I.bm, i) || dn("bl");
      X.mp_bollup[i] = dn("bm");
      X.mp_ma[i] = cross(I.ma5, I.ma20, i, false);
      X.mp_conf[i] = dn("ma20") || cross(I.dif, I.dea, i, false);
    }
    return X;
  }

  function snap(O, H, L, C, V, s, t) {
    const a12 = 2 / 13, a26 = 2 / 27, a9 = 2 / 10;
    let e12 = C[s], e26 = C[s], dea = 0.0, gain = 0.0, loss = 0.0, atr = 0.0, tr0 = 0.0;
    for (let j = s; j < t + 1; j++) {
      const idx = j - s, c = C[j];
      if (idx > 0) { e12 = a12 * c + (1 - a12) * e12; e26 = a26 * c + (1 - a26) * e26; dea = a9 * (e12 - e26) + (1 - a9) * dea; }
      if (idx === 14) {
        let g = 0.0, l_ = 0.0;
        for (let q = s + 1; q < s + 15; q++) { const ch = C[q] - C[q - 1]; g += Math.max(ch, 0); l_ += Math.max(-ch, 0); }
        gain = g / 14; loss = l_ / 14;
      } else if (idx > 14) {
        const ch = c - C[j - 1];
        gain = (13 * gain + Math.max(ch, 0)) / 14; loss = (13 * loss + Math.max(-ch, 0)) / 14;
      }
      const pc = idx ? C[j - 1] : c;
      const trv = Math.max(H[j] - L[j], Math.abs(H[j] - pc), Math.abs(L[j] - pc));
      if (idx < 13) tr0 += trv;
      else if (idx === 13) { tr0 += trv; atr = tr0 / 14; }
      else atr = (atr * 13 + trv) / 14;
    }
    const dif = e12 - e26;
    const rsi = loss ? 100 - 100 / (1 + gain / loss) : (gain ? 100 : 50);
    const close = C[t];
    const ma20 = sumr(C, t - 19, t + 1) / 20, ma60 = sumr(C, t - 59, t + 1) / 60, ma20p = sumr(C, t - 24, t - 4) / 20;
    const avg = sumr(V, t - 20, t) / 20, vr = avg > 0 ? V[t] / avg : 0;
    const slope = ma20 - ma20p;
    const stretch = atr && atr > 0 ? (close - ma20) / atr : null;
    const high10 = mx(H, t - 10, t);
    const breakout = close > high10;
    const pullback = !!(atr && L[t] <= ma20 + 0.5 * atr && close > ma20 && close > O[t] && close > C[t - 1]);
    const rawStop = atr ? 1.5 * atr / close * 100 : 0;
    const stopPct = pyRound4(Math.min(8.0, Math.max(1.5, rawStop)));
    const tp = 10 * ((close > ma20 ? 1 : 0) + (ma20 > ma60 ? 1 : 0) + (slope > 0 ? 1 : 0));
    const trendOk = close > ma20 && tp >= 20;
    const momOk = dif > dea && rsi >= 40 && rsi <= 72;
    const mp = (dif > dea ? 10 : 0) + (rsi >= 45 && rsi <= 68 ? 10 : rsi >= 40 && rsi <= 72 ? 5 : 0);
    const volOk = vr >= 0.9 && vr <= 4 && V[t] > 0;
    const vp = vr >= 1.2 && vr <= 3 ? 15 : volOk ? 10 : 0;
    const sp = breakout ? 20 : pullback ? 15 : 0;
    const riskOk = !!(stretch !== null && stretch >= 0 && stretch <= 2.5 && rawStop <= 8.0);
    const rp = riskOk && stretch <= 2 ? 15 : riskOk ? 10 : 0;
    const score = tp + mp + vp + sp + rp;
    const eligible = trendOk && momOk && volOk && (breakout || pullback) && riskOk && score >= 75;
    const exitEl = (close < ma20 && (dif < dea || rsi < 45)) || (close < ma60 && rsi < 40);
    const strict = tp >= 30 && mp >= 20 && vp >= 15 && sp >= 15 && rp >= 15;
    const grade = score >= 90 && strict ? "S" : score >= 78 ? "A" : score >= 60 ? "B" : "C";
    return [eligible, exitEl, score, grade, stopPct];
  }
  function autoSignals(O, H, L, C, V) {
    const n = C.length, el = new Array(n).fill(false), ex = new Array(n).fill(false), gr = new Array(n).fill(null), sc = new Array(n).fill(null), st = new Array(n).fill(null);
    for (let t = 119; t < n; t++) { const r = snap(O, H, L, C, V, t - 119, t); el[t] = r[0]; ex[t] = r[1]; sc[t] = r[2]; gr[t] = r[3]; st[t] = r[4]; }
    const buy = new Array(n).fill(false), exitP = new Array(n).fill(false);
    for (let t = 124; t < n; t++) { buy[t] = el[t] && !el.slice(t - 5, t).some(Boolean); exitP[t] = ex[t]; }
    return [buy, exitP, gr, sc, st];
  }

  const fee = (v, side, cn) => (cn ? Math.max(5.0, v * 0.0003) + v * 0.00001 + (side === "sell" ? v * 0.0005 : 0) : v * 0.0001);
  function assess(O, H, L, C, V, I, i, rule, sym, cn) {
    const close = C[i], ma20 = I.ma20[i], ma60 = I.ma60[i], rsi = I.rsi[i], atr = I.atr[i], dif = I.dif[i], dea = I.dea[i], k = I.k[i], d = I.d[i];
    const ok = (x) => !isnan(x);
    const avg = sumr(V, i - 20, i) / 20, vr = avg ? V[i] / avg : 0;
    const trend = (ok(ma20) && close > ma20 ? 10 : 0) + (ok(ma60) && ok(ma20) && ma20 > ma60 ? 10 : 0) + (i + 1 > 24 && ok(ma20) && ok(I.ma20[i - 4]) && ma20 > I.ma20[i - 4] ? 5 : 0);
    const mom = (ok(dif) && dif > dea ? 10 : 0) + (ok(rsi) && rsi >= 45 && rsi <= 68 ? 6 : 0) + (ok(k) && k > d && k < 85 ? 4 : 0);
    let vs = vr >= 1.5 && vr <= 3 ? 20 : vr >= 1.2 && vr < 1.5 ? 14 : (vr > 0 && vr < 1.2) || (vr > 3 && vr <= 5) ? 8 : 0;
    if (rule === "mp_pullback") vs = vr >= 0.5 && vr < 1 && C[i] > O[i] ? 20 : vr > 0 ? 8 : 0;
    const slip = cn ? 0.001 : 0.0005;
    let q;
    if (cn) { const lot = sym.startsWith("sh68") ? 1 : 100; q = Math.floor(25000 / close / lot) * lot; if (sym.startsWith("sh68") && q < 200) q = 0; }
    else q = Math.floor(25000 / close);
    const entry = close * (1 + slip), stop = entry * 0.97, take = entry * 1.06;
    const loss = (entry - stop * (1 - slip)) * q + fee(entry * q, "buy", cn) + fee(stop * (1 - slip) * q, "sell", cn);
    const profit = (take * (1 - slip) - entry) * q - fee(entry * q, "buy", cn) - fee(take * (1 - slip) * q, "sell", cn);
    const rr = loss > 0 && q > 0 ? profit / loss : 0;
    const risk = rr >= 1.8 ? 25 : rr >= 1.5 ? 18 : rr >= 1 ? 10 : 0;
    const stretch = ok(ma20) && ok(atr) && atr ? Math.abs(close - ma20) / atr : null;
    const exe = stretch !== null && stretch <= 2 && V[i] > 0 ? 10 : stretch !== null && stretch <= 3 ? 5 : 0;
    const score = trend + mom + vs + risk + exe;
    const strict = trend === 25 && mom >= 16 && vs >= 14 && risk === 25 && exe === 10 && i + 1 >= 60;
    return [score >= 90 && strict ? "S" : score >= 78 ? "A" : score >= 60 ? "B" : "C", score];
  }

  function simulate(O, H, L, C, V, sig, ex, plans, sym, cn) {
    const n = C.length, cost = COST[cn ? "cn" : "us"], slip = cost.slip, lp = cn ? limitPct(sym) : null;
    const trades = []; let pos = null;
    for (let i = 1; i < n; i++) {
      let sold = false;
      const pc = C[i - 1];
      const upLim = cn && O[i] >= pc * (1 + lp) * 0.998, dnLim = cn && O[i] <= pc * (1 - lp) * 1.002;
      if (pos !== null && (!cn || i > pos[1])) {
        const stop = pos[3], take = pos[4];
        let ev = null;
        if (O[i] <= stop) ev = [O[i], "跳空止损"];
        else if (O[i] >= take) ev = [O[i], "跳空止盈"];
        else if (ex !== null && ex[i - 1]) ev = [O[i], "指标退出"];
        else if (i - pos[1] >= pos[5]) ev = [O[i], "持有到期"];
        else if (L[i] <= stop) ev = [stop, "止损"];
        else if (H[i] >= take) ev = [take, "止盈"];
        if (ev && V[i] > 0 && !dnLim) {
          const px = ev[0] * (1 - slip);
          trades.push([pos[0], pos[1], i, pos[2], px, px * (1 - cost.sell) / (pos[2] * (1 + cost.buy)) - 1, ev[1]]);
          pos = null; sold = true;
        }
      }
      if (pos === null && !sold && sig[i - 1]) {
        if (V[i] > 0 && !upLim) {
          const [st, tk, hd] = plans[i - 1];
          const entry = O[i] * (1 + slip);
          pos = [i - 1, i, entry, entry * (1 - st / 100), entry * (1 + tk / 100), hd];
          if (!cn) {
            let ev = null;
            if (L[i] <= pos[3]) ev = [pos[3], "止损"]; else if (H[i] >= pos[4]) ev = [pos[4], "止盈"];
            if (ev) { const px = ev[0] * (1 - slip); trades.push([pos[0], pos[1], i, entry, px, px * (1 - cost.sell) / (entry * (1 + cost.buy)) - 1, ev[1]]); pos = null; }
          }
        }
      }
    }
    return [trades, pos];
  }

  const cols = (K) => (Array.isArray(K) ? { d: K.map((k) => k.d), o: K.map((k) => k.o), h: K.map((k) => k.h), l: K.map((k) => k.l), c: K.map((k) => k.c), v: K.map((k) => k.v) } : K);
  function analyze(sym, K, cn = null, rules = null) {
    if (cn === null) cn = !sym.startsWith("us");
    const k_ = cols(K), O = k_.o, H = k_.h, L = k_.l, C = k_.c, V = k_.v, n = C.length, out = {};
    if (n < 30) return out;
    const I = compute(O, H, L, C, V), S = entrySignals(O, H, L, C, V, I, cn), X = exitSignals(O, H, L, C, V, I, cn);
    for (const key of rules || ORDER) {
      let sig, ex, plans, grades = {};
      if (key === "mp_auto") {
        if (n < 125) continue;
        const [buy, exp, gr, sc, st] = autoSignals(O, H, L, C, V);
        plans = st.map((x) => (x === null ? null : [x, pyRound4(x * 2), 10]));
        for (let t = 0; t < n; t++) if (buy[t]) grades[t] = [gr[t], sc[t]];
        sig = buy; ex = exp;
      } else {
        if (RULES[key][4] && !cn) continue;
        sig = S[key]; ex = X[key]; plans = new Array(n).fill(FIXED);
        for (let t = 0; t < n; t++) if (sig[t]) grades[t] = assess(O, H, L, C, V, I, t, key, sym, cn);
      }
      const [trades, pos] = simulate(O, H, L, C, V, sig, ex, plans, sym, cn);
      let exitNext = null;
      if (pos !== null) { const last = n - 1; if (ex[last]) exitNext = "指标退出"; else if (last + 1 - pos[1] >= pos[5]) exitNext = "持有到期"; }
      const sl = []; for (let t = 0; t < n; t++) if (sig[t]) sl.push(t);
      out[key] = { sig: sl, grade: grades, trades, open: pos, exit_next: exitNext, plan: sig[n - 1] ? plans[n - 1] : null, plans };
    }
    return out;
  }
  function customCombo(K, keys, match = "all", stop = 3.0, take = 6.0, hold = 10, cn = null, sym = "") {
    if (cn === null) cn = !sym.startsWith("us");
    const k_ = cols(K), O = k_.o, H = k_.h, L = k_.l, C = k_.c, V = k_.v, n = C.length;
    const I = compute(O, H, L, C, V), S = entrySignals(O, H, L, C, V, I, cn);
    const sig = new Array(n).fill(false);
    for (let t = 0; t < n; t++) { const hits = keys.filter((k) => S[k]).map((k) => S[k][t]); sig[t] = hits.length > 0 && (match === "all" ? hits.every(Boolean) : hits.some(Boolean)); }
    return simulate(O, H, L, C, V, sig, null, new Array(n).fill([stop, take, hold]), sym, cn);
  }
  /* 一串交易的成绩：次数、胜率、平均收益、复利累计、最大回撤（按笔复利的资金曲线，空仓不计）、同期买入持有 */
  function perf(trades, C, i0) {
    const n = trades.length;
    let eq = 1, peak = 1, mdd = 0, w = 0, s = 0;
    for (const t of trades) { eq *= 1 + t[5]; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); if (t[5] > 0) w++; s += t[5]; }
    const a = i0 == null ? 0 : i0;
    return { n, win: n ? w / n * 100 : null, avg: n ? s / n * 100 : null, cum: (eq - 1) * 100, mdd: mdd * 100, hold: C.length > a + 1 ? (C[C.length - 1] / C[a] - 1) * 100 : null };
  }
  const api = { RULES, ORDER, FIXED, COST, compute, entrySignals, exitSignals, autoSignals, assess, simulate, analyze, customCombo, perf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MPRules = api;
})(typeof window !== "undefined" ? window : globalThis);
