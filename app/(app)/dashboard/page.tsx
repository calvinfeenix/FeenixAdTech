import { Suspense } from "react";
import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { publicUrl, THUMB_BUCKET } from "@/lib/storage";
import { resolveRange } from "@/lib/analytics";
import CampaignCard from "@/components/campaign-card";
import EmptyState from "@/components/empty-state";
import RangePicker from "@/components/range-picker";
import { DashboardAnalytics, AnalyticsSkeleton, TopGames } from "@/components/analytics-sections";
import type { Campaign } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const profile = await requireApproved();
  const supabase = await createClient();
  const { range, fromIso } = resolveRange((await searchParams).range);

  // RLS scopes this to campaigns the user can access (all, for admins).
  const { data: campaignRows } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  const campaigns = (campaignRows ?? []) as Campaign[];
  const ids = campaigns.map((c) => c.id);
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const isAdmin = profile.role === "admin";

  // Creative thumbnails for the shown campaign cards (collage backgrounds).
  const shown = campaigns.slice(0, 3);
  const { data: caRows } = shown.length
    ? await supabase.from("campaign_assets").select("campaign_id, assets(thumb_path)").in("campaign_id", shown.map((c) => c.id))
    : { data: [] };
  const thumbsByCampaign = new Map<string, string[]>();
  for (const r of (caRows ?? []) as unknown as { campaign_id: string; assets: { thumb_path: string | null } | null }[]) {
    const url = r.assets?.thumb_path ? publicUrl(THUMB_BUCKET, r.assets.thumb_path) : null;
    if (!url) continue;
    const arr = thumbsByCampaign.get(r.campaign_id) ?? [];
    if (arr.length < 6) arr.push(url);
    thumbsByCampaign.set(r.campaign_id, arr);
  }

  return (
    <div className="space-y-6 fade-up">
      {/* Hero — full-bleed games backdrop that gradients into the page background */}
      <div className="relative -mt-20 -mx-4 sm:-mx-6 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-drift" style={{ backgroundImage: "url(/login-bg.png)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/70 to-background" />
        <div className="relative px-6 pt-24 pb-16 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/SmallLogo.png" alt="Feenix" className="h-11 w-auto object-contain" />
          <h1 className="mt-4 text-2xl sm:text-3xl font-display font-bold text-foreground">
            Welcome back, {profile.full_name || profile.username}
          </h1>
          <p className="mt-1 text-2xl sm:text-3xl font-display font-bold text-foreground">
            Craft your in-game ad delivery now.
          </p>
          <Link
            href="/assets"
            className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-full px-12 sm:px-20 py-2.5 transition-all duration-200 hover:shadow-[0_6px_28px_-6px_var(--accent)] active:scale-95"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/UploadIcon.png" alt="" width={16} height={16} className="object-contain" /> Upload Asset
          </Link>
        </div>
      </div>

      {/* Performance Highlights */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[30px] leading-tight font-display font-bold text-accent">Performance Highlights</h2>
          <p className="text-muted text-sm mt-0.5">Performance across the campaigns you have access to.</p>
        </div>
        <RangePicker value={range} />
      </div>

      {/* Metrics + trend stream in via the analytics RPC; the page shell renders immediately. */}
      <Suspense key={`metrics-${range}`} fallback={<AnalyticsSkeleton />}>
        <DashboardAnalytics campaignIds={ids} campaignsCount={campaigns.length} activeCount={activeCount} fromIso={fromIso} />
      </Suspense>

      {/* Best experiences + campaigns */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Best Performing Experiences */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[#66CCFF]">Best Performing Experiences</h2>
            {isAdmin && (
              <Link href="/games" className="text-xs text-[#a1a1aa] hover:underline flex items-center gap-1">
                <ArrowRight size={13} /> View all
              </Link>
            )}
          </div>
          <Suspense key={`topgames-${range}`} fallback={<div className="bg-card border border-border rounded-xl h-[88px] animate-pulse" />}>
            <TopGames campaignIds={ids} fromIso={fromIso} />
          </Suspense>
        </div>

        {/* Your campaigns */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[#66CCFF]">Your campaigns</h2>
            <Link href="/campaigns" className="text-xs text-[#a1a1aa] hover:underline flex items-center gap-1">
              <ArrowRight size={13} /> View all
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description={
                isAdmin
                  ? "Create your first campaign to start serving ads."
                  : "You haven't been added to any campaigns yet. An admin will assign you access."
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {shown.map((c) => (
                <CampaignCard
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  name={c.name}
                  status={c.status}
                  flightStart={c.flight_start}
                  flightEnd={c.flight_end}
                  thumbs={thumbsByCampaign.get(c.id) ?? []}
                  heightClass="h-[116px]"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
