"""Background experiment execution worker."""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import get_settings
from app.core.classical_algorithms import (
    canny_edge_detection,
    prewitt_edge_detection,
    sobel_edge_detection,
)
from app.core.evaluation import compute_metrics
from app.core.genetic_algorithm.ga_engine import GACancelled, GAConfig, GAEngine, GenerationRecord
from app.core.preprocessing import PreprocessConfig, load_image_from_bytes, preprocess
from app.core.visualization import create_overlay, gradient_to_uint8
from app.database import AsyncSessionLocal
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import ACTIVE_STATUSES, Experiment, ExperimentStatus
from app.models.ga_generation_history import GAGenerationHistory
from app.models.ga_parameters import GAParameters
from app.models.image import Image
from app.models.metric import Metric
from app.models.result_image import ResultImage, ResultImageType
from app.schemas.experiment import AlgorithmParamsSchema, ExperimentRunRequest, GAParamsSchema
from app.services.job_registry import clear_cancel, is_cancelled
from app.services.progress_tracker import ExperimentProgressTracker, resolve_algorithms
from app.services.storage import StorageService

logger = logging.getLogger(__name__)


async def _update_progress(session, experiment: Experiment, percent: float, current_generation: int | None) -> None:
    experiment.progress_percent = percent
    experiment.current_generation = current_generation
    await session.flush()


async def _mark_cancelled(session, experiment: Experiment) -> None:
    experiment.status = ExperimentStatus.CANCELLED.value
    experiment.finished_at = datetime.now(timezone.utc)
    experiment.current_generation = None
    clear_cancel(experiment.id)
    await session.commit()


async def _mark_failed(session, experiment: Experiment, message: str) -> None:
    experiment.status = ExperimentStatus.FAILED.value
    experiment.error_message = message[:2000]
    experiment.finished_at = datetime.now(timezone.utc)
    experiment.current_generation = None
    clear_cancel(experiment.id)
    await session.commit()


async def _mark_completed(session, experiment: Experiment) -> None:
    experiment.status = ExperimentStatus.COMPLETED.value
    experiment.progress_percent = 100.0
    experiment.current_generation = None
    experiment.completed_at = datetime.now(timezone.utc)
    experiment.finished_at = datetime.now(timezone.utc)
    experiment.error_message = None
    clear_cancel(experiment.id)
    await session.commit()


def _parse_run_request(job_params: dict) -> ExperimentRunRequest:
    return ExperimentRunRequest.model_validate(job_params)


async def _claim_experiment_for_run(session, experiment_id: uuid.UUID) -> Experiment | None:
    """Atomically claim a queued experiment (SELECT FOR UPDATE). Returns None if skipped."""
    result = await session.execute(
        select(Experiment).where(Experiment.id == experiment_id).with_for_update()
    )
    experiment = result.scalar_one_or_none()
    if not experiment:
        return None

    if experiment.cancel_requested:
        experiment.status = ExperimentStatus.CANCELLED.value
        experiment.finished_at = datetime.now(timezone.utc)
        experiment.current_generation = None
        experiment.cancel_requested = False
        await session.commit()
        return None

    if experiment.status != ExperimentStatus.QUEUED.value:
        await session.rollback()
        return None

    if not experiment.job_params:
        experiment.status = ExperimentStatus.FAILED.value
        experiment.error_message = "Missing job parameters"
        experiment.finished_at = datetime.now(timezone.utc)
        experiment.current_generation = None
        await session.commit()
        return None

    try:
        _parse_run_request(experiment.job_params)
    except Exception:
        experiment.status = ExperimentStatus.FAILED.value
        experiment.error_message = "Invalid job parameters"
        experiment.finished_at = datetime.now(timezone.utc)
        experiment.current_generation = None
        await session.commit()
        return None

    experiment.status = ExperimentStatus.RUNNING.value
    experiment.started_at = datetime.now(timezone.utc)
    experiment.progress_percent = 0.0
    experiment.current_generation = None
    experiment.error_message = None
    experiment.finished_at = None
    experiment.completed_at = None
    await session.commit()
    return experiment


async def run_experiment_job(experiment_id: uuid.UUID) -> None:
    settings = get_settings()

    async with AsyncSessionLocal() as session:
        claimed = await _claim_experiment_for_run(session, experiment_id)
        if claimed is None:
            return

    try:
        await _execute_job(experiment_id, settings)
    except Exception:
        logger.exception("Background job %s crashed", experiment_id)
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Experiment).where(Experiment.id == experiment_id))
            experiment = result.scalar_one_or_none()
            if experiment and experiment.status in ACTIVE_STATUSES:
                await _mark_failed(session, experiment, "Unexpected worker error")


