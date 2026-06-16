import { apiFetch } from "@/lib/api";

export interface LeaderboardRow {
  rank: number;
  algorithm?: string;
  avg_iou?: number | null;
  avg_f1?: number | null;
  avg_dice?: number | null;
  avg_runtime_ms?: number | null;
  sample_count?: number;
  dataset?: string;
  image_id?: string;
  benchmark?: string;
  benchmark_id?: string;
  winning_algorithm?: string;
  experiment?: string;
  experiment_id?: string;
  best_iou?: number | null;
  researcher?: string;
  experiments?: number;
}

export interface LeaderboardCenter {
  top_algorithms: LeaderboardRow[];
  top_datasets: LeaderboardRow[];
  top_benchmarks: LeaderboardRow[];
  top_experiments: LeaderboardRow[];
  top_accuracy: LeaderboardRow[];
  top_speed: LeaderboardRow[];
  top_robustness: LeaderboardRow[];
  top_researchers: LeaderboardRow[];
}

export const leaderboardService = {
  getCenter(): Promise<LeaderboardCenter> {
    return apiFetch<LeaderboardCenter>("/api/leaderboard");
  },

  getAlgorithms(): Promise<{ items: LeaderboardRow[] }> {
    return apiFetch<{ items: LeaderboardRow[] }>("/api/leaderboard/algorithms");
  },

  getBenchmarks(): Promise<{ items: LeaderboardRow[] }> {
    return apiFetch<{ items: LeaderboardRow[] }>("/api/leaderboard/benchmarks");
  },

  getDatasets(): Promise<{ items: LeaderboardRow[] }> {
    return apiFetch<{ items: LeaderboardRow[] }>("/api/leaderboard/datasets");
  },
};
