"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNav, isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      {mobileNav.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
              active ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.mobileLabel ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
