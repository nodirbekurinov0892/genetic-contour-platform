"use client";

import type { ExperimentStatusResponse } from "@shared/types";

interface ExperimentProgressProps {
  status: ExperimentStatusResponse;
}

export function ExperimentProgress({ status }: ExperimentProgressProps) {
  const isActive = status.status === "queued" || status.status === "running";

  if (!isActive && status.status !== "completed") {
    return null;
  }

  return (
    <div className="scientific-card space-y-3 p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Execution progress</span>
        <span className="tabular-nums text-muted-foreground">
          {status.progress_percent.toFixed(1)}%
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, status.progress_percent))}%` }}
        />
      </div>
      {status.status === "running" && status.current_generation != null && (
        <p className="text-xs text-muted-foreground">
          GA generation {status.current_generation}
        </p>
      )}
      {status.status === "queued" && (
        <p className="text-xs text-muted-foreground">Waiting for worker to start...</p>
      )}
    </div>
  );
}
