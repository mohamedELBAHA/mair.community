import type { APIRoute } from "astro";
import { getSupabase } from "../../../lib/supabase";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalToken,
} from "../../../lib/portal-auth";

export const prerender = false;

// Fellow cohort members — visible only to authenticated participants of the
// same cohort. We never return `code` (access credential).
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
  const { data: me, error: meErr } = await sb
    .from("mentorship_users")
    .select("cohort_id")
    .eq("id", session.uid)
    .single();
  if (meErr || !me) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const { data, error } = await sb
    .from("mentorship_users")
    .select("id,email,name,university,phd_year,linkedin,website")
    .eq("cohort_id", me.cohort_id)
    .order("name", { ascending: true });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      members: (data || []).map((m) => ({
        id: m.id,
        isSelf: m.id === session.uid,
        name: m.name,
        email: m.email,
        university: m.university,
        phdYear: m.phd_year,
        linkedin: m.linkedin,
        website: m.website,
      })),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};
