#!/usr/bin/env python3
"""The archive lint — prove every recipe's frozen numbers still reproduce, on every push.

This is CI enforcement for the hard rules in CLAUDE.md:

  1. Every recipe's lye_g and fill_pct are re-derived through tools/lye.py's compute() from
     the recipe's own frontmatter inputs. A mismatch means either the recipe carries a number
     the calculator didn't produce, or reference/sap-values.toml drifted — and per doctrine,
     touching the SAP table invalidates the cross-check behind every Ready recipe. Either way
     the build goes red instead of quietly publishing a wrong number.

     Batch #3 is the deliberate exception that proves the rule: its recorded lye was scaled,
     not calculated, and its frontmatter says so (`lye_g_correct`, `overflowed`). The lint
     checks the annotation, not the mistake — the cautionary tale stays frozen in the archive.

  2. Frontmatter is schema-checked and cross-file references hold: mold and fragrance ids
     exist in inventory, oils sum to 100, lifecycle fields match status, and every poured
     recipe's fragrance weights agree with the ledger in inventory/fragrances.toml.

Read-only. Exits non-zero on any failure. Run alongside `lye.py --self-check`, not instead.

Needs pyyaml for frontmatter (pip install -r tools/site-requirements.txt).
Usage:
  check.py
"""

from __future__ import annotations

import datetime as dt
import re
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lye  # the calculator owns the arithmetic; this file only compares

try:
    import yaml
except ImportError:
    sys.exit("missing dependency pyyaml — pip install -r tools/site-requirements.txt")

ROOT = Path(__file__).resolve().parent.parent
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)

STATUSES = {"draft", "ready", "curing", "cured", "abandoned", "failed"}
POURED_STATUSES = {"curing", "cured", "failed"}
PROFILES = {"body", "hand"}
# fill_pct is recorded to one decimal, so recomputation may differ by up to half a tenth.
FILL_TOLERANCE = 0.06


