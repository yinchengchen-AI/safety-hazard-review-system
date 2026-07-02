import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

export class CreateReviewTaskDto {
  @IsString() @Length(1, 200) name!: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  hazard_ids?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true })
  batch_ids?: string[];
}

export class ReviewTaskResponseDto {
  id!: string;
  name!: string;
  creator_id!: string;
  status!: string;
  created_at!: Date | null;
  completed_at!: Date | null;
  creator_username?: string | null;
  hazard_count?: number;
  reviewed_count?: number;
  report_status?: string | null;
}

export class ReviewTaskDetailResponseDto extends ReviewTaskResponseDto {
  hazards!: any[];
}

export class ReviewSingleHazardDto {
  @IsString() @Length(1, 4000) conclusion!: string;
  @IsIn(['pending', 'passed', 'failed']) status_in_task!: string;
  @IsOptional() @IsArray() @IsString({ each: true })
  photo_tokens?: string[];
}

export class BatchReviewItemDto extends ReviewSingleHazardDto {
  @IsUUID() hazard_id!: string;
}

export class BatchReviewRequestDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => BatchReviewItemDto)
  items!: BatchReviewItemDto[];
}
