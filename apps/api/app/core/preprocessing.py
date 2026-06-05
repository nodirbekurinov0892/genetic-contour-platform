"""Image preprocessing pipeline for contour detection."""

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class PreprocessConfig:
    resize_width: int = 256
    blur_kernel: int = 5
    threshold: float = 0.5


@dataclass
class PreprocessResult:
    original: np.ndarray
    grayscale: np.ndarray
    resized: np.ndarray
    blurred: np.ndarray
    gradient_magnitude: np.ndarray


def _ensure_odd_kernel(kernel: int) -> int:
    k = max(1, kernel)
    return k if k % 2 == 1 else k + 1


def load_image_from_bytes(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image")
    return image


def load_image_from_bytes(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image from bytes")
    return image


def load_image_from_path(path: str) -> np.ndarray:
    # cv2.imread fails on some Unicode paths on Windows — use fromfile + imdecode
    try:
        data = np.fromfile(path, dtype=np.uint8)
        image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    except OSError:
        image = cv2.imread(path, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Unable to load image from {path}")
    return image


def resize_keep_aspect(image: np.ndarray, target_width: int) -> np.ndarray:
    h, w = image.shape[:2]
    if w <= target_width:
        return image
    scale = target_width / w
    new_h = int(h * scale)
    return cv2.resize(image, (target_width, new_h), interpolation=cv2.INTER_AREA)


def to_grayscale(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def apply_gaussian_blur(grayscale: np.ndarray, kernel: int) -> np.ndarray:
    k = _ensure_odd_kernel(kernel)
    return cv2.GaussianBlur(grayscale, (k, k), 0)


def compute_gradient_magnitude(grayscale: np.ndarray) -> np.ndarray:
    gx = cv2.Sobel(grayscale, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(grayscale, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(gx**2 + gy**2)
    if magnitude.max() > 0:
        magnitude = magnitude / magnitude.max()
    return magnitude.astype(np.float32)


def preprocess(image: np.ndarray, config: PreprocessConfig) -> PreprocessResult:
    resized = resize_keep_aspect(image, config.resize_width)
    gray = to_grayscale(resized)
    blurred = apply_gaussian_blur(gray, config.blur_kernel)
    gradient = compute_gradient_magnitude(blurred)
    return PreprocessResult(
        original=image,
        grayscale=gray,
        resized=resized,
        blurred=blurred,
        gradient_magnitude=gradient,
    )
