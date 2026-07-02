from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from uuid import UUID


class TaskHazardReview(BaseModel):
    conclusion: str
    status_in_task: str
    photo_tokens: Optional[List[str]] = []


class TaskHazardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    hazard_id: UUID
    conclusion: Optional[str] = None
    status_in_task: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewer_id: Optional[UUID] = None
    reviewer_username: Optional[str] = None
    photos: List[dict] = []
