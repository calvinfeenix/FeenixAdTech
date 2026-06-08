import { createAdminClient } from "./supabase-admin";

/**
 * Server-only access to the singleton `app_settings` row. Never import this
 * into a Client Component — it reads the raw Roblox API key via the service
 * role (the table is RLS-locked to service-role only).
 */
export interface RobloxConfig {
  apiKey: string | null;
  creatorUserId: number | null;
}

export async function getRobloxConfig(): Promise<RobloxConfig> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("roblox_api_key, roblox_creator_user_id")
    .eq("id", "global")
    .maybeSingle();
  return {
    apiKey: data?.roblox_api_key ?? null,
    creatorUserId: data?.roblox_creator_user_id ?? null,
  };
}

/** Masked view safe to send to the admin UI (never the raw key). */
export async function getRobloxSettingsView(): Promise<{
  keyConfigured: boolean;
  keyLast4: string | null;
  creatorUserId: number | null;
}> {
  const { apiKey, creatorUserId } = await getRobloxConfig();
  return {
    keyConfigured: !!apiKey,
    keyLast4: apiKey ? apiKey.slice(-4) : null,
    creatorUserId,
  };
}
