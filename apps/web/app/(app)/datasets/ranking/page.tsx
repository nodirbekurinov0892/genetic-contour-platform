"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingState } from "@/components/ui/state-panel";
import { datasetRankingService, type DatasetRankingResponse } from "@/services/datasetRankingService";
import { formatAlgorithmLabel } from "@/lib/user-labels";

export default function DatasetRankingPage() {
  const [data, setData] = useState<DatasetRankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    datasetRankingService
      .getUserRanking()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklash xatosi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Dataset reytingi yuklanmoqda..." />;
  if (error || !data) return <ErrorState message={error ?? "Ma'lumot yo'q"} />;

  const table = data.table ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dataset Ranking Engine"
        description="Har bir dataset uchun IoU, F1, Dice, qiyinlik va shovqin — faqat yakunlangan tajriba metrikalaridan"
        badge="Ranking"
      />
      {table.length === 0 ? (
        <div className="scientific-card p-6 text-center text-sm text-muted-foreground">
          Dataset reytingi uchun kamida bitta yakunlangan supervised tajriba kerak.
        </div>
      ) : (
        <div className="scientific-card overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Dataset</th>
                <th className="p-2">Avg IoU</th>
                <th className="p-2">Avg F1</th>
                <th className="p-2">Avg Dice</th>
                <th className="p-2">Winner</th>
                <th className="p-2">Difficulty</th>
                <th className="p-2">Noise</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.image_id} className="border-b">
                  <td className="p-2">{row.dataset}</td>
                  <td className="p-2 font-mono">{row.avg_iou?.toFixed(4) ?? "—"}</td>
                  <td className="p-2 font-mono">{row.avg_f1?.toFixed(4) ?? "—"}</td>
                  <td className="p-2 font-mono">{row.avg_dice?.toFixed(4) ?? "—"}</td>
                  <td className="p-2">{formatAlgorithmLabel(row.winner_algorithm ?? "—")}</td>
                  <td className="p-2">
                    <Badge variant="outline">{row.difficulty_class}</Badge>
                    <span className="ml-2 font-mono text-xs">{row.difficulty_score.toFixed(3)}</span>
                  </td>
                  <td className="p-2 font-mono">{row.noise_score.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
