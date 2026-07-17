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

  signPhotoUrl(
    photoId: string,
    size: 'original' | 'thumbnail',
    uaHint: string | null = null,
  ): string {
    const exp = Math.floor(Date.now() / 1000) + this.ttl;
    const baseSig = this.sign(this.payload(photoId, size, exp));
    const sig = uaHint ? this.signWithHint(this.payload(photoId, size, exp), uaHint) : baseSig;
    const hintParam = uaHint ? `&u=${encodeURIComponent(uaHint)}` : '';
    // P1-14: optionally bind the signature to the first 16 chars
    // of the requesting UA so a captured URL won't replay cleanly
    // from a different client (Referer leak, shared logs, packet
    // dump). Caller passes null to keep the URL portable.
    return `/api/v1/photos/${photoId}/image?size=${size}&exp=${exp}&sig=${sig}${hintParam}`;
  }

  private signWithHint(payload: Buffer, uaHint: string): string {
    return createHmac('sha256', this.secret)
      .update(Buffer.concat([payload, Buffer.from('|' + uaHint)]))
      .digest('hex');
  }

  buildLegacyTokenUrl(photoId: string, size: string, token: string): string {
    return `/api/v1/photos/${photoId}/image?size=${size}&token=${token}`;
  }

  verify(
    photoId: string,
    size: string,
    exp: number,
    sig: string,
    uaHint: string | null = null,
  ): boolean {
    if (!sig || !exp) return false;
    const expInt = Number(exp);
    if (!Number.isFinite(expInt)) return false;
    if (expInt < Math.floor(Date.now() / 1000)) return false;
    const expectedPlain = this.sign(this.payload(photoId, size, expInt));
    const expectedHinted = uaHint
      ? this.signWithHint(this.payload(photoId, size, expInt), uaHint)
      : null;
    try {
      const provided = Buffer.from(sig, 'hex');
      if (expectedHinted) {
        const hintBuf = Buffer.from(expectedHinted, 'hex');
        if (hintBuf.length === provided.length && timingSafeEqual(hintBuf, provided)) {
          return true;
        }
      }
      const plainBuf = Buffer.from(expectedPlain, 'hex');
      if (plainBuf.length === provided.length && timingSafeEqual(plainBuf, provided)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
