from fastapi import Depends, HTTPException, status
from app.dependencies.auth import get_current_active_user
from app.models import User


async def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
