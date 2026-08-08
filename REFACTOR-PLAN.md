# TypeScript + Astro rewrite — plan

Branch: `refactor/typescript-rewrite`. This file is transient: it is deleted in the final commit of the refactor, and git history keeps it.

## Goal

Replace the three Python programs with TypeScript, and the hand-rolled static site generator with Astro, without changing a single number, a single recipe, or a single published URL. The soap data is format-neutral and stays exactly where it is; only the code that reads it changes language.

**Non-goals.** No visual redesign (Claude Design does that next, against clean markup). No new features. No change to the loop, the lifecycle, or the skills' behaviour — only the command strings inside them.

## Decisions taken

| Decision | Choice |
|---|---|
| CLI runtime | `node tools/lye.ts` — native Node type-stripping, no build step, no runner dependency. Local Node is v24.18.0, well past the 22.18 threshold. |
| Layout | Shared core in `src/lib/`, CLI entry points stay at `tools/lye.ts` and `tools/check.ts`, Astro in `src/pages` + `src/components`. Data directories do not move. |
| CSS | Plain CSS, one global stylesheet, ~85 lines. No framework. Semantic markup and microformats preserved; decoration dropped, **print styles kept**. See *CSS*, below. |
| Toolchain | Vitest, Prettier, `astro check`. No ESLint. |
| Package manager | npm. |

Pinned versions as of 2026-08-08: `astro@7.2.0`, `smol-toml@1.7.1`, `zod@4.4.3`, `yaml@2.9.0`, `vitest@4.1.10`, `prettier@3.9.6`, `@astrojs/check@0.9.10`, plus `typescript` — native type-stripping does no typechecking, so TypeScript is a real devDependency that `astro check` and the editor both need, and it gets pinned like the rest. Confirm each version resolves at install time rather than trusting this list.

`package.json` sets `"engines": { "node": ">=22.18" }`. Below that threshold type-stripping is off and `node tools/lye.ts` dies with a bare syntax error — an unhelpful failure for a tool that gets run at the counter.

### Why Astro, and why the full version

Two alternatives were weighed and rejected, and the reasoning is worth keeping because `site.py`'s own docstring argues the other way: *"a real static-site generator would want to own that layout instead of reading it."*

**An SPA (Vite, client-side routing) is the wrong shape.** `/feed.xml` must be a real file, so a build step is required regardless — an SPA is an SSG with extra steps. Deep links to `/recipes/<slug>/` would resolve only via the GitHub Pages `404.html` rewrite, which technically preserves the URLs while making every one of them a redirect. And the site is deliberately no-JS: the microformats exist so the page is readable without executing anything, and a recipe gets printed and carried to a pot of lye. None of that wants a JavaScript runtime between the file and the paper.

**A direct TS port of `site.py`** — ~500 lines plus `markdown-it`, `yaml`, `smol-toml`, no framework, no build — is genuinely lower-risk and reaches the same one-language outcome. It was rejected because the redesign is the point: f-strings in a 540-line file are a bad substrate for design work, and components plus a dev server are a good one. **Astro with content collections** was chosen over a thinner Astro (pages reading through `src/lib/data.ts`, no collections, no remark plugins) on the same reasoning — the collection API is the idiomatic path and ages better as the archive grows a page per batch. The cost is accepted knowingly: collections want to own `recipes/`, and the four open questions under *To verify against live docs* are the price of that. Resolve them early in Phase 3, before the components are written on top of them.

## What must survive

These are the properties the repo is built around. The rewrite is correct only if all of them hold afterwards.

1. **The calculator owns the arithmetic.** One module produces every lye weight, water weight, fill percentage, and yield. Nothing else computes them — not the site, not the lint, not a skill.
2. **The calculator runs without a build step.** `node tools/lye.ts --self-check` works on a clean checkout after `npm ci`, from any directory. It is read at the counter; it cannot depend on a compile.
3. **The calculator re-proves itself on every run.** The six-batch fixture and the fragrance-ledger reconciliation stay in `--self-check`, with human-readable output, because `retro` and `inventory` call it after every write.
4. **The archive is frozen.** `recipes/0*.md` must be byte-identical to `main` at the end of this work. This is the single strongest acceptance criterion and it is checkable with one `git diff`.
5. **The published URLs do not move.** `/`, `/recipes/<slug>/`, `/inventory/`, `/method/`, `/formulation/`, `/feed.xml`, `404.html`.
6. **CI proves the archive before it publishes anything.** The `check → build → deploy` job order is doctrine, not convenience.

### The one property that does not survive

