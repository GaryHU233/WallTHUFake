/* 热门标签页 */
"use strict";

initHeader("tags");
initFooter();

const cloud = document.getElementById("tag-cloud");
const loading = document.getElementById("tag-loading");
const empty = document.getElementById("tag-empty");

loadTags();

async function loadTags() {
  try {
    const data = await api("/api/tags");
    loading.remove();
    if (!data.tags.length) {
      empty.innerHTML = `<div class="empty-state" style="margin-top:16px">
          <span class="emoji">🏷️</span>
          <b>还没有标签</b>
          <span>发帖时在正文里加上 #标签，就会出现在这里</span>
        </div>`;
      return;
    }
    const max = Math.max(...data.tags.map((t) => t.count));
    cloud.innerHTML = data.tags.map(({ tag, count }) => {
      const size = 13 + Math.round((count / max) * 5);
      return `<a class="tag-pill" href="/?tag=${encodeURIComponent(tag)}"
                 style="font-size:${size}px"># ${esc(tag)} <small>${count}</small></a>`;
    }).join("");
  } catch (err) {
    loading.remove();
    empty.innerHTML = `<div class="empty-state"><span class="emoji">😵</span>
        <b>标签加载失败</b><span>${esc(err.message)}</span></div>`;
  }
}
