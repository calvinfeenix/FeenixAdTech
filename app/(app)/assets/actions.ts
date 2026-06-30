"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getRobloxConfig } from "@/lib/settings";
import { ASSET_BUCKET } from "@/lib/storage";
import {
  RobloxError,
  fetchAssetType,
  fetchModeration,
  grantOpenUse,
  outcomeToStatus,
  pollOperation,
  uploadAsset,
  type RobloxAssetType,
} from "@/lib/roblox";
import type { RobloxStatus } from "@/lib/types";

interface ActionResult {
  ok?: boolean;
  error?: string;
  status?: RobloxStatus;
  robloxAssetId?: number | null;
}

async function assertAdmin() {
  const p = await getSessionProfile();
  return p && p.role === "admin" && p.status === "approved" ? p : null;
}

async function persist(
  assetId: string,
  fields: {
    roblox_status: RobloxStatus;
    roblox_asset_id?: number | null;
    roblox_operation_id?: string | null;
    roblox_error?: string | null;
  }
) {
  const admin = createAdminClient();
  await admin
    .from("assets")
    .update({ ...fields, roblox_synced_at: new Date().toISOString() })
    .eq("id", assetId);
}

/**
 * Manually attach a Roblox asset ID (the **Image** id for images — "Copy Texture
 * ID" — or the asset id for video/audio) and mark the asset approved. Also makes
 * it Open Use so it renders in any experience. Rejects a Decal id with guidance,
 * since that's the common mistake that renders black (ImageLabel needs the Image).
 */
export async function setRobloxAssetIdManually(
  assetId: string,
  robloxAssetId: number
): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  if (!Number.isInteger(robloxAssetId) || robloxAssetId <= 0)
    return { error: "Enter a valid numeric Roblox asset ID." };

  const cfg = await getRobloxConfig();
  let note: string | null = null;
  if (cfg.apiKey) {
    const type = await fetchAssetType(cfg.apiKey, robloxAssetId);
    if (type === "Decal")
      return {
        error:
          "That's the Decal id — it won't render. Open the asset on Roblox, click \"Copy Texture ID\", and paste that Image id instead.",
      };
    // Make it usable in every experience (any owner). Best-effort.
    const grant = await grantOpenUse(cfg.apiKey, robloxAssetId);
    if (!grant.ok) note = `Saved, but couldn't auto-set Open Use (${grant.message}). Set it manually on Roblox if it won't load in other games.`;
  }

  await persist(assetId, {
    roblox_status: "approved",
    roblox_asset_id: robloxAssetId,
    roblox_operation_id: null,
    roblox_error: note,
  });
  return { ok: true, status: "approved", robloxAssetId };
}

/**
 * Publish a Feenix asset to Roblox via Open Cloud. Images are re-encoded to PNG
 * (Roblox Decals reject WebP) and made Open Use; video (.mp4/.mov) uploads as a
 * Video asset for VideoFrame playback (requires a 13+ ID-verified creator).
 * Errors are recorded on the row as `failed` + a human message for the UI.
 */
