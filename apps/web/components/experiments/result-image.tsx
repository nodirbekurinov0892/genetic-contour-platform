"use client";

import { StoredImage } from "@/components/ui/stored-image";
import { cn } from "@/lib/utils";

interface ResultImageProps {
  filePath: string;
  url?: string | null;
  alt: string;
  label?: string;
  className?: string;
}

export function ResultImageView({ filePath, url, alt, label, className }: ResultImageProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
        <StoredImage filePath={filePath} url={url} alt={alt} fill />
      </div>
    </div>
  );
}
