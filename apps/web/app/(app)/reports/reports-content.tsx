"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Download, FileText, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExportButtons } from "@/components/experiments/export-buttons";
import { SectionHeader } from "@/components/ui/section-header";
import { WorkflowNextStep } from "@/components/layout/workflow-next-step";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/state-panel";
import { useToast } from "@/components/providers/toast-provider";
import { experimentService } from "@/services/experimentService";
import { reportService, type StoredReport } from "@/services/reportService";
import {
  EXPERIMENT_STATUS_MESSAGES,
  formatAlgorithmLabel,
  formatExperimentStatus,
} from "@/lib/user-labels";
import type { ExperimentBrowseItem } from "@shared/types";
import { formatDate } from "@/lib/utils";

const INCOMPLETE_STATUSES = ["failed", "running", "queued", "cancelled", "pending"] as const;

function statusBadgeVariant(status: string): "success" | "destructive" | "secondary" | "outline" {
  if (status === "completed") return "success";
  if (status === "failed") return "destructive";
  if (status === "running" || status === "queued") return "secondary";
  return "outline";
}

function statusLabel(status: string): string {
  return EXPERIMENT_STATUS_MESSAGES[status] ?? formatExperimentStatus(status);
}

export default function ReportsPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("experiment");

  const [completed, setCompleted] = useState<ExperimentBrowseItem[]>([]);
  const [incomplete, setIncomplete] = useState<ExperimentBrowseItem[]>([]);
  const [storedReports, setStoredReports] = useState<StoredReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renameReport, setRenameReport] = useState<StoredReport | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteReport, setDeleteReport] = useState<StoredReport | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [doneBrowse, reportsRes, ...incompleteBrowses] = await Promise.all([
        experimentService.browse({
          status: "completed",
          search: search || undefined,
          sort: "created_at_desc",
          limit: 50,
        }),
        reportService.list(50),
        ...INCOMPLETE_STATUSES.map((status) =>
          experimentService.browse({
            status,
            search: search || undefined,
            sort: "created_at_desc",
            limit: 20,
          }),
        ),
      ]);
      setCompleted(doneBrowse.items);
      setStoredReports(reportsRes.items);
      const seen = new Set<string>();
      const merged: ExperimentBrowseItem[] = [];
      for (const browse of incompleteBrowses) {
        for (const item of browse.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }
      }
      merged.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setIncomplete(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hisobotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const handleRegenerate = async (report: StoredReport) => {
    setBusyId(report.id);
    try {
      await reportService.regenerate(report.id);
      toast("Hisobot qayta generatsiya qilindi", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Xato", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleExportZip = async () => {
    setBusyId("zip");
    try {
      await reportService.exportZip();
      toast("ZIP eksport yuklandi", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Eksport xatosi", "error");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (highlightId) {
      document.getElementById(`report-${highlightId}`)?.scrollIntoView({ behavior: "smooth" });
    }
  }, [highlightId, completed, loading]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Ilmiy hisobotlar"
        description="Yakunlangan tajribalar uchun PDF, JSON, CSV va XLSX eksport markazi"
      />

      <Input
        placeholder="Hisobot qidirish..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {storedReports.length > 0 && (
        <section className="scientific-card space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Saqlangan hisobot fayllari</h2>
            <Button
              variant="outline"
              size="sm"
              disabled={busyId === "zip"}
              onClick={() => void handleExportZip()}
            >
              <Download className="mr-2 h-4 w-4" />
              Barchasini ZIP
            </Button>
          </div>
          <div className="space-y-3">
            {storedReports.map((report) => (
              <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.format.toUpperCase()} · {report.experiment_title}
                  </p>
                  <Badge variant={report.storage_status === "available" ? "success" : "destructive"} className="mt-1">
                    {report.storage_status === "available" ? "Mavjud" : "Fayl topilmadi"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.storage_status === "missing" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === report.id}
                      onClick={() => void handleRegenerate(report)}
                    >
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      Qayta generatsiya
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenameReport(report);
                      setRenameTitle(report.title);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setDeleteReport(report)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/experiments/${report.experiment_id}`}>Tajriba</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <LoadingState message="Hisobotlar yuklanmoqda..." />
      ) : error ? (
        <ErrorState title="Xato" message={error} onRetry={load} />
      ) : completed.length === 0 && incomplete.length === 0 ? (
        <EmptyState
          title="Tajribalar yo&apos;q"
          description="Ilmiy hisobot yaratish uchun avval tajribani yakunlang."
          action={
            <Button asChild>
              <Link href="/experiments/new">Yangi tajriba boshlash</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {incomplete.length > 0 && (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Yakunlanmagan tajribalar
              </h2>
              <p className="text-sm text-muted-foreground">
                PDF, CSV, JSON va XLSX faqat yakunlangan tajribalar uchun mavjud.
              </p>
              {incomplete.map((exp) => (
                <div key={exp.id} className="scientific-card p-5">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/experiments/${exp.id}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {exp.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(exp.created_at)}
                        {exp.algorithm && ` · ${formatAlgorithmLabel(exp.algorithm)}`}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(exp.status)}>
                      {formatExperimentStatus(exp.status)}
                    </Badge>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">{statusLabel(exp.status)}</p>
                  <ExportButtons experimentId={exp.id} status={exp.status} />
                </div>
              ))}
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Yakunlangan hisobotlar</h2>
              {completed.map((exp) => (
                <div
                  key={exp.id}
                  id={`report-${exp.id}`}
                  className={
                    highlightId === exp.id
                      ? "scientific-card ring-2 ring-primary/30 p-5"
                      : "scientific-card p-5"
                  }
                >
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <Link
                          href={`/experiments/${exp.id}`}
                          className="font-semibold hover:text-primary hover:underline"
                        >
                          {exp.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(exp.created_at)}
                          {exp.finished_at && ` · Yakunlandi ${formatDate(exp.finished_at)}`}
                          {exp.algorithm && ` · ${formatAlgorithmLabel(exp.algorithm)}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">{formatExperimentStatus("completed")}</Badge>
                  </div>
                  <ExportButtons experimentId={exp.id} status="completed" />
                </div>
              ))}
            </section>
          )}

          {completed.length > 0 && (
            <WorkflowNextStep
              title="Keyingi qadam: analitika markazi"
              description="Platforma kesimidagi metrikalar va trend tahlili"
              href="/analytics"
              label="Analitikaga o'tish"
            />
          )}
        </div>
      )}

      {renameReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6">
            <h3 className="font-semibold">Hisobot nomi</h3>
            <Input className="mt-3" value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameReport(null)}>Bekor</Button>
              <Button
                disabled={!renameTitle.trim() || busyId === renameReport.id}
                onClick={() => {
                  setBusyId(renameReport.id);
                  void reportService
                    .update(renameReport.id, { title: renameTitle.trim() })
                    .then(() => {
                      toast("Nom yangilandi", "success");
                      setRenameReport(null);
                      return load();
                    })
                    .catch((err) => toast(err instanceof Error ? err.message : "Xato", "error"))
                    .finally(() => setBusyId(null));
                }}
              >
                Saqlash
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteReport}
        title="Hisobotni o'chirish?"
        description="Storage fayli va DB yozuvi o'chiriladi."
        confirmLabel="O'chirish"
        destructive
        loading={busyId === deleteReport?.id}
        onCancel={() => setDeleteReport(null)}
        onConfirm={() => {
          if (!deleteReport) return;
          setBusyId(deleteReport.id);
          void reportService
            .delete(deleteReport.id)
            .then(() => {
              toast("Hisobot o'chirildi", "success");
              setDeleteReport(null);
              return load();
            })
            .catch((err) => toast(err instanceof Error ? err.message : "Xato", "error"))
            .finally(() => setBusyId(null));
        }}
      />
    </div>
  );
}
