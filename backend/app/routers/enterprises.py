from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.core.database import get_db
from app.schemas import EnterpriseCreate, EnterpriseResponse
from app.models import Enterprise
from app.dependencies.auth import get_current_active_user
from app.services import audit_log_service

router = APIRouter()


@router.post("", response_model=EnterpriseResponse, status_code=status.HTTP_201_CREATED)
async def create_enterprise(
    request: Request,
    data: EnterpriseCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    enterprise = Enterprise(
        name=data.name,
        credit_code=data.credit_code,
        industry_sector=data.industry_sector,
        enterprise_type=data.enterprise_type,
    )
    db.add(enterprise)
    await db.commit()
    await db.refresh(enterprise)

    await audit_log_service.record(
        db=db,
        user_id=current_user.id if hasattr(current_user, 'id') else None,
        action="create_enterprise",
        target_type="enterprise",
        target_id=enterprise.id,
        detail={"name": enterprise.name, "credit_code": enterprise.credit_code},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 201,
        },
    )

    return enterprise


@router.get("", response_model=list[EnterpriseResponse])
async def list_enterprises(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    result = await db.execute(select(Enterprise).where(Enterprise.deleted_at.is_(None)))
    return result.scalars().all()


@router.get("/{enterprise_id}", response_model=EnterpriseResponse)
async def get_enterprise(
    enterprise_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Enterprise).where(Enterprise.id == enterprise_id, Enterprise.deleted_at.is_(None))
    )
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return enterprise


@router.delete("/{enterprise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_enterprise(
    request: Request,
    enterprise_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    result = await db.execute(
        select(Enterprise).where(Enterprise.id == enterprise_id, Enterprise.deleted_at.is_(None))
    )
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    enterprise_name = enterprise.name
    enterprise.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db.commit()

    await audit_log_service.record(
        db=db,
        user_id=current_user.id if hasattr(current_user, 'id') else None,
        action="delete_enterprise",
        target_type="enterprise",
        target_id=enterprise_id,
        detail={"name": enterprise_name},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 204,
        },
    )

    return None
