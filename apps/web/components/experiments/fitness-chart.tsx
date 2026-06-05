"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { GenerationHistoryRecord } from "@shared/types";
import { SectionHeader } from "@/components/ui/section-header";

interface FitnessChartProps {
  history: GenerationHistoryRecord[];
}

export function FitnessChart({ history }: FitnessChartProps) {
  if (history.length === 0) {
    return (
      <div className="scientific-card p-8 text-center text-sm text-muted-foreground">
        No generation history available for this experiment.
      </div>
    );
  }

  const bestFinal = history[history.length - 1]?.best_fitness ?? 0;
  const improvement =
    history.length > 1
      ? ((history[history.length - 1].best_fitness - history[0].best_fitness) /
          Math.max(history[0].best_fitness, 0.0001)) *
        100
      : 0;

  return (
    <div className="scientific-card overflow-hidden">
      <div className="border-b bg-muted/30 px-6 py-4">
        <SectionHeader
          title="GA Fitness Evolution"
          description={`${history.length} generations · Final best fitness: ${bestFinal.toFixed(4)} · Improvement: ${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}%`}
          badge="Genetic Algorithm"
          className="mb-0"
        />
      </div>
      <div className="p-6">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={history} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
            <XAxis
              dataKey="generation"
              label={{ value: "Generation", position: "insideBottom", offset: -5, fontSize: 12 }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              label={{ value: "Fitness Score", angle: -90, position: "insideLeft", fontSize: 12 }}
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [value.toFixed(4), ""]}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <ReferenceLine
              y={bestFinal}
              stroke="hsl(var(--primary))"
              strokeDasharray="4 4"
              label={{ value: "Final best", fontSize: 10, fill: "hsl(var(--primary))" }}
            />
            <Line
              type="monotone"
              dataKey="best_fitness"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Best Fitness"
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="average_fitness"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              name="Average Fitness"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
