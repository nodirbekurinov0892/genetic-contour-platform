"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  ChevronRight,
  Layers,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { useHeaderClock } from "@/components/providers/system-status-provider";
import { getBreadcrumbs, getPageTitle } from "@/lib/page-titles";
import {
  formatUserRole,
  getRoleBadgeVariant,
  getUserDisplayName,
} from "@/lib/user-profile";
import { notificationService } from "@/services/notificationService";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { dateLabel, weekday, syncLabel, apiStatus, refresh } = useHeaderClock();
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const pageTitle = getPageTitle(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);
  const profile = user?.profile_data ?? null;

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    notificationService
      .unreadCount()
      .then((res) => setUnreadCount(res.count))
      .catch(() => setUnreadCount(0));
  }, [user, pathname]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-sky-200/70 bg-gradient-to-r from-sky-50/95 via-sky-50/90 to-blue-50/90 backdrop-blur dark:border-sky-500/20 dark:from-slate-950/95 dark:via-sky-950/40 dark:to-slate-950/95">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 lg:min-w-[220px]">
          <Link href="/" className="hidden items-center gap-2 rounded-lg p-1.5 hover:bg-sky-500/10 md:flex">
            <div className="rounded-lg bg-sky-500/15 p-1.5">
              <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
          </Link>
          <div className="min-w-0 flex-1">
            <nav
              aria-label="Breadcrumb"
              className="mb-0.5 hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex"
            >
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="h-3 w-3" />}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-sky-700 dark:hover:text-sky-300">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <h1 className="truncate text-base font-semibold tracking-tight text-sky-950 dark:text-sky-50 sm:text-lg">
              {pageTitle}
            </h1>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          className="order-last hidden w-full min-w-0 sm:order-none sm:flex sm:max-w-xs sm:flex-1 lg:max-w-sm"
        >
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Qidiruv: rasm, tajriba..."
              className="h-9 border-sky-200/70 bg-white/80 pl-9 dark:border-sky-500/20 dark:bg-slate-900/60"
              aria-label="Global qidiruv"
            />
          </div>
        </form>

        <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-sky-200/70 bg-white/70 px-3 py-1.5 text-xs dark:border-sky-500/20 dark:bg-slate-900/50 lg:flex">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                apiStatus === "online" && "bg-emerald-500",
                apiStatus === "offline" && "bg-destructive",
                apiStatus === "checking" && "animate-pulse bg-amber-500",
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
            <p className="font-medium text-sky-900 dark:text-sky-100">{weekday}</p>
            <p className="text-muted-foreground">{dateLabel}</p>
          </div>

          <ThemeToggle />

          <Button variant="ghost" size="sm" className="relative h-9 w-9 p-0" asChild>
            <Link href="/notifications" aria-label="Bildirishnomalar">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </Button>

          {user && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-sky-200/70 bg-white/80 px-2 py-1.5 text-left transition-colors hover:bg-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-400/40 dark:border-sky-500/20 dark:bg-slate-900/60"
                  aria-label="Foydalanuvchi menyusi"
                >
                  <UserAvatar user={user} size="sm" />
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
                  className="z-50 min-w-[240px] rounded-lg border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <div className="border-b border-border/60 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {getUserDisplayName(user.name, profile)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <Badge variant={getRoleBadgeVariant(user.role)} className="mt-2">
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
