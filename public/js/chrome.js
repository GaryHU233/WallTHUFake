/* 纯静态页面：根据 body[data-page] 渲染页头页脚 */
"use strict";
(function () {
  const page = document.body.dataset.page || "";
  initHeader(page);
  initFooter();
})();