`tools/lye.py` is zero-dependency stdlib, and CLAUDE.md, `README.md`, and `tools/site-requirements.txt` all say so. Node has no TOML parser, so `lye.ts` needs `smol-toml`. The invariant is restated rather than quietly dropped: *the calculator is the sole source of lye arithmetic, runs without a build step, and re-proves itself on every run.* Every place that claims "no dependencies" gets rewritten to say that instead. This is a deliberate doctrine edit, and it is the only one.

## Porting gotchas, measured

**Rounding — port the rule, do not sample it.** Python's `round()` is round-half-to-even; JS `Math.round()` is round-half-up. Every lye weight in the archive went through Python's rule. Actual unrounded values:

```
#1  122.5266 -> 123      #4  217.8251 -> 218
#2   73.5160 ->  74      #5   75.1888 ->  75
#3  243.2834 -> 243      #6  222.7815 -> 223
```

No lye weight lands on a boundary; the closest is Batch #1, 0.027 g clear of `.5`. But `compute()` rounds four values, not one — `lye_g_rounded`, `water_g_rounded`, `kaolin_g`, `sodium_lactate_ml` — and `fit_oils` rounds the solved oil weight before its final `compute()` call. Those are five call sites, and the six historical batches only measure one of them. `kaolin_g` is `oils × 0.02`, which lands exactly on `.5` for every odd multiple of 25 g of oils: 1225 g gives 24.5, where Python yields 24 and `Math.round` yields 25. The calculator's job is the next batch, not the six already frozen.

So: **write a `roundHalfEven()` helper in `calc.ts` and use it at every site where Python called `round()`.** Never `Math.round`. This makes the port exact by construction and demotes the fixture from sole evidence to regression guard, which is what a fixture should be.

**Sorting — every `.sort()` gets an explicit comparator, and one of them is load-bearing.** JS `Array.prototype.sort()` with no comparator sorts by stringified value: `[2, 10]` becomes `[10, 2]`. `lye_solution_density` sorts `(naoh_fraction, density)` pairs before interpolating (`lye.py:72`). Get that order wrong and the interpolation returns a wrong density → wrong batter volume → wrong fill % → a wrong fit-vs-overflow verdict, silently, unless a fixture happens to straddle the corrupted segment. The site's batch-number sorts have the same hazard with less at stake. Numeric comparators everywhere, no exceptions.

**Integer-keyed dicts become `Map`, never plain objects.** JS objects iterate integer-like keys in ascending numeric order regardless of insertion order. `site.py`'s `by_batch: dict[int, dict]` and `check.py`'s `batches: set[int]` are both integer-keyed. Today's code sorts explicitly at every use, so behaviour would survive the naive port by luck — which is exactly why it needs writing down.

**Dates.** pyyaml parses `poured: 2026-07-17` into a `date`; `check.py` relies on that for its ordering and `isinstance` checks. The `yaml` package's default core schema returns a **string**, and Astro's frontmatter parsing may return either. Rule for the rewrite: **dates are ISO strings end to end.** Compare lexicographically (correct for ISO-8601). Never call `new Date("2026-07-17")` — it parses as UTC midnight and renders in local time, which displays as the 16th in US Eastern and would silently shift every cure milestone on the site by a day. Cure-date arithmetic uses `Date.UTC(...)` and formats back to ISO; no date library needed. Schemas should accept `string | Date` and normalise to ISO, so it does not matter which the parser hands over.

**The date schema must reject, not merely normalise.** `check.py`'s `isinstance(fm.get("poured"), dt.date)` does double duty: it proves the field is present *and* that it is a real date. pyyaml hands `2026-13-45` back as a plain string, the isinstance check fails, and the lint goes red — that is a feature, not an accident. Under "ISO strings end to end" a naive `if (!fm.poured)` presence check accepts that typo silently. The zod schema therefore needs a strict `YYYY-MM-DD` pattern **plus** a calendar-validity refinement (round-tripping through `Date.UTC` and comparing back to the input string catches 13-month and 31-February), and `check.ts` must lean on the schema for well-formedness rather than re-testing presence by hand.

**The rendered HTML will not be byte-identical, and that is expected.** Python-Markdown is not a CommonMark implementation; Astro's remark pipeline is. They disagree in edge cases — nested list tightness, inline HTML handling, some emphasis parsing. No tool choice avoids this; a hand-rolled `markdown-it` port would diverge too, just differently. This is why Phase 3's acceptance is a *rendered-text* diff across all eleven pages rather than an HTML comparison: the question is whether any content was lost, not whether two markdown parsers agree on whitespace. Inspect the text diffs rather than skimming them — a dropped table row and a reflowed `<li>` look similar at a glance.

