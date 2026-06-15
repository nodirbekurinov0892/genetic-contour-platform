from uuid import UUID

from pydantic import BaseModel


class ExperimentVerificationResponse(BaseModel):
    experiment_id: UUID
    image_id: UUID
    ground_truth_storage_key: str | None = None
    canonical_ground_truth_key: str
    effective_ground_truth_key: str | None = None
    ground_truth_storage_status: str
    ground_truth_file_exists: bool
    run_time_had_ground_truth: bool
    run_time_ground_truth_checksum_sha256: str | None = None
    current_gt_checksum: str | None = None
    has_supervised_metrics: bool
    metrics_independently_verifiable: bool
    inconsistency_detected: bool
    warning: str | None = None
