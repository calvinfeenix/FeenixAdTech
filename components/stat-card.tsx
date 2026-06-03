import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
}

/** Headline metric card used on the dashboard and campaign analytics. */
export default function StatCard({ title, value, subtitle, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted font-medium">{title}</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1.5">{value}</p>
          {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
          <Icon size={20} className="text-accent" />
        </div>
      </div>
    </div>
  );
}
