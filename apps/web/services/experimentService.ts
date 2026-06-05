import { apiFetch, downloadFile } from "@/lib/api";
import type {
  AlgorithmName,
  AlgorithmParams,
  ExperimentJobResponse,
  ExperimentRecord,
  ExperimentResults,
  ExperimentStatusResponse,
  GAParams,
} from "@shared/types";

export const experimentService = {
  create(data: {
    image_id: string;
    title: string;
    description?: string;
  }): Promise<ExperimentRecord> {
    return apiFetch<ExperimentRecord>("/api/experiments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  list(): Promise<ExperimentRecord[]> {
    return apiFetch<ExperimentRecord[]>("/api/experiments");
  },

  getById(id: string): Promise<ExperimentRecord> {
    return apiFetch<ExperimentRecord>(`/api/experiments/${id}`);
  },

  run(
    id: string,
    data: {
      algorithm: AlgorithmName;
      params: AlgorithmParams;
      ga_params?: GAParams;
    },
  ): Promise<ExperimentJobResponse> {
    return apiFetch<ExperimentJobResponse>(`/api/experiments/${id}/run`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getStatus(id: string): Promise<ExperimentStatusResponse> {
    return apiFetch<ExperimentStatusResponse>(`/api/experiments/${id}/status`);
  },

  cancel(id: string): Promise<ExperimentStatusResponse> {
    return apiFetch<ExperimentStatusResponse>(`/api/experiments/${id}/cancel`, {
      method: "POST",
    });
  },

  getResults(id: string): Promise<ExperimentResults> {
    return apiFetch<ExperimentResults>(`/api/experiments/${id}/results`);
  },

  getReport(id: string): Promise<Record<string, unknown>> {
    return apiFetch<Record<string, unknown>>(`/api/experiments/${id}/report`);
  },

  downloadPdf(id: string): Promise<void> {
    return downloadFile(`/api/experiments/${id}/report/pdf`, `experiment-${id}-report.pdf`);
  },

  async downloadJson(id: string): Promise<void> {
    const report = await apiFetch<Record<string, unknown>>(`/api/experiments/${id}/report`);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment-${id}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadCsv(id: string): Promise<void> {
    return downloadFile(`/api/experiments/${id}/report/csv`, `experiment-${id}-report.csv`);
  },

  delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/api/experiments/${id}`, {
      method: "DELETE",
    });
  },
};
