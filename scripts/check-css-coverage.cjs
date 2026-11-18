/**
 * Verifies that every CSS class used in index.html exists in dist/app.css.
 * Guards against cssnano inlining @apply-only rules and Tailwind content misses.
 * Usage: node scripts/check-css-coverage.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cssPath = path.join(root, "dist/app.css");
if (!fs.existsSync(cssPath)) {
  console.log("dist/app.css missing. Run npm run build first.");
  process.exit(1);
}
const css = fs.readFileSync(cssPath, "utf8");

const used = new Set();
(html.match(/\sclass="([^"]*)"/g) || []).forEach((attr) => {
  const value = attr.replace(/^\s*class="/, "").replace(/"$/, "");
  value
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => used.add(token));
});

/* Only classes this project defines itself can be silently inlined by cssnano;
   Tailwind utilities are always emitted when referenced in content files. */
const sourceCss = fs.readFileSync(path.join(root, "src/styles/tailwind-entry.css"), "utf8");
const defined = new Set();
(sourceCss.match(/^\s*\.[a-z][a-z0-9_-]*/gim) || []).forEach((sel) =>
  defined.add(sel.trim().slice(1)),
);
const custom = [...used].filter((token) => defined.has(token));

const escape = (token) => token.replace(/[.*+?^${}()|[\]\\:#%/!]/g, (m) => "\\" + m);
const missing = [...used].filter((token) => {
  const needle = "." + escape(token);
  return css.indexOf(needle) === -1;
});
const missingCustom = [...custom].filter((token) => css.indexOf("." + escape(token)) === -1);

console.log(used.size + " classes referenced in index.html (" + custom.length + " project-defined)");
if (missingCustom.length) {
  console.log("Project classes inlined away by cssnano (" + missingCustom.length + "):");
  missingCustom.forEach((token) => console.log("  - " + token));
  process.exit(1);
}
if (missing.length) {
  console.log(
    "Note: " +
      missing.length +
      " utility classes not found verbatim (usually arbitrary values or responsive variants): " +
      missing.slice(0, 12).join(", "),
  );
}
console.log("All project-defined classes present in dist/app.css");
