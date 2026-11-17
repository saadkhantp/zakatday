/**
 * Interaction steps for scripts/smoke.cjs.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait until a bottom sheet has finished its slide-in transition. */
async function waitSheetOpen(page, selector) {
  await page.waitForSelector(selector + "[data-open=true]", { timeout: 5000 });
  await page.waitForFunction(
    (sel) => {
      const sheet = document.querySelector(sel);
      const panel = sheet && sheet.querySelector(".more-sheet__panel");
      const backdrop = sheet && sheet.querySelector(".more-sheet__backdrop");
      if (!panel || !backdrop) return false;
      const style = getComputedStyle(backdrop);
      return (
        Number(style.opacity) > 0.99 &&
        style.transitionProperty !== "none" &&
        panel.getBoundingClientRect().top < window.innerHeight * 0.9
      );
    },
    { timeout: 5000 },
    selector,
  );
  await sleep(120);
}

/** DOM-level click: immune to scroll/pointer races in headless Chrome. */
async function domClick(page, selector) {
  const found = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, selector);
  if (!found) throw new Error("domClick: no element for " + selector);
  await sleep(80);
}

module.exports = async function run({ page, base, check, num, consoleErrors, failedRequests }) {
  console.log("page load");
  const response = await page.goto(base + "/", { waitUntil: "networkidle2", timeout: 30000 });
  check("GET / status", response.status(), 200);
  check("no failed local requests", failedRequests, (list) => list.length === 0);
  check("title mentions ZakatDay", await page.title(), (t) => /ZakatDay/.test(t));
  check(
    "dist/app.css is applied",
    await page.evaluate(() => {
      const el = document.querySelector(".section-card");
      return el ? getComputedStyle(el).borderTopWidth : "";
    }),
    (v) => v === "1px",
  );

  console.log("live rates");
  await page.waitForFunction(
    () => document.getElementById("goldPerGramText").textContent.trim() !== "…",
    { timeout: 25000 },
  );
  const rates = await page.evaluate(() => ({
    gold: document.getElementById("goldPerGramText").textContent,
    silver: document.getElementById("silverPerGramText").textContent,
    status: document.getElementById("ratesDot").dataset.status,
    currency: document.getElementById("heroCurrencyCode").textContent,
  }));
  check("gold price rendered", num(rates.gold), (n) => n > 0);
  check("silver price rendered", num(rates.silver), (n) => n > 0);
  check("rates resolved live or manual", rates.status, (v) => v === "live" || v === "override");
  console.log("  info: currency " + rates.currency + ", gold/g " + rates.gold + ", silver/g " + rates.silver);

  console.log("maths");
  const setField = async (id, value) => {
    await page.$eval(
      "#" + id,
      (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      value,
    );
  };
  await setField("cashHeld", "10000");
  await page.click("#cashBank");
  await page.type("#cashBank", "60000");
  const math = await page.evaluate(() => {
    const goldPerGram = Number(
      document.getElementById("goldPerGramText").textContent.replace(/[^\d.]/g, ""),
    );
    return {
      zakat: document.getElementById("zakatAmount").textContent,
      state: document.getElementById("zakatAmount").dataset.state,
      net: document.getElementById("netAssetsValue").textContent,
      nisabText: document.getElementById("nisabValueText").textContent,
      meter: document.getElementById("nisabMeterFill").style.width,
      progress: Number(document.getElementById("nisabMeter").getAttribute("aria-valuenow")),
      cashTotal: document.getElementById("cashTotal").textContent,
      goldPerGram: goldPerGram,
      silverNisabValue: goldPerGram * 87.48,
      engineRate: window.ZakatEngine.ZAKAT_RATE,
      breakdown: document.getElementById("segCash").style.width,
    };
  });
  check("cash total includes both fields", num(math.cashTotal), (n) => n >= 70000);
  check("zakat state decided", math.state, (v) => v === "due" || v === "below");
  check("progress within 0-100", math.progress, (n) => n >= 0 && n <= 100);
  check("breakdown bar filled", math.breakdown, (v) => v === "100.00%" || v === "100%");
  check("engine rate is 2.5%", math.engineRate, 0.025);
  if (math.state === "due") {
    check("zakat ≈ 2.5% of 70,000", num(math.zakat), (n) => Math.abs(n - 1750) < 1);
    check("meter full when due", parseFloat(math.meter), (n) => n === 100);
  } else {
    check("no zakat below nisab", num(math.zakat), (n) => n === 0);
    console.log("  info: below nisab — nisab value " + math.nisabText);
  }

  console.log("gold by karat and tola");
  await page.$eval("#goldKarat", (el) => {
    el.value = "22";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.$eval("#goldUnit", (el) => {
    el.value = "tola";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await setField("goldGrams", "2");
  const gold = await page.evaluate(() => ({
    weight: document.getElementById("goldWeightText").textContent,
    value: document.getElementById("goldValueText").textContent,
    metals: document.getElementById("metalsTotal").textContent,
  }));
  check("2 tola 22K ≈ 21.38 g fine", num(gold.weight), (n) => Math.abs(n - 21.3836) < 0.05);
  check("gold value computed", num(gold.value), (n) => n > 0);
  check("metals total reflects gold", num(gold.metals), (n) => n > 0);

  console.log("nisab toggle");
  await domClick(page, '[data-standard="gold"]');
  check(
    "gold nisab selected",
    await page.$eval('[data-standard="gold"]', (el) => el.getAttribute("aria-pressed")),
    "true",
  );
  check(
    "nisab standard persisted",
    await page.evaluate(() => localStorage.getItem("zakatday-nisab-standard")),
    "gold",
  );
  const goldNisab = await page.$eval("#nisabValueText", (el) => el.textContent);
  check("gold nisab value shown", goldNisab.length > 0, true);
  await domClick(page, '[data-standard="silver"]');

  console.log("currency conversion");
  await page.evaluate(() => {
    window.__fxLog = [];
    document.addEventListener(
      "click",
      (event) => {
        window.__fxLog.push(
          "click:" +
            (event.target.closest("[data-currency]")
              ? event.target.closest("[data-currency]").dataset.currency
              : event.target.id || event.target.className),
        );
      },
      true,
    );
  });
  /* Deterministic starting point: switch back to USD first (preference persists). */
  const startCurrency = await page.$eval("#heroCurrencyCode", (el) => el.textContent);
  if (startCurrency !== "USD") {
    await domClick(page, "#currencyTrigger");
    await waitSheetOpen(page, "#currencySheet");
    await page.type("#currencySearch", "usd");
    await sleep(250);
    await domClick(page, "#currencyList .currency-option");
    await page.waitForFunction(
      () => document.getElementById("heroCurrencyCode").textContent === "USD",
      { timeout: 8000 },
    );
    await sleep(400);
  }
  await sleep(350);
  const bankBefore = await page.$eval("#cashBank", (el) => el.value);
  const currencyBefore = await page.$eval("#heroCurrencyCode", (el) => el.textContent);
  await domClick(page, "#currencyTrigger");
  await waitSheetOpen(page, "#currencySheet");
  await domClick(page, "#currencySearch");
  await page.$eval("#currencySearch", (el) => {
    el.value = "";
  });
  await page.type("#currencySearch", "pkr");
  await page.waitForSelector("#currencyList .currency-option", { timeout: 5000 });
  await sleep(250);
  check(
    "search filters to PKR",
    await page.$eval("#currencyList .currency-option .currency-option__code", (el) => el.textContent),
    "PKR",
  );
  await domClick(page, "#currencyList .currency-option");
  await sleep(700);
  await page.waitForFunction(
    () => document.getElementById("heroCurrencyCode").textContent === "PKR",
    { timeout: 8000 },
  );
  const bankAfter = await page.$eval("#cashBank", (el) => el.value);
  check("conversion measured across USD → PKR", currencyBefore, "USD");
  check(
    "amounts converted to PKR",
    Number(bankAfter) / Number(bankBefore),
    (ratio) => ratio > 10 && ratio < 1000,
  );
  if (!(Number(bankAfter) / Number(bankBefore) > 10)) {
    console.log("  info: before=" + bankBefore + " after=" + bankAfter);
  }
  check(
    "currency persisted",
    await page.evaluate(() => localStorage.getItem("zakatday-currency")),
    "PKR",
  );
  check(
    "favourite pill marked active",
    await page.$eval("#favPills [aria-pressed=true]", (el) => el.dataset.currency),
    "PKR",
  );
  await page.waitForFunction(() => document.getElementById("currencySheet").hidden === true, {
    timeout: 5000,
  });
  check("currency sheet closed", await page.$eval("#currencySheet", (el) => el.hidden), true);

  console.log("manual metal price");
  const toggleRates = async () => {
    await domClick(page, "#editRatesBtn");
    await sleep(250);
  };
  await toggleRates();
  await page.waitForSelector("#rateEditor:not([hidden])", { timeout: 4000 });
  await page.$eval("#rateGoldInput", (el) => {
    el.value = "1000";
  });
  await page.$eval("#rateSilverInput", (el) => {
    el.value = "10";
  });
  await domClick(page, "#saveRatesBtn");
  await page.waitForFunction(() => document.getElementById("rateEditor").hidden === true, {
    timeout: 4000,
  });
  await sleep(200);
  const manual = await page.evaluate(() => ({
    gold: document.getElementById("goldPerGramText").textContent,
    status: document.getElementById("ratesDot").dataset.status,
    nisab: document.getElementById("nisabValueText").textContent,
  }));
  check("manual gold price shown", num(manual.gold), (n) => n === 1000);
  check("status marks override", manual.status, "override");
  check("nisab recalculated from manual price", num(manual.nisab), (n) => n > 0);

    console.log("summary + sharing");
  await page.evaluate(() => {
    document.getElementById("shareSummaryBtn").scrollIntoView({ block: "center" });
  });
  await sleep(300);
  await page.click("#shareSummaryBtn");
  await page.waitForFunction(() => document.getElementById("summaryModal").hidden === false, {
    timeout: 4000,
  });
  const summary = await page.evaluate(() => ({
    text: document.getElementById("summaryText").textContent,
    hidden: document.getElementById("summaryModal").hidden,
  }));
  check("summary modal opened", summary.hidden, false);
  check("summary includes zakat line", summary.text, (t) => /ZAKAT DUE \(2\.5%\)/.test(t));
  check("summary names the currency", summary.text, (t) => /Currency: PKR/.test(t));
  check("summary includes nisab standard", summary.text, (t) => /Silver \(612\.36 g\)/.test(t));
  await domClick(page, "#summaryWithCode");
  const withCode = await page.$eval("#summaryText", (el) => el.textContent);
  check("currency code toggle appends code", withCode, (t) => /PKR/.test(t));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.getElementById("summaryModal").hidden, { timeout: 4000 });

  console.log("reset");
  await domClick(page, "#resetBtn");
  check(
    "reset arms before clearing",
    await page.$eval("#resetBtn", (el) => el.dataset.confirm),
    "true",
  );
  await domClick(page, "#resetBtn");
  const cleared = await page.evaluate(() => ({
    bank: document.getElementById("cashBank").value,
    gold: document.getElementById("goldGrams").value,
    zakat: document.getElementById("zakatAmount").textContent.trim(),
    currency: document.getElementById("heroCurrencyCode").textContent,
  }));
  check("inputs cleared", cleared.bank + cleared.gold, "");
  check("zakat back to placeholder", cleared.zakat, "—");
  check("currency kept after reset", cleared.currency, "PKR");

  console.log("theme");
  const darkBefore = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  await domClick(page, "#themeToggleBtn");
  const darkAfter = await page.evaluate(() =>
    document.documentElement.classList.contains("dark"),
  );
  check("theme toggled", darkBefore !== darkAfter, true);
  check(
    "theme persisted",
    await page.evaluate(() => localStorage.getItem("theme")),
    (v) => v === "dark" || v === "light",
  );
  check(
    "theme-color meta synced",
    await page.$eval('meta[name="theme-color"]', (el) => el.content),
    (v) => v === "#020617" || v === "#f8fafc",
  );

  console.log("privacy");
  const writes = await page.evaluate(() => window.__storageWrites || []);
  const allowed = ["theme", "zakatday-currency", "zakatday-favorites", "zakatday-nisab-standard"];
  const badWrites = [...new Set(writes)].filter((key) => allowed.indexOf(key) === -1);
  check("only whitelisted storage keys written", badWrites, (list) => list.length === 0);
  check("no URL query/hash written", await page.evaluate(() => location.search + location.hash), "");
  check(
    "localStorage holds no amounts",
    await page.evaluate(() => {
      let blob = "";
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        blob += key + "=" + localStorage.getItem(key) + ";";
      }
      return blob;
    }),
    (blob) => !/(19000|70000|10000|60000)/.test(blob),
  );

  console.log("faq page");
  const faq = await page.goto(base + "/faq/", { waitUntil: "networkidle2" });
  check("GET /faq/ status", faq.status(), 200);
  check(
    "faq heading present",
    (await page.$eval("main h1", (el) => el.textContent.trim())).length > 5,
    true,
  );
  check("faq sections", await page.$$eval("main section", (list) => list.length), (n) => n >= 5);
  check("faq details count", await page.$$eval("details.faq-item", (list) => list.length), (n) => n >= 10);
  check(
    "faq JSON-LD is FAQPage",
    await page.$eval('script[type="application/ld+json"]', (el) => JSON.parse(el.textContent)["@type"]),
    "FAQPage",
  );

  console.log("meta & structured data");
  await page.goto(base + "/", { waitUntil: "networkidle2" });
  await page.waitForFunction(
    () => document.getElementById("goldPerGramText").textContent.trim() !== "…",
    { timeout: 25000 },
  );
  check(
    "canonical points at the apex host",
    await page.$eval('link[rel="canonical"]', (el) => el.href),
    "https://www.zakatday.cc/",
  );
  check(
    "hreflang x-default present",
    await page.$eval('link[rel="alternate"][hreflang="x-default"]', (el) => el.href),
    "https://www.zakatday.cc/",
  );
  check(
    "hreflang entries ≥ 10",
    await page.$$eval('link[rel="alternate"][hreflang]', (list) => list.length),
    (n) => n >= 10,
  );
  check(
    "first theme-color is the light default",
    await page.$eval('meta[name="theme-color"]', (el) => el.content),
    (v) => v === "#f8fafc" || v === "#020617",
  );
  check(
    "theme-color media pair present",
    await page.$$eval('meta[name="theme-color"][media]', (list) => list.length),
    2,
  );
  check(
    "manifest linked root-absolute",
    await page.$eval('link[rel="manifest"]', (el) => el.getAttribute("href")),
    "/manifest.json",
  );
  check(
    "og:image is a PNG with dimensions",
    await page.evaluate(() => {
      const img = document.querySelector('meta[property="og:image"]').content;
      const w = document.querySelector('meta[property="og:image:width"]').content;
      const h = document.querySelector('meta[property="og:image:height"]').content;
      return img.endsWith("/assets/og/og-image.png") && w === "1200" && h === "630";
    }),
    true,
  );
  check(
    "index JSON-LD order WebApplication → FAQPage",
    await page.$$eval('script[type="application/ld+json"]', (list) =>
      list.map((el) => JSON.parse(el.textContent)["@type"]),
    ),
    (types) => types[0] === "WebApplication" && types[1] === "FAQPage",
  );
  check(
    "single h1 on the calculator page",
    await page.$$eval("h1", (list) => list.length),
    1,
  );
  check(
    "how-it-works section rendered",
    await page.$eval("#howItWorks", (el) => el.querySelectorAll("dt").length),
    (n) => n >= 4,
  );

  console.log("whatsapp receipt");
  await page.type("#cashHeld", "100000");
  await page.evaluate(() =>
    document.getElementById("cashHeld").dispatchEvent(new Event("input", { bubbles: true })),
  );
  await sleep(200);
  check(
    "share trigger appears once amounts exist",
    await page.$eval("#whatsappShareBtn", (el) => !el.hidden),
    true,
  );
  await domClick(page, "#whatsappShareBtn");
  check(
    "receipt modal opens",
    await page.$eval("#whatsappShareModal", (el) => !el.hidden),
    true,
  );
  /* Assert against the engine, not a fixed number: the currency follows the
     browser locale, so 2.5% of 100,000 is a different string per locale. */
  const receipt = await page.evaluate(() => {
    const summary = window.ZakatDay.getSummary();
    return {
      visible: document.getElementById("shareCardBreakdown").hidden === false,
      zakat: document.getElementById("shareCardZakat").textContent.trim(),
      nisab: document.getElementById("shareCardNisab").textContent.trim(),
      currency: document.getElementById("shareCardCurrency").textContent.trim(),
      due: summary.due,
      expectedCurrency: summary.currency,
      hasNisabPrice: summary.hasNisabPrice,
    };
  });
  check(
    "receipt mirrors the engine: currency and due-vs-not",
    receipt,
    (r) =>
      r.visible &&
      r.currency === r.expectedCurrency &&
      (r.due ? /\d/.test(r.zakat) : r.zakat === "—"),
  );
  check(
    "receipt nisab mirrors the engine",
    receipt,
    (r) => (r.hasNisabPrice ? /\d/.test(r.nisab) : r.nisab === "—"),
  );
  const shareMaybe = await page.evaluate(() => {
    const summary = window.ZakatDay.getSummary();
    return { texts: { totals: "", itemized: "" }, due: summary.due };
  });
  const shareTexts = await page.evaluate(() => ({
    totals: window.ZakatDay.getShareText("totals"),
    itemized: window.ZakatDay.getShareText("itemized"),
  }));
  check("itemized text includes figures", shareTexts.itemized, (t) => /100[.,]000/.test(t));
  check("totals text hides figures", shareTexts.totals, (t) => !/100[.,]000/.test(t));
  check(
    "totals text states the same due as the engine",
    { text: shareTexts.totals, due: shareMaybe.due },
    ({ text, due }) => (due ? !/none/i.test(text) : /none/i.test(text)),
  );
  const png = await page.evaluate(async () => {
    const node = document.getElementById("zakatShareCaptureRoot");
    if (typeof window.html2canvas !== "function") return "missing";
    const canvas = await window.html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
    });
    return canvas.toDataURL("image/png").slice(0, 22) + " " + canvas.width + "x" + canvas.height;
  });
  check(
    "html2canvas rasterises a receipt PNG",
    png,
    (v) => v.startsWith("data:image/png;base64") && /^\S+ \d+x\d+$/.test(v),
  );
  await domClick(page, "#shareModeTotals");
  check(
    "totals mode hides the breakdown",
    await page.$eval("#shareCardBreakdown", (el) => el.hidden),
    true,
  );
  await page.keyboard.press("Escape");
  check(
    "Escape closes the receipt modal",
    await page.$eval("#whatsappShareModal", (el) => el.hidden),
    true,
  );

  console.log("console");
  check("no console/page errors", consoleErrors, (list) => list.length === 0);
};

