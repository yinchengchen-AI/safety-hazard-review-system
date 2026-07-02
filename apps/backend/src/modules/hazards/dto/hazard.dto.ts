import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class HazardListQueryDto {
  @IsOptional() @IsString() enterprise_id?: string;
  @IsOptional() @IsString() batch_id?: string;
  @IsOptional() @IsString() status?: 'pending' | 'passed' | 'failed';
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() inspection_method?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) page_size?: number;
}

export class HazardResponseDto {
  id!: string;
  enterprise_id!: string;
  batch_id!: string;
  content!: string | null;
  description!: string | null;
  location!: string | null;
  category!: string | null;
  inspection_method!: string | null;
  inspector!: string | null;
  inspection_date!: Date | null;
  judgment_basis!: string | null;
  violation_clause!: string | null;
  is_rectified!: string | null;
  rectification_date!: Date | null;
  rectification_responsible!: string | null;
  rectification_measures!: string | null;
  report_remarks!: string | null;
  reporting_unit!: string | null;
  status!: string;
  current_task_id!: string | null;
  review_count!: number;
  created_at!: Date | null;
  updated_at!: Date | null;
  // Joined fields populated by the service layer.
  enterprise_name?: string | null;
  enterprise_credit_code?: string | null;
  enterprise_region?: string | null;
  enterprise_address?: string | null;
  enterprise_contact_person?: string | null;
  enterprise_industry_sector?: string | null;
  enterprise_enterprise_type?: string | null;
  batch_name?: string | null;
  batch_reporting_unit?: string | null;
}

export class HazardListResponseDto {
  items!: HazardResponseDto[];
  total!: number;
  page!: number;
  page_size!: number;
}

export class HazardEditableFieldsDto {
  description!: boolean;
  location!: boolean;
  category!: boolean;
  inspection_method!: boolean;
  inspector!: boolean;
  inspection_date!: boolean;
  judgment_basis!: boolean;
  violation_clause!: boolean;
  is_rectified!: boolean;
  rectification_date!: boolean;
  rectification_responsible!: boolean;
  rectification_measures!: boolean;
  report_remarks!: boolean;
  reporting_unit!: boolean;
}

const EDITABLE_FIELDS: (keyof HazardEditableFieldsDto)[] = [
  'description', 'location', 'category', 'inspection_method', 'inspector',
  'inspection_date', 'judgment_basis', 'violation_clause', 'is_rectified',
  'rectification_date', 'rectification_responsible', 'rectification_measures',
  'report_remarks', 'reporting_unit',
];

export class UpdateHazardDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @Length(1, 255) location?: string;
  @IsOptional() @IsString() @Length(1, 50) category?: string;
  @IsOptional() @IsString() @Length(1, 50) inspection_method?: string;
  @IsOptional() @IsString() @Length(1, 100) inspector?: string;
  @IsOptional() inspection_date?: Date;
  @IsOptional() @IsString() @Length(1, 500) judgment_basis?: string;
  @IsOptional() @IsString() violation_clause?: string;
  @IsOptional() @IsIn(['已整改', '未整改', '整改中']) is_rectified?: string;
  @IsOptional() rectification_date?: Date;
  @IsOptional() @IsString() @Length(1, 200) rectification_responsible?: string;
  @IsOptional() @IsString() rectification_measures?: string;
  @IsOptional() @IsString() report_remarks?: string;
  @IsOptional() @IsString() @Length(1, 100) reporting_unit?: string;
}

export { EDITABLE_FIELDS };
