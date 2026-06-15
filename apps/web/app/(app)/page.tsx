"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, FlaskConical, Target, Timer } from "lucide-react";
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
import { WorkflowStrip } from "@/components/layout/workflow-strip";
import { experimentService } from "@/services/experimentService";
import { statsService, type PlatformStats } from "@/services/statsService";
import type { ExperimentRecord } from "@shared/types";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state-panel";
import { API_BASE } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { formatAlgorithmLabel } from "@/lib/user-labels";

export default function DashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !stats && !error) {
    return <LoadingState message="Boshqaruv paneli yuklanmoqda..." />;
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

  const workflowStep = experiments.some((e) => e.status === "completed")
    ? 5
    : experiments.length > 0
      ? 5
      : stats && stats.total_images > 0
        ? 2
        : 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Boshqaruv paneli</h1>
          <p className="mt-1 text-muted-foreground">
            Tajriba jarayonini boshqaring va natijalarni kuzating
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/experiments/new">Yangi tajriba</Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href="/experiments">So&apos;nggi tajribalar</Link>
          </Button>
        </div>
      </div>

      <WorkflowStrip activeStep={workflowStep} />

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
          value={formatAlgorithmLabel(stats?.most_used_algorithm)}
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
        <section className="scientific-card p-5 lg:col-span-2">
          <SectionHeader title="So&apos;nggi tajribalar" description="Eng yangi tahlillar" />
          {experiments.length === 0 ? (
            <EmptyState
              title="Hali tajribalar yo&apos;q"
              description="Birinchi tajribani yaratish uchun wizarddan foydalaning."
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
                  className="flex items-center justify-between rounded-lg border border-border/80 p-3 transition-colors hover:bg-accent/50"
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

        <section className="scientific-card p-5">
          <SectionHeader title="7 kunlik faollik" />
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
    </div>
  );
}
