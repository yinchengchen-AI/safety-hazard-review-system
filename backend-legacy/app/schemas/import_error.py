from pydantic import BaseModel, ConfigDict
from datetime import datetime
from uuid import UUID


class ImportErrorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    batch_id: UUID
    row_index: int
    raw_data: str | None = None
    reason: str
    created_at: datetime
