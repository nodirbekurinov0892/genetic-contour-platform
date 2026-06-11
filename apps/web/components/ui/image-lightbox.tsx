"use client";

import { useEffect } from "react";
import { X, Download } from "lucide-react";
import { StoredImage } from "@/components/ui/stored-image";
import { downloadImage } from "@/lib/download-image";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  open: boolean;
  onClose: () => void;
  filePath: string;
  url?: string | null;
  alt: string;
  title?: string;
}

export function ImageLightbox({
  open,
  onClose,
  filePath,
  url,
  alt,
  title,
}: ImageLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{title ?? alt}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                "hover:bg-muted",
              )}
              onClick={() => downloadImage(filePath, url, `${title ?? alt}.png`)}
            >
              <Download className="h-3.5 w-3.5" />
              Yuklab olish
            </button>
            <button
              type="button"
              className="rounded-md p-1 hover:bg-muted"
              onClick={onClose}
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative aspect-[4/3] bg-muted/30">
          <StoredImage filePath={filePath} url={url} alt={alt} fill />
        </div>
      </div>
    </div>
  );
}
