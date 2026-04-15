from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.core.database import get_db
from app.schemas import EnterpriseCreate, EnterpriseResponse
from app.models import Enterprise
from app.dependencies.auth import get_current_active_user

router = APIRouter()


@router.post("", response_model=EnterpriseResponse, status_code=status.HTTP_201_CREATED)
async def create_enterprise(
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
    enterprise.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db.commit()
    return None
