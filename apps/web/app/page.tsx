"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, ImageIcon, TrendingUp, Dna, CheckCircle2 } from "lucide-react";
import { ExperimentStatusBadge } from "@/components/experiments/experiment-status-badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
import { ImageCard } from "@/components/experiments/image-card";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    Promise.all([statsService.get(), experimentService.list()])
      .then(([s, exps]) => {
        setStats(s);
        setExperiments(exps);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || loading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Genetic Contour Detection Platform</h1>
        <p className="text-muted-foreground">
          Sign in to upload images, run experiments, and export scientific reports.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/register">Register</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load dashboard"
        message={error}
        hint={`Ensure the API is running at ${API_BASE}`}
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
            <span className="scientific-badge">Research Platform</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Genetic algorithm based contour detection — scientific analysis center
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/experiments">New Experiment</Link>
          </Button>
          <Button asChild>
            <Link href="/upload">Upload Image</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Experiments"
          value={stats?.total_experiments ?? 0}
          subtitle={`${stats?.completed_experiments ?? 0} completed successfully`}
          icon={FlaskConical}
          accent="blue"
          trend={{ label: `${successRate}% success rate`, positive: successRate >= 50 }}
        />
        <StatCard
          title="Uploaded Images"
          value={stats?.total_images ?? 0}
          subtitle="Available for analysis"
          icon={ImageIcon}
          accent="green"
        />
        <StatCard
          title="Best GA Fitness"
          value={
            stats?.best_ga_fitness != null
              ? stats.best_ga_fitness.toFixed(4)
              : "—"
          }
          subtitle="Across all genetic algorithm runs"
          icon={TrendingUp}
          accent="amber"
        />
        <StatCard
          title="Algorithms"
          value={stats?.algorithms_count ?? 4}
          subtitle="Sobel · Prewitt · Canny · GA"
          icon={CheckCircle2}
          accent="slate"
        />
      </div>

      <section>
        <SectionHeader title="Recent Experiments" description="Latest contour detection analyses" />
        {experiments.length === 0 ? (
          <EmptyState
            title="No experiments yet"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/experiments">Create experiment</Link>
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
          <SectionHeader title="Quick Access" description="Jump to completed experiment reports" />
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
