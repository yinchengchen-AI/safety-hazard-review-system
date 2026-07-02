from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from contextlib import asynccontextmanager

from app.core.database import engine, Base, AsyncSessionLocal
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.startup_checks import assert_safe_for_runtime
from app.routers import auth, users, enterprises, batches, hazards, review_tasks, photos, reports, statistics, audit_logs, notifications
from app.core.exception_handlers import AuditableHTTPException, audit_exception_handler
from app.services.storage_service import ensure_bucket


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Make sure the MinIO bucket exists before the first upload. The MinIO
    # client is sync, so we off-load to a worker thread to keep the
    # event loop free.
    import asyncio
    await asyncio.to_thread(ensure_bucket)

    # Block production boots with default credentials / weak secrets.
    await assert_safe_for_runtime(settings, AsyncSessionLocal)

    yield
    await engine.dispose()


app = FastAPI(
    title="Safety Hazard Review System",
    description="安全生产隐患复核系统",
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiter state - the middleware reads this attribute.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Tighten CORS to the actual surface we expose. Origins are still
# controlled by ``ALLOWED_ORIGINS`` (comma-separated).
_allowed_origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(enterprises.router, prefix="/api/v1/enterprises", tags=["enterprises"])
app.include_router(batches.router, prefix="/api/v1/batches", tags=["batches"])
app.include_router(hazards.router, prefix="/api/v1/hazards", tags=["hazards"])
app.include_router(review_tasks.router, prefix="/api/v1/review-tasks", tags=["review-tasks"])
app.include_router(photos.router, prefix="/api/v1/photos", tags=["photos"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(statistics.router, prefix="/api/v1/statistics", tags=["statistics"])
app.include_router(audit_logs.router, prefix="/api/v1/audit-logs", tags=["audit-logs"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])

# Custom exception handler for auditable failures (e.g. login failures).
app.add_exception_handler(AuditableHTTPException, audit_exception_handler)


@app.get("/health")
async def health_check():
    return {"status": "ok"}
