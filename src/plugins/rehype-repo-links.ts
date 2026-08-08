/** Point intra-repo hrefs (docs cross-references, tool paths) at GitHub.
 *
 * The docs link to files like `../recipes/README.md` and `tools/lye.ts`, which exist in the repo
 * but not on the site. GitHub is the canonical home for those; the site only re-renders what it
 * has pages for.
 */

import type { Element, Root, RootContent } from "hast";

import { REPO_URL } from "../lib/site.ts";

const ALREADY_ABSOLUTE = /^(https?:\/\/|#|\/|mailto:)/;

function rewrite(node: Element): void {
  const href = node.properties?.href;
  if (typeof href !== "string" || ALREADY_ABSOLUTE.test(href)) return;
  node.properties.href = `${REPO_URL}/blob/main/${href.replace(/^(\.\.\/)+/, "")}`;
}

function walk(node: Root | RootContent): void {
  if (node.type === "element" && node.tagName === "a") rewrite(node);
  if ("children" in node) for (const child of node.children) walk(child);
}

export default function rehypeRepoLinks() {
  return (tree: Root): void => walk(tree);
}
