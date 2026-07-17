import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { users } from '@prisma/client';

/**
 * Token priority: Authorization Bearer header > access_token cookie.
 * The browser SPA uses the cookie; tests and direct API consumers
 * can override with a header.
 */
function extractToken(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7);
  }
  if (req.cookies && typeof req.cookies['access_token'] === 'string') {
    return req.cookies['access_token'];
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: extractToken,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('SECRET_KEY', ''),
    });
  }

  async validate(payload: { sub: string; ver?: number; role?: string }): Promise<users> {
    // Prisma's soft-delete middleware (Phase 1) already excludes rows
    // where deleted_at is set, so a missing user means either deleted
    // or wrong id.
    const user = await this.prisma.users.findFirst({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Could not validate credentials');
    }
    // P1-6: token_version bump (on password reset / role change /
    // explicit "log out everywhere") invalidates every token minted
    // before the bump. Tokens minted before this field existed will
    // have payload.ver === undefined, which we treat as v0.
    const claimedVersion = typeof payload.ver === 'number' ? payload.ver : 0;
    if (claimedVersion !== user.token_version) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return user;
  }
}
