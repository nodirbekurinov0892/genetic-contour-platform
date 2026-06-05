export type ExperimentStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AlgorithmName =
  | "sobel"
  | "prewitt"
  | "canny"
  | "genetic"
  | "compare_all";

export type ResultImageType =
  | "original"
  | "grayscale"
  | "gradient"
  | "sobel"
  | "prewitt"
  | "canny"
  | "ga"
  | "overlay"
  | "mask";

export interface ImageRecord {
  id: string;
  original_name: string;
  file_path: string;
  url?: string | null;
  width: number;
  height: number;
  size: number;
  mime_type: string;
  created_at: string;
}

export interface ExperimentRecord {
  id: string;
  image_id: string;
  title: string;
  description: string | null;
  status: ExperimentStatus;
  progress_percent: number;
  current_generation: number | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExperimentJobResponse {
  job_id: string;
  status: ExperimentStatus;
}

export interface ExperimentStatusResponse {
  job_id: string;
  status: ExperimentStatus;
  progress_percent: number;
  current_generation: number | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export interface MetricRecord {
  edge_density: number | null;
  continuity_score: number | null;
  noise_score: number | null;
  fitness_score: number | null;
  runtime_ms: number | null;
}

export interface ResultImageRecord {
  id: string;
  type: string;
  file_path: string;
  url: string | null;
}

export interface GenerationHistoryRecord {
  generation: number;
  best_fitness: number;
  average_fitness: number;
  mutation_rate: number;
}

export interface AlgorithmRunRecord {
  id: string;
  algorithm_name: string;
  parameters_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
  runtime_ms: number | null;
  status: string;
  metrics: MetricRecord[];
  result_images: ResultImageRecord[];
  generation_history: GenerationHistoryRecord[];
}

export interface ExperimentResults {
  experiment: ExperimentRecord;
  algorithm_runs: AlgorithmRunRecord[];
}

export interface AlgorithmParams {
  threshold: number;
  blur_kernel: number;
  resize_width: number;
  canny_low: number;
  canny_high: number;
}

export interface GAParams {
  population_size: number;
  generations: number;
  mutation_rate: number;
  crossover_rate: number;
  elitism_count: number;
  threshold: number;
  blur_kernel: number;
  resize_width: number;
}
