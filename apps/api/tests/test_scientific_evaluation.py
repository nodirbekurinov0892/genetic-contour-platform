"""Tests for scientific evaluation framework."""

from app.core.scientific_evaluation import (
    EVALUATION_MODE_HEURISTIC,
    EVALUATION_MODE_SUPERVISED,
    build_scientific_context,
    determine_winner,
    detect_metric_inconsistencies,
)


def _row(algo: str, key: str, **metrics: float) -> dict:
    return {"algorithm": algo, "algorithm_key": key, **metrics}


def test_no_winner_without_ground_truth():
    rows = [_row("Sobel", "sobel", continuity_score=0.9)]
    ctx = build_scientific_context(rows, has_ground_truth=False)
    assert ctx["evaluation_mode"] == EVALUATION_MODE_HEURISTIC
    assert ctx["winner"] is None
    assert ctx["disclaimer"] is not None
    assert "ilmiy jihatdan isbotlanmagan" in ctx["summary"]


def test_winner_by_iou():
    rows = [
        _row("Sobel", "sobel", iou=0.5, f1_score=0.6, dice_coefficient=0.55),
        _row("Canny", "canny", iou=0.7, f1_score=0.65, dice_coefficient=0.68),
    ]
    winner = determine_winner(rows)
    assert winner is not None
    assert winner["algorithm"] == "Canny"
    assert winner["tie"] is False


def test_winner_tie_break_f1():
    rows = [
        _row("Sobel", "sobel", iou=0.7, f1_score=0.8, dice_coefficient=0.7),
        _row("Canny", "canny", iou=0.7, f1_score=0.6, dice_coefficient=0.75),
    ]
    winner = determine_winner(rows)
    assert winner["algorithm"] == "Sobel"


def test_high_fitness_low_iou_warning():
    rows = [
        _row(
            "GA",
            "genetic",
            fitness_score=0.8,
            iou=0.2,
            continuity_score=0.5,
            recall=0.5,
            edge_density=0.05,
            precision=0.5,
        ),
    ]
    warnings = detect_metric_inconsistencies(rows)
    assert any(w["type"] == "high_fitness_low_iou" for w in warnings)


def test_supervised_mode():
    rows = [_row("Canny", "canny", iou=0.6, f1_score=0.7, dice_coefficient=0.65)]
    ctx = build_scientific_context(rows, has_ground_truth=True)
    assert ctx["evaluation_mode"] == EVALUATION_MODE_SUPERVISED
    assert ctx["winner"]["algorithm"] == "Canny"
    assert ctx["disclaimer"] is None


def test_gt_added_after_run_stays_heuristic():
    """Image may have GT later; report must follow run-time supervised metrics."""
    rows = [
        _row("Sobel", "sobel", continuity_score=0.9, edge_density=0.07, iou=None),
        _row("GA", "genetic", fitness_score=0.65, continuity_score=0.99, iou=None),
    ]
    ctx = build_scientific_context(rows, has_ground_truth=True)
    assert ctx["evaluation_mode"] == EVALUATION_MODE_HEURISTIC
    assert ctx["has_ground_truth"] is False
    assert ctx["winner"] is None
    assert ctx["disclaimer"] is not None


def test_insights_noise_wording_lowest_penalty():
    from app.services.insights_service import generate_insights

    rows = [
        _row("Sobel", "sobel", noise_score=0.04, continuity_score=0.5, edge_density=0.08),
        _row("GA", "genetic", noise_score=0.02, continuity_score=0.5, edge_density=0.07),
    ]
    insights = generate_insights(rows, has_ground_truth=False)
    noise_obs = [o for o in insights["observations"] if "Noise" in o]
    assert noise_obs
    assert "eng past penalty" in noise_obs[0]
    assert "eng yuqori" not in noise_obs[0].lower() or "eng past" in noise_obs[0]
