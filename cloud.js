/* 小七指标学堂 · 云同步（WorkBuddy 云服务：WorkBuddy 账号登录 + 学习进度/测验成绩保存）
 * 只在 WorkBuddy 发布链接上启用（云服务按域名校验来源）；GitHub 等其他镜像只做阅读，不显示登录。
 * SDK 异步加载，不阻塞页面显示。 */
(function () {
  const publicConfig = {
    endpoint: "https://xiaobai-indicator-academy.app-tencent.workbuddy.host",
    oauthRelayBaseUrl: "https://www.workbuddy.cn/v2/as/genie-baas/oauth",
    publishableKey: "wbpk_OGc78yUbMFyN7xwb1uR9BH_uPYgH6JxG5CxjKmzFmeiv6iaAMxFvf7h",
  };
  const SDK = "https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js";
  const enabled = location.origin === publicConfig.endpoint;
  const st = { cloud: null, user: null, ready: false, err: "", learned: new Set(), attempts: [] };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const errText = (e) => {
    const m = (e && (e.message || e.msg)) || String(e || "");
    if (/network|fetch|Failed to fetch/i.test(m)) return "网络不太好，稍后再试";
    if (/42501|permission|denied/i.test(m)) return "没有权限，请重新登录";
    if (/quota|limit|exceed/i.test(m)) return "云服务额度不足，请联系管理员";
    return m || "操作失败，请重试";
  };

  function loadSdk() {
    return new Promise((res, rej) => {
      if (window.WorkBuddyCloud) return res();
      const s = document.createElement("script");
      s.src = SDK; s.async = true; s.onload = res; s.onerror = () => rej(new Error("登录组件加载失败（网络问题）"));
      document.head.appendChild(s);
    });
  }

  // ---------- 头部按钮 ----------
  function renderBar() {
    const el = $("#authbar");
    if (!el) return;
    if (!enabled) { el.innerHTML = ""; return; }
    if (!st.ready || !st.cloud) { el.innerHTML = `<span class="muted small">${st.err ? esc(st.err) : "连接中…"}</span>`; return; }
    if (st.user) {
      const name = st.user.name || "已登录";
      el.innerHTML = `<a href="#/me" class="me">👤 ${esc(name)}</a>`;
    } else {
      el.innerHTML = `<button class="btn" id="loginBtn">使用 WorkBuddy 登录</button>`;
      $("#loginBtn").onclick = login;
    }
  }

  async function login() {
    try {
      const back = new URL(location.href);
      back.pathname = "/";
      for (const k of ["code", "state", "provider"]) back.searchParams.delete(k);
      const { data, error } = await st.cloud.auth.signInWithOAuth({ provider: "workbuddy", redirectTo: back.toString() });
      if (error) return toast("登录失败：" + errText(error));
      location.assign(data.url);
    } catch (e) { toast("登录失败：" + errText(e)); }
  }

  async function logout() {
    await st.cloud.auth.signOut();
    st.user = null; st.learned = new Set(); st.attempts = [];
    renderBar(); refresh();
  }

  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.className = "show";
    clearTimeout(t._h); t._h = setTimeout(() => (t.className = ""), 3200);
  }

  // ---------- 回调处理（先于一切页面逻辑） ----------
  async function restoreAuth() {
    const url = new URL(location.href);
    if (url.searchParams.has("code") || url.searchParams.has("error")) {
      if (url.searchParams.get("provider") !== "workbuddy") { st.err = "登录回调无效，请重新登录"; return; }
      if (typeof st.cloud.auth.handleWorkBuddyCallback !== "function") { st.err = "暂时无法登录"; return; }
      const { data: session, error } = await st.cloud.auth.handleWorkBuddyCallback();
      for (const k of ["code", "state", "provider", "error", "error_description"]) url.searchParams.delete(k);
      history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      if (error) { toast("登录失败：" + errText(error)); return; }
      if (session) { st.user = session.user; toast("登录成功，学习进度会自动保存到云端"); return; }
    }
    const { data: session } = await st.cloud.auth.getSession();
    st.user = session ? session.user : null;
  }

  // ---------- 数据 ----------
  async function loadMine() {
    if (!st.user) return;
    const db = st.cloud.database;
    const a = await db.from("lesson_progress").select("lesson_id, created_at").order("created_at", { ascending: true });
    if (a.error) throw a.error;
    st.learned = new Set((a.data || []).map((r) => r.lesson_id));
    const b = await db.from("quiz_attempts").select("id, score, total, created_at").order("created_at", { ascending: false }).limit(10);
    if (b.error) throw b.error;
    st.attempts = b.data || [];
  }

  async function markLearned(id, on) {
    if (!st.user) return toast("先登录，才能把进度保存到云端");
    const db = st.cloud.database;
    if (on) {
      const { error } = await db.from("lesson_progress").insert({ lesson_id: id, owner_name: st.user.name ?? null }).select();
      if (error && error.code !== "23505") return toast("保存失败：" + errText(error));
      st.learned.add(id);
      toast("已记为学会 ✅（已保存到云端）");
    } else {
      const { data, error } = await db.from("lesson_progress").delete().eq("lesson_id", id).select();
      if (error) return toast("取消失败：" + errText(error));
      if (!data || !data.length) toast("没有找到这条记录");
      st.learned.delete(id);
    }
    refresh();
  }

  async function saveQuiz(score, total, answers) {
    if (!st.user) return toast(`答对 ${score}/${total}。登录后成绩会保存到云端`);
    const { data, error } = await st.cloud.database.from("quiz_attempts")
      .insert({ score, total, answers, owner_name: st.user.name ?? null }).select("id, score, total, created_at");
    if (error) return toast("成绩保存失败：" + errText(error));
    st.attempts.unshift(data[0]);
    toast(`成绩 ${score}/${total} 已保存到云端`);
    refresh();
  }

  // ---------- 页面装饰 ----------
  let cur = { page: "", id: "" };
  function refresh() { decorate(cur); }
  function decorate({ page, id }) {
    cur = { page, id };
    if (!enabled) return;
    const total = (window.LESSONS || []).length;
    if (page === "home") {
      const box = $("#myprogress");
      if (!box) return;
      if (!st.ready || !st.cloud) { box.innerHTML = st.err ? `<div class="card muted">云同步暂不可用：${esc(st.err)}</div>` : ""; return; }
      if (!st.user) { box.innerHTML = `<div class="card">登录后可以记录<b>学过哪些课</b>和<b>每次测验成绩</b>，换手机、换电脑都能接着学。<button class="btn" id="homeLogin">使用 WorkBuddy 登录</button></div>`; $("#homeLogin").onclick = login; return; }
      const n = st.learned.size, pct = total ? Math.round((n / total) * 100) : 0;
      const last = st.attempts[0];
      box.innerHTML = `<div class="card"><div class="ct">我的学习进度<span class="badge"><a href="#/me">详情 →</a></span></div>
        <div class="bar"><i style="width:${pct}%"></i></div><div class="muted">已学会 ${n}/${total} 课（${pct}%）${last ? `｜最近一次测验 ${last.score}/${last.total}` : "｜还没做过测验"}</div></div>`;
    }
    if (page === "lesson") {
      const box = $("#learnbox");
      if (!box) return;
      if (!st.ready || !st.cloud) { box.innerHTML = ""; return; }
      if (!st.user) { box.innerHTML = `<button class="btn ghost" id="lessonLogin">登录后可以记录这课已学会</button>`; $("#lessonLogin").onclick = login; return; }
      const on = st.learned.has(id);
      box.innerHTML = `<button class="btn ${on ? "done" : ""}" id="learnBtn">${on ? "✅ 已学会（点击取消）" : "我学会了，记下来"}</button>`;
      $("#learnBtn").onclick = () => markLearned(id, !on);
    }
    if (page === "cat") {
      document.querySelectorAll(".item").forEach((a) => {
        const lid = (a.getAttribute("href") || "").split("/").pop();
        a.classList.toggle("learned", st.learned.has(lid));
      });
    }
    if (page === "me") renderMe();
  }

  function renderMe() {
    const app = $("#app"), L = window.LESSONS || [];
    if (!enabled) { app.innerHTML = `<h1>我的</h1><div class="card">云同步只在 WorkBuddy 链接上可用。</div>`; return; }
    if (!st.ready || !st.cloud) { app.innerHTML = `<h1>我的</h1><div class="card">${esc(st.err || "连接中…")}</div>`; return; }
    if (!st.user) { app.innerHTML = `<h1>我的</h1><div class="card">还没登录。<button class="btn" id="meLogin">使用 WorkBuddy 登录</button></div>`; $("#meLogin").onclick = login; return; }
    const cats = (window.CATS || []).map((c) => {
      const ls = L.filter((x) => x.cat === c.id), n = ls.filter((x) => st.learned.has(x.id)).length;
      return `<tr><td><a href="#/cat/${c.id}">${c.name}</a></td><td>${n}/${ls.length}</td><td><div class="bar sm"><i style="width:${ls.length ? (n / ls.length) * 100 : 0}%"></i></div></td></tr>`;
    }).join("");
    const todo = L.filter((x) => !st.learned.has(x.id)).slice(0, 5);
    app.innerHTML = `<div class="crumb"><a href="#/">首页</a> / 我的</div><h1>我的学习</h1>
      <div class="muted">${esc(st.user.name || "WorkBuddy 用户")}｜数据保存在云端，只有你自己能看到</div>
      <h2>各分类进度</h2><div class="tablewrap"><table class="tbl"><tr><th>分类</th><th>已学会</th><th>进度</th></tr>${cats}</table></div>
      <h2>接下来学</h2><div class="list">${todo.map((x) => `<a class="card item" href="#/lesson/${x.id}"><div class="it">${x.title}</div></a>`).join("") || '<div class="card">全部学完了 🎉</div>'}</div>
      <h2>测验记录</h2><div class="tablewrap"><table class="tbl"><tr><th>时间</th><th>成绩</th></tr>${st.attempts.map((a) => `<tr><td>${esc(new Date(a.created_at).toLocaleString("zh-CN"))}</td><td>${a.score}/${a.total}</td></tr>`).join("") || '<tr><td colspan="2">还没做过测验，<a href="#/quiz">去做一次</a></td></tr>'}</table></div>
      <p><button class="btn ghost" id="logoutBtn">退出登录</button></p>`;
    $("#logoutBtn").onclick = logout;
  }

  window.Cloud = { enabled, decorate, saveQuiz, state: st };

  // ---------- 启动 ----------
  (async function boot() {
    renderBar();
    if (!enabled) return;
    try {
      await loadSdk();
      st.cloud = WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: publicConfig.endpoint,
        oauthRelayBaseUrl: publicConfig.oauthRelayBaseUrl,
        publishableKey: publicConfig.publishableKey,
      });
      await restoreAuth();
      if (st.user) await loadMine();
      st.cloud.auth.onAuthStateChange && st.cloud.auth.onAuthStateChange((_e, session) => {
        const u = session ? session.user : null;
        if (!!u !== !!st.user) { st.user = u; if (!u) { st.learned = new Set(); st.attempts = []; } renderBar(); refresh(); }
      });
    } catch (e) {
      st.err = errText(e);
    }
    st.ready = true;
    renderBar();
    refresh();
  })();
})();
