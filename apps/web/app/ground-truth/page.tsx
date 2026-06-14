"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-panel";
import type { ImageRecord } from "@shared/types";

export default function GroundTruthPage() {
  const [items, setItems] = useState<ImageRecord[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number | string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gt, cov] = await Promise.all([
        apiFetch<ImageRecord[]>("/api/ground-truth"),
        apiFetch<Record<string, number | string>>("/api/ground-truth/coverage"),
      ]);
      setItems(gt);
      setCoverage(cov);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const revalidate = async (id: string) => {
    await apiFetch(`/api/ground-truth/${id}/validate`, { method: "POST" });
    await load();
  };

  const deleteGt = async (id: string) => {
    await apiFetch(`/api/lifecycle/images/${id}/ground-truth`, { method: "DELETE" });
    await load();
  };

  if (loading) return <LoadingState message="Ground Truth yuklanmoqda..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ground Truth Manager"
        description="GT validatsiya, provenance va lifecycle boshqaruvi"
        badge="GT v2"
      />
      {coverage && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Jami rasmlar", coverage.total_images],
            ["GT bilan", coverage.with_ground_truth],
            ["Valid GT", coverage.valid_gt],
            ["Qamrov %", coverage.coverage_pct],
          ].map(([label, val]) => (
            <div key={String(label)} className="scientific-card p-4 text-center">
              <p className="text-2xl font-bold">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState
          title="GT juftliklari yo&apos;q"
          description="Rasm kutubxonasida ground truth yuklang."
          action={
            <Button asChild>
              <Link href="/library">Kutubxonaga o&apos;tish</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((img) => (
            <div key={img.id} className="scientific-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{img.original_name}</p>
                <p className="text-xs text-muted-foreground">
                  Status: {img.gt_validation_status ?? "pending"} ·{" "}
                  {img.gt_validated_at ? new Date(img.gt_validated_at).toLocaleString() : "—"}
                </p>
              </div>
              <div className="flex gap-2">
                {img.gt_validation_status === "valid" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                <Button size="sm" variant="outline" onClick={() => revalidate(img.id)}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Qayta validatsiya
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteGt(img.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  GT o&apos;chirish
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
