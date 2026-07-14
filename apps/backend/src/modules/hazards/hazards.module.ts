import { Module } from '@nestjs/common';
import { HazardsService } from './hazards.service';
import { HazardsController } from './hazards.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  providers: [HazardsService],
  controllers: [HazardsController],
  exports: [HazardsService],
})
export class HazardsModule {}
