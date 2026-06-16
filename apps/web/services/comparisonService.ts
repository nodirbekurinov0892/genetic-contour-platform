import { apiFetch } from "@/lib/api";

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

export const comparisonService = {
  compareExperiments(experimentA: string, experimentB: string): Promise<ExperimentComparison> {
    const q = new URLSearchParams({ experiment_a: experimentA, experiment_b: experimentB });
    return apiFetch<ExperimentComparison>(`/api/comparison/experiments?${q}`);
  },

  compareAlgorithms(algorithmA: string, algorithmB: string): Promise<AlgorithmComparison> {
    const q = new URLSearchParams({ algorithm_a: algorithmA, algorithm_b: algorithmB });
    return apiFetch<AlgorithmComparison>(`/api/comparison/algorithms?${q}`);
  },

  compareBenchmarks(benchmarkA: string, benchmarkB: string): Promise<BenchmarkComparison> {
    const q = new URLSearchParams({ benchmark_a: benchmarkA, benchmark_b: benchmarkB });
    return apiFetch<BenchmarkComparison>(`/api/comparison/benchmarks?${q}`);
  },

  compareDatasets(benchmarkId: string): Promise<DatasetRankingComparison> {
    return apiFetch<DatasetRankingComparison>(`/api/comparison/datasets/${benchmarkId}`);
  },
};
