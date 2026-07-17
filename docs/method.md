# House Method — Cold Process

This is the current process, the one every new recipe renders from. It is the **refined era** that landed in Batch #4 and has held since: clay stick-blended into the oils up front, the 6qt stockpot on induction with no transfer step, an IPA spritz on the poured top, and — new as of Batch #6 — the miter box at a 1" cut.

Earlier batches describe an older process (All-Clad bowls, a post-trace clay slurry, a hand-stir for fragrance, a freehand knife). That is not drift to fix — a poured recipe is frozen history. See [`recipes/README.md`](../recipes/README.md).

This document is the *source* a recipe is built from. It is never something a recipe links to — the recipe carries its full method inline, because it gets read at the counter with gloves on. When this method changes, new recipes render from the new version; already-poured recipes keep the era they were made in.

## Safety — the non-negotiables

This is the canonical list. A recipe carries a one-line **Safety** reminder in its header block (glasses and gloves before lye · lye into water, never the reverse · ventilate · soap-only equipment) rather than repeating this section in full; the site renders the full list as a collapsed disclaimer on every recipe page. Recipes poured before 2026-07 carry the older verbatim Safety First block — frozen history, not drift to fix.

- Safety glasses and nitrile gloves on **before** touching lye.
- Lye (NaOH) is caustic — it burns skin and eyes on contact.
- Always add **lye to water**, never water to lye. (Reverse, and it can erupt.)
- Work in a **well-ventilated** area — the fumes are brief but harsh; don't lean over the pitcher.
- **Soap-only equipment** — nothing that touches lye or raw batter ever returns to kitchen use.
- **Raw batter is caustic** until it saponifies. An overflow gets wiped with a damp cloth, then a vinegar-dampened cloth, before it sets.

## The number rule

**No lye weight is ever eyeballed, scaled, or done by hand.** It comes out of [`tools/lye.py`](../tools/lye.py), which is pinned to the same SAP table SoapCalc uses. Then it gets **cross-checked on SoapCalc** before the pour. The calculator is the first opinion; SoapCalc is the second; the recipe is not `Ready` until both agree. Batch #3 is why — its lye was scaled from a previous batch instead of recalculated, and it ran over a point of superfat below its label.

## Standing parameters

The house defaults, derived from the batches to date. A recipe may depart from these, but the departure is a decision worth noting, not a default.

- **Water:** 38% of oil weight. (Runs a ~26% lye concentration — on the fluid side, which buys working time and matters for the fill math.)
- **Superfat:** 5% for body bars, 6% for the high-coconut hand bar (the extra fat offsets the extra cleansing).
- **Kaolin clay:** 2% of oil weight, stick-blended into the oils.
- **Sodium lactate:** ~1 tsp per pound of oils (the calculator gives the millilitres), into the *cooled* lye solution.
- **Temperature:** combine oils and lye both in the **105–120°F** window, within ~10°F of each other.
- **Cut:** 1" bars in the miter box.

## The process

### 1. Gear up
Glasses and gloves on. Ventilation on. Pre-weigh every ingredient into its own container before anything is combined. If the fragrance accelerates (check the recipe), have the clay and fragrance fully staged *before* you reach trace.

### 2. Prep the mold
- **Nurture 5 lb loaf:** assemble the silicone liner in the wood frame, push-out holes down; set the clear acrylic lid aside. No towel insulation — the clear lid handles soda ash.
- **Brambleberry 10" loaf:** set it on a flat cutting board so the silicone can't sag under load. No lining.
- **Brambleberry oval:** set on a flat surface. No prep.

### 3. Lye solution *(make it first — it needs ~30 min to cool)*
1. Weigh the distilled water into the 2qt stainless bowl.
2. Weigh the lye pellets separately, into a vessel of at least 350 ml (218g+ of pellets won't fit a 1-cup bowl).
3. **Pour lye into water** — never the reverse. Stir until clear; it heats to ~185°F and gives off brief fumes. Don't lean over it.
4. Stir in the sodium lactate.
5. Set it aside to cool to **105–120°F**.

### 4. Oils and clay
1. Melt the coconut oil, then combine it with the olive and castor in the 6qt stockpot on the induction element.
2. **Stick-blend the kaolin clay straight into the combined oils** until smooth — no slurry cup.
3. Bring the oils to **105–120°F**, within ~10°F of the lye solution.

### 5. Combine and trace
1. Pour the cooled lye solution into the stockpot — blend in place, no transfer.
2. Stick-blend in **5–10 second bursts**, alternating with hand stirring, until **light trace** (the batter thickens just enough to leave a faint trail off the blender). The high-olive blends are forgiving; the higher-coconut hand blend moves a touch faster.

### 6. Fragrance
1. Pre-mix the fragrance in a cup, then add at light trace.
2. **Non-accelerating** fragrances fold in with a few low-speed stick-blend pulses. **Accelerating** ones get a 1–2 minute hand stir and speed — no stick blender, and pour fast.

### 7. Pour, spritz, rest
1. Pour into the prepped mold; tap to release bubbles; smooth the top.
2. Spritz the top with 99% isopropyl alcohol to prevent soda ash.
3. On the Nurture mold, seat the clear acrylic lid. On the open molds, bridge cardboard over the top on risers so nothing touches the soap.
4. Leave undisturbed **24–48 hours** (a few days is fine).

### 8. Unmold and cut
1. Wait until it's firm and not sticky. Give it more time if it's soft.
2. Loaf: remove the wood sides, lift the liner, peel it off the loaf. Oval: flex the silicone and pop each bar out.
3. Loaf: cut at **1" in the miter box** with the bench scraper. Oval: no cutting.
4. **The cure clock starts at the cut**, not the pour.

### 9. Cure *(4–6 weeks)*
1. Rack the bars with airflow on all sides; cool, dry, out of direct sun.
2. **4 weeks minimum**; 6–8 is better for these high-olive bars. The higher-coconut hand bar hardens faster but still wants a full cure for mildness.
3. Label with the batch and cut date.
