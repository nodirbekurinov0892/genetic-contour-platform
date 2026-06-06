"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/section-header";
import type { AlgorithmParams, GAParams } from "@shared/types";

interface AlgorithmParamsFormProps {
  params: AlgorithmParams;
  gaParams: GAParams;
  showGA: boolean;
  onParamsChange: (params: AlgorithmParams) => void;
  onGAParamsChange: (params: GAParams) => void;
}

function ParamField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AlgorithmParamsForm({
  params,
  gaParams,
  showGA,
  onParamsChange,
  onGAParamsChange,
}: AlgorithmParamsFormProps) {
  return (
    <div className="space-y-6">
      <div>
        <SectionHeader
          title="Oldindan qayta ishlash va klassik parametrlar"
          description="Kulrangga o'tkazish, xiralashtirish, o'lchamni o'zgartirish va klassik chekka detektorlariga qo'llanadi"
          badge="Umumiy"
          className="mb-4"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ParamField id="threshold" label="Chegara (Threshold)" hint="Chekka binarizatsiyasi (0–1)">
            <Input
              id="threshold"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={params.threshold}
              onChange={(e) => onParamsChange({ ...params, threshold: parseFloat(e.target.value) })}
            />
          </ParamField>
          <ParamField id="blur_kernel" label="Xiralashtirish yadrosi" hint="Gauss xiralashtirish hajmi (toq son)">
            <Input
              id="blur_kernel"
              type="number"
              min="1"
              max="15"
              value={params.blur_kernel}
              onChange={(e) => onParamsChange({ ...params, blur_kernel: parseInt(e.target.value) })}
            />
          </ParamField>
          <ParamField id="resize_width" label="Kenglik o'lchami" hint="Maqsad kengligi (piksel)">
            <Input
              id="resize_width"
              type="number"
              min="64"
              max="1024"
              value={params.resize_width}
              onChange={(e) => onParamsChange({ ...params, resize_width: parseInt(e.target.value) })}
            />
          </ParamField>
          <ParamField id="canny_low" label="Canny Low" hint="Past gisteresis chegarasi">
            <Input
              id="canny_low"
              type="number"
              value={params.canny_low}
              onChange={(e) => onParamsChange({ ...params, canny_low: parseFloat(e.target.value) })}
            />
          </ParamField>
          <ParamField id="canny_high" label="Canny High" hint="Yuqori gisteresis chegarasi">
            <Input
              id="canny_high"
              type="number"
              value={params.canny_high}
              onChange={(e) => onParamsChange({ ...params, canny_high: parseFloat(e.target.value) })}
            />
          </ParamField>
        </div>
      </div>

      {showGA && (
        <div>
          <SectionHeader
            title="Genetic Algorithm parametrlari"
            description="Ko'p mezonli kontur optimallashtirish uchun populyatsiya evolyutsiyasi sozlamalari"
            badge="GA"
            className="mb-4"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ParamField id="population_size" label="Populyatsiya hajmi" hint="Xromosomalar soni">
              <Input
                id="population_size"
                type="number"
                value={gaParams.population_size}
                onChange={(e) => onGAParamsChange({ ...gaParams, population_size: parseInt(e.target.value) })}
              />
            </ParamField>
            <ParamField id="generations" label="Avlodlar" hint="Evolyutsiya iteratsiyalari">
              <Input
                id="generations"
                type="number"
                value={gaParams.generations}
                onChange={(e) => onGAParamsChange({ ...gaParams, generations: parseInt(e.target.value) })}
              />
            </ParamField>
            <ParamField id="mutation_rate" label="Mutatsiya darajasi" hint="Gen mutatsiyasi ehtimoli">
              <Input
                id="mutation_rate"
                type="number"
                step="0.01"
                value={gaParams.mutation_rate}
                onChange={(e) => onGAParamsChange({ ...gaParams, mutation_rate: parseFloat(e.target.value) })}
              />
            </ParamField>
            <ParamField id="crossover_rate" label="Krossover darajasi" hint="Krossover ehtimoli">
              <Input
                id="crossover_rate"
                type="number"
                step="0.05"
                value={gaParams.crossover_rate}
                onChange={(e) => onGAParamsChange({ ...gaParams, crossover_rate: parseFloat(e.target.value) })}
              />
            </ParamField>
            <ParamField id="elitism_count" label="Elitizm soni" hint="Saqlanadigan eng yaxshi xromosomalar">
              <Input
                id="elitism_count"
                type="number"
                value={gaParams.elitism_count}
                onChange={(e) => onGAParamsChange({ ...gaParams, elitism_count: parseInt(e.target.value) })}
              />
            </ParamField>
          </div>
        </div>
      )}
    </div>
  );
}
