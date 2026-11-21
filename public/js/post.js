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
let loggedIn = false;
let commentsById = new Map();

/* ------------------------------ 评论图片 ------------------------------ */
function commentFileUrl(f) {
  if (!f._url) f._url = URL.createObjectURL(f);
  return f._url;
}

function renderCommentImages(files, previewEl) {
  previewEl.innerHTML = files.map((f, i) => `
    <div class="preview-item">
      <img src="${commentFileUrl(f)}" alt="${esc(f.name)}">
      <button type="button" data-remove="${i}" aria-label="移除图片">✕</button>
    </div>`).join("");
}

function addCommentImages(files, fileList, previewEl, wrapperEl) {
  for (const f of Array.from(fileList || [])) {
    if (files.length >= 9) { toast("最多上传 9 张图片", "error"); break; }
    if (!f.type.startsWith("image/")) { toast(`「${f.name}」不是图片格式`, "error"); continue; }
    if (f.size > 5 * 1024 * 1024) { toast(`「${f.name}」超过 5MB`, "error"); continue; }
    files.push(f);
  }
  renderCommentImages(files, previewEl);
  if (wrapperEl) wrapperEl.hidden = !files.length;
}

function makeCommentUploader(btnEl, inputEl, previewEl, wrapperEl) {
  const files = [];
  btnEl.addEventListener("click", () => inputEl.click());
  inputEl.addEventListener("change", () => {
    addCommentImages(files, inputEl.files, previewEl, wrapperEl);
    inputEl.value = "";
  });
  previewEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    files.splice(Number(btn.dataset.remove), 1);
    renderCommentImages(files, previewEl);
    if (wrapperEl) wrapperEl.hidden = !files.length;
  });
  return {
    files,
    reset() { files.length = 0; renderCommentImages(files, previewEl); if (wrapperEl) wrapperEl.hidden = true; },
  };
}

const commentUploader = makeCommentUploader(
  document.getElementById("comment-image-btn"),
  document.getElementById("comment-image-input"),
  document.getElementById("comment-preview-grid"),
  document.getElementById("comment-images"),
);

/* ------------------------------ 评论语音 ------------------------------ */
function audioFileUrl(f) {
  if (!f._url) f._url = URL.createObjectURL(f);
  return f._url;
}

function isAudioFile(f) {
  if (f.type && f.type.startsWith("audio/")) return true;
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  return ["mp3", "m4a", "wav", "ogg", "opus", "aac", "flac", "webm", "amr", "3gp", "caf"].includes(ext);
}

function renderAudioPreviews(files, previewEl) {
  previewEl.innerHTML = files.map((f, i) => `
    <div class="audio-preview-item">
      <audio controls src="${audioFileUrl(f)}"></audio>
      <span class="audio-preview-name">${esc(f.name)}</span>
      <button type="button" data-remove="${i}" aria-label="移除语音">✕</button>
    </div>`).join("");
}

function addAudios(files, fileList, previewEl, wrapperEl) {
  for (const f of Array.from(fileList || [])) {
    if (files.length >= 3) { toast("最多上传 3 段语音", "error"); break; }
    if (!isAudioFile(f)) { toast(`「${f.name}」不是音频格式`, "error"); continue; }
    if (f.size > 10 * 1024 * 1024) { toast(`「${f.name}」超过 10MB`, "error"); continue; }
    files.push(f);
  }
  renderAudioPreviews(files, previewEl);
  if (wrapperEl) wrapperEl.hidden = !files.length;
}

function makeAudioUploader(btnEl, inputEl, previewEl, wrapperEl) {
  const files = [];
  btnEl.addEventListener("click", () => inputEl.click());
  inputEl.addEventListener("change", () => {
    addAudios(files, inputEl.files, previewEl, wrapperEl);
    inputEl.value = "";
  });
  previewEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    files.splice(Number(btn.dataset.remove), 1);
    renderAudioPreviews(files, previewEl);
    if (wrapperEl) wrapperEl.hidden = !files.length;
  });
  return {
    files,
    reset() { files.length = 0; renderAudioPreviews(files, previewEl); if (wrapperEl) wrapperEl.hidden = true; },
  };
}

const commentAudioUploader = makeAudioUploader(
  document.getElementById("comment-audio-btn"),
  document.getElementById("comment-audio-input"),
  document.getElementById("comment-audio-preview-list"),
  document.getElementById("comment-audios"),
);

/* ------------------------------ 评论附件 ------------------------------ */
function isZipFile(f) {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if (ext === "zip") return true;
  return f.type === "application/zip" || f.type === "application/x-zip-compressed";
}

