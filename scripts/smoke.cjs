/**
 * End-to-end smoke test in headless Chrome (puppeteer-core + local Chrome).
 * Serves the repo over HTTP and verifies pages, live rates, maths, currency
 * switching, manual prices, summary, reset, theme and storage privacy.
 * Usage: node scripts/smoke.cjs   (run `npm run build` first)
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const puppeteer = require("puppeteer-core");

const root = path.join(__dirname, "..");
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function serve() {
  /* Unreferenced targets must not fail the run, so a missing icon/OG image is
     reported as a pending asset rather than a 404 request. */
  const isPendingAsset = (target) =>
    target === "/favicon.ico" ||
    target === "/favicon.svg" ||
    target.startsWith("/assets/");
  const server = http.createServer((req, res) => {
    let target = decodeURIComponent(req.url.split("?")[0]);
    if (target.endsWith("/")) target += "index.html";
    const file = path.join(root, target);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (isPendingAsset(target)) {
        res.writeHead(404, { "X-Pending-Asset": "1" });
      } else {
        res.writeHead(404);
      }
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

let failures = 0;
function check(label, actual, assertion) {
  const ok = typeof assertion === "function" ? assertion(actual) : actual === assertion;
  console.log((ok ? "  ok   " : "  FAIL ") + label + (ok ? "" : " → " + JSON.stringify(actual)));
  if (!ok) failures += 1;
}

const num = (text) => Number(String(text).replace(/[^\d.]/g, ""));

(async () => {
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });

  const consoleErrors = [];
  const failedRequests = [];
  const pendingAssets = [];
  /* Missing icon/OG files get an empty 200 so a gap does not fail the run.
     Files that are already in the repo are served as themselves. */
  const isBrandAsset = (pathname) =>
    pathname.startsWith("/assets/") || /^\/favicon\.(ico|svg)$/.test(pathname);
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (!req.url().startsWith(base)) {
      req.continue();
      return;
    }
    const pathname = new URL(req.url()).pathname;
    if (!isBrandAsset(pathname)) {
      req.continue();
      return;
    }
    const file = path.join(root, pathname);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      req.continue();
      return;
    }
    if (!pendingAssets.includes(pathname)) pendingAssets.push(pathname);
    req.respond({ status: 200, contentType: "image/png", body: "" });
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(base)) failedRequests.push(req.url());
  });
  page.on("response", (res) => {
    if (res.url().startsWith(base) && res.status() >= 400) {
      failedRequests.push(res.status() + " " + res.url());
    }
  });
  await page.evaluateOnNewDocument(() => {
    var original = Storage.prototype.setItem;
    window.__storageWrites = [];
    Storage.prototype.setItem = function (key, value) {
      window.__storageWrites.push(key);
      return original.call(this, key, value);
    };
  });

  try {
    await require("./smoke-steps.cjs")({ page, base, check, num, consoleErrors, failedRequests });
  } catch (error) {
    failures += 1;
    console.log("  FAIL exception: " + error.message);
  } finally {
    await browser.close();
    server.close();
  }

  if (consoleErrors.length) consoleErrors.forEach((e) => console.log("  console: " + e));
  if (failedRequests.length) failedRequests.forEach((r) => console.log("  request: " + r));
  if (pendingAssets.length) {
    console.log(
      "  pending artwork (" +
        pendingAssets.length +
        "): " +
        pendingAssets.join(", ") +
        ". Drop the files in /assets to clear",
    );
  }
  console.log(failures === 0 ? "\nSmoke test passed." : "\n" + failures + " smoke check(s) failed.");
  process.exit(failures === 0 ? 0 : 1);
})();