async def _execute_job(experiment_id: uuid.UUID, settings) -> None:
    storage = StorageService(settings)

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Experiment).where(Experiment.id == experiment_id))
        experiment = result.scalar_one_or_none()
        if not experiment:
            return

        request = _parse_run_request(experiment.job_params or {})
        ga = request.ga_params or GAParamsSchema(
            population_size=settings.ga_default_population_size,
            generations=settings.ga_default_generations,
            mutation_rate=settings.ga_default_mutation_rate,
            crossover_rate=settings.ga_default_crossover_rate,
            elitism_count=settings.ga_default_elitism_count,
        )
        algorithms = resolve_algorithms(request.algorithm)
        tracker = ExperimentProgressTracker(algorithms, ga.generations)

        img_result = await session.execute(select(Image).where(Image.id == experiment.image_id))
        image = img_result.scalar_one_or_none()
        if not image:
            await _mark_failed(session, experiment, "Source image not found")
            return

        await _clear_previous_runs(session, experiment.id, storage)

        if is_cancelled(experiment_id):
            await _mark_cancelled(session, experiment)
            return

        try:
            image_key = storage.resolve_storage_key(
                storage_key=image.storage_key,
                file_path=image.file_path,
            )
            image_bytes = await asyncio.to_thread(storage.get_bytes, image_key)
            raw = await asyncio.to_thread(load_image_from_bytes, image_bytes)
            config = PreprocessConfig(
                resize_width=request.params.resize_width,
                blur_kernel=request.params.blur_kernel,
                threshold=request.params.threshold,
            )
            prep = await asyncio.to_thread(preprocess, raw, config)

            await _create_pipeline_run(
                session=session,
                storage=storage,
                experiment=experiment,
                prep=prep,
                source_storage_key=image.storage_key,
            )
            percent, gen = tracker.complete_preprocessing()
            await _update_progress(session, experiment, percent, gen)
            await session.commit()

            if is_cancelled(experiment_id):
                await _mark_cancelled(session, experiment)
                return

            for algo in algorithms:
                if is_cancelled(experiment_id):
                    await _mark_cancelled(session, experiment)
                    return

                if algo == "genetic":
                    await _run_genetic_algorithm(
                        session=session,
                        storage=storage,
                        experiment=experiment,
                        experiment_id=experiment_id,
                        prep=prep,
                        params=request.params,
                        ga=ga,
                        tracker=tracker,
                    )
                else:
                    await _run_classical_algorithm(
                        session=session,
                        storage=storage,
                        experiment=experiment,
                        algo=algo,
                        prep=prep,
                        params=request.params,
                    )
                    percent, gen = tracker.complete_classical_algorithm()
                    await _update_progress(session, experiment, percent, gen)
                    await session.commit()

            await _mark_completed(session, experiment)
        except JobCancelled:
            await _mark_cancelled(session, experiment)
        except Exception:
            logger.exception("Experiment %s failed in worker", experiment_id)
            await _mark_failed(session, experiment, "Experiment processing failed")


class JobCancelled(Exception):
    pass


async def _clear_previous_runs(session, experiment_id: uuid.UUID, storage: StorageService) -> None:
    from sqlalchemy import delete

    await session.execute(delete(AlgorithmRun).where(AlgorithmRun.experiment_id == experiment_id))
    await session.flush()
    await asyncio.to_thread(storage.delete_prefix, f"results/{experiment_id}")


async def _save_result_image(
    session,
    storage: StorageService,
    run: AlgorithmRun,
    experiment_id: uuid.UUID,
    image_type: str,
    array,
    filename: str,
) -> ResultImage:
    key = storage.result_key(str(experiment_id), str(run.id), filename)
    stored = await asyncio.to_thread(storage.save_image_array, key, array)
    result_image = ResultImage(
        algorithm_run_id=run.id,
        type=image_type,
        storage_key=stored.storage_key,
        public_url=stored.public_url,
        file_path=stored.storage_key,
    )
    session.add(result_image)
    return result_image


async def _create_pipeline_run(session, storage, experiment, prep, source_storage_key: str):
    run = AlgorithmRun(
        id=uuid.uuid4(),
        experiment_id=experiment.id,
        algorithm_name="pipeline",
        parameters_json={"stage": "preprocessing"},
        status="completed",
    )
    session.add(run)
    await session.flush()

    artifacts = [
        (ResultImageType.ORIGINAL.value, prep.resized, "original.png"),
        (ResultImageType.GRAYSCALE.value, prep.grayscale, "grayscale.png"),
        (ResultImageType.GRADIENT.value, gradient_to_uint8(prep.gradient_magnitude), "gradient.png"),
    ]

    for img_type, array, filename in artifacts:
        await _save_result_image(session, storage, run, experiment.id, img_type, array, filename)

    run.result_json = {"source_storage_key": source_storage_key}
    run.runtime_ms = 0
    await session.flush()


