import {
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
import { Request, Response } from 'express';
import { PhotosService } from './photos.service';
import { PhotoBindRequestDto, PhotoUploadResponseDto } from './dto/photo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ActiveUserGuard } from '../../common/guards';

@Controller('api/v1/photos')
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PhotoUploadResponseDto> {
    if (!file) throw new Error('file is required');
    return this.photos.upload(file.buffer, file.originalname ?? 'image.jpg', file.mimetype ?? 'image/jpeg');
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @Post(':tempToken/bind')
  @HttpCode(200)
  async bind(
    @Param('tempToken') tempToken: string,
    @Body() dto: PhotoBindRequestDto,
  ): Promise<{ message: string }> {
    await this.photos.bind(tempToken, dto);
    return { message: 'Photo bound successfully' };
  }

  /**
   * Serve a photo. Auth via HMAC sig (preferred) or ?token=<jwt>
   * (legacy). Sets ``X-Photo-Auth-Deprecated: true`` on the legacy
   * path so the client knows to migrate. Marked @Public because the
   * HMAC sig itself authenticates the request.
   */
  @Public()
  @Get(':photoId/image')
  async serve(
    @Param('photoId') photoId: string,
    @Query('size') size: 'original' | 'thumbnail' = 'original',
    @Query('sig') sig?: string,
    @Query('exp') exp?: string,
    @Query('token') token?: string,
    @Req() req?: Request,
    @Res() res?: Response,
  ): Promise<void> {
    if (size !== 'original' && size !== 'thumbnail') {
      res!.status(400).json({ detail: 'Invalid size parameter', status_code: 400 });
      return;
    }
    let legacy = false;
    let file: { body: Buffer; contentType: string } | null = null;
    if (sig && exp) {
      file = await this.photos.serveSigned(photoId, size, sig, Number(exp));
    } else if (token && req) {
      // Legacy path: the global JwtAuthGuard has already validated
      // the JWT and populated req.user; we just read its id.
      const user = (req as { user?: { id: string } }).user;
      if (!user) {
        res!.status(401).json({ detail: 'Photo access requires a signed URL or bearer token', status_code: 401 });
        return;
      }
      const r = await this.photos.serveLegacy(photoId, size, user.id);
      file = r ? { body: r.body, contentType: r.contentType } : null;
      legacy = r?.legacy ?? false;
    } else {
      res!.status(401).json({ detail: 'Photo access requires a signed URL or bearer token', status_code: 401 });
      return;
    }
    if (!file) {
      res!.status(404).json({ detail: 'Photo not found', status_code: 404 });
      return;
    }
    res!.setHeader('Content-Type', file.contentType);
    res!.setHeader('Cache-Control', 'private, max-age=300');
    if (legacy) res!.setHeader('X-Photo-Auth-Deprecated', 'true');
    res!.send(file.body);
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard)
  @Delete(':photoId')
  @HttpCode(204)
  async remove(@Param('photoId') photoId: string): Promise<void> {
    await this.photos.delete(photoId);
  }
}
