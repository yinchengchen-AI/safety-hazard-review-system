import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Enterprise(Base):
    __tablename__ = "enterprises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    credit_code = Column(String(50), nullable=True)
    region = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)
    contact_person = Column(String(100), nullable=True)
    industry_sector = Column(String(100), nullable=True)
    enterprise_type = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(ZoneInfo("Asia/Shanghai")))
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    hazards = relationship("Hazard", back_populates="enterprise")
