"use client";

import Link from "next/link";
import {
  BarChart3,
  FlaskConical,
  GitCompare,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PLATFORM_NAME, PLATFORM_SUBTITLE, PLATFORM_VERSION } from "@shared/constants";

const stats = [
  { label: "Algoritmlar", value: "12+" },
  { label: "Metrikalar", value: "18+" },
  { label: "Hisobot formatlari", value: "PDF/CSV" },
];

const advantages = [
  {
    icon: FlaskConical,
    title: "Ilmiy tajriba wizardi",
    body: "5 bosqichli jarayon: yuklash, GT, algoritm, baholash, eksport.",
  },
  {
    icon: GitCompare,
    title: "Taqqoslash va benchmark",
    body: "Natijalarni ilmiy metrikalar bo'yicha tahlil qiling.",
  },
  {
    icon: ShieldCheck,
    title: "Xavfsiz kirish",
    body: "Cookie-based sessiya va rollar asosida boshqaruv.",
  },
];

export function AuthHeroPanel() {
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:w-[52%] lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-sky-50 to-blue-100 dark:from-sky-950 dark:via-slate-950 dark:to-blue-950" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.35), transparent 40%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.25), transparent 35%)",
        }}
      />
      <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
        <div>
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-2xl bg-sky-500/15 p-3 ring-1 ring-sky-500/20">
              <Layers className="h-7 w-7 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">{PLATFORM_NAME}</p>
              <p className="text-sm text-muted-foreground">{PLATFORM_SUBTITLE}</p>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-sky-200/60 bg-white/60 p-6 backdrop-blur dark:border-sky-500/20 dark:bg-slate-900/50">
            <div className="mb-4 flex items-center gap-2 text-sky-700 dark:text-sky-300">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Ilmiy tahlil platformasi</span>
            </div>
            <svg viewBox="0 0 420 180" className="h-auto w-full text-sky-500/80" aria-hidden>
              <defs>
                <linearGradient id="heroLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path
                d="M20 140 C 80 40, 140 160, 200 80 S 320 40, 400 100"
                fill="none"
                stroke="url(#heroLine)"
                strokeWidth="3"
              />
              {[40, 110, 180, 250, 320].map((x, i) => (
                <circle key={x} cx={x} cy={140 - i * 18} r="5" fill="currentColor" opacity={0.35 + i * 0.12} />
              ))}
              <rect x="20" y="20" width="380" height="140" rx="12" fill="none" stroke="currentColor" strokeOpacity="0.15" />
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-sky-200/70 bg-white/70 px-4 py-3 text-center dark:border-sky-500/20 dark:bg-slate-900/40"
              >
                <p className="text-xl font-semibold text-sky-700 dark:text-sky-300">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {advantages.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex gap-3 rounded-xl border border-sky-200/60 bg-white/50 p-4 dark:border-sky-500/15 dark:bg-slate-900/35"
            >
              <div className="rounded-lg bg-sky-500/10 p-2">
                <Icon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Versiya v{PLATFORM_VERSION} · Enterprise scientific workflow
          </p>
        </div>
      </div>
    </div>
  );
}

export function AuthMobileBrand() {
  return (
    <Link href="/login" className="mb-6 flex items-center gap-3 lg:hidden">
      <div className="rounded-xl bg-sky-500/10 p-2.5">
        <Layers className="h-5 w-5 text-sky-600 dark:text-sky-400" />
      </div>
      <div>
        <p className="text-sm font-semibold">{PLATFORM_NAME}</p>
        <p className="text-xs text-muted-foreground">{PLATFORM_SUBTITLE}</p>
      </div>
    </Link>
  );
}
