"use client";

import { SectionHeader } from "@/components/ui/section-header";
import type { ScientificInsights } from "@shared/types";

interface InsightsPanelProps {
  insights: ScientificInsights | null;
  loading?: boolean;
}

export function InsightsPanel({ insights, loading }: InsightsPanelProps) {
  if (loading) {
    return (
      <section>
        <SectionHeader title="AI ilmiy tahlil" badge="Insights" />
        <p className="text-sm text-muted-foreground">Tahlil yuklanmoqda...</p>
      </section>
    );
  }

  if (!insights) return null;

  return (
    <section className="space-y-4">
      <SectionHeader
        title="AI ilmiy tahlil"
        description="Metrikalar asosida avtomatik natija tahlili"
        badge="Insights"
      />
      <div className="scientific-card p-4">
        <p className="text-sm leading-relaxed">{insights.summary}</p>
      </div>
      {insights.comparisons.length > 0 && (
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold">Taqqoslash xulosalari</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {insights.comparisons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold text-emerald-600">Kuchli tomonlar</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {insights.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold text-amber-600">Zaif tomonlar</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {insights.weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
