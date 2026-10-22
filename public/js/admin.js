/* WallTHU 管理后台 */
"use strict";

let csrf = "";
let currentTab = "all";
let currentPage = 1;
let currentQ = "";
let currentFilter = "";
let canLoadMore = false;
let loading = false;
let statsCache = null;

const loginView = document.getElementById("login-view");
const adminHeader = document.getElementById("admin-header");
const adminMain = document.getElementById("admin-main");
const adminList = document.getElementById("admin-list");
const adminToolbar = document.getElementById("admin-toolbar");
const adminMore = document.getElementById("admin-more");
const statsGrid = document.getElementById("admin-stats");
const tabsEl = document.getElementById("admin-tabs");

document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
document.getElementById("logout-btn").addEventListener("click", logout);
document.getElementById("login-form").addEventListener("submit", login);
adminMore.addEventListener("click", () => {
  if (!canLoadMore || loading) return;
  currentPage += 1;
  loadTab(true);
});
tabsEl.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab || tab.dataset.tab === currentTab) return;
  switchTab(tab.dataset.tab);
});

checkAuth();

/* --------------------------------- 登录态 --------------------------------- */
async function checkAuth() {
  try {
    const data = await api("/api/admin/me");
    if (!data.authenticated) {
      showLogin();
      return;
    }
    csrf = data.csrf;
    showAdmin();
  } catch (e) {
    showLogin();
  }
}

function showLogin() {
  csrf = "";
  adminHeader.hidden = true;
  adminMain.hidden = true;
  loginView.hidden = false;
  document.getElementById("login-form").elements.password.focus();
}

function showAdmin() {
  loginView.hidden = true;
  adminHeader.hidden = false;
  adminMain.hidden = false;
  updateThemeIcon();
  switchTab("all");
  loadStats();
}

