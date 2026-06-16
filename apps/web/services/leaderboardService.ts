import { apiFetch } from "@/lib/api";

export interface LeaderboardCenter {
  top_algorithms: Array<{
    rank: number;
    algorithm: string;
    avg_iou: number | null;
    avg_f1: number | null;
    avg_dice: number | null;
    avg_runtime_ms: number | null;
    sample_count: number;
  }>;
  top_datasets: Array<{
    rank: number;
    dataset: string;
    image_id: string;
    avg_iou: number | null;
    sample_count: number;
  }>;
  top_benchmarks: Array<{
    rank: number;
    benchmark: string;
    benchmark_id: string;
    winning_algorithm: string;
    avg_iou: number | null;
  }>;
  top_experiments: Array<{
    rank: number;
    experiment: string;
    experiment_id: string;
    best_iou: number | null;
    avg_runtime_ms: number | null;
  }>;
  top_accuracy: LeaderboardCenter["top_algorithms"];
  top_speed: LeaderboardCenter["top_algorithms"];
  top_robustness: LeaderboardCenter["top_algorithms"];
  top_researchers: Array<{
    rank: number;
    researcher: string;
    experiments: number;
    avg_iou: number | null;
  }>;
}

export const leaderboardService = {
  getCenter(): Promise<LeaderboardCenter> {
    return apiFetch<LeaderboardCenter>("/api/leaderboard");
  },
};
