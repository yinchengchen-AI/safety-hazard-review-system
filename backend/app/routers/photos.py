from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from uuid import uuid4, UUID
import io
from PIL import Image

from app.core.database import get_db
from app.core.config import settings
from app.schemas import PhotoUploadResponse, PhotoBindRequest
from app.models import Photo
from app.dependencies.auth import get_current_active_user
from app.services.storage_service import StorageService

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}


@router.post("/upload", response_model=PhotoUploadResponse)
async def upload_photo(
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
    detected = imghdr.what(None, h=content)
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

    return PhotoUploadResponse(
        temp_token=temp_token,
        original_url=original_path,
        thumbnail_url=thumbnail_path,
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

    photo.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db.commit()
    return None