function renderZipPreviews(files, previewEl) {
  previewEl.innerHTML = files.map((f, i) => `
    <div class="zip-preview-item">
      <span class="zip-preview-icon">📦</span>
      <span class="zip-preview-name">${esc(f.name)}</span>
      <button type="button" data-remove="${i}" aria-label="移除附件">✕</button>
    </div>`).join("");
}

function addZips(files, fileList, previewEl, wrapperEl) {
  for (const f of Array.from(fileList || [])) {
    if (files.length >= 3) { toast("最多上传 3 个附件", "error"); break; }
    if (!isZipFile(f)) { toast(`「${f.name}」仅支持 zip 格式`, "error"); continue; }
    if (f.size > 20 * 1024 * 1024) { toast(`「${f.name}」超过 20MB`, "error"); continue; }
    files.push(f);
  }
  renderZipPreviews(files, previewEl);
  if (wrapperEl) wrapperEl.hidden = !files.length;
}

function makeZipUploader(btnEl, inputEl, previewEl, wrapperEl) {
  const files = [];
  btnEl.addEventListener("click", () => inputEl.click());
  inputEl.addEventListener("change", () => {
    addZips(files, inputEl.files, previewEl, wrapperEl);
    inputEl.value = "";
  });
  previewEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    files.splice(Number(btn.dataset.remove), 1);
    renderZipPreviews(files, previewEl);
    if (wrapperEl) wrapperEl.hidden = !files.length;
  });
  return {
    files,
    reset() { files.length = 0; renderZipPreviews(files, previewEl); if (wrapperEl) wrapperEl.hidden = true; },
  };
}

const commentZipUploader = makeZipUploader(
  document.getElementById("comment-zip-btn"),
  document.getElementById("comment-zip-input"),
  document.getElementById("comment-zip-preview-list"),
  document.getElementById("comment-zips"),
);

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
  commentsById = new Map(comments.map((c) => [c.id, c]));
  // 每条回复都归到顶层评论下（定向回复可能回复的是某条回复，需要向上找到根）
  const rootOf = (id) => {
    const seen = new Set();
    let cur = commentsById.get(id);
    while (cur && cur.parent_id && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = commentsById.get(cur.parent_id);
    }
    return cur ? cur.id : id;
  };
  const repliesByRoot = {};
  comments.forEach((c) => {
    if (c.parent_id) {
      const root = rootOf(c.id);
      (repliesByRoot[root] = repliesByRoot[root] || []).push(c);
    }
  });
  commentListEl.innerHTML = comments
    .filter((c) => !c.parent_id)
    .map((c) => commentItemHtml(c, repliesByRoot[c.id] || []))
    .join("");
  refreshCommentCount();
}

function commentLabel(c) {
  return c.is_anonymous ? "匿名" : (c.nickname || "实名");
}

function commentItemHtml(c, replies = []) {
  const who = c.is_anonymous
    ? `<span class="badge badge-anon">匿名</span>`
    : `<span class="badge badge-named">${esc(c.nickname || "实名")}</span>`;
  const uid = c.user_id
    ? `<span class="badge badge-uid" title="用户专属 ID">ID ${fmtUid(c.user_id)}</span>` : "";
  const mine = c.is_mine ? `<span class="badge badge-mine">我的</span>` : "";
  const dm = (!c.is_mine && c.user_id)
    ? `<button class="comment-dm" type="button" data-dm-user="${c.user_id}" data-anon="${c.is_anonymous ? 1 : 0}">${ICONS.mail} 私信</button>` : "";
  const del = c.is_mine
    ? `<button class="comment-delete" type="button" data-delete-comment="${c.id}">删除</button>` : "";
  const images = imagesHtml(c.images, c.id);
  const audios = audiosHtml(c.audios);
  const zips = zipsHtml(c.zips);
  const like = `<button class="comment-like ${c.liked ? "liked" : ""}" type="button"
                data-like-comment="${c.id}" aria-pressed="${c.liked ? "true" : "false"}"
                title="点赞"><span class="heart">${ICONS.heart}</span> <span>${c.like_count || 0}</span></button>`;
  const avatar = avatarHtml(c.user_id || c.id, c.is_anonymous ? "" : (c.nickname || ""));
  return `<div class="comment-item" data-comment-id="${c.id}">
      ${avatar}
      <div class="comment-main">
        <div class="comment-head">
          ${who}${uid}${mine}
          <time class="time" datetime="${esc(c.created_at)}">${fmtTime(c.created_at)}</time>
        </div>
        <div class="comment-content">${esc(c.content)}</div>
        ${images}
        ${audios}
        ${zips}
        <div class="comment-actions">
          ${like}
          <button class="comment-reply" type="button" data-reply-comment="${c.id}">回复</button>
          ${dm}
          <button class="comment-report" type="button"
                  data-report-comment="${c.id}">举报</button>
          ${del}
        </div>
        <div class="reply-slot" data-reply-slot="${c.id}"></div>
        <div class="replies">${replies.map(replyItemHtml).join("")}</div>
      </div>
    </div>`;
}

