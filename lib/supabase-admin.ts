import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER ONLY — this bypasses Row Level Security.
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
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "The service-role client cannot be created."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
