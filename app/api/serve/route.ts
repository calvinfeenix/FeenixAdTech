import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * Ad-serving endpoint for Roblox game servers.
 *
 *   GET /api/serve?game=<robloxPlaceId>[&placement=<locationExternalRef>]
 *   Header: x-api-key: <INGEST_API_KEY>
 *
 * Returns the creatives to show in a game right now. A creative is served ONLY
 * when ALL of these hold (mirrors the old platform's resolution rules):
 *   - its campaign.status = 'active'
 *   - today is within the campaign flight window (flight_start..flight_end)
 *   - the campaign targets this game (campaign_games) and the location
 *     (campaign_locations)
 *   - the asset is published & approved on Roblox (roblox_status='approved'
 *     with a roblox_asset_id)
 *
 * Response groups creatives by placement (in-game ad location) and includes the
 * campaign/game/location IDs so the game can attribute analytics back to
 * /api/ingest. 204 when there's nothing active to serve.
 *
 * Uses the service role (trusted server-to-server; the game server holds the
 * shared key), so it is not subject to RLS.
 */
export async function GET(request: Request) {
  if (!process.env.INGEST_API_KEY || request.headers.get("x-api-key") !== process.env.INGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const gameParam = searchParams.get("game");
  const placement = searchParams.get("placement");
  if (!gameParam) return NextResponse.json({ error: "Missing ?game=<robloxPlaceId>" }, { status: 400 });

  const admin = createAdminClient();

  // Resolve the game by its Roblox place id, or by our UUID if the param is one.
  // (Comparing the uuid `id` column to a non-uuid string would error, so we only
  // try the id match when the param actually looks like a uuid.)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameParam);
  const col = isUuid ? "id" : "roblox_place_id";
  const { data: game } = await admin
    .from("games")
    .select("id, name, roblox_place_id, status")
    .eq(col, gameParam)
    .maybeSingle();
  if (!game || game.status !== "active") return new NextResponse(null, { status: 204 });

  const today = new Date().toISOString().slice(0, 10);

  // Active campaigns (in flight) that target this game.
  const { data: cgRows } = await admin
    .from("campaign_games")
    .select("campaigns!inner(id, name, status, flight_start, flight_end)")
    .eq("game_id", game.id);

  type C = { id: string; name: string; status: string; flight_start: string | null; flight_end: string | null };
  const activeCampaigns = ((cgRows ?? []) as unknown as { campaigns: C }[])
    .map((r) => r.campaigns)
    .filter(
      (c) =>
        c.status === "active" &&
        (!c.flight_start || c.flight_start <= today) &&
        (!c.flight_end || c.flight_end >= today)
    );
  const campaignIds = activeCampaigns.map((c) => c.id);
  if (campaignIds.length === 0) return new NextResponse(null, { status: 204 });
  const campaignName = new Map(activeCampaigns.map((c) => [c.id, c.name]));

  // This game's locations (optionally narrowed to a single placement).
  let locQuery = admin.from("game_locations").select("id, name, external_ref").eq("game_id", game.id);
  if (placement) locQuery = locQuery.eq("external_ref", placement);
  const { data: locations } = await locQuery;
  if (!locations?.length) return new NextResponse(null, { status: 204 });
  const locIds = new Set(locations.map((l) => l.id));

  // Approved, Roblox-ready creatives for those campaigns.
  const { data: caRows } = await admin
    .from("campaign_assets")
    .select("campaign_id, assets!inner(id, title, type, roblox_asset_id, roblox_status)")
    .in("campaign_id", campaignIds)
    .eq("assets.roblox_status", "approved");
  type A = { id: string; title: string; type: string; roblox_asset_id: number | null; roblox_status: string };
  const creativesByCampaign = new Map<string, A[]>();
  for (const r of (caRows ?? []) as unknown as { campaign_id: string; assets: A }[]) {
    if (!r.assets?.roblox_asset_id) continue;
    const arr = creativesByCampaign.get(r.campaign_id) ?? [];
    arr.push(r.assets);
    creativesByCampaign.set(r.campaign_id, arr);
  }

  // Which campaigns target which of this game's locations.
  const { data: clRows } = await admin
    .from("campaign_locations")
    .select("campaign_id, game_location_id")
    .in("campaign_id", campaignIds);

  const placements = locations
    .map((loc) => {
      const seen = new Set<string>();
      const creatives: object[] = [];
      for (const cl of (clRows ?? []) as { campaign_id: string; game_location_id: string }[]) {
        if (cl.game_location_id !== loc.id) continue;
        if (!locIds.has(loc.id)) continue;
        for (const a of creativesByCampaign.get(cl.campaign_id) ?? []) {
          const key = `${cl.campaign_id}:${a.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          creatives.push({
            assetId: a.id,
            robloxAssetId: a.roblox_asset_id,
            type: a.type,
            title: a.title,
            campaignId: cl.campaign_id,
            campaignName: campaignName.get(cl.campaign_id),
          });
        }
      }
      return { locationId: loc.id, name: loc.name, externalRef: loc.external_ref, creatives };
    })
    .filter((p) => p.creatives.length > 0);

  if (placements.length === 0) return new NextResponse(null, { status: 204 });

  return NextResponse.json({
    game: { id: game.id, name: game.name, robloxPlaceId: game.roblox_place_id },
    servedAt: new Date().toISOString(),
    cacheTtlSeconds: 30,
    placements,
  });
}
