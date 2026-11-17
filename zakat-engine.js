/**
 * ZakatDay calculation engine — pure functions only.
 *
 * No DOM, no storage, no network: the same code powers the UI and the tests.
 * Amounts are held in the user's display currency; metal weights stay in grams
 * and tola so the same numbers can be re-priced when the currency or the
 * gold/silver rates change.
 *
 * Thresholds follow the widely used Hanafi figures from the previous site.
 */
(function () {
  "use strict";

  var GRAMS = {
    silverNisab: 612.36,
    goldNisab: 87.48,
    tola: 11.6638,
    troyOunce: 31.1034768,
  };

  var ZAKAT_RATE = 0.025;

  /** Nisab per the silver (majority, more beneficial to the poor) or gold standard. */
  var NISAB = {
    silver: { grams: GRAMS.silverNisab, label: "Silver (612.36 g)" },
    gold: { grams: GRAMS.goldNisab, label: "Gold (87.48 g)" },
  };

  var KARATS = [
    { karat: 24, purity: 1 },
    { karat: 22, purity: 22 / 24 },
    { karat: 21, purity: 21 / 24 },
    { karat: 18, purity: 18 / 24 },
    { karat: 14, purity: 14 / 24 },
  ];

  function toNumber(value) {
    var numeric = typeof value === "number" ? value : parseFloat(value);
    if (!isFinite(numeric) || numeric < 0) return 0;
    return numeric;
  }

  /** Fresh (zeroed) state. `standard` defaults to the silver standard. */
  function createState(options) {
    var opts = options || {};
    return {
      standard: opts.standard === "gold" ? "gold" : "silver",
      currency: opts.currency || "USD",
      cash: { held: 0, bank: 0, digital: 0 },
      gold: { value: 0, grams: 0 },
      silver: { value: 0, grams: 0 },
      investments: { shares: 0, crypto: 0, retirement: 0 },
      business: { stock: 0, receivables: 0 },
      debts: { payable: 0 },
      rates: {
        /** Price of 24k gold per gram in `currency`. */
        goldPerGram: toNumber(opts.goldPerGram),
        /** Price of fine silver per gram in `currency`. */
        silverPerGram: toNumber(opts.silverPerGram),
        goldManual: Boolean(opts.goldManual),
        silverManual: Boolean(opts.silverManual),
      },
    };
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function sumValues(object) {
    var total = 0;
    Object.keys(object || {}).forEach(function (key) {
      total += toNumber(object[key]);
    });
    return total;
  }

  /** Full breakdown for the given state. */
  function compute(state) {
    var s = state || createState();
    var cash = sumValues(s.cash);
    var goldValue = toNumber(s.gold && s.gold.value);
    var silverValue = toNumber(s.silver && s.silver.value);
    var investments = sumValues(s.investments);
    var business = sumValues(s.business);
    var debts = sumValues(s.debts);

    var metals = goldValue + silverValue;
    var grossAssets = cash + metals + investments + business;
    var netAssets = grossAssets - debts;
    if (netAssets < 0) netAssets = 0;

    var standard = s.standard === "gold" ? "gold" : "silver";
    var rates = s.rates || {};
    var perGram =
      standard === "gold" ? toNumber(rates.goldPerGram) : toNumber(rates.silverPerGram);
    var nisabGrams = NISAB[standard].grams;
    var nisabValue = perGram * nisabGrams;

    /* Without a metal price the threshold is unknown: treat any asset as liable. */
    var hasNisabPrice = perGram > 0;
    var meetsNisab = hasNisabPrice ? netAssets >= nisabValue : netAssets > 0;
    var due = netAssets > 0 && meetsNisab;

    var progress = 0;
    if (hasNisabPrice) {
      progress = Math.min(100, (netAssets / nisabValue) * 100);
    } else if (netAssets > 0) {
      progress = 100;
    }

    return {
      currency: s.currency || "USD",
      standard: standard,
      standardLabel: NISAB[standard].label,
      cash: cash,
      goldValue: goldValue,
      silverValue: silverValue,
      metals: metals,
      investments: investments,
      business: business,
      debts: debts,
      grossAssets: grossAssets,
      netAssets: netAssets,
      nisabGrams: nisabGrams,
      nisabPricePerGram: perGram,
      nisabValue: nisabValue,
      hasNisabPrice: hasNisabPrice,
      meetsNisab: meetsNisab,
      due: due,
      progress: progress,
      zakatRate: ZAKAT_RATE,
      zakat: due ? netAssets * ZAKAT_RATE : 0,
      categories: {
        cash: cash,
        metals: metals,
        investments: investments,
        business: business,
        debts: debts,
      },
    };
  }

  /**
   * Convert every money field from one currency to another using USD
   * cross-rates. Returns a NEW state; the input is never mutated. Metal prices
   * the user typed manually (or metal prices that are missing) are kept as-is
   * apart from the currency label, so nothing is silently zeroed.
   */
  function reconvert(state, targetCurrency, rates, convertFn) {
    var next = cloneState(state);
    var from = state.currency || "USD";
    var to = String(targetCurrency || "USD").toUpperCase();
    next.currency = to;
    if (from === to || !rates || typeof convertFn !== "function") return next;

    var convert = function (amount) {
      var result = convertFn(amount, from, to, rates);
      if (result === null || !isFinite(result)) return amount;
      return result;
    };

    ["cash", "investments", "business", "debts"].forEach(function (group) {
      Object.keys(next[group] || {}).forEach(function (key) {
        next[group][key] = convert(next[group][key]);
      });
    });
    next.gold.value = convert(next.gold.value);
    next.silver.value = convert(next.silver.value);
    next.rates.goldPerGram = convert(next.rates.goldPerGram);
    next.rates.silverPerGram = convert(next.rates.silverPerGram);
    next.rates.goldManual = false;
    next.rates.silverManual = false;
    return next;
  }

  /** value = grams × purity × price per gram */
  function metalValue(grams, purity, pricePerGram) {
    return toNumber(grams) * (purity === undefined ? 1 : purity) * toNumber(pricePerGram);
  }

  function gramsFromTola(tola) {
    return toNumber(tola) * GRAMS.tola;
  }

  function gramsFromOunce(ounces) {
    return toNumber(ounces) * GRAMS.troyOunce;
  }

  /** Category keys with a non-zero total, in breakdown-bar order. */
  function activeCategories(summary) {
    return ["cash", "metals", "investments", "business", "debts"].filter(
      function (key) {
        return summary.categories[key] > 0;
      },
    );
  }


  /**
   * Plain-text summary for WhatsApp / clipboard sharing.
   * `format` should be (amount) => string including the currency symbol.
   */
  function toSummaryText(summary, format, options) {
    var opts = options || {};
    var fmt =
      typeof format === "function"
        ? format
        : function (value) {
            return String(Math.round(value * 100) / 100);
          };
    var money = function (value) {
      return opts.withCode ? fmt(value) + " " + summary.currency : fmt(value);
    };
    var lines = [];

    lines.push("ZakatDay — Zakat summary");
    lines.push("Currency: " + summary.currency);
    lines.push("Nisab standard: " + summary.standardLabel);
    lines.push("");
    lines.push("Zakatable assets");
    if (summary.cash > 0) lines.push("  • Cash & bank: " + money(summary.cash));
    if (summary.metals > 0) {
      lines.push(
        "  • Gold: " + money(summary.goldValue) +
          " · Silver: " + money(summary.silverValue),
      );
    }
    if (summary.investments > 0) {
      lines.push("  • Investments: " + money(summary.investments));
    }
    if (summary.business > 0) {
      lines.push("  • Business assets: " + money(summary.business));
    }
    lines.push("  • Gross assets: " + money(summary.grossAssets));
    if (summary.debts > 0) {
      lines.push("  • Less debts due: −" + money(summary.debts));
    }
    lines.push("  • Net zakatable: " + money(summary.netAssets));
    lines.push("");
    lines.push(
      summary.hasNisabPrice
        ? "Nisab threshold: " + money(summary.nisabValue)
        : "Nisab threshold: enter current gold/silver prices",
    );
    lines.push(
      summary.due
        ? "Status: above nisab — Zakat is due (2.5%)"
        : summary.netAssets > 0
          ? "Status: below nisab — no Zakat due"
          : "Status: no zakatable assets entered",
    );
    lines.push("");
    lines.push("ZAKAT DUE (2.5%): " + money(summary.zakat));
    lines.push("");
    lines.push("Estimate only — please verify with a qualified scholar.");
    lines.push("Calculated with ZakatDay · www.zakatday.cc");
    return lines.join("\n");
  }

  window.ZakatEngine = {
    GRAMS: GRAMS,
    NISAB: NISAB,
    KARATS: KARATS,
    ZAKAT_RATE: ZAKAT_RATE,
    createState: createState,
    cloneState: cloneState,
    compute: compute,
    reconvert: reconvert,
    metalValue: metalValue,
    gramsFromTola: gramsFromTola,
    gramsFromOunce: gramsFromOunce,
    activeCategories: activeCategories,
    toSummaryText: toSummaryText,
    toNumber: toNumber,
  };
})();

