---
name: retro
description: Close the loop on a recipe after the counter. Modes — pour (Ready→Curing, debit the fragrance ledger, start tracking), cut (set the cut date, start the cure clock, record yield), cure (Curing→Cured, record the finished-bar verdict), abandon (a Draft/Ready never made), fail (poured but didn't survive). The only skill that moves a recipe past Ready or debits inventory. Use after making a batch, after cutting it, weeks later when it's cured, or when a recipe won't be made.
---

# Retro — close the loop

The counterpart to `formulate`. Where `formulate` designs, `retro` records what actually happened — and it's the only skill that advances a recipe past `ready` or touches fragrance stock. The archive exists to make the next batch better, and it only works if this skill actually runs. A cured bar with an empty Outcome taught us nothing.

Pick the mode from what Brian is telling you. When ambiguous, ask.

## Mode: pour — "I made it"

A `ready` (or `draft`, if he made it without a formal confirm) recipe became a real batch. This is the mode with side effects, so it's the careful one.

1. **Confirm it matches.** Did the batch go as written, or did anything change at the counter — a substituted fragrance, a different amount, a tweak? Record reality, not the plan. If the lye or oils changed, the recipe's calculated numbers no longer describe what's in the mold; note it prominently.
2. **Set status and date.** `status: curing`, `poured: <YYYY-MM-DD>`. Leave `cut` blank — it's still in the mold.
3. **Debit the fragrance ledger — the one write to inventory.** For each fragrance the batch used, append `{ batch = N, g = M }` to that fragrance's `used` list in [`inventory/fragrances.toml`](../../../inventory/fragrances.toml), and recompute `remaining_g` as `initial_g` minus the new ledger sum. Use the amounts actually poured, not the planned ones if they differ.
4. **Prove the ledger still reconciles.** Run `node tools/lye.ts --self-check` and confirm every fragrance still derives cleanly. This is the guard against exactly the drift that lost Batch #5's 11g — never skip it.
5. **Open the Outcome.** Append the pour to the recipe's Outcome section: date, fill as poured, anything notable. Note what the next retro should capture (the cut, then the cure).

Depletion happens **here, at pour** — never at `ready`. A recipe that was designed but not made consumed nothing.

## Mode: cut — "I cut it"

The loaf came out of the mold and got cut (or the oval got unmolded).

1. Set `cut: <YYYY-MM-DD>` in the frontmatter. **The cure clock starts now**, not at the pour.
2. Record the real yield — actual bar count and cut thickness — in `yield` and the Outcome. If it differs from the calculator's estimate, that's data worth keeping.
3. Note how it cut: cleanliness, whether it cleared the miter box, any crumbling or soft spots. Batch #6 is the first miter-box loaf, so its cut is a genuine unknown to capture.
4. Give the earliest usable date (cut + 4 weeks) and a fuller-cure date (cut + 6) as absolute dates.

Pour and cut often land a day or two apart; it's fine to do both in one session. They're separate modes because the cut is what starts the cure clock, and sometimes the cure check-in is weeks later.

## Mode: cure — "here's how it turned out"

Weeks later, the bar is cured and Brian's used it. This is the verdict the whole loop is for.

1. Set `status: cured`.
2. Record the finished-bar assessment in Outcome: hardness, lather (quantity, creaminess), how the scent held through cure, actual color/browning vs expected, skin feel, any DOS or issues, and the honest verdict — make it again, tweak it, or retire the idea. Draw out specifics; "it's good" doesn't help the next formulation.
3. If it suggests a formulation change (more coconut, different fragrance rate, a superfat tweak), note it — it's a candidate for the next `formulate` and possibly a `docs/formulation.md` update.

Not every batch gets this check-in, and that's expected. When it happens, it's the most valuable thing in the archive.

## Mode: abandon — "not making it"

A `draft` or `ready` recipe won't be made.

1. Set `status: abandoned`. Note why in a line (superseded by a better idea, ran out of a fragrance, changed plans).
2. **No inventory change** — nothing was consumed.
3. Offer to move the file to `recipes/archive/` to keep the active list clean, or to delete it if it never held anything worth keeping. Brian chooses; deletion is his call, not the skill's.

## Mode: fail — "it didn't survive"

A poured batch seized, separated, overheated, or came out unusable.

1. Set `status: failed`. Record what went wrong in Outcome, in detail — it's the most instructive kind of entry.
2. **Inventory was still consumed** — if the pour debit hasn't been recorded yet, do it now (same mechanics as pour mode, including the `--self-check`). Failed soap used up real fragrance.
3. Note the lesson for `docs/` if there's a process fix worth making.

## Guardrails

- **Only this skill moves a recipe past `ready`**, and only this skill debits fragrance stock. `formulate` reads inventory; `retro` writes the depletion.
- **Always `--self-check` after a ledger write.** An unproven ledger edit is how drift starts.
- **Record reality, not the recipe.** If the batch diverged from the plan, the Outcome captures what actually went in the mold.
- **Never rewrite a poured recipe's body or numbers** — the recipe is frozen history. Retro only appends to Outcome and updates status/date frontmatter. A factual error in a poured recipe gets a dated Correction note, never a silent edit.
- **Deletion is Brian's call.** The skill can propose archiving or deleting an abandoned recipe; it doesn't delete on its own.
