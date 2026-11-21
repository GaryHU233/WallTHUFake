/* WallTHU 公共脚本：请求、页头页脚、卡片、弹层、验证码、灯箱 */
"use strict";

/* 线条图标（描边 SVG，随 currentColor 着色） */
const ICONS = {
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.5C7 16.6 3.5 13.4 3.5 9.6 3.5 7 5.6 5 8.1 5c1.6 0 3 .8 3.9 2.1C12.9 5.8 14.3 5 15.9 5c2.5 0 4.6 2 4.6 4.6 0 3.8-3.5 7-8.5 10.9Z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4.6L3 21l.8-3.2A8 8 0 1 1 21 12Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4.5c3-2 7 1 14-1.5v10c-7 2.5-11-.5-14 1.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12"/><path d="M10 11.5v5M14 11.5v5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chat: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 12a8 8 0 0 1-8 8H4.6L3 21l.8-3.2A8 8 0 1 1 21 12Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 10.5 12 3.5l8.5 7v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M9.5 21v-6.5h5V21"/></svg>',
  tag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 11.2V4.5a1 1 0 0 1 1-1h6.7a2 2 0 0 1 1.4.6l7.1 7.1a2 2 0 0 1 0 2.8l-6.4 6.4a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1-.6-1.4Z"/><circle cx="8" cy="8" r="1.6"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/></svg>',
  compose: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.5c-4.9 0-8.5-2.9-8.5-8V7l1.4-1.4L6.3 7l1.4-1.4L9.1 7l1.4-1.4L11.9 7l1.4-1.4L14.7 7l1.4-1.4L17.5 7l1.5-1.4.5.6v6.3c0 5.1-3.6 8-7.5 8Z"/><path d="m7.5 13.5 1.8 1.8 3-3.2"/></svg>',
};

/* 头像：根据种子取色，取名字首字 */
function avatarHtml(seed, name) {
  const palette = [
    ["#eaf3f7", "#096f9a"], ["#eaf7f0", "#28694c"], ["#fff6df", "#805c22"],
    ["#fff0ed", "#9c493a"], ["#f3effc", "#6b4a9b"], ["#fdf0f6", "#9b3d63"],
    ["#edf4f2", "#24694f"], ["#f5efe7", "#7a5230"],
  ];
  const s = String(seed == null ? "" : seed) + String(name || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const [bg, fg] = palette[h % palette.length];
  const ch = name ? [...name][0] : (seed ? "匿" : "墙");
  return `<span class="avatar" style="background:${bg};color:${fg}" aria-hidden="true">${esc(ch)}</span>`;
}

const CATEGORIES = ["表白捞人", "失物招领", "闲置交易", "求助问答", "树洞吐槽", "绘画分享", "音乐交流", "活动通知"];
// 普通访客可选分类：活动通知仅管理员可发布
const USER_CATEGORIES = CATEGORIES.filter((c) => c !== "活动通知");
const REPORT_REASONS = [
  "辱骂/人身攻击", "广告/推广", "引战/挑事", "虚假信息",
  "泄露隐私", "色情/低俗", "其他",
];

// 当前登录用户（null 表示未登录）；由 loadAuthUser() 填充
let authUser = null;
let authLoaded = false;

/* ---------------------------------- 工具 ---------------------------------- */
function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 10) return "刚刚";
  if (diff < 60) return `${diff} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

async function api(path, options = {}) {
  const opts = { credentials: "same-origin", ...options };
  opts.headers = { ...(options.headers || {}) };
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch (e) {
    throw new Error("网络连接失败，请检查网络");
  }
  let data = {};
  try { data = await res.json(); } catch (e) { /* 非 JSON */ }
  if (res.status === 401 && authUser) {
    // 单点登录：账号在其它设备重新登录后，本端 token 失效，就地登出
    authUser = null;
    authLoaded = true;
    if (typeof renderAuthState === "function") renderAuthState();
  }
  if (!res.ok) {
    const err = new Error(data.error || `请求失败 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------------------------- Toast --------------------------------- */
let toastWrap = null;
function toast(message, type = "") {
  if (!toastWrap) {
    toastWrap = document.createElement("div");
    toastWrap.className = "toast-wrap";
    document.body.appendChild(toastWrap);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = message;
  toastWrap.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .25s, transform .25s";
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) {}
    ta.remove();
    return ok;
  }
}

function absoluteUrl(path) {
  return new URL(path, location.origin).href;
}

