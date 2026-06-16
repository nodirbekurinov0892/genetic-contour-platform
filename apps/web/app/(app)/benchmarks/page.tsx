"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Play, Plus } from "lucide-react";
import { DEFAULT_ALGORITHM_PARAMS, DEFAULT_GA_PARAMS } from "@shared/constants";
import type { ImageRecord } from "@shared/types";
import { apiFetch } from "@/lib/api";
import { imageService } from "@/services/imageService";
import { formatAlgorithmLabel, formatComparisonProtocol } from "@/lib/user-labels";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-panel";

interface BenchmarkDataset {
  id: string;
  image_id: string;
  sort_order: number;
}

interface Benchmark {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  dataset_count: number;
  comparison_protocol: string;
  datasets?: BenchmarkDataset[];
}

interface BenchmarkRun {
  id: string;
  benchmark_id: string;
  status: string;
  cohort_size: number;
  completed_count: number;
  aggregate_metrics_json: Record<string, Record<string, number | null>> | null;
}

interface LeaderboardEntry {
  algorithm_name: string;
  rank: number;
  avg_iou: number | null;
  avg_f1: number | null;
  avg_dice: number | null;
  avg_runtime_ms: number | null;
  sample_count: number;
}

interface DatasetRankingEntry {
  image_id: string;
  winner_algorithm: string | null;
  best_iou: number | null;
}

interface CollectionStats {
  id: string;
  name: string;
  category: string | null;
  image_count: number;
  gt_count: number;
}

const BATCH_SIZES = [10, 50, 100, 500, 1000] as const;

