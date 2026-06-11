"use client";

import { MetricTooltip } from "@/components/scientific/metric-tooltip";
import { cn } from "@/lib/utils";

export interface MetricsRow {
  algorithm: string;
  edge_density: number | null;
  continuity_score: number | null;
  noise_score: number | null;
  fitness_score: number | null;
  runtime_ms: number | null;
}

interface MetricsTableProps {
  rows: MetricsRow[];
  className?: string;
  highlightBest?: boolean;
}

function bestKey(rows: MetricsRow[], key: keyof MetricsRow, mode: "max" | "min" = "max") {
  const values = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number");
  if (!values.length) return null;
  return mode === "max" ? Math.max(...values) : Math.min(...values);
}

export function MetricsTable({ rows, className, highlightBest = false }: MetricsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Metrika ma&apos;lumotlari mavjud emas.
      </p>
    );
  }

  const lowestNoise = highlightBest ? bestKey(rows, "noise_score", "min") : null;
  const fastest = highlightBest ? bestKey(rows, "runtime_ms", "min") : null;

  return (
    <div className={cn("overflow-x-auto rounded-xl border", className)}>
      <table className="metrics-table w-full">
        <thead>
          <tr>
            <th>Algoritm</th>
            <th className="text-right">
              <MetricTooltip metricKey="edge_density" />
            </th>
            <th className="text-right">
              <MetricTooltip metricKey="continuity_score" />
            </th>
            <th className="text-right">
              <MetricTooltip metricKey="noise_score" />
            </th>
            <th className="text-right">
              <MetricTooltip metricKey="fitness_score" />
            </th>
            <th className="text-right">Ishlash vaqti</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.algorithm}>
              <td className="font-medium">{row.algorithm}</td>
              <td className="text-right font-mono text-xs">
                {(row.edge_density ?? 0).toFixed(4)}
              </td>
              <td className="text-right font-mono text-xs">
                {(row.continuity_score ?? 0).toFixed(4)}
              </td>
              <td
                className={cn(
                  "text-right font-mono text-xs",
                  row.noise_score === lowestNoise &&
                    lowestNoise != null &&
                    "font-semibold text-emerald-600 dark:text-emerald-400",
                )}
              >
                {(row.noise_score ?? 0).toFixed(4)}
              </td>
              <td className="text-right font-mono text-xs text-muted-foreground">
                {row.fitness_score?.toFixed(4) ?? "—"}
              </td>
              <td
                className={cn(
                  "text-right font-mono text-xs",
                  row.runtime_ms === fastest &&
                    fastest != null &&
                    "font-semibold text-emerald-600 dark:text-emerald-400",
                )}
              >
                {row.runtime_ms != null ? `${row.runtime_ms} ms` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Heuristik metrikalar — algoritm ustunligini isbotlamaydi. Fitness faqat GA ichki
        optimallashtirish metrikasi.
      </p>
    </div>
  );
}
