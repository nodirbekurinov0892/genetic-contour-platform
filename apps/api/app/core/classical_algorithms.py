"""Classical edge detection algorithms: Sobel, Prewitt, Canny."""

from dataclasses import dataclass

import cv2
import numpy as np
from skimage.filters import prewitt


@dataclass
class ClassicalResult:
    edges: np.ndarray
    algorithm: str
    runtime_ms: float


def _normalize_edges(edges: np.ndarray) -> np.ndarray:
    edges = edges.astype(np.float32)
    if edges.max() > 0:
        edges = edges / edges.max()
    return edges


def _to_binary_uint8(edges: np.ndarray, threshold: float = 0.5) -> np.ndarray:
    normalized = _normalize_edges(edges)
    binary = (normalized >= threshold).astype(np.uint8) * 255
    return binary


def sobel_edge_detection(
    grayscale: np.ndarray, threshold: float = 0.5
) -> ClassicalResult:
    import time

    start = time.perf_counter()
    gx = cv2.Sobel(grayscale, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(grayscale, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(gx**2 + gy**2)
    edges = _to_binary_uint8(magnitude, threshold)
    runtime = (time.perf_counter() - start) * 1000
    return ClassicalResult(edges=edges, algorithm="sobel", runtime_ms=runtime)


def prewitt_edge_detection(
    grayscale: np.ndarray, threshold: float = 0.5
) -> ClassicalResult:
    import time

    start = time.perf_counter()
    response = prewitt(grayscale.astype(np.float64))
    edges = _to_binary_uint8(response, threshold)
    runtime = (time.perf_counter() - start) * 1000
    return ClassicalResult(edges=edges, algorithm="prewitt", runtime_ms=runtime)


def canny_edge_detection(
    grayscale: np.ndarray,
    low_threshold: float = 50.0,
    high_threshold: float = 150.0,
) -> ClassicalResult:
    import time

    start = time.perf_counter()
    edges = cv2.Canny(
        grayscale,
        threshold1=int(low_threshold),
        threshold2=int(high_threshold),
    )
    runtime = (time.perf_counter() - start) * 1000
    return ClassicalResult(edges=edges, algorithm="canny", runtime_ms=runtime)
