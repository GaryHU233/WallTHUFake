/* 首页：信息流、筛选、发帖 */
"use strict";

let postModal;
let pendingFiles = [];
let previewUrls = [];

const urlParams = new URLSearchParams(location.search);
const initialCategory = urlParams.get("category") || "全部";
const state = {
  sort: ["new", "hot", "pinned"].includes(urlParams.get("sort")) ? urlParams.get("sort") : "new",
  category: initialCategory === "全部" || CATEGORIES.includes(initialCategory)
    ? initialCategory : "全部",
  q: urlParams.get("q") || "",
  tag: urlParams.get("tag") || "",
  page: 1,
  total: 0,
  pinnedCount: 0,
  loading: false,
  hasMore: false,
};

const feedEl = document.getElementById("feed");
const pinnedEl = document.getElementById("pinned-section");
const emptyEl = document.getElementById("feed-empty");
const loadMoreBtn = document.getElementById("load-more");
const countEl = document.getElementById("feed-count");
const catScroll = document.getElementById("cat-scroll");
const sortTabs = document.getElementById("sort-tabs");
const filterBanner = document.getElementById("filter-banner");

/* --------------------------------- 初始化 --------------------------------- */
initHeader("home");
initFooter();
bindPostActions(document.body);
initPostModal();

renderCategories();
renderSortTabs();
renderFilterBanner();
loadFeed(true);

/* --------------------------------- 渲染 UI -------------------------------- */
function renderCategories() {
  const cats = ["全部", ...CATEGORIES];
  catScroll.innerHTML = cats.map((cat) => `
    <button class="cat-chip ${cat === state.category ? "active" : ""}"
            data-cat="${esc(cat)}" type="button"
            aria-selected="${cat === state.category}">${esc(cat)}</button>`).join("");

  catScroll.addEventListener("click", (e) => {
    const chip = e.target.closest(".cat-chip");
    if (!chip) return;
    state.category = chip.dataset.cat;
    catScroll.querySelectorAll(".cat-chip").forEach((el) => {
      const on = el === chip;
      el.classList.toggle("active", on);
      el.setAttribute("aria-selected", on);
    });
    syncUrl();
    loadFeed(true);
  });
}

function renderSortTabs() {
  sortTabs.querySelectorAll(".sort-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.sort === state.sort);
  });
  sortTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".sort-tab");
    if (!tab || tab.dataset.sort === state.sort) return;
    state.sort = tab.dataset.sort;
    renderSortTabsActive();
    syncUrl();
    loadFeed(true);
  });
}

function renderSortTabsActive() {
  sortTabs.querySelectorAll(".sort-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.sort === state.sort);
  });
}

function renderFilterBanner() {
  const chips = [];
  if (state.q) {
    chips.push(`<span class="filter-chip">🔍 搜索「${esc(state.q)}」
      <button type="button" data-clear="q" aria-label="清除搜索">✕</button></span>`);
  }
  if (state.tag) {
    chips.push(`<span class="filter-chip"># ${esc(state.tag)}
      <button type="button" data-clear="tag" aria-label="清除标签">✕</button></span>`);
  }
  filterBanner.innerHTML = chips.length
    ? `<div class="filter-banner">${chips.join("")}</div>` : "";

  filterBanner.querySelectorAll("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state[btn.dataset.clear] = "";
      renderFilterBanner();
      syncUrl();
      loadFeed(true);
    });
  });
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.sort !== "new") params.set("sort", state.sort);
  if (state.category !== "全部") params.set("category", state.category);
  if (state.q) params.set("q", state.q);
  if (state.tag) params.set("tag", state.tag);
  const qs = params.toString();
  history.replaceState(null, "", qs ? `/?${qs}` : "/");
}