def check_recipe(path: Path, sap: dict, molds: dict, fragrances: dict, batches: set[int]) -> list[str]:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return ["no frontmatter block"]
    fm = yaml.safe_load(m.group(1))
    body = text[m.end() :]

    def need(field: str) -> bool:
        if fm.get(field) is None:
            errors.append(f"missing frontmatter field '{field}'")
            return False
        return True

    # --- schema and identity ---
    if need("batch") and not path.name.startswith(f"{fm['batch']:03d}-"):
        errors.append(f"batch {fm['batch']} does not match filename prefix {path.name[:3]}")
    status = fm.get("status")
    if status not in STATUSES:
        errors.append(f"unknown status '{status}'")
    if fm.get("profile") not in PROFILES:
        errors.append(f"unknown profile '{fm.get('profile')}'")
    for field in ("created", "oils_g", "superfat_pct", "water_pct", "oils", "lye_g", "fill_pct", "mold"):
        need(field)
    if fm.get("parent") is not None and fm["parent"] not in batches:
        errors.append(f"parent batch {fm['parent']} does not exist")

    mold_key = fm.get("mold")
    if mold_key and mold_key not in molds["molds"]:
        errors.append(f"mold '{mold_key}' not in inventory/molds.toml")
        mold_key = None

    oils = fm.get("oils") or {}
    if oils and abs(sum(oils.values()) - 100) > 0.01:
        errors.append(f"oil percentages sum to {sum(oils.values())}, not 100")

    for f in fm.get("fragrance", []):
        if f["id"] not in fragrances["fragrances"]:
            errors.append(f"fragrance '{f['id']}' not in inventory/fragrances.toml")

    # --- lifecycle invariants ---
    if status == "ready" and fm.get("soapcalc_confirmed") is not True:
        errors.append("status 'ready' without soapcalc_confirmed: true — the one gate that matters")
    if status in POURED_STATUSES and not isinstance(fm.get("poured"), dt.date):
        errors.append(f"status '{status}' without a poured date")
    if status in {"draft", "ready", "abandoned"} and fm.get("poured"):
        errors.append(f"status '{status}' but poured is set — a poured recipe is curing/cured/failed")
    if status == "cured" and not isinstance(fm.get("cut"), dt.date):
        errors.append("status 'cured' without a cut date — the cure clock never started")
    dates = [fm.get(k) for k in ("created", "poured", "cut")]
    real = [d for d in dates if isinstance(d, dt.date)]
    if real != sorted(real):
        errors.append("dates out of order (created <= poured <= cut)")
    if "## Outcome" not in body:
        errors.append("body has no '## Outcome' section")

    # --- the numbers: re-derive through the calculator ---
    if errors:
        return errors  # inputs unusable; recompute would just cascade noise
    fragrance_g = sum(f["g"] for f in fm.get("fragrance", []))
    try:
        r = lye.compute(
            oils_g=fm["oils_g"],
            blend_pct=dict(oils),
            superfat_pct=fm["superfat_pct"],
            water_pct=fm["water_pct"],
            fragrance_g=fragrance_g,
            mold_key=mold_key,
            sap=sap,
            molds=molds,
        )
    except ValueError as exc:
        return [f"calculator rejected the frontmatter: {exc}"]

    # lye_g_correct marks a recipe whose as-made lye is a preserved mistake; the calculator
    # must reproduce the annotation. Everywhere else it must reproduce lye_g itself.
    recorded_lye = fm.get("lye_g_correct", fm["lye_g"])
    if r["lye_g_rounded"] != recorded_lye:
        errors.append(
            f"lye does not reproduce: calculator says {r['lye_g_rounded']}g, frontmatter records {recorded_lye}g"
            " — recipe error or SAP-table drift; neither ships"
        )

    fill = r["mold"]["fill_pct"]
    if abs(fill - fm["fill_pct"]) > FILL_TOLERANCE:
        errors.append(f"fill does not reproduce: calculator says {fill:.1f}%, frontmatter records {fm['fill_pct']}%")
    if bool(fm.get("overflowed")) == r["mold"]["fits"]:
        state = "overflowed: true but the calculator says it fits" if fm.get("overflowed") else \
            f"fill {fill:.1f}% exceeds the {r['mold']['max_fill_pct']}% ceiling with no overflowed flag"
        errors.append(state)

    # --- fragrance ledger cross-check (poured recipes only; drafts consumed nothing) ---
    if status in POURED_STATUSES:
        for f in fm.get("fragrance", []):
            ledger = fragrances["fragrances"][f["id"]].get("used", [])
            entry = next((u for u in ledger if u["batch"] == fm["batch"]), None)
            if entry is None:
                errors.append(f"poured, but fragrance '{f['id']}' has no ledger entry for batch {fm['batch']}")
            elif entry["g"] != f["g"]:
                errors.append(
                    f"fragrance '{f['id']}': recipe says {f['g']}g, ledger says {entry['g']}g for batch {fm['batch']}"
                )
    return errors


def check_ledger_orphans(fragrances: dict, batches: set[int]) -> list[str]:
    """Every ledger debit must point at a real batch — retro debits at pour, nothing else does."""
    errors = []
    for key, f in fragrances["fragrances"].items():
        for u in f.get("used", []):
            if u["batch"] not in batches:
                errors.append(f"fragrances.toml: '{key}' ledger references nonexistent batch {u['batch']}")
    return errors


def main() -> int:
    sap = lye.load_toml(ROOT / "reference" / "sap-values.toml")
    molds = lye.load_toml(ROOT / "inventory" / "molds.toml")
    fragrances = lye.load_toml(ROOT / "inventory" / "fragrances.toml")

    paths = sorted((ROOT / "recipes").glob("[0-9][0-9][0-9]-*.md"))
    batches = {int(p.name[:3]) for p in paths}

    print("Archive lint — re-deriving every recipe's numbers through the calculator.\n")
    failures = 0
    for path in paths:
        errors = check_recipe(path, sap, molds, fragrances, batches)
        flag = "OK " if not errors else "FAIL"
        print(f"  {flag}  {path.name}")
        for e in errors:
            print(f"        - {e}")
        failures += len(errors)

    orphans = check_ledger_orphans(fragrances, batches)
    for e in orphans:
        print(f"  FAIL  {e}")
    failures += len(orphans)

    print()
    if failures:
        print(f"{failures} problem(s). The archive and the calculator disagree — nothing deploys until they agree.")
        return 1
    print(f"All {len(paths)} recipes reproduce: lye, fill, lifecycle, and the fragrance ledger all agree.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
