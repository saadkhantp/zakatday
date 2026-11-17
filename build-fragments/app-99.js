
  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */

  function boot() {
    var stored = CS.getStoredCurrency();
    state.currency = stored || CS.guessCurrencyFromLocale();
    if (stored) {
      /* Keep favourites useful: surface a previously chosen currency. */
      var favorites = CS.getFavorites();
      if (favorites.indexOf(stored) === -1) {
        CS.saveFavorites([stored].concat(favorites));
      }
    }

    bindStandardToggle();
    bindTheme();
    bindMoneyInputs();
    bindMetals();
    bindRateEditor();
    bindReset();
    bindSheetsAndModals();
    bindShare();
    bindWhatsAppShare();
    bindKeyboard();

    var year = $("footerYear");
    if (year) year.textContent = String(new Date().getFullYear());

    renderFavPills();
    syncPinToggle();
    render();

    refreshRates({ announce: false, force: true }).then(function () {
      if (!live.metals) {
        showToast("Live rates unavailable — tap Edit to enter gold and silver prices.", {
          duration: 7000,
        });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /**
   * Public hooks used by inline handlers in index.html and by the smoke test.
   * Kept intentionally small; all state access is read-only.
   */
  window.ZakatDay = {
    openSummary: function () {
      openSummary();
      return document.getElementById("summaryModal").hidden;
    },
    shareWhatsApp: function () {
      window.open(whatsappUrl(summaryForShare()), "_blank", "noopener,noreferrer");
    },
    openWhatsAppShare: function () {
      openWhatsAppShare();
      return true;
    },
    getShareText: function (mode) {
      var previous = shareMode;
      shareMode = mode === "totals" ? "totals" : "itemized";
      var text = shareTextForMode();
      shareMode = previous;
      return text;
    },
    closeAll: function () {
      closeModal($("summaryModal"));
      closeModal($("updatesModal"));
      closeModal($("whatsappShareModal"));
      if (openSheet) closeSheetEl(openSheet);
      closeRateEditor();
    },
    getState: function () {
      return Engine.cloneState(state);
    },
    getSummary: function () {
      var summary = Engine.compute(state);
      return {
        currency: summary.currency,
        standard: summary.standard,
        netAssets: summary.netAssets,
        nisabValue: summary.nisabValue,
        hasNisabPrice: summary.hasNisabPrice,
        due: summary.due,
        zakat: summary.zakat,
      };
    },
    getLive: function () {
      return {
        hasRates: Boolean(live.rates),
        hasMetals: Boolean(live.metals),
        status: live.status,
      };
    },
  };
})();
