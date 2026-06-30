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
      <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/75 to-background" />
      <div className="relative px-4 sm:px-6 pt-24 pb-8 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-display font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
