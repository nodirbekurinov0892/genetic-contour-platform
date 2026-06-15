import { Suspense } from "react";
import ReportsPageContent from "./reports-content";
import { LoadingState } from "@/components/ui/state-panel";

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingState message="Hisobotlar yuklanmoqda..." />}>
      <ReportsPageContent />
    </Suspense>
  );
}
