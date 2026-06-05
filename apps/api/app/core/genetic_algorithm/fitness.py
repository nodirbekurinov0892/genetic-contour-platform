"""Fitness function for contour detection chromosomes.

F = w1 * gradient_score + w2 * continuity_score + w3 * thinness_score - w4 * noise_penalty
"""

import cv2
import numpy as np

from app.core.genetic_algorithm.chromosome import Chromosome

# Fitness weights (tunable)
W_GRADIENT = 0.35
W_CONTINUITY = 0.30
W_THINNESS = 0.20
W_NOISE = 0.15


def _gradient_strength_score(mask: np.ndarray, gradient: np.ndarray) -> float:
    """Higher score when edges align with strong gradients."""
    edge_pixels = mask > 0
    if not np.any(edge_pixels):
        return 0.0
    alignment = gradient[edge_pixels]
    return float(np.mean(alignment))


def _continuity_score(mask: np.ndarray) -> float:
    """Measure contour continuity via connected components."""
    binary = (mask > 0).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num_labels <= 1:
        return 0.0

    # Penalize fragmentation; reward fewer, larger components
    areas = stats[1:, cv2.CC_STAT_AREA]
    total_edge = np.sum(binary)
    if total_edge == 0:
        return 0.0

    largest = float(np.max(areas)) / total_edge
    fragmentation = 1.0 - min(1.0, (num_labels - 1) / 50.0)
    return 0.6 * largest + 0.4 * fragmentation


def _thinness_score(mask: np.ndarray) -> float:
    """Reward thin edges (single-pixel width contours)."""
    binary = (mask > 0).astype(np.uint8) * 255
    if np.sum(binary) == 0:
        return 0.0

    # Skeleton approximation via morphological thinning proxy
    kernel = np.ones((3, 3), np.uint8)
    eroded = cv2.erode(binary, kernel, iterations=1)
    thin_ratio = np.sum(eroded > 0) / max(np.sum(binary > 0), 1)
    return float(min(1.0, thin_ratio * 2.0))


def _noise_penalty(mask: np.ndarray, gradient: np.ndarray) -> float:
    """Penalize isolated edge pixels in low-gradient regions."""
    binary = (mask > 0).astype(np.uint8)
    if np.sum(binary) == 0:
        return 0.0

    kernel = np.ones((3, 3), np.uint8)
    neighbor_count = cv2.filter2D(binary, -1, kernel, borderType=cv2.BORDER_CONSTANT)
    isolated = (binary > 0) & (neighbor_count <= 2) & (gradient < 0.2)
    noise_ratio = np.sum(isolated) / max(np.sum(binary), 1)
    return float(noise_ratio)


def compute_fitness(
    chromosome: Chromosome,
    gradient: np.ndarray,
    weights: tuple[float, float, float, float] | None = None,
) -> float:
    w1, w2, w3, w4 = weights or (W_GRADIENT, W_CONTINUITY, W_THINNESS, W_NOISE)
    mask = chromosome.genes.astype(np.uint8)

    grad_score = _gradient_strength_score(mask, gradient)
    cont_score = _continuity_score(mask)
    thin_score = _thinness_score(mask)
    noise = _noise_penalty(mask, gradient)

    fitness = w1 * grad_score + w2 * cont_score + w3 * thin_score - w4 * noise

    chromosome.fitness = fitness
    chromosome.fitness_components = {
        "gradient_score": grad_score,
        "continuity_score": cont_score,
        "thinness_score": thin_score,
        "noise_penalty": noise,
    }
    return fitness


def evaluate_population(
    chromosomes: list[Chromosome], gradient: np.ndarray
) -> None:
    for chrom in chromosomes:
        compute_fitness(chrom, gradient)
