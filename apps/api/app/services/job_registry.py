"""Cooperative job cancellation via DB flag (works across API/worker processes)."""

import uuid

from app.database_sync import SyncSessionLocal
from app.models.experiment import Experiment


def is_cancelled(experiment_id: uuid.UUID) -> bool:
    with SyncSessionLocal() as session:
        experiment = session.get(Experiment, experiment_id)
        return bool(experiment and experiment.cancel_requested)


def clear_cancel(experiment_id: uuid.UUID) -> None:
    with SyncSessionLocal() as session:
        experiment = session.get(Experiment, experiment_id)
        if experiment and experiment.cancel_requested:
            experiment.cancel_requested = False
            session.commit()


def set_cancel_requested(experiment_id: uuid.UUID) -> None:
    with SyncSessionLocal() as session:
        experiment = session.get(Experiment, experiment_id)
        if experiment:
            experiment.cancel_requested = True
            session.commit()
