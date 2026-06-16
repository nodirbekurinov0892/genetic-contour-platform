"""Global search across user-owned entities."""

from __future__ import annotations

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.benchmark import Benchmark
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.report import Report
from app.models.user import User

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic", "compare_all")


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(self, user: User, query: str, *, limit: int = 20) -> dict:
        q = query.strip()
        if len(q) < 2:
            return {"query": q, "experiments": [], "images": [], "benchmarks": [], "reports": [], "algorithms": []}

        pattern = f"%{q}%"
        user_id = user.id

        exp_rows = await self.db.execute(
            select(Experiment.id, Experiment.title, Experiment.status)
            .where(Experiment.user_id == user_id, Experiment.title.ilike(pattern))
            .order_by(Experiment.created_at.desc())
            .limit(limit)
        )
        img_rows = await self.db.execute(
            select(Image.id, Image.original_name)
            .where(Image.user_id == user_id, Image.original_name.ilike(pattern))
            .order_by(Image.created_at.desc())
            .limit(limit)
        )
        bench_rows = await self.db.execute(
            select(Benchmark.id, Benchmark.name, Benchmark.slug)
            .where(
                or_(Benchmark.name.ilike(pattern), Benchmark.slug.ilike(pattern)),
            )
            .order_by(Benchmark.created_at.desc())
            .limit(limit)
        )
        report_rows = await self.db.execute(
            select(Report.id, Report.experiment_id, Report.format)
            .join(Experiment, Report.experiment_id == Experiment.id)
            .where(Experiment.user_id == user_id)
            .order_by(Report.created_at.desc())
            .limit(limit)
        )

        algo_hits = [a for a in _EDGE_ALGORITHMS if q.lower() in a.lower()]

        return {
            "query": q,
            "experiments": [
                {"id": str(r[0]), "title": r[1], "status": r[2]} for r in exp_rows.all()
            ],
            "images": [{"id": str(r[0]), "name": r[1]} for r in img_rows.all()],
            "benchmarks": [
                {"id": str(r[0]), "name": r[1], "slug": r[2]} for r in bench_rows.all()
            ],
            "reports": [
                {"id": str(r[0]), "experiment_id": str(r[1]), "format": r[2]}
                for r in report_rows.all()
            ],
            "algorithms": algo_hits,
        }
