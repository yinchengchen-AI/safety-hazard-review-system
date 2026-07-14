import { MulterError } from 'multer';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuditContextStore } from '../audit-context';
import { AuditLogsService } from '../../modules/audit-logs/audit-logs.service';

// Per-route multer limits. Keep in sync with the FileInterceptor
// configs in the controllers; the filter only uses this for the
// user-facing error message.
const ROUTE_FILE_LIMITS: Array<{ match: (path: string) => boolean; bytes: number }> = [
  { match: (p) => p.startsWith('/api/v1/photos/upload'), bytes: 10 * 1024 * 1024 },
  { match: (p) => p.startsWith('/api/v1/batches/import'), bytes: 50 * 1024 * 1024 },
];

function fileLimitFor(path: string): number | undefined {
  const hit = ROUTE_FILE_LIMITS.find((r) => r.match(path));
  return hit?.bytes;
}

function humanFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/**
 * Translate every error to the FastAPI shape: ``{ detail, status_code }``.
 * Internal errors are never exposed unless ``EXPOSE_INTERNAL_ERRORS`` is set.
 *
 * Side effect: failed requests (4xx / 5xx) get an audit_logs row
 * written through ``AuditLogsService`` so the admin can see who hit
 * what without having to grep the HTTP access log.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  // ``audit`` is optional so the filter can be instantiated
  // directly in tests (e.g. ``app.useGlobalFilters(new
  // AllExceptionsFilter())``) without dragging the full DI graph
  // in. In production the global APP_FILTER provider wires the
  // AuditLogsService in.
  constructor(private readonly audit?: AuditLogsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail: string | string[] = 'Internal server error';

    const url = request.url?.split('?')[0] ?? '';

    if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      const limit = fileLimitFor(url);
      detail = limit
        ? `文件大小超过限制（最大 ${humanFileSize(limit)}）`
        : '文件大小超过限制';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        detail = body;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        if (typeof obj.message === 'string') detail = obj.message;
        else if (Array.isArray(obj.message)) detail = obj.message.map(String);
        else if (typeof obj.detail === 'string') detail = obj.detail;
        else detail = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`unhandled error on ${request.method} ${request.url}: ${exception.message}`, exception.stack);
      if (process.env.EXPOSE_INTERNAL_ERRORS === 'true') {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        detail = exception.message;
      }
    }

    if (status >= 400) {
      const userId = (request as Request & { user?: { id?: string } }).user?.id ?? null;
      const reqCtx = AuditContextStore.get();
      const action = this.deriveAction(request.method, url);
      const targetType = this.deriveTargetType(url);
      const detailMsg = Array.isArray(detail) ? detail.join('; ') : detail;
      this.audit?.record({
          userId,
          action,
          targetType,
          targetId: (request.params as Record<string, string>)?.id ?? null,
          detail: { error: detailMsg, status_code: status },
          requestInfo: {
            ip: reqCtx?.ipAddress,
            userAgent: reqCtx?.userAgent,
            method: request.method,
            path: reqCtx?.path ?? url,
            statusCode: status,
          },
        })
        .catch(() => undefined);
    }

    response.status(status).json({
      detail,
      status_code: status,
    });
  }

  private deriveAction(method: string, url: string): string {
    const op = url.split('/').filter(Boolean)[2] ?? url;
    return `${method.toLowerCase()}.${op || 'unknown'}`;
  }

  private deriveTargetType(url: string): string {
    if (url.startsWith('/api/v1/auth')) return 'auth';
    if (url.startsWith('/api/v1/users')) return 'user';
    if (url.startsWith('/api/v1/enterprises')) return 'enterprise';
    if (url.startsWith('/api/v1/hazards')) return 'hazard';
    if (url.startsWith('/api/v1/batches')) return 'batch';
    if (url.startsWith('/api/v1/review-tasks')) return 'review_task';
    if (url.startsWith('/api/v1/reports')) return 'report';
    if (url.startsWith('/api/v1/photos')) return 'photo';
    if (url.startsWith('/api/v1/notifications')) return 'notification';
    return 'unknown';
  }
}
