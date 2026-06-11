"use client";

import { useState } from "react";
import { StoredImage } from "@/components/ui/stored-image";

export interface ComparisonImage {
  label: string;
  filePath: string;
  url?: string | null;
}

interface ComparisonSliderProps {
  images: ComparisonImage[];
}

export function ComparisonSlider({ images }: ComparisonSliderProps) {
  const [index, setIndex] = useState(0);
  const current = images[index];

  if (!current || images.length === 0) return null;

  return (
    <div className="scientific-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <p className="text-sm font-semibold">Vizual taqqoslash</p>
        <div className="flex flex-wrap gap-1">
          {images.map((img, i) => (
            <button
              key={img.label}
              type="button"
              onClick={() => setIndex(i)}
              className={`rounded-md px-2 py-1 text-xs ${
                i === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {img.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative aspect-[4/3] bg-muted/20">
        <StoredImage
          filePath={current.filePath}
          url={current.url}
          alt={current.label}
          fill
        />
      </div>
      {images.length > 1 && (
        <div className="border-t px-4 py-3">
          <input
            type="range"
            min={0}
            max={images.length - 1}
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {current.label} ({index + 1}/{images.length})
          </p>
        </div>
      )}
    </div>
  );
}
