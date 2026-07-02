import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { users } from '@prisma/client';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): users => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
