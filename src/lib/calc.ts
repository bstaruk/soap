/** The arithmetic. Lye, water, batter volume, mold fit, yield — and nothing else in the repo
 * computes any of them.
 *
 * A faithful port of `tools/lye.py`'s `compute` / `fit_oils` / `_yield` / `lye_solution_density`
 * / `resolve_oil_name`, kept structurally close on purpose so the two read as the same program.
 * Pure: no I/O, no filesystem, no clock.
 *
 * Two things the port must get right, because JavaScript's defaults are wrong for both:
 *
 *   Rounding. Python's `round()` is half-to-even; `Math.round()` is half-up. Every lye weight in
 *   the archive went through Python's rule, and `kaolin_g` (oils × 2%) lands exactly on `.5` for
 *   every odd multiple of 25 g of oils — 1,225 g gives 24.5, where the two rules disagree. So
 *   `roundHalfEven` below, at every site where Python called `round()`. Never `Math.round`.
 *
 *   Sorting. `[].sort()` with no comparator sorts by stringified value, so `[0.1, 0.05]` would
 *   come back in the order it went in. `lyeSolutionDensity` interpolates between sorted points;
 *   a wrong order there returns a wrong density, a wrong batter volume, and a wrong
 *   fit-vs-overflow verdict, silently.
 */

import type { DensityRow, Mold, Molds, OilDef, Sap } from "./schema.ts";

export const SODIUM_LACTATE_ML_PER_1000G = 10.87; // 1 tsp per lb of oils, converted
export const KAOLIN_PCT_OF_OILS = 2.0; // house rate, constant across every batch to date

/** Python's `round()`: nearest integer, ties to even. `0.5 -> 0`, `24.5 -> 24`, `25.5 -> 26`. */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction > 0.5) return floor + 1;
  if (fraction < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

export interface MoldYield {
  bars: number;
  how: string;
}

export interface MoldFit {
  key: string;
  label: string;
  cavityMl: number;
  fillPct: number;
  maxFillPct: number;
  fits: boolean;
  yield: MoldYield;
}

export interface Batch {
  oilsG: number;
  /** Canonical SAP key -> grams, in blend order. */
  oilsGBy: Map<string, number>;
  blendPct: Record<string, number>;
  superfatPct: number;
  waterPct: number;
  lyeG: number;
  lyeGRounded: number;
  waterG: number;
  waterGRounded: number;
  fragranceG: number;
  fragrancePct: number;
  kaolinG: number;
  sodiumLactateMl: number;
  naohConcentrationPct: number;
  batterMl: number;
  mold?: MoldFit;
}

export interface ComputeInput {
  oilsG: number;
  blendPct: Record<string, number>;
  superfatPct: number;
  waterPct: number;
  fragranceG: number;
  moldKey?: string | null;
  sap: Sap;
  molds: Molds;
}

/** Map a blend shorthand to a SAP key. Exact match wins; otherwise a unique prefix.
 *
 * Lets a recipe say `coconut` while the table key stays the precise `coconut_76` — but an
 * ambiguous or unknown name is an error, never a silent guess at which oil was meant.
 */
export function resolveOilName(name: string, oilDefs: Record<string, OilDef>): string {
  if (Object.hasOwn(oilDefs, name)) return name;
  const matches = Object.keys(oilDefs).filter((key) => key.startsWith(name));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error(`oil '${name}' has no validated SAP value in sap-values.toml`);
  }
  throw new Error(`oil '${name}' is ambiguous — matches [${matches.join(", ")}]`);
}

/** Density of the lye solution at a given NaOH mass fraction, linearly interpolated.
 *
 * The solution is markedly denser than its water (~1.29 vs 1.0 at these concentrations);
 * treating water and lye as separate volumes overstates the batter by ~15% and would wave
 * an overflow straight through.
 */
export function lyeSolutionDensity(naohFraction: number, table: DensityRow[]): number {
  const points: Array<[number, number]> = table
    .map((row): [number, number] => [row.naoh_fraction, row.density])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const first = points[0];
  const last = points[points.length - 1];
  if (naohFraction <= first[0]) return first[1];
  if (naohFraction >= last[0]) return last[1];

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, d0] = points[i];
    const [x1, d1] = points[i + 1];
    if (x0 <= naohFraction && naohFraction <= x1) {
      return d0 + ((d1 - d0) * (naohFraction - x0)) / (x1 - x0);
    }
  }
  return last[1]; // unreachable; the bounds checks above already cover the ends
}

/** Bars per batch. Loaves cut at 1"; cavity molds yield one bar per cavity. */
export function moldYield(mold: Mold): MoldYield {
  if (mold.type === "cavity") {
    return { bars: mold.cavities ?? 0, how: "one per cavity, no cutting" };
  }
  const length = mold.cavity_in.length;
  const bars = Math.floor(length); // house cut is 1"
  return { bars, how: `${bars} bars at 1" from an ${length}" loaf` };
}

