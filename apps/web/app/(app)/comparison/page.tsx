import { Suspense } from "react";
import ComparisonPageContent from "./comparison-content";
import { LoadingState } from "@/components/ui/state-panel";

export default function ComparisonPage() {
  return (
    <Suspense fallback={<LoadingState message="Taqqoslash markazi yuklanmoqda..." />}>
      <ComparisonPageContent />
    </Suspense>
  );
}
