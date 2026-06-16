import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/minio', () => ({
  minio: { putObject: vi.fn().mockResolvedValue({ etag: 'abc' }) },
  BUCKET: 'shr-photos',
  ensureBucket: vi.fn(),
}));

import { PhotoService } from '@/services/photo';

describe('PhotoService.upload', () => {
  it('returns storageKey and originalName', async () => {
    const r = await PhotoService.upload(Buffer.from('fake'), 'image/jpeg', 'photo.jpg', 'u1');
    expect(r.storageKey).toMatch(/^photos\//);
    expect(r.originalName).toBe('photo.jpg');
  });
});
