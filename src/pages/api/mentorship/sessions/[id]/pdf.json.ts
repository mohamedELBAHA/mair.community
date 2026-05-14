import type { APIRoute } from "astro";
import { getSupabase } from "../../../../../lib/supabase";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalToken,
} from "../../../../../lib/portal-auth";

export const prerender = false;

const BUCKET = "bootcamp-pdfs";
const SIGN_TTL_SECONDS = 60 * 5; // 5 min — long enough to start the download

// Mints a short-lived signed URL for a session's PDF, but only if the
// requesting participant belongs to the session's cohort.
export const GET: APIRoute = async ({ cookies, params }) => {
  const token = cookies.get(PORTAL_SESSION_COOKIE)?.value;
  const session = await verifyPortalToken(token);
  if (!session) return json({ error: "unauthorized" }, 401);

  const sessionId = params.id;
  if (!sessionId) return json({ error: "missing id" }, 400);

  const sb = getSupabase();

  // Look up the bootcamp session + the cohort slug it belongs to in one round-trip.
  const { data: row, error } = await sb
    .from("bootcamp_sessions")
    .select("id, pdf_path, pdf_filename, cohorts!inner(slug)")
    .eq("id", sessionId)
    .single();
  if (error || !row) return json({ error: "not found" }, 404);

  // Hide the existence of files in other cohorts.
  const cohortSlug = (row as unknown as { cohorts?: { slug?: string } }).cohorts?.slug;
  if (cohortSlug !== session.cohortSlug) return json({ error: "not found" }, 404);
  if (!row.pdf_path) return json({ error: "no pdf for this session" }, 404);

  const { data: signed, error: sErr } = await sb.storage
    .from(BUCKET)
    .createSignedUrl(row.pdf_path, SIGN_TTL_SECONDS, {
      download: row.pdf_filename || true,
    });
  if (sErr || !signed) {
    return json({ error: sErr?.message || "could not sign" }, 500);
  }

  return json(
    { url: signed.signedUrl, filename: row.pdf_filename || "presentation.pdf" },
    200,
  );
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
