/** The Atom feed, hand-written on purpose.
 *
 * Not `@astrojs/rss`: that emits RSS 2.0, which would change the `<id>` scheme on entries that
 * are already published, and every reader would re-issue every batch as new. The
 * `tag:soap.brian.staruk.net,2026:/recipes/<slug>/` form below is the published one and does
 * not move.
 */

import type { APIRoute } from "astro";

import { loadRecipes } from "../lib/data.ts";
import { recipeTitle, SITE_URL, STATUS_LABEL, xmlEscape } from "../lib/site.ts";

export const GET: APIRoute = () => {
  const recipes = loadRecipes();

  const entries = [...recipes]
    .sort((a, b) => b.fm.batch - a.fm.batch)
    .map((r) => {
      const fm = r.fm;
      const updated = `${fm.poured ?? fm.created}T00:00:00Z`;
      const frag = fm.fragrance.map((f) => f.id).join(", ") || "unscented";
      const summary =
        `Batch #${fm.batch} — ${STATUS_LABEL[fm.status]}. ` +
        `${fm.oils_g}g oils in ${fm.mold}; fragrance: ${frag}.`;
      return `  <entry>
    <title>Batch #${fm.batch}: ${xmlEscape(recipeTitle(r.body, r.slug))}</title>
    <link href="${SITE_URL}${r.url}"/>
    <id>tag:soap.brian.staruk.net,2026:${r.url}</id>
    <updated>${updated}</updated>
    <summary>${xmlEscape(summary)}</summary>
  </entry>`;
    });

  // ISO strings, so the newest date is the largest string.
  const newest =
    recipes
      .map((r) => r.fm.poured ?? r.fm.created)
      .sort()
      .at(-1) ?? "2026-01-01";

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>soap — batches</title>
  <link href="${SITE_URL}/"/>
  <link rel="self" href="${SITE_URL}/feed.xml"/>
  <id>tag:soap.brian.staruk.net,2026:/</id>
  <updated>${newest}T00:00:00Z</updated>
  <author><name>Brian Staruk</name></author>
${entries.join("\n")}
</feed>
`;

  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
