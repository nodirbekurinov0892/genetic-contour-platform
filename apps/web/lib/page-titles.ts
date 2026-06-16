export const PAGE_TITLES: Record<string, string> = {
  "/": "Boshqaruv paneli",
  "/experiments/new": "Yangi tajriba",
  "/experiments": "Tajribalar",
  "/comparison": "Natijalarni taqqoslash",
  "/ground-truth": "Ground Truth boshqaruvi",
  "/benchmarks": "Benchmark to'plamlari",
  "/leaderboard": "Leaderboard Center",
  "/datasets/ranking": "Dataset reytingi",
  "/analytics": "Analitika markazi",
  "/reports": "Hisobotlar",
  "/library": "Rasm kutubxonasi",
  "/help": "Yordam",
  "/profile": "Profil",
  "/status": "Tizim holati",
  "/onboarding": "Boshlang'ich yo'riqnoma",
  "/notifications": "Bildirishnomalar",
  "/storage": "Saqlash markazi",
  "/search": "Global qidiruv",
  "/api-explorer": "API Explorer",
  "/team": "Jamoa boshqaruvi",
};

export function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/experiments/") && pathname !== "/experiments/new") {
    return "Tajriba tafsilotlari";
  }
  return "Contour Analytics Platform";
}

export function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: "Boshqaruv paneli", href: "/" },
  ];

  if (pathname === "/") return [{ label: "Boshqaruv paneli" }];

  const title = getPageTitle(pathname);
  if (pathname.startsWith("/experiments/") && pathname !== "/experiments/new") {
    return [...crumbs, { label: "Tajribalar", href: "/experiments" }, { label: title }];
  }

  return [...crumbs, { label: title }];
}

export const UZ_WEEKDAYS = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
] as const;

export function formatHeaderDate(date: Date): { dateLabel: string; weekday: string; timeLabel: string } {
  const weekday = UZ_WEEKDAYS[date.getDay()];
  const dateLabel = new Intl.DateTimeFormat("uz-UZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return { dateLabel, weekday, timeLabel };
}
