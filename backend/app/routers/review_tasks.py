from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.schemas import ReviewTaskCreate, ReviewTaskResponse, ReviewTaskDetailResponse, TaskHazardReview, TaskHazardResponse, BatchReviewRequest
from app.models import ReviewTask, Hazard, TaskHazard, HazardStatusHistory, User, Photo, Report
from app.dependencies.auth import get_current_active_user
from app.services.report_orchestration_service import ReportOrchestrationService
from app.services import audit_log_service

router = APIRouter()


def _append_token_to_url(url: str, token: str) -> str:
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}token={token}"


def _extract_token_from_request(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:]
    return request.query_params.get("token", "")


@router.post("", response_model=ReviewTaskResponse, status_code=status.HTTP_201_CREATED)
async def create_review_task(
    data: ReviewTaskCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Collect hazard ids from both direct hazard_ids and batch_ids
    unique_hazard_ids = set(data.hazard_ids)

    if data.batch_ids:
        batch_result = await db.execute(
            select(Hazard.id)
            .where(
                Hazard.batch_id.in_(data.batch_ids),
                Hazard.deleted_at.is_(None),
                Hazard.current_task_id.is_(None),
            )
        )
        unique_hazard_ids.update(batch_result.scalars().all())

    if not unique_hazard_ids:
        raise HTTPException(status_code=400, detail="No hazards selected")

    unique_hazard_ids = list(unique_hazard_ids)

    # Validate hazards and lock them with SELECT FOR UPDATE
    result = await db.execute(
        select(Hazard)
        .where(Hazard.id.in_(unique_hazard_ids), Hazard.deleted_at.is_(None))
        .with_for_update()
    )
    hazards = result.scalars().all()

    if len(hazards) != len(unique_hazard_ids):
        raise HTTPException(status_code=400, detail="Some hazards not found")

    for h in hazards:
        if h.current_task_id is not None:
            raise HTTPException(
                status_code=400,
                detail=f"Hazard {h.id} is already in another review task",
            )

    task = ReviewTask(
        name=data.name,
        creator_id=current_user.id,
        status="pending",
    )
    db.add(task)
    await db.flush()

    for h in hazards:
        h.current_task_id = task.id
        task_hazard = TaskHazard(task_id=task.id, hazard_id=h.id)
        db.add(task_hazard)

    await db.commit()
    await db.refresh(task)

    await audit_log_service.record(
        db=db,
        user_id=current_user.id,
        action="create_review_task",
        target_type="review_task",
        target_id=task.id,
        detail={"name": task.name, "hazard_count": len(unique_hazard_ids)},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 201,
        },
    )

    resp = ReviewTaskResponse.model_validate(task)
    resp.hazard_count = len(unique_hazard_ids)
    resp.reviewed_count = 0
    return resp


@router.get("", response_model=list[ReviewTaskResponse])
async def list_review_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ReviewTask)
        .where(ReviewTask.deleted_at.is_(None))
        .options(selectinload(ReviewTask.creator))
        .order_by(ReviewTask.created_at.desc())
    )
    tasks = result.scalars().all()

    responses = []
    for task in tasks:
        resp = ReviewTaskResponse.model_validate(task)
        resp.creator_username = task.creator.username if task.creator else None
        # Count hazards
        count_result = await db.execute(
            select(func.count()).select_from(TaskHazard).where(TaskHazard.task_id == task.id)
        )
        resp.hazard_count = count_result.scalar()
        reviewed_result = await db.execute(
            select(func.count()).select_from(TaskHazard).where(
                TaskHazard.task_id == task.id, TaskHazard.status_in_task.isnot(None)
            )
        )
        resp.reviewed_count = reviewed_result.scalar()

        # Report status
        report_result = await db.execute(
            select(Report.status).where(Report.task_id == task.id)
        )
        report_status = report_result.scalar_one_or_none()
        resp.report_status = report_status

        responses.append(resp)

    return responses


