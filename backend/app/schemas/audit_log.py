from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Any


class AuditLogBase(BaseModel):
    action: str
    target_type: str
    target_id: UUID | None = None
    detail: dict[str, Any] | None = None


class AuditLogCreate(AuditLogBase):
    user_id: UUID | None = None
    ip_address: str | None = None
    method: str | None = None
    path: str | None = None
    status_code: int | None = None
    user_agent: str | None = None


class AuditLogResponse(AuditLogBase):
    id: UUID
    user_id: UUID | None = None
    ip_address: str | None = None
    method: str | None = None
    path: str | None = None
    status_code: int | None = None
    user_agent: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int


class AuditLogQueryParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    user_id: UUID | None = None
    action: str | None = None
    target_type: str | None = None
    target_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
