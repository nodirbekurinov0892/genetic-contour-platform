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
import { MetricTooltip } from "@/components/scientific/metric-tooltip";
import { WinnerPanel } from "@/components/scientific/winner-panel";
import type { MetricRecord, WinnerInfo } from "@shared/types";

interface SupervisedRow {
  algorithm: string;
  metrics: MetricRecord;
}

interface SupervisedMetricsPanelProps {
  rows: SupervisedRow[];
  winner?: WinnerInfo | null;
  hasGroundTruth?: boolean;
}

export function SupervisedMetricsPanel({
  rows,
  winner = null,
  hasGroundTruth = false,
}: SupervisedMetricsPanelProps) {
  const hasSupervised = rows.some(
    (r) => r.metrics.iou != null || r.metrics.f1_score != null,
  );

  if (!hasSupervised) {
    return (
      <section>
        <SectionHeader
          title="Supervised metrikalar"
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
        title="Supervised metrikalar"
        description="Ground Truth asosida o&apos;lchanadigan metrikalar — g&apos;olib faqat shu blokda"
        badge="Supervised"
      />
      <WinnerPanel winner={winner} hasGroundTruth={hasGroundTruth} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Algoritm</th>
              <th className="px-3 py-2">
                <MetricTooltip metricKey="precision" />
              </th>
              <th className="px-3 py-2">
                <MetricTooltip metricKey="recall" />
              </th>
              <th className="px-3 py-2">
                <MetricTooltip metricKey="f1_score" />
              </th>
              <th className="px-3 py-2">
                <MetricTooltip metricKey="iou" />
              </th>
              <th className="px-3 py-2">
                <MetricTooltip metricKey="dice_coefficient" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.algorithm} className="border-t">
                <td className="px-3 py-2 font-medium">{row.algorithm}</td>
                <td className="px-3 py-2 font-mono text-xs">{fmt(row.metrics.precision)}</td>
                <td className="px-3 py-2 font-mono text-xs">{fmt(row.metrics.recall)}</td>
                <td className="px-3 py-2 font-mono text-xs">{fmt(row.metrics.f1_score)}</td>
                <td className="px-3 py-2 font-mono text-xs">{fmt(row.metrics.iou)}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {fmt(row.metrics.dice_coefficient)}
                </td>
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
          <p className="mb-3 text-sm font-semibold">IoU tartibi (g&apos;olib aniqlash mezoni)</p>
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
