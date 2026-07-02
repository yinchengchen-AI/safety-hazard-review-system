from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from uuid import UUID
import io
import pandas as pd
from openpyxl import Workbook
from starlette.responses import StreamingResponse

from app.core.database import get_db
from app.schemas import (
    EnterpriseCreate,
    EnterpriseUpdate,
    EnterpriseResponse,
    EnterpriseListResponse,
    EnterpriseImportResult,
)
from app.models import Enterprise, Hazard
from app.dependencies.permissions import require_admin
from app.services import audit_log_service

router = APIRouter()


@router.get("/export")
async def export_enterprises(
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await db.execute(
        select(Enterprise).where(Enterprise.deleted_at.is_(None)).order_by(Enterprise.created_at.desc())
    )
    enterprises = result.scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "企业列表"
    headers = ["企业名称", "统一社会信用代码", "属地", "详细地址", "负责人", "行业领域", "企业类型", "创建时间"]
    ws.append(headers)

    for e in enterprises:
        ws.append([
            e.name,
            e.credit_code or "",
            e.region or "",
            e.address or "",
            e.contact_person or "",
            e.industry_sector or "",
            e.enterprise_type or "",
            e.created_at.strftime("%Y-%m-%d %H:%M:%S") if e.created_at else "",
        ])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="enterprises.xlsx"'},
    )


@router.get("/template")
async def download_enterprise_template():
    wb = Workbook()
    ws = wb.active
    ws.title = "企业导入模板"
    headers = ["企业名称", "统一社会信用代码", "属地", "详细地址", "负责人", "行业领域", "企业类型"]
    sample = ["示例企业", "91110000123456789X", "北京市", "北京市朝阳区示例路1号", "张三", "商务系统", "个体经营"]
    ws.append(headers)
    ws.append(sample)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="enterprise_template.xlsx"'},
    )


@router.post("", response_model=EnterpriseResponse, status_code=status.HTTP_201_CREATED)
async def create_enterprise(
    request: Request,
    data: EnterpriseCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    enterprise = Enterprise(
        name=data.name,
        credit_code=data.credit_code,
        region=data.region,
        address=data.address,
        contact_person=data.contact_person,
        industry_sector=data.industry_sector,
        enterprise_type=data.enterprise_type,
    )
    db.add(enterprise)
    await db.commit()
    await db.refresh(enterprise)

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="create_enterprise",
        target_type="enterprise",
        target_id=enterprise.id,
        detail={"name": enterprise.name, "credit_code": enterprise.credit_code},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 201,
        },
    )

    return enterprise


