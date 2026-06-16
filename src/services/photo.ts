import { randomUUID } from 'crypto';
import { minio, BUCKET, ensureBucket } from '@/lib/minio';
import { prisma } from '@/lib/prisma';

export const PhotoService = {
  async upload(buffer: Buffer, mimeType: string, originalName: string, userId: string) {
    await ensureBucket();
    const ext = originalName.split('.').pop() || 'bin';
    const storageKey = `photos/${randomUUID()}.${ext}`;
    await minio.putObject(BUCKET, storageKey, buffer, buffer.length, { 'Content-Type': mimeType });
    // 不写 ReviewPhoto，等提交 review 时再绑（见 ReviewService.submit）
    return { storageKey, originalName, mimeType, sizeBytes: buffer.length, uploadedById: userId };
  },

  async getSignedUrl(storageKey: string, ttlSeconds = 3600): Promise<string> {
    return minio.presignedGetObject(BUCKET, storageKey, ttlSeconds);
  },

  async delete(storageKey: string) {
    await minio.removeObject(BUCKET, storageKey);
  },

  /**
   * 批量绑定已上传的 photo 到 review
   */
  async attachToReview(
    reviewId: string,
    photoMetas: { storageKey: string; takenAt: Date; gpsLat?: number; gpsLng?: number }[],
    capturedById: string,
  ) {
    return prisma.reviewPhoto.createMany({
      data: photoMetas.map((m) => ({ ...m, reviewId, capturedById, syncStatus: 'SYNCED' })),
    });
  },
};
