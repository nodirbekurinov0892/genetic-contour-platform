"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, ImageIcon, FileText, Target, Wrench } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state-panel";
import { useToast } from "@/components/providers/toast-provider";
import { apiFetch } from "@/lib/api";

interface StorageHealth {
  backend: string;
  images: { count: number; bytes: number; mb: number };
  ground_truths: { count: number };
  reports: { count: number };
  exports: { count: number };
  total_bytes: number;
  total_mb: number;
  health_score?: number;
  missing_files?: number;
  ghost_records?: number;
  orphan_files?: number;
  cleanup_available?: boolean;
}

export default function StoragePage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<StorageHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<StorageHealth>("/api/storage/health-dashboard")
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklash xatosi"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const runCleanup = async (path: string, success: string) => {
    setBusy(true);
    try {
      await apiFetch(path, { method: "POST" });
      toast(success, "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Xato", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Saqlash markazi yuklanmoqda..." />;
  if (error || !summary) {
    return <ErrorState message={error ?? "Ma'lumot yo'q"} onRetry={load} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Saqlash markazi"
        description={`Backend: ${summary.backend} — health score: ${summary.health_score ?? "—"}/100`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Rasmlar" value={summary.images.count} subtitle={`${summary.images.mb} MB`} icon={ImageIcon} accent="blue" />
        <StatCard title="Ground Truth" value={summary.ground_truths.count} subtitle="GT fayllar" icon={Target} accent="green" />
        <StatCard title="Hisobotlar" value={summary.reports.count} subtitle="Eksport fayllar" icon={FileText} accent="amber" />
        <StatCard title="Jami hajm" value={`${summary.total_mb} MB`} subtitle={`${summary.total_bytes.toLocaleString("uz-UZ")} bayt`} icon={HardDrive} accent="slate" />
      </div>

      <section className="scientific-card space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Wrench className="h-4 w-4" />
          Storage cleanup
        </h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Missing files</dt>
            <dd className="font-semibold">{summary.missing_files ?? 0}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Broken records</dt>
            <dd className="font-semibold">{summary.ghost_records ?? 0}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Orphan files</dt>
            <dd className="font-semibold">{summary.orphan_files ?? 0}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void runCleanup("/api/storage/cleanup/broken-records", "Broken yozuvlar belgilandi")}
          >
            Broken yozuvlarni belgilash
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void runCleanup("/api/storage/cleanup/orphans", "Orphan fayllar tozalandi")}
          >
            Orphan fayllarni tozalash
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/library">Rasm kutubxonasi</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
