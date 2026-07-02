import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, DateTime, BigInteger, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Photo(Base):
    __tablename__ = "photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_hazard_id = Column(UUID(as_uuid=True), ForeignKey("task_hazards.id"), nullable=True)
    temp_token = Column(String(64), nullable=True)
    original_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String(50), nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    task_hazard = relationship("TaskHazard", back_populates="photos")

    __table_args__ = (
        Index("ix_photos_task_hazard", "task_hazard_id"),
        Index("ix_photos_temp_token", "temp_token"),
    )
