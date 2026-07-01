"""Password hashing and JWT helpers.

We use the ``bcrypt`` library directly (not ``passlib``) because passlib
1.7.4 is unmaintained and has known compatibility issues with newer
``bcrypt`` releases. The hash format produced is identical to what
passlib used to write (``$2b$``), so old hashes continue to verify.

When ``verify_password`` is called and the supplied hash is using an older
cost factor, the caller (typically the login route) is expected to rehash
the plaintext and persist the new value. See ``auth.login``.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional
import bcrypt
import jwt
from app.core.config import settings


# Cost factor for new hashes. 12 is the bcrypt library default and matches
# what passlib used to default to. Old hashes with a lower cost remain
# valid for verification; ``needs_rehash`` is used to upgrade them.
_BCRYPT_ROUNDS = 12


def get_password_hash(password: str) -> str:
    """Return a bcrypt hash of ``password``.

    bcrypt has a 72-byte input limit; we truncate defensively to avoid a
    silent error in the caller.
    """
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True iff ``plain_password`` matches ``hashed_password``.

    Supports legacy ``$2a$/$2b$/$2y$`` passlib hashes as well as new hashes
    produced by this module.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except (ValueError, TypeError):
        # Malformed hash (not a bcrypt format) - treat as failed match.
        return False


def _parse_cost_factor(hashed_password: str) -> Optional[int]:
    """Extract the bcrypt cost factor from a hash string.

    Format is ``$<algo>$<cost>$<22-char-salt><hash>``, e.g. ``$2b$12$...``.
    Returns None if the hash is not in a recognised bcrypt format.
    """
    parts = hashed_password.split("$")
    if len(parts) < 4:
        return None
    try:
        return int(parts[2])
    except (TypeError, ValueError):
        return None


def needs_rehash(hashed_password: str) -> bool:
    """Return True if the hash should be re-derived with the current cost.

    The login route rehashes the plaintext and persists the new value on
    the next successful authentication so that over time the whole user
    base migrates to the current cost factor without an admin operation.
    """
    cost = _parse_cost_factor(hashed_password)
    if cost is None:
        # Unrecognised format - safest to rehash on next login.
        return True
    return cost < _BCRYPT_ROUNDS


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Mint a JWT with the configured algorithm and secret."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(ZoneInfo("Asia/Shanghai")) + expires_delta
    else:
        expire = (
            datetime.now(ZoneInfo("Asia/Shanghai"))
            + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Return the decoded payload or None on any verification error."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None
