import { Suspense } from "react";
import Link from "next/link";
import { Megaphone, ArrowRight, UploadCloud } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { formatDate, campaignStatusColors } from "@/lib/utils";
import { publicUrl, THUMB_BUCKET } from "@/lib/storage";
import Logo from "@/components/logo";
import Badge from "@/components/badge";
import EmptyState from "@/components/empty-state";
import { DashboardAnalytics, AnalyticsSkeleton, TopGames } from "@/components/analytics-sections";
import type { Campaign } from "@/lib/types";

export default async function DashboardPage() {
  const profile = await requireApproved();
  const supabase = await createClient();

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
  const shown = campaigns.slice(0, 4);
  const { data: caRows } = shown.length
    ? await supabase.from("campaign_assets").select("campaign_id, assets(thumb_path)").in("campaign_id", shown.map((c) => c.id))
    : { data: [] };
  const thumbsByCampaign = new Map<string, string[]>();
  for (const r of (caRows ?? []) as unknown as { campaign_id: string; assets: { thumb_path: string | null } | null }[]) {
    const url = r.assets?.thumb_path ? publicUrl(THUMB_BUCKET, r.assets.thumb_path) : null;
    if (!url) continue;
    const arr = thumbsByCampaign.get(r.campaign_id) ?? [];
    if (arr.length < 4) arr.push(url);
    thumbsByCampaign.set(r.campaign_id, arr);
  }

  return (
    <div className="space-y-6 fade-up">
      {/* Hero — full-bleed games backdrop that gradients into the page background */}
      <div className="relative -mt-20 -mx-4 sm:-mx-6 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/login-bg.png)" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/70 to-background" />
        <div className="relative px-6 pt-24 pb-16 flex flex-col items-center text-center">
          <Logo size={38} />
          <h1 className="mt-4 text-2xl sm:text-3xl font-display font-bold text-foreground">
            Welcome back, {profile.full_name || profile.username}
          </h1>
          <p className="mt-1 text-base sm:text-lg font-display font-semibold text-muted-strong">
            Craft your in-game ad delivery now.
          </p>
          <Link
            href="/assets"
            className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-black font-semibold rounded-full px-6 py-2.5 transition-all duration-200 hover:shadow-[0_6px_28px_-6px_var(--accent)] active:scale-95"
          >
            <UploadCloud size={18} /> Upload Asset
          </Link>
        </div>
      </div>

      {/* Performance Highlights */}
      <div>
        <h2 className="text-xl font-display font-bold text-accent">Performance Highlights</h2>
        <p className="text-muted text-sm mt-0.5">
          {profile.role === "admin"
            ? "Organization-wide campaign performance."
            : "Performance across the campaigns you have access to."}
        </p>
      </div>

      {/* Metrics + trend stream in via the analytics RPC; the page shell renders immediately. */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <DashboardAnalytics campaignIds={ids} campaignsCount={campaigns.length} activeCount={activeCount} />
      </Suspense>

      {/* Best experiences + campaigns */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Best Performing Experiences */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Best Performing Experiences</h2>
            {isAdmin && (
              <Link href="/games" className="text-xs text-accent hover:underline flex items-center gap-1">
                View all <ArrowRight size={13} />
              </Link>
            )}
          </div>
          <Suspense fallback={<div className="bg-card border border-border rounded-xl h-[220px] animate-pulse" />}>
            <TopGames campaignIds={ids} />
          </Suspense>
        </div>

        {/* Your campaigns */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Your campaigns</h2>
            <Link href="/campaigns" className="text-xs text-accent hover:underline flex items-center gap-1">
              View all <ArrowRight size={13} />
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
            <div className="grid sm:grid-cols-2 gap-4">
              {shown.map((c) => {
                const thumbs = thumbsByCampaign.get(c.id) ?? [];
                return (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    className="relative overflow-hidden rounded-xl border border-border hover:border-border-strong transition-colors group h-[116px] flex flex-col justify-end p-4"
                  >
                    {thumbs.length > 0 && (
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="overflow-hidden bg-surface">
                            {thumbs[i % thumbs.length] && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumbs[i % thumbs.length]} alt="" className="w-full h-full object-cover" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/55" />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium text-foreground truncate group-hover:text-accent transition-colors">
                          {c.name}
                        </h3>
                        <Badge className={campaignStatusColors[c.status]}>{c.status}</Badge>
                      </div>
                      <p className="text-xs text-muted mt-1.5">
                        {c.flight_start ? formatDate(c.flight_start) : "No start"} →{" "}
                        {c.flight_end ? formatDate(c.flight_end) : "Open"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
