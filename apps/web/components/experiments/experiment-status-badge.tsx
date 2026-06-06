import { Badge } from "@/components/ui/badge";
import type { ExperimentStatus } from "@shared/types";

const STATUS_LABELS: Record<ExperimentStatus, string> = {
  pending: "Kutilmoqda",
  queued: "Navbatda",
  running: "Bajarilmoqda",
  completed: "Yakunlandi",
  failed: "Muvaffaqiyatsiz",
  cancelled: "Bekor qilindi",
};

const STATUS_VARIANTS: Record<
  ExperimentStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  pending: "secondary",
  queued: "outline",
  running: "warning",
  completed: "success",
  failed: "destructive",
  cancelled: "secondary",
};

export function ExperimentStatusBadge({ status }: { status: ExperimentStatus | string }) {
  const key = status as ExperimentStatus;
  return (
    <Badge variant={STATUS_VARIANTS[key] ?? "secondary"}>
      {STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
