import { apiFetch } from "@/lib/api";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  payload_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export const notificationService = {
  list(params?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]> {
    const q = new URLSearchParams();
    if (params?.unreadOnly) q.set("unread_only", "true");
    if (params?.limit != null) q.set("limit", String(params.limit));
    const suffix = q.toString() ? `?${q}` : "";
    return apiFetch<Notification[]>(`/api/notifications${suffix}`);
  },

  unreadCount(): Promise<{ count: number }> {
    return apiFetch<{ count: number }>("/api/notifications/unread-count");
  },

  markRead(id: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: "POST" });
  },

  markAllRead(): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>("/api/notifications/read-all", { method: "POST" });
  },
};
