import { MulterError } from 'multer';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Translate every error to the legacy FastAPI shape: ``{ detail: string, status_code: number }``.
 * Internal errors are never exposed to the client unless ``EXPOSE_INTERNAL_ERRORS`` is set.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail: string | string[] = 'Internal server error';

    if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      detail = '文件大小超过限制（最大 10MB）';
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

    response.status(status).json({
      detail,
      status_code: status,
    });
  }
}