async function login(e) {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector("button");
  const password = form.elements.password.value;
  button.disabled = true;
  try {
    const data = await api("/api/admin/login", { method: "POST", body: { password } });
    csrf = data.csrf;
    form.reset();
    toast("登录成功", "success");
    showAdmin();
  } catch (err) {
    toast(err.message, "error");
    form.elements.password.select();
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  try {
    await adminApi("/api/admin/logout", { method: "POST" });
  } catch (e) { /* ignore */ }
  showLogin();
  toast("已退出登录");
}

async function adminApi(path, options = {}) {
  const opts = { ...options, headers: { ...(options.headers || {}), "X-CSRF-Token": csrf } };
  try {
    return await api(path, opts);
  } catch (err) {
    if (err.status === 401) {
      showLogin();
      toast("登录已过期，请重新登录", "error");
    }
    throw err;
  }
}

/* --------------------------------- 统计 ---------------------------------- */
async function loadStats() {
  try {
    const data = await api("/api/admin/stats");
    statsCache = data.stats;
    renderTopStats();
  } catch (e) { /* 静默 */ }
}

function renderTopStats() {
  if (!statsCache) return;
  const s = statsCache;
  statsGrid.innerHTML = `
    <div class="stat-card">
      <div class="label">已发布帖子</div>
      <div class="value">${s.approved_posts}</div>
      <div class="sub">线上可见</div>
    </div>
    <div class="stat-card">
      <div class="label">今日访问</div>
      <div class="value">${s.views_today}</div>
      <div class="sub">独立访客 ${s.uv_today}</div>
    </div>
    <div class="stat-card ${s.unread_messages ? "hot" : ""}">
      <div class="label">未读私信</div>
      <div class="value">${s.unread_messages}</div>
      <div class="sub">访客留言待回复</div>
    </div>
    <div class="stat-card">
      <div class="label">待处理举报</div>
      <div class="value">${s.open_reports}</div>
      <div class="sub">待处理申诉 ${s.open_appeals}</div>
    </div>`;

  setPill("pill-reports", s.open_reports);
  setPill("pill-appeals", s.open_appeals);
  setPill("pill-messages", s.unread_messages);
}

function setPill(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.hidden = !value;
}

/* --------------------------------- 标签切换 -------------------------------- */
function switchTab(tab) {
  currentTab = tab;
  currentPage = 1;
  currentQ = "";
  currentFilter = ["reports", "appeals"].includes(tab) ? "open" : "all";
  tabsEl.querySelectorAll(".tab").forEach((el) =>
    el.classList.toggle("active", el.dataset.tab === tab)
  );
  statsGrid.hidden = tab === "stats";
  renderToolbar();
  adminList.innerHTML = "";
  adminMore.hidden = true;

  if (tab === "stats") {
    loadStatsPage();
  } else if (tab === "bans") {
    loadBans();
  } else if (tab === "messages") {
    loadThreads();
  } else {
    loadTab(false);
  }
}

function renderToolbar() {
  if (["all", "approved", "deleted"].includes(currentTab)) {
    adminToolbar.innerHTML = `
      <input class="input" id="admin-q" placeholder="搜索帖子正文…" maxlength="50" value="${esc(currentQ)}">
      <button class="btn" id="admin-search" type="button">搜索</button>
      <button class="btn btn-ghost" id="admin-clear" type="button" hidden>清除</button>`;
    const input = document.getElementById("admin-q");
    document.getElementById("admin-search").addEventListener("click", () => {
      currentQ = input.value.trim();
      currentPage = 1;
      loadTab(false);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        currentQ = input.value.trim();
        currentPage = 1;
        loadTab(false);
      }
    });
  } else if (currentTab === "comments" || currentTab === "reports" || currentTab === "appeals") {
    const options = currentTab === "comments"
      ? [["all", "全部评论"], ["visible", "正常展示"], ["hidden", "已隐藏"]]
      : [["open", "待处理"], ["all", "全部"], ["resolved", "已处理"], ["dismissed", "已忽略"]];
    adminToolbar.innerHTML = `
      <select class="select" id="admin-filter">
        ${options.map(([v, t]) => `<option value="${v}" ${v === currentFilter ? "selected" : ""}>${t}</option>`).join("")}
      </select>`;
    document.getElementById("admin-filter").addEventListener("change", (e) => {
      currentFilter = e.target.value;
      currentPage = 1;
      loadTab(false);
    });
  } else {
    adminToolbar.innerHTML = "";
  }
}

/* --------------------------------- 列表加载 -------------------------------- */
async function loadTab(append) {
  if (loading) return;
  loading = true;
  if (!append) {
    adminList.innerHTML = `<div class="skeleton" style="height:110px"></div><div class="skeleton" style="height:110px;margin-top:10px"></div>`;
    currentPage = 1;
  }
  adminMore.disabled = true;
  adminMore.textContent = "加载中…";

  try {
    let url = "";
    let items = [];
    let hasMore = false;

    if (["all", "approved", "deleted"].includes(currentTab)) {
      const params = new URLSearchParams({ status: currentTab, page: currentPage });
      if (currentQ) params.set("q", currentQ);
      url = `/api/admin/posts?${params}`;
      const data = await adminApi(url);
      items = data.posts.map(postItemHtml);
      hasMore = data.has_more;
    } else if (currentTab === "comments") {
      const params = new URLSearchParams({ status: currentFilter, page: currentPage });
      const data = await adminApi(`/api/admin/comments?${params}`);
      items = data.comments.map(commentItemHtml);
      hasMore = data.has_more;
    } else if (currentTab === "reports") {
      const data = await adminApi(`/api/admin/reports?status=${currentFilter}`);
      items = data.reports.map(reportItemHtml);
    } else if (currentTab === "appeals") {
      const data = await adminApi(`/api/admin/appeals?status=${currentFilter}`);
      items = data.appeals.map(appealItemHtml);
    }

    if (append) {
      adminList.insertAdjacentHTML("beforeend", items.join(""));
    } else {
      adminList.innerHTML = items.join("");
    }
    if (!adminList.querySelector(".admin-item")) {
      adminList.innerHTML = emptyHtml();
    }
    canLoadMore = hasMore;
    adminMore.hidden = !hasMore;
  } catch (err) {
    if (!append) {
      adminList.innerHTML = `<div class="admin-empty">加载失败：${esc(err.message)}</div>`;
    } else {
      toast(err.message, "error");
    }
    canLoadMore = false;
    adminMore.hidden = true;
  } finally {
    loading = false;
    adminMore.disabled = false;
    adminMore.textContent = "加载更多";
  }
}

