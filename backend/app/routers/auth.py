from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.exception_handlers import AuditableHTTPException
from app.schemas import Token
from app.models import User
from app.dependencies.auth import get_current_active_user
from app.services import audit_log_service

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.username == form_data.username, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise AuditableHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user.id)})

    # 记录登录成功
    await audit_log_service.record(
        db=db,
        user_id=user.id,
        action="login_success",
        target_type="auth",
        detail={"username": user.username, "login_result": "success"},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_me(current_user: User = Depends(get_current_active_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "role": current_user.role,
    }
