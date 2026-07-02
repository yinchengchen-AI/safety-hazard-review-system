from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID


class BatchCreate(BaseModel):
    name: str


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    import_time: datetime
    file_name: Optional[str] = None
    total_count: int
    success_count: int
    fail_count: int
    creator_username: Optional[str] = None
    original_file_path: Optional[str] = None
    reporting_unit: Optional[str] = None
    created_at: datetime
    deleted_at: Optional[datetime] = None
    available_hazard_count: int = 0


class BatchImportResult(BaseModel):
    batch: BatchResponse
    success_count: int
    fail_count: int
    errors: list[dict]


class BatchPreviewItem(BaseModel):
    row_index: int
    enterprise_name: str | None
    credit_code: str | None
    region: str | None
    address: str | None
    contact_person: str | None
    industry_sector: str | None
    enterprise_type: str | None
    reporting_unit: str | None
    description: str | None
    content: str | None
    location: str | None
    category: str | None
    inspection_method: str | None
    inspector: str | None
    inspection_date: str | None
    judgment_basis: str | None
    violation_clause: str | None
    is_rectified: str | None
    rectification_date: str | None
    rectification_responsible: str | None
    rectification_measures: str | None
    report_remarks: str | None
    errors: list[str]


class BatchPreviewResponse(BaseModel):
    total: int
    items: list[BatchPreviewItem]
    temp_token: str
