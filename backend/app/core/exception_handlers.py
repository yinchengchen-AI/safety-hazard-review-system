from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
from app.core.database import AsyncSessionLocal
from app.services import audit_log_service


class AuditableHTTPException(HTTPException):
    """可审计的 HTTP 异常

    继承自 HTTPException，用于需要记录审计日志的场景（如登录失败）
    """
    pass


async def audit_exception_handler(request: Request, exc: AuditableHTTPException):
    """处理 AuditableHTTPException，记录失败日志后返回标准错误响应"""
    # 创建独立 session 记录失败日志
    async with AsyncSessionLocal() as session:
        await audit_log_service.record_failure(session, request, exc)

    # 返回标准 HTTPException 响应，确保前端不受影响
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers if hasattr(exc, "headers") else None,
    )
