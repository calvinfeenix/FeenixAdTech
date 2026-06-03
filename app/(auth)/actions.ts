"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export interface AuthResult {
  ok?: boolean;
  error?: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

/**
 * Sign up a new user. We create the auth user with the service role and
 * `email_confirm: true` so the account is usable immediately regardless of the
 * project's email-confirmation setting — access is still gated by the
 * `status = 'pending'` flag until an admin approves them. The profile row is
 * created automatically by the `handle_new_user` trigger.
 */
export async function signupAction(formData: FormData): Promise<AuthResult> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!USERNAME_RE.test(username))
    return { error: "Username must be 3–32 characters: letters, numbers, underscores." };
  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const admin = createAdminClient();

  // Reject duplicate usernames up front for a clean error message.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (existing) return { error: "That username is already taken." };

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName || null },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already"))
      return { error: "An account with that email already exists." };
    return { error: error.message };
  }

  // Establish a session so the user lands on the "pending approval" screen.
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  return { ok: true };
}

/**
 * Log in with either a username or an email plus password. Usernames are
 * resolved to their email server-side via the service role (the public can't
 * read the profiles table directly).
 */
export async function loginAction(formData: FormData): Promise<AuthResult> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "Enter your username/email and password." };

  let email = identifier.toLowerCase();

  if (!identifier.includes("@")) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("email")
      .ilike("username", identifier)
      .maybeSingle();
    if (!data) return { error: "Invalid credentials." };
    email = data.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid credentials." };
  return { ok: true };
}
