import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const INSECURE_FALLBACK = 'your-secret-key-change-in-production';

export function hashPassword(plain: string): string {
  // bcrypt has a 72-byte input limit; truncate defensively.
  const buf = Buffer.from(plain, 'utf-8').subarray(0, 72);
  const salt = bcrypt.genSaltSync(BCRYPT_ROUNDS);
  return bcrypt.hashSync(buf, salt).toString();
}

export function verifyPassword(plain: string, hashed: string): boolean {
  if (!plain || !hashed) return false;
  try {
    const buf = Buffer.from(plain, 'utf-8').subarray(0, 72);
    return bcrypt.compareSync(buf, hashed);
  } catch {
    return false;
  }
}

export function needsRehash(hashed: string): boolean {
  const parts = hashed.split('$');
  if (parts.length < 4) return true;
  const cost = parseInt(parts[2], 10);
  if (Number.isNaN(cost)) return true;
  return cost < BCRYPT_ROUNDS;
}

export const INSECURE_DEFAULT_SECRET = INSECURE_FALLBACK;
