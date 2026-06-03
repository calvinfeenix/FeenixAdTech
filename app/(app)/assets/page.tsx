import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, ASSET_BUCKET, THUMB_BUCKET } from "@/lib/storage";
import AssetGallery from "@/components/asset-gallery";
import type { Asset } from "@/lib/types";

export default async function AssetsPage() {
  const profile = await requireApproved();
  const supabase = await createClient();

  const { data } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  // Attach public URLs for display (originals + thumbnails).
  const assets: Asset[] = (data ?? []).map((a) => ({
    ...(a as Asset),
    url: publicUrl(ASSET_BUCKET, a.storage_path) ?? undefined,
    thumb_url: publicUrl(THUMB_BUCKET, a.thumb_path) ?? undefined,
  }));

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Asset Repository</h1>
        <p className="text-muted text-sm mt-1">
          {profile.role === "admin"
            ? "Every creative uploaded across the organization. Upload, inspect, and manage."
            : "Browse every creative available across Feenix."}
        </p>
      </div>

      <AssetGallery assets={assets} isAdmin={profile.role === "admin"} />
    </div>
  );
}
