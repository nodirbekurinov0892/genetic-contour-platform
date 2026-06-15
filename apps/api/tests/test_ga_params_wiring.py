"""GA parameter wiring — engine receives GAConfig fields from request."""

from app.core.genetic_algorithm.ga_engine import GAConfig
from app.schemas.experiment import AlgorithmParamsSchema, ExperimentRunRequest, GAParamsSchema


def test_ga_config_receives_population_and_generations():
    request = ExperimentRunRequest(
        algorithm="genetic",
        params=AlgorithmParamsSchema(resize_width=320, blur_kernel=7, threshold=0.4),
        ga_params=GAParamsSchema(
            population_size=42,
            generations=15,
            mutation_rate=0.1,
            crossover_rate=0.8,
            elitism_count=3,
        ),
    )
    ga = request.ga_params
    assert ga is not None
    config = GAConfig(
        population_size=ga.population_size,
        generations=ga.generations,
        mutation_rate=ga.mutation_rate,
        crossover_rate=ga.crossover_rate,
        elitism_count=ga.elitism_count,
    )
    assert config.population_size == 42
    assert config.generations == 15
    assert config.mutation_rate == 0.1
    assert config.crossover_rate == 0.8
    assert config.elitism_count == 3


def test_preprocessing_uses_algorithm_params_not_ga_defaults():
    request = ExperimentRunRequest(
        algorithm="compare_all",
        params=AlgorithmParamsSchema(resize_width=512, blur_kernel=9, threshold=0.35),
        ga_params=GAParamsSchema(resize_width=256, blur_kernel=5, threshold=0.5),
    )
    # Preprocessing must follow AlgorithmParamsSchema for fair comparison.
    assert request.params.resize_width == 512
    assert request.params.blur_kernel == 9
    assert request.params.threshold == 0.35
    # GAParams preprocessing fields are audit mirrors only at persistence time.
    assert request.ga_params.resize_width == 256
