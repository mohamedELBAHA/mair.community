import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import remarkToc from "remark-toc";
import icon from "astro-icon";
import remarkCollapse from "remark-collapse";
import sitemap from "@astrojs/sitemap";
import { SITE } from "./src/config";

import rehypeExternalLinks from "rehype-external-links";

import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import { getAstroRedirects } from "./src/redirects";

const redirects = getAstroRedirects();

// Configuration for local preview without Netlify adapter
export default defineConfig({
  site: SITE.website,
  output: "static", // Changed from "hybrid" to "static" for preview
  // No adapter for local preview
  prefetch: {
    prefetchAll: true,
  },
  experimental: { contentLayer: true, serverIslands: true },
  build: {
    format: "file",
  },
  redirects,

  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react(),
    sitemap({
      filter: page => !page.includes("/404"),
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
    }),
    icon(),
    mdx(),
    pagefind(),
  ],

  markdown: {
    rehypePlugins: [
      [rehypeExternalLinks, {
        target: '_blank',
        rel: ['nofollow', 'noopener', 'noreferrer']
      }]
    ],
    remarkPlugins: [
      remarkToc,
      [
        remarkCollapse,
        {
          test: "Table of contents",
        },
      ],
    ],
    shikiConfig: {
      theme: "one-dark-pro",
      wrap: true,
    },
  },

  vite: {
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
});
