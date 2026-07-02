"""Helpers for the httpOnly auth cookie.

The frontend stores its session in a ``SameSite=Lax`` httpOnly cookie
named ``access_token``. ``Lax`` is sufficient for the deployment shape
(front-end and API are served from the same origin via the Nginx
reverse proxy, both locally and in production), so we do not also
implement a double-submit CSRF token.

``Secure`` is set whenever ``ENV`` is ``production`` or ``staging``;
``localhost`` would otherwise reject the cookie on http.
"""
from fastapi import Response

from app.core.config import settings

COOKIE_NAME = "access_token"
_MAX_AGE_SECONDS = 60 * 60 * 8  # matches ACCESS_TOKEN_EXPIRE_MINUTES


def set_auth_cookie(response: Response, token: str) -> None:
    is_prod = settings.ENV in ("production", "staging")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=_MAX_AGE_SECONDS,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    is_prod = settings.ENV in ("production", "staging")
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=is_prod,
        samesite="lax",
        httponly=True,
    )
