"use client";

import { AlertTriangle } from "lucide-react";
import { HEURISTIC_DISCLAIMER_UZ } from "@/lib/metric-definitions";
import { cn } from "@/lib/utils";

interface ScientificDisclaimerProps {
  variant?: "warning" | "info";
  message?: string;
  className?: string;
}

export function ScientificDisclaimer({
  variant = "warning",
  message = HEURISTIC_DISCLAIMER_UZ,
  className,
}: ScientificDisclaimerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        variant === "warning"
          ? "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-blue-500/50 bg-blue-500/10",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
