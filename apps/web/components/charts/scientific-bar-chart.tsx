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
import { EmptyState } from "@/components/ui/state-panel";

export interface ChartPoint {
  algorithm: string;
  value: number | null;
}

interface ScientificBarChartProps {
  title: string;
  data: ChartPoint[];
  valueLabel?: string;
  domain?: [number | "auto", number | "auto"];
  formatValue?: (value: number) => string;
  height?: number;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

export function ScientificBarChart({
  title,
  data,
  valueLabel = "Qiymat",
  domain,
  formatValue = (v) => v.toFixed(4),
  height = 260,
}: ScientificBarChartProps) {
  const points = data.filter((d) => d.value != null);
  if (points.length === 0) {
    return (
      <div className="scientific-card p-4">
        <p className="mb-2 text-sm font-semibold">{title}</p>
        <EmptyState
          title="Grafik uchun ma'lumot yo'q"
          description="Tanlangan filtrlarda metrikalar topilmadi."
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className="scientific-card p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.6)" />
            <XAxis
              dataKey="algorithm"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number) => [formatValue(value), valueLabel]}
            />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
