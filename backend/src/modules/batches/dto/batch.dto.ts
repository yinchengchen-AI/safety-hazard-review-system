import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

/** A single hazard row in the import payload. The front-end parses
 *  Excel with exceljs and sends us JSON; we keep the binary parser
 *  out of the backend. */
export class HazardImportRow {
  @IsString() @Length(1, 200) enterprise_name!: string;
  @IsOptional() @IsString() @Length(1, 50) credit_code?: string;
  @IsOptional() @IsString() @Length(1, 100) region?: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 100) contact_person?: string;
  @IsOptional() @IsString() @Length(1, 100) industry_sector?: string;
  @IsOptional() @IsString() @Length(1, 50) enterprise_type?: string;
  @IsOptional() @IsString() @Length(1, 100) reporting_unit?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsString() @Length(1, 255) location?: string;
  @IsOptional() @IsString() @Length(1, 50) category?: string;
  @IsOptional() @IsString() @Length(1, 50) inspection_method?: string;
  @IsOptional() @IsString() @Length(1, 100) inspector?: string;
  @IsOptional() @IsDateString() inspection_date?: string;
  @IsOptional() @IsString() @Length(1, 500) judgment_basis?: string;
  @IsOptional() @IsString() violation_clause?: string;
  @IsOptional() @IsIn(['已整改', '未整改', '整改中']) is_rectified?: string;
  @IsOptional() @IsDateString() rectification_date?: string;
  @IsOptional() @IsString() @Length(1, 200) rectification_responsible?: string;
  @IsOptional() @IsString() rectification_measures?: string;
  @IsOptional() @IsString() report_remarks?: string;
}

export class BatchImportRequestDto {
  @IsString() @Length(1, 100) name!: string;
  @IsString() @Length(1, 255) filename!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => HazardImportRow)
  rows!: HazardImportRow[];
}

export class BatchResponseDto {
  id!: string;
  name!: string;
  import_time!: Date | null;
  file_name!: string | null;
  total_count!: number;
  success_count!: number;
  fail_count!: number;
  creator_username?: string | null;
  original_file_path?: string | null;
  reporting_unit?: string | null;
  created_at!: Date | null;
  available_hazard_count?: number;
}

export class BatchImportResultDto {
  batch!: BatchResponseDto;
  success_count!: number;
  fail_count!: number;
  errors!: { row_index: number; reason: string }[];
}

export class ImportErrorResponseDto {
  id!: string;
  batch_id!: string;
  row_index!: number;
  raw_data!: string | null;
  reason!: string;
}

export class BatchPreviewRequestDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => HazardImportRow)
  rows!: HazardImportRow[];
}

export class BatchPreviewItemDto {
  row_index!: number;
  enterprise_name!: string | null;
  description!: string | null;
  errors!: string[];
}

export class BatchPreviewResponseDto {
  total!: number;
  items!: BatchPreviewItemDto[];
}
