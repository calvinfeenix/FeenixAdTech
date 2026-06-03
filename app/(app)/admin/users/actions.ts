"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { UserRole, UserStatus } from "@/lib/types";

interface ActionResult {
  ok?: boolean;
  error?: string;
}

/**
 * All mutations here change another user's role/status, so they run with the
 * service role AFTER confirming the caller is an approved admin. Admins cannot
 * change their own role/status (prevents accidental self-lockout).
 */
async function guard(targetId: string): Promise<{ error?: string; selfEdit?: boolean }> {
  const me = await getSessionProfile();
  if (!me || me.role !== "admin" || me.status !== "approved") return { error: "Forbidden" };
  return { selfEdit: me.id === targetId };
}

export async function setUserStatus(
  userId: string,
  status: UserStatus
): Promise<ActionResult> {
  const g = await guard(userId);
  if (g.error) return { error: g.error };
  if (g.selfEdit) return { error: "You can't change your own status." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ status }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserRole(userId: string, role: UserRole): Promise<ActionResult> {
  const g = await guard(userId);
  if (g.error) return { error: g.error };
  if (g.selfEdit) return { error: "You can't change your own role." };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { ok: true };
}
