import { apiFetch } from "@/lib/api";

export interface OrganizationMember {
  user_id: string;
  role: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  member_count: number;
  members: OrganizationMember[];
}

export interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export const teamService = {
  listOrganizations(): Promise<Organization[]> {
    return apiFetch<Organization[]>("/api/teams/organizations");
  },

  createOrganization(name: string): Promise<{ id: string; name: string; slug: string }> {
    return apiFetch("/api/teams/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  listAuditLogs(limit = 100): Promise<AuditLog[]> {
    return apiFetch<AuditLog[]>(`/api/teams/audit-logs?limit=${limit}`);
  },
};
