/** Shapes for everything the repo stores as data — the TOML files and recipe frontmatter.
 *
 * Standalone `zod`, deliberately not `astro/zod`: the calculator imports these schemas and must
 * not acquire a dependency on the website. `src/content.config.ts` imports them the other way
 * round, which is the direction that is allowed to couple.
 *
 * The date schemas reject rather than merely normalise. `check.py` got that for free — pyyaml
 * handed back a `date` for a real date and a plain string for `2026-13-45`, so an `isinstance`
 * test caught the typo. Under "ISO strings end to end" nothing catches it unless the schema does.
 */

import { z } from "zod";
import { isIsoDate } from "./dates.ts";

/** A real calendar date, however the parser chose to hand it over. */
export const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))
  .refine(isIsoDate, "expected a real calendar date, YYYY-MM-DD");

/** The same, for fields that are legitimately empty until the batch reaches that milestone.
 *
 * `poured:` and `cut:` sit in the template as bare keys with no value, and a Draft may omit them
 * altogether — both mean "hasn't happened yet" and both normalise to `null`. What is *not*
 * tolerated is a value that is present and malformed.
 */
export const isoDateOrNull = z
  .union([z.string(), z.date(), z.null()])
  .nullish()
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? null)))
  .refine((v) => v === null || isIsoDate(v), "expected a real calendar date, YYYY-MM-DD");

// --- reference/sap-values.toml ----------------------------------------------

export const oilDef = z.object({
  label: z.string(),
  naoh_sap: z.number().positive(),
  density_g_per_ml: z.number().positive(),
  soapcalc_entry: z.string(),
  notes: z.string().optional(),
});

export const componentDef = z.object({
  density_g_per_ml: z.number().positive(),
  notes: z.string().optional(),
});

export const densityRow = z.object({
  naoh_fraction: z.number(),
  density: z.number().positive(),
});

export const sapFile = z.object({
  lye_solution_density: z.array(densityRow).min(2),
  oils: z.record(z.string(), oilDef),
  components: z.record(z.string(), componentDef),
});

// --- inventory/molds.toml ---------------------------------------------------

export const mold = z.object({
  label: z.string(),
  type: z.enum(["loaf", "cavity"]),
  construction: z.string(),
  cavities: z.number().int().positive().optional(),
  cavity_in: z.object({ length: z.number(), width: z.number(), height: z.number() }),
  cavity_ml: z.number().positive(),
  cavity_ml_each: z.number().positive().optional(),
  lid: z.boolean(),
  max_fill_pct: z.number().positive().optional(),
  fill_evidence: z.string().optional(),
  notes: z.string().optional(),
  capacity_note: z.string().optional(),
});

export const moldsFile = z.object({
  molds: z.record(z.string(), mold),
  cutter: z.looseObject({ label: z.string() }).optional(),
});

// --- inventory/fragrances.toml ----------------------------------------------

export const fragranceUse = z.object({ batch: z.number().int().positive(), g: z.number() });

export const fragrance = z.object({
  label: z.string(),
  brand: z.string(),
  kind: z.string(),
  initial_g: z.number(),
  used: z.array(fragranceUse).default([]),
  remaining_g: z.number(),
  vanillin: z.string().optional(),
  max_usage_pct: z.string().optional(),
  behavior: z.string().optional(),
  scent: z.string().optional(),
  status: z.string().optional(),
});

export const fragrancesFile = z.object({ fragrances: z.record(z.string(), fragrance) });

// --- inventory/staples.toml -------------------------------------------------

export const stapleOil = z.object({
  sap_ref: z.string(),
  grade: z.string().optional(),
  role: z.string(),
  house_range_pct: z.tuple([z.number(), z.number()]),
  ceiling_note: z.string().optional(),
});

export const additive = z.object({
  label: z.string(),
  role: z.string(),
  rate_pct_of_oils: z.number().optional(),
  rate_ml_per_1000g_oils: z.number().optional(),
  rate_g_per_900g_oils: z.number().optional(),
  rate_evidence: z.string().optional(),
  grind: z.string().optional(),
  method_note: z.string().optional(),
  ceiling_note: z.string().optional(),
  status: z.string().optional(),
});

