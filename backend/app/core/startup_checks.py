"""Runtime safety checks performed during application startup.

In ``production`` / ``staging`` environments we refuse to boot when:
  - The default admin / admin123 account is still present in the database.

In any environment we also surface a warning when the default admin
account exists (so the operator can see it in dev too), but only
production halts. The check runs against a freshly opened session, not
the request-bound session, so it works in the FastAPI lifespan hook
before any request handling.
"""
import logging
from typing import Callable, Awaitable

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.core.config import Settings
from app.core.security import get_password_hash, verify_password
from app.models import User


logger = logging.getLogger(__name__)

# Hash of the documented insecure default password. We compare against the
# stored hash, not the plaintext, so we do not leak the password through
# the auth flow during the check.
_DEFAULT_PASSWORD_PLAINTEXT = "admin123"
_DEFAULT_USERNAME = "admin"
_PROD_ENVS = {"production", "staging"}


async def _default_admin_present(session_maker: async_sessionmaker) -> bool:
    """Return True if a user named ``admin`` exists with the default password."""
    async with session_maker() as session:
        result = await session.execute(
            select(User).where(User.username == _DEFAULT_USERNAME, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is None:
            return False
        return verify_password(_DEFAULT_PASSWORD_PLAINTEXT, user.password_hash)


async def assert_safe_for_runtime(
    settings: Settings,
    session_maker: async_sessionmaker,
) -> None:
    """Verify that the application may run in the configured environment.

    Raises ``RuntimeError`` on any blocking condition (currently: default
    admin password in a production-like env). Non-blocking issues are
    logged at WARNING level.
    """
    env = settings.ENV
    is_prod = env in _PROD_ENVS

    if is_prod:
        try:
            still_default = await _default_admin_present(session_maker)
        except Exception as exc:  # noqa: BLE001
            # Database not reachable yet - the lifespan hook will surface
            # that error separately. Don't double-report.
            logger.warning("startup_checks: could not query users table: %s", exc)
            return
        if still_default:
            raise RuntimeError(
                f"Refusing to start in {env!r} with the default admin/{_DEFAULT_PASSWORD_PLAINTEXT} "
                "account. Change the password (e.g. via the API or a one-off script) "
                "and restart."
            )
    else:
        try:
            still_default = await _default_admin_present(session_maker)
        except Exception:  # noqa: BLE001
            return
        if still_default:
            logger.warning(
                "startup_checks: default admin/%s account is still present (ENV=%s). "
                "Change the password before deploying to production.",
                _DEFAULT_PASSWORD_PLAINTEXT,
                env,
            )
