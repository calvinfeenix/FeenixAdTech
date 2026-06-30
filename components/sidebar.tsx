"use client";

import { useEffect, useState } from "react";
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
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
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
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop rail

  // Restore the desktop collapsed preference; drive the content margin via a
  // class on <html> so the (server) layout column can react in CSS.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem("feenix-collapsed") === "1");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("feenix-collapsed", collapsed);
    localStorage.setItem("feenix-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

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
        className={`fixed left-0 top-0 bottom-0 bg-sidebar-bg flex flex-col z-50 transition-[width,transform] duration-200 ease-out lg:translate-x-0 w-[240px] ${
          collapsed ? "lg:w-[76px]" : "lg:w-[240px]"
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Logo — left edge aligns with the nav item icons (px-6) */}
        <div className={`flex items-center py-5 ${collapsed ? "lg:justify-center lg:px-0 px-6" : "justify-between px-6"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Vector.svg" alt="feenix AdTech" className={`h-5 w-auto ${collapsed ? "lg:hidden" : ""}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {collapsed && <img src="/SmallLogo.png" alt="Feenix" className="hidden lg:block h-6 w-auto" />}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="lg:hidden text-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {items.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                  collapsed ? "lg:justify-center" : ""
                } ${
                  isActive
                    ? "bg-[#18181b]/80 border-[#3f3f46]/50 text-sidebar-active"
                    : "border-transparent text-sidebar-text hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon size={19} className={`shrink-0 ${isActive ? "text-accent" : ""}`} />
                <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer + collapse toggle (desktop) */}
        <div className={`px-4 py-4 border-t border-[#18181b] hidden lg:flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <p className={`text-sidebar-text text-xs ${collapsed ? "hidden" : ""}`}>Feenix AdTech v1.0</p>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#27272a] text-sidebar-text hover:bg-white/5 hover:text-white hover:border-[#3f3f46] transition-colors"
          >
            <ChevronLeft size={16} className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
      </aside>
    </>
  );
}
