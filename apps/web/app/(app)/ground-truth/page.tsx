"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, RefreshCw, Trash2, Upload, AlertTriangle } from "lucide-react";
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
  const [actionType, setActionType] = useState<"validate" | "delete" | "upload" | null>(null);

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
    setActionType("validate");
    try {
      await apiFetch(`/api/ground-truth/${id}/validate`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validatsiya xatosi");
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const deleteGt = async (id: string, name: string) => {
    if (!window.confirm(`"${name}" uchun Ground Truth o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`)) {
      return;
    }
    setActionId(id);
    setActionType("delete");
    try {
      await apiFetch(`/api/lifecycle/images/${id}/ground-truth`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'chirish xatosi");
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const clearGtReference = async (id: string) => {
    setActionId(id);
    setActionType("delete");
    try {
      await imageService.clearGroundTruthReference(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tozalash xatosi");
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const reuploadGt = async (id: string, file: File) => {
    setActionId(id);
    setActionType("upload");
    try {
      await imageService.uploadGroundTruth(id, file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qayta yuklash xatosi");
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  if (loading) return <LoadingState message="Ground Truth yuklanmoqda..." />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ground Truth boshqaruvi"
        description="GT juftlash, validatsiya holati va maska boshqaruvi"
      />

      {coverage && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          description="Rasm kutubxonasida Ground Truth mask yuklang."
          action={
            <Button asChild>
              <Link href="/library">Kutubxonaga o&apos;tish</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((img) => {
            const busy = actionId === img.id;
            return (
              <div key={img.id} className="scientific-card p-5">
                <div className="grid gap-5 lg:grid-cols-[auto_1fr_auto]">
                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Asl rasm
                      </p>
                      <div className="relative h-28 w-36 overflow-hidden rounded-lg border bg-muted/20">
                        <StoredImage
                          filePath={img.file_path}
                          url={img.url}
                          alt={img.original_name}
                          fill
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Ground Truth
                      </p>
                      <div className="relative h-28 w-36 overflow-hidden rounded-lg border bg-muted/20">
                        {img.ground_truth_url ? (
                          <StoredImage
                            filePath=""
                            url={img.ground_truth_url}
                            alt="Ground Truth"
                            fill
                          />
                        ) : img.ground_truth_storage_status === "reference_missing" ? (
                          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-amber-700">
                            <AlertTriangle className="h-4 w-4" />
                            GT fayl topilmadi
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            Mask yo&apos;q
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <p className="font-semibold">{img.original_name}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">{GT_PAIRING_LABELS.paired}</Badge>
                      <Badge variant="outline">
                        {formatGtValidationStatus(img.gt_validation_status)}
                      </Badge>
                      {img.ground_truth_storage_status === "available" && (
                        <Badge variant="success">GT fayl mavjud</Badge>
                      )}
                      {img.ground_truth_storage_status === "reference_missing" && (
                        <Badge variant="destructive">GT fayl topilmadi</Badge>
                      )}
                      {img.gt_validation_status === "valid" && img.ground_truth_storage_status === "available" && (
                        <Badge variant="success">Juftlik tasdiqlangan</Badge>
                      )}
                    </div>
                    {img.ground_truth_storage_status === "reference_missing" && (
                      <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        GT yozuvi bor, lekin storage fayli yo&apos;q. Qayta yuklang yoki bog&apos;lanishni olib tashlang.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {img.gt_validated_at
                        ? `Tekshirildi: ${new Date(img.gt_validated_at).toLocaleString("uz-UZ")}`
                        : "Validatsiya kutilmoqda"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => revalidate(img.id)}
                      className="gap-2"
                    >
                      {busy && actionType === "validate" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Qayta validatsiya
                    </Button>
                    <label className="inline-flex">
                      <Button size="sm" variant="outline" asChild disabled={busy} className="w-full gap-2">
                        <span>
                          {busy && actionType === "upload" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          Qayta yuklash
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void reuploadGt(img.id, file);
                        }}
                      />
                    </label>
                    {img.ground_truth_storage_status === "reference_missing" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => clearGtReference(img.id)}
                        className="gap-2"
                      >
                        GT bog&apos;lanishini olib tashlash
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => deleteGt(img.id, img.original_name)}
                      className="gap-2"
                    >
                      {busy && actionType === "delete" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      GT o&apos;chirish
                    </Button>
                  </div>
                </div>
                {img.gt_validation_status === "valid" && img.ground_truth_storage_status === "available" && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Nazoratli baholash uchun tayyor
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
