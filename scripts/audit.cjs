/**
 * Privacy audit + DOM contract check.
 *  - No sessionStorage / IndexedDB / cookies / URL writes anywhere in shipped JS.
 *  - localStorage is limited to the four documented preference keys.
 *  - Every getElementById target in app.js exists in index.html.
 * Usage: node scripts/audit.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const jsFiles = ["app.js", "currency-service.js", "zakat-engine.js", "theme.js", "theme-init.js"];
const allJs = jsFiles.map((file) => ({ file, source: read(file) }));
const html = read("index.html");
const faqHtml = read("faq/index.html");

const problems = [];
const notes = [];

/* 1. Forbidden storage APIs */
const forbidden = [
  [/sessionStorage/, "sessionStorage"],
  [/\bindexedDB\b|\bIDBFactory\b/, "IndexedDB"],
  [/document\.cookie/, "document.cookie"],
  [/history\.(pushState|replaceState)/, "history mutation"],
  [/location\.(hash|search)\s*=/, "URL mutation"],
  [/\.sendBeacon\(/, "sendBeacon"],
  [/new\s+WebSocket\(/, "WebSocket"],
];
allJs.forEach(({ file, source }) => {
  forbidden.forEach(([pattern, label]) => {
    if (pattern.test(source)) problems.push(file + " uses " + label);
  });
});

/* 2. localStorage keys must be whitelisted */
const allowedKeys = new Set([
  "theme",
  "zakatday-currency",
  "zakatday-favorites",
  "zakatday-nisab-standard",
]);
const keyLiterals = new Set();
allJs.forEach(({ file, source }) => {
  const re = /localStorage\.(getItem|setItem|removeItem)\(\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(source))) {
    keyLiterals.add(match[2]);
  }
  // Dynamic keys (e.g. STORAGE_KEYS.currency) are declared as string literals nearby.
  const decl = /(\w+):\s*"(zakatday-[a-z-]+)"/g;
  while ((match = decl.exec(source))) keyLiterals.add(match[2]);
});
[...keyLiterals].forEach((key) => {
  if (!allowedKeys.has(key)) problems.push('unexpected localStorage key "' + key + '"');
});

/* 3. Amount inputs must never be read into any persisted value */
if (/localStorage\.setItem\([^)]*input/i.test(read("app.js"))) {
  problems.push("app.js persists an input value");
}

/* 4. DOM contract: every getElementById in app.js must exist in index.html */
const appSource = read("app.js");
const ids = new Set();
const idRe = /getElementById\("([^"]+)"\)/g;
let m;
while ((m = idRe.exec(appSource))) ids.add(m[1]);
const wrapperRe = /\$\("([^"]+)"\)/g;
while ((m = wrapperRe.exec(appSource))) ids.add(m[1]);
const htmlIds = new Set((html.match(/\sid="([^"]+)"/g) || []).map((s) => s.slice(5, -1)));
[...ids].forEach((id) => {
  if (!htmlIds.has(id)) problems.push("app.js references #" + id + " which is missing from index.html");
});

/* 5. Referenced local assets must exist */
const assets = new Set();
[html, faqHtml].forEach((doc) => {
  const re = /(?:href|src)="(\.{1,2}\/[^"]+)"/g;
  let a;
  while ((a = re.exec(doc))) assets.add(a[1]);
});
assets.forEach((asset) => {
  const clean = asset.split("#")[0];
  if (!clean || clean === "./" || clean === "../") return;
  const target = path.normalize(path.join(root, clean.replace(/^\.\//, "")));
  const alt = path.normalize(path.join(root, "faq", clean));
  if (!fs.existsSync(target) && !fs.existsSync(alt)) {
    problems.push("missing local asset " + asset);
  }
});

/* 6. Third-party hosts (informational) */
const hosts = new Set();
[html, faqHtml].forEach((doc) => {
  const re = /https?:\/\/([a-z0-9.-]+\/[^"'\s]*)/gi;
  let h;
  while ((h = re.exec(doc))) hosts.add(h[1].split("/")[0]);
});
allJs.forEach(({ source }) => {
  const re = /https?:\/\/([a-z0-9.-]+)/gi;
  let h;
  while ((h = re.exec(source))) hosts.add(h[1]);
});
notes.push("hosts: " + [...hosts].sort().join(", "));
notes.push("localStorage keys: " + [...keyLiterals].sort().join(", "));
notes.push("getElementById targets checked: " + ids.size);

notes.forEach((note) => console.log("  " + note));
if (problems.length) {
  problems.forEach((problem) => console.log("  FAIL " + problem));
  process.exit(1);
}
console.log("Privacy + DOM contract audit passed.");
