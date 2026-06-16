import { apiFetch } from "@/lib/api";

export interface StorageCenterSummary {
  backend: string;
  images: { count: number; bytes: number; mb: number };
  ground_truths: { count: number };
  reports: { count: number };
  exports: { count: number };
  total_bytes: number;
  total_mb: number;
}

export const storageCenterService = {
  getSummary(): Promise<StorageCenterSummary> {
    return apiFetch<StorageCenterSummary>("/api/storage/center");
  },
};
