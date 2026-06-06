"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff, Maximize2 } from "lucide-react";
import { resolveStaticUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ScientificImageCardProps {
  filePath: string;
  url?: string | null;
  alt: string;
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
  highlight?: boolean;
}

export function ScientificImageCard({
  filePath,
  url,
  alt,
  title,
  subtitle,
  badge,
  className,
  highlight = false,
}: ScientificImageCardProps) {
  const [error, setError] = useState(false);
  const src = resolveStaticUrl(filePath, url);

  return (
    <div
      className={cn(
        "scientific-card group overflow-hidden",
        highlight && "ring-2 ring-primary/30",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {badge && <span className="scientific-badge">{badge}</span>}
      </div>
      <div className="relative aspect-[4/3] bg-muted/20">
        {error || !src ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8 opacity-40" />
            <span className="text-xs">Rasm mavjud emas</span>
          </div>
        ) : (
          <>
            <Image
              src={src}
              alt={alt}
              fill
              className="object-contain p-2"
              unoptimized
              onError={() => setError(true)}
            />
            <div className="absolute bottom-2 right-2 rounded-md bg-background/80 p-1 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
