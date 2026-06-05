import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { label: string; positive?: boolean };
  className?: string;
  accent?: "blue" | "green" | "amber" | "slate";
}

const accentStyles = {
  blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20",
  green: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
  amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20",
  slate: "from-slate-500/10 to-slate-600/5 border-slate-500/20",
};

const iconStyles = {
  blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  green: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  slate: "text-slate-600 dark:text-slate-400 bg-slate-500/10",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  accent = "blue",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "scientific-card relative overflow-hidden border bg-gradient-to-br p-6",
        accentStyles[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {trend.label}
            </p>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5", iconStyles[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
