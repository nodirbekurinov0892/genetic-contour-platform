"use client";

import { AlertCircle } from "lucide-react";
import type { MetricWarning } from "@shared/types";

interface FalsePositiveWarningsProps {
  warnings: MetricWarning[];
}

export function FalsePositiveWarnings({ warnings }: FalsePositiveWarningsProps) {
  if (!warnings.length) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
        <AlertCircle className="h-4 w-4" />
        Metrik nomuvofiqlik ogohlantirishlari
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {warnings.map((w) => (
          <li key={`${w.type}-${w.algorithm}`}>{w.message}</li>
        ))}
      </ul>
    </div>
  );
}
