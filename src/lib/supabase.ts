import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client (uses service-role key). Never imported from
// client-side code — Astro's Vite enforces this for `import.meta.env` keys
// not prefixed with PUBLIC_.
export function getSupabase() {
  const url = import.meta.env.SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
