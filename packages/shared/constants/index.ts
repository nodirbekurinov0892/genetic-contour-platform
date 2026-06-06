export const ALGORITHMS = [
  { id: "sobel", label: "Sobel", description: "Gradient asosidagi chekka aniqlash" },
  { id: "prewitt", label: "Prewitt", description: "Konvolyutsiya asosidagi chekka aniqlash" },
  { id: "canny", label: "Canny", description: "Ko'p bosqichli optimal chekka aniqlash" },
  { id: "genetic", label: "Genetic Algorithm", description: "GA asosidagi kontur optimallashtirish" },
  { id: "compare_all", label: "Barchasini solishtirish", description: "Barcha algoritmlarni ishga tushirish" },
] as const;

export const DEFAULT_ALGORITHM_PARAMS = {
  threshold: 0.5,
  blur_kernel: 5,
  resize_width: 256,
  canny_low: 50,
  canny_high: 150,
};

export const DEFAULT_GA_PARAMS = {
  population_size: 50,
  generations: 30,
  mutation_rate: 0.05,
  crossover_rate: 0.7,
  elitism_count: 2,
  threshold: 0.5,
  blur_kernel: 5,
  resize_width: 256,
};

export const API_ROUTES = {
  health: "/health",
  images: "/api/images",
  upload: "/api/images/upload",
  experiments: "/api/experiments",
} as const;
