"use client";

import { SectionHeader } from "@/components/ui/section-header";
import type { ReproducibilityInfo } from "@shared/types";

interface ReproducibilityPanelProps {
  data: ReproducibilityInfo | null | undefined;
}

export function ReproducibilityPanel({ data }: ReproducibilityPanelProps) {
  if (!data) return null;

  const rows = [
    ["Random seed", data.random_seed],
    ["Python", data.python_version],
    ["OpenCV", data.opencv_version],
    ["NumPy", data.numpy_version],
    ["scikit-image", data.skimage_version],
  ];

  return (
    <section>
      <SectionHeader
        title="Reproducibility"
        description="Tajriba muhiti va seed ma'lumotlari"
        badge="Science"
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={String(label)} className="border-t first:border-t-0">
                <td className="bg-muted/30 px-3 py-2 font-medium">{label}</td>
                <td className="px-3 py-2 font-mono text-xs">{String(value ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
