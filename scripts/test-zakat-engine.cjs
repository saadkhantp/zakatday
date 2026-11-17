/**
 * Sandbox smoke tests for currency-service.js (no network, no DOM).
 * Run: npm run test:engine
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
let failures = 0;

function check(label, actual, expected) {
  const ok =
    typeof expected === "function"
      ? expected(actual)
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log("  ok   " + label);
  } else {
    failures += 1;
    console.log("  FAIL " + label + " → got " + JSON.stringify(actual));
  }
}

function makeContext(overrides) {
  const store = {};
  const ctx = {
    window: {},
    Intl,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    isFinite,
    parseFloat,
    Promise,
    setTimeout,
    clearTimeout,
    AbortController,
    console,
    navigator: { language: "en-PK", languages: ["en-PK", "en"] },
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(store, key)
          ? store[key]
          : null;
      },
      setItem(key, value) {
        store[key] = String(value);
      },
      removeItem(key) {
        delete store[key];
      },
    },
  };
  ctx.fetch = async () => {
    throw new Error("offline");
  };
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "currency-service.js"), "utf8"), ctx);
  return { ctx, store, CS: ctx.window.CurrencyService };
}

function makeContext2(overrides) {
  const ctx = {
    window: {},
    Intl,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    isFinite,
    parseFloat,
    console,
  };
  Object.assign(ctx, overrides || {});
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "zakat-engine.js"), "utf8"), ctx);
  return { ctx, ZakatEngine: ctx.window.ZakatEngine };
}

console.log("currency-service");
{
  const { CS, store } = makeContext();
  check("catalogue has 150+ currencies", CS.LIST.length, (n) => n >= 150);
  check("USD/GBP/PKR/AED/SAR/EUR all known", 
    ["USD", "GBP", "PKR", "AED", "SAR", "EUR"].every((c) => CS.isKnown(c)), true);
  check("locale PK → PKR", CS.guessCurrencyFromLocale(), "PKR");
  check("favourites seeded with locale currency first", CS.getFavorites()[0], "PKR");
  check("favourite cap is 6", CS.getFavorites().length, 6);
  check("storage key written for favourites", Object.keys(store), ["zakatday-favorites"]);

  const payload = {
    date: "2026-11-17",
    usd: { pkr: 280, gbp: 0.78, xau: 0.000258, xag: 0.021 },
  };
  const normalised = CS.normaliseRates(payload, "jsdelivr");
  check("normaliseRates upper-cases keys", normalised.rates.PKR, 280);
  check("normaliseRates keeps USD=1", normalised.rates.USD, 1);
  check("normaliseRates keeps date", normalised.date, "2026-11-17");

  const erShape = CS.normaliseRates({ rates: { PKR: 280, USD: 1 } }, "er-api");
  check("er-api shapenormalises", erShape.rates.PKR, 280);

  const metals = CS.metalsFromPayload(payload, "jsdelivr");
  check("gold per oz ≈ 3876", Math.round(metals.goldUsdPerOz), 3876);
  check("silver per oz ≈ 47.6", Math.round(metals.silverUsdPerOz), 48);

  check("convert USD→PKR", CS.convert(100, "USD", "PKR", normalised.rates), 28000);
  check("convert same currency is identity", CS.convert(55, "USD", "USD", null), 55);
  check("convert missing rate → null", CS.convert(10, "USD", "ANG", normalised.rates), null);
  check("convert GBP→PKR cross-rate", Math.round(CS.convert(100, "GBP", "PKR", normalised.rates)), 35897);
  check("parseAmount strips separators", CS.parseAmount("1,234.56"), 1234.56);
  check("parseAmount rejects text", CS.parseAmount("abc"), 0);
  check("parseAmount rejects negative", CS.parseAmount("-5"), 0);
  check("formatMoney PKR uses no decimals", CS.formatMoney(1234567, "PKR"), (s) => !/\.\d/.test(s));
  check("formatMoney JPY uses no decimals", CS.formatMoney(1234567, "JPY"), (s) => !/\.\d/.test(s));
  check("flagFor PK", CS.flagFor("PK"), "🇵🇰");
  check("flagFor EU", CS.flagFor("EU"), "🇪🇺");
  check("search finds PKR by code prefix", CS.searchCurrencies("pk")[0].code, "PKR");
  check("search finds by name", CS.searchCurrencies("riyal").length, (n) => n >= 2);

  const capList = CS.getFavorites();
  CS.saveFavorites(capList.slice(0, 5));
  const pinTarget = ["JPY", "KRW", "CAD", "CNY"].find(
    (code) => capList.indexOf(code) === -1,
  );
  const pinned = CS.toggleFavorite(pinTarget);
  check("pin adds currency", pinned.list.length, 6);
  check("pin at cap evicts oldest pin", CS.toggleFavorite("CHF").evicted, pinTarget);
  check("unpin removes currency", CS.toggleFavorite("CHF").list.indexOf("CHF"), -1);
}

(async () => {
  console.log("zakat-engine");
  const { ZakatEngine: E } = makeContext2();

  const empty = E.createState();
  check("default standard is silver", empty.standard, "silver");
  check("silver nisab is 612.36 g", E.NISAB.silver.grams, 612.36);
  check("gold nisab is 87.48 g", E.NISAB.gold.grams, 87.48);
  check("tola is 11.6638 g", E.GRAMS.tola, 11.6638);
  check("zakat rate is 2.5%", E.ZAKAT_RATE, 0.025);

  const emptySummary = E.compute(empty);
  check("empty state has no zakat", emptySummary.zakat, 0);
  check("empty state is not due", emptySummary.due, false);
  check("empty state progress is 0", emptySummary.progress, 0);

  /* Gold price 100/gram → silver nisab 61,236; gold nisab 8,748 */
  const state = E.createState({ goldPerGram: 100, silverPerGram: 1.2 });
  state.cash = { held: 5000, bank: 20000, digital: 1000 };
  state.gold = { value: 30000, grams: 300 };
  state.investments = { shares: 4000, crypto: 0, retirement: 2000 };
  state.business = { stock: 3000, receivables: 1000 };
  state.debts = { payable: 4240 };
  const s1 = E.compute(state);
  check("cash sums", s1.cash, 26000);
  check("metals sum", s1.metals, 30000);
  check("investments sum", s1.investments, 6000);
  check("business sum", s1.business, 4000);
  check("gross assets", s1.grossAssets, 66000);
  check("net assets", s1.netAssets, 61760);
  check("silver nisab value", s1.nisabValue, 612.36 * 1.2);
  check("above nisab → due", s1.due, true);
  check("zakat is 2.5% of net", Math.round(s1.zakat * 100) / 100, 1544);
  check("progress capped at 100", s1.progress, 100);

  state.standard = "gold";
  const s2 = E.compute(state);
  check("gold nisab value", s2.nisabValue, 100 * 87.48);
  check("gold standard still above nisab", s2.due, true);

  const belowState = E.createState({ goldPerGram: 100, silverPerGram: 1.2 });
  belowState.cash.held = 100;
  belowState.debts.payable = 5000;
  const s3 = E.compute(belowState);
  check("debts cannot make net negative", s3.netAssets, 0);
  check("no zakat when nothing net", s3.zakat, 0);

  const noPrice = E.createState();
  noPrice.cash.held = 2500;
  const s4 = E.compute(noPrice);
  check("missing metal price: still liable", s4.due, true);
  check("missing metal price: progress 100", s4.progress, 100);
  check("missing metal price: zakat 2.5%", s4.zakat, 62.5);

  /* reconvert keeps weights + totals; state is not mutated */
  const { CS } = makeContext();
  const rates = { USD: 1, PKR: 280 };
  const converted = E.reconvert(state, "PKR", rates, CS.convert);
  check("reconvert sets currency", converted.currency, "PKR");
  check("reconvert scales cash", converted.cash.bank, 20000 * 280);
  check("reconvert leaves original untouched", state.currency, "USD");
  check("reconvert scales manual metal price", converted.rates.goldPerGram, 28000);
  const reconSummary = E.compute(converted);
  check("reconvert preserves nisab ratio", Math.round(reconSummary.nisabValue), Math.round(s2.nisabValue * 280));
  check("reconvert without rates only relabels", E.reconvert(state, "EUR", null, null).cash.bank, 20000);

  check("metalValue applies purity", E.metalValue(100, 22 / 24, 100), (100 * 22 * 100) / 24);
  check("gramsFromTola", Math.round(E.gramsFromTola(5) * 1000) / 1000, 58.319);
  check("gramsFromOunce", Math.round(E.gramsFromOunce(1) * 1000) / 1000, 31.103);
  check("activeCategories order", E.activeCategories(s1), ["cash", "metals", "investments", "business", "debts"]);

  const text = E.toSummaryText(s1, (v) => "Rs " + Math.round(v));
  check("summary mentions zakat due", text.indexOf("ZAKAT DUE (2.5%): Rs 1544") !== -1, true);
  check("summary includes standard", text.indexOf("Silver (612.36 g)") !== -1, true);
  check("summary includes disclaimer", text.indexOf("verify with a qualified scholar") !== -1, true);
  const lowState = E.createState({ goldPerGram: 100, silverPerGram: 1.2 });
  lowState.cash.held = 500;
  const lowSummary = E.compute(lowState);
  check("below nisab is not due", lowSummary.due, false);
  check("below nisab zakat is 0", lowSummary.zakat, 0);
  check("below nisab progress is partial", lowSummary.progress < 100 && lowSummary.progress > 0, true);
  const belowText = E.toSummaryText(lowSummary, (v) => String(v));
  check("below-nisab summary says no zakat", belowText.indexOf("no Zakat due") !== -1, true);

  console.log("offline fallback");
  const { CS: OfflineCS } = makeContext();
  const offline = await OfflineCS.loadLiveRates();
  check("offline status fx", offline.status.fx, "error");
  check("offline status metals", offline.status.metals, "error");
  check("offline rates null (caller keeps manual rates)", offline.rates, null);

  console.log(failures === 0 ? "\nAll checks passed." : "\n" + failures + " check(s) failed.");
  process.exit(failures === 0 ? 0 : 1);
})();

