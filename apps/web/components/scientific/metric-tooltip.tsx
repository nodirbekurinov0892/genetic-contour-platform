"use client";

import { Info } from "lucide-react";
import { METRIC_DEFINITIONS } from "@/lib/metric-definitions";
import { cn } from "@/lib/utils";

interface MetricTooltipProps {
  metricKey: keyof typeof METRIC_DEFINITIONS;
  className?: string;
}

export function MetricTooltip({ metricKey, className }: MetricTooltipProps) {
  const def = METRIC_DEFINITIONS[metricKey];
  if (!def) return null;

  return (
    <span className={cn("group relative inline-flex items-center gap-1", className)}>
      <span>{def.label}</span>
      <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-md border bg-popover p-3 text-left text-xs text-popover-foreground shadow-md group-hover:block"
      >
        <span className="mb-1 block font-semibold">{def.label}</span>
        <span className="mb-1 block text-muted-foreground">
          <strong>O&apos;lchaydi:</strong> {def.measures}
        </span>
        <span className="block text-muted-foreground">
          <strong>O&apos;lchamaydi:</strong> {def.doesNotMeasure}
        </span>
      </span>
    </span>
  );
}