/* ------------------------------- 页头 / 页脚 ------------------------------- */
function initHeader(active = "") {
  const el = document.getElementById("site-header");
  if (!el) return;
  const q = new URLSearchParams(location.search).get("q") || "";
  el.className = "site-header";
  el.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="/" aria-label="清华附中校园墙首页">
        <img class="brand-mark" src="/img/logo.png" alt="清华附中校园墙">
        <span class="brand-text">
          <strong>校园墙</strong>
          <small>清华附中国际部</small>
        </span>
      </a>
      <form class="header-search" id="header-search" role="search">
        <input type="search" name="q" value="${esc(q)}" maxlength="50"
               placeholder="搜索帖子，如「耳机」「图书馆」" aria-label="搜索帖子">
        <button type="submit" aria-label="搜索">${ICONS.search}</button>
      </form>
      <nav class="header-nav" aria-label="导航">
        <a href="/" class="${active === "home" ? "active" : ""}">首页</a>
        <a href="/tags" class="${active === "tags" ? "active" : ""}">标签</a>
        <a href="/me" class="${active === "me" ? "active" : ""}">我的</a>
        <a href="/rules" class="${active === "rules" ? "active" : ""}">墙规</a>
        <a href="/about" class="${active === "about" ? "active" : ""}">关于</a>
        <button class="chat-entry" id="dm-toggle" type="button" aria-label="私信" hidden>
          <span class="chat-icon" aria-hidden="true">${ICONS.chat}</span>
          <span class="chat-label">私信</span>
          <span class="chat-dot" id="dm-dot" hidden></span>
        </button>
        <button class="chat-entry" id="chat-toggle" type="button" aria-label="私信墙主">
          <span class="chat-icon" aria-hidden="true">${ICONS.mail}</span>
          <span class="chat-label">私信墙主</span>
          <span class="chat-dot" id="chat-dot" hidden></span>
        </button>
        <span class="auth-area" id="auth-area"></span>
      </nav>
    </div>`;
  document.getElementById("chat-toggle").addEventListener("click", openChatModal);
  document.getElementById("dm-toggle").addEventListener("click", openDmDrawer);
  document.getElementById("header-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = e.target.elements.q.value.trim();
    location.href = value ? `/?q=${encodeURIComponent(value)}` : "/";
  });
  renderAuthState();
  loadAuthUser();
  refreshChatBadge();
  setInterval(refreshChatBadge, 60000);
  setInterval(refreshDmBadge, 60000);

  // 移动端底部导航
  if (!document.getElementById("bottom-nav")) {
    const nav = document.createElement("nav");
    nav.id = "bottom-nav";
    nav.className = "bottom-nav";
    nav.setAttribute("aria-label", "移动端导航");
    nav.innerHTML = `
      <a href="/" class="${active === "home" ? "active" : ""}">${ICONS.home}<span>首页</span></a>
      <a href="/tags" class="${active === "tags" ? "active" : ""}">${ICONS.tag}<span>标签</span></a>
      <button type="button" class="bottom-compose" aria-label="发帖">${ICONS.compose}<span>发帖</span></button>
      <a href="/me" class="${active === "me" ? "active" : ""}">${ICONS.user}<span>我的</span></a>`;
    document.body.appendChild(nav);
    nav.querySelector(".bottom-compose").addEventListener("click", () => {
      const fab = document.getElementById("fab");
      if (fab) fab.click();
      else location.href = "/";
    });
  }
}

/* -------------------------------- 私信墙主 -------------------------------- */
let chatModal = null;

async function refreshChatBadge() {
  try {
    const data = await api("/api/messages/unread");
    const dot = document.getElementById("chat-dot");
    if (dot) dot.hidden = !data.unread;
  } catch (_) {
    /* 未登录 / 网络异常时静默 */
  }
}

function openChatModal() {
  if (!chatModal) buildChatModal();
  openModal(chatModal);
  loadChatMessages();
}

function buildChatModal() {
  chatModal = document.createElement("div");
  chatModal.className = "modal-overlay";
  chatModal.innerHTML = `
    <div class="modal chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div class="modal-head">
        <h2 id="chat-title">私信墙主</h2>
        <button class="modal-close" type="button" aria-label="关闭">✕</button>
      </div>
      <div class="modal-body chat-body">
        <div class="notice">
          <span>🔒</span>
          <span>消息只有你和墙主可见。请勿发送他人隐私或与校园墙无关的广告。</span>
        </div>
        <div class="chat-list" id="chat-list">
          <div class="chat-empty">加载中…</div>
        </div>
        <form id="chat-form" class="chat-form">
          <textarea class="textarea" name="content" maxlength="500" rows="2"
                    placeholder="给墙主留言，例如咨询、建议或申诉…" required></textarea>
          <button class="btn btn-primary btn-sm" type="submit">发送</button>
        </form>
      </div>
    </div>`;
  document.body.appendChild(chatModal);
  bindModalDismiss(chatModal);
  chatModal.querySelector("#chat-form").addEventListener("submit", sendChatMessage);
}

async function loadChatMessages() {
  const list = chatModal.querySelector("#chat-list");
  try {
    const data = await api("/api/messages");
    if (!data.messages.length) {
      list.innerHTML = `<div class="chat-empty">有问题、建议或申诉？<br>直接给墙主留言吧 👋</div>`;
    } else {
      list.innerHTML = data.messages.map(chatMessageHtml).join("");
      list.scrollTop = list.scrollHeight;
    }
    const dot = document.getElementById("chat-dot");
    if (dot) dot.hidden = true;
  } catch (err) {
    list.innerHTML = `<div class="chat-empty">${esc(err.message)}</div>`;
  }
}

function chatMessageHtml(m) {
  const mine = m.sender === "user";
  return `<div class="chat-msg ${mine ? "mine" : "theirs"}">
      ${mine ? "" : '<span class="chat-who">墙主</span>'}
      <div class="chat-bubble">${esc(m.content)}</div>
      <time class="chat-time">${fmtTime(m.created_at)}</time>
    </div>`;
}

async function sendChatMessage(e) {
  e.preventDefault();
  const form = e.target;
  const input = form.elements.content;
  const content = input.value.trim();
  if (!content) return toast("消息不能为空", "error");
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await api("/api/messages", { method: "POST", body: { content } });
    input.value = "";
    const list = chatModal.querySelector("#chat-list");
    if (list.querySelector(".chat-empty")) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", chatMessageHtml(data.message));
    list.scrollTop = list.scrollHeight;
  } catch (err) {
    toast(err.message, "error");
  } finally {
    button.disabled = false;
  }
}

/* ------------------------------ 用户登录态 ------------------------------ */
async function loadAuthUser(force = false) {
  if (authLoaded && !force) return authUser;
  try {
    const data = await api("/api/auth/me");
    authUser = data.authenticated ? data.user : null;
  } catch (_) {
    authUser = null;
  }
  authLoaded = true;
  renderAuthState();
  return authUser;
}

function renderAuthState() {
  const area = document.getElementById("auth-area");
  const dm = document.getElementById("dm-toggle");
  if (dm) dm.hidden = !authUser;
  if (!area) return;
  if (authUser) {
    area.innerHTML = `<span class="user-chip">
        ${avatarHtml(authUser.id, authUser.username || "我")}
        <span class="user-name">ID #${fmtUid(authUser.id)}</span>
        <span class="user-id">${esc(authUser.username)}</span>
        <button class="logout-btn" type="button" title="退出登录">退出</button></span>`;
    area.querySelector(".logout-btn").addEventListener("click", logoutUser);
  } else {
    area.innerHTML = `<button class="login-entry btn btn-sm" type="button">登录 / 注册</button>`;
    area.querySelector(".login-entry").addEventListener("click", () => openAuthModal("login"));
  }
  refreshDmBadge();
}

async function logoutUser() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (_) {}
  authUser = null;
  authLoaded = true;
  renderAuthState();
  toast("已退出登录", "success");
}

function requireLogin(actionLabel = "") {
  if (authUser) return true;
  openAuthModal("login");
  if (actionLabel) toast(`请先登录账号后${actionLabel}`, "info");
  return false;
}

async function refreshDmBadge() {
  const dot = document.getElementById("dm-dot");
  if (!dot) return;
  if (!authUser) { dot.hidden = true; return; }
  try {
    const data = await api("/api/dm/unread");
    dot.hidden = !data.unread;
  } catch (_) {
    dot.hidden = true;
  }
}

/* ------------------------------ 登录 / 注册 ------------------------------ */
let authModal = null;
let authOnSuccess = null;

function openAuthModal(mode = "login", onSuccess = null) {
  if (!authModal) buildAuthModal();
  authOnSuccess = typeof onSuccess === "function" ? onSuccess : null;
  switchAuthPane(mode);
  openModal(authModal);
}

function switchAuthPane(mode) {
  if (!authModal) return;
  authModal.querySelectorAll(".auth-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.mode === mode));
  authModal.querySelectorAll(".auth-pane").forEach((p) =>
    p.hidden = p.dataset.pane !== mode);
  if (mode === "register") {
    const img = authModal.querySelector("[data-captcha]");
    if (img) refreshCaptcha(img);
  }
}

function buildAuthModal() {
  authModal = document.createElement("div");
  authModal.className = "modal-overlay";
  authModal.innerHTML = `
    <div class="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div class="modal-head">
        <h2 id="auth-title">登录 / 注册</h2>
        <button class="modal-close" type="button" aria-label="关闭">✕</button>
      </div>
      <div class="auth-tabs">
        <button class="auth-tab active" data-mode="login" type="button">登录</button>
        <button class="auth-tab" data-mode="register" type="button">注册</button>
      </div>
      <div class="modal-body">
        <form class="auth-pane" data-pane="login" id="login-form">
          <div class="field">
            <div class="field-label">用户名</div>
            <input class="input" name="username" maxlength="20" autocomplete="username" required>
          </div>
          <div class="field">
            <div class="field-label">密码</div>
            <input class="input" name="password" type="password" maxlength="128" autocomplete="current-password" required>
          </div>
          <button class="btn btn-primary btn-block" type="submit">登录</button>
          <div class="notice" style="margin-top:12px">
            <span>🔒</span>
            <span>同一账号同一时间仅允许一处登录，新登录会使其它设备下线。</span>
          </div>
        </form>

        <form class="auth-pane" data-pane="register" id="register-form" hidden>
          <div class="field">
            <div class="field-label">用户名 <span class="hint">2-20 位字母、数字、下划线或中文</span></div>
            <input class="input" name="username" maxlength="20" autocomplete="username" required>
          </div>
          <div class="field">
            <div class="field-label">昵称 <span class="hint">选填，可重复</span></div>
            <input class="input" name="nickname" maxlength="20" autocomplete="nickname" placeholder="选填，实名发帖时展示">
          </div>
          <div class="field">
            <div class="field-label">密码 <span class="hint">至少 6 位</span></div>
            <input class="input" name="password" type="password" maxlength="128" autocomplete="new-password" required>
          </div>
          <div class="field">
            <div class="field-label">确认密码</div>
            <input class="input" name="password2" type="password" maxlength="128" autocomplete="new-password" required>
          </div>
          <div class="field">
            <div class="field-label">手机号 <span class="hint">选填</span></div>
            <input class="input" name="phone" maxlength="30" autocomplete="tel" placeholder="选填，用于找回账号">
          </div>
          <div class="field">
            <div class="field-label">微信号 <span class="hint">选填</span></div>
            <input class="input" name="wechat" maxlength="30" autocomplete="off" placeholder="选填，用于联系">
          </div>
          ${captchaHtml()}
          <button class="btn btn-primary btn-block" type="submit">注册</button>
        </form>
      </div>
    </div>`;
  document.body.appendChild(authModal);
  bindModalDismiss(authModal);
  bindCaptcha(authModal);
  authModal.querySelectorAll(".auth-tab").forEach((t) =>
    t.addEventListener("click", () => switchAuthPane(t.dataset.mode)));
  authModal.querySelector("#login-form").addEventListener("submit", submitLogin);
  authModal.querySelector("#register-form").addEventListener("submit", submitRegister);
}

async function submitLogin(e) {
  e.preventDefault();
  const form = e.target;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { username: form.elements.username.value.trim(), password: form.elements.password.value },
    });
    await loadAuthUser(true);
    closeModal(authModal);
    toast(`欢迎回来，${data.user.username}`, "success");
    if (authOnSuccess) { const cb = authOnSuccess; authOnSuccess = null; cb(); }
  } catch (err) {
    toast(err.message, "error");
  } finally {
    submit.disabled = false;
  }
}

async function submitRegister(e) {
  e.preventDefault();
  const form = e.target;
  const pwd = form.elements.password.value;
  if (pwd.length < 6) return toast("密码至少 6 位", "error");
  if (pwd !== form.elements.password2.value) return toast("两次输入的密码不一致", "error");
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: {
        username: form.elements.username.value.trim(),
        password: pwd,
        captcha: form.elements.captcha.value.trim(),
        nickname: form.elements.nickname.value.trim(),
        phone: form.elements.phone.value.trim(),
        wechat: form.elements.wechat.value.trim(),
      },
    });
    toast(data.message || "注册成功", "success");
    form.reset();
    switchAuthPane("login");
  } catch (err) {
    toast(err.message, "error");
    const img = authModal.querySelector("[data-captcha]");
    if (img) refreshCaptcha(img);
  } finally {
    submit.disabled = false;
  }
}

/* ------------------------------ 用户间私信 ------------------------------ */
let dmDrawer = null;
let dmConvId = null;
let dmConvName = "";
let dmConvAnon = false;
let dmBlock = { blocked: false, blocked_by_me: false };

// 专属 ID 编号统一补足 5 位展示（如 15 → 00015）
function fmtUid(id) {
  return id == null ? "" : String(id).padStart(5, "0");
}

// 对他人展示的用户名：专属 ID 编号为主，实名昵称（如有）作为补充，不暴露注册用户名
function uidLabel(user) {
  const tag = `用户 #${fmtUid(user.id)}`;
  return user.nickname ? `${user.nickname} · ${tag}` : tag;
}

