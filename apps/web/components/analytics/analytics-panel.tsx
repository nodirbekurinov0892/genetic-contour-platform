"use client";

import {
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { SectionHeader } from "@/components/ui/section-header";
import type { AlgorithmRunRecord } from "@shared/types";

const LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "GA",
};

interface AnalyticsPanelProps {
  edgeRuns: AlgorithmRunRecord[];
}

export function AnalyticsPanel({ edgeRuns }: AnalyticsPanelProps) {
  const radarData = [
    { metric: "Continuity", full: 1 },
    { metric: "Fitness", full: 1 },
    { metric: "Low Noise", full: 1 },
    { metric: "IoU", full: 1 },
    { metric: "Speed", full: 1 },
  ];

  const maxRuntime = Math.max(...edgeRuns.map((r) => r.metrics[0]?.runtime_ms ?? 0), 1);

  for (const run of edgeRuns) {
    const m = run.metrics[0];
    if (!m) continue;
    const key = LABELS[run.algorithm_name] ?? run.algorithm_name;
    for (const row of radarData) {
      const existing = (row as Record<string, number | string>)[key];
      if (existing !== undefined) continue;
      if (row.metric === "Continuity") {
        (row as Record<string, number | string>)[key] = m.continuity_score ?? 0;
      } else if (row.metric === "Fitness") {
        (row as Record<string, number | string>)[key] = m.fitness_score ?? m.edge_density ?? 0;
      } else if (row.metric === "Low Noise") {
        (row as Record<string, number | string>)[key] = 1 - (m.noise_score ?? 0);
      } else if (row.metric === "IoU") {
        (row as Record<string, number | string>)[key] = m.iou ?? 0;
      } else if (row.metric === "Speed") {
        (row as Record<string, number | string>)[key] =
          1 - (m.runtime_ms ?? 0) / maxRuntime;
      }
    }
  }

  const ranking = edgeRuns
    .map((run) => {
      const m = run.metrics[0];
      const score =
        (m?.iou ?? 0) * 0.35 +
        (m?.continuity_score ?? 0) * 0.25 +
        (1 - (m?.noise_score ?? 0)) * 0.2 +
        (m?.f1_score ?? 0) * 0.2;
      return {
        algorithm: LABELS[run.algorithm_name] ?? run.algorithm_name,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const gaRun = edgeRuns.find((r) => r.algorithm_name === "genetic");
  const varianceData =
    gaRun?.generation_history.map((g) => ({
      generation: g.generation,
      variance: Math.max(0, g.average_fitness - g.best_fitness * 0.1),
      best: g.best_fitness,
      avg: g.average_fitness,
    })) ?? [];

  const fitnessComponents = gaRun?.result_json?.fitness_components as
    | Record<string, number>
    | undefined;

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Kengaytirilgan analitika"
        description="Radar, reyting, konvergensiya va fitness komponentlari"
        badge="Analytics"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold">Radar chart</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                {edgeRuns.map((run, i) => {
                  const key = LABELS[run.algorithm_name] ?? run.algorithm_name;
                  const colors = ["#2563eb", "#16a34a", "#f59e0b", "#9333ea"];
                  return (
                    <Radar
                      key={run.id}
                      name={key}
                      dataKey={key}
                      stroke={colors[i % colors.length]}
                      fill={colors[i % colors.length]}
                      fillOpacity={0.15}
                    />
                  );
                })}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold">Algoritm reytingi</p>
          <ol className="space-y-2">
            {ranking.map((row, i) => (
              <li
                key={row.algorithm}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  #{i + 1} {row.algorithm}
                </span>
                <span className="font-mono">{row.score.toFixed(4)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {varianceData.length > 0 && (
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold">GA konvergensiya va variance</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={varianceData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="generation" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="best" stroke="#2563eb" dot={false} />
                <Line type="monotone" dataKey="avg" stroke="#94a3b8" dot={false} />
                <Line type="monotone" dataKey="variance" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {fitnessComponents && (
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold">Fitness komponentlari (GA)</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(fitnessComponents).map(([key, value]) => (
              <div key={key} className="rounded-md border px-3 py-2 text-sm">
                <p className="text-xs text-muted-foreground">{key}</p>
                <p className="font-mono font-semibold">{Number(value).toFixed(4)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
