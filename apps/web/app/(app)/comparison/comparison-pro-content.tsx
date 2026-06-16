"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ALGORITHMS } from "@shared/constants";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/state-panel";
import { ScientificBarChart } from "@/components/charts/scientific-bar-chart";
import { ActionEmptyState } from "@/components/comparison/action-empty-state";
import {
  comparisonService,
  type AlgorithmComparison,
  type BenchmarkSummary,
  type GlobalDatasetRanking,
  type MultiExperimentComparison,
} from "@/services/comparisonService";
import { experimentService } from "@/services/experimentService";
import { apiFetch, downloadFile } from "@/lib/api";
import { formatAlgorithmLabel } from "@/lib/user-labels";
import type { ExperimentBrowseItem } from "@shared/types";

type ProTab = "multi" | "benchmark" | "datasets" | "algorithms";

interface BenchmarkOption {
  id: string;
  name: string;
}

const EDGE_ALGORITHMS = ALGORITHMS.filter((a) => a.id !== "compare_all").map((a) => a.id);
const SELECT_PRESETS = [5, 10, 20, 50, 100] as const;

function formatCell(key: string, val: unknown): string {
  if (val == null) return "—";
  if (key.includes("algorithm")) return formatAlgorithmLabel(String(val));
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : val.toFixed(4);
  return String(val);
}

function MetricsTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);
  return (
    <div className="scientific-card overflow-x-auto p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {columns.map((key) => (
              <th key={key} className="p-2 capitalize">
                {key.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b">
              {columns.map((key) => (
                <td key={key} className="p-2">
                  {formatCell(key, row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComparisonProContent() {
  const router = useRouter();
  const [tab, setTab] = useState<ProTab>("multi");
  const [experiments, setExperiments] = useState<ExperimentBrowseItem[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkOption[]>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [algoA, setAlgoA] = useState("sobel");
  const [algoB, setAlgoB] = useState("canny");
  const [benchId, setBenchId] = useState("");
  const [multiResult, setMultiResult] = useState<MultiExperimentComparison | null>(null);
  const [benchSummary, setBenchSummary] = useState<BenchmarkSummary | null>(null);
  const [datasetRanking, setDatasetRanking] = useState<GlobalDatasetRanking | null>(null);
  const [algoResult, setAlgoResult] = useState<AlgorithmComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  const completedExperiments = useMemo(
    () => experiments.filter((e) => e.status === "completed"),
    [experiments],
  );

  useEffect(() => {
    Promise.all([
      experimentService.browse({ status: "completed", limit: 100 }),
      apiFetch<BenchmarkOption[]>("/api/benchmarks"),
    ])
      .then(([expBrowse, benchList]) => {
        setExperiments(expBrowse.items);
        setBenchmarks(benchList);
        if (benchList[0]) setBenchId(benchList[0].id);
      })
      .finally(() => setInitLoading(false));
  }, []);

  const toggleExperiment = (id: string) => {
    setSelectedExpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 100 ? prev : [...prev, id],
    );
  };

  const selectAllCompleted = () => {
    setSelectedExpIds(completedExperiments.slice(0, 100).map((e) => e.id));
  };

  const selectPreset = (n: number) => {
    setSelectedExpIds(completedExperiments.slice(0, n).map((e) => e.id));
  };

  const runMulti = useCallback(async () => {
    setLoading(true);
    setMultiResult(null);
    try {
      setMultiResult(await comparisonService.compareMultiExperiments(selectedExpIds));
    } finally {
      setLoading(false);
    }
  }, [selectedExpIds]);

  const runBenchmarkSummary = useCallback(async () => {
    if (!benchId) return;
    setLoading(true);
    setBenchSummary(null);
    try {
      setBenchSummary(await comparisonService.getBenchmarkSummary(benchId));
    } finally {
      setLoading(false);
    }
  }, [benchId]);

  const runDatasetRanking = useCallback(async () => {
    setLoading(true);
    setDatasetRanking(null);
    try {
      setDatasetRanking(await comparisonService.getGlobalDatasetRanking());
    } finally {
      setLoading(false);
    }
  }, []);

  const runAlgorithmCompare = useCallback(async () => {
    setLoading(true);
    setAlgoResult(null);
    try {
      setAlgoResult(await comparisonService.compareAlgorithms(algoA, algoB));
    } finally {
      setLoading(false);
    }
  }, [algoA, algoB]);

  useEffect(() => {
    if (tab === "datasets") void runDatasetRanking();
  }, [tab, runDatasetRanking]);

  useEffect(() => {
    if (tab === "benchmark" && benchId) void runBenchmarkSummary();
  }, [tab, benchId, runBenchmarkSummary]);

  const handleBenchmarkAction = async (action: string) => {
    if (!benchSummary?.benchmark_id) {
      router.push("/benchmarks");
      return;
    }
    if (action === "run_benchmark" || action === "view_benchmark") {
      router.push("/benchmarks");
      return;
    }
    if (action === "export_report" && benchSummary.run_id) {
      await downloadFile(
        `/api/benchmarks/${benchSummary.benchmark_id}/runs/${benchSummary.run_id}/report/csv`,
        `benchmark-${benchSummary.benchmark_id}-summary.csv`,
      );
      return;
    }
    if (action === "retry_failed" && benchSummary.run_id) {
      await apiFetch(
        `/api/benchmarks/${benchSummary.benchmark_id}/runs/${benchSummary.run_id}/retry-failed`,
        { method: "POST" },
      );
      await runBenchmarkSummary();
      return;
    }
    if (action === "cancel_run" && benchSummary.run_id) {
      await apiFetch(
        `/api/benchmarks/${benchSummary.benchmark_id}/runs/${benchSummary.run_id}/cancel`,
        { method: "POST" },
      );
      await runBenchmarkSummary();
    }
  };

  if (initLoading) return <LoadingState message="Taqqoslash markazi yuklanmoqda..." />;

  const tabs: { id: ProTab; label: string }[] = [
    { id: "multi", label: "Ko'p tajriba analitikasi" },
    { id: "benchmark", label: "Benchmark summary" },
    { id: "datasets", label: "Dataset reytingi" },
    { id: "algorithms", label: "Algoritm vs algoritm" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "multi" && (
        <>
          <div className="scientific-card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={selectAllCompleted}>
                Barcha completed tajribalarni tanlash
              </Button>
              {SELECT_PRESETS.map((n) => (
                <Button key={n} size="sm" variant="ghost" onClick={() => selectPreset(n)}>
                  {n} ta
                </Button>
              ))}
              <span className="text-xs text-muted-foreground">
                Tanlangan: {selectedExpIds.length} / {completedExperiments.length}
              </span>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2 text-sm">
              {completedExperiments.length === 0 ? (
                <p className="text-muted-foreground">Yakunlangan tajribalar yo&apos;q.</p>
              ) : (
                completedExperiments.map((exp) => (
                  <label key={exp.id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedExpIds.includes(exp.id)}
                      onChange={() => toggleExperiment(exp.id)}
                    />
                    {exp.title}
                  </label>
                ))
              )}
            </div>
            <Button onClick={() => void runMulti()} disabled={loading || selectedExpIds.length === 0}>
              {loading ? "Hisoblanmoqda..." : "Algoritm bo'yicha statistika"}
            </Button>
          </div>

          {loading && <LoadingState message="Ko'p tajriba statistikasi hisoblanmoqda..." />}

          {!loading && multiResult && multiResult.status === "empty" && (
            <ActionEmptyState
              title="Ilmiy taqqoslash uchun ma'lumot yetarli emas"
              message={multiResult.message ?? "GT va supervised metrikali completed tajribalar tanlang."}
              actions={["select_experiments"]}
            />
          )}

          {!loading && multiResult && multiResult.status === "ready" && (
            <>
              {multiResult.excluded_experiments.length > 0 && (
                <div className="scientific-card p-4 text-sm">
                  <p className="mb-2 font-semibold">Excluded experiments ({multiResult.excluded_experiments.length})</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {multiResult.excluded_experiments.map((e) => (
                      <li key={e.experiment_id}>
                        {e.title ?? e.experiment_id.slice(0, 8)} — {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <ScientificBarChart
                  title="Avg IoU"
                  data={comparisonService.formatChartPoints(multiResult.charts.avg_iou)}
                />
                <ScientificBarChart
                  title="Avg F1"
                  data={comparisonService.formatChartPoints(multiResult.charts.avg_f1)}
                />
                <ScientificBarChart
                  title="Avg Dice"
                  data={comparisonService.formatChartPoints(multiResult.charts.avg_dice)}
                />
                <ScientificBarChart
                  title="Avg Runtime (ms)"
                  data={comparisonService.formatChartPoints(multiResult.charts.avg_runtime_ms)}
                  formatValue={(v) => v.toFixed(1)}
                />
                <ScientificBarChart
                  title="Sample Count"
                  data={comparisonService.formatChartPoints(multiResult.charts.sample_count)}
                  formatValue={(v) => String(Math.round(v))}
                  domain={[0, "auto"]}
                />
              </div>
              <MetricsTable rows={multiResult.table} />
            </>
          )}
        </>
      )}

      {tab === "benchmark" && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Benchmark
              <select
                className="mt-1 block h-9 min-w-[220px] rounded-md border bg-background px-2 text-sm"
                value={benchId}
                onChange={(e) => setBenchId(e.target.value)}
              >
                {benchmarks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => void runBenchmarkSummary()} disabled={loading || !benchId}>
              Yangilash
            </Button>
          </div>

          {loading && <LoadingState message="Benchmark summary yuklanmoqda..." />}

          {!loading && benchSummary && benchSummary.status !== "ready" && (
            <ActionEmptyState
              title={
                benchSummary.status === "no_run"
                  ? "Benchmark hali ishga tushirilmagan"
                  : benchSummary.status === "running"
                    ? "Benchmark ishlayapti"
                    : "Benchmark summary hozircha mavjud emas"
              }
              message={benchSummary.message}
              actions={benchSummary.actions ?? ["run_benchmark"]}
              onAction={(action) => void handleBenchmarkAction(action)}
            />
          )}

          {!loading && benchSummary && benchSummary.status === "ready" && (
            <>
              <div className="scientific-card grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Rasmlar</p>
                  <p className="font-semibold">{benchSummary.image_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GT</p>
                  <p className="font-semibold">{benchSummary.gt_count}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completed</p>
                  <p className="font-semibold">
                    {benchSummary.completed_count}/{benchSummary.cohort_size}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Failed</p>
                  <p className="font-semibold">{benchSummary.failed_count ?? 0}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleBenchmarkAction("export_report")}>
                  CSV eksport
                </Button>
                {benchSummary.run_id && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void downloadFile(
                          `/api/benchmarks/${benchSummary.benchmark_id}/runs/${benchSummary.run_id}/report/xlsx`,
                          `benchmark-${benchSummary.benchmark_id}-summary.xlsx`,
                        )
                      }
                    >
                      XLSX eksport
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void downloadFile(
                          `/api/benchmarks/${benchSummary.benchmark_id}/runs/${benchSummary.run_id}/report/pdf`,
                          `benchmark-${benchSummary.benchmark_id}-summary.pdf`,
                        )
                      }
                    >
                      PDF eksport
                    </Button>
                  </>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ScientificBarChart
                  title="Avg IoU"
                  data={comparisonService.formatChartPoints(benchSummary.charts.avg_iou)}
                />
                <ScientificBarChart
                  title="Avg F1"
                  data={comparisonService.formatChartPoints(benchSummary.charts.avg_f1)}
                />
                <ScientificBarChart
                  title="Avg Dice"
                  data={comparisonService.formatChartPoints(benchSummary.charts.avg_dice)}
                />
                <ScientificBarChart
                  title="Avg Runtime (ms)"
                  data={comparisonService.formatChartPoints(benchSummary.charts.avg_runtime_ms)}
                  formatValue={(v) => v.toFixed(1)}
                />
              </div>
              <MetricsTable rows={benchSummary.table} />
            </>
          )}
        </>
      )}

      {tab === "datasets" && (
        <>
          <div className="flex gap-2">
            <Button onClick={() => void runDatasetRanking()} disabled={loading} variant="outline" size="sm">
              Qayta yuklash
            </Button>
          </div>
          {loading && <LoadingState message="Dataset reytingi yuklanmoqda..." />}
          {!loading && datasetRanking && datasetRanking.status === "empty" && (
            <ActionEmptyState
              title="Dataset reytingi hali mavjud emas"
              message={datasetRanking.message}
              actions={["create_benchmark", "run_benchmark"]}
            />
          )}
          {!loading && datasetRanking && datasetRanking.status === "ready" && (
            <>
              <p className="text-sm text-muted-foreground">
                {datasetRanking.run_count} ta completed benchmark run bo&apos;yicha umumiy reyting
              </p>
              <MetricsTable rows={datasetRanking.table} />
            </>
          )}
        </>
      )}

      {tab === "algorithms" && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Algoritm A
              <select
                className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm"
                value={algoA}
                onChange={(e) => setAlgoA(e.target.value)}
              >
                {EDGE_ALGORITHMS.map((a) => (
                  <option key={a} value={a}>
                    {formatAlgorithmLabel(a)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Algoritm B
              <select
                className="mt-1 block h-9 rounded-md border bg-background px-2 text-sm"
                value={algoB}
                onChange={(e) => setAlgoB(e.target.value)}
              >
                {EDGE_ALGORITHMS.map((a) => (
                  <option key={a} value={a}>
                    {formatAlgorithmLabel(a)}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={() => void runAlgorithmCompare()} disabled={loading}>
              Taqqoslash
            </Button>
          </div>
          {loading && <LoadingState message="Algoritmlar taqqoslanmoqda..." />}
          {!loading && algoResult && algoResult.table.length === 0 && (
            <ActionEmptyState
              title="Algoritm taqqoslash uchun ma'lumot yo'q"
              message="Completed supervised tajribalar ishga tushiring."
              actions={["select_experiments"]}
            />
          )}
          {!loading && algoResult && algoResult.table.length > 0 && (
            <>
              <ScientificBarChart
                title="Avg IoU"
                data={algoResult.chart.map((r) => ({
                  algorithm: formatAlgorithmLabel(r.algorithm),
                  value: r.avg_iou,
                }))}
              />
              <MetricsTable rows={algoResult.table} />
            </>
          )}
        </>
      )}
    </div>
  );
}
