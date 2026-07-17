import { Module } from '@nestjs/common';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  providers: [
    AuditLogsService,
    makeCounterProvider({
      name: 'audit_write_failures_total',
      help: 'Total number of audit_log row writes that failed',
      labelNames: ['kind'],
    }),
  ],
  controllers: [AuditLogsController],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
