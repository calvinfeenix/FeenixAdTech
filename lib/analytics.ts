import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsEvent, CampaignAnalyticsSummary } from "./types";

interface NamedEvent extends AnalyticsEvent {
  game_name?: string | null;
  location_name?: string | null;
}

/**
 * Fetch an aggregated analytics summary for the given campaigns.
 *
 * All aggregation happens in the `campaign_analytics` Postgres RPC — it sums in
 * SQL (one tiny payload) and is SECURITY DEFINER so it bypasses the per-row RLS
 * that would otherwise time out on a large events table. We deliberately do NOT
 * read raw rows here: that hits PostgREST's row cap AND the per-row RLS timeout.
 *
 * If the function isn't installed yet (run scripts/analytics-function.sql), we
 * return an empty summary rather than hang — the page still renders instantly.
 */
export async function fetchCampaignAnalytics(
  supabase: SupabaseClient,
  campaignIds: string[]
): Promise<CampaignAnalyticsSummary> {
  if (campaignIds.length === 0) return EMPTY_SUMMARY;
  const { data, error } = await supabase.rpc("campaign_analytics", { p_campaign_ids: campaignIds });
  if (error || !data) return EMPTY_SUMMARY;
  return data as CampaignAnalyticsSummary;
}

/** Zero-state used when a campaign has no events (or the RPC returns null). */
export const EMPTY_SUMMARY: CampaignAnalyticsSummary = {
  impressions: 0,
  clicks: 0,
  uniqueUsers: 0,
  ctr: 0,
  daily: [],
  byGame: [],
  byLocation: [],
};

/**
 * Aggregate raw analytics events into the summary the UI charts consume.
 * Metrics: impressions, clicks, CTR (clicks/impressions), and unique users.
 * Pure function — no I/O — so it is trivial to test and reuse.
 *
 * Note on unique users: events carry a per-day unique count, so the campaign
 * total is the sum of daily uniques (a reach approximation — a player active on
 * two days counts on each). Good enough for reporting; swap for HLL/exact
 * distinct counts if precise de-duplication across the flight is ever needed.
 */
export function summarizeAnalytics(events: NamedEvent[]): CampaignAnalyticsSummary {
  let impressions = 0;
  let clicks = 0;
  let uniqueUsers = 0;

  const dailyMap = new Map<string, { impressions: number; clicks: number; uniqueUsers: number }>();
  const gameMap = new Map<string, number>();
  const locationMap = new Map<string, number>();

  for (const e of events) {
    const count = e.count ?? 1;
    if (e.event_type === "impression") impressions += count;
    else if (e.event_type === "click") clicks += count;
    else if (e.event_type === "unique_user") uniqueUsers += count;

    const day = e.ts.slice(0, 10); // YYYY-MM-DD
    const entry = dailyMap.get(day) ?? { impressions: 0, clicks: 0, uniqueUsers: 0 };
    if (e.event_type === "impression") entry.impressions += count;
    else if (e.event_type === "click") entry.clicks += count;
    else if (e.event_type === "unique_user") entry.uniqueUsers += count;
    dailyMap.set(day, entry);

    // Breakdowns are impression-weighted.
    if (e.event_type === "impression") {
      const g = e.game_name || "Unattributed";
      const l = e.location_name || "Unattributed";
      gameMap.set(g, (gameMap.get(g) ?? 0) + count);
      locationMap.set(l, (locationMap.get(l) ?? 0) + count);
    }
  }

  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const byGame = [...gameMap.entries()]
    .map(([game, impressions]) => ({ game, impressions }))
    .sort((a, b) => b.impressions - a.impressions);

  const byLocation = [...locationMap.entries()]
    .map(([location, impressions]) => ({ location, impressions }))
    .sort((a, b) => b.impressions - a.impressions);

  return {
    impressions,
    clicks,
    uniqueUsers,
    ctr: impressions > 0 ? clicks / impressions : 0,
    daily,
    byGame,
    byLocation,
  };
}
