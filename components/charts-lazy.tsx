"use client";

import dynamic from "next/dynamic";
import type { TrendPoint, BreakdownBar } from "./charts";

/**
 * Lazy chart wrappers — recharts is a heavy client bundle, so we load it
 * on-demand (ssr:false) with a skeleton. The page never waits on the chart JS.
 */
const TrendInner = dynamic(() => import("./charts").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-lg bg-surface/50" />,
});

const BreakdownInner = dynamic(() => import("./charts").then((m) => m.BreakdownChart), {
  ssr: false,
  loading: () => <div className="h-[160px] w-full animate-pulse rounded-lg bg-surface/50" />,
});

export function TrendChart(props: { data: TrendPoint[] }) {
  return <TrendInner {...props} />;
}

export function BreakdownChart(props: { data: BreakdownBar[] }) {
  return <BreakdownInner {...props} />;
}
