from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from uuid import UUID
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.schemas import NotificationListResponse, NotificationResponse
from app.models import Notification, User
from app.dependencies.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20

    # Total count (excluding soft-deleted)
    total_result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.deleted_at.is_(None),
        )
    )
    total = total_result.scalar()

    # Unread count
    unread_result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.deleted_at.is_(None),
        )
    )
    unread_count = unread_result.scalar()

    # Paginated items
    items_result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.deleted_at.is_(None),
        )
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = items_result.scalars().all()

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(i) for i in items],
        total=total,
        unread_count=unread_count,
    )


@router.get("/unread-count", response_model=int)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.deleted_at.is_(None),
        )
    )
    return result.scalar()


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    result = await db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
            Notification.deleted_at.is_(None),
        )
        .values(is_read=True, read_at=now, updated_at=now)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.commit()
    return None


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.deleted_at.is_(None),
        )
        .values(is_read=True, read_at=now, updated_at=now)
    )
    await db.commit()
    return None
