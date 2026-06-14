"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNav, isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background md:hidden">
      {mobileNav.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center py-2 text-[10px] transition-colors",
              active ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {item.mobileLabel ?? item.label}
          </Link>
        );
      })}
    </nav>
  );
}
