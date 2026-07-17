#!/usr/bin/env python3
"""The soap calculator — lye, water, mold fill, and yield for a cold-process batch.

Why this exists: Claude does not do lye arithmetic, and a hobbyist triple-checking on
SoapCalc is a second opinion, not a first line of defense. This script is the first line.
It reads the SAP table and mold data that the rest of the repo trusts, produces every number
a recipe needs, and re-proves itself against six real batches on every `--self-check` run.

It answers two questions the eye cannot:

  1. How much lye? Wrong here means a caustic bar or a greasy one. The SAP table is pinned to
     SoapCalc (reference/sap-values.toml) precisely so this number and the human's cross-check
     share a source and can actually agree.

  2. Will it fit? Batch #3 overflowed because "63 oz" was read as a volume when it was the
     0.4-rule oil weight — and that rule silently over-predicts these water-heavy recipes by
     ~10%. This computes real batter volume from real component densities instead.

No third-party dependencies. Needs Python 3.11+ for the stdlib `tomllib` parser.

Usage:
  lye.py --self-check
  lye.py --mold nurture-5lb --oils 1600 --blend olive=62,coconut=28,castor=10 \\
         --superfat 6 --water 38 --fragrance 44
  lye.py --fit nurture-5lb --blend olive=62,coconut=28,castor=10 --superfat 6 \\
         --water 38 --fragrance-pct 3 --target-fill 93
"""

from __future__ import annotations

import argparse
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAP_PATH = ROOT / "reference" / "sap-values.toml"
MOLDS_PATH = ROOT / "inventory" / "molds.toml"

SODIUM_LACTATE_ML_PER_1000G = 10.87  # 1 tsp per lb of oils, converted
KAOLIN_PCT_OF_OILS = 2.0  # house rate, constant across every batch to date


def load_toml(path: Path) -> dict:
    with open(path, "rb") as fh:
        return tomllib.load(fh)


def resolve_oil_name(name: str, oil_defs: dict) -> str:
    """Map a blend shorthand to a SAP key. Exact match wins; otherwise a unique prefix.

    Lets a recipe say `coconut` while the table key stays the precise `coconut_76` — but an
    ambiguous or unknown name is an error, never a silent guess at which oil was meant.
    """
    if name in oil_defs:
        return name
    matches = [k for k in oil_defs if k.startswith(name)]
    if len(matches) == 1:
        return matches[0]
    if not matches:
        raise ValueError(f"oil '{name}' has no validated SAP value in {SAP_PATH.name}")
    raise ValueError(f"oil '{name}' is ambiguous — matches {matches}")


def lye_solution_density(naoh_fraction: float, table: list[dict]) -> float:
    """Density of the lye solution at a given NaOH mass fraction, linearly interpolated.

    The solution is markedly denser than its water (~1.29 vs 1.0 at these concentrations);
    treating water and lye as separate volumes overstates the batter by ~15% and would wave
    an overflow straight through.
    """
    points = sorted((row["naoh_fraction"], row["density"]) for row in table)
    lo, hi = points[0][0], points[-1][0]
    if naoh_fraction <= lo:
        return points[0][1]
    if naoh_fraction >= hi:
        return points[-1][1]
    for (x0, d0), (x1, d1) in zip(points, points[1:]):
        if x0 <= naoh_fraction <= x1:
            return d0 + (d1 - d0) * (naoh_fraction - x0) / (x1 - x0)
    return points[-1][1]  # unreachable; keeps type checkers happy


