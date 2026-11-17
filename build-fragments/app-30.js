
  /* ------------------------------------------------------------------ */
  /* Rates                                                              */
  /* ------------------------------------------------------------------ */

  function goldUsdPerGram() {
    return live.metals && live.metals.goldUsdPerOz
      ? live.metals.goldUsdPerOz / CS.TROY_OUNCE_GRAMS
      : 0;
  }

  function silverUsdPerGram() {
    return live.metals && live.metals.silverUsdPerOz
      ? live.metals.silverUsdPerOz / CS.TROY_OUNCE_GRAMS
      : 0;
  }

  /** USD → display currency for one gram of metal (null if unavailable). */
  function perGramToDisplay(usdPerGram) {
    if (!usdPerGram) return null;
    if (state.currency === "USD") return usdPerGram;
    return CS.convert(usdPerGram, "USD", state.currency, live.rates);
  }

  /**
   * Push live prices into engine state unless the user typed their own for that
   * metal. Returns true when at least one price changed.
   */
  function applyLivePrices() {
    var changed = false;
    var gold = perGramToDisplay(goldUsdPerGram());
    var silver = perGramToDisplay(silverUsdPerGram());
    if (gold && !state.rates.goldManual && state.rates.goldPerGram !== gold) {
      state.rates.goldPerGram = gold;
      changed = true;
    }
    if (silver && !state.rates.silverManual && state.rates.silverPerGram !== silver) {
      state.rates.silverPerGram = silver;
      changed = true;
    }
    return changed;
  }

  async function refreshRates(options) {
    var opts = options || {};
    if (live.loading && !opts.force) return;
    live.loading = true;
    setRateStatus("loading");
    try {
      var result = await CS.loadLiveRates();
      if (result.rates) {
        live.rates = result.rates.rates;
        live.ratesFetchedAt = result.fetchedAt;
      }
      if (result.metals) {
        live.metals = result.metals;
        live.metalsFetchedAt = result.fetchedAt;
      }
      live.status = result.status;
      var changed = applyLivePrices();
      renderRates();
      if (changed || opts.always) render();
      if (opts.announce !== false) {
        if (result.metals) {
          showToast("Live gold &amp; silver prices updated".replace("&amp;", "&"), { duration: 2600 });
        } else if (result.rates) {
          showToast("Currency rates updated — metal prices unavailable, enter them manually.", {
            duration: 5200,
          });
        } else {
          showToast("Live rates unavailable. You can enter metal prices manually.", {
            duration: 5600,
          });
        }
      }
    } finally {
      live.loading = false;
    }
  }

  function setRateStatus(status) {
    var dot = $("ratesDot");
    var moreDot = $("moreRatesDot");
    var label = $("ratesStatusText");
    if (dot) dot.setAttribute("data-status", status);
    if (moreDot) moreDot.hidden = status !== "live";
    var messages = {
      live: "Live rates loaded",
      loading: "Loading live rates",
      cached: "Using saved rates",
      error: "Live rates unavailable",
      override: "Using your manual metal prices",
    };
    if (label) label.textContent = messages[status] || messages.error;
  }

  function priceLabel(value) {
    if (!value) return "—";
    var currency = CS.getCurrency(state.currency);
    var digits = value < 10 ? 3 : 2;
    return CS.formatMoney(value, state.currency, { decimals: digits }) +
      (currency.decimals === 0 && value < 10 ? "" : "");
  }

  function renderRates() {
    setText($("goldPerGramText"), priceLabel(state.rates.goldPerGram));
    setText($("silverPerGramText"), priceLabel(state.rates.silverPerGram));
    var status = live.status.metals === "live" ? "live" : "error";
    if (state.rates.goldManual || state.rates.silverManual) status = "override";
    if (!state.rates.goldPerGram && !state.rates.silverPerGram && live.loading) {
      status = "loading";
    }
    setRateStatus(status);
    each("[data-symbol]", function (node) {
      setText(node, symbolFor(state.currency));
    });
  }
