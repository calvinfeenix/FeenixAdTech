import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Badge from "@/components/badge";
import { campaignStatusColors, formatDate } from "@/lib/utils";
import type { CampaignStatus } from "@/lib/types";

/**
 * Campaign card with a "living collage" background: the campaign's creative
 * thumbnails are tiled into a 3×2 grid that gently pans + zooms on hover, over
 * a near-black (sidebar) fill so the title and flight dates stay easy to read.
 */
export default function CampaignCard({
  href,
  name,
  status,
  flightStart,
  flightEnd,
  thumbs,
  heightClass = "h-[150px]",
  showCta = false,
}: {
  href: string;
  name: string;
  status: CampaignStatus;
  flightStart: string | null;
  flightEnd: string | null;
  thumbs: string[];
  heightClass?: string;
  showCta?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card-glow relative overflow-hidden rounded-xl border border-border bg-sidebar-bg transition-colors group ${heightClass} flex flex-col justify-end p-4`}
    >
      {thumbs.length > 0 && (
        <div
          aria-hidden
          className="absolute -inset-6 grid grid-cols-3 grid-rows-2 gap-1.5 opacity-80 transition-transform duration-[900ms] ease-out group-hover:-translate-x-4 group-hover:-translate-y-4 group-hover:scale-[1.12]"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={thumbs[i % thumbs.length]} alt="" className="w-full h-full object-cover rounded" />
          ))}
        </div>
      )}

      {/* Near-black (sidebar) scrim — solid where the text sits, lifting toward the top */}
      <div className="absolute inset-0 bg-gradient-to-t from-sidebar-bg via-sidebar-bg/85 to-sidebar-bg/40" />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[18px] font-semibold text-foreground truncate group-hover:text-accent transition-colors">
            {name}
          </h3>
          <Badge className={campaignStatusColors[status]}>{status}</Badge>
        </div>
        <p className="text-[12px] font-bold text-[#346c92]/90 mt-1.5">
          {flightStart ? formatDate(flightStart) : "No start"} → {flightEnd ? formatDate(flightEnd) : "Open"}
        </p>
        {showCta && (
          <span className="inline-flex items-center gap-1 text-xs text-accent mt-2">
            View analytics <ArrowRight size={13} />
          </span>
        )}
      </div>
    </Link>
  );
}
