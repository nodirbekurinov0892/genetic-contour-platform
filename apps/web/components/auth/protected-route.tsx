"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { LoadingState, ErrorState } from "@/components/ui/state-panel";
import { Button } from "@/components/ui/button";
import { hasStoredAccessToken } from "@/lib/auth-storage";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const retryRef = useRef(false);

  const pendingSession = !user && hasStoredAccessToken();

  useEffect(() => {
    if (!loading && pendingSession && !retryRef.current) {
      retryRef.current = true;
      void refreshUser();
    }
  }, [loading, pendingSession, refreshUser]);

  useEffect(() => {
    if (!loading && !user && !hasStoredAccessToken()) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  if (loading || pendingSession) {
    return <LoadingState message="Autentifikatsiya tekshirilmoqda..." />;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Kirish talab qilinadi"
          message="Sessiya topilmadi yoki muddati tugagan. Qayta kiring."
        />
        <Button asChild>
          <Link href={`/login?next=${encodeURIComponent(pathname)}`}>Kirish</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
