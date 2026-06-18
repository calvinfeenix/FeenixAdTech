import { Suspense } from "react";
import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { formatDate, campaignStatusColors } from "@/lib/utils";
import Badge from "@/components/badge";
import EmptyState from "@/components/empty-state";
import { DashboardAnalytics, AnalyticsSkeleton } from "@/components/analytics-sections";
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

      {/* Metrics + trend stream in via the analytics RPC; the page shell renders immediately. */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <DashboardAnalytics campaignIds={ids} campaignsCount={campaigns.length} activeCount={activeCount} />
      </Suspense>

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
