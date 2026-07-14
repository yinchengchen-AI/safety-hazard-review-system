import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, needsRehash, verifyPassword } from '../../common/security.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface LoginResult {
  access_token: string;
  token_type: 'bearer';
  user: { id: string; username: string; role: string; is_active: boolean };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly cookieName = 'access_token';
  private readonly cookieMaxAgeMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogsService,
  ) {
    const minutes = this.config.get<number>('ACCESS_TOKEN_EXPIRE_MINUTES', 480);
    this.cookieMaxAgeMs = minutes * 60 * 1000;
  }

  /**
   * Validate a username + password pair. Returns the user on success.
   * Throws UnauthorizedException with a translated message otherwise.
   * ``is_active`` is checked here so we can surface a consistent
   * error code regardless of whether the row exists.
   *
   * Login attempts (success + failure) get an explicit audit row so
   * the operator can investigate brute force / credential stuffing.
   */
  async validateCredentials(username: string, password: string) {
    const user = await this.prisma.users.findFirst({ where: { username } });
    if (!user || !user.is_active) {
      await this.recordLoginFailure(username, user ? 'inactive' : 'unknown_user');
      throw new UnauthorizedException('Incorrect username or password');
    }
    if (!verifyPassword(password, user.password_hash)) {
      await this.recordLoginFailure(username, 'bad_password', user.id);
      throw new UnauthorizedException('Incorrect username or password');
    }

    if (needsRehash(user.password_hash)) {
      user.password_hash = hashPassword(password);
      await this.prisma.users.update({
        where: { id: user.id },
        data: { password_hash: user.password_hash },
      });
    }
    await this.audit.record({
      userId: user.id,
      action: 'auth.login.success',
      targetType: 'auth',
      targetId: user.id,
      detail: { username: user.username },
    });
    return user;
  }

  private async recordLoginFailure(
    username: string,
    reason: string,
    userId?: string,
  ): Promise<void> {
    await this.audit.record({
      userId: userId ?? null,
      action: 'auth.login.failure',
      targetType: 'auth',
      targetId: userId ?? null,
      detail: { username, reason },
    });
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.validateCredentials(username, password);
    const access_token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      access_token,
      token_type: 'bearer',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
      },
    };
  }

  /** HTTP cookie helpers. The browser SPA relies on the httpOnly
   *  cookie for auth; tests / curl can override with an
   *  Authorization header (see JwtAuthGuard priority). */
  buildAuthCookie(token: string, isProd: boolean): string {
    const flags = [
      `${this.cookieName}=${token}`,
      'Path=/',
      `Max-Age=${Math.floor(this.cookieMaxAgeMs / 1000)}`,
      'HttpOnly',
      'SameSite=Strict',
    ];
    if (isProd) flags.push('Secure');
    return flags.join('; ');
  }

  buildClearCookie(isProd: boolean): string {
    const flags = [
      `${this.cookieName}=`,
      'Path=/',
      'Max-Age=0',
      'HttpOnly',
      'SameSite=Strict',
    ];
    if (isProd) flags.push('Secure');
    return flags.join('; ');
  }

  isProd(): boolean {
    const env = this.config.get<string>('ENV', 'dev');
    return env === 'production' || env === 'staging';
  }
}
