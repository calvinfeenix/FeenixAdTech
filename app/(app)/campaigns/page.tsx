import Link from "next/link";
import { Megaphone, Plus, ArrowRight } from "lucide-react";
import { requireApproved } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { campaignStatusColors, formatDate } from "@/lib/utils";
import Badge from "@/components/badge";
import EmptyState from "@/components/empty-state";
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

  return (
    <div className="space-y-6 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Campaigns</h1>
          <p className="text-muted text-sm mt-1">
            {isAdmin ? "All campaigns across Feenix." : "Campaigns you have access to."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/campaigns/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95"
          >
            <Plus size={16} /> New campaign
          </Link>
        )}
      </div>

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
          {isAdmin && (
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95"
            >
              <Plus size={16} /> New campaign
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-border-strong transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-foreground group-hover:text-accent transition-colors">
                  {c.name}
                </h3>
                <Badge className={campaignStatusColors[c.status]}>{c.status}</Badge>
              </div>
              <p className="text-xs text-muted mt-3">
                {c.flight_start ? formatDate(c.flight_start) : "No start"} →{" "}
                {c.flight_end ? formatDate(c.flight_end) : "Open"}
              </p>
              <span className="inline-flex items-center gap-1 text-xs text-accent mt-4">
                View analytics <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
