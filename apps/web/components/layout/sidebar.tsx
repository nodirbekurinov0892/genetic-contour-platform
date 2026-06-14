"use client";

import {
  BarChart3,
  LogIn,
  LogOut,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLATFORM_NAME, PLATFORM_SUBTITLE, PLATFORM_VERSION } from "@shared/constants";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { enterpriseNav, isNavItemActive } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{PLATFORM_NAME}</p>
            <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
              {PLATFORM_SUBTITLE}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ilmiy ish oqimi
        </p>
        {enterpriseNav.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t p-4">
        {user ? (
          <div className="space-y-2">
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => logout()}
            >
              <LogOut className="h-3.5 w-3.5" />
              Chiqish
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <Link href="/login">
              <LogIn className="h-3.5 w-3.5" />
              Kirish
            </Link>
          </Button>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            v{PLATFORM_VERSION}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
