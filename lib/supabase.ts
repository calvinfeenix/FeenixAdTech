import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (anon key). Safe to use in Client Components.
 * Row Level Security policies — not this key — are what protect the data.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
