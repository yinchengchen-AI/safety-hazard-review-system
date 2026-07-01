import { Module } from '@nestjs/common';
import { EnterprisesService } from './enterprises.service';
import { EnterprisesController } from './enterprises.controller';

@Module({
  providers: [EnterprisesService],
  controllers: [EnterprisesController],
  exports: [EnterprisesService],
})
export class EnterprisesModule {}
