"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Upload, CheckCircle, AlertCircle, FileImage, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageCard } from "@/components/experiments/image-card";
import { SectionHeader } from "@/components/ui/section-header";
import { imageService } from "@/services/imageService";
import type { ImageRecord } from "@shared/types";
import { formatBytes, cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImageRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const validateAndSetFile = useCallback((selected: File) => {
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Faqat JPG, PNG va WebP fayllar qabul qilinadi");
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError("Fayl hajmi 10 MB dan oshmasligi kerak");
      return;
    }
    setError(null);
    setFile(selected);
    setResult(null);
    setPreview(URL.createObjectURL(selected));
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) validateAndSetFile(selected);
    },
    [validateAndSetFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const selected = e.dataTransfer.files?.[0];
      if (selected) validateAndSetFile(selected);
    },
    [validateAndSetFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await imageService.upload(file);
      setResult(res.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash muvaffaqiyatsiz");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHeader
        title="Rasm yuklash"
        description="Kontur aniqlash tajribalari uchun test rasmlarini yuklang. Qo'llab-quvvatlanadi: JPG, PNG, WebP — maks. 10 MB."
        badge="Kirish ma'lumoti"
      />

      <div className="scientific-card overflow-hidden">
        <label
          htmlFor="file-upload"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            "drop-zone m-4",
            dragActive && "drop-zone-active",
            file && "border-solid",
          )}
        >
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <p className="text-base font-semibold">
            {dragActive ? "Rasmni shu yerga tashlang" : "Rasmni sudrab olib keling"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            yoki fayl tanlash uchun bosing
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            JPG · PNG · WebP · 10 MB gacha
          </p>
          <input
            id="file-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={onFileSelect}
          />
        </label>

        {preview && file && (
          <div className="border-t bg-muted/20 p-6">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0 overflow-hidden rounded-lg border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Ko'rib chiqish" className="h-32 w-32 object-contain p-1" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{file.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Hajm</dt>
                  <dd>{formatBytes(file.size)}</dd>
                  <dt className="text-muted-foreground">Turi</dt>
                  <dd>{file.type}</dd>
                </dl>
                <Button onClick={handleUpload} disabled={uploading} className="w-full sm:w-auto">
                  {uploading ? "Yuklanmoqda..." : "Rasm yuklash"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="mx-4 mb-4 flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Muvaffaqiyatli yuklandi
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href="/experiments">Tajriba ishga tushirish</Link>
            </Button>
          </div>
        )}
      </div>

      {result && (
        <section>
          <SectionHeader title="Yuklangan rasm" />
          <ImageCard image={result} />
        </section>
      )}
    </div>
  );
}
