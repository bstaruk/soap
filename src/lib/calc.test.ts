/** The calculator, re-proved.
 *
 * Two jobs. The six-batch fixture is the regression guard: it re-derives every recorded lye
 * weight and fill percentage from the pinned SAP table, and it catches the batch that
 * overflowed. Everything else tests the places where the JavaScript port could plausibly
 * diverge from the Python original — rounding, sorting, floor division — none of which the six
 * batches happen to exercise.
 */

import { describe, expect, it } from "vitest";

import {
  compute,
  fitOils,
  lyeSolutionDensity,
  moldYield,
  resolveOilName,
  roundHalfEven,
} from "./calc.ts";
import {
  loadEquipment,
  loadFragrances,
  loadMolds,
  loadRecipes,
  loadSap,
  loadStaples,
} from "./data.ts";
import { addDays, isIsoDate } from "./dates.ts";
import { EXPECTED_FILL_PCT, SELF_CHECK } from "./fixtures.ts";

const sap = loadSap();
const molds = loadMolds();

describe("roundHalfEven", () => {
  it("breaks ties toward even, the way Python's round() does", () => {
    // No historical batch lands on a boundary, which is exactly why these are asserted here.
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(24.5)).toBe(24);
    expect(roundHalfEven(25.5)).toBe(26);
    expect(roundHalfEven(-0.5)).toBe(0);
    expect(roundHalfEven(-1.5)).toBe(-2);
    expect(roundHalfEven(-2.5)).toBe(-2);
  });

  it("rounds ordinary values to nearest", () => {
    expect(roundHalfEven(122.5266)).toBe(123);
    expect(roundHalfEven(73.516)).toBe(74);
    expect(roundHalfEven(243.2834)).toBe(243);
    expect(roundHalfEven(217.8251)).toBe(218);
    expect(roundHalfEven(75.1888)).toBe(75);
    expect(roundHalfEven(222.7815)).toBe(223);
    expect(roundHalfEven(0.4)).toBe(0);
    expect(roundHalfEven(-0.6)).toBe(-1);
  });

  it("disagrees with Math.round exactly where the kaolin rate lands on a tie", () => {
    // 1,225 g of oils × 2% = 24.5 g of clay. Math.round would say 25.
    const r = compute({
      oilsG: 1225,
      blendPct: { olive: 62, coconut: 28, castor: 10 },
      superfatPct: 6,
      waterPct: 38,
      fragranceG: 0,
      moldKey: null,
      sap,
      molds,
    });
    expect(r.kaolinG).toBe(24);
    expect(Math.round(1225 * 0.02)).toBe(25);
  });
});

describe("lyeSolutionDensity", () => {
  const table = sap.lye_solution_density;

  it("clamps below the first point and above the last", () => {
    expect(lyeSolutionDensity(0.0, table)).toBe(1.054);
    expect(lyeSolutionDensity(0.05, table)).toBe(1.054);
    expect(lyeSolutionDensity(0.5, table)).toBe(1.38);
  });

  it("interpolates linearly between points", () => {
    expect(lyeSolutionDensity(0.125, table)).toBeCloseTo((1.109 + 1.165) / 2, 12);
    expect(lyeSolutionDensity(0.2, table)).toBe(1.219);
  });

  it("sorts numerically, not by stringified value", () => {
    // The hazard the explicit comparator exists for: a default .sort() would order these
    // 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35 as strings and interpolate across the wrong segment.
    const shuffled = [...table].reverse();
    for (const fraction of [0.06, 0.125, 0.22, 0.34]) {
      expect(lyeSolutionDensity(fraction, shuffled)).toBe(lyeSolutionDensity(fraction, table));
    }
  });
});

describe("resolveOilName", () => {
  it("prefers an exact match", () => {
    expect(resolveOilName("olive", sap.oils)).toBe("olive");
    expect(resolveOilName("coconut_76", sap.oils)).toBe("coconut_76");
  });

  it("accepts a unique prefix", () => {
    expect(resolveOilName("coconut", sap.oils)).toBe("coconut_76");
  });

  it("refuses to guess", () => {
    expect(() => resolveOilName("palm", sap.oils)).toThrow(/no validated SAP value/);
    expect(() => resolveOilName("c", sap.oils)).toThrow(/ambiguous/);
  });
});

describe("moldYield", () => {
  it("cuts a loaf at 1 inch, floor division", () => {
    expect(moldYield(molds.molds["nurture-5lb"])).toEqual({
      bars: 18,
      how: '18 bars at 1" from an 18" loaf',
    });
    expect(moldYield(molds.molds["bb-10in-loaf"]).bars).toBe(10);
  });

  it("gives one bar per cavity", () => {
    expect(moldYield(molds.molds["bb-6cav-oval"])).toEqual({
      bars: 6,
      how: "one per cavity, no cutting",
    });
  });
});

