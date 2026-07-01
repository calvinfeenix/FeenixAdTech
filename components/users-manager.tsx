"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Shield, ShieldOff, Clock, Trash2, UploadCloud } from "lucide-react";
import { useToast } from "@/components/toast";
import Badge from "@/components/badge";
import { initials, roleColors, userStatusColors, formatDate } from "@/lib/utils";
import { setUserRole, setUserStatus, removeUser, setAssetUploadPermission } from "@/app/(app)/admin/users/actions";
import type { Profile } from "@/lib/types";

export default function UsersManager({
  users,
  currentUserId,
  isSuperAdmin,
}: {
  users: Profile[];
  currentUserId: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  async function run(id: string, fn: () => Promise<{ error?: string }>, msg: string) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.error) return toast(res.error, "error");
    toast(msg, "success");
    router.refresh();
  }

  function Row({ u }: { u: Profile }) {
    const isSelf = u.id === currentUserId;
    const disabled = busy === u.id;
    return (
      <div className="card-glow flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3 transition-colors">
        <div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center text-sm font-semibold shrink-0">
          {initials(u.full_name || u.username)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {u.full_name || u.username}{" "}
            {isSelf && <span className="text-xs text-muted">(you)</span>}
          </p>
          <p className="text-xs text-muted truncate">
            @{u.username} · {u.email}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          {u.is_super_admin ? (
            <Badge className="bg-[#66CCFF]/15 text-[#66CCFF] border border-[#66CCFF]/30">super admin</Badge>
          ) : (
            <Badge className={roleColors[u.role]}>{u.role}</Badge>
          )}
          <Badge className={userStatusColors[u.status]}>{u.status}</Badge>
          <span className="text-xs text-muted w-20 text-right">{formatDate(u.created_at)}</span>
        </div>

        {/* Asset-upload permission — SUPER ADMIN ONLY. Super admins always have it,
            so their row shows a static indicator rather than a toggle. */}
        {isSuperAdmin &&
          (u.is_super_admin ? (
            <span
              title="Super admins can always upload assets"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#66CCFF]/10 text-[#66CCFF]/80 shrink-0"
            >
              <UploadCloud size={13} /> Uploads on
            </span>
          ) : (
            <button
              disabled={disabled}
              onClick={() =>
                run(
                  u.id,
                  () => setAssetUploadPermission(u.id, !u.can_upload_assets),
                  u.can_upload_assets ? "Upload access revoked" : "Upload access granted"
                )
              }
              title="Toggle asset-upload permission"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 shrink-0 ${
                u.can_upload_assets
                  ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  : "bg-white/5 text-muted hover:text-foreground hover:bg-white/10"
              }`}
            >
              <UploadCloud size={13} /> {u.can_upload_assets ? "Uploads on" : "Uploads off"}
            </button>
          ))}

        {!isSelf && (
          <div className="flex items-center gap-1.5 shrink-0">
            {u.status === "pending" ? (
              <>
                <button
                  disabled={disabled}
                  onClick={() => run(u.id, () => setUserStatus(u.id, "approved"), "User approved")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-success/15 text-success hover:bg-success/25 disabled:opacity-50"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  disabled={disabled}
                  onClick={() => run(u.id, () => setUserStatus(u.id, "rejected"), "User rejected")}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-danger/15 text-danger hover:bg-danger/25 disabled:opacity-50"
                >
                  <X size={14} /> Reject
                </button>
              </>
            ) : (
              <>
                {u.status === "rejected" && (
                  <button
                    disabled={disabled}
                    onClick={() => run(u.id, () => setUserStatus(u.id, "approved"), "User approved")}
                    className="px-2.5 py-1.5 rounded-lg text-xs bg-success/15 text-success hover:bg-success/25 disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {u.role === "user" ? (
                  <button
                    disabled={disabled}
                    onClick={() => run(u.id, () => setUserRole(u.id, "admin"), "Promoted to admin")}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-accent-soft text-accent hover:bg-accent/20 disabled:opacity-50"
                  >
                    <Shield size={14} /> Make admin
                  </button>
                ) : (
                  <button
                    disabled={disabled}
                    onClick={() => run(u.id, () => setUserRole(u.id, "user"), "Demoted to user")}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-white/5 text-muted-strong hover:text-foreground hover:bg-white/10 disabled:opacity-50"
                  >
                    <ShieldOff size={14} /> Revoke admin
                  </button>
                )}
              </>
            )}
            {/* Super-admin-only: permanently remove the user. */}
            {isSuperAdmin && (
              <button
                disabled={disabled}
                onClick={() => {
                  if (confirm(`Remove ${u.username}? This permanently deletes their account.`))
                    run(u.id, () => removeUser(u.id), "User removed");
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-danger/15 text-danger hover:bg-danger/25 disabled:opacity-50"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Clock size={15} className="text-amber-400" /> Pending approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted bg-card border border-border rounded-xl px-4 py-3">
            No pending requests.
          </p>
        ) : (
          <div className="space-y-2">
            {pending.map((u) => (
              <Row key={u.id} u={u} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">All members ({others.length})</h2>
        <div className="space-y-2">
          {others.map((u) => (
            <Row key={u.id} u={u} />
          ))}
        </div>
      </section>
    </div>
  );
}
