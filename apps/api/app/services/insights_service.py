"""Rule-based scientific insights from experiment metrics — narrative-free."""

from __future__ import annotations

from typing import Any

from app.core.scientific_evaluation import (
    build_scientific_context,
    warnings_from_gt_verification,
    warnings_from_reproducibility,
)

ALGO_LABELS = {
    "sobel": "Sobel",
    "prewitt": "Prewitt",
    "canny": "Canny",
    "genetic": "Genetik algoritm",
}


def _metric_fact(
    field: str,
    label: str,
    rows: list[dict[str, Any]],
    *,
    higher_is_better: bool = True,
) -> str | None:
    ranked = [r for r in rows if r.get(field) is not None]
    if not ranked:
        return None
    if higher_is_better:
        best = max(ranked, key=lambda x: x[field])
        return f"{label} bo'yicha eng yuqori qiymat: {best['algorithm']} ({best[field]:.4f})."
    best = min(ranked, key=lambda x: x[field])
    return (
        f"{label} bo'yicha eng past penalty: {best['algorithm']} ({best[field]:.4f})."
    )


def generate_insights(
    metrics_rows: list[dict[str, Any]],
    *,
    has_ground_truth: bool = False,
    reproducibility_json: dict[str, Any] | None = None,
    gt_verification: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not metrics_rows:
        return {
            "evaluation_mode": "heuristic",
            "has_ground_truth": False,
            "winner": None,
            "metric_warnings": [],
            "disclaimer": (
                "These results are heuristic observations only. "
                "Algorithm superiority cannot be scientifically established without Ground Truth."
            ),
            "summary": "Tajriba metrikalari mavjud emas.",
            "observations": [],
            "limitations": [],
            "comparisons": [],
            "winner_logic": {
                "criteria": ["iou", "f1_score", "dice_coefficient"],
                "fitness_participates": False,
                "declared_when": "has_ground_truth",
            },
        }

    scientific = build_scientific_context(
        metrics_rows,
        extra_warnings=(
            warnings_from_reproducibility(reproducibility_json)
            + warnings_from_gt_verification(gt_verification)
        ),
    )

    observations: list[str] = []
    limitations: list[str] = []
    comparisons: list[str] = []

    if scientific["has_ground_truth"] and scientific["winner"]:
        w = scientific["winner"]
        iou_text = f"{w['iou']:.4f}" if w.get("iou") is not None else "N/A"
        if w.get("tie"):
            observations.append(
                f"IoU ({iou_text}) bo'yicha teng natija: {w['algorithm']}."
            )
        else:
            observations.append(
                f"IoU bo'yicha eng yuqori overlap: {w['algorithm']} ({iou_text})."
            )
        for field, label in (
            ("f1_score", "F1"),
            ("dice_coefficient", "Dice"),
            ("precision", "Precision"),
            ("recall", "Recall"),
        ):
            fact = _metric_fact(field, label, metrics_rows)
            if fact:
                observations.append(fact)
    else:
        limitations.append(scientific["disclaimer"] or "")
        for field, label, higher in (
            ("continuity_score", "Continuity", True),
            ("noise_score", "Noise (penalty)", False),
            ("edge_density", "Edge density", True),
        ):
            fact = _metric_fact(field, label, metrics_rows, higher_is_better=higher)
            if fact:
                observations.append(f"Heuristik kuzatuv — {fact}")

        ga_row = next(
            (r for r in metrics_rows if r.get("algorithm_key") == "genetic"),
            None,
        )
        if ga_row and ga_row.get("fitness_score") is not None:
            observations.append(
                f"GA ichki optimallashtirish fitness: {ga_row['fitness_score']:.4f} "
                f"(algoritmlararo taqqoslash metrikasi emas)."
            )

    if not scientific["has_ground_truth"]:
        limitations.append(
            "Ground truth maska yo'q — Precision, Recall, IoU, F1, Dice hisoblanmagan."
        )
        limitations.append("G'olib aniqlanmagan (winner = null).")

    for warning in scientific.get("metric_warnings", []):
        limitations.append(warning.get("message", ""))

    if scientific["has_ground_truth"]:
        for row in metrics_rows:
            for other in metrics_rows:
                if row is other:
                    continue
                for field, label in (("iou", "IoU"), ("f1_score", "F1")):
                    a, b = row.get(field), other.get(field)
                    if a is None or b is None or b == 0:
                        continue
                    delta = ((a - b) / abs(b)) * 100
                    if abs(delta) > 1:
                        direction = "yuqori" if delta > 0 else "past"
                        comparisons.append(
                            f"{row['algorithm']} {other['algorithm']} ga nisbatan "
                            f"{abs(delta):.1f}% {direction} {label} ({a:.4f} vs {b:.4f})."
                        )

    return {
        "evaluation_mode": scientific["evaluation_mode"],
        "has_ground_truth": scientific["has_ground_truth"],
        "winner": scientific["winner"],
        "metric_warnings": scientific["metric_warnings"],
        "disclaimer": scientific["disclaimer"],
        "summary": scientific["summary"],
        "observations": [o for o in observations if o],
        "limitations": [l for l in limitations if l],
        "comparisons": comparisons,
        "strengths": [o for o in observations if o],
        "weaknesses": [l for l in limitations if l],
        "winner_logic": scientific["winner_logic"],
        "metric_taxonomy": scientific["metric_taxonomy"],
        "ground_truth_verification": (
            {
                "ground_truth_storage_status": gt_verification.get("ground_truth_storage_status"),
                "ground_truth_file_exists": gt_verification.get("ground_truth_file_exists"),
                "effective_ground_truth_key": gt_verification.get("effective_ground_truth_key"),
                "metrics_independently_verifiable": gt_verification.get(
                    "metrics_independently_verifiable"
                ),
                "inconsistency_detected": gt_verification.get("inconsistency_detected"),
                "warning": gt_verification.get("warning"),
            }
            if gt_verification
            else None
        ),
    }
