
  /**
   * Switch currency: converts every amount with live cross-rates so the user's
   * work is preserved. Manual metal prices are converted from the currency they
   * were typed in and stay marked as manual.
   */
  function changeCurrency(code) {
    var next = String(code || "").toUpperCase();
    if (!CS.isKnown(next)) return;
    if (next === state.currency) {
      closeSheetEl($("currencySheet"));
      return;
    }
    var previous = Engine.cloneState(state);
    CS.setStoredCurrency(next);

    if (live.rates) {
      state = Engine.reconvert(state, next, live.rates, CS.convert);
    } else {
      state.currency = next;
    }

    if (previous.rates.goldManual) {
      var gold = CS.convert(previous.rates.goldPerGram, previous.currency, next, live.rates);
      state.rates.goldPerGram = gold === null ? previous.rates.goldPerGram : gold;
      state.rates.goldManual = true;
    }
    if (previous.rates.silverManual) {
      var silver = CS.convert(previous.rates.silverPerGram, previous.currency, next, live.rates);
      state.rates.silverPerGram = silver === null ? previous.rates.silverPerGram : silver;
      state.rates.silverManual = true;
    }

    applyLivePrices();
    refreshPickerViews();
    closeSheetEl($("currencySheet"));
    render();
    if (!live.rates) {
      showToast(
        "Rates offline. Amounts re-labelled as " + next + " without conversion.",
        { duration: 5600 },
      );
    } else {
      showToast("Switched to " + next + ". Amounts converted at live rates.", { duration: 2600 });
    }
  }
