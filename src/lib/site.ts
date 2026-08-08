/** Constants and display helpers for the site — the projection of the repo, not the repo.
 *
 * The site never computes a number that belongs to the calculator. Everything it shows comes
 * straight out of recipe frontmatter and inventory TOML; the only arithmetic here is date math
 * for cure milestones, which is display, not formulation.
 */

import { addDays } from "./dates.ts";
import type { Status } from "./schema.ts";

export const SITE_URL = "https://soap.brian.staruk.net";
export const REPO_URL = "https://github.com/bstaruk/soap";

export const CURE_MIN_DAYS = 28; // "4 weeks minimum" per docs/method.md
export const CURE_FULL_DAYS = 42; // "6–8 is better"; 6 weeks is the milestone shown

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  ready: "Ready",
  curing: "Curing",
  cured: "Cured",
  abandoned: "Abandoned",
  failed: "Failed",
};

/** Index ordering: what's alive on the counter first, then the archive. */
export const STATUS_ORDER: Status[] = ["curing", "ready", "draft", "cured", "failed", "abandoned"];

export const NAV: Array<{ href: string; label: string }> = [
  { href: "/", label: "Batches" },
  { href: "/inventory/", label: "Inventory" },
  { href: "/method/", label: "Method" },
  { href: "/formulation/", label: "Formulation" },
];

const H1_RE = /^# (.+)$/m;

/** A recipe's title is its leading H1 — the one the page renders in place of the body's. */
export function recipeTitle(body: string, fallback: string): string {
  const match = H1_RE.exec(body);
  return match ? match[1].replace(/[*_]/g, "").trim() : fallback;
}

export function fmtG(value: number | null | undefined): string {
  return typeof value === "number" ? `${value.toLocaleString("en-US")} g` : "";
}

/** Frontmatter oil keys are SAP-table keys; soften them for display (coconut_76 -> coconut 76°). */
export function oilDisplayName(key: string): string {
  return key.replaceAll("_76", " 76°").replaceAll("_", " ");
}

/** Display-only date math: the 4- and 6-week marks from the cut date. */
export function cureMilestones(status: Status, cut: string | null): string {
  if (status !== "curing") return "";
  if (!cut) return "in the mold — the cure clock starts at the cut";
  return (
    `cut ${cut} · 4-week mark ${addDays(cut, CURE_MIN_DAYS)}` +
    ` · 6-week mark ${addDays(cut, CURE_FULL_DAYS)}`
  );
}

/** Python's `html.escape(s, quote=True)`, for the hand-written Atom feed. */
export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}
