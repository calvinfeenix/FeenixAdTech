"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Images,
  Gamepad2,
  Users,
  Settings,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "./logo";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  img?: string;
  adminOnly?: boolean;
  superOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  // Assets can hold other brands' creative, so it's admin-only.
  { href: "/assets", label: "Assets", icon: Images, adminOnly: true },
  { href: "/games", label: "Games", icon: Gamepad2, adminOnly: true },
  { href: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, superOnly: true },
];

export default function Sidebar({ role, isSuperAdmin }: { role: UserRole; isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = navItems.filter((i) => {
    if (i.superOnly) return isSuperAdmin;
    if (i.adminOnly) return role === "admin";
    return true;
  });

  return (
    <>
      {/* Mobile open button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="lg:hidden fixed top-3.5 left-4 z-30 w-9 h-9 flex items-center justify-center rounded-lg bg-card border border-[#18181b] text-foreground"
      >
        <Menu size={18} />
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 w-[240px] bg-sidebar-bg flex flex-col z-50 transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5">
          <Wordmark size={18} />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="lg:hidden text-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                  isActive
                    ? "bg-[#18181b]/80 border-[#3f3f46]/50 text-sidebar-active"
                    : "border-transparent text-sidebar-text hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.img}
                    alt=""
                    width={19}
                    height={19}
                    className="object-contain transition-opacity"
                    style={{ opacity: isActive ? 1 : 0.55 }}
                  />
                ) : (
                  <item.icon size={19} className={isActive ? "text-accent" : ""} />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#18181b]">
          <p className="text-sidebar-text text-xs">Feenix AdTech v1.0</p>
        </div>
      </aside>
    </>
  );
}
