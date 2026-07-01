import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } })],
  providers: [PhotosService],
  controllers: [PhotosController],
  exports: [PhotosService],
})
export class PhotosModule {}
