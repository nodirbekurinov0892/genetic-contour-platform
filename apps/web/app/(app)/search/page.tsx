"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FlaskConical, ImageIcon, Search, Trophy } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-panel";
import { searchService, type SearchResults } from "@/services/searchService";
import { formatAlgorithmLabel, formatExperimentStatus } from "@/lib/user-labels";

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchService
        .search(q)
        .then(setResults)
        .catch((err) => setError(err instanceof Error ? err.message : "Qidiruv xatosi"))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const totalHits =
    (results?.experiments.length ?? 0) +
    (results?.images.length ?? 0) +
    (results?.benchmarks.length ?? 0) +
    (results?.reports.length ?? 0) +
    (results?.algorithms.length ?? 0);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Global qidiruv"
        description="Tajribalar, rasmlar, benchmarklar va algoritmlar bo'yicha qidiruv"
      />

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kamida 2 belgi kiriting..."
          className="pl-9"
          autoFocus
        />
      </div>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-sm text-muted-foreground">Qidiruv uchun kamida 2 belgi kiriting.</p>
      )}

      {loading && <LoadingState message="Qidirilmoqda..." />}
      {error && <ErrorState message={error} />}

      {!loading && results && totalHits === 0 && query.trim().length >= 2 && (
        <EmptyState title="Natija topilmadi" description={`"${results.query}" bo'yicha hech narsa yo'q.`} />
      )}

      {!loading && results && totalHits > 0 && (
        <div className="space-y-6">
          {results.experiments.length > 0 && (
            <section className="scientific-card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <FlaskConical className="h-4 w-4" />
                Tajribalar ({results.experiments.length})
              </h3>
              <ul className="space-y-2 text-sm">
                {results.experiments.map((exp) => (
                  <li key={exp.id}>
                    <Link href={`/experiments/${exp.id}`} className="font-medium hover:text-primary hover:underline">
                      {exp.title}
                    </Link>
                    <Badge variant="outline" className="ml-2">
                      {formatExperimentStatus(exp.status)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.images.length > 0 && (
            <section className="scientific-card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <ImageIcon className="h-4 w-4" />
                Rasmlar ({results.images.length})
              </h3>
              <ul className="space-y-2 text-sm">
                {results.images.map((img) => (
                  <li key={img.id}>
                    <Link href="/library" className="hover:text-primary hover:underline">
                      {img.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.benchmarks.length > 0 && (
            <section className="scientific-card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Trophy className="h-4 w-4" />
                Benchmarklar ({results.benchmarks.length})
              </h3>
              <ul className="space-y-2 text-sm">
                {results.benchmarks.map((b) => (
                  <li key={b.id}>
                    <Link href="/benchmarks" className="hover:text-primary hover:underline">
                      {b.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{b.slug}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.algorithms.length > 0 && (
            <section className="scientific-card p-4">
              <h3 className="mb-3 font-semibold">Algoritmlar</h3>
              <div className="flex flex-wrap gap-2">
                {results.algorithms.map((algo) => (
                  <Badge key={algo} variant="secondary">
                    {formatAlgorithmLabel(algo)}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {results.reports.length > 0 && (
            <section className="scientific-card p-4">
              <h3 className="mb-3 font-semibold">Hisobotlar ({results.reports.length})</h3>
              <ul className="space-y-2 text-sm">
                {results.reports.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/reports?experiment=${r.experiment_id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {r.format.toUpperCase()} — tajriba {r.experiment_id.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState message="Qidiruv yuklanmoqda..." />}>
      <SearchPageContent />
    </Suspense>
  );
}
