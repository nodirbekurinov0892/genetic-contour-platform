"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PLATFORM_NAME } from "@shared/constants";
import { apiFetch } from "@/lib/api";

const steps = [
  "Rasm kutubxonasiga asl rasm yuklang",
  "Ixtiyoriy Ground Truth mask qo&apos;shing",
  "Yangi tajriba wizardida compare_all ishga tushiring",
  "Taqqoslash markazida natijalarni tahlil qiling",
];

export default function OnboardingPage() {
  const router = useRouter();

  const finish = async () => {
    try {
      await apiFetch("/api/auth/onboarding/complete", { method: "POST" });
    } catch {
      // non-blocking
    }
    router.push("/");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">{PLATFORM_NAME} ga xush kelibsiz</h1>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Button onClick={() => void finish()}>Boshlash</Button>
    </div>
  );
}
