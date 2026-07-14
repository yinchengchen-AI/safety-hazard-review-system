import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'cookie',
  'cookies',
  'authorization',
  'auth',
  'secret',
  'secret_key',
  'minio_secret_key',
  'photo_signature_secret',
]);

function maskSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      out[k] = SENSITIVE_KEYS.has(lower) ? '***' : maskSensitive(v);
    }
    return out;
  }
  return obj;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = Date.now();

    const query = maskSensitive(req.query);
    const body = maskSensitive(req.body);
    const safeUrl = `${req.url}`.split('?')[0];

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log({
            method: req.method,
            url: safeUrl,
            query,
            body,
            status: res.statusCode,
            durationMs: ms,
          });
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.warn({
            method: req.method,
            url: safeUrl,
            query,
            body,
            status: err?.status ?? 500,
            durationMs: ms,
          });
        },
      }),
    );
  }
}
