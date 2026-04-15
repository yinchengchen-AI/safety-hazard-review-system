from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import engine, Base
from app.routers import auth, users, enterprises, batches, hazards, review_tasks, photos, reports, statistics


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="Safety Hazard Review System",
    description="安全生产隐患复核系统",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(enterprises.router, prefix="/api/v1/enterprises", tags=["enterprises"])
app.include_router(batches.router, prefix="/api/v1/batches", tags=["batches"])
app.include_router(hazards.router, prefix="/api/v1/hazards", tags=["hazards"])
app.include_router(review_tasks.router, prefix="/api/v1/review-tasks", tags=["review-tasks"])
app.include_router(photos.router, prefix="/api/v1/photos", tags=["photos"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(statistics.router, prefix="/api/v1/statistics", tags=["statistics"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
