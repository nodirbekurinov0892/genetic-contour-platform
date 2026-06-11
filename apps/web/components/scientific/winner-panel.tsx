"use client";

import type { WinnerInfo } from "@shared/types";

interface WinnerPanelProps {
  winner: WinnerInfo | null;
  hasGroundTruth: boolean;
}

export function WinnerPanel({ winner, hasGroundTruth }: WinnerPanelProps) {
  if (!hasGroundTruth) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <strong>G&apos;olib:</strong> Aniqlanmagan (Ground Truth mavjud emas).
      </div>
    );
  }

  if (!winner) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        <strong>G&apos;olib:</strong> Supervised metrikalar hisoblanmagan.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
      <p className="font-semibold text-emerald-700 dark:text-emerald-300">
        Supervised g&apos;olib (IoU → F1 → Dice)
        {winner.tie ? " — teng natija" : ""}
      </p>
      <p className="mt-1">
        <span className="font-medium">{winner.algorithm}</span>
        {" · "}
        IoU={winner.iou?.toFixed(4) ?? "—"}
        {" · "}
        F1={winner.f1_score?.toFixed(4) ?? "—"}
        {" · "}
        Dice={winner.dice_coefficient?.toFixed(4) ?? "—"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Fitness qatnashmaydi. Faqat Ground Truth asosidagi metrikalar.
      </p>
    </div>
  );
}