export const staplesFile = z.object({
  oils: z.record(z.string(), stapleOil),
  additives: z.record(z.string(), additive),
  lye: z.record(z.string(), z.looseObject({ label: z.string() })).optional(),
  water: z.record(z.string(), z.looseObject({ label: z.string() })).optional(),
});

// --- inventory/equipment.toml -----------------------------------------------

const equipmentItem = z.looseObject({ label: z.string(), use: z.string().optional() });

export const equipmentFile = z.object({
  current: z.object({
    vessels: z.record(z.string(), equipmentItem),
    tools: z.array(equipmentItem).default([]),
    cutting: z.array(equipmentItem).default([]),
    safety: z.array(equipmentItem).default([]),
  }),
  superseded: z
    .array(
      z.looseObject({
        label: z.string(),
        was: z.string(),
        eras: z.string(),
        replaced_by: z.string(),
        why: z.string().optional(),
      }),
    )
    .default([]),
});

// --- recipe frontmatter -----------------------------------------------------

export const STATUSES = ["draft", "ready", "curing", "cured", "abandoned", "failed"] as const;
export const POURED_STATUSES = ["curing", "cured", "failed"] as const;
export const PROFILES = ["body", "hand"] as const;

export type Status = (typeof STATUSES)[number];

/** True for a status that means the batter actually went into a mold. */
export function isPoured(status: Status): boolean {
  return (POURED_STATUSES as readonly string[]).includes(status);
}

export const recipeFragrance = z.object({ id: z.string(), g: z.number() });

export const recipeFrontmatter = z.object({
  batch: z.number().int().positive(),
  status: z.enum(STATUSES),
  mold: z.string(),
  profile: z.enum(PROFILES),
  parent: z.number().int().positive().nullable().default(null),

  created: isoDate,
  poured: isoDateOrNull,
  cut: isoDateOrNull,

  oils_g: z.number().positive(),
  superfat_pct: z.number(),
  water_pct: z.number(),
  oils: z.record(z.string(), z.number()),

  lye_g: z.number(),
  /** Set only on a recipe whose as-made lye is a preserved mistake (Batch #3). */
  lye_g_correct: z.number().optional(),
  soapcalc_confirmed: z.boolean().default(false),

  fill_pct: z.number(),
  overflowed: z.boolean().default(false),

  fragrance: z.array(recipeFragrance).default([]),
  yield: z
    .object({ bars: z.number().int().nonnegative(), cut_in: z.number().nullable().default(null) })
    .optional(),
});

// --- inferred types ---------------------------------------------------------

export type OilDef = z.infer<typeof oilDef>;
export type ComponentDef = z.infer<typeof componentDef>;
export type DensityRow = z.infer<typeof densityRow>;
export type Sap = z.infer<typeof sapFile>;
export type Mold = z.infer<typeof mold>;
export type Molds = z.infer<typeof moldsFile>;
export type Fragrance = z.infer<typeof fragrance>;
export type Fragrances = z.infer<typeof fragrancesFile>;
export type Staples = z.infer<typeof staplesFile>;
export type Equipment = z.infer<typeof equipmentFile>;
export type RecipeFrontmatter = z.infer<typeof recipeFrontmatter>;

/** Value at a zod issue path, or `undefined` if nothing is there. */
function valueAt(input: unknown, path: PropertyKey[]): unknown {
  let cursor = input;
  for (const key of path) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<PropertyKey, unknown>)[key];
  }
  return cursor;
}

/** Flatten a zod failure into the one-line-per-problem shape the archive lint prints.
 *
 * An absent field reads as "missing frontmatter field 'x'" rather than zod's "expected number,
 * received undefined" — the lint is read by a human looking for what to go fix.
 */
export function issueLines(error: z.ZodError, input: unknown): string[] {
  return error.issues.map((i) => {
    const where = i.path.length ? i.path.map(String).join(".") : "(root)";
    if (i.code === "invalid_type" && valueAt(input, i.path) === undefined) {
      return `missing frontmatter field '${where}'`;
    }
    return `frontmatter '${where}': ${i.message}`;
  });
}
