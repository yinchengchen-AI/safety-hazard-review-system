from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "safety_hazard",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.report_tasks", "app.tasks.photo_cleanup_tasks", "app.tasks.notification_cleanup_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "cleanup-old-notifications": {
            "task": "app.tasks.notification_cleanup_tasks.cleanup_old_notifications",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)
