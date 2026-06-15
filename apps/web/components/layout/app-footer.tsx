"use client";

import Link from "next/link";
import { BookOpen, FileText, HelpCircle, Layers, Shield } from "lucide-react";
import { PLATFORM_NAME, PLATFORM_VERSION } from "@shared/constants";
import { useHeaderClock } from "@/components/providers/system-status-provider";

const ENV_LABEL =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

export function AppFooter() {
  const { apiStatus } = useHeaderClock();

  return (
    <footer className="border-t border-sky-200/60 bg-gradient-to-r from-sky-50/80 to-blue-50/50 px-4 py-6 dark:border-sky-500/15 dark:from-slate-950 dark:to-sky-950/20 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1400px] gap-6 md:grid-cols-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <p className="text-sm font-semibold">{PLATFORM_NAME}</p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Konturlarni ilmiy tahlil qilish va taqqoslash uchun enterprise platforma.
          </p>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Barcha huquqlar himoyalangan</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platforma</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/help" className="inline-flex items-center gap-2 hover:text-sky-700 dark:hover:text-sky-300">
                <BookOpen className="h-3.5 w-3.5" />
                Hujjatlar
              </Link>
            </li>
            <li>
              <Link href="/help" className="inline-flex items-center gap-2 hover:text-sky-700 dark:hover:text-sky-300">
                <HelpCircle className="h-3.5 w-3.5" />
                Yordam
              </Link>
            </li>
            <li>
              <Link href="/status" className="inline-flex items-center gap-2 hover:text-sky-700 dark:hover:text-sky-300">
                <Shield className="h-3.5 w-3.5" />
                API holati
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Huquqiy</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/legal/privacy" className="hover:text-sky-700 dark:hover:text-sky-300">
                Maxfiylik siyosati
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="hover:text-sky-700 dark:hover:text-sky-300">
                Foydalanish shartlari
              </Link>
            </li>
            <li>
              <Link href="/legal/cookies" className="hover:text-sky-700 dark:hover:text-sky-300">
                Cookie siyosati
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tizim</p>
          <p className="text-muted-foreground">Versiya: v{PLATFORM_VERSION}</p>
          <p className="inline-flex items-center gap-2 text-muted-foreground">
            <span
              className={
                apiStatus === "online"
                  ? "inline-flex h-2 w-2 rounded-full bg-emerald-500"
                  : apiStatus === "offline"
                    ? "inline-flex h-2 w-2 rounded-full bg-destructive"
                    : "inline-flex h-2 w-2 rounded-full bg-amber-500"
              }
            />
            API {apiStatus === "online" ? "online" : apiStatus === "offline" ? "offline" : "tekshirilmoqda"}
          </p>
          <p className="text-muted-foreground">Muhit: {ENV_LABEL}</p>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 text-sky-700 hover:underline dark:text-sky-300"
          >
            <FileText className="h-3.5 w-3.5" />
            Qo&apos;llab-quvvatlash
          </Link>
        </div>
      </div>
    </footer>
  );
}
