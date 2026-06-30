import Link from "next/link";
import { Megaphone, Plus, ArrowRight } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, THUMB_BUCKET } from "@/lib/storage";
import { campaignStatusColors, formatDate } from "@/lib/utils";
import Badge from "@/components/badge";
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

  // First creative thumbnail per campaign → card cover image.
  const { data: caRows } = campaigns.length
    ? await supabase
        .from("campaign_assets")
        .select("campaign_id, assets(thumb_path)")
        .in("campaign_id", campaigns.map((c) => c.id))
    : { data: [] };
  const thumbByCampaign = new Map<string, string>();
  for (const r of (caRows ?? []) as unknown as { campaign_id: string; assets: { thumb_path: string | null } | null }[]) {
    if (thumbByCampaign.has(r.campaign_id)) continue;
    const url = r.assets?.thumb_path ? publicUrl(THUMB_BUCKET, r.assets.thumb_path) : null;
    if (url) thumbByCampaign.set(r.campaign_id, url);
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
          {campaigns.map((c) => {
            const thumb = thumbByCampaign.get(c.id);
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="card-glow relative overflow-hidden rounded-xl border border-border bg-card transition-colors group h-[150px] flex flex-col justify-end p-4"
              >
                {thumb && (
                  <div className="absolute inset-0 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-card/35" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[18px] font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                      {c.name}
                    </h3>
                    <Badge className={campaignStatusColors[c.status]}>{c.status}</Badge>
                  </div>
                  <p className="text-xs text-muted mt-1.5">
                    {c.flight_start ? formatDate(c.flight_start) : "No start"} →{" "}
                    {c.flight_end ? formatDate(c.flight_end) : "Open"}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs text-accent mt-2">
                    View analytics <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
