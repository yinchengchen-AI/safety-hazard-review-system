import { describe, it, expect, beforeEach, vi } from 'vitest';

const { putObject, presignedGetObject, removeObject, ensureBucket, createMany } = vi.hoisted(() => ({
  putObject: vi.fn(),
  presignedGetObject: vi.fn(),
  removeObject: vi.fn(),
  ensureBucket: vi.fn(),
  createMany: vi.fn().mockResolvedValue({ count: 2 }),
}));

vi.mock('@/lib/minio', () => ({
  minio: { putObject, presignedGetObject, removeObject },
  BUCKET: 'shr-photos',
  ensureBucket,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: { reviewPhoto: { createMany } },
}));

import { PhotoService } from '@/services/photo';

describe('PhotoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMany.mockResolvedValue({ count: 2 });
  });

  it('upload calls ensureBucket, stores under photos/<uuid>.<ext>, returns metadata', async () => {
    putObject.mockResolvedValueOnce({ etag: 'x' });
    const r = await PhotoService.upload(Buffer.from('fake'), 'image/jpeg', 'photo.jpg', 'u1');
    expect(ensureBucket).toHaveBeenCalled();
    expect(putObject).toHaveBeenCalledWith(
      'shr-photos',
      expect.stringMatching(/^photos\/[0-9a-f-]{36}\.jpg$/),
      expect.any(Buffer),
      4,
      { 'Content-Type': 'image/jpeg' },
    );
    expect(r).toEqual({
      storageKey: expect.stringMatching(/^photos\//),
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      uploadedById: 'u1',
    });
  });

  it('upload uses the part after the last dot as the extension', async () => {
    putObject.mockResolvedValueOnce({ etag: 'x' });
    const r = await PhotoService.upload(Buffer.from('x'), 'application/octet-stream', 'report.pdf', 'u1');
    expect(r.storageKey).toMatch(/\.pdf$/);
  });

  it('getSignedUrl delegates to minio.presignedGetObject with default ttl', async () => {
    presignedGetObject.mockResolvedValueOnce('https://signed/url');
    const u = await PhotoService.getSignedUrl('photos/abc.jpg');
    expect(presignedGetObject).toHaveBeenCalledWith('shr-photos', 'photos/abc.jpg', 3600);
    expect(u).toBe('https://signed/url');
  });

  it('getSignedUrl honors custom ttl', async () => {
    presignedGetObject.mockResolvedValueOnce('https://signed/url?ttl=60');
    await PhotoService.getSignedUrl('photos/abc.jpg', 60);
    expect(presignedGetObject).toHaveBeenCalledWith('shr-photos', 'photos/abc.jpg', 60);
  });

  it('delete calls minio.removeObject', async () => {
    removeObject.mockResolvedValueOnce(undefined);
    await PhotoService.delete('photos/abc.jpg');
    expect(removeObject).toHaveBeenCalledWith('shr-photos', 'photos/abc.jpg');
  });

  it('attachToReview creates ReviewPhoto rows with SYNCED status', async () => {
    const metas = [
      { storageKey: 'photos/a.jpg', takenAt: new Date(), gpsLat: 1.23, gpsLng: 4.56 },
      { storageKey: 'photos/b.jpg', takenAt: new Date() },
    ];
    const r = await PhotoService.attachToReview('r1', metas, 'u1');
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { ...metas[0], reviewId: 'r1', capturedById: 'u1', syncStatus: 'SYNCED' },
        { ...metas[1], reviewId: 'r1', capturedById: 'u1', syncStatus: 'SYNCED' },
      ],
    });
    expect(r).toEqual({ count: 2 });
  });
});
