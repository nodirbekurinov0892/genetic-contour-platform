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

  list(): Promise<ImageRecord[]> {
    return apiFetch<ImageRecord[]>("/api/images");
  },

  getById(id: string): Promise<ImageRecord> {
    return apiFetch<ImageRecord>(`/api/images/${id}`);
  },
};
