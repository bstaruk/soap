/** The soap calculator — lye, water, mold fill, and yield for a cold-process batch.
 *
 * Why this exists: Claude does not do lye arithmetic, and a hobbyist triple-checking on
 * SoapCalc is a second opinion, not a first line of defense. This script is the first line.
 * It reads the SAP table and mold data that the rest of the repo trusts, produces every number
 * a recipe needs, and re-proves itself against six real batches on every `--self-check` run.
 *
 * It answers two questions the eye cannot:
 *
 *   1. How much lye? Wrong here means a caustic bar or a greasy one. The SAP table is pinned to
 *      SoapCalc (reference/sap-values.toml) precisely so this number and the human's cross-check
 *      share a source and can actually agree.
 *
 *   2. Will it fit? Batch #3 overflowed because "63 oz" was read as a volume when it was the
 *      0.4-rule oil weight — and that rule silently over-predicts these water-heavy recipes by
 *      ~10%. This computes real batter volume from real component densities instead.
 *
 * Runs with no build step: Node strips the types and executes the file directly (Node 22.18+).
 * The arithmetic lives in src/lib/calc.ts and is the only source of it in the repo.
 *
 * Usage:
 *   node tools/lye.ts --self-check
 *   node tools/lye.ts --mold nurture-5lb --oils 1600 --blend olive=62,coconut=28,castor=10 \
 *          --superfat 6 --water 38 --fragrance 44
 *   node tools/lye.ts --fit nurture-5lb --blend olive=62,coconut=28,castor=10 --superfat 6 \
 *          --water 38 --fragrance-pct 3 --target-fill 93
 */

import { parseArgs } from "node:util";

import { compute, fitOils } from "../src/lib/calc.ts";
import { loadFragrances, loadMolds, loadSap } from "../src/lib/data.ts";
import { SELF_CHECK } from "../src/lib/fixtures.ts";
import { fixed, formatReport } from "../src/lib/report.ts";
import type { Molds, Sap } from "../src/lib/schema.ts";

const HELP = `Cold-process soap calculator.

  --self-check          re-prove the six historical batches and exit
  --mold MOLD           mold key from inventory/molds.toml
  --oils G              total oil weight in grams
  --blend SPEC          e.g. olive=62,coconut=28,castor=10
  --superfat PCT        superfat % (default 5)
  --water PCT           water as % of oils (default 38)
  --fragrance G         fragrance weight in grams
  --fit MOLD            solve for oil weight to hit --target-fill in this mold
  --fragrance-pct PCT   fragrance % of oils, for --fit (default 3)
  --target-fill PCT     target fill % for --fit (default 93)
  -h, --help            show this message`;

export function parseBlend(spec: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of spec.split(",")) {
    const eq = part.indexOf("=");
    const name = (eq === -1 ? part : part.slice(0, eq)).trim();
    const pct = Number(eq === -1 ? "" : part.slice(eq + 1));
    if (!name || !Number.isFinite(pct)) {
      throw new Error(`bad --blend entry '${part.trim()}' — expected name=percent`);
    }
    out[name] = pct;
  }
  return out;
}

/** Re-derive every fragrance's remaining_g from initial_g minus its used ledger.
 *
 * This is the Batch #5 guard in code: a hand-edited 'remaining' with nothing to check it
 * against is how 11g went missing for three weeks. Here the ledger cannot silently disagree
 * with itself.
 */
export function checkFragranceLedger(): number {
  const fragrances = loadFragrances().fragrances;
  let failures = 0;
  console.log("Fragrance ledger — re-deriving remaining from initial minus used.\n");
  for (const f of Object.values(fragrances)) {
    const used = f.used.reduce((total, u) => total + u.g, 0);
    const derived = f.initial_g - used;
    const stated = f.remaining_g;
    const ok = derived === stated;
    if (!ok) failures += 1;
    const flag = ok ? "" : `  <- MISMATCH: ledger says ${derived}g`;
    console.log(
      `  ${ok ? "OK " : "FAIL"}  ${f.label.padEnd(22)} ${String(f.initial_g).padStart(4)}g -` +
        ` ${String(used).padStart(4)}g used = ${String(derived).padStart(4)}g` +
        `  (stated ${stated}g)${flag}`,
    );
  }
  console.log();
  return failures;
}

