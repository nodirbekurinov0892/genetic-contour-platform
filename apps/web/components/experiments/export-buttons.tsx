"use client";

import { useState } from "react";
import { FileText, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { experimentService } from "@/services/experimentService";
import { EXPERIMENT_STATUS_MESSAGES, REPORT_TYPE_LABELS } from "@/lib/user-labels";
import { cn } from "@/lib/utils";

export type ReportType = "scientific" | "executive" | "technical" | "benchmark";

interface ExportButtonsProps {
  experimentId: string;
  status?: string;
  className?: string;
}

type ExportType = "pdf" | "json" | "csv" | "xlsx" | null;

export function ExportButtons({ experimentId, status = "completed", className }: ExportButtonsProps) {
  const [reportType, setReportType] = useState<ReportType>("scientific");
  const [loading, setLoading] = useState<ExportType>(null);
  const [error, setError] = useState<string | null>(null);

  const isCompleted = status === "completed";

  const handleExport = async (type: ExportType) => {
    if (!type) return;
    setLoading(type);
    setError(null);
    try {
      if (type === "pdf") {
        await experimentService.downloadPdf(experimentId);
      } else if (type === "json") {
        await experimentService.downloadJson(experimentId, reportType);
      } else if (type === "csv") {
        await experimentService.downloadCsv(experimentId);
      } else if (type === "xlsx") {
        await experimentService.downloadXlsx(experimentId, reportType);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eksport muvaffaqiyatsiz");
    } finally {
      setLoading(null);
    }
  };

  if (!isCompleted) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {EXPERIMENT_STATUS_MESSAGES[status] ??
          "Hisobotlar faqat yakunlangan tajribalar uchun mavjud."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label htmlFor={`report-type-${experimentId}`} className="text-xs text-muted-foreground">
          Hisobot turi
        </Label>
        <select
          id={`report-type-${experimentId}`}
          className="mt-1 h-9 w-full max-w-xs rounded-md border bg-background px-2 text-sm"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
        >
          {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((key) => (
            <option key={key} value={key}>
              {REPORT_TYPE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={loading !== null}
          onClick={() => handleExport("pdf")}
          className="gap-2"
        >
          {loading === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          PDF hisobot
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() => handleExport("json")}
          className="gap-2"
        >
          {loading === "json" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileJson className="h-4 w-4" />
          )}
          JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() => handleExport("csv")}
          className="gap-2"
        >
          {loading === "csv" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() => handleExport("xlsx")}
          className="gap-2"
        >
          {loading === "xlsx" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          XLSX
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
