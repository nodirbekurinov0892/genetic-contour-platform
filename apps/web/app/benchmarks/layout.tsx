import { ProtectedRoute } from "@/components/auth/protected-route";

export default function BenchmarksLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
