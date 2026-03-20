(function () {
  const THEME_KEY = "theme";
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY); // 'system' | 'light' | 'dark' | null
  }

  function isExplicitTheme(theme) {
    return theme === "light" || theme === "dark";
  }

  function resolveTheme(theme) {
    if (theme === "dark") return "dark";
    if (theme === "light") return "light";
    return mediaQuery.matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  function applyCurrentTheme() {
    applyTheme(resolveTheme(getStoredTheme()));
  }

  applyCurrentTheme();

  const handleSystemThemeChange = () => {
    const storedTheme = getStoredTheme();

    // Follow system only when user has not explicitly chosen light or dark.
    if (!isExplicitTheme(storedTheme)) {
      applyCurrentTheme();
    }
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleSystemThemeChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleSystemThemeChange);
  }
})();
