/**
 * Concatenates build-fragments/app-*.js into app.js (explicit order).
 * Usage: node scripts/build-app.cjs
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const fragmentDir = path.join(root, "build-fragments");
const order = [
  "app-01.js",
  "app-10.js",
  "app-20.js",
  "app-30.js",
  "app-40.js",
  "app-50.js",
  "app-60.js",
  "app-70.js",
  "app-80.js",
  "app-90.js",
  "app-92.js",
  "app-95.js",
  "app-99.js",
];

const missing = order.filter((file) => !fs.existsSync(path.join(fragmentDir, file)));
if (missing.length) {
  console.log("Missing fragments: " + missing.join(", "));
  process.exit(1);
}

const source = order
  .map((file) => fs.readFileSync(path.join(fragmentDir, file), "utf8").replace(/\s+$/, ""))
  .join("\n");

fs.writeFileSync(path.join(root, "app.js"), source + "\n");

try {
  execFileSync(process.execPath, ["--check", path.join(root, "app.js")], { stdio: "pipe" });
} catch (error) {
  console.log("app.js syntax error:\n" + String(error.stderr || error.message));
  process.exit(1);
}

console.log("app.js built from " + order.length + " fragments (" + source.split("\n").length + " lines).");