describe("compute", () => {
  it("rejects a blend that does not sum to 100", () => {
    expect(() =>
      compute({
        oilsG: 900,
        blendPct: { olive: 70, coconut: 18, castor: 10 },
        superfatPct: 5,
        waterPct: 38,
        fragranceG: 0,
        moldKey: null,
        sap,
        molds,
      }),
    ).toThrow(/blend must sum to 100%/);
  });

  it("rejects a mold that is not in inventory", () => {
    expect(() =>
      compute({
        oilsG: 900,
        blendPct: { olive: 72, coconut: 18, castor: 10 },
        superfatPct: 5,
        waterPct: 38,
        fragranceG: 0,
        moldKey: "no-such-mold",
        sap,
        molds,
      }),
    ).toThrow(/not in inventory/);
  });
});

describe("the six batches", () => {
  for (const f of SELF_CHECK) {
    it(`#${f.batch} reproduces — ${f.note}`, () => {
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
      if (f.recordedLye !== null) expect(r.lyeGRounded).toBe(f.recordedLye);
      expect(Number(r.mold!.fillPct.toFixed(1))).toBe(EXPECTED_FILL_PCT[f.batch]);
      expect(r.mold!.fits).toBe(f.expectFit);
    });
  }

  it("catches Batch #3's overflow, and says the lye should have been 243 g", () => {
    const r = compute({
      oilsG: 1787,
      blendPct: { olive: 72, coconut: 18, castor: 10 },
      superfatPct: 5,
      waterPct: 38,
      fragranceG: 120,
      moldKey: "nurture-5lb",
      sap,
      molds,
    });
    expect(r.mold!.fits).toBe(false);
    expect(r.mold!.fillPct).toBeGreaterThan(r.mold!.maxFillPct);
    expect(r.lyeGRounded).toBe(243); // the recipe records 246 — scaled, not recalculated
  });
});

describe("fitOils", () => {
  it("solves for an oil weight that hits the target fill", () => {
    const r = fitOils({
      moldKey: "nurture-5lb",
      blendPct: { olive: 62, coconut: 28, castor: 10 },
      superfatPct: 6,
      waterPct: 38,
      fragrancePct: 3,
      targetFillPct: 93,
      sap,
      molds,
    });
    expect(Number.isInteger(r.oilsG)).toBe(true);
    expect(r.mold!.fillPct).toBeCloseTo(93, 1);
    expect(r.mold!.fits).toBe(true);
  });
});

describe("the fragrance ledger", () => {
  it("re-derives every remaining_g from initial minus used", () => {
    for (const [key, f] of Object.entries(loadFragrances().fragrances)) {
      const used = f.used.reduce((total, u) => total + u.g, 0);
      expect(f.initial_g - used, `${key} (${f.label})`).toBe(f.remaining_g);
    }
  });
});

describe("dates", () => {
  it("accepts real calendar dates and rejects impossible ones", () => {
    expect(isIsoDate("2026-07-17")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true); // a real leap day
    expect(isIsoDate("2026-13-45")).toBe(false);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    expect(isIsoDate("2026-7-17")).toBe(false);
    expect(isIsoDate("soon")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it("adds days in UTC, so a cure milestone never slips a day west of Greenwich", () => {
    expect(addDays("2026-07-17", 28)).toBe("2026-08-14");
    expect(addDays("2026-07-17", 42)).toBe("2026-08-28");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2024-02-27", 2)).toBe("2024-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("orders ISO strings lexicographically", () => {
    expect(["2026-07-17", "2026-03-13"].sort()).toEqual(["2026-03-13", "2026-07-17"]);
  });
});

describe("the data files", () => {
  it("all parse through their schemas", () => {
    expect(Object.keys(loadSap().oils).length).toBeGreaterThan(0);
    expect(Object.keys(loadMolds().molds).length).toBeGreaterThan(0);
    expect(Object.keys(loadFragrances().fragrances).length).toBeGreaterThan(0);
    expect(Object.keys(loadStaples().oils).length).toBeGreaterThan(0);
    expect(loadEquipment().current.tools.length).toBeGreaterThan(0);
  });

  it("reads every recipe's frontmatter, with dates normalised to ISO strings", () => {
    const recipes = loadRecipes();
    expect(recipes.length).toBeGreaterThan(0);
    for (const r of recipes) {
      expect(r.fm.batch, r.fileName).toBe(Number(r.fileName.slice(0, 3)));
      expect(isIsoDate(r.fm.created), r.fileName).toBe(true);
      expect(r.url).toBe(`/recipes/${r.slug}/`);
    }
  });
});
