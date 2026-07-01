import { requireAdmin, canUploadAssets } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, ASSET_BUCKET, THUMB_BUCKET } from "@/lib/storage";
import AssetGallery from "@/components/asset-gallery";
import PageHero from "@/components/page-hero";
import type { Asset } from "@/lib/types";

export default async function AssetsPage() {
  const profile = await requireAdmin();
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
      <PageHero
        title="Asset Repository"
        subtitle={
          profile.role === "admin"
            ? "Every creative uploaded across the organization. Upload, inspect, and manage."
            : "Browse every creative available across Feenix."
        }
      />

      <AssetGallery assets={assets} isAdmin={profile.role === "admin"} canUpload={canUploadAssets(profile)} />
    </div>
  );
}
