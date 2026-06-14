import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FlaskConical,
  GitCompare,
  HelpCircle,
  Home,
  ImageIcon,
  LineChart,
  FileText,
  PlusCircle,
  Target,
  Trophy,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobileLabel?: string;
  showOnMobile?: boolean;
};

/** Enterprise scientific workflow — primary journey order. */
export const enterpriseNav: NavItem[] = [
  { href: "/", label: "Boshqaruv paneli", icon: Home, mobileLabel: "Panel", showOnMobile: true },
  {
    href: "/experiments/new",
    label: "Yangi tajriba",
    icon: PlusCircle,
    mobileLabel: "Yangi",
    showOnMobile: true,
  },
  { href: "/experiments", label: "Tajribalar", icon: FlaskConical, mobileLabel: "Tajribalar" },
  {
    href: "/comparison",
    label: "Taqqoslash markazi",
    icon: GitCompare,
    mobileLabel: "Taqqoslash",
    showOnMobile: true,
  },
  { href: "/ground-truth", label: "Ground Truth", icon: Target, mobileLabel: "GT" },
  { href: "/benchmarks", label: "Benchmarklar", icon: Trophy, mobileLabel: "Bench" },
  {
    href: "/analytics",
    label: "Analitika markazi",
    icon: LineChart,
    mobileLabel: "Analitika",
  },
  { href: "/reports", label: "Hisobotlar", icon: FileText, mobileLabel: "Hisobot" },
  {
    href: "/library",
    label: "Rasm kutubxonasi",
    icon: ImageIcon,
    mobileLabel: "Kutubxona",
    showOnMobile: true,
  },
  { href: "/help", label: "Yordam", icon: HelpCircle, mobileLabel: "Yordam", showOnMobile: true },
];

export const mobileNav = enterpriseNav.filter((item) => item.showOnMobile);

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/experiments/new") return pathname === "/experiments/new";
  if (href === "/experiments") {
    return (
      pathname === "/experiments" ||
      (pathname.startsWith("/experiments/") && !pathname.startsWith("/experiments/new"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
