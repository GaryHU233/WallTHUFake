// 尽早应用主题，避免闪烁（放在 <head> 中同步加载）
(function () {
  try {
    var saved = localStorage.getItem("wallthu-theme");
    var dark = saved
      ? saved === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
  } catch (e) {}
})();
