import { apiFetch } from "@/lib/api";
import { formatAlgorithmLabel } from "@/lib/user-labels";

export interface ExperimentComparison {
  mode: "experiment_vs_experiment";
  experiment_a: string;
  experiment_b: string;
  table: Array<{
    algorithm: string;
    experiment_a_iou: number | null;
    experiment_b_iou: number | null;
    experiment_a_f1: number | null;
    experiment_b_f1: number | null;
    iou_delta: number | null;
  }>;
  chart: Array<{
    algorithm: string;
    experiment_a: number | null;
    experiment_b: number | null;
  }>;
}

export interface AlgorithmComparison {
  mode: "algorithm_vs_algorithm";
  table: Array<{
    algorithm: string;
    avg_iou: number | null;
    avg_f1: number | null;
    sample_count: number;
    rank?: number;
  }>;
  chart: Array<{ algorithm: string; avg_iou: number | null }>;
}

export interface BenchmarkComparison {
  mode: "benchmark_vs_benchmark";
  benchmark_a: string;
  benchmark_b: string;
  table: Array<{
    algorithm: string;
    benchmark_a_avg_iou: number | null;
    benchmark_b_avg_iou: number | null;
    benchmark_a_rank: number | null;
    benchmark_b_rank: number | null;
  }>;
  chart: Array<{
    algorithm: string;
    benchmark_a: number | null;
    benchmark_b: number | null;
  }>;
}

export interface DatasetRankingComparison {
  mode: "dataset_ranking";
  benchmark_id: string;
  benchmark_name: string;
  table: Array<{
    image_id: string;
    winner_algorithm: string | null;
    best_iou: number | null;
  }>;
}

export interface MultiExperimentComparison {
  mode: "multi_experiment";
  status: "empty" | "ready";
  message?: string;
  experiment_count: number;
  included_count: number;
  excluded_experiments: Array<{
    experiment_id: string;
    title: string | null;
    reason: string;
  }>;
  table: Array<{
    algorithm: string;
    rank: number;
    avg_iou: number | null;
    avg_f1: number | null;
    avg_dice: number | null;
    avg_precision: number | null;
    avg_recall: number | null;
    avg_runtime_ms: number | null;
    std_iou: number | null;
    std_f1: number | null;
    sample_count: number;
  }>;
  charts: Record<string, Array<{ algorithm: string; value: number | null }>>;
}

export interface BenchmarkSummary {
  mode: "benchmark_summary";
  status: "no_run" | "running" | "ready" | "failed" | "empty";
  message: string;
  benchmark_id: string;
  benchmark_name: string;
  run_id: string | null;
  run_status?: string;
  image_count: number;
  gt_count: number;
  cohort_size?: number;
  completed_count?: number;
  failed_count?: number;
  algorithm_run_count?: number;
  progress_percent?: number;
  table: Array<Record<string, unknown>>;
  leaderboard: Array<Record<string, unknown>>;
  charts: Record<string, Array<{ algorithm: string; value: number | null }>>;
  actions?: string[];
}

export interface GlobalDatasetRanking {
  mode: "dataset_ranking";
  status: "empty" | "ready";
  message: string;
  run_count: number;
  table: Array<Record<string, unknown>>;
  actions?: string[];
}

function chartPoints(
  rows: Array<{ algorithm: string; value: number | null }> | undefined,
): Array<{ algorithm: string; value: number | null }> {
  return (rows ?? []).map((r) => ({
    algorithm: formatAlgorithmLabel(r.algorithm),
    value: r.value,
  }));
}

export const comparisonService = {
  compareExperiments(experimentA: string, experimentB: string): Promise<ExperimentComparison> {
    const q = new URLSearchParams({ experiment_a: experimentA, experiment_b: experimentB });
    return apiFetch<ExperimentComparison>(`/api/comparison/experiments?${q}`);
  },

  compareMultiExperiments(experimentIds: string[]): Promise<MultiExperimentComparison> {
    const q = new URLSearchParams({ ids: experimentIds.join(",") });
    return apiFetch<MultiExperimentComparison>(`/api/comparison/multi-experiments?${q}`);
  },

  compareAlgorithms(algorithmA: string, algorithmB: string): Promise<AlgorithmComparison> {
    const q = new URLSearchParams({ algorithm_a: algorithmA, algorithm_b: algorithmB });
    return apiFetch<AlgorithmComparison>(`/api/comparison/algorithms?${q}`);
  },

  compareBenchmarks(benchmarkA: string, benchmarkB: string): Promise<BenchmarkComparison> {
    const q = new URLSearchParams({ benchmark_a: benchmarkA, benchmark_b: benchmarkB });
    return apiFetch<BenchmarkComparison>(`/api/comparison/benchmarks?${q}`);
  },

  getBenchmarkSummary(benchmarkId: string): Promise<BenchmarkSummary> {
    return apiFetch<BenchmarkSummary>(`/api/comparison/benchmark-summary/${benchmarkId}`);
  },

  getGlobalDatasetRanking(): Promise<GlobalDatasetRanking> {
    return apiFetch<GlobalDatasetRanking>("/api/comparison/dataset-ranking");
  },

  compareDatasets(benchmarkId: string): Promise<DatasetRankingComparison> {
    return apiFetch<DatasetRankingComparison>(`/api/comparison/datasets/${benchmarkId}`);
  },

  formatChartPoints: chartPoints,
};
