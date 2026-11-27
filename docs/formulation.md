# House Formulation Doctrine

How a recipe gets designed here — the ratios that have worked, why they work, and the rails a new formula stays inside. This is what `formulate` reasons from. It is taste plus seven batches of evidence, not chemistry law; a departure is allowed, but it's a decision, not a default.

The house bar is the **butter bar** — olive, coconut, shea, cocoa butter and castor — as of Batch #7. It grew out of **Bastille**, a soap that is mostly olive oil (a true Castile is 100% olive), which is what Batches #1–#6 were and what the two older blends below still are. Olive is still the largest single oil in every blend here; the rest of the formula is levers on top of it.

## The house blends

The butter bar is **the** house blend — the default for a new batch unless the brief names something else. The two Bastille blends came first and are proven; they stay documented, but they are no longer what gets made by default.

### Butter bar — 45 / 20 / 15 / 10 / 10 at 7% superfat — the house blend
Olive 45% / coconut 20% / shea butter 15% / cocoa butter 10% / castor 10%. Designed as a bath bar that also works at the sink. The 25% hard butters do three jobs: a hard bar that released from the oval molds cleanly at 41 hours with no freezer, where the high-olive blends come out soft; a creamy, dense lather rather than a bubbly one; and enough hardness to carry a 7% superfat, the highest here, which leaves skin soft with no tightness. It cures ivory, and the unrefined cocoa butter leaves a subtle cocoa scent in the cured bar with no fragrance added. Batch #7, cured 2026-11-27 with the verdict "would not change a single thing" — and declared the house blend the same day. **That is one batch of evidence, and it was unscented**; a fragrance is a new variable (see Fragrance below).

### Body bar — 72 / 18 / 10 at 5% superfat
Olive 72% / coconut 18% / castor 10%. The default for a bar that isn't washing hands ten times a day. High olive for mildness, 18% coconut for enough lather and cleansing without stripping, 10% castor for creamy bubbles. Batches #1–#4; not poured since.

### Hand bar — 62 / 28 / 10 at 6% superfat
Olive 62% / coconut 28% / castor 10%, superfat bumped to 6%. A frequently-used hand bar needs more cleansing and a bubblier lather, which is the 28% coconut — but 28% coconut alone would start to dry skin, so the extra superfat cushions it back. The two moves are a pair; don't make one without the other. Batches #5–#6. Confirmed as the house hand soap on 2026-10-22, then overtaken as the default by the butter bar on 2026-11-27 — Brian doesn't expect to go back to the olive-heavy bars soon.

## The levers, and their rails

- **Olive** is the backbone — 62–72% in the Bastille blends, where down toward 62 makes room for more coconut and up toward 72 makes the mildest bar. The butter bar takes it down to 45% to make room for 25% butters. Nothing between 45 and 62 has been poured.
- **Coconut** is the cleansing/lather dial — 18–28%. Below 18, lather goes flat; **above ~30% it reads as a degreaser on skin.** 28% is the house ceiling and it's the reason the hand bar runs 6% superfat. The butter bar sits at 20%.
- **Castor** stays pinned at **10%**. It's a small lever with real effect on lather creaminess; above ~15% bars turn sticky. No batch has had a reason to move it.
- **Butters** are the hardness the olive never supplied — shea 15% and cocoa butter 10%, 25% together. Those are the only rates poured and they worked, so they are pinned rather than ranged. The usual guidance keeps cocoa butter at or under ~15% (above that bars turn brittle and lather drops); that is general advice, not house evidence. The cocoa butter is the unrefined wafers, not deodorized — it is part of the bar's scent. Butters bring trace on sooner than the high-olive blends, and cocoa butter starts to set below ~95°F, so a butter batch combines in the upper half of the temperature window.
- **Superfat** is the free-oil safety margin — 5% for the body bar, 6% for high-coconut, 7% for the butter bar, where the hard butters offset the softness a higher superfat usually costs. Higher is milder but softer and shortens shelf life; lower is harder and more cleansing but less forgiving of any lye error. On a 1g scale, 5–7% also keeps a comfortable margin against rounding.
- **Water** at 38% of oils is the house constant. More water is a fluider batter and a longer cure; less accelerates trace and firms faster. It also moves the fill math, so it isn't a free knob — [`tools/lye.ts`](../tools/lye.ts) re-checks fit whenever it changes.

## Fragrance

Load rates, all as a percentage of oil weight, from what's actually been poured:

- **Light ~2%** — a whisper of scent, or when the fragrance browns and you want to keep the bar pale. (Batch #5.)
- **Moderate ~3%** — essential-oil batches, where more is expensive and fades anyway. (Batch #1.)
- **Strong ~6.5%** — fragrance oils where the scent is the point. (Batches #2, #3, #4.) This is about the ceiling for these; most FOs list a max around 5–6% for leave-on-adjacent use.

`formulate` pulls the real per-oil data from [`inventory/fragrances.toml`](../inventory/fragrances.toml). Three things there change a design:

- **Vanillin browns the bar.** High-vanillin fragrances (Vanilla Bean, the gourmands) turn a bar tan-to-dark-brown over cure. That's not a defect to avoid — it's a look to design around, and it pairs naturally with a kraft-paper wrap. But it rules out a pale or white bar.
- **Acceleration steals your working time.** An accelerating fragrance (Coconut + Praline) means clay and scent fully staged before trace, a hand stir instead of the stick blender, and a fast pour. Don't pair it with an intricate technique.
- **The butter bar has never been scented.** Batch #7 was unscented, cured ivory, and smells faintly of its own cocoa butter. A fragrance there changes three things at once: vanillin would brown the ivory, an accelerating fragrance stacks on a blend that already traces sooner, and a strong load would bury the cocoa butter. The first scented butter bar is an experiment, not a repeat.
- **Amount on hand caps the batch.** A nearly-spent bottle (right now: Vanilla Bean ~9g, Sensuous Sandalwood ~7g, Coconut + Praline ~5g) either sets the batch size or gets blended with something else. `formulate` reads the ledger so it won't spec 44g of a 7g bottle.

## How `formulate` uses this

1. **Mold + use case → blend and superfat.** The butter bar is the default. The Bastille hand bar or body bar is made when Brian asks for it by name. A new use case is a real design conversation, not a default.
2. **Mold + target fill → oil weight**, via `tools/lye.ts --fit`. Aim for **~92–95%** of a mold's ceiling — full bars, real margin against overflow. Never design to 100%.
3. **Fragrance choice → check the ledger** for amount, vanillin, and behavior; set the load rate to taste and to what the bottle holds.
4. **Everything → `tools/lye.ts`** for the actual weights, fill, and yield. Never by hand.
5. **Brian cross-checks on SoapCalc.** Only then is it `Ready`.

## Room to grow

Directions the palette could take, noted so they're on the radar — none tried yet, each a real design conversation when it comes up:

- **A new oil** (sweet almond, say) means adding a validated SAP value to [`reference/sap-values.toml`](../reference/sap-values.toml) first — verified against SoapCalc, never guessed — and probably its own small run before it joins a real batch. Shea and cocoa butter came in this way for Batch #7.
- **A scented butter bar** — a non-vanillin fragrance, so the ivory holds, in a buttery / savory direction that sits with the cocoa butter rather than covering it. The idea from Batch #7's cure retro.
- **Coffee grounds** as an exfoliant/deodorizer are staged in the staples but have never been used; the first batch that includes them is doing something genuinely new.
- **A distinct kitchen bar** (higher coconut, coffee grounds, maybe a lower superfat since it's washing dishes not skin) would be another blend worth formalizing once it's proven.
