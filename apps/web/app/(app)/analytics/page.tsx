"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { WorkflowNextStep } from "@/components/layout/workflow-next-step";
import { LoadingState, ErrorState } from "@/components/ui/state-panel";
import { analyticsService, type AdvancedAnalytics } from "@/services/analyticsService";
import { formatAlgorithmLabel } from "@/lib/user-labels";
import { FlaskConical, Timer, Target, Trophy } from "lucide-react";
import { API_BASE } from "@/lib/api";

export default function AnalyticsPage() {
  const [data, setData] = useState<AdvancedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyticsService
      .getAdvanced()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Analitika yuklanmoqda..." />;
  if (error || !data) {
    return (
      <ErrorState
        title="Analitika markazini yuklab bo&apos;lmadi"
        message={error ?? "Ma'lumot yo'q"}
        hint={`API ${API_BASE}`}
      />
    );
  }

  const { summary } = data;

  const leaderboardChart = data.algorithm_leaderboard.map((e) => ({
    name: formatAlgorithmLabel(e.algorithm),
    avg_iou: e.avg_iou,
    avg_f1: e.avg_f1 ?? 0,
  }));

  const iouDistribution = data.iou_distribution.map((b) => ({
    name: b.bin,
    count: b.count,
  }));

  const trendChart = data.trend_analysis.map((t) => ({
    name: t.date.slice(5),
    experiments: t.experiments,
    avg_iou: t.avg_iou,
  }));

  const runtimeChart = Object.entries(data.runtime_analytics).map(([algo, stats]) => ({
    name: formatAlgorithmLabel(algo),
    mean: stats.mean ?? 0,
    median: stats.median ?? 0,
  }));

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Analitika markazi"
        description="Real DB metrikalari — algoritm reytingi, IoU taqsimoti, trend va runtime tahlili"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Jami tajribalar"
          value={summary.total_experiments}
          subtitle={`${summary.completed_experiments} yakunlangan · ${summary.success_rate_pct}% muvaffaqiyat`}
          icon={FlaskConical}
          accent="blue"
        />
        <StatCard
          title="Eng yaxshi algoritm"
          value={formatAlgorithmLabel(data.top_algorithm)}
          subtitle={data.worst_algorithm ? `Eng past: ${formatAlgorithmLabel(data.worst_algorithm)}` : "—"}
          icon={Target}
          accent="green"
        />
        <StatCard
          title="Benchmark ishga tushirishlar"
          value={summary.benchmark_runs}
          subtitle={`${summary.algorithms_count} algoritm`}
          icon={Trophy}
          accent="amber"
        />
        <StatCard
          title="O&apos;rtacha IoU"
          value={data.iou_statistics.mean?.toFixed(4) ?? "—"}
          subtitle={`N=${data.iou_statistics.count}`}
          icon={Timer}
          accent="slate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="scientific-card p-5">
          <SectionHeader title="Algoritm reytingi" description="O&apos;rtacha IoU bo&apos;yicha" />
          {leaderboardChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Metrikalar yo&apos;q.{" "}
              <Link href="/experiments/new" className="text-primary underline">
                Yangi tajriba
              </Link>
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaderboardChart} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="avg_iou" name="Avg IoU" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="scientific-card p-5">
          <SectionHeader title="IoU taqsimoti" description="Histogramma (real metrikalar)" />
          {iouDistribution.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">IoU ma&apos;lumotlari yo&apos;q</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={iouDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Soni" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="scientific-card p-5">
          <SectionHeader title="30 kunlik trend" description="Tajribalar va o&apos;rtacha IoU" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 1]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="experiments"
                  name="Tajribalar"
                  stroke="hsl(var(--primary))"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avg_iou"
                  name="Avg IoU"
                  stroke="hsl(142 76% 36%)"
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="scientific-card p-5">
          <SectionHeader title="Runtime tahlili" description="Algoritm bo&apos;yicha o&apos;rtacha va median (ms)" />
          {runtimeChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Runtime ma&apos;lumotlari yo&apos;q</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={runtimeChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mean" name="O'rtacha" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="median" name="Median" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {data.algorithm_leaderboard.length > 0 && (
        <section className="scientific-card overflow-x-auto p-5">
          <SectionHeader title="To&apos;liq reyting jadvali" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">#</th>
                <th className="p-2">Algoritm</th>
                <th className="p-2">Avg IoU</th>
                <th className="p-2">Avg F1</th>
                <th className="p-2">Avg Dice</th>
                <th className="p-2">Runtime (ms)</th>
                <th className="p-2">N</th>
              </tr>
            </thead>
            <tbody>
              {data.algorithm_leaderboard.map((e) => (
                <tr key={e.algorithm} className="border-b">
                  <td className="p-2">{e.rank}</td>
                  <td className="p-2">{formatAlgorithmLabel(e.algorithm)}</td>
                  <td className="p-2">{e.avg_iou.toFixed(4)}</td>
                  <td className="p-2">{e.avg_f1?.toFixed(4) ?? "—"}</td>
                  <td className="p-2">{e.avg_dice?.toFixed(4) ?? "—"}</td>
                  <td className="p-2">{e.avg_runtime_ms?.toFixed(1) ?? "—"}</td>
                  <td className="p-2">{e.sample_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <WorkflowNextStep
        title="Keyingi qadam: taqqoslash markazi"
        description="Tajribalar, algoritmlar va benchmarklarni yonma-yon tahlil qiling"
        href="/comparison"
        label="Taqqoslash markaziga o'tish"
      />
    </div>
  );
}
