"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className={`inline-flex items-center gap-2 text-sm text-muted-strong hover:text-foreground transition-colors ${className}`}
    >
      <LogOut size={15} /> Sign out
    </button>
  );
}
