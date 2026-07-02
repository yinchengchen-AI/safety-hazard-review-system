import { Module } from '@nestjs/common';
import { HazardsService } from './hazards.service';
import { HazardsController } from './hazards.controller';

@Module({
  providers: [HazardsService],
  controllers: [HazardsController],
  exports: [HazardsService],
})
export class HazardsModule {}
