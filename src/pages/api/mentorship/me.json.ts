import type { APIRoute } from "astro";
import { getSupabase } from "../../../lib/supabase";
import { PORTAL_SESSION_COOKIE, verifyPortalToken } from "../../../lib/portal-auth";

export const prerender = false;

// Returns the freshest profile + attendance for the participant identified by
// the HttpOnly session cookie. Called by the portal on each page load so admin
// changes to attendance show up immediately.
export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get(PORTAL_SESSION_COOKIE)?.value;
  const session = await verifyPortalToken(token);
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const sb = getSupabase();
  const { data: cohort } = await sb
    .from("cohorts")
    .select("id,label,slug")
    .eq("slug", session.cohortSlug)
    .single();
  if (!cohort) {
    return new Response(JSON.stringify({ error: "cohort not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const { data: user } = await sb
    .from("mentorship_users")
    .select(
      "id,email,name,university,phd_year,thesis,linkedin,website,attended_session_ids"
    )
    .eq("id", session.uid)
    .eq("cohort_id", cohort.id)
    .maybeSingle();
  if (!user) {
    return new Response(JSON.stringify({ error: "user not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      cohort: { slug: cohort.slug, label: cohort.label },
      profile: {
        email: user.email,
        name: user.name,
        university: user.university,
        phdYear: user.phd_year,
        thesis: user.thesis,
        linkedin: user.linkedin,
        website: user.website,
        attendedSessionIds: user.attended_session_ids || [],
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        // Don't let browsers/CDNs cache personal data.
        "cache-control": "no-store",
      },
    }
  );
};
