/**
 * ZakatDay UI layer.
 *
 * Owns DOM wiring only: all maths lives in zakat-engine.js, all rates and
 * formatting in currency-service.js. Nothing the user types is transmitted or
 * persisted. Amounts exist only in the `state` object for this tab's lifetime.
 */
(function () {
  "use strict";

  var CS = window.CurrencyService;
  var Engine = window.ZakatEngine;
  if (!CS || !Engine) return;

  var METALS = { gold: 0, silver: 1 };
  var GOLD_PURITY = { 24: 1, 22: 22 / 24, 21: 21 / 24, 18: 18 / 24, 14: 14 / 24 };
  var METAL_STALE_MS = 1000 * 60 * 30;

  var FEEDBACK_MAILTO = "salam@zakatday.cc";

  var state = Engine.createState();
  var live = {
    rates: null,
    metals: null,
    ratesFetchedAt: null,
    metalsFetchedAt: null,
    status: { fx: "loading", metals: "loading" },
    loading: false,
  };
  /* Metal price snapshot taken when the currency changes, to detect staleness. */
  var metalWeights = { gold: 0, silver: 0, goldKarat: 24, silverPurity: 1 };
  var units = { gold: "g", silver: "g" };
  var resetArmed = false;
  var toastTimer = null;
  var undoAction = null;

  function $(id) {
    return document.getElementById(id);
  }

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function show(node, visible) {
    if (node) node.hidden = !visible;
  }

  function fmt(amount) {
    return CS.formatMoney(amount, state.currency);
  }

  /** Compact money for pills/labels: drops decimals for large values. */
  function fmtCompact(amount) {
    var currency = CS.getCurrency(state.currency);
    var abs = Math.abs(Number(amount) || 0);
    var digits = abs >= 10000 ? 0 : currency.decimals;
    return CS.formatMoney(amount, state.currency, { decimals: digits });
  }

  function symbolFor(code) {
    return CS.getCurrency(code).symbol;
  }

  function flashClass(node, className) {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }
  /* ------------------------------------------------------------------ */
  /* Sheet / modal plumbing (AyahDay attachBottomSheetDrag pattern)      */
  /* ------------------------------------------------------------------ */

  var openSheet = null;

  function attachBottomSheetDrag(options) {
    var sheet = options.sheet;
    var panel = options.panel;
    var handle = options.handle || panel;
    var backdrop = options.backdrop;
    var close = options.close;
    var snap = options.snap || 0.25;
    var canStart = options.canStart;
    if (!sheet || !panel) return null;

    var dragY = 0;
    var startY = 0;
    var startedAt = 0;
    var dragging = false;

    function height() {
      return panel.getBoundingClientRect().height || 1;
    }

    function onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (canStart && !canStart(event)) return;
      dragging = true;
      startY = event.clientY;
      startedAt = Date.now();
      dragY = 0;
      panel.classList.add("more-sheet__panel--dragging");
      if (handle.setPointerCapture) {
        try {
          handle.setPointerCapture(event.pointerId);
        } catch (e) {
          /* ignore */
        }
      }
      event.preventDefault();
    }

    function onPointerMove(event) {
      if (!dragging) return;
      dragY = Math.max(0, event.clientY - startY);
      panel.style.transform = "translateY(" + dragY + "px)";
      if (backdrop) backdrop.style.opacity = String(Math.max(0.2, 1 - dragY / height()));
    }

    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      var elapsed = Math.max(1, Date.now() - startedAt);
      var velocity = dragY / elapsed;
      panel.classList.remove("more-sheet__panel--dragging");
      panel.style.transform = "";
      if (backdrop) backdrop.style.opacity = "";
      var closed = dragY > height() * snap || (dragY > 40 && velocity > 0.55);
      if (closed && close) close();
    }

    /* Listeners live on the grab handle only, so taps inside the sheet body are
       never interpreted as a drag gesture. */
    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
  }

  function openSheetEl(sheet, trigger, onOpened) {
    if (!sheet || openSheet === sheet) return;
    if (openSheet) closeSheetEl(openSheet);
    sheet.hidden = false;
    openSheet = sheet;
    document.body.style.overflow = "hidden";
    if (trigger) {
      sheet.dataset.triggerId = trigger.id;
      trigger.setAttribute("aria-expanded", "true");
    }
    requestAnimationFrame(function () {
      sheet.setAttribute("data-open", "true");
    });
    var panel = sheet.querySelector(".more-sheet__panel");
    if (!sheet.dataset.dragReady && panel) {
      sheet.dataset.dragReady = "1";
      attachBottomSheetDrag({
        sheet: sheet,
        panel: panel,
        handle: sheet.querySelector("[data-sheet-drag]") || panel,
        backdrop: sheet.querySelector(".more-sheet__backdrop"),
        close: function () {
          closeSheetEl(sheet);
        },
        canStart: function (event) {
          return !event.target.closest("input, select, textarea, a, button");
        },
      });
    }
    var focusTarget =
      sheet.querySelector("[data-sheet-autofocus]") || sheet.querySelector(".more-sheet__title");
    if (focusTarget) {
      if (!focusTarget.hasAttribute("tabindex")) focusTarget.setAttribute("tabindex", "-1");
      setTimeout(function () {
        focusTarget.focus({ preventScroll: true });
      }, 60);
    }
    if (typeof onOpened === "function") onOpened();
  }

  function closeSheetEl(sheet) {
    if (!sheet || sheet.hidden) return;
    sheet.setAttribute("data-open", "false");
    var trigger = sheet.dataset.triggerId ? $(sheet.dataset.triggerId) : null;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    setTimeout(function () {
      sheet.hidden = true;
      if (openSheet === sheet) {
        openSheet = null;
        document.body.style.overflow = "";
        if (trigger) trigger.focus({ preventScroll: true });
      }
    }, 300);
  }

  function openModal(modal) {
    if (!modal || !modal.hidden) return;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var focusTarget = modal.querySelector(".updates-modal__got-it");
    if (focusTarget) {
      setTimeout(function () {
        focusTarget.focus({ preventScroll: true });
      }, 40);
    }
  }

  function closeModal(modal) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (!openSheet && !document.querySelector(".updates-modal:not([hidden])")) {
      document.body.style.overflow = "";
    }
  }

  /** Copy text with a clipboard fallback for non-secure contexts. */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(text);
        },
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function showToast(message, options) {
    var toast = $("saveToast");
    var text = $("saveToastText");
    var action = $("saveToastAction");
    if (!toast || !text) return;
    setText(text, message);
    var opts = options || {};
    undoAction = typeof opts.onAction === "function" ? opts.onAction : null;
    if (action) {
      action.hidden = !undoAction;
      setText(action, opts.actionLabel || "Undo");
    }
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.hidden = true;
      undoAction = null;
    }, opts.duration || 4200);
  }