def compute(
    *,
    oils_g: float,
    blend_pct: dict[str, float],
    superfat_pct: float,
    water_pct: float,
    fragrance_g: float,
    mold_key: str | None,
    sap: dict,
    molds: dict,
) -> dict:
    """Everything a recipe needs, from an oil weight and a blend. Pure arithmetic — no I/O."""
    if abs(sum(blend_pct.values()) - 100) > 0.01:
        raise ValueError(f"blend must sum to 100%, got {sum(blend_pct.values())}")

    oil_defs = sap["oils"]
    comp = sap["components"]

    # Per-oil weights and their individual lye demand at 0% superfat. Names resolve to SAP
    # keys up front so the rest of the function works in canonical keys.
    oils_g_by = {resolve_oil_name(name, oil_defs): oils_g * pct / 100 for name, pct in blend_pct.items()}
    lye_full = sum(grams * oil_defs[name]["naoh_sap"] for name, grams in oils_g_by.items())

    lye_g = lye_full * (1 - superfat_pct / 100)
    water_g = oils_g * water_pct / 100
    sodium_lactate_ml = oils_g / 1000 * SODIUM_LACTATE_ML_PER_1000G
    kaolin_g = oils_g * KAOLIN_PCT_OF_OILS / 100

    # Batter volume = oils + lye solution + fragrance + clay + sodium lactate.
    naoh_fraction = lye_g / (lye_g + water_g)
    sol_density = lye_solution_density(naoh_fraction, sap["lye_solution_density"])
    vol_ml = sum(grams / oil_defs[name]["density_g_per_ml"] for name, grams in oils_g_by.items())
    vol_ml += (lye_g + water_g) / sol_density
    vol_ml += fragrance_g / comp["fragrance"]["density_g_per_ml"]
    vol_ml += kaolin_g / comp["kaolin_clay"]["density_g_per_ml"]
    vol_ml += sodium_lactate_ml / comp["sodium_lactate"]["density_g_per_ml"]

    result = {
        "oils_g": oils_g,
        "oils_g_by": oils_g_by,
        "blend_pct": blend_pct,
        "superfat_pct": superfat_pct,
        "water_pct": water_pct,
        "lye_g": lye_g,
        "lye_g_rounded": round(lye_g),
        "water_g": water_g,
        "water_g_rounded": round(water_g),
        "fragrance_g": fragrance_g,
        "fragrance_pct": fragrance_g / oils_g * 100 if oils_g else 0,
        "kaolin_g": round(kaolin_g),
        "sodium_lactate_ml": round(sodium_lactate_ml),
        "naoh_concentration_pct": naoh_fraction * 100,
        "batter_ml": vol_ml,
    }

    if mold_key:
        mold = molds["molds"][mold_key]
        cavity = mold["cavity_ml"]
        fill_pct = vol_ml / cavity * 100
        ceiling = mold.get("max_fill_pct", 100)
        result["mold"] = {
            "key": mold_key,
            "label": mold["label"],
            "cavity_ml": cavity,
            "fill_pct": fill_pct,
            "max_fill_pct": ceiling,
            "fits": fill_pct <= ceiling,
            "yield": _yield(mold),
        }
    return result


