"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExportButtons } from "@/components/experiments/export-buttons";
import { SectionHeader } from "@/components/ui/section-header";
import { LoadingState, EmptyState } from "@/components/ui/state-panel";
import { experimentService } from "@/services/experimentService";
import type { ExperimentRecord } from "@shared/types";
import { formatDate } from "@/lib/utils";

export default function ReportsPage() {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    experimentService
      .list()
      .then(setExperiments)
      .finally(() => setLoading(false));
  }, []);

  const completed = experiments.filter((e) => e.status === "completed");

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Ilmiy hisobotlar"
        description="Dissertatsiya va ilmiy hujjatlar uchun tajriba natijalarini PDF, JSON yoki CSV formatida eksport qiling"
        badge="Eksport"
      />

      {loading ? (
        <LoadingState message="Hisobotlar yuklanmoqda..." />
      ) : completed.length === 0 ? (
        <EmptyState
          title="Yakunlangan tajribalar yo'q"
          description="Ilmiy hisobot yaratish uchun avval tajribani yakunlang."
        />
      ) : (
        <div className="space-y-4">
          {completed.map((exp) => (
            <div key={exp.id} className="scientific-card p-5">
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
                      {exp.completed_at && ` · Yakunlandi ${formatDate(exp.completed_at)}`}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Yakunlandi</Badge>
              </div>
              <ExportButtons experimentId={exp.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
