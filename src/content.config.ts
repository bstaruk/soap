import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

import { recipeFrontmatter } from "./lib/schema.ts";

/** The archive. The `NNN-` pattern is what excludes `recipes/README.md` and `recipes/archive/`. */
const recipes = defineCollection({
  loader: glob({ pattern: "[0-9][0-9][0-9]-*.md", base: "./recipes" }),
  schema: recipeFrontmatter,
});

/** `docs/method.md` and `docs/formulation.md`, rendered as-is — H1 and all. */
const docs = defineCollection({
  loader: glob({ pattern: "*.md", base: "./docs" }),
});

export const collections = { recipes, docs };
