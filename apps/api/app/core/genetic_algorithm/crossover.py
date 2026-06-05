"""Crossover operators for binary edge mask chromosomes."""

import random

import numpy as np

from app.core.genetic_algorithm.chromosome import Chromosome


def one_point_crossover(
    parent1: Chromosome, parent2: Chromosome, crossover_rate: float = 0.7
) -> tuple[Chromosome, Chromosome]:
    if random.random() > crossover_rate:
        return parent1.copy(), parent2.copy()

    h, w = parent1.shape
    flat1 = parent1.genes.flatten()
    flat2 = parent2.genes.flatten()
    point = random.randint(1, len(flat1) - 1)

    child1_genes = np.concatenate([flat1[:point], flat2[point:]])
    child2_genes = np.concatenate([flat2[:point], flat1[point:]])

    return (
        Chromosome(genes=child1_genes.reshape(h, w)),
        Chromosome(genes=child2_genes.reshape(h, w)),
    )


def mask_based_crossover(
    parent1: Chromosome, parent2: Chromosome, crossover_rate: float = 0.7
) -> tuple[Chromosome, Chromosome]:
    """Uniform mask crossover — each pixel inherited randomly from either parent."""
    if random.random() > crossover_rate:
        return parent1.copy(), parent2.copy()

    mask = np.random.random(parent1.shape) < 0.5
    child1_genes = np.where(mask, parent1.genes, parent2.genes)
    child2_genes = np.where(mask, parent2.genes, parent1.genes)

    return (
        Chromosome(genes=child1_genes.copy()),
        Chromosome(genes=child2_genes.copy()),
    )
