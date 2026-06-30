import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import { fetchGameIcons } from "@/lib/roblox-icons";
import GameManager from "@/components/game-manager";
import PageHero from "@/components/page-hero";
import type { Game } from "@/lib/types";

export default async function GamesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("games")
    .select("*, locations:game_locations(*)")
    .order("created_at", { ascending: false });

  const games = (data ?? []) as Game[];

  // Live Roblox icons for each game (by place id).
  const iconByPlace = await fetchGameIcons(games.map((g) => g.roblox_place_id));
  const icons: Record<string, string> = {};
  for (const g of games) {
    const url = g.roblox_place_id ? iconByPlace.get(String(g.roblox_place_id)) : undefined;
    if (url) icons[g.id] = url;
  }

  // Per-game impressions/clicks/unique (admin-only DEFINER RPC).
  const { data: statsData } = await supabase.rpc("games_analytics");
  const stats = (statsData ?? {}) as Record<string, { impressions: number; clicks: number; uniqueUsers: number }>;

  return (
    <div className="space-y-6 fade-up">
      <PageHero
        title="Games Inventory"
        subtitle="Roblox experiences where Feenix can serve ads, and the individual ad locations within them."
      />
      <GameManager games={games} icons={icons} stats={stats} />
    </div>
  );
}
