/**
 * Assembles index.html from s:head.html + build-fragments (explicit order).
 * Usage: node scripts/build-html.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const order = [
  "81-intro",
  "82-hero",
  "83-rates",
  "84-asset-cash",
  "85-asset-metals",
  "86-asset-investments",
  "87-asset-business-debts",
  "88-zakat-result",
  "90-main-tail",
  "91-footer",
  "92-more-sheet",
  "93-currency-sheet",
  "94-modals",
  "89-about-modal",
  "95-scripts",
];

const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\s+$/, "");
const head = read("s/head.html");
const parts = order.map((name) => read("build-fragments/" + name + ".html"));
const html = head + "\n" + parts.join("\n") + "\n";

fs.writeFileSync(path.join(root, "index.html"), html);

/* FAQ page: same builder, different fragment set. */
const faqOrder = [
  "s/faq-head.html",
  "s/faq-basics.html",
  "s/faq-metals.html",
  "s/faq-privacy.html",
  "s/faq-accuracy.html",
  "s/faq-scripts.html",
];
const faqHtml = faqOrder.map(read).join("\n") + "\n";
fs.mkdirSync(path.join(root, "faq"), { recursive: true });
fs.writeFileSync(path.join(root, "faq/index.html"), faqHtml);

/* Light structural validation so a broken fragment never ships. */
const VOID_TAGS = new Set([
  "meta", "link", "input", "br", "img", "hr", "source", "area", "base", "col", "embed", "param", "track", "wbr",
]);
function validate(html) {
  const problems = [];
  const stack = [];
  /* Raw-text elements: their bodies are not markup (JSON-LD strings may contain
     "<", inline JS may contain "<"). Skip the body, keep the tags. */
  const RAW_TEXT = new Set(["script", "style"]);
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^<>]*?)>/g;
  /* A closing raw-text tag is the string alone: "</script>" inside a JSON
     value always continues with a quote, comma or brace before ">". */
  const endTagRe = new RegExp("<\\/(" + [...RAW_TEXT].join("|") + ")>", "g");
  const rawEnds = [];
  let endMatch;
  while ((endMatch = endTagRe.exec(html))) rawEnds.push({ tag: endMatch[1], at: endMatch.index });

  let match;
  let rawCursor = 0;
  while ((match = tagRe.exec(html))) {
    const [, closing, rawTag, attrs] = match;
    const tag = rawTag.toLowerCase();
    const selfClose = /\/\s*$/.test(attrs);
    if (VOID_TAGS.has(tag) || selfClose) continue;
    if (!closing && RAW_TEXT.has(tag)) {
      /* Jump the token cursor past the element's real end tag, then let the
         loop continue from there so </script> itself is still matched. */
      while (rawCursor < rawEnds.length && rawEnds[rawCursor].at < tagRe.lastIndex) rawCursor += 1;
      const end = rawEnds[rawCursor];
      tagRe.lastIndex = end ? end.at : html.length;
      stack.push({ tag, attrs });
      stack.push({ tag, attrs, rawEnd: true });
      continue;
    }
    if (closing && RAW_TEXT.has(tag) && stack.length && stack[stack.length - 1].rawEnd) {
      stack.pop();
      stack.pop();
      rawCursor += 1;
      continue;
    }
    if (!closing) {
      stack.push({ tag, attrs });
      continue;
    }
    const top = stack.pop();
    if (!top) problems.push("extra closing </" + tag + ">");
    else if (top.tag !== tag) problems.push("mismatch <" + top.tag + "> closed by </" + tag + ">");
  }
  stack.forEach((entry) => problems.push("unclosed <" + entry.tag + ">"));

  const ids = (html.match(/\sid="([^"]+)"/g) || []).map((m) => m.slice(5, -1));
  const dupes = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (dupes.length) problems.push("duplicate ids: " + [...new Set(dupes)].join(", "));
  if (/\b(bootstrap|cdn\.jsdelivr\.net\/npm\/bootstrap)\b/i.test(html)) {
    problems.push("Bootstrap reference found");
  }
  return { problems, ids };
}

const { problems, ids } = validate(html);
problems.forEach((problem) => console.log("  " + problem));
console.log(
  problems.length === 0
    ? "index.html built: " + ids.length + " ids, structure valid."
    : "index.html built with " + problems.length + " problem(s).",
);
process.exit(problems.length === 0 ? 0 : 1);