function openDmDrawer() {
  if (!authUser) { openAuthModal("login", () => openDmDrawer()); return; }
  if (!dmDrawer) buildDmDrawer();
  showDmList();
  openDmPanel();
}

// 从帖子 / 评论的「私信」按钮直接发起会话；anon=true 表示对方是匿名发布，只显示其 ID
function openDmTo(userId, anon) {
  if (!authUser) { openAuthModal("login", () => openDmTo(userId, anon)); return; }
  if (!userId || userId === authUser.id) return;
  if (!dmDrawer) buildDmDrawer();
  openDmPanel();
  showDmChat(userId, !!anon);
}

function openDmPanel() {
  dmDrawer.classList.add("open");
  const backdrop = document.getElementById("dm-backdrop");
  if (backdrop) backdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDmPanel() {
  if (!dmDrawer) return;
  dmDrawer.classList.remove("open");
  const backdrop = document.getElementById("dm-backdrop");
  if (backdrop) backdrop.classList.remove("open");
  if (!document.querySelector(".modal-overlay.open")) document.body.style.overflow = "";
}

function buildDmDrawer() {
  const backdrop = document.createElement("div");
  backdrop.className = "dm-backdrop";
  backdrop.id = "dm-backdrop";
  backdrop.addEventListener("click", closeDmPanel);
  document.body.appendChild(backdrop);

  dmDrawer = document.createElement("aside");
  dmDrawer.className = "dm-drawer";
  dmDrawer.innerHTML = `
    <div class="dm-head">
      <h2>私信</h2>
      <button class="dm-close" type="button" aria-label="关闭">✕</button>
    </div>
    <div class="dm-body">
      <div class="dm-view" id="dm-list-view">
        <div class="dm-search">
          <input class="input" id="dm-search-input" maxlength="20"
                 placeholder="输入用户 ID 或昵称，发起新私信" autocomplete="off">
        </div>
        <div class="dm-search-results" id="dm-search-results" hidden></div>
        <div class="dm-conv-list" id="dm-conv-list"><div class="chat-empty">加载中…</div></div>
      </div>
      <div class="dm-view" id="dm-chat-view" hidden>
        <div class="dm-chat-head">
          <button class="dm-back" type="button" aria-label="返回会话列表">←</button>
          <span class="dm-peer" id="dm-peer"></span>
          <button class="dm-block-btn" id="dm-block-btn" type="button" hidden>拉黑</button>
        </div>
        <div class="dm-block-notice" id="dm-block-notice" hidden></div>
        <div class="chat-list" id="dm-chat-list"></div>
        <form id="dm-form" class="chat-form">
          <textarea class="textarea" name="content" maxlength="500" rows="2"
                    placeholder="发送私信…" required></textarea>
          <button class="btn btn-primary btn-sm" type="submit">发送</button>
        </form>
      </div>
    </div>`;
  document.body.appendChild(dmDrawer);
  dmDrawer.querySelector(".dm-close").addEventListener("click", closeDmPanel);
  dmDrawer.querySelector(".dm-back").addEventListener("click", showDmList);
  dmDrawer.querySelector("#dm-form").addEventListener("submit", sendDm);
  dmDrawer.querySelector("#dm-block-btn").addEventListener("click", toggleDmBlock);
  const searchInput = dmDrawer.querySelector("#dm-search-input");
  searchInput.addEventListener("input", debounce(() => searchUsers(searchInput.value), 250));
  dmDrawer.querySelector("#dm-conv-list").addEventListener("click", (e) => {
    const btn = e.target.closest(".dm-conv");
    if (btn) showDmChat(Number(btn.dataset.userId));
  });
  dmDrawer.querySelector("#dm-search-results").addEventListener("click", (e) => {
    const btn = e.target.closest(".dm-search-item");
    if (!btn) return;
    dmDrawer.querySelector("#dm-search-input").value = "";
    dmDrawer.querySelector("#dm-search-results").hidden = true;
    showDmChat(Number(btn.dataset.userId));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dmDrawer.classList.contains("open")) closeDmPanel();
  });
}

