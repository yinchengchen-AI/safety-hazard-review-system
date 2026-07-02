import { IsString, IsUUID, Length } from 'class-validator';

export class PhotoBindRequestDto {
  @IsUUID()
  task_hazard_id!: string;
}

export class PhotoUploadResponseDto {
  temp_token!: string;
  original_url!: string;
  thumbnail_url!: string;
  width!: number;
  height!: number;
  file_size!: number;
}
