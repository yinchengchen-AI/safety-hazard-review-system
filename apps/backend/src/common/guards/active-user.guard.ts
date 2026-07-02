import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { users } from '@prisma/client';

/**
 * Companion to ``JwtAuthGuard``: ensures the user returned by the JWT
 * strategy is still active and not soft-deleted. The strategy already
 * filters soft-deleted rows via the Prisma middleware, so this guard
 * only has to check the ``is_active`` flag.
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: users | undefined = request.user;
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Could not validate credentials');
    }
    return true;
  }
}
