#!/usr/bin/env python3
"""Build the static site — the repo rendered as plain HTML for soap.brian.staruk.net.

Why hand-rolled: the repo's layout is doctrine (recipes/NNN-slug.md, frontmatter as the data,
TOML inventory), and a real static-site generator would want to own that layout instead of
reading it. This script is the other way around — the site is a projection of the repo, built
from the same files the skills read. No JS, no tracking, one hand-written stylesheet.

The site never computes a number that belongs to the calculator. Everything it shows comes
straight out of recipe frontmatter and inventory TOML; the only arithmetic here is date math
for cure milestones, which is display, not formulation.

Build-time dependencies (the kitchen calculator stays zero-dep): markdown, pyyaml.
  pip install -r tools/site-requirements.txt
Usage:
  python3 tools/site.py [--out _site]
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import re
import shutil
import sys
import tomllib
from pathlib import Path

try:
    import markdown
    import yaml
except ImportError as exc:  # a clear sentence beats a bare traceback here
    sys.exit(f"missing build dependency ({exc.name}) — pip install -r tools/site-requirements.txt")

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://soap.brian.staruk.net"
REPO_URL = "https://github.com/bstaruk/soap"
CURE_MIN_DAYS = 28  # "4 weeks minimum" per docs/method.md
CURE_FULL_DAYS = 42  # "6–8 is better"; 6 weeks is the milestone shown

FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)

# Recipes poured before 2026-07 carry the same verbatim "Safety First" section — frozen history,
# never edited (see recipes/README.md). The site swaps that repeat out at render time for the one
# shared disclaimer below, collapsed so it's a reminder rather than 20% of every page.
SAFETY_SECTION_RE = re.compile(r"^## Safety First\n(?:(?!^## ).*\n?)*", re.M)

SAFETY_DISCLAIMER = """<details class="safety">
    <summary>Lye safety — the non-negotiables</summary>
    <ul>
      <li>Safety glasses and nitrile gloves on <strong>before</strong> touching lye.</li>
      <li>Lye (NaOH) is caustic — it burns skin and eyes on contact.</li>
      <li>Always add <strong>lye to water</strong>, never water to lye.</li>
      <li>Work with good ventilation — the fumes are brief but harsh.</li>
      <li>Soap-only equipment — nothing returns to kitchen use.</li>
      <li>Raw batter stays caustic until it saponifies.</li>
    </ul>
  </details>
  <p class="safety-print">Safety: glasses and gloves before lye · lye into water, never the reverse · ventilate · soap-only equipment · raw batter is caustic until cured.</p>"""

STATUS_LABEL = {
    "draft": "Draft",
    "ready": "Ready",
    "curing": "Curing",
    "cured": "Cured",
    "abandoned": "Abandoned",
    "failed": "Failed",
}
# Index ordering: what's alive on the counter first, then the archive.
STATUS_ORDER = ["curing", "ready", "draft", "cured", "failed", "abandoned"]


def esc(s: object) -> str:
    return html.escape(str(s), quote=True)


def md_to_html(text: str) -> str:
    return markdown.markdown(text, extensions=["tables"])


def rewrite_repo_links(html_text: str) -> str:
    """Point intra-repo hrefs (docs cross-references, tool paths) at GitHub.

    The docs link to files like ../recipes/README.md and tools/lye.py, which exist in the repo
    but not on the site. GitHub is the canonical home for those; the site only re-renders what
    it has pages for.
    """

    def fix(m: re.Match) -> str:
        href = m.group(1)
        if href.startswith(("http://", "https://", "#", "/", "mailto:")):
            return m.group(0)
        clean = re.sub(r"^(\.\./)+", "", href)
        return f'href="{REPO_URL}/blob/main/{clean}"'

    return re.sub(r'href="([^"]+)"', fix, html_text)


def load_recipe(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        sys.exit(f"{path.name}: no frontmatter block")
    fm = yaml.safe_load(m.group(1))
    body = text[m.end() :]
    title_m = re.search(r"^# (.+)$", body, re.M)
    title = re.sub(r"[*_]", "", title_m.group(1)).strip() if title_m else path.stem
    return {"fm": fm, "body": body, "title": title, "slug": path.stem, "url": f"/recipes/{path.stem}/"}


def fmt_date(d: object) -> str:
    return d.isoformat() if isinstance(d, dt.date) else ""


def fmt_g(v: object) -> str:
    return f"{v:,} g" if isinstance(v, (int, float)) else ""


# --- page shell -------------------------------------------------------------

NAV = [("/", "Batches"), ("/inventory/", "Inventory"), ("/method/", "Method"), ("/formulation/", "Formulation")]


def page(*, title: str, content: str, path: str, description: str = "") -> str:
    nav = "\n".join(
        f'      <a href="{href}"{" aria-current=\"page\"" if href == path else ""}>{label}</a>'
        for href, label in NAV
    )
    desc = f'\n  <meta name="description" content="{esc(description)}">' if description else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)} · soap</title>{desc}
  <link rel="stylesheet" href="/style.css">
  <link rel="alternate" type="application/atom+xml" title="Batches" href="/feed.xml">
  <link rel="canonical" href="{SITE_URL}{path}">
</head>
<body>
  <header class="site-header">
    <a class="site-title" href="/">soap</a>
    <nav>
{nav}
    </nav>
  </header>
  <main>
{content}
  </main>
  <footer class="site-footer">
    <p>Brian's cold-process soap recipe book. <a href="{REPO_URL}">source</a> · <a href="/feed.xml">feed</a></p>
  </footer>
</body>
</html>
"""


