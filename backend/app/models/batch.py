import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    import_time = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    file_name = Column(String(255), nullable=True)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    original_file_path = Column(String(500), nullable=True)
    reporting_unit = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    hazards = relationship("Hazard", back_populates="batch")
    creator = relationship("User")
