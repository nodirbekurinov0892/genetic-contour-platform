"use client";

import Image from "next/image";
import { resolveStaticUrl } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import type { ImageRecord } from "@shared/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImageCardProps {
  image: ImageRecord;
}

export function ImageCard({ image }: ImageCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="truncate text-sm font-medium">{image.original_name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mb-3 aspect-video overflow-hidden rounded-md bg-muted">
          <Image
            src={resolveStaticUrl(image.file_path, image.url)}
            alt={image.original_name}
            fill
            className="object-contain"
            unoptimized
          />
        </div>
        <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          <dt>Size</dt>
          <dd>{image.width}×{image.height}</dd>
          <dt>File</dt>
          <dd>{formatBytes(image.size)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
