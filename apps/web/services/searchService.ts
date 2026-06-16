import { apiFetch } from "@/lib/api";

export interface SearchResults {
  query: string;
  experiments: Array<{ id: string; title: string; status: string }>;
  images: Array<{ id: string; name: string }>;
  benchmarks: Array<{ id: string; name: string; slug: string }>;
  reports: Array<{ id: string; experiment_id: string; format: string }>;
  algorithms: string[];
}

export const searchService = {
  search(q: string, limit = 20): Promise<SearchResults> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return apiFetch<SearchResults>(`/api/search?${params}`);
  },
};
