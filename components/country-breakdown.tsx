"use client";

import { useState } from "react";
import { BreakdownChart } from "@/components/charts-lazy";

const OPTIONS = [10, 25, 50, 100];

/**
 * "Impressions by country" card. A campaign can accrue hundreds of countries, so
 * we default to the top 10 (the data arrives already sorted desc from the RPC)
 * and let the viewer widen to 25 / 50 / 100 via a dropdown. Only options that
 * would actually reveal more rows than the current data length are offered.
 */
export default function CountryBreakdown({ data }: { data: { label: string; value: number }[] }) {
  const [topN, setTopN] = useState(10);

  // 10 is always available; each larger step only appears once there's enough
  // data to make it meaningful (e.g. "Top 25" needs more than 10 countries).
  const options = OPTIONS.filter((n, i) => i === 0 || data.length > OPTIONS[i - 1]);
  const shown = data.slice(0, topN);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          Impressions by country <span className="text-muted font-normal">({data.length})</span>
        </h2>
        {options.length > 1 && (
          <select
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-muted-strong focus:border-accent focus:outline-none cursor-pointer"
            aria-label="Number of countries to show"
          >
            {options.map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        )}
      </div>
      {/* Bounded height so a large selection scrolls inside the card instead of
          stretching it to thousands of pixels. */}
      <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
        <BreakdownChart data={shown} />
      </div>
    </div>
  );
}
