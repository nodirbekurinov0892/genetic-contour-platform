"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ALGORITHMS } from "@shared/constants";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state-panel";
import { comparisonService, type AlgorithmComparison, type BenchmarkComparison, type DatasetRankingComparison, type ExperimentComparison } from "@/services/comparisonService";
import { experimentService } from "@/services/experimentService";
import { apiFetch } from "@/lib/api";
import { formatAlgorithmLabel } from "@/lib/user-labels";
import type { ExperimentBrowseItem } from "@shared/types";

type ProTab = "experiments" | "algorithms" | "benchmarks" | "datasets";

interface BenchmarkOption {
  id: string;
  name: string;
}

const EDGE_ALGORITHMS = ALGORITHMS.filter((a) => a.id !== "compare_all").map((a) => a.id);

export function ComparisonProContent() {
  const [tab, setTab] = useState<ProTab>("experiments");
  const [experiments, setExperiments] = useState<ExperimentBrowseItem[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkOption[]>([]);
  const [expA, setExpA] = useState("");
  const [expB, setExpB] = useState("");
  const [algoA, setAlgoA] = useState("sobel");
  const [algoB, setAlgoB] = useState("canny");
  const [benchA, setBenchA] = useState("");
  const [benchB, setBenchB] = useState("");
  const [benchDataset, setBenchDataset] = useState("");
  const [result, setResult] = useState<
    ExperimentComparison | AlgorithmComparison | BenchmarkComparison | DatasetRankingComparison | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      experimentService.browse({ status: "completed", limit: 50 }),
      apiFetch<BenchmarkOption[]>("/api/benchmarks"),
    ])
      .then(([expBrowse, benchList]) => {
        setExperiments(expBrowse.items);
        setBenchmarks(benchList);
        if (expBrowse.items[0]) setExpA(expBrowse.items[0].id);
        if (expBrowse.items[1]) setExpB(expBrowse.items[1].id);
        if (benchList[0]) {
          setBenchA(benchList[0].id);
          setBenchDataset(benchList[0].id);
        }
        if (benchList[1]) setBenchB(benchList[1].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklash xatosi"))
      .finally(() => setInitLoading(false));
  }, []);

  const runComparison = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (tab === "experiments") {
        if (!expA || !expB) throw new Error("Ikkala tajribani tanlang");
        setResult(await comparisonService.compareExperiments(expA, expB));
      } else if (tab === "algorithms") {
        setResult(await comparisonService.compareAlgorithms(algoA, algoB));
      } else if (tab === "benchmarks") {
        if (!benchA || !benchB) throw new Error("Ikkala benchmarkni tanlang");
        setResult(await comparisonService.compareBenchmarks(benchA, benchB));
      } else {
        if (!benchDataset) throw new Error("Benchmark tanlang");
        setResult(await comparisonService.compareDatasets(benchDataset));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Taqqoslash xatosi");
    } finally {
      setLoading(false);
    }
  }, [tab, expA, expB, algoA, algoB, benchA, benchB, benchDataset]);

  if (initLoading) return <LoadingState message="Taqqoslash ma'lumotlari yuklanmoqda..." />;

  const tabs: { id: ProTab; label: string }[] = [
    { id: "experiments", label: "Tajriba vs tajriba" },
    { id: "algorithms", label: "Algoritm vs algoritm" },
    { id: "benchmarks", label: "Benchmark vs benchmark" },
    { id: "datasets", label: "Dataset reytingi" },
  ];

  const table = result?.table ?? [];
  const chart = "chart" in (result ?? {}) ? (result as ExperimentComparison | AlgorithmComparison | BenchmarkComparison).chart ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTab(t.id);
              setResult(null);
              setError(null);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {tab === "experiments" && (
          <>
            <label className="text-sm">
              Tajriba A
              <select
                className="mt-1 block h-9 min-w-[200px] rounded-md border bg-background px-2 text-sm"
                value={expA}
                onChange={(e) => setExpA(e.target.value)}
              >
                {experiments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Tajriba B
              <select
                className="mt-1 block h-9 min-w-[200px] rounded-md border bg-background px-2 text-sm"
                value={expB}
                onChange={(e) => setExpB(e.target.value)}
              >
                {experiments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {tab === "algorithms" && (
          <>
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
          </>
        )}
        {tab === "benchmarks" && (
          <>
            <label className="text-sm">
              Benchmark A
              <select
                className="mt-1 block h-9 min-w-[180px] rounded-md border bg-background px-2 text-sm"
                value={benchA}
                onChange={(e) => setBenchA(e.target.value)}
              >
                {benchmarks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Benchmark B
              <select
                className="mt-1 block h-9 min-w-[180px] rounded-md border bg-background px-2 text-sm"
                value={benchB}
                onChange={(e) => setBenchB(e.target.value)}
              >
                {benchmarks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {tab === "datasets" && (
          <label className="text-sm">
            Benchmark
            <select
              className="mt-1 block h-9 min-w-[220px] rounded-md border bg-background px-2 text-sm"
              value={benchDataset}
              onChange={(e) => setBenchDataset(e.target.value)}
            >
              {benchmarks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button onClick={() => void runComparison()} disabled={loading}>
          {loading ? "Taqqoslanmoqda..." : "Taqqoslash"}
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={() => void runComparison()} />}

      {loading && <LoadingState message="Natijalar yuklanmoqda..." />}

      {!loading && result && table.length === 0 && (
        <div className="scientific-card p-6 text-center text-sm text-muted-foreground">
          Tanlangan benchmark uchun yakunlangan cohort run topilmadi yoki dataset reytingi bo&apos;sh.
        </div>
      )}

      {!loading && result && table.length > 0 && (
        <>
          {chart.length > 0 && tab !== "datasets" && (
            <div className="scientific-card p-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chart.map((row) => ({
                      ...row,
                      algorithm: formatAlgorithmLabel(String(row.algorithm ?? "")),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="algorithm" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {"experiment_a" in chart[0] && (
                      <>
                        <Bar dataKey="experiment_a" name="Tajriba A" fill="hsl(var(--primary))" />
                        <Bar dataKey="experiment_b" name="Tajriba B" fill="hsl(217 91% 60%)" />
                      </>
                    )}
                    {"avg_iou" in chart[0] && !("experiment_a" in chart[0]) && (
                      <Bar dataKey="avg_iou" name="Avg IoU" fill="hsl(var(--primary))" />
                    )}
                    {"benchmark_a" in chart[0] && (
                      <>
                        <Bar dataKey="benchmark_a" name="Benchmark A" fill="hsl(var(--primary))" />
                        <Bar dataKey="benchmark_b" name="Benchmark B" fill="hsl(217 91% 60%)" />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="scientific-card overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {Object.keys(table[0]).map((key) => (
                    <th key={key} className="p-2 capitalize">
                      {key.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((row, idx) => (
                  <tr key={idx} className="border-b">
                    {Object.entries(row).map(([key, val]) => (
                      <td key={key} className="p-2">
                        {key.includes("algorithm") || key === "winner_algorithm"
                          ? formatAlgorithmLabel(val as string | null)
                          : typeof val === "number"
                            ? val.toFixed(4)
                            : String(val ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
