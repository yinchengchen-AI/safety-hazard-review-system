from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from datetime import date

from app.core.database import get_db
from app.models import Hazard, ReviewTask, TaskHazard, Batch, Enterprise, User, StatisticsDaily
from app.dependencies.auth import get_current_active_user
from app.schemas import (
    EnterpriseStatistics,
    BatchStatistics,
    InspectorStatistics,
    TrendStatistics,
    TrendPoint,
)

router = APIRouter()


@router.get("/enterprise", response_model=list[EnterpriseStatistics])
async def enterprise_statistics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            Enterprise.id,
            Enterprise.name,
            func.count(Hazard.id).label("total_hazards"),
            func.sum(case((Hazard.status == "pending", 1), else_=0)).label("pending_count"),
            func.sum(case((Hazard.status == "passed", 1), else_=0)).label("passed_count"),
            func.sum(case((Hazard.status == "failed", 1), else_=0)).label("failed_count"),
            func.coalesce(func.sum(Hazard.review_count), 0).label("review_count"),
        )
        .join(Hazard, and_(Hazard.enterprise_id == Enterprise.id, Hazard.deleted_at.is_(None)))
        .where(Enterprise.deleted_at.is_(None))
        .group_by(Enterprise.id, Enterprise.name)
    )

    stats = []
    for row in result.all():
        stats.append(EnterpriseStatistics(
            enterprise_id=row.id,
            enterprise_name=row.name,
            total_hazards=row.total_hazards or 0,
            pending_count=row.pending_count or 0,
            passed_count=row.passed_count or 0,
            failed_count=row.failed_count or 0,
            review_count=row.review_count or 0,
        ))
    return stats


@router.get("/batch", response_model=list[BatchStatistics])
async def batch_statistics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            Batch.id,
            Batch.name,
            func.count(Hazard.id).label("total_hazards"),
            func.sum(case((Hazard.status != "pending", 1), else_=0)).label("reviewed_count"),
            func.sum(case((Hazard.status == "passed", 1), else_=0)).label("passed_count"),
            func.sum(case((Hazard.status == "failed", 1), else_=0)).label("failed_count"),
        )
        .join(Hazard, and_(Hazard.batch_id == Batch.id, Hazard.deleted_at.is_(None)))
        .where(Batch.deleted_at.is_(None))
        .group_by(Batch.id, Batch.name)
    )

    stats = []
    for row in result.all():
        total = row.total_hazards or 0
        reviewed = row.reviewed_count or 0
        passed = row.passed_count or 0
        stats.append(BatchStatistics(
            batch_id=row.id,
            batch_name=row.name,
            total_hazards=total,
            reviewed_count=reviewed,
            passed_count=passed,
            failed_count=row.failed_count or 0,
            coverage_rate=round(reviewed / total, 4) if total else 0.0,
            pass_rate=round(passed / reviewed, 4) if reviewed else 0.0,
        ))
    return stats


@router.get("/inspector", response_model=list[InspectorStatistics])
async def inspector_statistics(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(
            User.id,
            User.username,
            func.count(ReviewTask.id).label("task_count"),
            func.count(TaskHazard.id).label("reviewed_hazard_count"),
        )
        .join(ReviewTask, ReviewTask.creator_id == User.id)
        .outerjoin(TaskHazard, TaskHazard.reviewer_id == User.id)
        .where(User.deleted_at.is_(None), ReviewTask.deleted_at.is_(None))
        .group_by(User.id, User.username)
    )

    stats = []
    for row in result.all():
        stats.append(InspectorStatistics(
            inspector_id=row.id,
            inspector_name=row.username,
            task_count=row.task_count or 0,
            reviewed_hazard_count=row.reviewed_hazard_count or 0,
        ))
    return stats


@router.get("/trend", response_model=TrendStatistics)
async def trend_statistics(
    start_date: date | None = None,
    end_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = select(StatisticsDaily).where(
        StatisticsDaily.enterprise_id.is_(None),
        StatisticsDaily.batch_id.is_(None),
        StatisticsDaily.inspector_id.is_(None),
    )
    if start_date:
        query = query.where(StatisticsDaily.stat_date >= start_date)
    if end_date:
        query = query.where(StatisticsDaily.stat_date <= end_date)

    query = query.order_by(StatisticsDaily.stat_date)
    result = await db.execute(query)
    rows = result.scalars().all()

    points = []
    for row in rows:
        total = row.total_hazards or 0
        reviewed = row.review_count or 0
        passed = row.passed_count or 0
        points.append(TrendPoint(
            period=row.stat_date.strftime("%Y-%m-%d"),
            total_hazards=row.total_hazards,
            pending_count=row.pending_count,
            passed_count=row.passed_count,
            failed_count=row.failed_count,
            review_count=row.review_count,
            task_count=row.task_count,
            coverage_rate=round(reviewed / total, 4) if total else 0.0,
            pass_rate=round(passed / reviewed, 4) if reviewed else 0.0,
        ))

    return TrendStatistics(points=points)
