from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.core.database import get_db
from app.schemas import HazardResponse, HazardListParams, HazardUpdate, HazardEditableFields
from app.models import Hazard, Enterprise, Batch
from app.dependencies.auth import get_current_active_user
from app.dependencies.permissions import require_admin
from app.services import audit_log_service

router = APIRouter()


@router.get("", response_model=dict)
async def list_hazards(
    params: HazardListParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    offset = (params.page - 1) * params.page_size
    base_query = select(Hazard).where(Hazard.deleted_at.is_(None))

    if params.enterprise_name:
        base_query = base_query.join(Hazard.enterprise).where(Enterprise.name.ilike(f"%{params.enterprise_name}%"))

    base_query = base_query.options(selectinload(Hazard.enterprise))
    base_query = base_query.options(selectinload(Hazard.batch))

    if params.enterprise_id:
        base_query = base_query.where(Hazard.enterprise_id == params.enterprise_id)
    if params.batch_id:
        base_query = base_query.where(Hazard.batch_id == params.batch_id)
    if params.batch_ids:
        base_query = base_query.where(Hazard.batch_id.in_(params.batch_ids))
    if params.status:
        base_query = base_query.where(Hazard.status == params.status)
    if params.category:
        base_query = base_query.where(Hazard.category == params.category)
    if params.is_rectified:
        base_query = base_query.where(Hazard.is_rectified == params.is_rectified)
    if params.inspection_method:
        base_query = base_query.where(Hazard.inspection_method == params.inspection_method)

    count_query = select(func.count()).select_from(Hazard).where(Hazard.deleted_at.is_(None))
    if params.enterprise_name:
        count_query = count_query.join(Hazard.enterprise).where(Enterprise.name.ilike(f"%{params.enterprise_name}%"))
    if params.enterprise_id:
        count_query = count_query.where(Hazard.enterprise_id == params.enterprise_id)
    if params.batch_id:
        count_query = count_query.where(Hazard.batch_id == params.batch_id)
    if params.batch_ids:
        count_query = count_query.where(Hazard.batch_id.in_(params.batch_ids))
    if params.status:
        count_query = count_query.where(Hazard.status == params.status)
    if params.category:
        count_query = count_query.where(Hazard.category == params.category)
    if params.is_rectified:
        count_query = count_query.where(Hazard.is_rectified == params.is_rectified)
    if params.inspection_method:
        count_query = count_query.where(Hazard.inspection_method == params.inspection_method)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    result = await db.execute(base_query.offset(offset).limit(params.page_size).order_by(Hazard.created_at.desc()))
    hazards = result.scalars().all()

    items = []
    for h in hazards:
        item = HazardResponse.model_validate(h)
        item.enterprise_name = h.enterprise.name if h.enterprise else None
        item.enterprise_credit_code = h.enterprise.credit_code if h.enterprise else None
        item.enterprise_region = h.enterprise.region if h.enterprise else None
        item.enterprise_address = h.enterprise.address if h.enterprise else None
        item.enterprise_contact_person = h.enterprise.contact_person if h.enterprise else None
        item.enterprise_industry_sector = h.enterprise.industry_sector if h.enterprise else None
        item.enterprise_enterprise_type = h.enterprise.enterprise_type if h.enterprise else None
        item.batch_name = h.batch.name if h.batch else None
        item.reporting_unit = h.reporting_unit if h.reporting_unit is not None else (h.batch.reporting_unit if h.batch else None)
        items.append(item)

    return {"items": items, "total": total, "page": params.page, "page_size": params.page_size}


@router.get("/{hazard_id}", response_model=HazardResponse)
async def get_hazard(
    hazard_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Hazard)
        .where(Hazard.id == hazard_id, Hazard.deleted_at.is_(None))
        .options(selectinload(Hazard.enterprise), selectinload(Hazard.batch))
    )
    hazard = result.scalar_one_or_none()
    if not hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")

    item = HazardResponse.model_validate(hazard)
    item.enterprise_name = hazard.enterprise.name if hazard.enterprise else None
    item.enterprise_credit_code = hazard.enterprise.credit_code if hazard.enterprise else None
    item.enterprise_region = hazard.enterprise.region if hazard.enterprise else None
    item.enterprise_address = hazard.enterprise.address if hazard.enterprise else None
    item.enterprise_contact_person = hazard.enterprise.contact_person if hazard.enterprise else None
    item.enterprise_industry_sector = hazard.enterprise.industry_sector if hazard.enterprise else None
    item.enterprise_enterprise_type = hazard.enterprise.enterprise_type if hazard.enterprise else None
    item.batch_name = hazard.batch.name if hazard.batch else None
    item.reporting_unit = hazard.reporting_unit if hazard.reporting_unit is not None else (hazard.batch.reporting_unit if hazard.batch else None)
    return item


