# Soap

A solo hobbyist's cold-process soap workflow. Track what's in the cabinet, formulate a batch against a real mold, make it, and record how it turned out — so the next batch is better than the last. Every established workflow runs through a skill, so the loop is repeatable rather than remembered.

The repo is **public as a worked example**, not as a boilerplate. The inventory is one person's actual stock and the formulation doctrine is one person's taste; the thing worth copying is the loop, not the contents.

## Repo map

- **`.claude/skills/`** — the loop. `formulate`, `retro`, `inventory`. Invoke as `/name`.
- **`docs/`** — how we make soap. `method.md` is the current house process; `formulation.md` is the house doctrine (ratios, superfat, water, fragrance rates).
- **`inventory/`** — what's on hand. `molds.toml`, `fragrances.toml`, `staples.toml`, `equipment.toml`.
- **`recipes/`** — one file per batch, the durable archive. Lifecycle and template: [`recipes/README.md`](recipes/README.md).
- **`reference/sap-values.toml`** — saponification values, pinned to SoapCalc.
- **`tools/lye.py`** — the calculator. Lye, water, mold fill check, yield. No dependencies.
- **`tools/site.py` + `tools/check.py`** — the static site ([soap.brian.staruk.net](https://soap.brian.staruk.net)) and the archive lint behind it. CI (`.github/workflows/site.yml`) re-proves every recipe's numbers through the calculator on every PR and deploys from `main`. Site-toolchain deps live in `tools/site-requirements.txt`; the calculator stays zero-dep.

## The loop

1. **`formulate`** — talk through the batch (mold, use case, scent, any oils you want in), converge on a shared understanding, then generate the recipe. Ends at `Ready` only after Brian's own SoapCalc cross-check.
2. **Make it.** Or don't.
3. **`retro`** — record the pour, the cut, and — weeks later — how the cured bar actually is. Or archive a recipe that never got made.
4. **`inventory`** — keep molds, fragrances, and staples honest as things arrive, run out, or get retired.

Between them, `formulate` reads inventory and never writes it, `retro` owns every status past `Ready`, and `inventory` owns stock. No skill crosses into another's lane.

## How we work

- **Recipes are kitchen-executable.** A recipe gets carried to the counter and read with lye on your gloves. It must stand alone: full method inline, no cross-referencing, nothing to go open. This is why `docs/method.md` is a *source to render from*, not a thing recipes link to. Safety is one compact reminder line in the recipe header; the canonical list lives in `docs/method.md`, and the site renders it as a collapsed disclaimer on every recipe page. Recipes poured before 2026-07 keep their older verbatim Safety First section — frozen history.
- **A poured recipe is history.** The moment a batch is made, its file freezes. Batch #1 describes All-Clad bowls and a Mac knife because that is what actually happened; retrofitting the current method onto it would destroy the record. Only the retro-owned Outcome section may be appended after the pour.
- **The calculator owns the arithmetic.** Claude does not do lye math. Ever. Not in its head, not by scaling a previous batch — `tools/lye.py` produces the numbers and the skill pastes them.
- **Ask, don't assume.** For decisions with real forks, present the options and a recommendation and let Brian choose — use the agent's structured question feature when available, otherwise ask conversationally.
- **The archive is for learning.** A batch with no recorded outcome taught us nothing. Recipes exist to make the next one better, which only works if `retro` actually runs.

## Hard rules

These are the ones that keep the soap from burning someone.

- **No lye weight reaches a recipe unless `tools/lye.py` produced it.** Not from a model, not from scaling a previous batch's number. Batch #3 scaled Batch #1's lye instead of recalculating and ran ~1.1 points of superfat below its own label — the cautionary tale is already in the archive.
- **No skill asserts a recipe is lye-safe on its own authority.** The calculator shows its work; it does not get a vote. Only `soapcalc_confirmed: true` — set by Brian, after his own cross-check at [SoapCalc](https://www.soapcalc.net) — may move a recipe to `Ready`. A skill that claims a recipe is safe has broken the one guard that matters.
- **The SAP table is pinned to SoapCalc.** Changing `reference/sap-values.toml` invalidates the cross-check behind every `Ready` recipe. It is a deliberate act with a re-verification cost, never a tidy-up.
- **Inventory depletes at pour, never at `Ready`.** A recipe that was never made consumed nothing.
- **Mold fit is proved by volume, never by a rule of thumb.** The 0.4 rule (cubic inches × 0.4 = oz of oils) over-predicts these recipes by ~10% because they run a lot of water; it is what overflowed Batch #3. The calculator sums real component volumes against real cavity volume.
- **Never guess at a number that belongs on a scale.** An unrecorded fragrance weight is an open question, not an estimate to quietly fill in.

## Conventions

- **Do not manually hard-wrap Markdown prose.** Keep each paragraph and list item on one physical source line; let editors and renderers wrap it visually.
- **Dates are absolute, never relative.** `cure until 2026-08-14`, never "six weeks out". Relative dates rot the moment they're written.
- **Units are pinned.** Grams for anything weighed (oils, lye, water, fragrance, clay). Millilitres for sodium lactate. Inches for molds and cuts. °F for temperatures. The scale reads whole grams, so lye rounds to whole grams.
- **Structured data lives in frontmatter; prose is the kitchen sheet.** The numbers a tool needs — mold, ratios, lye, fill, dates, fragrance ids — belong in YAML frontmatter, not buried in a Markdown table someone has to parse back out. The prose body is for the human holding the stick blender.
- **Prefer concrete annotated examples over blank fill-in skeletons** when writing guides or templates.
- **CLAUDE.md files stay under ~200 lines.** Prefer a nested CLAUDE.md next to what it governs over growing this one.

## Commits

**`main` is protected.** Work on a branch; changes reach `main` by pull request. Never commit directly to `main`.

Small, focused **Conventional Commits** — `type(scope): summary`. Autonomous inside an authorized skill flow; proposed at an approval gate outside one. Scopes: `recipes`, `inventory`, `skills`, `docs`, `tools`, `reference`.

```
docs(recipes): import batches 1-6 from claude project
docs(recipes): record batch 6 outcome — cut at 1", 18 bars
fix(inventory): correct sensuous sandalwood remaining to 7g
feat(tools): add mold fill check to lye calculator
feat(skills): add formulate skill
```

Recipes take `docs(...)` because in this repo they genuinely are documents.

## Memory

This project does **not** use Claude's cross-session memory. If something is worth remembering, it goes in the repo — a recipe, an inventory note, `docs/`, or a CLAUDE.md — where every fresh session reads it. Memory is machine-local and drifts; the repo is public and self-sufficient, which is the whole point. Don't create or update memory files; if something seems worth persisting, propose where in the repo it belongs.