function emptyHtml(text) {
  const map = {
    all: "还没有帖子",
    approved: "还没有已发布的帖子",
    deleted: "没有已删除的帖子",
    comments: "暂无评论",
    reports: "没有待处理的举报",
    appeals: "没有待处理的申诉",
    messages: "还没有访客私信",
  };
  return `<div class="admin-empty">${esc(text || map[currentTab] || "暂无数据")}</div>`;
}

/* -------------------------------- 列表渲染 -------------------------------- */
function postItemHtml(p) {
  const thumbs = p.images.length
    ? `<div class="admin-thumbs" data-images='${esc(JSON.stringify(p.images))}'>${p.images
        .map((src, i) => `<img src="${esc(src)}" alt="配图 ${i + 1}" loading="lazy" data-thumb="${i}">`)
        .join("")}</div>`
    : "";
  const statusBadge = {
    pending: '<span class="badge" style="background:color-mix(in srgb,var(--orange) 16%,transparent);color:var(--orange)">待审核（旧）</span>',
    approved: '<span class="badge" style="background:color-mix(in srgb,var(--green) 15%,transparent);color:var(--green)">已发布</span>',
    deleted: '<span class="badge" style="background:color-mix(in srgb,var(--danger) 12%,transparent);color:var(--danger)">已删除</span>',
    rejected: '<span class="badge" style="background:color-mix(in srgb,var(--danger) 12%,transparent);color:var(--danger)">已驳回（旧）</span>',
  }[p.status] || "";

  const dmLabel = p.nickname || "匿名访客";
  const actions = [];
  if (p.status === "approved" && p.pinned) {
    actions.push(`<button class="btn btn-sm" data-act="unpin" data-id="${p.id}">取消置顶</button>`);
  } else if (p.status === "approved") {
    actions.push(`<button class="btn btn-sm" data-act="pin" data-id="${p.id}">置顶</button>`);
  }
  if (p.status === "approved") {
    actions.push(`<a class="btn btn-sm" href="/post/${p.id}" target="_blank" rel="noopener">查看</a>`);
  } else {
    actions.push(`<button class="btn btn-sm" data-act="restore" data-id="${p.id}">恢复发布</button>`);
  }
  if (p.visitor_id) {
    actions.push(`<button class="btn btn-sm" data-act="dm" data-thread="${p.visitor_id}"
      data-label="${esc(dmLabel)}">私信</button>`);
  }
  if (p.status !== "deleted") {
    actions.push(`<span class="spacer"></span>
      <button class="btn btn-sm btn-danger" data-act="delete" data-id="${p.id}">删除</button>`);
  }

  return `<div class="admin-item" data-post="${p.id}">
      <div class="admin-item-head">
        <span class="badge badge-cat" data-cat="${esc(p.category)}">${esc(p.category)}</span>
        <span class="badge">#${p.id}</span>
        ${p.pinned ? '<span class="badge badge-pinned">📌 置顶</span>' : ""}
        <span class="badge ${p.is_anonymous ? "badge-anon" : "badge-named"}">${p.is_anonymous ? "匿名" : esc(p.nickname || "实名")}</span>
        ${statusBadge}
        <time class="time">${fmtTime(p.created_at)}</time>
      </div>
      <div class="content">${esc(p.content)}</div>
      ${thumbs}
      <div class="meta-line">
        <span>IP ${esc(p.ip || "未知")}</span>
        <span>♥ ${p.like_count}</span><span>💬 ${p.comment_count}</span><span>👁 ${p.view_count}</span>
        ${p.contact ? `<span>联系方式：${esc(p.contact)}</span>` : ""}
      </div>
      ${p.reject_reason ? `<div class="reject-reason">驳回原因：${esc(p.reject_reason)}</div>` : ""}
      <div class="admin-actions">${actions.join("")}</div>
    </div>`;
}

