import { API_BASE, apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";

export interface StoredReport {
  id: string;
  experiment_id: string;
  experiment_title: string;
  format: string;
  title: string;
  storage_status: "available" | "missing";
  created_at: string | null;
}

export const reportService = {
  list(limit = 50): Promise<{ items: StoredReport[] }> {
    return apiFetch<{ items: StoredReport[] }>(`/api/reports?limit=${limit}`);
  },

  update(reportId: string, data: { title: string }): Promise<{ id: string; title: string | null }> {
    return apiFetch(`/api/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete(reportId: string): Promise<{ message: string }> {
    return apiFetch(`/api/reports/${reportId}`, { method: "DELETE" });
  },

  regenerate(reportId: string): Promise<{ id: string; storage_key: string }> {
    return apiFetch(`/api/reports/${reportId}/regenerate`, { method: "POST" });
  },

  async exportZip(reportIds?: string[]): Promise<void> {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/api/reports/export-zip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ report_ids: reportIds ?? null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(typeof body.detail === "string" ? body.detail : "Eksport xatosi");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reports-export.zip";
    a.click();
    URL.revokeObjectURL(url);
  },
};
