"use client";

import { StoredImage } from "@/components/ui/stored-image";
import { cn } from "@/lib/utils";
import type { ImageRecord } from "@shared/types";
import { Check, Target } from "lucide-react";

interface ImagePickerProps {
  images: ImageRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ImagePicker({ images, selectedId, onSelect }: ImagePickerProps) {
  if (images.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Rasmlar yo&apos;q. Avval rasm yuklang.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image) => {
        const selected = image.id === selectedId;
        return (
          <button
            key={image.id}
            type="button"
            onClick={() => onSelect(image.id)}
            className={cn(
              "scientific-card overflow-hidden text-left transition",
              selected && "ring-2 ring-primary",
            )}
          >
            <div className="relative aspect-video bg-muted/30">
              <StoredImage
                filePath={image.file_path}
                url={image.url}
                alt={image.original_name}
                fill
              />
              {selected && (
                <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              {image.has_ground_truth && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-600/90 px-2 py-0.5 text-[10px] text-white">
                  <Target className="h-3 w-3" />
                  GT
                </span>
              )}
            </div>
            <div className="border-t px-3 py-2">
              <p className="truncate text-xs font-medium">{image.original_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {image.width}x{image.height}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
