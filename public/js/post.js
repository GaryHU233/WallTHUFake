/* 帖子详情页 */
"use strict";

const match = location.pathname.match(/\/post\/(\d+)/);
const postId = match ? Number(match[1]) : 0;

const detailEl = document.getElementById("post-detail");
const disclaimerEl = document.getElementById("post-disclaimers");
const commentListEl = document.getElementById("comment-list");
const commentEmptyEl = document.getElementById("comment-empty");
const commentCountEl = document.getElementById("comment-count");
const commentForm = document.getElementById("comment-form");
const anonInput = document.getElementById("comment-anon");
const nicknameInput = document.getElementById("comment-nickname");
const toTopBtn = document.getElementById("to-top");

let currentPost = null;
let identity = { nickname: "", locked: false, days_left: 0 };

initHeader("");
initFooter();
bindPostActions(document.body, { navigate: false });
loadIdentity();

if (!postId) {
  renderError("帖子编号无效");
} else {
  loadPost();
  loadComments();
}

/* --------------------------------- 帖子详情 -------------------------------- */
async function loadPost() {
  try {
    const data = await api(`/api/posts/${postId}`);
    currentPost = data.post;
    renderPost(currentPost);
    renderNav(currentPost);
    document.title = `${currentPost.content.slice(0, 24)} · WallTHU 校园墙`;
  } catch (err) {
    renderError(err.message);
  }
}

function renderPost(post) {
  detailEl.innerHTML = postCardHtml(post, { detail: true });

  const clauses = [
    "内容仅代表发布者个人观点，与 WallTHU 校园墙运营方无关。若内容侵犯你的权益，请点击「举报」或前往申诉页。",
  ];
  if (post.category === "闲置交易") {
    clauses.push("⚠️ 闲置交易提示：线下交易风险自担，谨防诈骗，请优先选择校内当面交易。");
  }
  clauses.push("🔒 隐私提醒：请勿在帖子或评论中发布他人照片、学号、手机号等个人信息。");
  disclaimerEl.innerHTML = clauses.map((c) => `<div class="disclaimer">${esc(c)}</div>`).join("");

  const badge = { anonymous: post.is_anonymous };
  commentCountEl.textContent = `${post.comment_count || 0} 条`;
  // 评论区匿名开关默认跟随帖子风格
  anonInput.checked = badge.anonymous;
  syncNicknameField();
}

function renderNav(post) {
  const nav = document.getElementById("post-nav");
  const prev = post.prev_id
    ? `<a href="/post/${post.prev_id}"><span class="dir">← 上一条</span>更早的帖子</a>`
    : `<span><span class="dir">← 上一条</span>没有了</span>`;
  const next = post.next_id
    ? `<a class="next" href="/post/${post.next_id}"><span class="dir">下一条 →</span>更新的帖子</a>`
    : `<span class="next"><span class="dir">下一条 →</span>没有了</span>`;
  nav.innerHTML = prev + next;
}

function renderError(message) {
  detailEl.innerHTML = `<div class="empty-state">
      <span class="emoji">🌫️</span>
      <b>${esc(message || "帖子不存在")}</b>
      <span>它可能还在审核中，或者已被删除</span>
      <a class="btn btn-sm" href="/" style="margin-top:14px">返回首页</a>
    </div>`;
  document.getElementById("post-nav").innerHTML = "";
  document.getElementById("comments").style.display = "none";
}

/* ---------------------------------- 评论 ---------------------------------- */
async function loadComments() {
  try {
    const data = await api(`/api/posts/${postId}/comments`);
    renderComments(data.comments);
  } catch (err) {
    commentEmptyEl.innerHTML = `<div class="empty-state">评论加载失败：${esc(err.message)}</div>`;
  }
}

function renderComments(comments) {
  if (!comments.length) {
    commentListEl.innerHTML = "";
    commentEmptyEl.innerHTML = `<div class="empty-state" style="padding:34px 20px">
        <span class="emoji">💭</span><b>还没有评论</b><span>来说点什么吧</span>
      </div>`;
    commentCountEl.textContent = "0 条";
    return;
  }
  commentEmptyEl.innerHTML = "";
  const repliesByParent = {};
  comments.forEach((c) => {
    if (c.parent_id) {
      (repliesByParent[c.parent_id] = repliesByParent[c.parent_id] || []).push(c);
    }
  });
  commentListEl.innerHTML = comments
    .filter((c) => !c.parent_id)
    .map((c) => commentItemHtml(c, repliesByParent[c.id] || []))
    .join("");
  refreshCommentCount();
}

function commentItemHtml(c, replies = []) {
  const who = c.is_anonymous
    ? `<span class="badge badge-anon">匿名</span>`
    : `<span class="badge badge-named">🙂 ${esc(c.nickname || "实名")}</span>`;
  const mine = c.is_mine ? `<span class="badge badge-mine">我的</span>` : "";
  return `<div class="comment-item" data-comment-id="${c.id}">
      <div class="comment-head">
        ${who}${mine}
        <time class="time" datetime="${esc(c.created_at)}">${fmtTime(c.created_at)}</time>
      </div>
      <div class="comment-content">${esc(c.content)}</div>
      <div class="comment-actions">
        <button class="comment-reply" type="button" data-reply-comment="${c.id}">回复</button>
        <button class="comment-report" type="button"
                data-report-comment="${c.id}">举报这条评论</button>
      </div>
      <div class="reply-slot" data-reply-slot="${c.id}"></div>
      <div class="replies">${replies.map(replyItemHtml).join("")}</div>
    </div>`;
}