async def _run_classical_algorithm(session, storage, experiment, algo, prep, params):
    run = AlgorithmRun(
        id=uuid.uuid4(),
        experiment_id=experiment.id,
        algorithm_name=algo,
        parameters_json=params.model_dump(),
        status="running",
    )
    session.add(run)
    await session.flush()

    grayscale = prep.blurred
    gradient = prep.gradient_magnitude

    if algo == "sobel":
        result = await asyncio.to_thread(sobel_edge_detection, grayscale, params.threshold)
    elif algo == "prewitt":
        result = await asyncio.to_thread(prewitt_edge_detection, grayscale, params.threshold)
    elif algo == "canny":
        result = await asyncio.to_thread(
            canny_edge_detection, grayscale, params.canny_low, params.canny_high
        )
    else:
        raise ValueError(f"Unknown algorithm: {algo}")

    await _save_algorithm_outputs(
        session, storage, experiment, run, algo, result.edges, prep, gradient, None, result.runtime_ms
    )


async def _run_genetic_algorithm(
    session,
    storage: StorageService,
    experiment,
    experiment_id: uuid.UUID,
    prep,
    params,
    ga: GAParamsSchema,
    tracker: ExperimentProgressTracker,
):
    run = AlgorithmRun(
        id=uuid.uuid4(),
        experiment_id=experiment.id,
        algorithm_name="genetic",
        parameters_json=params.model_dump(),
        status="running",
    )
    session.add(run)
    await session.flush()

    gradient = prep.gradient_magnitude
    ga_config = GAConfig(
        population_size=ga.population_size,
        generations=ga.generations,
        mutation_rate=ga.mutation_rate,
        crossover_rate=ga.crossover_rate,
        elitism_count=ga.elitism_count,
    )
    session.add(
        GAParameters(
            algorithm_run_id=run.id,
            population_size=ga.population_size,
            generations=ga.generations,
            mutation_rate=ga.mutation_rate,
            crossover_rate=ga.crossover_rate,
            elitism_count=ga.elitism_count,
            threshold=ga.threshold,
            blur_kernel=ga.blur_kernel,
            resize_width=ga.resize_width,
        )
    )
    await session.flush()

    loop = asyncio.get_running_loop()

    async def _persist_ga_progress(percent: float, gen: int) -> None:
        async with AsyncSessionLocal() as progress_session:
            result = await progress_session.execute(
                select(Experiment).where(Experiment.id == experiment_id)
            )
            exp = result.scalar_one_or_none()
            if exp and exp.status == ExperimentStatus.RUNNING.value:
                exp.progress_percent = percent
                exp.current_generation = gen
                await progress_session.commit()

    def on_generation(record: GenerationRecord) -> None:
        percent, gen = tracker.record_ga_generation(record.generation)
        if is_cancelled(experiment_id):
            raise JobCancelled()
        future = asyncio.run_coroutine_threadsafe(_persist_ga_progress(percent, gen), loop)
        future.result(timeout=10)

    def should_cancel() -> bool:
        return is_cancelled(experiment_id)

    engine = GAEngine(ga_config)
    try:
        ga_result = await asyncio.to_thread(engine.run, gradient, on_generation, should_cancel)
    except (JobCancelled, GACancelled):
        raise JobCancelled() from None

    percent, gen = tracker.complete_ga()
    await _update_progress(session, experiment, percent, gen)
    await session.flush()

    edges = ga_result.best_mask
    fitness = ga_result.best_chromosome.fitness

    for rec in ga_result.generation_history:
        session.add(
            GAGenerationHistory(
                algorithm_run_id=run.id,
                generation=rec.generation,
                best_fitness=rec.best_fitness,
                average_fitness=rec.average_fitness,
                mutation_rate=rec.mutation_rate,
            )
        )

    await _save_result_image(
        session, storage, run, experiment.id, ResultImageType.MASK.value, edges, "mask.png"
    )

    run.result_json = {
        "best_fitness": fitness,
        "fitness_components": ga_result.best_chromosome.fitness_components,
        "generations": ga_config.generations,
        "population_size": ga_config.population_size,
    }

    await _save_algorithm_outputs(
        session,
        storage,
        experiment,
        run,
        "genetic",
        edges,
        prep,
        gradient,
        fitness,
        ga_result.runtime_ms,
    )
    await session.commit()


async def _save_algorithm_outputs(
    session,
    storage: StorageService,
    experiment: Experiment,
    run: AlgorithmRun,
    algo: str,
    edges,
    prep,
    gradient,
    fitness: float | None,
    runtime: float,
):
    edge_filename = "genetic.png" if algo == "genetic" else f"{algo}.png"
    await _save_result_image(session, storage, run, experiment.id, algo if algo != "genetic" else "ga", edges, edge_filename)

    overlay = await asyncio.to_thread(create_overlay, prep.resized, edges)
    await _save_result_image(
        session, storage, run, experiment.id, ResultImageType.OVERLAY.value, overlay, f"{algo}_overlay.png"
    )

    metrics_data = compute_metrics(edges, gradient, fitness, runtime)
    session.add(
        Metric(
            algorithm_run_id=run.id,
            edge_density=metrics_data["edge_density"],
            continuity_score=metrics_data["continuity_score"],
            noise_score=metrics_data["noise_score"],
            fitness_score=metrics_data["fitness_score"],
            runtime_ms=metrics_data["runtime_ms"],
        )
    )

    run.runtime_ms = int(runtime)
    run.status = "completed"
    await session.flush()
