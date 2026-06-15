"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { PLATFORM_NAME, PLATFORM_SUBTITLE } from "@shared/constants";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AuthFooter } from "@/components/layout/auth-footer";

export function AuthLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
        aria-hidden
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/login" className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{PLATFORM_NAME}</p>
            <p className="text-xs text-muted-foreground">{PLATFORM_SUBTITLE}</p>
          </div>
        </Link>
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <AuthFooter />
    </div>
  );
}
