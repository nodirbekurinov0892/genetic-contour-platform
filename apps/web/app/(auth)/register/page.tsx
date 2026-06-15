"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { RedirectIfAuthenticated } from "@/components/auth/redirect-if-authenticated";
import { SmtpAuthNotice } from "@/components/auth/smtp-auth-notice";

export default function RegisterPage() {
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(email, password, name.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ro'yxatdan o'tish muvaffaqiyatsiz");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RedirectIfAuthenticated next="/">
      <div className="scientific-card border-border/80 p-8 shadow-lg">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Hisob yaratish</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kontur tahlili platformasida tajriba o&apos;tkazishni boshlang
          </p>
        </div>

        <SmtpAuthNotice />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ism (ixtiyoriy)</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Hisob yaratilmoqda..." : "Ro'yxatdan o'tish"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Allaqachon hisobingiz bormi?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Kirish
          </Link>
        </p>
      </div>
    </RedirectIfAuthenticated>
  );
}
