"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Search, Music, Play, Check } from "lucide-react";
import { useToast } from "@/components/toast";
import { initials } from "@/lib/utils";
import {
  createCampaign,
  updateCampaign,
  type CampaignInput,
  type CreativeAction,
} from "@/app/(app)/campaigns/actions";
import type { Asset, CampaignStatus, Game, Profile } from "@/lib/types";

const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "completed"];

export interface CampaignFormInitial {
  id: string;
  name: string;
  status: CampaignStatus;
  flight_start: string | null;
  flight_end: string | null;
  userIds: string[];
  assetIds: string[];
  gameIds: string[];
  locationIds: string[];
  actions?: Record<string, CreativeAction>;
}

export default function CampaignForm({
  users,
  assets,
  games,
  initial,
}: {
  users: Profile[];
  assets: Asset[];
  games: Game[];
  initial?: CampaignFormInitial;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initial?.name ?? "");
  const [status, setStatus] = useState<CampaignStatus>(initial?.status ?? "draft");
  const [flightStart, setFlightStart] = useState(initial?.flight_start ?? "");
  const [flightEnd, setFlightEnd] = useState(initial?.flight_end ?? "");
  const [userIds, setUserIds] = useState<Set<string>>(new Set(initial?.userIds ?? []));
  const [assetIds, setAssetIds] = useState<Set<string>>(new Set(initial?.assetIds ?? []));
  const [locationIds, setLocationIds] = useState<Set<string>>(new Set(initial?.locationIds ?? []));
  const [gameIds, setGameIds] = useState<Set<string>>(new Set(initial?.gameIds ?? []));
  const [actions, setActions] = useState<Record<string, CreativeAction>>(initial?.actions ?? {});
  const [userQuery, setUserQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedAssets = useMemo(
    () => assets.filter((a) => assetIds.has(a.id)),
    [assets, assetIds]
  );

  function toggleAction(assetId: string) {
    setActions((prev) => {
      const next = { ...prev };
      if (next[assetId]) delete next[assetId];
      else next[assetId] = { actionText: "Interact", maxDistance: 20, holdDuration: 0 };
      return next;
    });
  }

  function patchAction(assetId: string, patch: Partial<CreativeAction>) {
    setActions((prev) => ({ ...prev, [assetId]: { ...prev[assetId], ...patch } }));
  }

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.username.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  // Toggling a location keeps its parent game selected automatically.
  function toggleLocation(gameId: string, locId: string) {
    const nextLoc = new Set(locationIds);
    if (nextLoc.has(locId)) nextLoc.delete(locId);
    else nextLoc.add(locId);
    setLocationIds(nextLoc);
    if (nextLoc.has(locId)) setGameIds(new Set(gameIds).add(gameId));
  }

  async function submit() {
    setSaving(true);
    const input: CampaignInput = {
      name,
      status,
      flight_start: flightStart || null,
      flight_end: flightEnd || null,
      userIds: [...userIds],
      assetIds: [...assetIds],
      gameIds: [...gameIds],
      locationIds: [...locationIds],
      // Only keep actions for assets still selected.
      actions: Object.fromEntries(
        Object.entries(actions).filter(([assetId]) => assetIds.has(assetId))
      ),
    };
    const res = initial ? await updateCampaign(initial.id, input) : await createCampaign(input);
    setSaving(false);
    if (res.error) return toast(res.error, "error");
    toast(initial ? "Campaign updated" : "Campaign created", "success");
    router.push(`/campaigns/${res.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Basics */}
      <Section title="Campaign details">
        <label className="block">
          <span className="text-sm font-medium text-muted-strong">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer Sneaker Drop"
            className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
        </label>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <label className="block">
            <span className="text-sm font-medium text-muted-strong">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CampaignStatus)}
              className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none capitalize"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="bg-card capitalize">
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-muted-strong">Flight start</span>
            <input
              type="date"
              value={flightStart}
              onChange={(e) => setFlightStart(e.target.value)}
              className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-muted-strong">Flight end</span>
            <input
              type="date"
              value={flightEnd}
              onChange={(e) => setFlightEnd(e.target.value)}
              className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </label>
        </div>
      </Section>

      {/* Users */}
      <Section title={`Viewer access (${userIds.size})`} subtitle="Users who can view this campaign and its analytics.">
        <div className="relative mb-3 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Search users…"
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
          {filteredUsers.map((u) => {
            const on = userIds.has(u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggle(userIds, setUserIds, u.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                  on ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <span className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials(u.full_name || u.username)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-foreground truncate">{u.full_name || u.username}</span>
                  <span className="block text-xs text-muted truncate">@{u.username}</span>
                </span>
                {on && <Check size={16} className="text-accent ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Assets */}
      <Section title={`Creatives to serve (${assetIds.size})`} subtitle="Assets delivered as part of this campaign.">
        {assets.length === 0 ? (
          <p className="text-sm text-muted">No assets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-64 overflow-auto pr-1">
            {assets.map((a) => {
              const on = assetIds.has(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(assetIds, setAssetIds, a.id)}
                  className={`relative rounded-lg overflow-hidden border aspect-square bg-surface flex items-center justify-center transition-colors ${
                    on ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-border-strong"
                  }`}
                  title={a.title}
                >
                  {a.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.thumb_url} alt={a.title} className="w-full h-full object-cover" />
                  ) : a.type === "audio" ? (
                    <Music size={22} className="text-muted" />
                  ) : (
                    <Play size={22} className="text-muted" />
                  )}
                  {on && (
                    <span className="absolute top-1 right-1 bg-accent text-white rounded-full p-0.5">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* Interactive actions (per selected creative) */}
      {selectedAssets.length > 0 && (
        <Section
          title="Interactive actions"
          subtitle="Optionally make a creative clickable in-game. The Roblox handler shows a proximity prompt; an interaction counts as a click (CTR)."
        >
          <div className="space-y-2">
            {selectedAssets.map((a) => {
              const action = actions[a.id];
              return (
                <div key={a.id} className="bg-surface border border-border rounded-lg px-3 py-2.5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!action}
                      onChange={() => toggleAction(a.id)}
                      className="accent-[var(--accent)] w-4 h-4"
                    />
                    <span className="text-sm text-foreground">{a.title}</span>
                    <span className="text-xs text-muted ml-auto">
                      {action ? "Clickable" : "Passive"}
                    </span>
                  </label>
                  {action && (
                    <div className="grid sm:grid-cols-3 gap-3 mt-3 pl-7">
                      <label className="block">
                        <span className="text-xs text-muted">Action text</span>
                        <input
                          value={action.actionText}
                          onChange={(e) => patchAction(a.id, { actionText: e.target.value })}
                          placeholder="Interact"
                          className="mt-1 w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-muted">Max distance (studs)</span>
                        <input
                          type="number"
                          value={action.maxDistance}
                          onChange={(e) => patchAction(a.id, { maxDistance: Number(e.target.value) })}
                          className="mt-1 w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-muted">Hold time (s)</span>
                        <input
                          type="number"
                          step="0.1"
                          value={action.holdDuration}
                          onChange={(e) => patchAction(a.id, { holdDuration: Number(e.target.value) })}
                          className="mt-1 w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Games + locations */}
      <Section
        title={`Games & locations (${gameIds.size} games, ${locationIds.size} locations)`}
        subtitle="Pick the games and the specific in-game ad locations to target."
      >
        {games.length === 0 ? (
          <p className="text-sm text-muted">No games in inventory yet.</p>
        ) : (
          <div className="space-y-3">
            {games.map((g) => {
              const gameOn = gameIds.has(g.id);
              return (
                <div key={g.id} className="border border-border rounded-lg bg-surface">
                  <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gameOn}
                      onChange={() => {
                        toggle(gameIds, setGameIds, g.id);
                        // Deselecting a game clears its locations too.
                        if (gameOn) {
                          const next = new Set(locationIds);
                          g.locations?.forEach((l) => next.delete(l.id));
                          setLocationIds(next);
                        }
                      }}
                      className="accent-[var(--accent)] w-4 h-4"
                    />
                    <span className="text-sm font-medium text-foreground">{g.name}</span>
                    <span className="text-xs text-muted ml-auto">{g.locations?.length ?? 0} locations</span>
                  </label>
                  {gameOn && (g.locations?.length ?? 0) > 0 && (
                    <div className="px-3 pb-3 pl-10 flex flex-wrap gap-2">
                      {g.locations!.map((loc) => {
                        const locOn = locationIds.has(loc.id);
                        return (
                          <button
                            key={loc.id}
                            onClick={() => toggleLocation(g.id, loc.id)}
                            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                              locOn
                                ? "border-accent bg-accent-soft text-accent"
                                : "border-border text-muted-strong hover:text-foreground"
                            }`}
                          >
                            {loc.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg text-sm text-muted-strong hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {initial ? "Save changes" : "Create campaign"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="text-xs text-muted mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}
