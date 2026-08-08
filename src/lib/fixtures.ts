/** Six real batches, their recorded numbers, and what actually happened.
 *
 * The lye assertions prove the SAP table against SoapCalc-confirmed weights; the fill assertions
 * prove the volume model gets fit-vs-overflow right — including the one batch that overflowed.
 *
 * This is a regression guard, not the whole proof of the port: the six batches only exercise one
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
    expectFit: true,
    note: "first oval",
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
    expectFit: true,
    note: "SoapCalc-confirmed 75.18",
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
    note: "SoapCalc-confirmed 222.80; still in mold",
  },
];

/** The fill percentages the Python calculator produced, to one decimal — the same figures the
 *  archive records in frontmatter. Asserted exactly so a drift in the volume model shows up as a
 *  test failure rather than as a still-passing fit verdict. */
export const EXPECTED_FILL_PCT: Record<number, number> = {
  1: 100.1,
  2: 98.9,
  3: 109.1,
  4: 97.6,
  5: 95.9,
  6: 95.2,
};
