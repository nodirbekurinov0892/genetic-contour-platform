import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://genetic_contour:genetic_contour_secret@localhost:5432/genetic_contour_test",
)
os.environ["SECRET_KEY"] = os.environ.get("SECRET_KEY", "test-secret-key-for-pytest-only-32chars")
os.environ["JWT_SECRET"] = os.environ.get("JWT_SECRET", "test-jwt-secret-for-pytest-only-32chars")
os.environ["API_DEBUG"] = "true"
os.environ["TRUSTED_HOSTS"] = os.environ.get("TRUSTED_HOSTS", "testserver,localhost,127.0.0.1")
os.environ["REDIS_URL"] = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
os.environ["EXPERIMENT_QUEUE_BACKEND"] = os.environ.get("EXPERIMENT_QUEUE_BACKEND", "asyncio")
os.environ["CELERY_TASK_ALWAYS_EAGER"] = os.environ.get("CELERY_TASK_ALWAYS_EAGER", "false")

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

settings = get_settings()
test_engine = create_async_engine(settings.async_database_url, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_database():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _isolate_test_data(prepare_database):
    """Truncate between tests — sync recovery tests commit outside the shared session."""
    table_names = ", ".join(
        f'"{table.name}"' for table in Base.metadata.sorted_tables
    )
    if table_names:
        async with test_engine.begin() as conn:
            await conn.execute(
                text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE")
            )
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture(autouse=True)
def _stub_celery_queue(monkeypatch):
    """Avoid real Redis/Celery during API tests; recovery is a no-op."""

    def fake_enqueue(experiment_id):
        return f"test-task-{experiment_id}"

    monkeypatch.setattr("app.jobs.queue.enqueue_experiment_run", fake_enqueue)
    monkeypatch.setattr(
        "app.services.experiment_service.enqueue_experiment_run",
        fake_enqueue,
    )
    monkeypatch.setattr(
        "app.jobs.recovery.run_startup_recovery",
        lambda: {"stale_running_reset": 0, "queued_re_enqueued": 0, "skipped": False},
    )
    async def _noop_startup_recovery_async():
        return {"stale_running_reset": 0, "queued_re_enqueued": 0, "skipped": False}

    monkeypatch.setattr(
        "app.jobs.recovery.run_startup_recovery_async",
        _noop_startup_recovery_async,
    )
    monkeypatch.setattr(
        "app.jobs.queue.revoke_experiment_task",
        lambda _task_id: None,
    )


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        async with TestSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()
