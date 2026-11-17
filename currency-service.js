/**
 * ZakatDay currency service.
 *
 * Responsibilities
 *  - Currency catalogue (150+ ISO codes) with symbol, name, flag emoji, decimals.
 *  - Live FX fetch with graceful fallback (jsDelivr currency-api → open.er-api.com).
 *  - Live gold/silver spot per troy ounce with graceful fallback.
 *  - Formatting helpers (Intl.NumberFormat) + favourites seeding from locale/timezone.
 *
 * Storage policy: this module persists ONLY `zakatday-currency` and
 * `zakatday-favorites`. It never receives or stores monetary amounts.
 *
 * Classic script (no modules) so the site stays zero-build for JS.
 */
(function () {
  "use strict";

  var TROY_OUNCE_GRAMS = 31.1034768;

  var STORAGE_KEYS = {
    currency: "zakatday-currency",
    favorites: "zakatday-favorites",
  };

  var API = {
    jsdelivr:
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
    jsdelivrMetal: function (metal) {
      return (
        "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/" +
        metal +
        ".min.json"
      );
    },
    erApi: "https://open.er-api.com/v6/latest/USD",
    timeoutMs: 9000,
  };

  /** code, name, symbol, country (ISO-3166 alpha-2 → flag emoji), decimals */
  var CURRENCY_TABLE = [
    ["AED", "UAE Dirham", "د.إ", "AE", 2],
    ["AFN", "Afghan Afghani", "؋", "AF", 2],
    ["ALL", "Albanian Lek", "L", "AL", 2],
    ["AMD", "Armenian Dram", "֏", "AM", 2],
    ["ANG", "Netherlands Antillian Guilder", "ƒ", "CW", 2],
    ["AOA", "Angolan Kwanza", "Kz", "AO", 2],
    ["ARS", "Argentine Peso", "$", "AR", 2],
    ["AUD", "Australian Dollar", "A$", "AU", 2],
    ["AWG", "Aruban Florin", "ƒ", "AW", 2],
    ["AZN", "Azerbaijani Manat", "₼", "AZ", 2],
    ["BAM", "Bosnia-Herzegovina Convertible Mark", "KM", "BA", 2],
    ["BBD", "Barbadian Dollar", "$", "BB", 2],
    ["BDT", "Bangladeshi Taka", "৳", "BD", 2],
    ["BGN", "Bulgarian Lev", "лв", "BG", 2],
    ["BHD", "Bahraini Dinar", "ب.د", "BH", 3],
    ["BIF", "Burundian Franc", "Fr", "BI", 0],
    ["BMD", "Bermudian Dollar", "$", "BM", 2],
    ["BND", "Brunei Dollar", "$", "BN", 2],
    ["BOB", "Bolivian Boliviano", "Bs.", "BO", 2],
    ["BRL", "Brazilian Real", "R$", "BR", 2],
    ["BSD", "Bahamian Dollar", "$", "BS", 2],
    ["BTN", "Bhutanese Ngultrum", "Nu.", "BT", 2],
    ["BWP", "Botswana Pula", "P", "BW", 2],
    ["BYN", "Belarusian Ruble", "Br", "BY", 2],
    ["BZD", "Belize Dollar", "$", "BZ", 2],
    ["CAD", "Canadian Dollar", "$", "CA", 2],
    ["CDF", "Congolese Franc", "Fr", "CD", 2],
    ["CHF", "Swiss Franc", "Fr", "CH", 2],
    ["CLP", "Chilean Peso", "$", "CL", 0],
    ["CNY", "Chinese Yuan", "¥", "CN", 2],
    ["COP", "Colombian Peso", "$", "CO", 0],
    ["CRC", "Costa Rican Colón", "₡", "CR", 2],
    ["CUP", "Cuban Peso", "$", "CU", 2],
    ["CVE", "Cape Verdean Escudo", "$", "CV", 2],
    ["CZK", "Czech Koruna", "Kč", "CZ", 2],
    ["DJF", "Djiboutian Franc", "Fr", "DJ", 0],
    ["DKK", "Danish Krone", "kr", "DK", 2],
    ["DOP", "Dominican Peso", "$", "DO", 2],
    ["DZD", "Algerian Dinar", "د.ج", "DZ", 2],
    ["EGP", "Egyptian Pound", "E£", "EG", 2],
    ["ERN", "Eritrean Nakfa", "Nfk", "ER", 2],
    ["ETB", "Ethiopian Birr", "Br", "ET", 2],
    ["EUR", "Euro", "€", "EU", 2],
    ["FJD", "Fijian Dollar", "$", "FJ", 2],
    ["FKP", "Falkland Islands Pound", "£", "FK", 2],
    ["GBP", "British Pound", "£", "GB", 2],
    ["GEL", "Georgian Lari", "₾", "GE", 2],
    ["GHS", "Ghanaian Cedi", "₵", "GH", 2],
    ["GYD", "Guyanese Dollar", "$", "GY", 2],
    ["HKD", "Hong Kong Dollar", "$", "HK", 2],
    ["HNL", "Honduran Lempira", "L", "HN", 2],
    ["HTG", "Haitian Gourde", "G", "HT", 2],
    ["HUF", "Hungarian Forint", "Ft", "HU", 0],
    ["IDR", "Indonesian Rupiah", "Rp", "ID", 0],
    ["ILS", "Israeli New Shekel", "₪", "IL", 2],
    ["INR", "Indian Rupee", "₹", "IN", 2],
    ["IQD", "Iraqi Dinar", "ع.د", "IQ", 0],
    ["IRR", "Iranian Rial", "﷼", "IR", 0],
    ["ISK", "Icelandic Króna", "kr", "IS", 0],
    ["JMD", "Jamaican Dollar", "$", "JM", 2],
    ["JOD", "Jordanian Dinar", "د.ا", "JO", 3],
    ["JPY", "Japanese Yen", "¥", "JP", 0],
    ["KES", "Kenyan Shilling", "KSh", "KE", 2],
    ["KGS", "Kyrgyzstani Som", "с", "KG", 2],
    ["KID", "Kiribati Dollar", "$", "KI", 2],
    ["KHR", "Cambodian Riel", "៛", "KH", 2],
    ["KMF", "Comorian Franc", "Fr", "KM", 0],
    ["KRW", "South Korean Won", "₩", "KR", 0],
    ["KWD", "Kuwaiti Dinar", "د.ك", "KW", 3],
    ["KYD", "Cayman Islands Dollar", "$", "KY", 2],
    ["KZT", "Kazakhstani Tenge", "₸", "KZ", 2],
    ["LAK", "Laotian Kip", "₭", "LA", 0],
    ["LBP", "Lebanese Pound", "L£", "LB", 0],
    ["LKR", "Sri Lankan Rupee", "Rs", "LK", 2],
    ["LRD", "Liberian Dollar", "$", "LR", 2],
    ["LSL", "Lesotho Loti", "L", "LS", 2],
    ["LYD", "Libyan Dinar", "ل.د", "LY", 3],
    ["MAD", "Moroccan Dirham", "د.م.", "MA", 2],
    ["MDL", "Moldovan Leu", "L", "MD", 2],
    ["MGA", "Malagasy Ariary", "Ar", "MG", 0],
    ["MKD", "Macedonian Denar", "ден", "MK", 2],
    ["MMK", "Myanmar Kyat", "K", "MM", 0],
    ["MNT", "Mongolian Tögrög", "₮", "MN", 0],
    ["MOP", "Macanese Pataca", "P", "MO", 2],
    ["MRU", "Mauritanian Ouguiya", "UM", "MR", 2],
    ["MUR", "Mauritian Rupee", "₨", "MU", 2],
    ["MVR", "Maldivian Rufiyaa", "Rf", "MV", 2],
    ["MWK", "Malawian Kwacha", "MK", "MW", 2],
    ["MXN", "Mexican Peso", "$", "MX", 2],
    ["MYR", "Malaysian Ringgit", "RM", "MY", 2],
    ["MZN", "Mozambican Metical", "MT", "MZ", 2],
    ["NAD", "Namibian Dollar", "$", "NA", 2],
    ["NGN", "Nigerian Naira", "₦", "NG", 2],
    ["NIO", "Nicaraguan Córdoba", "C$", "NI", 2],
    ["NOK", "Norwegian Krone", "kr", "NO", 2],
    ["NPR", "Nepalese Rupee", "₨", "NP", 2],
    ["NZD", "New Zealand Dollar", "$", "NZ", 2],
    ["OMR", "Omani Rial", "ر.ع.", "OM", 3],
    ["PAB", "Panamanian Balboa", "B/.", "PA", 2],
    ["PEN", "Peruvian Sol", "S/", "PE", 2],
    ["PGK", "Papua New Guinean Kina", "K", "PG", 2],
    ["PHP", "Philippine Peso", "₱", "PH", 2],
    ["PKR", "Pakistani Rupee", "₨", "PK", 0],
    ["PLN", "Polish Złoty", "zł", "PL", 2],
    ["PYG", "Paraguayan Guaraní", "₲", "PY", 0],
    ["QAR", "Qatari Riyal", "ر.ق", "QA", 2],
    ["RON", "Romanian Leu", "lei", "RO", 2],
    ["RSD", "Serbian Dinar", "дин", "RS", 2],
    ["RUB", "Russian Ruble", "₽", "RU", 2],
    ["RWF", "Rwandan Franc", "Fr", "RW", 0],
    ["SAR", "Saudi Riyal", "﷼", "SA", 2],
    ["SBD", "Solomon Islands Dollar", "$", "SB", 2],
    ["SCR", "Seychellois Rupee", "₨", "SC", 2],
    ["SDG", "Sudanese Pound", "ج.س.", "SD", 2],
    ["SEK", "Swedish Krona", "kr", "SE", 2],
    ["SGD", "Singapore Dollar", "$", "SG", 2],
    ["SHP", "Saint Helena Pound", "£", "SH", 2],
    ["SLE", "Sierra Leonean Leone", "Le", "SL", 2],
    ["SOS", "Somali Shilling", "Sh", "SO", 2],
    ["SRD", "Surinamese Dollar", "$", "SR", 2],
    ["SSP", "South Sudanese Pound", "£", "SS", 2],
    ["STN", "São Tomé & Príncipe Dobra", "Db", "ST", 2],
    ["SVC", "Salvadoran Colón", "₡", "SV", 2],
    ["SYP", "Syrian Pound", "£", "SY", 0],
    ["SZL", "Swazi Lilangeni", "E", "SZ", 2],
    ["THB", "Thai Baht", "฿", "TH", 2],
    ["TJS", "Tajikistani Somoni", "ЅМ", "TJ", 2],
    ["TMT", "Turkmenistani Manat", "m", "TM", 2],
    ["TND", "Tunisian Dinar", "د.ت", "TN", 3],
    ["TOP", "Tongan Paʻanga", "T$", "TO", 2],
    ["TRY", "Turkish Lira", "₺", "TR", 2],
    ["TTD", "Trinidad & Tobago Dollar", "$", "TT", 2],
    ["TVD", "Tuvaluan Dollar", "$", "TV", 2],
    ["TWD", "New Taiwan Dollar", "NT$", "TW", 2],
    ["TZS", "Tanzanian Shilling", "Sh", "TZ", 2],
    ["UAH", "Ukrainian Hryvnia", "₴", "UA", 2],
    ["UGX", "Ugandan Shilling", "USh", "UG", 0],
    ["USD", "US Dollar", "$", "US", 2],
    ["UYU", "Uruguayan Peso", "$", "UY", 2],
    ["UZS", "Uzbekistani Som", "so'm", "UZ", 0],
    ["VES", "Venezuelan Bolívar", "Bs.", "VE", 2],
    ["VND", "Vietnamese Đồng", "₫", "VN", 0],
    ["VUV", "Vanuatu Vatu", "Vt", "VU", 0],
    ["WST", "Samoan Tālā", "T", "WS", 2],
    ["XAF", "Central African CFA Franc", "Fr", "CM", 0],
    ["XCD", "East Caribbean Dollar", "$", "AG", 2],
    ["XOF", "West African CFA Franc", "Fr", "SN", 0],
    ["XPF", "CFP Franc", "Fr", "PF", 0],
    ["YER", "Yemeni Rial", "﷼", "YE", 0],
    ["ZAR", "South African Rand", "R", "ZA", 2],
    ["ZMW", "Zambian Kwacha", "ZK", "ZM", 2],
    ["ZWL", "Zimbabwean Dollar", "$", "ZW", 2],
  ];

  var CURRENCIES = {};
  var LIST = CURRENCY_TABLE.map(function (row) {
    var entry = {
      code: row[0],
      name: row[1],
      symbol: row[2],
      country: row[3],
      decimals: row[4],
    };
    CURRENCIES[entry.code] = entry;
    return entry;
  });

  /** Region (ISO-3166 alpha-2) → preferred currency. */
  var REGION_CURRENCY = {
    PK: "PKR", IN: "INR", BD: "BDT", LK: "LKR", NP: "NPR", AF: "AFN",
    US: "USD", CA: "CAD", GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR",
    ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR",
    FI: "EUR", GR: "EUR", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD",
    BH: "BHD", OM: "OMR", JO: "JOD", EG: "EGP", TR: "TRY", IL: "ILS",
    MY: "MYR", ID: "IDR", SG: "SGD", TH: "THB", PH: "PHP", VN: "VND",
    CN: "CNY", HK: "HKD", TW: "TWD", JP: "JPY", KR: "KRW", AU: "AUD",
    NZ: "NZD", ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", MA: "MAD",
    DZ: "DZD", TN: "TND", LY: "LYD", SD: "SDG", ET: "ETB", SO: "SOS",
    RU: "RUB", UA: "UAH", KZ: "KZT", UZ: "UZS", AZ: "AZN", BR: "BRL",
    MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", CH: "CHF",
    SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF",
    RO: "RON", BG: "BGN", IR: "IRR", IQ: "IQD", SY: "SYP", LB: "LBP",
    YE: "YER", MU: "MUR", MV: "MVR", BN: "BND", TT: "TTD", JM: "JMD",
    CW: "ANG", AW: "AWG", EU: "EUR",
  };

  /** Timezone → currency, used when the browser locale omits a region. */
  var TZ_CURRENCY = [
    [/^Asia\/Karachi$/, "PKR"],
    [/^Asia\/Kolkata|^Asia\/Calcutta$/, "INR"],
    [/^Asia\/Dhaka$/, "BDT"],
    [/^Asia\/Colombo$/, "LKR"],
    [/^Asia\/Kathmandu$/, "NPR"],
    [/^Asia\/Kabul$/, "AFN"],
    [/^Asia\/Dubai|^Asia\/Muscat$/, "AED"],
    [/^Asia\/Riyadh$/, "SAR"],
    [/^Asia\/Qatar$/, "QAR"],
    [/^Asia\/Kuwait$/, "KWD"],
    [/^Asia\/Bahrain$/, "BHD"],
    [/^Asia\/Amman$/, "JOD"],
    [/^Asia\/Beirut$/, "LBP"],
    [/^Asia\/Baghdad$/, "IQD"],
    [/^Asia\/Tehran$/, "IRR"],
    [/^Asia\/Jerusalem|^Asia\/Tel_Aviv$/, "ILS"],
    [/^Asia\/Istanbul$/, "TRY"],
    [/^Asia\/Kuala_|^Asia\/Singapore|^Asia\/Brunei$/, "MYR"],
    [/^Asia\/Jakarta|^Asia\/Makassar|^Asia\/Jayapura$/, "IDR"],
    [/^Asia\/Bangkok$/, "THB"],
    [/^Asia\/Manila$/, "PHP"],
    [/^Asia\/Ho_Chi_Minh$/, "VND"],
    [/^Asia\/Shanghai|^Asia\/Chongqing|^Asia\/Harbin|^Asia\/Urumqi$/, "CNY"],
    [/^Asia\/Hong_Kong$/, "HKD"],
    [/^Asia\/Taipei$/, "TWD"],
    [/^Asia\/Tokyo$/, "JPY"],
    [/^Asia\/Seoul$/, "KRW"],
    [/^Africa\/Lagos$/, "NGN"],
    [/^Africa\/Nairobi$/, "KES"],
    [/^Africa\/Accra$/, "GHS"],
    [/^Africa\/Casablanca$/, "MAD"],
    [/^Africa\/Algiers$/, "DZD"],
    [/^Africa\/Tunis$/, "TND"],
    [/^Africa\/Cairo$/, "EGP"],
    [/^Africa\/Johannesburg$/, "ZAR"],
    [/^America\/New_York|^America\/Chicago|^America\/Denver|^America\/Los_Angeles|^America\/Phoenix|^America\/Anchorage|^Pacific\/Honolulu$/, "USD"],
    [/^America\/Toronto|^America\/Vancouver|^America\/Edmonton|^America\/Winnipeg|^America\/Halifax$/, "CAD"],
    [/^America\/Mexico_City|^America\/Monterrey|^America\/Tijuana$/, "MXN"],
    [/^America\/Sao_Paulo|^America\/Bahia$/, "BRL"],
    [/^America\/(Argentina|Buenos_Aires)$/, "ARS"],
    [/^Europe\/London$/, "GBP"],
    [/^Europe\/(Paris|Berlin|Madrid|Rome|Amsterdam|Brussels|Vienna|Lisbon|Athens|Helsinki|Bratislava|Ljubljana|Luxembourg|Valletta|Riga|Tallinn|Vilnius|Zagreb|Dublin)$/, "EUR"],
    [/^Europe\/Zurich|^Europe\/Vaduz$/, "CHF"],
    [/^Europe\/Stockholm$/, "SEK"],
    [/^Europe\/Oslo$/, "NOK"],
    [/^Europe\/Copenhagen$/, "DKK"],
    [/^Europe\/Warsaw$/, "PLN"],
    [/^Europe\/Prague$/, "CZK"],
    [/^Europe\/Budapest$/, "HUF"],
    [/^Europe\/Bucharest$/, "RON"],
    [/^Europe\/Sofia$/, "BGN"],
    [/^Europe\/Moscow$/, "RUB"],
    [/^Europe\/Kyiv|^Europe\/Kiev$/, "UAH"],
    [/^Australia\//, "AUD"],
    [/^Pacific\/Auckland$/, "NZD"],
  ];

  var DEFAULT_FAVORITES = ["USD", "PKR", "GBP", "AED", "SAR", "EUR"];
  var MAX_FAVORITES = 6;


  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* Storage unavailable (private mode / quota): preference just resets. */
    }
  }

  /** Regional-indicator flag emoji from an ISO-3166 alpha-2 country code. */
  function flagFor(countryCode) {
    if (!countryCode || countryCode.length !== 2) return "🏳️";
    var cc = countryCode.toUpperCase();
    if (cc === "EU") return "🇪🇺";
    return String.fromCodePoint(
      0x1f1e6 + cc.charCodeAt(0) - 65,
      0x1f1e6 + cc.charCodeAt(1) - 65,
    );
  }

  function getCurrency(code) {
    return CURRENCIES[String(code || "").toUpperCase()] || CURRENCIES.USD;
  }

  function isKnown(code) {
    return Object.prototype.hasOwnProperty.call(
      CURRENCIES,
      String(code || "").toUpperCase(),
    );
  }

  /** Read a metal entry from camelCase / snake_case / lower-case payloads. */
  function readMetal(map, code) {
    if (!map || typeof map !== "object") return null;
    var lower = code.toLowerCase();
    var camel = lower.charAt(0).toUpperCase() + lower.slice(1);
    var candidates = [lower, lower.toUpperCase(), camel];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = map[candidates[i]];
      if (typeof value === "number" && isFinite(value) && value > 0) {
        return value;
      }
    }
    return null;
  }

  /**
   * Normalise an API payload into { base:"USD", rates:{USD:1,...}, date }.
   * Supports both @fawazahmed0 (lower-case keys) and open.er-api.com
   * (upper-case keys); both are quoted per 1 USD.
   */
  function normaliseRates(raw, source) {
    if (!raw || typeof raw !== "object") return null;
    var map = raw.usd || raw.rates;
    if (!map || typeof map !== "object") return null;
    var rates = { USD: 1 };
    Object.keys(map).forEach(function (key) {
      var value = map[key];
      if (typeof value !== "number" || !isFinite(value) || value <= 0) return;
      rates[key.toUpperCase()] = value;
    });
    rates.USD = 1;
    if (Object.keys(rates).length < 2) return null;
    return {
      base: "USD",
      rates: rates,
      date: typeof raw.date === "string" ? raw.date : "",
      source: source || "unknown",
    };
  }

  /**
   * USD per troy ounce from a metal payload where `xau`/`xag` are quoted as
   * troy ounces per 1 USD, i.e. usdPerOz = 1 / xau.
   */
  function metalsFromPayload(raw, source) {
    if (!raw || typeof raw !== "object") return null;
    var xau = readMetal(raw.xau, "xau");
    var xag = readMetal(raw.xag, "xag");
    if (!xau && raw.usd && typeof raw.usd === "object") {
      xau = readMetal(raw.usd, "xau");
    }
    if (!xag && raw.usd && typeof raw.usd === "object") {
      xag = readMetal(raw.usd, "xag");
    }
    var goldOz = xau ? 1 / xau : null;
    var silverOz = xag ? 1 / xag : null;
    if (!goldOz && !silverOz) return null;
    return {
      goldUsdPerOz: goldOz,
      silverUsdPerOz: silverOz,
      date: typeof raw.date === "string" ? raw.date : "",
      source: source || "unknown",
    };
  }

  /** fetch + JSON with a timeout; resolves `null` on any failure. */
  function fetchJson(url, timeoutMs) {
    var controller =
      typeof AbortController === "function" ? new AbortController() : null;
    var options = { cache: "no-store" };
    if (controller) options.signal = controller.signal;
    var timer = null;
    var request = fetch(url, options)
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
    if (controller) {
      timer = setTimeout(function () {
        controller.abort();
      }, timeoutMs || API.timeoutMs);
    }
    return request;
  }

  /* ------------------------------------------------------------------ */
  /* Live rates                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Resolve live USD-based FX + metals. Never throws.
   * Order: jsDelivr usd.json (includes XAU/XAG) → open.er-api.com for fiat
   * plus metal-specific jsDelivr files for gold/silver. Partial data is fine.
   */
  async function loadLiveRates() {
    var status = { fx: "error", metals: "error", fxSource: "", metalSource: "" };
    var rates = null;
    var metals = null;

    var primary = await fetchJson(API.jsdelivr);
    var primaryData = normaliseRates(primary, "jsDelivr currency-api");
    if (primaryData) {
      rates = primaryData;
      status.fx = "live";
      status.fxSource = "jsDelivr currency-api";
      metals = metalsFromPayload(primary, "jsDelivr currency-api");
      if (metals) {
        status.metals = "live";
        status.metalSource = "jsDelivr currency-api";
      }
    }

    if (!rates) {
      var fallback = await fetchJson(API.erApi);
      var fallbackData = normaliseRates(fallback, "open.er-api.com");
      if (fallbackData) {
        rates = fallbackData;
        status.fx = "live";
        status.fxSource = "open.er-api.com";
      }
    }

    if (!metals) {
      var responses = await Promise.all([
        fetchJson(API.jsdelivrMetal("xau")),
        fetchJson(API.jsdelivrMetal("xag")),
      ]);
      var goldPayload = responses[0];
      var silverPayload = responses[1];
      var goldOz = null;
      var silverOz = null;
      if (goldPayload) {
        var g = readMetal(goldPayload, "xau") || readMetal(goldPayload, "usd");
        if (g) goldOz = 1 / g;
      }
      if (silverPayload) {
        var s = readMetal(silverPayload, "xag") || readMetal(silverPayload, "usd");
        if (s) silverOz = 1 / s;
      }
      if (goldOz || silverOz) {
        metals = {
          goldUsdPerOz: goldOz,
          silverUsdPerOz: silverOz,
          date:
            (goldPayload && goldPayload.date) ||
            (silverPayload && silverPayload.date) ||
            "",
          source: "jsDelivr metal feeds",
        };
        status.metals = "live";
        status.metalSource = "jsDelivr metal feeds";
      }
    }

    return {
      rates: rates,
      metals: metals,
      status: status,
      fetchedAt: new Date(),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Conversion + formatting                                            */
  /* ------------------------------------------------------------------ */

  /** Convert via USD cross-rate; returns null when either rate is missing. */
  function convert(amount, fromCode, toCode, rates) {
    var value = Number(amount);
    if (!isFinite(value)) return null;
    if (value === 0) return 0;
    var from = String(fromCode || "USD").toUpperCase();
    var to = String(toCode || "USD").toUpperCase();
    if (from === to) return value;
    if (!rates) return null;
    var fromRate = from === "USD" ? 1 : rates[from];
    var toRate = to === "USD" ? 1 : rates[to];
    if (typeof fromRate !== "number" || typeof toRate !== "number") return null;
    if (!fromRate || !toRate) return null;
    return (value / fromRate) * toRate;
  }

  function formatMoney(amount, code, options) {
    var opts = options || {};
    var currency = getCurrency(code);
    var value = Number(amount);
    if (!isFinite(value)) value = 0;
    var digits =
      typeof opts.decimals === "number" ? opts.decimals : currency.decimals;
    try {
      return new Intl.NumberFormat(opts.locale || undefined, {
        style: "currency",
        currency: currency.code,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    } catch (e) {
      try {
        return new Intl.NumberFormat(opts.locale || undefined, {
          style: "decimal",
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(value);
      } catch (e2) {
        return currency.symbol + " " + value.toFixed(digits);
      }
    }
  }

  function formatNumber(amount, decimals) {
    var value = Number(amount);
    if (!isFinite(value)) value = 0;
    var digits = typeof decimals === "number" ? decimals : 2;
    try {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    } catch (e) {
      return value.toFixed(digits);
    }
  }

  /** Parse a typed money string into a positive finite number (else 0). */
  function parseAmount(raw) {
    if (typeof raw === "number") {
      return isFinite(raw) && raw > 0 ? raw : 0;
    }
    if (!raw) return 0;
    var text = String(raw);
    if (text.trim().charAt(0) === "-") return 0;
    var cleaned = text
      .replace(/[^\d.]/g, "")
      .replace(/(\..*)\./g, "$1");
    var value = parseFloat(cleaned);
    if (!isFinite(value) || value <= 0) return 0;
    return value;
  }


  /* ------------------------------------------------------------------ */
  /* Preferences (non-sensitive only)                                   */
  /* ------------------------------------------------------------------ */

  function guessCurrencyFromLocale() {
    var langs = [];
    try {
      if (navigator.languages && navigator.languages.length) {
        langs = Array.prototype.slice.call(navigator.languages);
      } else if (navigator.language) {
        langs = [navigator.language];
      }
    } catch (e) {
      langs = [];
    }
    for (var i = 0; i < langs.length; i += 1) {
      var parts = String(langs[i]).split(/[-_]/);
      for (var p = parts.length - 1; p >= 1; p -= 1) {
        var region = parts[p].toUpperCase();
        if (region.length === 2 && REGION_CURRENCY[region]) {
          return REGION_CURRENCY[region];
        }
      }
    }
    var tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {
      tz = "";
    }
    for (var t = 0; t < TZ_CURRENCY.length; t += 1) {
      if (TZ_CURRENCY[t][0].test(tz)) return TZ_CURRENCY[t][1];
    }
    return "USD";
  }

  function seedFavoritesFromLocale() {
    var picks = [];
    var push = function (code) {
      if (code && isKnown(code) && picks.indexOf(code) === -1) picks.push(code);
    };
    push(guessCurrencyFromLocale());
    DEFAULT_FAVORITES.forEach(push);
    return picks.slice(0, MAX_FAVORITES);
  }

  function getStoredCurrency() {
    var stored = safeGet(STORAGE_KEYS.currency);
    if (stored && isKnown(stored)) return String(stored).toUpperCase();
    return null;
  }

  function setStoredCurrency(code) {
    if (!isKnown(code)) return;
    safeSet(STORAGE_KEYS.currency, String(code).toUpperCase());
  }

  function getFavorites() {
    var raw = safeGet(STORAGE_KEYS.favorites);
    if (!raw) {
      var seeded = seedFavoritesFromLocale();
      safeSet(STORAGE_KEYS.favorites, JSON.stringify(seeded));
      return seeded;
    }
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      var clean = [];
      parsed.forEach(function (code) {
        var upper = String(code || "").toUpperCase();
        if (isKnown(upper) && clean.indexOf(upper) === -1) clean.push(upper);
      });
      if (!clean.length) throw new Error("empty");
      return clean.slice(0, MAX_FAVORITES);
    } catch (e) {
      var fallback = seedFavoritesFromLocale();
      safeSet(STORAGE_KEYS.favorites, JSON.stringify(fallback));
      return fallback;
    }
  }

  function saveFavorites(list) {
    var clean = [];
    (list || []).forEach(function (code) {
      var upper = String(code || "").toUpperCase();
      if (isKnown(upper) && clean.indexOf(upper) === -1) clean.push(upper);
    });
    clean = clean.slice(0, MAX_FAVORITES);
    safeSet(STORAGE_KEYS.favorites, JSON.stringify(clean));
    return clean;
  }

  /**
   * Pin/unpin a currency. When the cap is reached a new pin evicts the oldest
   * favourite, so the current currency can always be pinned.
   * Returns { list, changed, evicted }.
   */
  function toggleFavorite(code) {
    var upper = String(code || "").toUpperCase();
    if (!isKnown(upper)) {
      return { list: getFavorites(), changed: false, evicted: "" };
    }
    var list = getFavorites();
    var index = list.indexOf(upper);
    var evicted = "";
    if (index === -1) {
      if (list.length >= MAX_FAVORITES) {
        evicted = list[list.length - 1];
        list = list.slice(0, MAX_FAVORITES - 1);
      }
      list.push(upper);
    } else {
      list.splice(index, 1);
    }
    return { list: saveFavorites(list), changed: true, evicted: evicted };
  }

  /* ------------------------------------------------------------------ */
  /* Search                                                            */
  /* ------------------------------------------------------------------ */

  function searchCurrencies(query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return LIST.slice();
    return LIST.filter(function (entry) {
      return (
        entry.code.toLowerCase().indexOf(q) === 0 ||
        entry.name.toLowerCase().indexOf(q) !== -1 ||
        entry.symbol.toLowerCase() === q
      );
    });
  }

  window.CurrencyService = {
    TROY_OUNCE_GRAMS: TROY_OUNCE_GRAMS,
    MAX_FAVORITES: MAX_FAVORITES,
    DEFAULT_FAVORITES: DEFAULT_FAVORITES,
    LIST: LIST,
    getCurrency: getCurrency,
    isKnown: isKnown,
    flagFor: flagFor,
    normaliseRates: normaliseRates,
    metalsFromPayload: metalsFromPayload,
    loadLiveRates: loadLiveRates,
    convert: convert,
    formatMoney: formatMoney,
    formatNumber: formatNumber,
    parseAmount: parseAmount,
    getStoredCurrency: getStoredCurrency,
    setStoredCurrency: setStoredCurrency,
    getFavorites: getFavorites,
    saveFavorites: saveFavorites,
    toggleFavorite: toggleFavorite,
    guessCurrencyFromLocale: guessCurrencyFromLocale,
    searchCurrencies: searchCurrencies,
  };
})();


