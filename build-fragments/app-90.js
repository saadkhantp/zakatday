
  /* ------------------------------------------------------------------ */
  /* Theme                                                              */
  /* ------------------------------------------------------------------ */

  function bindTheme() {
    if (typeof initThemeToggle === "function") initThemeToggle();
    var btn = $("themeToggleBtn");
    if (!btn) return;
    var glyph = btn.querySelector(".header-icon-btn__glyph");
    var sync = function () {
      var isDark = document.documentElement.classList.contains("dark");
      if (glyph) glyph.textContent = isDark ? "light_mode" : "dark_mode";
    };
    sync();
    btn.addEventListener("click", function () {
      sync();
    });
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function () {
        sync();
      });
  }

  /* ------------------------------------------------------------------ */
  /* Sharing                                                            */
  /* ------------------------------------------------------------------ */

  function summaryForShare() {
    var summary = render();
    return Engine.toSummaryText(
      summary,
      function (value) {
        return CS.formatMoney(value, state.currency);
      },
      { withCode: true },
    );
  }

  function openSummary() {
    var modal = $("summaryModal");
    var pre = $("summaryText");
    if (!modal || !pre) return;
    pre.textContent = summaryForShare();
    openModal(modal);
  }

  function shareText(text) {
    if (navigator.share) {
      return navigator.share({ title: "My Zakat summary", text: text }).catch(function () {
        return copyText(text);
      });
    }
    return copyText(text).then(function (ok) {
      showToast(ok ? "Summary copied to clipboard." : "Could not copy. Select the text instead.", {
        duration: 3200,
      });
      return ok;
    });
  }

  function whatsappUrl(text) {
    return "https://wa.me/?text=" + encodeURIComponent(text);
  }
