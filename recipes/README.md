# Recipes

One file per batch — the durable archive. A recipe is both a **kitchen sheet** (carried to the counter, read with gloves on) and a **record** (what was made, when, and how it turned out). Those two jobs shape every rule here.

## Kitchen-executable

A recipe **stands alone**. Full method inline, full safety inline, nothing to cross-reference, nothing to go open mid-pour. This is why the method isn't a link and the Safety section is copied verbatim into every file — a recipe you're reading with lye on your gloves cannot depend on a document you'd have to stop and open. The repetition is the feature, not duplication to factor out.

## Frozen at pour

The moment a batch is poured, its file is **history and does not change** — except the retro-owned Outcome section, which is appended after. Batch #1 describes All-Clad bowls and a Mac knife because that is what actually happened; "updating" it to the current method would erase the record of how the process evolved. New recipes render from the current [`docs/method.md`](../docs/method.md); old recipes keep their era. If you find a factual error in a poured recipe (a miscalculation, a wrong figure), correct it with a dated **Correction** note in the body — never a silent edit.

## The numbers are frozen too

Every weight in a recipe came out of [`tools/lye.py`](../tools/lye.py) and was cross-checked on SoapCalc. No weight is ever hand-scaled from another batch — that is the Batch #3 mistake, preserved in the archive as a warning. A recipe reaches `Ready` **only after** `soapcalc_confirmed: true`, which only Brian sets, after his own cross-check.

## Frontmatter is the data; prose is the sheet

The numbers a tool needs live in YAML frontmatter — mold, blend, superfat, water, lye, fill, dates, fragrance ids. The Markdown body is for the human at the stockpot. A future phone-friendly site renders from the frontmatter, so it carries the real data rather than forcing a parser to dig it back out of a table. (Recipes use YAML frontmatter; the inventory and reference data files use TOML, because those are read by the zero-dependency calculator. Different jobs, different formats.)

## Lifecycle

```
draft ──► ready ──► curing ──► cured
             │          │
             ▼          ▼
         abandoned   failed
```

- **draft** — being formulated. Numbers may still move. Owned by `formulate`.
- **ready** — formulated, calculated, and `soapcalc_confirmed`. Cleared to make. Owned by `formulate`; the confirmation is Brian's.
- **curing** — poured. `poured` is set; inventory is debited; the cure clock starts at `cut`. A blank `cut` means it's still in the mold. Owned by `retro`.
- **cured** — done curing, with a recorded verdict on the finished bar. Owned by `retro`.
- **abandoned** — a `draft`/`ready` recipe that was never made. Consumed nothing. Owned by `retro`.
- **failed** — poured but didn't survive (seized, separated, overheated, DOS). Inventory was still consumed. Owned by `retro`.

Only `retro` moves a recipe past `ready`. Only `formulate` creates and readies. This mirrors the discipline that keeps the arithmetic and the stock honest — one lane per transition.

## Naming

`recipes/NNN-slug.md` — a three-digit batch number and a kebab-case slug: `001-bastille-cedarwood-eucalyptus.md`. The number is the batch number and is stable once created. Status lives *inside* the file, never in the name. Archived recipes (abandoned, or old cured batches you want out of the main list) can move to `recipes/archive/` — same file, same name.

## Template

Copy this for a new recipe. The frontmatter is the real, tool-read data; the body is a realistic example, not a skeleton. `<!-- comments -->` explain each part — delete them as you fill it in.

```markdown
---
batch: 7                    # batch number; matches the filename prefix
status: draft               # draft | ready | curing | cured | abandoned | failed
mold: bb-6cav-oval          # a key from inventory/molds.toml
profile: hand               # body | hand — which house blend (see docs/formulation.md)
parent: 5                   # batch this descends from, or null for a fresh line
created: 2026-07-20
poured:                     # set by retro at pour; blank until then
cut:                        # set by retro at cut; blank until cut. cure clock starts here
oils_g: 520
superfat_pct: 6
water_pct: 38
oils: { olive: 62, coconut_76: 28, castor: 10 }   # percentages, must sum to 100
lye_g: 71                   # from tools/lye.py — NEVER hand-scaled
soapcalc_confirmed: false   # only Brian sets true, after his own cross-check → gate to `ready`
fill_pct: 92.9              # from tools/lye.py; must be under the mold's ceiling
fragrance:
  - { id: bb-sensuous-sandalwood, g: 16 }   # ids from inventory/fragrances.toml → drives depletion
yield: { bars: 6, cut_in: null }            # cut_in null for cavity molds
---

# Bastille Sandalwood Hand Bar

### Brambleberry 6-Cavity Oval — Cold Process
### Batch #7 — Draft

> **Mold:** Brambleberry 6-Cavity Oval (3.5" × 2.5" × 1" per cavity)
> **Yield:** 6 bars | **Cure:** 4 weeks minimum | **Active:** ~1 hour
> **Basis:** the hand bar (62/28/10 @ 6% SF), Batch #5's line

<!-- Safety First — verbatim in every recipe, never abbreviated. See docs/method.md. -->
## Safety First

- Safety glasses and nitrile gloves on before touching lye
- Lye (NaOH) is caustic — burns skin and eyes on contact
- Always add **lye to water**, never water to lye
- Well-ventilated area — fumes are brief but harsh
- Soap-only equipment — never returns to kitchen use

## Recipe

<!-- Weights straight from tools/lye.py. The confirm line is not optional. -->
| Component | Amount | Notes |
|---|---|---|
| Olive oil | 322g | 62% — extra virgin |
| Coconut oil, refined 76° | 146g | 28% |
| Castor oil | 52g | 10% — lather |
| Distilled water | 198g | 38% of oils |
| Sodium hydroxide (lye) | 71g | 62/28/10 @ 6% SF — **confirm on SoapCalc before pouring** |
| Sodium lactate | 6ml | Into the cooled lye solution |
| Sensuous Sandalwood FO | 16g | 3% — Brambleberry; no acceleration |
| Kaolin clay | 10g | Stick-blend into the oils before the lye |

> **6% superfat**, 62/28/10 hand blend. Fragrance at a moderate 3%. Fills the oval to ~93% — 6 bars.
> **Lye confirmed on SoapCalc:** ___g (fill in when you check).

## Instructions

<!-- The full current method, inline. Copy from docs/method.md and tailor to this batch's mold and fragrance. -->
### Step 1 — Gear Up
...

## Batch Notes
<!-- Written by you at make-time: what you observed, deviations, how trace and pour went. -->

## Outcome
<!-- retro-owned. Empty until the batch is made. Pour → cut → cured verdict get appended here. -->
```

## What goes where

- **Batch Notes** is yours, written when you make the batch — observations, deviations, how it behaved.
- **Outcome** belongs to `retro` and only `retro`. It stays empty until the batch is poured, then grows: the pour, the cut, and — weeks later — how the cured bar actually is. An empty Outcome on a cured batch is the whole point of the loop going unrealized.
