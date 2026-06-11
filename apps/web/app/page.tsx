"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, ImageIcon, TrendingUp, Dna, CheckCircle2 } from "lucide-react";
import { ExperimentStatusBadge } from "@/components/experiments/experiment-status-badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { useAuth } from "@/components/providers/auth-provider";
import { experimentService } from "@/services/experimentService";
import { statsService, type PlatformStats } from "@/services/statsService";
import type { ExperimentRecord } from "@shared/types";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state-panel";
import { API_BASE } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

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
        <h1 className="text-3xl font-bold">Genetik kontur aniqlash platformasi</h1>
        <p className="text-muted-foreground">
          Rasmlarni yuklash, tajribalarni ishga tushirish va ilmiy hisobotlarni eksport qilish uchun
          tizimga kiring.
        </p>
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
        title="Boshqaruv panelini yuklab bo'lmadi"
        message={error}
        hint={`API ${API_BASE} manzilida ishlayotganini tekshiring`}
      />
    );
  }

  const successRate =
    stats && stats.total_experiments > 0
      ? Math.round((stats.completed_experiments / stats.total_experiments) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Dna className="h-5 w-5 text-primary" />
            <span className="scientific-badge">Ilmiy platforma</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Boshqaruv paneli</h1>
          <p className="text-muted-foreground">
            Genetik algoritm asosida kontur aniqlash — ilmiy tahlil markazi
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/experiments">Yangi tajriba</Link>
          </Button>
          <Button asChild>
            <Link href="/upload">Rasm yuklash</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Jami tajribalar"
          value={stats?.total_experiments ?? 0}
          subtitle={`${stats?.completed_experiments ?? 0} ta muvaffaqiyatli yakunlandi`}
          icon={FlaskConical}
          accent="blue"
          trend={{ label: `${successRate}% muvaffaqiyat darajasi`, positive: successRate >= 50 }}
        />
        <StatCard
          title="Yuklangan rasmlar"
          value={stats?.total_images ?? 0}
          subtitle="Tahlil uchun mavjud"
          icon={ImageIcon}
          accent="green"
        />
        <StatCard
          title="GA ichki fitness ko'rsatkichi"
          value={
            stats?.best_ga_fitness != null
              ? stats.best_ga_fitness.toFixed(4)
              : "—"
          }
          subtitle="GA optimallashtirish metrikasi (global g'olib emas)"
          icon={TrendingUp}
          accent="amber"
        />
        <StatCard
          title="Algoritmlar"
          value={stats?.algorithms_count ?? 4}
          subtitle="Sobel · Prewitt · Canny · GA"
          icon={CheckCircle2}
          accent="slate"
        />
      </div>

      <section>
        <SectionHeader
          title="So'nggi tajribalar"
          description="Eng so'nggi kontur aniqlash tahlillari"
        />
        {experiments.length === 0 ? (
          <EmptyState
            title="Hali tajribalar yo'q"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/experiments">Tajriba yaratish</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {experiments.slice(0, 5).map((exp) => (
              <Link
                key={exp.id}
                href={`/experiments/${exp.id}`}
                className="scientific-card flex items-center justify-between p-4 transition-colors hover:bg-accent/50"
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

      {experiments.length > 0 && (
        <section>
          <SectionHeader
            title="Tezkor kirish"
            description="Yakunlangan tajriba hisobotlariga o'tish"
          />
          <div className="flex flex-wrap gap-2">
            {experiments
              .filter((e) => e.status === "completed")
              .slice(0, 3)
              .map((exp) => (
                <Button key={exp.id} variant="outline" size="sm" asChild>
                  <Link href={`/experiments/${exp.id}`}>{exp.title}</Link>
                </Button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
