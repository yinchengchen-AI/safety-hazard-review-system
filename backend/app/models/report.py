import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("review_tasks.id"), nullable=False)
    word_path = Column(String(500), nullable=True)
    pdf_path = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    error_message = Column(String, nullable=True)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))

    task = relationship("ReviewTask")
