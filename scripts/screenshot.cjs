/**
 * Visual check: screenshots of the finished pages in light and dark themes.
 * Usage: node scripts/screenshot.cjs  (writes PNGs to dist/)
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const puppeteer = require("puppeteer-core");

const root = path.join(__dirname, "..");
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".xml": "application/xml",
  ".txt": "text/plain",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let target = decodeURIComponent(req.url.split("?")[0]);
  if (target.endsWith("/")) target += "index.html";
  const file = path.join(root, target);
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(fs.readFileSync(file));
});

server.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--no-sandbox"],
  });

  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });
    await page.evaluateOnNewDocument((value) => {
      localStorage.setItem("theme", value);
    }, theme);
    await page.goto(base + "/", { waitUntil: "networkidle2" });
    await sleep(1200);
    await page.evaluate(() => {
      document.getElementById("cashHeld").value = "25000";
      document.getElementById("cashHeld").dispatchEvent(new Event("input", { bubbles: true }));
      document.getElementById("cashBank").value = "185000";
      document.getElementById("cashBank").dispatchEvent(new Event("input", { bubbles: true }));
      const gold = document.getElementById("goldGrams");
      gold.value = "45";
      gold.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await sleep(600);
    await page.evaluate(() => {
      document.querySelectorAll("[data-reveal]").forEach((node) => {
        node.setAttribute("data-revealed", "true");
      });
    });
    await sleep(300);
    await page.screenshot({ path: path.join(root, "dist", "preview-" + theme + ".png"), fullPage: true });
    console.log("wrote dist/preview-" + theme + ".png");
    await page.close();
  }

  const faqPage = await browser.newPage();
  await faqPage.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });
  await faqPage.goto(base + "/faq/", { waitUntil: "networkidle2" });
  await sleep(800);
  await faqPage.screenshot({ path: path.join(root, "dist", "preview-faq.png"), fullPage: false });
  console.log("wrote dist/preview-faq.png");

  await browser.close();
  server.close();
});
