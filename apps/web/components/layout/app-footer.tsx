"use client";

import Link from "next/link";
import { PLATFORM_NAME, PLATFORM_VERSION } from "@shared/constants";
import { useHeaderClock } from "@/components/providers/system-status-provider";

const ENV_LABEL =
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.NODE_ENV ??
  "development";

export function AppFooter() {
  const { apiStatus } = useHeaderClock();

  return (
    <footer className="border-t border-border/80 bg-card/50 px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {PLATFORM_NAME} © {new Date().getFullYear()}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span>Versiya: v{PLATFORM_VERSION}</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={
                apiStatus === "online"
                  ? "inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"
                  : apiStatus === "offline"
                    ? "inline-flex h-1.5 w-1.5 rounded-full bg-destructive"
                    : "inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"
              }
            />
            API {apiStatus === "online" ? "online" : apiStatus === "offline" ? "offline" : "..."}
          </span>
          <span>Muhit: {ENV_LABEL}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/legal/privacy" className="hover:text-primary">
            Maxfiylik siyosati
          </Link>
          <Link href="/legal/terms" className="hover:text-primary">
            Foydalanish shartlari
          </Link>
          <Link href="/help" className="hover:text-primary">
            Yordam
          </Link>
        </div>
      </div>
    </footer>
  );
}
