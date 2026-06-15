"""Tests for GT artifact verification and inconsistency detection."""

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

from app.core.scientific_evaluation import warnings_from_gt_verification
from app.services.gt_verification_service import build_gt_verification_status


def _image(**kwargs):
    defaults = {
        "id": UUID("7e5eab66-cb90-4324-b2dd-ee86deb8b5f4"),
        "ground_truth_storage_key": None,
        "ground_truth_file_path": None,
        "gt_checksum": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _experiment(**kwargs):
    defaults = {
        "id": UUID("b43cbd76-beb8-4c12-a91a-163d72abf01a"),
        "reproducibility_json": {
            "has_ground_truth": True,
            "ground_truth_checksum_sha256": "abc123",
        },
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_inconsistency_when_supervised_metrics_but_gt_missing():
    storage = MagicMock()
    storage.resolve_storage_key.side_effect = lambda **kw: kw.get("storage_key") or kw.get("file_path")
    storage.exists.return_value = False

    status = build_gt_verification_status(
        experiment=_experiment(),
        image=_image(),
        storage=storage,
        metrics_rows=[{"algorithm": "Sobel", "iou": 0.05, "f1_score": 0.09}],
    )

    assert status["has_supervised_metrics"] is True
    assert status["ground_truth_file_exists"] is False
    assert status["inconsistency_detected"] is True
    assert status["metrics_independently_verifiable"] is False
    assert "cannot be independently verified" in status["warning"]


def test_verifiable_when_gt_file_exists():
    storage = MagicMock()
    storage.resolve_storage_key.side_effect = lambda **kw: kw.get("storage_key") or kw.get("file_path")
    storage.exists.return_value = True

    status = build_gt_verification_status(
        experiment=_experiment(),
        image=_image(
            ground_truth_storage_key="uploads/ground-truth/7e5eab66-cb90-4324-b2dd-ee86deb8b5f4.png"
        ),
        storage=storage,
        metrics_rows=[{"algorithm": "Sobel", "iou": 0.05, "f1_score": 0.09}],
    )

    assert status["inconsistency_detected"] is False
    assert status["metrics_independently_verifiable"] is True


def test_warning_from_gt_verification():
    warnings = warnings_from_gt_verification(
        {"inconsistency_detected": True, "warning": "GT artifact missing; metrics cannot be independently verified."}
    )
    assert len(warnings) == 1
    assert warnings[0]["type"] == "gt_artifact_inconsistent"
