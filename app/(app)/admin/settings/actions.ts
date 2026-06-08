"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getRobloxConfig } from "@/lib/settings";
import { validateKey } from "@/lib/roblox";

interface ActionResult {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function assertAdmin() {
  const p = await getSessionProfile();
  return p && p.role === "admin" && p.status === "approved" ? p : null;
}

/**
 * Save the shared Roblox Open Cloud settings. A blank API key field leaves the
 * stored key untouched (so admins can edit the creator id without re-pasting).
 */
export async function saveRobloxSettings(formData: FormData): Promise<ActionResult> {
  const me = await assertAdmin();
  if (!me) return { error: "Forbidden" };

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const creatorRaw = String(formData.get("creatorUserId") ?? "").trim();

  const creatorUserId = creatorRaw ? Number(creatorRaw) : null;
  if (creatorRaw && (!Number.isInteger(creatorUserId) || (creatorUserId as number) <= 0))
    return { error: "Creator user ID must be a positive number." };

  const update: Record<string, unknown> = {
    id: "global",
    roblox_creator_user_id: creatorUserId,
    updated_at: new Date().toISOString(),
    updated_by: me.id,
  };
  if (apiKey) update.roblox_api_key = apiKey; // blank → keep existing

  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert(update, { onConflict: "id" });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { ok: true };
}

/** Validate the currently-saved key against Roblox Open Cloud. */
export async function testRobloxConnection(): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  const { apiKey } = await getRobloxConfig();
  if (!apiKey) return { error: "No API key saved yet." };
  const res = await validateKey(apiKey);
  return res.ok ? { ok: true, message: res.message } : { error: res.message };
}
