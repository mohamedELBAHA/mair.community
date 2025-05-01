import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import remarkToc from "remark-toc";
import icon from "astro-icon";
import remarkCollapse from "remark-collapse";
import sitemap from "@astrojs/sitemap";
import { SITE } from "./src/config";
import { fileURLToPath } from "url";

import rehypeExternalLinks from "rehype-external-links";

import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import netlify from "@astrojs/netlify";
import { getAstroRedirects } from "./src/redirects";

const redirects = getAstroRedirects();
// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  output: "hybrid",
  adapter: netlify(),
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
        rel: ['noopener', 'noreferrer'],
        internal: true
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
      themes: { light: "min-light", dark: "night-owl" },
      wrap: true,
    },
  },
  vite: {
    assetsInclude: ["**/*.riv"],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ["@resvg/resvg-js", "@astrojs/astro", "@hookform/resolvers", "tailwind-merge"],
    },
    ssr: {
      noExternal: ["@astrojs/astro", "marked", "@hookform/resolvers", "tailwind-merge"],
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
      },
      rollupOptions: {
        external: [
          /scripts\/.*/,        // Everything in scripts directory
          /\.py$/,             // Any Python files outside scripts
          /\.venv\/.*/,        // Virtual environment directory
          /requirements\.txt$/ // Requirements file
        ],
      }
    }
  },
  scopedStyleStrategy: "where",
});