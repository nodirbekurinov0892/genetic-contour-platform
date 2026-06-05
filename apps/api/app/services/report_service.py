"""Scientific report generation: PDF, CSV, enriched JSON."""

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from fastapi import HTTPException
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.report import Report
from app.models.result_image import ResultImage
from app.models.user import User
from app.services.storage import StorageService
from app.utils.ownership import ensure_owner

logger = logging.getLogger(__name__)

PROJECT_TITLE = "Genetic Contour Detection Platform"
PROJECT_SUBTITLE = (
    "Genetik algoritmlar asosida tasvirlardagi obyektlar konturlarini aniqlash"
)
EDGE_ALGORITHMS = ["sobel", "prewitt", "canny", "genetic"]
ALGO_LABELS = {
    "sobel": "Sobel",
    "prewitt": "Prewitt",
    "canny": "Canny",
    "genetic": "Genetik algoritm (GA)",
    "pipeline": "Preprocessing",
}


class ReportService:
    def __init__(
        self,
        db: AsyncSession,
        settings: Settings,
        storage: StorageService | None = None,
    ):
        self.db = db
        self.settings = settings
        self.storage = storage or StorageService(settings)

    async def _load_experiment(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        result = await self.db.execute(
            select(Experiment)
            .where(Experiment.id == experiment_id)
            .options(
                selectinload(Experiment.algorithm_runs).selectinload(
                    AlgorithmRun.result_images
                ),
                selectinload(Experiment.algorithm_runs).selectinload(
                    AlgorithmRun.metrics
                ),
                selectinload(Experiment.algorithm_runs).selectinload(
                    AlgorithmRun.generation_history
                ),
                selectinload(Experiment.algorithm_runs).selectinload(
                    AlgorithmRun.ga_parameters
                ),
            )
        )
        experiment = result.scalar_one_or_none()
        if not experiment:
            raise HTTPException(status_code=404, detail="Experiment not found")
        ensure_owner(experiment.user_id, user.id, "experiment")
        return experiment

    async def _load_image(self, image_id: uuid.UUID) -> Image:
        result = await self.db.execute(select(Image).where(Image.id == image_id))
        image = result.scalar_one_or_none()
        if not image:
            raise HTTPException(status_code=404, detail="Source image not found")
        return image

    def _find_image(self, run: AlgorithmRun | None, img_type: str) -> ResultImage | None:
        if not run:
            return None
        return next((ri for ri in run.result_images if ri.type == img_type), None)

    def _edge_type(self, algo: str) -> str:
        return "ga" if algo == "genetic" else algo

    def _load_result_image_bytes(self, result_image: ResultImage) -> bytes:
        key = self.storage.resolve_storage_key(
            storage_key=result_image.storage_key,
            file_path=result_image.file_path,
        )
        return self.storage.get_bytes(key)

    def _rl_image(
        self,
        result_image: ResultImage,
        width: float = 7 * cm,
        height: float = 5 * cm,
    ) -> RLImage | None:
        try:
            data = self._load_result_image_bytes(result_image)
            return RLImage(ImageReader(io.BytesIO(data)), width=width, height=height)
        except Exception:
            logger.warning(
                "Missing image for PDF: %s",
                result_image.storage_key or result_image.file_path,
            )
            return None

    async def build_report_data(self, experiment_id: uuid.UUID, user: User) -> dict[str, Any]:
        experiment = await self._load_experiment(experiment_id, user)
        image = await self._load_image(experiment.image_id)

        pipeline = next(
            (r for r in experiment.algorithm_runs if r.algorithm_name == "pipeline"),
            None,
        )
        edge_runs = [
            r
            for r in experiment.algorithm_runs
            if r.algorithm_name in EDGE_ALGORITHMS
        ]
        edge_runs.sort(key=lambda r: EDGE_ALGORITHMS.index(r.algorithm_name))
        ga_run = next((r for r in edge_runs if r.algorithm_name == "genetic"), None)

        metrics_rows = []
        for run in edge_runs:
            m = run.metrics[0] if run.metrics else None
            if not m:
                continue
            metrics_rows.append(
                {
                    "algorithm": ALGO_LABELS.get(run.algorithm_name, run.algorithm_name),
                    "algorithm_key": run.algorithm_name,
                    "edge_density": m.edge_density,
                    "continuity_score": m.continuity_score,
                    "noise_score": m.noise_score,
                    "fitness_score": m.fitness_score,
                    "runtime_ms": m.runtime_ms,
                }
            )

        conclusion = self._generate_conclusion(metrics_rows, ga_run)

        return {
            "meta": {
                "project_title": PROJECT_TITLE,
                "project_subtitle": PROJECT_SUBTITLE,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "report_version": "1.0",
            },
            "experiment": {
                "id": str(experiment.id),
                "title": experiment.title,
                "description": experiment.description,
                "status": experiment.status,
                "created_at": experiment.created_at.isoformat() if experiment.created_at else None,
                "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None,
            },
            "image": {
                "id": str(image.id),
                "original_name": image.original_name,
                "width": image.width,
                "height": image.height,
                "size_bytes": image.size,
                "mime_type": image.mime_type,
            },
            "parameters": {
                run.algorithm_name: run.parameters_json
                for run in edge_runs
                if run.parameters_json
            },
            "ga_parameters": (
                {
                    "population_size": ga_run.ga_parameters.population_size,
                    "generations": ga_run.ga_parameters.generations,
                    "mutation_rate": ga_run.ga_parameters.mutation_rate,
                    "crossover_rate": ga_run.ga_parameters.crossover_rate,
                    "elitism_count": ga_run.ga_parameters.elitism_count,
                }
                if ga_run and ga_run.ga_parameters
                else None
            ),
            "metrics": metrics_rows,
            "ga_result": (
                ga_run.result_json if ga_run and ga_run.result_json else None
            ),
            "generation_history": (
                [
                    {
                        "generation": g.generation,
                        "best_fitness": g.best_fitness,
                        "average_fitness": g.average_fitness,
                    }
                    for g in sorted(ga_run.generation_history, key=lambda x: x.generation)
                ]
                if ga_run
                else []
            ),
            "conclusion": conclusion,
            "pipeline_run_id": str(pipeline.id) if pipeline else None,
            "algorithm_run_ids": {r.algorithm_name: str(r.id) for r in edge_runs},
        }

    def _generate_conclusion(
        self, metrics_rows: list[dict], ga_run: AlgorithmRun | None
    ) -> str:
        if not metrics_rows:
            return (
                "Tajriba natijalari mavjud emas. Kontur aniqlash algoritmlarini "
                "taqqoslash uchun avval tajribani bajarish kerak."
            )

        best_continuity = max(metrics_rows, key=lambda x: x["continuity_score"] or 0)
        lowest_noise = min(metrics_rows, key=lambda x: x["noise_score"] or 1)
        fastest = min(metrics_rows, key=lambda x: x["runtime_ms"] or 999999)

        parts = [
            f"Ushbu tajribada {len(metrics_rows)} ta kontur aniqlash algoritmi "
            f"bir xil preprocessing pipeline asosida sinovdan o'tkazildi.",
            f"Kontur uzluksizligi (continuity) bo'yicha eng yaxshi natija "
            f"{best_continuity['algorithm']} algoritmida "
            f"({best_continuity['continuity_score']:.4f}) qayd etildi.",
            f"Shovqin darajasi (noise penalty) eng past "
            f"{lowest_noise['algorithm']} algoritmida "
            f"({lowest_noise['noise_score']:.4f}) bo'ldi.",
            f"Eng tez ishlash vaqti {fastest['algorithm']} algoritmida "
            f"({fastest['runtime_ms']} ms) kuzatildi.",
        ]

        if ga_run and ga_run.result_json:
            fitness = ga_run.result_json.get("best_fitness")
            components = ga_run.result_json.get("fitness_components", {})
            parts.append(
                f"Genetik algoritm ko'p mezonli fitness funksiyasi asosida "
                f"optimallashtirilgan kontur topdi (best fitness = {fitness:.4f}). "
                f"Fitness komponentlari: gradient={components.get('gradient_score', 0):.4f}, "
                f"continuity={components.get('continuity_score', 0):.4f}, "
                f"thinness={components.get('thinness_score', 0):.4f}, "
                f"noise_penalty={components.get('noise_penalty', 0):.4f}."
            )
            parts.append(
                "Klassik algoritmlar (Sobel, Prewitt, Canny) gradient asosida tez "
                "ishlaydi, biroq genetik algoritm kontur uzluksizligi, ingichkaligi "
                "va gradient mosligini bir vaqtda optimallashtirish imkonini beradi."
            )
        else:
            parts.append(
                "Klassik gradient asosidagi algoritmlar tez natija beradi, "
                "lekin ko'p mezonli optimallashtirish talab qilinadigan vazifalarda "
                "genetik algoritm qo'llash tavsiya etiladi."
            )

        return " ".join(parts)

    def build_csv(self, report_data: dict[str, Any]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["# Genetic Contour Detection Platform — Experiment Report"])
        writer.writerow(["Project", report_data["meta"]["project_title"]])
        writer.writerow(["Experiment ID", report_data["experiment"]["id"]])
        writer.writerow(["Title", report_data["experiment"]["title"]])
        writer.writerow(["Status", report_data["experiment"]["status"]])
        writer.writerow(["Image", report_data["image"]["original_name"]])
        writer.writerow(["Image Size", f"{report_data['image']['width']}x{report_data['image']['height']}"])
        writer.writerow(["Generated At", report_data["meta"]["generated_at"]])
        writer.writerow([])

        writer.writerow(["Algorithm", "Edge Density", "Continuity", "Noise", "Fitness", "Runtime (ms)"])
        for row in report_data["metrics"]:
            writer.writerow([
                row["algorithm"],
                f"{row['edge_density']:.6f}" if row["edge_density"] is not None else "",
                f"{row['continuity_score']:.6f}" if row["continuity_score"] is not None else "",
                f"{row['noise_score']:.6f}" if row["noise_score"] is not None else "",
                f"{row['fitness_score']:.6f}" if row["fitness_score"] is not None else "",
                row["runtime_ms"] or "",
            ])
        writer.writerow([])

        if report_data["generation_history"]:
            writer.writerow(["GA Generation History"])
            writer.writerow(["Generation", "Best Fitness", "Average Fitness"])
            for g in report_data["generation_history"]:
                writer.writerow([g["generation"], f"{g['best_fitness']:.6f}", f"{g['average_fitness']:.6f}"])
            writer.writerow([])

        writer.writerow(["Scientific Conclusion"])
        writer.writerow([report_data["conclusion"]])

        return output.getvalue()

    def _make_fitness_chart_bytes(self, history: list[dict]) -> bytes | None:
        if not history:
            return None
        gens = [h["generation"] for h in history]
        best = [h["best_fitness"] for h in history]
        avg = [h["average_fitness"] for h in history]

        fig, ax = plt.subplots(figsize=(7, 3.5), dpi=120)
        ax.plot(gens, best, "b-o", markersize=3, linewidth=1.5, label="Best Fitness")
        ax.plot(gens, avg, "gray", linestyle="--", linewidth=1, label="Average Fitness")
        ax.set_xlabel("Generation")
        ax.set_ylabel("Fitness Score")
        ax.set_title("GA Fitness Evolution")
        ax.legend(loc="lower right", fontsize=8)
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        return buf.getvalue()

    async def generate_pdf(self, experiment_id: uuid.UUID, user: User) -> bytes:
        experiment = await self._load_experiment(experiment_id, user)
        if experiment.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="PDF report is only available for completed experiments.",
            )

        report_data = await self.build_report_data(experiment_id, user)
        image = await self._load_image(experiment.image_id)

        pipeline = next(
            (r for r in experiment.algorithm_runs if r.algorithm_name == "pipeline"),
            None,
        )
        edge_runs = [r for r in experiment.algorithm_runs if r.algorithm_name in EDGE_ALGORITHMS]
        edge_runs.sort(key=lambda r: EDGE_ALGORITHMS.index(r.algorithm_name))

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Heading1"],
            fontSize=16,
            spaceAfter=6,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#1e3a5f"),
        )
        subtitle_style = ParagraphStyle(
            "Subtitle",
            parent=styles["Normal"],
            fontSize=10,
            spaceAfter=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#475569"),
        )
        heading_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontSize=12,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#1e40af"),
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            alignment=TA_JUSTIFY,
        )

        story: list = []
        story.append(Paragraph(PROJECT_TITLE, title_style))
        story.append(Paragraph(PROJECT_SUBTITLE, subtitle_style))
        story.append(Paragraph(
            f"Hisobot sanasi: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            subtitle_style,
        ))
        story.append(Spacer(1, 0.5 * cm))

        story.append(Paragraph("1. Tajriba ma'lumotlari", heading_style))
        info_data = [
            ["Tajriba nomi", experiment.title],
            ["Tajriba ID", str(experiment.id)],
            ["Holat", experiment.status],
            ["Rasm", image.original_name],
            ["O'lcham", f"{image.width} × {image.height} px"],
            ["Fayl hajmi", f"{image.size / 1024:.1f} KB"],
            ["MIME", image.mime_type],
        ]
        if experiment.completed_at:
            info_data.append(["Yakunlangan", experiment.completed_at.strftime("%Y-%m-%d %H:%M")])

        info_table = Table(info_data, colWidths=[5 * cm, 12 * cm])
        info_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.4 * cm))

        story.append(Paragraph("2. Preprocessing natijalari", heading_style))
        if pipeline:
            prep_cells: list = []
            for img_type, label in [
                ("original", "Original"),
                ("grayscale", "Grayscale"),
                ("gradient", "Gradient"),
            ]:
                ri = self._find_image(pipeline, img_type)
                if ri:
                    img = self._rl_image(ri, 4.5 * cm, 3.5 * cm)
                    if img:
                        prep_cells.append(
                            [Paragraph(f"<b>{label}</b>", styles["Normal"]), img]
                        )
            if prep_cells:
                story.append(Table(prep_cells, colWidths=[2.5 * cm, 5.5 * cm]))
        story.append(Spacer(1, 0.3 * cm))

        story.append(Paragraph("3. Algoritm natijalari", heading_style))
        for run in edge_runs:
            label = ALGO_LABELS.get(run.algorithm_name, run.algorithm_name)
            story.append(Paragraph(f"<b>{label}</b>", styles["Normal"]))
            edge_ri = self._find_image(run, self._edge_type(run.algorithm_name))
            overlay_ri = self._find_image(run, "overlay")
            row_imgs = []
            if edge_ri:
                img = self._rl_image(edge_ri, 6 * cm, 4.5 * cm)
                if img:
                    row_imgs.append([Paragraph("Kontur", styles["Normal"]), img])
            if overlay_ri:
                img = self._rl_image(overlay_ri, 6 * cm, 4.5 * cm)
                if img:
                    row_imgs.append([Paragraph("Overlay", styles["Normal"]), img])
            if row_imgs:
                story.append(Table(row_imgs, colWidths=[2 * cm, 7 * cm]))
            story.append(Spacer(1, 0.2 * cm))

        story.append(PageBreak())

        story.append(Paragraph("4. Metrikalar taqqoslash jadvali", heading_style))
        metrics_header = ["Algoritm", "Edge Density", "Continuity", "Noise", "Fitness", "Runtime (ms)"]
        metrics_data = [metrics_header]
        for row in report_data["metrics"]:
            metrics_data.append([
                row["algorithm"],
                f"{row['edge_density']:.4f}" if row["edge_density"] is not None else "—",
                f"{row['continuity_score']:.4f}" if row["continuity_score"] is not None else "—",
                f"{row['noise_score']:.4f}" if row["noise_score"] is not None else "—",
                f"{row['fitness_score']:.4f}" if row["fitness_score"] is not None else "—",
                str(row["runtime_ms"] or "—"),
            ])
        mt = Table(metrics_data, colWidths=[3.5 * cm, 2.5 * cm, 2.5 * cm, 2 * cm, 2.5 * cm, 2.5 * cm])
        mt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ALIGN", (1, 1), (-1, -1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(mt)
        story.append(Spacer(1, 0.5 * cm))

        if report_data["generation_history"]:
            story.append(Paragraph("5. GA Fitness Evolution", heading_style))
            chart_bytes = self._make_fitness_chart_bytes(report_data["generation_history"])
            if chart_bytes:
                story.append(RLImage(ImageReader(io.BytesIO(chart_bytes)), width=14 * cm, height=7 * cm))
            story.append(Spacer(1, 0.4 * cm))

        story.append(Paragraph("6. Ilmiy xulosa", heading_style))
        story.append(Paragraph(report_data["conclusion"], body_style))

        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=A4,
            rightMargin=1.5 * cm,
            leftMargin=1.5 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.5 * cm,
        )
        doc.build(story)
        pdf_bytes = pdf_buffer.getvalue()

        storage_key = self.storage.report_key(str(experiment_id))
        stored = self.storage.save_bytes(storage_key, pdf_bytes, "application/pdf")
        self.db.add(
            Report(
                experiment_id=experiment_id,
                user_id=user.id,
                format="pdf",
                storage_key=stored.storage_key,
                public_url=stored.public_url,
                file_path=stored.storage_key,
            )
        )
        await self.db.flush()

        logger.info("PDF report generated: %s", stored.storage_key)
        return pdf_bytes
