import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(1, 50)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['admin', 'inspector'])
  role!: 'admin' | 'inspector';

  @IsOptional()
  @IsString()
  @Length(1, 100)
  full_name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['admin', 'inspector'])
  role?: 'admin' | 'inspector';

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  full_name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  new_password!: string;
}

export class UserResponseDto {
  id!: string;
  username!: string;
  full_name?: string | null;
  phone?: string | null;
  role!: string;
  is_active!: boolean;
  created_at!: Date | null;
}

export class UserListResponseDto {
  items!: UserResponseDto[];
  total!: number;
}
