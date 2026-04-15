import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class ImportError(Base):
    __tablename__ = "import_errors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False)
    row_index = Column(Integer, nullable=False)
    raw_data = Column(String, nullable=True)
    reason = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))

    __table_args__ = (
        Index("ix_import_errors_batch", "batch_id"),
    )
