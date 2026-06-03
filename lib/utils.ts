import type {
  AssetType,
  CampaignStatus,
  GameStatus,
  UserRole,
  UserStatus,
} from "./types";

/** Tailwind class pairs for status / type badges (dark theme friendly). */
export const campaignStatusColors: Record<CampaignStatus, string> = {
  draft: "bg-white/8 text-muted-strong",
  active: "bg-emerald-500/15 text-emerald-400",
  paused: "bg-amber-500/15 text-amber-400",
  completed: "bg-sky-500/15 text-sky-400",
};

export const userStatusColors: Record<UserStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-red-500/15 text-red-400",
};

export const roleColors: Record<UserRole, string> = {
  admin: "bg-accent-soft text-accent",
  user: "bg-white/8 text-muted-strong",
};

export const gameStatusColors: Record<GameStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  inactive: "bg-white/8 text-muted",
};

export const assetTypeColors: Record<AssetType, string> = {
  image: "bg-sky-500/15 text-sky-400",
  video: "bg-violet-500/15 text-violet-400",
  audio: "bg-pink-500/15 text-pink-400",
};

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Compact number for stat cards: 12345 -> "12.3K". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds && seconds !== 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Classify a MIME type into one of our asset buckets. */
export function assetTypeFromMime(mime: string): AssetType | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
