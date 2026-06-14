"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";

export default function ComparisonLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