**Prettier must not touch the archive.** A formatter run over `recipes/` would reflow tables and violate "a poured recipe is frozen." `.prettierignore` excludes all Markdown and all TOML; Prettier formats `src/`, `tools/`, and config files only.

**Floor division.** `int(length // 1.0)` in `_yield` becomes `Math.floor(length)`.

**Repo-root resolution.** Python used `Path(__file__).resolve().parent.parent`. Use `fileURLToPath(import.meta.url)` in a `src/lib/paths.ts`, so the CLI works from any working directory. Do not use `process.cwd()`.

## Target layout

```
package.json  tsconfig.json  astro.config.mjs  vitest.config.ts  .prettierrc  .prettierignore
src/
  lib/
    paths.ts        repo-root resolution
    schema.ts       zod schemas — sap, molds, fragrances, staples, equipment, recipe frontmatter
    data.ts         load + validate the TOML files and recipe frontmatter
    calc.ts         pure arithmetic: resolveOilName, lyeSolutionDensity, compute, fitOils, moldYield
    report.ts       formatReport — the text batch sheet
    fixtures.ts     the six-batch self-check table
    dates.ts        ISO-string helpers, UTC-only arithmetic
    calc.test.ts    vitest over fixtures.ts
  content.config.ts
  plugins/
    remark-recipe-body.ts   strip leading H1 into frontmatter.title; strip legacy "Safety First" and set a flag
    rehype-repo-links.ts    rewrite relative hrefs to GitHub blob URLs
  layouts/Base.astro
  components/  RecipeCard.astro  SafetyDisclaimer.astro  StatusBadge.astro
  pages/
    index.astro  recipes/[...slug].astro  inventory.astro  method.astro  formulation.astro
    404.astro  feed.xml.ts
  styles/site.css
tools/
  lye.ts    check.ts
```

Unchanged and not moved: `recipes/`, `inventory/`, `reference/`, `docs/`, `.claude/skills/`, `CLAUDE.md`, `README.md`.

### tsconfig constraints

Native type-stripping bans anything requiring codegen and requires explicit extensions on relative imports. Set `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`, `allowImportingTsExtensions: true`, `noEmit: true`, `moduleResolution: "bundler"`, and extend `astro/tsconfigs/strict`. Every relative import is written `./calc.ts`, including from `.astro` files — Vite resolves those fine. No `enum`, no `namespace`, no parameter properties.

### Astro specifics

- `src/content.config.ts` defines a `recipes` collection via `glob({ pattern: "[0-9][0-9][0-9]-*.md", base: "./recipes" })`, which preserves today's behaviour of excluding `recipes/README.md` and anything in `recipes/archive/`. Verify the character class works with Astro 7's globber; fall back to `*.md` plus a filter if not.
- A second collection (or a plain build-time read) covers `docs/method.md` and `docs/formulation.md`.
- Inventory TOML loads through `src/lib/data.ts`, the same module the CLI uses. Do not duplicate loading logic in an Astro loader.
- Schemas live in `src/lib/schema.ts` using standalone `zod@4`, and `content.config.ts` imports them. Astro re-exports Zod 4 from `astro/zod`, so this should be compatible — but the calculator must not import from `astro/zod`, because that couples the kitchen tool to the website. If Astro rejects a standalone-zod schema, keep the collection schema loose and let `tools/check.ts` remain the schema authority; it runs before the build in CI either way.
- `astro.config.mjs`: `site: 'https://soap.brian.staruk.net'`, no `base`, default `build.format: 'directory'` (this is what reproduces the existing URLs), remark and rehype plugins registered.
- The feed stays hand-written Atom in `src/pages/feed.xml.ts`. Do **not** use `@astrojs/rss` — it emits RSS 2.0 and would change the `<id>` scheme on entries already published. Preserve `tag:soap.brian.staruk.net,2026:/recipes/<slug>/` exactly.
- Confirm `src/pages/404.astro` still emits `404.html` at the root under directory format; GitHub Pages needs that filename.
- The custom domain is configured in repo settings (no CNAME file exists today and deploys work). Optionally add `public/CNAME` as belt-and-braces; harmless either way.

### CSS

One plain global stylesheet at `src/styles/site.css`, imported once in `src/layouts/Base.astro` and bundled by Astro. No Tailwind, no preprocessor, no CSS modules, and no Astro scoped `<style>` blocks.

