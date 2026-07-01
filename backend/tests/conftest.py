"""Shared pytest fixtures for the safety hazard backend.

The test suite runs against a real PostgreSQL instance using
``postgresql+asyncpg://postgres:postgres@localhost:5433/safety_hazard_test``.
The ``setup_database`` fixture drops and recreates the schema once per
session so tests can mutate freely. The ``seed_admin_user`` fixture
inserts the standard ``admin`` / ``admin123`` account.

Rate limiting (slowapi) is switched to an in-process memory store so the
test runner does not require a live Redis. The store is reset between
tests via the ``_reset_limiter`` fixture.
"""
import asyncio
import os

# Force the test environment BEFORE any ``app.*`` import so the settings
# object picks up the relaxed validation rules.
os.environ.setdefault("ENV", "test")

import pytest_asyncio  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool  # noqa: E402
from sqlalchemy import text  # noqa: E402
from limits.storage import MemoryStorage  # noqa: E402

from app.main import app  # noqa: E402
from app.core.database import Base, get_db  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.models import User  # noqa: E402
from app.services.storage_service import ensure_bucket  # noqa: E402

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5433/safety_hazard_test"

engine = create_async_engine(TEST_DATABASE_URL, echo=False, future=True, poolclass=NullPool)
TestingSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


# Swap the slowapi storage to an in-process memory backend so tests
# don't depend on Redis. We keep the production key_func (IP-based).
# Swap the limiter's storage to in-process memory so the test runner
# does not need a live Redis. We keep the key_func (IP) intact.
limiter._storage = MemoryStorage()
limiter._storage_uri = "memory://"
limiter._storage_options = {}
limiter._limiter.storage = limiter._storage


@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    # The lifespan hook creates the MinIO bucket in production; tests
    # do not run the lifespan, so create it here.
    try:
        ensure_bucket()
    except Exception as exc:  # noqa: BLE001
        import warnings
        warnings.warn(f"conftest: failed to create MinIO bucket: {exc}")
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _reset_limiter():
    """Reset the slowapi memory store before each test so the
    5/minute login limit does not leak across tests."""
    if hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        try:
            limiter._storage.reset()
        except Exception:
            pass
    yield


@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    c = AsyncClient(transport=transport, base_url="http://test")
    yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def seed_admin_user(setup_database):
    async with TestingSessionLocal() as session:
        await session.execute(text("DELETE FROM users WHERE username = 'admin'"))
        user = User(
            username="admin",
            password_hash=get_password_hash("admin123"),
            role="admin",
            is_active=True,
        )
        session.add(user)
        await session.commit()
    yield
