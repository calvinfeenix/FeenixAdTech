import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { ASSET_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Hands an admin a one-time signed upload URL so the BROWSER can upload a large
 * original (e.g. an .mp4) straight to Storage — bypassing the Next route handler,
 * whose `formData()` parse fails on large bodies ("Invalid form data"). The
 * client then calls /api/assets/upload with just `storagePath` + small metadata.
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "approved")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { filename?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const ext = (body.filename?.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `video/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not sign upload" }, { status: 500 });

  return NextResponse.json({ path, token: data.token });
}