@router.get("/{task_id}", response_model=ReviewTaskDetailResponse)
async def get_review_task(
    request: Request,
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ReviewTask)
        .where(ReviewTask.id == task_id, ReviewTask.deleted_at.is_(None))
        .options(selectinload(ReviewTask.creator))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")

    resp = ReviewTaskDetailResponse.model_validate(task)
    resp.creator_username = task.creator.username if task.creator else None

    # Counts
    count_result = await db.execute(
        select(func.count()).select_from(TaskHazard).where(TaskHazard.task_id == task.id)
    )
    resp.hazard_count = count_result.scalar()
    reviewed_result = await db.execute(
        select(func.count()).select_from(TaskHazard).where(
            TaskHazard.task_id == task.id, TaskHazard.status_in_task.isnot(None)
        )
    )
    resp.reviewed_count = reviewed_result.scalar()

    # Hazards detail
    th_result = await db.execute(
        select(TaskHazard)
        .where(TaskHazard.task_id == task.id)
        .options(
            selectinload(TaskHazard.hazard).selectinload(Hazard.enterprise),
            selectinload(TaskHazard.hazard).selectinload(Hazard.batch),
            selectinload(TaskHazard.reviewer),
            selectinload(TaskHazard.photos),
        )
    )
    task_hazards = th_result.scalars().all()

    hazards_data = []
    for th in task_hazards:
        # Temporarily detach photos so model_validate doesn't fail on dict coercion
        original_photos = th.photos
        th.photos = []
        th_resp = TaskHazardResponse.model_validate(th)
        th.photos = original_photos
        user_token = _extract_token_from_request(request)
        th_resp.reviewer_username = th.reviewer.username if th.reviewer else None
        th_resp.photos = []
        for p in th.photos:
            if p.deleted_at is not None:
                continue
            original_url = f"/api/v1/photos/{p.id}/image?size=original"
            thumbnail_url = f"/api/v1/photos/{p.id}/image?size=thumbnail"
            if user_token:
                original_url = _append_token_to_url(original_url, user_token)
                thumbnail_url = _append_token_to_url(thumbnail_url, user_token)
            th_resp.photos.append({
                "id": str(p.id),
                "original_url": original_url,
                "thumbnail_url": thumbnail_url,
                "width": p.width,
                "height": p.height,
            })
        hazard_info = {
            "task_hazard": th_resp,
            "hazard_id": str(th.hazard.id),
            "content": th.hazard.content,
            "location": th.hazard.location,
            "enterprise_name": th.hazard.enterprise.name if th.hazard.enterprise else None,
            "enterprise_credit_code": th.hazard.enterprise.credit_code if th.hazard.enterprise else None,
            "enterprise_region": th.hazard.enterprise.region if th.hazard.enterprise else None,
            "enterprise_address": th.hazard.enterprise.address if th.hazard.enterprise else None,
            "enterprise_contact_person": th.hazard.enterprise.contact_person if th.hazard.enterprise else None,
            "enterprise_industry_sector": th.hazard.enterprise.industry_sector if th.hazard.enterprise else None,
            "enterprise_enterprise_type": th.hazard.enterprise.enterprise_type if th.hazard.enterprise else None,
            "is_rectified": th.hazard.is_rectified,
            "rectification_responsible": th.hazard.rectification_responsible,
            "rectification_measures": th.hazard.rectification_measures,
            "reporting_unit": th.hazard.reporting_unit if th.hazard.reporting_unit is not None else (th.hazard.batch.reporting_unit if th.hazard.batch else None),
            "status": th.hazard.status,
        }
        hazards_data.append(hazard_info)

    resp.hazards = hazards_data
    return resp


