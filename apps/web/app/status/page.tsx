import { PLATFORM_NAME } from "@shared/constants";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://genetic-contour-platform.onrender.com";
const WEB_URL =
  process.env.NEXT_PUBLIC_WEB_URL || "https://genetic-contour-platform-web.vercel.app";

type HealthPayload = {
  status?: string;
  service?: string;
  checks?: Record<string, { ok: boolean; detail: string }>;
};

async function fetchHealth(path: string): Promise<{ ok: boolean; data: HealthPayload | null }> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
    const data = (await res.json()) as HealthPayload;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

export default async function StatusPage() {
  const [live, ready] = await Promise.all([
    fetchHealth("/health"),
    fetchHealth("/health/ready"),
  ]);

  const checks = ready.data?.checks ?? {};
  const routes = [
    { path: "/ground-truth", label: "Ground Truth" },
    { path: "/benchmarks", label: "Benchmarks" },
    { path: "/help", label: "Help" },
    { path: "/onboarding", label: "Onboarding" },
    { path: "/legal/terms", label: "Legal — Terms" },
    { path: "/legal/privacy", label: "Legal — Privacy" },
    { path: "/legal/cookies", label: "Legal — Cookies" },
  ];

  const routeResults = await Promise.all(
    routes.map(async (route) => {
      try {
        const res = await fetch(`${WEB_URL}${route.path}`, {
          method: "HEAD",
          next: { revalidate: 300 },
        });
        return { ...route, status: res.status, ok: res.ok };
      } catch {
        return { ...route, status: 0, ok: false };
      }
    }),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold">{PLATFORM_NAME} — Production Status</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase Ultimate · Public research platform · Last checked at page load (cached ~60s)
        </p>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">API</h2>
        <p className="text-sm text-muted-foreground break-all">{API_URL}</p>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium">/health</span> —{" "}
            {live.ok ? (
              <span className="text-green-600">OK ({live.data?.status})</span>
            ) : (
              <span className="text-red-600">DOWN</span>
            )}
          </li>
          <li>
            <span className="font-medium">/health/ready</span> —{" "}
            {ready.ok ? (
              <span className="text-green-600">OK ({ready.data?.status})</span>
            ) : (
              <span className="text-amber-600">
                DEGRADED ({ready.data?.status ?? "unreachable"})
              </span>
            )}
          </li>
        </ul>
        {Object.keys(checks).length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">Check</th>
                <th className="py-1">Status</th>
                <th className="py-1">Detail</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(checks).map(([name, check]) => (
                <tr key={name} className="border-b border-muted/40">
                  <td className="py-1 font-medium">{name}</td>
                  <td className="py-1">{check.ok ? "ok" : "fail"}</td>
                  <td className="py-1 text-muted-foreground">{check.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {checks.redis?.detail?.includes("asyncio") && (
          <p className="text-xs text-muted-foreground">
            Redis skipped — expected when <code>EXPERIMENT_QUEUE_BACKEND=asyncio</code>. See{" "}
            <code>docs/queue-scalability.md</code> for scaling to Celery + Redis.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Frontend routes</h2>
        <p className="text-sm text-muted-foreground break-all">{WEB_URL}</p>
        <ul className="space-y-1 text-sm">
          {routeResults.map((r) => (
            <li key={r.path}>
              <span className="font-medium">{r.path}</span> —{" "}
              {r.ok ? (
                <span className="text-green-600">{r.status}</span>
              ) : (
                <span className="text-red-600">{r.status || "error"}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">Operational notes</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>SMTP not configured — auth runs in degraded mode (auto-verify on register).</li>
          <li>Migrations applied via Render start command: <code>alembic upgrade head</code>.</li>
          <li>Production E2E: <code>node scripts/production_e2e_ultimate.mjs</code> (23 checks).</li>
        </ul>
      </section>
    </div>
  );
}
