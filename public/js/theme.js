// 新版样式仅支持浅色主题；清理旧版深色模式的残留标记
(function () {
  try {
    if (document.documentElement.getAttribute("data-theme")) {
      document.documentElement.removeAttribute("data-theme");
    }
    if (localStorage.getItem("wallthu-theme") !== null) {
      localStorage.removeItem("wallthu-theme");
    }
  } catch (e) {}
})();
