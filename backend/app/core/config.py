from pydantic_settings import BaseSettings
from typing import Optional
import secrets


# Generate a strong random default secret at import time.
# It is still recommended to override this via environment variable in production.
_DEFAULT_SECRET_KEY = secrets.token_urlsafe(32)


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/safety_hazard"
    REDIS_URL: str = "redis://localhost:6379/0"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "hazard-photos"
    MINIO_SECURE: bool = False

    SECRET_KEY: str = _DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Security
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # Development only: set to True to auto-create tables on startup.
    # In production, use Alembic migrations instead.
    AUTO_CREATE_TABLES: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
