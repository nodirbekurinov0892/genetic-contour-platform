"""GT missing warnings in scientific evaluation context."""

from app.core.scientific_evaluation import build_scientific_context, warnings_from_reproducibility


def test_gt_missing_warning_in_scientific_context():
    reproducibility = {
        "gt_reference_present": True,
        "gt_file_available": False,
        "evaluation_warnings": [
            "Ground Truth fayli topilmadi, tajriba evristik rejimda baholandi",
        ],
    }
    rows = [
        {
            "algorithm": "Sobel",
            "algorithm_key": "sobel",
            "edge_density": 0.1,
            "continuity_score": 0.5,
            "noise_score": 0.2,
            "fitness_score": None,
            "runtime_ms": 10,
            "precision": None,
            "recall": None,
            "f1_score": None,
            "iou": None,
            "dice_coefficient": None,
        }
    ]
    extra = warnings_from_reproducibility(reproducibility)
    ctx = build_scientific_context(rows, extra_warnings=extra)

    assert ctx["evaluation_mode"] == "heuristic"
    assert ctx["has_ground_truth"] is False
    assert ctx["winner"] is None
    assert any(w["type"] == "gt_file_missing" for w in ctx["metric_warnings"])
