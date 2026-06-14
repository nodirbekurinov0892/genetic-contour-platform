"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface AuthConfig {
  smtp_configured: boolean;
  email_verification_required: boolean;
  degraded_auth_mode: boolean;
}

export function SmtpAuthNotice() {
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    void apiFetch<AuthConfig>("/api/auth/config", { skipAuth: true }).then(setConfig).catch(() => {
      setConfig(null);
    });
  }, []);

  if (!config?.degraded_auth_mode) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
      <strong>SMTP sozlanmagan.</strong> Email tasdiqlash va parolni tiklash ishlamaydi. Ro&apos;yxatdan
      o&apos;tish va kirish degraded rejimda ishlaydi.
    </div>
  );
}
