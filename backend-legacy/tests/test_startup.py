"""Tests for the ``assert_safe_for_runtime`` startup guard.

These tests build a Settings object in isolation and then call the
guard against the test session maker (which has the seeded admin/admin123
account). The guard is the production gate; we exercise both branches.
"""
import pytest_asyncio
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.startup_checks import assert_safe_for_runtime


def _make_settings(env: str, secret_key: str) -> Settings:
    """Build a Settings instance with the validation logic that matches
    the production guard.
    """
    return Settings(ENV=env, SECRET_KEY=secret_key)


class TestSecretKeyValidation:
    def test_insecure_default_rejected_in_production(self):
        with pytest.raises(ValidationError):
            _make_settings(env="production", secret_key="your-secret-key-change-in-production")

    def test_short_key_rejected_in_production(self):
        with pytest.raises(ValidationError):
            _make_settings(env="production", secret_key="too-short")

    def test_strong_key_accepted_in_production(self):
        s = _make_settings(env="production", secret_key="x" * 32)
        assert s.ENV == "production"

    def test_insecure_default_allowed_in_dev(self):
        s = _make_settings(env="dev", secret_key="your-secret-key-change-in-production")
        assert s.ENV == "dev"

    def test_invalid_env_value_rejected(self):
        with pytest.raises(ValidationError):
            _make_settings(env="staging-not-real", secret_key="x" * 32)


@pytest_asyncio.fixture
async def session_maker():
    # Re-use the test session maker from conftest via import.
    from tests.conftest import TestingSessionLocal
    yield TestingSessionLocal


@pytest.mark.asyncio
async def test_default_admin_blocks_production_startup(session_maker):
    settings = Settings(ENV="production", SECRET_KEY="x" * 32)
    with pytest.raises(RuntimeError, match="default admin"):
        await assert_safe_for_runtime(settings, session_maker)


@pytest.mark.asyncio
async def test_default_admin_only_warns_in_dev(session_maker, caplog):
    settings = Settings(ENV="dev", SECRET_KEY="x" * 32)
    import logging
    with caplog.at_level(logging.WARNING, logger="app.core.startup_checks"):
        await assert_safe_for_runtime(settings, session_maker)
    # In dev we expect a warning, not a raised error.
    assert any("default admin" in rec.message for rec in caplog.records)
