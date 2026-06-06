"use client";

import { Maximize2 } from "lucide-react";
import { StoredImage } from "@/components/ui/stored-image";
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
        <StoredImage filePath={filePath} url={url} alt={alt} fill />
        <div className="absolute bottom-2 right-2 rounded-md bg-background/80 p-1 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
