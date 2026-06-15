"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AuthFooter } from "@/components/layout/auth-footer";
import { AuthHeroPanel, AuthMobileBrand } from "@/components/auth/auth-hero-panel";

export function AuthLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:flex-row">
      <AuthHeroPanel />
      <div className="relative flex min-h-screen flex-1 flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50/80 via-background to-background dark:from-sky-950/20" />
        <header className="relative z-10 flex items-center justify-end px-6 py-5 lg:px-10">
          <ThemeToggle />
        </header>
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-6 lg:px-10">
          <div className="w-full max-w-md">
            <AuthMobileBrand />
            {children}
          </div>
        </main>
        <AuthFooter />
      </div>
    </div>
  );
}
