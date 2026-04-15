import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class StatisticsMonthly(Base):
    __tablename__ = "statistics_monthly"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stat_month = Column(String(7), nullable=False)
    enterprise_id = Column(UUID(as_uuid=True), ForeignKey("enterprises.id"), nullable=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id"), nullable=True)
    inspector_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    total_hazards = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    passed_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    review_count = Column(Integer, default=0)
    task_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")), onupdate=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))

    __table_args__ = (
        UniqueConstraint("stat_month", "enterprise_id", "batch_id", "inspector_id", name="uix_stats_monthly"),
    )
