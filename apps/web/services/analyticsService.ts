import { apiFetch } from "@/lib/api";

export interface StatSummary {
  mean: number | null;
  median: number | null;
  std: number | null;
  variance: number | null;
  min: number | null;
  max: number | null;
  count: number;
}

export interface HistogramBin {
  bin: string;
  count: number;
  min: number;
  max: number;
}

export interface AlgorithmLeaderboardEntry {
  rank: number;
  algorithm: string;
  avg_iou: number;
  avg_f1: number | null;
  avg_dice: number | null;
  avg_runtime_ms: number | null;
  sample_count: number;
}

export interface TrendPoint {
  date: string;
  experiments: number;
  avg_iou: number | null;
}

export interface AdvancedAnalytics {
  summary: {
    total_experiments: number;
    completed_experiments: number;
    failed_experiments: number;
    success_rate_pct: number;
    benchmark_runs: number;
    algorithms_count: number;
  };
  algorithm_leaderboard: AlgorithmLeaderboardEntry[];
  top_algorithm: string | null;
  worst_algorithm: string | null;
  runtime_analytics: Record<string, StatSummary>;
  iou_distribution: HistogramBin[];
  iou_statistics: StatSummary;
  f1_distribution: HistogramBin[];
  f1_statistics: StatSummary;
  dice_distribution: HistogramBin[];
  dice_statistics: StatSummary;
  precision_recall_analysis: Array<{
    algorithm: string;
    precision: number;
    recall: number;
    f1_score: number | null;
  }>;
  dataset_performance: Array<{
    image_id: string;
    name: string;
    avg_iou: number | null;
    metric_samples: number;
  }>;
  trend_analysis: TrendPoint[];
}

export const analyticsService = {
  getAdvanced(): Promise<AdvancedAnalytics> {
    return apiFetch<AdvancedAnalytics>("/api/analytics/advanced");
  },
};
