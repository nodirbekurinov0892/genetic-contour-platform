"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState } from "@/components/ui/state-panel";
import { teamService, type AuditLog, type Organization } from "@/services/teamService";
import { formatDate } from "@/lib/utils";

export default function TeamPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgList, auditLogs] = await Promise.all([
        teamService.listOrganizations(),
        teamService.listAuditLogs(50),
      ]);
      setOrgs(orgList);
      setLogs(auditLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createOrg = async () => {
    if (!name.trim()) {
      setError("Tashkilot nomini kiriting");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await teamService.createOrganization(name.trim());
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yaratish xatosi");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Jamoa ma'lumotlari yuklanmoqda..." />;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Jamoa boshqaruvi"
        description="Tashkilotlar, a'zolar va audit jurnali"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="scientific-card space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Plus className="h-5 w-5" />
          Yangi tashkilot
        </h2>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="org-name">Tashkilot nomi</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan, Kontur Lab"
            />
          </div>
          <Button className="self-end" disabled={busy} onClick={() => void createOrg()}>
            Yaratish
          </Button>
        </div>
      </div>

      {orgs.length === 0 ? (
        <EmptyState
          title="Tashkilotlar yo'q"
          description="Yuqoridagi forma orqali birinchi tashkilotni yarating."
        />
      ) : (
        <div className="space-y-4">
          {orgs.map((org) => (
            <div key={org.id} className="scientific-card p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Users className="h-4 w-4" />
                    {org.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{org.slug}</p>
                </div>
                <Badge variant="outline">{org.member_count} a&apos;zo</Badge>
              </div>
              {org.members.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {org.members.map((m) => (
                    <li key={m.user_id} className="flex items-center gap-2">
                      <span className="font-mono text-xs">{m.user_id.slice(0, 8)}...</span>
                      <Badge variant="secondary">{m.role}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <section className="scientific-card p-5">
        <h3 className="mb-4 font-semibold">Audit jurnali</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Audit yozuvlari yo&apos;q.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Vaqt</th>
                  <th className="p-2">Amal</th>
                  <th className="p-2">Resurs</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="p-2 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="p-2">{log.action}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {log.resource_type}
                      {log.resource_id ? ` · ${log.resource_id.slice(0, 8)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
