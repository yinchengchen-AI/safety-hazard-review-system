import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class HazardStatusHistory(Base):
    __tablename__ = "hazard_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hazard_id = Column(UUID(as_uuid=True), ForeignKey("hazards.id"), nullable=False)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    reason = Column(String, nullable=True)

    hazard = relationship("Hazard", back_populates="status_history")
    changer = relationship("User")
