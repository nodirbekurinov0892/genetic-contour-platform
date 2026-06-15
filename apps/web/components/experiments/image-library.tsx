"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Target, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StoredImage } from "@/components/ui/stored-image";
import { LoadingState } from "@/components/ui/state-panel";
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
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [gtOnly, setGtOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingGtFor, setUploadingGtFor] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await imageService.list({
        search: search || undefined,
        has_ground_truth: gtOnly ? true : undefined,
        limit: 100,
      });
      setImages(data);
    } finally {
      setLoading(false);
    }
  }, [search, gtOnly]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);

  const handleGtUpload = async (imageId: string, file: File) => {
    setUploadingGtFor(imageId);
    try {
      await imageService.uploadGroundTruth(imageId, file);
      await load();
    } finally {
      setUploadingGtFor(null);
    }
  };

  const handleClearGt = async (imageId: string) => {
    setActionId(imageId);
    try {
      await imageService.clearGroundTruthReference(imageId);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteRecord = async (imageId: string, name: string) => {
    if (!window.confirm(`"${name}" yozuvi tozalansinmi? (Faqat DB yozuvi, fayl allaqachon yo'qolgan bo'lishi mumkin)`)) {
      return;
    }
    setActionId(imageId);
    try {
      await imageService.deleteBrokenRecord(imageId);
      await load();
    } finally {
      setActionId(null);
    }
  };

  if (loading && images.length === 0) {
    return <LoadingState message="Rasm kutubxonasi yuklanmoqda..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Rasm qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant={gtOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setGtOnly((v) => !v)}
        >
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
            const busy = actionId === image.id;
            return (
              <div key={image.id} className="scientific-card overflow-hidden">
                <button
                  type="button"
                  className="relative block aspect-video w-full bg-muted/20"
                  onClick={() => onSelect?.(image)}
                  disabled={broken}
                >
                  <StoredImage
                    filePath={image.file_path}
                    url={image.url}
                    alt={image.original_name}
                    fill
                  />
                  {image.has_ground_truth && (
                    <span className="absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
                      GT
                    </span>
                  )}
                  {storageBadge(image)}
                </button>
                <div className="space-y-2 border-t p-3">
                  <p className="truncate text-sm font-medium">{image.original_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Storage:{" "}
                    {broken
                      ? "Fayl topilmadi"
                      : image.storage_status === "available"
                        ? "Mavjud"
                        : "Noma'lum"}
                    {gtMissing && " · GT fayl yo'q"}
                  </p>
                  {broken && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Fayl topilmadi. Qayta yuklang yoki yozuvni tozalang.</span>
                    </div>
                  )}
                  {image.has_ground_truth && image.ground_truth_url && (
                    <div className="relative aspect-video overflow-hidden rounded border">
                      <StoredImage
                        filePath=""
                        url={image.ground_truth_url}
                        alt="Ground truth"
                        fill
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingGtFor === image.id ? "Yuklanmoqda..." : "GT maska yuklash"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploadingGtFor === image.id || busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleGtUpload(image.id, file);
                        }}
                      />
                    </label>
                    {gtMissing && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={busy}
                        onClick={() => void handleClearGt(image.id)}
                      >
                        GT bog&apos;lanishini olib tashlash
                      </Button>
                    )}
                    {broken && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs gap-1"
                        disabled={busy}
                        onClick={() => void handleDeleteRecord(image.id, image.original_name)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Yozuvni tozalash
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
