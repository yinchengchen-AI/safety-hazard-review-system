from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete
from uuid import UUID
import io
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.schemas import BatchResponse, BatchImportResult, ImportErrorResponse, BatchPreviewResponse
from app.models import Batch, ImportError, Hazard, User
from app.dependencies.auth import get_current_active_user
from app.services.import_service import ImportService
from app.services.storage_service import StorageService
from app.services.template_service import TemplateService

router = APIRouter()


@router.get("", response_model=list[BatchResponse])
async def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    stmt = (
        select(Batch, User.username)
        .outerjoin(User, Batch.creator_id == User.id)
        .where(Batch.deleted_at.is_(None))
        .order_by(Batch.import_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    rows = result.all()
    batches = []
    for batch, username in rows:
        batch.creator_username = username
        # Count available hazards (not deleted and not locked in a task)
        count_result = await db.execute(
            select(func.count())
            .select_from(Hazard)
            .where(
                Hazard.batch_id == batch.id,
                Hazard.deleted_at.is_(None),
                Hazard.current_task_id.is_(None),
            )
        )
        batch.available_hazard_count = count_result.scalar() or 0
        batches.append(batch)
    return batches


@router.post("/preview", response_model=BatchPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    batch_name: str = "",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    content = await file.read()
    service = ImportService(db)
    preview = service.preview_file(filename=file.filename or "unknown", content=io.BytesIO(content))

    temp_token = str(uuid.uuid4())
    storage = StorageService()
    object_name = f"temp/batch-preview/{temp_token}/{file.filename or 'unknown'}"
    storage.upload_file(content, object_name, content_type=file.content_type or "application/octet-stream")

    items = preview["items"][:20]
    return BatchPreviewResponse(
        total=preview["total"],
        items=items,
        temp_token=temp_token,
    )


@router.post("/import", response_model=BatchImportResult)
async def import_hazards(
    temp_token: str = Form(...),
    name: str = Form(...),
    filename: str = Form(""),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    service = ImportService(db)
    result = await service.import_file(
        temp_token=temp_token,
        filename=filename or name,
        batch_name=name,
        user_id=current_user.id,
    )
    return result


@router.get("/{batch_id}/errors", response_model=list[ImportErrorResponse])
async def list_import_errors(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(ImportError).where(ImportError.batch_id == batch_id).order_by(ImportError.row_index)
    )
    return result.scalars().all()


@router.delete("/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_batch(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None)))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    batch.deleted_at = now

    await db.execute(
        update(Hazard)
        .where(Hazard.batch_id == batch_id, Hazard.deleted_at.is_(None))
        .values(deleted_at=now)
    )

    await db.execute(delete(ImportError).where(ImportError.batch_id == batch_id))

    storage = StorageService()
    if batch.original_file_path:
        storage.delete_file(batch.original_file_path)

    await db.commit()
    return None


@router.get("/{batch_id}/download")
async def download_batch_file(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(select(Batch).where(Batch.id == batch_id, Batch.deleted_at.is_(None)))
    batch = result.scalar_one_or_none()
    if not batch or not batch.original_file_path:
        raise HTTPException(status_code=404, detail="文件不存在")

    storage = StorageService()
    try:
        response = storage.get_file(batch.original_file_path)
        data = response.read()
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"无法读取文件: {str(e)}")

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{batch.file_name or "download"}"'},
    )


@router.get("/template")
async def download_template(
    format: str = Query("excel", enum=["excel", "csv"]),
    current_user=Depends(get_current_active_user),
):
    if format == "csv":
        buffer = TemplateService.generate_csv_template()
        media_type = "text/csv; charset=utf-8"
        filename = "template.csv"
    else:
        buffer = TemplateService.generate_excel_template()
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "template.xlsx"

    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
