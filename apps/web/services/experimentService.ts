import { API_BASE, apiFetch, downloadFile } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import type {
  AlgorithmName,
  AlgorithmParams,
  ExperimentBrowseResponse,
  ExperimentJobResponse,
  ExperimentRecord,
  ExperimentResults,
  ExperimentStatusResponse,
  GAParams,
  ScientificInsights,
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

  browse(params?: {
    search?: string;
    status?: string;
    algorithm?: string;
    date_from?: string;
    date_to?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<ExperimentBrowseResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.status) query.set("status", params.status);
    if (params?.algorithm) query.set("algorithm", params.algorithm);
    if (params?.date_from) query.set("date_from", params.date_from);
    if (params?.date_to) query.set("date_to", params.date_to);
    if (params?.sort) query.set("sort", params.sort);
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<ExperimentBrowseResponse>(`/api/experiments/browse${suffix}`);
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
      comparison_protocol?: string;
      seed?: number;
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

  clone(id: string): Promise<ExperimentRecord> {
    return apiFetch<ExperimentRecord>(`/api/experiments/${id}/clone`, {
      method: "POST",
    });
  },

  rerun(id: string): Promise<ExperimentJobResponse> {
    return apiFetch<ExperimentJobResponse>(`/api/experiments/${id}/rerun`, {
      method: "POST",
    });
  },

  getInsights(id: string): Promise<ScientificInsights> {
    return apiFetch<ScientificInsights>(`/api/experiments/${id}/insights`);
  },

  getResults(id: string): Promise<ExperimentResults> {
    return apiFetch<ExperimentResults>(`/api/experiments/${id}/results`);
  },

  getReport(
    id: string,
    reportType: "scientific" | "executive" | "technical" | "benchmark" = "scientific",
  ): Promise<Record<string, unknown>> {
    return apiFetch<Record<string, unknown>>(
      `/api/experiments/${id}/report?report_type=${reportType}`,
    );
  },

  downloadPdf(id: string): Promise<void> {
    return downloadFile(`/api/experiments/${id}/report/pdf`, `experiment-${id}-report.pdf`);
  },

  downloadXlsx(
    id: string,
    reportType: "scientific" | "executive" | "technical" | "benchmark" = "scientific",
  ): Promise<void> {
    return downloadFile(
      `/api/experiments/${id}/report/xlsx?report_type=${reportType}`,
      `experiment-${id}-${reportType}-report.xlsx`,
    );
  },

  async downloadJson(
    id: string,
    reportType: "scientific" | "executive" | "technical" | "benchmark" = "scientific",
  ): Promise<void> {
    const report = await apiFetch<Record<string, unknown>>(
      `/api/experiments/${id}/report?report_type=${reportType}`,
    );
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

  streamUrl(id: string): string {
    return `${API_BASE}/api/experiments/${id}/stream`;
  },

  streamHeaders(): Record<string, string> {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
};
