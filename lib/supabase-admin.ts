import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client using the SECRET key. SERVER ONLY — bypasses Row Level Security.
 *
 * Only use it for trusted privileged operations that have already passed an
 * explicit admin check in a Server Action / Route Handler:
 *   - approving / rejecting sign-ups and changing roles
 *   - writing analytics events from the ingestion endpoint
 *   - the seed script
 *
 * Importing this into a Client Component will leak the key — don't.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. " +
        "The admin (secret-key) client cannot be created."
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
