"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlgorithmParamsForm } from "@/components/experiments/algorithm-params";
import { ExperimentsTable } from "@/components/experiments/experiments-table";
import { ImagePicker } from "@/components/experiments/image-picker";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/state-panel";
import { experimentService } from "@/services/experimentService";
import { imageService } from "@/services/imageService";
import { ALGORITHMS, DEFAULT_ALGORITHM_PARAMS, DEFAULT_GA_PARAMS } from "@shared/constants";
import type {
  AlgorithmName,
  AlgorithmParams,
  ExperimentBrowseItem,
  GAParams,
  ImageRecord,
} from "@shared/types";
import { API_BASE } from "@/lib/api";

const PAGE_SIZE = 10;

export default function ExperimentsPage() {
  const router = useRouter();
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [browseItems, setBrowseItems] = useState<ExperimentBrowseItem[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [selectedImage, setSelectedImage] = useState("");
  const [title, setTitle] = useState("");
  const [algorithm, setAlgorithm] = useState<AlgorithmName>("compare_all");
  const [params, setParams] = useState<AlgorithmParams>(DEFAULT_ALGORITHM_PARAMS);
  const [gaParams, setGAParams] = useState<GAParams>(DEFAULT_GA_PARAMS);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [algorithmFilter, setAlgorithmFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("created_at_desc");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [imgs, browse] = await Promise.all([
        imageService.list({ limit: 100 }),
        experimentService.browse({
          search: search || undefined,
          status: statusFilter || undefined,
          algorithm: algorithmFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort,
          limit: PAGE_SIZE,
          offset: browseOffset,
        }),
      ]);
      setImages(imgs);
      setBrowseItems(browse.items);
      setBrowseTotal(browse.total);
      if (imgs.length > 0 && !selectedImage) setSelectedImage(imgs[0].id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, algorithmFilter, dateFrom, dateTo, sort, browseOffset, selectedImage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 250);
    return () => clearTimeout(timer);
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
  const totalPages = Math.max(1, Math.ceil(browseTotal / PAGE_SIZE));
  const currentPage = Math.floor(browseOffset / PAGE_SIZE) + 1;

  if (loading && images.length === 0 && browseItems.length === 0) {
    return <LoadingState message="Tajribalar yuklanmoqda..." />;
  }

  if (loadError && images.length === 0) {
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
        description="Research-grade workflow: visual image picker, filtrlar va professional jadval"
        badge="Research"
      />

      <div className="scientific-card overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Yangi tajriba</h2>
              <p className="text-sm text-muted-foreground">
                Visual image picker va algoritm parametrlari
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
                <Label>Rasm tanlash</Label>
                <ImagePicker
                  images={images}
                  selectedId={selectedImage}
                  onSelect={setSelectedImage}
                />
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

      <section className="space-y-4">
        <SectionHeader
          title="Tajribalar tarixi"
          description="Qidiruv, filtr, sort va pagination"
        />
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Qidirish..."
            value={search}
            onChange={(e) => {
              setBrowseOffset(0);
              setSearch(e.target.value);
            }}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setBrowseOffset(0);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">Barcha holatlar</option>
            <option value="completed">Yakunlangan</option>
            <option value="running">Bajarilmoqda</option>
            <option value="queued">Navbatda</option>
            <option value="failed">Muvaffaqiyatsiz</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={algorithmFilter}
            onChange={(e) => {
              setBrowseOffset(0);
              setAlgorithmFilter(e.target.value);
            }}
          >
            <option value="">Barcha algoritmlar</option>
            <option value="compare_all">Hammasi</option>
            <option value="sobel">Sobel</option>
            <option value="prewitt">Prewitt</option>
            <option value="canny">Canny</option>
            <option value="genetic">GA</option>
          </select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setBrowseOffset(0);
              setDateFrom(e.target.value);
            }}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setBrowseOffset(0);
              setDateTo(e.target.value);
            }}
          />
        </div>
        <select
          className="h-10 max-w-xs rounded-md border bg-background px-3 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="created_at_desc">Eng yangi</option>
          <option value="created_at_asc">Eng eski</option>
          <option value="title_asc">Sarlavha A-Z</option>
          <option value="title_desc">Sarlavha Z-A</option>
        </select>

        <ExperimentsTable items={browseItems} />

        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {browseTotal} ta tajriba · sahifa {currentPage}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={browseOffset === 0}
              onClick={() => setBrowseOffset((v) => Math.max(0, v - PAGE_SIZE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={browseOffset + PAGE_SIZE >= browseTotal}
              onClick={() => setBrowseOffset((v) => v + PAGE_SIZE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
