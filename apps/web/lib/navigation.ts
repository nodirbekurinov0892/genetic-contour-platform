import type { LucideIcon } from "lucide-react";
import {
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
  User,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  mobileLabel?: string;
  showOnMobile?: boolean;
};

export type NavCategory = {
  id: string;
  label: string;
  items: NavItem[];
};

export const enterpriseNavCategories: NavCategory[] = [
  {
    id: "main",
    label: "Asosiy",
    items: [
      { href: "/", label: "Boshqaruv paneli", icon: Home, mobileLabel: "Panel", showOnMobile: true },
      {
        href: "/experiments/new",
        label: "Yangi tajriba",
        icon: PlusCircle,
        mobileLabel: "Yangi",
        showOnMobile: true,
      },
    ],
  },
  {
    id: "workflow",
    label: "Tajriba jarayoni",
    items: [
      { href: "/experiments", label: "Tajribalar", icon: FlaskConical, mobileLabel: "Tajribalar" },
      {
        href: "/comparison",
        label: "Natijalarni taqqoslash",
        icon: GitCompare,
        mobileLabel: "Taqqoslash",
        showOnMobile: true,
      },
      { href: "/reports", label: "Hisobotlar", icon: FileText, mobileLabel: "Hisobot" },
    ],
  },
  {
    id: "data",
    label: "Ma'lumotlar",
    items: [
      {
        href: "/library",
        label: "Rasm kutubxonasi",
        icon: ImageIcon,
        mobileLabel: "Kutubxona",
        showOnMobile: true,
      },
      { href: "/ground-truth", label: "Ground Truth boshqaruvi", icon: Target, mobileLabel: "GT" },
      { href: "/benchmarks", label: "Benchmark to'plamlari", icon: Trophy, mobileLabel: "Bench" },
    ],
  },
  {
    id: "analysis",
    label: "Tahlil",
    items: [
      {
        href: "/analytics",
        label: "Analitika markazi",
        icon: LineChart,
        mobileLabel: "Analitika",
      },
    ],
  },
  {
    id: "system",
    label: "Tizim",
    items: [
      { href: "/profile", label: "Profil", icon: User, mobileLabel: "Profil" },
      { href: "/help", label: "Yordam", icon: HelpCircle, mobileLabel: "Yordam", showOnMobile: true },
    ],
  },
];

/** Flat list for mobile nav and legacy consumers. */
export const enterpriseNav: NavItem[] = enterpriseNavCategories.flatMap((c) => c.items);

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
