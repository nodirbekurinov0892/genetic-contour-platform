"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Layers } from "lucide-react";
import { PLATFORM_NAME, PLATFORM_SUBTITLE } from "@shared/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { RedirectIfAuthenticated } from "@/components/auth/redirect-if-authenticated";
import { LoadingState } from "@/components/ui/state-panel";
import { safeRedirectPath } from "@/lib/safe-redirect";

function LoginForm() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirish muvaffaqiyatsiz");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RedirectIfAuthenticated next={next}>
      <div className="scientific-card p-8">
        <div className="mb-6 flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Kirish</h1>
            <p className="text-sm text-muted-foreground">{PLATFORM_NAME}</p>
            <p className="text-xs text-muted-foreground">{PLATFORM_SUBTITLE}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parol</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Kirilmoqda..." : "Kirish"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Hisobingiz yo&apos;qmi?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Ro&apos;yxatdan o&apos;tish
          </Link>
        </p>
      </div>
    </RedirectIfAuthenticated>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <Suspense fallback={<LoadingState message="Yuklanmoqda..." className="h-32" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
