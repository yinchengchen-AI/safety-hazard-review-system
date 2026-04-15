import pytest


@pytest.mark.asyncio
async def test_list_users(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_user(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    response = await client.post(
        "/api/v1/users",
        json={"username": "testuser", "password": "testpass", "role": "inspector", "full_name": "测试用户", "phone": "13800138000"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "testuser"
    assert data["role"] == "inspector"
    assert data["full_name"] == "测试用户"
    assert data["phone"] == "13800138000"


@pytest.mark.asyncio
async def test_update_user(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    create = await client.post(
        "/api/v1/users",
        json={"username": "updateuser", "password": "testpass", "role": "inspector"},
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = create.json()["id"]

    response = await client.put(
        f"/api/v1/users/{user_id}",
        json={"role": "admin", "full_name": "更新姓名", "phone": "13900139000"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"
    assert data["full_name"] == "更新姓名"
    assert data["phone"] == "13900139000"


@pytest.mark.asyncio
async def test_reset_password(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    create = await client.post(
        "/api/v1/users",
        json={"username": "resetuser", "password": "oldpass", "role": "inspector"},
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = create.json()["id"]

    response = await client.post(
        f"/api/v1/users/{user_id}/reset-password",
        json={"new_password": "newpass123"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    login_new = await client.post(
        "/api/v1/auth/login",
        data={"username": "resetuser", "password": "newpass123"},
    )
    assert login_new.status_code == 200


@pytest.mark.asyncio
async def test_delete_user(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    create = await client.post(
        "/api/v1/users",
        json={"username": "deleteuser", "password": "testpass", "role": "inspector"},
        headers={"Authorization": f"Bearer {token}"},
    )
    user_id = create.json()["id"]

    response = await client.delete(
        f"/api/v1/users/{user_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204

    login_after = await client.post(
        "/api/v1/auth/login",
        data={"username": "deleteuser", "password": "testpass"},
    )
    assert login_after.status_code == 401


@pytest.mark.asyncio
async def test_search_users(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/users?keyword=admin",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert all("admin" in u["username"] for u in data["items"])
