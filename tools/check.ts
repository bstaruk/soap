/** The archive lint — prove every recipe's frozen numbers still reproduce, on every push.
 *
 * This is CI enforcement for the hard rules in CLAUDE.md:
 *
 *   1. Every recipe's lye_g and fill_pct are re-derived through src/lib/calc.ts's compute() from
 *      the recipe's own frontmatter inputs. A mismatch means either the recipe carries a number
 *      the calculator didn't produce, or reference/sap-values.toml drifted — and per doctrine,
 *      touching the SAP table invalidates the cross-check behind every Ready recipe. Either way
 *      the build goes red instead of quietly publishing a wrong number.
 *
 *      Batch #3 is the deliberate exception that proves the rule: its recorded lye was scaled,
 *      not calculated, and its frontmatter says so (`lye_g_correct`, `overflowed`). The lint
 *      checks the annotation, not the mistake — the cautionary tale stays frozen in the archive.
 *
 *   2. Frontmatter is schema-checked and cross-file references hold: mold and fragrance ids
 *      exist in inventory, oils sum to 100, lifecycle fields match status, and every poured
 *      recipe's fragrance weights agree with the ledger in inventory/fragrances.toml.
 *
 * Well-formedness is the schema's job, not this file's. src/lib/schema.ts rejects a date like
 * `2026-13-45` outright, which is what pyyaml's date type used to do for the Python version by
 * accident of typing — a presence check alone would wave the typo through.
 *
 * Read-only. Exits non-zero on any failure. Run alongside `lye.ts --self-check`, not instead.
 *
 * Usage:
 *   node tools/check.ts
 */

import { compute } from "../src/lib/calc.ts";
import {
  loadFragrances,
  loadMolds,
  loadSap,
  readRecipes,
  type RawRecipe,
} from "../src/lib/data.ts";
import { fixed } from "../src/lib/report.ts";
import {
  isPoured,
  issueLines,
  recipeFrontmatter,
  type Fragrances,
  type Molds,
  type Sap,
} from "../src/lib/schema.ts";

/** fill_pct is recorded to one decimal, so recomputation may differ by up to half a tenth. */
const FILL_TOLERANCE = 0.06;

interface Context {
  sap: Sap;
  molds: Molds;
  fragrances: Fragrances;
  batches: Set<number>;
}

