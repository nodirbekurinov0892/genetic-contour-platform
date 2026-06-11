export interface MetricDefinition {
  label: string;
  measures: string;
  doesNotMeasure: string;
  group: "supervised" | "heuristic";
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  iou: {
    label: "IoU",
    measures: "Ground Truth bilan bashorat o'rtasidagi kesishish / birlashish nisbati (Jaccard).",
    doesNotMeasure: "Vizual sifat, kontur uzluksizligi yoki GA fitness.",
    group: "supervised",
  },
  f1_score: {
    label: "F1",
    measures: "Precision va Recall garmonik o'rtachasi.",
    doesNotMeasure: "Kontur ingichakligi, gradient mosligi yoki runtime.",
    group: "supervised",
  },
  dice_coefficient: {
    label: "Dice",
    measures: "Ikki binar maskaning o'xshashlik koeffitsienti (F1 bilan bog'liq).",
    doesNotMeasure: "Heuristik kontur sifati yoki algoritm tezligi.",
    group: "supervised",
  },
  precision: {
    label: "Precision",
    measures: "Bashorat qilingan chekka piksellari qancha foizi GT da to'g'ri.",
    doesNotMeasure: "Qoplanmagan GT chekkalar (FN) yoki vizual estetika.",
    group: "supervised",
  },
  recall: {
    label: "Recall",
    measures: "GT chekka piksellari qancha foizi bashoratda topilgan.",
    doesNotMeasure: "Ortiqcha chekkalar (FP) yoki kontur uzluksizligi.",
    group: "supervised",
  },
  continuity_score: {
    label: "Continuity",
    measures: "Kontur fragmentatsiyasi va eng katta komponent ulushi (heuristik).",
    doesNotMeasure: "GT bilan moslik yoki algoritm aniqligi.",
    group: "heuristic",
  },
  noise_score: {
    label: "Noise",
    measures: "Izolyatsiya qilingan chekka piksellari ulushi (penalty — past yaxshi).",
    doesNotMeasure: "GT asosidagi FP/FN yoki ilmiy aniqlik.",
    group: "heuristic",
  },
  fitness_score: {
    label: "GA ichki fitness",
    measures: "Genetik algoritm evolyutsiyasi uchun ichki optimallashtirish balli.",
    doesNotMeasure: "Algoritmlararo taqqoslash yoki GT aniqligi. Faqat GA uchun.",
    group: "heuristic",
  },
  edge_density: {
    label: "Edge density",
    measures: "Rasmdagi chekka piksellari ulushi.",
    doesNotMeasure: "Chekka to'g'riligi yoki GT overlap.",
    group: "heuristic",
  },
};

export const HEURISTIC_DISCLAIMER =
  "These results are heuristic observations only. Algorithm superiority cannot be scientifically established without Ground Truth.";

export const HEURISTIC_DISCLAIMER_UZ =
  "Ushbu natijalar faqat heuristik kuzatuvlar. Ground Truth bo'lmagan holda algoritm ustunligini ilmiy jihatdan isbotlab bo'lmaydi.";
