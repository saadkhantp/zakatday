/**
 * next-themes-compatible bootstrap (class strategy, localStorage key "theme").
 * Runs synchronously before paint to avoid flash of wrong theme.
 * Aligned with ayahday/theme-init.js.
 */
(function () {
  function readTokenColor(name) {
    var raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (/^(?:\d*\.?\d+%?\s+){2}\d*\.?\d+%?$/.test(raw)) return "rgb(" + raw + ")";
    var probe = document.createElement("span");
    probe.hidden = true;
    probe.style.color = "var(" + name + ")";
    document.documentElement.appendChild(probe);
    var color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }

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

  /* Keep the browser chrome on the design tokens, including when JS is the
     only thing that knows the stored theme. */
  var lightChrome = readTokenColor("--chrome-light");
  var darkChrome = readTokenColor("--chrome-dark");
  var themeMetas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < themeMetas.length; i++) {
    var media = themeMetas[i].getAttribute("media") || "";
    if (media.indexOf("dark") !== -1) themeMetas[i].setAttribute("content", darkChrome);
    else if (media.indexOf("light") !== -1) themeMetas[i].setAttribute("content", lightChrome);
    else themeMetas[i].setAttribute("content", isDark ? darkChrome : lightChrome);
  }

  /* Opt in to scroll/fade motion only when it is both supported and wanted.
     The CSS keeps every reveal element visible without this class, so a failed
     script (or reduced motion) leaves a completely static page. */
  var noMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!noMotion) document.documentElement.classList.add("motion-in");
})();
