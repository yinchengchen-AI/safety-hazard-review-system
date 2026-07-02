from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from uuid import UUID
from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.schemas import AuditLogResponse, AuditLogListResponse, AuditLogQueryParams
from app.models import AuditLog
from app.dependencies.permissions import require_admin

router = APIRouter()


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    params: AuditLogQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
    admin = Depends(require_admin),
):
    # Build base query
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)

    filters = []
    if params.user_id:
        filters.append(AuditLog.user_id == params.user_id)
    if params.action:
        filters.append(AuditLog.action.ilike(f"%{params.action}%"))
    if params.target_type:
        filters.append(AuditLog.target_type == params.target_type)
    if params.target_id:
        filters.append(AuditLog.target_id == params.target_id)
    if params.start_date:
        start_dt = datetime.combine(params.start_date, time.min).replace(tzinfo=ZoneInfo("Asia/Shanghai"))
        filters.append(AuditLog.created_at >= start_dt)
    if params.end_date:
        end_dt = datetime.combine(params.end_date, time.max).replace(tzinfo=ZoneInfo("Asia/Shanghai"))
        filters.append(AuditLog.created_at <= end_dt)

    if filters:
        where_clause = and_(*filters)
        query = query.where(where_clause)
        count_query = count_query.where(where_clause)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (params.page - 1) * params.page_size
    query = (
        query.order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(params.page_size)
    )

    result = await db.execute(query)
    items = result.scalars().all()

    return {"items": items, "total": total}


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(require_admin),
):
    result = await db.execute(select(AuditLog).where(AuditLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return log
