import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuditContextStore } from '../audit-context';

/**
 * Opens an AsyncLocalStorage scope for the duration of each request
 * so downstream services can call ``AuditLogsService.record()`` and
 * have the request IP / method / path / user-agent filled in
 * automatically. The same scope is honoured by the exception filter
 * so failed requests can also write a log row.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined;
    const userAgent = (req.headers['user-agent'] as string | undefined)?.slice(0, 500);

    return AuditContextStore.run(
      {
        ipAddress,
        userAgent,
        method: req.method,
        path: req.url?.split('?')[0]?.slice(0, 200),
      },
      () =>
        next.handle().pipe(
          tap(() => {
            const ctx = AuditContextStore.get();
            if (ctx) ctx.statusCode = res.statusCode;
          }),
          catchError((err) => {
            const ctx = AuditContextStore.get();
            if (ctx) ctx.statusCode = err?.status ?? res.statusCode ?? 500;
            return throwError(() => err);
          }),
        ),
    );
  }
}
