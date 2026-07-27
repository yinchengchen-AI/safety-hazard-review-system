import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PhotosService } from './photos.service';
import { PhotoBindRequestDto, PhotoListItemDto, PhotoListQueryDto, PhotoUploadResponseDto } from './dto/photo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ActiveUserGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { users } from '@prisma/client';

@Controller('api/v1/photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: users,
  ): Promise<PhotoUploadResponseDto> {
    if (!file) throw new BadRequestException('file is required');
    return this.photos.upload(
      file.buffer,
      file.originalname ?? 'image.jpg',
      file.mimetype ?? 'image/jpeg',
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @Post(':tempToken/bind')
  @HttpCode(200)
  async bind(
    @Param('tempToken') tempToken: string,
    @Body() dto: PhotoBindRequestDto,
    @CurrentUser() user: users,
  ): Promise<{ message: string }> {
    await this.photos.bind(tempToken, dto, user.id, user.role);
    return { message: 'Photo bound successfully' };
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @Get()
  async list(@Query() query: PhotoListQueryDto): Promise<PhotoListItemDto[]> {
    return this.photos.listByTaskHazard(query.task_hazard_id);
  }

  /**
   * Serve a photo. Auth via HMAC signature only — the signed URL
   * is the credential. Marked @Public because the HMAC sig itself
   * authenticates the request.
   */
  @Public()
  @Get(':photoId/image')
  async serve(
    @Param('photoId') photoId: string,
    @Query('size') size: 'original' | 'thumbnail' = 'original',
    @Query('sig') sig?: string,
    @Query('exp') exp?: string,
    @Res() res?: Response,
  ): Promise<void> {
    if (size !== 'original' && size !== 'thumbnail') {
      res!.status(400).json({ detail: 'Invalid size parameter', status_code: 400 });
      return;
    }
    if (!sig || !exp) {
      res!.status(401).json({ detail: 'Photo access requires a signed URL', status_code: 401 });
      return;
    }
    const file = await this.photos.serveSigned(photoId, size, sig, Number(exp));
    if (!file) {
      res!.status(404).json({ detail: 'Photo not found', status_code: 404 });
      return;
    }
    res!.setHeader('Content-Type', file.contentType);
    res!.setHeader('Cache-Control', 'private, max-age=300');
    res!.send(file.body);
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @Delete(':photoId')
  @HttpCode(204)
  async remove(
    @Param('photoId') photoId: string,
    @CurrentUser() user: users,
  ): Promise<void> {
    await this.photos.delete(photoId, user.id, user.role);
  }
}
