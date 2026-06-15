"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  ChevronRight,
  LogOut,
  RefreshCw,
  Settings,
  User,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { useHeaderClock } from "@/components/providers/system-status-provider";
import { getBreadcrumbs, getPageTitle } from "@/lib/page-titles";
import {
  formatUserRole,
  getUserDisplayName,
  getUserInitials,
} from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { dateLabel, weekday, syncLabel, apiStatus, refresh } = useHeaderClock();
  const pageTitle = getPageTitle(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);
  const profile = user?.profile_data ?? null;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="mb-1 hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-primary">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{pageTitle}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs lg:flex">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                apiStatus === "online" && "bg-emerald-500",
                apiStatus === "offline" && "bg-destructive",
                apiStatus === "checking" && "bg-amber-500 animate-pulse",
              )}
              aria-hidden
            />
            <span className="text-muted-foreground">{syncLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => void refresh()}
              aria-label="Holatni yangilash"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="hidden text-right text-xs leading-tight md:block">
            <p className="font-medium">{weekday}</p>
            <p className="text-muted-foreground">{dateLabel}</p>
          </div>

          <ThemeToggle />

          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Bildirishnomalar">
            <Bell className="h-4 w-4" />
          </Button>

          {user && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Foydalanuvchi menyusi"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                    {getUserInitials(user.name, profile, user.email)}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-sm font-medium">
                      {getUserDisplayName(user.name, profile)}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {formatUserRole(user.role)}
                    </span>
                  </span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[220px] rounded-lg border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <div className="border-b border-border/60 px-3 py-2">
                    <p className="truncate text-sm font-medium">{getUserDisplayName(user.name, profile)}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <Badge variant="secondary" className="mt-2">
                      {formatUserRole(user.role)}
                    </Badge>
                  </div>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/profile"
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent"
                    >
                      <User className="h-4 w-4" />
                      Profil
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/profile?tab=security"
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-accent"
                    >
                      <Settings className="h-4 w-4" />
                      Sozlamalar
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10"
                    onSelect={() => void logout()}
                  >
                    <LogOut className="h-4 w-4" />
                    Tizimdan chiqish
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>

      {apiStatus === "offline" && (
        <div className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive sm:px-6">
          API bilan aloqa uzildi. Ba&apos;zi funksiyalar vaqtincha ishlamasligi mumkin.
        </div>
      )}
    </header>
  );
}
