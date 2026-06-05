"""Selection operators for genetic algorithm."""

import random

from app.core.genetic_algorithm.chromosome import Chromosome


def tournament_selection(
    population: list[Chromosome],
    tournament_size: int = 3,
) -> Chromosome:
    """Select a chromosome via tournament selection."""
    contestants = random.sample(
        population, min(tournament_size, len(population))
    )
    return max(contestants, key=lambda c: c.fitness)
