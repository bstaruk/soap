/** The text batch sheet — a scratch check to read or paste, not the recipe file. */

import { roundHalfEven, type Batch } from "./calc.ts";

/** Python's `f"{value:.Nf}"`: correctly rounded to N places, ties to even.
 *
 * `toFixed` breaks ties away from zero, which for whole grams is the difference between
 * `100.5 -> 100` and `100.5 -> 101`. At one or more decimal places an exact binary tie is
 * vanishingly rare in these computed values, so `toFixed` is left to do that job.
 */
export function fixed(value: number, digits = 0): string {
  return digits === 0 ? roundHalfEven(value).toFixed(0) : value.toFixed(digits);
}

export function formatReport(r: Batch): string {
  const lines: string[] = [];

  const blend = Object.entries(r.blendPct)
    .map(([name, pct]) => `${name} ${Math.trunc(pct)}%`)
    .join("/");
  lines.push(
    `Oils: ${fixed(r.oilsG)}g  (${blend})   superfat ${fixed(r.superfatPct)}%` +
      `   water ${fixed(r.waterPct)}% of oils`,
  );
  lines.push("");

  for (const [name, grams] of r.oilsGBy) {
    lines.push(`  ${name.padEnd(16)} ${fixed(grams).padStart(7)} g`);
  }
  lines.push(`  ${"water".padEnd(16)} ${String(r.waterGRounded).padStart(7)} g`);
  lines.push(
    `  ${"lye (NaOH)".padEnd(16)} ${String(r.lyeGRounded).padStart(7)} g` +
      `   (${fixed(r.lyeG, 2)} before rounding)`,
  );
  lines.push(`  ${"sodium lactate".padEnd(16)} ${String(r.sodiumLactateMl).padStart(7)} ml`);
  lines.push(`  ${"kaolin clay".padEnd(16)} ${String(r.kaolinG).padStart(7)} g`);
  if (r.fragranceG) {
    lines.push(
      `  ${"fragrance".padEnd(16)} ${fixed(r.fragranceG).padStart(7)} g` +
        `   (${fixed(r.fragrancePct, 1)}% of oils)`,
    );
  }
  lines.push("");

  lines.push(`Lye solution concentration: ${fixed(r.naohConcentrationPct, 1)}% NaOH`);
  lines.push(`Batter volume: ${fixed(r.batterMl)} ml`);
  if (r.mold) {
    const m = r.mold;
    const verdict = m.fits ? "FITS" : "*** OVERFLOWS ***";
    lines.push(`Mold: ${m.label}`);
    lines.push(
      `  cavity ${fixed(m.cavityMl)} ml   fill ${fixed(m.fillPct, 1)}%` +
        `   ceiling ${m.maxFillPct}%   ${verdict}`,
    );
    lines.push(`  yield: ${m.yield.bars} bars (${m.yield.how})`);
  }
  lines.push("");

  lines.push("Cross-check this lye weight on SoapCalc before you pour. The calculator is the");
  lines.push("first opinion, not the only one — a recipe reaches Ready only after you confirm it.");
  return lines.join("\n");
}
