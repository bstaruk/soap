# soap

A cold-process soap workflow run through [Claude Code](https://claude.com/claude-code) — inventory, recipe formulation, and batch history, wired together as a repeatable skill loop.

I'm a solo hobbyist. I started making soap because I was tired of paying $7 a bar for olive-oil soap on Etsy, and this repo is how I keep it consistent: what's in my cabinet, how I formulate a batch against a specific mold, and how each batch actually turned out. It's **public as a worked example** — not a product or a template, just a real look at how I use AI for something that isn't my day job. The soap is mostly olive oil (a "Bastille" bar); the interesting part is the loop.

## Why a repo, and why skills

I used to run all this out of a Claude.ai Project — a pile of notes that slowly got disjointed. The problem wasn't Claude, it was that nothing was *structured*: numbers lived in prose, "remaining" amounts were hand-edited and drifted, and I had detailed process notes but no discipline around them. Moving it into a repo with **skills** fixes that. Each established workflow is a documented skill with one job, and the data a tool needs lives in real files a tool can read.

The payoff showed up immediately: importing six batches surfaced a fragrance that had gone unaccounted for three weeks, a batch whose lye was scaled instead of recalculated, and a mold-capacity number that had caused an overflow — all things a pile of notes hid and structured data caught.

## The loop

Three skills, invoked as `/name` in Claude Code:

1. **`/formulate`** — the entry point. We talk through a batch: which mold, what it's for, which fragrance, any oils I want to feature. Once we agree, it generates a recipe with every weight computed by the calculator — never by hand.
2. **Make it** (or don't). I always cross-check the lye on [SoapCalc](https://www.soapcalc.net) before pouring. Only my confirmation moves a recipe from Draft to Ready.
3. **`/retro`** — close the loop. Log the pour (which debits my fragrance stock), the cut (which starts the cure clock), and — weeks later — how the cured bar actually turned out. Or abandon a recipe I never made.

Keeping the cabinet current is **`/inventory`**: molds, fragrances, staples, equipment, and the saponification values new oils need.

A recipe moves `draft → ready → curing → cured`, with `abandoned` and `failed` as off-ramps. Only `/retro` advances a recipe past Ready — the same way only I can confirm the lye is safe.

## The calculator

[`tools/lye.py`](tools/lye.py) is the heart of it — no dependencies, just Python 3.11+. It computes the lye, the water, whether the batter will fit the mold, and the bar yield. Two things make it trustworthy:

- **The lye math is pinned to SoapCalc.** The saponification table ([`reference/sap-values.toml`](reference/sap-values.toml)) uses SoapCalc's values, so the calculator and my cross-check share a source and actually agree. It's the first opinion; SoapCalc is the second; a recipe isn't Ready until both match.
- **Mold fit is proved by volume, not a rule of thumb.** The usual "cubic inches × 0.4" rule over-predicts my water-heavy recipes by ~10% — it's what once overflowed a batch onto the mold. The calculator sums real component volumes against the real cavity instead.

It re-proves itself on every run against six real batches:

```
$ python3 tools/lye.py --self-check
```

Every batch reproduces its SoapCalc-confirmed lye weight, the one historical overflow is correctly flagged, and every fragrance's remaining amount reconciles against its usage ledger.

To design a batch by hand, or see what fills a mold:

```
$ python3 tools/lye.py --mold nurture-5lb --oils 1600 --blend olive=62,coconut=28,castor=10 --superfat 6 --water 38 --fragrance 44
$ python3 tools/lye.py --fit bb-6cav-oval --blend olive=72,coconut=18,castor=10 --superfat 5 --target-fill 93
```

## Repo map

- **[`CLAUDE.md`](CLAUDE.md)** — the rules Claude works under (this is the real spec for how the loop behaves).
- **`.claude/skills/`** — the three skills: `formulate`, `retro`, `inventory`.
- **`docs/`** — [`method.md`](docs/method.md) (how I make it) and [`formulation.md`](docs/formulation.md) (the house blends and why).
- **`inventory/`** — molds, fragrances, staples, equipment. What's actually in the cabinet.
- **`recipes/`** — one file per batch, the durable archive. Lifecycle and template in [`recipes/README.md`](recipes/README.md).
- **`reference/sap-values.toml`** — saponification values, pinned to SoapCalc.
- **`tools/lye.py`** — the calculator.

## A safety note

This repo works with **sodium hydroxide (lye)**, which is caustic and genuinely dangerous. Nothing here is a substitute for knowing what you're doing: gloves and eye protection, lye into water never the reverse, good ventilation, and your own independent lye-calculator check before every pour. The calculator here is a first line of defense, not the only one — which is exactly why I still cross-check every batch by hand.
