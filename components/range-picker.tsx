"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar, ChevronDown } from "lucide-react";

export const RANGE_OPTIONS = [
  { v: "7", l: "Last 7 days" },
  { v: "28", l: "Last 28 days" },
  { v: "90", l: "Last 90 days" },
  { v: "all", l: "All time" },
];

/** Date-range selector. Writes ?range= to the URL (28 = default, omitted). */
export default function RangePicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onChange(v: string) {
    const params = new URLSearchParams(sp.toString());
    if (v === "28") params.delete("range");
    else params.set("range", v);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="relative inline-flex items-center shrink-0">
      <Calendar size={14} className="absolute left-3 text-muted pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Date range"
        className="appearance-none bg-card border border-border rounded-lg pl-8 pr-8 py-1.5 text-sm text-foreground hover:border-border-strong focus:border-accent focus:outline-none cursor-pointer"
      >
        {RANGE_OPTIONS.map((r) => (
          <option key={r.v} value={r.v} className="bg-card text-foreground">
            {r.l}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 text-muted pointer-events-none" />
    </div>
  );
}
