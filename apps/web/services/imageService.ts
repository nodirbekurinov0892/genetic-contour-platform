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
};
