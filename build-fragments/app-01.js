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