function checkRecipe(raw: RawRecipe, ctx: Context): string[] {
  const errors: string[] = [];

  if (raw.frontmatter === null) return ["no frontmatter block"];
  const parsed = recipeFrontmatter.safeParse(raw.frontmatter);
  if (!parsed.success) return issueLines(parsed.error, raw.frontmatter);
  const fm = parsed.data;
  const body = raw.body;

  // --- schema and identity ---
  if (!raw.fileName.startsWith(`${String(fm.batch).padStart(3, "0")}-`)) {
    errors.push(`batch ${fm.batch} does not match filename prefix ${raw.fileName.slice(0, 3)}`);
  }
  if (fm.parent !== null && !ctx.batches.has(fm.parent)) {
    errors.push(`parent batch ${fm.parent} does not exist`);
  }

  let moldKey: string | null = fm.mold;
  if (!Object.hasOwn(ctx.molds.molds, moldKey)) {
    errors.push(`mold '${moldKey}' not in inventory/molds.toml`);
    moldKey = null;
  }

  const oilSum = Object.values(fm.oils).reduce((total, pct) => total + pct, 0);
  if (Object.keys(fm.oils).length && Math.abs(oilSum - 100) > 0.01) {
    errors.push(`oil percentages sum to ${oilSum}, not 100`);
  }

  for (const f of fm.fragrance) {
    if (!Object.hasOwn(ctx.fragrances.fragrances, f.id)) {
      errors.push(`fragrance '${f.id}' not in inventory/fragrances.toml`);
    }
  }

  // --- lifecycle invariants ---
  if (fm.status === "ready" && fm.soapcalc_confirmed !== true) {
    errors.push("status 'ready' without soapcalc_confirmed: true — the one gate that matters");
  }
  if (isPoured(fm.status) && !fm.poured) {
    errors.push(`status '${fm.status}' without a poured date`);
  }
  if (["draft", "ready", "abandoned"].includes(fm.status) && fm.poured) {
    errors.push(`status '${fm.status}' but poured is set — a poured recipe is curing/cured/failed`);
  }
  if (fm.status === "cured" && !fm.cut) {
    errors.push("status 'cured' without a cut date — the cure clock never started");
  }
  // ISO strings compare lexicographically, which is the whole reason they are ISO strings.
  const real = [fm.created, fm.poured, fm.cut].filter((d): d is string => typeof d === "string");
  if (real.join("|") !== [...real].sort().join("|")) {
    errors.push("dates out of order (created <= poured <= cut)");
  }
  if (!body.includes("## Outcome")) {
    errors.push("body has no '## Outcome' section");
  }

  // --- the numbers: re-derive through the calculator ---
  if (errors.length) return errors; // inputs unusable; recompute would just cascade noise

  const fragranceG = fm.fragrance.reduce((total, f) => total + f.g, 0);
  let r;
  try {
    r = compute({
      oilsG: fm.oils_g,
      blendPct: fm.oils,
      superfatPct: fm.superfat_pct,
      waterPct: fm.water_pct,
      fragranceG,
      moldKey,
      sap: ctx.sap,
      molds: ctx.molds,
    });
  } catch (err) {
    return [`calculator rejected the frontmatter: ${err instanceof Error ? err.message : err}`];
  }

  // lye_g_correct marks a recipe whose as-made lye is a preserved mistake; the calculator
  // must reproduce the annotation. Everywhere else it must reproduce lye_g itself.
  const recordedLye = fm.lye_g_correct ?? fm.lye_g;
  if (r.lyeGRounded !== recordedLye) {
    errors.push(
      `lye does not reproduce: calculator says ${r.lyeGRounded}g, frontmatter records ${recordedLye}g` +
        " — recipe error or SAP-table drift; neither ships",
    );
  }

  const fill = r.mold!.fillPct;
  if (Math.abs(fill - fm.fill_pct) > FILL_TOLERANCE) {
    errors.push(
      `fill does not reproduce: calculator says ${fixed(fill, 1)}%, frontmatter records ${fm.fill_pct}%`,
    );
  }
  if (fm.overflowed === r.mold!.fits) {
    errors.push(
      fm.overflowed
        ? "overflowed: true but the calculator says it fits"
        : `fill ${fixed(fill, 1)}% exceeds the ${r.mold!.maxFillPct}% ceiling with no overflowed flag`,
    );
  }

  // --- fragrance ledger cross-check (poured recipes only; drafts consumed nothing) ---
  if (isPoured(fm.status)) {
    for (const f of fm.fragrance) {
      const ledger = ctx.fragrances.fragrances[f.id].used;
      const entry = ledger.find((u) => u.batch === fm.batch);
      if (entry === undefined) {
        errors.push(`poured, but fragrance '${f.id}' has no ledger entry for batch ${fm.batch}`);
      } else if (entry.g !== f.g) {
        errors.push(
          `fragrance '${f.id}': recipe says ${f.g}g, ledger says ${entry.g}g for batch ${fm.batch}`,
        );
      }
    }
  }
  return errors;
}

/** Every ledger debit must point at a real batch — retro debits at pour, nothing else does. */
function checkLedgerOrphans(fragrances: Fragrances, batches: Set<number>): string[] {
  const errors: string[] = [];
  for (const [key, f] of Object.entries(fragrances.fragrances)) {
    for (const u of f.used) {
      if (!batches.has(u.batch)) {
        errors.push(`fragrances.toml: '${key}' ledger references nonexistent batch ${u.batch}`);
      }
    }
  }
  return errors;
}

export function main(): number {
  const recipes = readRecipes();
  const ctx: Context = {
    sap: loadSap(),
    molds: loadMolds(),
    fragrances: loadFragrances(),
    batches: new Set(recipes.map((r) => r.batch)),
  };

  console.log("Archive lint — re-deriving every recipe's numbers through the calculator.\n");
  let failures = 0;

  for (const raw of recipes) {
    const errors = checkRecipe(raw, ctx);
    console.log(`  ${errors.length ? "FAIL" : "OK "}  ${raw.fileName}`);
    for (const e of errors) console.log(`        - ${e}`);
    failures += errors.length;
  }

  const orphans = checkLedgerOrphans(ctx.fragrances, ctx.batches);
  for (const e of orphans) console.log(`  FAIL  ${e}`);
  failures += orphans.length;

  console.log();
  if (failures) {
    console.log(
      `${failures} problem(s). The archive and the calculator disagree — nothing deploys until they agree.`,
    );
    return 1;
  }
  console.log(
    `All ${recipes.length} recipes reproduce: lye, fill, lifecycle, and the fragrance ledger all agree.`,
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`check: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 2;
}
