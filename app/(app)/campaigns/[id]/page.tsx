import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gamepad2, MapPin, Users, Music, Play } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, THUMB_BUCKET } from "@/lib/storage";
import { campaignStatusColors, formatDate, initials } from "@/lib/utils";
import Badge from "@/components/badge";
import CampaignActions from "@/components/campaign-actions";
import { CampaignAnalytics, AnalyticsSkeleton } from "@/components/analytics-sections";
import type { Asset, Campaign, GameLocation, Profile } from "@/lib/types";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireApproved();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();
  if (!campaign) notFound(); // RLS hides campaigns the user can't access → 404

  const c = campaign as Campaign;

  // Assignments load fast. Analytics is lazy-loaded below in a Suspense boundary
  // so this page never blocks on the (DB-aggregated) metrics query.
  const [assetsRes, gamesRes, locationsRes, usersRes] = await Promise.all([
    supabase.from("campaign_assets").select("assets(*)").eq("campaign_id", id),
    supabase.from("campaign_games").select("games(id, name)").eq("campaign_id", id),
    supabase.from("campaign_locations").select("game_locations(id, name, game_id)").eq("campaign_id", id),
    isAdmin
      ? supabase.from("campaign_users").select("profiles(id, username, full_name, email)").eq("campaign_id", id)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  // Supabase types embedded relations loosely, so unwrap via `unknown` casts.
  const assets: Asset[] = ((assetsRes.data ?? []) as unknown as { assets: Asset }[])
    .map((r) => r.assets)
    .filter(Boolean)
    .map((a) => ({ ...a, thumb_url: publicUrl(THUMB_BUCKET, a.thumb_path) ?? undefined }));

  const games = ((gamesRes.data ?? []) as unknown as { games: { id: string; name: string } }[])
    .map((r) => r.games)
    .filter(Boolean);
  const locations = ((locationsRes.data ?? []) as unknown as { game_locations: GameLocation }[])
    .map((r) => r.game_locations)
    .filter(Boolean);
  const viewers = ((usersRes.data ?? []) as unknown as { profiles: Profile }[])
    .map((r) => r.profiles)
    .filter(Boolean);

  return (
    <div className="space-y-6 fade-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ArrowLeft size={15} /> Campaigns
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-display font-bold text-foreground">{c.name}</h1>
            <Badge className={campaignStatusColors[c.status]}>{c.status}</Badge>
          </div>
          <p className="text-sm text-muted mt-1">
            Flight: {c.flight_start ? formatDate(c.flight_start) : "—"} →{" "}
            {c.flight_end ? formatDate(c.flight_end) : "Open"}
          </p>
        </div>
        {isAdmin && <CampaignActions id={c.id} />}
      </div>

      {/* Metrics + trend + breakdowns stream in via the analytics RPC. */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <CampaignAnalytics campaignId={id} creativesCount={assets.length} gamesCount={games.length} />
      </Suspense>

      {/* Targeting & creatives */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Creatives */}
        <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-3">Creatives ({assets.length})</h2>
          {assets.length === 0 ? (
            <p className="text-sm text-muted">No creatives assigned.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {assets.map((a) => (
                <div key={a.id} className="rounded-lg overflow-hidden border border-border aspect-square bg-surface flex items-center justify-center" title={a.title}>
                  {a.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumb_url} alt={a.title} className="w-full h-full object-cover" />
                  ) : a.type === "audio" ? (
                    <Music size={20} className="text-muted" />
                  ) : (
                    <Play size={20} className="text-muted" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Targeting */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Gamepad2 size={15} className="text-accent" /> Games ({games.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {games.length === 0 ? (
                <span className="text-sm text-muted">None</span>
              ) : (
                games.map((g) => (
                  <Badge key={g.id} className="bg-white/8 text-muted-strong normal-case">
                    {g.name}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <MapPin size={15} className="text-accent" /> Locations ({locations.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {locations.length === 0 ? (
                <span className="text-sm text-muted">None</span>
              ) : (
                locations.map((l) => (
                  <Badge key={l.id} className="bg-white/8 text-muted-strong normal-case">
                    {l.name}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Viewers (admin only) */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <Users size={15} className="text-accent" /> Viewer access ({viewers.length})
          </h2>
          {viewers.length === 0 ? (
            <p className="text-sm text-muted">No users assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {viewers.map((u) => (
                <span key={u.id} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-1.5 text-sm text-foreground">
                  <span className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[10px] font-semibold">
                    {initials(u.full_name || u.username)}
                  </span>
                  @{u.username}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
