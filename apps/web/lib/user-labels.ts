/** User-facing Uzbek labels — hide internal protocol/storage identifiers. */

export const EVALUATION_MODE_LABELS = {
  supervised: "Nazoratli baholash",
  heuristic: "Evristik baholash",
} as const;

export const EVALUATION_MODE_DESCRIPTIONS = {
  supervised: "Ground Truth mavjud — IoU, F1 va Dice orqali o'lchanadi.",
  heuristic: "Ground Truth yo'q — kontur sifati evristik ko'rsatkichlar bilan baholanadi.",
} as const;

export const GT_PAIRING_LABELS = {
  paired: "GT yuklandi",
  notPaired: "GT yuklanmagan",
  selectedNotUploaded: "GT tanlangan — yuklash tugmasini bosing",
} as const;

export const GT_VALIDATION_LABELS: Record<string, string> = {
  valid: "Tasdiqlangan",
  pending: "Tekshirilmoqda",
  invalid: "Noto'g'ri",
  rejected: "Rad etilgan",
};

export const COMPARISON_WORKFLOW_LABEL =
  "To'liq taqqoslash — Sobel, Prewitt, Canny va Genetik algoritm";

export const FAIR_PROTOCOL_LABEL = "Adolatli taqqoslash protokoli (bir xil preprocessing)";

export const COMPARISON_PROTOCOL_LABELS: Record<string, string> = {
  fair_v1: "Adolatli taqqoslash protokoli v1",
};

export const EXPERIMENT_STATUS_MESSAGES: Record<string, string> = {
  pending: "Kutilmoqda — ishga tushirish kerak",
  queued: "Navbatda — tez orada ishga tushadi",
  running: "Ishlamoqda — natijalar tayyorlanmoqda",
  failed: "Muvaffaqiyatsiz — qayta urinib ko'ring",
  cancelled: "Bekor qilindi",
  completed: "Yakunlandi — hisobot va taqqoslash mavjud",
};

export const EXPERIMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Kutilmoqda",
  queued: "Navbatda",
  running: "Ishlamoqda",
  failed: "Muvaffaqiyatsiz",
  cancelled: "Bekor qilindi",
  completed: "Yakunlandi",
};

export const ALGORITHM_USER_LABELS: Record<string, string> = {
  sobel: "Sobel",
  prewitt: "Prewitt",
  canny: "Canny",
  genetic: "Genetik algoritm",
  compare_all: "Barcha algoritmlar",
};

export function formatAlgorithmLabel(algorithm: string | null | undefined): string {
  if (!algorithm) return "—";
  return ALGORITHM_USER_LABELS[algorithm] ?? algorithm;
}

export function formatComparisonProtocol(protocol: string | null | undefined): string {
  if (!protocol) return "—";
  return COMPARISON_PROTOCOL_LABELS[protocol] ?? "Adolatli taqqoslash protokoli";
}

export const GT_DISPLAY_STATUS_LABELS: Record<string, string> = {
  VALID: "Tasdiqlangan",
  WARNING: "Ogohlantirish",
  INVALID: "Noto'g'ri",
};

export function formatGtDisplayStatus(status: string | null | undefined): string {
  if (!status) return "Tekshirilmagan";
  return GT_DISPLAY_STATUS_LABELS[status] ?? status;
}

export function getGtDisplayStatusVariant(
  status: string | null | undefined,
): "success" | "warning" | "destructive" | "outline" {
  if (status === "VALID") return "success";
  if (status === "WARNING") return "warning";
  if (status === "INVALID") return "destructive";
  return "outline";
}

export function formatGtValidationStatus(status: string | null | undefined): string {
  if (!status) return "Tekshirilmagan";
  return GT_VALIDATION_LABELS[status] ?? status;
}

export const REPORT_TYPE_LABELS: Record<string, string> = {
  scientific: "Ilmiy",
  executive: "Rahbariyat",
  technical: "Texnik",
  benchmark: "Benchmark",
};

export function formatExperimentStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return EXPERIMENT_STATUS_LABELS[status] ?? status;
}
