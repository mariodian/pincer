(function () {
  const stored = localStorage.getItem("theme"); // 'light' | 'dark' | null
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (stored === "dark" || (!stored && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
})();
