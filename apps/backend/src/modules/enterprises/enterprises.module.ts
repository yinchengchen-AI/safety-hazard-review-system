import { Module } from '@nestjs/common';
import { EnterprisesService } from './enterprises.service';
import { EnterprisesController } from './enterprises.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  providers: [EnterprisesService],
  controllers: [EnterprisesController],
  exports: [EnterprisesService],
})
export class EnterprisesModule {}
