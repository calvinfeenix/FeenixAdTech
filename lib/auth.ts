import { redirect } from "next/navigation";
import { createClient } from "./supabase-server";
import type { Profile } from "./types";

/**
 * Returns the current user's profile (or null if not signed in / no profile).
 * Uses `getUser()` which validates the JWT with Supabase, not just the cookie.
 */
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

/**
 * Guard for app pages: ensures the visitor is signed in AND approved.
 * Redirects to /login or /pending otherwise. Returns the profile on success.
 */
export async function requireApproved(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "approved") redirect("/pending");
  return profile;
}

/** Guard for admin-only pages. Redirects non-admins to the dashboard. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireApproved();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
