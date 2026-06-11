"use client";

import type { AlgorithmRunRecord } from "@shared/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-panel";
import { ResultImageView } from "@/components/experiments/result-image";

const ALGORITHM_LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "Genetic Algorithm",
};

interface ResultGridProps {
  runs: AlgorithmRunRecord[];
}

export function ResultGrid({ runs }: ResultGridProps) {
  const edgeRuns = runs.filter((r) => r.algorithm_name !== "pipeline");

  if (edgeRuns.length === 0) {
    return (
      <EmptyState
        title="Hali natijalar yo'q"
        description="Algoritm natijalarini ko'rish uchun tajriba ishga tushiring."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {edgeRuns.map((run) => {
        const edgeType = run.algorithm_name === "genetic" ? "ga" : run.algorithm_name;
        const edgeImage = run.result_images.find((ri) => ri.type === edgeType);
        const overlay = run.result_images.find((ri) => ri.type === "overlay");

        return (
          <Card key={run.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {edgeImage ? (
                <ResultImageView
                  filePath={edgeImage.file_path}
                  url={edgeImage.url}
                  alt={`${run.algorithm_name} natijasi`}
                  label="Chekkalar"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Chekka rasmi yo&apos;q</p>
              )}
              {overlay && (
                <ResultImageView
                  filePath={overlay.file_path}
                  url={overlay.url}
                  alt={`${run.algorithm_name} qoplamasi`}
                  label="Qoplama"
                />
              )}
              {run.metrics[0] && (
                <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <dt>Chekka zichligi</dt>
                  <dd>{(run.metrics[0].edge_density ?? 0).toFixed(4)}</dd>
                  <dt>Ishlash vaqti</dt>
                  <dd>{run.metrics[0].runtime_ms ?? 0} ms</dd>
                  {run.metrics[0].fitness_score != null && (
                    <>
                      <dt>GA ichki fitness</dt>
                      <dd>{run.metrics[0].fitness_score.toFixed(4)}</dd>
                    </>
                  )}
                </dl>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