@router.get("", response_model=EnterpriseListResponse)
async def list_enterprises(
    page: int = 1,
    page_size: int = 20,
    keyword: str = "",
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20

    where_clause = Enterprise.deleted_at.is_(None)
    if keyword:
        search = f"%{keyword}%"
        where_clause = where_clause & (
            Enterprise.name.ilike(search)
            | Enterprise.credit_code.ilike(search)
            | Enterprise.region.ilike(search)
            | Enterprise.contact_person.ilike(search)
        )

    result = await db.execute(
        select(Enterprise)
        .where(where_clause)
        .order_by(Enterprise.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    total_result = await db.execute(
        select(func.count()).select_from(Enterprise).where(where_clause)
    )
    total = total_result.scalar()

    return {"items": items, "total": total}


@router.get("/{enterprise_id}", response_model=EnterpriseResponse)
async def get_enterprise(
    enterprise_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await db.execute(
        select(Enterprise).where(Enterprise.id == enterprise_id, Enterprise.deleted_at.is_(None))
    )
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return enterprise


@router.put("/{enterprise_id}", response_model=EnterpriseResponse)
async def update_enterprise(
    request: Request,
    enterprise_id: UUID,
    data: EnterpriseUpdate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await db.execute(
        select(Enterprise).where(Enterprise.id == enterprise_id, Enterprise.deleted_at.is_(None))
    )
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    updated_fields = {}
    for field in ["name", "credit_code", "region", "address", "contact_person", "industry_sector", "enterprise_type"]:
        value = getattr(data, field)
        if value is not None:
            setattr(enterprise, field, value)
            updated_fields[field] = value

    await db.commit()
    await db.refresh(enterprise)

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="update_enterprise",
        target_type="enterprise",
        target_id=enterprise_id,
        detail={"name": enterprise.name, "updated_fields": list(updated_fields.keys())},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    return enterprise


@router.delete("/{enterprise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_enterprise(
    request: Request,
    enterprise_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await db.execute(
        select(Enterprise).where(Enterprise.id == enterprise_id, Enterprise.deleted_at.is_(None))
    )
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    enterprise_name = enterprise.name
    enterprise.deleted_at = datetime.now(ZoneInfo("Asia/Shanghai"))
    await db.commit()

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="delete_enterprise",
        target_type="enterprise",
        target_id=enterprise_id,
        detail={"name": enterprise_name},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 204,
        },
    )

    return None


@router.get("/{enterprise_id}/statistics")
async def get_enterprise_statistics(
    enterprise_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    result = await db.execute(
        select(
            func.count(Hazard.id).label("total_hazards"),
            func.sum(case((Hazard.status == "pending", 1), else_=0)).label("pending_count"),
            func.sum(case((Hazard.status == "passed", 1), else_=0)).label("passed_count"),
            func.sum(case((Hazard.status == "failed", 1), else_=0)).label("failed_count"),
        )
        .where(Hazard.enterprise_id == enterprise_id, Hazard.deleted_at.is_(None))
    )
    row = result.one_or_none()
    total = row.total_hazards or 0
    pending = row.pending_count or 0
    passed = row.passed_count or 0
    failed = row.failed_count or 0
    reviewed = passed + failed
    coverage_rate = round(reviewed / total * 100, 2) if total > 0 else 0.0
    pass_rate = round(passed / reviewed * 100, 2) if reviewed > 0 else 0.0

    return {
        "enterprise_id": enterprise_id,
        "total_hazards": total,
        "pending_count": pending,
        "passed_count": passed,
        "failed_count": failed,
        "reviewed_count": reviewed,
        "coverage_rate": coverage_rate,
        "pass_rate": pass_rate,
    }


def _read_file(filename: str, raw: bytes) -> pd.DataFrame:
    try:
        if filename.lower().endswith(".csv"):
            for encoding in ["utf-8", "gbk", "gb2312", "utf-8-sig"]:
                try:
                    return pd.read_csv(io.BytesIO(raw), encoding=encoding)
                except UnicodeDecodeError:
                    continue
            raise ValueError("Unable to decode CSV file")
        else:
            return pd.read_excel(io.BytesIO(raw))
    except Exception as e:
        raise ValueError(f"Failed to read file: {str(e)}")


def _get_value(row, cols: dict, possible_names: list):
    for name in possible_names:
        for key in cols:
            if key.lower() == name.lower():
                val = row[key]
                if pd.isna(val):
                    return None
                return str(val).strip()
            normalized_key = key.lower().replace(" ", "").replace("\u3000", "")
            normalized_name = name.lower().replace(" ", "").replace("\u3000", "")
            if normalized_key == normalized_name:
                val = row[key]
                if pd.isna(val):
                    return None
                return str(val).strip()
    return None


@router.post("/import", response_model=EnterpriseImportResult)
async def import_enterprises(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    raw = await file.read()
    df = _read_file(file.filename, raw)

    errors = []
    success_count = 0

    for idx, row in df.iterrows():
        row_num = int(idx) + 2
        try:
            cols = {str(k).strip(): str(k).strip() for k in row.index}
            name = _get_value(row, cols, ["企业名称", "enterprise_name", "企业", "enterprise", "名称"])
            credit_code = _get_value(row, cols, ["统一社会信用代码", "credit_code", "信用代码"])
            region = _get_value(row, cols, ["属地", "region", "所在地区"])
            address = _get_value(row, cols, ["详细地址", "address", "地址"])
            contact_person = _get_value(row, cols, ["负责人", "contact_person", "联系人", "法人代表"])
            industry_sector = _get_value(row, cols, ["行业领域", "industry_sector", "行业"])
            enterprise_type = _get_value(row, cols, ["企业类型", "enterprise_type", "类型"])

            if not name:
                raise ValueError("企业名称不能为空")

            # Check duplicate name
            dup = await db.execute(
                select(Enterprise).where(
                    Enterprise.name == name,
                    Enterprise.deleted_at.is_(None),
                )
            )
            if dup.scalar_one_or_none():
                raise ValueError(f"企业名称已存在: {name}")

            # Check duplicate credit_code
            if credit_code:
                dup_code = await db.execute(
                    select(Enterprise).where(
                        Enterprise.credit_code == credit_code,
                        Enterprise.deleted_at.is_(None),
                    )
                )
                if dup_code.scalar_one_or_none():
                    raise ValueError(f"统一社会信用代码已存在: {credit_code}")

            enterprise = Enterprise(
                name=name,
                credit_code=credit_code,
                region=region,
                address=address,
                contact_person=contact_person,
                industry_sector=industry_sector,
                enterprise_type=enterprise_type,
            )
            db.add(enterprise)
            await db.flush()
            success_count += 1
        except Exception as e:
            errors.append(f"第{row_num}行: {str(e)}")

    await db.commit()

    await audit_log_service.record(
        db=db,
        user_id=admin.id,
        action="import_enterprises",
        target_type="enterprise",
        detail={"success_count": success_count, "error_count": len(errors)},
        request_info={
            "ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "method": request.method,
            "path": str(request.url.path),
            "status_code": 200,
        },
    )

    return {"success_count": success_count, "error_count": len(errors), "errors": errors}
