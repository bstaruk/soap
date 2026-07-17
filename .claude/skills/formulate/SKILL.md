---
name: formulate
description: The entry point of the soap loop. Talk through a batch — mold, use case, fragrance, any specific oils — converge on a shared understanding, then generate a Draft recipe with every number from tools/lye.py. Reads inventory but never writes it; hands off to Brian's SoapCalc cross-check, which is the only thing that moves a recipe to Ready. Use when starting a new batch.
---

# Formulate — design one batch

A conversation that ends in a Draft recipe file. This is where a batch is thought through and written down; it is not where the batch is made (that's the counter) or recorded (that's `retro`). One session designs one recipe.

The whole skill rests on one rule from the root [`CLAUDE.md`](../../../CLAUDE.md): **Claude never does lye arithmetic.** Every weight in the output comes from [`tools/lye.py`](../../../tools/lye.py). The skill's job is to hold a good design conversation and then run the calculator — not to be the calculator.

## 1. Ground before talking

Read, every session, before proposing anything:

- The root `CLAUDE.md` (the hard rules) and this repo's current state.
- [`docs/formulation.md`](../../../docs/formulation.md) — the house blends, the rails, the fragrance rates. This is what a proposal reasons from.
- [`docs/method.md`](../../../docs/method.md) — the current method the recipe will render from.
- [`inventory/molds.toml`](../../../inventory/molds.toml), [`inventory/fragrances.toml`](../../../inventory/fragrances.toml), [`inventory/staples.toml`](../../../inventory/staples.toml) — what's actually on hand. **Read-only.** Formulate never edits inventory; stock changes belong to `inventory`, depletion to `retro`.
- The recent `recipes/` — what's been made, what's still curing, what a new batch might build on or avoid repeating.

## 2. Lock the brief

Converge, in conversation, on the details Brian named in the request and the ones he didn't:

- **Which mold.** Sets the batch size and the fill ceiling. If unstated, ask — it's the one input nothing else can be computed without.
- **Use case.** Hand bar, body/shower bar, gift, experiment. This picks the house blend and superfat (`docs/formulation.md`), and a use case outside the two known blends is a real design conversation, not a default.
- **Fragrance.** Read the ledger for what's on hand, how much, its vanillin (browning) and behavior (acceleration). A nearly-spent bottle either sets the batch size or gets blended. Never spec more than the bottle holds.
- **Any specific oils or intent** — a wish to use up a nearly-spent bottle, try coffee grounds, aim for a pale bar, whatever. Surface the consequences (e.g. "Vanilla Bean will brown that pale bar dark").

For real forks, present options and a recommendation and let Brian choose — the structured question feature when available, otherwise conversationally. Don't silently pick for him on anything that shapes the bar.

## 3. Let the calculator do the numbers

Once the brief is settled, and only then:

- **To size the batch to the mold:** `python3 tools/lye.py --fit <mold> --blend <...> --superfat <n> --water 38 --fragrance-pct <n> --target-fill <92–95>`. Aim for 92–95% of the mold's ceiling — full bars, real overflow margin. Never design to 100%.
- **To produce the final weights:** `python3 tools/lye.py --mold <mold> --oils <g> --blend <...> --superfat <n> --water 38 --fragrance <g>`. Paste the real output; do not transcribe numbers by hand or "clean them up."
- If the fill comes back over the ceiling, the batch is too big for the mold — resize, don't rationalize. The calculator saying OVERFLOWS is the Batch #3 guard doing its job.

Never compute, scale, round, or adjust a lye weight yourself. If the calculator can't answer something (a new oil with no SAP value), stop — that oil needs a validated entry in `reference/sap-values.toml` first, and that's an `inventory`/reference task, not a guess to make here.

## 4. Write the Draft

Create `recipes/NNN-<slug>.md` from the template in [`recipes/README.md`](../../../recipes/README.md):

- **Frontmatter** carries the settled data — mold, blend, superfat, water, `lye_g`, `fill_pct`, fragrance ids and grams, yield — all from the calculator. `status: draft`. `soapcalc_confirmed: false`.
- **Body** is the full kitchen sheet: the one-line **Safety** reminder in the header block, the weight table, and the complete current method inline from `docs/method.md`, tailored to this mold and fragrance (mold prep, whether the fragrance accelerates, loaf-cut vs oval). It must stand alone at the counter.
- Fragrance ids must match `inventory/fragrances.toml` keys — they're what `retro` debits at pour.
- The number is the batch's number (next after the highest existing).

## 5. Hand off to the confirmation gate

The recipe is **Draft, not Ready.** Tell Brian plainly:

> This is Draft. Cross-check the lye on SoapCalc — 62/28/10, 1600g, 6% SF, 38% water — and if it matches, set `soapcalc_confirmed: true` and `status: ready`.

**Only Brian's SoapCalc cross-check moves a recipe to Ready.** The skill may state the calculator's number and that the calculator self-check passes, but it never asserts the recipe is safe on its own authority and never sets `ready` or `soapcalc_confirmed: true` itself. That gate is the second opinion the whole design depends on.

## Guardrails

- **Never do lye math.** Every weight comes from `tools/lye.py`. No exceptions, no "just this once for a round number."
- **Inventory is read-only here.** No edits to molds, fragrances, or staples. Depletion happens at pour, in `retro`.
- **Never set `ready` or `soapcalc_confirmed`.** The skill produces Draft; Brian's cross-check produces Ready.
- **Never design to the rim.** Target 92–95% fill. A batch the calculator flags as overflowing gets resized, not talked into fitting.
- **Don't invent an oil or a SAP value.** An oil not in `reference/sap-values.toml` can't enter a recipe until it's added and validated against SoapCalc.
- **One recipe per session.** Several ideas worth pursuing → write one, note the rest in chat for a future session.
