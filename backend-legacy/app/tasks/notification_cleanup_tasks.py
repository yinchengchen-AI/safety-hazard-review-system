import asyncio
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import update

from app.core.database import AsyncSessionLocal
from app.models.notification import Notification
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


async def _run_cleanup():
    async with AsyncSessionLocal() as db:
        cutoff = datetime.now(ZoneInfo("Asia/Shanghai")) - timedelta(days=30)
        result = await db.execute(
            update(Notification)
            .where(
                Notification.is_read == True,
                Notification.read_at < cutoff,
                Notification.deleted_at.is_(None),
            )
            .values(deleted_at=datetime.now(ZoneInfo("Asia/Shanghai")))
        )
        await db.commit()
        logger.info("Soft-deleted %s old read notifications", result.rowcount)


@celery_app.task(name="app.tasks.notification_cleanup_tasks.cleanup_old_notifications")
def cleanup_old_notifications():
    asyncio.run(_run_cleanup())
