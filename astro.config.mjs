// @ts-check
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";

import rehypeRepoLinks from "./src/plugins/rehype-repo-links.ts";
import remarkRecipeBody from "./src/plugins/remark-recipe-body.ts";

export default defineConfig({
  site: "https://soap.brian.staruk.net",
  // The default 'directory' format is what reproduces the published URLs:
  // /recipes/<slug>/, /inventory/, /method/, /formulation/.
  build: { format: "directory" },
  markdown: {
    // Astro 7 defaults to the Sätteri processor; the remark/rehype pipeline is opt-in via
    // @astrojs/markdown-remark. This repo wants remark: the two plugins below are mdast and
    // hast transforms, and CommonMark + GFM is the behaviour the archive was rendered against.
    processor: unified({
      remarkPlugins: [remarkRecipeBody],
      rehypePlugins: [rehypeRepoLinks],
      // The recipes are full of inch marks (10" loaf, 1" cut) and em dashes typed as em dashes.
      // SmartyPants would rewrite both. A poured recipe is frozen; render it as written.
      smartypants: false,
    }),
  },
});
