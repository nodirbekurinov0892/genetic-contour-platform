import { apiFetch } from "@/lib/api";

export interface ApiRouteEntry {
  method: string;
  path: string;
}

export interface PerformanceAudit {
  table_counts: Record<string, number>;
  largest_table: string;
  storage_consumer_bytes: number;
  known_bottlenecks: Array<{
    area: string;
    issue: string;
    endpoint: string;
  }>;
  slow_endpoints: string[];
}

export interface SecurityAudit {
  jwt: { enabled: boolean; algorithm: string };
  rbac: {
    roles: string[];
    team_roles: string[];
    ownership_model: string;
  };
  upload_validation: Record<string, boolean>;
  rate_limiting: { enabled: boolean; library: string };
  storage_access: Record<string, unknown>;
  trusted_hosts: string[];
  cors_origins_count: number;
}

export interface ApiExplorer {
  openapi_url: string | null;
  docs_url: string | null;
  redoc_url: string | null;
  docs_enabled?: boolean;
  routes: ApiRouteEntry[];
  version: string;
}

export const platformService = {
  getPerformanceAudit(): Promise<PerformanceAudit> {
    return apiFetch<PerformanceAudit>("/api/platform/performance-audit");
  },

  getSecurityAudit(): Promise<SecurityAudit> {
    return apiFetch<SecurityAudit>("/api/platform/security-audit");
  },

  getApiExplorer(): Promise<ApiExplorer> {
    return apiFetch<ApiExplorer>("/api/platform/api-explorer");
  },
};
