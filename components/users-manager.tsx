"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Shield, ShieldOff, Clock } from "lucide-react";
import { useToast } from "@/components/toast";
import Badge from "@/components/badge";
import { initials, roleColors, userStatusColors, formatDate } from "@/lib/utils";
import { setUserRole, setUserStatus } from "@/app/(app)/admin/users/actions";
import type { Profile } from "@/lib/types";

export default function UsersManager({
  users,
  currentUserId,
}: {
  users: Profile[];
  currentUserId: string;
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
      <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3">
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
          <Badge className={roleColors[u.role]}>{u.role}</Badge>
          <Badge className={userStatusColors[u.status]}>{u.status}</Badge>
          <span className="text-xs text-muted w-20 text-right">{formatDate(u.created_at)}</span>
        </div>

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