# --- recipe pages -----------------------------------------------------------


def status_badge(status: str) -> str:
    return f'<span class="badge badge-{esc(status)}">{esc(STATUS_LABEL.get(status, status))}</span>'


def cure_milestones(fm: dict) -> str:
    """Display-only date math: the 4- and 6-week marks from the cut date."""
    cut = fm.get("cut")
    if fm.get("status") != "curing":
        return ""
    if not isinstance(cut, dt.date):
        return "in the mold — the cure clock starts at the cut"
    return (
        f"cut {cut.isoformat()} · 4-week mark {(cut + dt.timedelta(days=CURE_MIN_DAYS)).isoformat()}"
        f" · 6-week mark {(cut + dt.timedelta(days=CURE_FULL_DAYS)).isoformat()}"
    )


def recipe_card(r: dict, molds: dict, fragrances: dict, by_batch: dict[int, dict]) -> str:
    fm = r["fm"]
    rows: list[tuple[str, str]] = []

    mold = molds["molds"].get(fm.get("mold"), {})
    rows.append(("Mold", esc(mold.get("label", fm.get("mold", "")))))

    # Frontmatter oil keys are SAP-table keys; soften them for display (coconut_76 -> coconut 76°).
    blend = " · ".join(
        f'{esc(name.replace("_76", " 76°").replace("_", " "))} {pct}%' for name, pct in fm.get("oils", {}).items()
    )
    rows.append(("Blend", f'{blend} — <span class="muted">{esc(fm.get("profile", ""))} profile</span>'))
    rows.append(("Oils", esc(fmt_g(fm.get("oils_g")))))
    rows.append(("Superfat", f'{fm.get("superfat_pct")}%'))
    rows.append(("Water", f'{fm.get("water_pct")}% of oils'))

    lye = esc(fmt_g(fm.get("lye_g")))
    if fm.get("lye_g_correct") is not None:
        lye += (
            f' <span class="warn">as made — the calculator\'s figure is {esc(fmt_g(fm["lye_g_correct"]))};'
            " see the notes</span>"
        )
    elif fm.get("soapcalc_confirmed"):
        lye += ' <span class="ok">SoapCalc-confirmed</span>'
    rows.append(("Lye (NaOH)", lye))

    fill = fm.get("fill_pct")
    ceiling = mold.get("max_fill_pct")
    fill_s = f"{fill}% of cavity" + (f' <span class="muted">(ceiling {ceiling}%)</span>' if ceiling else "")
    if fm.get("overflowed"):
        fill_s += ' <span class="warn">overflowed</span>'
    rows.append(("Fill", fill_s))

    frags = []
    for f in fm.get("fragrance", []):
        label = fragrances["fragrances"].get(f["id"], {}).get("label", f["id"])
        frags.append(f'<span class="p-ingredient">{esc(label)} {esc(fmt_g(f["g"]))}</span>')
    rows.append(("Fragrance", " · ".join(frags) if frags else "unscented"))

    y = fm.get("yield", {})
    yield_s = f'{y.get("bars", "?")} bars'
    if y.get("cut_in"):
        yield_s += f' · cut at {y["cut_in"]}&Prime;'
    rows.append(("Yield", yield_s))

    parent = fm.get("parent")
    if parent and parent in by_batch:
        p = by_batch[parent]
        rows.append(("Line", f'descends from <a href="{p["url"]}">Batch #{parent}</a>'))
    children = sorted(b for b, c in by_batch.items() if c["fm"].get("parent") == fm["batch"])
    if children:
        links = " · ".join(f'<a href="{by_batch[b]["url"]}">Batch #{b}</a>' for b in children)
        rows.append(("Continued by", links))

    cure = cure_milestones(fm)
    if cure:
        rows.append(("Cure", esc(cure) if "mark" not in cure else cure))

    dl = "\n".join(f"      <dt>{k}</dt><dd>{v}</dd>" for k, v in rows)
    dates = " · ".join(
        s
        for s in (
            f'created <time class="dt-published" datetime="{fmt_date(fm.get("created"))}">{fmt_date(fm.get("created"))}</time>',
            f'poured {fmt_date(fm.get("poured"))}' if fm.get("poured") else "",
            f'cut {fmt_date(fm.get("cut"))}' if fm.get("cut") else "",
        )
        if s
    )
    return f"""<aside class="card">
    <p class="card-status">{status_badge(fm["status"])} <span class="muted">{dates}</span></p>
    <dl>
{dl}
    </dl>
  </aside>"""


