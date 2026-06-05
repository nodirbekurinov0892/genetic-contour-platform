#!/usr/bin/env python3
"""Offline verification of GA pipeline (no database required).

Run from apps/api:
    python scripts/test_ga_pipeline.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np

from app.core.classical_algorithms import sobel_edge_detection
from app.core.genetic_algorithm.ga_engine import GAConfig, GAEngine
from app.core.preprocessing import PreprocessConfig, preprocess


def make_synthetic_image(size: int = 128) -> np.ndarray:
    """Create a simple synthetic image with a circle for contour detection."""
    import cv2

    img = np.zeros((size, size, 3), dtype=np.uint8)
    cv2.circle(img, (size // 2, size // 2), size // 4, (255, 255, 255), 2)
    return img


def main() -> None:
    print("=== GA Pipeline Verification ===\n")

    raw = make_synthetic_image()
    config = PreprocessConfig(resize_width=128, blur_kernel=5, threshold=0.5)
    prep = preprocess(raw, config)
    gradient = prep.gradient_magnitude

    print(f"Preprocessing OK — gradient shape: {gradient.shape}, max: {gradient.max():.4f}")

    sobel = sobel_edge_detection(prep.blurred, threshold=0.5)
    edge_density = np.sum(sobel.edges > 0) / sobel.edges.size
    print(f"Sobel OK — edge density: {edge_density:.4f}, runtime: {sobel.runtime_ms:.1f}ms")

    ga_config = GAConfig(population_size=30, generations=10, mutation_rate=0.05)
    engine = GAEngine(ga_config)
    result = engine.run(gradient)

    print(f"\nGA Engine OK:")
    print(f"  Population size: {ga_config.population_size}")
    print(f"  Generations: {len(result.generation_history)}")
    print(f"  Best fitness: {result.best_chromosome.fitness:.4f}")
    print(f"  Fitness components: {result.best_chromosome.fitness_components}")
    print(f"  Mask non-zero pixels: {np.sum(result.best_mask > 0)}")
    print(f"  Runtime: {result.runtime_ms:.1f}ms")

    if result.generation_history:
        first = result.generation_history[0]
        last = result.generation_history[-1]
        print(f"\n  Gen 0  — best: {first.best_fitness:.4f}, avg: {first.average_fitness:.4f}")
        print(f"  Gen {last.generation} — best: {last.best_fitness:.4f}, avg: {last.average_fitness:.4f}")

    assert len(result.generation_history) == ga_config.generations
    assert result.best_chromosome.fitness > 0
    assert np.sum(result.best_mask > 0) > 0

    print("\n✓ All GA pipeline checks passed.")


if __name__ == "__main__":
    main()
