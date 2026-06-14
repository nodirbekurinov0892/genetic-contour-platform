"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/section-header";
import { ScientificDisclaimer } from "@/components/scientific/scientific-disclaimer";
import { EvaluationModeBanner } from "@/components/scientific/evaluation-mode-banner";
import { AlgorithmParamsForm } from "@/components/experiments/algorithm-params";
import { ImageCard } from "@/components/experiments/image-card";
import { imageService } from "@/services/imageService";
import { experimentService } from "@/services/experimentService";
import {
  DEFAULT_ALGORITHM_PARAMS,
  DEFAULT_GA_PARAMS,
  PLATFORM_NAME,
} from "@shared/constants";
import type { AlgorithmParams, GAParams, ImageRecord } from "@shared/types";
import { cn, formatBytes } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;
const STEPS = [
  "Asl rasm",
  "Ground Truth",
  "Algoritmlar",
  "Baholash rejimi",
  "Ishga tushirish",
] as const;

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
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHeader
        title="Yangi tajriba"
        description={`${PLATFORM_NAME} — 5 bosqichli ilmiy workflow`}
        badge="Wizard"
      />

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="scientific-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">1. Asl rasm yuklash</h2>
          <label className="drop-zone flex cursor-pointer flex-col items-center p-8">
            <Upload className="mb-2 h-8 w-8 text-primary" />
            <span className="text-sm font-medium">Rasm tanlang yoki sudrab tashlang</span>
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
          {preview && file && (
            <div className="flex items-center gap-4 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="h-20 w-20 rounded border object-contain" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
            </div>
          )}
          <Button onClick={uploadOriginal} disabled={!file || busy}>
            {busy ? "Yuklanmoqda..." : "Davom etish"}
          </Button>
        </div>
      )}

      {step === 1 && image && (
        <div className="scientific-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">2. Ground Truth mask (ixtiyoriy)</h2>
          <ImageCard image={image} />
          <p className="text-sm text-muted-foreground">
            Supervised metrikalar (IoU, F1, Dice) uchun GT mask yuklang. PNG tavsiya etiladi.
          </p>
          <div className="space-y-2">
            <Label htmlFor="gt-file">GT maska</Label>
            <Input
              id="gt-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setGtFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {image.has_ground_truth && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              GT juftlangan
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Orqaga
            </Button>
            {gtFile && (
              <Button variant="secondary" onClick={uploadGt} disabled={busy}>
                GT yuklash
              </Button>
            )}
            <Button onClick={() => setStep(2)}>
              Davom etish
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="scientific-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">3. Algoritmlar va parametrlar</h2>
          <p className="text-sm text-muted-foreground">
            Taqqoslash rejimi: <strong>compare_all</strong> — barcha 4 algoritm (Sobel, Prewitt,
            Canny, GA) fair_v1 protokoli bilan ishlaydi.
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
            <Button onClick={() => setStep(3)}>Davom etish</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="scientific-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">4. Baholash rejimi</h2>
          <EvaluationModeBanner mode={evaluationMode} hasGroundTruth={hasGroundTruth} />
          {!hasGroundTruth && <ScientificDisclaimer />}
          <p className="text-sm text-muted-foreground">
            Baholash rejimi Ground Truth mavjudligiga qarab avtomatik aniqlanadi (Phase Z+).
            Foydalanuvchi supervised rejimni GTsiz majburlay olmaydi.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Orqaga
            </Button>
            <Button onClick={() => setStep(4)}>Davom etish</Button>
          </div>
        </div>
      )}

      {step === 4 && image && (
        <div className="scientific-card space-y-4 p-6">
          <h2 className="text-lg font-semibold">5. Tajribani ishga tushirish</h2>
          <div className="space-y-2 text-sm">
            <div>
              <Label htmlFor="exp-title">Tajriba nomi</Label>
              <Input
                id="exp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <p>
              <span className="text-muted-foreground">Rasm:</span> {image.original_name}
            </p>
            <p>
              <span className="text-muted-foreground">GT:</span>{" "}
              {hasGroundTruth ? "Juftlangan" : "Yo'q (heuristic)"}
            </p>
            <p>
              <span className="text-muted-foreground">Algoritmlar:</span> compare_all (4 ta)
            </p>
            <p>
              <span className="text-muted-foreground">Rejim:</span> {evaluationMode}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(3)}>
              Orqaga
            </Button>
            <Button onClick={runExperiment} disabled={busy || !title.trim()}>
              {busy ? "Ishga tushirilmoqda..." : "Tajribani ishga tushirish"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
