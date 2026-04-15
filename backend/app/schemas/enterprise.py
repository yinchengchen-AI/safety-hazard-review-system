from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID


class EnterpriseCreate(BaseModel):
    name: str
    credit_code: Optional[str] = None
    industry_sector: Optional[str] = None
    enterprise_type: Optional[str] = None


class EnterpriseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    credit_code: Optional[str] = None
    industry_sector: Optional[str] = None
    enterprise_type: Optional[str] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None