function commentItemHtml(c) {
  return `<div class="admin-item" data-comment="${c.id}">
      <div class="admin-item-head">
        <span class="badge">#${c.id}</span>
        <span class="badge">帖子 #${c.post_id}</span>
        <span class="badge ${c.is_anonymous ? "badge-anon" : "badge-named"}">${c.is_anonymous ? "匿名" : esc(c.nickname || "实名")}</span>
        <span class="badge">${c.status === "visible" ? "展示中" : "已隐藏"}</span>
        <time class="time">${fmtTime(c.created_at)}</time>
      </div>
      <div class="content">${esc(c.content)}</div>
      <div class="meta-line">
        <span>IP ${esc(c.ip || "未知")}</span>
        <span>原帖：${esc(c.post_content || "（已删除）")}${c.post_content && c.post_content.length >= 80 ? "…" : ""}</span>
      </div>
      <div class="admin-actions">
        <a class="btn btn-sm" href="/post/${c.post_id}" target="_blank" rel="noopener">查看原帖</a>
        <button class="btn btn-sm" data-act="toggle-comment" data-id="${c.id}" data-status="${c.status}">
          ${c.status === "visible" ? "隐藏" : "恢复展示"}
        </button>
        ${c.visitor_id ? `<button class="btn btn-sm" data-act="dm"
          data-thread="${c.visitor_id}" data-label="${esc(c.nickname || "匿名访客")}">私信</button>` : ""}
        <span class="spacer"></span>
        <button class="btn btn-sm btn-danger" data-act="delete-comment" data-id="${c.id}">删除</button>
      </div>
    </div>`;
}

function reportItemHtml(r) {
  const target = r.comment_id
    ? `评论 #${r.comment_id}：${esc(r.comment_content || "（已删除）")}`
    : `帖子 #${r.post_id}：${esc(r.post_content || "（已删除）")}`;
  const statusText = { open: "待处理", resolved: "已处理", dismissed: "已忽略" }[r.status] || r.status;
  const actions = [];
  if (r.status === "open") {
    actions.push(`<button class="btn btn-sm" data-act="report-resolve" data-id="${r.id}">标记已处理</button>`);
    actions.push(`<button class="btn btn-sm btn-ghost" data-act="report-dismiss" data-id="${r.id}">忽略</button>`);
  }
  if (r.post_id) {
    actions.push(`<button class="btn btn-sm btn-danger" data-act="delete-post" data-id="${r.post_id}">删除帖子</button>`);
  }
  if (r.comment_id) {
    actions.push(`<button class="btn btn-sm btn-danger" data-act="delete-comment" data-id="${r.comment_id}">删除评论</button>`);
  }

  return `<div class="admin-item" data-report="${r.id}">
      <div class="admin-item-head">
        <span class="badge" style="background:color-mix(in srgb,var(--danger) 12%,transparent);color:var(--danger)">举报 #${r.id}</span>
        <span class="badge">${esc(r.reason)}</span>
        <span class="badge">${statusText}</span>
        <time class="time">${fmtTime(r.created_at)}</time>
      </div>
      <div class="content">${target}</div>
      ${r.detail ? `<div class="reject-reason" style="background:var(--bg-soft);color:var(--text-2)">补充说明：${esc(r.detail)}</div>` : ""}
      <div class="meta-line"><span>举报人 IP ${esc(r.ip || "未知")}</span></div>
      <div class="admin-actions">
        ${actions.join("")}
        ${r.post_id ? `<a class="btn btn-sm" href="/post/${r.post_id}" target="_blank" rel="noopener">查看帖子</a>` : ""}
        <span class="spacer"></span>
      </div>
    </div>`;
}

