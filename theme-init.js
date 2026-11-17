/**
 * next-themes-compatible bootstrap (class strategy, localStorage key "theme").
 * Runs synchronously before paint to avoid flash of wrong theme.
 * Aligned with ayahday/theme-init.js.
 */
(function () {
  var storageKey = "theme";
  var stored = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch (e) {
    stored = null;
  }
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var isDark =
    stored === "dark" ||
    (stored === "light" ? false : stored === "system" ? prefersDark : false);
  document.documentElement.classList.toggle("dark", isDark);
})();
