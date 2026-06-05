export const ALGORITHMS = [
  { id: "sobel", label: "Sobel", description: "Gradient-based edge detection" },
  { id: "prewitt", label: "Prewitt", description: "Convolution-based edge detection" },
  { id: "canny", label: "Canny", description: "Multi-stage optimal edge detection" },
  { id: "genetic", label: "Genetic Algorithm", description: "GA-based contour optimization" },
  { id: "compare_all", label: "Compare All", description: "Run all algorithms" },
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
