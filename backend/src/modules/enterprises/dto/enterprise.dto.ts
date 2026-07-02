import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class CreateEnterpriseDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional() @IsString() @Length(1, 50) credit_code?: string;
  @IsOptional() @IsString() @Length(1, 100) region?: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 100) contact_person?: string;
  @IsOptional() @IsString() @Length(1, 100) industry_sector?: string;
  @IsOptional() @IsString() @Length(1, 50) enterprise_type?: string;
}

export class UpdateEnterpriseDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @Length(1, 50) credit_code?: string;
  @IsOptional() @IsString() @Length(1, 100) region?: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 100) contact_person?: string;
  @IsOptional() @IsString() @Length(1, 100) industry_sector?: string;
  @IsOptional() @IsString() @Length(1, 50) enterprise_type?: string;
}

export class EnterpriseResponseDto {
  id!: string;
  name!: string;
  credit_code!: string | null;
  region!: string | null;
  address!: string | null;
  contact_person!: string | null;
  industry_sector!: string | null;
  enterprise_type!: string | null;
  created_at!: Date | null;
}

export class EnterpriseListResponseDto {
  items!: EnterpriseResponseDto[];
  total!: number;
}

export class EnterpriseImportResultDto {
  success_count!: number;
  error_count!: number;
  errors!: string[];
}

/** A single row in the import payload. The front-end parses the
 *  Excel with exceljs and sends us JSON; we never touch the binary
 *  parser here. */
export class EnterpriseImportRow {
  // Empty string allowed here; the service treats it as a business
  // error (``name 不能为空``) so the row is recorded in
  // ``import_errors`` rather than rejected at the validation layer.
  @IsString() @Length(0, 200) name!: string;
  @IsOptional() @IsString() @Length(1, 50) credit_code?: string;
  @IsOptional() @IsString() @Length(1, 100) region?: string;
  @IsOptional() @IsString() @Length(1, 500) address?: string;
  @IsOptional() @IsString() @Length(1, 100) contact_person?: string;
  @IsOptional() @IsString() @Length(1, 100) industry_sector?: string;
  @IsOptional() @IsString() @Length(1, 50) enterprise_type?: string;
}

export class EnterpriseImportRequestDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => EnterpriseImportRow)
  rows!: EnterpriseImportRow[];
}
