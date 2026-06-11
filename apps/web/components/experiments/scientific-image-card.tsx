"use client";

import { Download, Maximize2 } from "lucide-react";
import { StoredImage } from "@/components/ui/stored-image";
import { downloadImage } from "@/lib/download-image";
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
  onInspect?: () => void;
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
  onInspect,
}: ScientificImageCardProps) {
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
      <button
        type="button"
        className="relative block aspect-[4/3] w-full bg-muted/20"
        onClick={onInspect}
      >
        <StoredImage filePath={filePath} url={url} alt={alt} fill />
        {onInspect && (
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-md bg-background/80 p-1 backdrop-blur">
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </div>
        )}
      </button>
      <div className="flex justify-end border-t px-3 py-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => downloadImage(filePath, url, `${title}.png`)}
        >
          <Download className="h-3.5 w-3.5" />
          Yuklab olish
        </button>
      </div>
    </div>
  );
}
