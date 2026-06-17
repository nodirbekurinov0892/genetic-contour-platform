import { apiFetch } from "@/lib/api";

export interface ResearchCleanupResult {
  message: string;
  deleted: {
    experiments: number;
    images: number;
    benchmarks: number;
    benchmark_runs: number;
    reports: number;
    notifications: number;
  };
  storage_failures: string[];
  orphans_removed: number;
}

export const accountService = {
  cleanupMyResearchData(confirmPhrase: string): Promise<ResearchCleanupResult> {
    return apiFetch<ResearchCleanupResult>("/api/account/cleanup/my-research-data", {
      method: "POST",
      body: JSON.stringify({ confirm_phrase: confirmPhrase }),
    });
  },
};
