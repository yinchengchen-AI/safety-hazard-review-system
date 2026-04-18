from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from uuid import uuid4, UUID
import io
from PIL import Image


def _is_jpeg(header: bytes) -> bool:
    return header.startswith(b"\xff\xd8\xff")


def _is_png(header: bytes) -> bool:
    return header.startswith(b"\x89PNG\r\n\x1a\n")


def _detect_image_format(header: bytes) -> str | None:
    if _is_jpeg(header):
        return "jpeg"
    if _is_png(header):
        return "png"
    return None

from app.core.database import get_db
from app.core.config import settings
from app.schemas import PhotoUploadResponse, PhotoBindRequest
from app.models import Photo
from app.dependencies.auth import get_current_active_user
from app.services.storage_service import StorageService


def _append_token_to_url(url: str, token: str) -> str:
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}token={token}"

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}


@router.post("/upload", response_model=PhotoUploadResponse)
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

    # MIME type check
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")

    # Magic bytes check
    detected = _detect_image_format(content[:8])
    if detected not in ("jpeg", "png"):
        raise HTTPException(status_code=400, detail="File header does not match allowed image formats")

    # Pillow validation
    try:
        img = Image.open(io.BytesIO(content))
        img.verify()
        img = Image.open(io.BytesIO(content))
        width, height = img.size
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    if width < 100 or height < 100 or width > 8192 or height > 8192:
        raise HTTPException(status_code=400, detail=f"Image dimensions out of allowed range: {width}x{height}")

    storage = StorageService()
    temp_token = str(uuid4())
    original_path, thumbnail_path = await storage.upload_image(
        content=content,
        filename=file.filename or "image.jpg",
        temp_token=temp_token,
    )

    photo = Photo(
        temp_token=temp_token,
        original_path=original_path,
        thumbnail_path=thumbnail_path,
        file_size=len(content),
        mime_type=file.content_type,
        width=width,
        height=height,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    user_token = request.headers.get("Authorization", "")[7:] if request.headers.get("Authorization", "").lower().startswith("bearer ") else ""
    original_url = f"/api/v1/photos/{photo.id}/image?size=original"
    thumbnail_url = f"/api/v1/photos/{photo.id}/image?size=thumbnail"
    if user_token:
        original_url = _append_token_to_url(original_url, user_token)
        thumbnail_url = _append_token_to_url(thumbnail_url, user_token)

    return PhotoUploadResponse(
        temp_token=temp_token,
        original_url=original_url,
        thumbnail_url=thumbnail_url,
        width=width,
        height=height,
        file_size=len(content),
    )


@router.post("/{temp_token}/bind")
async def bind_photo(
    temp_token: str,
    data: PhotoBindRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(select(Photo).where(Photo.temp_token == temp_token))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo.task_hazard_id = data.task_hazard_id
    photo.temp_token = None
    await db.commit()
    return {"message": "Photo bound successfully"}


@router.get("/{photo_id}/image")
async def get_photo_image(
    photo_id: UUID,
    size: str = "original",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(select(Photo).where(Photo.id == photo_id, Photo.deleted_at.is_(None)))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Authorization: only allow access if photo is bound to a task hazard the user can review,
    # or if it still has a temp_token (recently uploaded by authenticated user)
    if photo.task_hazard_id is not None:
        from sqlalchemy.orm import selectinload
        from app.models import TaskHazard, ReviewTask

        th_result = await db.execute(
            select(TaskHazard)
            .where(TaskHazard.id == photo.task_hazard_id)
            .options(selectinload(TaskHazard.task))
        )
        task_hazard = th_result.scalar_one_or_none()
        if task_hazard and task_hazard.task and task_hazard.task.status != "cancelled":
            pass
        else:
            raise HTTPException(status_code=404, detail="Photo not found")
    elif photo.temp_token is None:
        # Photo is neither bound nor has a temp_token (orphan/abandoned)
        raise HTTPException(status_code=404, detail="Photo not found")

    object_name = photo.original_path if size == "original" else photo.thumbnail_path
    storage = StorageService()
    try:
        content = storage.get_file_content(object_name)
    except Exception:
        raise HTTPException(status_code=404, detail="Image file not found in storage")

    content_type = photo.mime_type or "image/jpeg"
    return Response(content=content, media_type=content_type)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(select(Photo).where(Photo.id == photo_id, Photo.deleted_at.is_(None)))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # If photo is bound to a task, verify the task is still pending
    if photo.task_hazard_id is not None:
        from sqlalchemy.orm import selectinload
        from app.models import TaskHazard, ReviewTask

        th_result = await db.execute(
            select(TaskHazard)
            .where(TaskHazard.id == photo.task_hazard_id)
            .options(selectinload(TaskHazard.task))
        )
        task_hazard = th_result.scalar_one_or_none()
        if not task_hazard or not task_hazard.task:
            raise HTTPException(status_code=404, detail="Photo not found")
        if task_hazard.task.status != "pending":
            raise HTTPException(status_code=400, detail="Cannot delete photo from a completed or cancelled task")

    # Soft delete in DB first, then clean up storage
    photo.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db.commit()

    storage = StorageService()
    storage.delete_file(photo.original_path)
    storage.delete_file(photo.thumbnail_path)

    return None
