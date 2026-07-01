import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Translate every error to the legacy FastAPI shape: ``{ detail: string, status_code: number }``.
 * This keeps the front-end error mapping (en → zh) working unchanged.
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

    if (exception instanceof HttpException) {
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
      detail = exception.message;
      this.logger.error(`unhandled error on ${request.method} ${request.url}: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      detail,
      status_code: status,
    });
  }
}