@router.post("/{task_id}/hazards/{hazard_id}/review", response_model=TaskHazardResponse)
async def review_hazard(
    request: Request,
    task_id: UUID,
    hazard_id: UUID,
    data: TaskHazardReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(TaskHazard).where(
            TaskHazard.task_id == task_id,
            TaskHazard.hazard_id == hazard_id,
        )
    )
    task_hazard = result.scalar_one_or_none()
    if not task_hazard:
        raise HTTPException(status_code=404, detail="Task hazard not found")

    task_result = await db.execute(
        select(ReviewTask).where(ReviewTask.id == task_id, ReviewTask.deleted_at.is_(None))
    )
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending tasks can be reviewed")

    # Determine if this is an edit
    is_edit = task_hazard.status_in_task is not None

    # Update task hazard
    task_hazard.conclusion = data.conclusion
    task_hazard.status_in_task = data.status_in_task
    task_hazard.reviewed_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    task_hazard.reviewer_id = current_user.id

    # Update hazard status and history
    hazard_result = await db.execute(select(Hazard).where(Hazard.id == hazard_id))
    hazard = hazard_result.scalar_one()

    old_status = hazard.status
    hazard.status = data.status_in_task
    if not is_edit and old_status == "pending" and data.status_in_task in ("passed", "failed"):
        hazard.review_count += 1

    reason = f"Reviewed in task {task_id}"
    if is_edit:
        reason += " (edited)"
    history = HazardStatusHistory(
        hazard_id=hazard.id,
        from_status=old_status,
        to_status=data.status_in_task,
        changed_by=current_user.id,
        reason=reason,
    )
    db.add(history)

    # Bind photos if any
    photos = []
    if data.photo_tokens:
        photo_result = await db.execute(
            select(Photo).where(Photo.temp_token.in_(data.photo_tokens))
        )
        photos = photo_result.scalars().all()
        for photo in photos:
            photo.task_hazard_id = task_hazard.id
            photo.temp_token = None

    await audit_log_service.record(
        db=db,
        user_id=current_user.id,
        action="review_hazard",
        target_type="review_task",
        target_id=task_id,
        detail={
            "hazard_id": str(hazard_id),
            "conclusion": data.conclusion,
            "status_in_task": data.status_in_task,
            "old_status": old_status,
            "is_edit": is_edit,
        },
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    await db.commit()
    await db.refresh(task_hazard)

    # Reload all photos for this task hazard to include existing + newly bound
    all_photos_result = await db.execute(
        select(Photo).where(Photo.task_hazard_id == task_hazard.id, Photo.deleted_at.is_(None))
    )
    all_photos = all_photos_result.scalars().all()

    user_token = _extract_token_from_request(request)
    photos_out = []
    for p in all_photos:
        original_url = f"/api/v1/photos/{p.id}/image?size=original"
        thumbnail_url = f"/api/v1/photos/{p.id}/image?size=thumbnail"
        if user_token:
            original_url = _append_token_to_url(original_url, user_token)
            thumbnail_url = _append_token_to_url(thumbnail_url, user_token)
        photos_out.append({
            "id": str(p.id),
            "original_url": original_url,
            "thumbnail_url": thumbnail_url,
            "width": p.width,
            "height": p.height,
        })

    resp = TaskHazardResponse(
        id=task_hazard.id,
        task_id=task_hazard.task_id,
        hazard_id=task_hazard.hazard_id,
        conclusion=task_hazard.conclusion,
        status_in_task=task_hazard.status_in_task,
        reviewed_at=task_hazard.reviewed_at,
        reviewer_id=task_hazard.reviewer_id,
        reviewer_username=current_user.username,
        photos=photos_out,
    )
    return resp


@router.delete("/{task_id}/hazards/{hazard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_hazard_from_task(
    task_id: UUID,
    hazard_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ReviewTask).where(ReviewTask.id == task_id, ReviewTask.deleted_at.is_(None))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending tasks can be modified")

    th_result = await db.execute(
        select(TaskHazard).where(
            TaskHazard.task_id == task_id,
            TaskHazard.hazard_id == hazard_id,
        )
    )
    task_hazard = th_result.scalar_one_or_none()
    if not task_hazard:
        raise HTTPException(status_code=404, detail="Hazard not in this task")

    # Revert hazard status if it was reviewed
    hazard_result = await db.execute(select(Hazard).where(Hazard.id == hazard_id))
    hazard = hazard_result.scalar_one()
    if task_hazard.status_in_task is not None:
        old_status = hazard.status
        hazard.status = "pending"
        if old_status in ("passed", "failed") and hazard.review_count > 0:
            hazard.review_count -= 1
        history = HazardStatusHistory(
            hazard_id=hazard.id,
            from_status=old_status,
            to_status="pending",
            changed_by=current_user.id,
            reason=f"Removed from task {task_id}",
        )
        db.add(history)

    hazard.current_task_id = None
    await db.execute(
        delete(TaskHazard).where(
            TaskHazard.task_id == task_id,
            TaskHazard.hazard_id == hazard_id,
        )
    )
    await db.commit()

    await audit_log_service.record(
        db=db,
        user_id=current_user.id,
        action="remove_hazard_from_task",
        target_type="review_task",
        target_id=task_id,
        detail={"hazard_id": str(hazard_id), "reverted_status": task_hazard.status_in_task is not None},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 204,
        },
    )

    return None


