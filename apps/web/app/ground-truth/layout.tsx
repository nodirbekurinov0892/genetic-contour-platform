import { ProtectedRoute } from "@/components/auth/protected-route";

export default function GroundTruthLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
