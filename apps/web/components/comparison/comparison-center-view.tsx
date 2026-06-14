"use client";

import type { AlgorithmRunRecord, ExperimentResults, ImageRecord } from "@shared/types";
import { ComparisonSlider } from "@/components/analytics/comparison-slider";
import { SupervisedMetricsPanel } from "@/components/analytics/supervised-metrics-panel";
import { ScientificImageCard } from "@/components/experiments/scientific-image-card";
import { MetricsTable } from "@/components/experiments/metrics-table";
import { EvaluationModeBanner } from "@/components/scientific/evaluation-mode-banner";
import { WinnerPanel } from "@/components/scientific/winner-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/state-panel";
import type { EvaluationMode, WinnerInfo } from "@shared/types";

const ALGORITHM_ORDER = ["sobel", "prewitt", "canny", "genetic"] as const;
const ALGORITHM_LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "Genetic Algorithm",
};

function getEdgeImage(run: AlgorithmRunRecord) {
  const edgeType = run.algorithm_name === "genetic" ? "ga" : run.algorithm_name;
  return run.result_images.find((ri) => ri.type === edgeType);
}

interface ComparisonCenterViewProps {
  data: ExperimentResults;
  sourceImage?: ImageRecord | null;
  evaluationMode?: EvaluationMode;
  winner?: WinnerInfo | null;
}

export function ComparisonCenterView({
  data,
  sourceImage,
  evaluationMode,
  winner = null,
}: ComparisonCenterViewProps) {
  const { experiment, algorithm_runs } = data;
  const edgeRuns = algorithm_runs
    .filter((r) => ALGORITHM_ORDER.includes(r.algorithm_name as (typeof ALGORITHM_ORDER)[number]))
    .sort(
      (a, b) =>
        ALGORITHM_ORDER.indexOf(a.algorithm_name as (typeof ALGORITHM_ORDER)[number]) -
        ALGORITHM_ORDER.indexOf(b.algorithm_name as (typeof ALGORITHM_ORDER)[number]),
    );

  const hasGroundTruth =
    sourceImage?.has_ground_truth ?? edgeRuns.some((r) => r.metrics[0]?.iou != null);
  const mode: EvaluationMode =
    evaluationMode ?? (hasGroundTruth ? "supervised" : "heuristic");

  if (experiment.status !== "completed" || edgeRuns.length === 0) {
    return (
      <EmptyState
        title="Taqqoslash uchun natijalar yo'q"
        description="Yakunlangan compare_all tajribasini tanlang yoki yangi tajriba ishga tushiring."
      />
    );
  }

  const metricsRows = edgeRuns.map((run) => {
    const m = run.metrics[0];
    return {
      algorithm: ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name,
      edge_density: m?.edge_density ?? null,
      continuity_score: m?.continuity_score ?? null,
      noise_score: m?.noise_score ?? null,
      fitness_score: m?.fitness_score ?? null,
      runtime_ms: m?.runtime_ms ?? null,
    };
  });

  const supervisedRows = edgeRuns.map((run) => ({
    algorithm: ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name,
    metrics: run.metrics[0] ?? {
      edge_density: null,
      continuity_score: null,
      noise_score: null,
      fitness_score: null,
      precision: null,
      recall: null,
      f1_score: null,
      iou: null,
      dice_coefficient: null,
      runtime_ms: null,
    },
  }));

  const comparisonImages = [];
  if (sourceImage) {
    comparisonImages.push({
      label: "Asl",
      filePath: sourceImage.file_path,
      url: sourceImage.url,
    });
  }
  for (const run of edgeRuns) {
    const edge = getEdgeImage(run);
    if (!edge) continue;
    comparisonImages.push({
      label: ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name,
      filePath: edge.file_path,
      url: edge.url,
    });
  }

  return (
    <div className="space-y-8">
      <EvaluationModeBanner mode={mode} hasGroundTruth={hasGroundTruth} />
      <WinnerPanel winner={winner} hasGroundTruth={hasGroundTruth} />

      <section>
        <SectionHeader
          title="Algoritmlar yonma-yon"
          description="Sobel, Prewitt, Canny va Genetic Algorithm natijalari"
          badge="4-up"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {edgeRuns.map((run) => {
            const edge = getEdgeImage(run);
            if (!edge) return null;
            const m = run.metrics[0];
            return (
              <ScientificImageCard
                key={run.id}
                filePath={edge.file_path}
                url={edge.url}
                alt={`${run.algorithm_name} natijasi`}
                title={ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name}
                subtitle={
                  m?.iou != null
                    ? `IoU: ${m.iou.toFixed(4)}`
                    : m?.fitness_score != null
                      ? `GA fitness: ${m.fitness_score.toFixed(4)}`
                      : `${m?.runtime_ms ?? 0} ms`
                }
                badge={run.algorithm_name === "genetic" ? "GA" : "Klassik"}
              />
            );
          })}
        </div>
      </section>

      {comparisonImages.length > 1 && (
        <section>
          <ComparisonSlider images={comparisonImages} />
        </section>
      )}

      <section>
        <SectionHeader title="Metrikalar jadvali" badge="Metrics" />
        <MetricsTable rows={metricsRows} />
      </section>

      {hasGroundTruth && (
        <section>
          <SupervisedMetricsPanel rows={supervisedRows} />
        </section>
      )}
    </div>
  );
}
