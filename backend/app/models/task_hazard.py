import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class TaskHazard(Base):
    __tablename__ = "task_hazards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("review_tasks.id"), nullable=False)
    hazard_id = Column(UUID(as_uuid=True), ForeignKey("hazards.id"), nullable=False)
    conclusion = Column(String, nullable=True)
    status_in_task = Column(String(20), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    task = relationship("ReviewTask", back_populates="task_hazards")
    hazard = relationship("Hazard", back_populates="task_hazards")
    reviewer = relationship("User")
    photos = relationship("Photo", back_populates="task_hazard", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("task_id", "hazard_id", name="uix_task_hazard"),
    )
