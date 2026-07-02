import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.warn(`${req.method} ${req.url} ${err?.status ?? 500} ${ms}ms`);
        },
      }),
    );
  }
}
