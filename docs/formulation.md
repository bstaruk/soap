# House Formulation Doctrine

How a recipe gets designed here — the ratios that have worked, why they work, and the rails a new formula stays inside. This is what `formulate` reasons from. It is taste plus six batches of evidence, not chemistry law; a departure is allowed, but it's a decision, not a default.

The backbone is **Bastille** — a soap that is mostly olive oil (a true Castile is 100% olive). Olive makes a mild, conditioning, hard-when-cured bar that's gentle enough for daily use. The rest of the formula is small levers on top of that.

## The two house blends

Everything to date is one of these two, and they cover the whole use-case range so far.

### Body bar — 72 / 18 / 10 at 5% superfat
Olive 72% / coconut 18% / castor 10%. The default for a bar that isn't washing hands ten times a day. High olive for mildness, 18% coconut for enough lather and cleansing without stripping, 10% castor for creamy bubbles. Batches #1–#4.

### Hand bar — 62 / 28 / 10 at 6% superfat
Olive 62% / coconut 28% / castor 10%, superfat bumped to 6%. A frequently-used hand bar needs more cleansing and a bubblier lather, which is the 28% coconut — but 28% coconut alone would start to dry skin, so the extra superfat cushions it back. The two moves are a pair; don't make one without the other. Batches #5–#6.

## The levers, and their rails

- **Olive** is the backbone — 62–72% here. Down toward 62 makes room for more coconut; up toward 72 makes the mildest bar. This is the balance you actually turn.
- **Coconut** is the cleansing/lather dial — 18–28%. Below 18, lather goes flat; **above ~30% it reads as a degreaser on skin.** 28% is the house ceiling and it's the reason the hand bar runs 6% superfat.
- **Castor** stays pinned at **10%**. It's a small lever with real effect on lather creaminess; above ~15% bars turn sticky. No batch has had a reason to move it.
- **Superfat** is the free-oil safety margin — 5% for body, 6% for high-coconut. Higher is milder but softer and shortens shelf life; lower is harder and more cleansing but less forgiving of any lye error. On a 1g scale, 5–6% also keeps a comfortable margin against rounding.
- **Water** at 38% of oils is the house constant. More water is a fluider batter and a longer cure; less accelerates trace and firms faster. It also moves the fill math, so it isn't a free knob — [`tools/lye.py`](../tools/lye.py) re-checks fit whenever it changes.

## Fragrance

Load rates, all as a percentage of oil weight, from what's actually been poured:

- **Light ~2%** — a whisper of scent, or when the fragrance browns and you want to keep the bar pale. (Batch #5.)
- **Moderate ~3%** — essential-oil batches, where more is expensive and fades anyway. (Batch #1.)
- **Strong ~6.5%** — fragrance oils where the scent is the point. (Batches #2, #3, #4.) This is about the ceiling for these; most FOs list a max around 5–6% for leave-on-adjacent use.

`formulate` pulls the real per-oil data from [`inventory/fragrances.toml`](../inventory/fragrances.toml). Three things there change a design:

- **Vanillin browns the bar.** High-vanillin fragrances (Vanilla Bean, the gourmands) turn a bar tan-to-dark-brown over cure. That's not a defect to avoid — it's a look to design around, and it pairs naturally with a kraft-paper wrap. But it rules out a pale or white bar.
- **Acceleration steals your working time.** An accelerating fragrance (Coconut + Praline) means clay and scent fully staged before trace, a hand stir instead of the stick blender, and a fast pour. Don't pair it with an intricate technique.
- **Amount on hand caps the batch.** A nearly-spent bottle (right now: Vanilla Bean ~9g, Sensuous Sandalwood ~7g, Coconut + Praline ~5g) either sets the batch size or gets blended with something else. `formulate` reads the ledger so it won't spec 44g of a 7g bottle.

## How `formulate` uses this

1. **Mold + use case → blend and superfat.** Hand-washing picks the hand bar; a body/shower bar picks the body bar. A new use case is a real design conversation, not a default.
2. **Mold + target fill → oil weight**, via `tools/lye.py --fit`. Aim for **~92–95%** of a mold's ceiling — full bars, real margin against overflow. Never design to 100%.
3. **Fragrance choice → check the ledger** for amount, vanillin, and behavior; set the load rate to taste and to what the bottle holds.
4. **Everything → `tools/lye.py`** for the actual weights, fill, and yield. Never by hand.
5. **Brian cross-checks on SoapCalc.** Only then is it `Ready`.

## Room to grow

Directions the palette could take, noted so they're on the radar — none tried yet, each a real design conversation when it comes up:

- **A new oil** (shea, cocoa butter, sweet almond) means adding a validated SAP value to [`reference/sap-values.toml`](../reference/sap-values.toml) first — verified against SoapCalc, never guessed — and probably its own small run before it joins a real batch.
- **Coffee grounds** as an exfoliant/deodorizer are staged in the staples but have never been used; the first batch that includes them is doing something genuinely new.
- **A distinct kitchen bar** (higher coconut, coffee grounds, maybe a lower superfat since it's washing dishes not skin) would be a third blend worth formalizing once it's proven.
