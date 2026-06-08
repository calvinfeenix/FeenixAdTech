import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, THUMB_BUCKET } from "@/lib/storage";
import CampaignForm, { type CampaignFormInitial } from "@/components/campaign-form";
import type { Asset, Campaign, Game, Profile } from "@/lib/types";

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) notFound();
  const c = campaign as Campaign;

  const [usersRes, assetsRes, gamesRes, cuRes, caRes, cgRes, clRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("status", "approved").order("username"),
    supabase.from("assets").select("*").order("created_at", { ascending: false }),
    supabase.from("games").select("*, locations:game_locations(*)").order("name"),
    supabase.from("campaign_users").select("user_id").eq("campaign_id", id),
    supabase
      .from("campaign_assets")
      .select("asset_id, action_type, action_text, action_max_distance, action_hold_duration")
      .eq("campaign_id", id),
    supabase.from("campaign_games").select("game_id").eq("campaign_id", id),
    supabase.from("campaign_locations").select("game_location_id").eq("campaign_id", id),
  ]);

  const users = (usersRes.data ?? []) as Profile[];
  const assets = ((assetsRes.data ?? []) as Asset[]).map((a) => ({
    ...a,
    thumb_url: publicUrl(THUMB_BUCKET, a.thumb_path) ?? undefined,
  }));
  const games = (gamesRes.data ?? []) as Game[];

  type CaRow = {
    asset_id: string;
    action_type: string | null;
    action_text: string | null;
    action_max_distance: number | null;
    action_hold_duration: number | null;
  };
  const caData = (caRes.data ?? []) as CaRow[];
  const actions: Record<string, { actionText: string; maxDistance: number; holdDuration: number }> = {};
  for (const r of caData) {
    if (r.action_type === "proximity") {
      actions[r.asset_id] = {
        actionText: r.action_text ?? "Interact",
        maxDistance: r.action_max_distance ?? 20,
        holdDuration: r.action_hold_duration ?? 0,
      };
    }
  }

  const initial: CampaignFormInitial = {
    id: c.id,
    name: c.name,
    status: c.status,
    flight_start: c.flight_start,
    flight_end: c.flight_end,
    userIds: (cuRes.data ?? []).map((r) => (r as { user_id: string }).user_id),
    assetIds: caData.map((r) => r.asset_id),
    gameIds: (cgRes.data ?? []).map((r) => (r as { game_id: string }).game_id),
    locationIds: (clRes.data ?? []).map((r) => (r as { game_location_id: string }).game_location_id),
    actions,
  };

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Edit Campaign</h1>
        <p className="text-muted text-sm mt-1">Update delivery settings, viewers, and targeting.</p>
      </div>
      <CampaignForm users={users} assets={assets} games={games} initial={initial} />
    </div>
  );
}
