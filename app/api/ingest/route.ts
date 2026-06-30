import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import type { AnalyticsEventType } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Analytics ingestion endpoint for Roblox game servers (STUB — wire your game
 * code to POST here once the in-experience SDK is ready).
 *
 *   POST /api/ingest
 *   Header:  x-api-key: <INGEST_API_KEY>
 *   Body (JSON):
 *     {
 *       "events": [
 *         { "campaign_id": "uuid", "game_id": "uuid?", "location_id": "uuid?",
 *           "event_type": "impression" | "click" | "unique_user",
 *           "count": 1, "ts": "2026-06-03T12:00:00Z?" }
 *       ]
 *     }
 *
 * Writes go through the service role (bypassing RLS) after the shared-secret
 * check, since game servers are not authenticated Supabase users.
 */
const VALID_TYPES: AnalyticsEventType[] = ["impression", "click", "unique_user"];

interface IncomingEvent {
  campaign_id?: string;
  game_id?: string | null;
  location_id?: string | null;
  event_type?: string;
  count?: number;
  ts?: string;
  /** ISO 3166-1 alpha-2 region code (e.g. "US"). Optional — older SDKs omit it. */
  country?: string | null;
}

/** Keep only a plausible 2-letter region code; everything else becomes null. */
function normalizeCountry(c: unknown): string | null {
  if (typeof c !== "string") return null;
  const up = c.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(up) ? up : null;
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!process.env.INGEST_API_KEY || apiKey !== process.env.INGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw: IncomingEvent[] = Array.isArray((body as { events?: unknown })?.events)
    ? ((body as { events: IncomingEvent[] }).events)
    : [body as IncomingEvent];

  const rows = [];
  for (const e of raw) {
    if (!e.campaign_id || typeof e.campaign_id !== "string")
      return NextResponse.json({ error: "Each event needs a campaign_id" }, { status: 400 });
    if (!e.event_type || !VALID_TYPES.includes(e.event_type as AnalyticsEventType))
      return NextResponse.json(
        { error: `event_type must be one of ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    const country = normalizeCountry(e.country);
    rows.push({
      campaign_id: e.campaign_id,
      game_id: e.game_id ?? null,
      location_id: e.location_id ?? null,
      event_type: e.event_type,
      count: Number.isFinite(e.count) ? Math.max(1, Math.floor(e.count as number)) : 1,
      // Only attach country when we actually have one, so events keep ingesting
      // even before the `country` column migration has run.
      ...(country ? { country } : {}),
      ...(e.ts ? { ts: e.ts } : {}),
    });
  }

  if (rows.length === 0) return NextResponse.json({ error: "No events" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("analytics_events").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ingested: rows.length });
}