function formatMetricValue(val: number | null | undefined): string {
  if (val == null) return "—";
  return typeof val === "number" ? val.toFixed(4) : String(val);
}

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Benchmark | null>(null);
  const [collection, setCollection] = useState<CollectionStats | null>(null);
  const [activeRun, setActiveRun] = useState<BenchmarkRun | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [datasetRanking, setDatasetRanking] = useState<DatasetRankingEntry[]>([]);
  const [batchSize, setBatchSize] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [pickedImages, setPickedImages] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, imgs] = await Promise.all([
        apiFetch<Benchmark[]>("/api/benchmarks"),
        imageService.list({ limit: 50 }),
      ]);
      setBenchmarks(list);
      setImages(imgs);
      if (list[0] && !selectedId) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadSelected = useCallback(async (id: string) => {
    const [detail, lb, coll] = await Promise.all([
      apiFetch<Benchmark>(`/api/benchmarks/${id}`),
      apiFetch<LeaderboardEntry[]>(`/api/benchmarks/${id}/leaderboard`),
      apiFetch<CollectionStats>(`/api/benchmarks/${id}/collection`),
    ]);
    setSelected(detail);
    setLeaderboard(lb);
    setCollection(coll);
  }, []);

  const loadDatasetRanking = useCallback(async (benchmarkId: string, runId: string) => {
    const ranking = await apiFetch<DatasetRankingEntry[]>(
      `/api/benchmarks/${benchmarkId}/runs/${runId}/dataset-ranking`,
    );
    setDatasetRanking(ranking);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedId) void loadSelected(selectedId);
  }, [selectedId, loadSelected]);

  useEffect(() => {
    if (!activeRun || activeRun.status === "completed" || activeRun.status === "failed") return;
    const timer = setInterval(() => {
      void apiFetch<BenchmarkRun>(
        `/api/benchmarks/${activeRun.benchmark_id}/runs/${activeRun.id}`,
      ).then((run) => {
        setActiveRun(run);
        if (run.status === "completed" && selectedId) {
          void loadSelected(selectedId);
          void loadDatasetRanking(run.benchmark_id, run.id);
        }
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [activeRun, selectedId, loadSelected, loadDatasetRanking]);

  const toggleImage = (id: string) => {
    setPickedImages((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const createBenchmark = async () => {
    if (!name.trim() || !slug.trim() || pickedImages.length === 0) {
      setError("Nom, identifikator va kamida 1 rasm tanlang");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<Benchmark>("/api/benchmarks", {
        method: "POST",
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          image_ids: pickedImages,
        }),
      });
      setName("");
      setSlug("");
      setCategory("");
      setDescription("");
      setPickedImages([]);
      setSelectedId(created.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yaratish xatosi");
    } finally {
      setBusy(false);
    }
  };

  const startRun = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setDatasetRanking([]);
    try {
      const run = await apiFetch<BenchmarkRun>(
        `/api/benchmarks/${selected.id}/runs?batch_size=${batchSize}`,
        {
          method: "POST",
          body: JSON.stringify({
            algorithm: "compare_all",
            params: DEFAULT_ALGORITHM_PARAMS,
            ga_params: DEFAULT_GA_PARAMS,
            comparison_protocol: "fair_v1",
          }),
        },
      );
      setActiveRun(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ishga tushirish xatosi");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Benchmarklar yuklanmoqda..." />;
  if (error && benchmarks.length === 0 && images.length === 0) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Benchmark to'plamlari"
        description="Dataset yaratish, guruhli ishga tushirish va umumiy natijalar"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="scientific-card space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="h-5 w-5" />
          Benchmark dataset yaratish
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="b-name">Nomi</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="b-slug">Identifikator</Label>
            <Input
              id="b-slug"
              placeholder="masalan, tanga-konturlar"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="b-category">Kategoriya</Label>
            <Input
              id="b-category"
              placeholder="masalan, metall, biologiya"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="b-desc">Tavsif</Label>
          <Input id="b-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Rasmlar yo&apos;q.{" "}
            <Link href="/library" className="text-primary underline">
              Kutubxonaga o&apos;ting
            </Link>
          </p>
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded border p-2 text-sm">
            {images.map((img) => (
              <label key={img.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={pickedImages.includes(img.id)}
                  onChange={() => toggleImage(img.id)}
                />
                {img.original_name}
                {img.has_ground_truth ? " (GT bor)" : ""}
              </label>
            ))}
          </div>
        )}
        <Button onClick={() => void createBenchmark()} disabled={busy}>
          Dataset yaratish
        </Button>
      </div>

      {benchmarks.length === 0 ? (
        <EmptyState title="Benchmarklar yo&apos;q" description="Yuqoridagi forma orqali yarating." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="scientific-card space-y-3 p-4">
            <h3 className="font-semibold">Benchmark ro&apos;yxati</h3>
            {benchmarks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`w-full rounded border p-3 text-left text-sm ${
                  selectedId === b.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.dataset_count} rasm
                  {b.category ? ` · ${b.category}` : ""}
                  {" · "}
                  {formatComparisonProtocol(b.comparison_protocol)}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="scientific-card space-y-4 p-4">
              <h3 className="font-semibold">{selected.name}</h3>
              {selected.category && (
                <p className="text-xs text-muted-foreground">Kategoriya: {selected.category}</p>
              )}
              <p className="text-sm text-muted-foreground">{selected.description}</p>
              {collection && (
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Rasmlar</dt>
                    <dd className="font-semibold">{collection.image_count}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">GT bilan</dt>
                    <dd className="font-semibold">{collection.gt_count}</dd>
                  </div>
                </dl>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground">Dataset rasmlari</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {(selected.datasets ?? []).map((ds) => {
                    const img = images.find((i) => i.id === ds.image_id);
                    return (
                      <li key={ds.id} className="rounded border border-border/60 px-2 py-1">
                        {img?.original_name ?? "Rasm"}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Batch hajmi</p>
                <div className="flex flex-wrap gap-2">
                  {BATCH_SIZES.map((size) => (
                    <Button
                      key={size}
                      variant={batchSize === size ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBatchSize(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={() => void startRun()} disabled={busy || selected.dataset_count === 0}>
                <Play className="mr-2 h-4 w-4" />
                Cohort ishga tushirish ({batchSize})
              </Button>
              {activeRun && activeRun.benchmark_id === selected.id && (
                <div className="rounded border p-3 text-sm">
                  <p>
                    Holat: {activeRun.status} ({activeRun.completed_count}/{activeRun.cohort_size})
                  </p>
                  {activeRun.aggregate_metrics_json && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">
                        Statistik xulosa
                      </p>
                      {Object.entries(activeRun.aggregate_metrics_json).map(([algo, metrics]) => (
                        <div key={algo} className="rounded border border-border/60 p-2">
                          <p className="font-medium">{formatAlgorithmLabel(algo)}</p>
                          <dl className="mt-1 grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(metrics).map(([key, val]) => (
                              <div key={key}>
                                <dt className="text-muted-foreground">{key}</dt>
                                <dd>{formatMetricValue(val)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="scientific-card overflow-x-auto p-4">
          <h3 className="mb-3 font-semibold">Reyting jadvali</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">#</th>
                <th className="p-2">Algoritm</th>
                <th className="p-2">Avg IoU</th>
                <th className="p-2">Avg F1</th>
                <th className="p-2">Avg Dice</th>
                <th className="p-2">Runtime (ms)</th>
                <th className="p-2">N</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((e) => (
                <tr key={e.algorithm_name} className="border-b">
                  <td className="p-2">{e.rank}</td>
                  <td className="p-2">{formatAlgorithmLabel(e.algorithm_name)}</td>
                  <td className="p-2">{e.avg_iou?.toFixed(4) ?? "—"}</td>
                  <td className="p-2">{e.avg_f1?.toFixed(4) ?? "—"}</td>
                  <td className="p-2">{e.avg_dice?.toFixed(4) ?? "—"}</td>
                  <td className="p-2">{e.avg_runtime_ms?.toFixed(1) ?? "—"}</td>
                  <td className="p-2">{e.sample_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {datasetRanking.length > 0 && (
        <div className="scientific-card overflow-x-auto p-4">
          <h3 className="mb-3 font-semibold">Dataset reytingi</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Rasm ID</th>
                <th className="p-2">G&apos;olib algoritm</th>
                <th className="p-2">Eng yaxshi IoU</th>
              </tr>
            </thead>
            <tbody>
              {datasetRanking.map((row) => {
                const img = images.find((i) => i.id === row.image_id);
                return (
                  <tr key={row.image_id} className="border-b">
                    <td className="p-2">{img?.original_name ?? row.image_id.slice(0, 8)}</td>
                    <td className="p-2">{formatAlgorithmLabel(row.winner_algorithm)}</td>
                    <td className="p-2">{row.best_iou?.toFixed(4) ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