/* --------------------------------- 数据加载 -------------------------------- */
async function loadFeed(reset) {
  if (state.loading) return;
  state.loading = true;

  if (reset) {
    state.page = 1;
    state.hasMore = false;
    feedEl.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>`;
    emptyEl.innerHTML = "";
    loadMoreBtn.hidden = true;
    if (state.sort !== "pinned") pinnedEl.innerHTML = "";
  }

  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "加载中…";

  const params = new URLSearchParams({ sort: state.sort, page: String(state.page) });
  if (state.category !== "全部") params.set("category", state.category);
  if (state.q) params.set("q", state.q);
  if (state.tag) params.set("tag", state.tag);

  try {
    const data = await api(`/api/posts?${params.toString()}`);
    state.total = data.total;
    state.hasMore = data.has_more;
    if (reset) state.pinnedCount = data.pinned.length;

    if (reset) feedEl.innerHTML = "";

    if (reset && state.sort !== "pinned" && data.pinned.length) {
      pinnedEl.innerHTML = `
        <div class="pinned-head">📌 置顶公告 <span>管理员推荐的重要内容</span></div>
        <div class="feed">${data.pinned.map((p) => postCardHtml(p)).join("")}</div>`;
    }

    if (data.posts.length) {
      feedEl.insertAdjacentHTML("beforeend", data.posts.map((p) => postCardHtml(p)).join(""));
    }

    if (!data.posts.length && reset) {
      emptyEl.innerHTML = emptyStateHtml();
    }

    const totalShown = state.total + (state.sort === "pinned" ? 0 : state.pinnedCount);
    countEl.textContent = totalShown ? `共 ${totalShown} 条` : "";
    loadMoreBtn.hidden = !state.hasMore;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "加载更多";
  } catch (err) {
    if (reset) {
      feedEl.innerHTML = "";
      countEl.textContent = "";
      state.hasMore = false;
      emptyEl.innerHTML = `<div class="empty-state">
          <span class="emoji">😵</span>
          <b>加载失败</b>
          <span>${esc(err.message)}</span>
        </div>`;
      loadMoreBtn.hidden = true;
    } else {
      state.page = Math.max(1, state.page - 1);
      toast(err.message, "error");
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "加载更多";
      loadMoreBtn.hidden = !state.hasMore;
    }
  } finally {
    state.loading = false;
  }
}

function emptyStateHtml() {
  if (state.q) {
    return `<div class="empty-state"><span class="emoji">🔍</span>
      <b>没有找到相关帖子</b><span>换个关键词试试，或者成为第一个发帖的人</span></div>`;
  }
  if (state.tag) {
    return `<div class="empty-state"><span class="emoji">🏷️</span>
      <b>这个标签下还没有帖子</b><span>发帖时加上 #${esc(state.tag)} 就能出现在这里</span></div>`;
  }
  if (state.sort === "pinned") {
    return `<div class="empty-state"><span class="emoji">📌</span>
      <b>还没有置顶公告</b><span>管理员置顶的重要通知会显示在这里</span></div>`;
  }
  return `<div class="empty-state"><span class="emoji">🌱</span>
    <b>这里还很安静</b><span>点右下角「发帖」，写下第一条吧</span></div>`;
}

loadMoreBtn.addEventListener("click", () => {
  if (!state.hasMore || state.loading) return;
  state.page += 1;
  loadFeed(false);
});

