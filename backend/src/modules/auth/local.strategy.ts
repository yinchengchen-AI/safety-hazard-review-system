import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service';
import { users } from '@prisma/client';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'username', passwordField: 'password' });
  }

  async validate(username: string, password: string): Promise<users> {
    return this.auth.validateCredentials(username, password);
  }
}
