"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const WORKFLOW_STEPS = [
  { step: 1, label: "Rasm yuklash", href: "/experiments/new" },
  { step: 2, label: "Ground Truth", href: "/experiments/new" },
  { step: 3, label: "Algoritmlar", href: "/experiments/new" },
  { step: 4, label: "Baholash", href: "/experiments/new" },
  { step: 5, label: "Natijalar", href: "/experiments" },
] as const;

interface WorkflowStripProps {
  activeStep?: number;
  className?: string;
}

export function WorkflowStrip({ activeStep = 1, className }: WorkflowStripProps) {
  return (
    <nav
      aria-label="Tajriba jarayoni"
      className={cn("scientific-card overflow-x-auto p-4", className)}
    >
      <ol className="flex min-w-[640px] items-center gap-2">
        {WORKFLOW_STEPS.map((item, index) => {
          const done = item.step < activeStep;
          const active = item.step === activeStep;
          return (
            <li key={item.step} className="flex flex-1 items-center gap-2">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
                  active && "border-primary bg-primary/10 text-primary",
                  done && !active && "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
                  !active && !done && "border-border text-muted-foreground hover:bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    active && "bg-primary text-primary-foreground",
                    done && !active && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
                    !active && !done && "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : item.step}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className="hidden h-px w-3 shrink-0 bg-border sm:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function WizardStepper({
  steps,
  currentStep,
  className,
}: {
  steps: readonly string[];
  currentStep: number;
  className?: string;
}) {
  return (
    <ol className={cn("grid gap-2 sm:grid-cols-5", className)}>
      {steps.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium sm:text-sm",
              active && "border-primary bg-primary/10 text-primary ring-1 ring-primary/20",
              done && !active && "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
              !active && !done && "border-border bg-card text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                active && "bg-primary text-primary-foreground",
                done && !active && "bg-emerald-500/20",
                !active && !done && "bg-muted",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="truncate">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
