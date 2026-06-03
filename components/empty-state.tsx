import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode; // optional action button
}

export default function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-dashed border-border bg-card/40">
      <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mb-4">
        <Icon size={26} className="text-accent" />
      </div>
      <h3 className="text-lg font-display font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
