/* WallTHU 公共脚本：请求、页头页脚、卡片、弹层、验证码、灯箱 */
"use strict";

const CATEGORIES = ["表白捞人", "失物招领", "闲置交易", "求助问答", "树洞吐槽", "活动通知"];
const REPORT_REASONS = [
  "辱骂/人身攻击", "广告/推广", "引战/挑事", "虚假信息",
  "泄露隐私", "色情/低俗", "其他",
];

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

/* --------------------------------- 主题切换 -------------------------------- */
function toggleTheme() {
  const root = document.documentElement;
  const dark = root.getAttribute("data-theme") === "dark";
  if (dark) {
    root.removeAttribute("data-theme");
    localStorage.setItem("wallthu-theme", "light");
  } else {
    root.setAttribute("data-theme", "dark");
    localStorage.setItem("wallthu-theme", "dark");
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  btn.textContent = dark ? "☀️" : "🌙";
  btn.setAttribute("aria-label", dark ? "切换到浅色模式" : "切换到深色模式");
}

/* ------------------------------- 页头 / 页脚 ------------------------------- */
function initHeader(active = "") {
  const el = document.getElementById("site-header");
  if (!el) return;
  const q = new URLSearchParams(location.search).get("q") || "";
  el.className = "site-header";
  el.innerHTML = `
    <div class="header-inner">
      <div class="brand">
        <a class="brand-school" href="https://this.edu.cn" target="_blank"
           rel="noopener noreferrer" title="清华大学附属中学国际部官网">
          <img src="/img/name.png" alt="清华大学附属中学国际部">
        </a>
        <a class="brand-logo" href="/" aria-label="校园墙首页">
          <img src="/img/logo.png" alt="清华附中国际部校徽">
        </a>
        <span class="brand-wall">校园墙</span>
      </div>
      <form class="header-search" id="header-search" role="search">
        <input type="search" name="q" value="${esc(q)}" maxlength="50"
               placeholder="搜索关键词，如「耳机」「图书馆」" aria-label="搜索帖子">
        <button type="submit" aria-label="搜索">🔍</button>
      </form>
      <nav class="header-nav" aria-label="导航">
        <a href="/tags" class="${active === "tags" ? "active" : ""}">热门标签</a>
        <a href="/rules" class="${active === "rules" ? "active" : ""}">墙规</a>
        <a href="/about" class="${active === "about" ? "active" : ""}">关于</a>
        <button class="chat-entry" id="chat-toggle" type="button" aria-label="私信墙主">
          <span class="chat-icon" aria-hidden="true">💬</span><span class="chat-label">私信墙主</span><span class="chat-dot" id="chat-dot" hidden></span>
        </button>
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="切换深色模式">🌙</button>
      </nav>
    </div>`;
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("chat-toggle").addEventListener("click", openChatModal);
  updateThemeIcon();
  document.getElementById("header-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const value = e.target.elements.q.value.trim();
    location.href = value ? `/?q=${encodeURIComponent(value)}` : "/";
  });
  refreshChatBadge();
  setInterval(refreshChatBadge, 60000);
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

function initFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.className = "site-footer";
  el.innerHTML = `
    <div class="container footer-inner">
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

function postCardHtml(post, { detail = false } = {}) {
  const cat = esc(post.category);
  const pinned = post.pinned ? `<span class="badge badge-pinned">📌 置顶</span>` : "";
  const who = post.is_anonymous
    ? `<span class="badge badge-anon">匿名</span>`
    : `<span class="badge badge-named">🙂 ${esc(post.nickname || "实名")}</span>`;
  const images = imagesHtml(post.images, post.id);
  return `
    <article class="post-card ${detail ? "is-detail" : ""} ${post.pinned ? "is-pinned" : ""}"
             data-post-id="${post.id}" data-cat="${cat}">
      <div class="post-top">
        <span class="badge badge-cat" data-cat="${cat}">${cat}</span>
        ${pinned}${who}
        <time class="post-time" datetime="${esc(post.created_at)}">${fmtTime(post.created_at)}</time>
      </div>
      <div class="post-content">${esc(post.content)}</div>
      ${images}
      ${detail ? detailMetaHtml(post) : ""}
      <div class="post-footer">
        <button class="action-btn like ${post.liked ? "liked" : ""}" data-action="like"
                aria-pressed="${post.liked ? "true" : "false"}" title="点赞">
          <span class="heart">♥</span><span class="like-count">${post.like_count}</span>
        </button>
        ${detail
          ? `<a class="action-btn" href="#comments">💬 <span class="comment-count">${post.comment_count || 0}</span></a>`
          : `<a class="action-btn" href="/post/${post.id}">💬 <span>${post.comment_count || 0}</span></a>`}
        <button class="action-btn" data-action="copy" title="复制帖子文字">📋 复制</button>
        <button class="action-btn" data-action="share" title="分享链接">🔗 分享</button>
        <button class="action-btn report" data-action="report" title="举报该帖子">🚩 举报</button>
      </div>
    </article>`;
}

function detailMetaHtml(post) {
  const contact = post.contact
    ? `<span>联系方式：${esc(post.contact)}</span>` : "";
  return `<div class="detail-meta">
      <span>🕒 ${esc(fmtTime(post.created_at))}</span>
      <span>👁 ${post.view_count} 次浏览</span>
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
      } else if (btn.dataset.action === "report") {
        openReportModal(postId);
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
