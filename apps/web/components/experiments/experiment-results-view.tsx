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
        description="Natijalar hosil bo'lishidan oldin bajarish to'xtatildi."
      />
    );
  }

  if (experiment.status === "failed" && edgeRuns.length === 0) {
    return (
      <EmptyState
        title="Tajriba muvaffaqiyatsiz"
        description="Qayta ishlash yakunlanmadi. Boshqa parametrlar bilan qayta urinib ko'ring."
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
            />
          )}
          {originalFromPipeline && (
            <ScientificImageCard
              filePath={originalFromPipeline.file_path}
              url={originalFromPipeline.url}
              alt="O'lchami o'zgartirilgan asl rasm"
              title="O'lcham o'zgartirilgan"
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
            title="Algoritm natijalari yo'q"
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
                      ? `Fitness: ${m.fitness_score.toFixed(4)}`
                      : `Ishlash vaqti: ${m?.runtime_ms ?? 0} ms`
                  }
                  badge={run.algorithm_name === "genetic" ? "GA" : "Klassik"}
                  highlight={run.algorithm_name === "genetic"}
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Batafsil natijalar"
          description="Chekka xaritalari, qoplama rasmlar va algoritm bo'yicha metrikalar"
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

      <section>
        <SectionHeader
          title="Kvantitativ metrikalar"
          description="Solishtirma baholash: chekka zichligi, uzluksizlik, shovqin, fitness, ishlash vaqti"
          badge="Ilmiy"
        />
        <MetricsTable rows={metricsRows} />
      </section>

      {gaRun && (
        <section>
          <FitnessChart history={gaRun.generation_history} />
        </section>
      )}

      {conclusion && (
        <section>
          <SectionHeader
            title="Ilmiy xulosa"
            description="Tajriba metrikalariga asoslangan avtomatik tahlil"
          />
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
