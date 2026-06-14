"""Tests for reproducibility v2 metadata."""

from app.utils.reproducibility_v2 import build_reproducibility_v2


def test_reproducibility_v2_fields():
    meta = build_reproducibility_v2(
        seed=42,
        preprocessing_params={"resize_width": 256},
        algorithm_params={"algorithms": ["sobel"]},
        image_dimensions={"original_width": 100, "original_height": 80},
        has_ground_truth=True,
        comparison_protocol="fair_v1",
        image_checksum="abc",
        gt_checksum="def",
        dataset_version="1.0",
    )
    assert meta["reproducibility_version"] == "2.0"
    assert meta["random_seed"] == 42
    assert meta["comparison_protocol"] == "fair_v1"
    assert meta["image_checksum_sha256"] == "abc"
    assert meta["fair_comparison_methodology"]["protocol"] == "fair_v1"
