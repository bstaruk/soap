/** Where things live, resolved from this file rather than from the shell.
 *
 * The calculator gets run from wherever the terminal happens to be sitting — the repo root,
 * `tools/`, somewhere else entirely — so the root is derived from `import.meta.url`, never from
 * `process.cwd()`.
 *
 * It is a search rather than a fixed `../..` because this module has two homes. Run directly it
 * sits in `src/lib/`; inside an Astro build Vite bundles it into `dist/.prerender/chunks/`, where
 * two levels up is `dist/` and every data read would miss. Walking up to the directory that
 * actually holds the SAP table finds the repo from either.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The one file that is only ever at the repo root, and is load-bearing enough to be the marker. */
const ROOT_MARKER = path.join("reference", "sap-values.toml");

function findRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, ROOT_MARKER))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`could not find the repo root above ${start} — no ${ROOT_MARKER}`);
    }
    dir = parent;
  }
}

export const ROOT = findRoot(path.dirname(fileURLToPath(import.meta.url)));

export const SAP_PATH = path.join(ROOT, "reference", "sap-values.toml");
export const MOLDS_PATH = path.join(ROOT, "inventory", "molds.toml");
export const FRAGRANCES_PATH = path.join(ROOT, "inventory", "fragrances.toml");
export const STAPLES_PATH = path.join(ROOT, "inventory", "staples.toml");
export const EQUIPMENT_PATH = path.join(ROOT, "inventory", "equipment.toml");

export const RECIPES_DIR = path.join(ROOT, "recipes");
export const DOCS_DIR = path.join(ROOT, "docs");

/** Recipe files are `NNN-slug.md`; `README.md` and anything else in the directory is not a batch. */
export const RECIPE_FILE_RE = /^\d{3}-.+\.md$/;
