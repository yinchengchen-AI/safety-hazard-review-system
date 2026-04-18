from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_password_hash
from app.schemas import UserCreate, UserUpdate, UserResetPassword, UserResponse, UserListResponse
from app.models import User
from app.dependencies.permissions import require_admin
from app.services import audit_log_service

router = APIRouter()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: Request,
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.username == user_in.username, User.deleted_at.is_(None))
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        full_name=user_in.full_name,
        phone=user_in.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="create_user",
        target_type="user",
        target_id=user.id,
        detail={"username": user.username, "role": user.role},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 201,
        },
    )

    return user


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = 1,
    page_size: int = 20,
    keyword: str = "",
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    offset = (page - 1) * page_size
    where_clause = User.deleted_at.is_(None)
    if keyword:
        where_clause = where_clause & User.username.ilike(f"%{keyword}%")

    result = await db.execute(
        select(User).where(where_clause).offset(offset).limit(page_size)
    )
    users = result.scalars().all()

    total_result = await db.execute(
        select(func.count()).select_from(User).where(where_clause)
    )
    total = total_result.scalar()

    return {"items": users, "total": total}


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    request: Request,
    user_id: UUID,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updated_fields = {}
    if user_in.role is not None:
        user.role = user_in.role
        updated_fields["role"] = user_in.role
    if user_in.password is not None:
        user.password_hash = get_password_hash(user_in.password)
        updated_fields["password_changed"] = True
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
        updated_fields["full_name"] = user_in.full_name
    if user_in.phone is not None:
        user.phone = user_in.phone
        updated_fields["phone"] = user_in.phone

    await db.commit()
    await db.refresh(user)

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="update_user",
        target_type="user",
        target_id=user_id,
        detail={"username": user.username, "updated_fields": list(updated_fields.keys())},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    return user


@router.post("/{user_id}/reset-password", response_model=UserResponse)
async def reset_password(
    request: Request,
    user_id: UUID,
    data: UserResetPassword,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(data.new_password)
    await db.commit()
    await db.refresh(user)

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="reset_password",
        target_type="user",
        target_id=user_id,
        detail={"username": user.username},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    request: Request,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    username = user.username
    user.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db.commit()

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="delete_user",
        target_type="user",
        target_id=user_id,
        detail={"username": username},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 204,
        },
    )

    return None
