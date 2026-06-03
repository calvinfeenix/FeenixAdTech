// ─────────────────────────────────────────────────────────────────────────
// Shared domain types — mirror the Postgres schema in scripts/schema.sql.
// ─────────────────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string; // = auth.users.id
  created_at: string;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
}

export type AssetType = "image" | "video" | "audio";

export interface Asset {
  id: string;
  created_at: string;
  uploaded_by: string | null;
  type: AssetType;
  title: string;
  original_filename: string;
  storage_path: string;
  thumb_path: string | null;
  mime: string;
  size_bytes: number;
  optimized_size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  tags: string[];
  // Populated at read time (signed/public URLs), not stored in the table.
  url?: string;
  thumb_url?: string;
}

export type GameStatus = "active" | "inactive";

export interface Game {
  id: string;
  created_at: string;
  name: string;
  roblox_universe_id: string | null;
  roblox_place_id: string | null;
  description: string | null;
  thumbnail_url: string | null;
  status: GameStatus;
  locations?: GameLocation[];
}

export interface GameLocation {
  id: string;
  created_at: string;
  game_id: string;
  name: string;
  external_ref: string | null;
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface Campaign {
  id: string;
  created_at: string;
  name: string;
  status: CampaignStatus;
  flight_start: string | null;
  flight_end: string | null;
  created_by: string | null;
  // Optional populated relations
  assets?: Asset[];
  games?: Game[];
  locations?: GameLocation[];
  users?: Profile[];
}

// Roblox reports three event kinds: an impression (ad shown), a click
// (interaction), and a unique_user beacon (one per distinct player per day).
export type AnalyticsEventType = "impression" | "click" | "unique_user";

export interface AnalyticsEvent {
  id: string;
  campaign_id: string;
  game_id: string | null;
  location_id: string | null;
  event_type: AnalyticsEventType;
  count: number;
  ts: string;
}

export interface CampaignAnalyticsSummary {
  impressions: number;
  clicks: number;
  uniqueUsers: number;
  ctr: number; // clicks / impressions
  daily: { date: string; impressions: number; clicks: number; uniqueUsers: number }[];
  byGame: { game: string; impressions: number }[];
  byLocation: { location: string; impressions: number }[];
}
