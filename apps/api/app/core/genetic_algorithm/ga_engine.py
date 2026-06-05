"""Genetic Algorithm engine for contour detection."""

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from app.core.genetic_algorithm.chromosome import Chromosome
from app.core.genetic_algorithm.crossover import mask_based_crossover
from app.core.genetic_algorithm.fitness import evaluate_population
from app.core.genetic_algorithm.mutation import local_edge_mutation
from app.core.genetic_algorithm.population import Population
from app.core.genetic_algorithm.selection import tournament_selection

logger = logging.getLogger(__name__)


class GACancelled(RuntimeError):
    """Raised when GA execution is cancelled."""


@dataclass
class GAConfig:
    population_size: int = 50
    generations: int = 30
    mutation_rate: float = 0.05
    crossover_rate: float = 0.7
    elitism_count: int = 2
    tournament_size: int = 3


@dataclass
class GenerationRecord:
    generation: int
    best_fitness: float
    average_fitness: float
    mutation_rate: float


@dataclass
class GAResult:
    best_chromosome: Chromosome
    best_mask: np.ndarray
    generation_history: list[GenerationRecord] = field(default_factory=list)
    runtime_ms: float = 0.0
    final_generation: int = 0


class GAEngine:
    def __init__(self, config: GAConfig):
        self.config = config

    def run(
        self,
        gradient: np.ndarray,
        progress_callback: Callable[[GenerationRecord], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
    ) -> GAResult:
        start = time.perf_counter()
        h, w = gradient.shape

        population = Population.initialize(
            self.config.population_size, h, w, gradient=gradient
        )
        evaluate_population(population.chromosomes, gradient)
        history: list[GenerationRecord] = []

        for gen in range(self.config.generations):
            if should_cancel and should_cancel():
                raise GACancelled()

            population.sort_by_fitness()
            best = population.get_best()
            avg = population.get_average_fitness()

            record = GenerationRecord(
                generation=gen,
                best_fitness=best.fitness,
                average_fitness=avg,
                mutation_rate=self.config.mutation_rate,
            )
            history.append(record)

            if progress_callback:
                progress_callback(record)

            logger.debug(
                "Gen %d | best=%.4f avg=%.4f", gen, best.fitness, avg
            )

            # Elitism: preserve top individuals
            elites = [c.copy() for c in population.chromosomes[: self.config.elitism_count]]
            new_population: list[Chromosome] = list(elites)

            while len(new_population) < self.config.population_size:
                parent1 = tournament_selection(
                    population.chromosomes, self.config.tournament_size
                )
                parent2 = tournament_selection(
                    population.chromosomes, self.config.tournament_size
                )
                child1, child2 = mask_based_crossover(
                    parent1, parent2, self.config.crossover_rate
                )
                child1 = local_edge_mutation(child1, self.config.mutation_rate)
                child2 = local_edge_mutation(child2, self.config.mutation_rate)
                new_population.extend([child1, child2])

            population = Population(new_population[: self.config.population_size])
            evaluate_population(population.chromosomes, gradient)

        population.sort_by_fitness()
        best = population.get_best()
        runtime = (time.perf_counter() - start) * 1000

        return GAResult(
            best_chromosome=best,
            best_mask=best.to_binary_mask(),
            generation_history=history,
            runtime_ms=runtime,
            final_generation=self.config.generations,
        )
