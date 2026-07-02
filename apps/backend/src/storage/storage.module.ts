import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { UrlSignerService } from './url-signer.service';

@Global()
@Module({
  providers: [StorageService, UrlSignerService],
  exports: [StorageService, UrlSignerService],
})
export class StorageModule {}
