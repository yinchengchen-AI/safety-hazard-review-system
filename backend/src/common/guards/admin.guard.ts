import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Allows only ``role === 'admin'`` users through. Pair with ``JwtAuthGuard``
 * and ``ActiveUserGuard`` via ``@UseGuards(...)``.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
