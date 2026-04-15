import asyncio
from app.tasks.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.services.report_service import ReportService


@celery_app.task(name="app.tasks.report_tasks.generate_report_task", bind=True, max_retries=3)
def generate_report_task(self, task_id: str):
    async def _run():
        async with AsyncSessionLocal() as db:
            service = ReportService(db)
            await service.generate_report(task_id)

    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