The reasoning is worth recording, because it is not arbitrary. Claude Design projects are libraries of plain HTML/CSS component previews, synced into a local component library one component at a time — so plain CSS is the format that gets *adopted* rather than translated. Tailwind would put utility strings in every `class` attribute, which contradicts the "clean markup is valuable" constraint this whole frontend is being kept simple to serve. Scoped `<style>` blocks are idiomatic Astro but would scatter ~85 lines across eight component files, and this stylesheet is meant to be deleted wholesale when the real design lands.

Roughly 85 lines, in this order: a `:root` block of about eight custom properties (bg, fg, muted, line, link, measure, font stack) as the seam a redesign hooks into; a micro-reset (`box-sizing`, margin zeroing, `img { max-width: 100% }`); typography and layout (system stack, line height, centred measure, header/nav/main/footer); `.table-scroll { overflow-x: auto }` and a `details`/`summary` baseline; minimal status badges as border-and-text rather than coloured pills; and the print block.

**The `@media print` block from `tools/site.css` is ported near-verbatim, and it is not optional.** It is functional, not decorative: it hides the header and footer, prevents page breaks inside tables and blockquotes, and — critically — hides `.safety` and reveals `.safety-print`, because a closed `<details>` does not print its contents. A recipe is carried to the counter and read with lye on your gloves; dropping this block would drop the safety line off the printed kitchen sheet. Preserve the comment explaining why.

Dark mode (the `prefers-color-scheme` block, ~16 lines of variable overrides) is dropped as decoration. It is recoverable from git history if it is missed.

**Preserve today's class vocabulary** even though today's CSS is being replaced: `site-header`, `site-title`, `card`, `card-status`, `badge`, `badge-{status}`, `batches`, `batch-no`, `intro`, `recipe`, `doc`, `safety`, `safety-print`, `muted`, `meta`, `warn`, `ok`, `num`, `table-scroll`, `site-footer`, plus the microformats (`h-recipe`, `h-entry`, `p-name`, `u-url`, `dt-published`, `p-ingredient`). This keeps the old `tools/site.css` a drop-in fallback from git history and gives the eventual design system stable hooks.

### What the remark plugin buys

`site.py` splices the recipe card in by partitioning rendered HTML on `</h1>`, and swaps the legacy `## Safety First` section out with a regex. Both disappear: the plugin lifts the leading H1 into `frontmatter.title` and strips the legacy safety section into a boolean flag, and `recipes/[...slug].astro` then renders title → card → disclaimer → `<Content />` in plain component order. **No recipe file is edited to make this work.**

## Phases

Python stays alive and runnable until Phase 5. Running both and diffing output is the cheapest verification available, and keeping them side by side costs nothing.

**Phase 0 — scaffold.** `package.json`, `tsconfig.json`, `.prettierrc`, `.prettierignore`, `.gitignore` (`node_modules/`, `dist/`, `.astro/`). Install deps. No behaviour change; Python still works.

**Phase 1 — the core.** `paths.ts`, `dates.ts`, `schema.ts`, `data.ts`, `calc.ts`, `report.ts`, `fixtures.ts`, `calc.test.ts`. `calc.ts` is a faithful port of `compute` / `fitOils` / `_yield` / `lye_solution_density` / `resolve_oil_name` — pure, no I/O, same structure so the two are diffable by eye.
*Done when:* `vitest run` passes, and every fixture batch asserts its exact recorded lye weight and fill percentage, including Batch #3's overflow. Add a direct unit test for `roundHalfEven` over the boundary cases (`0.5 -> 0`, `24.5 -> 24`, `25.5 -> 26`), since no historical batch exercises them and they are the whole reason the helper exists.

**Phase 2 — the CLIs.** `tools/lye.ts` (`--self-check`, `--mold/--oils/--blend/...`, `--fit`) and `tools/check.ts`. Keep flag names identical. Keep the report format close enough to be recognisable; exact byte parity is not required, but the numbers must match.
*Done when:* `node tools/lye.ts --self-check` and `python3 tools/lye.py --self-check` report the same verdicts and the same numbers; same for `check.ts` vs `check.py` across all six recipes.

**Phase 3 — the site.** Astro config, content config, plugins, layout, components, pages, feed, and the stylesheet described under *CSS*.
*Done when:* `npm run build` emits the same set of HTML and XML paths as `python3 tools/site.py` (`find dist -type f | sort` vs `find _site -type f | sort`; asset paths legitimately differ, since Astro emits hashed `/_astro/*.css` and there will be no `/style.css`), and a rendered-text diff over **all eleven pages** — six recipes, index, inventory, method, formulation, 404 — shows nothing lost. Strip tags and diff; it is one loop, and one spot-checked page is thin evidence against a 540-line generator. Also confirm in the browser's print preview that a recipe page prints without header or footer and **with** the one-line safety reminder visible.

