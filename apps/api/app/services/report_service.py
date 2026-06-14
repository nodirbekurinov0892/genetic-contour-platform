"""Scientific report generation: PDF, CSV, enriched JSON."""

import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from fastapi import HTTPException
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
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
from app.core.platform import PLATFORM_NAME, PLATFORM_SUBTITLE
from app.core.scientific_evaluation import build_scientific_context
from app.utils.ownership import ensure_owner

logger = logging.getLogger(__name__)

PROJECT_TITLE = PLATFORM_NAME
PROJECT_SUBTITLE = PLATFORM_SUBTITLE
EDGE_ALGORITHMS = ["sobel", "prewitt", "canny", "genetic"]
ALGO_LABELS = {
    "sobel": "Sobel",
    "prewitt": "Prewitt",
    "canny": "Canny",
    "genetic": "Genetic Algorithm (GA)",
    "pipeline": "Preprocessing",
}
_MISSING_IMAGE_LABEL = "Rasm mavjud emas"
_UNICODE_REPLACEMENTS = (
    ("\u2014", "-"),  # em dash
    ("\u2013", "-"),  # en dash
    ("\u00d7", "x"),  # multiplication sign
    ("\u2018", "'"),  # left single quote
    ("\u2019", "'"),  # right single quote
    ("\u201c", '"'),  # left double quote
    ("\u201d", '"'),  # right double quote
)


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

    def _load_storage_bytes(
        self,
        *,
        storage_key: str | None,
        file_path: str | None,
    ) -> bytes:
        key = self.storage.resolve_storage_key(
            storage_key=storage_key,
            file_path=file_path,
        )
        return self.storage.get_bytes(key)

    def _load_result_image_bytes(self, result_image: ResultImage) -> bytes:
        return self._load_storage_bytes(
            storage_key=result_image.storage_key,
            file_path=result_image.file_path,
        )

    @staticmethod
    def _sanitize_pdf_text(text: str) -> str:
        normalized = text
        for source, replacement in _UNICODE_REPLACEMENTS:
            normalized = normalized.replace(source, replacement)
        return normalized

    def _pdf_paragraph(self, text: str, style: ParagraphStyle) -> Paragraph:
        safe = escape(self._sanitize_pdf_text(text))
        return Paragraph(safe, style)

    def _missing_image_paragraph(self, style: ParagraphStyle) -> Paragraph:
        return self._pdf_paragraph(_MISSING_IMAGE_LABEL, style)

    def _rl_image_from_bytes(
        self,
        data: bytes,
        width: float = 7 * cm,
        height: float = 5 * cm,
    ) -> RLImage | None:
        try:
            buffer = io.BytesIO(data)
            buffer.seek(0)
            return RLImage(buffer, width=width, height=height)
        except Exception as exc:
            logger.warning("Failed to embed image bytes in PDF: %s", exc)
            return None

    def _rl_image(
        self,
        result_image: ResultImage,
        width: float = 7 * cm,
        height: float = 5 * cm,
    ) -> RLImage | None:
        try:
            data = self._load_result_image_bytes(result_image)
            return self._rl_image_from_bytes(data, width=width, height=height)
        except Exception as exc:
            logger.warning(
                "Missing image for PDF (%s): %s - %s",
                result_image.type,
                result_image.storage_key or result_image.file_path,
                exc,
            )
            return None

    def _rl_image_or_placeholder(
        self,
        result_image: ResultImage | None,
        styles: dict,
        width: float = 7 * cm,
        height: float = 5 * cm,
    ):
        if not result_image:
            return self._missing_image_paragraph(styles["Normal"])
        image = self._rl_image(result_image, width=width, height=height)
        return image or self._missing_image_paragraph(styles["Normal"])

    def _rl_image_from_storage_or_placeholder(
        self,
        *,
        storage_key: str | None,
        file_path: str | None,
        styles: dict,
        width: float = 7 * cm,
        height: float = 5 * cm,
    ):
        try:
            data = self._load_storage_bytes(storage_key=storage_key, file_path=file_path)
            image = self._rl_image_from_bytes(data, width=width, height=height)
            return image or self._missing_image_paragraph(styles["Normal"])
        except Exception as exc:
            logger.warning(
                "Missing storage image for PDF: %s - %s",
                storage_key or file_path,
                exc,
            )
            return self._missing_image_paragraph(styles["Normal"])

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
                    "precision": m.precision,
                    "recall": m.recall,
                    "f1_score": m.f1_score,
                    "iou": m.iou,
                    "dice_coefficient": m.dice_coefficient,
                    "runtime_ms": m.runtime_ms,
                }
            )

        scientific = build_scientific_context(metrics_rows)
        conclusion = scientific["summary"]

        return {
            "meta": {
                "project_title": PROJECT_TITLE,
                "project_subtitle": PROJECT_SUBTITLE,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "report_version": "2.0",
            },
            "experiment": {
                "id": str(experiment.id),
                "title": experiment.title,
                "description": experiment.description,
                "status": experiment.status,
                "created_at": experiment.created_at.isoformat() if experiment.created_at else None,
                "completed_at": experiment.completed_at.isoformat() if experiment.completed_at else None,
                "reproducibility": experiment.reproducibility_json,
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
            "scientific_evaluation": scientific,
            "pipeline_run_id": str(pipeline.id) if pipeline else None,
            "algorithm_run_ids": {r.algorithm_name: str(r.id) for r in edge_runs},
        }

    def build_csv(self, report_data: dict[str, Any]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([f"# {PLATFORM_NAME} — Experiment Report"])
        writer.writerow(["Project", report_data["meta"]["project_title"]])
        writer.writerow(["Experiment ID", report_data["experiment"]["id"]])
        writer.writerow(["Title", report_data["experiment"]["title"]])
        writer.writerow(["Status", report_data["experiment"]["status"]])
        writer.writerow(["Image", report_data["image"]["original_name"]])
        writer.writerow(["Image Size", f"{report_data['image']['width']}x{report_data['image']['height']}"])
        writer.writerow(["Generated At", report_data["meta"]["generated_at"]])
        writer.writerow([])

        sci = report_data.get("scientific_evaluation", {})
        writer.writerow(["Evaluation Mode", sci.get("evaluation_mode", "")])
        writer.writerow(["Has Ground Truth", sci.get("has_ground_truth", False)])
        winner = sci.get("winner")
        if winner:
            writer.writerow(["Winner (IoU/F1/Dice)", winner.get("algorithm", "")])
            writer.writerow(["Winner IoU", winner.get("iou", "")])
        else:
            writer.writerow(["Winner", "None (no Ground Truth or no supervised metrics)"])
        if sci.get("disclaimer"):
            writer.writerow(["Disclaimer", sci["disclaimer"]])
        writer.writerow([])

        has_supervised = sci.get("has_ground_truth") and any(
            row.get("iou") is not None for row in report_data["metrics"]
        )
        if has_supervised:
            writer.writerow([
                "Algorithm", "IoU", "F1", "Precision", "Recall", "Dice",
                "Continuity", "Noise", "Edge Density", "GA Internal Fitness", "Runtime (ms)",
            ])
            for row in report_data["metrics"]:
                writer.writerow([
                    row["algorithm"],
                    f"{row['iou']:.6f}" if row.get("iou") is not None else "",
                    f"{row['f1_score']:.6f}" if row.get("f1_score") is not None else "",
                    f"{row['precision']:.6f}" if row.get("precision") is not None else "",
                    f"{row['recall']:.6f}" if row.get("recall") is not None else "",
                    f"{row['dice_coefficient']:.6f}" if row.get("dice_coefficient") is not None else "",
                    f"{row['continuity_score']:.6f}" if row["continuity_score"] is not None else "",
                    f"{row['noise_score']:.6f}" if row["noise_score"] is not None else "",
                    f"{row['edge_density']:.6f}" if row["edge_density"] is not None else "",
                    f"{row['fitness_score']:.6f}" if row["fitness_score"] is not None else "",
                    row["runtime_ms"] or "",
                ])
        else:
            writer.writerow([
                "Algorithm", "Edge Density", "Continuity", "Noise",
                "GA Internal Fitness", "Runtime (ms)",
            ])
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
            writer.writerow(["GA Internal Optimization — Generation History"])
            writer.writerow(["Generation", "Best Fitness", "Average Fitness"])
            for g in report_data["generation_history"]:
                writer.writerow([g["generation"], f"{g['best_fitness']:.6f}", f"{g['average_fitness']:.6f}"])
            writer.writerow([])

        warnings = sci.get("metric_warnings") or []
        if warnings:
            writer.writerow(["Metric Inconsistency Warnings"])
            for w in warnings:
                writer.writerow([w.get("message", "")])
            writer.writerow([])

        writer.writerow(["Data-Driven Summary"])
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
            ["Tajriba nomi", self._sanitize_pdf_text(experiment.title)],
            ["Tajriba ID", str(experiment.id)],
            ["Holat", experiment.status],
            ["Rasm", self._sanitize_pdf_text(image.original_name)],
            ["O'lcham", f"{image.width} x {image.height} px"],
            ["Fayl hajmi", f"{image.size / 1024:.1f} KB"],
            ["MIME", image.mime_type],
        ]
        if experiment.completed_at:
            info_data.append(["Yakunlangan", experiment.completed_at.strftime("%Y-%m-%d %H:%M")])
        sci = report_data.get("scientific_evaluation", {})
        info_data.append([
            "Evaluation mode",
            "Supervised" if sci.get("evaluation_mode") == "supervised" else "Heuristic",
        ])
        info_data.append(["Ground Truth", "Mavjud" if sci.get("has_ground_truth") else "Yo'q"])
        if experiment.reproducibility_json:
            repro = experiment.reproducibility_json
            info_data.append(["Random seed", str(repro.get("random_seed", "-"))])
            info_data.append(["Captured at", str(repro.get("captured_at", "-"))])
            info_data.append(["Python", str(repro.get("python_version", "-"))])
            info_data.append(["OpenCV", str(repro.get("opencv_version", "-"))])
            info_data.append(["NumPy", str(repro.get("numpy_version", "-"))])
            info_data.append(["scikit-image", str(repro.get("skimage_version", "-"))])
            info_data.append(["Platform version", str(repro.get("platform_version", "-"))])
            prep = repro.get("preprocessing_params") or {}
            if prep:
                info_data.append(["Preprocessing", str(prep)])
            algo = repro.get("algorithm_params") or {}
            if algo:
                info_data.append(["Algorithm params", str(algo)])

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
        prep_cells: list = [
            [
                Paragraph("<b>Asl yuklangan</b>", styles["Normal"]),
                self._rl_image_from_storage_or_placeholder(
                    storage_key=image.storage_key,
                    file_path=image.file_path,
                    styles=styles,
                    width=4.5 * cm,
                    height=3.5 * cm,
                ),
            ],
        ]

        if pipeline:
            for img_type, label in [
                ("original", "O'lcham o'zgartirilgan"),
                ("grayscale", "Kulrang"),
                ("gradient", "Gradient"),
            ]:
                ri = self._find_image(pipeline, img_type)
                prep_cells.append(
                    [
                        Paragraph(f"<b>{label}</b>", styles["Normal"]),
                        self._rl_image_or_placeholder(
                            ri,
                            styles,
                            width=4.5 * cm,
                            height=3.5 * cm,
                        ),
                    ]
                )
        story.append(Table(prep_cells, colWidths=[2.5 * cm, 5.5 * cm]))
        story.append(Spacer(1, 0.3 * cm))

        story.append(Paragraph("3. Algoritm natijalari", heading_style))
        for run in edge_runs:
            label = ALGO_LABELS.get(run.algorithm_name, run.algorithm_name)
            story.append(Paragraph(f"<b>{label}</b>", styles["Normal"]))
            edge_ri = self._find_image(run, self._edge_type(run.algorithm_name))
            overlay_ri = self._find_image(run, "overlay")
            mask_ri = (
                self._find_image(run, "mask")
                if run.algorithm_name == "genetic"
                else None
            )
            row_imgs = [
                [
                    Paragraph("Kontur", styles["Normal"]),
                    self._rl_image_or_placeholder(edge_ri, styles, 6 * cm, 4.5 * cm),
                ],
            ]
            if run.algorithm_name == "genetic":
                row_imgs.append(
                    [
                        Paragraph("Binar maska", styles["Normal"]),
                        self._rl_image_or_placeholder(mask_ri, styles, 6 * cm, 4.5 * cm),
                    ]
                )
            row_imgs.append(
                [
                    Paragraph("Overlay", styles["Normal"]),
                    self._rl_image_or_placeholder(overlay_ri, styles, 6 * cm, 4.5 * cm),
                ]
            )
            story.append(Table(row_imgs, colWidths=[2 * cm, 7 * cm]))
            story.append(Spacer(1, 0.2 * cm))

        story.append(PageBreak())

        story.append(Paragraph("4. Metrikalar taqqoslash jadvali", heading_style))

        if sci.get("disclaimer"):
            story.append(Paragraph(
                f"<b>Ogohlantirish:</b> {self._sanitize_pdf_text(sci['disclaimer'])}",
                body_style,
            ))
            story.append(Spacer(1, 0.2 * cm))

        winner = sci.get("winner")
        if winner:
            story.append(Paragraph(
                f"<b>Supervised g'olib (IoU/F1/Dice):</b> "
                f"{self._sanitize_pdf_text(winner['algorithm'])} "
                f"(IoU={winner.get('iou', 0):.4f}, F1={winner.get('f1_score', 0):.4f}, "
                f"Dice={winner.get('dice_coefficient', 0):.4f}).",
                body_style,
            ))
            story.append(Spacer(1, 0.2 * cm))
        elif sci.get("evaluation_mode") == "heuristic":
            story.append(Paragraph(
                "<b>G'olib:</b> Aniqlanmagan — Ground Truth mavjud emas.",
                body_style,
            ))
            story.append(Spacer(1, 0.2 * cm))

        has_supervised = sci.get("has_ground_truth") and any(
            row.get("iou") is not None for row in report_data["metrics"]
        )
        if has_supervised:
            story.append(Paragraph("<b>Supervised metrikalar</b>", styles["Normal"]))
            metrics_header = [
                "Algoritm", "IoU", "F1", "Precision", "Recall", "Dice",
            ]
        else:
            story.append(Paragraph("<b>Heuristik metrikalar</b>", styles["Normal"]))
            metrics_header = [
                "Algoritm", "Edge Density", "Continuity", "Noise",
                "GA Ichki Fitness", "Runtime (ms)",
            ]
        metrics_data = [metrics_header]
        for row in report_data["metrics"]:
            if has_supervised:
                metrics_data.append([
                    row["algorithm"],
                    f"{row['iou']:.4f}" if row.get("iou") is not None else "-",
                    f"{row['f1_score']:.4f}" if row.get("f1_score") is not None else "-",
                    f"{row['precision']:.4f}" if row.get("precision") is not None else "-",
                    f"{row['recall']:.4f}" if row.get("recall") is not None else "-",
                    f"{row['dice_coefficient']:.4f}" if row.get("dice_coefficient") is not None else "-",
                ])
            else:
                metrics_data.append([
                    row["algorithm"],
                    f"{row['edge_density']:.4f}" if row["edge_density"] is not None else "-",
                    f"{row['continuity_score']:.4f}" if row["continuity_score"] is not None else "-",
                    f"{row['noise_score']:.4f}" if row["noise_score"] is not None else "-",
                    f"{row['fitness_score']:.4f}" if row["fitness_score"] is not None else "-",
                    str(row["runtime_ms"] or "-"),
                ])

        col_width = 16 * cm / len(metrics_header)
        mt = Table(metrics_data, colWidths=[col_width] * len(metrics_header))
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
        story.append(Spacer(1, 0.3 * cm))

        if has_supervised:
            story.append(Paragraph("<b>Heuristik metrikalar (qo'shimcha)</b>", styles["Normal"]))
            heuristic_header = [
                "Algoritm", "Continuity", "Noise", "Edge Density",
                "GA Ichki Fitness", "Runtime (ms)",
            ]
            heuristic_data = [heuristic_header]
            for row in report_data["metrics"]:
                heuristic_data.append([
                    row["algorithm"],
                    f"{row['continuity_score']:.4f}" if row["continuity_score"] is not None else "-",
                    f"{row['noise_score']:.4f}" if row["noise_score"] is not None else "-",
                    f"{row['edge_density']:.4f}" if row["edge_density"] is not None else "-",
                    f"{row['fitness_score']:.4f}" if row["fitness_score"] is not None else "-",
                    str(row["runtime_ms"] or "-"),
                ])
            col_w2 = 16 * cm / len(heuristic_header)
            ht = Table(heuristic_data, colWidths=[col_w2] * len(heuristic_header))
            ht.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#475569")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(ht)
            story.append(Spacer(1, 0.3 * cm))

        warnings = sci.get("metric_warnings") or []
        if warnings:
            story.append(Paragraph("5. Metrik nomuvofiqlik ogohlantirishlari", heading_style))
            for w in warnings:
                story.append(Paragraph(
                    f"• {self._sanitize_pdf_text(w.get('message', ''))}",
                    body_style,
                ))
            story.append(Spacer(1, 0.3 * cm))

        if report_data["generation_history"]:
            story.append(Paragraph("6. GA ichki optimallashtirish (Fitness Evolution)", heading_style))
            chart_bytes = self._make_fitness_chart_bytes(report_data["generation_history"])
            chart_image = (
                self._rl_image_from_bytes(chart_bytes, width=14 * cm, height=7 * cm)
                if chart_bytes
                else None
            )
            if chart_image:
                story.append(chart_image)
            else:
                story.append(self._missing_image_paragraph(styles["Normal"]))
            story.append(Spacer(1, 0.4 * cm))

        section_num = "7" if report_data["generation_history"] else "6"
        story.append(Paragraph(f"{section_num}. Ma'lumotlarga asoslangan xulosa", heading_style))
        story.append(self._pdf_paragraph(report_data["conclusion"], body_style))

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
