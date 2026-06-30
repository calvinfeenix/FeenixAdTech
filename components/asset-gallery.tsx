"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Trash2,
  X,
  Music,
  Play,
  Loader2,
  Images,
  UploadCloud,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/toast";
import EmptyState from "@/components/empty-state";
import Badge from "@/components/badge";
import AssetUploader from "@/components/asset-uploader";
import {
  assetTypeColors,
  formatBytes,
  formatDate,
  formatDuration,
  robloxStatusColors,
  robloxStatusLabels,
} from "@/lib/utils";
import { publishAssetToRoblox, refreshRobloxStatus, setRobloxAssetIdManually } from "@/app/(app)/assets/actions";
import type { Asset, AssetType, RobloxStatus } from "@/lib/types";

const DOT_COLOR: Partial<Record<RobloxStatus, string>> = {
  approved: "bg-emerald-400",
  reviewing: "bg-amber-400",
  processing: "bg-sky-400",
  rejected: "bg-red-400",
  failed: "bg-red-400",
};

const TYPES: (AssetType | "all")[] = ["all", "image", "video"];

export default function AssetGallery({
  assets,
  isAdmin,
}: {
  assets: Asset[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [showUploader, setShowUploader] = useState(false);
  const [inspect, setInspect] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [robloxBusy, setRobloxBusy] = useState(false);
  const [waitMsg, setWaitMsg] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");

  // Esc closes the inspect modal (safety net so it's never un-closable).
  useEffect(() => {
    if (!inspect) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setInspect(null);
        setWaitMsg(null);
        setManualId("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (filter !== "all" && a.type !== filter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.original_filename.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [assets, query, filter]);

  async function handleDelete(asset: Asset) {
    if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      toast("Asset deleted", "success");
      setInspect(null);
      router.refresh();
    } catch (err) {
      toast(String((err as Error).message), "error");
    } finally {
      setDeleting(false);
    }
  }

  const RESOLVED: RobloxStatus[] = ["approved", "rejected", "failed"];

  async function onPublish(a: Asset) {
    setRobloxBusy(true);
    setWaitMsg("Submitting to Roblox…");
    const res = await publishAssetToRoblox(a.id);
    if (res.error) {
      setRobloxBusy(false);
      setWaitMsg(null);
      setInspect((p) => (p ? { ...p, roblox_status: "failed", roblox_error: res.error! } : p));
      return toast(res.error, "error");
    }

    let status = res.status!;
    setInspect((p) =>
      p ? { ...p, roblox_status: status, roblox_error: null, roblox_asset_id: res.robloxAssetId ?? p.roblox_asset_id } : p
    );

    // Smart wait: poll moderation for up to 30s so a fast Approve/Reject shows
    // instantly. If it's still under review after 30s, tell the admin to come
    // back rather than spinning forever.
    setWaitMsg("Please wait — Roblox is moderating this asset…");
    const start = Date.now();
    while (!RESOLVED.includes(status) && Date.now() - start < 30_000) {
      await new Promise((r) => setTimeout(r, 3000));
      const r2 = await refreshRobloxStatus(a.id);
      if (r2.error || !r2.status) break;
      status = r2.status;
      setInspect((p) =>
        p ? { ...p, roblox_status: status, roblox_asset_id: r2.robloxAssetId ?? p.roblox_asset_id } : p
      );
    }

    setRobloxBusy(false);
    if (RESOLVED.includes(status)) {
      setWaitMsg(null);
      toast(
        `Roblox: ${robloxStatusLabels[status]}`,
        status === "approved" ? "success" : status === "rejected" ? "error" : "info"
      );
    } else {
      setWaitMsg("Still in review on Roblox — come back in a few minutes and hit Re-check.");
      toast("Submitted — still under review on Roblox.", "info");
    }
    router.refresh();
  }

  async function onRefresh(a: Asset) {
    setRobloxBusy(true);
    const res = await refreshRobloxStatus(a.id);
    setRobloxBusy(false);
    if (res.error) return toast(res.error, "error");
    toast(`Status: ${robloxStatusLabels[res.status!]}`, res.status === "rejected" ? "error" : "success");
    setInspect((p) =>
      p ? { ...p, roblox_status: res.status!, roblox_asset_id: res.robloxAssetId ?? p.roblox_asset_id } : p
    );
    router.refresh();
  }

  async function onSetManualId(a: Asset) {
    const id = Number(manualId.trim());
    if (!Number.isInteger(id) || id <= 0) return toast("Enter a valid numeric Roblox asset ID.", "error");
    setRobloxBusy(true);
    const res = await setRobloxAssetIdManually(a.id, id);
    setRobloxBusy(false);
    if (res.error) return toast(res.error, "error");
    toast("Roblox asset ID set — approved", "success");
    setManualId("");
    setInspect((p) => (p ? { ...p, roblox_status: "approved", roblox_asset_id: id, roblox_error: null } : p));
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === t
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUploader(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95"
          >
            <Plus size={16} /> Upload
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No assets found"
          description={
            assets.length === 0
              ? isAdmin
                ? "Upload your first creative to build the repository."
                : "No assets have been uploaded yet."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                if (isAdmin) {
                  setWaitMsg(null);
                  setManualId("");
                  setInspect(a);
                }
              }}
              className={`card-glow group text-left bg-card border border-border rounded-xl overflow-hidden transition-colors ${
                isAdmin ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="relative aspect-square bg-surface flex items-center justify-center overflow-hidden">
                {a.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.thumb_url}
                    alt={a.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                ) : a.type === "audio" ? (
                  <Music size={32} className="text-muted" />
                ) : (
                  <Play size={32} className="text-muted" />
                )}
                {a.type !== "image" && (
                  <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                    {formatDuration(a.duration_seconds)}
                  </span>
                )}
                {DOT_COLOR[a.roblox_status] && (
                  <span
                    title={`Roblox: ${robloxStatusLabels[a.roblox_status]}`}
                    className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ring-2 ring-black/50 ${DOT_COLOR[a.roblox_status]}`}
                  />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <Badge className={assetTypeColors[a.type]}>{a.type}</Badge>
                  <span className="text-[11px] text-muted">{formatBytes(a.optimized_size_bytes ?? a.size_bytes)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showUploader && <AssetUploader onClose={() => setShowUploader(false)} />}

      {/* Inspect modal (admin only) */}
      {inspect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setInspect(null);
            setWaitMsg(null);
          }}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h3 className="font-display font-semibold text-foreground truncate">{inspect.title}</h3>
              <button onClick={() => setInspect(null)} className="text-muted hover:text-foreground" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-auto flex-1 min-h-0">
              <div className="rounded-xl overflow-hidden bg-surface flex items-center justify-center">
                {inspect.type === "image" && inspect.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={inspect.url} alt={inspect.title} className="max-h-[40vh] w-auto" />
                )}
                {inspect.type === "video" && inspect.url && (
                  <video src={inspect.url} controls className="max-h-[40vh] w-full" />
                )}
                {inspect.type === "audio" && inspect.url && (
                  <audio src={inspect.url} controls className="w-full m-6" />
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 mt-5 text-sm">
                <Meta label="Type" value={inspect.type} />
                <Meta label="Original" value={inspect.original_filename} />
                <Meta label="Original size" value={formatBytes(inspect.size_bytes)} />
                <Meta label="Optimized" value={formatBytes(inspect.optimized_size_bytes)} />
                {inspect.width && (
                  <Meta label="Dimensions" value={`${inspect.width} × ${inspect.height}`} />
                )}
                {inspect.duration_seconds != null && (
                  <Meta label="Duration" value={formatDuration(inspect.duration_seconds)} />
                )}
                <Meta label="Uploaded" value={formatDate(inspect.created_at)} />
                <Meta label="Tags" value={inspect.tags.length ? inspect.tags.join(", ") : "—"} />
              </dl>

              {/* Roblox publishing */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Roblox</span>
                  <Badge className={robloxStatusColors[inspect.roblox_status]}>
                    {robloxStatusLabels[inspect.roblox_status]}
                  </Badge>
                </div>
                {inspect.roblox_asset_id && (
                  <a
                    href={`https://create.roblox.com/store/asset/${inspect.roblox_asset_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-2"
                  >
                    Asset ID {inspect.roblox_asset_id} <ExternalLink size={12} />
                  </a>
                )}
                {inspect.roblox_error && (
                  <p className="text-xs text-danger mt-2">{inspect.roblox_error}</p>
                )}
                {robloxBusy && waitMsg && (
                  <p className="flex items-center gap-2 text-xs text-accent mt-2">
                    <Loader2 size={12} className="animate-spin" /> {waitMsg}
                  </p>
                )}
                {!robloxBusy && waitMsg && (
                  <p className="text-xs text-amber-400 mt-2">{waitMsg}</p>
                )}
                {inspect.type === "video" && (
                  <p className="text-xs text-muted mt-2">
                    Video publishes via Open Cloud (needs a 13+ ID-verified creator account; .mp4/.mov,
                    ≤5 min) and plays on VideoFrames. Or upload it on Roblox and paste its asset ID below.
                  </p>
                )}
                {/* Manual Roblox asset ID — Image (Texture) ID for images, asset ID for video */}
                <div className="flex items-center gap-2 mt-3">
                  <input
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder={inspect.type === "video" ? "Roblox video asset ID" : "Roblox Texture ID (Copy Texture ID)"}
                    inputMode="numeric"
                    className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={() => onSetManualId(inspect)}
                    disabled={robloxBusy}
                    className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-muted-strong hover:text-foreground hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    Set ID
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
              <div className="flex items-center gap-2">
                {["not_published", "failed", "rejected"].includes(inspect.roblox_status) && (
                  <button
                    onClick={() => onPublish(inspect)}
                    disabled={robloxBusy}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95 disabled:opacity-50"
                  >
                    {robloxBusy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {inspect.roblox_status === "not_published" ? "Publish to Roblox" : "Retry publish"}
                  </button>
                )}
                {["processing", "reviewing", "uploading"].includes(inspect.roblox_status) && (
                  <button
                    onClick={() => onRefresh(inspect)}
                    disabled={robloxBusy}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/5 text-muted-strong hover:text-foreground hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    {robloxBusy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    Re-check status
                  </button>
                )}
                {inspect.roblox_status === "approved" && (
                  <button
                    onClick={() => onRefresh(inspect)}
                    disabled={robloxBusy}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {robloxBusy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Re-check
                  </button>
                )}
              </div>
              <button
                onClick={() => handleDelete(inspect)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-danger/15 text-danger hover:bg-danger/25 font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete asset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="text-foreground truncate">{value}</dd>
    </div>
  );
}
