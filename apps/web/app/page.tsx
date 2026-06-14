"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  FlaskConical,
  GitCompare,
  ImageIcon,
  Layers,
  Target,
  Timer,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExperimentStatusBadge } from "@/components/experiments/experiment-status-badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { useAuth } from "@/components/providers/auth-provider";
import { experimentService } from "@/services/experimentService";
import { statsService, type PlatformStats } from "@/services/statsService";
import { PLATFORM_NAME, PLATFORM_SUBTITLE } from "@shared/constants";
import type { ExperimentRecord } from "@shared/types";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state-panel";
import { API_BASE } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const ALGO_LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "Genetic Algorithm",
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    setDataLoading(true);
    setError(null);

    Promise.all([statsService.get(), experimentService.list()])
      .then(([s, exps]) => {
        if (cancelled) return;
        setStats(s);
        setExperiments(exps);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi");
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading) {
    return <LoadingState message="Boshqaruv paneli yuklanmoqda..." />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <div className="flex justify-center">
          <Layers className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">{PLATFORM_NAME}</h1>
        <p className="text-muted-foreground">{PLATFORM_SUBTITLE}</p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/login">Kirish</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/register">Ro&apos;yxatdan o&apos;tish</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (dataLoading && !stats && !error) {
    return <LoadingState message="Statistika yuklanmoqda..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Boshqaruv panelini yuklab bo&apos;lmadi"
        message={error}
        hint={`API ${API_BASE} manzilida ishlayotganini tekshiring`}
      />
    );
  }

  const successRate =
    stats && stats.total_experiments > 0
      ? Math.round((stats.completed_experiments / stats.total_experiments) * 100)
      : 0;

  const activityChart =
    stats?.activity_7d.map((d) => ({ name: d.date.slice(5), count: d.count })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span className="scientific-badge">Analytics Platform</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Boshqaruv paneli</h1>
          <p className="text-muted-foreground">{PLATFORM_SUBTITLE}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/comparison">Taqqoslash</Link>
          </Button>
          <Button asChild>
            <Link href="/experiments/new">Yangi tajriba</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Jami tajribalar"
          value={stats?.total_experiments ?? 0}
          subtitle={`${stats?.completed_experiments ?? 0} ta yakunlangan`}
          icon={FlaskConical}
          accent="blue"
          trend={{ label: `${successRate}% muvaffaqiyat`, positive: successRate >= 50 }}
        />
        <StatCard
          title="GT qamrovi"
          value={`${stats?.gt_coverage_pct ?? 0}%`}
          subtitle={`${stats?.paired_images ?? 0} / ${stats?.total_images ?? 0} juft`}
          icon={Target}
          accent="green"
        />
        <StatCard
          title="Eng ko&apos;p algoritm"
          value={
            stats?.most_used_algorithm
              ? ALGO_LABELS[stats.most_used_algorithm] ?? stats.most_used_algorithm
              : "—"
          }
          subtitle="Platforma bo&apos;ylab"
          icon={Activity}
          accent="amber"
        />
        <StatCard
          title="O&apos;rtacha runtime"
          value={stats?.avg_runtime_ms != null ? `${stats.avg_runtime_ms} ms` : "—"}
          subtitle="Barcha algoritmlar"
          icon={Timer}
          accent="slate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="scientific-card p-4 lg:col-span-2">
          <SectionHeader title="So&apos;nggi tajribalar" description="Eng yangi tahlillar" />
          {experiments.length === 0 ? (
            <EmptyState
              title="Hali tajribalar yo&apos;q"
              action={
                <Button asChild size="sm">
                  <Link href="/experiments/new">Birinchi tajriba</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {experiments.slice(0, 6).map((exp) => (
                <Link
                  key={exp.id}
                  href={`/experiments/${exp.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  <div>
                    <p className="font-medium">{exp.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(exp.created_at)}</p>
                  </div>
                  <ExperimentStatusBadge status={exp.status} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="scientific-card p-4">
          <SectionHeader title="7 kunlik faollik" badge="7d" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Rasmlar</p>
              <p className="font-semibold">{stats?.total_images ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">O&apos;rtacha IoU</p>
              <p className="font-semibold">{stats?.avg_iou?.toFixed(3) ?? "—"}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/library">
            <ImageIcon className="mr-1 h-4 w-4" />
            Rasm kutubxonasi
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/analytics">Analitika markazi</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/comparison">
            <GitCompare className="mr-1 h-4 w-4" />
            Taqqoslash markazi
          </Link>
        </Button>
      </section>
    </div>
  );
}
