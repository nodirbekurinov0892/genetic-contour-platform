"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state-panel";

export type ComparisonAction =
  | "create_benchmark"
  | "run_benchmark"
  | "view_benchmark"
  | "select_experiments"
  | "retry_failed"
  | "cancel_run"
  | "export_report";

const ACTION_LABELS: Record<ComparisonAction, { label: string; href?: string; variant?: "default" | "outline" }> = {
  create_benchmark: { label: "Benchmark yaratish", href: "/benchmarks", variant: "default" },
  run_benchmark: { label: "Benchmarkni ishga tushirish", href: "/benchmarks", variant: "default" },
  view_benchmark: { label: "Benchmark markaziga o'tish", href: "/benchmarks", variant: "outline" },
  select_experiments: { label: "Tajribalarni tanlash", href: "/experiments", variant: "outline" },
  retry_failed: { label: "Muvaffaqiyatsizlarni qayta urinish", variant: "outline" },
  cancel_run: { label: "Ishni bekor qilish", variant: "outline" },
  export_report: { label: "Hisobot eksport", variant: "outline" },
};

interface ActionEmptyStateProps {
  title: string;
  message: string;
  actions?: Array<ComparisonAction | string>;
  onAction?: (action: ComparisonAction) => void;
}

export function ActionEmptyState({ title, message, actions = [], onAction }: ActionEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={message}
      action={
        actions.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {actions.map((action) => {
              const key = action as ComparisonAction;
              const meta = ACTION_LABELS[key] ?? { label: String(action), variant: "outline" as const };
              if (meta.href && !onAction) {
                return (
                  <Button key={action} variant={meta.variant ?? "outline"} size="sm" asChild>
                    <Link href={meta.href}>{meta.label}</Link>
                  </Button>
                );
              }
              return (
                <Button
                  key={action}
                  variant={meta.variant ?? "outline"}
                  size="sm"
                  onClick={() => onAction?.(key)}
                >
                  {meta.label}
                </Button>
              );
            })}
          </div>
        ) : undefined
      }
    />
  );
}
