import Link from "next/link";
import { Megaphone, Eye, MousePointerClick, Users, ArrowRight } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { fetchCampaignAnalytics } from "@/lib/analytics";
import { formatCompact, formatDate, formatPercent, campaignStatusColors } from "@/lib/utils";
import StatCard from "@/components/stat-card";
import Badge from "@/components/badge";
import EmptyState from "@/components/empty-state";
import { TrendChart } from "@/components/charts";
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

  // Aggregated server-side (RPC, with a paginated fallback) — fetching raw
  // events would hit PostgREST's row cap and silently drop recent days.
  const ids = campaigns.map((c) => c.id);
  const summary = await fetchCampaignAnalytics(supabase, ids);
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Welcome back, {profile.full_name || profile.username}
        </h1>
        <p className="text-muted text-sm mt-1">
          {profile.role === "admin"
            ? "Organization-wide campaign performance."
            : "Performance across the campaigns you have access to."}
        </p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Campaigns"
          value={String(campaigns.length)}
          subtitle={`${activeCount} active`}
          icon={Megaphone}
        />
        <StatCard title="Impressions" value={formatCompact(summary.impressions)} icon={Eye} />
        <StatCard
          title="Unique Users"
          value={formatCompact(summary.uniqueUsers)}
          icon={Users}
        />
        <StatCard
          title="CTR"
          value={formatPercent(summary.ctr)}
          subtitle={`${formatCompact(summary.clicks)} clicks`}
          icon={MousePointerClick}
        />
      </div>

      {/* Trend */}
      {summary.daily.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Delivery trend</h2>
          <TrendChart data={summary.daily} />
        </div>
      )}

      {/* Campaign list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Your campaigns</h2>
          <Link href="/campaigns" className="text-sm text-accent hover:underline flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description={
              profile.role === "admin"
                ? "Create your first campaign to start serving ads."
                : "You haven't been added to any campaigns yet. An admin will assign you access."
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="bg-card border border-border rounded-xl p-5 hover:border-border-strong transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-foreground group-hover:text-accent transition-colors">
                    {c.name}
                  </h3>
                  <Badge className={campaignStatusColors[c.status]}>{c.status}</Badge>
                </div>
                <p className="text-xs text-muted mt-3">
                  {c.flight_start ? formatDate(c.flight_start) : "No start"} →{" "}
                  {c.flight_end ? formatDate(c.flight_end) : "Open"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
