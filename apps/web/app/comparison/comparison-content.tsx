"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state-panel";
import { ComparisonCenterView } from "@/components/comparison/comparison-center-view";
import { experimentService } from "@/services/experimentService";
import { imageService } from "@/services/imageService";
import type {
  ExperimentBrowseItem,
  ExperimentResults,
  ImageRecord,
  ScientificInsights,
} from "@shared/types";
import { API_BASE } from "@/lib/api";

export default function ComparisonPageContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("experiment") ?? "";

  const [experiments, setExperiments] = useState<ExperimentBrowseItem[]>([]);
  const [selectedId, setSelectedId] = useState(initialId);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [insights, setInsights] = useState<ScientificInsights | null>(null);
  const [sourceImage, setSourceImage] = useState<ImageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExperiments = useCallback(async () => {
    const browse = await experimentService.browse({
      status: "completed",
      sort: "created_at_desc",
      limit: 50,
    });
    setExperiments(browse.items);
    if (!selectedId && browse.items.length > 0) {
      setSelectedId(browse.items[0].id);
    }
  }, [selectedId]);

  const loadResults = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [res, ins] = await Promise.all([
        experimentService.getResults(id),
        experimentService.getInsights(id).catch(() => null),
      ]);
      setResults(res);
      setInsights(ins);
      const img = await imageService.getById(res.experiment.image_id);
      setSourceImage(img);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Natijalarni yuklab bo'lmadi");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExperiments().catch((err) => {
      setError(err instanceof Error ? err.message : "Tajribalarni yuklab bo'lmadi");
      setLoading(false);
    });
  }, [loadExperiments]);

  useEffect(() => {
    if (selectedId) loadResults(selectedId);
  }, [selectedId, loadResults]);

  if (error && !results) {
    return (
      <ErrorState
        title="Taqqoslash markazini yuklab bo'lmadi"
        message={error}
        hint={`API ${API_BASE}`}
        onRetry={() => selectedId && loadResults(selectedId)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Taqqoslash markazi"
        description="Sobel, Prewitt, Canny va Genetic Algorithm natijalarini yonma-yon tahlil qiling"
        badge="Comparison Center"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="exp-select">
          Tajriba:
        </label>
        <select
          id="exp-select"
          className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Tanlang...</option>
          {experiments.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.title}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" asChild>
          <Link href="/experiments/new">Yangi tajriba</Link>
        </Button>
      </div>

      {experiments.length === 0 && !loading ? (
        <EmptyState
          title="Yakunlangan tajribalar yo'q"
          action={
            <Button asChild>
              <Link href="/experiments/new">Birinchi tajribani boshlash</Link>
            </Button>
          }
        />
      ) : loading ? (
        <LoadingState message="Taqqoslash natijalari yuklanmoqda..." />
      ) : results ? (
        <ComparisonCenterView
          data={results}
          sourceImage={sourceImage}
          evaluationMode={insights?.evaluation_mode}
          winner={insights?.winner ?? null}
        />
      ) : null}
    </div>
  );
}
