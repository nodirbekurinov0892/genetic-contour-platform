"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WorkflowNextStepProps {
  title: string;
  description?: string;
  href: string;
  label: string;
  className?: string;
}

export function WorkflowNextStep({
  title,
  description,
  href,
  label,
  className,
}: WorkflowNextStepProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4",
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Button asChild size="sm" className="gap-2">
        <Link href={href}>
          {label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
