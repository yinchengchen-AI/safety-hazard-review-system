from pydantic import BaseModel
from typing import Optional
from uuid import UUID


class EnterpriseStatistics(BaseModel):
    enterprise_id: UUID
    enterprise_name: str
    total_hazards: int
    pending_count: int
    passed_count: int
    failed_count: int
    review_count: int
    coverage_rate: float = 0.0
    pass_rate: float = 0.0


class BatchStatistics(BaseModel):
    batch_id: UUID
    batch_name: str
    total_hazards: int
    reviewed_count: int
    passed_count: int
    failed_count: int
    coverage_rate: float
    pass_rate: float


class InspectorStatistics(BaseModel):
    inspector_id: UUID
    inspector_name: str
    task_count: int
    reviewed_hazard_count: int


class TrendPoint(BaseModel):
    period: str
    total_hazards: int
    pending_count: int
    passed_count: int
    failed_count: int
    review_count: int
    task_count: int
    coverage_rate: float = 0.0
    pass_rate: float = 0.0


class ReportingUnitStatistics(BaseModel):
    reporting_unit: str
    total_hazards: int
    pending_count: int
    passed_count: int
    failed_count: int
    review_count: int


class OverviewStatistics(BaseModel):
    total_hazards: int
    pending_count: int
    passed_count: int
    failed_count: int
    review_count: int
    task_count: int
    coverage_rate: float = 0.0
    pass_rate: float = 0.0


class TrendStatistics(BaseModel):
    points: list[TrendPoint]