@router.post("/{task_id}/batch-review", response_model=list[TaskHazardResponse])
async def batch_review_hazards(
    request: Request,
    task_id: UUID,
    data: BatchReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ReviewTask).where(ReviewTask.id == task_id, ReviewTask.deleted_at.is_(None))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending tasks can be reviewed")

    # Preload existing photos for all task hazards in this task to avoid
    # flushing inside the loop.
    existing_photos_result = await db.execute(
        select(Photo).where(
            Photo.task_hazard_id.in_(
                select(TaskHazard.id).where(TaskHazard.task_id == task_id)
            ),
            Photo.deleted_at.is_(None),
        )
    )
    existing_photos_map: dict[UUID, list] = {}
    for p in existing_photos_result.scalars().all():
        existing_photos_map.setdefault(p.task_hazard_id, []).append(p)

    responses = []
    for item in data.items:
        th_result = await db.execute(
            select(TaskHazard).where(
                TaskHazard.task_id == task_id,
                TaskHazard.hazard_id == item.hazard_id,
            )
        )
        task_hazard = th_result.scalar_one_or_none()
        if not task_hazard:
            continue

        is_edit = task_hazard.status_in_task is not None

        task_hazard.conclusion = item.conclusion
        task_hazard.status_in_task = item.status_in_task
        task_hazard.reviewed_at = datetime.now(ZoneInfo("Asia/Shanghai"))
        task_hazard.reviewer_id = current_user.id

        hazard_result = await db.execute(select(Hazard).where(Hazard.id == item.hazard_id))
        hazard = hazard_result.scalar_one()

        old_status = hazard.status
        hazard.status = item.status_in_task
        if not is_edit and old_status == "pending" and item.status_in_task in ("passed", "failed"):
            hazard.review_count += 1

        reason = f"Reviewed in task {task_id}"
        if is_edit:
            reason += " (edited)"
        history = HazardStatusHistory(
            hazard_id=hazard.id,
            from_status=old_status,
            to_status=item.status_in_task,
            changed_by=current_user.id,
            reason=reason,
        )
        db.add(history)

        photos = []
        if item.photo_tokens:
            photo_result = await db.execute(
                select(Photo).where(Photo.temp_token.in_(item.photo_tokens))
            )
            photos = photo_result.scalars().all()
            for photo in photos:
                photo.task_hazard_id = task_hazard.id
                photo.temp_token = None

        user_token = _extract_token_from_request(request)
        photos_out = []
        for p in existing_photos_map.get(task_hazard.id, []):
            original_url = f"/api/v1/photos/{p.id}/image?size=original"
            thumbnail_url = f"/api/v1/photos/{p.id}/image?size=thumbnail"
            if user_token:
                original_url = _append_token_to_url(original_url, user_token)
                thumbnail_url = _append_token_to_url(thumbnail_url, user_token)
            photos_out.append({
                "id": str(p.id),
                "original_url": original_url,
                "thumbnail_url": thumbnail_url,
                "width": p.width,
                "height": p.height,
            })
        for p in photos:
            original_url = f"/api/v1/photos/{p.id}/image?size=original"
            thumbnail_url = f"/api/v1/photos/{p.id}/image?size=thumbnail"
            if user_token:
                original_url = _append_token_to_url(original_url, user_token)
                thumbnail_url = _append_token_to_url(thumbnail_url, user_token)
            photos_out.append({
                "id": str(p.id),
                "original_url": original_url,
                "thumbnail_url": thumbnail_url,
                "width": p.width,
                "height": p.height,
            })

        resp = TaskHazardResponse(
            id=task_hazard.id,
            task_id=task_hazard.task_id,
            hazard_id=task_hazard.hazard_id,
            conclusion=task_hazard.conclusion,
            status_in_task=task_hazard.status_in_task,
            reviewed_at=task_hazard.reviewed_at,
            reviewer_id=task_hazard.reviewer_id,
            reviewer_username=current_user.username,
            photos=photos_out,
        )
        responses.append(resp)

    await db.commit()
    return responses


