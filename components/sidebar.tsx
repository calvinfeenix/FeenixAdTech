"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Images,
  Gamepad2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "./logo";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/assets", label: "Assets", icon: Images },
  { href: "/games", label: "Games", icon: Gamepad2, adminOnly: true },
  { href: "/admin/users", label: "Users", icon: Users, adminOnly: true },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = navItems.filter((i) => !i.adminOnly || role === "admin");

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-sidebar-bg border-r border-border flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-border">
        <Wordmark height={22} />
        <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-accent border border-accent/40 rounded px-1.5 py-0.5">
          AdTech
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent-soft text-sidebar-active"
                  : "text-sidebar-text hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon size={19} className={isActive ? "text-accent" : ""} />
              <span className="nav-underscore">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border">
        <p className="text-sidebar-text text-xs">Feenix AdTech v1.0</p>
      </div>
    </aside>
  );
}
