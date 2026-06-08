"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase-server";
import type { CampaignStatus } from "@/lib/types";

export interface CreativeAction {
  actionText: string;
  maxDistance: number;
  holdDuration: number;
}

export interface CampaignInput {
  name: string;
  status: CampaignStatus;
  flight_start: string | null;
  flight_end: string | null;
  userIds: string[];
  assetIds: string[];
  gameIds: string[];
  locationIds: string[];
  /** Optional per-asset interaction; presence makes that creative clickable. */
  actions: Record<string, CreativeAction>;
}

interface ActionResult {
  ok?: boolean;
  error?: string;
  id?: string;
}

async function assertAdmin() {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "approved") return null;
  return profile;
}

/** Replace all assignment rows for a campaign with the provided selections. */
async function syncAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  input: CampaignInput
) {
  await Promise.all([
    supabase.from("campaign_users").delete().eq("campaign_id", campaignId),
    supabase.from("campaign_assets").delete().eq("campaign_id", campaignId),
    supabase.from("campaign_games").delete().eq("campaign_id", campaignId),
    supabase.from("campaign_locations").delete().eq("campaign_id", campaignId),
  ]);

  const inserts: Promise<unknown>[] = [];
  if (input.userIds.length)
    inserts.push(
      Promise.resolve(
        supabase
          .from("campaign_users")
          .insert(input.userIds.map((user_id) => ({ campaign_id: campaignId, user_id })))
      )
    );
  if (input.assetIds.length)
    inserts.push(
      Promise.resolve(
        supabase.from("campaign_assets").insert(
          input.assetIds.map((asset_id) => {
            const a = input.actions?.[asset_id];
            return {
              campaign_id: campaignId,
              asset_id,
              action_type: a ? "proximity" : null,
              action_text: a ? a.actionText || "Interact" : null,
              action_max_distance: a ? a.maxDistance : null,
              action_hold_duration: a ? a.holdDuration : null,
            };
          })
        )
      )
    );
  if (input.gameIds.length)
    inserts.push(
      Promise.resolve(
        supabase
          .from("campaign_games")
          .insert(input.gameIds.map((game_id) => ({ campaign_id: campaignId, game_id })))
      )
    );
  if (input.locationIds.length)
    inserts.push(
      Promise.resolve(
        supabase
          .from("campaign_locations")
          .insert(
            input.locationIds.map((game_location_id) => ({
              campaign_id: campaignId,
              game_location_id,
            }))
          )
      )
    );
  await Promise.all(inserts);
}

function validate(input: CampaignInput): string | null {
  if (!input.name.trim()) return "Campaign name is required.";
  if (input.flight_start && input.flight_end && input.flight_end < input.flight_start)
    return "Flight end must be after the start date.";
  return null;
}

export async function createCampaign(input: CampaignInput): Promise<ActionResult> {
  const admin = await assertAdmin();
  if (!admin) return { error: "Forbidden" };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name: input.name.trim(),
      status: input.status,
      flight_start: input.flight_start,
      flight_end: input.flight_end,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create campaign." };

  await syncAssignments(supabase, data.id, input);
  revalidatePath("/campaigns");
  return { ok: true, id: data.id };
}

export async function updateCampaign(id: string, input: CampaignInput): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      name: input.name.trim(),
      status: input.status,
      flight_start: input.flight_start,
      flight_end: input.flight_end,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await syncAssignments(supabase, id, input);
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${id}`);
  return { ok: true, id };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/campaigns");
  return { ok: true };
}
