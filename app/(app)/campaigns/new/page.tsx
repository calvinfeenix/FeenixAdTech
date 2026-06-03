import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, THUMB_BUCKET } from "@/lib/storage";
import CampaignForm from "@/components/campaign-form";
import type { Asset, Game, Profile } from "@/lib/types";

export default async function NewCampaignPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [usersRes, assetsRes, gamesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("status", "approved").order("username"),
    supabase.from("assets").select("*").order("created_at", { ascending: false }),
    supabase.from("games").select("*, locations:game_locations(*)").order("name"),
  ]);

  const users = (usersRes.data ?? []) as Profile[];
  const assets = ((assetsRes.data ?? []) as Asset[]).map((a) => ({
    ...a,
    thumb_url: publicUrl(THUMB_BUCKET, a.thumb_path) ?? undefined,
  }));
  const games = (gamesRes.data ?? []) as Game[];

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">New Campaign</h1>
        <p className="text-muted text-sm mt-1">
          Configure delivery, assign viewers, and target games and locations.
        </p>
      </div>
      <CampaignForm users={users} assets={assets} games={games} />
    </div>
  );
}
