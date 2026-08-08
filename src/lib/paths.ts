/** Where things live, resolved from this file rather than from the shell.
 *
 * The calculator gets run from wherever the terminal happens to be sitting — the repo root,
 * `tools/`, somewhere else entirely — so every path is derived from `import.meta.url`.
 * Never `process.cwd()`.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const SAP_PATH = path.join(ROOT, "reference", "sap-values.toml");
export const MOLDS_PATH = path.join(ROOT, "inventory", "molds.toml");
export const FRAGRANCES_PATH = path.join(ROOT, "inventory", "fragrances.toml");
export const STAPLES_PATH = path.join(ROOT, "inventory", "staples.toml");
export const EQUIPMENT_PATH = path.join(ROOT, "inventory", "equipment.toml");

export const RECIPES_DIR = path.join(ROOT, "recipes");
export const DOCS_DIR = path.join(ROOT, "docs");

/** Recipe files are `NNN-slug.md`; `README.md` and anything else in the directory is not a batch. */
export const RECIPE_FILE_RE = /^\d{3}-.+\.md$/;
