/**
 * Minimal, typed Roblox Open Cloud Assets client. SERVER ONLY.
 *
 * Covers exactly what Feenix needs: upload an image/audio asset under a user
 * creator, poll the resulting long-running operation, and re-check moderation
 * state independently of upload completion (the key fix for status desync).
 *
 * Docs: https://create.roblox.com/docs/cloud/reference/Asset
 */
const BASE = "https://apis.roblox.com";

export type RobloxAssetType = "Decal" | "Audio" | "Video";

/** A typed failure we can branch on / surface to the admin. */
export class RobloxError extends Error {
  code: "INVALID_KEY" | "ID_VERIFICATION_REQUIRED" | "FORBIDDEN" | "RATE_LIMITED" | "UNREACHABLE" | "BAD_RESPONSE";
  constructor(code: RobloxError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "RobloxError";
  }
}

/** Normalized moderation/operation outcome. */
export interface RobloxOutcome {
  done: boolean;
  operationId?: string;
  assetId?: number;
  /** "reviewing" | "approved" | "rejected" (lowercased) once known. */
  moderationState?: string;
}

// ── LRO envelope shapes (only the fields we read) ────────────────────────
interface LroEnvelope {
  path?: string;
  done?: boolean;
  error?: { code?: string; message?: string };
  response?: {
    assetId?: string | number;
    path?: string;
    moderationResult?: { moderationState?: string };
  };
}

function operationIdFromPath(path?: string): string | undefined {
  if (!path?.startsWith("operations/")) return undefined;
  const id = path.slice("operations/".length).trim();
  return id || undefined;
}

function assetIdFromEnvelope(env: LroEnvelope): number | undefined {
  const field = env.response?.assetId;
  if (field != null && Number(field) > 0) return Number(field);
  const p = env.response?.path;
  if (p?.startsWith("assets/")) {
    const n = Number(p.slice("assets/".length).split("/")[0]);
    if (n > 0) return n;
  }
  return undefined;
}

function envelopeToOutcome(env: LroEnvelope): RobloxOutcome {
  if (!env.done) return { done: false, operationId: operationIdFromPath(env.path) };
  const moderationState = env.response?.moderationResult?.moderationState?.toLowerCase();
  return {
    done: true,
    operationId: operationIdFromPath(env.path),
    assetId: assetIdFromEnvelope(env),
    moderationState,
  };
}

/** Translate a non-2xx Open Cloud response into a typed RobloxError. */
async function raiseForStatus(res: Response): Promise<never> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }
  if (res.status === 401)
    throw new RobloxError("INVALID_KEY", "Roblox API key is invalid or expired — update it in Settings.");
  if (res.status === 403) {
    if (/IdVerification|verify/i.test(body))
      throw new RobloxError(
        "ID_VERIFICATION_REQUIRED",
        "The Roblox creator account must complete ID verification before uploading assets (roblox.com → Settings → Account Info → Verify)."
      );
    throw new RobloxError("FORBIDDEN", `Roblox denied the request (check the key's asset permissions). ${body.slice(0, 200)}`);
  }
  if (res.status === 429) throw new RobloxError("RATE_LIMITED", "Roblox rate limit hit — try again shortly.");
  throw new RobloxError("UNREACHABLE", `Roblox returned ${res.status}. ${body.slice(0, 200)}`);
}

/**
 * Upload an asset. Returns the LRO outcome — either an operationId to poll, or
 * (rarely) an immediately-finished result.
 */
export async function uploadAsset(opts: {
  apiKey: string;
  assetType: RobloxAssetType;
  fileBytes: Buffer | Uint8Array;
  filename: string;
  contentType: string;
  displayName: string;
  description?: string;
  creatorUserId: number;
}): Promise<RobloxOutcome> {
  const request = JSON.stringify({
    assetType: opts.assetType,
    displayName: opts.displayName.slice(0, 50),
    description: (opts.description ?? "").slice(0, 1000),
    creationContext: { creator: { userId: opts.creatorUserId } },
  });

  const form = new FormData();
  form.append("request", request);
  // Cast to BlobPart: at runtime this is always a Node Buffer/Uint8Array backed
  // by a regular ArrayBuffer; TS's SharedArrayBuffer union is the only concern.
  form.append(
    "fileContent",
    new Blob([opts.fileBytes as unknown as BlobPart], { type: opts.contentType }),
    opts.filename
  );

  let res: Response;
  try {
    res = await fetch(`${BASE}/assets/v1/assets`, {
      method: "POST",
      headers: { "x-api-key": opts.apiKey },
      body: form,
    });
  } catch (e) {
    throw new RobloxError("UNREACHABLE", `Could not reach Roblox: ${(e as Error).message}`);
  }
  if (!res.ok) await raiseForStatus(res);

  const env = (await res.json().catch(() => null)) as LroEnvelope | null;
  if (!env) throw new RobloxError("BAD_RESPONSE", "Roblox returned an unreadable upload response.");
  return envelopeToOutcome(env);
}

