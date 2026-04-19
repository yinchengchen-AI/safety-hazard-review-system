import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import Notification, User, ReviewTask, Hazard, TaskHazard

logger = logging.getLogger(__name__)


def _truncate_hazard_content(content: str | None) -> str:
    if not content:
        return ""
    if len(content) <= 20:
        return content
    return content[:20] + "..."


async def notify_task_created(db: AsyncSession, task: ReviewTask, actor_id: UUID) -> list[Notification]:
    notifications = []
    try:
        result = await db.execute(
            select(User).where(
                User.role == "inspector",
                User.deleted_at.is_(None),
            )
        )
        inspectors = result.scalars().all()
        for inspector in inspectors:
            if inspector.id == actor_id:
                continue
            notification = Notification(
                user_id=inspector.id,
                type="task_created",
                title=f"您有新的复核任务：{task.name}",
                related_type="review_task",
                related_id=task.id,
            )
            db.add(notification)
            notifications.append(notification)
    except IntegrityError:
        logger.warning("Duplicate notification ignored for task_created", exc_info=True)
    except Exception:
        logger.warning("Failed to create task_created notifications", exc_info=True)
    return notifications


async def notify_task_completed(db: AsyncSession, task: ReviewTask, actor_id: UUID) -> list[Notification]:
    notifications = []
    try:
        recipients = set()
        if task.creator_id and task.creator_id != actor_id:
            recipients.add(task.creator_id)

        result = await db.execute(
            select(User).where(
                User.role == "admin",
                User.deleted_at.is_(None),
            )
        )
        admins = result.scalars().all()
        for admin in admins:
            if admin.id != actor_id:
                recipients.add(admin.id)

        for user_id in recipients:
            notification = Notification(
                user_id=user_id,
                type="task_completed",
                title=f"复核任务已完成：{task.name}",
                related_type="review_task",
                related_id=task.id,
            )
            db.add(notification)
            notifications.append(notification)
    except IntegrityError:
        logger.warning("Duplicate notification ignored for task_completed", exc_info=True)
    except Exception:
        logger.warning("Failed to create task_completed notifications", exc_info=True)
    return notifications


async def notify_task_cancelled(db: AsyncSession, task: ReviewTask, actor_id: UUID) -> list[Notification]:
    notifications = []
    try:
        recipients = set()
        if task.creator_id and task.creator_id != actor_id:
            recipients.add(task.creator_id)

        result = await db.execute(
            select(TaskHazard.reviewer_id)
            .where(
                TaskHazard.task_id == task.id,
                TaskHazard.reviewer_id.isnot(None),
                TaskHazard.deleted_at.is_(None),
            )
            .distinct()
        )
        reviewer_ids = result.scalars().all()
        for rid in reviewer_ids:
            if rid and rid != actor_id:
                recipients.add(rid)

        for user_id in recipients:
            notification = Notification(
                user_id=user_id,
                type="task_cancelled",
                title=f"复核任务已取消：{task.name}",
                related_type="review_task",
                related_id=task.id,
            )
            db.add(notification)
            notifications.append(notification)
    except IntegrityError:
        logger.warning("Duplicate notification ignored for task_cancelled", exc_info=True)
    except Exception:
        logger.warning("Failed to create task_cancelled notifications", exc_info=True)
    return notifications


async def notify_hazard_reviewed(db: AsyncSession, hazard: Hazard, task_id: UUID, actor_id: UUID) -> Notification | None:
    try:
        if not hazard.batch or not hazard.batch.creator_id:
            return None
        creator_id = hazard.batch.creator_id
        if creator_id == actor_id:
            return None

        # Verify creator user is not deleted
        result = await db.execute(
            select(User).where(User.id == creator_id, User.deleted_at.is_(None))
        )
        creator = result.scalar_one_or_none()
        if not creator:
            return None

        content = _truncate_hazard_content(hazard.content)
        notification = Notification(
            user_id=creator_id,
            type="hazard_reviewed",
            title=f"隐患已被复核：{content}",
            related_type="hazard",
            related_id=hazard.id,
        )
        db.add(notification)
        return notification
    except IntegrityError:
        logger.warning("Duplicate notification ignored for hazard_reviewed", exc_info=True)
        return None
    except Exception:
        logger.warning("Failed to create hazard_reviewed notification", exc_info=True)
        return None


async def notify_report_completed(db: AsyncSession, task: ReviewTask) -> Notification | None:
    try:
        if not task.creator_id:
            return None

        result = await db.execute(
            select(User).where(User.id == task.creator_id, User.deleted_at.is_(None))
        )
        creator = result.scalar_one_or_none()
        if not creator:
            return None

        notification = Notification(
            user_id=task.creator_id,
            type="report_completed",
            title=f"复核报告已生成：{task.name}",
            related_type="report",
            related_id=task.id,
        )
        db.add(notification)
        return notification
    except IntegrityError:
        logger.warning("Duplicate notification ignored for report_completed", exc_info=True)
        return None
    except Exception:
        logger.warning("Failed to create report_completed notification", exc_info=True)
        return None
