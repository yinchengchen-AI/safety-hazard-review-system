import { IsString, MinLength } from 'class-validator';

export class LoginRequest {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class TokenResponse {
  access_token!: string;
  token_type: 'bearer' = 'bearer';
}