def _yield(mold: dict) -> dict:
    """Bars per batch. Loaves cut at 1"; cavity molds yield one bar per cavity."""
    if mold["type"] == "cavity":
        return {"bars": mold["cavities"], "how": "one per cavity, no cutting"}
    length = mold["cavity_in"]["length"]
    bars = int(length // 1.0)  # house cut is 1"
    return {"bars": bars, "how": f'{bars} bars at 1" from an {length}" loaf'}


def fit_oils(
    *,
    mold_key: str,
    blend_pct: dict[str, float],
    superfat_pct: float,
    water_pct: float,
    fragrance_pct: float,
    target_fill_pct: float,
    sap: dict,
    molds: dict,
) -> dict:
    """Solve for the oil weight that fills a mold to a target percentage.

    Fill rises monotonically with oil weight, so a bisection converges cleanly. Fragrance is
    given as a rate here (% of oils) because that is how it is chosen before a weight exists.
    """
    lo, hi = 100.0, 6000.0
    for _ in range(60):
        mid = (lo + hi) / 2
        r = compute(
            oils_g=mid,
            blend_pct=blend_pct,
            superfat_pct=superfat_pct,
            water_pct=water_pct,
            fragrance_g=mid * fragrance_pct / 100,
            mold_key=mold_key,
            sap=sap,
            molds=molds,
        )
        if r["mold"]["fill_pct"] < target_fill_pct:
            lo = mid
        else:
            hi = mid
    return compute(
        oils_g=round((lo + hi) / 2),
        blend_pct=blend_pct,
        superfat_pct=superfat_pct,
        water_pct=water_pct,
        fragrance_g=round((lo + hi) / 2) * fragrance_pct / 100,
        mold_key=mold_key,
        sap=sap,
        molds=molds,
    )


def format_report(r: dict) -> str:
    """A human-readable batch sheet. Not the recipe file — a scratch check to read or paste."""
    lines = []
    b = "/".join(f"{name} {int(pct)}%" for name, pct in r["blend_pct"].items())
    lines.append(f"Oils: {r['oils_g']:.0f}g  ({b})   superfat {r['superfat_pct']:.0f}%   water {r['water_pct']:.0f}% of oils")
    lines.append("")
    for name, grams in r["oils_g_by"].items():
        lines.append(f"  {name:16} {grams:7.0f} g")
    lines.append(f"  {'water':16} {r['water_g_rounded']:7d} g")
    lines.append(f"  {'lye (NaOH)':16} {r['lye_g_rounded']:7d} g   ({r['lye_g']:.2f} before rounding)")
    lines.append(f"  {'sodium lactate':16} {r['sodium_lactate_ml']:7d} ml")
    lines.append(f"  {'kaolin clay':16} {r['kaolin_g']:7d} g")
    if r["fragrance_g"]:
        lines.append(f"  {'fragrance':16} {r['fragrance_g']:7.0f} g   ({r['fragrance_pct']:.1f}% of oils)")
    lines.append("")
    lines.append(f"Lye solution concentration: {r['naoh_concentration_pct']:.1f}% NaOH")
    lines.append(f"Batter volume: {r['batter_ml']:.0f} ml")
    if "mold" in r:
        m = r["mold"]
        verdict = "FITS" if m["fits"] else "*** OVERFLOWS ***"
        lines.append(f"Mold: {m['label']}")
        lines.append(f"  cavity {m['cavity_ml']:.0f} ml   fill {m['fill_pct']:.1f}%   ceiling {m['max_fill_pct']}%   {verdict}")
        lines.append(f"  yield: {m['yield']['bars']} bars ({m['yield']['how']})")
    lines.append("")
    lines.append("Cross-check this lye weight on SoapCalc before you pour. The calculator is the")
    lines.append("first opinion, not the only one — a recipe reaches Ready only after you confirm it.")
    return "\n".join(lines)


# --- Self-check fixture: six real batches, their recorded numbers, and what actually happened.
# The lye assertions prove the SAP table against SoapCalc-confirmed weights; the fill assertions
# prove the volume model gets fit-vs-overflow right — including the one batch that overflowed.
SELF_CHECK = [
    # (batch, blend, oils, SF, water%, fragrance_g, mold, recorded_lye, expect_fit, note)
    (1, {"olive": 72, "coconut": 18, "castor": 10}, 900, 5, 38, 27, "bb-10in-loaf", 123, True, "first batch; domed slightly"),
    (2, {"olive": 72, "coconut": 18, "castor": 10}, 540, 5, 38, 36, "bb-6cav-oval", 74, True, "first oval"),
    (3, {"olive": 72, "coconut": 18, "castor": 10}, 1787, 5, 38, 120, "nurture-5lb", None, False, "OVERFLOWED — lye was scaled not recalculated"),
    (4, {"olive": 72, "coconut": 18, "castor": 10}, 1600, 5, 38, 104, "nurture-5lb", 218, True, "SoapCalc-confirmed 217.90"),
    (5, {"olive": 62, "coconut": 28, "castor": 10}, 540, 6, 38, 11, "bb-6cav-oval", 75, True, "SoapCalc-confirmed 75.18"),
    (6, {"olive": 62, "coconut": 28, "castor": 10}, 1600, 6, 38, 44, "nurture-5lb", 223, True, "SoapCalc-confirmed 222.80; still in mold"),
]


def check_fragrance_ledger() -> int:
    """Re-derive every fragrance's remaining_g from initial_g minus its used ledger.

    This is the Batch #5 guard in code: a hand-edited 'remaining' with nothing to check it
    against is how 11g went missing for three weeks. Here the ledger cannot silently disagree
    with itself.
    """
    frag = load_toml(ROOT / "inventory" / "fragrances.toml")["fragrances"]
    failures = 0
    print("Fragrance ledger — re-deriving remaining from initial minus used.\n")
    for key, f in frag.items():
        used = sum(u["g"] for u in f.get("used", []))
        derived = f["initial_g"] - used
        stated = f["remaining_g"]
        ok = derived == stated
        failures += not ok
        flag = "" if ok else f"  <- MISMATCH: ledger says {derived}g"
        print(f"  {'OK ' if ok else 'FAIL'}  {f['label']:22} {f['initial_g']:4}g - {used:4}g used = {derived:4}g  (stated {stated}g){flag}")
    print()
    return failures


def self_check(sap: dict, molds: dict) -> int:
    print("Self-check — re-proving six real batches against the pinned SAP table.\n")
    failures = 0
    for batch, blend, oils, sf, water, frag, mold_key, recorded_lye, expect_fit, note in SELF_CHECK:
        r = compute(
            oils_g=oils, blend_pct=blend, superfat_pct=sf, water_pct=water,
            fragrance_g=frag, mold_key=mold_key, sap=sap, molds=molds,
        )
        lye = r["lye_g_rounded"]
        fill = r["mold"]["fill_pct"]
        fits = r["mold"]["fits"]

        lye_ok = recorded_lye is None or lye == recorded_lye
        fit_ok = fits == expect_fit
        ok = lye_ok and fit_ok
        failures += not ok

        lye_str = f"lye {lye}g" + ("" if recorded_lye is None else f" vs recorded {recorded_lye}g")
        fit_str = f"fill {fill:5.1f}% -> {'fits' if fits else 'OVERFLOWS'}"
        flag = "" if lye_ok else "  <- LYE MISMATCH"
        flag += "" if fit_ok else "  <- FIT MISMATCH"
        print(f"  {'OK ' if ok else 'FAIL'}  Batch #{batch}: {lye_str:34}  {fit_str}{flag}")
        print(f"           {note}")
    print()
    if failures:
        print(f"{failures} batch(es) failed. The SAP table or volume model has drifted — do not trust output.")
    else:
        print("All six reproduce. Lye weights match SoapCalc; the overflow is caught and the five fits pass.")

    ledger_failures = check_fragrance_ledger()
    if ledger_failures:
        print(f"{ledger_failures} fragrance(s) don't reconcile — the ledger and remaining_g have drifted.")
    else:
        print("Every fragrance reconciles: initial - used = remaining, exactly.")
    return 1 if (failures or ledger_failures) else 0


def parse_blend(s: str) -> dict[str, float]:
    out = {}
    for part in s.split(","):
        name, _, pct = part.partition("=")
        out[name.strip()] = float(pct)
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Cold-process soap calculator.")
    ap.add_argument("--self-check", action="store_true", help="re-prove the six historical batches and exit")
    ap.add_argument("--mold", help="mold key from inventory/molds.toml")
    ap.add_argument("--oils", type=float, help="total oil weight in grams")
    ap.add_argument("--blend", type=parse_blend, help="e.g. olive=62,coconut=28,castor=10")
    ap.add_argument("--superfat", type=float, default=5, help="superfat %% (default 5)")
    ap.add_argument("--water", type=float, default=38, help="water as %% of oils (default 38)")
    ap.add_argument("--fragrance", type=float, default=0, help="fragrance weight in grams")
    ap.add_argument("--fit", metavar="MOLD", help="solve for oil weight to hit --target-fill in this mold")
    ap.add_argument("--fragrance-pct", type=float, default=3, help="fragrance %% of oils, for --fit (default 3)")
    ap.add_argument("--target-fill", type=float, default=93, help="target fill %% for --fit (default 93)")
    args = ap.parse_args(argv)

    sap = load_toml(SAP_PATH)
    molds = load_toml(MOLDS_PATH)

    if args.self_check:
        return self_check(sap, molds)

    if args.fit:
        if not args.blend:
            ap.error("--fit needs --blend")
        r = fit_oils(
            mold_key=args.fit, blend_pct=args.blend, superfat_pct=args.superfat,
            water_pct=args.water, fragrance_pct=args.fragrance_pct,
            target_fill_pct=args.target_fill, sap=sap, molds=molds,
        )
        print(f"To fill {args.fit} to ~{args.target_fill:.0f}%: {r['oils_g']:.0f}g oils.\n")
        print(format_report(r))
        return 0

    if args.oils and args.blend:
        r = compute(
            oils_g=args.oils, blend_pct=args.blend, superfat_pct=args.superfat,
            water_pct=args.water, fragrance_g=args.fragrance, mold_key=args.mold,
            sap=sap, molds=molds,
        )
        print(format_report(r))
        return 0

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