function showDmList() {
  dmConvId = null;
  dmDrawer.querySelector("#dm-chat-view").hidden = true;
  dmDrawer.querySelector("#dm-list-view").hidden = false;
  loadDmConversations();
}

function showDmChat(userId, anon) {
  dmConvId = userId;
  dmConvAnon = !!anon;
  dmConvName = `用户 #${fmtUid(userId)}`;
  dmBlock = { blocked: false, blocked_by_me: false };
  dmDrawer.querySelector("#dm-list-view").hidden = true;
  dmDrawer.querySelector("#dm-chat-view").hidden = false;
  dmDrawer.querySelector("#dm-peer").textContent = dmConvName;
  dmDrawer.querySelector("#dm-block-btn").hidden = true;
  dmDrawer.querySelector("#dm-block-notice").hidden = true;
  dmDrawer.querySelector("#dm-form").hidden = false;
  loadDmThread(userId);
}

async function loadDmConversations() {
  const list = dmDrawer.querySelector("#dm-conv-list");
  try {
    const data = await api("/api/dm");
    if (!data.conversations.length) {
      list.innerHTML = `<div class="chat-empty">还没有私信会话<br>在上方输入用户 ID，发起第一条私信吧 👋</div>`;
    } else {
      list.innerHTML = data.conversations.map(dmConvHtml).join("");
    }
    refreshDmBadge();
  } catch (err) {
    list.innerHTML = `<div class="chat-empty">${esc(err.message)}</div>`;
  }
}

