"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageOff, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  fetchAuthenticatedBlob,
  resolveMediaProxyUrl,
  resolveStaticUrl,
  resolveStorageKey,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface StoredImageProps {
  filePath: string;
  url?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
}

function shouldPreferProxyFirst(directSrc: string, storageKey: string): boolean {
  if (!storageKey) return false;
  if (process.env.NODE_ENV !== "production") return false;
  return (
    directSrc.includes("/static/results/") ||
    directSrc.includes("/static/uploads/") ||
    directSrc.includes("onrender.com/static/")
  );
}

export function StoredImage({
  filePath,
  url,
  alt,
  className,
  fill = false,
}: StoredImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const triedProxyRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const storageKey = resolveStorageKey(filePath, url);
  const directSrc = resolveStaticUrl(filePath, url);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const loadViaProxy = useCallback(async () => {
    if (!storageKey) {
      setError("Rasm manzili topilmadi");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const objectUrl = await fetchAuthenticatedBlob(resolveMediaProxyUrl(storageKey));
      revokeObjectUrl();
      objectUrlRef.current = objectUrl;
      setDisplaySrc(objectUrl);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Noma'lum xato";
      setError(`Rasm yuklanmadi: ${message}`);
      setDisplaySrc(null);
    } finally {
      setLoading(false);
    }
  }, [revokeObjectUrl, storageKey]);

  useEffect(() => {
    triedProxyRef.current = false;
    revokeObjectUrl();
    setError(null);

    if (!storageKey && !directSrc) {
      setDisplaySrc(null);
      setError("Rasm manzili topilmadi");
      setLoading(false);
      return;
    }

    if (!directSrc || shouldPreferProxyFirst(directSrc, storageKey)) {
      void loadViaProxy();
      return;
    }

    setDisplaySrc(directSrc);
    setLoading(false);
  }, [directSrc, loadViaProxy, revokeObjectUrl, storageKey, reloadToken]);

  useEffect(() => () => revokeObjectUrl(), [revokeObjectUrl]);

  const handleImageError = () => {
    if (triedProxyRef.current || !storageKey) {
      setError("Rasm yuklanmadi — qayta urinib ko'ring");
      setDisplaySrc(null);
      setLoading(false);
      return;
    }

    triedProxyRef.current = true;
    void loadViaProxy();
  };

  const handleRetry = () => {
    triedProxyRef.current = false;
    setReloadToken((t) => t + 1);
  };

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground",
          fill && "absolute inset-0",
          className,
        )}
      >
        <Loader2 className="h-6 w-6 animate-spin opacity-50" />
      </div>
    );
  }

  if (error || !displaySrc) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 px-3 text-center text-muted-foreground",
          fill && "absolute inset-0",
          className,
        )}
      >
        <ImageOff className="h-8 w-8 opacity-40" />
        <span className="text-xs leading-relaxed">{error ?? "Rasm mavjud emas"}</span>
        {storageKey && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleRetry}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Qayta yuklash
          </Button>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      className={cn(
        fill ? "absolute inset-0 h-full w-full object-contain p-2" : "h-full w-full object-contain",
        className,
      )}
      onError={handleImageError}
    />
  );
}
