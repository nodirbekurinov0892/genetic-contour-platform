"""Scientific statistics core functions."""

from app.core.statistics import (
    cohens_d,
    confidence_interval_95,
    histogram_bins,
    kruskal_wallis,
    mann_whitney_u,
    paired_t_test,
    significance_conclusion,
    summarize_distribution,
    wilcoxon_signed_rank,
)


def test_summarize_distribution_basic():
    result = summarize_distribution([0.1, 0.2, 0.3, 0.4])
    assert result["count"] == 4
    assert result["mean"] == 0.25
    assert result["min"] == 0.1
    assert result["max"] == 0.4


def test_confidence_interval():
    ci = confidence_interval_95([0.5, 0.6, 0.7, 0.8])
    assert ci["lower"] is not None
    assert ci["upper"] is not None
    assert ci["lower"] <= ci["mean"] <= ci["upper"]


def test_wilcoxon_paired():
    a = [0.2, 0.3, 0.4, 0.5, 0.6]
    b = [0.1, 0.2, 0.3, 0.4, 0.5]
    result = wilcoxon_signed_rank(a, b)
    assert result["p_value"] is not None


def test_mann_whitney():
    result = mann_whitney_u([0.1, 0.2, 0.3, 0.4], [0.5, 0.6, 0.7, 0.8])
    assert result["p_value"] is not None


def test_kruskal_wallis_multi():
    result = kruskal_wallis([0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9])
    assert result["p_value"] is not None


def test_paired_t_test():
    result = paired_t_test([0.2, 0.3, 0.4, 0.5], [0.1, 0.2, 0.3, 0.4])
    assert result["p_value"] is not None


def test_effect_size():
    d = cohens_d([0.8, 0.9, 0.85], [0.4, 0.5, 0.45])
    assert d is not None


def test_histogram_bins():
    bins = histogram_bins([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], bins=3)
    assert len(bins) == 3
    assert sum(b["count"] for b in bins) == 9


def test_significance_conclusion_text():
    text = significance_conclusion("genetic", "sobel", {"p_value": 0.01})
    assert text is not None
    assert "0.01" in text
