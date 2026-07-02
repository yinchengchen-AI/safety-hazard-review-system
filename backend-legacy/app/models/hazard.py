import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, Index, text, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Hazard(Base):
    __tablename__ = "hazards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey("enterprises.id"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=False)
    content = Column(String, nullable=True)
    description = Column(String, nullable=True)
    location = Column(String(255), nullable=True)
    category = Column(String(50), nullable=True)
    inspection_method = Column(String(50), nullable=True)
    inspector = Column(String(100), nullable=True)
    inspection_date = Column(Date, nullable=True)
    judgment_basis = Column(String(500), nullable=True)
    violation_clause = Column(String, nullable=True)
    is_rectified = Column(String(20), nullable=True)
    rectification_date = Column(Date, nullable=True)
    rectification_responsible = Column(String(200), nullable=True)
    rectification_measures = Column(String, nullable=True)
    report_remarks = Column(String, nullable=True)
    reporting_unit = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    current_task_id = Column(UUID(as_uuid=True), ForeignKey("review_tasks.id"), nullable=True)
    review_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")), onupdate=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    enterprise = relationship("Enterprise", back_populates="hazards")
    batch = relationship("Batch", back_populates="hazards")
    current_task = relationship("ReviewTask", foreign_keys=[current_task_id])
    task_hazards = relationship("TaskHazard", back_populates="hazard")
    status_history = relationship("HazardStatusHistory", back_populates="hazard", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_hazards_enterprise_status_created", "enterprise_id", "status", "created_at"),
        Index("ix_hazards_batch_status", "batch_id", "status"),
        Index("ix_hazards_current_task", "current_task_id"),
        Index(
            "ix_hazards_enterprise_content_hash_location_hash",
            "enterprise_id",
            text("digest(content, 'sha256')"),
            text("digest(COALESCE(location, ''), 'sha256')"),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
