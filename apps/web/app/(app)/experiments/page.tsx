"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Input } from "@/components/ui/input";
import { ExperimentsTable } from "@/components/experiments/experiments-table";
import { LoadingState, ErrorState } from "@/components/ui/state-panel";
import { experimentService } from "@/services/experimentService";
import type { ExperimentBrowseItem } from "@shared/types";
import { API_BASE } from "@/lib/api";
import { formatAlgorithmLabel } from "@/lib/user-labels";
import { ALGORITHMS } from "@shared/constants";

const PAGE_SIZE = 10;

export default function ExperimentsPage() {
  const [browseItems, setBrowseItems] = useState<ExperimentBrowseItem[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const browse = await experimentService.browse({
        search: search || undefined,
        status: statusFilter || undefined,
        algorithm: algorithmFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: browseOffset,
      });
      setBrowseItems(browse.items);
      setBrowseTotal(browse.total);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Ma'lumotlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, algorithmFilter, dateFrom, dateTo, sort, browseOffset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(browseTotal / PAGE_SIZE));
  const currentPage = Math.floor(browseOffset / PAGE_SIZE) + 1;

  if (loading && browseItems.length === 0) {
    return <LoadingState message="Tajribalar yuklanmoqda..." />;
  }

  if (loadError && browseItems.length === 0) {
    return (
      <ErrorState
        title="Tajribalarni yuklab bo&apos;lmadi"
        message={loadError}
        hint={`API ${API_BASE} manzilida ishlayotganini tekshiring`}
        onRetry={loadData}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader
          title="Tajribalar"
          description="Barcha tajribalar, filtrlar va natijalar tarixi"
        />
        <Button asChild>
          <Link href="/experiments/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Yangi tajriba
          </Link>
        </Button>
      </div>

      <section className="scientific-card space-y-4 p-5">
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
            className="h-10 rounded-md border border-border/80 bg-background px-3 text-sm"
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
            <option value="pending">Kutilmoqda</option>
            <option value="cancelled">Bekor qilindi</option>
          </select>
          <select
            className="h-10 rounded-md border border-border/80 bg-background px-3 text-sm"
            value={algorithmFilter}
            onChange={(e) => {
              setBrowseOffset(0);
              setAlgorithmFilter(e.target.value);
            }}
          >
            <option value="">Barcha algoritmlar</option>
            {ALGORITHMS.map((algo) => (
              <option key={algo.id} value={algo.id}>
                {formatAlgorithmLabel(algo.id)}
              </option>
            ))}
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
          className="h-10 max-w-xs rounded-md border border-border/80 bg-background px-3 text-sm"
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