def build_recipe_page(r: dict, molds: dict, fragrances: dict, by_batch: dict[int, dict]) -> str:
    body_md, has_safety_section = SAFETY_SECTION_RE.subn("@@safety@@\n\n", r["body"], count=1)
    body_html = rewrite_repo_links(md_to_html(body_md))
    card = recipe_card(r, molds, fragrances, by_batch)
    # The card belongs right under the recipe's own H1, not above it. Newer recipes have no
    # Safety First section to swap, so the disclaimer rides along under the card instead.
    disclaimer = "" if has_safety_section else f"\n  {SAFETY_DISCLAIMER}"
    head, sep, tail = body_html.partition("</h1>")
    body_html = f"{head}{sep}\n  {card}{disclaimer}\n{tail}" if sep else f"{card}{disclaimer}\n{body_html}"
    body_html = body_html.replace("<p>@@safety@@</p>", SAFETY_DISCLAIMER)
    content = f'  <article class="h-recipe recipe">\n{body_html}\n  </article>'
    fm = r["fm"]
    desc = f'Batch #{fm["batch"]} — {STATUS_LABEL.get(fm["status"], fm["status"])}.'
    return page(title=f'Batch #{fm["batch"]} · {r["title"]}', content=content, path=r["url"], description=desc)


# --- index ------------------------------------------------------------------


def build_index(recipes: list[dict], molds: dict) -> str:
    by_status: dict[str, list[dict]] = {}
    for r in recipes:
        by_status.setdefault(r["fm"]["status"], []).append(r)

    sections = []
    for status in STATUS_ORDER:
        group = by_status.pop(status, [])
        if not group:
            continue
        items = []
        for r in sorted(group, key=lambda r: -r["fm"]["batch"]):
            fm = r["fm"]
            mold_label = molds["molds"].get(fm.get("mold"), {}).get("label", fm.get("mold", ""))
            when = fmt_date(fm.get("poured") or fm.get("created"))
            meta_bits = [when, esc(mold_label), f'{fm.get("yield", {}).get("bars", "?")} bars']
            cure = cure_milestones(fm)
            if cure:
                meta_bits.append(esc(cure))
            items.append(
                f"""      <li class="h-entry">
        <span class="batch-no">#{fm["batch"]}</span>
        <a class="u-url p-name" href="{r["url"]}">{esc(r["title"])}</a>
        {status_badge(fm["status"])}
        <span class="muted meta">{" · ".join(b for b in meta_bits if b)}</span>
      </li>"""
            )
        sections.append(
            f'  <section>\n    <h2>{esc(STATUS_LABEL[status])}</h2>\n    <ul class="batches">\n'
            + "\n".join(items)
            + "\n    </ul>\n  </section>"
        )
    for status in by_status:  # an unknown status is a data error, not something to hide
        sys.exit(f"index: recipe with unknown status '{status}'")

    intro = '  <p class="intro">One page per batch: the recipe as made, and how it turned out.</p>'
    return page(
        title="Batches",
        content=intro + "\n" + "\n".join(sections),
        path="/",
        description="Cold-process soap recipes and how each batch turned out.",
    )


# --- inventory --------------------------------------------------------------


