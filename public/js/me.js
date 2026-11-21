/* 「我的」页：我发的帖子、我发的评论、收到的回复 */
"use strict";

initHeader("me");
initFooter();

const statsPosts = document.getElementById("stat-posts");
const statsComments = document.getElementById("stat-comments");
const statsReplies = document.getElementById("stat-replies");
const postsEl = document.getElementById("me-posts");
const commentsEl = document.getElementById("me-comments");
const repliesEl = document.getElementById("me-replies");

loadMe();
document.addEventListener("wallthu:post-deleted", loadMe);

async function loadMe() {
  try {
    const data = await api("/api/me");
    statsPosts.textContent = data.stats.posts;
    statsComments.textContent = data.stats.comments;
    statsReplies.textContent = data.stats.replies;
    renderPosts(data.posts);
    renderComments(data.comments);
    renderReplies(data.replies);
  } catch (err) {
    if (err.status === 401) {
      postsEl.innerHTML = `<div class="empty-state"><span class="emoji">🔒</span>
          <b>请先登录账号</b><span>登录后即可查看你发布的帖子与评论</span>
          <button class="btn btn-primary btn-sm" type="button" style="margin-top:14px">登录 / 注册</button></div>`;
      postsEl.querySelector("button").addEventListener("click", () =>
        openAuthModal("login", () => { loadAuthUser(); loadMe(); }));
    } else {
      postsEl.innerHTML = `<div class="empty-state"><span class="emoji">😵</span>
          <b>加载失败</b><span>${esc(err.message)}</span></div>`;
    }
    commentsEl.innerHTML = "";
    repliesEl.innerHTML = "";
  }
}

function renderPosts(posts) {
  if (!posts.length) {
    postsEl.innerHTML = `<div class="empty-state"><span class="emoji">📝</span>
        <b>还没有发过帖子</b><span>点首页上方「发帖」按钮写下第一条吧</span></div>`;
    return;
  }
  postsEl.innerHTML = posts.map((p) => postCardHtml(p)).join("");
  bindPostActions(postsEl);
}

function renderComments(comments) {
  if (!comments.length) {
    commentsEl.innerHTML = `<div class="empty-state"><span class="emoji">💬</span>
        <b>还没有评论</b><span>在别人的帖子下说点什么吧</span></div>`;
    return;
  }
  commentsEl.innerHTML = comments.map((c) => `
    <div class="me-item">
      <div class="comment-content">${esc(c.content)}</div>
      ${imagesHtml(c.images, c.id)}
      ${audiosHtml(c.audios)}
      <div class="me-meta">
        <span>于 <a href="/post/${c.post_id}">帖子 #${c.post_id}</a></span>
        <span>${esc(c.post_content || "（已删除）")}</span>
        <time class="time">${fmtTime(c.created_at)}</time>
      </div>
    </div>`).join("");
}

function renderReplies(replies) {
  if (!replies.length) {
    repliesEl.innerHTML = `<div class="empty-state"><span class="emoji">🔔</span>
        <b>还没有收到回复</b><span>别人回复你的评论后会出现在这里</span></div>`;
    return;
  }
  repliesEl.innerHTML = replies.map((r) => {
    const who = r.is_anonymous
      ? `<span class="badge badge-anon">匿名</span>`
      : `<span class="badge badge-named">${esc(r.nickname || "实名")}</span>`;
    const uid = r.user_id
      ? `<span class="badge badge-uid" title="用户专属 ID">ID ${fmtUid(r.user_id)}</span>` : "";
    return `<div class="me-item">
      <div class="me-meta">
        ${who}${uid}
        <time class="time">${fmtTime(r.created_at)}</time>
      </div>
      <div class="comment-content">${esc(r.content)}</div>
      ${imagesHtml(r.images, r.id)}
      ${audiosHtml(r.audios)}
      <div class="me-reply-to">回复了你的评论：${esc(r.parent_content || "…")}</div>
    </div>`;
  }).join("");
}