/** Poll an in-flight operation by id. */
export async function pollOperation(apiKey: string, operationId: string): Promise<RobloxOutcome> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/assets/v1/operations/${operationId}`, {
      headers: { "x-api-key": apiKey },
    });
  } catch (e) {
    throw new RobloxError("UNREACHABLE", `Could not reach Roblox: ${(e as Error).message}`);
  }
  if (!res.ok) await raiseForStatus(res);
  const env = (await res.json().catch(() => null)) as LroEnvelope | null;
  if (!env) throw new RobloxError("BAD_RESPONSE", "Roblox returned an unreadable operation response.");
  return envelopeToOutcome(env);
}

/** Re-check moderation for an already-known asset id (the desync fix). */
export async function fetchModeration(apiKey: string, assetId: number): Promise<string | undefined> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/assets/v1/assets/${assetId}?readMask=moderationResult`, {
      headers: { "x-api-key": apiKey },
    });
  } catch (e) {
    throw new RobloxError("UNREACHABLE", `Could not reach Roblox: ${(e as Error).message}`);
  }
  if (!res.ok) await raiseForStatus(res);
  const data = (await res.json().catch(() => null)) as
    | { moderationResult?: { moderationState?: string } }
    | null;
  return data?.moderationResult?.moderationState?.toLowerCase();
}

/**
 * Lightweight key check for the Settings "Test" button. A valid key on an
 * unknown asset id returns 404 (not 401); an invalid/expired key returns 401.
 */
export async function validateKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${BASE}/assets/v1/assets/1?readMask=moderationResult`, {
      headers: { "x-api-key": apiKey },
    });
    if (res.status === 401) return { ok: false, message: "Key is invalid or expired." };
    if (res.status === 403) return { ok: false, message: "Key lacks asset permissions." };
    // 200/404/400 all imply the key authenticated.
    return { ok: true, message: "Key authenticated successfully." };
  } catch (e) {
    return { ok: false, message: `Could not reach Roblox: ${(e as Error).message}` };
  }
}

/**
 * Make an asset usable in ANY experience (any owner) — "Open Use" — via the
 * Open Cloud Asset Permissions API: grant the `All` subject the `Use` action.
 * `grantDependencies` cascades a Decal's grant to its underlying Image/texture,
 * so the texture an ImageLabel actually renders becomes public too.
 *
 * Note: Open Use is IRREVOCABLE (per Roblox). Re-granting an already-public
 * asset returns the `PublicAssetCannotBeGrantedTo` error, which we treat as OK.
 */
export async function grantOpenUse(apiKey: string, assetId: number): Promise<{ ok: boolean; message?: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/asset-permissions-api/v1/assets/permissions`, {
      method: "PATCH",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        subjectType: "All",
        subjectId: null,
        action: "Use",
        requests: [{ assetId, grantDependencies: true }],
      }),
    });
  } catch (e) {
    return { ok: false, message: `Could not reach Roblox: ${(e as Error).message}` };
  }
  if (!res.ok) return { ok: false, message: `Open Use grant returned HTTP ${res.status}.` };
  const data = (await res.json().catch(() => null)) as
    | { successAssetIds?: number[]; errors?: { assetId: number; code: string }[] }
    | null;
  if (data?.successAssetIds?.some((id) => Number(id) === assetId)) return { ok: true };
  const err = data?.errors?.find((e) => Number(e.assetId) === assetId);
  if (err?.code === "PublicAssetCannotBeGrantedTo") return { ok: true }; // already Open Use
  return { ok: false, message: err?.code ?? "Open Use grant failed." };
}

/** The asset's type ("Decal" | "Image" | "Audio" | …), or undefined. Used to
 *  catch the common mistake of pasting a Decal id where the Image id is needed. */
export async function fetchAssetType(apiKey: string, assetId: number): Promise<string | undefined> {
  try {
    const res = await fetch(`${BASE}/assets/v1/assets/${assetId}?readMask=assetType`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return undefined;
    const data = (await res.json().catch(() => null)) as { assetType?: string } | null;
    return data?.assetType;
  } catch {
    return undefined;
  }
}

/** Map an internal moderation/operation outcome to our asset roblox_status. */
export function outcomeToStatus(o: RobloxOutcome): "processing" | "reviewing" | "approved" | "rejected" {
  if (!o.done) return "processing";
  switch (o.moderationState) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    default:
      return "reviewing";
  }
}