@router.post("/{task_id}/complete", response_model=ReviewTaskResponse)
async def complete_task(
    task_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ReviewTask).where(ReviewTask.id == task_id, ReviewTask.deleted_at.is_(None))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending tasks can be completed")

    # Validate all hazards are reviewed
    unreviewed_count_result = await db.execute(
        select(func.count())
        .select_from(TaskHazard)
        .where(TaskHazard.task_id == task_id, TaskHazard.status_in_task.is_(None))
    )
    unreviewed_count = unreviewed_count_result.scalar()
    if unreviewed_count > 0:
        raise HTTPException(status_code=400, detail="存在未复核的隐患，无法完成任务")

    # Release locks and update hazard statuses
    hazard_result = await db.execute(
        select(Hazard).where(Hazard.current_task_id == task_id)
    )
    hazards = hazard_result.scalars().all()
    for h in hazards:
        h.current_task_id = None

    task.status = "completed"
    task.completed_at = datetime.now(ZoneInfo("Asia/Shanghai"))

    # 计算复核统计
    hazard_count = len(hazards)
    reviewed_count = sum(1 for h in hazards if h.status in ("passed", "failed"))

    await audit_log_service.record(
        db=db,
        user_id=current_user.id,
        action="complete_task",
        target_type="review_task",
        target_id=task_id,
        detail={
            "task_name": task.name,
            "hazard_count": hazard_count,
            "reviewed_count": reviewed_count,
        },
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    await db.commit()
    await db.refresh(task)

    try:
        orchestrator = ReportOrchestrationService(db)
        await orchestrator.create_and_enqueue(task.id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("Failed to enqueue report generation after task completion: %s", e)

    return ReviewTaskResponse.model_validate(task)


@router.post("/{task_id}/cancel", response_model=ReviewTaskResponse)
async def cancel_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ReviewTask).where(ReviewTask.id == task_id, ReviewTask.deleted_at.is_(None))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")

    hazard_result = await db.execute(
        select(Hazard).where(Hazard.current_task_id == task_id)
    )
    hazards = hazard_result.scalars().all()
    for h in hazards:
        h.current_task_id = None

    task.status = "cancelled"

    await audit_log_service.record(
        db=db,
        user_id=current_user.id,
        action="cancel_task",
        target_type="review_task",
        target_id=task_id,
        detail={"task_name": task.name},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    await db.commit()
    await db.refresh(task)

    return ReviewTaskResponse.model_validate(task)