/* --------------------------------- 发帖弹层 -------------------------------- */
function initPostModal() {
  postModal = document.getElementById("post-modal");
  const form = document.getElementById("post-form");
  const select = document.getElementById("post-category");
  const anonInput = document.getElementById("is-anonymous");
  const nicknameField = document.getElementById("nickname-field");
  const contentInput = document.getElementById("post-content");
  const counter = document.getElementById("content-counter");
  const uploadZone = document.getElementById("upload-zone");
  const imageInput = document.getElementById("image-input");
  const previewGrid = document.getElementById("preview-grid");
  const captchaBox = document.getElementById("post-captcha");

  select.innerHTML = `<option value="" selected disabled>请选择分类</option>` +
    CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  captchaBox.innerHTML = captchaHtml();
  bindCaptcha(captchaBox);
  bindModalDismiss(postModal);

  document.getElementById("fab").addEventListener("click", openPostModal);

  anonInput.addEventListener("change", () => {
    nicknameField.hidden = anonInput.checked;
    const nick = form.elements.nickname;
    nick.required = !anonInput.checked;
    if (anonInput.checked) nick.value = "";
  });

  contentInput.addEventListener("input", () => {
    const n = contentInput.value.length;
    counter.textContent = `${n} / 2000`;
    counter.classList.toggle("over", n > 2000);
  });

  uploadZone.addEventListener("click", () => imageInput.click());
  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); imageInput.click(); }
  });
  ["dragenter", "dragover"].forEach((evt) =>
    uploadZone.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadZone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    uploadZone.addEventListener(evt, (e) => {
      e.preventDefault();
      uploadZone.classList.remove("dragover");
    })
  );
  uploadZone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
  imageInput.addEventListener("change", () => {
    addFiles(imageInput.files);
    imageInput.value = "";
  });

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    for (const file of incoming) {
      if (pendingFiles.length >= 9) {
        toast("最多上传 9 张图片", "error");
        break;
      }
      if (!file.type.startsWith("image/")) {
        toast(`「${file.name}」不是图片格式`, "error");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast(`「${file.name}」超过 5MB`, "error");
        continue;
      }
      pendingFiles.push(file);
    }
    renderPreviews();
  }

  function renderPreviews() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = pendingFiles.map((file) => URL.createObjectURL(file));
    previewGrid.innerHTML = pendingFiles.map((file, i) => `
      <div class="preview-item">
        <img src="${previewUrls[i]}" alt="${esc(file.name)}">
        <button type="button" data-remove="${i}" aria-label="移除图片">✕</button>
      </div>`).join("");
  }

  previewGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    pendingFiles.splice(Number(btn.dataset.remove), 1);
    renderPreviews();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const category = form.elements.category.value;
    const content = form.elements.content.value.trim();
    const isAnonymous = anonInput.checked;
    const nickname = form.elements.nickname.value.trim();
    const captcha = form.elements.captcha.value.trim();

    if (!category) return toast("请选择分类", "error");
    if (!content) return toast("正文不能为空", "error");
    if (content.length > 2000) return toast("正文不能超过 2000 字", "error");
    if (!isAnonymous && !nickname) return toast("请填写昵称，或打开匿名开关", "error");
    if (!captcha) return toast("请输入验证码", "error");

    const fd = new FormData();
    fd.append("category", category);
    fd.append("content", content);
    fd.append("is_anonymous", isAnonymous ? "1" : "0");
    fd.append("nickname", nickname);
    fd.append("contact", form.elements.contact.value.trim());
    fd.append("captcha", captcha);
    pendingFiles.forEach((file) => fd.append("images", file));

    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = "提交中…";
    try {
      const data = await api("/api/posts", { method: "POST", body: fd });
      toast(data.message || "提交成功，等待审核", "success");
      resetForm();
      closeModal(postModal);
    } catch (err) {
      toast(err.message, "error");
      const img = captchaBox.querySelector("[data-captcha]");
      if (img) refreshCaptcha(img);
      form.elements.captcha.value = "";
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  });

  function resetForm() {
    form.reset();
    anonInput.checked = true;
    nicknameField.hidden = true;
    form.elements.nickname.required = false;
    counter.textContent = "0 / 2000";
    pendingFiles = [];
    renderPreviews();
    const img = captchaBox.querySelector("[data-captcha]");
    if (img) refreshCaptcha(img);
  }
}

function openPostModal() {
  const img = document.querySelector("#post-captcha [data-captcha]");
  if (img) refreshCaptcha(img);
  openModal(postModal);
}
