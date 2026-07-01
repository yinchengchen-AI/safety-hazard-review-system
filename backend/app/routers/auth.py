from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    get_password_hash,
    needs_rehash,
)
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.cookie import set_auth_cookie, clear_auth_cookie
from app.core.exception_handlers import AuditableHTTPException
from app.schemas import Token
from app.models import User
from app.dependencies.auth import get_current_active_user
from app.services import audit_log_service

router = APIRouter()


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(
    request: Request,  # required by slowapi for the limiter key
    response: Response,  # used to set the httpOnly auth cookie
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    # slowapi key_func is sync; stash the parsed username on request.state
    # so the limiter can read it without re-parsing the form body.
    request.state._login_username = form_data.username
    result = await db.execute(
        select(User).where(
            User.username == form_data.username,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise AuditableHTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user.id)})

    # Transparently upgrade the stored hash to the current cost factor on
    # the next successful login. This lets the codebase migrate away from
    # any legacy passlib hash format without an admin operation.
    if needs_rehash(user.password_hash):
        user.password_hash = get_password_hash(form_data.password)
        await db.flush()

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

    # Commit so the rehash and audit log are persisted before the session is
    # closed by the request lifecycle.
    await db.commit()

    # The token is also returned in the body for tests / direct API
    # consumers. The browser SPA uses the httpOnly cookie.
    set_auth_cookie(response, access_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_me(current_user: User = Depends(get_current_active_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    """Clear the httpOnly auth cookie. Idempotent."""
    clear_auth_cookie(response)
    return None
