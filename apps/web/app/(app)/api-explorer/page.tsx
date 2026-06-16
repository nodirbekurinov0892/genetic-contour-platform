"use client";

import { useEffect, useMemo, useState } from "react";
import { Code2, Shield, Zap } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/state-panel";
import {
  platformService,
  type ApiExplorer,
  type PerformanceAudit,
  type SecurityAudit,
} from "@/services/platformService";

export default function ApiExplorerPage() {
  const [explorer, setExplorer] = useState<ApiExplorer | null>(null);
  const [performance, setPerformance] = useState<PerformanceAudit | null>(null);
  const [security, setSecurity] = useState<SecurityAudit | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      platformService.getApiExplorer(),
      platformService.getPerformanceAudit(),
      platformService.getSecurityAudit(),
    ])
      .then(([exp, perf, sec]) => {
        setExplorer(exp);
        setPerformance(perf);
        setSecurity(sec);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklash xatosi"))
      .finally(() => setLoading(false));
  }, []);

  const filteredRoutes = useMemo(() => {
    if (!explorer) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return explorer.routes;
    return explorer.routes.filter(
      (r) => r.path.toLowerCase().includes(q) || r.method.toLowerCase().includes(q),
    );
  }, [explorer, filter]);

  if (loading) return <LoadingState message="API Explorer yuklanmoqda..." />;
  if (error || !explorer) {
    return <ErrorState message={error ?? "Ma'lumot yo'q"} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="API Explorer"
        description={`Platforma versiyasi ${explorer.version} — ${explorer.routes.length} endpoint`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {performance && (
          <section className="scientific-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Zap className="h-4 w-4 text-amber-600" />
              Performance audit
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {Object.entries(performance.table_counts).map(([table, count]) => (
                <div key={table}>
                  <dt className="text-muted-foreground">{table}</dt>
                  <dd className="font-semibold">{count}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Eng katta jadval: {performance.largest_table} · Storage:{" "}
              {(performance.storage_consumer_bytes / (1024 * 1024)).toFixed(2)} MB
            </p>
          </section>
        )}

        {security && (
          <section className="scientific-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Shield className="h-4 w-4 text-emerald-600" />
              Security audit
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">JWT</dt>
                <dd>{security.jwt.enabled ? `${security.jwt.algorithm} faol` : "O'chirilgan"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">RBAC rollari</dt>
                <dd className="flex flex-wrap gap-1">
                  {security.rbac.roles.map((r) => (
                    <Badge key={r} variant="outline">
                      {r}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rate limiting</dt>
                <dd>{security.rate_limiting.enabled ? security.rate_limiting.library : "Yo'q"}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>

      <section className="scientific-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Code2 className="h-4 w-4" />
            API marshrutlari
          </h3>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Endpoint qidirish..."
            className="max-w-xs"
          />
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 w-24">Method</th>
                <th className="p-2">Path</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map((route, idx) => (
                <tr key={`${route.method}-${route.path}-${idx}`} className="border-b">
                  <td className="p-2">
                    <Badge variant={route.method === "GET" ? "secondary" : "default"}>
                      {route.method}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-xs">{route.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {explorer.docs_enabled === false
            ? "Production rejimida OpenAPI va /docs o'chirilgan."
            : `OpenAPI: ${explorer.openapi_url ?? "—"} · Docs: ${explorer.docs_url ?? "—"}`}
        </p>
      </section>
    </div>
  );
}
