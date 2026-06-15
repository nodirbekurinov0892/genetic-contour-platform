"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers } from "lucide-react";
import { PLATFORM_NAME } from "@shared/constants";
import { cn } from "@/lib/utils";
import { enterpriseNavCategories, isNavItemActive } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border/80 bg-sidebar text-sidebar-foreground md:flex">
      <div className="border-b border-border/80 px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <p className="truncate text-sm font-semibold leading-tight">{PLATFORM_NAME}</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {enterpriseNavCategories.map((category) => (
          <div key={category.id}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {category.label}
            </p>
            <div className="space-y-0.5">
              {category.items.map(({ href, label, icon: Icon }) => {
                const active = isNavItemActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/15"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
