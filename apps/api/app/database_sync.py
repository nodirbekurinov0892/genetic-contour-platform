"""Synchronous SQLAlchemy session for Celery workers and job helpers."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

settings = get_settings()

sync_engine = create_engine(
    settings.sync_database_url,
    pool_pre_ping=True,
)

SyncSessionLocal = sessionmaker(bind=sync_engine, class_=Session, expire_on_commit=False)
