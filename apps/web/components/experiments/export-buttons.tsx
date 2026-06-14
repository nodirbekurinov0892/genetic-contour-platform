"use client";

import { useState } from "react";
import { FileText, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { experimentService } from "@/services/experimentService";
import { EXPERIMENT_STATUS_MESSAGES } from "@/lib/user-labels";
import { cn } from "@/lib/utils";

interface ExportButtonsProps {
  experimentId: string;
  status?: string;
  className?: string;
}

type ExportType = "pdf" | "json" | "csv" | null;

export function ExportButtons({ experimentId, status = "completed", className }: ExportButtonsProps) {
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
        await experimentService.downloadJson(experimentId);
      } else if (type === "csv") {
        await experimentService.downloadCsv(experimentId);
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
    <div className={cn("space-y-2", className)}>
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
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
