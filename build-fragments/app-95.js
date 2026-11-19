
  /* ------------------------------------------------------------------ */
  /* Global wiring                                                      */
  /* ------------------------------------------------------------------ */

  function bindSheetsAndModals() {
    var moreBtn = $("moreMenuBtn");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        openSheetEl($("moreSheet"), moreBtn);
      });
    }

    var currencyTrigger = $("currencyTrigger");
    if (currencyTrigger) {
      currencyTrigger.addEventListener("click", function () {
        refreshPickerViews();
        openSheetEl($("currencySheet"), currencyTrigger, function () {
          var search = $("currencySearch");
          if (search) {
            search.value = "";
            renderCurrencyList("");
            setTimeout(function () {
              search.focus({ preventScroll: true });
            }, 220);
          }
        });
      });
    }

    each("[data-sheet-close]", function (node) {
      node.addEventListener("click", function () {
        closeSheetEl(node.closest(".more-sheet"));
      });
    });

    each("[data-more-action]", function (node) {
      node.addEventListener("click", function () {
        var action = node.dataset.moreAction;
        closeSheetEl($("moreSheet"));
        setTimeout(function () {
          if (action === "about") {
            /* The sheet returns focus to the menu button as it finishes
               closing. Open after that so the dialog keeps the focus. */
            setTimeout(function () {
              openAbout($("moreMenuBtn"));
            }, 200);
          } else if (action === "currency") {
            refreshPickerViews();
            openSheetEl($("currencySheet"), $("currencyTrigger"));
          } else if (action === "rates") {
            refreshRates({ force: true });
          } else if (action === "theme") {
            if (typeof toggleTheme === "function") toggleTheme();
            var btn = $("themeToggleBtn");
            if (btn) btn.click();
          } else if (action === "summary") {
            closeModal($("summaryModal"));
            openSummary();
          } else if (action === "latest") {
            openModal($("updatesModal"));
          } else if (action === "feedback") {
            window.location.href = feedbackHref();
          }
        }, 180);
      });
    });

    each("[data-updates-close]", function (node) {
      node.addEventListener("click", function () {
        closeModal($("updatesModal"));
      });
    });
    each("[data-summary-close]", function (node) {
      node.addEventListener("click", function () {
        closeModal($("summaryModal"));
      });
    });

    var search = $("currencySearch");
    if (search) {
      search.addEventListener("input", function () {
        renderCurrencyList(search.value);
      });
      search.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          var first = document.querySelector("#currencyList .currency-option");
          if (first) changeCurrency(first.dataset.currency);
        }
      });
    }

    var pinToggle = $("pinCurrentToggle");
    if (pinToggle) {
      pinToggle.addEventListener("change", function () {
        togglePin(state.currency, null);
      });
    }

    var feedback = $("feedbackBtn");
    if (feedback) {
      feedback.addEventListener("click", function () {
        window.location.href = feedbackHref();
      });
    }
  }

  function feedbackHref() {
    var subject = encodeURIComponent("ZakatDay feedback");
    var body = encodeURIComponent(
      "Assalamu alaikum,\n\nHere is my feedback about ZakatDay:\n\n\n\n" +
        "(Sent from " +
        location.hostname +
        ")",
    );
    return "mailto:" + FEEDBACK_MAILTO + "?subject=" + subject + "&body=" + body;
  }

  function bindShare() {
    var share = $("shareSummaryBtn");
    if (share) {
      share.addEventListener("click", function () {
        shareText(summaryForShare());
      });
    }
    var copy = $("copySummaryBtn");
    if (copy) {
      copy.addEventListener("click", function () {
        var text = $("summaryText") ? $("summaryText").textContent : "";
        copyText(text).then(function (ok) {
          showToast(ok ? "Summary copied." : "Copy failed. Select the text manually.", {
            duration: 2600,
          });
        });
      });
    }
    var summaryWhatsapp = $("summaryWhatsappBtn");
    if (summaryWhatsapp) {
      summaryWhatsapp.addEventListener("click", function () {
        var text = $("summaryText") ? $("summaryText").textContent : "";
        window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
      });
    }
    var toastAction = $("saveToastAction");
    if (toastAction) {
      toastAction.addEventListener("click", function () {
        if (undoAction) undoAction();
        undoAction = null;
        var toast = $("saveToast");
        if (toast) toast.hidden = true;
      });
    }
  }

  function bindKeyboard() {
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      closeRateEditor();
      if (openSheet) closeSheetEl(openSheet);
      closeModal($("updatesModal"));
      closeModal($("summaryModal"));
      closeModal($("whatsappShareModal"));
    });
  }
