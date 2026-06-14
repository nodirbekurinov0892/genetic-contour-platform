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
  has_ground_truth?: boolean;
  ground_truth_url?: string | null;
  ground_truth_uploaded_at?: string | null;
  gt_validation_status?: string | null;
  gt_validated_at?: string | null;
  created_at: string;
}

export interface ReproducibilityInfo {
  random_seed?: number;
  python_version?: string;
  opencv_version?: string;
  numpy_version?: string;
  skimage_version?: string;
  captured_at?: string;
  platform_version?: string;
  preprocessing_params?: Record<string, unknown>;
  algorithm_params?: Record<string, unknown>;
  image_dimensions?: Record<string, number>;
  has_ground_truth?: boolean;
}

export type EvaluationMode = "supervised" | "heuristic";

export interface WinnerInfo {
  algorithm: string;
  algorithm_key?: string;
  algorithm_keys?: string[];
  primary_metric: string;
  iou?: number;
  f1_score?: number;
  dice_coefficient?: number;
  tie?: boolean;
}

export interface MetricWarning {
  type: string;
  algorithm: string;
  message: string;
}

export interface ScientificEvaluation {
  evaluation_mode: EvaluationMode;
  has_ground_truth: boolean;
  winner: WinnerInfo | null;
  metric_warnings: MetricWarning[];
  disclaimer: string | null;
  summary: string;
  winner_logic: {
    criteria: string[];
    fitness_participates: boolean;
    declared_when: string;
  };
  metric_taxonomy: {
    supervised: string[];
    heuristic: string[];
  };
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
  reproducibility_json?: ReproducibilityInfo | null;
}

export interface ExperimentBrowseItem {
  id: string;
  title: string;
  status: ExperimentStatus;
  algorithm: string | null;
  image_id: string;
  image_name: string | null;
  progress_percent: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface ExperimentBrowseResponse {
  items: ExperimentBrowseItem[];
  total: number;
  limit: number;
  offset: number;
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
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  iou: number | null;
  dice_coefficient: number | null;
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

export interface ScientificInsights {
  evaluation_mode: EvaluationMode;
  has_ground_truth: boolean;
  winner: WinnerInfo | null;
  metric_warnings: MetricWarning[];
  disclaimer: string | null;
  summary: string;
  observations: string[];
  limitations: string[];
  comparisons: string[];
  strengths: string[];
  weaknesses: string[];
  winner_logic: ScientificEvaluation["winner_logic"];
  metric_taxonomy: ScientificEvaluation["metric_taxonomy"];
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
