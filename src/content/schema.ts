import { slugify } from "@/lib/utils";
import { reference, z, type SchemaContext } from "astro:content";

export const blogSchema = (ctx: SchemaContext) =>
  z
    .object({
      authors: z.array(reference("authors")).optional(),
      pubDatetime: z.date(),
      title: z.string(),
      slug: z.string().optional(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      keywords: z.array(z.string()).default([""]),
      ogImage: ctx.image().optional(), //z.string().optional(),
      description: z.string().optional().default(""),
      published: z.boolean().optional().default(true),
    })
    .transform(arg => {
      const slug = arg.slug ? arg.slug : slugify(arg.title);
      return {
        ...arg,
        slug,
      };
    });

export const authorSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  bio: z.string(),
  avatar: z.string(),
  is_core_team: z.boolean().optional().default(false),
});

export type ArticleFrontmatter = z.infer<ReturnType<typeof blogSchema>>;

export const memberSchema = (ctx: SchemaContext) =>
  z.object({
    name: z.string(),
    link: z.string().url(),
    profile_image: ctx.image(),
    status: z.enum(["active"]),
  });

export const teamSchema = (ctx: SchemaContext) =>
  z.object({
    members: z.array(memberSchema(ctx)),
  });

export const testimonialSchema = (ctx: SchemaContext) =>
  z.object({
    name: z.string(),
    role: z.string(),
    avatar: ctx.image().optional(),
    quote: z.string().optional(),
    video: z.string().url().optional(),
    poster: z.string().url().optional(),
  });

export const testimonialsSchema = (ctx: SchemaContext) =>
  z.object({
    testimonials: z.array(testimonialSchema(ctx)),
  });
