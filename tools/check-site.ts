/** The build lint — prove the published site still has the properties it is published for.
 *
 * `tools/check.ts` proves the archive's numbers. This proves the *output*: that the URLs did not
 * move, that the Atom ids did not change, and that a recipe page still prints as a kitchen sheet.
 *
 * The print check is the reason this file exists. A recipe gets printed and carried to a pot of
 * lye, and a closed `<details>` does not print its contents — so the page carries a one-line
 * `.safety-print` reminder that the print stylesheet reveals as it hides the collapsed version.
 * That is easy to verify by eye once and easy to lose silently forever after. Here it is a build
 * step instead.
 *
 * Read-only. Exits non-zero on any failure. Run after `astro build`.
 *
 * Usage:
 *   node tools/check-site.ts [dist]
 */

import fs from "node:fs";
import path from "node:path";

import { ROOT } from "../src/lib/paths.ts";
import { readRecipes } from "../src/lib/data.ts";

const dist = path.resolve(ROOT, process.argv[2] ?? "dist");

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

function read(relative: string): string | null {
  const file = path.join(dist, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

// --- the published URL set ---------------------------------------------------

const slugs = readRecipes().map((r) => r.slug);
const expected = [
  "index.html",
  "inventory/index.html",
  "method/index.html",
  "formulation/index.html",
  "404.html", // GitHub Pages needs this filename at the root, not 404/index.html
  "feed.xml",
  ...slugs.map((slug) => `recipes/${slug}/index.html`),
];

for (const relative of expected) {
  if (read(relative) === null) fail(`missing ${relative}`);
}

// --- the feed's identity -----------------------------------------------------

const feed = read("feed.xml");
if (feed) {
  for (const slug of slugs) {
    const id = `<id>tag:soap.brian.staruk.net,2026:/recipes/${slug}/</id>`;
    if (!feed.includes(id))
      fail(`feed.xml has no entry id for ${slug} — readers would re-issue it`);
  }
  if (!feed.includes("<id>tag:soap.brian.staruk.net,2026:/</id>")) fail("feed.xml has no feed id");
}

// --- the printed kitchen sheet -----------------------------------------------

// Astro inlines the stylesheet when it is small enough, so look in both places.
function stylesheetsFor(html: string): string[] {
  const sheets = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
    const css = read(m[1].replace(/^\//, ""));
    if (css !== null) sheets.push(css);
  }
  return sheets;
}

const HIDE_COLLAPSED = /\.safety\s*\{[^}]*display:\s*none/;
const SHOW_ONE_LINER = /\.safety-print\s*\{[^}]*display:\s*block/;

for (const slug of slugs) {
  const relative = `recipes/${slug}/index.html`;
  const html = read(relative);
  if (html === null) continue;

  if (!html.includes('class="safety-print"')) {
    fail(`${relative}: no .safety-print line — the printed sheet would carry no safety reminder`);
  }

  const printBlocks = stylesheetsFor(html)
    .flatMap((css) => [...css.matchAll(/@media\s+print\s*\{([\s\S]*)/g)])
    .map((m) => m[1]);
  if (printBlocks.length === 0) {
    fail(`${relative}: no @media print block in any stylesheet`);
  } else if (
    !printBlocks.some((block) => HIDE_COLLAPSED.test(block) && SHOW_ONE_LINER.test(block))
  ) {
    fail(`${relative}: the print block does not hide .safety and reveal .safety-print`);
  }
}

// --- report ------------------------------------------------------------------

console.log("Build lint — re-checking the published URLs, the feed ids, and the printed sheet.\n");
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n${failures.length} problem(s). The build is not the site that was published.`);
  process.exitCode = 1;
} else {
  console.log(`  OK   ${expected.length} published paths, all present`);
  console.log(`  OK   ${slugs.length} Atom entry ids unchanged`);
  console.log(`  OK   ${slugs.length} recipe pages print with the safety reminder`);
  console.log("\nThe site still has the shape it publishes under.");
}
