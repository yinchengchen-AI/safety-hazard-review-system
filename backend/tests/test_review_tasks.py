import pytest
from httpx import AsyncClient


async def get_admin_token(client: AsyncClient) -> str:
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


async def create_enterprise_and_hazard(client: AsyncClient, token: str, name: str = "测试企业"):
    """Helper to create an enterprise and a hazard, returning hazard id."""
    # create enterprise
    ent_res = await client.post(
        "/api/v1/enterprises",
        json={"name": name, "credit_code": f"code-{name}"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert ent_res.status_code == 201
    enterprise_id = ent_res.json()["id"]

    # import a batch to create hazard
    from openpyxl import Workbook
    import io
    wb = Workbook()
    ws = wb.active
    ws.append(["企业名称", "隐患描述", "隐患位置"])
    ws.append([name, f"{name}隐患", "车间A"])
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    preview = await client.post(
        "/api/v1/batches/preview",
        files={"file": ("test.xlsx", buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers={"Authorization": f"Bearer {token}"},
    )
    temp_token = preview.json()["temp_token"]

    import_res = await client.post(
        "/api/v1/batches/import",
        data={"temp_token": temp_token, "name": f"batch-{name}", "filename": "test.xlsx"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert import_res.status_code == 200

    # get hazard
    hazards_res = await client.get(
        "/api/v1/hazards",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hazards_res.status_code == 200
    hazards = hazards_res.json()["items"]
    hazard = next((h for h in hazards if h["enterprise_name"] == name), None)
    assert hazard is not None
    return hazard["id"]


@pytest.mark.asyncio
async def test_create_task_and_remove_hazard(client: AsyncClient):
    token = await get_admin_token(client)
    hazard_id = await create_enterprise_and_hazard(client, token)

    # create task
    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "复核任务1", "hazard_ids": [hazard_id]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    task_id = create_res.json()["id"]

    # get task detail
    detail = await client.get(
        f"/api/v1/review-tasks/{task_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail.status_code == 200
    assert detail.json()["hazard_count"] == 1

    # remove hazard
    remove = await client.delete(
        f"/api/v1/review-tasks/{task_id}/hazards/{hazard_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert remove.status_code == 204

    # verify task has 0 hazards
    detail2 = await client.get(
        f"/api/v1/review-tasks/{task_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail2.json()["hazard_count"] == 0

    # verify hazard is free again
    hazard_res = await client.get(
        f"/api/v1/hazards/{hazard_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hazard_res.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_review_hazard_and_edit(client: AsyncClient):
    token = await get_admin_token(client)
    hazard_id = await create_enterprise_and_hazard(client, token)

    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "复核任务2", "hazard_ids": [hazard_id]},
        headers={"Authorization": f"Bearer {token}"},
    )
    task_id = create_res.json()["id"]

    # review
    review = await client.post(
        f"/api/v1/review-tasks/{task_id}/hazards/{hazard_id}/review",
        json={"conclusion": "符合要求", "status_in_task": "passed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert review.status_code == 200
    assert review.json()["status_in_task"] == "passed"

    # edit review
    edit = await client.post(
        f"/api/v1/review-tasks/{task_id}/hazards/{hazard_id}/review",
        json={"conclusion": "不符合要求", "status_in_task": "failed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert edit.status_code == 200
    assert edit.json()["status_in_task"] == "failed"

    # verify hazard status updated
    hazard_res = await client.get(
        f"/api/v1/hazards/{hazard_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hazard_res.json()["status"] == "failed"
    # review count should be 1 (not incremented on edit)
    assert hazard_res.json()["review_count"] == 1


@pytest.mark.asyncio
async def test_batch_review(client: AsyncClient):
    token = await get_admin_token(client)
    h1 = await create_enterprise_and_hazard(client, token, "企业A")
    h2 = await create_enterprise_and_hazard(client, token, "企业B")

    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "批量复核任务", "hazard_ids": [h1, h2]},
        headers={"Authorization": f"Bearer {token}"},
    )
    task_id = create_res.json()["id"]

    batch = await client.post(
        f"/api/v1/review-tasks/{task_id}/batch-review",
        json={
            "items": [
                {"hazard_id": h1, "conclusion": "A通过", "status_in_task": "passed"},
                {"hazard_id": h2, "conclusion": "B不通过", "status_in_task": "failed"},
            ]
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert batch.status_code == 200
    results = batch.json()
    assert len(results) == 2
    assert results[0]["status_in_task"] == "passed"
    assert results[1]["status_in_task"] == "failed"

    # complete task should succeed
    complete = await client.post(
        f"/api/v1/review-tasks/{task_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_complete_task_with_unreviewed_hazard_fails(client: AsyncClient):
    token = await get_admin_token(client)
    h1 = await create_enterprise_and_hazard(client, token, "企业C")

    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "未全复核任务", "hazard_ids": [h1]},
        headers={"Authorization": f"Bearer {token}"},
    )
    task_id = create_res.json()["id"]

    complete = await client.post(
        f"/api/v1/review-tasks/{task_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete.status_code == 400
    assert "未复核" in complete.json()["detail"]


@pytest.mark.asyncio
async def test_complete_task_creates_report(client: AsyncClient):
    token = await get_admin_token(client)
    h1 = await create_enterprise_and_hazard(client, token, "企业Report")
    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "报告任务", "hazard_ids": [h1]},
        headers={"Authorization": f"Bearer {token}"},
    )
    task_id = create_res.json()["id"]

    # Review the hazard first
    await client.post(
        f"/api/v1/review-tasks/{task_id}/hazards/{h1}/review",
        json={"status_in_task": "passed", "conclusion": "ok"},
        headers={"Authorization": f"Bearer {token}"},
    )

    complete = await client.post(
        f"/api/v1/review-tasks/{task_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert complete.status_code == 200

    status_res = await client.get(
        f"/api/v1/reports/{task_id}/status",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "pending"
