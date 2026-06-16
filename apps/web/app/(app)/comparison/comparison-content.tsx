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
import { WorkflowNextStep } from "@/components/layout/workflow-next-step";
import { ComparisonProContent } from "./comparison-pro-content";

type ViewMode = "single" | "pro";

export default function ComparisonPageContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("experiment") ?? "";
  const [viewMode, setViewMode] = useState<ViewMode>("single");

  const [experiments, setExperiments] = useState<ExperimentBrowseItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [insights, setInsights] = useState<ScientificInsights | null>(null);
  const [sourceImage, setSourceImage] = useState<ImageRecord | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExperiments = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const browse = await experimentService.browse({
        status: "completed",
        sort: "created_at_desc",
        limit: 50,
      });
      setExperiments(browse.items);
      const preferred =
        initialId && browse.items.some((e) => e.id === initialId)
          ? initialId
          : browse.items[0]?.id ?? "";
      setSelectedId(preferred);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tajribalarni yuklab bo'lmadi");
    } finally {
      setLoadingList(false);
    }
  }, [initialId]);

  const loadResults = useCallback(async (id: string) => {
    if (!id) {
      setResults(null);
      return;
    }
    setLoadingResults(true);
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
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    void loadExperiments();
  }, [loadExperiments]);

  useEffect(() => {
    if (selectedId) void loadResults(selectedId);
  }, [selectedId, loadResults]);

  if (loadingList) {
    return <LoadingState message="Tajribalar ro'yxati yuklanmoqda..." />;
  }

  if (error && !results && experiments.length === 0) {
    return (
      <ErrorState
        title="Taqqoslash markazini yuklab bo'lmadi"
        message={error}
        hint={`API ${API_BASE}`}
        onRetry={() => void loadExperiments()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Natijalarni taqqoslash"
        description="Sobel, Prewitt, Canny va Genetik algoritm natijalarini yonma-yon tahlil qiling"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={viewMode === "single" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("single")}
        >
          Yagona tajriba
        </Button>
        <Button
          variant={viewMode === "pro" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("pro")}
        >
          Professional taqqoslash
        </Button>
      </div>

      {viewMode === "pro" ? (
        <ComparisonProContent />
      ) : (
        <>
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

      {experiments.length === 0 ? (
        <EmptyState
          title="Yakunlangan tajribalar yo'q"
          description="Taqqoslash uchun avval tajribani yakunlang."
          action={
            <Button asChild>
              <Link href="/experiments/new">Birinchi tajribani boshlash</Link>
            </Button>
          }
        />
      ) : loadingResults ? (
        <LoadingState message="Taqqoslash natijalari yuklanmoqda..." />
      ) : error && !results ? (
        <ErrorState message={error} onRetry={() => selectedId && loadResults(selectedId)} />
      ) : results ? (
        <>
          <ComparisonCenterView
            data={results}
            sourceImage={sourceImage}
            evaluationMode={insights?.evaluation_mode}
            winner={insights?.winner ?? null}
          />
          <WorkflowNextStep
            title="Keyingi qadam: ilmiy hisobotlar"
            description="Yakunlangan tajriba uchun PDF, CSV va JSON eksport"
            href={`/reports${selectedId ? `?experiment=${selectedId}` : ""}`}
            label="Hisobotlarga o'tish"
          />
        </>
      ) : null}
        </>
      )}
    </div>
  );
}
