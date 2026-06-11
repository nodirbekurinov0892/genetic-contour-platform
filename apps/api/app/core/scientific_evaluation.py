"""Scientific evaluation modes, winner logic, and metric consistency checks."""

from __future__ import annotations

from typing import Any

EVALUATION_MODE_SUPERVISED = "supervised"
EVALUATION_MODE_HEURISTIC = "heuristic"

SUPERVISED_METRICS = ("iou", "f1_score", "precision", "recall", "dice_coefficient")
HEURISTIC_METRICS = ("fitness_score", "continuity_score", "noise_score", "edge_density")

# Thresholds for heuristic vs supervised divergence warnings.
_FITNESS_HIGH = 0.55
_IOU_LOW = 0.40
_CONTINUITY_HIGH = 0.70
_RECALL_LOW = 0.40
_EDGE_DENSITY_HIGH = 0.12
_PRECISION_LOW = 0.40


def get_evaluation_mode(has_ground_truth: bool) -> str:
    return EVALUATION_MODE_SUPERVISED if has_ground_truth else EVALUATION_MODE_HEURISTIC


def has_supervised_metrics(metrics_rows: list[dict[str, Any]]) -> bool:
    return any(row.get("iou") is not None for row in metrics_rows)


def determine_winner(metrics_rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Winner is declared only when Ground Truth supervised metrics exist.

    Primary criterion: IoU. Ties broken by F1, then Dice.
    Fitness never participates in winner determination.
    """
    if not has_supervised_metrics(metrics_rows):
        return None

    candidates = [r for r in metrics_rows if r.get("iou") is not None]
    if not candidates:
        return None

    def _pick(
        pool: list[dict[str, Any]],
        field: str,
        reverse: bool = True,
    ) -> list[dict[str, Any]]:
        values = [r.get(field) for r in pool if r.get(field) is not None]
        if not values:
            return pool
        target = max(values) if reverse else min(values)
        return [r for r in pool if r.get(field) == target]

    winners = _pick(candidates, "iou")
    if len(winners) > 1:
        winners = _pick(winners, "f1_score")
    if len(winners) > 1:
        winners = _pick(winners, "dice_coefficient")

    if len(winners) == 1:
        row = winners[0]
        return {
            "algorithm": row["algorithm"],
            "algorithm_key": row.get("algorithm_key"),
            "primary_metric": "iou",
            "iou": row.get("iou"),
            "f1_score": row.get("f1_score"),
            "dice_coefficient": row.get("dice_coefficient"),
            "tie": False,
        }

    return {
        "algorithm": ", ".join(r["algorithm"] for r in winners),
        "algorithm_keys": [r.get("algorithm_key") for r in winners],
        "primary_metric": "iou",
        "iou": winners[0].get("iou"),
        "f1_score": winners[0].get("f1_score"),
        "dice_coefficient": winners[0].get("dice_coefficient"),
        "tie": True,
    }


def detect_metric_inconsistencies(metrics_rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Flag cases where heuristic scores look strong but supervised scores are weak."""
    warnings: list[dict[str, str]] = []

    for row in metrics_rows:
        algo = row.get("algorithm", "Unknown")
        fitness = row.get("fitness_score")
        iou = row.get("iou")
        continuity = row.get("continuity_score")
        recall = row.get("recall")
        density = row.get("edge_density")
        precision = row.get("precision")

        if fitness is not None and iou is not None:
            if fitness >= _FITNESS_HIGH and iou <= _IOU_LOW:
                warnings.append(
                    {
                        "type": "high_fitness_low_iou",
                        "algorithm": algo,
                        "message": (
                            f"{algo}: GA ichki fitness ({fitness:.4f}) yuqori, "
                            f"lekin IoU ({iou:.4f}) past — heuristik va GT natijalari mos kelmayapti."
                        ),
                    }
                )

        if continuity is not None and recall is not None:
            if continuity >= _CONTINUITY_HIGH and recall <= _RECALL_LOW:
                warnings.append(
                    {
                        "type": "high_continuity_low_recall",
                        "algorithm": algo,
                        "message": (
                            f"{algo}: continuity ({continuity:.4f}) yuqori, "
                            f"lekin recall ({recall:.4f}) past — uzluksiz kontur GT qoplamayapti."
                        ),
                    }
                )

        if density is not None and precision is not None:
            if density >= _EDGE_DENSITY_HIGH and precision <= _PRECISION_LOW:
                warnings.append(
                    {
                        "type": "high_density_low_precision",
                        "algorithm": algo,
                        "message": (
                            f"{algo}: edge density ({density:.4f}) yuqori, "
                            f"lekin precision ({precision:.4f}) past — ko'p noto'g'ri chekka piksellari."
                        ),
                    }
                )

    return warnings


def generate_data_driven_summary(
    metrics_rows: list[dict[str, Any]],
    *,
    has_ground_truth: bool,
    winner: dict[str, Any] | None,
) -> str:
    """Narrative-free, data-only summary. No algorithm praise or superiority claims without GT."""
    if not metrics_rows:
        return "Tajriba metrikalari mavjud emas."

    n = len(metrics_rows)
    parts = [
        f"{n} ta algoritm bir xil preprocessing pipeline asosida baholandi.",
    ]

    if has_ground_truth and winner:
        if winner.get("tie"):
            parts.append(
                f"IoU ({winner['iou']:.4f}) bo'yicha bir nechta algoritm teng natija ko'rsatdi: "
                f"{winner['algorithm']}."
            )
        else:
            parts.append(
                f"Ground Truth mavjud. IoU bo'yicha eng yuqori overlap "
                f"{winner['algorithm']} algoritmida ({winner['iou']:.4f}). "
                f"F1={winner.get('f1_score', 0):.4f}, Dice={winner.get('dice_coefficient', 0):.4f}."
            )
    else:
        parts.append(
            "Ground Truth mavjud emas. Natijalar faqat heuristik kuzatuvlar; "
            "algoritm ustunligi ilmiy jihatdan isbotlanmagan."
        )

    fastest = min(metrics_rows, key=lambda x: x.get("runtime_ms") or 999999)
    if fastest.get("runtime_ms") is not None:
        parts.append(
            f"Eng qisqa runtime: {fastest['algorithm']} ({fastest['runtime_ms']} ms)."
        )

    return " ".join(parts)


def build_scientific_context(
    metrics_rows: list[dict[str, Any]],
    *,
    has_ground_truth: bool,
) -> dict[str, Any]:
    mode = get_evaluation_mode(has_ground_truth)
    winner = determine_winner(metrics_rows) if has_ground_truth else None
    warnings = detect_metric_inconsistencies(metrics_rows) if has_ground_truth else []
    summary = generate_data_driven_summary(
        metrics_rows,
        has_ground_truth=has_ground_truth,
        winner=winner,
    )

    return {
        "evaluation_mode": mode,
        "has_ground_truth": has_ground_truth,
        "winner": winner,
        "metric_warnings": warnings,
        "summary": summary,
        "winner_logic": {
            "criteria": ["iou", "f1_score", "dice_coefficient"],
            "fitness_participates": False,
            "declared_when": "has_ground_truth",
        },
        "metric_taxonomy": {
            "supervised": list(SUPERVISED_METRICS),
            "heuristic": list(HEURISTIC_METRICS),
        },
        "disclaimer": (
            None
            if has_ground_truth
            else (
                "These results are heuristic observations only. "
                "Algorithm superiority cannot be scientifically established without Ground Truth."
            )
        ),
    }
