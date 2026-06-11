"use client";

import { SectionHeader } from "@/components/ui/section-header";
import { EvaluationModeBanner } from "@/components/scientific/evaluation-mode-banner";
import { FalsePositiveWarnings } from "@/components/scientific/false-positive-warnings";
import { WinnerPanel } from "@/components/scientific/winner-panel";
import type { ScientificInsights } from "@shared/types";

interface InsightsPanelProps {
  insights: ScientificInsights | null;
  loading?: boolean;
}

export function InsightsPanel({ insights, loading }: InsightsPanelProps) {
  if (loading) {
    return (
      <section>
        <SectionHeader title="Ilmiy tahlil" badge="Science" />
        <p className="text-sm text-muted-foreground">Tahlil yuklanmoqda...</p>
      </section>
    );
  }

  if (!insights) return null;

  const observations = insights.observations?.length
    ? insights.observations
    : insights.strengths;
  const limitations = insights.limitations?.length
    ? insights.limitations
    : insights.weaknesses;

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Ilmiy tahlil"
        description="Ma'lumotlarga asoslangan kuzatuvlar — narrativsiz"
        badge="Science"
      />
      <EvaluationModeBanner
        mode={insights.evaluation_mode}
        hasGroundTruth={insights.has_ground_truth}
      />
      <WinnerPanel winner={insights.winner} hasGroundTruth={insights.has_ground_truth} />
      <FalsePositiveWarnings warnings={insights.metric_warnings} />
      <div className="scientific-card p-4">
        <p className="mb-1 text-sm font-semibold">Xulosa</p>
        <p className="text-sm leading-relaxed">{insights.summary}</p>
      </div>
      {insights.comparisons.length > 0 && (
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold">Metrik taqqoslash faktlari</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {insights.comparisons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold text-emerald-600">Kuzatuvlar</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {observations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="scientific-card p-4">
          <p className="mb-2 text-sm font-semibold text-amber-600">Cheklovlar</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
