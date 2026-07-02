"""Shared ``slowapi`` Limiter instance.

A single ``Limiter`` is created at module import time and reused by both
the FastAPI middleware (``app.main``) and route decorators
(``routers.auth``). Tests override ``limiter._storage`` with a
``MemoryStorage`` instance to keep state local.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL,
    # The default headers emit `X-RateLimit-Limit` etc. on every response,
    # which we do not need - keep noise low.
    headers_enabled=False,
)
