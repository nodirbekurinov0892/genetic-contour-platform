"""Population initialization and management."""

import numpy as np

from app.core.genetic_algorithm.chromosome import Chromosome


class Population:
    def __init__(self, chromosomes: list[Chromosome]):
        self.chromosomes = chromosomes

    @property
    def size(self) -> int:
        return len(self.chromosomes)

    @classmethod
    def initialize(
        cls,
        population_size: int,
        height: int,
        width: int,
        gradient: np.ndarray | None = None,
        seed_ratio: float = 0.3,
    ) -> "Population":
        chromosomes: list[Chromosome] = []
        seed_count = int(population_size * seed_ratio)

        for i in range(population_size):
            if i < seed_count and gradient is not None:
                threshold = 0.2 + (i / max(seed_count, 1)) * 0.4
                chrom = Chromosome.from_gradient_seed(gradient, threshold)
            else:
                chrom = Chromosome.random(height, width)
            chromosomes.append(chrom)

        return cls(chromosomes)

    def get_best(self) -> Chromosome:
        return max(self.chromosomes, key=lambda c: c.fitness)

    def get_average_fitness(self) -> float:
        if not self.chromosomes:
            return 0.0
        return float(np.mean([c.fitness for c in self.chromosomes]))

    def sort_by_fitness(self) -> None:
        self.chromosomes.sort(key=lambda c: c.fitness, reverse=True)
