import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy import select, delete
from app.tasks.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models import Photo
from app.services.storage_service import StorageService


@celery_app.task(name="app.tasks.photo_cleanup_tasks.cleanup_orphan_photos")
def cleanup_orphan_photos():
    """Clean up photos that have been left with temp_token for too long."""

    async def _run():
        cutoff = datetime.now(ZoneInfo("Asia/Shanghai")) - timedelta(hours=24)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Photo).where(
                    Photo.temp_token.isnot(None),
                    Photo.uploaded_at < cutoff,
                )
            )
            photos = result.scalars().all()
            if not photos:
                return {"deleted": 0}

            storage = StorageService()
            deleted_count = 0
            for photo in photos:
                try:
                    if photo.original_path:
                        storage.delete_file(photo.original_path)
                    if photo.thumbnail_path:
                        storage.delete_file(photo.thumbnail_path)
                except Exception:
                    pass
                await db.delete(photo)
                deleted_count += 1

            await db.commit()
            return {"deleted": deleted_count}

    return asyncio.run(_run())
