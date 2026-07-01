import uuid
from sqlalchemy import select
from app.models import Report
from app.tasks.report_tasks import generate_report_task


class ReportOrchestrationService:
    """Coordinates the lifecycle of a Report row for a ReviewTask.

    Idempotent w.r.t. enqueueing: a task that already has a ``pending``
    or ``processing`` report is left alone. A ``failed`` report is reset
    to ``pending`` so the operator can re-trigger generation without
    manual DB surgery. A ``completed`` report is regenerated only when
    ``force=True`` is passed (used by the manual ``POST /reports/.../generate``
    endpoint); automatic callers (``complete_task``) skip it.
    """

    def __init__(self, db):
        self.db = db

    async def create_and_enqueue(self, task_id: uuid.UUID, *, force: bool = False) -> None:
        result = await self.db.execute(
            select(Report).where(Report.task_id == task_id)
        )
        report = result.scalar_one_or_none()
        if report is None:
            report = Report(task_id=task_id, status="pending")
            self.db.add(report)
            await self.db.commit()
        elif report.status in ("pending", "processing"):
            # Already in flight; do not enqueue a duplicate Celery job.
            return
        elif report.status == "failed":
            # Reset so a re-trigger actually runs.
            report.status = "pending"
            report.error_message = None
            await self.db.commit()
        elif report.status == "completed" and not force:
            # Auto-triggered path: nothing to do.
            return
        # Fall-through: pending (new/reset) or completed+force -> enqueue.
        generate_report_task.delay(str(task_id))
