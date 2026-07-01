import pytest


@pytest.mark.asyncio
async def test_login_success(client):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_failure(client):
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "wrong", "password": "wrong"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_endpoint(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "admin"
    # The /me endpoint should also surface the is_active flag.
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_disabled_user_cannot_authenticate(client, db_session):
    """An account with ``is_active=False`` must be rejected at login,
    and any previously-minted token must be rejected by /me.
    """
    from sqlalchemy import update
    from app.models import User
    from tests.conftest import TestingSessionLocal
    await db_session.execute(update(User).where(User.username == "admin").values(is_active=False))
    await db_session.commit()

    # Fresh login attempt is rejected.
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert response.status_code == 401

    # Restore for downstream tests.
    await db_session.execute(update(User).where(User.username == "admin").values(is_active=True))
    await db_session.commit()


@pytest.mark.asyncio
async def test_login_rate_limit(client):
    """slowapi is configured at 5/minute. The 6th failed login within
    the same window must come back 429, not 401, because the limiter
    short-circuits before the route handler.
    """
    for i in range(5):
        r = await client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "wrong"},
        )
        # The first 5 are rejected as bad credentials.
        assert r.status_code == 401, f"attempt {i+1} expected 401, got {r.status_code}"
    # The 6th attempt hits the limiter.
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "wrong"},
    )
    assert r.status_code == 429, f"expected 429 on 6th attempt, got {r.status_code}"


@pytest.mark.asyncio
async def test_password_rehash_on_login(client, db_session):
    """Successful login should detect a legacy cost-factor and upgrade it.
    We hand-craft a hash with cost 4, then log in and confirm the stored
    hash is now cost 12.
    """
    import bcrypt
    from sqlalchemy import select
    from app.models import User
    from tests.conftest import TestingSessionLocal

    legacy_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(rounds=4)).decode("utf-8")
    await db_session.execute(
        # In case the prior test changed the hash, force a known legacy one.
        __import__("sqlalchemy").text(
            "UPDATE users SET password_hash = :h WHERE username = 'admin'"
        ),
        {"h": legacy_hash},
    )
    await db_session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert resp.status_code == 200

    # The hash on disk should now be at the current cost (12). Read via a
    # fresh connection so we do not rely on session-level caches.
    from sqlalchemy import text
    async with TestingSessionLocal() as fresh:
        result = await fresh.execute(text("SELECT password_hash FROM users WHERE username = :u"), {"u": "admin"})
        h = result.scalar_one()
    parts = h.split("$")
    cost = int(parts[2])
    assert cost >= 12
