from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.schemas import ReportStatusResponse, ReportGenerateResponse
from app.models import Report
from app.dependencies.auth import get_current_active_user
from app.services.report_orchestration_service import ReportOrchestrationService
from app.services.storage_service import StorageService

router = APIRouter()


@router.post("/{task_id}/generate", response_model=ReportGenerateResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_report(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    orchestrator = ReportOrchestrationService(db)
    await orchestrator.create_and_enqueue(task_id)
    return ReportGenerateResponse(task_id=task_id)


@router.get("/{task_id}/status", response_model=ReportStatusResponse)
async def get_report_status(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(select(Report).where(Report.task_id == task_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.get("/{task_id}/download")
async def download_report(
    task_id: UUID,
    format: str,  # word or pdf
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(select(Report).where(Report.task_id == task_id))
    report = result.scalar_one_or_none()
    if not report or report.status != "completed":
        raise HTTPException(status_code=404, detail="Report not ready")

    path = report.word_path if format == "word" else report.pdf_path
    if not path:
        raise HTTPException(status_code=404, detail=f"{format} report not available")

    storage = StorageService()
    try:
        data = storage.get_file(path)
        content = data.read()
        data.close()
        data.release_conn()
    except Exception:
        raise HTTPException(status_code=404, detail="Report file not found in storage")

    content_type = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if format == "word"
        else "application/pdf"
    )
    extension = "docx" if format == "word" else "pdf"
    filename = f"report_{task_id}.{extension}"

    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
