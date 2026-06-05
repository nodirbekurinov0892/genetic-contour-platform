"""Mutation operators for binary edge mask chromosomes."""

import random

import numpy as np

from app.core.genetic_algorithm.chromosome import Chromosome


def random_pixel_mutation(
    chromosome: Chromosome, mutation_rate: float = 0.05
) -> Chromosome:
    """Flip random pixels in the edge mask."""
    mutated = chromosome.copy()
    mask = np.random.random(chromosome.shape) < mutation_rate
    mutated.genes = np.where(mask, 1 - mutated.genes, mutated.genes)
    return mutated


def local_edge_mutation(
    chromosome: Chromosome, mutation_rate: float = 0.05
) -> Chromosome:
    """Shift edge pixels locally (small spatial perturbation)."""
    mutated = chromosome.copy()
    h, w = chromosome.shape
    edge_coords = np.argwhere(mutated.genes > 0)

    if len(edge_coords) == 0:
        return random_pixel_mutation(chromosome, mutation_rate)

    num_mutations = max(1, int(len(edge_coords) * mutation_rate))
    for _ in range(num_mutations):
        idx = random.randint(0, len(edge_coords) - 1)
        y, x = edge_coords[idx]
        dy, dx = random.randint(-1, 1), random.randint(-1, 1)
        ny, nx = np.clip(y + dy, 0, h - 1), np.clip(x + dx, 0, w - 1)
        mutated.genes[y, x] = 0
        mutated.genes[ny, nx] = 1

    return mutated