**Phase 4 — CI.** Rewrite `.github/workflows/site.yml`: `actions/setup-node@v4` with npm cache, `npm ci`, then `astro check`, `node tools/lye.ts --self-check`, `vitest run`, `node tools/check.ts` in the `check` job; `npm run build` uploading `dist` in `build`; `deploy` unchanged. The header comment block (lines 4–6) names the `.py` files and is rewritten with the rest.

One deliberate wrinkle: `astro check` needs `npm ci`, so the "prove the archive" job now installs the site's whole dependency tree to run proofs that have nothing to do with the site. Today's `check` job installs only pyyaml. This is accepted rather than overlooked — splitting `astro check` into `build` would keep the archive proof lean but weaken the rule that nothing typechecks late. Job *order* stays doctrine either way.

**Phase 5 — remove Python.** Delete `tools/lye.py`, `tools/check.py`, `tools/site.py`, `tools/site.css`, `tools/site-requirements.txt`. Drop `_site/` from `.gitignore` in favour of `dist/`.

**Phase 6 — documentation and skills.** The prose sweep, below.

## Documentation and skill edits

Every one of these is a known reference to the Python tools; none may be missed.

- `CLAUDE.md` — repo map lines 14–15; "The calculator owns the arithmetic" (line 30); the first hard rule (line 38). Rewrite the "No dependencies" claim per *The one property that does not survive*.
- `README.md` — lines 27, 35, 43–44, 49, 59–60. The "~350-line hand-rolled generator" paragraph needs rewriting for Astro; the "no dependencies, just Python 3.11+" sentence needs the restated invariant.
- `.claude/skills/formulate/SKILL.md` — lines 10, 37, 38, 62, **and line 3**. Line 3 is the frontmatter `description`, which is the string the skill dispatcher matches against; it names `tools/lye.py` and is easy to miss because it is metadata rather than prose.
- `.claude/skills/retro/SKILL.md` — line 19.
- `.claude/skills/inventory/SKILL.md` — lines 10, 55. Line 10's "zero-dependency calculator" phrasing changes.
- `docs/method.md` line 22; `docs/formulation.md` lines **23**, 42, 44.
- `recipes/README.md` lines 15, **19**, 61, 63, 82. Line 19's "read by the zero-dependency calculator" is one of the claims *The one property that does not survive* requires rewriting.
- `inventory/molds.toml` line 8, `inventory/fragrances.toml` line 4, `reference/sap-values.toml` line 17 — **comment lines only**. No data value changes in these files.
- `.claude/launch.json` — replace the `python3 -m http.server` config with `npm run dev` on Astro's port 4321.

## Acceptance criteria

1. `git diff main -- 'recipes/0*.md'` is empty. The frozen archive did not move.
2. `git diff main -- inventory/ reference/` shows comment-line changes only, zero data changes.
3. `node tools/lye.ts --self-check` — six batches reproduce, Batch #3's overflow is caught, all seven fragrances reconcile.
4. `node tools/check.ts` — all six recipes reproduce lye, fill, lifecycle, and ledger.
5. `vitest run` green; `astro check` clean.
6. `npm run build` emits the same HTML and XML URL set as the current `_site`. Asset paths may differ — Astro's hashed `/_astro/*.css` replaces `/style.css`.
7. `diff _site/feed.xml dist/feed.xml` is empty. The Atom `<id>` scheme is already published; a subtle change to it re-issues every entry in every reader. Python is kept alive until Phase 5 precisely so this diff can be run.
8. The printed kitchen sheet survives, checked headlessly rather than by eye: every `dist/recipes/*/index.html` contains `class="safety-print"`, and the bundled stylesheet contains the `@media print` rules that hide `.safety` and reveal `.safety-print`. The Phase 3 print-preview check is good but does not survive into CI; this does.
9. CI green on the PR to `main`.

## To verify against live docs during implementation

Written from Astro 7.2.0's published API, but confirm rather than assume:

- `glob()` character-class pattern support.
- Whether a standalone `zod@4` schema is accepted by `defineCollection`.
- Whether `404.astro` emits `404.html` (not `404/index.html`) under `build.format: 'directory'`.
- Whether Astro hands frontmatter dates through as strings or `Date` objects — the schema normalises either way, but confirm which.

## Commits

Conventional Commits, one per phase or smaller. Scopes: `tools` for code, `docs` for prose, `skills` for the skill files. `main` is protected — this lands as a PR from `refactor/typescript-rewrite`.
