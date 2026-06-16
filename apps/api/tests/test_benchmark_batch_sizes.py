"""Benchmark batch size validation."""

ENTERPRISE_BATCH_SIZES = (10, 50, 100, 500, 1000)


def test_batch_sizes_include_enterprise_tiers():
    assert 500 in ENTERPRISE_BATCH_SIZES
    assert len(ENTERPRISE_BATCH_SIZES) == 5
