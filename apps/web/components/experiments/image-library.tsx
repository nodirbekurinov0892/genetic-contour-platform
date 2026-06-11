"use client";

import { useCallback, useEffect, useState } from "react";
import { Target, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StoredImage } from "@/components/ui/stored-image";
import { LoadingState } from "@/components/ui/state-panel";
import { imageService } from "@/services/imageService";
import type { ImageRecord } from "@shared/types";

interface ImageLibraryProps {
  onSelect?: (image: ImageRecord) => void;
}

export function ImageLibrary({ onSelect }: ImageLibraryProps) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [gtOnly, setGtOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingGtFor, setUploadingGtFor] = useState<string | null>(null);

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
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const handleGtUpload = async (imageId: string, file: File) => {
    setUploadingGtFor(imageId);
    try {
      await imageService.uploadGroundTruth(imageId, file);
      await load();
    } finally {
      setUploadingGtFor(null);
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
      </div>
      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Rasmlar topilmadi.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <div key={image.id} className="scientific-card overflow-hidden">
              <button
                type="button"
                className="relative block aspect-video w-full bg-muted/20"
                onClick={() => onSelect?.(image)}
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
              </button>
              <div className="space-y-2 border-t p-3">
                <p className="truncate text-sm font-medium">{image.original_name}</p>
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
                <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingGtFor === image.id ? "Yuklanmoqda..." : "GT maska yuklash"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingGtFor === image.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleGtUpload(image.id, file);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
