import logging
from uuid import UUID
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

# 敏感字段列表（禁止记录）
SENSITIVE_FIELDS = {
    "password",
    "token",
    "access_token",
    "temp_token",
    "api_key",
    "secret",
    "authorization",
    "password_hash",
    "new_password",
    "private_key",
    "session_id",
    "cookie",
    "csrf_token",
}


def sanitize_sensitive_data(data: dict[str, Any] | None) -> dict[str, Any] | None:
    """递归过滤敏感字段"""
    if data is None:
        return None

    sanitized = {}
    for key, value in data.items():
        if key.lower() in SENSITIVE_FIELDS:
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_sensitive_data(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_sensitive_data(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            sanitized[key] = value
    return sanitized


async def record(
    db: AsyncSession,
    user_id: UUID | None,
    action: str,
    target_type: str,
    target_id: UUID | None = None,
    detail: dict[str, Any] | None = None,
    request_info: dict[str, Any] | None = None,
) -> AuditLog | None:
    """显式记录审计日志

    使用传入的 db session（与路由同一会话），由路由的 await db.commit() 统一提交
    """
    try:
        # 过滤敏感信息
        safe_detail = sanitize_sensitive_data(detail)

        # 构建 request_info（只记录允许的字段）
        safe_request_info = {}
        if request_info:
            allowed_fields = {"ip", "user_agent", "method", "path", "status_code"}
            safe_request_info = {
                k: v for k, v in request_info.items() if k in allowed_fields
            }

        audit = AuditLog(
            user_id=user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            detail=safe_detail,
            ip_address=safe_request_info.get("ip"),
            method=safe_request_info.get("method"),
            path=safe_request_info.get("path"),
            status_code=safe_request_info.get("status_code"),
            user_agent=safe_request_info.get("user_agent"),
        )
        db.add(audit)
        return audit
    except Exception as e:
        logger.warning(f"Failed to record audit log: {e}", exc_info=True)
        return None


async def record_failure(
    db: AsyncSession,
    request: Any,
    exception: Any,
) -> AuditLog | None:
    """记录失败操作（由异常处理器调用）

    使用独立的 db session，因为失败场景无业务事务可关联
    """
    try:
        # 尝试从请求中提取用户信息
        user_id = None
        username = None

        # 尝试从 form 数据中提取 username（用于登录失败）
        try:
            if hasattr(request, "form"):
                form_data = await request.form()
                username = form_data.get("username")
        except Exception:
            pass

        detail = {
            "status_code": getattr(exception, "status_code", None),
            "detail": getattr(exception, "detail", str(exception)),
        }
        if username:
            detail["username"] = username

        audit = AuditLog(
            user_id=user_id,
            action="login_failed" if (getattr(exception, "status_code", None) == 401) else "operation_failed",
            target_type="auth" if (getattr(exception, "status_code", None) == 401) else "system",
            detail=sanitize_sensitive_data(detail),
            ip_address=request.client.host if hasattr(request, "client") else None,
            method=request.method if hasattr(request, "method") else None,
            path=str(request.url.path) if hasattr(request, "url") else None,
            status_code=getattr(exception, "status_code", None),
            user_agent=request.headers.get("user-agent") if hasattr(request, "headers") else None,
        )
        db.add(audit)
        await db.commit()
        return audit
    except Exception as e:
        logger.warning(f"Failed to record failure audit log: {e}", exc_info=True)
        return None
