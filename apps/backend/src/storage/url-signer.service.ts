import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const DELIMITER = '|';

@Injectable()
export class UrlSignerService {
  private readonly logger = new Logger(UrlSignerService.name);
  private readonly secret: string;
  private readonly ttl: number;

  constructor(config: ConfigService) {
    const explicit = config.get<string>('PHOTO_SIGNATURE_SECRET');
    const jwt = config.get<string>('SECRET_KEY') ?? '';
    if (explicit) {
      this.secret = explicit;
    } else {
      this.logger.warn(
        'PHOTO_SIGNATURE_SECRET is not configured; falling back to SECRET_KEY. ' +
          'This is a dev-only fallback: a JWT secret rotation will invalidate every signed photo URL.',
      );
      this.secret = jwt;
    }
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
