"""Fair Comparison Protocol — identical input space for all algorithms."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.preprocessing import PreprocessResult
from app.core.visualization import gradient_to_uint8

FAIR_PROTOCOL_V1 = "fair_v1"
LEGACY_PROTOCOL = "legacy"
DEFAULT_PROTOCOL = FAIR_PROTOCOL_V1
METHODOLOGY_VERSION = "2.0.0"

FAIR_V1_METHODOLOGY = {
    "protocol": FAIR_PROTOCOL_V1,
    "version": METHODOLOGY_VERSION,
    "input_space": "normalized_gradient_magnitude_uint8",
    "description": (
        "Fair protocol v1 uses a shared gradient-enhanced input space: all edge detectors "
        "(Sobel, Prewitt, Canny) receive the same normalized Sobel gradient magnitude (uint8), "
        "while GA operates on the matching float gradient [0,1]. This is intentional fair "
        "comparison — not textbook blurred-grayscale classical edge detection."
    ),
    "methodological_note": (
        "Classical detectors run on gradient-enhanced input, not raw blurred grayscale. "
        "Use comparison_protocol=legacy for blurred-grayscale classical inputs."
    ),
    "preprocessing": {
        "resize": "aspect-preserving width target",
        "grayscale": "BGR2GRAY",
        "blur": "Gaussian blur on grayscale",
        "gradient": "Sobel magnitude normalized to [0,1]",
        "classical_input": "gradient_to_uint8(gradient_magnitude)",
        "ga_input": "gradient_magnitude float32 [0,1]",
    },
    "threshold_policy": {
        "sobel_prewitt": "0-1 normalized magnitude threshold",
        "canny": "0-255 on uint8 gradient input",
        "ga": "chromosome threshold genes on gradient domain",
    },
}


@dataclass
class AlgorithmInput:
    classical_grayscale: np.ndarray
    ga_gradient: np.ndarray
    protocol: str
    metadata: dict[str, Any]


def resolve_protocol(protocol: str | None) -> str:
    if protocol in (None, "", LEGACY_PROTOCOL):
        return LEGACY_PROTOCOL
    if protocol == FAIR_PROTOCOL_V1:
        return FAIR_PROTOCOL_V1
    return protocol


def resolve_algorithm_input(
    prep: PreprocessResult,
    protocol: str | None,
) -> AlgorithmInput:
    resolved = resolve_protocol(protocol)
    if resolved == FAIR_PROTOCOL_V1:
        classical_input = gradient_to_uint8(prep.gradient_magnitude)
        return AlgorithmInput(
            classical_grayscale=classical_input,
            ga_gradient=prep.gradient_magnitude,
            protocol=FAIR_PROTOCOL_V1,
            metadata={
                "input_space": FAIR_V1_METHODOLOGY["input_space"],
                "classical_shape": list(classical_input.shape),
                "ga_shape": list(prep.gradient_magnitude.shape),
            },
        )
    return AlgorithmInput(
        classical_grayscale=prep.blurred,
        ga_gradient=prep.gradient_magnitude,
        protocol=LEGACY_PROTOCOL,
        metadata={
            "classical_input": "blurred_grayscale",
            "ga_input": "gradient_magnitude",
        },
    )