function replyItemHtml(r) {
  const who = r.is_anonymous
    ? `<span class="badge badge-anon">匿名</span>`
    : `<span class="badge badge-named">🙂 ${esc(r.nickname || "实名")}</span>`;
  return `<div class="reply-item">
      <div class="comment-head">
        ${who}
        <time class="time" datetime="${esc(r.created_at)}">${fmtTime(r.created_at)}</time>
      </div>
      <div class="comment-content">${esc(r.content)}</div>
    </div>`;
}

commentListEl.addEventListener("click", (e) => {
  const reportBtn = e.target.closest("[data-report-comment]");
  if (reportBtn) {
    openReportModal(postId, Number(reportBtn.dataset.reportComment));
    return;
  }
  const replyBtn = e.target.closest("[data-reply-comment]");
  if (replyBtn) {
    openReplyForm(Number(replyBtn.dataset.replyComment));
  }
});

function openReplyForm(commentId) {
  const slot = commentListEl.querySelector(`[data-reply-slot="${commentId}"]`);
  if (!slot || slot.querySelector(".reply-form")) return;
  const anonymous = anonInput.checked;
  const nickname = nicknameInput.value.trim();
  const identityText = anonymous
    ? "将以匿名身份回复"
    : `将以「${nickname || "实名"}」回复`;
  slot.innerHTML = `
    <form class="reply-form">
      <textarea class="textarea" name="content" maxlength="500" rows="2"
                placeholder="回复这条评论…" required></textarea>
      <div class="reply-form-bar">
        <span class="reply-identity">${esc(identityText)}</span>
        <button class="btn btn-primary btn-sm" type="submit">回复</button>
      </div>
    </form>`;
  const ta = slot.querySelector("textarea");
  ta.focus();
  slot.querySelector("form").addEventListener("submit", (e) => submitReply(e, commentId));
}

async function submitReply(e, commentId) {
  e.preventDefault();
  const form = e.target;
  const content = form.elements.content.value.trim();
  const isAnonymous = anonInput.checked;
  const nickname = nicknameInput.value.trim();

  if (!content) return toast("回复不能为空", "error");
  if (content.length > 500) return toast("回复不能超过 500 字", "error");
  if (!isAnonymous && !nickname) return toast("请填写昵称，或打开匿名开关", "error");

  const submit = form.querySelector('button[type=submit]');
  submit.disabled = true;
  submit.textContent = "发送中…";
  try {
    const data = await api(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: { content, is_anonymous: isAnonymous, nickname, parent_id: commentId },
    });
    form.remove();
    appendReply(commentId, data.comment);
    toast("回复已发布", "success");
    loadIdentity();
  } catch (err) {
    toast(err.message, "error");
    if (err.status === 409) loadIdentity();
  } finally {
    submit.disabled = false;
    submit.textContent = "回复";
  }
}

function appendReply(parentId, reply) {
  const item = commentListEl.querySelector(`.comment-item[data-comment-id="${parentId}"]`);
  if (!item) return;
  let replies = item.querySelector(".replies");
  if (!replies) {
    replies = document.createElement("div");
    replies.className = "replies";
    item.appendChild(replies);
  }
  replies.insertAdjacentHTML("beforeend", replyItemHtml(reply));
  refreshCommentCount();
}

anonInput.addEventListener("change", syncNicknameField);

function syncNicknameField() {
  const anonymous = anonInput.checked;
  nicknameInput.hidden = anonymous;
  nicknameInput.required = !anonymous;
  if (anonymous) {
    nicknameInput.value = "";
    nicknameInput.readOnly = false;
    nicknameInput.title = "设置后 30 天内不可更改";
    return;
  }
  if (identity.locked) {
    nicknameInput.value = identity.nickname;
    nicknameInput.readOnly = true;
    nicknameInput.title = `昵称已锁定，${identity.days_left} 天后可更改`;
  } else {
    nicknameInput.readOnly = false;
    nicknameInput.title = "设置后 30 天内不可更改";
  }
}

async function loadIdentity() {
  try {
    identity = await api("/api/identity");
  } catch (_) {
    return;
  }
  syncNicknameField();
}

commentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = commentForm.elements.content.value.trim();
  const isAnonymous = anonInput.checked;
  const nickname = nicknameInput.value.trim();

  if (!content) return toast("评论不能为空", "error");
  if (content.length > 500) return toast("评论不能超过 500 字", "error");
  if (!isAnonymous && !nickname) return toast("请填写昵称，或打开匿名开关", "error");

  const submit = document.getElementById("comment-submit");
  submit.disabled = true;
  submit.textContent = "发送中…";
  try {
    const data = await api(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: {
        content,
        is_anonymous: isAnonymous,
        nickname,
      },
    });
    commentForm.elements.content.value = "";
    appendComment(data.comment);
    toast("评论已发布", "success");
    loadIdentity();
  } catch (err) {
    toast(err.message, "error");
    if (err.status === 409) loadIdentity();
  } finally {
    submit.disabled = false;
    submit.textContent = "发表评论";
  }
});

function appendComment(comment) {
  commentEmptyEl.innerHTML = "";
  commentListEl.insertAdjacentHTML("beforeend", commentItemHtml(comment, []));
  refreshCommentCount();
}

function refreshCommentCount() {
  const n = commentListEl.querySelectorAll(".comment-item, .reply-item").length;
  commentCountEl.textContent = `${n} 条`;
  const cardCount = detailEl.querySelector(".comment-count");
  if (cardCount) cardCount.textContent = n;
}

/* ------------------------------- 回到顶部等 -------------------------------- */
window.addEventListener("scroll", () => {
  toTopBtn.classList.toggle("show", window.scrollY > 520);
}, { passive: true });

toTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
