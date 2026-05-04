import type { APIRoute } from "astro";
import { getSupabase } from "../../lib/supabase";

export const prerender = false;

// Public researchers feed for the /network page. Pulls live data from
// Supabase so admin edits in the dashboard show up here without a redeploy.
// Shape matches what the page's client code expects (legacy contract).
export const GET: APIRoute = async () => {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("researchers")
    .select(
      "name,first_name,last_name,affiliation,position,photo,scholar,linkedin,website,twitter,orcid,openalex_id,hindex,i10index,citedby,works_count,interests,scholar_verified,last_scraped"
    )
    .order("citedby", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message, data: [] }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Map snake_case → camelCase to match the legacy /api/researchers contract
  // the network page was originally written against.
  const mapped = (data || []).map(r => ({
    name: r.name,
    firstName: r.first_name,
    lastName: r.last_name,
    affiliation: r.affiliation,
    position: r.position,
    photo: r.photo,
    scholar: r.scholar,
    linkedin: r.linkedin,
    website: r.website,
    twitter: r.twitter,
    orcid: r.orcid,
    openAlexId: r.openalex_id,
    hindex: r.hindex,
    i10index: r.i10index,
    citedby: r.citedby,
    worksCount: r.works_count,
    interests: r.interests || [],
    scholarVerified: r.scholar_verified,
    lastupdate: r.last_scraped,
  }));

  return new Response(JSON.stringify({ data: mapped, count: mapped.length }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60, s-maxage=60",
    },
  });
};
