import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, THUMB_BUCKET } from "@/lib/storage";
import CampaignCard from "@/components/campaign-card";
import EmptyState from "@/components/empty-state";
import PageHero from "@/components/page-hero";
import type { Campaign } from "@/lib/types";

export default async function CampaignsPage() {
  const profile = await requireApproved();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  // RLS returns every campaign for admins, or only assigned ones for users.
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  const campaigns = (data ?? []) as Campaign[];

  // Creative thumbnails per campaign → the card's moving collage background.
  const { data: caRows } = campaigns.length
    ? await supabase
        .from("campaign_assets")
        .select("campaign_id, assets(thumb_path)")
        .in("campaign_id", campaigns.map((c) => c.id))
    : { data: [] };
  const thumbsByCampaign = new Map<string, string[]>();
  for (const r of (caRows ?? []) as unknown as { campaign_id: string; assets: { thumb_path: string | null } | null }[]) {
    const url = r.assets?.thumb_path ? publicUrl(THUMB_BUCKET, r.assets.thumb_path) : null;
    if (!url) continue;
    const arr = thumbsByCampaign.get(r.campaign_id) ?? [];
    if (arr.length < 6) arr.push(url);
    thumbsByCampaign.set(r.campaign_id, arr);
  }

  const newBtn = (
    <Link
      href="/campaigns/new"
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95 shrink-0"
    >
      <Plus size={16} /> New campaign
    </Link>
  );

  return (
    <div className="space-y-6 fade-up">
      <PageHero
        title="Campaigns"
        subtitle={isAdmin ? "All campaigns across Feenix." : "Campaigns you have access to."}
        action={isAdmin ? newBtn : undefined}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description={
            isAdmin
              ? "Create your first campaign to assign assets, games, and viewers."
              : "You haven't been assigned to any campaigns yet."
          }
        >
          {isAdmin && newBtn}
        </EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              href={`/campaigns/${c.id}`}
              name={c.name}
              status={c.status}
              flightStart={c.flight_start}
              flightEnd={c.flight_end}
              thumbs={thumbsByCampaign.get(c.id) ?? []}
              showCta
            />
          ))}
        </div>
      )}
    </div>
  );
}