export async function publishAssetToRoblox(assetId: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };

  const { apiKey, creatorUserId } = await getRobloxConfig();
  if (!apiKey || !creatorUserId)
    return { error: "Set the Roblox API key and creator user ID in Settings first." };

  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("assets")
    .select("id, type, title, original_filename, storage_path, mime")
    .eq("id", assetId)
    .single();
  if (!asset) return { error: "Asset not found." };

  if (asset.type === "video" && !/(mp4|quicktime|mov)/i.test(asset.mime || asset.original_filename || ""))
    return { error: "Roblox only accepts .mp4 or .mov video. Re-upload this creative as MP4." };

  // Download the stored file.
  const dl = await admin.storage.from(ASSET_BUCKET).download(asset.storage_path);
  if (dl.error || !dl.data) return { error: `Could not read stored file: ${dl.error?.message}` };
  let bytes: Uint8Array = new Uint8Array(await dl.data.arrayBuffer());

  let robloxType: RobloxAssetType;
  let contentType: string;
  let filename: string;

  if (asset.type === "image") {
    // Roblox Decals require PNG/JPG — our optimized copy is WebP.
    bytes = await sharp(bytes).png().toBuffer();
    robloxType = "Decal";
    contentType = "image/png";
    filename = `${asset.id}.png`;
  } else if (asset.type === "video") {
    // Open Cloud accepts .mp4/.mov video (13+ ID-verified creators). Uploaded as
    // stored; the resulting asset id plays directly on a VideoFrame.
    robloxType = "Video";
    contentType = /quicktime|mov/i.test(asset.mime || "") ? "video/mov" : "video/mp4";
    filename = asset.original_filename || `${asset.id}.mp4`;
  } else {
    robloxType = "Audio";
    contentType = asset.mime || "audio/mpeg";
    filename = asset.original_filename || `${asset.id}.mp3`;
  }

  try {
    let outcome = await uploadAsset({
      apiKey,
      assetType: robloxType,
      fileBytes: bytes,
      filename,
      contentType,
      displayName: asset.title,
      description: "Uploaded via Feenix AdTech",
      creatorUserId,
    });

    // Try briefly to resolve the operation so the asset id / moderation appears
    // without making the admin click Re-check immediately.
    let tries = 0;
    while (!outcome.done && outcome.operationId && tries < 3) {
      await new Promise((r) => setTimeout(r, 1500));
      outcome = await pollOperation(apiKey, outcome.operationId);
      tries++;
    }

    const finalAssetId = outcome.assetId ?? null;
    const status = outcomeToStatus(outcome);

    // Make IMAGES usable in any experience (Open Use). Roblox doesn't allow the
    // "All" subject for video/audio, so we only grant it for decals/images.
    let note: string | null = null;
    if (finalAssetId && asset.type === "image") {
      const grant = await grantOpenUse(apiKey, finalAssetId);
      if (!grant.ok) note = `Couldn't auto-set Open Use (${grant.message}).`;
      // A Decal id can't be rendered by an ImageLabel — guide the admin to the Image id.
      note = `Published as a Decal and set to Open Use. To make it render in-game, open the asset on Roblox, click "Copy Texture ID", and paste that Image id below.${note ? " " + note : ""}`;
    }
    if (finalAssetId && asset.type === "video") {
      note = `Video uploaded to Roblox (asset ${finalAssetId}) — it plays directly on a VideoFrame. Roblox doesn't allow Open Use for video, so it's usable in experiences you own or explicitly grant access to.`;
    }

    await persist(assetId, {
      roblox_status: status,
      roblox_asset_id: finalAssetId,
      roblox_operation_id: outcome.done ? null : outcome.operationId ?? null,
      roblox_error: note,
    });
    revalidatePath("/assets");
    return { ok: true, status, robloxAssetId: finalAssetId };
  } catch (e) {
    const message = e instanceof RobloxError ? e.message : `Upload failed: ${(e as Error).message}`;
    await persist(assetId, { roblox_status: "failed", roblox_error: message });
    revalidatePath("/assets");
    return { error: message };
  }
}

/**
 * Re-query Roblox for the current state of an already-submitted asset. Polls the
 * operation while it's still processing, otherwise re-checks moderation. This is
 * what keeps Feenix in sync with Roblox's moderation truth.
 */
export async function refreshRobloxStatus(assetId: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { error: "Forbidden" };
  const { apiKey } = await getRobloxConfig();
  if (!apiKey) return { error: "Set the Roblox API key in Settings first." };

  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("assets")
    .select("id, roblox_status, roblox_asset_id, roblox_operation_id")
    .eq("id", assetId)
    .single();
  if (!asset) return { error: "Asset not found." };

  try {
    let outcome;
    if (!asset.roblox_asset_id && asset.roblox_operation_id) {
      outcome = await pollOperation(apiKey, asset.roblox_operation_id);
    } else if (asset.roblox_asset_id) {
      const moderationState = await fetchModeration(apiKey, asset.roblox_asset_id);
      outcome = { done: true, assetId: asset.roblox_asset_id, moderationState };
    } else {
      return { error: "Nothing to refresh — this asset hasn't been published yet." };
    }

    const status = outcomeToStatus(outcome);
    await persist(assetId, {
      roblox_status: status,
      roblox_asset_id: outcome.assetId ?? asset.roblox_asset_id,
      roblox_operation_id: outcome.done ? null : asset.roblox_operation_id,
      roblox_error: null,
    });
    revalidatePath("/assets");
    return { ok: true, status, robloxAssetId: outcome.assetId ?? asset.roblox_asset_id };
  } catch (e) {
    const message = e instanceof RobloxError ? e.message : `Refresh failed: ${(e as Error).message}`;
    if (e instanceof RobloxError && e.code === "INVALID_KEY") {
      await persist(assetId, { roblox_status: "failed", roblox_error: message });
    }
    revalidatePath("/assets");
    return { error: message };
  }
}