/* ------------------------------------------------------------------ */
  /* Motion + interaction polish                                        */
  /* Scroll reveal, value fades and the "Check your Zakat" hand-off.    */
  /* Everything here degrades to a static page without JS or motion.    */
  /* ------------------------------------------------------------------ */

  var motionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  /** True when animation is wanted: motion-in is set by theme-init.js. */
  function motionOn() {
    if (motionQuery && motionQuery.matches) return false;
    return document.documentElement.classList.contains("motion-in");
  }

  function scrollBehavior() {
    return motionOn() ? "smooth" : "auto";
  }

  /**
   * Staggered fade-up for items a user just asked for (modal bodies, toast
   * cards). Only elements carrying `data-reveal` are touched, so ordinary
   * content is never hidden.
   */
  function revealChildren(host, options) {
    if (!host) return;
    var opts = options || {};
    var step = opts.step === undefined ? 40 : opts.step;
    var nodes = host.querySelectorAll("[data-reveal]");
    Array.prototype.forEach.call(nodes, function (node) {
      node.removeAttribute("data-revealed");
      if (!motionOn()) {
        node.setAttribute("data-revealed", "true");
        return;
      }
      node.style.setProperty("--reveal-delay", (opts.index || 0) * step + "ms");
    });
    /* Force the pre-reveal frame, then flip the attribute so the CSS
       transition has a start value to animate from. */
    void host.offsetWidth;
    requestAnimationFrame(function () {
      Array.prototype.forEach.call(nodes, function (node) {
        node.setAttribute("data-revealed", "true");
      });
    });
  }

  /** Fade a value that just changed (stat numbers, summary lines). */
  function flashText(node) {
    if (!node || !motionOn()) return;
    node.classList.remove("motion-fade");
    void node.offsetWidth;
    node.classList.add("motion-fade");
  }


  /** Reveal section cards as they enter the viewport, once each. */
  function revealOnScroll() {
    if (!motionOn()) return;
    var targets = document.querySelectorAll("main > section");
    if (!targets.length) return;

    var viewport = window.innerHeight || 0;
    var candidates = [];
    Array.prototype.forEach.call(targets, function (node, index) {
      /* Anything already on the first screen stays untouched, so the initial
         paint and largest-contentful-paint are unaffected. */
      if (node.getBoundingClientRect().top < viewport * 0.9) return;
      node.setAttribute("data-reveal", "");
      node.style.setProperty("--reveal-delay", Math.min(index, 4) * 30 + "ms");
      candidates.push(node);
    });
    if (!candidates.length) return;

    if (typeof window.IntersectionObserver !== "function") {
      candidates.forEach(function (node) {
        node.setAttribute("data-revealed", "true");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    candidates.forEach(function (node) {
      observer.observe(node);
    });
  }

  /** Smooth in-page jump used by "Check Your Due Zakat". */
  function scrollToNode(node, offset) {
    if (!node) return;
    var top = node.getBoundingClientRect().top + (window.pageYOffset || 0) - (offset || 12);
    window.scrollTo({ top: Math.max(0, top), behavior: scrollBehavior() });
  }

  /* ------------------------------------------------------------------ */
  /* About / How it works                                               */
  /* ------------------------------------------------------------------ */

  var aboutReturnFocus = null;

  function openAbout(returnFocus) {
    var modal = $("aboutModal");
    if (!modal) return;
    aboutReturnFocus = returnFocus || null;
    openModal(modal);
    var body = $("aboutModalBody");
    if (body) revealChildren(body, { step: 35 });
    var closeBtn = modal.querySelector(".header-icon-btn");
    if (closeBtn) {
      setTimeout(function () {
        closeBtn.focus({ preventScroll: true });
      }, 60);
    }
  }

  function bindAboutModal() {
    var trigger = $("aboutBtn");
    var modal = $("aboutModal");
    if (!modal) return;

    function close() {
      closeModal(modal);
      if (aboutReturnFocus && aboutReturnFocus.focus) {
        aboutReturnFocus.focus({ preventScroll: true });
      }
    }

    if (trigger) {
      trigger.addEventListener("click", function () {
        openAbout(trigger);
      });
    }

    each("[data-about-close]", function (node) {
      node.addEventListener("click", close);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }

  /* ------------------------------------------------------------------ */
  /* "Check Your Due Zakat"                                             */
  /* ------------------------------------------------------------------ */

  /**
   * The results card sits below the inputs, so the button stays disabled until
   * there is something to check, then hands the user straight to the result.
   */
  function bindCheckDue() {
    var btn = $("checkDueBtn");
    var card = $("zakatCard");
    if (!btn) return;

    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      render();
      scrollToNode(card, 12);
      if (card) {
        card.classList.remove("is-flashing");
        void card.offsetWidth;
        card.classList.add("is-flashing");
        setTimeout(function () {
          card.classList.remove("is-flashing");
        }, 1000);
        if (card.hasAttribute("tabindex")) card.focus({ preventScroll: true });
      }
      flashText($("zakatAmount"));
      var hint = $("checkDueHint");
      if (hint) hint.hidden = true;
    });
  }

  /** Enable the check button as soon as any asset weighs in. */
  function syncCheckDue(summary) {
    var btn = $("checkDueBtn");
    var hint = $("checkDueHint");
    if (!btn) return;
    var ready = Boolean(summary) && summary.netAssets > 0;
    btn.disabled = !ready;
    if (hint) hint.hidden = ready;
  }

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
          showToast("Currency rates updated, but metal prices are unavailable. Enter them manually.", {
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
    if (!value) return "-";
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
      setText(amount, hasInput ? fmtCompact(summary.zakat) : "-");
    }
    syncCheckDue(summary);

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
        text = "Add your assets in the cards above to see your nisab position.";
      } else if (!summary.hasNisabPrice) {
        text = "Metal price missing. Add a gold or silver price to check the nisab.";
      } else if (summary.due) {
        text = "Above nisab by " + fmtCompact(summary.netAssets - summary.nisabValue) + " · Zakat is due.";
      } else {
        text = pct + "% of nisab · " + fmtCompact(summary.nisabValue - summary.netAssets) + " short.";
      }
      setText(meterLabel, text);
    }

    setText($("netAssetsValue"), summary.netAssets > 0 ? fmtCompact(summary.netAssets) : "-");
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
    setText($("goldValueText"), state.gold.value > 0 ? fmt(state.gold.value) : "-");
    setText($("silverValueText"), state.silver.value > 0 ? fmt(state.silver.value) : "-");

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
    setText($("breakdownTotal"), base > 0 ? fmtCompact(base) + " total" : "-");
  }

  /* ------------------------------------------------------------------ */
  /* Currency picker + favourites                                       */
  /* ------------------------------------------------------------------ */

  function renderFavPills() {
    /* Favourite pills were removed. Currency is chosen from the header. */
  }

  function renderCurrencyList(query) {
    var list = $("currencyList");
    if (!list) return;
    var matches = CS.searchCurrencies(query);
    var favorites = CS.getFavorites();
    list.textContent = "";

    if (!matches.length) {
      var empty = document.createElement("p");
      empty.className = "picker-empty";
      empty.textContent = "No currency matches “" + String(query).trim() + "”.";
      list.appendChild(empty);
      return;
    }

    var pinned = matches.filter(function (entry) {
      return favorites.indexOf(entry.code) !== -1;
    });
    var others = matches.filter(function (entry) {
      return favorites.indexOf(entry.code) === -1;
    });

    var addSection = function (label, entries) {
      if (!entries.length) return;
      var heading = document.createElement("p");
      heading.className = "picker-section-label";
      heading.textContent = label;
      list.appendChild(heading);
      entries.forEach(function (entry) {
        list.appendChild(currencyRow(entry));
      });
    };

    addSection("Pinned", pinned);
    addSection(query ? "Results" : "All currencies", others);
  }

  function currencyRow(entry) {
    var row = document.createElement("div");
    row.className = "currency-option";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", entry.code === state.currency ? "true" : "false");
    row.setAttribute("aria-checked", entry.code === state.currency ? "true" : "false");
    row.setAttribute("tabindex", "0");
    row.dataset.currency = entry.code;

    var flag = document.createElement("span");
    flag.className = "currency-option__flag";
    flag.setAttribute("aria-hidden", "true");
    flag.textContent = CS.flagFor(entry.country);

    var codeNode = document.createElement("span");
    codeNode.className = "currency-option__code";
    codeNode.textContent = entry.code;

    var nameNode = document.createElement("span");
    nameNode.className = "currency-option__name";
    nameNode.textContent = entry.name;

    var symbolNode = document.createElement("span");
    symbolNode.className = "currency-option__symbol";
    symbolNode.setAttribute("aria-hidden", "true");
    symbolNode.textContent = entry.symbol;

    var star = document.createElement("button");
    star.type = "button";
    star.className = "currency-option__star";
    star.setAttribute(
      "aria-pressed",
      CS.getFavorites().indexOf(entry.code) !== -1 ? "true" : "false",
    );
    star.setAttribute("aria-label", "Pin " + entry.code + " to favourites");
    var starIcon = document.createElement("span");
    starIcon.className = "material-symbols-outlined";
    starIcon.setAttribute("aria-hidden", "true");
    starIcon.textContent = "star";
    star.appendChild(starIcon);

    row.appendChild(flag);
    row.appendChild(codeNode);
    row.appendChild(nameNode);
    row.appendChild(symbolNode);
    row.appendChild(star);

    row.addEventListener("click", function (event) {
      if (event.target.closest(".currency-option__star")) return;
      changeCurrency(entry.code);
    });
    row.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        changeCurrency(entry.code);
      }
    });
    star.addEventListener("click", function (event) {
      event.stopPropagation();
      togglePin(entry.code, star);
    });

    return row;
  }

  function togglePin(code, star) {
    var result = CS.toggleFavorite(code);
    var pinnedNow = result.list.indexOf(code) !== -1;
    if (star) {
      star.setAttribute("aria-pressed", pinnedNow ? "true" : "false");
      flashClass(star, "animate-saved-menu-pulse");
    }
    refreshPickerViews();
    var evicted = result.evicted ? " (" + result.evicted + " unpinned)" : "";
    showToast(
      pinnedNow ? code + " pinned to your currencies" + evicted : code + " removed from favourites",
      {
        duration: 3200,
        onAction: function () {
          CS.toggleFavorite(code);
          if (result.evicted) CS.toggleFavorite(result.evicted);
          refreshPickerViews();
          render();
        },
      },
    );
  }

  function refreshPickerViews() {
    renderFavPills();
    var search = $("currencySearch");
    renderCurrencyList(search ? search.value : "");
    syncPinToggle();
  }

  function syncPinToggle() {
    var toggle = $("pinCurrentToggle");
    if (!toggle) return;
    toggle.checked = CS.getFavorites().indexOf(state.currency) !== -1;
  }

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
    var withCode = $("summaryWithCode") ? $("summaryWithCode").checked : false;
    return Engine.toSummaryText(
      summary,
      function (value) {
        return CS.formatMoney(value, state.currency);
      },
      { withCode: withCode },
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

  /* ------------------------------------------------------------------ */
  /* WhatsApp receipt sharing                                           */
  /* ------------------------------------------------------------------ */

  /* Privacy choice lives in memory only (audit forbids new storage keys). */
  var shareMode = "itemized";
  var shareBusy = false;

  /** Format a category value for the receipt; em dash when nothing is entered. */
  function receiptMoney(value, summary) {
    if (!(value > 0)) return "-";
    return CS.formatMoney(value, state.currency, { decimals: summary.zakat >= 1000 ? 0 : 2 });
  }

  function receiptDate() {
    try {
      return new Date().toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "";
    }
  }

  /** Rebuild every field of the receipt. Pure DOM writes, no state changes. */
  function renderShareCard() {
    var summary = Engine.compute(state);
    var itemized = shareMode === "itemized";

    setText($("shareCardDate"), receiptDate());
    setText($("shareCardCurrency"), state.currency);
    setText($("shareCardStandard"), (summary.standard === "gold" ? "Gold" : "Silver") + " nisab");
    setText(
      $("shareCardNisabStandard"),
      summary.standard === "gold" ? "gold, 87.48 g" : "silver, 612.36 g",
    );

    var rows = $("shareCardBreakdown");
    if (rows) rows.hidden = !itemized;
    setText($("shareCardCash"), receiptMoney(summary.cash, summary));
    setText($("shareCardMetals"), receiptMoney(summary.metals, summary));
    setText($("shareCardInvestments"), receiptMoney(summary.investments, summary));
    setText($("shareCardBusiness"), receiptMoney(summary.business, summary));
    setText(
      $("shareCardDebts"),
      summary.debts > 0 ? "-" + CS.formatMoney(summary.debts, state.currency, { decimals: 0 }) : "-",
    );
    setText($("shareCardNet"), receiptMoney(summary.netAssets, summary));
    show($("shareCardTotalsNote"), !itemized);

    setText($("shareCardZakat"), summary.due ? CS.formatMoney(summary.zakat, state.currency) : "-");
    setText($("shareCardNisab"), summary.hasNisabPrice ? fmt(summary.nisabValue) : "-");

    var status;
    if (summary.netAssets <= 0) {
      status = "No assets entered yet";
    } else if (!summary.hasNisabPrice) {
      status = "Metal price missing, nisab not checked";
    } else if (summary.due) {
      status = "Above nisab · Zakat is due";
    } else {
      status = "Below nisab · no Zakat due";
    }
    setText($("shareCardStatus"), status);

    return summary;
  }

  function syncShareTrigger() {
    /* The receipt opens from the action-row icon, which stays available. */
  }

  function setShareStatus(message, isError) {
    var node = $("whatsappShareStatus");
    if (!node) return;
    node.textContent = message || "";
    if (isError) node.setAttribute("data-state", "error");
    else node.removeAttribute("data-state");
  }

  function setShareBusy(busy) {
    shareBusy = busy;
    var send = $("whatsappShareSend");
    if (send) send.disabled = busy;
    setText($("whatsappShareSendLabel"), busy ? "Preparing…" : "Generate & share");
  }

  /**
   * Text handed to WhatsApp. Mirrors summaryForShare() but honours the privacy
   * choice made in the preview: "totals" drops every asset figure.
   */
  function shareTextForMode() {
    if (shareMode !== "totals") return summaryForShare();
    var summary = Engine.compute(state);
    var due;
    if (summary.due) {
      due = "Zakat due (2.5%): " + fmt(summary.zakat);
    } else if (summary.netAssets > 0) {
      due = "Zakat due (2.5%): none, net wealth is below the nisab.";
    } else {
      due = "Zakat due (2.5%): none, no assets entered.";
    }
    return [
      "ZakatDay. Zakat summary",
      "",
      "Currency: " + state.currency,
      "Nisab standard: " + summary.standardLabel,
      "Nisab threshold: " +
        (summary.hasNisabPrice ? fmt(summary.nisabValue) : "metal price not set"),
      due,
      "",
      "Asset figures hidden by choice.",
      "Calculated at zakatday.cc. Estimate only, verify with a qualified scholar.",
    ].join("\n");
  }


  function fillShareTextarea(text) {
    var pre = $("summaryText");
    if (pre) pre.textContent = text;
  }

  /** Resolve html2canvas if the pinned CDN script loaded; otherwise re-load it. */
  function loadHtml2Canvas() {
    if (typeof window.html2canvas === "function") return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve) {
      var script = document.createElement("script");
      var settled = false;
      var done = function (value) {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.crossOrigin = "anonymous";
      script.addEventListener("load", function () {
        done(typeof window.html2canvas === "function" ? window.html2canvas : null);
      });
      script.addEventListener("error", function () {
        done(null);
      });
      document.head.appendChild(script);
      setTimeout(function () {
        done(typeof window.html2canvas === "function" ? window.html2canvas : null);
      }, 7000);
    });
  }

  function captureReceipt() {
    var node = $("zakatShareCaptureRoot");
    if (!node) return Promise.resolve(null);
    return loadHtml2Canvas().then(function (h2c) {
      if (!h2c) return null;
      return h2c(node, {
        backgroundColor: readTokenColor("--white"),
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        logging: false,
        useCORS: true,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    });
  }

  function canvasToPngFile(canvas) {
    return new Promise(function (resolve) {
      if (!canvas || typeof canvas.toBlob !== "function") {
        resolve(null);
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) {
          resolve(null);
          return;
        }
        var name = "zakatday-zakat-" + new Date().toISOString().slice(0, 10) + ".png";
        try {
          resolve(new File([blob], name, { type: "image/png" }));
        } catch (error) {
          resolve(null);
        }
      }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
  }

  /**
   * File sharing via the Web Share API; resolves "unsupported" when unavailable.
   * The caption is omitted on purpose: sharing a file together with text makes
   * macOS and Chrome copy the same PNG onto the clipboard twice.
   */
  function webShareFiles(file) {
    if (!navigator.share || !navigator.canShare) return Promise.resolve("unsupported");
    if (!navigator.canShare({ files: [file] })) return Promise.resolve("unsupported");
    return navigator
      .share({ files: [file] })
      .then(function () {
        return "shared";
      })
      .catch(function (error) {
        return error && error.name === "AbortError" ? "cancelled" : "failed";
      });
  }

  function openWhatsAppWith(text) {
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
  }

  function closeShare() {
    closeModal($("whatsappShareModal"));
  }

  /**
   * Generate the PNG receipt, hand it to the OS share sheet (which lists
   * WhatsApp), then open WhatsApp with the text. Any failure degrades to text.
   */
  function runShare() {
    if (shareBusy) return;
    setShareBusy(true);
    setShareStatus("Building your receipt image…");

    var summary = renderShareCard();
    var text = shareTextForMode();

    var finish = function (message, isError) {
      syncShareTrigger(summary);
      setShareStatus(message, isError);
    };

    var goText = function (message) {
      setShareBusy(false);
      openWhatsAppWith(text);
      finish(message, false);
      setTimeout(closeShare, 500);
    };

    captureReceipt()
      .then(function (canvas) {
        if (!canvas) return "no-capture";
        return canvasToPngFile(canvas).then(function (file) {
          if (!file) return "no-file";
          return webShareFiles(file).then(function (outcome) {
            if (outcome === "shared" || outcome === "cancelled") return outcome;
            downloadBlob(file, file.name);
            return "downloaded";
          });
        });
      })
      .then(function (outcome) {
        if (outcome === "shared") {
          setShareBusy(false);
          finish("Receipt image handed to WhatsApp.", false);
          setTimeout(closeShare, 500);
        } else if (outcome === "cancelled") {
          setShareBusy(false);
          finish("Share cancelled. Nothing was sent.", false);
        } else if (outcome === "downloaded") {
          goText("Receipt PNG saved to your device. Attach it in WhatsApp, then send the text.");
        } else if (outcome === "no-file") {
          goText("Could not encode the image. Sent the text summary instead.");
        } else {
          goText("Image generator unavailable. Sent the text summary instead.");
        }
      })
      .catch(function () {
        goText("Could not build the image. Sent the text summary instead.");
      });
  }

  function openWhatsAppShare() {
    var modal = $("whatsappShareModal");
    if (!modal) return;
    var itemized = $("shareModeItemized");
    if (itemized) itemized.checked = shareMode !== "totals";
    syncShareTrigger(Engine.compute(state));
    renderShareCard();
    setShareStatus("");
    openModal(modal);
  }

  function bindWhatsAppShare() {
    var trigger = $("whatsappBtn");
    if (trigger) {
      trigger.addEventListener("click", function () {
        openWhatsAppShare();
      });
    }

    each("[data-whatsapp-share-close]", function (node) {
      node.addEventListener("click", function () {
        var modal = $("whatsappShareModal");
        if (modal) closeModal(modal);
      });
    });

    each('input[name="sharePrivacy"]', function (node) {
      node.addEventListener("change", function () {
        shareMode = node.value === "totals" ? "totals" : "itemized";
        renderShareCard();
      });
    });

    var send = $("whatsappShareSend");
    if (send) {
      send.addEventListener("click", function () {
        runShare();
      });
    }
  }

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

    var withCode = $("summaryWithCode");
    if (withCode) {
      withCode.addEventListener("change", function () {
        var pre = $("summaryText");
        if (pre) pre.textContent = summaryForShare();
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
    bindAboutModal();
    bindCheckDue();
    bindSheetsAndModals();
    bindShare();
    bindWhatsAppShare();
    bindKeyboard();

    var year = $("footerYear");
    if (year) year.textContent = String(new Date().getFullYear());

    renderFavPills();
    syncPinToggle();
    render();
    revealOnScroll();

    refreshRates({ announce: false, force: true }).then(function () {
      if (!live.metals) {
        showToast("Live rates unavailable. Tap Edit to enter gold and silver prices.", {
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
