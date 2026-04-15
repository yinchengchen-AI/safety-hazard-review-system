from pydantic import BaseModel, ConfigDict
from datetime import datetime, date
from typing import Optional
from uuid import UUID


class HazardCreate(BaseModel):
    enterprise_id: UUID
    batch_id: UUID
    content: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    inspection_method: Optional[str] = None
    inspector: Optional[str] = None
    inspection_date: Optional[date] = None
    judgment_basis: Optional[str] = None
    violation_clause: Optional[str] = None
    is_rectified: Optional[str] = None
    rectification_date: Optional[date] = None
    rectification_responsible: Optional[str] = None
    rectification_measures: Optional[str] = None
    report_remarks: Optional[str] = None


class HazardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    enterprise_id: UUID
    batch_id: UUID
    content: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    inspection_method: Optional[str] = None
    inspector: Optional[str] = None
    inspection_date: Optional[date] = None
    judgment_basis: Optional[str] = None
    violation_clause: Optional[str] = None
    is_rectified: Optional[str] = None
    rectification_date: Optional[date] = None
    rectification_responsible: Optional[str] = None
    rectification_measures: Optional[str] = None
    report_remarks: Optional[str] = None
    reporting_unit: Optional[str] = None
    status: str
    current_task_id: Optional[UUID] = None
    review_count: int
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    enterprise_name: Optional[str] = None
    enterprise_credit_code: Optional[str] = None
    enterprise_region: Optional[str] = None
    enterprise_address: Optional[str] = None
    enterprise_contact_person: Optional[str] = None
    enterprise_industry_sector: Optional[str] = None
    enterprise_enterprise_type: Optional[str] = None
    batch_name: Optional[str] = None
    batch_reporting_unit: Optional[str] = None


class HazardUpdateStatus(BaseModel):
    status: str
    reason: Optional[str] = None


class HazardUpdate(BaseModel):
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    inspection_method: Optional[str] = None
    inspector: Optional[str] = None
    inspection_date: Optional[date] = None
    judgment_basis: Optional[str] = None
    violation_clause: Optional[str] = None
    is_rectified: Optional[str] = None
    rectification_date: Optional[date] = None
    rectification_responsible: Optional[str] = None
    rectification_measures: Optional[str] = None
    report_remarks: Optional[str] = None
    reporting_unit: Optional[str] = None


class HazardEditableFields(BaseModel):
    description: bool = False
    location: bool = False
    category: bool = False
    inspection_method: bool = False
    inspector: bool = False
    inspection_date: bool = False
    judgment_basis: bool = False
    violation_clause: bool = False
    is_rectified: bool = False
    rectification_date: bool = False
    rectification_responsible: bool = False
    rectification_measures: bool = False
    report_remarks: bool = False
    reporting_unit: bool = False


class HazardListParams(BaseModel):
    enterprise_name: Optional[str] = None
    enterprise_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    batch_ids: list[UUID] = []
    status: Optional[str] = None
    category: Optional[str] = None
    is_rectified: Optional[str] = None
    inspection_method: Optional[str] = None
    page: int = 1
    page_size: int = 20
