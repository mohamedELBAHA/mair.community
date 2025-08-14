import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { generateOgImageForArticle } from "@/lib/og-image";

export async function getStaticPaths() {
  const articles = await getCollection("blog").then(p =>
    p.filter(({ data }) => !data.draft && !data.ogImage)
  );
  return articles.map(article => ({
    params: { slug: article.data.slug },
    props: article,
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const buffer = await generateOgImageForArticle(
    props as CollectionEntry<"blog">
  );
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
};