function dmConvHtml(c) {
  const mine = c.last_sender === authUser.id;
  const preview = (mine ? "我：" : "") + (c.last_content || "");
  const name = uidLabel(c.user);
  return `<button class="dm-conv" type="button" data-user-id="${c.user.id}">
      <span class="dm-conv-main">
        <span class="dm-conv-name">${esc(name)}${c.blocked ? " · 已拉黑" : ""}</span>
        <span class="dm-conv-preview">${esc(preview)}</span>
      </span>
      <span class="dm-conv-side">
        <time class="dm-conv-time">${fmtTime(c.last_at)}</time>
        ${c.unread ? `<span class="dm-unread">${c.unread}</span>` : ""}
      </span>
    </button>`;
}

async function searchUsers(q) {
  const box = dmDrawer.querySelector("#dm-search-results");
  if (!q || !q.trim()) { box.hidden = true; box.innerHTML = ""; return; }
  try {
    const data = await api(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
    if (!data.users.length) {
      box.hidden = false;
      box.innerHTML = `<div class="dm-search-empty">没有找到用户「${esc(q.trim())}」</div>`;
    } else {
      box.hidden = false;
      box.innerHTML = data.users.map((u) =>
        `<button class="dm-search-item" type="button" data-user-id="${u.id}">${esc(uidLabel(u))}</button>`).join("");
    }
  } catch (_) {
    box.hidden = true;
  }
}

async function loadDmThread(userId) {
  const list = dmDrawer.querySelector("#dm-chat-list");
  list.innerHTML = `<div class="chat-empty">加载中…</div>`;
  try {
    const anonQuery = dmConvAnon ? "?anon=1" : "";
    const data = await api(`/api/dm/${userId}${anonQuery}`);
    const peer = uidLabel(data.user);
    dmConvName = peer;
    dmDrawer.querySelector("#dm-peer").textContent = peer;
    dmBlock = { blocked: !!data.blocked, blocked_by_me: !!data.blocked_by_me };
    renderDmBlockState();
    list.innerHTML = data.messages.length
      ? data.messages.map(dmMessageHtml).join("")
      : `<div class="chat-empty">和 ${esc(peer)} 打个招呼吧 👋</div>`;
    list.scrollTop = list.scrollHeight;
    refreshDmBadge();
  } catch (err) {
    list.innerHTML = `<div class="chat-empty">${esc(err.message)}</div>`;
  }
}

function renderDmBlockState() {
  const btn = dmDrawer.querySelector("#dm-block-btn");
  const notice = dmDrawer.querySelector("#dm-block-notice");
  const form = dmDrawer.querySelector("#dm-form");
  if (dmBlock.blocked_by_me) {
    btn.textContent = "解除拉黑";
    btn.hidden = false;
    notice.innerHTML = "你已拉黑对方，解除后双方才能继续互发消息。";
    notice.hidden = false;
    form.hidden = true;
  } else if (dmBlock.blocked) {
    btn.hidden = true;
    notice.innerHTML = "对方已拉黑你，暂时无法发送消息。";
    notice.hidden = false;
    form.hidden = true;
  } else {
    btn.textContent = "拉黑";
    btn.hidden = false;
    notice.hidden = true;
    form.hidden = false;
  }
}

async function toggleDmBlock() {
  if (!dmConvId) return;
  const act = dmBlock.blocked_by_me ? "unblock" : "block";
  try {
    const data = await api(`/api/dm/${dmConvId}/${act}`, { method: "POST" });
    dmBlock.blocked_by_me = !!data.blocked;
    renderDmBlockState();
    toast(act === "block" ? "已拉黑对方" : "已解除拉黑", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

function dmMessageHtml(m) {
  const mine = m.sender_id === authUser.id;
  return `<div class="chat-msg ${mine ? "mine" : "theirs"}">
      ${mine ? "" : '<span class="chat-who">' + esc(dmConvName) + "</span>"}
      <div class="chat-bubble">${esc(m.content)}</div>
      <time class="chat-time">${fmtTime(m.created_at)}</time>
    </div>`;
}

async function sendDm(e) {
  e.preventDefault();
  if (!dmConvId) return;
  const form = e.target;
  const input = form.elements.content;
  const content = input.value.trim();
  if (!content) return toast("消息不能为空", "error");
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await api(`/api/dm/${dmConvId}`, { method: "POST", body: { content } });
    input.value = "";
    const list = dmDrawer.querySelector("#dm-chat-list");
    if (list.querySelector(".chat-empty")) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", dmMessageHtml(data.message));
    list.scrollTop = list.scrollHeight;
  } catch (err) {
    toast(err.message, "error");
  } finally {
    button.disabled = false;
  }
}

function initFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.className = "site-footer";
  el.innerHTML = `
    <div class="footer-inner">
      <div class="footer-note">
        内容仅代表发布者个人观点，与校园墙运营方及学校无关。本墙由学生志愿者运营，非学校官方平台。<br>
        请勿发布他人隐私信息，线下交易风险自担，谨防诈骗。
      </div>
      <div class="footer-links">
        <a href="/rules">墙规 / 发帖须知</a>
        <a href="/about">关于我们</a>
        <a href="/appeal">申诉</a>
        <a href="/tags">热门标签</a>
        <a href="https://this.edu.cn" target="_blank" rel="noopener noreferrer">清华附中官网</a>
      </div>
    </div>`;
}

/* --------------------------------- 验证码 --------------------------------- */
function captchaHtml() {
  return `<div class="captcha-row">
      <input class="input" name="captcha" placeholder="输入右侧验证码" maxlength="6"
             autocomplete="off" inputmode="text" required>
      <img class="captcha-img" src="/api/captcha" alt="点击刷新验证码" data-captcha>
    </div>`;
}

function refreshCaptcha(img) {
  img.src = "/api/captcha?t=" + Date.now();
}

function bindCaptcha(root) {
  root.querySelectorAll("[data-captcha]").forEach((img) => {
    img.addEventListener("click", () => refreshCaptcha(img));
  });
}

/* --------------------------------- 灯箱 ---------------------------------- */
let lightboxEl = null;
let lightboxImages = [];
let lightboxIndex = 0;

function ensureLightbox() {
  if (lightboxEl) return lightboxEl;
  lightboxEl = document.createElement("div");
  lightboxEl.className = "lightbox";
  lightboxEl.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="关闭">✕</button>
    <button class="lightbox-prev" type="button" aria-label="上一张">‹</button>
    <img alt="图片预览">
    <button class="lightbox-next" type="button" aria-label="下一张">›</button>
    <div class="lightbox-count"></div>`;
  document.body.appendChild(lightboxEl);

  const close = () => lightboxEl.classList.remove("open");
  lightboxEl.querySelector(".lightbox-close").addEventListener("click", close);
  lightboxEl.addEventListener("click", (e) => {
    if (e.target === lightboxEl) close();
  });
  lightboxEl.querySelector(".lightbox-prev").addEventListener("click", (e) => {
    e.stopPropagation(); stepLightbox(-1);
  });
  lightboxEl.querySelector(".lightbox-next").addEventListener("click", (e) => {
    e.stopPropagation(); stepLightbox(1);
  });
  document.addEventListener("keydown", (e) => {
    if (!lightboxEl.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });
  return lightboxEl;
}

function openLightbox(images, index) {
  if (!images || !images.length) return;
  ensureLightbox();
  lightboxImages = images;
  lightboxIndex = index || 0;
  renderLightbox();
  lightboxEl.classList.add("open");
}

function stepLightbox(delta) {
  if (lightboxImages.length < 2) return;
  lightboxIndex = (lightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
  renderLightbox();
}

function renderLightbox() {
  lightboxEl.querySelector("img").src = lightboxImages[lightboxIndex];
  lightboxEl.querySelector(".lightbox-count").textContent =
    lightboxImages.length > 1 ? `${lightboxIndex + 1} / ${lightboxImages.length}` : "";
  const multi = lightboxImages.length > 1 ? "" : "none";
  lightboxEl.querySelector(".lightbox-prev").style.display = multi;
  lightboxEl.querySelector(".lightbox-next").style.display = multi;
}

/* --------------------------------- 帖子卡片 -------------------------------- */
function imagesHtml(images, postId) {
  if (!images || !images.length) return "";
  const n = Math.min(images.length, 3);
  const cls = images.length === 1 ? "n1" : images.length === 2 ? "n2" : "";
  const cells = images.slice(0, 3).map((src, i) => {
    const more = i === 2 && images.length > 3
      ? `<div class="img-more">+${images.length - 3}</div>` : "";
    return `<div class="img-cell" data-img-index="${i}">
        <img src="${esc(src)}" alt="帖子图片 ${i + 1}" loading="lazy">
        ${more}
      </div>`;
  }).join("");
  return `<div class="post-images ${cls}" data-images='${esc(JSON.stringify(images))}'>${cells}</div>`;
}

function audiosHtml(audios) {
  if (!audios || !audios.length) return "";
  return `<div class="post-audios">${audios.map((src) =>
    `<audio class="audio-player" controls preload="metadata" src="${esc(src)}"></audio>`
  ).join("")}</div>`;
}

function zipsHtml(zips) {
  if (!zips || !zips.length) return "";
  return `<div class="post-zips">${zips.map((z) =>
    `<a class="zip-chip" href="${esc(z.url)}" download="${esc(z.name)}" title="下载附件">📦 ${esc(z.name)}</a>`
  ).join("")}</div>`;
}

function postCardHtml(post, { detail = false } = {}) {
  const cat = esc(post.category);
  const pinned = post.pinned ? `<span class="stamp">置顶</span>` : "";
  const who = post.is_anonymous
    ? `<span class="badge badge-anon">匿名</span>`
    : `<span class="badge badge-named">${esc(post.nickname || "实名")}</span>`;
  const uid = post.user_id
    ? `<span class="badge badge-uid" title="用户专属 ID">ID ${fmtUid(post.user_id)}</span>` : "";
  const dm = (!post.is_mine && post.user_id)
    ? `<button class="action-btn" data-action="dm" data-dm-user="${post.user_id}" data-anon="${post.is_anonymous ? 1 : 0}" title="私信发布者">${ICONS.mail} 私信</button>` : "";
  const images = imagesHtml(post.images, post.id);
  const audios = audiosHtml(post.audios);
  const avatar = avatarHtml(
    post.user_id || post.id,
    post.is_anonymous ? "" : (post.nickname || "")
  );
  return `
    <article class="post-card ${detail ? "is-detail" : ""} ${post.pinned ? "is-pinned" : ""}"
             data-post-id="${post.id}" data-cat="${cat}">
      ${avatar}
      <div class="post-main">
        <div class="post-top">
          <a class="badge-cat" href="/?category=${encodeURIComponent(post.category)}">${cat}</a>
          ${pinned}${who}${uid}
          <time class="post-time" datetime="${esc(post.created_at)}">${fmtTime(post.created_at)}</time>
        </div>
        <div class="post-content">${esc(post.content)}</div>
        ${images}
        ${audios}
        ${detail ? detailMetaHtml(post) : ""}
        <div class="post-footer">
          <button class="action-btn like ${post.liked ? "liked" : ""}" data-action="like"
                  aria-pressed="${post.liked ? "true" : "false"}" title="点赞">
            <span class="heart">${ICONS.heart}</span><span class="like-count">${post.like_count}</span>
          </button>
          ${detail
            ? `<a class="action-btn" href="#comments">${ICONS.comment} <span class="comment-count">${post.comment_count || 0}</span></a>`
            : `<a class="action-btn" href="/post/${post.id}">${ICONS.comment} <span>${post.comment_count || 0}</span></a>`}
          <button class="action-btn" data-action="copy" title="复制帖子文字">${ICONS.copy} 复制</button>
          <button class="action-btn" data-action="share" title="分享链接">${ICONS.share} 分享</button>
          ${dm}
          ${post.is_mine ? `<button class="action-btn danger" data-action="delete" title="删除我的帖子">${ICONS.trash} 删除</button>` : ""}
          <button class="action-btn report" data-action="report" title="举报该帖子">${ICONS.flag} 举报</button>
        </div>
      </div>
    </article>`;
}

function detailMetaHtml(post) {
  const contact = post.contact
    ? `<span>联系方式：${esc(post.contact)}</span>` : "";
  return `<div class="detail-meta">
      <span>${ICONS.eye} ${post.view_count} 次浏览</span>
      ${contact}
    </div>`;
}

/* ------------------------------ 卡片交互绑定 ------------------------------- */
function bindPostActions(root, options = {}) {
  const { navigate = true } = options;
  root.addEventListener("click", async (e) => {
    const imgCell = e.target.closest(".img-cell");
    if (imgCell) {
      e.preventDefault();
      const wrap = imgCell.closest(".post-images");
      let images = [];
      try { images = JSON.parse(wrap.dataset.images || "[]"); } catch (_) {}
      openLightbox(images, Number(imgCell.dataset.imgIndex) || 0);
      return;
    }

    const btn = e.target.closest("[data-action]");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest("[data-post-id]");
      if (!card) return;
      const postId = Number(card.dataset.postId);

      if (btn.dataset.action === "like") {
        btn.disabled = true;
        try {
          const data = await api(`/api/posts/${postId}/like`, { method: "POST" });
          btn.classList.toggle("liked", data.liked);
          btn.setAttribute("aria-pressed", data.liked ? "true" : "false");
          const counter = btn.querySelector(".like-count") || btn.querySelector("span:last-child");
          if (counter) counter.textContent = data.like_count;
        } catch (err) {
          toast(err.message, "error");
        } finally {
          btn.disabled = false;
        }
      } else if (btn.dataset.action === "copy") {
        const content = card.querySelector(".post-content");
        const ok = await copyText(content ? content.textContent.trim() : "");
        toast(ok ? "内容已复制" : "复制失败，请手动选择", ok ? "success" : "error");
      } else if (btn.dataset.action === "share") {
        const url = absoluteUrl(`/post/${postId}`);
        const content = card.querySelector(".post-content");
        const text = content ? content.textContent.trim().slice(0, 80) : "WallTHU 校园墙";
        if (navigator.share) {
          try {
            await navigator.share({ title: "WallTHU 校园墙", text, url });
          } catch (_) { /* 用户取消 */ }
        } else {
          const ok = await copyText(url);
          toast(ok ? "链接已复制" : "复制失败", ok ? "success" : "error");
        }
      } else if (btn.dataset.action === "dm") {
        openDmTo(Number(btn.dataset.dmUser), btn.dataset.anon === "1");
      } else if (btn.dataset.action === "report") {
        openReportModal(postId);
      } else if (btn.dataset.action === "delete") {
        if (!confirm("确定删除这条帖子吗？删除后将不再对外展示。")) return;
        btn.disabled = true;
        try {
          await api(`/api/posts/${postId}/delete`, { method: "POST" });
          toast("帖子已删除", "success");
          if (location.pathname.startsWith("/post/")) {
            location.href = "/";
          } else {
            card.remove();
            document.dispatchEvent(new CustomEvent("wallthu:post-deleted", { detail: { id: postId } }));
          }
        } catch (err) {
          toast(err.message, "error");
          btn.disabled = false;
        }
      }
      return;
    }

    if (navigate) {
      const card = e.target.closest(".post-card");
      if (card && !e.target.closest("a") && !e.target.closest("button")) {
        location.href = `/post/${card.dataset.postId}`;
      }
    }
  });
}

/* -------------------------------- 举报弹层 -------------------------------- */
let reportModal = null;

function openReportModal(postId, commentId) {
  if (!reportModal) {
    reportModal = document.createElement("div");
    reportModal.className = "modal-overlay";
    reportModal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div class="modal-head">
          <h2 id="report-title">举报内容</h2>
          <button class="modal-close" type="button" aria-label="关闭">✕</button>
        </div>
        <div class="modal-body">
          <form id="report-form">
            <div class="field">
              <div class="field-label">举报理由</div>
              <select class="select" name="reason" required>
                ${REPORT_REASONS.map((r) => `<option value="${r}">${r}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <div class="field-label">补充说明 <span class="hint">选填</span></div>
              <textarea class="textarea" name="detail" maxlength="300"
                        style="min-height:84px" placeholder="可以补充具体情况，方便管理员判断"></textarea>
            </div>
            <div class="notice">举报会提交给管理员人工审核，恶意举报同样可能被处理。</div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:16px">提交举报</button>
          </form>
        </div>
      </div>`;
    document.body.appendChild(reportModal);
    reportModal.querySelector(".modal-close").addEventListener("click", () => closeModal(reportModal));
    reportModal.addEventListener("click", (e) => {
      if (e.target === reportModal) closeModal(reportModal);
    });
    reportModal.querySelector("#report-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const submit = form.querySelector('button[type="submit"]');
      const payload = {
        reason: form.elements.reason.value,
        detail: form.elements.detail.value.trim(),
        post_id: Number(form.dataset.postId) || null,
        comment_id: Number(form.dataset.commentId) || null,
      };
      submit.disabled = true;
      try {
        const data = await api("/api/reports", { method: "POST", body: payload });
        toast(data.message || "举报已提交", "success");
        form.reset();
        closeModal(reportModal);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        submit.disabled = false;
      }
    });
  }
  const form = reportModal.querySelector("#report-form");
  form.dataset.postId = postId || "";
  form.dataset.commentId = commentId || "";
  openModal(reportModal);
}

/* --------------------------------- 弹层 ---------------------------------- */
function openModal(el) {
  el.classList.add("open");
  document.body.style.overflow = "hidden";
  const focusable = el.querySelector("input, textarea, select, button");
  if (focusable) setTimeout(() => focusable.focus(), 60);
}

function closeModal(el) {
  el.classList.remove("open");
  if (!document.querySelector(".modal-overlay.open")) {
    document.body.style.overflow = "";
  }
}

function bindModalDismiss(el) {
  el.addEventListener("click", (e) => {
    if (e.target === el) closeModal(el);
  });
  el.querySelectorAll(".modal-close").forEach((btn) =>
    btn.addEventListener("click", () => closeModal(el))
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && el.classList.contains("open")) closeModal(el);
  });
}
