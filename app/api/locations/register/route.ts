import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/**
 * Auto-registration of ad locations reported by a Roblox game server on startup.
 *
 *   POST /api/locations/register
 *   Header: x-api-key: <INGEST_API_KEY>
 *   Body: { robloxPlaceId: number,
 *           placements: [ { externalRef, name, surfaceType?, path? } ] }
 *
 * The game (by Roblox place id) is upserted if unseen, then each placement is
 * inserted as a game_location keyed by (game_id, external_ref). Idempotent —
 * already-known locations are left untouched (so admin edits to names stick).
 * Uses the service role (trusted server-to-server via the shared key).
 */
interface Placement {
  externalRef?: string;
  name?: string;
  surfaceType?: string;
  path?: string;
}

export async function POST(request: Request) {
  if (!process.env.INGEST_API_KEY || request.headers.get("x-api-key") !== process.env.INGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { robloxPlaceId?: number | string; placements?: Placement[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const placeId = body.robloxPlaceId != null ? String(body.robloxPlaceId) : "";
  if (!placeId) return NextResponse.json({ error: "Missing robloxPlaceId" }, { status: 400 });

  const placements = (body.placements ?? []).filter(
    (p): p is Required<Pick<Placement, "externalRef">> & Placement =>
      typeof p?.externalRef === "string" && p.externalRef.length > 0
  );

  const admin = createAdminClient();

  // Find or create the game by its Roblox place id (keeps the flow zero-config;
  // admins can rename/deactivate auto-created games in the Games tab).
  let { data: game } = await admin
    .from("games")
    .select("id")
    .eq("roblox_place_id", placeId)
    .maybeSingle();

  if (!game) {
    const created = await admin
      .from("games")
      .insert({ name: `Roblox Place ${placeId}`, roblox_place_id: placeId, status: "active" })
      .select("id")
      .single();
    if (created.error || !created.data)
      return NextResponse.json({ error: created.error?.message ?? "Could not create game" }, { status: 500 });
    game = created.data;
  }

  if (placements.length === 0) return NextResponse.json({ registered: 0, gameId: game.id });

  // Insert new locations only; ignore ones we've already registered.
  const rows = placements.map((p) => ({
    game_id: game!.id,
    external_ref: p.externalRef,
    name: (p.name ?? p.externalRef).slice(0, 200),
  }));
  const { data, error } = await admin
    .from("game_locations")
    .upsert(rows, { onConflict: "game_id,external_ref", ignoreDuplicates: true })
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ registered: data?.length ?? 0, received: placements.length, gameId: game.id });
}
