"use client";

import { useEffect, useState } from "react";
import { HardDrive, ImageIcon, FileText, Target } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { ErrorState, LoadingState } from "@/components/ui/state-panel";
import { storageCenterService, type StorageCenterSummary } from "@/services/storageCenterService";

export default function StoragePage() {
  const [summary, setSummary] = useState<StorageCenterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storageCenterService
      .getSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Yuklash xatosi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Saqlash markazi yuklanmoqda..." />;
  if (error || !summary) {
    return <ErrorState message={error ?? "Ma'lumot yo'q"} />;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Saqlash markazi"
        description={`Backend: ${summary.backend} — foydalanuvchi resurslari hajmi`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Rasmlar"
          value={summary.images.count}
          subtitle={`${summary.images.mb} MB`}
          icon={ImageIcon}
          accent="blue"
        />
        <StatCard
          title="Ground Truth"
          value={summary.ground_truths.count}
          subtitle="GT fayllar"
          icon={Target}
          accent="green"
        />
        <StatCard
          title="Hisobotlar"
          value={summary.reports.count}
          subtitle="Eksport fayllar"
          icon={FileText}
          accent="amber"
        />
        <StatCard
          title="Jami hajm"
          value={`${summary.total_mb} MB`}
          subtitle={`${summary.total_bytes.toLocaleString("uz-UZ")} bayt`}
          icon={HardDrive}
          accent="slate"
        />
      </div>

      <section className="scientific-card p-5">
        <h3 className="mb-4 font-semibold">Saqlash tafsilotlari</h3>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Storage backend</dt>
            <dd className="font-semibold">{summary.backend}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Eksportlar</dt>
            <dd className="font-semibold">{summary.exports.count}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Rasm hajmi (bayt)</dt>
            <dd className="font-semibold">{summary.images.bytes.toLocaleString("uz-UZ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">GT soni</dt>
            <dd className="font-semibold">{summary.ground_truths.count}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