function replyItemHtml(r) {
  const who = r.is_anonymous
    ? `<span class="badge badge-anon">匿名</span>`
    : `<span class="badge badge-named">${esc(r.nickname || "实名")}</span>`;
  const uid = r.user_id
    ? `<span class="badge badge-uid" title="用户专属 ID">ID ${fmtUid(r.user_id)}</span>` : "";
  const dm = (!r.is_mine && r.user_id)
    ? `<button class="comment-dm" type="button" data-dm-user="${r.user_id}" data-anon="${r.is_anonymous ? 1 : 0}">${ICONS.mail} 私信</button>` : "";
  const del = r.is_mine
    ? `<button class="comment-delete" type="button" data-delete-comment="${r.id}">删除</button>` : "";
  const images = imagesHtml(r.images, r.id);
  const audios = audiosHtml(r.audios);
  const zips = zipsHtml(r.zips);
  const mention = r.reply_to_name
    ? `<span class="reply-mention">回复 <b>@${esc(r.reply_to_name)}</b>：</span>` : "";
  const like = `<button class="comment-like ${r.liked ? "liked" : ""}" type="button"
                data-like-comment="${r.id}" aria-pressed="${r.liked ? "true" : "false"}"
                title="点赞"><span class="heart">${ICONS.heart}</span> <span>${r.like_count || 0}</span></button>`;
  const avatar = avatarHtml(r.user_id || r.id, r.is_anonymous ? "" : (r.nickname || ""))
    .replace('class="avatar"', 'class="avatar small"');
  return `<div class="reply-item" data-comment-id="${r.id}">
      <div class="comment-head">
        ${avatar}
        ${who}${uid}
        <time class="time" datetime="${esc(r.created_at)}">${fmtTime(r.created_at)}</time>
      </div>
      <div class="comment-content">${mention}${esc(r.content)}</div>
      ${images}
      ${audios}
      ${zips}
      <div class="comment-actions">
        ${like}
        <button class="comment-reply" type="button" data-reply-comment="${r.id}">回复</button>
        ${dm}
        ${del}
      </div>
      <div class="reply-slot" data-reply-slot="${r.id}"></div>
    </div>`;
}

commentListEl.addEventListener("click", (e) => {
  const likeBtn = e.target.closest("[data-like-comment]");
  if (likeBtn) {
    likeComment(Number(likeBtn.dataset.likeComment), likeBtn);
    return;
  }
  const dmBtn = e.target.closest("[data-dm-user]");
  if (dmBtn) {
    openDmTo(Number(dmBtn.dataset.dmUser), dmBtn.dataset.anon === "1");
    return;
  }
  const reportBtn = e.target.closest("[data-report-comment]");
  if (reportBtn) {
    openReportModal(postId, Number(reportBtn.dataset.reportComment));
    return;
  }
  const delBtn = e.target.closest("[data-delete-comment]");
  if (delBtn) {
    deleteOwnComment(Number(delBtn.dataset.deleteComment));
    return;
  }
  const replyBtn = e.target.closest("[data-reply-comment]");
  if (replyBtn) {
    openReplyForm(Number(replyBtn.dataset.replyComment));
  }
});

