"use client";

import { useState } from "react";
import { FileText, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { experimentService } from "@/services/experimentService";
import { cn } from "@/lib/utils";

interface ExportButtonsProps {
  experimentId: string;
  disabled?: boolean;
  className?: string;
}

type ExportType = "pdf" | "json" | "csv" | null;

export function ExportButtons({ experimentId, disabled, className }: ExportButtonsProps) {
  const [loading, setLoading] = useState<ExportType>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={disabled || loading !== null}
          onClick={() => handleExport("pdf")}
          className="gap-2"
        >
          {loading === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          PDF hisobotni yuklab olish
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || loading !== null}
          onClick={() => handleExport("json")}
          className="gap-2"
        >
          {loading === "json" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileJson className="h-4 w-4" />
          )}
          JSON yuklab olish
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || loading !== null}
          onClick={() => handleExport("csv")}
          className="gap-2"
        >
          {loading === "csv" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          CSV yuklab olish
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
