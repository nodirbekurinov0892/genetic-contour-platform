"""Scientific statistical tests on real metric samples."""

from __future__ import annotations

from statistics import mean, stdev
from typing import Any

import numpy as np
from scipy import stats


def _clean(values: list[float | None]) -> list[float]:
    return [float(v) for v in values if v is not None]


def confidence_interval_95(values: list[float]) -> dict[str, float | None]:
    if len(values) < 2:
        m = mean(values) if values else None
        return {"lower": m, "upper": m, "mean": m}
    m = mean(values)
    sem = stdev(values) / (len(values) ** 0.5)
    margin = 1.96 * sem
    return {"lower": round(m - margin, 6), "upper": round(m + margin, 6), "mean": round(m, 6)}


def cohens_d(sample_a: list[float], sample_b: list[float]) -> float | None:
    if len(sample_a) < 2 or len(sample_b) < 2:
        return None
    pooled = np.sqrt(((len(sample_a) - 1) * np.var(sample_a, ddof=1) + (len(sample_b) - 1) * np.var(sample_b, ddof=1)) / (len(sample_a) + len(sample_b) - 2))
    if pooled == 0:
        return 0.0
    return round(float((mean(sample_a) - mean(sample_b)) / pooled), 4)


def wilcoxon_signed_rank(sample_a: list[float], sample_b: list[float]) -> dict[str, Any]:
    a, b = _clean(sample_a), _clean(sample_b)
    if len(a) != len(b) or len(a) < 2:
        return {"test": "wilcoxon", "statistic": None, "p_value": None, "significant_95": False}
    stat, p = stats.wilcoxon(a, b, alternative="two-sided")
    return {
        "test": "wilcoxon",
        "statistic": round(float(stat), 4),
        "p_value": round(float(p), 6),
        "significant_95": bool(p < 0.05),
    }


def mann_whitney_u(sample_a: list[float], sample_b: list[float]) -> dict[str, Any]:
    a, b = _clean(sample_a), _clean(sample_b)
    if len(a) < 2 or len(b) < 2:
        return {"test": "mann_whitney_u", "statistic": None, "p_value": None, "significant_95": False}
    stat, p = stats.mannwhitneyu(a, b, alternative="two-sided")
    return {
        "test": "mann_whitney_u",
        "statistic": round(float(stat), 4),
        "p_value": round(float(p), 6),
        "significant_95": bool(p < 0.05),
    }


def kruskal_wallis(*samples: list[float]) -> dict[str, Any]:
    cleaned = [_clean(s) for s in samples if _clean(s)]
    if len(cleaned) < 2 or any(len(s) < 2 for s in cleaned):
        return {"test": "kruskal_wallis", "statistic": None, "p_value": None, "significant_95": False}
    stat, p = stats.kruskal(*cleaned)
    return {
        "test": "kruskal_wallis",
        "statistic": round(float(stat), 4),
        "p_value": round(float(p), 6),
        "significant_95": bool(p < 0.05),
    }


def paired_t_test(sample_a: list[float], sample_b: list[float]) -> dict[str, Any]:
    a, b = _clean(sample_a), _clean(sample_b)
    if len(a) != len(b) or len(a) < 2:
        return {"test": "paired_t", "statistic": None, "p_value": None, "significant_95": False}
    stat, p = stats.ttest_rel(a, b)
    return {
        "test": "paired_t",
        "statistic": round(float(stat), 4),
        "p_value": round(float(p), 6),
        "significant_95": bool(p < 0.05),
    }


def summarize_distribution(values: list[float]) -> dict[str, Any]:
    vals = _clean(values)
    if not vals:
        return {"count": 0, "mean": None, "median": None, "std": None, "variance": None, "min": None, "max": None}
    return {
        "count": len(vals),
        "mean": round(mean(vals), 4),
        "median": round(float(np.median(vals)), 4),
        "std": round(stdev(vals), 4) if len(vals) > 1 else 0.0,
        "variance": round(float(np.var(vals)), 6) if len(vals) > 1 else 0.0,
        "min": round(min(vals), 4),
        "max": round(max(vals), 4),
        "confidence_interval_95": confidence_interval_95(vals),
    }


def histogram_bins(values: list[float], bins: int = 10) -> list[dict[str, float | int | str]]:
    vals = _clean(values)
    if not vals:
        return []
    counts, edges = np.histogram(vals, bins=bins)
    out: list[dict[str, float | int | str]] = []
    for i, count in enumerate(counts):
        out.append({
            "bin": f"{edges[i]:.3f}-{edges[i + 1]:.3f}",
            "min": round(float(edges[i]), 4),
            "max": round(float(edges[i + 1]), 4),
            "count": int(count),
        })
    return out


def significance_conclusion(
    algorithm_a: str,
    algorithm_b: str,
    test_result: dict[str, Any],
    metric: str = "IoU",
) -> str | None:
    p = test_result.get("p_value")
    if p is None:
        return None
    a_label = algorithm_a.replace("_", " ").title()
    b_label = algorithm_b.replace("_", " ").title()
    if p < 0.05:
        return f"{a_label} statistically differs from {b_label} on {metric} (p={p:.4f} < 0.05)"
    return f"No statistically significant difference between {a_label} and {b_label} on {metric} (p={p:.4f})"
