import { apiFetch } from "@/lib/api";

export interface BenchmarkDeleteImpact {
  benchmark_id: string;
  benchmark_name: string;
  run_count: number;
  linked_experiments: number;
  dataset_count: number;
}

export const benchmarkManagementService = {
  update(
    benchmarkId: string,
    data: { name?: string; description?: string | null; category?: string | null },
  ): Promise<{ id: string; name: string; description: string | null; category: string | null }> {
    return apiFetch(`/api/benchmarks/${benchmarkId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  archive(benchmarkId: string): Promise<{ message: string }> {
    return apiFetch(`/api/benchmarks/${benchmarkId}/archive`, { method: "POST" });
  },

  restore(benchmarkId: string): Promise<{ message: string }> {
    return apiFetch(`/api/benchmarks/${benchmarkId}/restore`, { method: "POST" });
  },

  deleteImpact(benchmarkId: string): Promise<BenchmarkDeleteImpact> {
    return apiFetch(`/api/benchmarks/${benchmarkId}/delete-impact`);
  },

  delete(benchmarkId: string, permanent = false): Promise<{ message: string; mode?: string }> {
    const q = permanent ? "?permanent=true" : "";
    return apiFetch(`/api/benchmarks/${benchmarkId}${q}`, { method: "DELETE" });
  },

  removeDatasetImage(benchmarkId: string, imageId: string): Promise<{ message: string }> {
    return apiFetch(`/api/benchmarks/${benchmarkId}/datasets/${imageId}`, { method: "DELETE" });
  },
};
