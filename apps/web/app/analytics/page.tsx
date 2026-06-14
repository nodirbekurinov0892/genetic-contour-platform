"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { LoadingState, ErrorState } from "@/components/ui/state-panel";
import { statsService, type PlatformStats } from "@/services/statsService";
import { ALGORITHMS } from "@shared/constants";
import { FlaskConical, ImageIcon, Timer, Target, Activity } from "lucide-react";
import { API_BASE } from "@/lib/api";

const ALGO_LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "Genetic Algorithm",
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    statsService
      .get()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Analitika yuklanmoqda..." />;
  if (error || !stats) {
    return (
      <ErrorState
        title="Analitika markazini yuklab bo'lmadi"
        message={error ?? "Ma'lumot yo'q"}
        hint={`API ${API_BASE}`}
      />
    );
  }

  const supervisedChart = [
    { name: "IoU", value: stats.avg_iou ?? 0 },
    { name: "F1", value: stats.avg_f1 ?? 0 },
    { name: "Dice", value: stats.avg_dice ?? 0 },
  ].filter((d) => d.value > 0);

  const activityChart = stats.activity_7d.map((d) => ({
    name: d.date.slice(5),
    count: d.count,
  }));

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Analitika markazi"
        description="Platforma bo'ylab tajribalar, GT qamrovi va o'rtacha metrikalar"
        badge="Analytics Center"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Jami tajribalar"
          value={stats.total_experiments}
          subtitle={`${stats.completed_experiments} yakunlangan`}
          icon={FlaskConical}
          accent="blue"
        />
        <StatCard
          title="GT qamrovi"
          value={`${stats.gt_coverage_pct}%`}
          subtitle={`${stats.paired_images} / ${stats.total_images} juft`}
          icon={Target}
          accent="green"
        />
        <StatCard
          title="O'rtacha runtime"
          value={stats.avg_runtime_ms != null ? `${stats.avg_runtime_ms} ms` : "—"}
          subtitle="Barcha algoritmlar bo'yicha"
          icon={Timer}
          accent="amber"
        />
        <StatCard
          title="Eng ko'p ishlatilgan"
          value={
            stats.most_used_algorithm
              ? ALGO_LABELS[stats.most_used_algorithm] ?? stats.most_used_algorithm
              : "—"
          }
          subtitle="Algoritm tanlovi"
          icon={Activity}
          accent="slate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="scientific-card p-4">
          <SectionHeader
            title="Supervised o'rtachalar"
            description="Faqat Ground Truth bilan hisoblangan metrikalar"
            badge="GT"
          />
          {supervisedChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              GT bilan tajribalar yo&apos;q.{" "}
              <Link href="/experiments/new" className="text-primary underline">
                Yangi tajriba
              </Link>
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={supervisedChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="scientific-card p-4">
          <SectionHeader title="7 kunlik faollik" description="Yaratilgan tajribalar" badge="7d" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="scientific-card p-4">
        <SectionHeader title="Platforma ko'rsatkichlari" />
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Yuklangan rasmlar</dt>
            <dd className="text-lg font-semibold">{stats.total_images}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">O'rtacha IoU</dt>
            <dd className="text-lg font-semibold">{stats.avg_iou?.toFixed(4) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">O'rtacha F1</dt>
            <dd className="text-lg font-semibold">{stats.avg_f1?.toFixed(4) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">O'rtacha Dice</dt>
            <dd className="text-lg font-semibold">{stats.avg_dice?.toFixed(4) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Algoritmlar</dt>
            <dd className="text-lg font-semibold">
              {ALGORITHMS.filter((a) => a.id !== "compare_all")
                .map((a) => a.label)
                .join(" · ")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Muvaffaqiyatsiz tajribalar</dt>
            <dd className="text-lg font-semibold">{stats.failed_experiments}</dd>
          </div>
        </dl>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/comparison">Taqqoslash markazi</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/reports">Hisobotlar</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
