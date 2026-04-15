import io
import os
import tempfile
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional

from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from playwright.async_api import async_playwright
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import ReviewTask, TaskHazard, Photo, Report
from app.services.storage_service import StorageService


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage = StorageService()

    async def generate_report(self, task_id: uuid.UUID) -> Report:
        result = await self.db.execute(
            select(ReviewTask)
            .where(ReviewTask.id == task_id)
            .options(selectinload(ReviewTask.creator))
        )
        task = result.scalar_one_or_none()
        if not task:
            raise ValueError("Review task not found")

        # Update report status to processing
        report_result = await self.db.execute(select(Report).where(Report.task_id == task_id))
        report = report_result.scalar_one_or_none()
        if not report:
            report = Report(task_id=task_id, status="pending")
            self.db.add(report)
            await self.db.flush()

        report.status = "processing"
        await self.db.commit()

        try:
            # Fetch task hazards with photos
            th_result = await self.db.execute(
                select(TaskHazard)
                .where(TaskHazard.task_id == task_id)
                .options(
                    selectinload(TaskHazard.hazard),
                    selectinload(TaskHazard.photos),
                    selectinload(TaskHazard.reviewer),
                )
            )
            task_hazards = th_result.scalars().all()

            # Generate Word
            word_path = await self._generate_word(task, task_hazards)

            # Generate PDF via Playwright
            pdf_path = await self._generate_pdf(task, task_hazards)

            report.word_path = word_path
            report.pdf_path = pdf_path
            report.status = "completed"
            report.generated_at = datetime.now(ZoneInfo("Asia/Shanghai"))
        except Exception as e:
            report.status = "failed"
            report.error_message = str(e)

        await self.db.commit()
        await self.db.refresh(report)
        return report

    async def _generate_word(self, task: ReviewTask, task_hazards: list) -> str:
        doc = Document()

        # Title
        title = doc.add_heading("安全生产隐患复核报告", level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Task info
        doc.add_paragraph(f"任务名称: {task.name}")
        doc.add_paragraph(f"创建人: {task.creator.username if task.creator else ''}")
        doc.add_paragraph(f"创建时间: {task.created_at.strftime('%Y-%m-%d %H:%M')}")
        doc.add_paragraph()

        # Hazards table
        table = doc.add_table(rows=1, cols=5)
        table.style = "Light Grid Accent 1"
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = "序号"
        hdr_cells[1].text = "隐患描述"
        hdr_cells[2].text = "位置"
        hdr_cells[3].text = "复核结论"
        hdr_cells[4].text = "复核状态"

        for idx, th in enumerate(task_hazards, 1):
            row_cells = table.add_row().cells
            row_cells[0].text = str(idx)
            row_cells[1].text = th.hazard.content or ""
            row_cells[2].text = th.hazard.location or ""
            row_cells[3].text = th.conclusion or ""
            row_cells[4].text = th.status_in_task or "待复核"

        # Save to temp file and upload
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            doc.save(tmp.name)
            tmp_path = tmp.name

        with open(tmp_path, "rb") as f:
            data = f.read()

        object_name = f"reports/{task.id}/{uuid.uuid4()}.docx"
        self.storage.client.put_object(
            self.storage.bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        os.unlink(tmp_path)
        return f"/{self.storage.bucket}/{object_name}"

    async def _generate_pdf(self, task: ReviewTask, task_hazards: list) -> str:
        html = self._build_html(task, task_hazards)

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_path = tmp.name

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.set_content(html)
            await page.pdf(path=tmp_path, format="A4", margin={"top": "1cm", "bottom": "1cm", "left": "1cm", "right": "1cm"})
            await browser.close()

        with open(tmp_path, "rb") as f:
            data = f.read()

        object_name = f"reports/{task.id}/{uuid.uuid4()}.pdf"
        self.storage.client.put_object(
            self.storage.bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type="application/pdf",
        )
        os.unlink(tmp_path)
        return f"/{self.storage.bucket}/{object_name}"

    def _build_html(self, task: ReviewTask, task_hazards: list) -> str:
        rows = ""
        for idx, th in enumerate(task_hazards, 1):
            photos_html = ""
            for photo in th.photos:
                photos_html += f'<img src="{photo.original_path}" style="max-width:150px;max-height:150px;margin:4px;" />'

            rows += f"""
            <tr>
                <td>{idx}</td>
                <td>{th.hazard.content or ""}</td>
                <td>{th.hazard.location or ""}</td>
                <td>{th.conclusion or ""}</td>
                <td>{th.status_in_task or "待复核"}</td>
                <td>{photos_html}</td>
            </tr>
            """

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; }}
                h1 {{ text-align: center; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th, td {{ border: 1px solid #333; padding: 8px; text-align: left; vertical-align: top; }}
                th {{ background: #f2f2f2; }}
            </style>
        </head>
        <body>
            <h1>安全生产隐患复核报告</h1>
            <p>任务名称: {task.name}</p>
            <p>创建人: {task.creator.username if task.creator else ""}</p>
            <p>创建时间: {task.created_at.strftime('%Y-%m-%d %H:%M')}</p>
            <table>
                <tr>
                    <th>序号</th>
                    <th>隐患描述</th>
                    <th>位置</th>
                    <th>复核结论</th>
                    <th>复核状态</th>
                    <th>照片</th>
                </tr>
                {rows}
            </table>
        </body>
        </html>
        """
