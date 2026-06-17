import { apiFetch } from "@/lib/api";
import type { ImageRecord } from "@shared/types";

interface UploadResponse {
  image: ImageRecord;
  message: string;
}

export const imageService = {
  upload(file: File): Promise<UploadResponse> {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<UploadResponse>("/api/images/upload", {
      method: "POST",
      body: form,
    });
  },

  list(params?: {
    search?: string;
    has_ground_truth?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ImageRecord[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.has_ground_truth != null) {
      query.set("has_ground_truth", String(params.has_ground_truth));
    }
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<ImageRecord[]>(`/api/images${suffix}`);
  },

  getById(id: string): Promise<ImageRecord> {
    return apiFetch<ImageRecord>(`/api/images/${id}`);
  },

  async uploadGroundTruth(imageId: string, file: File): Promise<ImageRecord> {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<ImageRecord>(`/api/images/${imageId}/ground-truth`, {
      method: "POST",
      body: form,
    });
  },

  async clearGroundTruthReference(imageId: string): Promise<ImageRecord> {
    return apiFetch<ImageRecord>(`/api/storage/repair/clear-ground-truth/${imageId}`, {
      method: "POST",
    });
  },

  async deleteBrokenRecord(imageId: string): Promise<{ message: string; image_id: string }> {
    return apiFetch(`/api/images/${imageId}/cleanup-broken`, { method: "POST" });
  },

  getUsage(imageId: string): Promise<{ experiment_count: number; experiments: Array<{ id: string; title: string }> }> {
    return apiFetch(`/api/images/${imageId}/usage`);
  },

  update(imageId: string, data: { original_name?: string; description?: string }): Promise<ImageRecord> {
    return apiFetch<ImageRecord>(`/api/images/${imageId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async replaceFile(imageId: string, file: File): Promise<ImageRecord> {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<ImageRecord>(`/api/images/${imageId}/replace`, {
      method: "POST",
      body: form,
    });
  },

  detachGroundTruth(imageId: string): Promise<ImageRecord> {
    return apiFetch<ImageRecord>(`/api/images/${imageId}/gt`, { method: "DELETE" });
  },

  delete(
    imageId: string,
    options?: { cascadeExperiments?: boolean; permanent?: boolean; archive?: boolean },
  ): Promise<{ message: string; mode?: string }> {
    const q = new URLSearchParams();
    if (options?.cascadeExperiments) q.set("cascade_experiments", "true");
    if (options?.permanent) q.set("permanent", "true");
    if (options?.archive) q.set("archive", "true");
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return apiFetch(`/api/images/${imageId}${suffix}`, { method: "DELETE" });
  },
};
