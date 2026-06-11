"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHeader } from "@/components/ui/section-header";
import type { MetricRecord } from "@shared/types";

interface SupervisedRow {
  algorithm: string;
  metrics: MetricRecord;
}

interface SupervisedMetricsPanelProps {
  rows: SupervisedRow[];
}

export function SupervisedMetricsPanel({ rows }: SupervisedMetricsPanelProps) {
  const hasSupervised = rows.some(
    (r) => r.metrics.iou != null || r.metrics.f1_score != null,
  );

  if (!hasSupervised) {
    return (
      <section>
        <SectionHeader
          title="Ground Truth metrikalari"
          description="Ground truth maska yuklangandan keyin Precision, Recall, F1, IoU va Dice hisoblanadi."
          badge="GT"
        />
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Ground truth mavjud emas. Rasm kutubxonasida maska yuklang.
        </p>
      </section>
    );
  }

  const chartData = rows.map((r) => ({
    algorithm: r.algorithm,
    IoU: r.metrics.iou ?? 0,
    F1: r.metrics.f1_score ?? 0,
    Dice: r.metrics.dice_coefficient ?? 0,
  }));

  const ranked = [...rows]
    .filter((r) => r.metrics.iou != null)
    .sort((a, b) => (b.metrics.iou ?? 0) - (a.metrics.iou ?? 0));

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Ground Truth metrikalari"
        description="Supervised baholash: Precision, Recall, F1, IoU, Dice"
        badge="Ilmiy"
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Algoritm</th>
              <th className="px-3 py-2">Precision</th>
              <th className="px-3 py-2">Recall</th>
              <th className="px-3 py-2">F1</th>
              <th className="px-3 py-2">IoU</th>
              <th className="px-3 py-2">Dice</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.algorithm} className="border-t">
                <td className="px-3 py-2 font-medium">{row.algorithm}</td>
                <td className="px-3 py-2">{fmt(row.metrics.precision)}</td>
                <td className="px-3 py-2">{fmt(row.metrics.recall)}</td>
                <td className="px-3 py-2">{fmt(row.metrics.f1_score)}</td>
                <td className="px-3 py-2">{fmt(row.metrics.iou)}</td>
                <td className="px-3 py-2">{fmt(row.metrics.dice_coefficient)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="scientific-card p-4">
          <p className="mb-3 text-sm font-semibold">IoU / F1 / Dice taqqoslash</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="algorithm" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="IoU" fill="#2563eb" />
                <Bar dataKey="F1" fill="#16a34a" />
                <Bar dataKey="Dice" fill="#9333ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="scientific-card p-4">
          <p className="mb-3 text-sm font-semibold">Algoritm reytingi (IoU)</p>
          <ol className="space-y-2">
            {ranked.map((row, i) => (
              <li
                key={row.algorithm}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  #{i + 1} {row.algorithm}
                </span>
                <span className="font-mono text-primary">
                  {(row.metrics.iou ?? 0).toFixed(4)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function fmt(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(4);
}
