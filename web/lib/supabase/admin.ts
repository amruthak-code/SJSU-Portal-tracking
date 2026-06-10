// Service-role Supabase client — SERVER ONLY. Bypasses RLS, so it must never be
// imported into client components. Used by internal (CRON_SECRET-protected)
// routes that the scraper calls.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
