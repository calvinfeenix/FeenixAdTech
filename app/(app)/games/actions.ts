"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";

interface ActionResult {
  ok?: boolean;
  error?: string;
}

async function assertAdmin() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "approved") return null;
  return profile;
}

export async function createGame(formData: FormData): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Game name is required." };

  const supabase = await createClient();
  const { data: game, error } = await supabase
    .from("games")
    .insert({
      name,
      roblox_universe_id: String(formData.get("roblox_universe_id") ?? "").trim() || null,
      roblox_place_id: String(formData.get("roblox_place_id") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      thumbnail_url: String(formData.get("thumbnail_url") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Optional newline-separated initial ad locations.
  const locationsRaw = String(formData.get("locations") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (locationsRaw.length && game) {
    await supabase
      .from("game_locations")
      .insert(locationsRaw.map((name) => ({ game_id: game.id, name })));
  }

  revalidatePath("/games");
  return { ok: true };
}

export async function addLocation(gameId: string, name: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  if (!name.trim()) return { error: "Location name is required." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_locations")
    .insert({ game_id: gameId, name: name.trim() });
  if (error) return { error: error.message };
  revalidatePath("/games");
  return { ok: true };
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("game_locations").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/games");
  return { ok: true };
}

export async function deleteGame(id: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/games");
  return { ok: true };
}
