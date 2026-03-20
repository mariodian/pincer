(function () {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function resolveTheme() {
    return mediaQuery.matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  function applyCurrentTheme() {
    applyTheme(resolveTheme());
  }

  applyCurrentTheme();

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", applyCurrentTheme);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(applyCurrentTheme);
  }
})();
