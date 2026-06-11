"use client";

import { Badge } from "@/components/ui/badge";
import type { EvaluationMode } from "@shared/types";
import { ScientificDisclaimer } from "@/components/scientific/scientific-disclaimer";

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
          {isSupervised ? "Supervised Evaluation" : "Heuristic Evaluation"}
        </Badge>
        {isSupervised ? (
          <span className="text-xs text-muted-foreground">
            Ground Truth mavjud — IoU/F1/Dice orqali o&apos;lchanadi
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Ground Truth yo&apos;q — g&apos;olib aniqlanmaydi
          </span>
        )}
      </div>
      {!isSupervised && <ScientificDisclaimer />}
    </div>
  );
}
