from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from uuid import UUID


class ReviewTaskCreate(BaseModel):
    name: str
    hazard_ids: List[UUID] = []
    batch_ids: List[UUID] = []


class ReviewTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    creator_id: UUID
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    creator_username: Optional[str] = None
    hazard_count: int = 0
    reviewed_count: int = 0
    report_status: Optional[str] = None


class ReviewTaskDetailResponse(ReviewTaskResponse):
    hazards: List[dict] = []


class BatchReviewItem(BaseModel):
    hazard_id: UUID
    conclusion: str
    status_in_task: str
    photo_tokens: Optional[List[str]] = []


class BatchReviewRequest(BaseModel):
    items: List[BatchReviewItem]
