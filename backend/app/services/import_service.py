import pandas as pd
import io
from typing import BinaryIO
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from app.models import Batch, Hazard, Enterprise, ImportError
from app.services.storage_service import StorageService


class ImportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _read_file(self, filename: str, raw: bytes) -> pd.DataFrame:
        try:
            if filename.lower().endswith(".csv"):
                return self._read_csv(raw)
            else:
                return pd.read_excel(io.BytesIO(raw))
        except Exception as e:
            raise ValueError(f"Failed to read file: {str(e)}")

    def preview_file(self, filename: str, content: BinaryIO) -> dict:
        raw = content.read()
        df = self._read_file(filename, raw)
        items = []
        for idx, row in df.head(50).iterrows():
            row_index = int(idx) + 2
            cols = {str(k).strip(): str(k).strip() for k in row.index}
            enterprise_name = self._get_value(row, cols, ["企业名称", "enterprise_name", "企业", "enterprise"])
            description = self._get_value(row, cols, ["隐患描述", "重大隐患描述", "举报问题描述", "description", "描述", "hazard_description"])
            location = self._get_value(row, cols, ["隐患位置", "location", "位置", "hazard_location"])
            credit_code = self._get_value(row, cols, ["统一社会信用代码", "credit_code", "信用代码"])
            region = self._get_value(row, cols, ["属地", "region", "所在地区"])
            address = self._get_value(row, cols, ["详细地址", "address", "地址"])
            contact_person = self._get_value(row, cols, ["负责人", "contact_person", "联系人", "法人代表"])
            industry_sector = self._get_value(row, cols, ["行业领域", "industry_sector", "行业"])
            enterprise_type = self._get_value(row, cols, ["企业类型", "enterprise_type", "类型"])
            reporting_unit = self._get_value(row, cols, ["上报单位", "reporting_unit", "上报机构"])
            category = self._get_value(row, cols, ["隐患分类", "category", "分类"])
            inspection_method = self._get_value(row, cols, ["检查方式", "inspection_method", "检查"])
            inspector = self._get_value(row, cols, ["检查人", "inspector", "检查人员"])
            inspection_date = self._get_value(row, cols, ["检查时间", "inspection_date", "检查日期"])
            judgment_basis = self._get_value(row, cols, ["判定依据", "judgment_basis"])
            violation_clause = self._get_value(row, cols, ["违反判定依据具体条款", "violation_clause", "条款"])
            is_rectified = self._get_value(row, cols, ["是否整改", "is_rectified", "整改状态"])
            rectification_date = self._get_value(row, cols, ["实际整改完成时间", "rectification_date", "整改完成时间"])
            rectification_responsible = self._get_value(row, cols, ["整改责任部门/责任人", "rectification_responsible", "整改责任人"])
            rectification_measures = self._get_value(row, cols, ["整改措施", "rectification_measures"])
            report_remarks = self._get_value(row, cols, ["举报情况备注", "report_remarks", "备注"])
            errors = []
            if not enterprise_name:
                errors.append("企业名称不能为空")
            if not description:
                errors.append("隐患描述不能为空")
            items.append({
                "row_index": row_index,
                "enterprise_name": enterprise_name,
                "credit_code": credit_code,
                "region": region,
                "address": address,
                "contact_person": contact_person,
                "industry_sector": industry_sector,
                "enterprise_type": enterprise_type,
                "reporting_unit": reporting_unit,
                "description": description,
                "content": description,
                "location": location,
                "category": category,
                "inspection_method": inspection_method,
                "inspector": inspector,
                "inspection_date": inspection_date,
                "judgment_basis": judgment_basis,
                "violation_clause": violation_clause,
                "is_rectified": is_rectified,
                "rectification_date": rectification_date,
                "rectification_responsible": rectification_responsible,
                "rectification_measures": rectification_measures,
                "report_remarks": report_remarks,
                "errors": errors,
            })
        return {"total": len(df), "items": items}

    async def import_file(self, temp_token: str, filename: str, batch_name: str, user_id: UUID):
        storage = StorageService()
        temp_object_name = f"temp/batch-preview/{temp_token}/{filename}"
        try:
            response = storage.get_file(temp_object_name)
            raw = response.read()
        except Exception as e:
            raise ValueError(f"无法读取暂存文件: {str(e)}")

        df = self._read_file(filename, raw)

        batch = Batch(
            name=batch_name,
            file_name=filename,
            total_count=len(df),
            success_count=0,
            fail_count=0,
            creator_id=user_id,
        )
        self.db.add(batch)
        await self.db.flush()

        # Move original file to permanent location
        permanent_object_name = f"uploads/batches/{batch.id}/{filename}"
        try:
            storage.client.put_object(
                storage.bucket,
                permanent_object_name,
                io.BytesIO(raw),
                length=len(raw),
                content_type="application/octet-stream",
            )
            batch.original_file_path = f"/{storage.bucket}/{permanent_object_name}"
        except Exception:
            pass

        errors = []
        success_count = 0

        for idx, row in df.iterrows():
            row_num = int(idx) + 2  # Excel row number (1-based + header)
            try:
                await self._process_row(row, row_num, batch.id)
                success_count += 1
            except Exception as e:
                errors.append({
                    "row_index": row_num,
                    "reason": str(e),
                })
                error_record = ImportError(
                    batch_id=batch.id,
                    row_index=row_num,
                    raw_data=str(row.to_dict()),
                    reason=str(e),
                )
                self.db.add(error_record)
                await self.db.flush()

        batch.success_count = success_count
        batch.fail_count = len(errors)
        await self.db.commit()
        await self.db.refresh(batch)

        # Clean up temp file
        try:
            storage.delete_file(temp_object_name)
        except Exception:
            pass

        from app.schemas import BatchResponse

        return {
            "batch": BatchResponse.model_validate(batch),
            "success_count": success_count,
            "fail_count": len(errors),
            "errors": errors,
        }

    def _read_csv(self, raw: bytes) -> pd.DataFrame:
        for encoding in ["utf-8", "gbk", "gb2312", "utf-8-sig"]:
            try:
                return pd.read_csv(io.BytesIO(raw), encoding=encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError("Unable to decode CSV file with any supported encoding")

    async def _process_row(self, row, row_num: int, batch_id: UUID):
        # Normalize column names - support Chinese and English headers
        cols = {str(k).strip(): str(k).strip() for k in row.index}

        enterprise_name = self._get_value(row, cols, ["企业名称", "enterprise_name", "企业", "enterprise"])
        description = self._get_value(row, cols, ["隐患描述", "重大隐患描述", "举报问题描述", "description", "描述", "hazard_description"])
        location = self._get_value(row, cols, ["隐患位置", "location", "位置", "hazard_location"])
        credit_code = self._get_value(row, cols, ["统一社会信用代码", "credit_code", "信用代码"])
        region = self._get_value(row, cols, ["属地", "region", "所在地区"])
        address = self._get_value(row, cols, ["详细地址", "address", "地址"])
        contact_person = self._get_value(row, cols, ["负责人", "contact_person", "联系人", "法人代表"])
        industry_sector = self._get_value(row, cols, ["行业领域", "industry_sector", "行业"])
        enterprise_type = self._get_value(row, cols, ["企业类型", "enterprise_type", "类型"])
        reporting_unit = self._get_value(row, cols, ["上报单位", "reporting_unit", "上报机构"])
        category = self._get_value(row, cols, ["隐患分类", "category", "分类"])
        inspection_method = self._get_value(row, cols, ["检查方式", "inspection_method", "检查"])
        inspector = self._get_value(row, cols, ["检查人", "inspector", "检查人员"])
        inspection_date_str = self._get_value(row, cols, ["检查时间", "inspection_date", "检查日期"])
        judgment_basis = self._get_value(row, cols, ["判定依据", "judgment_basis"])
        violation_clause = self._get_value(row, cols, ["违反判定依据具体条款", "violation_clause", "条款"])
        is_rectified = self._get_value(row, cols, ["是否整改", "is_rectified", "整改状态"])
        rectification_date_str = self._get_value(row, cols, ["实际整改完成时间", "rectification_date", "整改完成时间"])
        rectification_responsible = self._get_value(row, cols, ["整改责任部门/责任人", "rectification_responsible", "整改责任人"])
        rectification_measures = self._get_value(row, cols, ["整改措施", "rectification_measures"])
        report_remarks = self._get_value(row, cols, ["举报情况备注", "report_remarks", "备注"])

        if not enterprise_name:
            raise ValueError("企业名称不能为空")
        if not description:
            raise ValueError("隐患描述不能为空")

        # Parse dates
        inspection_date = self._parse_date(inspection_date_str)
        rectification_date = self._parse_date(rectification_date_str)

        # Find or create enterprise with row lock
        result = await self.db.execute(
            select(Enterprise)
            .where(Enterprise.name == enterprise_name, Enterprise.deleted_at.is_(None))
            .with_for_update()
        )
        enterprise = result.scalar_one_or_none()
        if not enterprise:
            enterprise = Enterprise(
                name=enterprise_name,
                credit_code=credit_code,
                region=region,
                address=address,
                contact_person=contact_person,
                industry_sector=industry_sector,
                enterprise_type=enterprise_type,
            )
            self.db.add(enterprise)
            await self.db.flush()
        else:
            # Update enterprise info if provided
            if industry_sector:
                enterprise.industry_sector = industry_sector
            if enterprise_type:
                enterprise.enterprise_type = enterprise_type
            if credit_code:
                enterprise.credit_code = credit_code
            if region:
                enterprise.region = region
            if address:
                enterprise.address = address
            if contact_person:
                enterprise.contact_person = contact_person
            await self.db.flush()
        await self.db.commit()

        # Re-bind enterprise id after commit
        enterprise_id = enterprise.id

        # Update batch reporting_unit
        batch_result = await self.db.execute(select(Batch).where(Batch.id == batch_id))
        batch = batch_result.scalar_one_or_none()
        if batch and reporting_unit and not batch.reporting_unit:
            batch.reporting_unit = reporting_unit
            await self.db.flush()
            await self.db.commit()

        # Deduplication check (1 month)
        one_month_ago = datetime.now(ZoneInfo("Asia/Shanghai")) - timedelta(days=30)
        dup_result = await self.db.execute(
            select(Hazard).where(
                Hazard.enterprise_id == enterprise_id,
                Hazard.description == description,
                Hazard.location == location,
                Hazard.deleted_at.is_(None),
                Hazard.created_at >= one_month_ago,
            )
        )
        if dup_result.scalar_one_or_none():
            raise ValueError("重复数据（最近1个月内已存在）")

        hazard = Hazard(
            enterprise_id=enterprise_id,
            batch_id=batch_id,
            content=description,
            description=description,
            location=location,
            category=category,
            inspection_method=inspection_method,
            inspector=inspector,
            inspection_date=inspection_date,
            judgment_basis=judgment_basis,
            violation_clause=violation_clause,
            is_rectified=is_rectified,
            rectification_date=rectification_date,
            rectification_responsible=rectification_responsible,
            rectification_measures=rectification_measures,
            report_remarks=report_remarks,
            reporting_unit=reporting_unit,
            status="pending",
        )
        try:
            self.db.add(hazard)
            await self.db.flush()
        except IntegrityError:
            await self.db.rollback()
            raise ValueError("重复数据（最近1个月内已存在）")
        # Commit per row for partial success semantics
        await self.db.commit()

    def _get_value(self, row, cols: dict, possible_names: list):
        for name in possible_names:
            for key in cols:
                # Strict match
                if key.lower() == name.lower():
                    val = row[key]
                    if pd.isna(val):
                        return None
                    return str(val).strip()
                # Fuzzy match: ignore all spaces (half-width and full-width)
                normalized_key = key.lower().replace(" ", "").replace("\u3000", "")
                normalized_name = name.lower().replace(" ", "").replace("\u3000", "")
                if normalized_key == normalized_name:
                    val = row[key]
                    if pd.isna(val):
                        return None
                    return str(val).strip()
        return None

    def _parse_date(self, val):
        if not val:
            return None
        try:
            # Try pandas to_datetime first
            dt = pd.to_datetime(str(val), errors="raise")
            return dt.date()
        except Exception:
            return None
