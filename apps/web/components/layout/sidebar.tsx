"use client";

import {
  BarChart3,
  FlaskConical,
  Home,
  ImagePlus,
  FileText,
  Dna,
  LogIn,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Boshqaruv paneli", icon: Home },
  { href: "/upload", label: "Rasm yuklash", icon: ImagePlus },
  { href: "/experiments", label: "Tajribalar", icon: FlaskConical },
  { href: "/reports", label: "Hisobotlar", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Dna className="h-6 w-6 text-primary" />
        <div>
          <p className="text-sm font-semibold">Genetik kontur</p>
          <p className="text-xs text-muted-foreground">Aniqlash platformasi</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
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
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4 space-y-3">
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
            v0.2.0
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
