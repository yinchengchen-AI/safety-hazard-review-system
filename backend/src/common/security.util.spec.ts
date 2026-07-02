import { hashPassword, verifyPassword, needsRehash } from './security.util';
import * as bcrypt from 'bcrypt';

describe('security.util', () => {
  it('round-trips a password', () => {
    const h = hashPassword('hunter2');
    expect(h).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(verifyPassword('hunter2', h)).toBe(true);
    expect(verifyPassword('hunter3', h)).toBe(false);
  });

  it('handles 72-byte truncation', () => {
    const longPwd = 'a'.repeat(100);
    const h = hashPassword(longPwd);
    expect(verifyPassword('a'.repeat(72), h)).toBe(true);
    expect(verifyPassword(longPwd, h)).toBe(true);
  });

  it('rejects empty inputs', () => {
    const h = hashPassword('something');
    expect(verifyPassword('', h)).toBe(false);
    expect(verifyPassword('something', '')).toBe(false);
  });

  it('detects low-cost hashes for rehash', () => {
    const low = bcrypt.hashSync(Buffer.from('x'), bcrypt.genSaltSync(4)).toString();
    expect(needsRehash(low)).toBe(true);
    const ok = hashPassword('abc');
    expect(needsRehash(ok)).toBe(false);
  });
});
