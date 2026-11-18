
  /* ------------------------------------------------------------------ */
  /* Inputs                                                             */
  /* ------------------------------------------------------------------ */

  function sanitizeTyped(input) {
    var cleaned = String(input.value || "")
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1");
    if (cleaned !== input.value) input.value = cleaned;
    return cleaned;
  }

  /* Element currently being edited: render() must not rewrite its value. */
  var activeInput = null;

  function bindMoneyInputs() {
    each("[data-group][data-field]", function (input) {
      var group = input.dataset.group;
      var field = input.dataset.field;
      input.addEventListener("focus", function () {
        activeInput = input;
      });
      input.addEventListener("input", function () {
        sanitizeTyped(input);
        if (!state[group]) state[group] = {};
        state[group][field] = CS.parseAmount(input.value);
        render();
      });
      input.addEventListener("blur", function () {
        if (activeInput === input) activeInput = null;
        var value = CS.parseAmount(input.value);
        if (state[group] && CS.parseAmount(state[group][field]) !== value) {
          state[group][field] = value;
        }
        input.value = value ? String(value) : "";
        render();
      });
    });
  }

  function bindMetals() {
    var goldInput = $("goldGrams");
    var silverInput = $("silverGrams");
    [goldInput, silverInput].forEach(function (input) {
      if (!input) return;
      input.addEventListener("focus", function () {
        activeInput = input;
      });
      input.addEventListener("input", function () {
        sanitizeTyped(input);
        render();
      });
      input.addEventListener("blur", function () {
        if (activeInput === input) activeInput = null;
        var value = Engine.toNumber(input.value);
        input.value = value ? String(value) : "";
      });
    });

    var goldKarat = $("goldKarat");
    if (goldKarat) {
      goldKarat.addEventListener("change", function () {
        metalWeights.goldKarat = goldKarat.value;
        render();
      });
    }
    var silverPurity = $("silverPurity");
    if (silverPurity) {
      silverPurity.addEventListener("change", function () {
        metalWeights.silverPurity = silverPurity.value;
        render();
      });
    }
    [["goldUnit", "gold"], ["silverUnit", "silver"]].forEach(function (pair) {
      var select = $(pair[0]);
      if (!select) return;
      select.addEventListener("change", function () {
        units[pair[1]] = select.value;
        render();
      });
    });
  }

  function bindStandardToggle() {
    each("[data-standard]", function (btn) {
      btn.addEventListener("click", function () {
        state.standard = btn.dataset.standard === "gold" ? "gold" : "silver";
        try {
          localStorage.setItem("zakatday-nisab-standard", state.standard);
        } catch (e) {
          /* preference only */
        }
        render();
      });
    });
    var stored = null;
    try {
      stored = localStorage.getItem("zakatday-nisab-standard");
    } catch (e) {
      stored = null;
    }
    if (stored === "gold" || stored === "silver") state.standard = stored;
  }

  /** Two-step reset: first click arms, second click clears everything. */
  function bindReset() {
    var btn = $("resetBtn");
    if (!btn) return;
    var timer = null;

    function disarm() {
      resetArmed = false;
      btn.setAttribute("data-confirm", "false");
      btn.setAttribute("aria-label", "Reset all amounts");
      btn.setAttribute("title", "Reset all amounts");
      if (timer) clearTimeout(timer);
    }

    btn.addEventListener("click", function () {
      if (!resetArmed) {
        resetArmed = true;
        btn.setAttribute("data-confirm", "true");
        btn.setAttribute("aria-label", "Tap again to clear every amount");
        btn.setAttribute("title", "Tap again to clear every amount");
        timer = setTimeout(disarm, 4000);
        showToast("Tap reset once more to clear every amount.", { duration: 4000 });
        return;
      }
      disarm();
      resetAll();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && resetArmed) disarm();
    });
  }

  function resetAll() {
    var standard = state.standard;
    var currency = state.currency;
    state = Engine.createState({ standard: standard, currency: currency });
    metalWeights.gold = 0;
    metalWeights.silver = 0;
    applyLivePrices();
    each("input[data-group], input[data-metal]", function (input) {
      input.value = "";
    });
    render();
    showToast("Cleared. Nothing was stored, so this is a true fresh start.", { duration: 3200 });
  }
