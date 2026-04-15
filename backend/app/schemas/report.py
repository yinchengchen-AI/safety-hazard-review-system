from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID


class ReportStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    status: str
    word_path: Optional[str] = None
    pdf_path: Optional[str] = None
    error_message: Optional[str] = None
    generated_at: Optional[datetime] = None
    created_at: datetime


class ReportGenerateResponse(BaseModel):
    task_id: UUID
    message: str = "Report generation started"
