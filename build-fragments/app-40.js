
  /* ------------------------------------------------------------------ */
  /* Metals + rendering                                                 */
  /* ------------------------------------------------------------------ */

  function unitToGrams(value, unit) {
    var amount = Engine.toNumber(value);
    if (unit === "tola") return Engine.gramsFromTola(amount);
    if (unit === "oz") return Engine.gramsFromOunce(amount);
    return amount;
  }

  /** Recompute metal value + fine weight from the raw weight inputs. */
  function syncMetals() {
    var goldPurity = GOLD_PURITY[String(metalWeights.goldKarat)] || 1;
    var silverPurity = Number(metalWeights.silverPurity) || 1;
    metalWeights.gold = unitToGrams($("goldGrams") ? $("goldGrams").value : 0, units.gold);
    metalWeights.silver = unitToGrams($("silverGrams") ? $("silverGrams").value : 0, units.silver);
    state.gold.grams = metalWeights.gold * goldPurity;
    state.silver.grams = metalWeights.silver * silverPurity;
    state.gold.value = state.gold.grams * state.rates.goldPerGram;
    state.silver.value = state.silver.grams * state.rates.silverPerGram;
  }

  function render() {
    syncMetals();
    var summary = Engine.compute(state);

    /* Hero */
    setText($("heroCurrencyCode"), state.currency);
    setText($("currencyTriggerCode"), state.currency);
    setText($("currencyTriggerSymbol"), symbolFor(state.currency));
    var flag = $("currencyTriggerFlag");
    if (flag) setText(flag, CS.flagFor(CS.getCurrency(state.currency).country));
    var trigger = $("currencyTrigger");
    if (trigger) {
      trigger.setAttribute("aria-label", "Change currency (currently " + state.currency + ")");
    }
    setText($("moreCurrencyValue"), state.currency);

    var amount = $("zakatAmount");
    if (amount) {
      var hasInput = summary.netAssets > 0;
      amount.setAttribute("data-state", !hasInput ? "none" : summary.due ? "due" : "below");
      setText(amount, hasInput ? fmtCompact(summary.zakat) : "—");
    }

    var meter = $("nisabMeter");
    var fill = $("nisabMeterFill");
    if (meter && fill) {
      meter.setAttribute("data-state", summary.due ? "due" : "below");
      meter.setAttribute("aria-valuenow", String(Math.round(summary.progress)));
      fill.style.width = Math.max(0, Math.min(100, summary.progress)) + "%";
    }

    var pct = Math.round(summary.progress);
    var meterLabel = $("nisabMeterLabel");
    if (meterLabel) {
      var text;
      if (summary.netAssets <= 0) {
        text = "Enter your assets below to see your nisab position.";
      } else if (!summary.hasNisabPrice) {
        text = "Metal price missing — add a gold or silver price to check the nisab.";
      } else if (summary.due) {
        text = "Above nisab by " + fmtCompact(summary.netAssets - summary.nisabValue) + " · Zakat is due.";
      } else {
        text = pct + "% of nisab · " + fmtCompact(summary.nisabValue - summary.netAssets) + " short.";
      }
      setText(meterLabel, text);
    }

    setText($("netAssetsValue"), summary.netAssets > 0 ? fmtCompact(summary.netAssets) : "—");
    setText(
      $("nisabValueText"),
      summary.hasNisabPrice ? fmtCompact(summary.nisabValue) : "set price",
    );

    /* Nisab toggle */
    each("[data-standard]", function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.standard === state.standard ? "true" : "false");
    });

    /* Metal rows inside the asset card */
    setText($("goldWeightText"), CS.formatNumber(state.gold.grams, 2) + " g fine");
    setText($("silverWeightText"), CS.formatNumber(state.silver.grams, 2) + " g fine");
    setText($("goldValueText"), state.gold.value > 0 ? fmt(state.gold.value) : "—");
    setText($("silverValueText"), state.silver.value > 0 ? fmt(state.silver.value) : "—");

    /* Card totals */
    setText($("cashTotal"), fmtCompact(summary.cash));
    setText($("metalsTotal"), fmtCompact(summary.metals));
    setText($("investmentsTotal"), fmtCompact(summary.investments));
    setText($("businessTotal"), fmtCompact(summary.business));
    setText($("debtsTotal"), fmtCompact(summary.debts));

    /* Render amounts as plain digits (re-typing would otherwise be re-parsed as
       one huge number once thousands separators are introduced). */
    setInputValue($("cashHeld"), state.cash.held);
    setInputValue($("cashBank"), state.cash.bank);
    setInputValue($("cashDigital"), state.cash.digital);
    setInputValue($("invShares"), state.investments.shares);
    setInputValue($("invCrypto"), state.investments.crypto);
    setInputValue($("invRetirement"), state.investments.retirement);
    setInputValue($("bizStock"), state.business.stock);
    setInputValue($("bizReceivables"), state.business.receivables);
    setInputValue($("debtPayable"), state.debts.payable);

    renderBreakdown(summary);
    renderRates();
    syncShareTrigger(summary);
    return summary;
  }

  function renderBreakdown(summary) {
    var colors = {
      cash: "segCash",
      metals: "segMetals",
      investments: "segInvestments",
      business: "segBusiness",
      debts: "segDebts",
    };
    var base = summary.grossAssets || 0;
    Object.keys(colors).forEach(function (key) {
      var node = $(colors[key]);
      if (!node) return;
      var value = summary.categories[key] || 0;
      var width = base > 0 ? Math.min(100, (value / base) * 100) : 0;
      node.style.width = width.toFixed(2) + "%";
    });
    setText($("breakdownTotal"), base > 0 ? fmtCompact(base) + " total" : "—");
  }
