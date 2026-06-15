import Link from "next/link";
import { PLATFORM_NAME } from "@shared/constants";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";

const topics = [
  {
    title: "Yangi tajriba",
    href: "/experiments/new",
    body: "5 bosqichli wizard orqali barcha algoritmlarni ishga tushiring.",
  },
  {
    title: "Ground Truth boshqaruvi",
    href: "/ground-truth",
    body: "GT validatsiya, qayta tekshirish va o'chirish.",
  },
  {
    title: "Benchmark to'plamlari",
    href: "/benchmarks",
    body: "Guruhli benchmark va reyting jadvali.",
  },
  {
    title: "Hisobotlar",
    href: "/reports",
    body: "PDF, CSV va JSON ilmiy hisobotlar.",
  },
];

const workflow = [
  "Tizimga kiring",
  "Yangi tajriba wizardida rasm yuklang",
  "Ixtiyoriy Ground Truth qo'shing",
  "Algoritmlar va baholashni sozlang",
  "Natijalarni taqqoslang",
  "Hisobot eksport qiling",
  "Analitika markazida trendlarni ko'ring",
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHeader
        title={`${PLATFORM_NAME} — Yordam`}
        description="Tajriba jarayoni va platforma bo'limlari bo'yicha qisqa yo'riqnoma"
      />

      <section className="scientific-card p-5">
        <h2 className="mb-3 font-semibold">Tavsiya etilgan jarayon</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {workflow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {topics.map((t) => (
          <div key={t.href} className="scientific-card p-5">
            <h2 className="font-semibold">{t.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
            <Button variant="link" className="mt-2 px-0" asChild>
              <Link href={t.href}>Bo&apos;limga o&apos;tish</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
