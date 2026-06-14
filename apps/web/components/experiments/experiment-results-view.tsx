"use client";

import { useState } from "react";
import type { AlgorithmRunRecord, ExperimentResults, ImageRecord } from "@shared/types";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { ComparisonSlider } from "@/components/analytics/comparison-slider";
import { SupervisedMetricsPanel } from "@/components/analytics/supervised-metrics-panel";
import { ScientificImageCard } from "@/components/experiments/scientific-image-card";
import { MetricsTable } from "@/components/experiments/metrics-table";
import { FitnessChart } from "@/components/experiments/fitness-chart";
import { ReproducibilityPanel } from "@/components/experiments/reproducibility-panel";
import { EvaluationModeBanner } from "@/components/scientific/evaluation-mode-banner";
import { FalsePositiveWarnings } from "@/components/scientific/false-positive-warnings";
import type { EvaluationMode, MetricWarning, WinnerInfo } from "@shared/types";

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
  evaluationMode?: EvaluationMode;
  winner?: WinnerInfo | null;
  metricWarnings?: MetricWarning[];
}

export function ExperimentResultsView({
  data,
  sourceImage,
  conclusion,
  evaluationMode,
  winner = null,
  metricWarnings = [],
}: ExperimentResultsViewProps) {
  const [lightbox, setLightbox] = useState<{
    filePath: string;
    url?: string | null;
    alt: string;
    title: string;
  } | null>(null);

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
  const hasGroundTruth =
    sourceImage?.has_ground_truth ??
    edgeRuns.some((r) => r.metrics[0]?.iou != null);
  const mode: EvaluationMode =
    evaluationMode ?? (hasGroundTruth ? "supervised" : "heuristic");

  if (
    (experiment.status === "pending" || experiment.status === "queued") &&
    edgeRuns.length === 0
  ) {
    return (
      <EmptyState
        title={experiment.status === "queued" ? "Tajriba navbatda" : "Tajriba hali ishga tushirilmagan"}
        description={
          experiment.status === "queued"
            ? "Fon worker ishni boshlashini kutmoqda."
            : "Tajribalar bo'limiga o'ting va ushbu tajribada algoritm ishga tushiring."
        }
      />
    );
  }

  if (experiment.status === "running" && edgeRuns.length === 0 && !pipelineRun) {
    return (
      <EmptyState
        title="Tajriba bajarilmoqda"
        description="Oldindan qayta ishlash va algoritmlar fon rejimida ishlamoqda."
      />
    );
  }

  if (experiment.status === "cancelled" && edgeRuns.length === 0 && !pipelineRun) {
    return (
      <EmptyState
        title="Tajriba bekor qilindi"
        description="Natijalar hosil bo&apos;lishidan oldin bajarish to&apos;xtatildi."
      />
    );
  }

  if (experiment.status === "failed" && edgeRuns.length === 0) {
    return (
      <EmptyState
        title="Tajriba muvaffaqiyatsiz"
        description="Qayta ishlash yakunlanmadi. Boshqa parametrlar bilan qayta urinib ko&apos;ring."
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

  const openImage = (filePath: string, url: string | null | undefined, alt: string, title: string) => {
    setLightbox({ filePath, url, alt, title });
  };

  return (
    <div className="space-y-10">
      <EvaluationModeBanner mode={mode} hasGroundTruth={hasGroundTruth} />
      <FalsePositiveWarnings warnings={metricWarnings} />
      <ReproducibilityPanel data={experiment.reproducibility_json} />
      <section>
        <SectionHeader
          title="Kirish va oldindan qayta ishlash"
          description="Asl rasm va barcha algoritmlar uchun ishlatilgan oldindan qayta ishlash natijalari"
          badge="Pipeline"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sourceImage && (
            <ScientificImageCard
              filePath={sourceImage.file_path}
              url={sourceImage.url}
              alt="Yuklangan asl rasm"
              title="Asl rasm"
              subtitle={`${sourceImage.width}×${sourceImage.height} px`}
              badge="Yuklash"
              onInspect={() =>
                openImage(sourceImage.file_path, sourceImage.url, "Asl rasm", "Asl rasm")
              }
            />
          )}
          {originalFromPipeline && (
            <ScientificImageCard
              filePath={originalFromPipeline.file_path}
              url={originalFromPipeline.url}
              alt="O&apos;lchami o&apos;zgartirilgan asl rasm"
              title="O&apos;lcham o&apos;zgartirilgan"
              subtitle="Nisbat saqlangan"
            />
          )}
          {grayscale && (
            <ScientificImageCard
              filePath={grayscale.file_path}
              url={grayscale.url}
              alt="Kulrang"
              title="Kulrang"
              subtitle="Yorqinlik kanali"
            />
          )}
          {gradient && (
            <ScientificImageCard
              filePath={gradient.file_path}
              url={gradient.url}
              alt="Gradient xaritasi"
              title="Gradient xaritasi"
              subtitle="Sobel magnitudasi"
              highlight
            />
          )}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Algoritmlarni solishtirish"
          description="Klassik va genetik yondashuvlardan olingan chekka aniqlash va kontur natijalari"
          badge={`${edgeRuns.length} ta algoritm`}
        />
        {edgeRuns.length === 0 ? (
          <EmptyState
            title="Algoritm natijalari yo&apos;q"
            description="Natijalarni olish uchun tajribani ishga tushiring."
          />
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
                  alt={`${run.algorithm_name} natijasi`}
                  title={ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name}
                  subtitle={
                    m?.fitness_score != null
                      ? `GA ichki fitness: ${m.fitness_score.toFixed(4)}`
                      : `Ishlash vaqti: ${m?.runtime_ms ?? 0} ms`
                  }
                  badge={run.algorithm_name === "genetic" ? "GA" : "Klassik"}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Batafsil natijalar"
          description="Chekka xaritalari, qoplama rasmlar va algoritm bo&apos;yicha metrikalar"
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
                      Zichlik {(m.edge_density ?? 0).toFixed(4)} · Uzluksizlik{" "}
                      {(m.continuity_score ?? 0).toFixed(4)} · {m.runtime_ms ?? 0} ms
                    </p>
                  )}
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {edge && (
                    <ScientificImageCard
                      filePath={edge.file_path}
                      url={edge.url}
                      alt="Chekkalar"
                      title="Kontur / Chekkalar"
                      className="border-0 shadow-none"
                    />
                  )}
                  {overlay && (
                    <ScientificImageCard
                      filePath={overlay.file_path}
                      url={overlay.url}
                      alt="Qoplama"
                      title="Qoplama"
                      className="border-0 shadow-none"
                    />
                  )}
                </div>
                {mask && (
                  <div className="px-4 pb-4">
                    <ScientificImageCard
                      filePath={mask.file_path}
                      url={mask.url}
                      alt="Binar maska"
                      title="Binar maska"
                      subtitle="GA xromosoma chiqishi"
                      className="border-0 shadow-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {edgeRuns.length > 1 && (
        <section>
          <SectionHeader
            title="Qoplama solishtirish"
            description="Asl rasm ustidagi kontur qoplamalarini vizual solishtirish"
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
                  alt={`${run.algorithm_name} qoplamasi`}
                  title={ALGORITHM_LABELS[run.algorithm_name] ?? run.algorithm_name}
                  subtitle="Qoplama"
                />
              );
            })}
          </div>
        </section>
      )}

      {comparisonImages.length > 1 && (
        <section>
          <ComparisonSlider images={comparisonImages} />
        </section>
      )}

      <SupervisedMetricsPanel
        rows={supervisedRows}
        winner={winner}
        hasGroundTruth={hasGroundTruth}
      />

      <section>
        <SectionHeader
          title="Heuristik metrikalar"
          description="Kuzatuv maqsadida — algoritm ustunligini isbotlamaydi"
          badge="Heuristic"
        />
        <MetricsTable rows={metricsRows} />
      </section>

      <AnalyticsPanel edgeRuns={edgeRuns} hasGroundTruth={hasGroundTruth} />

      {gaRun && (
        <section>
          <FitnessChart history={gaRun.generation_history} />
        </section>
      )}

      {conclusion && (
        <section>
          <SectionHeader
            title="Ma&apos;lumotlarga asoslangan xulosa"
            description="Narrativsiz, faqat metrikalar faktlari"
          />
          <Card className="scientific-card border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <p className="text-sm leading-relaxed text-foreground/90">{conclusion}</p>
            </CardContent>
          </Card>
        </section>
      )}

      <ImageLightbox
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        filePath={lightbox?.filePath ?? ""}
        url={lightbox?.url}
        alt={lightbox?.alt ?? ""}
        title={lightbox?.title}
      />
    </div>
  );
}
