import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { users } from '@prisma/client';

/**
 * Token priority: Authorization Bearer header > access_token cookie > ?token=
 * query string. The browser SPA uses the cookie; tests and direct API
 * consumers can override with a header. ``?token=`` is kept for the
 * photo URL migration window and will be removed in a later phase.
 */
function extractToken(req: Request): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7);
  }
  if (req.cookies && typeof req.cookies['access_token'] === 'string') {
    return req.cookies['access_token'];
  }
  const q = (req.query as Record<string, unknown>).token;
  if (typeof q === 'string') return q;
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

  async validate(payload: { sub: string }): Promise<users> {
    // Prisma's soft-delete middleware (Phase 1) already excludes rows
    // where deleted_at is set, so a missing user means either deleted
    // or wrong id.
    const user = await this.prisma.users.findFirst({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Could not validate credentials');
    }
    return user;
  }
}
