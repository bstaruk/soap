/** Dates are ISO strings, end to end. Arithmetic happens in UTC or not at all.
 *
 * `new Date("2026-07-17")` parses as UTC midnight and renders in local time, which displays as
 * the 16th anywhere west of Greenwich — that would silently shift every cure milestone on the
 * site by a day. So: parse by hand, compute with `Date.UTC`, format back to `YYYY-MM-DD`, and
 * compare lexicographically (which is correct for ISO-8601 and needs no parsing at all).
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A well-formed *and* real calendar date. `2026-13-45` and `2026-02-31` are both rejected. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  // Round-tripping through Date.UTC is the calendar check: an out-of-range month or day
  // overflows into a neighbouring month or year and comes back as a different string.
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return toIso(Date.UTC(y, m - 1, d)) === value;
}

/** Format a UTC timestamp as `YYYY-MM-DD`. */
export function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Milliseconds since epoch at UTC midnight on an ISO date. */
export function utcOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** `addDays("2026-07-17", 28)` -> `"2026-08-14"`. */
export function addDays(iso: string, days: number): string {
  return toIso(utcOf(iso) + days * 86_400_000);
}

/** Normalise whatever a YAML or frontmatter parser hands over into an ISO string.
 *
 * pyyaml gave `check.py` a real `date` object; the `yaml` package gives a string; Astro may
 * give either. Everything downstream wants the string, so the seam is here.
 */
export function normaliseDate(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}
