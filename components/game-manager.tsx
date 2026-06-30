"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Loader2,
  MapPin,
  Trash2,
  Gamepad2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/toast";
import EmptyState from "@/components/empty-state";
import Badge from "@/components/badge";
import { gameStatusColors } from "@/lib/utils";
import { addLocation, createGame, deleteGame, deleteLocation } from "@/app/(app)/games/actions";
import type { Game } from "@/lib/types";

export default function GameManager({
  games,
  icons = {},
}: {
  games: Game[];
  icons?: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLoc, setNewLoc] = useState<Record<string, string>>({});

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const res = await createGame(new FormData(e.currentTarget));
    setSaving(false);
    if (res.error) return toast(res.error, "error");
    toast("Game added", "success");
    setShowForm(false);
    router.refresh();
  }

  async function onAddLocation(gameId: string) {
    const name = newLoc[gameId]?.trim();
    if (!name) return;
    const res = await addLocation(gameId, name);
    if (res.error) return toast(res.error, "error");
    setNewLoc((p) => ({ ...p, [gameId]: "" }));
    router.refresh();
  }

  async function onDeleteLocation(id: string) {
    const res = await deleteLocation(id);
    if (res.error) return toast(res.error, "error");
    router.refresh();
  }

  async function onDeleteGame(g: Game) {
    if (!confirm(`Delete "${g.name}" and its locations? This cannot be undone.`)) return;
    const res = await deleteGame(g.id);
    if (res.error) return toast(res.error, "error");
    toast("Game deleted", "success");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95"
        >
          <Plus size={16} /> New game
        </button>
      </div>

      {games.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="No games in inventory"
          description="Add the Roblox experiences where Feenix can serve ads, then define their ad locations."
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {games.map((g) => (
            <div key={g.id} className="card-glow bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface border border-border shrink-0 flex items-center justify-center">
                  {icons[g.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icons[g.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Gamepad2 size={20} className="text-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">{g.name}</h3>
                    <Badge className={gameStatusColors[g.status]}>{g.status}</Badge>
                  </div>
                  {g.description && (
                    <p className="text-sm text-muted mt-1 line-clamp-2">{g.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted">
                    {g.roblox_place_id && (
                      <a
                        href={`https://www.roblox.com/games/${g.roblox_place_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        <ExternalLink size={12} /> Place {g.roblox_place_id}
                      </a>
                    )}
                    {g.roblox_universe_id && <span>Universe {g.roblox_universe_id}</span>}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteGame(g)}
                  className="text-muted hover:text-danger transition-colors shrink-0"
                  title="Delete game"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Locations */}
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs uppercase tracking-wide text-muted mb-2">
                  Ad locations ({g.locations?.length ?? 0})
                </p>
                <div className="space-y-1.5">
                  {(g.locations ?? []).map((loc) => (
                    <div
                      key={loc.id}
                      className="flex items-center justify-between bg-surface rounded-lg px-3 py-1.5"
                    >
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <MapPin size={13} className="text-accent" /> {loc.name}
                      </span>
                      <button
                        onClick={() => onDeleteLocation(loc.id)}
                        className="text-muted hover:text-danger transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    value={newLoc[g.id] ?? ""}
                    onChange={(e) => setNewLoc((p) => ({ ...p, [g.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && onAddLocation(g.id)}
                    placeholder="Add location (e.g. Lobby Billboard)"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={() => onAddLocation(g.id)}
                    className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-muted-strong hover:text-foreground hover:bg-white/10 transition-colors"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New game modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={onCreate}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 fade-up max-h-[85vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-semibold text-foreground">New game</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <Input name="name" label="Game name" required />
              <div className="grid grid-cols-2 gap-3">
                <Input name="roblox_place_id" label="Roblox place ID" />
                <Input name="roblox_universe_id" label="Universe ID" />
              </div>
              <Input name="thumbnail_url" label="Thumbnail URL" />
              <Textarea name="description" label="Description" />
              <Textarea
                name="locations"
                label="Initial ad locations (one per line)"
                placeholder={"Lobby Billboard\nSpawn Banner\nShop Wall"}
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm text-muted-strong hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Add game
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Input({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-muted-strong">{label}</span>
      <input
        name={name}
        required={required}
        className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function Textarea({ name, label, placeholder }: { name: string; label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-muted-strong">{label}</span>
      <textarea
        name={name}
        rows={3}
        placeholder={placeholder}
        className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none resize-none"
      />
    </label>
  );
}