@router.get("/{hazard_id}/editable", response_model=HazardEditableFields)
async def get_hazard_editable_fields(
    hazard_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    result = await db.execute(
        select(Hazard).where(Hazard.id == hazard_id, Hazard.deleted_at.is_(None))
    )
    hazard = result.scalar_one_or_none()
    if not hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")

    return HazardEditableFields(
        description=hazard.description is None,
        location=hazard.location is None,
        category=hazard.category is None,
        inspection_method=hazard.inspection_method is None,
        inspector=hazard.inspector is None,
        inspection_date=hazard.inspection_date is None,
        judgment_basis=hazard.judgment_basis is None,
        violation_clause=hazard.violation_clause is None,
        is_rectified=hazard.is_rectified is None,
        rectification_date=hazard.rectification_date is None,
        rectification_responsible=hazard.rectification_responsible is None,
        rectification_measures=hazard.rectification_measures is None,
        report_remarks=hazard.report_remarks is None,
    )


@router.put("/{hazard_id}", response_model=HazardResponse)
async def update_hazard(
    request: Request,
    hazard_id: UUID,
    data: HazardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    result = await db.execute(
        select(Hazard)
        .where(Hazard.id == hazard_id, Hazard.deleted_at.is_(None))
        .options(selectinload(Hazard.enterprise), selectinload(Hazard.batch))
    )
    hazard = result.scalar_one_or_none()
    if not hazard:
        raise HTTPException(status_code=404, detail="Hazard not found")

    # Only fields that are currently None can be updated
    editable_fields = {
        "description": hazard.description is None,
        "location": hazard.location is None,
        "category": hazard.category is None,
        "inspection_method": hazard.inspection_method is None,
        "inspector": hazard.inspector is None,
        "inspection_date": hazard.inspection_date is None,
        "judgment_basis": hazard.judgment_basis is None,
        "violation_clause": hazard.violation_clause is None,
        "is_rectified": hazard.is_rectified is None,
        "rectification_date": hazard.rectification_date is None,
        "rectification_responsible": hazard.rectification_responsible is None,
        "rectification_measures": hazard.rectification_measures is None,
        "report_remarks": hazard.report_remarks is None,
    }

    updated_fields = {}
    update_data = data.model_dump(exclude_unset=True)

    for field, new_value in update_data.items():
        if new_value is not None and not editable_fields.get(field, False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"字段 '{field}' 已有值，不可修改",
            )
        if new_value is not None:
            setattr(hazard, field, new_value)
            updated_fields[field] = new_value

    if updated_fields:
        await audit_log_service.record(
            db=db,
            user_id=current_user.id,
            action="update_hazard",
            target_type="hazard",
            target_id=hazard.id,
            detail={"updated_fields": updated_fields, "hazard_id": str(hazard.id)},
            request_info={
                "ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "method": request.method,
                "path": str(request.url.path),
                "status_code": 200,
            },
        )
        await db.commit()
        await db.refresh(hazard)

    item = HazardResponse.model_validate(hazard)
    item.enterprise_name = hazard.enterprise.name if hazard.enterprise else None
    item.enterprise_credit_code = hazard.enterprise.credit_code if hazard.enterprise else None
    item.enterprise_region = hazard.enterprise.region if hazard.enterprise else None
    item.enterprise_address = hazard.enterprise.address if hazard.enterprise else None
    item.enterprise_contact_person = hazard.enterprise.contact_person if hazard.enterprise else None
    item.enterprise_industry_sector = hazard.enterprise.industry_sector if hazard.enterprise else None
    item.enterprise_enterprise_type = hazard.enterprise.enterprise_type if hazard.enterprise else None
    item.batch_name = hazard.batch.name if hazard.batch else None
    item.reporting_unit = hazard.reporting_unit if hazard.reporting_unit is not None else (hazard.batch.reporting_unit if hazard.batch else None)
    return item
