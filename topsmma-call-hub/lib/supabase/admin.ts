import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client that uses the service role key, so it
// bypasses row level security entirely. Only use this for trusted
// background work that isn't tied to a particular rep's session, such
// as the AI brief generator, which keeps running after a request has
// already finished and has no logged-in user's cookies to read.
//
// Never import this file from a "use client" component, and never send
// its key to the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
