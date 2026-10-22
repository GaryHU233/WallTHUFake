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
  commentCountEl.textContent = `${comments.length} 条`;
  commentListEl.innerHTML = comments.map((c) => {
    const who = c.is_anonymous
      ? `<span class="badge badge-anon">匿名</span>`
      : `<span class="badge badge-named">🙂 ${esc(c.nickname || "实名")}</span>`;
    return `<div class="comment-item" data-comment-id="${c.id}">
        <div class="comment-head">
          ${who}
          <time class="time" datetime="${esc(c.created_at)}">${fmtTime(c.created_at)}</time>
        </div>
        <div class="comment-content">${esc(c.content)}</div>
        <button class="comment-report" type="button"
                data-report-comment="${c.id}">举报这条评论</button>
      </div>`;
  }).join("");
}

commentListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-report-comment]");
  if (!btn) return;
  openReportModal(postId, Number(btn.dataset.reportComment));
});

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
  const who = comment.is_anonymous
    ? `<span class="badge badge-anon">匿名</span>`
    : `<span class="badge badge-named">🙂 ${esc(comment.nickname || "实名")}</span>`;
  commentListEl.insertAdjacentHTML("beforeend", `<div class="comment-item" data-comment-id="${comment.id}">
      <div class="comment-head">
        ${who}
        <time class="time" datetime="${esc(comment.created_at)}">${fmtTime(comment.created_at)}</time>
      </div>
      <div class="comment-content">${esc(comment.content)}</div>
      <button class="comment-report" type="button"
              data-report-comment="${comment.id}">举报这条评论</button>
    </div>`);

  const items = commentListEl.querySelectorAll(".comment-item").length;
  commentCountEl.textContent = `${items} 条`;
  const cardCount = detailEl.querySelector(".comment-count");
  if (cardCount) cardCount.textContent = items;
}

/* ------------------------------- 回到顶部等 -------------------------------- */
window.addEventListener("scroll", () => {
  toTopBtn.classList.toggle("show", window.scrollY > 520);
}, { passive: true });

toTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
