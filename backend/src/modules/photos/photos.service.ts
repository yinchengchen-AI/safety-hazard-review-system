import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { UrlSignerService } from '../../storage/url-signer.service';
import { PhotoBindRequestDto, PhotoUploadResponseDto } from './dto/photo.dto';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_DIM = 100;
const MAX_DIM = 8192;

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly signer: UrlSignerService,
  ) {}

  async upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<PhotoUploadResponseDto> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException(`Invalid file type: ${mimeType}`);
    }
    let meta;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      throw new BadRequestException('Invalid image file');
    }
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < MIN_DIM || h < MIN_DIM || w > MAX_DIM || h > MAX_DIM) {
      throw new BadRequestException(`Image dimensions out of allowed range: ${w}x${h}`);
    }

    const tempToken = randomUUID();
    const { originalKey, thumbnailKey } = await this.storage.uploadImage(buffer, filename, tempToken);
    const photo = await this.prisma.photos.create({
      data: {
        original_path: originalKey,
        thumbnail_path: thumbnailKey,
        file_size: buffer.length,
        mime_type: mimeType,
        width: w,
        height: h,
        temp_token: tempToken,
      },
    });

    return {
      temp_token: tempToken,
      original_url: this.signer.signPhotoUrl(photo.id, 'original'),
      thumbnail_url: this.signer.signPhotoUrl(photo.id, 'thumbnail'),
      width: w,
      height: h,
      file_size: buffer.length,
    };
  }

  async bind(tempToken: string, dto: PhotoBindRequestDto): Promise<void> {
    const photo = await this.prisma.photos.findFirst({ where: { temp_token: tempToken } });
    if (!photo) throw new NotFoundException('Photo not found');
    await this.prisma.photos.update({
      where: { id: photo.id },
      data: { task_hazard_id: dto.task_hazard_id, temp_token: null },
    });
  }

  /**
   * Resolve the photo on a (size, sig, exp) request. Returns the bytes
   * + content type, or null if the request is unauthenticated.
   * ``legacyUsed`` is true when the caller presented a JWT (the
   * legacy ?token= path); the controller sets a deprecation header
   * in that case.
   */
  async serveSigned(
    photoId: string,
    size: 'original' | 'thumbnail',
    sig: string,
    exp: number,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    if (!this.signer.verify(photoId, size, exp, sig)) return null;
    return this.serve(photoId, size, false);
  }

  async serveLegacy(
    photoId: string,
    size: 'original' | 'thumbnail',
    userId: string,
  ): Promise<{ body: Buffer; contentType: string; legacy: boolean } | null> {
    // legacyUsed = true; the route already validated the JWT and
    // confirmed is_active, but we re-check here to avoid trusting
    // a route that forgot.
    const user = await this.prisma.users.findFirst({
      where: { id: userId, is_active: true },
    });
    if (!user) return null;
    return this.serve(photoId, size, true);
  }

  private async serve(
    photoId: string,
    size: 'original' | 'thumbnail',
    legacy: boolean,
  ): Promise<{ body: Buffer; contentType: string; legacy: boolean } | null> {
    const photo = await this.prisma.photos.findFirst({ where: { id: photoId } });
    if (!photo) return null;
    if (photo.task_hazard_id !== null) {
      // Bound photo: the task must still be active and not cancelled.
      const th = await this.prisma.task_hazards.findFirst({
        where: { id: photo.task_hazard_id },
        include: { review_tasks: true },
      });
      if (!th || !th.review_tasks || th.review_tasks.status === 'cancelled') return null;
    } else if (photo.temp_token === null) {
      // Bound once but the binding is gone? Refuse.
      return null;
    }
    const key = size === 'original' ? photo.original_path : photo.thumbnail_path;
    try {
      const body = await this.storage.getObject(key);
      return { body, contentType: photo.mime_type ?? 'image/jpeg', legacy };
    } catch {
      return null;
    }
  }

  async delete(photoId: string): Promise<void> {
    const photo = await this.prisma.photos.findFirst({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');
    if (photo.task_hazard_id !== null) {
      const th = await this.prisma.task_hazards.findFirst({
        where: { id: photo.task_hazard_id },
        include: { review_tasks: true },
      });
      if (th?.review_tasks && th.review_tasks.status !== 'pending') {
        throw new BadRequestException('Cannot delete photo from a completed or cancelled task');
      }
    }
    await this.storage.deleteObject(photo.original_path);
    await this.storage.deleteObject(photo.thumbnail_path);
    await this.prisma.photos.update({
      where: { id: photo.id },
      data: { deleted_at: new Date() },
    });
  }
}
