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
    measures: "GT chekka piksellari qancha foizi topilgan.",
    doesNotMeasure: "False positive yoki kontur uzluksizligi.",
    group: "supervised",
  },
  edge_density: {
    label: "Chekka zichligi",
    measures: "Chekka piksellari ulushi — kontur qalinligi indikatori.",
    doesNotMeasure: "Chekka to'g'riligi yoki GT overlap.",
    group: "heuristic",
  },
  gradient_magnitude: {
    label: "Gradient kuchi",
    measures: "Gradient amplitudasi bo'yicha o'rtacha chekka kuchliligi.",
    doesNotMeasure: "GT overlap yoki algoritm tezligi.",
    group: "heuristic",
  },
  contour_count: {
    label: "Konturlar soni",
    measures: "Aniqlangan alohida konturlar soni.",
    doesNotMeasure: "Chekka to'g'riligi yoki GT overlap.",
    group: "heuristic",
  },
  fitness_score: {
    label: "Fitness",
    measures: "Genetik algoritmning moslik bahosi (GA ichki ko'rsatkichi).",
    doesNotMeasure: "Chekka to'g'riligi yoki GT overlap.",
    group: "heuristic",
  },
};

export const HEURISTIC_DISCLAIMER =
  "These results are heuristic observations only. Algorithm superiority cannot be scientifically established without Ground Truth.";

export const HEURISTIC_DISCLAIMER_UZ =
  "Ushbu natijalar faqat evristik kuzatuvlar. Ground Truth bo'lmagan holda algoritm ustunligini ilmiy jihatdan isbotlab bo'lmaydi.";
