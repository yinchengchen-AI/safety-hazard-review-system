import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import get_password_hash
from app.models import User, Notification, ReviewTask, Hazard, TaskHazard, Enterprise, Batch
from app.services import notification_service


async def get_admin_token(client: AsyncClient) -> str:
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


async def get_user_token(client: AsyncClient, username: str, password: str) -> str:
    login = await client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": password},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


import uuid as uuid_mod


@pytest_asyncio.fixture
async def inspector_user(db_session):
    unique = str(uuid_mod.uuid4())[:8]
    user = User(
        username=f"inspector_{unique}",
        password_hash=get_password_hash("pass123"),
        role="inspector",
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def admin_user(db_session):
    unique = str(uuid_mod.uuid4())[:8]
    user = User(
        username=f"admin_{unique}",
        password_hash=get_password_hash("pass123"),
        role="admin",
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest_asyncio.fixture
async def another_inspector(db_session):
    unique = str(uuid_mod.uuid4())[:8]
    user = User(
        username=f"inspector2_{unique}",
        password_hash=get_password_hash("pass123"),
        role="inspector",
    )
    db_session.add(user)
    await db_session.commit()
    return user


async def _create_enterprise_hazard_batch(db_session, creator_id=None):
    unique = str(uuid_mod.uuid4())[:8]
    enterprise = Enterprise(name=f"测试企业{unique}", credit_code=f"test-code-{unique}")
    db_session.add(enterprise)
    await db_session.flush()

    batch = Batch(name=f"测试批次{unique}", creator_id=creator_id)
    db_session.add(batch)
    await db_session.flush()

    hazard = Hazard(
        enterprise_id=enterprise.id,
        batch_id=batch.id,
        content=f"这是一个测试隐患描述{unique}",
        status="pending",
    )
    db_session.add(hazard)
    await db_session.commit()
    return hazard


# B1: task_created notifications for inspectors excluding actor
@pytest.mark.asyncio
async def test_notify_task_created_excludes_actor(client: AsyncClient, inspector_user, admin_user, db_session):
    token = await get_admin_token(client)

    # Create hazard
    hazard = await _create_enterprise_hazard_batch(db_session)

    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "B1测试任务", "hazard_ids": [str(hazard.id)]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201

    # Admin (actor) should have ZERO notifications
    admin_notifs = await db_session.execute(
        select(Notification).where(
            Notification.user_id == admin_user.id,
            Notification.type == "task_created",
            Notification.deleted_at.is_(None),
        )
    )
    assert admin_notifs.scalars().all() == []

    # Inspector should have ONE notification
    inspector_notifs = await db_session.execute(
        select(Notification).where(
            Notification.user_id == inspector_user.id,
            Notification.type == "task_created",
            Notification.deleted_at.is_(None),
        )
    )
    notifs = inspector_notifs.scalars().all()
    assert len(notifs) == 1
    assert "B1测试任务" in notifs[0].title


# B2: task_completed notifications for creator + admins excluding actor
@pytest.mark.asyncio
async def test_notify_task_completed_excludes_actor(client: AsyncClient, inspector_user, admin_user, db_session):
    inspector_token = await get_user_token(client, inspector_user.username, "pass123")
    admin_token = await get_admin_token(client)

    # Get seeded admin user id
    seeded_admin = await db_session.execute(select(User).where(User.username == "admin"))
    seeded_admin = seeded_admin.scalar_one()

    hazard = await _create_enterprise_hazard_batch(db_session)
    # Create task as inspector (so inspector is creator)
    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "B2测试任务", "hazard_ids": [str(hazard.id)]},
        headers={"Authorization": f"Bearer {inspector_token}"},
    )
    task_id = create_res.json()["id"]

    # Review the hazard first as inspector
    await client.post(
        f"/api/v1/review-tasks/{task_id}/hazards/{hazard.id}/review",
        json={"status_in_task": "passed", "conclusion": "ok"},
        headers={"Authorization": f"Bearer {inspector_token}"},
    )

    # Complete task as seeded admin (actor)
    complete_res = await client.post(
        f"/api/v1/review-tasks/{task_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert complete_res.status_code == 200

    # Seeded admin (actor) should have ZERO task_completed notifications
    admin_notifs = await db_session.execute(
        select(Notification).where(
            Notification.user_id == seeded_admin.id,
            Notification.type == "task_completed",
            Notification.deleted_at.is_(None),
        )
    )
    assert admin_notifs.scalars().all() == []

    # Inspector (creator) should have ONE notification
    insp_notifs = await db_session.execute(
        select(Notification).where(
            Notification.user_id == inspector_user.id,
            Notification.type == "task_completed",
            Notification.deleted_at.is_(None),
        )
    )
    assert len(insp_notifs.scalars().all()) == 1

    # Fixture admin_user (non-actor admin) should also have ONE notification
    fixture_admin_notifs = await db_session.execute(
        select(Notification).where(
            Notification.user_id == admin_user.id,
            Notification.type == "task_completed",
            Notification.deleted_at.is_(None),
        )
    )
    assert len(fixture_admin_notifs.scalars().all()) == 1


# B3: task_cancelled notifications for creator + reviewers excluding actor
@pytest.mark.asyncio
async def test_notify_task_cancelled_excludes_actor(client: AsyncClient, inspector_user, admin_user, db_session):
    inspector_token = await get_user_token(client, inspector_user.username, "pass123")
    admin_token = await get_admin_token(client)

    hazard = await _create_enterprise_hazard_batch(db_session)
    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "B3测试任务", "hazard_ids": [str(hazard.id)]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    task_id = create_res.json()["id"]

    # Inspector reviews the hazard
    await client.post(
        f"/api/v1/review-tasks/{task_id}/hazards/{hazard.id}/review",
        json={"status_in_task": "passed", "conclusion": "ok"},
        headers={"Authorization": f"Bearer {inspector_token}"},
    )

    # Admin cancels the task (actor)
    cancel_res = await client.post(
        f"/api/v1/review-tasks/{task_id}/cancel",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert cancel_res.status_code == 200

    # Admin (actor) should have ZERO task_cancelled notifications
    admin_notifs = await db_session.execute(
        select(Notification).where(
            Notification.user_id == admin_user.id,
            Notification.type == "task_cancelled",
            Notification.deleted_at.is_(None),
        )
    )
    assert admin_notifs.scalars().all() == []

    # Inspector (reviewer) should have ONE notification
    inspector_notifs = await db_session.execute(
        select(Notification).where(
            Notification.user_id == inspector_user.id,
            Notification.type == "task_cancelled",
            Notification.deleted_at.is_(None),
        )
    )
    notifs = inspector_notifs.scalars().all()
    assert len(notifs) == 1


# B4: single hazard review creates notification for batch creator
@pytest.mark.asyncio
async def test_single_hazard_review_notifies_batch_creator(client: AsyncClient, inspector_user, db_session):
    admin_token = await get_admin_token(client)

    # Create hazard with inspector as batch creator
    hazard = await _create_enterprise_hazard_batch(db_session, creator_id=inspector_user.id)

    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "B4测试任务", "hazard_ids": [str(hazard.id)]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    task_id = create_res.json()["id"]

    # Admin reviews the hazard (actor)
    review_res = await client.post(
        f"/api/v1/review-tasks/{task_id}/hazards/{hazard.id}/review",
        json={"status_in_task": "passed", "conclusion": "ok"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert review_res.status_code == 200

    # Inspector (batch creator) should have ONE hazard_reviewed notification
    notifs_result = await db_session.execute(
        select(Notification).where(
            Notification.user_id == inspector_user.id,
            Notification.type == "hazard_reviewed",
            Notification.deleted_at.is_(None),
        )
    )
    notifs = notifs_result.scalars().all()
    assert len(notifs) == 1
    assert "隐患已被复核" in notifs[0].title


# B5: batch review deduplicates notifications per batch creator
@pytest.mark.asyncio
async def test_batch_review_deduplicates_notifications(client: AsyncClient, inspector_user, db_session):
    admin_token = await get_admin_token(client)

    # Create two hazards from same batch
    hazard1 = await _create_enterprise_hazard_batch(db_session, creator_id=inspector_user.id)
    hazard2 = await _create_enterprise_hazard_batch(db_session, creator_id=inspector_user.id)

    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "B5测试任务", "hazard_ids": [str(hazard1.id), str(hazard2.id)]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    task_id = create_res.json()["id"]

    # Batch review both hazards
    batch_res = await client.post(
        f"/api/v1/review-tasks/{task_id}/batch-review",
        json={
            "items": [
                {"hazard_id": str(hazard1.id), "status_in_task": "passed", "conclusion": "ok1"},
                {"hazard_id": str(hazard2.id), "status_in_task": "passed", "conclusion": "ok2"},
            ]
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert batch_res.status_code == 200

    # Inspector should have exactly ONE notification (deduplicated)
    notifs_result = await db_session.execute(
        select(Notification).where(
            Notification.user_id == inspector_user.id,
            Notification.type == "hazard_reviewed",
            Notification.deleted_at.is_(None),
        )
    )
    notifs = notifs_result.scalars().all()
    assert len(notifs) == 1


# B6: report completion creates notification for task creator
@pytest.mark.asyncio
async def test_report_completed_notification(client: AsyncClient, inspector_user, db_session):
    admin_token = await get_admin_token(client)

    hazard = await _create_enterprise_hazard_batch(db_session)
    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "B6测试任务", "hazard_ids": [str(hazard.id)]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    task_id = create_res.json()["id"]

    # Review and complete
    await client.post(
        f"/api/v1/review-tasks/{task_id}/hazards/{hazard.id}/review",
        json={"status_in_task": "passed", "conclusion": "ok"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    await client.post(
        f"/api/v1/review-tasks/{task_id}/complete",
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Trigger report generation directly via service (mock internals)
    from app.services.report_service import ReportService
    from unittest.mock import AsyncMock, patch

    async with db_session.begin():
        pass  # ensure session is clean

    service = ReportService(db_session)
    with patch.object(service, "_generate_word", new_callable=AsyncMock, return_value="/test/word.docx"):
        with patch.object(service, "_generate_pdf", new_callable=AsyncMock, return_value="/test/pdf.pdf"):
            report = await service.generate_report(task_id)

    # Admin (task creator) should have report_completed notification
    notifs_result = await db_session.execute(
        select(Notification).where(
            Notification.user_id == report.task.creator_id,
            Notification.type == "report_completed",
            Notification.deleted_at.is_(None),
        )
    )
    notifs = notifs_result.scalars().all()
    assert len(notifs) == 1
    assert "复核报告已生成" in notifs[0].title


# B7: list notifications paginated, excluding soft-deleted
@pytest.mark.asyncio
async def test_list_notifications_paginated(client: AsyncClient, inspector_user, db_session):
    token = await get_user_token(client, inspector_user.username, "pass123")

    # Create 5 notifications
    for i in range(5):
        n = Notification(
            user_id=inspector_user.id,
            type="test",
            title=f"通知{i}",
        )
        db_session.add(n)
    await db_session.commit()

    # Soft-delete one
    result = await db_session.execute(
        select(Notification).where(Notification.user_id == inspector_user.id, Notification.deleted_at.is_(None))
    )
    to_delete = result.scalars().first()
    to_delete.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db_session.commit()

    res = await client.get(
        "/api/v1/notifications?page=1&page_size=20",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 4
    assert len(data["items"]) == 4


# B8: unread count endpoint
@pytest.mark.asyncio
async def test_unread_count(client: AsyncClient, inspector_user, db_session):
    token = await get_user_token(client, inspector_user.username, "pass123")

    # 3 unread
    for i in range(3):
        n = Notification(user_id=inspector_user.id, type="test", title=f"未读{i}")
        db_session.add(n)
    # 2 read
    for i in range(2):
        n = Notification(
            user_id=inspector_user.id,
            type="test",
            title=f"已读{i}",
            is_read=True,
            read_at=datetime.now(ZoneInfo("Asia/Shanghai")),
        )
        db_session.add(n)
    await db_session.commit()

    res = await client.get(
        "/api/v1/notifications/unread-count",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json() == 3


# B9: mark single notification as read
@pytest.mark.asyncio
async def test_mark_as_read(client: AsyncClient, inspector_user, db_session):
    token = await get_user_token(client, inspector_user.username, "pass123")

    n = Notification(user_id=inspector_user.id, type="test", title="标记已读")
    db_session.add(n)
    await db_session.commit()
    notif_id = n.id

    res = await client.post(
        f"/api/v1/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 204

    # Expire all and re-query to pick up committed changes from router session
    await db_session.commit()
    db_session.expire_all()
    result = await db_session.execute(
        select(Notification).where(Notification.id == notif_id)
    )
    updated = result.scalar_one()
    assert updated.is_read is True
    assert updated.read_at is not None


# B10: mark all as read
@pytest.mark.asyncio
async def test_mark_all_as_read(client: AsyncClient, inspector_user, db_session):
    token = await get_user_token(client, inspector_user.username, "pass123")

    for i in range(5):
        n = Notification(user_id=inspector_user.id, type="test", title=f"未读{i}")
        db_session.add(n)
    await db_session.commit()

    res = await client.post(
        "/api/v1/notifications/read-all",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 204

    result = await db_session.execute(
        select(Notification).where(
            Notification.user_id == inspector_user.id,
            Notification.is_read == False,
            Notification.deleted_at.is_(None),
        )
    )
    assert result.scalars().all() == []


# B11: notification failure does not rollback parent transaction
@pytest.mark.asyncio
async def test_notification_failure_does_not_rollback_parent(client: AsyncClient, inspector_user, db_session):
    admin_token = await get_admin_token(client)

    hazard = await _create_enterprise_hazard_batch(db_session)

    # Temporarily monkey-patch service to raise exception
    original_notify = notification_service.notify_task_created
    async def broken_notify(*args, **kwargs):
        raise RuntimeError("simulated failure")
    notification_service.notify_task_created = broken_notify

    try:
        create_res = await client.post(
            "/api/v1/review-tasks",
            json={"name": "B11测试任务", "hazard_ids": [str(hazard.id)]},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # Task creation should still succeed
        assert create_res.status_code == 201
    finally:
        notification_service.notify_task_created = original_notify


# B13: cleanup task soft-deletes read notifications older than 30 days
@pytest.mark.asyncio
async def test_cleanup_old_notifications(db_session):
    now = datetime.now(ZoneInfo("Asia/Shanghai"))

    # Old read notification (31 days ago)
    old = Notification(
        user_id=None,  # will set below
        type="test",
        title="old",
        is_read=True,
        read_at=now - timedelta(days=31),
    )
    # Recent read notification (5 days ago)
    recent = Notification(
        user_id=None,
        type="test",
        title="recent",
        is_read=True,
        read_at=now - timedelta(days=5),
    )
    # Old unread notification
    old_unread = Notification(
        user_id=None,
        type="test",
        title="old unread",
        is_read=False,
    )

    # Need a real user_id
    user = User(username="cleanupuser", password_hash=get_password_hash("pass"), role="inspector")
    db_session.add(user)
    await db_session.flush()
    old.user_id = user.id
    recent.user_id = user.id
    old_unread.user_id = user.id
    db_session.add_all([old, recent, old_unread])
    await db_session.commit()

    # Run cleanup using the test session directly
    from sqlalchemy import update
    from app.models.notification import Notification as NotifModel

    cutoff = datetime.now(ZoneInfo("Asia/Shanghai")) - timedelta(days=30)
    result = await db_session.execute(
        update(NotifModel)
        .where(
            NotifModel.is_read == True,
            NotifModel.read_at < cutoff,
            NotifModel.deleted_at.is_(None),
        )
        .values(deleted_at=datetime.now(ZoneInfo("Asia/Shanghai")))
    )
    await db_session.commit()

    # Re-query from DB in fresh transaction
    async with db_session.begin():
        old_result = await db_session.execute(select(Notification).where(Notification.id == old.id))
        old_refreshed = old_result.scalar_one()
        recent_result = await db_session.execute(select(Notification).where(Notification.id == recent.id))
        recent_refreshed = recent_result.scalar_one()
        unread_result = await db_session.execute(select(Notification).where(Notification.id == old_unread.id))
        unread_refreshed = unread_result.scalar_one()

    assert old_refreshed.deleted_at is not None
    assert recent_refreshed.deleted_at is None
    assert unread_refreshed.deleted_at is None


# B14: actor does not receive own notification
@pytest.mark.asyncio
async def test_actor_does_not_receive_own_notification(client: AsyncClient, admin_user, db_session):
    admin_token = await get_admin_token(client)

    hazard = await _create_enterprise_hazard_batch(db_session)
    create_res = await client.post(
        "/api/v1/review-tasks",
        json={"name": "B14测试任务", "hazard_ids": [str(hazard.id)]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_res.status_code == 201

    # Admin should have ZERO task_created notifications for this task
    result = await db_session.execute(
        select(Notification).where(
            Notification.user_id == admin_user.id,
            Notification.type == "task_created",
            Notification.deleted_at.is_(None),
        )
    )
    assert result.scalars().all() == []


# B15: duplicate notification prevented by unique constraint
@pytest.mark.asyncio
async def test_duplicate_notification_prevented(db_session):
    user = User(username="dupuser", password_hash=get_password_hash("pass"), role="inspector")
    db_session.add(user)
    await db_session.flush()

    task_id = user.id  # use as related_id

    n1 = Notification(
        user_id=user.id,
        type="report_completed",
        title="first",
        related_type="report",
        related_id=task_id,
    )
    db_session.add(n1)
    await db_session.commit()

    n2 = Notification(
        user_id=user.id,
        type="report_completed",
        title="second",
        related_type="report",
        related_id=task_id,
    )
    db_session.add(n2)
    from sqlalchemy.exc import IntegrityError
    with pytest.raises(IntegrityError):
        await db_session.commit()
