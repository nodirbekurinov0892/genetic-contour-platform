import Link from "next/link";
import { PLATFORM_NAME } from "@shared/constants";
import { Button } from "@/components/ui/button";

const topics = [
  { title: "Yangi tajriba", href: "/experiments/new", body: "5 bosqichli wizard orqali compare_all ishga tushiring." },
  { title: "Ground Truth", href: "/ground-truth", body: "GT validatsiya, qayta tekshirish va o&apos;chirish." },
  { title: "Benchmarklar", href: "/benchmarks", body: "Cohort benchmark va leaderboard." },
  { title: "Hisobotlar", href: "/reports", body: "PDF v3 ilmiy hisobotlar." },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-bold">{PLATFORM_NAME} — Yordam markazi</h1>
      <p className="text-muted-foreground">
        Professional public research platform bo&apos;yicha qisqa yo&apos;riqnoma.
      </p>
      <div className="space-y-4">
        {topics.map((t) => (
          <div key={t.href} className="rounded-lg border p-4">
            <h2 className="font-semibold">{t.title}</h2>
            <p className="text-sm text-muted-foreground">{t.body}</p>
            <Button variant="link" className="mt-2 px-0" asChild>
              <Link href={t.href}>Batafsil</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
