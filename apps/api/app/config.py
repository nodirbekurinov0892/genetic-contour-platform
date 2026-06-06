from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_SECRET_MARKERS = (
    "dev-secret-change-in-production",
    "change-me-to-a-random-64-char-string-in-production",
    "change-me",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database (required)
    database_url: str = ""

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_debug: bool = True
    secret_key: str = ""
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:3000"
    trusted_hosts: str = "localhost,127.0.0.1"
    api_public_url: str = "http://localhost:8000"

    # Observability (optional)
    sentry_dsn: str = ""
    sentry_environment: str = "production"
    sentry_traces_sample_rate: float = 0.1
    log_json: bool = False

    # Queue: "asyncio" = in-process background tasks (Render free tier);
    #         "celery" = Redis + Celery worker
    experiment_queue_backend: str = "asyncio"
    redis_url: str = "redis://localhost:6379/0"
    celery_task_always_eager: bool = False

    # Storage
    storage_backend: str = "local"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket_name: str = ""
    s3_region: str = "auto"
    s3_public_base_url: str = ""

    # Upload
    max_upload_size_mb: int = 10
    allowed_mime_types: str = "image/jpeg,image/png,image/webp"
    upload_dir: str = "uploads"
    results_dir: str = "results"

    # Rate limiting
    rate_limit_per_minute: int = 60

    # GA defaults
    ga_default_population_size: int = 50
    ga_default_generations: int = 30
    ga_default_mutation_rate: float = 0.05
    ga_default_crossover_rate: float = 0.7
    ga_default_elitism_count: int = 2

    @model_validator(mode="after")
    def validate_required_settings(self) -> "Settings":
        errors: list[str] = []

        if not self.database_url.strip():
            errors.append("DATABASE_URL is required")

        if not self.secret_key.strip():
            errors.append("SECRET_KEY is required")

        if not self.jwt_secret.strip():
            errors.append("JWT_SECRET is required")

        backend = self.storage_backend.strip().lower()
        if backend not in {"local", "s3"}:
            errors.append("STORAGE_BACKEND must be 'local' or 's3'")

        if backend == "s3":
            for field_name, value in [
                ("S3_BUCKET_NAME", self.s3_bucket_name),
                ("S3_ACCESS_KEY_ID", self.s3_access_key_id),
                ("S3_SECRET_ACCESS_KEY", self.s3_secret_access_key),
                ("S3_PUBLIC_BASE_URL", self.s3_public_base_url),
            ]:
                if not value.strip():
                    errors.append(f"{field_name} is required when STORAGE_BACKEND=s3")

        backend = self.experiment_queue_backend.strip().lower()
        if backend not in {"asyncio", "celery"}:
            errors.append("EXPERIMENT_QUEUE_BACKEND must be 'asyncio' or 'celery'")

        if self.uses_celery_queue and not self.celery_task_always_eager:
            if not self.redis_url.strip():
                errors.append("REDIS_URL is required when EXPERIMENT_QUEUE_BACKEND=celery")
            elif not self.redis_url.startswith(("redis://", "rediss://")):
                errors.append("REDIS_URL must start with redis:// or rediss://")

        if not self.api_debug:
            if self.secret_key.strip() in _INSECURE_SECRET_MARKERS:
                errors.append("SECRET_KEY must be a strong random value in production")
            if self.jwt_secret.strip() in _INSECURE_SECRET_MARKERS:
                errors.append("JWT_SECRET must be a strong random value in production")
            if self.secret_key == self.jwt_secret:
                errors.append("SECRET_KEY and JWT_SECRET must be different in production")
            if self.uses_celery_queue and not self.celery_task_always_eager and not self.redis_url.strip():
                errors.append("REDIS_URL is required in production when EXPERIMENT_QUEUE_BACKEND=celery")

        if errors:
            raise ValueError("; ".join(errors))

        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> list[str]:
        hosts = [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]
        return hosts or ["*"]

    @property
    def allowed_mime_list(self) -> list[str]:
        return [m.strip() for m in self.allowed_mime_types.split(",") if m.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def async_database_url(self) -> str:
        """Normalize DATABASE_URL for SQLAlchemy async engine."""
        url = self.database_url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        """Normalize DATABASE_URL for synchronous SQLAlchemy (Celery workers)."""
        url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    @property
    def uses_celery_queue(self) -> bool:
        return self.experiment_queue_backend.strip().lower() == "celery"

    @property
    def celery_broker_url(self) -> str:
        return self.redis_url

    @property
    def celery_result_backend(self) -> str:
        return self.redis_url

    def build_static_url(self, file_path: str) -> str:
        """Legacy local URL builder. Prefer storage public_url in new code."""
        normalized = file_path.replace("\\", "/").lstrip("/")
        if normalized.startswith("static/"):
            normalized = normalized[len("static/") :]
        return f"{self.api_public_url.rstrip('/')}/static/{normalized}"

    @property
    def use_local_static_files(self) -> bool:
        """Local /static serving is dev-only. Production uses S3/R2 public URLs."""
        return self.storage_backend.strip().lower() == "local" and self.api_debug

    @property
    def use_json_logs(self) -> bool:
        if self.log_json:
            return True
        return not self.api_debug

    @property
    def base_dir(self) -> Path:
        return Path(__file__).resolve().parent.parent

    @property
    def upload_path(self) -> Path:
        path = self.base_dir / self.upload_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def results_path(self) -> Path:
        path = self.base_dir / self.results_dir
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    return Settings()
