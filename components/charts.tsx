"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact } from "@/lib/utils";

const AXIS = "#346C92";
const GRID = "rgba(102,204,255,0.07)";
const COLORS = ["#66CCFF", "#00FF6C", "#1677FF", "#FB923C", "#EC4899", "#EF4452"];

const tooltipStyle = {
  background: "#05143a",
  border: "1px solid rgba(102,204,255,0.25)",
  borderRadius: 12,
  color: "#f3f8ff",
  fontSize: 12,
};

export interface TrendPoint {
  date: string;
  impressions: number;
  clicks: number;
  uniqueUsers: number;
}

/** Area trend of impressions / unique users / clicks over time. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="g-impr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00FF6C" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#00FF6C" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g-uu" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#66CCFF" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#66CCFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickFormatter={(d: string) => d.slice(5)}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => formatCompact(v)}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "#cbe7f6" }}
          formatter={(v, name) => [formatCompact(Number(v)), String(name)] as [string, string]}
        />
        <Area
          type="monotone"
          name="Impressions"
          dataKey="impressions"
          stroke="#00FF6C"
          fill="url(#g-impr)"
          strokeWidth={2}
          isAnimationActive
          animationBegin={0}
          animationDuration={1500}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          name="Unique users"
          dataKey="uniqueUsers"
          stroke="#66CCFF"
          fill="url(#g-uu)"
          strokeWidth={2}
          isAnimationActive
          animationBegin={250}
          animationDuration={1500}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          name="Clicks"
          dataKey="clicks"
          stroke="#FB923C"
          fill="transparent"
          strokeWidth={2}
          isAnimationActive
          animationBegin={500}
          animationDuration={1500}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface BreakdownBar {
  label: string;
  value: number;
}

/** Horizontal bar breakdown (e.g. impressions by game or location). */
export function BreakdownChart({ data }: { data: BreakdownBar[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "#b6b6c0", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={{ color: "#f3f8ff" }}
          labelStyle={{ color: "#cbe7f6" }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(v) => [formatCompact(Number(v)), "Impressions"] as [string, string]}
        />
        <Bar dataKey="value" name="Impressions" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
