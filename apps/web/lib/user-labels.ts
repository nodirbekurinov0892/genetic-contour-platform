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

export const EXPERIMENT_STATUS_MESSAGES: Record<string, string> = {
  queued: "Navbatda — tez orada ishga tushadi",
  running: "Ishlamoqda — natijalar tayyorlanmoqda",
  failed: "Muvaffaqiyatsiz — qayta urinib ko'ring",
  cancelled: "Bekor qilindi",
  completed: "Yakunlandi — hisobot va taqqoslash mavjud",
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

export function formatGtValidationStatus(status: string | null | undefined): string {
  if (!status) return "Tekshirilmagan";
  return GT_VALIDATION_LABELS[status] ?? status;
}