async function deleteOwnComment(commentId) {
  if (!confirm("确定删除这条评论吗？删除后将不再展示。")) return;
  try {
    await api(`/api/comments/${commentId}/delete`, { method: "POST" });
    toast("评论已删除", "success");
    loadComments();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function likeComment(commentId, btn) {
  btn.disabled = true;
  try {
    const data = await api(`/api/comments/${commentId}/like`, { method: "POST" });
    btn.classList.toggle("liked", data.liked);
    btn.setAttribute("aria-pressed", data.liked ? "true" : "false");
    const counter = btn.querySelector("span");
    if (counter) counter.textContent = data.like_count;
  } catch (err) {
    toast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function openReplyForm(commentId) {
  if (!requireLogin("评论")) return;
  const slot = commentListEl.querySelector(`[data-reply-slot="${commentId}"]`);
  if (!slot || slot.querySelector(".reply-form")) return;
  const anonymous = anonInput.checked;
  const nickname = nicknameInput.value.trim();
  const target = commentsById.get(commentId);
  const targetLabel = target ? commentLabel(target) : "";
  const placeholder = targetLabel ? `回复 @${targetLabel}…` : "回复这条评论…";
  const identityText = anonymous
    ? "将以匿名身份回复"
    : `将以「${nickname || "实名"}」回复`;
  slot.innerHTML = `
    <form class="reply-form">
      <textarea class="textarea" name="content" maxlength="500" rows="2"
                placeholder="${esc(placeholder)}" required></textarea>
      <div class="reply-images" hidden>
        <div class="preview-grid"></div>
      </div>
      <div class="reply-audios" hidden>
        <div class="audio-preview-list"></div>
      </div>
      <div class="reply-zips" hidden>
        <div class="zip-preview-list"></div>
      </div>
      <div class="reply-form-bar">
        <span class="reply-identity">${esc(identityText)}</span>
        <input type="file" class="reply-image-input" accept="image/*" multiple hidden>
        <button class="btn btn-sm btn-ghost reply-image-btn" type="button" title="添加图片">🖼️</button>
        <input type="file" class="reply-audio-input" accept="audio/*" multiple hidden>
        <button class="btn btn-sm btn-ghost reply-audio-btn" type="button" title="添加语音">🎤</button>
        <input type="file" class="reply-zip-input" accept=".zip,application/zip,application/x-zip-compressed" multiple hidden>
        <button class="btn btn-sm btn-ghost reply-zip-btn" type="button" title="添加 zip 附件">📦</button>
        <button class="btn btn-primary btn-sm" type="submit">回复</button>
      </div>
    </form>`;
  const form = slot.querySelector("form");
  const ta = form.querySelector("textarea");
  ta.focus();
  const uploader = makeCommentUploader(
    form.querySelector(".reply-image-btn"),
    form.querySelector(".reply-image-input"),
    form.querySelector(".preview-grid"),
    form.querySelector(".reply-images"),
  );
  const audioUploader = makeAudioUploader(
    form.querySelector(".reply-audio-btn"),
    form.querySelector(".reply-audio-input"),
    form.querySelector(".audio-preview-list"),
    form.querySelector(".reply-audios"),
  );
  const zipUploader = makeZipUploader(
    form.querySelector(".reply-zip-btn"),
    form.querySelector(".reply-zip-input"),
    form.querySelector(".zip-preview-list"),
    form.querySelector(".reply-zips"),
  );
  form.addEventListener("submit", (e) => submitReply(e, commentId, uploader, audioUploader, zipUploader));
}

async function submitReply(e, commentId, uploader, audioUploader, zipUploader) {
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
    const fd = new FormData();
    fd.append("content", content);
    fd.append("is_anonymous", isAnonymous ? "1" : "0");
    fd.append("nickname", nickname);
    fd.append("parent_id", String(commentId));
    uploader.files.forEach((file) => fd.append("images", file));
    audioUploader.files.forEach((file) => fd.append("audios", file));
    zipUploader.files.forEach((file) => fd.append("zips", file));
    const data = await api(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: fd,
    });
    form.remove();
    loadComments();
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
  await loadAuthUser();
  loggedIn = !!authUser;
  identity = authUser
    ? { nickname: authUser.nickname, locked: authUser.nickname_locked, days_left: authUser.nickname_days_left }
    : { nickname: "", locked: false, days_left: 0 };
  syncNicknameField();
  renderCommentGate();
}

function renderCommentGate() {
  const card = document.querySelector(".comment-form-card");
  if (!card) return;
  const gate = document.getElementById("comment-login-gate");
  if (loggedIn) {
    card.style.display = "";
    if (gate) gate.remove();
    return;
  }
  card.style.display = "none";
  if (gate) return;
  const div = document.createElement("div");
  div.className = "notice brand";
  div.id = "comment-login-gate";
  div.style.marginBottom = "16px";
  div.innerHTML = `<span>🔒</span><span>登录后才能发表评论。</span>
    <button class="btn btn-primary btn-sm" type="button" style="margin-left:auto">登录 / 注册</button>`;
  div.querySelector("button").addEventListener("click", () => openAuthModal("login", loadIdentity));
  card.insertAdjacentElement("afterend", div);
}

commentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireLogin("评论")) return;
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
    const fd = new FormData();
    fd.append("content", content);
    fd.append("is_anonymous", isAnonymous ? "1" : "0");
    fd.append("nickname", nickname);
    commentUploader.files.forEach((file) => fd.append("images", file));
    commentAudioUploader.files.forEach((file) => fd.append("audios", file));
    commentZipUploader.files.forEach((file) => fd.append("zips", file));
    const data = await api(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: fd,
    });
    commentForm.elements.content.value = "";
    commentUploader.reset();
    commentAudioUploader.reset();
    commentZipUploader.reset();
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
