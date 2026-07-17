---
name: inventory
description: Keep the cabinet honest. Add or retire a mold, log a new fragrance bottle, reconcile a re-weighed bottle, update equipment as it changes, or add a new oil's validated SAP value. Owns the inventory/ and reference/ data — the state formulate reads and retro debits. Does NOT deplete fragrance from making soap (that's retro's job at pour). Use when the physical cabinet changes: something arrives, runs out, gets retired, or gets re-measured.
---

# Inventory — keep the cabinet honest

The write lane for what's on hand. `formulate` reads this data and `retro` debits the fragrance ledger at pour; this skill handles every *other* change to stock — new arrivals, retirements, re-measurements, and new validated reference data. It exists because inventory drifts silently: the All-Clad bowls sat listed two method-eras after they were retired, and a wrong "remaining" is how Batch #5's fragrance went missing.

All inventory and reference data is **TOML** (read by the zero-dependency calculator). After any change that touches derived numbers, run `python3 tools/lye.py --self-check` to prove nothing drifted.

## Molds — `inventory/molds.toml`

Adding a mold is mostly measurement. What the calculator needs is real, not advertised:

- **Cavity dimensions measured inside the silicone**, in inches — the space batter actually occupies. Ignore the product page's outer dimensions.
- **`cavity_ml`** — the real internal volume. Compute it from the cavity dimensions (`L × W × H` in inches × 16.387 = mL) or, better, measure it: fill the mold with water, weigh it, 1 g ≈ 1 mL. For a cavity mold, measure one cavity and multiply.
- **`lid` and `max_fill_pct`** — does batter have to clear a lid (like the Nurture), or can it dome freely (an open loaf)? The ceiling is lower for a lidded mold. Start conservative; tighten it as real batches prove where the edge is, and record that in `fill_evidence`.
- **Miter-box clearance** — if it's a loaf, does its width and height clear the cutter's 4.625" × 3.5" opening? Record it in `cutter.clears`.

Retiring a mold: note it, don't delete the history — a poured recipe still points at it.

## Fragrances — `inventory/fragrances.toml`

The ledger is the careful part. `remaining_g` is always **`initial_g` minus the sum of the `used` list** — never a hand-typed number, because a hand-typed number is what has nothing to check it.

- **New bottle:** add an entry with `initial_g` (convert from oz: × 28.35), empty or absent `used`, and `remaining_g = initial_g`. Fill in what the supplier publishes — `vanillin` (browning), `max_usage_pct`, `behavior` (acceleration, ricing, discoloration), `scent`. Leave a field `"unknown"` rather than guessing; a guessed number here looks measured and misleads a future formulation.
- **Restock of the same fragrance** (a fresh bottle of one you've used): simplest is to raise `initial_g` by the new bottle's weight and note it — the ledger keeps reconciling. (Or, if you'd rather track bottles separately, give it a new key.)
- **Re-weigh reconciliation:** if you put a bottle on the scale and it doesn't match `remaining_g`, that gap is real information — evaporation, spillage, or an unrecorded use. Record it as a `used` entry with a `note` and no `batch`, e.g. `{ note = "re-weigh 2026-08-01, evaporation/loss", g = 3 }`, then recompute `remaining_g`. The ledger stays the single source of truth and `--self-check` still passes. Don't silently overwrite `remaining_g`.
- **Depletion from making soap is NOT this skill.** That's `retro` at pour. This skill handles arrivals and corrections, not batch consumption.

## Staples — `inventory/staples.toml`

The always-on-hand palette (olive, coconut, castor, lye, water, additives). Not depletion-tracked — these are bulk-bought and restocked. Update when a house rate changes (with the evidence for it) or a new staple joins the palette. A rate change is really a formulation decision — consider whether it belongs in `docs/formulation.md` too.

## Equipment — `inventory/equipment.toml`

The one that drifts fastest. When a tool arrives or gets retired, move it — don't just add. A retired vessel goes to `[[superseded]]` with what replaced it and why; the `current` section is what's actually in use this method-era. Keeping `superseded` populated is how a reader knows an old recipe's All-Clad bowl is history, not a mistake. A material method change (a new mixing vessel, a new cutter) probably also touches `docs/method.md`.

## New oils — `reference/sap-values.toml`

Adding an oil to the palette is the highest-stakes inventory change, because it feeds the lye math.

- **Never guess a SAP value.** Look it up on [SoapCalc](https://www.soapcalc.net), use SoapCalc's value, and record which entry it came from (`soapcalc_entry`) — the table is pinned to SoapCalc precisely so the calculator and Brian's cross-check agree.
- Add `density_g_per_ml` too (needed for the fill model) and a note on the oil's role and any substitution traps (like pomace vs regular olive).
- Changing an existing value invalidates the cross-check behind every `ready` recipe. Don't — except to correct a genuine error, and then say so loudly.
- After adding, extend the calculator's self-check if you have a SoapCalc-confirmed batch to pin it against, and run `--self-check`.

## Guardrails

- **`remaining_g` is always derived, never typed.** initial minus used. Reconcile discrepancies with a noted `used` entry, not an overwrite.
- **Never deplete fragrance for a batch here.** Pour depletion is `retro`'s, at pour, so stock and batches stay in one lane.
- **Never guess a SAP value or a supplier spec.** Verify against SoapCalc; leave unknowns `"unknown"`.
- **Retire, don't erase.** Superseded equipment and molds stay as history because frozen recipes still reference them.
- **Prove it after.** `python3 tools/lye.py --self-check` after any change to derived data.
