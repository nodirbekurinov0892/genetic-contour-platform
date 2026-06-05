"""Real progress calculation from preprocessing steps and GA generations."""

EDGE_ALGORITHMS = ["sobel", "prewitt", "canny", "genetic"]


def resolve_algorithms(algorithm: str) -> list[str]:
    if algorithm == "compare_all":
        return list(EDGE_ALGORITHMS)
    return [algorithm]


def compute_total_steps(algorithms: list[str], ga_generations: int) -> int:
    """1 preprocessing step + 1 per classical algo + N GA generations."""
    steps = 1
    for algo in algorithms:
        if algo == "genetic":
            steps += max(ga_generations, 1)
        else:
            steps += 1
    return steps


class ExperimentProgressTracker:
    def __init__(self, algorithms: list[str], ga_generations: int):
        self.algorithms = algorithms
        self.ga_generations = max(ga_generations, 1)
        self.total_steps = compute_total_steps(algorithms, ga_generations)
        self._completed_steps = 0
        self._current_generation: int | None = None

    def complete_preprocessing(self) -> tuple[float, int | None]:
        self._completed_steps += 1
        self._current_generation = None
        return self._percent(), None

    def complete_classical_algorithm(self) -> tuple[float, int | None]:
        self._completed_steps += 1
        self._current_generation = None
        return self._percent(), None

    def record_ga_generation(self, generation: int) -> tuple[float, int]:
        """Call once per completed GA generation (0-indexed from GA engine)."""
        self._current_generation = generation + 1
        base = self._completed_steps
        ga_progress = (generation + 1) / self.ga_generations
        ga_steps_in_total = self.ga_generations
        effective = base + ga_progress * ga_steps_in_total
        percent = round(min(100.0, 100.0 * effective / self.total_steps), 2)
        return percent, self._current_generation

    def complete_ga(self) -> tuple[float, int | None]:
        self._completed_steps += self.ga_generations
        self._current_generation = None
        return self._percent(), None

    def _percent(self) -> float:
        return round(min(100.0, 100.0 * self._completed_steps / self.total_steps), 2)
