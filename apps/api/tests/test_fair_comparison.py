"""Tests for Fair Comparison Protocol."""

import numpy as np

from app.core.fair_comparison import FAIR_PROTOCOL_V1, LEGACY_PROTOCOL, resolve_algorithm_input
from app.core.preprocessing import PreprocessConfig, preprocess


def _sample_image():
    return np.zeros((120, 160, 3), dtype=np.uint8)


def test_fair_v1_uses_gradient_for_classical():
    prep = preprocess(_sample_image(), PreprocessConfig(resize_width=128))
    inp = resolve_algorithm_input(prep, FAIR_PROTOCOL_V1)
    assert inp.protocol == FAIR_PROTOCOL_V1
    assert inp.classical_grayscale.dtype == np.uint8
    assert inp.classical_grayscale.shape == prep.gradient_magnitude.shape[:2]


def test_legacy_uses_blurred_for_classical():
    prep = preprocess(_sample_image(), PreprocessConfig(resize_width=128))
    inp = resolve_algorithm_input(prep, LEGACY_PROTOCOL)
    assert inp.protocol == LEGACY_PROTOCOL
    assert inp.classical_grayscale is prep.blurred
