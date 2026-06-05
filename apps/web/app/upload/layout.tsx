import { ProtectedRoute } from "@/components/auth/protected-route";

export default function UploadLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
