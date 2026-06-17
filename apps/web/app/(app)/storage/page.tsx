"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, HardDrive, ImageIcon, FileText, Target, Wrench } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, LoadingState } from "@/components/ui/state-panel";
import { useToast } from "@/components/providers/toast-provider";
import { apiFetch } from "@/lib/api";
import { accountService } from "@/services/accountService";

const CLEAN_START_PHRASE = "DELETE MY RESEARCH DATA";

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
  const [cleanStartOpen, setCleanStartOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

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

  const runCleanStart = async () => {
    if (confirmText.trim() !== CLEAN_START_PHRASE) {
      toast(`Tasdiqlash matni: ${CLEAN_START_PHRASE}`, "error");
      return;
    }
    setBusy(true);
    try {
      const result = await accountService.cleanupMyResearchData(confirmText);
      toast(
        `Tozalandi: ${result.deleted.experiments} tajriba, ${result.deleted.images} rasm`,
        "success",
      );
      setCleanStartOpen(false);
      setConfirmText("");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Tozalash xatosi", "error");
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
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void runCleanup("/api/storage/cleanup/broken-records", "Broken yozuvlar belgilandi")}>
            Broken image yozuvlari
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void runCleanup("/api/storage/cleanup/broken-reports", "Broken hisobotlar tozalandi")}>
            Broken hisobotlar
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void runCleanup("/api/storage/cleanup/orphans", "Orphan fayllar tozalandi")}>
            Orphan fayllar
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/library">Rasm kutubxonasi</Link>
          </Button>
        </div>
      </section>

      <section className="scientific-card space-y-4 border-destructive/30 p-5">
        <h3 className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Clean Start — barcha tajriba ma&apos;lumotlari
        </h3>
        <p className="text-sm text-muted-foreground">
          Barcha rasmlar, tajribalar, benchmarklar, hisobotlar va natijalar o&apos;chiriladi. Hisobingiz saqlanadi.
        </p>
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => setCleanStartOpen(true)}>
          Barcha tajriba ma&apos;lumotlarini tozalash
        </Button>
      </section>

      <ConfirmDialog
        open={cleanStartOpen}
        title="Barcha ma'lumotlarni o'chirish?"
        description={`Tasdiqlash uchun quyidagi matnni kiriting: ${CLEAN_START_PHRASE}`}
        confirmLabel="Butunlay tozalash"
        destructive
        loading={busy}
        onCancel={() => { if (!busy) { setCleanStartOpen(false); setConfirmText(""); } }}
        onConfirm={() => void runCleanStart()}
      />

      {cleanStartOpen && (
        <div className="fixed inset-x-0 bottom-24 z-[60] mx-auto max-w-md px-4">
          <div className="rounded-lg border bg-background p-4 shadow-lg">
            <Label htmlFor="clean-confirm">Tasdiqlash matni</Label>
            <Input
              id="clean-confirm"
              className="mt-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CLEAN_START_PHRASE}
              disabled={busy}
            />
          </div>
        </div>
      )}
    </div>
  );
}
