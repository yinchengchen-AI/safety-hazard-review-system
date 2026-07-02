import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.tasks.celery_app import celery_app
from app.core.config import settings
from app.services.report_service import ReportService


@celery_app.task(name="app.tasks.report_tasks.generate_report_task", bind=True, max_retries=3)
def generate_report_task(self, task_id: str):
    async def _run():
        database_url = settings.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
        engine = create_async_engine(database_url, echo=False, future=True)
        AsyncSessionLocal = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
        )
        try:
            async with AsyncSessionLocal() as db:
                service = ReportService(db)
                await service.generate_report(task_id)
        finally:
            await engine.dispose()

    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
