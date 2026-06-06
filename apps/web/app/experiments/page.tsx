"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExperimentStatusBadge } from "@/components/experiments/experiment-status-badge";
import { AlgorithmParamsForm } from "@/components/experiments/algorithm-params";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state-panel";
import { experimentService } from "@/services/experimentService";
import { imageService } from "@/services/imageService";
import { ALGORITHMS, DEFAULT_ALGORITHM_PARAMS, DEFAULT_GA_PARAMS } from "@shared/constants";
import type { AlgorithmName, AlgorithmParams, ExperimentRecord, GAParams, ImageRecord } from "@shared/types";
import { API_BASE } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function ExperimentsPage() {
  const router = useRouter();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [title, setTitle] = useState("");
  const [algorithm, setAlgorithm] = useState<AlgorithmName>("compare_all");
  const [params, setParams] = useState<AlgorithmParams>(DEFAULT_ALGORITHM_PARAMS);
  const [gaParams, setGAParams] = useState<GAParams>(DEFAULT_GA_PARAMS);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [imgs, exps] = await Promise.all([
        imageService.list(),
        experimentService.list(),
      ]);
      setImages(imgs);
      setExperiments(exps);
      if (imgs.length > 0) setSelectedImage(imgs[0].id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRun = async () => {
    if (!selectedImage || !title.trim()) {
      setFormError("Rasm tanlang va sarlavha kiriting");
      return;
    }
    setRunning(true);
    setFormError(null);
    try {
      const experiment = await experimentService.create({
        image_id: selectedImage,
        title: title.trim(),
      });
      const job = await experimentService.run(experiment.id, {
        algorithm,
        params,
        ga_params: algorithm === "genetic" || algorithm === "compare_all" ? gaParams : undefined,
      });
      router.push(`/experiments/${job.job_id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Tajriba muvaffaqiyatsiz");
    } finally {
      setRunning(false);
    }
  };

  const showGA = algorithm === "genetic" || algorithm === "compare_all";

  if (loading) {
    return <LoadingState message="Tajribalar yuklanmoqda..." />;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Tajribalarni yuklab bo'lmadi"
        message={loadError}
        hint={`API ${API_BASE} manzilida ishlayotganini tekshiring`}
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Tajribalar"
        description="Oldindan qayta ishlash, klassik chekka detektorlari va Genetic Algorithm parametrlarini sozlang"
        badge="Tahlil"
      />

      <div className="scientific-card overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Yangi tajriba</h2>
              <p className="text-sm text-muted-foreground">
                Algoritm parametrlarini sozlang va tahlilni ishga tushiring
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-6 p-6">
          {images.length === 0 ? (
            <EmptyState
              title="Rasmlar yuklanmagan"
              description="Tajriba ishga tushirishdan oldin rasm yuklang."
              action={
                <Button asChild>
                  <Link href="/upload">Rasm yuklashga o&apos;tish</Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Tajriba sarlavhasi</Label>
                  <Input
                    id="title"
                    placeholder="masalan, Tanga kontur aniqlash"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Rasm</Label>
                  <select
                    id="image"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedImage}
                    onChange={(e) => setSelectedImage(e.target.value)}
                  >
                    {images.map((img) => (
                      <option key={img.id} value={img.id}>
                        {img.original_name} ({img.width}×{img.height})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Algoritm</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {ALGORITHMS.map((algo) => (
                    <button
                      key={algo.id}
                      type="button"
                      onClick={() => setAlgorithm(algo.id as AlgorithmName)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        algorithm === algo.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      }`}
                    >
                      <p className="text-sm font-medium">{algo.label}</p>
                      <p className="text-xs text-muted-foreground">{algo.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <AlgorithmParamsForm
                params={params}
                gaParams={gaParams}
                showGA={showGA}
                onParamsChange={setParams}
                onGAParamsChange={setGAParams}
              />

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <Button onClick={handleRun} disabled={running} className="gap-2">
                <Play className="h-4 w-4" />
                {running ? "Tajriba navbatga qo'yilmoqda..." : "Tajribani ishga tushirish"}
              </Button>
            </>
          )}
        </div>
      </div>

      <section>
        <SectionHeader
          title="Tajribalar tarixi"
          description="Ilgari bajarilgan tahlillar"
          className="mb-4"
        />
        {experiments.length === 0 ? (
          <EmptyState
            title="Hali tajribalar yo'q"
            description="Birinchi tajribangizni yuqorida yarating."
          />
        ) : (
          <div className="space-y-2">
            {experiments.map((exp) => (
              <Link
                key={exp.id}
                href={`/experiments/${exp.id}`}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{exp.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(exp.created_at)}</p>
                </div>
                <ExperimentStatusBadge status={exp.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
