"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { ErrorState, LoadingState } from "@/components/ui/state-panel";
import { leaderboardService, type LeaderboardCenter } from "@/services/leaderboardService";
import { formatAlgorithmLabel } from "@/lib/user-labels";

function RankTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string; format?: (v: unknown) => string }[];
}) {
  if (rows.length === 0) {
    return (
      <div className="scientific-card p-4">
        <p className="mb-2 text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">Hali ma&apos;lumot yo&apos;q — tajriba yoki benchmark ishga tushiring.</p>
      </div>
    );
  }
  return (
    <div className="scientific-card overflow-x-auto p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {columns.map((c) => (
              <th key={c.key} className="p-2">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b">
              {columns.map((c) => (
                <td key={c.key} className="p-2 font-mono">
                  {c.format ? c.format(row[c.key]) : String(row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    leaderboardService
      .getCenter()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklash xatosi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Leaderboard yuklanmoqda..." />;
  if (error || !data) return <ErrorState message={error ?? "Ma'lumot yo'q"} />;

  const metricCol = (key: string, label: string) => ({
    key,
    label,
    format: (v: unknown) => (typeof v === "number" ? v.toFixed(4) : "—"),
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Leaderboard Center"
        description="Algoritm, dataset, benchmark va tajribalar bo'yicha haqiqiy PostgreSQL reytingi"
        badge="Enterprise"
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <RankTable
          title="Top Algorithms (Avg IoU)"
          rows={data.top_algorithms}
          columns={[
            { key: "rank", label: "#" },
            { key: "algorithm", label: "Algoritm", format: (v) => formatAlgorithmLabel(String(v ?? "")) },
            metricCol("avg_iou", "Avg IoU"),
            metricCol("avg_f1", "Avg F1"),
            { key: "sample_count", label: "Samples" },
          ]}
        />
        <RankTable
          title="Top Datasets"
          rows={data.top_datasets}
          columns={[
            { key: "rank", label: "#" },
            { key: "dataset", label: "Dataset" },
            metricCol("avg_iou", "Avg IoU"),
            { key: "sample_count", label: "Samples" },
          ]}
        />
        <RankTable
          title="Top Benchmarks"
          rows={data.top_benchmarks}
          columns={[
            { key: "rank", label: "#" },
            { key: "benchmark", label: "Benchmark" },
            { key: "winning_algorithm", label: "Winner", format: (v) => formatAlgorithmLabel(String(v ?? "")) },
            metricCol("avg_iou", "Avg IoU"),
          ]}
        />
        <RankTable
          title="Top Experiments"
          rows={data.top_experiments}
          columns={[
            { key: "rank", label: "#" },
            { key: "experiment", label: "Tajriba" },
            metricCol("best_iou", "Best IoU"),
            { key: "avg_runtime_ms", label: "Avg ms", format: (v) => (typeof v === "number" ? v.toFixed(1) : "—") },
          ]}
        />
        <RankTable
          title="Top Speed"
          rows={data.top_speed}
          columns={[
            { key: "rank", label: "#" },
            { key: "algorithm", label: "Algoritm", format: (v) => formatAlgorithmLabel(String(v ?? "")) },
            { key: "avg_runtime_ms", label: "Avg ms", format: (v) => (typeof v === "number" ? v.toFixed(1) : "—") },
          ]}
        />
        <RankTable
          title="Top Researchers"
          rows={data.top_researchers}
          columns={[
            { key: "rank", label: "#" },
            { key: "researcher", label: "Tadqiqotchi" },
            { key: "experiments", label: "Tajribalar" },
            metricCol("avg_iou", "Avg IoU"),
          ]}
        />
      </div>
    </div>
  );
}
