"""Application configuration loaded from environment variables.

The Settings object is the single source of truth for runtime config.
Production-like environments (``staging`` / ``production``) refuse to start
with a weak or default ``SECRET_KEY``; dev and test get a per-process random
secret so the application boots without manual setup.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import os
import secrets


# The documented insecure default. Keep this string stable: it is referenced
# by tests and by the production guard below.
_INSECURE_DEV_FALLBACK = "your-secret-key-change-in-production"
_MIN_SECRET_KEY_LENGTH = 32
_PROD_ENVS = {"production", "staging"}


def _default_secret_for(env: str) -> str:
    """Pick the SECRET_KEY default appropriate for the runtime environment.

    - In production-like envs we still return the insecure placeholder so the
      validator can detect it and refuse to boot.
    - In dev/test we mint a per-process random secret so that ``uvicorn`` and
      ``pytest`` both boot without requiring an explicit ``.env`` file. The
      randomness is per-process, which is acceptable for local development.
    """
    if env in _PROD_ENVS:
        return _INSECURE_DEV_FALLBACK
    return secrets.token_urlsafe(32)


class Settings(BaseSettings):
    # Runtime environment. One of: "dev", "test", "staging", "production".
    ENV: str = "dev"

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/safety_hazard"
    REDIS_URL: str = "redis://localhost:6379/0"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "hazard-photos"
    MINIO_SECURE: bool = False

    # In dev/test the default is a per-process random value (see
    # ``_default_secret_for``). In production-like envs it is the documented
    # insecure placeholder, which the validator below will reject.
    SECRET_KEY: str = _default_secret_for(os.environ.get("ENV", "dev"))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # Development only: set to True to auto-create tables on startup.
    # In production, use Alembic migrations instead.
    AUTO_CREATE_TABLES: bool = False

    # Photo URL HMAC signature lifetime, in seconds. Default: 15 minutes.
    PHOTO_SIGNATURE_TTL: int = 900

    # Login rate limit (per remote address). slowapi syntax: "<count>/<period>".
    LOGIN_RATE_LIMIT: str = "5/minute"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, v: str, info) -> str:
        env = info.data.get("ENV", "dev")
        if env in _PROD_ENVS:
            if v == _INSECURE_DEV_FALLBACK:
                raise ValueError(
                    "SECRET_KEY is set to the documented insecure fallback. "
                    "Generate a real one with: openssl rand -hex 32"
                )
            if len(v) < _MIN_SECRET_KEY_LENGTH:
                raise ValueError(
                    f"SECRET_KEY must be at least {_MIN_SECRET_KEY_LENGTH} "
                    f"characters in {env} (got {len(v)})"
                )
        # In dev/test we accept any value (including the placeholder) so the
        # developer does not have to mint a secret just to run pytest.
        return v

    @field_validator("ENV")
    @classmethod
    def _validate_env(cls, v: str) -> str:
        allowed = {"dev", "test", "staging", "production"}
        if v not in allowed:
            raise ValueError(f"ENV must be one of {sorted(allowed)}, got {v!r}")
        return v


settings = Settings()