def build_inventory(molds: dict, fragrances: dict, staples: dict, equipment: dict) -> str:
    frag_rows = []
    for key, f in fragrances["fragrances"].items():
        used = sorted(f.get("used", []), key=lambda u: u["batch"])
        ledger = "; ".join(f'#{u["batch"]}: {u["g"]} g' for u in used) or "unused"
        status = f' <span class="warn">{esc(f["status"])}</span>' if f.get("status") else ""
        frag_rows.append(
            f"""      <tr id="{esc(key)}">
        <td><strong>{esc(f["label"])}</strong><br><span class="muted">{esc(f["brand"])} · {esc(f["kind"])}</span></td>
        <td class="num">{f["remaining_g"]} g <span class="muted">of {f["initial_g"]} g</span>{status}<br>
            <span class="muted">{ledger}</span></td>
        <td>{esc(f.get("scent", ""))}<br><span class="muted">{esc(f.get("behavior", "").strip())}</span></td>
      </tr>"""
        )

    mold_rows = []
    for key, m in molds["molds"].items():
        c = m["cavity_in"]
        dims = f'{c["length"]}&Prime; × {c["width"]}&Prime; × {c["height"]}&Prime;'
        per = " per cavity" if m["type"] == "cavity" else ""
        cavity = f'{m["cavity_ml"]:,.0f} ml'
        if m["type"] == "cavity":
            cavity += f' total · {m["cavities"]} cavities'
        mold_rows.append(
            f"""      <tr id="{esc(key)}">
        <td><strong>{esc(m["label"])}</strong><br><span class="muted">{esc(m["type"])} · {esc(m["construction"])}</span></td>
        <td class="num">{dims}{per}<br><span class="muted">{cavity}</span></td>
        <td class="num">{m.get("max_fill_pct", "—")}%</td>
      </tr>"""
        )

    oil_items = []
    for key, o in staples["oils"].items():
        lo, hi = o["house_range_pct"]
        rng = f"{lo}%" if lo == hi else f"{lo}–{hi}%"
        oil_items.append(
            f'      <li><strong>{esc(o["sap_ref"])}</strong> — {esc(o["role"])}'
            f' <span class="muted">house range {rng} of oils</span></li>'
        )

    add_items = []
    for key, a in staples["additives"].items():
        rate = ""
        if "rate_pct_of_oils" in a:
            rate = f'{a["rate_pct_of_oils"]}% of oils'
        elif "rate_ml_per_1000g_oils" in a:
            rate = f'{a["rate_ml_per_1000g_oils"]} ml per 1,000 g oils'
        elif "rate_g_per_900g_oils" in a:
            rate = f'{a["rate_g_per_900g_oils"]} g per 900 g oils'
        add_items.append(
            f'      <li><strong>{esc(a["label"])}</strong> — {esc(a["role"])}'
            + (f' <span class="muted">house rate {rate}</span>' if rate else "")
            + "</li>"
        )

    cur = equipment["current"]
    equip_items = [
        f'      <li><strong>{esc(v["label"])}</strong> — {esc(v.get("use", "").strip())}</li>'
        for v in cur["vessels"].values()
    ]
    equip_items += [
        f'      <li><strong>{esc(t["label"])}</strong>'
        + (f' — {esc(t.get("use", "").strip())}' if t.get("use") else "")
        + "</li>"
        for t in cur.get("tools", []) + cur.get("cutting", []) + cur.get("safety", [])
    ]
    superseded = "\n".join(
        f'        <li><strong>{esc(s["label"])}</strong> — {esc(s["was"])} ({esc(s["eras"])});'
        f' replaced by {esc(s["replaced_by"])}</li>'
        for s in equipment.get("superseded", [])
    )

    content = f"""  <h1>Inventory</h1>
  <p class="intro">What's in the cabinet. Fragrance amounts are a running ledger, debited at each pour.</p>

  <h2>Fragrances</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>Fragrance</th><th>Remaining · ledger</th><th>Scent · behavior</th></tr></thead>
    <tbody>
{"".join(frag_rows)}
    </tbody>
  </table></div>

  <h2>Molds</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>Mold</th><th>Cavity</th><th>Fill ceiling</th></tr></thead>
    <tbody>
{"".join(mold_rows)}
    </tbody>
  </table></div>
  <p class="muted">Cavity dimensions are measured inside the silicone; fill is proved by summed
  component volumes, never the 0.4 rule — the rule is what overflowed Batch #3.</p>

  <h2>Staple oils</h2>
  <ul>
{chr(10).join(oil_items)}
  </ul>

  <h2>Additives</h2>
  <ul>
{chr(10).join(add_items)}
  </ul>

  <h2>Equipment</h2>
  <ul>
{chr(10).join(equip_items)}
  </ul>
  <details>
    <summary>Superseded (kept on purpose — frozen recipes reference these)</summary>
    <ul>
{superseded}
    </ul>
  </details>"""
    return page(
        title="Inventory",
        content=content,
        path="/inventory/",
        description="Molds, fragrances, staple oils, and equipment on hand.",
    )