function appealItemHtml(a) {
  const statusText = { open: "待处理", resolved: "已处理", dismissed: "已忽略" }[a.status] || a.status;
  return `<div class="admin-item" data-appeal="${a.id}">
      <div class="admin-item-head">
        <span class="badge">申诉 #${a.id}</span>
        ${a.post_id ? `<span class="badge">帖子 #${a.post_id}</span>` : '<span class="badge badge-anon">未关联帖子</span>'}
        <span class="badge">${statusText}</span>
        <time class="time">${fmtTime(a.created_at)}</time>
      </div>
      <div class="content">${esc(a.content)}</div>
      <div class="meta-line">
        <span>IP ${esc(a.ip || "未知")}</span>
        ${a.contact ? `<span>联系方式：${esc(a.contact)}</span>` : ""}
      </div>
      <div class="admin-actions">
        ${a.status === "open" ? `
          <button class="btn btn-sm" data-act="appeal-resolve" data-id="${a.id}">标记已处理</button>
          <button class="btn btn-sm btn-ghost" data-act="appeal-dismiss" data-id="${a.id}">忽略</button>` : ""}
        ${a.post_id ? `<a class="btn btn-sm" href="/post/${a.post_id}" target="_blank" rel="noopener">查看帖子</a>` : ""}
      </div>
    </div>`;
}

/* --------------------------------- 列表交互 -------------------------------- */
adminList.addEventListener("click", async (e) => {
  const thumb = e.target.closest("[data-thumb]");
  if (thumb) {
    const wrap = thumb.closest(".admin-thumbs");
    let images = [];
    try { images = JSON.parse(wrap.dataset.images || "[]"); } catch (_) {}
    openLightbox(images, Number(thumb.dataset.thumb) || 0);
    return;
  }

  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === "dm" || act === "open-thread") {
    openAdminChat(btn.dataset.thread, btn.dataset.label);
    return;
  }

  const id = btn.dataset.id;

  try {
    if (act === "restore") {
      await adminApi(`/api/admin/posts/${id}/status`, {
        method: "POST", body: { status: "approved" },
      });
      toast("已恢复发布", "success");
    } else if (act === "pin" || act === "unpin") {
      await adminApi(`/api/admin/posts/${id}/pin`, {
        method: "POST", body: { pinned: act === "pin" },
      });
      toast(act === "pin" ? "已置顶" : "已取消置顶", "success");
    } else if (act === "delete" || act === "delete-post") {
      if (!confirm("确定删除这条帖子吗？删除后将不再对外展示。")) return;
      await adminApi(`/api/admin/posts/${id}/delete`, { method: "POST" });
      toast("帖子已删除", "success");
    } else if (act === "toggle-comment") {
      const hidden = btn.dataset.status === "visible";
      await adminApi(`/api/admin/comments/${id}/hide`, { method: "POST", body: { hidden } });
      toast(hidden ? "评论已隐藏" : "评论已恢复", "success");
    } else if (act === "delete-comment") {
      if (!confirm("确定删除这条评论吗？此操作不可恢复。")) return;
      await adminApi(`/api/admin/comments/${id}/delete`, { method: "POST" });
      toast("评论已删除", "success");
    } else if (act === "report-resolve" || act === "report-dismiss") {
      await adminApi(`/api/admin/reports/${id}`, {
        method: "POST",
        body: { action: act === "report-resolve" ? "resolve" : "dismiss" },
      });
      toast("举报已处理", "success");
    } else if (act === "appeal-resolve" || act === "appeal-dismiss") {
      await adminApi(`/api/admin/appeals/${id}`, {
        method: "POST",
        body: { action: act === "appeal-resolve" ? "resolve" : "dismiss" },
      });
      toast("申诉已处理", "success");
    }
  } catch (err) {
    toast(err.message, "error");
    return;
  }
  await Promise.all([loadTab(false), loadStats()]);
});

/* ---------------------------------- 私信 ---------------------------------- */
async function loadThreads() {
  adminToolbar.innerHTML = "";
  adminMore.hidden = true;
  adminList.innerHTML = `<div class="skeleton" style="height:110px"></div>
    <div class="skeleton" style="height:110px;margin-top:10px"></div>`;
  try {
    const data = await adminApi("/api/admin/messages");
    adminList.innerHTML = data.threads.length
      ? data.threads.map(threadItemHtml).join("")
      : emptyHtml();
  } catch (err) {
    adminList.innerHTML = `<div class="admin-empty">加载失败：${esc(err.message)}</div>`;
  }
}

function threadItemHtml(t) {
  const label = t.nickname || "匿名访客";
  return `<div class="admin-item" data-thread="${t.thread}">
      <div class="admin-item-head">
        <span class="badge ${t.nickname ? "badge-named" : "badge-anon"}">${t.nickname ? "🙂 " + esc(t.nickname) : label}</span>
        ${t.unread ? `<span class="badge badge-pinned">${t.unread} 条未读</span>` : ""}
        <span class="badge">帖子 ${t.post_count}</span>
        <span class="badge">评论 ${t.comment_count}</span>
        <span class="badge">IP ${esc(t.last_ip)}</span>
        <time class="time">${fmtTime(t.last_at)}</time>
      </div>
      <div class="content">${t.last_sender === "admin" ? "墙主：" : ""}${esc(t.last_content)}</div>
      <div class="admin-actions">
        <button class="btn btn-sm btn-primary" data-act="open-thread"
                data-thread="${t.thread}" data-label="${esc(label)}">打开会话</button>
        <span class="spacer"></span>
        <span class="meta-line" style="margin:0">共 ${t.total} 条消息</span>
      </div>
    </div>`;
}

let adminChatModal = null;
let adminChatThread = "";
let adminChatLabel = "";

function buildAdminChatModal() {
  adminChatModal = document.createElement("div");
  adminChatModal.className = "modal-overlay";
  adminChatModal.innerHTML = `
    <div class="modal chat-modal" role="dialog" aria-modal="true" aria-labelledby="adm-chat-title">
      <div class="modal-head">
        <h2 id="adm-chat-title">私信</h2>
        <button class="modal-close" type="button" aria-label="关闭">✕</button>
      </div>
      <div class="modal-body chat-body">
        <div class="notice">
          <span>🔒</span>
          <span>私信仅该访客与管理员可见。访客身份按浏览器识别，请勿在私信中索取无关隐私。</span>
        </div>
        <div class="chat-list admin-chat-list" id="adm-chat-list">
          <div class="chat-empty">加载中…</div>
        </div>
        <form id="adm-chat-form" class="chat-form">
          <textarea class="textarea" name="content" maxlength="1000" rows="2"
                    placeholder="以墙主身份回复…" required></textarea>
          <button class="btn btn-primary btn-sm" type="submit">发送</button>
        </form>
      </div>
    </div>`;
  document.body.appendChild(adminChatModal);
  bindModalDismiss(adminChatModal);
  adminChatModal.querySelector("#adm-chat-form").addEventListener("submit", sendAdminChatMessage);
}

async function openAdminChat(thread, label) {
  if (!thread) return;
  if (!adminChatModal) buildAdminChatModal();
  adminChatThread = thread;
  adminChatLabel = label || "访客";
  adminChatModal.querySelector("#adm-chat-title").textContent = `私信 · ${adminChatLabel}`;
  openModal(adminChatModal);
  await loadAdminChat();
}

async function loadAdminChat() {
  const list = adminChatModal.querySelector("#adm-chat-list");
  try {
    const data = await adminApi(`/api/admin/messages/${adminChatThread}`);
    if (!data.messages.length) {
      list.innerHTML = `<div class="chat-empty">还没有消息，发送第一条吧。</div>`;
    } else {
      list.innerHTML = data.messages.map(adminChatMessageHtml).join("");
      list.scrollTop = list.scrollHeight;
    }
    if (data.nickname) {
      adminChatLabel = data.nickname;
      adminChatModal.querySelector("#adm-chat-title").textContent = `私信 · ${data.nickname}`;
    }
    loadStats();
    if (currentTab === "messages") loadThreads();
  } catch (err) {
    list.innerHTML = `<div class="chat-empty">${esc(err.message)}</div>`;
  }
}

function adminChatMessageHtml(m) {
  const mine = m.sender === "admin";
  return `<div class="chat-msg ${mine ? "mine" : "theirs"}">
      ${mine ? "" : '<span class="chat-who">访客</span>'}
      <div class="chat-bubble">${esc(m.content)}</div>
      <time class="chat-time">${fmtTime(m.created_at)}</time>
    </div>`;
}

async function sendAdminChatMessage(e) {
  e.preventDefault();
  const form = e.target;
  const input = form.elements.content;
  const content = input.value.trim();
  if (!content) return toast("消息不能为空", "error");
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = await adminApi(`/api/admin/messages/${adminChatThread}`, {
      method: "POST",
      body: { content },
    });
    input.value = "";
    const list = adminChatModal.querySelector("#adm-chat-list");
    if (list.querySelector(".chat-empty")) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", adminChatMessageHtml(data.message));
    list.scrollTop = list.scrollHeight;
    loadStats();
  } catch (err) {
    toast(err.message, "error");
  } finally {
    button.disabled = false;
  }
}

/* ---------------------------------- 封禁 ---------------------------------- */
async function loadBans() {
  adminToolbar.innerHTML = "";
  adminMore.hidden = true;
  adminList.innerHTML = `<div class="skeleton" style="height:100px"></div>`;
  try {
    const data = await adminApi("/api/admin/bans");
    const form = `<div class="admin-item">
        <div class="admin-item-head"><span class="badge">➕ 新增封禁</span></div>
        <form id="ban-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input class="input" name="ip" placeholder="IP 地址，例如 203.0.113.7"
                 style="flex:2;min-width:170px" maxlength="45" required>
          <input class="input" name="reason" placeholder="原因（选填）"
                 style="flex:2;min-width:150px" maxlength="200">
          <select class="select" name="days" style="width:auto">
            <option value="0">永久</option>
            <option value="1">1 天</option>
            <option value="3">3 天</option>
            <option value="7">7 天</option>
            <option value="30">30 天</option>
          </select>
          <button class="btn btn-primary btn-sm" type="submit">封禁</button>
        </form>
        <div class="notice" style="margin-top:10px">
          <span>⚠️</span>
          <span>封禁按 IP 生效，可能影响同一网络下的其他同学，请谨慎使用。封禁后该 IP 无法发帖与评论。</span>
        </div>
      </div>`;

    const list = data.bans.length
      ? data.bans.map((b) => `<div class="admin-item" data-ban="${b.id}">
          <div class="admin-item-head">
            <span class="badge">封禁 #${b.id}</span>
            <span class="badge badge-cat" style="--cat:var(--danger)">${esc(b.ip)}</span>
            <time class="time">${fmtTime(b.created_at)}</time>
          </div>
          <div class="content">原因：${esc(b.reason || "（未填写）")}</div>
          <div class="meta-line">
            <span>${b.expires_at ? `到期时间 ${esc(b.expires_at.replace("T", " ").replace("Z", " UTC"))}` : "永久封禁"}</span>
          </div>
          <div class="admin-actions">
            <span class="spacer"></span>
            <button class="btn btn-sm" data-act="unban" data-id="${b.id}">解除封禁</button>
          </div>
        </div>`).join("")
      : `<div class="admin-empty">当前没有生效中的封禁</div>`;

    adminList.innerHTML = form + list;

    document.getElementById("ban-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const submit = f.querySelector("button[type=submit]");
      submit.disabled = true;
      try {
        await adminApi("/api/admin/bans", {
          method: "POST",
          body: {
            ip: f.elements.ip.value.trim(),
            reason: f.elements.reason.value.trim(),
            days: Number(f.elements.days.value),
          },
        });
        toast("已封禁该 IP", "success");
        await Promise.all([loadBans(), loadStats()]);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        submit.disabled = false;
      }
    });

    adminList.querySelectorAll('[data-act="unban"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("确定解除该封禁吗？")) return;
        try {
          await adminApi(`/api/admin/bans/${btn.dataset.id}/remove`, { method: "POST" });
          toast("已解除封禁", "success");
          await Promise.all([loadBans(), loadStats()]);
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  } catch (err) {
    adminList.innerHTML = `<div class="admin-empty">加载失败：${esc(err.message)}</div>`;
  }
}

/* ---------------------------------- 统计页 -------------------------------- */
async function loadStatsPage() {
  adminToolbar.innerHTML = "";
  adminMore.hidden = true;
  adminList.innerHTML = `<div class="skeleton" style="height:220px"></div>`;
  try {
    const data = await api("/api/admin/stats");
    statsCache = data.stats;
    renderTopStats();
    renderStatsPage(data.stats);
  } catch (err) {
    adminList.innerHTML = `<div class="admin-empty">加载失败：${esc(err.message)}</div>`;
  }
}

function renderStatsPage(s) {
  const chart = (rows, key, color) => {
    const max = Math.max(1, ...rows.map((r) => r[key]));
    return `<div class="chart">${rows.map((r) => {
      const v = r[key];
      const h = 4 + Math.round((v / max) * 68);
      return `<div class="bar-wrap" title="${r.day}：${v}">
          <div class="bar-num">${v}</div>
          <div class="bar" style="height:${h}px;background:${color}"></div>
          <div class="bar-label">${r.day.slice(5)}</div>
        </div>`;
    }).join("")}</div>`;
  };

  adminList.innerHTML = `
    <div class="admin-grid" style="margin-bottom:14px">
      <div class="stat-card"><div class="label">今日访问 (PV)</div><div class="value">${s.views_today}</div><div class="sub">独立访客 ${s.uv_today}</div></div>
      <div class="stat-card"><div class="label">累计访问 (PV)</div><div class="value">${s.views_total}</div><div class="sub">建站以来</div></div>
      <div class="stat-card"><div class="label">累计点赞</div><div class="value">${s.total_likes}</div><div class="sub">全部帖子</div></div>
      <div class="stat-card"><div class="label">生效封禁</div><div class="value">${s.bans}</div><div class="sub">个 IP</div></div>
      <div class="stat-card"><div class="label">已发布</div><div class="value">${s.approved_posts}</div><div class="sub">帖子</div></div>
      <div class="stat-card"><div class="label">已删除</div><div class="value">${s.deleted_posts}</div><div class="sub">帖子</div></div>
      <div class="stat-card"><div class="label">评论总数</div><div class="value">${s.total_comments}</div><div class="sub">展示中</div></div>
      <div class="stat-card"><div class="label">未读私信</div><div class="value">${s.unread_messages}</div><div class="sub">条</div></div>
    </div>

    <div class="admin-item">
      <div class="admin-section-title">近 7 天访问量 <span class="feed-count">PV</span></div>
      ${chart(s.days, "visits", "linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 40%,var(--bg)))")}
    </div>

    <div class="admin-item">
      <div class="admin-section-title">近 7 天发帖量 <span class="feed-count">条</span></div>
      ${chart(s.days, "posts", "linear-gradient(180deg,var(--brand),color-mix(in srgb,var(--brand) 40%,var(--bg)))")}
    </div>

    <div class="notice" style="margin-top:14px">
      <span>ℹ️</span>
      <span>访问量统计所有页面浏览（PV），独立访客按 IP 去重。数据按北京时间自然日统计。</span>
    </div>`;
}

