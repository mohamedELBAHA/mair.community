import { file, glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import {
  authorSchema,
  blogSchema,
  memberSchema,
  testimonialSchema,
} from "./schema";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "articles" }),
  schema: arg => blogSchema(arg),
});

export const authors = defineCollection({
  loader: glob({ pattern: "**/[^_]*.json", base: "authors" }),
  schema: authorSchema,
});

/**
 * Gallery collection
 * Using local images from team/gallery folder
 */

const gallery = defineCollection({
  loader: file("local-gallery-data.json"),
});

const team = defineCollection({
  loader: file("team/team-members.json"),
  schema: ctx => memberSchema(ctx),
});

const testimonials = defineCollection({
  loader: file("testimonials/data.json"),
  schema: ctx => testimonialSchema(ctx),
});

export const collections = {
  gallery,
  team,
  blog,
  authors,
  testimonials,
};
