"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StoredImage } from "@/components/ui/stored-image";
import { LoadingState } from "@/components/ui/state-panel";
import { useToast } from "@/components/providers/toast-provider";
import { imageService } from "@/services/imageService";
import type { ImageRecord } from "@shared/types";

interface ImageLibraryProps {
  onSelect?: (image: ImageRecord) => void;
  refreshKey?: number;
}

function storageBadge(image: ImageRecord) {
  if (image.storage_status === "missing") {
    return (
      <Badge variant="destructive" className="absolute right-2 top-2 text-[10px]">
        Fayl topilmadi
      </Badge>
    );
  }
  if (image.ground_truth_storage_status === "reference_missing") {
    return (
      <Badge variant="outline" className="absolute right-2 top-2 border-amber-500 text-[10px] text-amber-700">
        GT yo&apos;q
      </Badge>
    );
  }
  return null;
}

export function ImageLibrary({ onSelect, refreshKey = 0 }: ImageLibraryProps) {
  const { toast } = useToast();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [gtOnly, setGtOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingGtFor, setUploadingGtFor] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameDesc, setRenameDesc] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ImageRecord | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<{ experiment_count: number } | null>(null);
  const [cascadeDelete, setCascadeDelete] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState<ImageRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await imageService.list({
        search: search || undefined,
        has_ground_truth: gtOnly ? true : undefined,
        limit: 100,
      });
      setImages(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Yuklash xatosi", "error");
    } finally {
      setLoading(false);
    }
  }, [search, gtOnly, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);

  const handleGtUpload = async (imageId: string, file: File) => {
    setUploadingGtFor(imageId);
    try {
      await imageService.uploadGroundTruth(imageId, file);
      toast("GT yuklandi", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Yuklash xatosi", "error");
    } finally {
      setUploadingGtFor(null);
    }
  };

  const handleReplaceFile = async (imageId: string, file: File) => {
    setActionId(imageId);
    try {
      await imageService.replaceFile(imageId, file);
      toast("Fayl almashtirildi", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Xato", "error");
    } finally {
      setActionId(null);
      setMenuId(null);
    }
  };

  const openDelete = async (image: ImageRecord) => {
    setMenuId(null);
    setDeleteTarget(image);
    setCascadeDelete(false);
    try {
      const usage = await imageService.getUsage(image.id);
      setDeleteUsage(usage);
    } catch {
      setDeleteUsage({ experiment_count: 0 });
    }
  };

  const closeDelete = () => {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeleteUsage(null);
    setCascadeDelete(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const linked = deleteUsage?.experiment_count ?? 0;
    try {
      await imageService.delete(deleteTarget.id, {
        cascadeExperiments: cascadeDelete,
        permanent: cascadeDelete || linked === 0,
        archive: !cascadeDelete && linked > 0,
      });
      const msg = cascadeDelete
        ? "Rasm va bog'langan tajribalar o'chirildi"
        : linked > 0
          ? "Rasm arxivlandi"
          : "Rasm o'chirildi";
      toast(msg, "success");
      closeDelete();
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "O'chirish xatosi", "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmCleanup = async () => {
    if (!cleanupTarget) return;
    setCleanupBusy(true);
    try {
      await imageService.deleteBrokenRecord(cleanupTarget.id);
      toast("Buzilgan yozuv tozalandi", "success");
      setCleanupTarget(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Tozalash xatosi", "error");
    } finally {
      setCleanupBusy(false);
    }
  };

  if (loading && images.length === 0) {
    return <LoadingState message="Rasm kutubxonasi yuklanmoqda..." />;
  }

  const linkedCount = deleteUsage?.experiment_count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rasm qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button type="button" variant={gtOnly ? "default" : "outline"} size="sm" onClick={() => setGtOnly((v) => !v)}>
          <Target className="mr-1 h-3.5 w-3.5" />
          Faqat GT
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          Yangilash
        </Button>
      </div>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Rasmlar topilmadi.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => {
            const broken = image.storage_status === "missing";
            const gtMissing = image.ground_truth_storage_status === "reference_missing";
            const cardBusy = actionId === image.id || deleteBusy;
            return (
              <div key={image.id} className="scientific-card overflow-hidden">
                <div className="relative">
                  <button
                    type="button"
                    className="relative block aspect-video w-full bg-muted/20"
                    onClick={() => !broken && onSelect?.(image)}
                    disabled={broken}
                  >
                    <StoredImage filePath={image.file_path} url={image.url} alt={image.original_name} fill />
                    {image.has_ground_truth && (
                      <span className="absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
                        GT
                      </span>
                    )}
                    {storageBadge(image)}
                  </button>
                  <div className="absolute right-2 top-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setMenuId(menuId === image.id ? null : image.id)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    {menuId === image.id && (
                      <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border bg-background p-1 shadow-lg">
                        <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted" onClick={() => { setRenameId(image.id); setRenameValue(image.original_name); setRenameDesc(""); setMenuId(null); }}>
                          <Pencil className="h-3 w-3" /> Qayta nomlash
                        </button>
                        <label className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted">
                          <Upload className="h-3 w-3" /> Faylni almashtirish
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleReplaceFile(image.id, f); e.target.value = ""; }} />
                        </label>
                        <Link href={`/experiments?image=${image.id}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted" onClick={() => setMenuId(null)}>
                          <ExternalLink className="h-3 w-3" /> Bog&apos;liq tajribalar
                        </Link>
                        <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10" onClick={() => void openDelete(image)}>
                          <Trash2 className="h-3 w-3" /> O&apos;chirish
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t p-3">
                  <p className="truncate text-sm font-medium">{image.original_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Storage: {broken ? "Fayl topilmadi" : image.storage_status === "available" ? "Mavjud" : "Noma'lum"}
                    {gtMissing && " · GT fayl yo'q"}
                  </p>

                  {broken && (
                    <div className="space-y-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>Fayl storage&apos;da topilmadi.</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-destructive/30 bg-background px-2 py-1">
                          <Upload className="h-3 w-3" /> Qayta yuklash
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={cardBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleReplaceFile(image.id, f); e.target.value = ""; }} />
                        </label>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={cardBusy} onClick={() => setCleanupTarget(image)}>
                          Yozuvni tozalash
                        </Button>
                      </div>
                    </div>
                  )}

                  {!broken && (
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingGtFor === image.id ? "Yuklanmoqda..." : "GT maska yuklash"}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploadingGtFor === image.id || cardBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleGtUpload(image.id, f); e.target.value = ""; }} />
                      </label>
                      {gtMissing && (
                        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={cardBusy} onClick={() => void imageService.detachGroundTruth(image.id).then(() => load()).then(() => toast("GT ajratildi", "success")).catch((e) => toast(e instanceof Error ? e.message : "Xato", "error"))}>
                          GT ajratish
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renameId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6">
            <h3 className="font-semibold">Rasmni tahrirlash</h3>
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="img-rename">Nom</Label>
                <Input id="img-rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="img-desc">Tavsif</Label>
                <Input id="img-desc" value={renameDesc} onChange={(e) => setRenameDesc(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameId(null)}>Bekor</Button>
              <Button disabled={!renameValue.trim()} onClick={() => void imageService.update(renameId, { original_name: renameValue.trim(), ...(renameDesc.trim() ? { description: renameDesc.trim() } : {}) }).then(() => { toast("Yangilandi", "success"); setRenameId(null); return load(); }).catch((e) => toast(e instanceof Error ? e.message : "Xato", "error"))}>
                Saqlash
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Rasmni o'chirish?"
        description={
          linkedCount > 0
            ? `Bu rasm ${linkedCount} ta tajribada ishlatilgan. Faqat arxivlash yoki tajribalar bilan birga o'chirish mumkin.`
            : "Rasm va storage fayli o'chiriladi."
        }
        confirmLabel={cascadeDelete ? "Tajribalar bilan o'chirish" : linkedCount > 0 ? "Faqat arxivlash" : "O'chirish"}
        destructive
        loading={deleteBusy}
        onCancel={closeDelete}
        onConfirm={() => void confirmDelete()}
      />

      {deleteTarget && linkedCount > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-[60] mx-auto flex max-w-md justify-center px-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background p-3 text-sm shadow-lg">
            <input type="checkbox" checked={cascadeDelete} onChange={(e) => setCascadeDelete(e.target.checked)} disabled={deleteBusy} />
            Bog&apos;langan tajribalar bilan birga o&apos;chirish
          </label>
        </div>
      )}

      <ConfirmDialog
        open={!!cleanupTarget}
        title="Buzilgan yozuvni tozalash?"
        description={`"${cleanupTarget?.original_name}" DB yozuvi o'chiriladi.`}
        confirmLabel="Tozalash"
        destructive
        loading={cleanupBusy}
        onCancel={() => !cleanupBusy && setCleanupTarget(null)}
        onConfirm={() => void confirmCleanup()}
      />
    </div>
  );
}
