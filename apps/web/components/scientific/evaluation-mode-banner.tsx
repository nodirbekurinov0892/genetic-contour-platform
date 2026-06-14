"use client";

import { Badge } from "@/components/ui/badge";
import type { EvaluationMode } from "@shared/types";
import { ScientificDisclaimer } from "@/components/scientific/scientific-disclaimer";
import {
  EVALUATION_MODE_DESCRIPTIONS,
  EVALUATION_MODE_LABELS,
} from "@/lib/user-labels";

interface EvaluationModeBannerProps {
  mode: EvaluationMode;
  hasGroundTruth: boolean;
}

export function EvaluationModeBanner({ mode, hasGroundTruth }: EvaluationModeBannerProps) {
  const isSupervised = mode === "supervised" && hasGroundTruth;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Baholash rejimi:</span>
        <Badge variant={isSupervised ? "default" : "secondary"}>
          {isSupervised
            ? EVALUATION_MODE_LABELS.supervised
            : EVALUATION_MODE_LABELS.heuristic}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {isSupervised
            ? EVALUATION_MODE_DESCRIPTIONS.supervised
            : EVALUATION_MODE_DESCRIPTIONS.heuristic}
        </span>
      </div>
      {!isSupervised && <ScientificDisclaimer />}
    </div>
  );
}
