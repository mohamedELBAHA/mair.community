import type { APIRoute } from "astro";
import { getSupabase } from "../../../lib/supabase";
import {
  createPortalToken,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_MAX_AGE,
} from "../../../lib/portal-auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { cohortSlug?: string; email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const cohortSlug = String(body.cohortSlug || "").trim();
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const code = String(body.code || "")
    .trim()
    .toUpperCase();
  if (!cohortSlug || !email || !code) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const sb = getSupabase();
  const { data: cohort } = await sb
    .from("cohorts")
    .select("id,label")
    .eq("slug", cohortSlug)
    .single();
  if (!cohort) {
    return new Response(JSON.stringify({ error: "Invalid email or code" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { data: user } = await sb
    .from("mentorship_users")
    .select(
      "id,email,code,name,university,phd_year,thesis,linkedin,website,attended_session_ids"
    )
    .eq("cohort_id", cohort.id)
    .ilike("email", email)
    .maybeSingle();

  if (!user || user.code.toUpperCase() !== code) {
    return new Response(JSON.stringify({ error: "Invalid email or code" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Strip the access code from the response — only send back the profile data.
  const { code: _strip, ...profile } = user;

  // Issue an HttpOnly session cookie so the portal can fetch fresh attendance
  // on every page load (without ever storing the access code in the browser).
  const token = await createPortalToken({ uid: user.id, cohortSlug });
  const isProd = import.meta.env.PROD;
  const cookieParts = [
    `${PORTAL_SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${PORTAL_SESSION_MAX_AGE}`,
  ];
  if (isProd) cookieParts.push("Secure");

  return new Response(
    JSON.stringify({
      ok: true,
      cohort: { slug: cohortSlug, label: cohort.label },
      profile: {
        email: profile.email,
        name: profile.name,
        university: profile.university,
        phdYear: profile.phd_year,
        thesis: profile.thesis,
        linkedin: profile.linkedin,
        website: profile.website,
        attendedSessionIds: profile.attended_session_ids || [],
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": cookieParts.join("; "),
      },
    }
  );
};
