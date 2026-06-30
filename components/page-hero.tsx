import type { ReactNode } from "react";

/**
 * Full-bleed page hero — the same drifting Roblox-games backdrop + gradient the
 * dashboard uses, with a left-aligned title and an optional right-side action.
 * Relies on the app layout (header overlays, main has pt-20) so the -mt-20
 * pulls it up behind the header, full width.
 */
export default function PageHero({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative -mt-20 -mx-4 sm:-mx-6 overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-drift" style={{ backgroundImage: "url(/login-bg.png)" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-background/45 via-background/65 to-background" />
      <div className="relative px-4 sm:px-6 pt-28 pb-12 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-[34px] font-display font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted text-sm mt-1.5 max-w-2xl">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
