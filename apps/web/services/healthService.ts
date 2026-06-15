export interface HealthStatus {
  status: string;
  service?: string;
  checks?: Record<string, string>;
}

async function fetchHealth(path: "/api/health/live" | "/api/health/ready"): Promise<HealthStatus> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Health check failed");
  }
  return res.json() as Promise<HealthStatus>;
}

export const healthService = {
  async ping(): Promise<HealthStatus> {
    return fetchHealth("/api/health/live");
  },

  async ready(): Promise<HealthStatus> {
    return fetchHealth("/api/health/ready");
  },
};
