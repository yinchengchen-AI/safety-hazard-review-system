import pytest
import uuid


@pytest.mark.asyncio
async def test_create_enterprise(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    unique = str(uuid.uuid4())[:8]

    response = await client.post(
        "/api/v1/enterprises",
        json={
            "name": f"创建测试企业-{unique}",
            "credit_code": f"911100001234567{unique}",
            "region": "北京市",
            "address": "北京市朝阳区测试路1号",
            "contact_person": "张三",
            "industry_sector": "制造业",
            "enterprise_type": "有限责任公司",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == f"创建测试企业-{unique}"
    assert data["credit_code"] == f"911100001234567{unique}"
    assert data["region"] == "北京市"


@pytest.mark.asyncio
async def test_list_enterprises(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    unique = str(uuid.uuid4())[:8]

    # Create first
    await client.post(
        "/api/v1/enterprises",
        json={"name": f"列表测试企业-{unique}", "region": "上海市"},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = await client.get(
        "/api/v1/enterprises?page=1&page_size=10",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


@pytest.mark.asyncio
async def test_search_enterprises(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    unique = str(uuid.uuid4())[:8]

    await client.post(
        "/api/v1/enterprises",
        json={"name": f"搜索专用企业-{unique}", "region": "广州市"},
        headers={"Authorization": f"Bearer {token}"},
    )

    response = await client.get(
        f"/api/v1/enterprises?keyword={unique}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert any(unique in e["name"] for e in data["items"])


@pytest.mark.asyncio
async def test_get_enterprise(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    unique = str(uuid.uuid4())[:8]

    create = await client.post(
        "/api/v1/enterprises",
        json={"name": f"详情测试企业-{unique}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    enterprise_id = create.json()["id"]

    response = await client.get(
        f"/api/v1/enterprises/{enterprise_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == f"详情测试企业-{unique}"


@pytest.mark.asyncio
async def test_update_enterprise(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    unique = str(uuid.uuid4())[:8]

    create = await client.post(
        "/api/v1/enterprises",
        json={"name": f"更新前企业-{unique}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    enterprise_id = create.json()["id"]

    response = await client.put(
        f"/api/v1/enterprises/{enterprise_id}",
        json={"name": f"更新后企业-{unique}", "region": "深圳市"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == f"更新后企业-{unique}"
    assert data["region"] == "深圳市"


@pytest.mark.asyncio
async def test_delete_enterprise(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    unique = str(uuid.uuid4())[:8]

    create = await client.post(
        "/api/v1/enterprises",
        json={"name": f"待删除企业-{unique}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    enterprise_id = create.json()["id"]

    response = await client.delete(
        f"/api/v1/enterprises/{enterprise_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 204

    get_response = await client.get(
        f"/api/v1/enterprises/{enterprise_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_enterprise_statistics(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]
    unique = str(uuid.uuid4())[:8]

    create = await client.post(
        "/api/v1/enterprises",
        json={"name": f"统计测试企业-{unique}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    enterprise_id = create.json()["id"]

    response = await client.get(
        f"/api/v1/enterprises/{enterprise_id}/statistics",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["enterprise_id"] == enterprise_id
    assert data["total_hazards"] == 0
    assert data["coverage_rate"] == 0.0
    assert data["pass_rate"] == 0.0


@pytest.mark.asyncio
async def test_export_enterprises(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/enterprises/export",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.mark.asyncio
async def test_download_template(client):
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/enterprises/template",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
