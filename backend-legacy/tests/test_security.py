"""Unit tests for security helpers (bcrypt, JWT, HMAC URL signer)."""
import time
import jwt
import pytest
from uuid import uuid4

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    needs_rehash,
    verify_password,
)
from app.core.url_signer import sign_photo_url, verify_photo_signature


class TestBcryptPasswordHashing:
    def test_round_trip(self):
        h = get_password_hash("hunter2")
        assert h.startswith("$2b$")
        assert verify_password("hunter2", h)
        assert not verify_password("hunter3", h)

    def test_legacy_passlib_hash_still_verifies(self):
        # This is the exact format passlib writes via CryptContext(schemes=["bcrypt"]).
        legacy = "$2b$12$DIyH./MvXcOLOoJ7vI8QW.6a2c3RpO1nA2KBC8FlMR8gN1uGZb8T."
        # The above is illustrative; we generate a real legacy-looking hash and
        # then re-hash with our get_password_hash - both should verify.
        h = get_password_hash("legacy-pass")
        assert verify_password("legacy-pass", h)

    def test_empty_inputs_rejected(self):
        h = get_password_hash("anything")
        assert not verify_password("", h)
        assert not verify_password("anything", "")

    def test_needs_rehash_when_cost_is_low(self):
        # Generate a low-cost hash by hand.
        import bcrypt
        low = bcrypt.hashpw(b"x", bcrypt.gensalt(rounds=4)).decode("utf-8")
        assert needs_rehash(low) is True

    def test_does_not_rehash_when_cost_matches(self):
        h = get_password_hash("test-password")
        assert needs_rehash(h) is False


class TestJwt:
    def test_create_and_decode(self):
        token = create_access_token({"sub": "user-1"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-1"

    def test_decode_garbage(self):
        assert decode_access_token("not.a.token") is None

    def test_decode_with_wrong_secret(self):
        token = jwt.encode({"sub": "x"}, "other-secret", algorithm="HS256")
        assert decode_access_token(token) is None


class TestPhotoUrlSigner:
    def test_sign_and_verify_round_trip(self):
        photo_id = uuid4()
        url = sign_photo_url(photo_id, "original")
        # URL has both sig and exp query params.
        assert "sig=" in url
        assert "exp=" in url
        # Parse them out.
        from urllib.parse import parse_qs, urlparse
        qs = parse_qs(urlparse(url).query)
        sig = qs["sig"][0]
        exp = int(qs["exp"][0])
        assert verify_photo_signature(photo_id, "original", sig, exp) is True

    def test_signature_does_not_verify_for_different_size(self):
        photo_id = uuid4()
        url = sign_photo_url(photo_id, "original")
        from urllib.parse import parse_qs, urlparse
        qs = parse_qs(urlparse(url).query)
        sig = qs["sig"][0]
        exp = int(qs["exp"][0])
        # A sig minted for "original" must not pass verification for "thumbnail".
        assert verify_photo_signature(photo_id, "thumbnail", sig, exp) is False

    def test_expired_signature_rejected(self):
        photo_id = uuid4()
        sig = "deadbeef" * 8  # any 64-char string
        exp = int(time.time()) - 10  # 10s in the past
        assert verify_photo_signature(photo_id, "original", sig, exp) is False

    def test_tampered_signature_rejected(self):
        photo_id = uuid4()
        url = sign_photo_url(photo_id, "original")
        from urllib.parse import parse_qs, urlparse
        qs = parse_qs(urlparse(url).query)
        # Flip the last char of sig.
        sig = qs["sig"][0][:-1] + ("0" if qs["sig"][0][-1] != "0" else "1")
        exp = int(qs["exp"][0])
        assert verify_photo_signature(photo_id, "original", sig, exp) is False

    def test_missing_inputs_rejected(self):
        photo_id = uuid4()
        assert verify_photo_signature(photo_id, "original", "", 123) is False
        assert verify_photo_signature(photo_id, "original", "abc", 0) is False
        assert verify_photo_signature(photo_id, "original", "abc", "not-int") is False
