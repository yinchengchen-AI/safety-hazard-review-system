import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { UUID } from 'crypto';

const DELIMITER = '|';  // illegal in UUIDs and in our `size` enum

@Injectable()
export class UrlSignerService {
  private readonly secret: string;
  private readonly ttl: number;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('SECRET_KEY') ?? '';
    this.ttl = config.get<number>('PHOTO_SIGNATURE_TTL', 900);
  }

  private payload(photoId: string, size: string, exp: number): Buffer {
    return Buffer.from(`${photoId}${DELIMITER}${size}${DELIMITER}${exp}`);
  }

  private sign(payload: Buffer): string {
    return createHmac('sha256', this.secret).update(payload).digest('hex');
  }

  signPhotoUrl(photoId: string, size: 'original' | 'thumbnail'): string {
    const exp = Math.floor(Date.now() / 1000) + this.ttl;
    const sig = this.sign(this.payload(photoId, size, exp));
    return `/api/v1/photos/${photoId}/image?size=${size}&exp=${exp}&sig=${sig}`;
  }

  buildLegacyTokenUrl(photoId: string, size: string, token: string): string {
    // Kept for the deprecation window where clients still hit
    // ?token=<jwt>; the route rejects disabled/deleted users.
    return `/api/v1/photos/${photoId}/image?size=${size}&token=${token}`;
  }

  verify(photoId: string, size: string, exp: number, sig: string): boolean {
    if (!sig || !exp) return false;
    const expInt = Number(exp);
    if (!Number.isFinite(expInt)) return false;
    if (expInt < Math.floor(Date.now() / 1000)) return false;
    const expected = this.sign(this.payload(photoId, size, expInt));
    try {
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
    } catch {
      return false;
    }
  }
}
