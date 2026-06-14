import { apiFetch } from "@/lib/api";

export interface ActivityDay {
  date: string;
  count: number;
}

export interface PlatformStats {
  total_experiments: number;
  completed_experiments: number;
  failed_experiments: number;
  total_images: number;
  paired_images: number;
  gt_coverage_pct: number;
  best_ga_fitness: number | null;
  algorithms_count: number;
  avg_iou: number | null;
  avg_f1: number | null;
  avg_dice: number | null;
  avg_runtime_ms: number | null;
  most_used_algorithm: string | null;
  activity_7d: ActivityDay[];
}

export const statsService = {
  get(): Promise<PlatformStats> {
    return apiFetch<PlatformStats>("/api/stats");
  },
};
