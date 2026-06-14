"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, RefreshCw, Trash2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StoredImage } from "@/components/ui/stored-image";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-panel";
import { imageService } from "@/services/imageService";
import { formatGtValidationStatus, GT_PAIRING_LABELS } from "@/lib/user-labels";
import type { ImageRecord } from "@shared/types";

export default function GroundTruthPage() {
  const [items, setItems] = useState<ImageRecord[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number | string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

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
    setActionId(id);
    try {
      await apiFetch(`/api/ground-truth/${id}/validate`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validatsiya xatosi");
    } finally {
      setActionId(null);
    }
  };

  const deleteGt = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" uchun Ground Truth o'chirilsinmi?`)) return;
    setActionId(id);
    try {
      await apiFetch(`/api/lifecycle/images/${id}/ground-truth`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirish xatosi");
    } finally {
      setActionId(null);
    }
  };

  const reuploadGt = async (id: string, file: File) => {
    setActionId(id);
    try {
      await imageService.uploadGroundTruth(id, file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qayta yuklash xatosi");
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <LoadingState message="Ground Truth yuklanmoqda..." />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ground Truth boshqaruvi"
        description="GT juftlash, validatsiya va lifecycle"
        badge="GT"
      />
      {coverage && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["Jami rasmlar", coverage.total_images],
            ["GT bilan juft", coverage.with_ground_truth],
            ["Tasdiqlangan GT", coverage.valid_gt],
            ["Qamrov %", coverage.coverage_pct],
          ].map(([label, val]) => (
            <div key={String(label)} className="scientific-card p-4 text-center">
              <p className="text-2xl font-bold">{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      {items.length === 0 ? (
        <EmptyState
          title="GT juftliklari yo'q"
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
            <div key={img.id} className="scientific-card flex flex-wrap gap-4 p-4">
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded border bg-muted/20">
                <StoredImage
                  filePath={img.file_path}
                  url={img.url}
                  alt={img.original_name}
                  fill
                />
              </div>
              {img.ground_truth_url && (
                <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded border bg-muted/20">
                  <StoredImage
                    filePath=""
                    url={img.ground_truth_url}
                    alt="GT"
                    fill
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{img.original_name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="default">{GT_PAIRING_LABELS.paired}</Badge>
                  <Badge variant="outline">
                    {formatGtValidationStatus(img.gt_validation_status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {img.gt_validated_at
                    ? `Tekshirildi: ${new Date(img.gt_validated_at).toLocaleString("uz-UZ")}`
                    : "Hali tekshirilmagan"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {img.gt_validation_status === "valid" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionId === img.id}
                  onClick={() => revalidate(img.id)}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Qayta validatsiya
                </Button>
                <label className="inline-flex">
                  <Button size="sm" variant="outline" asChild disabled={actionId === img.id}>
                    <span>
                      <Upload className="mr-1 h-3.5 w-3.5" />
                      Qayta yuklash
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void reuploadGt(img.id, file);
                    }}
                  />
                </label>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={actionId === img.id}
                  onClick={() => deleteGt(img.id, img.original_name)}
                >
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
