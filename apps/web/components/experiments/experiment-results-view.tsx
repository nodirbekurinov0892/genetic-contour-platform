"use client";

import type { AlgorithmRunRecord, ExperimentResults, ImageRecord } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { ScientificImageCard } from "@/components/experiments/scientific-image-card";
import { MetricsTable } from "@/components/experiments/metrics-table";
import { FitnessChart } from "@/components/experiments/fitness-chart";

const ALGORITHM_ORDER = ["sobel", "prewitt", "canny", "genetic"] as const;
const ALGORITHM_LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "Genetic Algorithm",
};

function findImage(run: AlgorithmRunRecord | undefined, type: string) {
  return run?.result_images.find((ri) => ri.type === type);
}

function getEdgeImage(run: AlgorithmRunRecord) {
  const edgeType = run.algorithm_name === "genetic" ? "ga" : run.algorithm_name;
  return run.result_images.find((ri) => ri.type === edgeType);
}

interface ExperimentResultsViewProps {
  data: ExperimentResults;
  sourceImage?: ImageRecord | null;
  conclusion?: string | null;
}

export function ExperimentResultsView({ data, sourceImage, conclusion }: ExperimentResultsViewProps) {
  const { experiment, algorithm_runs } = data;
  const pipelineRun = algorithm_runs.find((r) => r.algorithm_name === "pipeline");
  const edgeRuns = algorithm_runs
    .filter((r) => ALGORITHM_ORDER.includes(r.algorithm_name as (typeof ALGORITHM_ORDER)[number]))
    .sort(
      (a, b) =>
        ALGORITHM_ORDER.indexOf(a.algorithm_name as (typeof ALGORITHM_ORDER)[number]) -
        ALGORITHM_ORDER.indexOf(b.algorithm_name as (typeof ALGORITHM_ORDER)[number]),
    );

  const gaRun = edgeRuns.find((r) => r.algorithm_name === "genetic");

  if (
    (experiment.status === "pending" || experiment.status === "queued") &&
    edgeRuns.length === 0
  ) {
    return (
      <EmptyState
        title={experiment.status === "queued" ? "Experiment queued" : "Experiment not run yet"}
        description={
          experiment.status === "queued"
            ? "Waiting for background worker to start processing."
            : "Go to Experiments and run an algorithm on this experiment."
        }
      />
    );
  }

  if (experiment.status === "running" && edgeRuns.length === 0 && !pipelineRun) {
    return (
      <EmptyState
        title="Experiment running"
        description="Preprocessing and algorithms are executing in the background."
      />
    );
  }

  if (experiment.status === "cancelled" && edgeRuns.length === 0 && !pipelineRun) {
    return (
      <EmptyState
        title="Experiment cancelled"
        description="Execution was stopped before results were produced."
      />
    );
  }

  if (experiment.status === "failed" && edgeRuns.length === 0) {
    return (
      <EmptyState
        title="Experiment failed"
        description="Processing did not complete. Try running again with different parameters."
      />
    );
  }

  const originalFromPipeline = findImage(pipelineRun, "original");
  const grayscale = findImage(pipelineRun, "grayscale");
  const gradient = findImage(pipelineRun, "gradient");

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

  return (
    <div className="space-y-10">
      {/* Preprocessing */}
      <section>
        <SectionHeader
          title="Input & Preprocessing"
          description="Original image and preprocessing pipeline outputs used for all algorithms"
          badge="Pipeline"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sourceImage && (
            <ScientificImageCard
              filePath={sourceImage.file_path}
              url={sourceImage.url}
              alt="Original uploaded"
              title="Original"
              subtitle={`${sourceImage.width}×${sourceImage.height} px`}
              badge="Upload"
            />
          )}
          {originalFromPipeline && (
            <ScientificImageCard
              filePath={originalFromPipeline.file_path}
              url={originalFromPipeline.url}
              alt="Resized original"
              title="Resized"
              subtitle="Aspect-ratio preserved"
            />
          )}
          {grayscale && (
            <ScientificImageCard
              filePath={grayscale.file_path}
              url={grayscale.url}
              alt="Grayscale"
              title="Grayscale"
              subtitle="Luminance channel"
            />
          )}
          {gradient && (
            <ScientificImageCard
              filePath={gradient.file_path}
              url={gradient.url}
              alt="Gradient map"
              title="Gradient Map"
              subtitle="Sobel magnitude"
              highlight
            />
          )}
        </div>
      </section>

      {/* Algorithm comparison grid */}
      <section>
        <SectionHeader
          title="Algorithm Comparison"
          description="Edge detection and contour extraction results from classical and genetic approaches"
          badge={`${edgeRuns.length} algorithms`}
        />
        {edgeRuns.length === 0 ? (
          <EmptyState title="No algorithm results" description="Run the experiment to generate outputs." />
        ) : (
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
                  alt={`${run.algorithm_name} result`}
                  title={ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name}
                  subtitle={
                    m?.fitness_score != null
                      ? `Fitness: ${m.fitness_score.toFixed(4)}`
                      : `Runtime: ${m?.runtime_ms ?? 0} ms`
                  }
                  badge={run.algorithm_name === "genetic" ? "GA" : "Classical"}
                  highlight={run.algorithm_name === "genetic"}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Detailed per-algorithm cards */}
      <section>
        <SectionHeader
          title="Detailed Results"
          description="Edge maps, overlays, and per-algorithm metrics"
        />
        <div className="grid gap-6 lg:grid-cols-2">
          {edgeRuns.map((run) => {
            const edge = getEdgeImage(run);
            const overlay = findImage(run, "overlay");
            const mask = findImage(run, "mask");
            const m = run.metrics[0];

            return (
              <div key={run.id} className="scientific-card overflow-hidden">
                <div className="border-b bg-muted/30 px-5 py-3">
                  <h3 className="font-semibold">
                    {ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name}
                  </h3>
                  {m && (
                    <p className="text-xs text-muted-foreground">
                      Density {(m.edge_density ?? 0).toFixed(4)} · Continuity{" "}
                      {(m.continuity_score ?? 0).toFixed(4)} · {m.runtime_ms ?? 0} ms
                    </p>
                  )}
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {edge && (
                    <ScientificImageCard
                      filePath={edge.file_path}
                      url={edge.url}
                      alt="Edges"
                      title="Contour / Edges"
                      className="border-0 shadow-none"
                    />
                  )}
                  {overlay && (
                    <ScientificImageCard
                      filePath={overlay.file_path}
                      url={overlay.url}
                      alt="Overlay"
                      title="Overlay"
                      className="border-0 shadow-none"
                    />
                  )}
                </div>
                {mask && (
                  <div className="px-4 pb-4">
                    <ScientificImageCard
                      filePath={mask.file_path}
                      url={mask.url}
                      alt="Binary mask"
                      title="Binary Mask"
                      subtitle="GA chromosome output"
                      className="border-0 shadow-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Overlay comparison */}
      {edgeRuns.length > 1 && (
        <section>
          <SectionHeader
            title="Overlay Comparison"
            description="Visual comparison of contour overlays on the original image"
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {edgeRuns.map((run) => {
              const overlay = findImage(run, "overlay");
              if (!overlay) return null;
              return (
                <ScientificImageCard
                  key={run.id}
                  filePath={overlay.file_path}
                  url={overlay.url}
                  alt={`${run.algorithm_name} overlay`}
                  title={ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name}
                  subtitle="Overlay"
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Metrics */}
      <section>
        <SectionHeader
          title="Quantitative Metrics"
          description="Comparative evaluation: edge density, continuity, noise, fitness, runtime"
          badge="Scientific"
        />
        <MetricsTable rows={metricsRows} />
      </section>

      {/* Fitness chart */}
      {gaRun && (
        <section>
          <FitnessChart history={gaRun.generation_history} />
        </section>
      )}

      {/* Conclusion */}
      {conclusion && (
        <section>
          <SectionHeader title="Scientific Conclusion" description="Automated analysis based on experiment metrics" />
          <Card className="scientific-card border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <p className="text-sm leading-relaxed text-foreground/90">{conclusion}</p>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
