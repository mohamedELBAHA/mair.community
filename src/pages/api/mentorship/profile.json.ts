import type { APIRoute } from "astro";
import { getSupabase } from "../../../lib/supabase";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalToken,
} from "../../../lib/portal-auth";

export const prerender = false;

// Participants self-edit a few profile fields. Admin-controlled fields
// (email, code, attended_session_ids) are intentionally NOT writable here.
const ALLOWED = [
  "name",
  "university",
  "phd_year",
  "thesis",
  "linkedin",
  "website",
] as const;

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get(PORTAL_SESSION_COOKIE)?.value;
  const session = await verifyPortalToken(token);
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (k in body) {
      const v = body[k];
      update[k] = typeof v === "string" ? v.trim() || null : null;
    }
  }
  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ error: "Nothing to update" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("mentorship_users")
    .update(update)
    .eq("id", session.uid)
    .select(
      "email,name,university,phd_year,thesis,linkedin,website,attended_session_ids"
    )
    .single();
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      profile: {
        email: data.email,
        name: data.name,
        university: data.university,
        phdYear: data.phd_year,
        thesis: data.thesis,
        linkedin: data.linkedin,
        website: data.website,
        attendedSessionIds: data.attended_session_ids || [],
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
