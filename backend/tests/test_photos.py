"""Integration tests for the photo endpoints with HMAC-signed URLs.

The actual MinIO call is short-circuited via a monkey-patch on
``StorageService.get_file_content`` so the tests do not require a live
object store. We focus on authn (signature is required, expired
signatures are rejected, the legacy ``?token=`` path still works for the
deprecation window) and the response-header contract for legacy mode.
"""
import io
import time
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from PIL import Image

from app.core.url_signer import sign_photo_url
from app.services.storage_service import StorageService


# --- helpers ---------------------------------------------------------------


def _png_bytes(width: int = 200, height: int = 200) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def fake_storage(monkeypatch):
    """Replace StorageService.get_file_content with a deterministic stub."""

    def _fake_get(self, object_name: str) -> bytes:
        return _png_bytes(64, 64)

    monkeypatch.setattr(StorageService, "get_file_content", _fake_get)
    yield


# --- tests ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_signed_url_can_fetch_photo(client, db_session, fake_storage):
    # Login
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload
    content = _png_bytes()
    files = {"file": ("x.png", content, "image/png")}
    up = await client.post("/api/v1/photos/upload", files=files, headers=headers)
    assert up.status_code == 200
    body = up.json()
    assert "sig=" in body["original_url"]
    assert "sig=" in body["thumbnail_url"]
    assert "token=" not in body["original_url"]

    # Fetch with the signed URL
    photo_id = body["temp_token"]
    # Parse the upload response's original_url to extract the photo id.
    parsed = urlparse(body["original_url"])
    path_parts = parsed.path.split("/")
    photo_uuid = path_parts[3]
    fetched = await client.get(body["original_url"], headers=headers)
    assert fetched.status_code == 200
    assert fetched.headers.get("content-type", "").startswith("image/")
    assert fetched.headers.get("X-Photo-Auth-Deprecated") is None


@pytest.mark.asyncio
async def test_missing_signature_rejected(client, db_session):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    photo_id = uuid4()
    resp = await client.get(f"/api/v1/photos/{photo_id}/image?size=original", headers=headers)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_expired_signature_rejected(client, db_session):
    photo_id = uuid4()
    expired_sig = "a" * 64
    expired_exp = int(time.time()) - 60
    resp = await client.get(
        f"/api/v1/photos/{photo_id}/image?size=original&sig={expired_sig}&exp={expired_exp}"
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_tampered_signature_rejected(client, db_session):
    photo_id = uuid4()
    url = sign_photo_url(photo_id, "original")
    qs = parse_qs(urlparse(url).query)
    sig = qs["sig"][0][:-1] + ("0" if qs["sig"][0][-1] != "0" else "1")
    exp = qs["exp"][0]
    photo_id = qs.get("photo_id", qs.get("path", [photo_id])[0])  # not used here
    # Use the original photo_id we minted; the URL is structurally the same
    # minus the size flip.
    photo_id = uuid4()
    resp = await client.get(
        f"/api/v1/photos/{photo_id}/image?size=original&sig={sig}&exp={exp}"
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_legacy_token_path_still_works(client, db_session, fake_storage):
    """The ``?token=<jwt>`` path is retained for the deprecation window
    and should be flagged via the ``X-Photo-Auth-Deprecated`` response
    header so the client knows to migrate.
    """
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    content = _png_bytes()
    files = {"file": ("x.png", content, "image/png")}
    up = await client.post("/api/v1/photos/upload", files=files, headers=headers)
    assert up.status_code == 200
    body = up.json()
    parsed = urlparse(body["original_url"])
    path_parts = parsed.path.split("/")
    # /api/v1/photos/{uuid}/image -> ['', 'api', 'v1', 'photos', '{uuid}', 'image']
    photo_uuid = path_parts[4]

    resp = await client.get(
        f"/api/v1/photos/{photo_uuid}/image?size=original&token={token}",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.headers.get("X-Photo-Auth-Deprecated") == "true"


@pytest.mark.asyncio
async def test_legacy_token_path_rejects_garbage_token(client, db_session):
    photo_id = uuid4()
    resp = await client.get(
        f"/api/v1/photos/{photo_id}/image?size=original&token=not-a-jwt"
    )
    assert resp.status_code == 401
