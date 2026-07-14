import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Public routes are normally skipped, but if a legacy JWT token is
      // passed via query string we still validate it so disabled/deleted
      // users cannot bypass authorization (e.g. photo access with ?token=).
      const request = context.switchToHttp().getRequest<Request>();
      const hasQueryToken = typeof request.query?.token === 'string' && request.query.token.length > 0;
      if (!hasQueryToken) {
        return true;
      }
    }

    return super.canActivate(context);
  }
}
