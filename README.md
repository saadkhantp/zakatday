# ZakatDay

A private, zero-storage Zakat calculator with live gold, silver and currency rates.
Live at **https://www.zakatday.cc**.

## How it works

- **Nothing you type is stored or sent.** Amounts live only in the page's memory.
  No backend, no database, no cookies. The only local storage keys are
  `theme`, `zakatday-currency`, `zakatday-favorites` and `zakatday-nisab-standard`.
- **Live rates** come from jsDelivr's `currency-api` (gold/silver priced per troy
  ounce and converted to grams in your currency), with `open.er-api.com` as a
  fiat fallback and manual metal prices as the final override.
- **Zakat maths**: 2.5% of net zakatable assets once they reach the nisab —
  612.36 g of silver or 87.48 g of gold (per the chosen standard).
- **WhatsApp receipt**: “Send to WhatsApp” renders a PNG receipt in the tab with
  [html2canvas](https://html2canvas.hertzen.com/) (pinned CDN build), hands it to
  the OS share sheet or downloads it, then opens WhatsApp with the text summary.
  Users pick itemized figures or totals-only; nothing is uploaded. If the library
  cannot load, the flow silently falls back to the text summary.

## Stack

- Static HTML, served straight from the repository root (GitHub Pages + `CNAME`).
- Tailwind CSS v3 compiled through PostCSS to `dist/app.css`.
- Plain classic scripts (`window.CurrencyService`, `window.ZakatEngine`,
  `window.ZakatDay`) — no bundler, no framework, no runtime dependencies.
- Google Fonts (Mulish + Material Symbols) loaded from the CDN.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Calculator page (generated — edit the sources below) |
| `faq/index.html` | Zakat guide, privacy notes and FAQ (generated) |
| `app.js` | DOM wiring, rendering, sheets, sharing (generated) |
| `currency-service.js` | Currency catalogue, live FX/metals, formatting, favourites |
| `zakat-engine.js` | Pure calculation engine (no DOM, no storage) |
| `theme.js`, `theme-init.js` | Dark-mode helpers (Applied before paint) |
| `s/head.html`, `s/faq-*.html` | HTML head + FAQ fragments |
| `build-fragments/*` | Page and `app.js` source fragments |
| `src/styles/tailwind-entry.css` | Tailwind entry point + component classes |
| `dist/app.css` | Built stylesheet (committed, served as-is) |
| `manifest.json` | PWA manifest (root-absolute icon paths) |
| `assets/icons/` | **Pending artwork** — favicons, Apple touch icon, 192/512 PWA icons |
| `assets/og/` | **Pending artwork** — `og-image.png` (1200×630) and `twitter-card.png` |
| `assets/brand/` | **Pending artwork** — `logo.svg` used by the structured data |
| `favicon.ico`, `favicon.svg` | **Pending artwork** — served from the site root |

### Asset & manifest wiring

Every icon and social-image path is root-absolute and standardised, so the final
artwork can be dropped in without touching markup:

| Reference | File |
| --- | --- |
| `<link rel="manifest">` | `/manifest.json` |
| `rel="icon"` (fallback) | `/favicon.ico`, `/favicon.svg` |
| `rel="icon"` (sized) | `/assets/icons/favicon-32x32.png`, `/assets/icons/favicon-16x16.png` |
| `rel="apple-touch-icon"` | `/assets/icons/apple-touch-icon.png` (180×180) |
| Manifest icons | `/assets/icons/icon-192.png`, `/assets/icons/icon-512.png`, `/assets/icons/icon-maskable-512.png` |
| `og:image` / JSON-LD image | `/assets/og/og-image.png` (1200×630) |
| `twitter:image` | `/assets/og/twitter-card.png` |
| JSON-LD publisher logo | `/assets/brand/logo.svg` (512×512) |

Until those files exist the browser reports them as missing; `test:smoke` lists
them once as "pending artwork" instead of failing, so the suite stays green
while the design work lands. The header wordmark (`.brand-logo-slot`) and the
receipt wordmark (`.receipt-brand-slot`) are marked slots: replace the inner
mark with an image or inline SVG and the surrounding markup needs no changes.
The old `zakat-day-logo-*.png` and `og-zakatday.jpg` files are no longer
referenced.

## Development

```bash
npm install          # once
npm run watch:css    # rebuild dist/app.css on change
npm run build        # build app.js + HTML + CSS
npm test             # build, engine tests, CSS coverage, audit, browser smoke test
```

`npm test` runs the browser smoke test with `puppeteer-core` against your local
Chrome (`CHROME_PATH` overrides the default macOS location).

### Editing pages

`index.html`, `faq/index.html` and `app.js` are **generated**. Change the files in
`s/` and `build-fragments/`, then run `npm run build`:

- `scripts/build-html.cjs` assembles the pages and validates tag balance,
  duplicate ids and leftover Bootstrap references.
- `scripts/build-app.cjs` concatenates `build-fragments/app-*.js` and syntax-checks it.

## Verification

| Script | Checks |
| --- | --- |
| `test:engine` | Currency service + zakat engine maths (60+ assertions, sandboxed) |
| `test:css` | Every project-defined class in `index.html` survives cssnano |
| `test:audit` | No `sessionStorage`/IndexedDB/cookies/URL writes; only 4 storage keys; every `getElementById` target exists; all local assets present |
| `test:smoke` | Real Chrome: live rates, maths, currency conversion, manual prices, summary, reset, theme, privacy, the FAQ page, SEO/JSON-LD metadata and the WhatsApp receipt flow |

## Zakat accuracy

The calculator is an arithmetic aid using the widely accepted thresholds and the
2.5% rate. Rules about specific assets differ between schools, so users are asked
to confirm their figure with a qualified scholar (see `/faq/`).
