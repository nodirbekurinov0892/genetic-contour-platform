import { apiFetch } from "@/lib/api";

export interface DatasetRankingRow {
  dataset: string;
  image_id: string;
  images: number;
  avg_iou: number | null;
  avg_f1: number | null;
  avg_dice: number | null;
  winner_algorithm?: string | null;
  best_iou?: number | null;
  noise_score: number;
  edge_complexity: number;
  object_density: number | null;
  contour_fragmentation: number;
  difficulty_score: number;
  difficulty_class: string;
  metric_samples?: number;
}

export interface DatasetRankingResponse {
  mode?: string;
  table: DatasetRankingRow[];
  sorts?: Record<string, string | null>;
  benchmark_id?: string;
  benchmark_name?: string;
  benchmark_run_id?: string;
}

export const datasetRankingService = {
  getUserRanking(limit = 50): Promise<DatasetRankingResponse> {
    return apiFetch<DatasetRankingResponse>(`/api/datasets/ranking?limit=${limit}`);
  },

  getBenchmarkRunRanking(benchmarkId: string, runId: string): Promise<DatasetRankingResponse> {
    return apiFetch<DatasetRankingResponse>(`/api/datasets/ranking/${benchmarkId}/${runId}`);
  },
};
