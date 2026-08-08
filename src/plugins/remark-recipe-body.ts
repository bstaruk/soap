/** Prepare a recipe body for rendering: drop the leading H1, drop the legacy safety section.
 *
 * `tools/site.py` did both of these by string surgery on rendered HTML — partitioning on
 * `</h1>` to splice the data card in, and a regex over the Markdown source to swap the repeated
 * "Safety First" block for the shared disclaimer. Doing it on the syntax tree instead means the
 * page can render title -> card -> disclaimer -> body in plain component order.
 *
 * The title *value* is not set here: `recipeTitle()` in `src/lib/site.ts` owns that rule, because
 * the index and the feed need every recipe's title without rendering any of them. This plugin
 * only removes the heading the page is about to render itself.
 *
 * **No recipe file is edited to make this work.** Recipes poured before 2026-07 carry the same
 * verbatim "Safety First" section, and that is frozen history: the transform happens at render
 * time, every time, and the file on disk keeps its era.
 */

import type { Root, RootContent } from "mdast";

/** The parts of the vfile Astro hands a remark plugin that this one actually touches. */
interface MarkdownFile {
  path?: string;
}

/** Concatenate the text of an mdast node, ignoring inline markup. */
function toText(node: RootContent): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => toText(child as RootContent)).join("");
  }
  return "";
}

export default function remarkRecipeBody() {
  return (tree: Root, file: MarkdownFile): void => {
    // Only recipes. The docs pages render their own H1 and have no safety section to strip.
    if (!/[/\\]recipes[/\\]/.test(file.path ?? "")) return;

    // --- remove the leading H1; the page renders the title above the data card ---
    const titleIndex = tree.children.findIndex((n) => n.type === "heading" && n.depth === 1);
    if (titleIndex !== -1) tree.children.splice(titleIndex, 1);

    // --- strip a legacy "## Safety First" section, up to the next level-2 heading ---
    // The trailing thematic break belongs to the section and goes with it, which is what the
    // Python regex did by consuming every line up to the next `## `.
    const safetyIndex = tree.children.findIndex(
      (n) => n.type === "heading" && n.depth === 2 && toText(n).trim() === "Safety First",
    );
    if (safetyIndex !== -1) {
      let end = safetyIndex + 1;
      while (end < tree.children.length) {
        const node = tree.children[end];
        if (node.type === "heading" && node.depth <= 2) break;
        end += 1;
      }
      tree.children.splice(safetyIndex, end - safetyIndex);
    }
  };
}
