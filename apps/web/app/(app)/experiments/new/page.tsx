"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/section-header";
import { EvaluationModeBanner } from "@/components/scientific/evaluation-mode-banner";
import { AlgorithmParamsForm } from "@/components/experiments/algorithm-params";
import { ImageCard } from "@/components/experiments/image-card";
import { WizardStepper } from "@/components/layout/workflow-strip";
import { imageService } from "@/services/imageService";
import { experimentService } from "@/services/experimentService";
import { DEFAULT_ALGORITHM_PARAMS, DEFAULT_GA_PARAMS } from "@shared/constants";
import type { AlgorithmParams, GAParams, ImageRecord } from "@shared/types";
import {
  COMPARISON_WORKFLOW_LABEL,
  EVALUATION_MODE_LABELS,
  FAIR_PROTOCOL_LABEL,
  GT_PAIRING_LABELS,
} from "@/lib/user-labels";
import { formatBytes } from "@/lib/utils";
import { StoredImage } from "@/components/ui/stored-image";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;
const STEPS = [
  "Asl rasm",
  "Ground Truth",
  "Algoritmlar",
  "Baholash rejimi",
  "Ishga tushirish",
] as const;

function WizardPreviewPanel({
  step,
  preview,
  file,
  image,
  hasGroundTruth,
  title,
}: {
  step: number;
  preview: string | null;
  file: File | null;
  image: ImageRecord | null;
  hasGroundTruth: boolean;
  title: string;
}) {
  return (
    <aside className="scientific-card sticky top-6 space-y-4 p-5 lg:top-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ko&apos;rib chiqish
        </p>
        <h3 className="mt-1 text-lg font-semibold">Tajriba xulosasi</h3>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted/20">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Tanlangan rasm" className="h-full w-full object-contain p-2" />
        ) : image?.url || image?.file_path ? (
          <StoredImage
            filePath={image.file_path}
            url={image.url}
            alt={image.original_name}
            fill
            className="object-contain p-2"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-10 w-10 opacity-40" />
            <p className="text-sm">Rasm tanlanmagan</p>
          </div>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Bosqich</dt>
          <dd className="font-medium">
            {step + 1} / {STEPS.length}
          </dd>
        </div>
        {file && (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Fayl</dt>
              <dd className="truncate font-medium">{file.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Hajm</dt>
              <dd>{formatBytes(file.size)}</dd>
            </div>
          </>
        )}
        {image && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Ground Truth</dt>
            <dd>
              <Badge variant={hasGroundTruth ? "success" : "outline"}>
                {hasGroundTruth ? GT_PAIRING_LABELS.paired : GT_PAIRING_LABELS.notPaired}
              </Badge>
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Algoritmlar</dt>
          <dd className="text-right text-xs font-medium">{COMPARISON_WORKFLOW_LABEL}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Baholash</dt>
          <dd>
            {hasGroundTruth
              ? EVALUATION_MODE_LABELS.supervised
              : EVALUATION_MODE_LABELS.heuristic}
          </dd>
        </div>
        {title && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Nom</dt>
            <dd className="truncate font-medium">{title}</dd>
          </div>
        )}
      </dl>
    </aside>
  );
}

export default function NewExperimentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<ImageRecord | null>(null);
  const [gtFile, setGtFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [params, setParams] = useState<AlgorithmParams>(DEFAULT_ALGORITHM_PARAMS);
  const [gaParams, setGAParams] = useState<GAParams>(DEFAULT_GA_PARAMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasGroundTruth = Boolean(image?.has_ground_truth);
  const evaluationMode = hasGroundTruth ? "supervised" : "heuristic";
  const gtPendingUpload = Boolean(gtFile && !hasGroundTruth);

  useEffect(() => {
    if (!title && file) {
      const base = file.name.replace(/\.[^.]+$/, "");
      setTitle(`${base} — taqqoslash`);
    }
  }, [file, title]);

  const validateFile = useCallback((selected: File) => {
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Faqat JPG, PNG va WebP qabul qilinadi");
      return false;
    }
    if (selected.size > MAX_SIZE) {
      setError("Fayl 10 MB dan oshmasligi kerak");
      return false;
    }
    setError(null);
    return true;
  }, []);

  const uploadOriginal = async () => {
    if (!file) return;
    if (image) {
      setStep(1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await imageService.upload(file);
      setImage(res.image);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash muvaffaqiyatsiz");
    } finally {
      setBusy(false);
    }
  };

  const uploadGt = async () => {
    if (!image || !gtFile) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await imageService.uploadGroundTruth(image.id, gtFile);
      setImage(updated);
      setGtFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "GT yuklash muvaffaqiyatsiz");
    } finally {
      setBusy(false);
    }
  };

  const runExperiment = async () => {
    if (!image || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const exp = await experimentService.create({
        image_id: image.id,
        title: title.trim(),
      });
      await experimentService.run(exp.id, {
        algorithm: "compare_all",
        params,
        ga_params: gaParams,
        comparison_protocol: "fair_v1",
      });
      router.push(`/experiments/${exp.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tajriba ishga tushmadi");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-6">
      <SectionHeader
        title="Yangi tajriba"
        description="5 bosqichli ilmiy tajriba — rasm, Ground Truth, algoritmlar va baholash"
      />

      <WizardStepper steps={STEPS} currentStep={step} />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {step === 0 && (
            <div className="scientific-card space-y-5 p-6">
              <h2 className="text-lg font-semibold">1. Asl rasm yuklash</h2>
              <label className="drop-zone flex cursor-pointer flex-col items-center p-10">
                <Upload className="mb-3 h-10 w-10 text-primary" />
                <span className="text-sm font-medium">Rasm tanlang yoki sudrab tashlang</span>
                <span className="mt-1 text-xs text-muted-foreground">JPG · PNG · WebP · 10 MB gacha</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && validateFile(f)) {
                      setFile(f);
                      setPreview(URL.createObjectURL(f));
                      setImage(null);
                    }
                  }}
                />
              </label>
              {image && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Serverda saqlangan
                  </p>
                  <ImageCard image={image} />
                </div>
              )}
              <Button onClick={uploadOriginal} disabled={!file || busy} className="gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Yuklanmoqda..." : image ? "Ground Truth bosqichiga o'tish" : "Yuklash va davom etish"}
              </Button>
            </div>
          )}

          {step === 1 && image && (
            <div className="scientific-card space-y-5 p-6">
              <h2 className="text-lg font-semibold">2. Ground Truth mask (ixtiyoriy)</h2>
              <div className="rounded-lg border p-4">
                {hasGroundTruth ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <Badge variant="success">{GT_PAIRING_LABELS.paired}</Badge>
                    <span className="text-muted-foreground">Nazoratli baholash yoqiladi</span>
                  </div>
                ) : gtFile ? (
                  <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4" />
                    <Badge variant="warning">{GT_PAIRING_LABELS.selectedNotUploaded}</Badge>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <Badge variant="outline">{GT_PAIRING_LABELS.notPaired}</Badge>
                    <p className="text-muted-foreground">
                      GT yuklamasangiz, tajriba{" "}
                      <strong>{EVALUATION_MODE_LABELS.heuristic}</strong> rejimida ishlaydi.
                    </p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                IoU, F1 va Dice metrikalari uchun Ground Truth mask yuklang. PNG tavsiya etiladi.
              </p>
              <div className="space-y-2">
                <Label htmlFor="gt-file">Ground Truth maska</Label>
                <Input
                  id="gt-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setGtFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Orqaga
                </Button>
                {gtFile && !hasGroundTruth && (
                  <Button variant="secondary" onClick={uploadGt} disabled={busy} className="gap-2">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {busy ? "Yuklanmoqda..." : "GT yuklash"}
                  </Button>
                )}
                <Button onClick={() => setStep(2)} disabled={gtPendingUpload || busy}>
                  Algoritmlarga o&apos;tish
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              {gtPendingUpload && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  GT fayl tanlangan, lekin yuklanmagan. Avval &quot;GT yuklash&quot; tugmasini bosing.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="scientific-card space-y-5 p-6">
              <h2 className="text-lg font-semibold">3. Algoritmlar va parametrlar</h2>
              <p className="text-sm text-muted-foreground">
                {COMPARISON_WORKFLOW_LABEL}. {FAIR_PROTOCOL_LABEL}.
              </p>
              <AlgorithmParamsForm
                params={params}
                gaParams={gaParams}
                showGA
                onParamsChange={setParams}
                onGAParamsChange={setGAParams}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Orqaga
                </Button>
                <Button onClick={() => setStep(3)}>Baholash rejimiga o&apos;tish</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="scientific-card space-y-5 p-6">
              <h2 className="text-lg font-semibold">4. Baholash rejimi</h2>
              <EvaluationModeBanner mode={evaluationMode} hasGroundTruth={hasGroundTruth} />
              <p className="text-sm text-muted-foreground">
                Baholash rejimi Ground Truth mavjudligiga qarab avtomatik aniqlanadi.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Orqaga
                </Button>
                <Button onClick={() => setStep(4)}>Xulosaga o&apos;tish</Button>
              </div>
            </div>
          )}

          {step === 4 && image && (
            <div className="scientific-card space-y-5 p-6">
              <h2 className="text-lg font-semibold">5. Tajribani ishga tushirish</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="exp-title">Tajriba nomi</Label>
                  <Input
                    id="exp-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="grid gap-2 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Rasm:</span> {image.original_name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Ground Truth:</span>{" "}
                    {hasGroundTruth ? GT_PAIRING_LABELS.paired : GT_PAIRING_LABELS.notPaired}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Algoritmlar:</span> {COMPARISON_WORKFLOW_LABEL}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Baholash:</span>{" "}
                    {hasGroundTruth
                      ? EVALUATION_MODE_LABELS.supervised
                      : EVALUATION_MODE_LABELS.heuristic}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Orqaga
                </Button>
                <Button onClick={runExperiment} disabled={busy || !title.trim()} className="gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? "Ishga tushirilmoqda..." : "Tajribani ishga tushirish"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <WizardPreviewPanel
          step={step}
          preview={preview}
          file={file}
          image={image}
          hasGroundTruth={hasGroundTruth}
          title={title}
        />
      </div>
    </div>
  );
}
