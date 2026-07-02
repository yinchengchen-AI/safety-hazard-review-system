"""HMAC-based signing for short-lived photo access URLs.

Photos are served from a backend endpoint that requires a signature in
query parameters. The signature is computed over a canonical payload
(``photo_id | size | exp``) using ``SECRET_KEY`` as the HMAC key, with a
default TTL of 15 minutes. The benefit over the previous design (JWT in
the query string) is that the token no longer lives in browser history,
server access logs, or the ``Referer`` header.
"""
import hmac
import hashlib
import time
from typing import Optional
from urllib.parse import urlencode
from uuid import UUID

from app.core.config import settings


def _canonical_payload(photo_id: UUID, size: str, exp: int) -> bytes:
    # Use a delimiter that is illegal in UUIDs and unlikely to appear in ``size``.
    return f"{photo_id}|{size}|{exp}".encode("utf-8")


def _sign(payload: bytes) -> str:
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return digest


def sign_photo_url(photo_id: UUID, size: str, ttl: Optional[int] = None) -> str:
    """Return a relative URL with ``sig`` and ``exp`` query parameters.

    The caller embeds the result directly in HTML/JSON; the client uses
    it as-is to fetch the image.
    """
    if ttl is None:
        ttl = settings.PHOTO_SIGNATURE_TTL
    exp = int(time.time()) + ttl
    sig = _sign(_canonical_payload(photo_id, size, exp))
    return f"/api/v1/photos/{photo_id}/image?size={size}&exp={exp}&sig={sig}"


def verify_photo_signature(
    photo_id: UUID,
    size: str,
    sig: str,
    exp: int,
) -> bool:
    """Return True iff the supplied signature matches and has not expired."""
    if not sig or not exp:
        return False
    try:
        exp_int = int(exp)
    except (TypeError, ValueError):
        return False
    if exp_int < int(time.time()):
        return False
    expected = _sign(_canonical_payload(photo_id, size, exp_int))
    # Constant-time comparison to prevent timing oracles.
    return hmac.compare_digest(expected, sig)


def build_legacy_token_url(photo_id: UUID, size: str, token: str) -> str:
    """Build the legacy ``?token=<jwt>`` URL for the deprecation period.

    This is here so the migration code in ``photos`` and ``review_tasks``
    has a single place to construct the fallback URL.
    """
    sep = "&" if "?" in size else "?"
    return f"/api/v1/photos/{photo_id}/image?size={size}{sep}token={token}"