/** Everything a recipe needs, from an oil weight and a blend. Pure arithmetic — no I/O. */
export function compute(input: ComputeInput): Batch {
  const { oilsG, blendPct, superfatPct, waterPct, fragranceG, moldKey, sap, molds } = input;

  const blendSum = Object.values(blendPct).reduce((total, pct) => total + pct, 0);
  if (Math.abs(blendSum - 100) > 0.01) {
    throw new Error(`blend must sum to 100%, got ${blendSum}`);
  }

  const oilDefs = sap.oils;
  const comp = sap.components;

  // Per-oil weights and their individual lye demand at 0% superfat. Names resolve to SAP
  // keys up front so the rest of the function works in canonical keys.
  const oilsGBy = new Map<string, number>();
  for (const [name, pct] of Object.entries(blendPct)) {
    oilsGBy.set(resolveOilName(name, oilDefs), (oilsG * pct) / 100);
  }
  let lyeFull = 0;
  for (const [name, grams] of oilsGBy) lyeFull += grams * oilDefs[name].naoh_sap;

  const lyeG = lyeFull * (1 - superfatPct / 100);
  const waterG = (oilsG * waterPct) / 100;
  const sodiumLactateMl = (oilsG / 1000) * SODIUM_LACTATE_ML_PER_1000G;
  const kaolinG = (oilsG * KAOLIN_PCT_OF_OILS) / 100;

  // Batter volume = oils + lye solution + fragrance + clay + sodium lactate. The clay and
  // sodium lactate go in unrounded — rounding is a scale-reading concern, not a volume one.
  const naohFraction = lyeG / (lyeG + waterG);
  const solDensity = lyeSolutionDensity(naohFraction, sap.lye_solution_density);
  let volMl = 0;
  for (const [name, grams] of oilsGBy) volMl += grams / oilDefs[name].density_g_per_ml;
  volMl += (lyeG + waterG) / solDensity;
  volMl += fragranceG / comp.fragrance.density_g_per_ml;
  volMl += kaolinG / comp.kaolin_clay.density_g_per_ml;
  volMl += sodiumLactateMl / comp.sodium_lactate.density_g_per_ml;

  const result: Batch = {
    oilsG,
    oilsGBy,
    blendPct,
    superfatPct,
    waterPct,
    lyeG,
    lyeGRounded: roundHalfEven(lyeG),
    waterG,
    waterGRounded: roundHalfEven(waterG),
    fragranceG,
    fragrancePct: oilsG ? (fragranceG / oilsG) * 100 : 0,
    kaolinG: roundHalfEven(kaolinG),
    sodiumLactateMl: roundHalfEven(sodiumLactateMl),
    naohConcentrationPct: naohFraction * 100,
    batterMl: volMl,
  };

  if (moldKey) {
    const mold = molds.molds[moldKey];
    if (!mold) throw new Error(`mold '${moldKey}' is not in inventory/molds.toml`);
    const cavity = mold.cavity_ml;
    const fillPct = (volMl / cavity) * 100;
    const ceiling = mold.max_fill_pct ?? 100;
    result.mold = {
      key: moldKey,
      label: mold.label,
      cavityMl: cavity,
      fillPct,
      maxFillPct: ceiling,
      fits: fillPct <= ceiling,
      yield: moldYield(mold),
    };
  }
  return result;
}

export interface FitInput {
  moldKey: string;
  blendPct: Record<string, number>;
  superfatPct: number;
  waterPct: number;
  fragrancePct: number;
  targetFillPct: number;
  sap: Sap;
  molds: Molds;
}

/** Solve for the oil weight that fills a mold to a target percentage.
 *
 * Fill rises monotonically with oil weight, so a bisection converges cleanly. Fragrance is
 * given as a rate here (% of oils) because that is how it is chosen before a weight exists.
 */
export function fitOils(input: FitInput): Batch {
  const { moldKey, blendPct, superfatPct, waterPct, fragrancePct, targetFillPct, sap, molds } =
    input;

  let lo = 100.0;
  let hi = 6000.0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const r = compute({
      oilsG: mid,
      blendPct,
      superfatPct,
      waterPct,
      fragranceG: (mid * fragrancePct) / 100,
      moldKey,
      sap,
      molds,
    });
    if (r.mold!.fillPct < targetFillPct) lo = mid;
    else hi = mid;
  }

  const solved = roundHalfEven((lo + hi) / 2);
  return compute({
    oilsG: solved,
    blendPct,
    superfatPct,
    waterPct,
    fragranceG: (solved * fragrancePct) / 100,
    moldKey,
    sap,
    molds,
  });
}
