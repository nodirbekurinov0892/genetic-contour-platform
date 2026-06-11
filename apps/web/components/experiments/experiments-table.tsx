"use client";

import Link from "next/link";
import { ExperimentStatusBadge } from "@/components/experiments/experiment-status-badge";
import type { ExperimentBrowseItem } from "@shared/types";
import { formatDate } from "@/lib/utils";

interface ExperimentsTableProps {
  items: ExperimentBrowseItem[];
}

const ALGO_LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "GA",
  compare_all: "Hammasi",
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function ExperimentsTable({ items }: ExperimentsTableProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Filtrga mos tajriba topilmadi.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2">Tajriba</th>
            <th className="px-3 py-2">Holat</th>
            <th className="px-3 py-2">Algoritm</th>
            <th className="px-3 py-2">Rasm</th>
            <th className="px-3 py-2">Yaratilgan</th>
            <th className="px-3 py-2">Davomiylik</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t hover:bg-muted/20">
              <td className="px-3 py-2">
                <Link
                  href={`/experiments/${item.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {item.title}
                </Link>
              </td>
              <td className="px-3 py-2">
                <ExperimentStatusBadge status={item.status} />
              </td>
              <td className="px-3 py-2">
                {item.algorithm ? ALGO_LABELS[item.algorithm] ?? item.algorithm : "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {item.image_name ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {formatDate(item.created_at)}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {formatDuration(item.duration_ms)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
