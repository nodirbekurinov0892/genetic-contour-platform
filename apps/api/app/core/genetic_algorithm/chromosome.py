"""Chromosome representation as binary edge mask."""

from dataclasses import dataclass, field

import numpy as np


@dataclass
class Chromosome:
    """Binary edge mask chromosome for contour detection."""

    genes: np.ndarray  # shape (H, W), dtype bool or uint8
    fitness: float = 0.0
    fitness_components: dict[str, float] = field(default_factory=dict)

    @property
    def shape(self) -> tuple[int, ...]:
        return self.genes.shape

    def copy(self) -> "Chromosome":
        return Chromosome(
            genes=self.genes.copy(),
            fitness=self.fitness,
            fitness_components=self.fitness_components.copy(),
        )

    def to_binary_mask(self) -> np.ndarray:
        return (self.genes > 0).astype(np.uint8) * 255

    @classmethod
    def random(cls, height: int, width: int, density: float = 0.15) -> "Chromosome":
        genes = np.random.random((height, width)) < density
        return cls(genes=genes.astype(np.uint8))

    @classmethod
    def from_gradient_seed(
        cls, gradient: np.ndarray, threshold: float = 0.3
    ) -> "Chromosome":
        genes = (gradient >= threshold).astype(np.uint8)
        return cls(genes=genes)
