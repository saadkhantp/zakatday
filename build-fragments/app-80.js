
  /* ------------------------------------------------------------------ */
  /* Rate editor                                                        */
  /* ------------------------------------------------------------------ */

  function openRateEditor() {
    var editor = $("rateEditor");
    var btn = $("editRatesBtn");
    if (!editor || !btn) return;
    setInputValue($("rateGoldInput"), state.rates.goldPerGram);
    setInputValue($("rateSilverInput"), state.rates.silverPerGram);
    editor.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    var first = $("rateGoldInput");
    if (first) {
      first.focus({ preventScroll: true });
      first.select();
    }
  }

  function closeRateEditor() {
    var editor = $("rateEditor");
    var btn = $("editRatesBtn");
    if (editor) editor.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  /** Write a plain digit string into an input, never clobbering the active field. */
  function setInputValue(input, value) {
    if (!input || input === activeInput) return;
    var next = value ? String(Math.round(value * 100) / 100) : "";
    if (input.value !== next) input.value = next;
  }

  function bindRateEditor() {
    var btn = $("editRatesBtn");
    if (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        var editor = $("rateEditor");
        if (editor && editor.hidden) openRateEditor();
        else closeRateEditor();
      });
    }
    var save = $("saveRatesBtn");
    if (save) {
      save.addEventListener("click", function () {
        var gold = CS.parseAmount($("rateGoldInput") ? $("rateGoldInput").value : "");
        var silver = CS.parseAmount($("rateSilverInput") ? $("rateSilverInput").value : "");
        if (gold) {
          state.rates.goldPerGram = gold;
          state.rates.goldManual = true;
        }
        if (silver) {
          state.rates.silverPerGram = silver;
          state.rates.silverManual = true;
        }
        closeRateEditor();
        render();
        showToast("Manual metal prices applied.", { duration: 2600 });
      });
    }
    var reset = $("resetRatesBtn");
    if (reset) {
      reset.addEventListener("click", function () {
        state.rates.goldManual = false;
        state.rates.silverManual = false;
        applyLivePrices();
        closeRateEditor();
        render();
        showToast(
          live.metals ? "Back to live metal prices." : "Live prices unavailable. Enter a price.",
          { duration: 3200 },
        );
      });
    }
    var editor = $("rateEditor");
    if (editor) {
      editor.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (save) save.click();
        }
      });
    }
    document.addEventListener("click", function (event) {
      var container = event.target.closest(".rate-pill");
      if (!container) closeRateEditor();
    });
  }
