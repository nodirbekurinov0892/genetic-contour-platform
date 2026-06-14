"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/state-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { safeRedirectPath } from "@/lib/safe-redirect";

const AUTH_PATHS = ["/login", "/register"];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

interface RedirectIfAuthenticatedProps {
  next?: string | null;
  children: React.ReactNode;
}

export function RedirectIfAuthenticated({ next, children }: RedirectIfAuthenticatedProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const nextPath = safeRedirectPath(next);
  const redirectStartedRef = useRef(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (loading || !user || redirectStartedRef.current) {
      return;
    }

    redirectStartedRef.current = true;
    router.replace(nextPath);

    const hardRedirectTimer = window.setTimeout(() => {
      if (isAuthPath(window.location.pathname)) {
        window.location.assign(nextPath);
      }
    }, 400);

    const fallbackTimer = window.setTimeout(() => {
      if (isAuthPath(window.location.pathname)) {
        setShowFallback(true);
      }
    }, 2000);

    return () => {
      window.clearTimeout(hardRedirectTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [loading, user, nextPath, router]);

  const handleContinue = () => {
    window.location.assign(nextPath);
  };

  if (loading) {
    return <LoadingState message="Yuklanmoqda..." className="h-32" />;
  }

  if (user) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        {!showFallback ? (
          <LoadingState message="Yo&apos;naltirilmoqda..." className="h-32" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Avtomatik yo&apos;naltirish ishlamadi. Davom etish tugmasini bosing.
          </p>
        )}
        {showFallback && (
          <Button type="button" onClick={handleContinue}>
            Davom etish
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
