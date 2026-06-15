"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AuthConfig {
  smtp_configured: boolean;
  email_verification_required: boolean;
  degraded_auth_mode: boolean;
}

export function PlatformAuthNotice() {
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    void apiFetch<AuthConfig>("/api/auth/config", { skipAuth: true })
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  if (!config?.degraded_auth_mode) return null;

  return (
    <div className="mb-4 flex gap-3 rounded-lg border border-sky-200/80 bg-sky-50/90 p-3 text-sm text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        Hisobingiz ro&apos;yxatdan o&apos;tgach darhol faollashtiriladi. Email orqali parolni
        tiklash funksiyasi tez orada qo&apos;shiladi.
      </p>
    </div>
  );
}
