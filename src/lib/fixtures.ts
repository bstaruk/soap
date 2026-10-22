/** Seven real batches, their recorded numbers, and what actually happened.
 *
 * The lye assertions prove the SAP table against SoapCalc-confirmed weights; the fill assertions
 * prove the volume model gets fit-vs-overflow right — including the batches that overflowed. The
 * oval batches (#2, #5, #7) were recorded as fitting against a cavity volume computed from the
 * mold's dimensions; against the cavity measured with water on 2026-10-22 they are all oversized,
 * and Batch #7's leftover batter is the evidence.
 *
 * This is a regression guard, not the whole proof of the port: the seven batches only exercise one
 * of the five places the calculator rounds, which is why `roundHalfEven` has its own unit test.
 */

export interface Fixture {
  batch: number;
  blend: Record<string, number>;
  oilsG: number;
  superfatPct: number;
  waterPct: number;
  fragranceG: number;
  moldKey: string;
  /** The weight actually recorded in the archive, or `null` where the recorded weight is a
   *  preserved mistake and only the fit verdict is being asserted. */
  recordedLye: number | null;
  expectFit: boolean;
  note: string;
}

export const SELF_CHECK: Fixture[] = [
  {
    batch: 1,
    blend: { olive: 72, coconut: 18, castor: 10 },
    oilsG: 900,
    superfatPct: 5,
    waterPct: 38,
    fragranceG: 27,
    moldKey: "bb-10in-loaf",
    recordedLye: 123,
    expectFit: true,
    note: "first batch; domed slightly",
  },
  {
    batch: 2,
    blend: { olive: 72, coconut: 18, castor: 10 },
    oilsG: 540,
    superfatPct: 5,
    waterPct: 38,
    fragranceG: 36,
    moldKey: "bb-6cav-oval",
    recordedLye: 74,
    expectFit: false,
    note: "first oval; oversized against the measured cavity",
  },
  {
    batch: 3,
    blend: { olive: 72, coconut: 18, castor: 10 },
    oilsG: 1787,
    superfatPct: 5,
    waterPct: 38,
    fragranceG: 120,
    moldKey: "nurture-5lb",
    recordedLye: null,
    expectFit: false,
    note: "OVERFLOWED — lye was scaled not recalculated",
  },
  {
    batch: 4,
    blend: { olive: 72, coconut: 18, castor: 10 },
    oilsG: 1600,
    superfatPct: 5,
    waterPct: 38,
    fragranceG: 104,
    moldKey: "nurture-5lb",
    recordedLye: 218,
    expectFit: true,
    note: "SoapCalc-confirmed 217.90",
  },
  {
    batch: 5,
    blend: { olive: 62, coconut: 28, castor: 10 },
    oilsG: 540,
    superfatPct: 6,
    waterPct: 38,
    fragranceG: 11,
    moldKey: "bb-6cav-oval",
    recordedLye: 75,
    expectFit: false,
    note: "SoapCalc-confirmed 75.18; oversized against the measured cavity",
  },
  {
    batch: 6,
    blend: { olive: 62, coconut: 28, castor: 10 },
    oilsG: 1600,
    superfatPct: 6,
    waterPct: 38,
    fragranceG: 44,
    moldKey: "nurture-5lb",
    recordedLye: 223,
    expectFit: true,
    note: "SoapCalc-confirmed 222.80",
  },
  {
    batch: 7,
    blend: { olive: 45, coconut_76: 20, shea_butter: 15, cocoa_butter: 10, castor: 10 },
    oilsG: 1071,
    superfatPct: 7,
    waterPct: 38,
    fragranceG: 0,
    moldKey: "bb-6cav-oval-x2",
    recordedLye: 143,
    expectFit: false,
    note: "SoapCalc-confirmed 142.85; first butters; overfilled both ovals with batter left over",
  },
];

/** The fill percentages the calculator produces, to one decimal — the same figures the archive
 *  records in frontmatter (`fill_pct`, or `fill_pct_correct` for the oval batches sized before the
 *  ovals were measured). Asserted exactly so a drift in the volume model shows up as a
 *  test failure rather than as a still-passing fit verdict. */
export const EXPECTED_FILL_PCT: Record<number, number> = {
  1: 100.1,
  2: 118.2,
  3: 109.1,
  4: 97.6,
  5: 114.6,
  6: 95.2,
  7: 112.3,
};
