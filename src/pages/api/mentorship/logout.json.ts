import type { APIRoute } from "astro";
import { PORTAL_SESSION_COOKIE } from "../../../lib/portal-auth";

export const prerender = false;

export const POST: APIRoute = async () => {
  // Expire the cookie immediately. Setting Max-Age=0 forces the browser to drop it.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": `${PORTAL_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    },
  });
};
