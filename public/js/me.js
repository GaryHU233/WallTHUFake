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
    postsEl.innerHTML = `<div class="empty-state"><span class="emoji">😵</span>
        <b>加载失败</b><span>${esc(err.message)}</span></div>`;
    commentsEl.innerHTML = "";
    repliesEl.innerHTML = "";
  }
}

function renderPosts(posts) {
  if (!posts.length) {
    postsEl.innerHTML = `<div class="empty-state"><span class="emoji">📝</span>
        <b>还没有发过帖子</b><span>点右下角「发帖」写下第一条吧</span></div>`;
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
    const who = r.is_anonymous ? "匿名" : (r.nickname || "实名");
    return `<div class="me-item">
      <div class="me-meta">
        <span class="badge badge-named">🙂 ${esc(who)}</span>
        <time class="time">${fmtTime(r.created_at)}</time>
      </div>
      <div class="comment-content">${esc(r.content)}</div>
      <div class="me-reply-to">回复了你的评论：${esc(r.parent_content || "…")}</div>
    </div>`;
  }).join("");
}
