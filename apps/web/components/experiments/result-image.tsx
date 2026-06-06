"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { resolveStaticUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ResultImageProps {
  filePath: string;
  url?: string | null;
  alt: string;
  label?: string;
  className?: string;
}

export function ResultImageView({ filePath, url, alt, label, className }: ResultImageProps) {
  const [error, setError] = useState(false);
  const src = resolveStaticUrl(filePath, url);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
        {error || !src ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span className="text-xs">Rasm mavjud emas</span>
          </div>
        ) : (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            unoptimized
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  );
}