export function selfCheck(sap: Sap, molds: Molds): number {
  console.log("Self-check — re-proving six real batches against the pinned SAP table.\n");
  let failures = 0;

  for (const f of SELF_CHECK) {
    const r = compute({
      oilsG: f.oilsG,
      blendPct: f.blend,
      superfatPct: f.superfatPct,
      waterPct: f.waterPct,
      fragranceG: f.fragranceG,
      moldKey: f.moldKey,
      sap,
      molds,
    });
    const lye = r.lyeGRounded;
    const fill = r.mold!.fillPct;
    const fits = r.mold!.fits;

    const lyeOk = f.recordedLye === null || lye === f.recordedLye;
    const fitOk = fits === f.expectFit;
    const ok = lyeOk && fitOk;
    if (!ok) failures += 1;

    const lyeStr = `lye ${lye}g` + (f.recordedLye === null ? "" : ` vs recorded ${f.recordedLye}g`);
    const fitStr = `fill ${fixed(fill, 1).padStart(5)}% -> ${fits ? "fits" : "OVERFLOWS"}`;
    const flag = (lyeOk ? "" : "  <- LYE MISMATCH") + (fitOk ? "" : "  <- FIT MISMATCH");
    console.log(
      `  ${ok ? "OK " : "FAIL"}  Batch #${f.batch}: ${lyeStr.padEnd(34)}  ${fitStr}${flag}`,
    );
    console.log(`           ${f.note}`);
  }
  console.log();

  if (failures) {
    console.log(
      `${failures} batch(es) failed. The SAP table or volume model has drifted — do not trust output.`,
    );
  } else {
    console.log(
      "All six reproduce. Lye weights match SoapCalc; the overflow is caught and the five fits pass.",
    );
  }

  const ledgerFailures = checkFragranceLedger();
  if (ledgerFailures) {
    console.log(
      `${ledgerFailures} fragrance(s) don't reconcile — the ledger and remaining_g have drifted.`,
    );
  } else {
    console.log("Every fragrance reconciles: initial - used = remaining, exactly.");
  }
  return failures || ledgerFailures ? 1 : 0;
}

export function main(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      "self-check": { type: "boolean", default: false },
      mold: { type: "string" },
      oils: { type: "string" },
      blend: { type: "string" },
      superfat: { type: "string", default: "5" },
      water: { type: "string", default: "38" },
      fragrance: { type: "string", default: "0" },
      fit: { type: "string" },
      "fragrance-pct": { type: "string", default: "3" },
      "target-fill": { type: "string", default: "93" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  const num = (raw: string, flag: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`--${flag} expects a number, got '${raw}'`);
    return n;
  };

  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const sap = loadSap();
  const molds = loadMolds();

  if (values["self-check"]) return selfCheck(sap, molds);

  const superfatPct = num(values.superfat!, "superfat");
  const waterPct = num(values.water!, "water");

  if (values.fit) {
    if (!values.blend) throw new Error("--fit needs --blend");
    const targetFillPct = num(values["target-fill"]!, "target-fill");
    const r = fitOils({
      moldKey: values.fit,
      blendPct: parseBlend(values.blend),
      superfatPct,
      waterPct,
      fragrancePct: num(values["fragrance-pct"]!, "fragrance-pct"),
      targetFillPct,
      sap,
      molds,
    });
    console.log(`To fill ${values.fit} to ~${fixed(targetFillPct)}%: ${fixed(r.oilsG)}g oils.\n`);
    console.log(formatReport(r));
    return 0;
  }

  if (values.oils && values.blend) {
    const r = compute({
      oilsG: num(values.oils, "oils"),
      blendPct: parseBlend(values.blend),
      superfatPct,
      waterPct,
      fragranceG: num(values.fragrance!, "fragrance"),
      moldKey: values.mold ?? null,
      sap,
      molds,
    });
    console.log(formatReport(r));
    return 0;
  }

  console.log(HELP);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  // A clear sentence beats a stack trace for a tool that gets run at the counter.
  console.error(`lye: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 2;
}
