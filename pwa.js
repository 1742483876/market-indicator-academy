/* 小七投研 PWA 外壳（2026-11-25）：学堂与个股站（stock/）共用。
 * 1) 注册 Service Worker（sw.js，作用范围 = 本文件所在目录 = 站点根）
 * 2) 新版本提示条「有新版本，点此刷新」（waiting → SKIP_WAITING → controllerchange 刷新）
 * 3) 离线角标「离线 · 数据时间 HH:MM」（SW 回退到缓存时通知；网络恢复后变成「点此刷新」）
 * 4) 首页「📲 添加到桌面」提示：Android Chrome 一键安装（beforeinstallprompt）/ iPhone 图示步骤 / 微信里提示先用浏览器打开；已安装不显示
 * 5) 桌面 App（standalone）里：下拉刷新、外部链接新窗口打开、空闲时预取常用页（断网也能看）
 * 改了 sw.js 的缓存逻辑就把下面 SWV 和 index.html、stock/index.html 里 pwa.js?v= 一起改，用户会看到「有新版本」。
 */
(function () {
  "use strict";
  const SWV = "u27";
  const me = document.currentScript;
  const ROOT = new URL(".", (me && me.src) || location.href); // 站点根（pwa.js 所在目录）
  const isStock = location.pathname.startsWith(ROOT.pathname + "stock/");
  const mq = (q) => window.matchMedia && matchMedia(q).matches;
  const standalone = () => mq("(display-mode: standalone)") || mq("(display-mode: fullscreen)") || mq("(display-mode: minimal-ui)") || navigator.standalone === true;
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isWx = /MicroMessenger/i.test(ua);
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const root = document.documentElement;
  if (standalone()) root.classList.add("pwa-app");

  // ---------- 样式（两站共用，自带，不依赖各站 style.css）----------
  const css = `
#pwa-tip{margin:8px 10px 0;padding:10px 12px;border-radius:12px;background:#fff7e6;border:1px solid #f5d9a8;color:#5c3d00;font-size:14px;line-height:1.55;position:relative}
@media (min-width:761px){#pwa-tip{margin:12px auto 0;max-width:940px}}
#pwa-tip b{font-size:15px}#pwa-tip .x{position:absolute;right:6px;top:4px;border:0;background:none;font-size:20px;color:#a07a3a;padding:2px 8px;cursor:pointer}
#pwa-tip .st{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 10px}#pwa-tip .st li{white-space:nowrap}
#pwa-tip .st svg{width:17px;height:17px;vertical-align:-3px;fill:none;stroke:#2f7fd8;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#pwa-tip .go{margin-top:8px;border:0;border-radius:8px;background:#e5484d;color:#fff;font-weight:700;padding:7px 16px;font-size:14px}
#pwa-tip .hint{display:block;color:#8a6a33;font-size:12.5px;margin-top:2px}
#pwa-bar{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 8px);z-index:99;background:#1f2328;color:#fff;border-radius:22px;padding:9px 16px;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.25);cursor:pointer;white-space:nowrap}
#pwa-bar b{color:#ffd27a}
#pwa-off{position:fixed;right:10px;bottom:calc(var(--tabh,0px) + env(safe-area-inset-bottom,0px) + 10px);z-index:98;background:rgba(31,35,40,.88);color:#fff;border-radius:16px;padding:5px 11px;font-size:12.5px;box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:pointer}
@media (min-width:761px){#pwa-off{bottom:12px}}
#pwa-ptr{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 52px);z-index:97;text-align:center;pointer-events:none;opacity:0;transition:opacity .15s}
#pwa-ptr span{display:inline-block;background:#fff;border:1px solid #e7e9ee;border-radius:16px;padding:4px 12px;font-size:13px;color:#6b7280;box-shadow:0 2px 8px rgba(0,0,0,.08)}
html.pwa-app body{overscroll-behavior-y:contain}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const el = (tag, id, html) => { let x = document.getElementById(id); if (!x) { x = document.createElement(tag); x.id = id; document.body.appendChild(x); } if (html != null) x.innerHTML = html; return x; };
  const hm = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, "0"), today = new Date().toDateString() === d.toDateString(); return (today ? "" : `${p(d.getMonth() + 1)}-${p(d.getDate())} `) + `${p(d.getHours())}:${p(d.getMinutes())}`; };

  // ---------- 1) 注册 SW + 2) 新版本提示 ----------
  let reloading = false, wantReload = false;
  function showUpdate(reg) {
    const b = el("div", "pwa-bar", "🆕 有新版本，<b>点此刷新</b>");
    b.onclick = () => {
      b.innerHTML = "正在更新…";
      wantReload = true;
      const w = reg.waiting;
      if (w) w.postMessage({ type: "SKIP_WAITING" }); else location.reload();
      setTimeout(() => { if (!reloading) location.reload(); }, 3000);
    };
  }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    const hadCtl = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadCtl && !wantReload) return; // 第一次安装接管，不用刷新
      if (reloading) return; reloading = true; location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("sw.js?v=" + SWV, ROOT).href, { scope: ROOT.pathname, updateViaCache: "none" }).then((reg) => {
        window.__pwaReg = reg;
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing; if (!w) return;
          w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdate(reg); });
        });
        // App 从后台切回来时查一下有没有新版本
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
      }).catch(() => {});
    });
    // ---------- 3) 离线角标 ----------
    let oldest = 0;
    navigator.serviceWorker.addEventListener("message", (e) => {
      const d = e.data || {};
      if (d.type === "sw-fallback") {
        oldest = oldest ? Math.min(oldest, d.ts || oldest) : d.ts || 0;
        const off = d.why === "offline" || navigator.onLine === false;
        const o = el("div", "pwa-off", `${off ? "📴 离线" : "🐢 网络慢"} · 数据时间 ${oldest ? hm(oldest) : "未知"}`);
        o.title = "显示的是上次存下的数据；点一下重新加载"; o.onclick = () => location.reload();
      } else if (d.type === "sw-online") {
        const o = document.getElementById("pwa-off");
        if (o && navigator.onLine !== false && !/恢复/.test(o.textContent)) { o.textContent = "✅ 网络已恢复 · 点此刷新"; }
      }
    });
    window.addEventListener("offline", () => { const o = el("div", "pwa-off"); if (!o.textContent) o.textContent = "📴 离线 · 显示上次的数据"; o.onclick = () => location.reload(); });
    window.addEventListener("online", () => { const o = document.getElementById("pwa-off"); if (o) o.textContent = "✅ 网络已恢复 · 点此刷新"; });
    if (navigator.onLine === false) { const showOff = () => { const o = el("div", "pwa-off"); if (!o.textContent) o.textContent = "📴 离线 · 显示上次的数据"; o.onclick = () => location.reload(); }; if (document.body) showOff(); else document.addEventListener("DOMContentLoaded", showOff); }
  }

  // ---------- 4) 添加到桌面提示（只在学堂首页、手机浏览器、未安装、没关过时显示）----------
  let deferred = null;
  const SHARE = '<svg viewBox="0 0 24 24"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/></svg>';
  function tipHTML() {
    const head = '<button class="x" aria-label="关闭">×</button><b>📲 添加到桌面，像 App 一样用</b><span class="hint">全屏打开、底部导航、断网也能看上次的数据</span>';
    if (isWx) return head + '<ol class="st"><li>① 点右上角「···」</li><li>② 选「在浏览器打开」</li><li>③ 再按浏览器提示添加到桌面</li></ol>';
    if (isIOS) return head + `<ol class="st"><li>① 点底部 ${SHARE}「分享」</li><li>② 往下滑，选 ${PLUS}「添加到主屏幕」</li><li>③ 点右上角「添加」</li></ol>${/CriOS|FxiOS|EdgiOS/.test(ua) ? '<span class="hint">用 Safari 打开本页更稳</span>' : ""}`;
    if (deferred) return head + '<button class="go">一键安装</button>';
    return head + '<ol class="st"><li>① 点浏览器右上角「⋮」</li><li>② 选「安装应用」或「添加到主屏幕」</li></ol>';
  }
  function onHome() { return !isStock && (location.hash === "" || location.hash === "#" || location.hash === "#/"); }
  function renderTip() {
    const show = !standalone() && (isIOS || isAndroid || deferred) && !LS.get("pwa_tip_off") && onHome();
    let t = document.getElementById("pwa-tip");
    if (!show) { if (t) t.remove(); return; }
    const app = document.getElementById("app");
    if (!app) return;
    if (!t) { t = document.createElement("div"); t.id = "pwa-tip"; app.parentNode.insertBefore(t, app); }
    t.innerHTML = tipHTML();
    t.querySelector(".x").onclick = () => { LS.set("pwa_tip_off", "1"); t.remove(); };
    const go = t.querySelector(".go");
    if (go) go.onclick = async () => {
      const d = deferred; if (!d) return;
      deferred = null; d.prompt();
      try { const r = await d.userChoice; if (r && r.outcome === "accepted") LS.set("pwa_tip_off", "1"); } catch (e) {}
      renderTip();
    };
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; renderTip(); });
  window.addEventListener("appinstalled", () => { LS.set("pwa_tip_off", "1"); deferred = null; renderTip(); });
  window.addEventListener("hashchange", renderTip);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderTip); else renderTip();

  // ---------- 5) 桌面 App 专属 ----------
  // 外部链接（腾讯文档、抖音、CBOE、财富规划等）：新窗口打开，不在 App 里把自己替换掉
  document.addEventListener("click", (e) => {
    if (!standalone()) return;
    const a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    let u; try { u = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    if (u.origin !== location.origin || !u.pathname.startsWith(ROOT.pathname)) { a.target = "_blank"; a.rel = "noopener"; }
  }, true);
  // 下拉刷新：在页面最顶上往下拉，松手重新拉数据
  if (standalone() && "ontouchstart" in window) {
    let y0 = null, x0 = 0, dy = 0, pulling = false;
    const ptr = el("div", "pwa-ptr", "<span>↓ 下拉刷新</span>");
    const blocked = () => document.querySelector("#lb.show, #gmod.show, .gsheet:not([hidden]), #tocpop") || document.body.style.overflow === "hidden";
    document.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || window.scrollY > 0 || blocked()) { y0 = null; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; pulling = false;
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (y0 == null) return;
      const t = e.touches[0]; dy = t.clientY - y0; const dx = Math.abs(t.clientX - x0);
      if (!pulling) { if (dy > 12 && dy > dx * 1.5 && window.scrollY <= 0) pulling = true; else if (dx > 12 || dy < -4) { y0 = null; return; } else return; }
      ptr.style.opacity = String(Math.min(1, dy / 80));
      ptr.firstChild.textContent = dy > 110 ? "↻ 松开刷新" : "↓ 下拉刷新";
    }, { passive: true });
    document.addEventListener("touchend", () => {
      if (pulling && dy > 110) { ptr.firstChild.textContent = "刷新中…"; ptr.style.opacity = "1"; location.reload(); }
      else ptr.style.opacity = "0";
      y0 = null; pulling = false; dy = 0;
    }, { passive: true });
  }
  // 预取常用页（只在桌面 App 里、非省流量、30 分钟一次）：该做什么 / 今日一票 / 赛马 / 报告列表 / 大事 / 期权 / 人气榜，断网也能打开
  if (!isStock && standalone()) window.addEventListener("load", () => setTimeout(() => {
    const A = window.__APP, c = navigator.connection;
    if (!A || !A.ver || !navigator.serviceWorker || !navigator.serviceWorker.controller || (c && c.saveData)) return;
    if (Date.now() - (+LS.get("pwa_warm") || 0) < 30 * 60e3) return;
    LS.set("pwa_warm", String(Date.now()));
    const mods = ["todo", "pick", "race", "cal", "opt", "hot"].map((m) => `${m}.js?v=${A.ver}`);
    const js = ["todo.json", "pick.json", "race.json", "events.json", "opt.json", "hot.json", "outlook.json", "s_signals.json", "reports/latest.json", "reports/index.json"];
    [...mods, ...js].forEach((u, i) => setTimeout(() => fetch(new URL(u, ROOT).href).catch(() => {}), i * 150));
  }, 4000));
})();
