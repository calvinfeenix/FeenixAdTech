import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import GameManager from "@/components/game-manager";
import type { Game } from "@/lib/types";

export default async function GamesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("games")
    .select("*, locations:game_locations(*)")
    .order("created_at", { ascending: false });

  const games = (data ?? []) as Game[];

  return (
    <div className="space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Games Inventory</h1>
        <p className="text-muted text-sm mt-1">
          Roblox experiences where Feenix can serve ads, and the individual ad locations within them.
        </p>
      </div>
      <GameManager games={games} />
    </div>
  );
}
