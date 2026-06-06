"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/state-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { safeRedirectPath } from "@/lib/safe-redirect";

interface RedirectIfAuthenticatedProps {
  next?: string | null;
  children: React.ReactNode;
}

export function RedirectIfAuthenticated({ next, children }: RedirectIfAuthenticatedProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const target = safeRedirectPath(next);
  const redirectedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (loading || !user || redirectedRef.current) {
      return;
    }

    redirectedRef.current = true;
    router.replace(target);

    const timer = window.setTimeout(() => setShowFallback(true), 2000);
    return () => window.clearTimeout(timer);
  }, [loading, user, router, target]);

  if (loading) {
    return <LoadingState message="Yuklanmoqda..." className="h-32" />;
  }

  if (user) {
    return (
      <div className="flex flex-col items-center gap-4">
        <LoadingState message="Yo'naltirilmoqda..." className="h-32" />
        {showFallback && (
          <Button asChild>
            <Link href={target}>Davom etish</Link>
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
