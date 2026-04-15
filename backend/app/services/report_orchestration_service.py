import uuid
from sqlalchemy.exc import IntegrityError
from app.models import Report
from app.tasks.report_tasks import generate_report_task


class ReportOrchestrationService:
    def __init__(self, db):
        self.db = db

    async def create_and_enqueue(self, task_id: uuid.UUID) -> None:
        report = Report(task_id=task_id, status="pending")
        self.db.add(report)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
        generate_report_task.delay(str(task_id))