# --- docs, feed, 404 --------------------------------------------------------


def build_doc(md_path: Path, url: str, title: str, description: str) -> str:
    body = rewrite_repo_links(md_to_html(md_path.read_text(encoding="utf-8")))
    return page(title=title, content=f'  <article class="doc">\n{body}\n  </article>', path=url, description=description)


def build_feed(recipes: list[dict]) -> str:
    entries = []
    for r in sorted(recipes, key=lambda r: -r["fm"]["batch"]):
        fm = r["fm"]
        date = fm.get("poured") or fm.get("created")
        updated = f"{fmt_date(date)}T00:00:00Z"
        frag = ", ".join(f["id"] for f in fm.get("fragrance", [])) or "unscented"
        summary = (
            f'Batch #{fm["batch"]} — {STATUS_LABEL.get(fm["status"], fm["status"])}. '
            f'{fm.get("oils_g")}g oils in {fm.get("mold")}; fragrance: {frag}.'
        )
        entries.append(
            f"""  <entry>
    <title>Batch #{fm["batch"]}: {esc(r["title"])}</title>
    <link href="{SITE_URL}{r["url"]}"/>
    <id>tag:soap.brian.staruk.net,2026:{r["url"]}</id>
    <updated>{updated}</updated>
    <summary>{esc(summary)}</summary>
  </entry>"""
        )
    newest = max((fmt_date(r["fm"].get("poured") or r["fm"].get("created")) for r in recipes), default="2026-01-01")
    return f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>soap — batches</title>
  <link href="{SITE_URL}/"/>
  <link rel="self" href="{SITE_URL}/feed.xml"/>
  <id>tag:soap.brian.staruk.net,2026:/</id>
  <updated>{newest}T00:00:00Z</updated>
  <author><name>Brian Staruk</name></author>
{chr(10).join(entries)}
</feed>
"""


def build_404() -> str:
    content = """  <h1>Not found</h1>
  <p>No such page. The batches live at <a href="/">the index</a>.</p>"""
    return page(title="Not found", content=content, path="/404.html")


# --- main -------------------------------------------------------------------


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Build the static site into an output directory.")
    ap.add_argument("--out", default="_site", help="output directory (default _site)")
    args = ap.parse_args(argv)

    out = ROOT / args.out
    molds = tomllib.loads((ROOT / "inventory" / "molds.toml").read_text(encoding="utf-8"))
    fragrances = tomllib.loads((ROOT / "inventory" / "fragrances.toml").read_text(encoding="utf-8"))
    staples = tomllib.loads((ROOT / "inventory" / "staples.toml").read_text(encoding="utf-8"))
    equipment = tomllib.loads((ROOT / "inventory" / "equipment.toml").read_text(encoding="utf-8"))

    recipes = [load_recipe(p) for p in sorted((ROOT / "recipes").glob("[0-9][0-9][0-9]-*.md"))]
    by_batch = {r["fm"]["batch"]: r for r in recipes}

    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    (out / "index.html").write_text(build_index(recipes, molds), encoding="utf-8")
    for r in recipes:
        d = out / "recipes" / r["slug"]
        d.mkdir(parents=True)
        (d / "index.html").write_text(build_recipe_page(r, molds, fragrances, by_batch), encoding="utf-8")

    (out / "inventory").mkdir()
    (out / "inventory" / "index.html").write_text(
        build_inventory(molds, fragrances, staples, equipment), encoding="utf-8"
    )
    for name, title, desc in (
        ("method", "House Method", "The current cold-process method."),
        ("formulation", "Formulation Doctrine", "The house blends, the levers, and their rails."),
    ):
        (out / name).mkdir()
        (out / name / "index.html").write_text(
            build_doc(ROOT / "docs" / f"{name}.md", f"/{name}/", title, desc), encoding="utf-8"
        )

    (out / "feed.xml").write_text(build_feed(recipes), encoding="utf-8")
    (out / "404.html").write_text(build_404(), encoding="utf-8")
    shutil.copy(ROOT / "tools" / "site.css", out / "style.css")

    pages = len(list(out.rglob("*.html")))
    print(f"built {pages} pages -> {out.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
