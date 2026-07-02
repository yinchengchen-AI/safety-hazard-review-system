import { Global, Module } from '@nestjs/common';
import { StartupChecksService } from './startup-checks';

@Global()
@Module({
  providers: [StartupChecksService],
  exports: [StartupChecksService],
})
export class StartupChecksModule {}
