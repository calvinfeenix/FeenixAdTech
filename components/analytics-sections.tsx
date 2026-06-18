import { Eye, MousePointerClick, Users, Megaphone, Gamepad2, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { fetchCampaignAnalytics } from "@/lib/analytics";
import { formatCompact, formatPercent } from "@/lib/utils";
import StatCard from "@/components/stat-card";
import EmptyState from "@/components/empty-state";
import { TrendChart, BreakdownChart } from "@/components/charts";

/**
 * Lazy-loaded analytics sections. These are async server components rendered
 * inside a <Suspense> boundary on the dashboard / campaign pages, so the page
 * shell paints immediately and the (DB-aggregated) metrics stream in. All the
 * heavy lifting happens in the `campaign_analytics` RPC — see lib/analytics.
 */

/** Skeleton shown while the analytics RPC resolves. */
export function AnalyticsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl h-[92px] animate-pulse" />
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl h-[300px] animate-pulse" />
    </div>
  );
}

export async function DashboardAnalytics({
  campaignIds,
  campaignsCount,
  activeCount,
}: {
  campaignIds: string[];
  campaignsCount: number;
  activeCount: number;
}) {
  const supabase = await createClient();
  const summary = await fetchCampaignAnalytics(supabase, campaignIds);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Campaigns" value={String(campaignsCount)} subtitle={`${activeCount} active`} icon={Megaphone} />
        <StatCard title="Impressions" value={formatCompact(summary.impressions)} icon={Eye} />
        <StatCard title="Unique Users" value={formatCompact(summary.uniqueUsers)} icon={Users} />
        <StatCard
          title="CTR"
          value={formatPercent(summary.ctr)}
          subtitle={`${formatCompact(summary.clicks)} clicks`}
          icon={MousePointerClick}
        />
      </div>
      {summary.daily.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Delivery trend</h2>
          <TrendChart data={summary.daily} />
        </div>
      )}
    </div>
  );
}

export async function CampaignAnalytics({
  campaignId,
  creativesCount,
  gamesCount,
}: {
  campaignId: string;
  creativesCount: number;
  gamesCount: number;
}) {
  const supabase = await createClient();
  const summary = await fetchCampaignAnalytics(supabase, [campaignId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Impressions" value={formatCompact(summary.impressions)} icon={Eye} />
        <StatCard title="Unique Users" value={formatCompact(summary.uniqueUsers)} icon={Users} />
        <StatCard
          title="CTR"
          value={formatPercent(summary.ctr)}
          subtitle={`${formatCompact(summary.clicks)} clicks`}
          icon={MousePointerClick}
        />
        <StatCard title="Creatives" value={String(creativesCount)} subtitle={`${gamesCount} games`} icon={Gamepad2} />
      </div>

      {summary.daily.length > 0 ? (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Delivery over time</h2>
          <TrendChart data={summary.daily} />
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title="No analytics yet"
          description="Once Roblox starts reporting events for this campaign, performance will appear here."
        />
      )}

      {(summary.byGame.length > 0 || summary.byLocation.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Impressions by game</h2>
            <BreakdownChart data={summary.byGame.map((g) => ({ label: g.game, value: g.impressions }))} />
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Impressions by location</h2>
            <BreakdownChart data={summary.byLocation.map((l) => ({ label: l.location, value: l.impressions }))} />
          </div>
        </div>
      )}
    </div>
  );
}
