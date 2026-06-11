"""Capture runtime environment metadata for reproducible experiments."""

from __future__ import annotations

import random
import sys
from datetime import datetime, timezone
from typing import Any

import cv2
import numpy as np


def capture_environment(
    *,
    seed: int | None = None,
    preprocessing_params: dict[str, Any] | None = None,
    algorithm_params: dict[str, Any] | None = None,
    image_dimensions: dict[str, int] | None = None,
    has_ground_truth: bool = False,
) -> dict[str, Any]:
    if seed is None:
        seed = random.randint(0, 2**31 - 1)

    random.seed(seed)
    np.random.seed(seed % (2**32))

    skimage_version = "n/a"
    try:
        import skimage  # noqa: WPS433

        skimage_version = skimage.__version__
    except ImportError:
        pass

    return {
        "random_seed": seed,
        "python_version": sys.version.split()[0],
        "opencv_version": cv2.__version__,
        "numpy_version": np.__version__,
        "skimage_version": skimage_version,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "platform_version": "1.0.0",
        "preprocessing_params": preprocessing_params or {},
        "algorithm_params": algorithm_params or {},
        "image_dimensions": image_dimensions or {},
        "has_ground_truth": has_ground_truth,
    }
