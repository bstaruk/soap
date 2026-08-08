/** Reading the repo: the TOML inventory, the SAP table, and recipe frontmatter.
 *
 * One loader per file, shared by the CLI tools and the site, so the website and the kitchen
 * calculator can never disagree about what is in the cabinet. Everything is validated on the
 * way in — an unvalidated read is how a typo becomes a number nobody checked.
 */

import fs from "node:fs";
import path from "node:path";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";

import {
  EQUIPMENT_PATH,
  FRAGRANCES_PATH,
  MOLDS_PATH,
  RECIPES_DIR,
  RECIPE_FILE_RE,
  SAP_PATH,
  STAPLES_PATH,
} from "./paths.ts";
import {
  equipmentFile,
  fragrancesFile,
  moldsFile,
  recipeFrontmatter,
  sapFile,
  staplesFile,
  type Equipment,
  type Fragrances,
  type Molds,
  type RecipeFrontmatter,
  type Sap,
  type Staples,
} from "./schema.ts";
import type { z } from "zod";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

function readToml<T>(file: string, schema: z.ZodType<T>): T {
  const raw = parseToml(fs.readFileSync(file, "utf8"));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`${path.basename(file)} does not match its schema:\n${issues}`);
  }
  return parsed.data;
}

export const loadSap = (): Sap => readToml(SAP_PATH, sapFile);
export const loadMolds = (): Molds => readToml(MOLDS_PATH, moldsFile);
export const loadFragrances = (): Fragrances => readToml(FRAGRANCES_PATH, fragrancesFile);
export const loadStaples = (): Staples => readToml(STAPLES_PATH, staplesFile);
export const loadEquipment = (): Equipment => readToml(EQUIPMENT_PATH, equipmentFile);

// --- recipes ----------------------------------------------------------------

/** A recipe file split into its two halves, with frontmatter parsed but not yet validated.
 *
 * The archive lint wants the unvalidated form so it can report schema problems as its own
 * findings rather than dying on the first bad file.
 */
export interface RawRecipe {
  slug: string;
  fileName: string;
  path: string;
  batch: number;
  frontmatter: unknown;
  body: string;
}

export interface Recipe {
  slug: string;
  fileName: string;
  url: string;
  fm: RecipeFrontmatter;
  body: string;
}

/** Recipe file paths, sorted by batch — `README.md` and anything else is not a batch. */
export function recipeFiles(): string[] {
  return fs
    .readdirSync(RECIPES_DIR)
    .filter((name) => RECIPE_FILE_RE.test(name))
    .sort()
    .map((name) => path.join(RECIPES_DIR, name));
}

export function splitFrontmatter(text: string): { frontmatter: unknown; body: string } | null {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) return null;
  return { frontmatter: parseYaml(match[1]), body: text.slice(match[0].length) };
}

export function readRecipes(): RawRecipe[] {
  return recipeFiles().map((file) => {
    const fileName = path.basename(file);
    const slug = fileName.replace(/\.md$/, "");
    const text = fs.readFileSync(file, "utf8");
    const split = splitFrontmatter(text);
    return {
      slug,
      fileName,
      path: file,
      batch: Number(fileName.slice(0, 3)),
      frontmatter: split ? split.frontmatter : null,
      body: split ? split.body : text,
    };
  });
}

/** Validated recipes. Throws on the first file that does not match the schema. */
export function loadRecipes(): Recipe[] {
  return readRecipes().map((raw) => {
    const parsed = recipeFrontmatter.safeParse(raw.frontmatter);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("\n");
      throw new Error(`${raw.fileName} frontmatter does not match its schema:\n${issues}`);
    }
    return {
      slug: raw.slug,
      fileName: raw.fileName,
      url: `/recipes/${raw.slug}/`,
      fm: parsed.data,
      body: raw.body,
    };
  });
}

/** Batch number -> recipe. A `Map`, because a plain object would silently reorder integer keys. */
export function byBatch(recipes: Recipe[]): Map<number, Recipe> {
  return new Map(recipes.map((r) => [r.fm.batch, r]));
}
