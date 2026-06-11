"""Capture runtime environment metadata for reproducible experiments."""

from __future__ import annotations

import random
import sys

import cv2
import numpy as np


def capture_environment(*, seed: int | None = None) -> dict[str, str | int]:
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
    }
