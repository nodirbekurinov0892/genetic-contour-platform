"use client";

import { SectionHeader } from "@/components/ui/section-header";
import type { ReproducibilityInfo } from "@shared/types";

interface ReproducibilityPanelProps {
  data: ReproducibilityInfo | null | undefined;
}

export function ReproducibilityPanel({ data }: ReproducibilityPanelProps) {
  if (!data) return null;

  const rows: [string, string | number | undefined][] = [
    ["Random seed", data.random_seed],
    ["Captured at", data.captured_at],
    ["Platform version", data.platform_version],
    ["Python", data.python_version],
    ["OpenCV", data.opencv_version],
    ["NumPy", data.numpy_version],
    ["scikit-image", data.skimage_version],
    ["Ground Truth", data.has_ground_truth ? "Mavjud" : "Yo'q"],
  ];

  if (data.image_dimensions && Object.keys(data.image_dimensions).length > 0) {
    rows.push([
      "Image dimensions",
      `${data.image_dimensions.original_width ?? "?"} x ${data.image_dimensions.original_height ?? "?"} px`,
    ]);
  }

  if (data.preprocessing_params && Object.keys(data.preprocessing_params).length > 0) {
    rows.push(["Preprocessing", JSON.stringify(data.preprocessing_params)]);
  }

  if (data.algorithm_params && Object.keys(data.algorithm_params).length > 0) {
    rows.push(["Algorithm params", JSON.stringify(data.algorithm_params)]);
  }

  return (
    <section>
      <SectionHeader
        title="Reproducibility"
        description="Tajriba muhiti, parametrlar va seed ma'lumotlari"
        badge="Science"
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={String(label)} className="border-t first:border-t-0">
                <td className="bg-muted/30 px-3 py-2 font-medium">{label}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{String(value ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
