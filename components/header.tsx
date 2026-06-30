"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { initials, roleColors } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export default function Header({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const display = profile.full_name || profile.username;

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[240px] z-30 h-16 flex items-center justify-end px-4 sm:px-6 bg-gradient-to-b from-background/70 to-transparent pointer-events-none">
      <div className="relative pointer-events-auto">
        <button
          onClick={() => setOpen((o) => !o)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center text-sm font-semibold">
            {initials(display)}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-foreground leading-tight">{display}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleColors[profile.role]}`}>
              {profile.role}
            </span>
          </div>
          <ChevronDown size={16} className="text-muted" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl py-1.5 fade-up">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">@{profile.username}</p>
              <p className="text-xs text-muted truncate">{profile.email}</p>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-strong hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
