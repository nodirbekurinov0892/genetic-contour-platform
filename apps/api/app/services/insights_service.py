"""Rule-based scientific insights from experiment metrics."""

from __future__ import annotations

from typing import Any

ALGO_LABELS = {
    "sobel": "Sobel",
    "prewitt": "Prewitt",
    "canny": "Canny",
    "genetic": "Genetik algoritm",
}


def _pct_delta(base: float | None, value: float | None) -> float | None:
    if base is None or value is None or base == 0:
        return None
    return ((value - base) / abs(base)) * 100


def generate_insights(metrics_rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not metrics_rows:
        return {
            "summary": "Tajriba metrikalari mavjud emas.",
            "strengths": [],
            "weaknesses": [],
            "comparisons": [],
        }

    by_key = {row["algorithm_key"]: row for row in metrics_rows if row.get("algorithm_key")}
    genetic = by_key.get("genetic")
    classical = [by_key[k] for k in ("sobel", "prewitt", "canny") if k in by_key]

    strengths: list[str] = []
    weaknesses: list[str] = []
    comparisons: list[str] = []

    def best_of(field: str) -> dict | None:
        ranked = [r for r in metrics_rows if r.get(field) is not None]
        if not ranked:
            return None
        if field == "noise_score":
            return min(ranked, key=lambda x: x[field])
        return max(ranked, key=lambda x: x[field])

    best_iou = best_of("iou")
    best_f1 = best_of("f1_score")
    best_continuity = best_of("continuity_score")
    lowest_noise = best_of("noise_score")

    if best_iou:
        strengths.append(
            f"IoU bo'yicha eng yaxshi natija {best_iou['algorithm']} algoritmida "
            f"({best_iou['iou']:.4f})."
        )
    if best_f1:
        strengths.append(
            f"F1 Score bo'yicha yetakchi {best_f1['algorithm']} "
            f"({best_f1['f1_score']:.4f})."
        )
    if best_continuity:
        strengths.append(
            f"Kontur uzluksizligi {best_continuity['algorithm']} da eng yuqori "
            f"({best_continuity['continuity_score']:.4f})."
        )

    if lowest_noise:
        strengths.append(
            f"Eng past shovqin darajasi {lowest_noise['algorithm']} da "
            f"({lowest_noise['noise_score']:.4f})."
        )

    slowest = max(
        (r for r in metrics_rows if r.get("runtime_ms") is not None),
        key=lambda x: x["runtime_ms"],
        default=None,
    )
    if slowest and slowest["runtime_ms"] and slowest["runtime_ms"] > 5000:
        weaknesses.append(
            f"{slowest['algorithm']} sekin ishladi ({slowest['runtime_ms']} ms)."
        )

    has_supervised = any(r.get("iou") is not None for r in metrics_rows)
    if not has_supervised:
        weaknesses.append(
            "Ground truth maska yo'q — Precision/Recall/IoU metrikalari hisoblanmagan."
        )

    if genetic:
        for key in ("sobel", "prewitt", "canny"):
            ref = by_key.get(key)
            if not ref:
                continue
            label = ALGO_LABELS[key]
            for metric, label_uz, higher_is_better in (
                ("continuity_score", "continuity", True),
                ("noise_score", "noise", False),
                ("iou", "IoU", True),
                ("f1_score", "F1", True),
            ):
                g_val = genetic.get(metric)
                r_val = ref.get(metric)
                if g_val is None or r_val is None:
                    continue
                delta = _pct_delta(r_val, g_val)
                if delta is None:
                    continue
                if higher_is_better and delta > 1:
                    comparisons.append(
                        f"Genetik algoritm {label} ga nisbatan {abs(delta):.1f}% yuqori "
                        f"{label_uz} ko'rsatdi."
                    )
                elif not higher_is_better and delta < -1:
                    comparisons.append(
                        f"Genetik algoritm {label} ga nisbatan {abs(delta):.1f}% past "
                        f"{label_uz} ko'rsatdi."
                    )

    summary_parts = [
        f"{len(metrics_rows)} ta algoritm tahlil qilindi.",
        *comparisons[:2],
    ]
    return {
        "summary": " ".join(summary_parts),
        "strengths": strengths,
        "weaknesses": weaknesses,
        "comparisons": comparisons,
    }
