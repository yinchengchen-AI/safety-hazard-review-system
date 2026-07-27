import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { UrlSignerService } from '../../storage/url-signer.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PhotoBindRequestDto, PhotoListItemDto, PhotoUploadResponseDto } from './dto/photo.dto';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIN_DIM = 100;
const MAX_DIM = 8192;

// Magic-byte fingerprints for the formats we accept. sharp.metadata()
// accepts a lot of formats we don't want; checking the first bytes
// narrows the input to the actual allowed set.
const MAGIC = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

function detectMimeFromMagic(buf: Buffer): string | null {
  for (const m of MAGIC) {
    if (buf.length < m.bytes.length) continue;
    let ok = true;
    for (let i = 0; i < m.bytes.length; i++) {
      if (buf[i] !== m.bytes[i]) { ok = false; break; }
    }
    if (ok) return m.mime;
  }
  return null;
}

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly signer: UrlSignerService,
    private readonly audit: AuditLogsService,
  ) {}

  async upload(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    currentUserId?: string,
  ): Promise<PhotoUploadResponseDto> {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }
    // 1. Magic-byte check first — the client-supplied Content-Type
    //    is informational. We refuse anything that doesn't start
    //    with JPEG or PNG bytes regardless of the header.
    const detected = detectMimeFromMagic(buffer);
    if (!detected) {
      throw new BadRequestException('Invalid file type: magic bytes do not match a known image format');
    }
    if (!ALLOWED_MIME.has(detected)) {
      throw new BadRequestException(`Invalid file type: ${detected}`);
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
        mime_type: detected,
        width: w,
        height: h,
        temp_token: tempToken,
        uploader_id: currentUserId ?? null,
      },
    });

    await this.audit.record({
      userId: currentUserId ?? null,
      action: 'photo.upload',
      targetType: 'photo',
      targetId: photo.id,
      detail: { bytes: buffer.length, width: w, height: h },
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

  async bind(
    tempToken: string,
    dto: PhotoBindRequestDto,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<void> {
    if (!currentUserId) throw new BadRequestException('Authentication required');
    const photo = await this.prisma.photos.findFirst({ where: { temp_token: tempToken } });
    if (!photo) throw new NotFoundException('Photo not found');
    // Only the uploader or an admin may attach a photo to a
    // task_hazard row. Without this check anyone who learns a
    // temp_token could attach the wrong photo to the wrong task.
    if (currentUserRole !== 'admin' && photo.uploader_id !== currentUserId) {
      throw new BadRequestException('Only the uploader or an admin can bind this photo');
    }
    // Confirm the task_hazard row exists and belongs to a
    // pending task. Binding to a completed/cancelled task would
    // alter historical evidence.
    const th = await this.prisma.task_hazards.findFirst({
      where: { id: dto.task_hazard_id },
      include: { review_tasks: true },
    });
    if (!th || !th.review_tasks) {
      throw new BadRequestException('Target task_hazard does not exist');
    }
    if (th.review_tasks.status !== 'pending') {
      throw new BadRequestException('Cannot bind photo to a completed or cancelled task');
    }
    await this.prisma.photos.update({
      where: { id: photo.id },
      data: { task_hazard_id: dto.task_hazard_id, temp_token: null },
    });
    await this.audit.record({
      userId: currentUserId ?? null,
      action: 'photo.bind',
      targetType: 'photo',
      targetId: photo.id,
      detail: { task_hazard_id: dto.task_hazard_id },
    });
  }

  async listByTaskHazard(taskHazardId: string): Promise<PhotoListItemDto[]> {
    const th = await this.prisma.task_hazards.findFirst({
      where: { id: taskHazardId, deleted_at: null },
    });
    if (!th) throw new NotFoundException('Task hazard not found');
    const photos = await this.prisma.photos.findMany({
      where: { task_hazard_id: taskHazardId, deleted_at: null },
      orderBy: { uploaded_at: 'asc' },
    });
    // URLs are signed on demand (same as the upload response) so
    // the returned links are always within the signature TTL.
    return photos.map((photo) => ({
      id: photo.id,
      task_hazard_id: taskHazardId,
      original_url: this.signer.signPhotoUrl(photo.id, 'original'),
      thumbnail_url: this.signer.signPhotoUrl(photo.id, 'thumbnail'),
      created_at: photo.uploaded_at,
    }));
  }

  async serveSigned(
    photoId: string,
    size: 'original' | 'thumbnail',
    sig: string,
    exp: number,
    uaHint: string | null = null,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    if (!this.signer.verify(photoId, size, exp, sig, uaHint)) return null;
    return this.serve(photoId, size);
  }

  private async serve(
    photoId: string,
    size: 'original' | 'thumbnail',
  ): Promise<{ body: Buffer; contentType: string } | null> {
    const photo = await this.prisma.photos.findFirst({ where: { id: photoId } });
    if (!photo) return null;
    if (photo.task_hazard_id !== null) {
      const th = await this.prisma.task_hazards.findFirst({
        where: { id: photo.task_hazard_id },
        include: { review_tasks: true },
      });
      if (!th || !th.review_tasks || th.review_tasks.status === 'cancelled') return null;
    } else if (photo.temp_token === null) {
      return null;
    }
    const key = size === 'original' ? photo.original_path : photo.thumbnail_path;
    try {
      const body = await this.storage.getObject(key);
      return { body, contentType: photo.mime_type ?? 'image/jpeg' };
    } catch {
      return null;
    }
  }

  async delete(
    photoId: string,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<void> {
    if (!currentUserId) throw new BadRequestException('Authentication required');
    const photo = await this.prisma.photos.findFirst({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');
    if (currentUserRole !== 'admin' && photo.uploader_id !== currentUserId) {
      throw new BadRequestException('Only the uploader or an admin can delete this photo');
    }
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
    await this.audit.record({
      userId: currentUserId ?? null,
      action: 'photo.delete',
      targetType: 'photo',
      targetId: photo.id,
    });
  }
}
