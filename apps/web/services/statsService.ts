import { apiFetch } from "@/lib/api";

export interface PlatformStats {
  total_experiments: number;
  completed_experiments: number;
  failed_experiments: number;
  total_images: number;
  best_ga_fitness: number | null;
  algorithms_count: number;
}

export const statsService = {
  get(): Promise<PlatformStats> {
    return apiFetch<PlatformStats>("/api/stats");
  },
};
