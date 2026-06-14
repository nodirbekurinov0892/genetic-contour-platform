"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExportButtons } from "@/components/experiments/export-buttons";
import { SectionHeader } from "@/components/ui/section-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/state-panel";
import { experimentService } from "@/services/experimentService";
import type { ExperimentBrowseItem } from "@shared/types";
import { formatDate } from "@/lib/utils";

export default function ReportsPage() {
  const [items, setItems] = useState<ExperimentBrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const browse = await experimentService.browse({
        status: "completed",
        search: search || undefined,
        sort: "created_at_desc",
        limit: 50,
      });
      setItems(browse.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hisobotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Ilmiy hisobotlar"
        description="Yakunlangan tajribalar uchun PDF, JSON va CSV eksport markazi"
        badge="Reports Center"
      />

      <Input
        placeholder="Hisobot qidirish..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <LoadingState message="Hisobotlar yuklanmoqda..." />
      ) : error ? (
        <ErrorState title="Xato" message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Yakunlangan tajribalar yo&apos;q"
          description="Ilmiy hisobot yaratish uchun avval tajribani yakunlang."
        />
      ) : (
        <div className="space-y-4">
          {items.map((exp) => (
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
                      {exp.finished_at && ` · Yakunlandi ${formatDate(exp.finished_at)}`}
                      {exp.algorithm && ` · ${exp.algorithm}`}
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
