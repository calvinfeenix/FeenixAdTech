import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { ASSET_BUCKET, THUMB_BUCKET } from "@/lib/storage";

export const runtime = "nodejs";

/** Admin-only asset deletion: removes the storage objects, then the row. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "approved") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("storage_path, thumb_path")
    .eq("id", id)
    .single();
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  await admin.storage.from(ASSET_BUCKET).remove([asset.storage_path]);
  if (asset.thumb_path) await admin.storage.from(THUMB_BUCKET).remove([asset.thumb_path]);

  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
